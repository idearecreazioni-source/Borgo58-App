-- =====================================================================
-- LA COMANDA CHE LA STAMPANTE NON HA RICEVUTO ESCE ALLA RIACCENSIONE —
-- 04/11/2026, chiesto da Alessio durante il collaudo: alle 11:27 una
-- comanda per la cucina è finita «fallito» con la stampante spenta, non è
-- uscita quando l'ha riaccesa, e nessuno l'ha avvisato.
-- =====================================================================
--
-- 🔴 COSA CAMBIA. Se la stampante NON HA RICEVUTO NIENTE (non apre la
--    connessione, o dice di non essere pronta prima che parta il foglio),
--    il ponte risponde «riprova»: la comanda torna in coda e il ponte la
--    riprende fra venti secondi, finché la stampante risponde. Esce alla
--    riaccensione, una volta sola. Dopo mezz'ora dalla richiesta diventa
--    fallita, con l'avviso e il tasto «Ristampa».
-- 🔴 COSA NON CAMBIA. Un foglio INCERTO (partito, senza risposta) non si
--    riprova mai da solo. Scontrini, annulli e chiusure nemmeno con «non è
--    partito niente»: il database rifiuta «riprova» per loro.
-- 🔴 L'AVVISO. `avvisi_stampa()` dice a chi lavora in Sala quali comande
--    dei conti aperti non sono uscite, con frasi fisse e senza indirizzi.

-- ---------------------------------------------------------------------
-- 1. Quando si può riprovare
-- ---------------------------------------------------------------------
alter table lavori_stampa add column if not exists riprova_dopo timestamptz;
comment on column lavori_stampa.riprova_dopo is
  'Per una comanda che la stampante non ha ricevuto: il ponte non la riprende prima di quest''ora.';
alter table lavori_stampa drop constraint if exists lavoro_riprova_solo_comande_in_coda;
alter table lavori_stampa add constraint lavoro_riprova_solo_comande_in_coda
  check (riprova_dopo is null or (stato = 'in_coda' and tipo in ('comanda', 'chiamata')));
comment on constraint lavoro_riprova_solo_comande_in_coda on lavori_stampa is
  'Si riprova da solo solo una comanda o un biglietto del turno ancora in coda: mai un documento fiscale, mai un incerto.';

-- ---------------------------------------------------------------------
-- 2. La coda: scadenze, presa, esito
-- ---------------------------------------------------------------------
create or replace function public.scadi_lavori_abbandonati()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  update lavori_stampa
     set stato = 'incerto', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Il ponte ha preso questo lavoro e non ha più risposto: forse è uscito, forse no. Guarda la stampante e decidi tu.'
   where stato = 'in_corso' and preso_il < now() - interval '5 minutes';

  -- 🔴 Una comanda che riprova da mezz'ora non esce più da sola: FALLITA,
  --    con l'avviso in Sala e in Cucina e il tasto «Ristampa» (04/11).
  update lavori_stampa
     set stato = 'fallito', finito_il = now(), riprova_dopo = null,
         errore_testo = 'La stampante non ha risposto per mezz''ora: non la riprovo più da solo.'
   where stato = 'in_coda' and tipo in ('comanda', 'chiamata') and errore_codice is not null
     and creato_il < now() - interval '30 minutes';

  update lavori_stampa l
     set stato = 'annullato', finito_il = now(),
         errore_testo = 'Il conto è stato chiuso prima che il ponte stampasse: non serve più.'
   where l.stato = 'in_coda' and l.order_id is not null and l.tipo in ('comanda', 'chiamata')
     and exists (select 1 from orders o where o.id = l.order_id and o.status <> 'aperto');

  update lavori_stampa
     set stato = 'annullato', finito_il = now(),
         errore_testo = 'Rimasto in coda più di tre ore: non lo stampo più da solo.'
   where stato = 'in_coda' and tipo in ('comanda', 'chiamata') and creato_il < now() - interval '3 hours';

  -- Uno scontrino o un annullo fermo in coda da sei ore non esce più da
  -- solo: FALLITO, così resta lì e blocca finché il titolare non decide.
  update lavori_stampa
     set stato = 'fallito', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Rimasto in coda più di sei ore: non lo emetto più da solo.'
   where stato = 'in_coda' and tipo in ('scontrino', 'annullo') and creato_il < now() - interval '6 hours';

  -- ⚠️ Una chiusura giornaliera chiesta e mai partita non scatta ore dopo,
  --    magari a giornata nuova già cominciata: dopo mezz'ora è fallita.
  update lavori_stampa
     set stato = 'fallito', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Rimasta in coda più di mezz''ora: la chiusura non la faccio più da solo, richiedila.'
   where stato = 'in_coda' and tipo = 'chiusura' and creato_il < now() - interval '30 minutes';
