-- =====================================================================
-- UNA RICORRENZA SI DICE A PAROLE SUE — «ogni N giorni/settimane/mesi/anni»
-- =====================================================================
-- 10/09/2026. Blocco 2A del mandato notturno, deciso da Alessio.
--
-- 🔴 COSA C'ERA, E PERCHE' NON BASTAVA. La casella «Si ripete» offriva
--    quattro possibilita' scelte da chi ha scritto il codice: ogni mese,
--    ogni tre mesi, ogni sei mesi, ogni anno. Sono le cadenze del
--    calendario fiscale, e infatti gli unici impegni ricorrenti nati
--    finora sono adempimenti societari. Tutto il resto della vita di
--    un'osteria — cambiare i filtri della cappa, chiamare il tecnico
--    della cella, ritirare le analisi — cade su cadenze che quell'elenco
--    non contiene, e chi ne aveva bisogno non aveva NESSUNA casella da
--    riempire: doveva rinunciare alla ricorrenza.
--
--    ⚠️ E il modo di fallire era muto: il menu si apriva, quattro voci,
--    nessun errore. *Un elenco chiuso che non contiene il caso di chi
--    guarda non sembra incompleto: sembra che quella cosa non si possa
--    fare.*
--
-- ⚠️ COSA SI FA, ed e' la forma piu' piccola che copre tutto: due dati
--    invece di una parola — **quante volte** (`ricorrenza_ogni`) e **di
--    che cosa** (`ricorrenza_unita`, fra giorni, settimane, mesi e anni).
--    Le quattro voci di prima diventano casi particolari di questa forma
--    (ogni 1 mesi, ogni 3 mesi, ogni 6 mesi, ogni 1 anni), quindi non si
--    perde niente e si guadagna tutto il resto.
--
-- ⚠️ COSA NON SI FA, per decisione di Alessio: niente scelta dei giorni
--    della settimana e niente data di fine. Sono due caselle in piu' su
--    un modulo che questo blocco esiste per alleggerire, e nessuno le ha
--    mai chieste. Il giorno che servissero, si aggiungono qui accanto.
--
-- 🔴 LE DUE COLONNE VANNO INSIEME O NON VANNO. Una `ricorrenza_ogni`
--    senza unita' e' un numero che non vuol dire niente, e un'unita'
--    senza numero non dice quante volte: sono l'una la meta' dell'altra,
--    e il vincolo lo pretende. Vuote tutt'e due = «non si ripete», che e'
--    lo stato in cui nasce un impegno.
--
-- ⚠️ LA COLONNA VECCHIA SI TOGLIE, NON SI SPEGNE (regola di questo
--    progetto, gia' pagata con `dining_tables.seats`): una colonna
--    lasciata li' vuota, fra sei mesi, qualcuno la riaccende credendo di
--    riparare qualcosa — e da quel momento due posti direbbero ogni
--    quanto si ripete lo stesso impegno.
--
-- 🔴 E LA SANATORIA DICHIARA QUANTE RIGHE HA TOCCATO (regola del 16/08):
--    uno zero non e' un errore — vuol dire «gia' fatto» o «niente da fare
--    su questo database» — ma va detto. E' il silenzio ad aver ingannato
--    quattro volte, non la mancanza del dato.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. I due dati, e nessun predefinito
-- ---------------------------------------------------------------------
-- ⚠️ NIENTE `default` (lezione del 14/08): su righe che esistono gia', un
--    predefinito e' una risposta data da chi scrive la migrazione al posto
--    di chi usa il gestionale. Qui vuoto dev'essere leggibile come «non si
--    ripete», ed e' esattamente cio' che `null` significa.
alter table tasks add column if not exists ricorrenza_ogni  smallint;
alter table tasks add column if not exists ricorrenza_unita text;

comment on column tasks.ricorrenza_ogni is
  'Ogni quante unita'' si ripete questo impegno. Vuota insieme a ricorrenza_unita significa «non si ripete». Dal 10/09/2026 al posto delle quattro cadenze fisse mensile/trimestrale/semestrale/annuale.';
comment on column tasks.ricorrenza_unita is
  'L''unita'' della ricorrenza: giorni, settimane, mesi, anni. Va sempre insieme a ricorrenza_ogni — una senza l''altra non dice niente, e il vincolo ricorrenza_intera lo impedisce.';

-- ---------------------------------------------------------------------
-- 2. La sanatoria: le ricorrenze gia' scritte restano quelle che erano
-- ---------------------------------------------------------------------
-- ⚠️ Si tocca SOLO chi aveva una ricorrenza e non ha ancora i due dati
--    nuovi: rilanciare la migrazione non riscrive niente sopra una scelta
--    fatta dopo dalla schermata (difetto del giro A, 14/08).
do $sanatoria$
declare
  v_toccate integer;
  v_rimaste integer;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tasks'
                and column_name = 'ricorrenza') then
    execute $q$
      update tasks
         set ricorrenza_ogni = case ricorrenza
                                 when 'mensile'     then 1
                                 when 'trimestrale' then 3
                                 when 'semestrale'  then 6
                                 when 'annuale'     then 1
                               end,
             ricorrenza_unita = case ricorrenza
                                  when 'annuale' then 'anni'
                                  else 'mesi'
                                end
       where ricorrenza is not null
         and ricorrenza_ogni is null
    $q$;
    get diagnostics v_toccate = row_count;
    raise notice 'Ricorrenze convertite nella forma nuova: %.', v_toccate;

    -- 🔴 NON SI VA AVANTI SE QUALCUNA E' RIMASTA INDIETRO. Togliere la
    --    colonna vecchia con una riga non convertita vorrebbe dire
    --    perdere in silenzio una ricorrenza di Alessio.
    execute $q$
      select count(*) from tasks where ricorrenza is not null and ricorrenza_ogni is null
    $q$ into v_rimaste;
    if v_rimaste <> 0 then
      raise exception 'SANATORIA: % impegni avevano una ricorrenza che non e'' stata convertita.', v_rimaste;
    end if;
  else
    raise notice 'La colonna vecchia non c''e'' piu'': niente da convertire.';
  end if;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- 3. I vincoli, e la frase italiana di ciascuno
