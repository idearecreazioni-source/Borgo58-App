-- =====================================================================
-- IL PORTIERE QUALIFICATO, E IL PREZZO CHE LA SALA DEVE VEDERE
-- 05/09/2026
-- =====================================================================
--
-- 🔴 DUE RETI HANNO GRIDATO SU DUE CASI CHE NON SONO DIFETTI, e ognuna
-- per una ragione sua. Nessuna delle due si zittisce allargando la
-- maglia: si corregge il metro.
--
--   1. `funzioni_senza_portiere()` accusava `viste_che_scavalcano_rls()`
--      di non avere il portiere. Il portiere ce l'ha, e RIFIUTA: e'
--      scritto `if not (select public.is_titolare()) then raise …`. La
--      rete cerca il GESTO — «se non sei il titolare, rifiuta» — ma
--      riconosceva solo il nome nudo `is_titolare()`, non quello
--      qualificato dallo schema. Misurato sulla catena delle migrazioni:
--      su 448 definizioni, **una sola** scrive il gesto in forma
--      qualificata, ed e' proprio quella. Non e' un caso di scuola: e'
--      la forma che `pg_get_functiondef` restituisce, cioe' quella che si
--      ottiene ogni volta che una funzione viene ripresa dal corpo vivo.
--
--   2. `viste_che_scavalcano_rls()` segnalava `menu_items_display`
--      perche' espone `selling_price`. Quel prezzo e' **il prezzo di
--      listino che la sala deve leggere per prendere una comanda** — non
--      un costo, non un margine, non un saldo. La vista esiste dal 04/08
--      apposta per quello, e il suo commento lo dice: «nome, categoria,
--      prezzo di vendita. Niente food cost/margine — sicura per lo
--      staff». Il setaccio guardava «denaro» dove la regola parla di
--      «denaro RISERVATO», e sono due cose diverse.
--
-- ---------------------------------------------------------------------
-- COSA QUESTA MIGRAZIONE FA, per intero
-- ---------------------------------------------------------------------
--   1. AGGIUNGE `public.gesto_del_portiere(text)` — il criterio «questo
--      testo contiene un rifiuto?» in UN POSTO SOLO. Non e'
--      `security definer`, non tocca nessuna tabella, e' chiusa a tutti:
--      la eseguono le due reti, che girano come proprietarie.
--   2. RIDEFINISCE `funzioni_senza_portiere()`.
--   3. RIDEFINISCE `funzioni_col_portiere()`.
--   4. RIDEFINISCE `viste_che_scavalcano_rls()` — che cambia forma della
--      risposta, quindi passa da `drop` + `create`.
--
-- ⚠️ NON TOCCA `20260904000001`, che e' gia' applicata: una migrazione
-- applicata non si riscrive mai, si corregge con una successiva (regola
-- del 23/08). E non tocca nessuna vista, nessuna tabella, nessuna policy,
-- nessun ruolo e nessun dato: **niente viene inserito, aggiornato o
-- cancellato fra i dati del locale**. La verifica legge il catalogo di
-- PostgreSQL e una riga di `user_roles` (serve l'identificativo del
-- titolare per impostare i claim e poter chiamare reti che hanno il
-- portiere), e costruisce e poi toglie tre funzioni finte e una vista
-- finta, tutte con un nome che comincia per underscore.
--
-- 🔴 IL LIMITE PIU' GRAVE, DETTO SUBITO. I corpi delle due reti sono
-- stati ricostruiti dalla CATENA DELLE MIGRAZIONI, non dal corpo vivo del
-- database — e la regola di questo progetto dice il contrario (18/08: una
-- funzione si riprende dal database, mai dal file che l'ha creata). Da
-- dove questo lavoro e' stato fatto il database non e' raggiungibile.
-- Misurato invece di supposto: `funzioni_senza_portiere` e
-- `funzioni_col_portiere` compaiono in **una sola** migrazione che le
-- definisce (`20260819000007`), e nessun'altra le ha toccate dopo — e'
-- l'unico caso in cui il file e il corpo vivo possono coincidere. **Non
-- e' una dimostrazione che coincidano**: chi applica questa migrazione
-- lascia parlare `npm run migra`, che confronta ogni funzione ridefinita
-- col corpo vivo e si ferma se qualcosa si perde (`scripts/guardie.mjs`).
-- Se quella rete si lamenta, si guarda lei e non questo file.

-- ---------------------------------------------------------------------
-- 1. Il criterio del portiere, in un posto solo
-- ---------------------------------------------------------------------
-- 🔴 PERCHE' UNA FUNZIONE E NON DUE COPIE. Il criterio viveva scritto due
-- volte, dentro `funzioni_senza_portiere()` e dentro
-- `funzioni_col_portiere()`. Correggerne una sola avrebbe prodotto la
-- cosa peggiore: le due reti che dicono l'opposto della stessa funzione —
-- «ha il portiere» per la prima, «non ce l'ha» per la seconda. E' la
-- regola del 26/08: *un criterio scritto in due corpi e' un criterio che
-- fra sei mesi cambia in uno solo.*
--
-- ⚠️ E IL GESTO SI SCRIVE IN QUATTRO MODI, non in due. Il 19/08 se ne
-- riconobbero due (`not is_titolare()` e `not (select is_titolare())`);
-- da oggi anche le due qualificate dallo schema. Sono la stessa frase.
--
-- ⚠️ NON E' UN CONTROLLO SUL NOME. Cercare la parola `is_titolare`
-- direbbe «protetta» di una funzione che la nomina in un commento, e —
-- peggio — di una che la usa come FILTRO nella `where`, che e'
-- precisamente cio' che questo progetto non considera un portiere
-- (27/08: un filtro risponde vuoto, un portiere rifiuta). Si cerca la
-- negazione, cioe' il rifiuto.
create or replace function public.gesto_del_portiere(p_testo text)
returns boolean
language sql
immutable
set search_path = public
as $gesto$
  select p_testo ~ 'not\s+\(?\s*(select\s+)?(public\.)?is_titolare\s*\(\s*\)'
      or p_testo ~ 'auth\.uid\s*\(\s*\)\s+is\s+null';
$gesto$;

-- Nessun utente la chiama: la eseguono le due reti, che sono
-- `security definer` e girano come proprietarie. Caso (a) della regola del
-- 27/08 — si chiude la porta, e non serve nessun portiere.
revoke all on function public.gesto_del_portiere(text) from public, anon, authenticated;

comment on function public.gesto_del_portiere(text) is
  'Vero se il testo di una funzione contiene un RIFIUTO — «se non sei il titolare, fermati» — nelle quattro scritture che il progetto usa, qualificate dallo schema comprese. E'' il criterio unico di `funzioni_senza_portiere()` e `funzioni_col_portiere()`: scritto in un posto solo perche'' le due reti non possano dire due cose diverse della stessa funzione.';

-- ---------------------------------------------------------------------
-- 2. La rete che elenca chi il portiere NON ce l'ha
-- ---------------------------------------------------------------------
-- Il corpo e' quello del 19/08. Cambiano tre cose, e nient'altro:
--   · il criterio non e' piu' scritto qui dentro: si chiede a
--     `gesto_del_portiere()`;
--   · prima di guardare si tolgono i commenti (**come prima**) E le
--     stringhe (**nuovo**);
--   · `p.prokind = 'f'`, che chiude la trappola del 23/08 —
--     `pg_get_functiondef` su un'aggregata solleva un errore che ferma
--     tutta la query, e il filtro puo' essere valutato dopo. Misurato:
--     nello schema non c'e' nessuna procedura e nessuna aggregata, quindi
--     oggi non cambia una riga.
--
-- 🔴 PERCHE' ANCHE LE STRINGHE. I commenti si toglievano gia' dal 19/08:
-- un portiere nominato in un commento non e' un portiere. Una stringa e'
-- lo stesso caso da un'altra porta — `select 'not is_titolare()'` non
-- rifiuta niente e nessuno — e finora bastava a far sembrare protetta una
-- funzione. Da oggi non basta piu', e c'e' una controprova che lo
-- dimostra costruendo il caso apposta.
--
-- ⚠️ IL VERSO IN CUI QUESTA DEPURAZIONE PUO' SBAGLIARE, ed e' quello
-- buono. Togliere testo puo' solo rendere il rifiuto PIU' difficile da
-- trovare, mai piu' facile: quindi un taglio storto fa comparire una
-- funzione in questo elenco quando non doveva — un allarme, che si vede.
-- Non puo' produrre un silenzio. Misurato sulla catena delle migrazioni:
-- su 448 definizioni, l'unica che cambia classificazione e'
-- `viste_che_scavalcano_rls`, che e' il caso da correggere.
--
-- ⚠️ E IL LIMITE DEL 19/08 RESTA INTERO: si guarda se il rifiuto c'e'
-- SCRITTO, non se venga eseguito. Un rifiuto dentro un ramo mai percorso
-- passerebbe.
create or replace function funzioni_senza_portiere()
returns table (nome text, tocca_denaro boolean)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  with d as (
    select p.oid,
           p.proname::text as nome,
           -- 1) via i commenti: `--` fino a fine riga (19/08).
           -- 2) via le stringhe: un apice, poi qualunque cosa che non sia
           --    un apice oppure una coppia di apici (che in SQL e'
           --    l'apice scritto dentro una stringa), poi l'apice che
           --    chiude.
           regexp_replace(
             regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g'),
             '''(''''|[^''])*''', ' ', 'g') as corpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
  )
  select d.nome, (d.corpo ~* '(unit_cost|costo|price|prezzo|amount|importo)')
    from d
   where not public.gesto_del_portiere(d.corpo)
   order by d.nome;