end $function$;

revoke all on function public.scadi_lavori_abbandonati() from public, anon, authenticated;

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

-- rete-guardie: ponte_esito_lavoro — il rifiuto «è stampato, fallito o incerto» diventa «… o riprova»: lo stesso controllo, con il quarto esito delle comande che la stampante non ha ricevuto
create or replace function public.ponte_esito_lavoro(
  p_chiave text, p_id uuid, p_stato text, p_errore_codice text,
  p_errore_testo text, p_stato_dispositivo text, p_esito jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_lavoro lavori_stampa%rowtype;
  v_stato_disp text := case when p_stato_dispositivo in ('pronto', 'carta_finita', 'coperchio_aperto', 'non_risponde', 'errore')
                            then p_stato_dispositivo else 'sconosciuto' end;
  v_codice     text := case when p_errore_codice in ('carta_finita', 'coperchio_aperto', 'non_risponde', 'risposta_a_meta', 'rifiutato', 'interrotto')
                            then p_errore_codice else 'sconosciuto' end;
  v_testo      text := case when p_stato = 'stampato' then null else left(p_errore_testo, 500) end;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;
  if p_stato not in ('stampato', 'fallito', 'incerto', 'riprova') then
    raise exception 'L''esito di un lavoro è stampato, fallito, incerto o riprova.';
  end if;

  -- 🔴 «RIPROVA» (04/11): la stampante non ha ricevuto niente, quindi la
  --    comanda torna in coda e il ponte la riprende fra venti secondi. Solo
  --    comande e biglietti del turno, e solo da «in corso»: mai un incerto,
  --    mai il fiscale. Dopo mezz'ora diventa fallita (scadi_lavori_abbandonati).
  if p_stato = 'riprova' then
    update lavori_stampa
       set stato = 'in_coda', preso_il = null, preso_da = null, finito_il = null,
           errore_codice = v_codice, errore_testo = left(p_errore_testo, 500),
           riprova_dopo = now() + interval '20 seconds'
     where id = p_id and preso_da = v_chiave and stato = 'in_corso' and tipo in ('comanda', 'chiamata')
     returning * into v_lavoro;
    if v_lavoro.id is null then
      raise exception 'Questo lavoro non si può riprovare: non è una comanda in corso per questo ponte.';
    end if;
    update dispositivi
       set ultimo_stato = v_stato_disp, ultimo_stato_testo = left(p_errore_testo, 500),
           ultimo_contatto_il = case when v_stato_disp = 'non_risponde' then ultimo_contatto_il else now() end
     where id = v_lavoro.dispositivo_id;
    return;
  end if;

  update lavori_stampa
     set stato = p_stato, finito_il = now(), riprova_dopo = null,
         errore_codice = case when p_stato = 'stampato' then null else v_codice end,
         errore_testo = v_testo,
         esito = case when pg_column_size(p_esito) <= 4000 then p_esito end
   where id = p_id and preso_da = v_chiave
     and (stato = 'in_corso' or (stato = 'incerto' and errore_codice = 'interrotto'))
   returning * into v_lavoro;
  if v_lavoro.id is null then
    raise exception 'Questo lavoro non è in corso per questo ponte: forse è già stato chiuso.';
  end if;

  update dispositivi
     set ultimo_stato = v_stato_disp,
         ultimo_stato_testo = v_testo,
         ultimo_contatto_il = case when v_stato_disp = 'non_risponde' then ultimo_contatto_il else now() end
   where id = v_lavoro.dispositivo_id;

  -- 🔴 Uscito = stampato anche per la pagina Cucina. Tutte le righe dello
  --    stesso foglio prendono la stessa ora: è la firma con cui
  --    `bigliettiCucina` le rimette insieme per una ristampa.
  -- ⚠️ Mai per il bar (vedi in testa), e senza far fallire l'esito: se il
  --    conto si è chiuso nel frattempo e il database rifiuta il segno, il
  --    lavoro resta comunque «stampato».
  if p_stato = 'stampato' then
    begin
      if v_lavoro.tipo = 'comanda' and v_lavoro.reparto = 'cucina' then
        update order_items set prepared_at = now()
         where id = any(v_lavoro.righe) and prepared_at is null and voided_at is null;
      elsif v_lavoro.tipo = 'chiamata' then
        update chiamate_turno set stampata_il = now()
         where id = v_lavoro.chiamata_id and stampata_il is null;
      end if;
    exception when others then
      raise warning 'Il foglio è uscito, ma non si è potuto segnare stampato: %', sqlerrm;
    end;
  end if;
end $function$;

revoke all on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. L'avviso per chi lavora in Sala
-- ---------------------------------------------------------------------
-- 🔴 SOLO FRASI FISSE, MAI IL TESTO DEL PONTE (come `stato_stampa`).
create or replace function public.avvisi_stampa()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', l.id, 'order_id', l.order_id, 'tavolo', o.table_label, 'reparto', l.reparto,
             'tipo', l.tipo, 'stato', l.stato, 'riprova', l.stato = 'in_coda',
             'righe', to_jsonb(l.righe), 'chiamata_id', l.chiamata_id,
             'frase', case
               when l.stato = 'incerto' then
                 'Forse ' || case when l.tipo = 'chiamata' then 'il biglietto del turno' else 'la comanda' end
                 || ' del ' || o.table_label || ' è uscit' || case when l.tipo = 'chiamata' then 'o' else 'a' end
                 || ', forse no: guarda la stampante ' || case when l.reparto = 'bar' then 'del bar' else 'della cucina' end || '.'
               else
                 case when l.tipo = 'chiamata' then 'Il biglietto del turno' else 'La comanda' end
                 || ' del ' || o.table_label || ' non è uscit' || case when l.tipo = 'chiamata' then 'o' else 'a' end
                 || ': ' || coalesce(frase_di_stampa(l.errore_codice), 'la stampante non l''ha stampata.')
                 || case when l.stato = 'in_coda' then ' Riprovo da solo.' else ' Premi «Ristampa».' end
             end)
             order by l.creato_il)
      from lavori_stampa l
      join orders o on o.id = l.order_id and o.status = 'aperto'
     where l.tipo in ('comanda', 'chiamata')
       and (l.stato in ('fallito', 'incerto') or (l.stato = 'in_coda' and l.errore_codice is not null))), '[]'::jsonb);
