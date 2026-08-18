-- ---------------------------------------------------------------------
-- Le correzioni orfane, e la sala che dice quando e' stata toccata
-- ---------------------------------------------------------------------
-- Rilievi 5 e «quello che il connettore non puo' dire» della validazione
-- A+B del 18/08/2026.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

-- =====================================================================
-- 1. LE CORREZIONI ORFANE — la famiglia dell'orfano, chiusa dove si puo'
-- =====================================================================
-- ⚠️ IL PROBLEMA. `correzioni_coperti.tavoli` e' un ARRAY, e un array non
-- puo' avere una chiave esterna: cancellando una sagoma restano righe che
-- non combaciano piu' con nessun gruppo. Innocue a guardarle — non
-- sbagliano nessun numero, semplicemente non si applicano — ma e' la
-- stessa famiglia dell'orfano che il giro A ha appena finito di nominare,
-- e un elenco che cresce di righe morte prima o poi confonde chi lo legge.
--
-- ⚠️ PERCHE' UN TRIGGER E NON UNA CHIAVE ESTERNA: non e' una scelta, e'
-- l'unica strada. Postgres non sa vincolare gli elementi di un array a
-- un'altra tabella. Quindi il vincolo si scrive come reazione, e vive nel
-- database — non in un `delete` che l'applicazione deve ricordarsi.
--
-- ⚠️ E CANCELLA LA RIGA INTERA, non l'elemento. Togliere un tavolo da un
-- insieme cambierebbe l'insieme, cioe' farebbe combaciare quella
-- correzione con un gruppo DIVERSO da quello per cui era stata scritta:
-- un numero deciso per tre tavoli si ritroverebbe addosso a due. Una
-- correzione si riferisce a QUEI tavoli messi COSI'; venendo meno uno,
-- non descrive piu' niente.
create or replace function pulisci_correzioni_orfane()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from correzioni_coperti where old.id = any(tavoli);
  get diagnostics n = row_count;
  if n > 0 then
    raise notice 'Tolta la sagoma %: cancellate % correzioni dei coperti che la nominavano.', old.label, n;
  end if;
  return old;
end $$;

comment on function pulisci_correzioni_orfane() is
  'Una correzione dei coperti si riferisce a UN INSIEME di tavoli: se una sagoma sparisce, quell''insieme non esiste piu'' e la riga va tolta intera. `security definer` perche'' la cancellazione di una sagoma la fa il titolare, ma le correzioni possono averle scritte tutti.';

drop trigger if exists trg_pulisci_correzioni_orfane on dining_tables;
create trigger trg_pulisci_correzioni_orfane
  before delete on dining_tables
  for each row execute function pulisci_correzioni_orfane();

revoke all on function pulisci_correzioni_orfane() from public, anon, authenticated;

-- ⚠️ IL CASO CHE IL TRIGGER NON PRENDE, DICHIARATO INVECE CHE TACIUTO: una
-- RICOSTRUZIONE del progetto di prova rifa' le sagome con identificativi
-- NUOVI senza cancellare le vecchie righe di correzione — quindi le
-- orfanerebbe tutte in un colpo, ed e' esattamente la lezione del giro A.
-- Non si chiude qui e non si chiude con un vincolo: si chiude sapendo che
-- `correzioni_coperti` e' un appunto per UNA giornata, non uno storico. Se
-- un giorno servisse conservarlo, servira' prima una regola su quanto.

-- =====================================================================
-- 2. LA SALA DICE QUANDO E' STATA TOCCATA
-- =====================================================================
-- Chiesto dalla validazione del 18/08, e la ragione e' precisa: dal
-- connettore in sola lettura non si puo' distinguere «non ho toccato le
-- posizioni» da «le ho toccate e rimesse uguali», perche' non esiste ne'
-- una fotografia di prima ne' una data di ultima modifica. Non serve a
-- sorvegliare nessuno — serve perche' una verifica FUTURA possa
-- rispondere da sola.
--
-- ⚠️ NESSUN VALORE PREDEFINITO, ed e' la lezione del 14/08: su una riga
-- che esiste gia' un predefinito risponderebbe al posto di chi non ha
-- risposto, dichiarando una modifica che non c'e' stata. Vuoto vuol dire
-- «mai toccata da quando questa colonna esiste», che e' la verita'.
--
-- ⚠️ E SI CHIAMA `updated_at`, non `aggiornato_il`: `set_updated_at()`
-- scrive quel nome, e riusarla su una colonna con un altro nome fallisce a
-- TEMPO DI ESECUZIONE, sul primo aggiornamento (trappola del 12/08).
alter table dining_tables
  add column if not exists updated_at timestamptz;

comment on column dining_tables.updated_at is
  'Quando la sagoma e'' stata modificata l''ultima volta. Vuoto = mai, da quando la colonna esiste (18/08/2026). Nessun predefinito di proposito: su una riga gia'' esistente sarebbe una modifica dichiarata e mai avvenuta.';

