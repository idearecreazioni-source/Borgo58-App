-- =====================================================================
-- Borgo 58 · La ricorrenza porta con sé l'avviso
-- =====================================================================
-- 20/09/2026.
--
-- 🔴 IL DIFETTO, LETTO NEL CODICE VIVO. `completa_task` rigenera il task
--    successivo elencando tredici colonne, e `remind_at` non è fra quelle:
--    chi si era messo un avviso alle 9:00 per una scadenza delle 10:00 se
--    lo ritrova **solo la prima volta**. Dal secondo giro in poi il task
--    torna, e l'avviso no.
--
-- ⚠️ E NON DA' NESSUN SEGNALE: il task nuovo è perfetto in tutto il resto —
--    titolo, scadenza, cadenza, categoria — e l'unica cosa che manca è
--    quella che avrebbe dovuto ricordartelo. È la forma che questo progetto
--    insegue da mesi: *una risposta più corta che ha l'aria di essere
--    intera*. Nessuna prova lo copriva: `tests/app/agenda-ricorrenza.test.js`
--    non nomina mai `remind_at`.
--
-- ---------------------------------------------------------------------
-- LA REGOLA: SI CONSERVA L'ANTICIPO, NON L'ORA
-- ---------------------------------------------------------------------
-- 🔴 QUELLO CHE UNA PERSONA SCEGLIE NON E' «LE 9:00»: E' «UN'ORA PRIMA».
--    Ricopiare l'istante dell'avviso lo lascerebbe sulla vecchia data —
--    cioè nel passato — e ricopiare la sola ora del giorno sbaglierebbe
--    tutti gli avvisi che stanno su un altro giorno («la sera prima»).
--    Si misura quindi la DISTANZA fra l'avviso e la scadenza, e si rimette
--    la stessa distanza sulla scadenza nuova.
--
-- ⚠️ LA DISTANZA SI MISURA IN ISTANTI, NON IN NUMERI DI OROLOGIO, e i due
--    istanti si compongono **a Roma**: `due_date` è una data e `due_time`
--    un orario senza fuso, mentre `remind_at` è un istante. Sommarli a
--    Greenwich sposterebbe ogni avviso di un'ora o due — ed è la trappola
--    più vecchia di questo progetto.
--
-- ⚠️ SENZA AVVISO NON SE NE INVENTA UNO: chi non l'aveva non lo trova.
--
-- ⚠️ E SENZA SCADENZA NON C'E' NESSUN ANTICIPO DA CONSERVARE. Un task che
--    si ripete ma non ha `due_date` fa nascere il successivo contando da
--    oggi: lì «un'ora prima di cosa» non ha risposta, e inventarne una
--    metterebbe l'avviso in un punto che nessuno ha scelto. Il task nasce
--    senza avviso, e questa riga lo dichiara invece di lasciarlo scoprire.
--
-- ⚠️ UN AVVISO CHE NASCE GIA' PASSATO NON SI TOGLIE, e non è una svista:
--    succede chiudendo con molto ritardo un task la cui prossima scadenza
--    è comunque alle spalle. Quel task È in ritardo, e l'avviso deve
--    partire — una volta sola, perché il giro lo segna come inviato.
--    Toglierlo sarebbe decidere al posto di chi l'aveva chiesto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. LA GUARDIA — si rifiuta invece di indovinare
-- ---------------------------------------------------------------------
-- 🔴 Una funzione si riscrive dal CORPO VIVO, mai dal file che l'ha creata
--    (regola del 18/08). Da dove questa migrazione è stata scritta il corpo
--    vivo non si poteva leggere, quindi il controllo si rovescia: si
--    descrive il corpo che ci si aspetta di sostituire e ci si ferma se se
--    ne trova un altro.
do $guardia$
declare
  v_corpo text;