-- ---------------------------------------------------------------------
-- ⚠️ Un vincolo senza `comment` risponde «violates check constraint
--    "..."», che in una schermata non e' un rifiuto: e' un guasto
--    (regola del 24/08). La traduzione la legge `src/lib/supabase.js`.
alter table tasks drop constraint if exists ricorrenza_ogni_sensata;
alter table tasks add constraint ricorrenza_ogni_sensata
  check (ricorrenza_ogni is null or ricorrenza_ogni between 1 and 999);
comment on constraint ricorrenza_ogni_sensata on tasks is
  'Ogni quanto si ripete dev''essere almeno 1: «ogni 0 giorni» non e'' una cadenza. Il tetto di 999 sta li'' per prendere una cifra digitata storta, non per vietare una cadenza lunga.';

alter table tasks drop constraint if exists ricorrenza_unita_valida;
alter table tasks add constraint ricorrenza_unita_valida
  check (ricorrenza_unita is null
         or ricorrenza_unita in ('giorni', 'settimane', 'mesi', 'anni'));
comment on constraint ricorrenza_unita_valida on tasks is
  'Un impegno si puo'' ripetere ogni tot giorni, settimane, mesi o anni: altre parole non le sa calcolare nessuno.';

alter table tasks drop constraint if exists ricorrenza_intera;
alter table tasks add constraint ricorrenza_intera
  check ((ricorrenza_ogni is null) = (ricorrenza_unita is null));
comment on constraint ricorrenza_intera on tasks is
  'Quante volte e di che cosa sono due meta'' della stessa risposta: o ci sono tutt''e due, o l''impegno non si ripete.';

