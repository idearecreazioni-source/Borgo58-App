-- =====================================================================
-- MEMO RICORDA GLI ULTIMI MINUTI — 25/10/2026, tappa 3 del piano
-- «MEMO che controlla» (prima metà: memoria breve e conto giusto)
-- =====================================================================
-- Alessio: *«possiamo fare in modo che memo voce non sia rigido come lo è
-- attualmente ma che capisca tutto ciò che gli dico come se lo dicessi a
-- te?»*. Oggi ogni frase arriva a MEMO da sola: «mettine due» dopo
-- «aggiungi il latte alla lista» non ha niente a cui riferirsi, e una
-- risposta a una domanda di MEMO non sa di essere una risposta.
--
-- Qui dentro le due cose che servono al database perché la memoria esista
-- e perché costi il giusto:
--
-- 1. `voce_scambi_recenti()` — le ultime cose dette negli ultimi dieci
--    minuti e cosa MEMO aveva capito, da passare al modello come
--    conversazione. Arriva dalle DUE porte: l'app la chiama col proprio
--    accesso, la Scorciatoia la riceve dentro `voce_apri_sessione`.
--    ⚠️ Nessuna porta nuova aperta agli anonimi: chi entra con la chiave
--    la riceve dalla porta che aveva già, con lo stesso freno.
--
-- 2. IL CONTO CON LA MEMORIA CACHE. Da oggi le istruzioni di MEMO (circa
--    13.600 token, misurati sulle 28 dettature degli ultimi 30 giorni)
--    si mandano marcate per la cache del modello: la seconda frase detta
--    entro cinque minuti le rilegge a un decimo del prezzo. Ma il modello
--    restituisce TRE numeri di ingresso invece di uno, e la funzione che
--    registra ne conosceva uno solo: senza questo pezzo la spesa del mese
--    risulterebbe PIU' BASSA del vero, in silenzio — cioè il tetto di
--    spesa scatterebbe tardi.
--    ⚠️ `scrivi_dettatura` NON si tocca: è lunga, è stata cambiata il
--    19/10 e ci passa tutto quello che MEMO scrive. Le due porte la
--    chiamano come prima e POI aggiungono alla riga i token della cache
--    e il loro costo. Il costo dei token normali resta calcolato dove era.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Le due colonne, e il listino della cache
-- ---------------------------------------------------------------------
alter table dettature add column if not exists token_cache_scritti integer;
alter table dettature add column if not exists token_cache_letti   integer;

comment on column dettature.token_cache_scritti is
  'Token delle istruzioni scritti nella memoria cache del modello (si pagano 1,25 volte il prezzo di ingresso). Vuoto sulle dettature di prima del 25/10/2026, quando la cache non si usava: vuoto vuol dire «non c''era», non «zero».';
comment on column dettature.token_cache_letti is
  'Token delle istruzioni riletti dalla memoria cache del modello (si pagano un decimo del prezzo di ingresso). Vuoto sulle dettature di prima del 25/10/2026.';

alter table costo_modello_ai add column if not exists cache_scrittura_volte numeric(6,3) not null default 1.25;
alter table costo_modello_ai add column if not exists cache_lettura_volte   numeric(6,3) not null default 0.10;

comment on column costo_modello_ai.cache_scrittura_volte is
  'Quante volte il prezzo di ingresso costa un token scritto nella cache di cinque minuti. 1,25 dal listino del fornitore (letto il 25/10/2026). E'' un fatto del listino, uguale per tutti i modelli di oggi: per questo ha un predefinito.';
comment on column costo_modello_ai.cache_lettura_volte is
  'Quante volte il prezzo di ingresso costa un token riletto dalla cache. 0,10 dal listino del fornitore (letto il 25/10/2026).';

alter table costo_modello_ai drop constraint if exists costo_modello_ai_cache_check;
alter table costo_modello_ai add constraint costo_modello_ai_cache_check
  check (cache_scrittura_volte >= 0 and cache_scrittura_volte <= 10
         and cache_lettura_volte >= 0 and cache_lettura_volte <= 10);
comment on constraint costo_modello_ai_cache_check on costo_modello_ai is
  'I moltiplicatori della cache stanno fra 0 e 10: sono «quante volte il prezzo di ingresso», non euro.';

