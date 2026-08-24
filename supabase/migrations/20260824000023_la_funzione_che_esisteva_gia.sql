-- =====================================================================
-- LA FUNZIONE CHE ESISTEVA GIA'
-- 24/08/2026 — correzione della 20260824000019, aggiunta e non riscritta
-- =====================================================================
-- 🔴 TROVATO DA UNA RETE DEL PROGETTO, non rileggendo. La prova sui
-- permessi e' diventata rossa:
--
--   solo 10 funzioni si possono eseguire con la sola chiave pubblica
--     → `set_aggiornato_il` era ATTESA e non c'era piu'
--
-- ⚠️ E IL DIFETTO NON E' IL PERMESSO: e' che **quella funzione esisteva
-- gia'**, dal 12/08 (`20260812000013`), e la scrivo nella 019 con un
-- commento che dice «la funzione va scritta, non evitata» — cioe' una
-- frase falsa, scritta credendo di crearne una nuova.
--
-- 🔴 E' ESATTAMENTE LA REGOLA DEL 18/08, VIOLATA NEL FILE CHE LA CITA:
-- *una funzione si riscrive prendendo il corpo VIVO dal database, mai a
-- memoria*. Non l'ho fatto, e cosi' ho cambiato in silenzio due cose che
-- nessuno mi aveva chiesto di cambiare:
--   · da `security invoker` a `security definer`;
--   · i permessi, revocandoli a tutti.
--
-- ⚠️ E IL CAMBIAMENTO NON ERA INNOCUO PER UNA TERZA TABELLA:
-- `articoli_fornitore` usa quella stessa funzione dal 12/08, e da allora
-- gira coi permessi di chi scrive. Renderla `definer` cambia sotto quali
-- permessi si aggiorna una colonna su una tabella che non stavo nemmeno
-- guardando — il genere di modifica che non da' nessun errore e si
-- scopre mesi dopo.
--
-- ⚠️ LA CURA E' RIMETTERLA COM'ERA, non tenersi il «miglioramento»:
-- chiuderla ai permessi puo' anche essere giusto, ma e' **una decisione a
-- se'** che riguarda due tabelle e va presa guardandole, non di
-- passaggio dentro una migrazione sui conti bancari.
--
-- ⚠️ La 019 non si riscrive (regola del 23/08): quel file racconta cosa
-- ho fatto stanotte, errore compreso.
-- =====================================================================

-- Il corpo VIVO del 12/08, ripreso dalla sua migrazione perche' da allora
-- nessun'altra l'ha toccata — controllato: le uniche due che la nominano
-- sono `20260812000013` (che la crea) e `20260813000002` (che la elenca
-- fra quelle aperte, senza cambiarla).
-- rete-guardie: set_aggiornato_il — il `security definer` si toglie APPOSTA:
-- gliel'ho messo io poche ore fa nella 019, credendo di creare una funzione
-- nuova, e quella funzione esiste dal 12/08 e la usa anche
-- `articoli_fornitore`. Qui non si perde un portiere: si rimette com'era
-- una funzione che non doveva essere toccata.
--
-- ⚠️ E LA RETE HA FATTO IL SUO LAVORO DUE VOLTE IN DIECI MINUTI: prima la
-- prova dei permessi ha visto la funzione sparire dall'elenco delle dieci
-- aperte, poi questo controllo ha visto il corpo perdere il definer. La
-- seconda volta stavo gia' correggendo, e mi ha costretto a **dichiarare**
-- invece di tirare dritto.
create or replace function set_aggiornato_il()
returns trigger
language plpgsql
set search_path = public
as $funzione$
begin
  new.aggiornato_il := now();
  return new;
end
$funzione$;

comment on function set_aggiornato_il() is
  'Tiene aggiornata la colonna `aggiornato_il`. Gemella di `set_updated_at()`, che scrive `updated_at`: sono due perche'' le colonne hanno due nomi, e riusare quella sbagliata fallisce al primo aggiornamento e non creando il trigger. ⚠️ Esiste dal 12/08/2026 e la usa anche `articoli_fornitore`: non e'' una funzione dei soli conti bancari.';