end;
$function$;

comment on function funzioni_senza_portiere() is
  'Le funzioni che scavalcano la RLS (security definer) e che lo staff puo'' eseguire senza che nessuno chieda chi sia. L''elenco si costruisce dal catalogo a ogni esecuzione: quello congelato sta nella prova, non qui. Il rifiuto si cerca dopo aver tolto commenti e stringhe — nominarlo li'' dentro non protegge niente.';

revoke all on function funzioni_senza_portiere() from public, anon, authenticated;
grant execute on function funzioni_senza_portiere() to authenticated;

-- ---------------------------------------------------------------------
-- 3. La rete gemella: chi il portiere ce l'ha
-- ---------------------------------------------------------------------
-- Serve alla prova che impedisce a una sanatoria di chiamare una di
-- quelle funzioni senza impostare i claim — il difetto che il 16/08
-- fermo' due volte una consegna in produzione.
--
-- 🔴 QUI SI GUARDA IL TESTO GREZZO, e NON e' una dimenticanza: e' che le
-- due reti sbagliano in due direzioni opposte, e ognuna deve arrotondare
-- dalla parte in cui l'errore si vede.
--   · `funzioni_senza_portiere()` ELENCA I SOSPETTI: credere a un
--     portiere che non c'e' produce un SILENZIO. Li' si e' severi —
--     commenti e stringhe non contano.
--   · `funzioni_col_portiere()` ELENCA CHI VA TRATTATO CON CAUTELA: non
--     riconoscere un portiere che c'e' toglie una sanatoria dalla
--     sorveglianza, e anche quello e' un silenzio. Li' si e' larghi —
--     contare una funzione di troppo produce al massimo un'accusa
--     rumorosa a una migrazione, che si legge e si chiude.
-- Il CRITERIO e' lo stesso — `gesto_del_portiere()` — e il testo su cui
-- lo si applica e' diverso apposta. Le due cose sono separate proprio
-- perche' questa differenza si possa leggere invece di dedurla.
CREATE OR REPLACE FUNCTION public.funzioni_col_portiere()
 RETURNS TABLE(nome text, portiere text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  select p.proname::text,
         case
           when pg_get_functiondef(p.oid) like '%is_titolare()%'
            and pg_get_functiondef(p.oid) like '%auth.uid()%' then 'is_titolare() e auth.uid()'
           when pg_get_functiondef(p.oid) like '%is_titolare()%' then 'is_titolare()'
           else 'auth.uid()'
         end
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     -- Il portiere si riconosce dalla FORMA, non dalla parola: questa
     -- funzione stessa nomina «is_titolare()» dentro un confronto, e con
     -- una ricerca per parola finirebbe nel proprio elenco.
     and public.gesto_del_portiere(pg_get_functiondef(p.oid))
   order by 1;
end;
$function$;

comment on function funzioni_col_portiere() is
  'Le funzioni di `public` che rifiutano chi non deve entrare. Serve alla prova che impedisce a una sanatoria di chiamarle senza impostare i claim. Il criterio e'' `gesto_del_portiere()`, lo stesso di `funzioni_senza_portiere()` — qui pero'' applicato al testo grezzo, perche'' su questo elenco l''errore sicuro e'' quello per eccesso.';

revoke all on function funzioni_col_portiere() from public, anon, authenticated;
grant execute on function funzioni_col_portiere() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Le viste che scavalcano la RLS, e il denaro RISERVATO
-- ---------------------------------------------------------------------
-- 🔴 LA REGOLA CAMBIA UNA PAROLA, E LA PAROLA E' TUTTO: da «zero colonne
-- economiche» a «zero colonne economiche RISERVATE». Il prezzo di listino
-- di un piatto non e' riservato — lo legge il cliente sul menu, e senza
-- di esso nessuno in sala puo' prendere una comanda. Costi d'acquisto,
-- margini, food cost, saldi, incassi e imposte lo sono.
--
-- ⚠️ L'ECCEZIONE E' UNA COPPIA, NON UN NOME DI COLONNA. Esentare «price»
-- o «prezzo» ovunque avrebbe tolto dal setaccio il caso che il setaccio
-- esiste per prendere: una vista che scavalca la RLS e mostra allo staff
-- il **prezzo d'acquisto** di un ingrediente. L'unica riga esente e'
-- `menu_items_display` × `selling_price`, scritta come congiunzione: una
-- seconda colonna di denaro su quella stessa vista continua a essere
-- segnalata, e `selling_price` su qualunque altra vista pure. C'e' una
-- controprova nella verifica che lo dimostra costruendo il caso.
--
-- ⚠️ LA RISPOSTA ORA DICE ANCHE **QUALI** COLONNE. Con un'eccezione in
-- mezzo, un «no» non basta piu': chi legge non potrebbe distinguere «non
-- ha colonne di denaro» da «ne ha una, ed e' quella dichiarata». Un
-- rifiuto che nomina e' la forma che questo progetto pretende ovunque.
--
-- ⚠️ CAMBIA LA FORMA DELLA RISPOSTA, quindi serve `drop` e non
-- `create or replace` (Postgres non cambia il tipo di ritorno di una
-- funzione esistente). E dopo un `drop` i permessi tornano APERTI A
-- CHIUNQUE, chiave pubblica compresa: si richiudono subito sotto, e la
-- verifica controlla che siano richiusi davvero (lezione del 13/08).
drop function if exists public.viste_che_scavalcano_rls();

create or replace function public.viste_che_scavalcano_rls()
returns table(vista text, espone_denaro boolean, colonne_riservate text)
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
  with viste as (
    select c.oid, c.relname::text as nome
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       -- NON `= 'security_invoker=true'`: Postgres conserva il valore
       -- COSI' COM'E' STATO SCRITTO, e `on`, `1`, `yes` sono tutti veri
       -- quanto `true`.
       and not coalesce(
         (select split_part(o, '=', 2)::boolean
            from unnest(coalesce(c.reloptions,'{}')) o
           where o like 'security_invoker=%'), false)
  ),
  riservate as (
    select v.nome, a.attname::text as colonna
      from viste v
      join pg_attribute a on a.attrelid = v.oid
     where a.attnum > 0 and not a.attisdropped
       -- 🔴 SI GUARDA L'INIZIO DI UN SEGMENTO DEL NOME, non una lettera
       --    qualsiasi — ed e' una correzione fatta dopo che la prima
       --    stesura ha gridato su `shopping_list_display.quantita_arrivata`:
       --    dentro «arr-IVA-ta» ci sono le lettere di «iva». Non e' un
       --    caso isolato, e la misura lo dice: sui 976 nomi di colonna del
       --    progetto la ricerca a lettera qualsiasi ne segnalava **104**,
       --    quella ancorata ne segnala **88**, e **tutti e sedici quelli
       --    che cadono sono falsi allarmi** — `reser-VAT-ion_date`,
       --    `att-IVA`, `sal-VAT-o`, `tro-VAT-e`,
       --    `giornate_con_s-COST-amenti`, `pr-IVA-cy_consent_at`.
       --    **Nessuna colonna vera di denaro smette di essere segnalata:
       --    zero.**
       --
       -- ⚠️ NON E' UN'ESENZIONE, ne' per i prezzi ne' per altro: l'elenco
       --    delle parole e' identico: cambia dove devono cominciare. Un
       --    setaccio che grida su una data di prenotazione si impara a
       --    spegnere, ed e' il modo in cui una rete muore.
       --
       -- ⚠️ RESTA UNA RICERCA PER PREFISSO dentro il segmento, e deve
       --    esserlo: `costo`, `prezzo`, `importi`, `ricavi`, `entrate`,
       --    `uscite`, `margine`, `prestito` sono la stessa parola con la
       --    coda diversa. Ancorare anche la fine taglierebbe fuori proprio
       --    le colonne vere.
       --
       -- ⚠️ IL PREZZO, DICHIARATO: una parola di denaro incollata dentro un
       --    segmento senza trattino basso — «sottocosto», «extraimporto» —
       --    adesso non si vede. In questo schema non ce n'e' nessuna
       --    (misurato sugli stessi 976 nomi) e la convenzione e' snake_case:
       --    il giorno che ne nascesse una si allunga l'elenco con la sua
       --    forma, non si torna alla ricerca a lettera qualsiasi.
       --
       -- ⚠️ E il setaccio dice DOVE GUARDARE, non cosa e' vero (26/08):
       --    serve a ordinare per gravita', non a decidere al posto di chi
       --    legge.
       and a.attname ~* '(^|_)(cost|prezz|price|import|amount|margin|ricav|utile|iva|vat|saldo|balance|entrat|uscit|takings|float|prestit|forgone|collected|full)'
       -- 🔴 L'UNICA ECCEZIONE DICHIARATA, e sono DUE condizioni insieme.
       --    `menu_items_display.selling_price` e' il prezzo di listino che
       --    la sala legge per prendere una comanda: la vista esiste dal
       --    04/08 apposta per quello (§3.18) e il suo commento lo dichiara
       --    — «Niente food cost/margine». Toglierla dal setaccio come
       --    NOME di colonna renderebbe invisibile il prezzo d'acquisto su
       --    qualunque altra vista, che e' il caso da prendere.
       and not (v.nome = 'menu_items_display' and a.attname = 'selling_price')
  )
  select v.nome,
         exists (select 1 from riservate r where r.nome = v.nome),
         (select string_agg(r.colonna, ', ' order by r.colonna)
            from riservate r where r.nome = v.nome)
    from viste v
   order by 1;
end
$fn$;

revoke all on function public.viste_che_scavalcano_rls() from public, anon, authenticated;
grant execute on function public.viste_che_scavalcano_rls() to authenticated;

comment on function public.viste_che_scavalcano_rls() is
  'Le viste di `public` senza `security_invoker`: girano coi permessi del proprietario e non applicano la RLS di chi le interroga. `espone_denaro` e `colonne_riservate` dicono se e quali colonne economiche RISERVATE mostrano — costi, margini, saldi, incassi, imposte. Il prezzo di listino della sala non lo e'': l''unica esenzione dichiarata e'' la coppia `menu_items_display` × `selling_price`, e vale solo per quella coppia.';

-- ---------------------------------------------------------------------
-- 5. Verifica
-- ---------------------------------------------------------------------
-- ⚠️ Gira come proprietaria, quindi non puo' provare che la RLS morda
-- (16/08). Prova due cose che invece sono sue: che il CRITERIO
-- discrimina, e che le due reti dicono la stessa cosa della stessa
-- funzione. Ogni caso e' tarato su una risposta gia' nota (26/08), e nei
-- DUE versi: un criterio che dice sempre di si' e uno che dice sempre di
-- no sembrano funzionare tutti e due.
do $verifica$
declare
  v_tit     uuid;
  v_denaro  text;
  v_colonne text;
  v_aperta  boolean;
begin
  -- (a) IL CRITERIO, prima di tutto il resto: se sbaglia lui, ogni cosa
  --     costruita sopra risponde con sicurezza una cosa falsa.
  if not public.gesto_del_portiere('if not is_titolare() then') then
    raise exception 'Il criterio non riconosce piu'' la forma non qualificata, che e'' quella della quasi totalita'' delle funzioni del progetto.';
  end if;
  if not public.gesto_del_portiere('if not (select is_titolare()) then') then
    raise exception 'Il criterio non riconosce piu'' la forma con la select (19/08).';
  end if;
  if not public.gesto_del_portiere('if not public.is_titolare() then') then
    raise exception 'Il criterio non riconosce la forma qualificata dallo schema.';
  end if;
  if not public.gesto_del_portiere('if not (select public.is_titolare()) then') then
    raise exception 'Il criterio non riconosce la forma qualificata dentro una select: e'' il caso che ha fatto gridare la rete.';
  end if;
  if not public.gesto_del_portiere('if auth.uid() is null then') then
    raise exception 'Il criterio non riconosce piu'' il portiere delle funzioni di servizio.';
  end if;
  -- ...e il verso opposto, che e' quello che rende il criterio credibile.
  if public.gesto_del_portiere('select public.is_titolare()') then
    raise exception 'Il criterio scambia una CHIAMATA per un RIFIUTO: un filtro nella where non e'' un portiere (27/08).';
  end if;
  if public.gesto_del_portiere('where is_titolare() or user_id = auth.uid()') then
    raise exception 'Il criterio scambia un filtro nella where per un portiere.';
  end if;
  if public.gesto_del_portiere('select 1') then
    raise exception 'Il criterio dice di si'' a un corpo che non nomina nessun portiere.';
  end if;

  -- Serve un titolare: le reti hanno il portiere, e senza claim rifiutano.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare in user_roles: le reti non si possono chiamare. Su un database ricostruito da zero, assegnare i ruoli prima (docs/AMBIENTE_PROVA.md).';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (b) LE TRE FUNZIONI FINTE. Non si guarda se la rete «funziona»: si
  --     costruiscono i tre casi di cui si conosce gia' la risposta e le si
  --     mette davanti. Una rete che risponde bene a un caso solo non ha
  --     ancora detto niente.
  execute 'create or replace function _prova_portiere_qualificato() returns integer '
       || 'language plpgsql security definer set search_path = public as '
       || '$x$ begin if not (select public.is_titolare()) then '
       || 'raise exception ''riservato''; end if; return 1; end $x$';
  execute 'grant execute on function _prova_portiere_qualificato() to authenticated';

  execute 'create or replace function _prova_portiere_nel_commento() returns integer '
       || 'language sql security definer set search_path = public as '
       || '$x$ -- qui ci sarebbe: if not is_titolare() then, ma non lo si fa'
       || chr(10) || ' select 1; $x$';
  execute 'grant execute on function _prova_portiere_nel_commento() to authenticated';

  execute 'create or replace function _prova_portiere_nella_stringa() returns text '
       || 'language sql security definer set search_path = public as '
       || '$x$ select ''if not is_titolare() then''::text $x$';
  execute 'grant execute on function _prova_portiere_nella_stringa() to authenticated';

  if exists (select 1 from funzioni_senza_portiere() where nome = '_prova_portiere_qualificato') then
    raise exception 'La rete accusa una funzione che rifiuta con «not (select public.is_titolare())»: e'' il difetto che questa migrazione chiude.';
  end if;
  if not exists (select 1 from funzioni_col_portiere() where nome = '_prova_portiere_qualificato') then
    raise exception 'La rete gemella non vede il portiere qualificato: le due reti direbbero due cose diverse della stessa funzione.';
  end if;
  if not exists (select 1 from funzioni_senza_portiere() where nome = '_prova_portiere_nel_commento') then
    raise exception 'Un portiere scritto solo in un COMMENTO basta a far sembrare protetta una funzione.';
  end if;
  if not exists (select 1 from funzioni_senza_portiere() where nome = '_prova_portiere_nella_stringa') then
    raise exception 'Un portiere scritto solo dentro una STRINGA basta a far sembrare protetta una funzione.';
  end if;

  execute 'drop function _prova_portiere_qualificato()';
  execute 'drop function _prova_portiere_nel_commento()';
  execute 'drop function _prova_portiere_nella_stringa()';
  if exists (select 1 from funzioni_senza_portiere()
              where nome in ('_prova_portiere_qualificato',
                             '_prova_portiere_nel_commento',
                             '_prova_portiere_nella_stringa')) then
    raise exception 'La verifica ha lasciato dietro di se'' le funzioni finte.';
  end if;

  -- (c) E LA RETE VERA DEVE RISPONDERE, non solo esistere: se non vedesse
  --     nessuna funzione senza portiere direbbe «tutto a posto» per
  --     sempre. Nel progetto ce ne sono, dichiarate una per una nella
  --     prova: il numero preciso vive li', qui basta che non sia zero.
  if (select count(*) from funzioni_senza_portiere()) = 0 then
    raise exception 'La rete non vede nessuna funzione senza portiere: quasi certamente e'' rotta.';
  end if;

  -- (d) LE VISTE. Nessuna apertura voluta deve esporre denaro RISERVATO.
  select string_agg(vista || ' (' || coalesce(colonne_riservate, '?') || ')', '; ')
    into v_denaro
    from public.viste_che_scavalcano_rls()
   where espone_denaro;
  if v_denaro is not null then
    raise exception 'Una vista che scavalca la RLS espone colonne economiche riservate: %', v_denaro;
  end if;

  -- (e) 🔴 LA CONTROPROVA CHE L'ECCEZIONE E' UNA COPPIA E NON UN NOME.
  --     Una vista nuova con una colonna che si chiama esattamente come
  --     quella esentata deve essere segnalata lo stesso. Senza questo
  --     controllo, allargare un giorno l'esenzione a «tutti i
  --     selling_price» non farebbe diventare rosso niente.
  --     ⚠️ E LA STESSA VISTA FINTA PORTA IL FALSO ALLARME: una colonna
  --        che si chiama «quantita_arrivata» e' una quantita' di merce, e
  --        la prima stesura la segnalava perche' dentro «arrivata» ci
  --        sono le lettere di «iva». I due casi stanno insieme apposta —
  --        una prova che guarda solo il verso buono non dice se il
  --        setaccio DISTINGUE, dice solo che qualcosa trova.
  execute 'create view _prova_vista_col_prezzo as '
       || 'select 1::numeric as selling_price, 2::numeric as quantita_arrivata';
  select colonne_riservate into v_colonne
    from public.viste_che_scavalcano_rls()
   where vista = '_prova_vista_col_prezzo';
  if v_colonne is null then
    raise exception 'L''esenzione non e'' una coppia: «selling_price» e'' diventato un nome esente ovunque.';
  end if;
  if v_colonne <> 'selling_price' then
    raise exception 'Il setaccio nomina «%» invece della sola «selling_price»: o segnala una quantita'' di merce come denaro, o si e'' perso il prezzo.', v_colonne;
  end if;
  execute 'drop view _prova_vista_col_prezzo';
  if exists (select 1 from public.viste_che_scavalcano_rls() where vista = '_prova_vista_col_prezzo') then
    raise exception 'La verifica ha lasciato dietro di se'' la vista finta.';
  end if;

  -- (f) E LA PORTA E' RICHIUSA dopo il drop del punto 4: dopo un `drop`
  --     Postgres rimette il permesso a chiunque, chiave pubblica compresa.
  select has_function_privilege('anon', 'public.viste_che_scavalcano_rls()', 'execute')
    into v_aperta;
  if v_aperta then
    raise exception 'La rete delle viste e'' eseguibile con la chiave pubblica: il revoke dopo il drop non ha preso.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il criterio del portiere vive in un posto solo e riconosce anche la forma qualificata; le viste segnalano il denaro riservato, e il prezzo di listino della sala non lo e''.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260905000001', 'il_portiere_qualificato_e_il_prezzo_di_sala') on conflict (version) do nothing;