-- ---------------------------------------------------------------------
-- 2. Le ultime cose dette
-- ---------------------------------------------------------------------
-- ⚠️ `security invoker`, apposta: decide la RLS di `dettature` (solo il
--    titolare), non una seconda serratura da tenere allineata. Dentro
--    `voce_apri_sessione` gira come la proprietaria, ma con l'identità
--    della chiave già impostata: `auth.uid()` è comunque quella giusta.
-- ⚠️ DIECI MINUTI E SEI SCAMBI. Una conversazione col gestionale mentre
--    si lavora è fatta di frasi ravvicinate; una frase di un'ora fa
--    ripescata come contesto farebbe capire male quella di adesso.
-- ⚠️ Le dettature fermate dal tetto non entrano: non hanno avuto risposta.
create or replace function voce_scambi_recenti()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $fn$
  -- ⚠️ L'ora si consegna gia' nel fuso del locale (HH:MM): il modello la
  --    legge accanto a «adesso sono le…», che e' italiana, e un orario a
  --    Greenwich gli farebbe credere che la frase di prima sia di due ore fa.
  select coalesce(jsonb_agg(x order by t), '[]'::jsonb)
    from (
      select d.creato_il as t,
             jsonb_build_object(
               'quando', to_char(d.creato_il at time zone 'Europe/Rome', 'HH24:MI'),
               'detto',  d.testo,
               'capito', coalesce(
                 (select string_agg(a.frase, ' · ' order by a.progressivo)
                    from azioni_dettate a where a.dettatura_id = d.id),
                 d.messaggio,
                 'Non ho segnato niente.')) as x
        from dettature d
       where d.creato_da = auth.uid()
         and d.creato_il > now() - interval '10 minutes'
         and d.esito <> 'tetto'
       order by d.creato_il desc
       limit 6
    ) s
$fn$;

comment on function voce_scambi_recenti() is
  'Le ultime cose dette a MEMO negli ultimi dieci minuti (al massimo sei), con quello che aveva capito: e'' la memoria breve che gli permette di capire «mettine due» o una risposta a una sua domanda.';

revoke all on function voce_scambi_recenti() from public, anon, authenticated;
grant execute on function voce_scambi_recenti() to authenticated;

