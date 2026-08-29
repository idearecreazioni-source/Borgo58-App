-- =====================================================================
-- QUELLO CHE LE RETI HANNO TROVATO
-- 29/08/2026
-- =====================================================================
-- Quattro prove del progetto sono diventate rosse da sole dopo il lavoro di
-- oggi. Nessuna delle quattro l'ha trovata una rilettura: le ha trovate il
-- controllo che gira dopo, ed e' esattamente il lavoro per cui esiste.
--
--   1. `scarto_da_dire` era eseguibile **con la sola chiave pubblica**,
--      che sta nel pacchetto del sito. Non usciva nessun dato — e' una
--      funzione pura — ma l'elenco di chi puo' bussare da fuori **non deve
--      crescere in silenzio**: e' la regola del 13/08.
--   2. `locale_aperto` e `si_lavora_in_cucina` scavalcavano la RLS senza
--      chiedere chi fosse il chiamante.
--   3. `anomalie_scarico.quantita_richiesta` — la colonna aggiunta oggi —
--      non era classificata nel censimento delle unita'.
--   4. Il vincolo sui giorni della settimana era **muto**: rispondeva in
--      inglese invece che con una frase leggibile.
--
-- ⚠️ E LA CURA DELLA 2 NON E' IL PORTIERE, ed e' il criterio del 27/08:
-- prima si guarda **chi chiama**. Quelle due funzioni leggono
-- `service_hours`, `service_closures` e `settimana_cucina`, e tutte e tre
-- hanno la lettura aperta a chi usa il gestionale — verificato nelle
-- policy, non dedotto. Quindi **non serve scavalcare niente**: si toglie
-- `security definer` e decide la RLS, che e' l'unico posto dove quella
-- regola vive. Un portiere qui sarebbe un controllo in piu' da mantenere
-- per un caso che, tolto il definer, non esiste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA PORTA CHE NON SERVIVA A NESSUNO
-- ---------------------------------------------------------------------
revoke all on function scarto_da_dire(numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. LE DUE DOMANDE DEL CALENDARIO NON SCAVALCANO PIU' NIENTE
-- ---------------------------------------------------------------------
-- rete-guardie: locale_aperto — il security definer si toglie APPOSTA: le tre tabelle che legge hanno gia la lettura aperta a chi usa il gestionale, quindi decide la RLS e nessun portiere serve
-- rete-guardie: si_lavora_in_cucina — il security definer si toglie APPOSTA, stessa ragione: tolto quello, la funzione smette di comparire fra chi scavalca i permessi e il caso non esiste piu invece di essere sorvegliato
create or replace function locale_aperto(p_data date)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select exists (select 1 from service_hours sh
                  where sh.weekday = extract(dow from p_data)::integer and sh.attivo)
     and not exists (select 1 from service_closures c
                      where p_data between c.dal and c.al);
$fn$;

revoke all on function locale_aperto(date) from public, anon, authenticated;
grant execute on function locale_aperto(date) to authenticated;

comment on function locale_aperto(date) is
  'Il tal giorno il locale e'' aperto al pubblico? Guarda la settimana tipo E le chiusure a date: sono due condizioni, e chi ne guarda una sola sbaglia sui giorni di ferie. Non scavalca i permessi: le tre tabelle le legge gia'' chi usa il gestionale.';

create or replace function si_lavora_in_cucina(p_data date)
returns boolean
language sql
stable
set search_path = public
as $fn$
  -- Una chiusura che si e' pronunciata vince sulla settimana tipo: e' lo
  -- scostamento di quel giorno preciso.
  select coalesce(
    (select c.si_lavora_in_cucina from service_closures c
      where p_data between c.dal and c.al and c.si_lavora_in_cucina is not null
      order by c.dal desc limit 1),
    (select s.si_lavora from settimana_cucina s
      where s.weekday = extract(dow from p_data)::integer)
  );
$fn$;

revoke all on function si_lavora_in_cucina(date) from public, anon, authenticated;
grant execute on function si_lavora_in_cucina(date) to authenticated;

comment on function si_lavora_in_cucina(date) is
  'Il tal giorno si lavora in cucina? VUOTO vuol dire «non l''ha ancora detto Alessio» ed e'' una risposta diversa da no: chi la riceve lo dichiara invece di dare per scontato che non si lavori.';

-- ---------------------------------------------------------------------
-- 3. LA COLONNA NUOVA ENTRA NEL CENSIMENTO DELLE UNITA'
-- ---------------------------------------------------------------------
-- ⚠️ Va nell'elenco di quelle che **si convertono**, accanto alla sorella
-- `quantita_mancante` che sta nella stessa tabella: e' una quantita' nella
-- lingua dell'ingrediente, quindi il giorno che un ingrediente cambia unita'
-- di misura va convertita come le altre. Lasciandola fuori, quel giorno
-- resterebbe un numero in chili in mezzo a numeri in pezzi — e nessun
-- errore lo direbbe.
do $censimento$
declare
  v_corpo text;
begin
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'colonne_unita_non_classificate';
  if v_corpo is null then
    raise exception 'colonne_unita_non_classificate non esiste.';
  end if;

  if position('(''anomalie_scarico'',''quantita_richiesta'')' in v_corpo) > 0 then
    raise notice 'La colonna e'' gia'' classificata: niente da fare.';
  else
    if position('(''anomalie_scarico'',''quantita_mancante''),' in v_corpo) = 0 then
      raise exception 'Non trovo la sorella da affiancare: il corpo vivo e'' diverso da quello letto.';
    end if;
    execute replace(v_corpo,
      '(''anomalie_scarico'',''quantita_mancante''),',
      '(''anomalie_scarico'',''quantita_mancante''), (''anomalie_scarico'',''quantita_richiesta''),');
  end if;
end
$censimento$;

-- ---------------------------------------------------------------------
-- 4. IL VINCOLO PARLA ITALIANO
-- ---------------------------------------------------------------------
-- Un vincolo senza commento risponde «violates check constraint …», che in
-- cucina non e' un rifiuto: e' un guasto.
comment on constraint settimana_cucina_weekday_check on settimana_cucina is
  'I giorni della settimana vanno da 0 (domenica) a 6 (sabato), come li conta il database. Se questo rifiuto compare, qualcuno sta scrivendo un giorno che non esiste.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto jsonb;
  v_tit uuid;
  v_aperte text;
  v_definer text;
  v_non_classificate text;
  v_mute text;
  v_risposta boolean;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Verifica impossibile: nessun titolare.'; end if;

  -- (1) Nessuna delle tre e' piu' aperta alla chiave pubblica.
  select string_agg(p.proname, ', ') into v_aperte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('scarto_da_dire', 'locale_aperto', 'si_lavora_in_cucina')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_aperte is not null then
    raise exception 'Ancora eseguibili con la chiave pubblica: %', v_aperte;
  end if;

  -- (2) …e le due del calendario non scavalcano piu' i permessi.
  select string_agg(p.proname, ', ') into v_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('locale_aperto', 'si_lavora_in_cucina')
     and p.prosecdef;
  if v_definer is not null then
    raise exception 'Scavalcano ancora la RLS: %', v_definer;
  end if;

  -- (3) 🔴 MA CONTINUANO A RISPONDERE, ed e' il controllo che vale di piu':
  --     togliere `security definer` puo' spegnere una funzione IN SILENZIO
  --     se le tabelle sotto non sono leggibili da chi chiama. Qui si prova
  --     col titolare, che e' chi la usera'.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  v_risposta := locale_aperto(current_date);
  if v_risposta is null then
    raise exception 'Tolto il definer, «il locale e'' aperto?» non risponde piu''.';
  end if;
  perform si_lavora_in_cucina(current_date);
  perform set_config('request.jwt.claims', null, true);

  -- (4) La colonna nuova e' classificata.
  select string_agg(tabella || '.' || colonna, ', ') into v_non_classificate
    from colonne_unita_non_classificate();
  if v_non_classificate is not null then
    raise exception 'Colonne ancora non classificate: %', v_non_classificate;
  end if;

  -- (5) E il vincolo non e' piu' muto.
  select string_agg(c.conname, ', ') into v_mute
    from pg_constraint c
   where c.conrelid = 'settimana_cucina'::regclass
     and c.contype = 'c'
     and obj_description(c.oid, 'pg_constraint') is null;
  if v_mute is not null then
    raise exception 'Vincoli ancora muti: %', v_mute;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica di quello che le reti hanno trovato');
  raise notice 'Nessuna porta aperta alla chiave pubblica, nessun definer di troppo, la colonna nuova e'' classificata e il vincolo parla italiano.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000009', 'quello_che_le_reti_hanno_trovato') on conflict (version) do nothing;
