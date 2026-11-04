-- =====================================================================
-- L'ANNULLO DAL GESTIONALE È SOSPESO — 04/11/2026, collaudo dal fornitore.
-- =====================================================================
--
-- 🔴 COSA È SUCCESSO. Sul registratore di prova (in modalità MF, non RT:
--    lo scontrino dice «SF.» e ha il logo «/F») il «VOID …» è stato
--    stampato come una riga di testo, e le righe dello scontrino che il
--    ponte mandava dopo sono diventate una VENDITA NUOVA (11:23 e 11:51).
--    Il manuale Epson Rev. U, §5.6 (pag. 45): il documento di annullo c'è
--    solo sui registratori RT.
-- 🔴 COSA FA QUESTA MIGRAZIONE. Finché `annullo_sospeso()` è vero:
--    · `accoda_annullo` rifiuta;
--    · il ponte non prende nessun annullo, nemmeno un ponte vecchio;
--    · gli annulli ancora in coda diventano falliti, senza partire.
--    Il ponte nuovo manda comunque solo il VOID del §11.29, dopo aver
--    chiesto lo stato RT (ponte/esegui.mjs).
-- ⚠️ Per riaccenderlo: una migrazione che fa tornare falso
--    `annullo_sospeso()`, dopo una prova su un registratore in modalità RT
--    e col sì di Alessio.

create or replace function public.annullo_sospeso()
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select true
$function$;

revoke all on function public.annullo_sospeso() from public, anon, authenticated;
comment on function public.annullo_sospeso() is
  'Vero finché l''annullo dello scontrino dal gestionale è sospeso (dal 04/11/2026, collaudo: il VOID è uscito come vendita su un registratore in modalità MF).';

-- Gli annulli che aspettano: falliti, non partono.
update lavori_stampa
   set stato = 'fallito', finito_il = now(), errore_codice = 'rifiutato',
       errore_testo = 'L''annullo dal gestionale è stato sospeso prima che partisse: fallo a mano dal registratore.'
 where tipo = 'annullo' and stato = 'in_coda';