-- ---------------------------------------------------------------------
-- 3. La porta della Scorciatoia la riceve dentro la sessione
-- ---------------------------------------------------------------------
-- Corpo preso dal database vivo il 25/10/2026; cambia solo il `return`.
create or replace function voce_apri_sessione(p_chiave text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_riga   chiavi_voce%rowtype;
  v_lim    record;
  v_spesa  record;
  v_cat    jsonb;
begin
  if nullif(btrim(coalesce(p_chiave, '')), '') is null then
    raise exception 'Manca la chiave.';
  end if;

  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    -- ⚠️ Non si dice se la chiave non esiste o se e' stata revocata: sono
    --    due informazioni utili solo a chi sta provando a indovinarla.
    raise exception 'Questa chiave non vale.';
  end if;

  select * into v_lim from voce_limite_dettature(v_riga.utente_id);
  if v_lim.superato then
    raise exception '%', v_lim.frase;
  end if;

  update chiavi_voce set ultimo_uso = now(), usi = usi + 1 where id = v_riga.id;

  -- 🔴 DA QUI IN POI SI E' LUI. La chiave e' l'autenticazione, e i claims
  --    valgono per questa transazione soltanto (`true` = local).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare: i comandi vocali sono solo suoi.';
  end if;

  select * into v_spesa from spesa_ai_del_mese();
  v_cat := voce_catalogo();

  return jsonb_build_object(
    'utente',   v_riga.utente_id,
    'chiave',   v_riga.nome,
    'catalogo', v_cat,
    'spesa',    to_jsonb(v_spesa),
    -- 25/10/2026: la memoria breve, dalla stessa porta e con lo stesso freno.
    'scambi',   voce_scambi_recenti());
end $function$;

revoke all on function voce_apri_sessione(text) from public, anon, authenticated;
grant execute on function voce_apri_sessione(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Il costo della cache, scritto sulla riga appena nata
-- ---------------------------------------------------------------------
-- Una funzione sola per le due porte: il conto della cache non deve poter
-- divergere fra l'app e l'orologio.
create or replace function aggiungi_cache_dettatura(p_esito jsonb, p_modello text,
                                                    p_scritti integer, p_letti integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id     uuid := nullif(p_esito->>'dettatura_id', '')::uuid;
  v_prezzo costo_modello_ai%rowtype;
  v_extra  numeric := 0;
begin
  if v_id is null or (coalesce(p_scritti, 0) = 0 and coalesce(p_letti, 0) = 0) then
    return p_esito;
  end if;

  select * into v_prezzo from costo_modello_ai where modello = p_modello;
  if found then
    v_extra := round(
      coalesce(p_scritti, 0)::numeric / 1000000 * v_prezzo.euro_milione_in * v_prezzo.cache_scrittura_volte +
      coalesce(p_letti, 0)::numeric   / 1000000 * v_prezzo.euro_milione_in * v_prezzo.cache_lettura_volte, 5);
  end if;

  -- ⚠️ Se il modello non e' a listino, `scrivi_dettatura` ha gia' scritto
  --    sulla riga che il costo non e' stato conteggiato: qui non si
  --    aggiunge niente, e quella frase resta vera.
  update dettature
     set token_cache_scritti = coalesce(p_scritti, 0),
         token_cache_letti   = coalesce(p_letti, 0),
         costo_euro          = coalesce(costo_euro, 0) + v_extra
   where id = v_id;

  return p_esito || jsonb_build_object(
    'costo_euro', coalesce((p_esito->>'costo_euro')::numeric, 0) + v_extra);
end $function$;

comment on function aggiungi_cache_dettatura(jsonb, text, integer, integer) is
  'Aggiunge alla dettatura appena registrata i token della cache del modello e il loro costo. La chiamano solo le due porte di registrazione: da fuori non si usa.';

revoke all on function aggiungi_cache_dettatura(jsonb, text, integer, integer)
  from public, anon, authenticated;

-- ⚠️ Un parametro in piu' fa una funzione NUOVA: le vecchie si tolgono,
--    altrimenti ogni chiamata per nome diventa ambigua (42725, a tempo di
--    esecuzione). Per nome, cosi' la migrazione si puo' rilanciare.
do $toglie$
declare r record;
begin
  for r in select p.oid::regprocedure as firma from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('registra_dettatura', 'registra_dettatura_da_chiave')
              and not ('p_token_cache_letti' = any(coalesce(p.proargnames, '{}'::text[])))
  loop
    execute 'drop function ' || r.firma;
  end loop;
end $toglie$;

-- Corpo preso dal database vivo il 25/10/2026; si aggiungono i due
-- parametri e l'ultima riga.
create or replace function registra_dettatura(
  p_testo               text,
  p_azioni              jsonb   default '[]'::jsonb,
  p_esito               text    default 'capita',
  p_modello             text    default null,
  p_token_domanda       integer default 0,
  p_token_risposta      integer default 0,
  p_messaggio           text    default null,
  p_token_cache_scritti integer default 0,
  p_token_cache_letti   integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' usare i comandi vocali.';
  end if;
  return aggiungi_cache_dettatura(
    scrivi_dettatura(auth.uid(), p_testo, 'app', p_azioni, p_esito,
                     p_modello, p_token_domanda, p_token_risposta, p_messaggio),
    p_modello, p_token_cache_scritti, p_token_cache_letti);
end $function$;

revoke all on function registra_dettatura(text, jsonb, text, text, integer, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function registra_dettatura(text, jsonb, text, text, integer, integer, text, integer, integer)
  to authenticated;

create or replace function registra_dettatura_da_chiave(
  p_chiave              text,
  p_testo               text,
  p_azioni              jsonb   default '[]'::jsonb,
  p_esito               text    default 'capita',
  p_modello             text    default null,
  p_token_domanda       integer default 0,
  p_token_risposta      integer default 0,
  p_messaggio           text    default null,
  p_token_cache_scritti integer default 0,
  p_token_cache_letti   integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_riga chiavi_voce%rowtype;
  v_lim  record;
begin
  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    -- ⚠️ Stessa identica frase dell'altra porta: due rifiuti diversi
    --    direbbero a chi prova che una delle due chiavi esiste.
    raise exception 'Questa chiave non vale.';
  end if;

  -- 🔴 IL FRENO CHE MANCAVA. Prima di scrivere, non dopo.
  select * into v_lim from voce_limite_dettature(v_riga.utente_id);
  if v_lim.superato then
    raise exception '%', v_lim.frase;
  end if;

  -- 🔴 LA TRACCIA CHE MANCAVA. Una dettatura entrata senza lasciare segno
  --    sulla chiave e' una dettatura che nessuno puo' contare quando il
  --    numero cresce e Alessio non ha parlato.
  update chiavi_voce
     set ultimo_uso = now(),
         usi        = usi + 1,
         scritture  = coalesce(scritture, 0) + 1
   where id = v_riga.id;

  -- 🔴 Da qui in poi si e' lui, per questa transazione soltanto: e' cio'
  --    che permette alle funzioni sottostanti di fare i loro controlli sul
  --    ruolo vero invece che su un anonimo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare.';
  end if;

  return aggiungi_cache_dettatura(
    scrivi_dettatura(v_riga.utente_id, p_testo, 'scorciatoia', p_azioni, p_esito,
                     p_modello, p_token_domanda, p_token_risposta, p_messaggio),
    p_modello, p_token_cache_scritti, p_token_cache_letti);
end $function$;

revoke all on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text, integer, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. La verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_ris      jsonb;
  v_ris2     jsonb;
  v_scambi   jsonb;
  v_d        dettature%rowtype;
  v_prezzo   costo_modello_ai%rowtype;
  v_atteso   numeric;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  -- Le porte: la memoria non e' aperta agli anonimi, il calcolo della
  -- cache non e' chiamabile da nessuno da fuori.
  if has_function_privilege('anon', 'voce_scambi_recenti()', 'execute') then
    raise exception 'VERIFICA: la memoria breve di MEMO e'' aperta agli anonimi.';
  end if;
  if has_function_privilege('authenticated', 'aggiungi_cache_dettatura(jsonb, text, integer, integer)', 'execute') then
    raise exception 'VERIFICA: il calcolo del costo della cache e'' chiamabile da fuori.';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('registra_dettatura', 'registra_dettatura_da_chiave')) <> 2 then
    raise exception 'VERIFICA: delle due porte di registrazione ne esiste piu'' di una versione.';
  end if;

  select * into v_prezzo from costo_modello_ai where modello = 'claude-sonnet-5';
  if not found then
    raise exception 'VERIFICA: il modello di MEMO non e'' a listino.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Una dettatura senza cache costa come prima, e le colonne della
    --     cache dicono zero, non vuoto: la cache c'era ed e' servita a niente.
    v_ris := registra_dettatura('ZZ verifica: aggiungi il latte', '[]'::jsonb, 'capita',
                                'claude-sonnet-5', 1000, 100, 'ZZ capito il latte', 0, 0);
    select * into v_d from dettature where id = (v_ris->>'dettatura_id')::uuid;
    v_atteso := round(1000::numeric / 1000000 * v_prezzo.euro_milione_in
                    + 100::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    if v_d.costo_euro is distinct from v_atteso or v_d.token_cache_letti is not null then
      raise exception 'VERIFICA (1): senza cache il costo e'' % (atteso %), cache letta %.',
        v_d.costo_euro, v_atteso, v_d.token_cache_letti;
    end if;

    -- (2) Con la cache il costo cresce esattamente di scritti×1,25 +
    --     letti×0,10 al prezzo di ingresso, e la risposta lo dice uguale.
    v_ris2 := registra_dettatura('ZZ verifica: mettine due', '[]'::jsonb, 'capita',
                                 'claude-sonnet-5', 200, 100, 'ZZ capito due', 13000, 50000);
    select * into v_d from dettature where id = (v_ris2->>'dettatura_id')::uuid;
    v_atteso := round(200::numeric / 1000000 * v_prezzo.euro_milione_in
                    + 100::numeric / 1000000 * v_prezzo.euro_milione_out, 5)
              + round(13000::numeric / 1000000 * v_prezzo.euro_milione_in * v_prezzo.cache_scrittura_volte
                    + 50000::numeric / 1000000 * v_prezzo.euro_milione_in * v_prezzo.cache_lettura_volte, 5);
    if v_d.costo_euro is distinct from v_atteso
       or (v_ris2->>'costo_euro')::numeric is distinct from v_atteso
       or v_d.token_cache_scritti is distinct from 13000 or v_d.token_cache_letti is distinct from 50000 then
      raise exception 'VERIFICA (2): con la cache il costo e'' % (risposta %, atteso %), scritti %, letti %.',
        v_d.costo_euro, v_ris2->>'costo_euro', v_atteso, v_d.token_cache_scritti, v_d.token_cache_letti;
    end if;

    -- (3) La memoria breve restituisce le due, in ordine, con quello che
    --     MEMO aveva capito.
    v_scambi := voce_scambi_recenti();
    if jsonb_array_length(v_scambi) < 2
       or v_scambi->(jsonb_array_length(v_scambi) - 2)->>'detto' is distinct from 'ZZ verifica: aggiungi il latte'
       or v_scambi->(jsonb_array_length(v_scambi) - 1)->>'detto' is distinct from 'ZZ verifica: mettine due'
       or v_scambi->(jsonb_array_length(v_scambi) - 1)->>'capito' is distinct from 'ZZ capito due' then
      raise exception 'VERIFICA (3): la memoria breve dice %.', v_scambi;
    end if;

    -- (4) Una dettatura di un''ora fa NON entra nella memoria.
    update dettature set creato_il = now() - interval '1 hour'
     where id = (v_ris->>'dettatura_id')::uuid;
    v_scambi := voce_scambi_recenti();
    if exists (select 1 from jsonb_array_elements(v_scambi) e
                where e->>'detto' = 'ZZ verifica: aggiungi il latte') then
      raise exception 'VERIFICA (4): una frase di un''ora fa e'' finita nella memoria breve.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della memoria breve di MEMO');

  raise notice 'Fatto: MEMO ricorda gli ultimi dieci minuti e il conto della cache e'' giusto al centesimo. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000003', 'memo_ricorda_gli_ultimi_minuti')
on conflict (version) do nothing;