begin
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'completa_task' and p.prokind = 'f';

  if v_corpo is null then
    raise exception 'GUARDIA: completa_task non esiste in questo database.';
  end if;
  if position('ricorrenza_unita' in v_corpo) = 0 then
    raise exception 'GUARDIA: la funzione viva non conosce la cadenza a parole sue (20260910000001). Leggi il corpo vivo prima di applicare.';
  end if;
  if position('remind_at' in v_corpo) > 0 then
    raise exception 'GUARDIA: la funzione viva nomina già l''avviso: questa migrazione è già stata applicata, o superata da un''altra.';
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 1. L'ISTANTE DELLA SCADENZA, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
-- ⚠️ Serve due volte — sulla scadenza vecchia e su quella nuova — e le due
--    devono essere composte allo stesso modo, o la distanza misurata non è
--    la distanza rimessa.
create or replace function istante_della_scadenza(p_giorno date, p_ora time without time zone)
returns timestamptz
language sql
immutable
set search_path = public
as $funzione$
  select case
           when p_giorno is null then null
           else (p_giorno::timestamp + coalesce(p_ora, time '00:00')) at time zone 'Europe/Rome'
         end;
$funzione$;

comment on function istante_della_scadenza(date, time without time zone) is
  'La scadenza come istante, composta a Roma. Un task senza giorno non ha un istante: risponde vuoto invece di inventarne uno.';

revoke all on function istante_della_scadenza(date, time without time zone) from public, anon, authenticated;
grant execute on function istante_della_scadenza(date, time without time zone) to authenticated;

-- ---------------------------------------------------------------------
-- 2. L'AVVISO DEL TASK SUCCESSIVO
-- ---------------------------------------------------------------------
-- 🔴 STA IN UNA FUNZIONE SUA PERCHE' COSI' SI PUO' PROVARE: dentro
--    `completa_task` l'unico modo di metterla alla prova sarebbe chiudere
--    task veri e guardare cosa nasce. Qui si interroga con date inventate.
create or replace function avviso_del_successivo(
  p_avviso_vecchio timestamptz,
  p_scadenza_vecchia date,
  p_scadenza_nuova date,
  p_ora time without time zone
)
returns timestamptz
language sql
immutable
set search_path = public
as $funzione$
  select case
           -- Chi non aveva un avviso non ne trova uno.
           when p_avviso_vecchio is null then null
           -- Senza scadenza vecchia non c'è anticipo da conservare.
           when p_scadenza_vecchia is null or p_scadenza_nuova is null then null
           else istante_della_scadenza(p_scadenza_nuova, p_ora)
                + (p_avviso_vecchio - istante_della_scadenza(p_scadenza_vecchia, p_ora))
         end;
$funzione$;

comment on function avviso_del_successivo(timestamptz, date, date, time without time zone) is
  'Dove va l''avviso del task rigenerato: alla stessa DISTANZA dalla scadenza che aveva prima. Senza avviso, o senza una scadenza da cui misurare, risponde vuoto: non si inventa un orario che nessuno ha scelto.';

revoke all on function avviso_del_successivo(timestamptz, date, date, time without time zone) from public, anon, authenticated;
grant execute on function avviso_del_successivo(timestamptz, date, date, time without time zone) to authenticated;

