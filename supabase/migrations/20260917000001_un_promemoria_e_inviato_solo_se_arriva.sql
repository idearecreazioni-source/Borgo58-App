-- =====================================================================
-- Borgo 58 · Un promemoria è inviato solo se arriva, e una volta sola
-- =====================================================================
-- 17/09/2026.
--
-- 🔴 QUATTRO DIFETTI NELLO STESSO GIRO — `send_due_task_reminders`, ultima
--    definizione viva in `20260810000005_allarmi.sql` righe 150-201 — e
--    nessuno dei quattro dà un errore.
--
--    1. L'INDIRIZZO DELLA PRODUZIONE È SCRITTO FISSO (riga 184). È l'unica
--       funzione rimasta fuori dal meccanismo: le altre nove che bussano a
--       una funzione online leggono `url_funzioni` dal Vault. ⚠️ Su
--       Borgo58-Prova i promemoria chiamano la funzione della PRODUZIONE:
--       ecco perché quel percorso su Prova **non è verificabile**.
--
--    2. «INVIATO» VUOL DIRE «ACCODATO». `net.http_post` mette la richiesta
--       in coda e restituisce un numero; quel numero veniva buttato via, e
--       la riga dopo scriveva `reminder_sent_at = now()`. Se Telegram non
--       riceveva niente, il promemoria risultava mandato e **non veniva mai
--       più ritentato**.
--
--    3. L'ESITO NON LO REGISTRAVA NIENTE: `net._http_response` non era
--       nominata da nessuna parte del gestionale.
--
--    4. 🔴 E LA PRIMA STESURA DI QUESTA CORREZIONE APRIVA UN DIFETTO NUOVO —
--       rilevato dalla revisione, ed è il motivo per cui questo file è stato
--       riscritto. Toglieva il falso «inviato» e **non impediva il doppione**:
--         · la richiesta partiva PRIMA che si scrivesse la riga che dichiara
--           il possesso, quindi due giri sovrapposti potevano accodarne due;
--         · una risposta persa rendeva il tentativo ritentabile;
--         · e la richiesta non portava con sé niente che permettesse a chi la
--           riceve di riconoscerla.
--       ⚠️ Cioè: *il caso che la correzione trattava bene — «non so se sia
--       arrivato, riprovo» — era esattamente il caso che produceva il
--       secondo Telegram.*
--
-- ⚠️ QUESTO FILE È STATO RISCRITTO, NON RATTOPPATO, e la ragione è la regola
--    del 23/08 letta per intero: una migrazione **già applicata** non si
--    riscrive mai, perché racconta cosa è successo quel giorno. Questa non è
--    applicata da nessuna parte — né su Prova né in produzione — quindi non
--    racconta ancora niente, e una migrazione che ne corregge una mai girata
--    sarebbe una bugia per chi ricostruisse da zero fra un anno.
--
-- ---------------------------------------------------------------------
-- COME SI CHIUDE IL DOPPIONE, in tre pezzi che servono TUTTI E TRE
-- ---------------------------------------------------------------------
-- 🔴 A. IL POSSESSO SI PRENDE PRIMA DELLA RICHIESTA, e si prende scrivendo.
--    La riga «in volo» si inserisce PRIMA di accodare, con un indice unico
--    parziale sulla chiave: due giri sovrapposti, il secondo non scrive e
--    non accoda. L'invariante sta nell'indice, non in un controllo dentro
--    la funzione.
--
-- 🔴 B. LA CHIAVE È DELLA CONSEGNA, NON DEL TENTATIVO. `promemoria:<impegno>:
--    <quando avvisare>`: stabile fra i tentativi, diversa se l'avviso viene
--    spostato. ⚠️ Con una chiave per tentativo il ritentativo dopo una
--    risposta persa sarebbe indistinguibile da un avviso nuovo — cioè il
--    doppione sarebbe garantito proprio dal meccanismo che doveva curarlo.
--
-- 🔴 C. CHI RICEVE DEDUPLICA, IN MODO DUREVOLE. Il database può sapere di
--    aver ACCODATO; non può sapere se sia ARRIVATA. L'unico posto da cui si
--    vede la differenza è la funzione online, e per ricordarsene fra una
--    chiamata e l'altra le serve un posto dove scrivere: `consegne_telegram`.
--
-- ⚠️ E I TRE PEZZI SI COPRONO A VICENDA, che è il motivo per cui il risultato
--    non dipende da come è fatto pg_net. Se accodare fosse transazionale, A
--    basta da solo; se non lo fosse — richiesta partita e possesso annullato
--    da un errore — interviene C, perché la chiave è la stessa. *Non si
--    poggia su una proprietà di pg_net che da qui nessuno ha misurato.*
--
-- 🔴 E IL FALSO POSITIVO ERA PIÙ VICINO DI QUANTO SEMBRI: costruire l'esito
--    sul CODICE DI STATO non basterebbe. `notify-telegram-reservation`
--    risponde **200 con `{"skipped": true}`** quando non manda niente e
--    **200 con `{"ok": true}`** quando ha mandato davvero — lo stesso codice
--    per «mandato» e «non mandato». Il discriminante è il CORPO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. LE TRE GUARDIE — questa migrazione si rifiuta invece di indovinare
-- ---------------------------------------------------------------------