-- ---------------------------------------------------------------------
-- 4. Chi chiude un impegno ricorrente ne fa nascere il prossimo
-- ---------------------------------------------------------------------
-- ⚠️ Corpo ripreso dal database VIVO (regola del 18/08): cambia solo il
--    conto della prossima scadenza. Tutto il resto — il portiere, i tre
--    rifiuti, il conto dalla scadenza e non da oggi — arriva intero.
--
-- 🔴 E L'`else` DEL `case` SOLLEVA invece di rispondere vuoto. Senza,
--    un'unita' fuori vocabolario darebbe una data vuota, cioe' un impegno
--    nuovo **senza scadenza** al posto di quello ricorrente: la famiglia
--    della risposta piu' corta che ha l'aria di essere intera (19/08).
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
  if v_t.id is null then raise exception 'Impegno non trovato'; end if;
  if not (is_titolare() or v_t.visibile_staff) then
    raise exception 'Questo impegno non e'' tuo';
  end if;
  if v_t.status = 'completato' then
    raise exception 'Questo impegno risulta gia'' fatto';
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
      raise exception 'Non so ogni quanto si ripete questo impegno: l''unita'' «%» non la conosco.',
        coalesce(v_t.ricorrenza_unita, 'vuota');
    end if;

    insert into tasks (title, description, due_date, due_time, priority, status,
                       category, origine_modulo, visibile_staff, preferito,
                       ricorrenza_ogni, ricorrenza_unita, generato_da)
    values (v_t.title, v_t.description, v_data, v_t.due_time, v_t.priority, 'da_fare',
            v_t.category, v_t.origine_modulo, v_t.visibile_staff, v_t.preferito,
            v_t.ricorrenza_ogni, v_t.ricorrenza_unita, p_id)
    returning id into v_nuovo;
  end if;

  return v_nuovo;
end;
$function$;

revoke all on function completa_task(uuid) from public, anon, authenticated;
grant execute on function completa_task(uuid) to authenticated;

-- rete-guardie: completa_task — le quattro parole mensile/trimestrale/semestrale/annuale se ne vanno apposta: non sono piu' un vocabolario, sono due dati (quante volte, di che cosa). Nessun rifiuto e nessun portiere si perde: al loro posto ne nasce uno in piu', quello che rifiuta un'unita' che non si sa calcolare.

