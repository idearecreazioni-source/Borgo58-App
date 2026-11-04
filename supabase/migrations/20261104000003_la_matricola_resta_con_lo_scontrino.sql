-- =====================================================================
-- LA MATRICOLA RESTA CON LO SCONTRINO — 04/11/2026, chiesto da Alessio al
-- collaudo: la matricola del registratore di prova è provvisoria
-- (99MEX063404) e verrà sostituita da quella definitiva.
-- =====================================================================
--
-- 🔴 La matricola si cambia dal gestionale quando si vuole («Modifica» sul
--    registratore, pagina Stampanti: c'è dal 20261104000002). Ma l'annullo
--    di uno scontrino deve usare la matricola CON CUI È STATO EMESSO, non
--    quella di oggi: dopo il cambio, gli scontrini vecchi si annullano con
--    la loro.
--
-- Quindi ogni scontrino la porta con sé (`lavori_stampa.matricola`):
--    · quando entra in coda prende quella del registratore in quel momento;
--    · se il registratore non l'aveva ancora, la prende la PRIMA volta che
--      il titolare la scrive (solo se è ancora vuota: un cambio dopo non
--      tocca gli scontrini che ce l'hanno già);
--    · se il registratore la mette nella risposta (`serialNumber`, da
--      fpmate.cgi 1.042), vale quella.
-- ⚠️ Niente in produzione: lì non c'è nessun registratore.

-- ---------------------------------------------------------------------
-- 1. La colonna, e chi la scrive
-- ---------------------------------------------------------------------
alter table lavori_stampa add column if not exists matricola text;
alter table lavori_stampa drop constraint if exists lavoro_matricola_ben_scritta;
alter table lavori_stampa add constraint lavoro_matricola_ben_scritta
  check (matricola is null or (tipo = 'scontrino' and matricola ~ '^[0-9A-Z]{11}$'));
comment on column lavori_stampa.matricola is
  'Per uno scontrino: la matricola del registratore quando è stato emesso. L''annullo usa questa, non quella di oggi.';

create or replace function public.scontrino_prende_la_matricola()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.tipo = 'scontrino' and new.matricola is null then
    -- `for share`: se il titolare la sta scrivendo proprio ora, si aspetta
    -- e si legge quella nuova (revisione del database, 04/11).
    select matricola into new.matricola from dispositivi where id = new.dispositivo_id for share;
  end if;
  return new;
end $function$;

revoke all on function public.scontrino_prende_la_matricola() from public, anon, authenticated;

drop trigger if exists scontrino_prende_la_matricola on lavori_stampa;
create trigger scontrino_prende_la_matricola
  before insert on lavori_stampa
  for each row execute function scontrino_prende_la_matricola();

-- La prima matricola scritta va agli scontrini di quel registratore che
-- non ne hanno ancora una. Le volte dopo non tocca niente.
create or replace function public.matricola_agli_scontrini_senza()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.matricola is not null and new.matricola is distinct from old.matricola then
    update lavori_stampa set matricola = new.matricola
     where dispositivo_id = new.id and tipo = 'scontrino' and matricola is null;
  end if;
  return new;
end $function$;

revoke all on function public.matricola_agli_scontrini_senza() from public, anon, authenticated;

drop trigger if exists matricola_agli_scontrini_senza on dispositivi;
create trigger matricola_agli_scontrini_senza
  after update of matricola on dispositivi
  for each row execute function matricola_agli_scontrini_senza();

-- 🔴 Una matricola scritta su uno scontrino non cambia più, da nessuna
--    parte (revisione del database, 04/11). ⚠️ Il limite che resta: se la
--    PRIMA matricola scritta nel gestionale è sbagliata, gli scontrini che
--    l'hanno presa la tengono; vale comunque quella che il registratore
--    mette nella risposta, se la mette.
create or replace function public.matricola_dello_scontrino_non_cambia()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.matricola is not null and new.matricola is distinct from old.matricola then
    raise exception 'La matricola di uno scontrino già fatto non si cambia.';
  end if;
  return new;
end $function$;

revoke all on function public.matricola_dello_scontrino_non_cambia() from public, anon, authenticated;

drop trigger if exists matricola_dello_scontrino_non_cambia on lavori_stampa;
create trigger matricola_dello_scontrino_non_cambia
  before update of matricola on lavori_stampa
  for each row execute function matricola_dello_scontrino_non_cambia();

-- Gli scontrini già fatti prendono la matricola di oggi, se c'è: fino a
-- adesso non è mai cambiata.
update lavori_stampa l set matricola = d.matricola
  from dispositivi d
 where d.id = l.dispositivo_id and l.tipo = 'scontrino' and l.matricola is null and d.matricola is not null;

-- ---------------------------------------------------------------------
-- 2. L'annullo e l'elenco usano la matricola dello scontrino
-- ---------------------------------------------------------------------
-- rete-guardie: accoda_annullo — tolto il rifiuto «la matricola scritta nel gestionale non è quella che il registratore ha messo sullo scontrino»: l'annullo usa direttamente quella dello scontrino, e il confronto con quella di oggi non serve più
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

create or replace function public.scontrini_recenti(p_limite integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare vede gli scontrini.';
  end if;
  return coalesce((
    select jsonb_agg(x.riga order by x.creato_il desc)
      from (
        select s.creato_il, jsonb_build_object(
                 'order_id', s.order_id,
                 'tavolo', o.table_label,
                 'stato', s.stato,
                 'totale', s.contenuto->'totale',
                 'numero', s.esito->'scontrino'->>'numero',
                 'data', s.esito->'scontrino'->>'data',
                 'ora', s.esito->'scontrino'->>'ora',
                 'chiusura', s.esito->'scontrino'->>'chiusura',
                 'riferimento', riferimento_annullo(s.esito, case when s.esito->'scontrino'->>'matricola' ~ '^[0-9A-Z]{11}$' then s.esito->'scontrino'->>'matricola' else s.matricola end),
                 'annullo', (select jsonb_build_object('stato', a.stato, 'numero', a.esito->'annullo'->>'numero',
                                                       'errore', a.errore_testo)
                               from lavori_stampa a
                              where a.scontrino_id = s.id and a.tipo = 'annullo'
                              order by (a.stato <> 'annullato') desc, a.creato_il desc limit 1)) as riga
          from lavori_stampa s
          join orders o on o.id = s.order_id
         where s.tipo = 'scontrino' and s.stato <> 'annullato'
         order by s.creato_il desc
         limit greatest(1, least(coalesce(p_limite, 20), 50))
      ) x), '[]'::jsonb);
end $function$;

revoke all on function public.scontrini_recenti(integer) from public, anon, authenticated;
grant execute on function public.scontrini_recenti(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_ente     uuid;
  v_disp     uuid;
  v_ordine   uuid;
  v_ordine2  uuid;
  v_k        jsonb;
  v_s1       uuid;
  v_s2       uuid;
  v_a        uuid;
  v_claims   text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_titolare is null or v_ente is null then
    raise exception 'VERIFICA: servono un titolare e un''entità.';
  end if;
  v_claims := json_build_object('sub', v_titolare, 'role', 'authenticated')::text;

  begin
    update dispositivi set attivo = false where attivo;
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta)
    values ('ZZ registratore della matricola', 'registratore_fiscale', 'simulatore', '127.0.0.1', 19194)
    returning id into v_disp;
    insert into orders (entity_id, table_label, status, coperti)
    values (v_ente, 'ZZ primo tavolo della matricola', 'aperto', 0) returning id into v_ordine;
    insert into orders (entity_id, table_label, status, coperti)
    values (v_ente, 'ZZ secondo tavolo della matricola', 'aperto', 0) returning id into v_ordine2;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ calice', 'bar', 1, 5), (v_ordine2, 'ZZ acqua', 'bar', 1, 2);
    update order_items set sent_at = now() where order_id in (v_ordine, v_ordine2);

    perform set_config('request.jwt.claims', v_claims, true);
    perform close_order_paid(v_ordine, 'contante', 0, null, false);
    perform close_order_paid(v_ordine2, 'contante', 0, null, false);
    v_k := crea_chiave_ponte('ZZ ponte della matricola');

    -- (1) Primo scontrino senza matricola sul registratore; poi il titolare
    --     scrive quella provvisoria: lo scontrino la prende.
    v_s1 := accoda_scontrino(v_ordine);
    if (select matricola from lavori_stampa where id = v_s1) is not null then
      raise exception 'VERIFICA (1a): uno scontrino ha una matricola che il registratore non aveva.';
    end if;
    set local role authenticated;
    update dispositivi set matricola = '99MEX063404' where id = v_disp;
    reset role;
    if (select matricola from lavori_stampa where id = v_s1) is distinct from '99MEX063404' then
      raise exception 'VERIFICA (1b): lo scontrino senza matricola non ha preso la prima scritta.';
    end if;

    -- (2) Arriva la matricola definitiva: il secondo scontrino prende quella,
    --     il primo tiene la sua.
    set local role authenticated;
    update dispositivi set matricola = '99IEC123456' where id = v_disp;
    reset role;
    v_s2 := accoda_scontrino(v_ordine2);
    if (select matricola from lavori_stampa where id = v_s1) <> '99MEX063404'
       or (select matricola from lavori_stampa where id = v_s2) <> '99IEC123456' then
      raise exception 'VERIFICA (2): il cambio di matricola ha toccato uno scontrino già fatto.';
    end if;

    -- (3) L'annullo del primo usa la provvisoria, l'elenco quella di ognuno.
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_s1, 'stampato', null, null, 'pronto',
      '{"scontrino":{"numero":"14","data":"4/11/2026","ora":"9:33","chiusura":"1627"}}'::jsonb);
    perform ponte_esito_lavoro(v_k->>'chiave', v_s2, 'stampato', null, null, 'pronto',
      '{"scontrino":{"numero":"1","data":"5/11/2026","ora":"12:00","chiusura":"1628"}}'::jsonb);
    perform set_config('request.jwt.claims', v_claims, true);
    v_a := accoda_annullo(v_ordine);
    if (select contenuto->>'riferimento' from lavori_stampa where id = v_a) <> 'VOID 1627 0014 04112026 99MEX063404' then
      raise exception 'VERIFICA (3a): l''annullo non usa la matricola dello scontrino: %.',
        (select contenuto->>'riferimento' from lavori_stampa where id = v_a);
    end if;
    if not exists (select 1 from jsonb_array_elements(scontrini_recenti(10)) e
                    where (e->>'order_id')::uuid = v_ordine2 and e->>'riferimento' = 'VOID 1628 0001 05112026 99IEC123456') then
      raise exception 'VERIFICA (3b): l''elenco degli scontrini non usa la matricola di ognuno.';
    end if;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della matricola dello scontrino');

  raise notice 'Fatto: uno scontrino prende la matricola del registratore quando entra in coda, o la prima che il titolare scrive; un cambio di matricola non tocca gli scontrini già fatti; l''annullo e l''elenco usano quella di ognuno. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000003', 'la_matricola_resta_con_lo_scontrino')
on conflict (version) do nothing;