-- ---------------------------------------------------------------------
-- 3. `completa_task`, dal corpo vivo, con l'avviso che viaggia
-- ---------------------------------------------------------------------
create or replace function completa_task(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_t     tasks%rowtype;
  v_nuovo uuid;
  v_data  date;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_t from tasks where id = p_id for update;
  if v_t.id is null then raise exception 'Task non trovato'; end if;
  if not (is_titolare() or v_t.visibile_staff) then
    raise exception 'Questo task non e'' tuo';
  end if;
  if v_t.status = 'completato' then
    raise exception 'Questo task risulta gia'' fatto';
  end if;

  update tasks set status = 'completato' where id = p_id;

  if v_t.ricorrenza_ogni is not null then
    -- Si conta dalla scadenza, non da oggi: un adempimento annuale
    -- chiuso in ritardo deve tornare alla SUA data, non spostarsi in
    -- avanti di quanto si e'' tardato.
    v_data := coalesce(v_t.due_date, (now() at time zone 'Europe/Rome')::date);
    v_data := (v_data + case v_t.ricorrenza_unita
                          when 'giorni'    then v_t.ricorrenza_ogni * interval '1 day'
                          when 'settimane' then v_t.ricorrenza_ogni * interval '1 week'
                          when 'mesi'      then v_t.ricorrenza_ogni * interval '1 month'
                          when 'anni'      then v_t.ricorrenza_ogni * interval '1 year'
                          else null
                        end)::date;
    if v_data is null then
      raise exception 'Non so ogni quanto si ripete questo task: l''unita'' «%» non la conosco.',
        coalesce(v_t.ricorrenza_unita, 'vuota');
    end if;

    -- 🔴 L'AVVISO VIAGGIA COL TASK, alla stessa distanza dalla scadenza.
    --    `reminder_sent_at` invece NON si copia: il task nuovo non ha
    --    ancora avvisato nessuno, e portarselo dietro lo farebbe nascere
    --    «gia' avvisato» — cioe' muto per sempre.
    insert into tasks (title, description, due_date, due_time, priority, status,
                       category, origine_modulo, visibile_staff, preferito,
                       ricorrenza_ogni, ricorrenza_unita, generato_da,
                       remind_at)
    values (v_t.title, v_t.description, v_data, v_t.due_time, v_t.priority, 'da_fare',
            v_t.category, v_t.origine_modulo, v_t.visibile_staff, v_t.preferito,
            v_t.ricorrenza_ogni, v_t.ricorrenza_unita, p_id,
            avviso_del_successivo(v_t.remind_at, v_t.due_date, v_data, v_t.due_time))
    returning id into v_nuovo;
  end if;

  return v_nuovo;
end;
$function$;

revoke all on function completa_task(uuid) from public, anon, authenticated;
grant execute on function completa_task(uuid) to authenticated;

-- rete-guardie: completa_task — le tre frasi di rifiuto dicono «task» invece di «impegno», per decisione del 20/09: nell'Agenda e in MEMO la parola visibile torna a essere «task». Nessun rifiuto e nessun portiere si perde; al loro posto arriva una colonna in piu' nell'insert, l'avviso.

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_lap0   integer;
  v_lap1   integer;
  v_tit    uuid;
  v_miei   uuid[] := '{}';
  v_id     uuid;
  v_nuovo  uuid;
  v_r      timestamptz;
  v_n      integer;
begin
  select count(*) into v_lap0 from deleted_records;
  select ur.user_id into v_tit from user_roles ur where ur.role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- -------------------------------------------------------------------
  -- 1. L'ANTICIPO SI CONSERVA — il caso dell'esempio: avviso un'ora prima
  -- -------------------------------------------------------------------
  insert into tasks (title, due_date, due_time, remind_at, status, category,
                     visibile_staff, ricorrenza_ogni, ricorrenza_unita)
  values ('VERIFICA-20SET avviso un''ora prima', date '2026-03-01', time '10:00',
          istante_della_scadenza(date '2026-03-01', time '10:00') - interval '1 hour',
          'da_fare', 'altro', true, 1, 'mesi')
  returning id into v_id;
  v_miei := v_miei || v_id;

  v_nuovo := completa_task(v_id);
  v_miei := v_miei || v_nuovo;
  select t.remind_at into v_r from tasks t where t.id = v_nuovo;
  if v_r is distinct from istante_della_scadenza(date '2026-04-01', time '10:00') - interval '1 hour' then
    raise exception 'VERIFICA: l''avviso del task nuovo doveva essere un''ora prima delle 10:00 del 01/04, ed e'' %.',
      coalesce(v_r::text, 'vuoto');
  end if;
  -- ⚠️ E non nasce «gia' avvisato»: sarebbe muto per sempre.
  if (select t.reminder_sent_at from tasks t where t.id = v_nuovo) is not null then
    raise exception 'VERIFICA: il task nuovo nasce gia'' segnato come avvisato.';
  end if;

  -- -------------------------------------------------------------------
  -- 2. L'ANTICIPO DI UN GIORNO INTERO — «la sera prima»
  -- -------------------------------------------------------------------
  -- 🔴 Serve perche' i due casi si distinguano: copiando la sola ORA del
  --    giorno il primo controllo passerebbe lo stesso, questo no.
  insert into tasks (title, due_date, due_time, remind_at, status, category,
                     visibile_staff, ricorrenza_ogni, ricorrenza_unita)
  values ('VERIFICA-20SET la sera prima', date '2026-03-01', time '10:00',
          istante_della_scadenza(date '2026-02-28', time '20:00'),
          'da_fare', 'altro', true, 1, 'mesi')
  returning id into v_id;
  v_miei := v_miei || v_id;

  v_nuovo := completa_task(v_id);
  v_miei := v_miei || v_nuovo;
  select t.remind_at into v_r from tasks t where t.id = v_nuovo;
  if v_r is distinct from istante_della_scadenza(date '2026-03-31', time '20:00') then
    raise exception 'VERIFICA: l''avviso «la sera prima» doveva cadere il 31/03 alle 20:00, ed e'' %.',
      coalesce(v_r::text, 'vuoto');
  end if;

  -- -------------------------------------------------------------------
  -- 3. L'ORA LEGALE NON SPOSTA L'ANTICIPO
  -- -------------------------------------------------------------------
  -- ⚠️ Fra il 01/03 e il 01/04 l'ora cambia. Le due prove qui sopra lo
  --    attraversano apposta: se la distanza si misurasse a Greenwich, un
  --    avviso «un'ora prima» diventerebbe di due ore, o di zero.
  --    Qui si controlla la proprieta' in chiaro: alle 10:00 di Roma resta
  --    alle 10:00 di Roma.
  if (istante_della_scadenza(date '2026-04-01', time '10:00') at time zone 'Europe/Rome')::time
       is distinct from time '10:00' then
    raise exception 'VERIFICA: l''istante della scadenza non torna alle 10:00 di Roma.';
  end if;

  -- -------------------------------------------------------------------
  -- 4. SENZA AVVISO NON SE NE INVENTA UNO
  -- -------------------------------------------------------------------
  insert into tasks (title, due_date, due_time, status, category,
                     visibile_staff, ricorrenza_ogni, ricorrenza_unita)
  values ('VERIFICA-20SET senza avviso', date '2026-03-01', time '10:00',
          'da_fare', 'altro', true, 1, 'mesi')
  returning id into v_id;
  v_miei := v_miei || v_id;

  v_nuovo := completa_task(v_id);
  v_miei := v_miei || v_nuovo;
  if (select t.remind_at from tasks t where t.id = v_nuovo) is not null then
    raise exception 'VERIFICA: e'' nato un avviso che nessuno aveva chiesto.';
  end if;

  -- -------------------------------------------------------------------
  -- 5. SENZA SCADENZA NON C'E' ANTICIPO DA CONSERVARE
  -- -------------------------------------------------------------------
  if avviso_del_successivo(now(), null, date '2026-04-01', time '10:00') is not null then
    raise exception 'VERIFICA: senza scadenza vecchia e'' stato inventato un avviso.';
  end if;

  -- -------------------------------------------------------------------
  -- 6. E LA SCADENZA CONTINUA A CONTARSI COME PRIMA
  -- -------------------------------------------------------------------
  -- Il resto della funzione non e' cambiato, e questa riga lo dimostra
  -- invece di darlo per scontato.
  select count(*) into v_n from tasks t
   where t.id = any(v_miei) and t.generato_da is not null
     and t.due_date = date '2026-04-01';
  if v_n <> 3 then
    raise exception 'VERIFICA: i tre task generati dovevano scadere il 01/04, ne risultano %.', v_n;
  end if;

  -- -------------------------------------------------------------------
  -- Si ripulisce: solo cio' che questa verifica ha creato
  -- -------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from tasks where id = any(v_miei);
  select count(*) into v_n from tasks where id = any(v_miei);
  if v_n <> 0 then
    raise exception 'VERIFICA: sono rimasti % task di prova.', v_n;
  end if;

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'VERIFICA: il registro delle cancellazioni e'' passato da % a %.', v_lap0, v_lap1;
  end if;
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''avviso che viaggia');

  raise notice 'La ricorrenza porta con se'' l''avviso, alla stessa distanza dalla scadenza.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260920000003', 'la_ricorrenza_porta_con_se_l_avviso') on conflict (version) do nothing;
