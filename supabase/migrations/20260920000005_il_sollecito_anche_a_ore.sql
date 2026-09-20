-- =====================================================================
-- Borgo 58 · Il sollecito anche a minuti e a ore
-- =====================================================================
-- 20/09/2026. Dipende dalla 20260920000004 e non ha senso senza di lei.
--
-- 🔴 COSA CAMBIA, E COSA NO. Il sollecito nasceva con le quattro unità della
--    ricorrenza — giorni, settimane, mesi, anni — perché un secondo
--    vocabolario è un secondo posto da tenere d'accordo. Provandolo però si
--    vede che le due cose non chiedono le stesse parole: **un impegno che si
--    ripete ogni dieci minuti non esiste, un sollecito sì.** «Ricordamelo
--    fra un'ora se non l'ho ancora fatto» è la richiesta normale; «ogni
--    giorno» è quella rara.
--
-- ⚠️ IL PREZZO DICHIARATO IERI SI PAGA OGGI, ed è giusto così: le due
--    unità in più valgono SOLO per il sollecito. La ricorrenza resta a
--    quattro, perché lì «ogni 10 minuti» non è un impegno.
--
-- 🔴 SOTTO I CINQUE MINUTI NON SI SOLLECITA, ed è un vincolo del database e
--    non un consiglio della schermata: un avviso ogni minuto non è un
--    promemoria, è un martello — e chi lo imposta se ne accorge quando ha
--    già ricevuto venti messaggi. Il limite sta dove nessuna schermata può
--    aggirarlo.
--
-- ⚠️ NON SI RISCRIVE NIENTE. Nessun task esistente viene toccato: le due
--    colonne restano vuote dove erano vuote, e chi aveva scelto «ogni 2
--    giorni» continua con «ogni 2 giorni».
-- =====================================================================

do $guardia$
declare
  v_istante text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tasks'
                    and column_name = 'sollecito_ogni') then
    raise exception 'GUARDIA: manca la 20260920000004 (le colonne del sollecito). Questa migrazione dipende da quella.';
  end if;

  select pg_get_functiondef(p.oid) into v_istante from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'istante_sollecito' and p.prokind = 'f';
  if v_istante is null then
    raise exception 'GUARDIA: istante_sollecito non esiste qui.';
  end if;
  if position('''minuti''' in v_istante) > 0 then
    raise exception 'GUARDIA: istante_sollecito conosce già i minuti: questa migrazione è già stata applicata, o superata da un''altra.';
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 1. LE DUE UNITA' IN PIU', e il minimo dei cinque minuti
-- ---------------------------------------------------------------------
alter table tasks drop constraint if exists sollecito_unita_valida;
alter table tasks add constraint sollecito_unita_valida
  check (sollecito_unita is null
         or sollecito_unita in ('minuti', 'ore', 'giorni', 'settimane', 'mesi', 'anni'));
comment on constraint sollecito_unita_valida on tasks is
  'Le unità del sollecito: minuti, ore, e le quattro della ricorrenza. Minuti e ore valgono solo qui — un impegno che si ripete ogni dieci minuti non esiste.';

alter table tasks drop constraint if exists sollecito_minuti_almeno_cinque;
alter table tasks add constraint sollecito_minuti_almeno_cinque
  check (sollecito_unita is distinct from 'minuti' or sollecito_ogni >= 5);
comment on constraint sollecito_minuti_almeno_cinque on tasks is
  'A minuti si sollecita da cinque in su: più spesso di così non è un promemoria, è un martello.';
-- ⚠️ `is distinct from` e non `<>`: con il vocabolario vuoto un confronto
--    normale darebbe NULL, il vincolo non scatterebbe, e il controllo
--    tacerebbe proprio nel caso che deve prendere (trappola del 27/08).

