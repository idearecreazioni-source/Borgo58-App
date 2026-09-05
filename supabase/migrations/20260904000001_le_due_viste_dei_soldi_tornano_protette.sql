-- =====================================================================
-- LE DUE VISTE DEI SOLDI TORNANO PROTETTE — 04/09/2026
-- =====================================================================
--
-- 🔴 IL DIFETTO, MISURATO E POI VISTO SUCCEDERE. `v_cash_balance` e
-- `v_discounts_gifts_monthly` erano nate col `security_invoker` il
-- 02/08 (`20260802000011`). L'hanno perso a un `create or replace view`
-- successivo — il 13/08, `…000009` e `…000008` — che non ripeteva
-- l'opzione: **Postgres non la conserva se non la si riscrive**, e non
-- solleva nessun errore. I commenti di quelle due migrazioni parlano del
-- vincolo 42P16 sull'ordine delle colonne: chi scriveva pensava a
-- quello.
--
-- ⚠️ SENZA `security_invoker` UNA VISTA GIRA COI PERMESSI DEL SUO
-- PROPRIETARIO, che qui e' `postgres` — e `postgres` ha `rolbypassrls`
-- **e** possiede le tabelle sorgenti, su cui la RLS non e' forzata. Due
-- strade indipendenti per lo stesso effetto: la RLS non viene applicata.
--
-- ✅ PROVATO SUL PROGETTO DI PROVA, non dedotto: con l'utente staff di
-- collaudo, `is_titolare()` risponde NO e le tabelle sorgenti
-- (`cash_movements`, `discounts_gifts`, `entities`) rispondono **vuote** —
-- la RLS agisce. Le due viste, nella **stessa sessione e nello stesso
-- istante**, rispondevano NON vuote, con lo stesso numero di righe che
-- vede il titolare. Non e' una configurazione sospetta: e' un
-- comportamento osservato.
--
-- ---------------------------------------------------------------------
-- PERCHE' `alter view … set` E NON `create or replace view`
-- ---------------------------------------------------------------------
-- 🔴 Perche' NON si tocca la definizione. Riscrivere il corpo vorrebbe
-- dire ricopiarlo da qualche parte, ed e' la trappola che questo
-- progetto ha gia' pagato il 18/08: *una vista o una funzione si
-- riprende dal DATABASE, mai dal file che l'ha creata* — fra i due ci
-- stanno tutte le migrazioni che l'hanno toccata nel frattempo, e
-- `v_cash_balance` ne ha tre. `alter view … set` cambia **solo
-- l'opzione**: il corpo resta bit per bit quello di adesso.
--
-- ⚠️ E' idempotente per costruzione: rimettere un'opzione al valore che
-- ha gia' non fa niente e non fallisce (§5 punto 3).
--
-- ---------------------------------------------------------------------
-- COSA QUESTA MIGRAZIONE **NON** FA, ed e' la parte da leggere
-- ---------------------------------------------------------------------
-- ⚠️ LE ALTRE OTTO VISTE SENZA `security_invoker` NON SI TOCCANO. Sono
-- aperture **volute e dichiarate**, non dimenticanze:
--   · le sei `_display` — il pattern e' scritto nel Contratto §6 e ogni
--     vista porta il proprio commento («senza unit_cost», «senza
--     importi», «Niente food cost/margine»);
--   · `v_stock_levels` — alla nascita, 02/08: «Nessun dato economico:
--     sicura per titolare e staff»;
--   · `v_recipe_allergens` — 01/08: «leggibile anche dallo staff … sicura»,
--     riconfermata il 29/08 con la ragione: metterle `security_invoker`
--     **le renderebbe mute in cucina**.
-- 🔴 Il discriminante non e' la meccanica — identica in tutte e dieci —
-- ma DUE cose: le altre otto **non espongono colonne economiche** (zero,
-- misurate dal catalogo) e **qualcuno le ha decise per iscritto**. Queste
-- due espongono dodici colonne di denaro e nessuno le ha decise: sono
-- nate protette.
--
-- ---------------------------------------------------------------------
-- IL PERIMETRO, DETTO CON PRECISIONE
-- ---------------------------------------------------------------------
-- 🔴 UNA STESURA PRECEDENTE DICEVA «non si toccano nemmeno grants», ED
-- ERA FALSO: questa migrazione **crea una funzione nuova** e ne fissa i
-- privilegi con un `revoke` e un `grant`. Dirlo largo per farlo sembrare
-- innocuo e' esattamente cio' che questo progetto rifiuta — e su una
-- migrazione il cui argomento sono i permessi, sarebbe la frase peggiore
-- da lasciare scritta.
--
-- Quello che questa migrazione fa, per intero:
--   1. cambia UNA OPZIONE su due viste esistenti (`security_invoker`);
--   2. riscrive il `comment on view` di quelle due;
--   3. AGGIUNGE UNA FUNZIONE NUOVA — `public.viste_che_scavalcano_rls()`,
--      una RPC di sola diagnosi che elenca quali viste scavalcano la RLS —
--      e ne dichiara i privilegi: chiusa a `public`, `anon` e
--      `authenticated`, poi concessa ad `authenticated` perche' la
--      chiama la prova col token del titolare. Dentro, il portiere
--      `public.is_titolare()` **rifiuta** chi titolare non e'. Serve alla
--      rete automatica: senza, l'elenco delle viste che scavalcano
--      tornerebbe a essere una lista scritta a mano che scade.
--
-- ⚠️ QUELLO CHE NON TOCCA, ed e' la parte che vale la pena affermare:
-- **nessun grant, nessuna policy, nessun ruolo e nessun dato di oggetti
-- gia' esistenti**. Le tabelle sorgenti restano com'erano — stessa RLS,
-- stesse policy, stessi permessi — e **nessun dato applicativo viene
-- inserito, aggiornato o cancellato**.
--
-- 🔴 UNA STESURA PRECEDENTE DICEVA ANCHE «nessuna riga viene letta», ED
-- ERA FALSO, per la seconda volta in questo stesso blocco. La verifica
-- legge, e va detto per intero:
--   · il **catalogo di PostgreSQL** (`pg_class`, `pg_namespace`,
--     `pg_attribute`) — che descrive la forma del database, non i dati
--     del locale;
--   · **una riga di `user_roles`**, quella di un titolare qualsiasi,
--     perche' senza il suo identificativo non si possono impostare i
--     claim e la RPC col portiere non si potrebbe chiamare. Senza quella
--     lettura il controllo (c) non esisterebbe, e la funzione sarebbe
--     creata senza che nessuno l'abbia mai fatta rispondere.
--
-- ⚠️ E la distinzione che conta per chi legge: **nessun dato economico
-- esce da questa migrazione**. Il blocco di verifica non interroga le due
-- viste, non tocca `cash_movements` ne' `discounts_gifts`, e il suo unico
-- `raise notice` stampa un conteggio di viste — non un saldo, non un
-- importo, non una riga.