-- rete-guardie: accoda_annullo — aggiunto il rifiuto «sospeso», niente tolto
create or replace function public.accoda_annullo(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order orders%rowtype;
  v_s     lavori_stampa%rowtype;
  v_disp  dispositivi%rowtype;
  v_rif   text;
  v_matricola text;
  v_id    uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può annullare uno scontrino.';
  end if;
  -- 🔴 Sospeso dal 04/11 (vedi in testa al file).
  if annullo_sospeso() then
    raise exception 'L''annullo dal gestionale è sospeso: fallo a mano dal registratore.';
  end if;
  perform scadi_lavori_abbandonati();

  -- Il conto si blocca: due tocchi insieme passano uno alla volta.
  select * into v_order from orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'Questo conto non c''è più: ricarica la pagina.';
  end if;

  select * into v_s from lavori_stampa
   where order_id = p_order and tipo = 'scontrino' and stato <> 'annullato';
  if v_s.id is null then
    raise exception 'Questo conto non ha uno scontrino da annullare.';
  end if;
  -- 🔴 Mai annullare uno scontrino che non è uscito di sicuro.
  if v_s.stato <> 'stampato' then
    raise exception 'Lo scontrino di questo conto non è uscito di sicuro (%): non si annulla. Guarda il registratore.', v_s.stato;
  end if;
  if exists (select 1 from lavori_stampa where scontrino_id = v_s.id and tipo = 'annullo' and stato <> 'annullato') then
    raise exception 'L''annullo di questo scontrino è già stato chiesto: guarda come è andato, non rifarlo.';
  end if;

  select * into v_disp from dispositivi where id = v_s.dispositivo_id;
  if v_disp.id is null or not v_disp.attivo then
    raise exception 'Il registratore che ha emesso questo scontrino è spento nel gestionale: accendilo dalla pagina Stampanti.';
  end if;
  -- 🔴 LA MATRICOLA È QUELLA DELLO SCONTRINO, non quella di oggi del
  --    registratore (Alessio, 04/11): prima quella che il registratore ha
  --    scritto nella risposta, poi quella salvata quando lo scontrino è
  --    entrato in coda. Cambiare la matricola nel gestionale non tocca gli
  --    scontrini già fatti.
  v_matricola := case when v_s.esito->'scontrino'->>'matricola' ~ '^[0-9A-Z]{11}$'
                     then v_s.esito->'scontrino'->>'matricola' else v_s.matricola end;
  if v_matricola is null then
    raise exception 'Manca la matricola del registratore: scrivila nella pagina Stampanti (è stampata in fondo allo scontrino).';
  end if;
  v_rif := riferimento_annullo(v_s.esito, v_matricola);
  if v_rif is null then
    raise exception 'Mancano numero, data o chiusura di questo scontrino: annullalo a mano dal registratore.';
  end if;

  begin
    insert into lavori_stampa (dispositivo_id, tipo, order_id, scontrino_id, contenuto)
    values (v_disp.id, 'annullo', p_order, v_s.id,
            v_s.contenuto || jsonb_build_object('riferimento', v_rif))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'L''annullo di questo scontrino è già stato chiesto: guarda come è andato, non rifarlo.';
  end;
  return v_id;
end $function$;


revoke all on function public.accoda_annullo(uuid) from public, anon, authenticated;
grant execute on function public.accoda_annullo(uuid) to authenticated;

-- (ponte_prendi_lavori: aggiunto il filtro sugli annulli sospesi, niente tolto.)
create or replace function public.ponte_prendi_lavori(p_chiave text, p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_presi  jsonb;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;

  -- rete-guardie: ponte_prendi_lavori — i lavori abbandonati diventano incerti in scadi_lavori_abbandonati(), chiamata qui, non più scritti dentro (revisione del database, 28/10)
  perform scadi_lavori_abbandonati();

  with presi as (
    select l.id from lavori_stampa l
      join dispositivi d on d.id = l.dispositivo_id and d.attivo
     where l.stato = 'in_coda'
       -- Una comanda che la stampante non ha ricevuto aspetta il suo turno.
       and (l.riprova_dopo is null or l.riprova_dopo <= now())
       -- 🔴 Un annullo non si prende finché è sospeso: nemmeno un ponte
       --    vecchio, che lo manderebbe con le righe di vendita.
       and (l.tipo <> 'annullo' or not annullo_sospeso())
     order by l.creato_il
     limit greatest(1, least(coalesce(p_limite, 5), 10))
     for update of l skip locked
  ), aggiornati as (
    update lavori_stampa l
       set stato = 'in_corso', preso_il = now(), preso_da = v_chiave, tentativi = l.tentativi + 1
      from presi where l.id = presi.id
    returning l.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'tipo', a.tipo, 'contenuto', a.contenuto,
           'dispositivo', jsonb_build_object(
             'id', d.id, 'nome', d.nome, 'tipo', d.tipo, 'protocollo', d.protocollo,
             'indirizzo', host(d.indirizzo), 'porta', d.porta))
           order by a.creato_il), '[]'::jsonb)
    into v_presi
    from aggiornati a join dispositivi d on d.id = a.dispositivo_id;

  return v_presi;
end $function$;


revoke all on function public.ponte_prendi_lavori(text, integer) from public, anon, authenticated;
grant execute on function public.ponte_prendi_lavori(text, integer) to anon, authenticated;

-- Verifica
do $verifica$
declare
  v_titolare uuid;
  v_ok       boolean := false;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare in user_roles.';
  end if;
  if not annullo_sospeso() then
    raise exception 'VERIFICA: l''annullo non risulta sospeso.';
  end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    perform accoda_annullo(gen_random_uuid());
  exception when others then v_ok := sqlerrm like '%sospeso%';
  end;
  perform set_config('request.jwt.claims', null, true);
  if not v_ok then
    raise exception 'VERIFICA: con l''annullo sospeso accoda_annullo non rifiuta.';
  end if;
  if exists (select 1 from lavori_stampa where tipo = 'annullo' and stato = 'in_coda') then
    raise exception 'VERIFICA: è rimasto un annullo in coda.';
  end if;
  raise notice 'Fatto: l''annullo è sospeso; accoda_annullo rifiuta, nessun annullo in coda, il ponte non ne prende.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000006', 'l_annullo_e_sospeso')
on conflict (version) do nothing;