-- 🔴 UNA FUNZIONE SI RISCRIVE DAL CORPO VIVO, MAI DAL FILE CHE L'HA CREATA
--    (regola del 18/08/2026, nata da una perdita silenziosa: fra il file e
--    il database ci stanno tutte le migrazioni che l'hanno toccata).
-- ⚠️ Da dove questa migrazione è stata scritta il corpo vivo NON si poteva
--    leggere. Allora il controllo si rovescia: la migrazione **descrive il
--    corpo che si aspetta di sostituire** e si ferma se ne trova un altro.
do $guardia$
declare
  v_corpo text;
begin
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'send_due_task_reminders'
     and p.prokind = 'f';

  if v_corpo is null then
    raise exception 'GUARDIA: send_due_task_reminders non esiste in questo database.';
  end if;

  if position('oudjuqbqszisdtwzbxdo' in v_corpo) = 0 then
    raise exception 'GUARDIA: la funzione viva non contiene l''indirizzo scritto fisso che questa migrazione toglie. Qualcuno l''ha già cambiata: leggi il corpo vivo (npm run funzione:viva) e riscrivi questa migrazione da quello, invece di sovrascrivere un lavoro che non hai visto.';
  end if;

  if position('reminder_sent_at = now()' in v_corpo) = 0 then
    raise exception 'GUARDIA: la funzione viva non scrive più reminder_sent_at nel modo che questa migrazione si aspetta. Leggi il corpo vivo prima di applicare.';
  end if;

  if position('invii_promemoria' in v_corpo) > 0 then
    raise exception 'GUARDIA: la funzione viva conosce già il registro degli invii — questa migrazione è già stata applicata, o superata da un''altra.';
  end if;
end $guardia$;

-- 🔴 SI PUÒ LEGGERE COM'È FINITA UNA RICHIESTA? Tutta la correzione poggia
--    su `net._http_response`, che è di pg_net e non nostra. Un esito
--    illeggibile letto come «riuscito» sarebbe il difetto di oggi con un
--    altro nome. Si guarda PRIMA, e si rifiuta.
do $guardia$
declare
  v_mancanti text[];
begin
  select coalesce(array_agg(c), '{}'::text[]) into v_mancanti
    from unnest(array['id', 'status_code', 'content', 'error_msg', 'created']) c
   where not exists (
     select 1 from information_schema.columns k
      where k.table_schema = 'net'
        and k.table_name = '_http_response'
        and k.column_name = c);

  if array_length(v_mancanti, 1) > 0 then
    raise exception 'GUARDIA: in net._http_response mancano le colonne %. Senza quelle non si può sapere com''è finita una richiesta, e un esito che non si può leggere non si può dichiarare.',
      array_to_string(v_mancanti, ', ');
  end if;
end $guardia$;

-- 🔴 E QUESTO DATABASE SA QUAL È IL PROPRIO INDIRIZZO? Da qui in avanti i
--    promemoria chiamano SOLO la funzione online del proprio progetto.
-- ⚠️ IL RIPIEGO ERA IL DIFETTO: `coalesce(vault, indirizzo-di-produzione)`
--    fa chiamare **il gestionale vero** a chi non si è configurato. È un
--    guardiano che fallisce APERTO.
do $guardia$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'url_funzioni') then
    raise exception 'GUARDIA: nel Vault di questo database manca il segreto «url_funzioni», e senza quello i promemoria non saprebbero a quale progetto appartengono. Impostalo (è l''indirizzo delle funzioni online di QUESTO progetto, quello che finisce con /functions/v1) e riapplica. Nessun valore va copiato da un altro progetto.';
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 1. L'indirizzo delle funzioni online di QUESTO database, in un posto solo
-- ---------------------------------------------------------------------
create or replace function url_delle_funzioni()
returns text
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_url text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'url_funzioni';
  v_url := nullif(btrim(coalesce(v_url, '')), '');
  if v_url is null then
    raise exception 'Nel Vault di questo database manca «url_funzioni»: non so a quale progetto appartengo, e non tiro a indovinare.';
  end if;
  -- La barra finale si toglie qui una volta sola: chi compone l'indirizzo
  -- aggiunge sempre «/nome-funzione», e due barre di fila danno un 404 che
  -- somiglia a una funzione non installata.
  return rtrim(v_url, '/');
end
$funzione$;

comment on function url_delle_funzioni() is
  'L''indirizzo delle funzioni online di QUESTO progetto, dal Vault. Nessun ripiego: un segreto che manca è un rifiuto, perché il ripiego sarebbe l''indirizzo della produzione.';