-- ⚠️ SE QUESTA MIGRAZIONE SI FERMA NELLA VERIFICA, le due `alter view`
-- sono gia' avvenute e la riga in `applied_migrations` no (§8, il caso
-- misurato il 23/08: cio' che sta fuori da un blocco `do` non viene
-- annullato). Non e' un guaio: `alter view … set` mette un'opzione al
-- valore che gia' ha senza fallire, quindi si rilancia e basta. Chi la
-- rilancia se ne accorge da `npm run migra`, che la vedra' ancora fra le
-- mancanti.

-- ---------------------------------------------------------------------
-- 1. Le due viste tornano a rispettare la RLS di chi le interroga
-- ---------------------------------------------------------------------
alter view public.v_cash_balance            set (security_invoker = true);
alter view public.v_discounts_gifts_monthly set (security_invoker = true);

comment on view public.v_cash_balance is
  'Due saldi separati: `balance` e'' il CONTANTE atteso nel cassetto, `saldo_banca` e'' il conto corrente. Sommarli non ha senso finche'' non si sa a che serve il totale. 🔴 `security_invoker` e'' OBBLIGATORIO qui: legge `cash_movements`, che e'' titolare-only. Senza, la vista gira come `postgres` e scavalca quella regola — successo dal 13/08/2026 al 04/09/2026, e provato dal vivo. Chi la riscrive con `create or replace view` DEVE ripetere `with (security_invoker = true)`.';