end $function$;

revoke all on function public.avvisi_stampa() from public, anon, authenticated;
grant execute on function public.avvisi_stampa() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_ordine   uuid;
  v_disp     uuid;
  v_reg      uuid;
  v_k        jsonb;
  v_riga     uuid;
  v_lavoro   uuid;
  v_s        uuid;
  v_r        jsonb;
  v_ok       boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles, e un''entità.';
  end if;

  if has_function_privilege('anon', 'avvisi_stampa()', 'execute')
     or not has_function_privilege('authenticated', 'avvisi_stampa()', 'execute') then
    raise exception 'VERIFICA: i permessi degli avvisi di stampa non sono quelli dichiarati.';
  end if;

  begin
    update dispositivi set attivo = false where attivo;
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
    values ('ZZ cucina della riprova', 'stampante_comande', 'simulatore', '127.0.0.1', 19195, 'cucina')
    returning id into v_disp;
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta)
    values ('ZZ registratore della riprova', 'registratore_fiscale', 'simulatore', '127.0.0.1', 19196)
    returning id into v_reg;

    insert into orders (entity_id, table_label, status, coperti)
    values (v_ente, 'ZZ T3', 'aperto', 0) returning id into v_ordine;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ tagliatelle', 'cucina', 1, 12) returning id into v_riga;
    update order_items set sent_at = now() where id = v_riga;
    select id into v_lavoro from lavori_stampa where order_id = v_ordine and tipo = 'comanda' and stato = 'in_coda';
    if v_lavoro is null then
      raise exception 'VERIFICA (0): la comanda non è entrata in coda.';
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_k := crea_chiave_ponte('ZZ ponte della riprova');
    perform set_config('request.jwt.claims', null, true);

    -- (1) Stampante spenta: il ponte dice «riprova», la comanda torna in
    --     coda e non si riprende subito.
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 then
      raise exception 'VERIFICA (1a): il ponte non ha preso la comanda: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'riprova', 'non_risponde',
                               'L''apparecchio non risponde (ECONNREFUSED).', 'non_risponde', null);
    if (select stato from lavori_stampa where id = v_lavoro) <> 'in_coda'
       or (select riprova_dopo from lavori_stampa where id = v_lavoro) <= now() then
      raise exception 'VERIFICA (1b): la comanda non è tornata in coda con la sua attesa.';
    end if;
    if jsonb_array_length(ponte_prendi_lavori(v_k->>'chiave', 5)) <> 0 then
      raise exception 'VERIFICA (1c): la comanda si è ripresa prima della sua attesa.';
    end if;

    -- (2) Lo staff in Sala vede l'avviso giusto, senza indirizzi.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := avvisi_stampa();
    if not exists (select 1 from jsonb_array_elements(v_r) a
                    where (a->>'id')::uuid = v_lavoro and (a->>'riprova')::boolean
                      and a->>'frase' like 'La comanda del ZZ T3 non è uscita: la stampante non risponde%Riprovo da solo.') then
      raise exception 'VERIFICA (2a): l''avviso della comanda che riprova non è quello giusto: %.', v_r;
    end if;
    if v_r::text ~ '\d+\.\d+\.\d+\.\d+' or v_r::text like '%ECONNREFUSED%' then
      raise exception 'VERIFICA (2b): l''avviso mostra il testo del ponte allo staff.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (3) Passata l'attesa la stampante è accesa: il ponte la riprende e la stampa.
    update lavori_stampa set riprova_dopo = now() - interval '1 second' where id = v_lavoro;
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or (v_r->0->>'id')::uuid <> v_lavoro then
      raise exception 'VERIFICA (3a): passata l''attesa il ponte non ha ripreso la comanda: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'stampato', null, null, 'pronto', '{}');
    if (select stato from lavori_stampa where id = v_lavoro) <> 'stampato'
       or (select riprova_dopo from lavori_stampa where id = v_lavoro) is not null then
      raise exception 'VERIFICA (3b): la comanda ripresa non è uscita come stampata.';
    end if;

    -- (4) Mezz'ora di «riprova»: fallita, con l'avviso rosso.
    update order_items set prepared_at = null where id = v_riga;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_lavoro := manda_alla_stampante(array[v_riga], null, false);
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'riprova', 'non_risponde', 'spenta', 'non_risponde', null);
    update lavori_stampa set creato_il = now() - interval '31 minutes' where id = v_lavoro;
    perform scadi_lavori_abbandonati();
    if (select stato from lavori_stampa where id = v_lavoro) <> 'fallito' then
      raise exception 'VERIFICA (4a): la comanda che riprovava da mezz''ora non è fallita.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    if not exists (select 1 from jsonb_array_elements(avvisi_stampa()) a
                    where (a->>'id')::uuid = v_lavoro and a->>'frase' like '%Premi «Ristampa».') then
      raise exception 'VERIFICA (4b): la comanda fallita non ha l''avviso con «Ristampa».';
    end if;
    perform set_config('request.jwt.claims', null, true);

    -- (5) 🔴 Un incerto e uno scontrino non si riprovano mai.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_lavoro := manda_alla_stampante(array[v_riga], null, false);
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'incerto', 'risposta_a_meta', 'a metà', 'errore', '{}');
    v_ok := false;
    begin
      perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'riprova', 'non_risponde', 'x', 'non_risponde', null);
    exception when others then v_ok := sqlerrm like '%non si può riprovare%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (5a): un foglio incerto si è potuto rimettere in coda.';
    end if;

    insert into orders (entity_id, table_label, status, coperti)
    values (v_ente, 'ZZ T4', 'aperto', 0) returning id into v_ordine;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ acqua', 'bar', 1, 2);
    update order_items set sent_at = now() where order_id = v_ordine;
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    perform close_order_paid(v_ordine, 'contante', 0, null, false);
    v_s := accoda_scontrino(v_ordine);
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    v_ok := false;
    begin
      perform ponte_esito_lavoro(v_k->>'chiave', v_s, 'riprova', 'non_risponde', 'x', 'non_risponde', null);
    exception when others then v_ok := sqlerrm like '%non si può riprovare%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (5b): uno scontrino si è potuto rimettere in coda da solo.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della comanda che riprova');

  raise notice 'Fatto: la comanda che la stampante non ha ricevuto torna in coda e aspetta venti secondi, poi esce una volta; dopo mezz''ora è fallita con «Ristampa»; lo staff vede l''avviso con frasi fisse; un incerto e uno scontrino non si riprovano mai. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000004', 'la_comanda_esce_alla_riaccensione')
on conflict (version) do nothing;