revoke all on function url_delle_funzioni() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. LA CHIAVE DI UNA CONSEGNA — la stessa, da tutte e due le parti
-- ---------------------------------------------------------------------
-- 🔴 UNA SOLA DEFINIZIONE, E VIVE QUI. La compone il database e la ricompone
--    la funzione online (`consegna.ts`) per controllarla: se le due
--    divergessero, il riconoscimento non avverrebbe mai e ogni ritentativo
--    manderebbe un secondo Telegram — in silenzio. La prova pura del modulo
--    e la verifica qui sotto congelano la stessa forma.
-- ⚠️ DUE INGREDIENTI E NON UNO: l'impegno **e** il momento dell'avviso. Con
--    il solo impegno, spostando l'avviso a un altro giorno il secondo avviso
--    — legittimo e diverso — verrebbe scambiato per un doppione e non
--    partirebbe mai.
create or replace function chiave_di_consegna(p_task_id uuid, p_quando timestamptz)
returns text
language sql
immutable
set search_path = public
as $funzione$
  -- ⚠️ L'istante si scrive SEMPRE in UTC con la Z: due scritture diverse
  --    dello stesso momento darebbero due chiavi, cioè due Telegram.
  select case
           when p_task_id is null or p_quando is null then null
           else 'promemoria:' || p_task_id::text || ':' ||
                to_char(p_quando at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         end;
$funzione$;

comment on function chiave_di_consegna(uuid, timestamptz) is
  'La chiave di una consegna di promemoria: stabile fra i tentativi, diversa se l''avviso viene spostato. È ciò che permette a chi riceve di riconoscere una richiesta già servita invece di mandare un secondo Telegram.';

revoke all on function chiave_di_consegna(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Il registro degli invii: è qui che un esito diventa leggibile
-- ---------------------------------------------------------------------
create table if not exists invii_promemoria (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  chiave       text not null,
  richiesta_id bigint,
  tentativo    integer not null,
  chiesto_il   timestamptz not null default now(),
  esito        text not null default 'in_volo'
               constraint invii_promemoria_esito_check
               check (esito in ('in_volo', 'riuscito', 'fallito', 'senza_risposta', 'esito_ignoto')),
  codice       integer,
  motivo       text,
  deciso_il    timestamptz
);

comment on table invii_promemoria is
  'Un tentativo di mandare un promemoria su Telegram, e com''è finito. Esiste perché fino al 17/09/2026 «inviato» voleva dire soltanto «accodato»: nessuna riga diceva se l''avviso fosse arrivato.';
comment on column invii_promemoria.chiave is
  'La chiave della CONSEGNA, uguale per tutti i tentativi dello stesso avviso: è ciò che permette a chi riceve di non mandarlo due volte.';
comment on column invii_promemoria.richiesta_id is
  'Il numero che pg_net restituisce accodando la richiesta. Prima veniva buttato via, ed è il motivo per cui l''esito non si poteva più ritrovare.';
comment on column invii_promemoria.esito is
  'in_volo = accodato, non si sa ancora · riuscito = è arrivato · fallito = non è arrivato, e il perché è in motivo · senza_risposta = nessuna risposta è tornata, si riprova con la stessa chiave · esito_ignoto = non si saprà mai, e non si riprova più.';
comment on column invii_promemoria.motivo is
  'Perché non è arrivato, in italiano. È la parte che si legge quando qualcosa non torna.';
comment on constraint invii_promemoria_esito_check on invii_promemoria is
  'Un invio può essere solo in volo, riuscito, fallito, senza risposta o di esito ignoto: «probabilmente arrivato» non è un esito.';

-- 🔴 IL POSSESSO, E NON PER GENTILEZZA. La riga «in volo» si scrive PRIMA di
--    accodare, e questo indice fa sì che due giri sovrapposti non possano
--    scriverla tutti e due: il secondo non scrive, quindi non accoda.
--    L'invariante sta nell'indice — non in un controllo dentro la funzione,
--    che è precisamente ciò che il Contratto vieta.
-- ⚠️ SULLA CHIAVE E NON SULL'IMPEGNO: se l'avviso viene spostato, la
--    consegna è un'altra e non dev'essere bloccata da una vecchia rimasta
--    in volo.
create unique index if not exists invii_promemoria_una_in_volo
  on invii_promemoria (chiave) where esito = 'in_volo';

create index if not exists invii_promemoria_per_chiave on invii_promemoria (chiave);
create index if not exists invii_promemoria_per_task on invii_promemoria (task_id);

alter table invii_promemoria enable row level security;
drop policy if exists invii_promemoria_titolare on invii_promemoria;
create policy invii_promemoria_titolare on invii_promemoria
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 4. LA MEMORIA DI CHI RICEVE — la deduplicazione durevole
-- ---------------------------------------------------------------------
-- 🔴 PERCHÉ NON PUÒ STARE DALLA PARTE DI CHI MANDA. Il database sa di aver
--    accodato una richiesta; **non sa se sia arrivata**. Fra le due cose ci
--    sta esattamente il caso che produce il doppione. L'unico posto da cui
--    si vede la differenza è chi riceve — e per ricordarsene fra una
--    chiamata e l'altra gli serve un posto dove scrivere, che è questo.
create table if not exists consegne_telegram (
  chiave       text primary key,
  stato        text not null default 'presa'
               constraint consegne_telegram_stato_check check (stato in ('presa', 'consegnata')),
  presa_il     timestamptz not null default now(),
  consegnata_il timestamptz
);

comment on table consegne_telegram is
  'Che cosa è già stato consegnato su Telegram, per chiave. La scrive la funzione online prima di mandare: è ciò che impedisce che un secondo arrivo della stessa richiesta produca un secondo messaggio.';
comment on column consegne_telegram.stato is
  'presa = qualcuno sta mandando, o ha smesso senza dirlo · consegnata = Telegram ha accettato il messaggio.';
comment on constraint consegne_telegram_stato_check on consegne_telegram is
  'Una consegna è presa o consegnata: non esiste un terzo stato, e «forse» non è uno stato.';

alter table consegne_telegram enable row level security;
drop policy if exists consegne_telegram_titolare on consegne_telegram;
create policy consegne_telegram_titolare on consegne_telegram
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ QUANTO SI ASPETTA PRIMA DI DIRE «NON LO SAPRÒ MAI». Cinque minuti: è il
--    passo del giro che manda, quindi una presa più vecchia di così non
--    appartiene a un giro ancora in corso.
create or replace function consegna_presa_scaduta() returns interval
language sql immutable set search_path = public
as $funzione$ select interval '5 minutes' $funzione$;

-- 🔴 PRENDERE IN CARICO È UNA SCRITTURA, ED È ATOMICA. `on conflict do
--    nothing` sulla chiave primaria: o la riga la scrive questa chiamata — e
--    allora tocca a lei mandare — oppure c'era già, e allora no. Due arrivi
--    insieme non possono ottenere «manda» tutti e due.
create or replace function prendi_consegna(p_chiave text)
returns text
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_mio   boolean := false;
  v_stato text;
  v_presa timestamptz;
begin
  if nullif(btrim(coalesce(p_chiave, '')), '') is null then
    raise exception 'Una consegna senza chiave non si può riconoscere: non la prendo in carico.';
  end if;

  insert into consegne_telegram (chiave) values (p_chiave)
  on conflict (chiave) do nothing;
  get diagnostics v_mio = row_count;

  if v_mio then
    return 'manda';
  end if;

  select stato, presa_il into v_stato, v_presa
    from consegne_telegram where chiave = p_chiave;

  if v_stato = 'consegnata' then
    return 'gia_consegnata';
  end if;
  if v_presa > now() - consegna_presa_scaduta() then
    return 'in_corso';
  end if;
  -- 🔴 PRESA E MAI CONFERMATA, E VECCHIA. Può essere arrivata o no, e non
  --    c'è modo di saperlo. Da qui non si torna a «manda»: un duplicato è
  --    silenzioso e indistinguibile da un avviso vero, un avviso mancante
  --    resta scritto e fa scattare un allarme.
  return 'ignota';
end
$funzione$;

create or replace function conferma_consegna(p_chiave text)
returns void
language sql
security definer
set search_path = public
as $funzione$
  update consegne_telegram
     set stato = 'consegnata', consegnata_il = now()
   where chiave = p_chiave and stato <> 'consegnata';
$funzione$;

-- ⚠️ SI RILASCIA SOLO QUANDO È CERTO CHE TELEGRAM NON ABBIA RICEVUTO, cioè
--    quando ha risposto di no. Se la chiamata si è interrotta a metà l'esito
--    è ignoto, e rilasciare lì vorrebbe dire rimettere in gioco una consegna
--    che forse è già arrivata — cioè costruire il doppione a mano.
create or replace function rilascia_consegna(p_chiave text)
returns void
language sql
security definer
set search_path = public
as $funzione$
  delete from consegne_telegram where chiave = p_chiave and stato = 'presa';
$funzione$;

comment on function prendi_consegna(text) is
  'Prende in carico una consegna, atomicamente. Risponde «manda» una volta sola per chiave; poi «gia_consegnata», «in_corso» o «ignota». La chiama la funzione online, non una schermata.';
comment on function conferma_consegna(text) is
  'Telegram ha accettato il messaggio: da qui in poi la stessa chiave non manda più niente.';
comment on function rilascia_consegna(text) is
  'Telegram ha RIFIUTATO: la chiave torna libera e il prossimo tentativo manderà. Mai chiamata quando l''esito è ignoto.';

revoke all on function prendi_consegna(text) from public, anon, authenticated;
revoke all on function conferma_consegna(text) from public, anon, authenticated;
revoke all on function rilascia_consegna(text) from public, anon, authenticated;
revoke all on function consegna_presa_scaduta() from public, anon, authenticated;
grant execute on function prendi_consegna(text) to service_role;
grant execute on function conferma_consegna(text) to service_role;
grant execute on function rilascia_consegna(text) to service_role;

-- ---------------------------------------------------------------------
-- 5. LA DECISIONE, SEPARATA DALL'INVIO
-- ---------------------------------------------------------------------
-- 🔴 STA IN UNA FUNZIONE SUA perché è l'unico modo di PROVARLA. Dentro il
--    giro che manda, l'unica maniera di metterla alla prova sarebbe far
--    partire richieste vere — cioè far suonare il telefono di Alessio per
--    collaudare un guardiano.
--
-- ⚠️ E IL DISCRIMINANTE È IL CORPO, NON IL CODICE DI STATO: la funzione
--    online risponde 200 sia con `{"ok":true}` (mandato) sia con
--    `{"skipped":true}` (non mandato). Guardare lo stato direbbe «arrivato»
--    in tutt'e due i casi.
--
-- 🔴 E UN CORPO CHE NON SI RIESCE A LEGGERE NON È UN SUCCESSO: *«non vuol
--    dire che è vuota, vuol dire che non lo so»*, e qui «non lo so» deve
--    comportarsi come «non è arrivato».
create or replace function esito_di_un_invio(p_stato integer, p_corpo text, p_errore text)
returns table (esito text, motivo text)
language plpgsql
immutable
set search_path = public
as $funzione$
declare
  v_corpo    jsonb;
  v_estratto text := left(coalesce(nullif(btrim(coalesce(p_corpo, '')), ''), '(nessuna risposta)'), 300);
begin
  begin
    v_corpo := nullif(btrim(coalesce(p_corpo, '')), '')::jsonb;
  exception when others then
    v_corpo := null;
  end;

  -- 🔴 «NON LO SAPRÒ MAI» È UN ESITO A SÉ, e viene prima di tutto: chi
  --    riceve lo dichiara quando ha preso in carico la consegna e non l'ha
  --    mai confermata. Da lì non si riprova, o si rischia il doppione.
  if coalesce(v_corpo->>'esito', '') = 'ignoto' then
    return query select 'esito_ignoto',
      ('Chi riceve aveva già preso in carico questo avviso e non ha mai confermato: non si può sapere se sia arrivato, e riprovare rischierebbe di mandarlo due volte. ' || v_estratto)::text;
    return;
  end if;

  -- Un altro giro la sta mandando adesso: non è un guasto, si riguarda dopo.
  if coalesce(v_corpo->>'esito', '') = 'in_corso' then
    return query select 'in_volo', null::text;
    return;
  end if;

  if nullif(btrim(coalesce(p_errore, '')), '') is not null then
    return query select 'fallito',
      ('La richiesta non è arrivata alla funzione online: ' || p_errore)::text;
    return;
  end if;

  if p_stato is null then
    return query select 'senza_risposta',
      'Nessuna risposta: non si può dire se l''avviso sia arrivato, quindi si dichiara non arrivato.'::text;
    return;
  end if;

  -- ⚠️ `gia_consegnato` è un SUCCESSO, ed è la chiave di volta del
  --    ritentativo: vuol dire «l'avevo già mandato io». Senza questo ramo,
  --    un avviso davvero arrivato resterebbe per sempre «non arrivato».
  if p_stato between 200 and 299 and coalesce((v_corpo->>'ok')::boolean, false) then
    return query select 'riuscito', null::text;
    return;
  end if;

  if p_stato between 200 and 299 and coalesce(v_corpo->>'skipped', '') = 'true' then
    return query select 'fallito',
      'La funzione online ha risposto «va bene» ma NON ha mandato niente: non ha riconosciuto questo promemoria.'::text;
    return;
  end if;

  if p_stato between 200 and 299 then
    return query select 'fallito',
      ('La funzione online ha risposto ' || p_stato || ' senza dire di aver mandato: ' || v_estratto)::text;
    return;
  end if;

  return query select 'fallito',
    ('La funzione online ha risposto ' || p_stato || ': ' || v_estratto)::text;
end
$funzione$;

comment on function esito_di_un_invio(integer, text, text) is
  'Questa risposta che cosa dice dell''avviso? Decide e basta: non manda niente e non scrive niente, così si può provare su risposte inventate senza far partire un Telegram. Il discriminante è il corpo, non il codice di stato.';

revoke all on function esito_di_un_invio(integer, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Il giro che manda — prende il possesso, POI accoda
-- ---------------------------------------------------------------------
create or replace function send_due_task_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  r        record;
  v_firma  text;
  v_anon   text;
  v_base   text;
  v_req    bigint;
  v_tent   integer;
  v_chiave text;
  v_riga   uuid;
  v_fermi  integer;
begin
  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  -- Se non si può notificare, NON si marca niente come inviato — altrimenti
  -- sparirebbe senza essere mai arrivato. E non si segna il giro come
  -- riuscito: questo è un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Promemoria Telegram saltati: parola d''ordine o chiave assenti dal Vault.';
    perform segnala_allarme(
      'notifiche_senza_chiavi',
      'I promemoria non partono: manca la parola d''ordine nel Vault del database.'
    );
    return;
  end if;

  -- 🔴 L'INDIRIZZO È QUELLO DI QUESTO DATABASE, e se manca ci si ferma qui.
  v_base := url_delle_funzioni();

  for r in
    select t.*, chiave_di_consegna(t.id, t.remind_at) as chiave_consegna
      from tasks t
     where t.remind_at is not null
       and t.remind_at <= now()
       and t.reminder_sent_at is null
       and t.status <> 'completato'
       -- Uno alla volta per consegna: finché una richiesta è in volo non se
       -- ne accoda un'altra per lo stesso avviso.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, t.remind_at) and i.esito = 'in_volo')
       -- 🔴 DA «NON LO SAPRÒ MAI» NON SI RIPROVA. Riprovare potrebbe mandare
       --    un secondo Telegram, e questo giro non lo fa mai. La riga resta
       --    con reminder_sent_at vuoto, visibile e allarmata.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, t.remind_at) and i.esito = 'esito_ignoto')
       -- ⚠️ UN TETTO AI TENTATIVI, ed è la lezione del 12/08: un lavoro che
       --    ritenta all'infinito chiede all'infinito. Il conto è PER
       --    CONSEGNA, non per impegno: un avviso spostato riparte da capo,
       --    ed è giusto — è un'altra consegna.
       and (select count(*) from invii_promemoria i
             where i.chiave = chiave_di_consegna(t.id, t.remind_at)) < 3
  loop
    -- ⚠️ OGNI AVVISO IN UN BLOCCO SUO: senza, un solo inciampo — una corsa
    --    persa sull'indice, un errore di rete — annullerebbe il giro INTERO
    --    e con esso gli avvisi già presi in carico.
    begin
      v_chiave := r.chiave_consegna;
      if v_chiave is null then
        continue;
      end if;

      select coalesce(max(i.tentativo), 0) + 1 into v_tent
        from invii_promemoria i where i.chiave = v_chiave;

      -- 🔴 IL POSSESSO PRIMA DELLA RICHIESTA, ED È UNA SCRITTURA. Se un
      --    altro giro ha già preso questo avviso, qui non si scrive niente
      --    e `v_riga` resta vuota: **non si accoda**. Prima la richiesta
      --    partiva e la riga si scriveva dopo, quindi due giri sovrapposti
      --    potevano accodarne due.
      insert into invii_promemoria (task_id, chiave, tentativo)
      values (r.id, v_chiave, v_tent)
      on conflict (chiave) where esito = 'in_volo' do nothing
      returning id into v_riga;

      if v_riga is null then
        continue;
      end if;

      -- 🔴 LA CHIAVE VIAGGIA CON LA RICHIESTA: è ciò che permette a chi
      --    riceve di riconoscere un ritentativo invece di mandare un
      --    secondo Telegram.
      select net.http_post(
        url := v_base || '/notify-telegram-reservation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon,
          'x-borgo58-firma', v_firma
        ),
        body := jsonb_build_object(
          'type', 'task_reminder',
          'chiave_consegna', v_chiave,
          'task', to_jsonb(r) - 'chiave_consegna')
      ) into v_req;

      update invii_promemoria set richiesta_id = v_req where id = v_riga;

      -- 🔴 QUI NON SI SCRIVE `reminder_sent_at`, ED È METÀ DELLA CORREZIONE.
      --    La richiesta è soltanto ACCODATA. Lo scrive
      --    `raccogli_esiti_promemoria`, e solo davanti a una risposta.
    exception when others then
      raise warning 'Promemoria %: % ', r.id, sqlerrm;
    end;
  end loop;

  -- ⚠️ CHI NON PUÒ PIÙ PARTIRE NON SPARISCE E NON TACE: né chi ha esaurito
  --    i tentativi, né chi è finito in «non lo saprò mai».
  select count(*) into v_fermi
    from tasks t
   where t.remind_at is not null
     and t.remind_at <= now()
     and t.reminder_sent_at is null
     and t.status <> 'completato'
     and (
       exists (select 1 from invii_promemoria i
                where i.chiave = chiave_di_consegna(t.id, t.remind_at)
                  and i.esito = 'esito_ignoto')
       or (select count(*) from invii_promemoria i
            where i.chiave = chiave_di_consegna(t.id, t.remind_at)) >= 3
     );

  if v_fermi > 0 then
    perform segnala_allarme(
      'promemoria_senza_recapito',
      'Ci sono ' || v_fermi || ' avvisi dell''Agenda che non riescono a partire. Non sono stati persi: restano scritti, e il perché è nel registro degli invii. Alcuni potrebbero essere arrivati senza che si sia potuto confermarlo — in quel caso non vengono rimandati, per non mandarli due volte.',
      jsonb_build_object('quanti', v_fermi));
  end if;

  -- Il giro è arrivato in fondo: è questa riga che permette di accorgersi,
  -- fra mezz'ora, che il giro NON è più arrivato in fondo.
  insert into stato_lavori (nome, ultimo_successo) values ('promemoria_agenda', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$funzione$;

comment on function send_due_task_reminders is
  'Chiamata da pg_cron ogni 5 minuti. PRENDE IL POSSESSO di ogni avviso scrivendo la riga «in volo», poi accoda la richiesta portandosi dietro la chiave di consegna. Non dichiara più che un avviso sia stato inviato: quello lo fa raccogli_esiti_promemoria, e solo davanti a una risposta.';

-- ---------------------------------------------------------------------
-- 7. Il giro che guarda com'è finita
-- ---------------------------------------------------------------------
create or replace function raccogli_esiti_promemoria()
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  i           record;
  v_stato     integer;
  v_contenuto text;
  v_errore    text;
  v_esito     record;
  v_falliti   integer := 0;
  v_ignoti    integer := 0;
begin
  for i in select * from invii_promemoria where esito = 'in_volo' order by chiesto_il loop
    select r.status_code, r.content, r.error_msg
      into v_stato, v_contenuto, v_errore
      from net._http_response r
     where r.id = i.richiesta_id;

    if not found then
      -- 🔴 «SPARITA» NON È «RIUSCITA». pg_net conserva le risposte per poche
      --    ore e poi le toglie: passato quel termine la riga non c'è più.
      -- ⚠️ E ADESSO RIPROVARE È SICURO, che prima non lo era: il tentativo
      --    successivo porta LA STESSA CHIAVE, quindi se l'avviso era già
      --    arrivato chi riceve lo riconosce e risponde «già consegnato»
      --    invece di mandarne un secondo. È questo che trasforma un'incognita
      --    in una risposta.
      if i.chiesto_il < now() - interval '2 hours' then
        update invii_promemoria
           set esito = 'senza_risposta',
               deciso_il = now(),
               motivo = 'La richiesta è stata accodata e nessuna risposta è mai tornata. Si riprova con la stessa chiave: se era arrivata, chi riceve lo dirà invece di mandarla di nuovo.'
         where id = i.id;
        v_falliti := v_falliti + 1;
      end if;
      continue;
    end if;

    select * into v_esito from esito_di_un_invio(v_stato, v_contenuto, v_errore);

    if v_esito.esito = 'in_volo' then
      -- 🔴 UN'ATTESA SENZA TETTO SI IMPIANTA PER SEMPRE, ed è un difetto che
      --    questa correzione si era messa in casa da sola. La risposta «in
      --    corso» resta scritta in `net._http_response`: riletta a ogni giro
      --    darebbe sempre lo stesso verdetto, l'invio resterebbe «in volo»
      --    per sempre, e l'indice unico impedirebbe qualunque ritentativo —
      --    quindi quell'avviso sarebbe bloccato **senza nessun allarme**.
      --    È la famiglia del guardiano che aspetta una parola che non
      --    arriverà (27/08), spostata dal tempo di un comando a quello di un
      --    invio.
      -- ⚠️ Mezz'ora: sei giri. Passata quella, si dichiara «senza risposta» e
      --    si riprova CON LA STESSA CHIAVE — che è sicuro, perché chi riceve
      --    la riconosce e non manda un secondo Telegram.
      if i.chiesto_il < now() - interval '30 minutes' then
        update invii_promemoria
           set esito = 'senza_risposta',
               codice = v_stato,
               deciso_il = now(),
               motivo = 'Chi riceve ha risposto che la stessa consegna era già in corso, e da mezz''ora non è cambiato niente. Si riprova con la stessa chiave: se era arrivata, lo dirà invece di mandarla di nuovo.'
         where id = i.id;
        v_falliti := v_falliti + 1;
      end if;
      continue;
    end if;

    update invii_promemoria
       set esito = v_esito.esito, codice = v_stato, motivo = v_esito.motivo, deciso_il = now()
     where id = i.id;

    if v_esito.esito = 'riuscito' then
      -- 🔴 È L'UNICO POSTO IN TUTTO IL GESTIONALE CHE SCRIVE QUESTA COLONNA,
      --    ed è davanti a una risposta che dice «mandato» — compreso «l'avevo
      --    già mandato io», che è la stessa cosa vista dal ritentativo.
      update tasks
         set reminder_sent_at = now()
       where id = i.task_id and reminder_sent_at is null;
    elsif v_esito.esito = 'esito_ignoto' then
      v_ignoti := v_ignoti + 1;
    else
      v_falliti := v_falliti + 1;
    end if;
  end loop;

  if v_falliti > 0 then
    perform segnala_allarme(
      'promemoria_non_arrivati',
      'Alcuni avvisi dell''Agenda non sono arrivati su Telegram. Non sono stati persi: restano da mandare, e il perché è scritto nel registro degli invii.',
      jsonb_build_object('quanti', v_falliti));
  end if;

  -- 🔴 L'ESITO IGNOTO HA UN ALLARME SUO, ed è il compromesso dichiarato: da
  --    lì non si riprova, perché riprovare potrebbe mandare un secondo
  --    Telegram. Quell'avviso forse è arrivato e forse no, e l'unica cosa
  --    onesta è dirlo a chi può guardare.
  if v_ignoti > 0 then
    perform segnala_allarme(
      'promemoria_esito_ignoto',
      'Di ' || v_ignoti || ' avvisi dell''Agenda non si saprà mai se siano arrivati: chi li riceve li aveva presi in carico e non ha confermato. NON vengono rimandati, per non mandarli due volte — vanno guardati a mano nel registro degli invii.',
      jsonb_build_object('quanti', v_ignoti));
  end if;

  insert into stato_lavori (nome, ultimo_successo) values ('esiti_promemoria', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$funzione$;

comment on function raccogli_esiti_promemoria is
  'Chiamata da pg_cron ogni 5 minuti. Guarda com''è finita ogni richiesta accodata e SOLO allora scrive reminder_sent_at. Una risposta che non si riesce a leggere, o che non torna affatto, vale «non arrivato»; un esito dichiarato ignoto non si riprova più.';

revoke all on function raccogli_esiti_promemoria() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Il lavoro pianificato, e la sua iscrizione alla sentinella
-- ---------------------------------------------------------------------
-- 🔴 LE DUE COSE VANNO INSIEME, SEMPRE. La sentinella fa il censimento nei
--    due versi: un lavoro in `cron.job` che non è in `lavori_sorvegliati` è
--    un allarme, e uno iscritto che non è più pianificato è un altro
--    allarme. Aggiungere il lavoro e dimenticare la riga farebbe suonare il
--    telefono di Alessio ogni quarto d'ora.
select cron.schedule(
  'esiti-promemoria',
  '*/5 * * * *',
  $cron$select raccogli_esiti_promemoria();$cron$
);

insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette) values
  ('esiti_promemoria', 'esiti-promemoria', 30,
   'Nessuno guarda più se gli avvisi dell''Agenda siano arrivati davvero: resterebbero tutti in volo, e nessun promemoria verrebbe mai dichiarato mandato.')
on conflict (nome_lavoro) do update
  set nome_cron         = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette       = excluded.cosa_smette;

-- ⚠️ Il battito di partenza, con la stessa scelta del 12/08: senza, la
--    sentinella griderebbe per un guasto inventato da questa migrazione.
insert into stato_lavori (nome, ultimo_successo) values ('esiti_promemoria', now())
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 9. Verifica
-- ---------------------------------------------------------------------
-- ⚠️ NON PARTE NESSUNA RICHIESTA E NON SI TOCCA NESSUN IMPEGNO VERO: si
--    provano la DECISIONE su risposte inventate e la PRESA IN CARICO su
--    chiavi inventate. È per questo che tutt'e due vivono in funzioni loro.
do $verifica$
declare
  v        record;
  v_chiave text := 'promemoria:00000000-0000-0000-0000-0000000000ff:2026-09-20T15:00:00.000Z';
  v_altra  text;
  v_a      text;
  v_b      text;
begin
  -- ===================================================================
  -- A. LA CHIAVE DI CONSEGNA
  -- ===================================================================
  v_a := chiave_di_consegna('00000000-0000-0000-0000-0000000000ff'::uuid, '2026-09-20T15:00:00Z'::timestamptz);
  v_b := chiave_di_consegna('00000000-0000-0000-0000-0000000000ff'::uuid, '2026-09-20T17:00:00+02:00'::timestamptz);
  -- 🔴 LO STESSO ISTANTE SCRITTO IN DUE MODI DEVE DARE LA STESSA CHIAVE: due
  --    scritture diverse dello stesso momento darebbero due chiavi, cioè due
  --    Telegram.
  if v_a is distinct from v_b then
    raise exception 'VERIFICA: lo stesso istante scritto in due fusi dà due chiavi diverse (% / %).', v_a, v_b;
  end if;
  if v_a is distinct from v_chiave then
    raise exception 'VERIFICA: la chiave non ha la forma attesa. Trovata: %', v_a;
  end if;
  -- ⚠️ E SPOSTANDO L'AVVISO LA CHIAVE CAMBIA: altrimenti un secondo avviso,
  --    legittimo e diverso, verrebbe scambiato per un doppione e non
  --    partirebbe mai.
  v_altra := chiave_di_consegna('00000000-0000-0000-0000-0000000000ff'::uuid, '2026-09-21T15:00:00Z'::timestamptz);
  if v_altra = v_chiave then
    raise exception 'VERIFICA: spostando l''avviso la chiave non cambia.';
  end if;
  if chiave_di_consegna(null, '2026-09-20T15:00:00Z'::timestamptz) is not null
     or chiave_di_consegna('00000000-0000-0000-0000-0000000000ff'::uuid, null) is not null then
    raise exception 'VERIFICA: una chiave si compone anche senza i suoi due ingredienti.';
  end if;

  -- ===================================================================
  -- B. LA PRESA IN CARICO — la concorrenza, provata sul meccanismo
  -- ===================================================================
  delete from consegne_telegram where chiave like 'promemoria:00000000-%';

  -- 🔴 DUE ARRIVI INSIEME: il primo manda, il secondo NO. È la prova della
  --    concorrenza, e si fa sul meccanismo che la decide — la scrittura con
  --    chiave primaria — non su due processi, che in una verifica non si
  --    possono avere.
  if prendi_consegna(v_chiave) <> 'manda' then
    raise exception 'VERIFICA: la prima presa in carico non dice «manda».';
  end if;
  if prendi_consegna(v_chiave) = 'manda' then
    raise exception 'VERIFICA: due arrivi con la stessa chiave ottengono tutti e due «manda». È il doppione.';
  end if;

  -- Finché è recente, il secondo arrivo dice «in corso»: non manda e non
  -- dichiara niente.
  if prendi_consegna(v_chiave) <> 'in_corso' then
    raise exception 'VERIFICA: una presa recente non viene riconosciuta come in corso.';
  end if;

  -- 🔴 LA RIPETIZIONE DELLA STESSA CHIAVE DOPO LA CONFERMA: non manda, e lo
  --    dice. È il caso del ritentativo dopo una risposta persa, ed è quello
  --    che trasforma un'incognita in una risposta invece che in un doppione.
  perform conferma_consegna(v_chiave);
  if prendi_consegna(v_chiave) <> 'gia_consegnata' then
    raise exception 'VERIFICA: dopo la conferma, un secondo arrivo non viene riconosciuto.';
  end if;

  -- ⚠️ E IL RILASCIO RIMETTE IN GIOCO **SOLO** UNA PRESA NON CONFERMATA: su
  --    una consegnata non deve fare niente, o si riaprirebbe la porta al
  --    doppione proprio dove era stata chiusa.
  perform rilascia_consegna(v_chiave);
  if prendi_consegna(v_chiave) <> 'gia_consegnata' then
    raise exception 'VERIFICA: il rilascio ha rimesso in gioco una consegna già confermata.';
  end if;

  -- 🔴 «NON LO SAPRÒ MAI»: presa, mai confermata, e vecchia. Non si torna a
  --    «manda» — è il compromesso dichiarato.
  delete from consegne_telegram where chiave = v_chiave;
  insert into consegne_telegram (chiave, stato, presa_il)
  values (v_chiave, 'presa', now() - interval '1 hour');
  if prendi_consegna(v_chiave) <> 'ignota' then
    raise exception 'VERIFICA: una presa vecchia e mai confermata torna a «manda». È il caso in cui si manderebbe un secondo Telegram.';
  end if;

  -- E il rilascio su una presa non confermata la rimette in gioco: è il caso
  -- in cui Telegram ha risposto di NO, e allora è certo che non abbia
  -- ricevuto niente.
  delete from consegne_telegram where chiave = v_chiave;
  if prendi_consegna(v_chiave) <> 'manda' then
    raise exception 'VERIFICA: dopo il rilascio la stessa chiave non riparte.';
  end if;
  perform rilascia_consegna(v_chiave);
  if prendi_consegna(v_chiave) <> 'manda' then
    raise exception 'VERIFICA: il rilascio di una presa non confermata non rimette in gioco la chiave.';
  end if;
  delete from consegne_telegram where chiave like 'promemoria:00000000-%';

  -- ===================================================================
  -- C. LA LETTURA DELLA RISPOSTA
  -- ===================================================================
  select * into v from esito_di_un_invio(200, '{"ok":true}', null);
  if v.esito <> 'riuscito' then
    raise exception 'VERIFICA: una risposta «ok» non viene riconosciuta come arrivata.';
  end if;

  -- ⚠️ IL RITENTATIVO RICONOSCIUTO È UN SUCCESSO: senza questo ramo un
  --    avviso davvero arrivato resterebbe per sempre «non arrivato», e si
  --    continuerebbe a riprovare.
  select * into v from esito_di_un_invio(200, '{"ok":true,"gia_consegnato":true}', null);
  if v.esito <> 'riuscito' then
    raise exception 'VERIFICA: «già consegnato» non viene contato come arrivato.';
  end if;

  -- 🔴 IL FALSO POSITIVO: stesso codice 200, ma non è stato mandato niente.
  select * into v from esito_di_un_invio(200, '{"skipped":true}', null);
  if v.esito = 'riuscito' then
    raise exception 'VERIFICA: una risposta 200 «skipped» viene contata come inviata. È il falso positivo che questa migrazione esiste per chiudere.';
  end if;
  if v.motivo not like '%NON ha mandato%' then
    raise exception 'VERIFICA: il motivo di uno «skipped» non dice che non è stato mandato niente. Trovato: %', v.motivo;
  end if;

  -- 🔴 L'ESITO IGNOTO NON È NÉ RIUSCITO NÉ RITENTABILE.
  select * into v from esito_di_un_invio(409, '{"ok":false,"esito":"ignoto"}', null);
  if v.esito <> 'esito_ignoto' then
    raise exception 'VERIFICA: un esito dichiarato ignoto non viene riconosciuto. Trovato: %', v.esito;
  end if;
  select * into v from esito_di_un_invio(502, '{"ok":false,"esito":"ignoto","error":"Invio interrotto a metà"}', null);
  if v.esito <> 'esito_ignoto' then
    raise exception 'VERIFICA: un invio interrotto a metà non viene riconosciuto come ignoto.';
  end if;

  select * into v from esito_di_un_invio(409, '{"ok":false,"esito":"in_corso"}', null);
  if v.esito <> 'in_volo' then
    raise exception 'VERIFICA: «in corso» non lascia l''invio in volo.';
  end if;

  select * into v from esito_di_un_invio(502, '{"error":"Invio Telegram fallito"}', null);
  if v.esito = 'riuscito' then raise exception 'VERIFICA: un 502 viene contato come inviato.'; end if;
  select * into v from esito_di_un_invio(401, '{"error":"Chiamante non riconosciuto"}', null);
  if v.esito = 'riuscito' then raise exception 'VERIFICA: un 401 viene contato come inviato.'; end if;
  select * into v from esito_di_un_invio(null, null, 'connection refused');
  if v.esito = 'riuscito' then raise exception 'VERIFICA: una richiesta mai arrivata viene contata come inviata.'; end if;

  -- 🔴 UN CORPO CHE NON SI RIESCE A LEGGERE NON È UN SUCCESSO: se lo fosse,
  --    basterebbe una risposta storta per far sparire un avviso.
  select * into v from esito_di_un_invio(200, 'questa non è una risposta leggibile', null);
  if v.esito = 'riuscito' then raise exception 'VERIFICA: una risposta illeggibile viene contata come inviata.'; end if;
  select * into v from esito_di_un_invio(200, null, null);
  if v.esito = 'riuscito' then raise exception 'VERIFICA: una risposta vuota viene contata come inviata.'; end if;

  -- ===================================================================
  -- D. IL GIRO CHE MANDA: la forma, letta dal corpo vivo
  -- ===================================================================
  if position('oudjuqbqszisdtwzbxdo' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) > 0 then
    raise exception 'VERIFICA: send_due_task_reminders contiene ancora un indirizzo scritto fisso.';
  end if;
  if position('url_delle_funzioni' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) = 0 then
    raise exception 'VERIFICA: send_due_task_reminders non legge l''indirizzo di questo database.';
  end if;
  -- 🔴 E NON DICHIARA PIÙ NIENTE: la colonna che significa «mandato» non si
  --    scrive più nel giro che accoda.
  if position('reminder_sent_at = now()' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) > 0 then
    raise exception 'VERIFICA: il giro che accoda scrive ancora reminder_sent_at. È esattamente il difetto che si stava chiudendo.';
  end if;
  if position('reminder_sent_at = now()' in pg_get_functiondef('raccogli_esiti_promemoria()'::regprocedure)) = 0 then
    raise exception 'VERIFICA: nessuno scrive reminder_sent_at dopo aver guardato la risposta.';
  end if;
  -- 🔴 L'ORDINE: il possesso si scrive PRIMA di accodare. È il difetto
  --    rilevato dalla revisione, e questa riga è l'unica cosa che se ne
  --    accorgerebbe se qualcuno rimettesse le due istruzioni al contrario.
  if position('insert into invii_promemoria' in pg_get_functiondef('send_due_task_reminders()'::regprocedure))
     > position('net.http_post' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) then
    raise exception 'VERIFICA: la richiesta viene accodata PRIMA che si scriva il possesso. Due giri sovrapposti potrebbero accodarne due.';
  end if;
  -- E la chiave viaggia con la richiesta, o chi riceve non può riconoscerla.
  if position('chiave_consegna' in pg_get_functiondef('send_due_task_reminders()'::regprocedure)) = 0 then
    raise exception 'VERIFICA: la richiesta non porta con sé la chiave di consegna.';
  end if;

  -- ===================================================================
  -- E. I PERMESSI
  -- ===================================================================
  -- 🔴 In questo progetto una funzione nasce eseguibile da chiunque abbia la
  --    chiave pubblica — che è PUBBLICA, sta nel pacchetto del sito.
  if has_function_privilege('authenticated', 'url_delle_funzioni()', 'execute') then
    raise exception 'VERIFICA: url_delle_funzioni è eseguibile da chi ha fatto il login.';
  end if;
  if has_function_privilege('authenticated', 'raccogli_esiti_promemoria()', 'execute') then
    raise exception 'VERIFICA: raccogli_esiti_promemoria è eseguibile da chi ha fatto il login.';
  end if;
  if has_function_privilege('anon', 'prendi_consegna(text)', 'execute')
     or has_function_privilege('authenticated', 'prendi_consegna(text)', 'execute') then
    raise exception 'VERIFICA: prendi_consegna è raggiungibile da fuori. Chi la raggiunge può far risultare consegnato un avviso mai mandato.';
  end if;
  if not has_function_privilege('service_role', 'prendi_consegna(text)', 'execute') then
    raise exception 'VERIFICA: la funzione online non può prendere in carico una consegna.';
  end if;

  -- ===================================================================
  -- F. Il lavoro nuovo è pianificato E iscritto alla sentinella
  -- ===================================================================
  if not exists (select 1 from cron.job where jobname = 'esiti-promemoria') then
    raise exception 'VERIFICA: il lavoro «esiti-promemoria» non è pianificato.';
  end if;
  if not exists (select 1 from lavori_sorvegliati where nome_cron = 'esiti-promemoria') then
    raise exception 'VERIFICA: il lavoro «esiti-promemoria» non è iscritto alla sentinella.';
  end if;

  -- G. Nessun residuo: la verifica ha cancellato le proprie chiavi inventate.
  if exists (select 1 from consegne_telegram where chiave like 'promemoria:00000000-%') then
    raise exception 'VERIFICA: sono rimaste delle chiavi di prova.';
  end if;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260917000001', 'un_promemoria_e_inviato_solo_se_arriva') on conflict (version) do nothing;