comment on view public.v_discounts_gifts_monthly is
  'Aggregazione mensile per la revisione fiscale. Per type=omaggio, total_full del mese e'' il totale a valore di listino degli omaggi. 🔴 `security_invoker` e'' OBBLIGATORIO qui: legge `discounts_gifts`, dove la regola dice «il titolare, oppure chi ha scritto la riga». Senza, i totali comprendono le righe di tutti — successo dal 13/08/2026 al 04/09/2026. Chi la riscrive con `create or replace view` DEVE ripetere `with (security_invoker = true)`.';

-- ---------------------------------------------------------------------
-- 2. La rete: quali viste scavalcano la RLS, chiesto al CATALOGO
-- ---------------------------------------------------------------------
-- 🔴 PERCHE' UNA FUNZIONE E NON UN ELENCO NELLA PROVA. Il difetto e'
-- durato tre settimane perche' `create or replace view` perde l'opzione
-- **in silenzio**: nessun errore, nessun segnale. Un elenco scritto a
-- mano in una prova scade il giorno dopo; una funzione che legge il
-- catalogo vede anche la vista che qualcuno scrivera' fra sei mesi.
-- Stessa forma di `funzioni_aperte_ad_anon` (13/08) e
-- `funzioni_senza_portiere` (19/08).
--
-- ⚠️ PORTIERE CHE RIFIUTA, non filtro nella `where` (regola del 27/08).
-- Chi la chiama? **Una prova automatica, col token del titolare** —
-- nessun trigger, nessuna funzione del database, nessun servizio. Quindi
-- e' il caso (b). Un filtro darebbe a chi non e' titolare un elenco
-- vuoto, che si legge «nessuna vista scavalca la RLS»: una rassicurazione
-- falsa proprio sulla rete che esiste per non farsi rassicurare.
create or replace function public.viste_che_scavalcano_rls()
returns table(vista text, espone_denaro boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not (select public.is_titolare()) then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  select c.relname::text,
         -- ⚠️ Il setaccio dice DOVE GUARDARE, non cosa e' vero (26/08): una
         --    colonna che si chiama «quantita_arrivata» finisce qui dentro
         --    ed e' una quantita' di merce. Serve a ordinare per gravita',
         --    non a decidere al posto di chi legge.
         exists (select 1 from pg_attribute a
                  where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                    and a.attname ~* '(cost|prezz|price|import|amount|margin|ricav|utile|iva|vat|saldo|balance|entrat|uscit|takings|float|prestit|forgone|collected|_full)')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     -- ⚠️ NON `= 'security_invoker=true'`: Postgres conserva il valore
     --    COSI' COM'E' STATO SCRITTO, e `on`, `1`, `yes` sono tutti veri
     --    quanto `true`. Un confronto letterale direbbe «scavalca» di una
     --    vista protetta con la parola giusta e la sillaba diversa.
     and not coalesce(
       (select split_part(o, '=', 2)::boolean
          from unnest(coalesce(c.reloptions,'{}')) o
         where o like 'security_invoker=%'), false)
   order by 1;
end
$fn$;

-- Ogni funzione nuova nasce eseguibile da chiunque abbia la chiave
-- pubblica: si chiude e poi si concede a chi serve davvero (regola
-- dell'11/08). Qui serve al titolare, che e' chi lancia la prova.
revoke all on function public.viste_che_scavalcano_rls() from public, anon, authenticated;
grant execute on function public.viste_che_scavalcano_rls() to authenticated;

comment on function public.viste_che_scavalcano_rls() is
  'Le viste di `public` senza `security_invoker`: girano coi permessi del proprietario e non applicano la RLS di chi le interroga. Non sono tutte un difetto — otto sono aperture volute e dichiarate (Contratto §6). La rete serve perche'' l''elenco non cresca in silenzio: `create or replace view` perde l''opzione senza dare errore.';

-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
-- ⚠️ QUESTA VERIFICA GIRA COME PROPRIETARIA, quindi **non puo'** provare
-- che la RLS morda: dentro una migrazione `auth.uid()` e' vuoto e i
-- permessi sono quelli di chi possiede tutto (lezione del 16/08). Qui si
-- prova la PROPRIETA' DELLO SCHEMA — l'opzione c'e', e sulle altre otto
-- non e' comparsa. Che lo staff smetta di vedere i saldi lo prova
-- `tests/app/permessi.test.js`, col token di un utente vero.
do $verifica$
declare
  v_scavalcano text;
  v_tit        uuid;
  v_quante     int;
begin
  -- (a) LE DUE SONO PROTETTE. Stesso riconoscimento robusto della rete: si
  --     legge il valore come booleano, non si confronta la parola.
  select string_agg(c.relname, ', ')
    into v_scavalcano
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and c.relname in ('v_cash_balance','v_discounts_gifts_monthly')
     and not coalesce(
       (select split_part(o, '=', 2)::boolean
          from unnest(coalesce(c.reloptions,'{}')) o
         where o like 'security_invoker=%'), false);
  if v_scavalcano is not null then
    raise exception 'Queste dovevano tornare protette e non lo sono: %', v_scavalcano;
  end if;

  -- (b) 🔴 IL VERSO OPPOSTO, e serve quanto il primo: se questa migrazione
  --     avesse protetto anche una delle aperture VOLUTE, le renderebbe mute
  --     in cucina — un guasto in servizio, non una correzione.
  -- ⚠️ E si controlla con un'ARITMETICA, non con un elenco di nomi: erano
  --     dieci, due tornano protette, ne devono restare **otto**. Un elenco
  --     scritto qui sarebbe il doppione di quello che vive nella prova, e
  --     due elenchi della stessa cosa prima o poi divergono — che e'
  --     esattamente il difetto che questa migrazione chiude.
  select count(*) into v_quante
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce(
       (select split_part(o, '=', 2)::boolean
          from unnest(coalesce(c.reloptions,'{}')) o
         where o like 'security_invoker=%'), false);
  if v_quante <> 8 then
    raise exception 'Le viste che scavalcano la RLS dovrebbero essere 8 e sono %. O ne e'' stata toccata una che non andava toccata, o ne e'' nata una nuova: guardare quale con public.viste_che_scavalcano_rls().', v_quante;
  end if;

  -- (c) LA RETE RISPONDE, e risponde il vero: una funzione che si CREA non
  --     e' una funzione che RISPONDE (17/08). Qui la si chiama davvero.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare in user_roles: la rete non si puo'' provare. Su un database ricostruito da zero, assegnare i ruoli prima (docs/AMBIENTE_PROVA.md).';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  if exists (select 1 from public.viste_che_scavalcano_rls()
              where vista in ('v_cash_balance','v_discounts_gifts_monthly')) then
    raise exception 'La rete vede ancora le due viste dei soldi fra quelle che scavalcano: o la migrazione non ha preso, o la rete e'' rotta.';
  end if;

  -- ⚠️ E il contrario, che e' cio' che rende la rete credibile: se non ne
  --    vedesse NESSUNA risponderebbe sempre «tutto a posto» — un guardiano
  --    che tace non si distingue da uno che approva.
  if (select count(*) from public.viste_che_scavalcano_rls()) <> v_quante then
    raise exception 'La rete e il catalogo non sono d''accordo su quante viste scavalcano: la rete e'' rotta.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Fatto: le due viste dei soldi rispettano la RLS di chi le interroga; restano % aperture volute, e la rete le riconosce.', v_quante;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260904000001', 'le_due_viste_dei_soldi_tornano_protette') on conflict (version) do nothing;