-- ---------------------------------------------------------------------
-- 5. Le due letture dell'Agenda portano i due dati nuovi
-- ---------------------------------------------------------------------
-- ⚠️ La colonna `ricorrenza` sparisce dalla risposta, e con lei sparisce
--    la parola: la frase «ogni 3 mesi» la compone la schermata, dove
--    vivono tutte le altre etichette del gestionale.
-- ⚠️ `drop` e poi `create`, non `create or replace`: cambiando le colonne
--    della risposta Postgres rifiuta la sostituzione. E dopo un `drop` i
--    permessi tornano APERTI AL MONDO, quindi il `revoke` va rimesso —
--    trappola gia' pagata il 13/08 con `create_ingredient`.
drop function if exists agenda_corsie();
create function agenda_corsie()
returns table (
  id uuid, title text, description text, due_date date,
  due_time time without time zone, category text, origine_modulo text,
  preferito boolean,
  ricorrenza_ogni smallint, ricorrenza_unita text,
  status text, visibile_staff boolean, corsia text,
  giorni_in_lista integer, giorni_alla_scadenza integer
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_oggi date := oggi_a_roma();
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select t.id, t.title, t.description, t.due_date, t.due_time,
         t.category, t.origine_modulo, t.preferito,
         t.ricorrenza_ogni, t.ricorrenza_unita,
         t.status::text, t.visibile_staff,
         case
           when t.due_date is null              then 'quando_capita'
           when t.due_date < v_oggi             then 'in_ritardo'
           -- «Questa settimana» vuol dire da oggi a sette giorni, non
           -- fino a domenica: il lunedi' l'orizzonte non deve accorciarsi
           -- a un giorno solo.
           when t.due_date <= v_oggi + 7        then 'questa_settimana'
           else 'piu_avanti'
         end,
         -- ⚠️ Le due date del sottrarre devono stare nello STESSO fuso: con
         -- `v_oggi` di Roma e `created_at` di Greenwich, un impegno scritto
         -- dopo mezzanotte nasceva gia' vecchio di un giorno. In «quando
         -- capita» l'anzianita' e' l'unica cosa che si guarda.
         (v_oggi - (t.created_at at time zone 'Europe/Rome')::date)::integer,
         case when t.due_date is not null then (t.due_date - v_oggi)::integer end
    from tasks t
   where t.status <> 'completato'
     -- La RLS su `tasks` distingue gia' cosa vede lo staff; qui si gira
     -- come proprietario, quindi il filtro va rimesso a mano.
     and (is_titolare() or t.visibile_staff)
   order by
     case
       when t.due_date is null then 3
       when t.due_date < v_oggi then 0
       when t.due_date <= v_oggi + 7 then 1
       else 2
     end,
     t.preferito desc,
     t.due_date asc nulls last,
     t.due_time asc nulls last,
     t.created_at asc;
end;
$function$;

revoke all on function agenda_corsie() from public, anon, authenticated;
grant execute on function agenda_corsie() to authenticated;

drop function if exists agenda_fatti(integer);
create function agenda_fatti(p_giorni integer default 30)
returns table (
  id uuid, title text, category text, due_date date, origine_modulo text,
  ricorrenza_ogni smallint, ricorrenza_unita text,
  visibile_staff boolean, fatto_il timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select t.id, t.title, t.category, t.due_date, t.origine_modulo,
         t.ricorrenza_ogni, t.ricorrenza_unita, t.visibile_staff, t.updated_at
    from tasks t
   where t.status = 'completato'
     and (is_titolare() or t.visibile_staff)
     -- `updated_at` e' quando e' stato chiuso: e' l'ultima cosa che gli
     -- e' successa. Non e' una data di chiusura vera, e per questo la
     -- finestra e' generosa invece che precisa.
     and t.updated_at > now() - make_interval(days => greatest(coalesce(p_giorni, 30), 1))
   order by t.updated_at desc;
end;
$function$;

revoke all on function agenda_fatti(integer) from public, anon, authenticated;
grant execute on function agenda_fatti(integer) to authenticated;

-- rete-guardie: agenda_corsie — la colonna «ricorrenza» della risposta se ne va apposta: al suo posto ne arrivano due, quante volte e di che cosa. La schermata legge quelle.
-- rete-guardie: agenda_fatti — stessa cosa: «ricorrenza» diventa «ricorrenza_ogni» e «ricorrenza_unita».

-- ---------------------------------------------------------------------
-- 6. La colonna vecchia se ne va
-- ---------------------------------------------------------------------
alter table tasks drop constraint if exists ricorrenza_valida;
alter table tasks drop column if exists ricorrenza;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ Ogni impegno che questa verifica crea se lo segna in un ARRAY, e
--    alla fine cancella per identificativo. Non «l'ultimo inserito»
--    (regola del 23/08), e non in una variabile sola che si sovrascrive
--    (difetto del 26/08, che ha lasciato una riga di prova in produzione).
do $verifica$
declare
  v_foto    jsonb := foto_righe();
  v_lap0    integer;
  v_lap1    integer;
  v_tit     uuid;
  v_miei    uuid[] := '{}';
  v_id      uuid;
  v_nuovo   uuid;
  v_data    date;
  v_n       integer;
  v_preso   boolean;
begin
  select count(*) into v_lap0 from deleted_records;

  select ur.user_id into v_tit from user_roles ur where ur.role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- -------------------------------------------------------------------
  -- 1. LA COLONNA VECCHIA NON C'E' PIU'
  -- -------------------------------------------------------------------
  -- Non «e'' vuota»: non esiste. Una colonna spenta, fra sei mesi,
  -- qualcuno la riaccende credendo di riparare qualcosa.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tasks'
                and column_name = 'ricorrenza') then
    raise exception 'VERIFICA: la colonna «ricorrenza» c''e'' ancora.';
  end if;

  -- -------------------------------------------------------------------
  -- 2. NESSUN IMPEGNO HA META' RICORRENZA
  -- -------------------------------------------------------------------
  -- ⚠️ E' una PROPRIETA', non un conteggio: resta vera domani, su tutti
  --    e due i database, e con qualunque numero di righe (regola 16/08).
  select count(*) into v_n from tasks
   where (ricorrenza_ogni is null) <> (ricorrenza_unita is null);
  if v_n <> 0 then
    raise exception 'VERIFICA: % impegni hanno meta'' ricorrenza.', v_n;
  end if;

  -- -------------------------------------------------------------------
  -- 3. LE QUATTRO UNITA' CONTANO LA PROSSIMA SCADENZA
  -- -------------------------------------------------------------------
  -- ⚠️ Le date sono scelte perche' le quattro risposte siano DIVERSE fra
  --    loro: con «ogni 1» su tutte, giorni e settimane darebbero risposte
  --    troppo vicine per distinguere uno scambio (regola del 19/08 sul
  --    numero degli elementi di una prova).
  --    Partenza 01/03/2026 (domenica): +10 giorni = 11/03,
  --    +2 settimane = 15/03, +3 mesi = 01/06, +1 anno = 01/03/2027.
  declare
    v_unita  text[] := array['giorni', 'settimane', 'mesi', 'anni'];
    v_quanti smallint[] := array[10, 2, 3, 1];
    v_attese date[] := array[date '2026-03-11', date '2026-03-15',
                             date '2026-06-01', date '2027-03-01'];
    i integer;
  begin
    for i in 1 .. 4 loop
      insert into tasks (title, due_date, status, category,
                         visibile_staff, ricorrenza_ogni, ricorrenza_unita)
      values ('VERIFICA-10SET ricorrenza ' || v_unita[i], date '2026-03-01',
              'da_fare', 'altro', true, v_quanti[i], v_unita[i])
      returning id into v_id;
      v_miei := v_miei || v_id;

      v_nuovo := completa_task(v_id);
      if v_nuovo is null then
        raise exception 'VERIFICA: chiudere un impegno «ogni % %» non ne ha generato un altro.',
          v_quanti[i], v_unita[i];
      end if;
      v_miei := v_miei || v_nuovo;

      select t.due_date into v_data from tasks t where t.id = v_nuovo;
      if v_data is distinct from v_attese[i] then
        raise exception 'VERIFICA: «ogni % %» dal 01/03/2026 doveva dare %, ha dato %.',
          v_quanti[i], v_unita[i], v_attese[i], coalesce(v_data::text, 'niente');
      end if;

      -- E la ricorrenza si eredita: altrimenti il secondo giro non nasce.
      select t.ricorrenza_ogni into v_n from tasks t where t.id = v_nuovo;
      if v_n is distinct from v_quanti[i]::integer then
        raise exception 'VERIFICA: l''impegno generato da «ogni % %» non ha ereditato la cadenza.',
          v_quanti[i], v_unita[i];
      end if;
    end loop;
  end;

  -- -------------------------------------------------------------------
  -- 4. SENZA RICORRENZA NON NASCE NIENTE
  -- -------------------------------------------------------------------
  insert into tasks (title, due_date, status, category, visibile_staff)
  values ('VERIFICA-10SET senza ricorrenza', date '2026-03-01',
          'da_fare', 'altro', true)
  returning id into v_id;
  v_miei := v_miei || v_id;
  if completa_task(v_id) is not null then
    raise exception 'VERIFICA: un impegno che non si ripete ne ha generato un altro.';
  end if;

  -- -------------------------------------------------------------------
  -- 5. I VINCOLI RIFIUTANO CIO' CHE NON E' UNA CADENZA
  -- -------------------------------------------------------------------
  -- ⚠️ Ogni rifiuto si prova nel suo `begin…exception` annidato: un
  --    gestore sul blocco grande inghiottirebbe anche il fallimento dei
  --    controlli (trappola del 15/08).
  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff,
                       ricorrenza_ogni, ricorrenza_unita)
    values ('VERIFICA-10SET zero', 'da_fare', 'altro', true, 0, 'giorni');
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: «ogni 0 giorni» e'' stato accettato.';
  end if;

  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff,
                       ricorrenza_ogni, ricorrenza_unita)
    values ('VERIFICA-10SET parola', 'da_fare', 'altro', true, 2, 'lune piene');
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: un''unita'' che nessuno sa calcolare e'' stata accettata.';
  end if;

  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff,
                       ricorrenza_ogni)
    values ('VERIFICA-10SET meta A', 'da_fare', 'altro', true, 3);
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: un numero senza unita'' e'' stato accettato.';
  end if;

  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff,
                       ricorrenza_unita)
    values ('VERIFICA-10SET meta B', 'da_fare', 'altro', true, 'mesi');
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: un''unita'' senza numero e'' stata accettata.';
  end if;

  -- -------------------------------------------------------------------
  -- 6. E IL VERSO OPPOSTO: UNA CADENZA INSOLITA MA LEGITTIMA PASSA
  -- -------------------------------------------------------------------
  -- 🔴 Un limite che rifiuta anche i casi buoni e' peggio di nessun
  --    limite (regola del 24/08). «Ogni 90 giorni» e «ogni 5 anni» sono
  --    strani e veri: il sanificatore della cappa, la revisione di un
  --    impianto.
  insert into tasks (title, status, category, visibile_staff,
                     ricorrenza_ogni, ricorrenza_unita)
  values ('VERIFICA-10SET novanta', 'da_fare', 'altro', true, 90, 'giorni')
  returning id into v_id;
  v_miei := v_miei || v_id;

  insert into tasks (title, status, category, visibile_staff,
                     ricorrenza_ogni, ricorrenza_unita)
  values ('VERIFICA-10SET cinque anni', 'da_fare', 'altro', true, 5, 'anni')
  returning id into v_id;
  v_miei := v_miei || v_id;

  -- -------------------------------------------------------------------
  -- 7. LE DUE LETTURE DELL'AGENDA PORTANO I DUE DATI
  -- -------------------------------------------------------------------
  select count(*) into v_n from agenda_corsie() c
   where c.id = any(v_miei) and c.ricorrenza_ogni is not null
     and c.ricorrenza_unita is not null;
  -- I quattro generati dalla chiusura + i due insoliti del punto 6.
  if v_n <> 6 then
    raise exception 'VERIFICA: agenda_corsie doveva riportare 6 cadenze, ne riporta %.', v_n;
  end if;

  select count(*) into v_n from agenda_fatti() f
   where f.id = any(v_miei) and f.ricorrenza_ogni is not null;
  -- I quattro chiusi che si ripetevano; il quinto chiuso non si ripete.
  if v_n <> 4 then
    raise exception 'VERIFICA: agenda_fatti doveva riportare 4 cadenze, ne riporta %.', v_n;
  end if;

  -- -------------------------------------------------------------------
  -- Si ripulisce: solo cio' che questa verifica ha creato
  -- -------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from tasks where id = any(v_miei);
  select count(*) into v_n from tasks where id = any(v_miei);
  if v_n <> 0 then
    raise exception 'VERIFICA: sono rimasti % impegni di prova.', v_n;
  end if;

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'VERIFICA: il registro delle cancellazioni e'' passato da % a %.', v_lap0, v_lap1;
  end if;
  perform pretendi_nessun_residuo(v_foto, 'la verifica della ricorrenza a parole sue');

  raise notice 'La ricorrenza si dice «ogni N giorni/settimane/mesi/anni», e le quattro unita'' contano giusto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260910000001', 'una_ricorrenza_si_dice_a_parole_sue') on conflict (version) do nothing;