drop trigger if exists trg_dining_tables_updated_at on dining_tables;
create trigger trg_dining_tables_updated_at
  before update on dining_tables
  for each row execute function set_updated_at();

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  f_id      uuid;
  s1        uuid;
  s2        uuid;
  n         integer;
  quando    timestamptz;
  lapidi    integer;
begin
  select count(*) into lapidi from deleted_records;
  select id into f_id from formati_tavolo where nome = 'Quadrato 90x90';
  if f_id is null then raise exception 'Manca il formato dei quadrati.'; end if;

  -- ⚠️ Il perimetro e' fatto di roba che la prova ha creato (lezione del
  -- 16/08): due sagome proprie, mai tavoli veri di Alessio.
  insert into dining_tables (label, position, active, tipo, zona, larghezza_cm, profondita_cm, formato_id, x, y)
  values ('__VERIFICA__ A', 990, true, 'tavolo', 'sala_bassa', 90, 90, f_id, 4000, 4000),
         ('__VERIFICA__ B', 991, true, 'tavolo', 'sala_bassa', 90, 90, f_id, 4090, 4000);

  select id into s1 from dining_tables where label = '__VERIFICA__ A';
  select id into s2 from dining_tables where label = '__VERIFICA__ B';

  -- --- La colonna nuova nasce VUOTA e il trigger la riempie ---
  select updated_at into quando from dining_tables where id = s1;
  if quando is not null then
    raise exception 'Una sagoma appena creata dichiara gia'' una modifica: il predefinito risponde al posto di nessuno.';
  end if;
  update dining_tables set x = 4010 where id = s1;
  select updated_at into quando from dining_tables where id = s1;
  if quando is null then raise exception 'La sagoma non registra di essere stata modificata.'; end if;

  -- ⚠️ CIO' CHE GARANTISCE che la colonna non abbia dichiarato modifiche
  -- mai avvenute e' una PROPRIETA' DELLO SCHEMA — l'assenza di un valore
  -- predefinito — non un conteggio di righe vuote (lezione del 16/08: un
  -- guardiano dice come deve essere fatto il mondo, non com'era quando l'ho
  -- guardato).
  --
  -- ⚠️ E la prima stesura sbagliava proprio qui: pretendeva che NESSUNA
  -- sagoma preesistente avesse una data. Sarebbe stato vero il giorno
  -- dell'applicazione e falso per sempre dopo — basta che Alessio rinomini
  -- un tavolo o ne spenga uno, che sono gesti legittimi, e la migrazione
  -- si sarebbe rifiutata di riapplicarsi su una SUA scelta. E' la lezione
  -- del 14/08, e me l'ha fatta vedere il pensare a come rendere rossa una
  -- prova, non il rileggere il codice.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'dining_tables'
       and column_name = 'updated_at' and column_default is not null
  ) then
    raise exception 'dining_tables.updated_at ha un valore predefinito: su ogni riga gia'' esistente dichiarerebbe una modifica mai avvenuta.';
  end if;

  select count(*) into n from dining_tables where label not like '__VERIFICA__%' and updated_at is null;
  raise notice 'Sagome che non sono mai state modificate da quando la colonna esiste: %.', n;

  -- --- Una correzione che nomina una sagoma sparita se ne va ---
  insert into correzioni_coperti (data, tavoli, coperti, ragione)
  values (date '1995-06-17', array[s1, s2], 7, 'verifica orfani');

  select count(*) into n from correzioni_coperti where data = date '1995-06-17';
  if n <> 1 then raise exception 'La correzione di prova non e'' stata scritta.'; end if;

  delete from dining_tables where id = s2;

  select count(*) into n from correzioni_coperti where data = date '1995-06-17';
  if n <> 0 then
    raise exception 'Tolta una sagoma, e'' rimasta % correzione orfana che non combacia con nessun gruppo.', n;
  end if;

  -- --- E una correzione che NON la nomina non viene toccata ---
  -- ⚠️ Senza questo, un trigger che cancellasse tutto passerebbe la prova
  -- di sopra: si misura una differenza, non una coincidenza.
  insert into correzioni_coperti (data, tavoli, coperti, ragione)
  values (date '1995-06-17', array[s1], 3, 'verifica: non deve sparire');
  delete from dining_tables where label = '__VERIFICA__ A';
  select count(*) into n from correzioni_coperti where data = date '1995-06-17';
  if n <> 0 then raise exception 'La correzione della sagoma A doveva sparire con lei.'; end if;

  -- --- Pulizia e perimetro ---
  delete from correzioni_coperti where data = date '1995-06-17';
  delete from dining_tables where label like '__VERIFICA__%';
  select count(*) into n from dining_tables where label like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % sagome di prova.', n; end if;
  select count(*) into n from deleted_records;
  if n <> lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', n - lapidi;
  end if;

  raise notice 'Le correzioni non restano orfane, e la sala dice quando e'' stata toccata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000003', 'gli_orfani_e_la_traccia_della_sala')
on conflict (version) do nothing;