-- ---------------------------------------------------------------------
-- 2. QUANDO CADE IL SOLLECITO — le due unità nuove nel calcolo
-- ---------------------------------------------------------------------
-- ⚠️ Cambia SOLO la riga dei passi: il resto — l'ultima occorrenza dovuta,
--    il tetto ai giri, il vuoto quando non ne è passata nessuna — è quello
--    della 20260920000004, riga per riga.
create or replace function istante_sollecito(
  p_avviso timestamptz,
  p_ogni smallint,
  p_unita text,
  p_adesso timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $funzione$
declare
  v_passo interval;
  v_qui   timestamptz;
  v_prec  timestamptz;
  i       integer := 0;
begin
  if p_avviso is null or p_ogni is null or p_unita is null or p_adesso is null then
    return null;
  end if;

  v_passo := case p_unita
               when 'minuti'    then greatest(p_ogni, 5) * interval '1 minute'
               when 'ore'       then p_ogni * interval '1 hour'
               when 'giorni'    then p_ogni * interval '1 day'
               when 'settimane' then p_ogni * interval '1 week'
               when 'mesi'      then p_ogni * interval '1 month'
               when 'anni'      then p_ogni * interval '1 year'
               else null
             end;
  if v_passo is null then
    return null;
  end if;

  v_qui := p_avviso;
  loop
    i := i + 1;
    -- ⚠️ IL TETTO CONTA DI PIU' ADESSO: con i minuti, un task aperto da un
    --    mese produce ottomila giri. Duemila bastano a coprire una settimana
    --    a cinque minuti, e oltre quella soglia si risponde l'ultima
    --    occorrenza calcolata invece di tenere il database a girare.
    if i > 2000 then
      return v_prec;
    end if;
    v_prec := v_qui;
    v_qui := v_qui + v_passo;
    if v_qui > p_adesso then
      return case when v_prec = p_avviso then null else v_prec end;
    end if;
  end loop;
end
$funzione$;

comment on function istante_sollecito(timestamptz, smallint, text, timestamptz) is
  'L''ultima occorrenza del sollecito già dovuta a un certo istante, oppure vuoto se non se n''è compiuta ancora nessuna. Conosce minuti, ore, giorni, settimane, mesi e anni; a minuti il passo non scende sotto i cinque.';

revoke all on function istante_sollecito(timestamptz, smallint, text, timestamptz) from public, anon, authenticated;
grant execute on function istante_sollecito(timestamptz, smallint, text, timestamptz) to authenticated;

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
  v_n      integer;
  v_preso  boolean;
  v_avviso timestamptz := now() - interval '3 hours';
begin
  select count(*) into v_lap0 from deleted_records;
  select ur.user_id into v_tit from user_roles ur where ur.role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. NIENTE SI ACCENDE DA SE', nemmeno adesso che le unità sono sei.
  select count(*) into v_n from tasks where sollecito_ogni is not null;
  if v_n <> 0 then
    raise exception 'VERIFICA: % task risultano sollecitati senza che nessuno l''abbia chiesto.', v_n;
  end if;

  -- 2. LE ORE CONTANO, e l'occorrenza dovuta è l'ultima.
  if istante_sollecito(v_avviso, 1::smallint, 'ore', v_avviso + interval '2 hours 30 minutes')
       is distinct from v_avviso + interval '2 hours' then
    raise exception 'VERIFICA: il sollecito a ore non cade dove deve.';
  end if;

  -- 3. I MINUTI CONTANO, e sotto i cinque non si scende.
  if istante_sollecito(v_avviso, 15::smallint, 'minuti', v_avviso + interval '38 minutes')
       is distinct from v_avviso + interval '30 minutes' then
    raise exception 'VERIFICA: il sollecito a minuti non cade dove deve.';
  end if;

  -- 🔴 IL LIMITE E' NEL DATABASE, e questa è la prova che rifiuta davvero.
  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff, remind_at,
                       sollecito_ogni, sollecito_unita)
    values ('VERIFICA-20SET un minuto', 'da_fare', 'altro', true, v_avviso, 1, 'minuti');
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: «ogni 1 minuto» e'' stato accettato.';
  end if;

  -- ⚠️ E IL VERSO OPPOSTO: cinque minuti è legittimo e deve passare. Un
  --    limite che rifiuta anche i casi buoni è peggio di nessun limite.
  insert into tasks (title, due_date, due_time, remind_at, status, category, visibile_staff,
                     ricorrenza_ogni, ricorrenza_unita, sollecito_ogni, sollecito_unita)
  values ('VERIFICA-20SET cinque minuti', date '2026-03-01', time '10:00',
          istante_della_scadenza(date '2026-03-01', time '10:00') - interval '1 hour',
          'da_fare', 'altro', true, 1, 'mesi', 5, 'minuti')
  returning id into v_id;
  v_miei := v_miei || v_id;

  -- 4. E LA RICORRENZA EREDITA ANCHE LE UNITA' NUOVE.
  v_nuovo := completa_task(v_id);
  v_miei := v_miei || v_nuovo;
  select count(*) into v_n from tasks t
   where t.id = v_nuovo and t.sollecito_ogni = 5 and t.sollecito_unita = 'minuti';
  if v_n <> 1 then
    raise exception 'VERIFICA: il task rigenerato non ha ereditato il sollecito a minuti.';
  end if;

  -- 5. LA RICORRENZA RESTA A QUATTRO UNITA': «ogni 10 minuti» non è un impegno.
  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff,
                       ricorrenza_ogni, ricorrenza_unita)
    values ('VERIFICA-20SET ricorrenza a minuti', 'da_fare', 'altro', true, 10, 'minuti');
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: una ricorrenza «ogni 10 minuti» e'' stata accettata.';
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
  perform pretendi_nessun_residuo(v_foto, 'la verifica del sollecito a ore');

  raise notice 'Il sollecito conosce minuti e ore, e sotto i cinque minuti rifiuta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260920000005', 'il_sollecito_anche_a_ore') on conflict (version) do nothing;