-- ⚠️ E i permessi tornano quelli di prima: e' una funzione di trigger, la
-- esegue il motore per conto della tabella. Sta nell'elenco delle dieci
-- eseguibili con la chiave pubblica insieme a `set_updated_at`, che fa la
-- stessa identica cosa — e quell'elenco e' lo **stato di partenza
-- congelato** del 13/08, non un elenco dichiarato innocuo.
grant execute on function set_aggiornato_il() to public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_definer  boolean;
  v_anon     boolean;
  v_quante   integer;
  v_entita   uuid;
  v_conto    uuid;
  v_prima    timestamptz;
  v_dopo     timestamptz;
  v_lapidi   integer;
  v_lapidi2  integer;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_entita from entities limit 1;
  if v_titolare is null or v_entita is null then
    raise exception 'Manca un titolare o un''entita'': impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) E' tornata `security invoker`, com'era dal 12/08.
  select p.prosecdef into v_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_aggiornato_il';
  if v_definer then
    raise exception 'set_aggiornato_il e'' rimasta security definer.';
  end if;

  -- (b) E i permessi sono quelli di prima: sta nell'elenco delle dieci.
  v_anon := has_function_privilege('anon', 'set_aggiornato_il()', 'execute');
  if not v_anon then
    raise exception 'set_aggiornato_il non e'' tornata nell''elenco delle funzioni aperte.';
  end if;

  select count(*) into v_quante
    from funzioni_aperte_ad_anon() where nome = 'set_aggiornato_il';
  if v_quante <> 1 then
    raise exception 'L''elenco delle funzioni aperte non la nomina.';
  end if;

  -- (c) 🔴 E CONTINUA A FUNZIONARE, che e' la cosa che conta davvero: il
  --     trigger dei conti bancari la usa, e senza questa prova la
  --     migrazione potrebbe rimettere a posto i permessi lasciando la
  --     colonna ferma.
  insert into conti_bancari (entity_id, nome)
  values (v_entita, 'verifica-aggiornato-20260824')
  returning id, aggiornato_il into v_conto, v_prima;

  -- ⚠️ LA TRAPPOLA DEL 16/08 MI HA MORSO QUI DENTRO, nella migrazione
  --    che corregge un'altra regola violata: `now()` dentro una
  --    transazione e' **un istante solo**, e `pg_sleep` non lo muove.
  --    Confrontando due letture di `aggiornato_il` uscivano identiche, e
  --    la verifica diceva «il trigger non scrive piu'» su un trigger che
  --    scriveva benissimo.
  --
  --    La forma giusta: si mette una data VECCHIA a mano — scavalcando il
  --    trigger con un update sulla sola colonna non basta, perche' il
  --    trigger la riscrive; quindi si guarda che dopo l'aggiornamento sia
  --    tornata a `now()`, che e' cio' che il trigger fa.
  update conti_bancari set aggiornato_il = '1990-01-01'::timestamptz where id = v_conto;
  select aggiornato_il into v_prima from conti_bancari where id = v_conto;
  if v_prima > '1991-01-01'::timestamptz then
    -- Il trigger l'ha gia' riscritta: e' la prova che funziona.
    v_dopo := v_prima;
  else
    update conti_bancari set nome = 'verifica-aggiornato-20260824-bis' where id = v_conto;
    select aggiornato_il into v_dopo from conti_bancari where id = v_conto;
  end if;

  if v_dopo < now() - interval '1 minute' then
    raise exception 'La colonna «aggiornato_il» e'' ferma al %: il trigger non scrive piu''.', v_dopo;
  end if;

  delete from conti_bancari where id = v_conto;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'set_aggiornato_il e'' tornata com''era, e scrive ancora.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000023', 'la_funzione_che_esisteva_gia') on conflict (version) do nothing;
