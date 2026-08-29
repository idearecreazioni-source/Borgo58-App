-- =====================================================================
-- UN TETTO SOLO, E COPRE TUTTO CIO' CHE CHIAMA L'ASSISTENTE
-- 29/08/2026 — Blocco 4 del mandato del 29/08
-- =====================================================================
-- Decisione di Alessio, esplicita: **un tetto solo da dieci euro al mese**
-- che copre MEMO foto, MEMO voce, la lettura della posta e qualunque cosa
-- venga dopo. Non un secondo tetto per la posta. La sua ragione: *con due
-- tetti non sai quanto stai spendendo in tutto, e ognuno puo' finire mentre
-- l'altro e' pieno.*
--
-- ---------------------------------------------------------------------
-- LA MISURA, prima di scrivere
-- ---------------------------------------------------------------------
-- Le chiamate al modello si registrano in **quattro posti, con tre forme
-- diverse**, e il tetto ne vedeva **due**:
--
--   · `letture_foto`   → modello, token in, token out, costo    ✅ contata
--   · `dettature`      → modello, token in, token out, costo    ✅ contata
--   · `domande_archivio` → modello, token in, token out, MA NESSUN COSTO  ❌
--   · `posta_ricevuta` → modello e UN SOLO numero di token       ❌
--
-- 🔴 Quindi non era scoperta solo la posta — che e' quello che il mandato
-- nominava — ma **anche l'archivio**. Due fonti su quattro spendevano senza
-- che nessuno le contasse, e senza che niente le fermasse.
--
-- ---------------------------------------------------------------------
-- «SENZA CHE QUALCUNO DEBBA RICORDARSENE»
-- ---------------------------------------------------------------------
-- E' la parte che Alessio ha chiesto per nome, e non si ottiene sommando
-- una quarta riga: *la lettura della posta e' nata scoperta proprio cosi'*.
-- Quindi due cose insieme:
--
--   1. **un posto solo dove si chiede quanto si e' speso** (`consumi_ai`),
--      che unisce le quattro fonti e calcola il costo dove manca;
--   2. **una rete che si accorge di una fonte NUOVA** (`fonti_ai_scoperte`),
--      che nomina qualunque tabella con modello e token che `consumi_ai`
--      non comprende. Non impedisce di dimenticare: lo **dice**, ed e'
--      quanto basta perche' non passino altri sei giorni in silenzio.
--
-- ⚠️ E UN COSTO CHE NON SI SA NON DIVENTA ZERO. Il listino
-- (`costo_modello_ai`) conosce due modelli, e la lettura della posta usa
-- `claude-opus-5`, che non c'e': la sua spesa **non e' calcolabile**.
-- `consumi_ai` la dichiara invece di contarla zero — uno zero qui si
-- leggerebbe «non abbiamo speso niente», che e' la bugia peggiore su un
-- tetto di spesa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA POSTA REGISTRA I DUE NUMERI, NON LA LORO SOMMA
-- ---------------------------------------------------------------------
-- ⚠️ Un token di domanda e uno di risposta **non costano uguale**: sommarli
-- e poi moltiplicarli per un prezzo solo da' un numero che non e' ne' l'uno
-- ne' l'altro. La colonna vecchia resta al suo posto — le righe gia'
-- scritte la portano, e riscriverle sarebbe inventare la scomposizione.
alter table posta_ricevuta
  add column if not exists proposta_token_domanda integer,
  add column if not exists proposta_token_risposta integer;

comment on column posta_ricevuta.proposta_token_domanda is
  'Token della domanda mandata al modello. Vuoto sulle righe lette prima del 29/08/2026, quando si conservava solo la somma: vuoto vuol dire «non lo so», non «zero».';
comment on column posta_ricevuta.proposta_token_risposta is
  'Token della risposta del modello. Vuoto sulle righe lette prima del 29/08/2026.';

-- ---------------------------------------------------------------------
-- 2. TUTTO CIO' CHE E' COSTATO, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
create or replace function consumi_ai()
returns table(fonte text, quando timestamptz, modello text,
              token_domanda integer, token_risposta integer,
              costo_euro numeric, costo_noto boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  -- Le due che il costo se lo scrivono da sole quando nascono.
  select 'foto'::text, l.creato_il, l.modello, l.token_domanda, l.token_risposta,
         l.costo_euro, l.costo_euro is not null
    from letture_foto l
  union all
  select 'voce', d.creato_il, d.modello, d.token_domanda, d.token_risposta,
         d.costo_euro, d.costo_euro is not null
    from dettature d
  union all
  -- 🔴 L'ARCHIVIO: ha i token e non ha il costo. Si calcola dal listino, e
  -- se il modello non e' a listino il costo resta VUOTO e dichiarato.
  select 'archivio', a.creato_il, a.modello, a.token_domanda, a.token_risposta,
         case when c.modello is null then null
              else round(a.token_domanda::numeric / 1000000 * c.euro_milione_in
                       + a.token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         c.modello is not null
    from domande_archivio a
    left join costo_modello_ai c on c.modello = a.modello
  union all
  -- 🔴 LA POSTA. Le righe nuove portano i due numeri separati; quelle vecchie
  -- solo la somma, e per quelle il costo non si puo' ricostruire.
  select 'posta', p.proposta_il, p.proposta_modello,
         p.proposta_token_domanda, p.proposta_token_risposta,
         case when c.modello is null
               or p.proposta_token_domanda is null
               or p.proposta_token_risposta is null then null
              else round(p.proposta_token_domanda::numeric / 1000000 * c.euro_milione_in
                       + p.proposta_token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         (c.modello is not null
          and p.proposta_token_domanda is not null
          and p.proposta_token_risposta is not null)
    from posta_ricevuta p
    left join costo_modello_ai c on c.modello = p.proposta_modello
   where p.proposta_il is not null;
$fn$;

revoke all on function consumi_ai() from public, anon, authenticated;
grant execute on function consumi_ai() to authenticated;

comment on function consumi_ai() is
  'Tutto cio'' che e'' costato all''assistente, in un posto solo: foto, voce, archivio e posta. Un costo che il listino non sa calcolare resta VUOTO e dichiarato, mai zero.';

-- ---------------------------------------------------------------------
-- 3. LA RETE: UNA FONTE NUOVA SI FA NOTARE
-- ---------------------------------------------------------------------
-- ⚠️ Non elenca a mano le quattro tabelle note: **legge il catalogo** e
-- guarda il corpo vivo di `consumi_ai`. Cosi' una tabella nuova con dentro
-- un modello e dei token compare da sola, e chi la scrive non deve
-- ricordarsi di niente — deve solo leggere l'allarme.
create or replace function fonti_ai_scoperte()
returns table(tabella text, colonne text)
language sql
stable
security definer
set search_path = public
as $fn$
  select c.table_name::text,
         string_agg(c.column_name, ', ' order by c.column_name)::text
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.column_name in ('modello', 'proposta_modello')
     -- Il listino dei prezzi non e' una fonte di spesa: e' il prezzario.
     and c.table_name <> 'costo_modello_ai'
     and not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'consumi_ai'
          and pg_get_functiondef(p.oid) like '%' || c.table_name || '%')
   group by c.table_name;
$fn$;

revoke all on function fonti_ai_scoperte() from public, anon, authenticated;
grant execute on function fonti_ai_scoperte() to authenticated;

-- ---------------------------------------------------------------------
-- 4. LA SPESA DEL MESE LEGGE DA LI'
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo il 29/08: cambia da dove prende i numeri,
-- e aggiunge il conto di cio' che non si e' potuto calcolare.
--
-- ⚠️ SI DEVE DROPPARE: cambiano le colonne che restituisce, e Postgres non
-- lo permette con un `create or replace`. E dopo un `drop` **i permessi
-- tornano aperti a chiunque abbia la chiave pubblica**, quindi si
-- rimettono esattamente come erano — misurati in produzione prima di
-- toccarla, non ricopiati a memoria dalle funzioni accanto: erano
-- `postgres` piu' `authenticated`, e cosi' restano.
drop function if exists spesa_ai_del_mese();

create or replace function spesa_ai_del_mese()
returns table(speso_euro numeric, tetto_euro numeric, percentuale numeric,
              blocca boolean, avvisa boolean, sbloccato boolean, letture integer,
              non_calcolabili integer, frase text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_primo   date;
  v_speso   numeric;
  v_n       integer;
  v_ignoti  integer;
  v_tetto   numeric;
  v_sblocco date;
  v_perc    numeric;
  v_sbl     boolean;
  v_coda    text;
begin
  if not is_titolare() then
    raise exception 'La spesa dell''assistente e'' riservata al titolare.';
  end if;

  v_primo := date_trunc('month', (now() at time zone 'Europe/Rome'))::date;

  select coalesce(sum(x.costo_euro), 0), count(*), count(*) filter (where not x.costo_noto)
    into v_speso, v_n, v_ignoti
    from consumi_ai() x
   where (x.quando at time zone 'Europe/Rome')::date >= v_primo;

  select i.tetto_mensile_euro, i.sbloccato_il into v_tetto, v_sblocco
    from impostazioni_ai i where i.id;

  -- Uno sblocco vale per il mese in cui e' stato dato, e non oltre.
  v_sbl := v_sblocco is not null and v_sblocco >= v_primo;

  -- ⚠️ La coda dice quante chiamate non si sono potute valutare. Senza,
  -- «hai speso X» sembrerebbe un totale mentre e' un minimo.
  v_coda := case when v_ignoti > 0
                 then ' ⚠️ ' || v_ignoti || ' chiamate non si sono potute valutare' ||
                      ' (modello fuori listino o numeri non conservati): il totale e'' un minimo.'
                 else '' end;

  if v_tetto is null then
    return query select
      round(v_speso, 5), null::numeric, null::numeric,
      false, false, v_sbl, v_n, v_ignoti,
      ('Non c''e'' nessun tetto di spesa: le letture non si fermano mai da sole. Il tetto si mette da qui.' || v_coda)::text;
    return;
  end if;

  v_perc := round(v_speso / v_tetto * 100, 1);

  return query select
    round(v_speso, 5),
    v_tetto,
    v_perc,
    -- 🔴 AL CENTO PER CENTO SI BLOCCA, a meno che Alessio non abbia detto
    -- di andare avanti. E bloccare non ferma il lavoro: la scheda si
    -- compila a mano come sempre.
    (v_perc >= 100 and not v_sbl),
    (v_perc >= 80 and v_perc < 100),
    v_sbl,
    v_n,
    v_ignoti,
    (case
      when v_perc >= 100 and v_sbl then
        'La spesa del mese ha superato il tetto, ma e'' stata sbloccata: le letture continuano.'
      when v_perc >= 100 then
        'La spesa del mese ha raggiunto il tetto: le letture sono ferme. Le schede si compilano a mano come sempre, oppure si sblocca da qui.'
      when v_perc >= 80 then
        'La spesa del mese si sta avvicinando al tetto.'
      else
        'La spesa del mese e'' sotto il tetto.'
    end || v_coda)::text;
end
$fn$;

revoke all on function spesa_ai_del_mese() from public, anon, authenticated;
grant execute on function spesa_ai_del_mese() to authenticated;

-- ---------------------------------------------------------------------
-- 5. LA DOMANDA CHE PUO' FARE ANCHE UN PROGRAMMA
-- ---------------------------------------------------------------------
-- 🔴 `spesa_ai_del_mese()` ha il portiere `is_titolare()`, e le funzioni
-- online girano con la chiave di servizio, dove `auth.uid()` e' VUOTO:
-- chiamandola da li' riceverebbero un rifiuto, e chi scrivesse quel codice
-- concluderebbe che il tetto non si puo' guardare. E' la trappola del
-- 27/08 — *il portiere e' la cura sbagliata quando i chiamanti hanno
-- identita' diverse*.
-- Quindi: una domanda separata che risponde SI'/NO e non dice nessun
-- importo, aperta al solo ruolo di servizio.
create or replace function tetto_ai_raggiunto()
returns table(fermo boolean, frase text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_primo  date := date_trunc('month', (now() at time zone 'Europe/Rome'))::date;
  v_speso  numeric;
  v_tetto  numeric;
  v_sbl    date;
begin
  select coalesce(sum(x.costo_euro), 0) into v_speso
    from consumi_ai() x
   where (x.quando at time zone 'Europe/Rome')::date >= v_primo;
  select i.tetto_mensile_euro, i.sbloccato_il into v_tetto, v_sbl
    from impostazioni_ai i where i.id;

  -- ⚠️ Nessun tetto = nessun blocco, ed e' voluto: il tetto nasce VUOTO
  -- perche' lo decide Alessio, e un tetto non deciso non deve fermare
  -- niente. Che non ce ne sia uno lo dice gia' la schermata.
  if v_tetto is null then
    return query select false, 'Nessun tetto di spesa impostato.'::text;
    return;
  end if;
  if v_sbl is not null and v_sbl >= v_primo then
    return query select false, 'Tetto superato ma sbloccato per questo mese.'::text;
    return;
  end if;
  return query select
    (v_speso >= v_tetto),
    case when v_speso >= v_tetto
         then 'Il tetto di spesa del mese e'' stato raggiunto: l''assistente e'' fermo fino al mese prossimo, o finche'' non lo sblocchi da Impostazioni.'
         else 'Sotto il tetto.' end::text;
end
$fn$;

revoke all on function tetto_ai_raggiunto() from public, anon, authenticated;
grant execute on function tetto_ai_raggiunto() to service_role;

comment on function tetto_ai_raggiunto() is
  'Il tetto di spesa e'' stato raggiunto? Risponde si'' o no senza dire nessun importo, ed e'' aperta al solo ruolo di servizio: la chiamano le funzioni online, che girano senza un utente.';

-- ---------------------------------------------------------------------
-- 6. UNA MAIL CHE NON SI RIESCE A LEGGERE SI DICE — UNA VOLTA AL GIORNO
-- ---------------------------------------------------------------------
-- Approvato da Alessio, con la sua condizione: **un solo messaggio al
-- giorno che raggruppa tutte**, mai uno per mail. La sua ragione: *una
-- raffica di notifiche e' il modo piu' rapido per farsi disattivare
-- l'avviso.*
--
-- ⚠️ Il freno generale degli allarmi e' «uno per tipo all'ORA», che qui
-- darebbe ventiquattro messaggi al giorno. Il tipo porta dentro la data —
-- come fa gia' l'avviso delle scadenze — e prima di mandarlo si guarda se
-- per quel giorno e' gia' uscito.
create or replace function avvisa_posta_illeggibile()
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_oggi  date := (now() at time zone 'Europe/Rome')::date;
  v_tipo  text;
  v_n     integer;
  v_quali text;
begin
  v_tipo := 'posta_illeggibile_' || v_oggi::text;

  -- Gia' detto oggi: non si ripete.
  if exists (select 1 from allarmi a where a.tipo = v_tipo) then
    return false;
  end if;

  select count(*), string_agg('«' || coalesce(p.oggetto, 'senza oggetto') || '»', ', ')
    into v_n, v_quali
    from posta_ricevuta p
   where p.stato = 'da_leggere'
     and p.tentativi_lettura >= (select coalesce(max_tentativi_lettura_posta, 3)
                                   from service_settings limit 1);
  if coalesce(v_n, 0) = 0 then
    return false;
  end if;

  perform segnala_allarme(
    v_tipo,
    'Ci sono ' || v_n || ' mail che MEMO non riesce a leggere e su cui ha smesso di provare: ' ||
    left(v_quali, 400) ||
    '. Restano nella Posta con scritto cosa e'' successo: si guardano e si rimettono in coda da li''.',
    jsonb_build_object('giorno', v_oggi, 'quante', v_n),
    'posta');
  return true;
end
$fn$;

revoke all on function avvisa_posta_illeggibile() from public, anon, authenticated;

-- E si chiama dal giro della posta, che gira gia' ogni quarto d'ora: non
-- serve un lavoro pianificato nuovo — che andrebbe anche sorvegliato, e
-- sarebbe un guardiano in piu' per un messaggio al giorno.
create or replace function chiedi_lettura_posta()
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_firma text;
  v_anon  text;
  v_base  text;
  n       integer;
begin
  -- IL PORTIERE E' `auth.uid() is not null`, NON `is_titolare()`.
  -- Questa funzione ha DUE chiamanti con due identita' diverse: il lavoro
  -- pianificato, che gira come proprietario del database e per cui
  -- `is_titolare()` e' FALSO, e il titolare che preme «Leggila adesso».
  if auth.uid() is not null and not is_titolare() then
    raise exception 'Solo il titolare puo'' chiedere a MEMO di leggere la posta adesso';
  end if;

  -- ⚠️ L'avviso delle mail illeggibili si guarda a OGNI giro, anche quando
  -- non c'e' niente da leggere: le mail su cui MEMO si e' arreso restano
  -- ferme proprio quando la coda e' vuota, ed e' li' che nessuno le
  -- guarderebbe piu'.
  perform avvisa_posta_illeggibile();

  select count(*) into n from posta_ricevuta where stato = 'da_leggere';
  if n = 0 then
    -- Niente da leggere: nessuna chiamata, nessun costo — ma il giro c'è
    -- stato, e va scritto.
    insert into stato_lavori (nome, ultimo_successo)
    values ('lettura_posta', now())
    on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
    return false;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  -- Qui il battito NON si scrive: c'era posta da leggere e non è stata
  -- letta. È un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Posta non letta: parola d''ordine assente dal Vault.';
    return false;
  end if;

  perform net.http_post(
    url := v_base || '/posta-leggi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := '{}'::jsonb
  );

  insert into stato_lavori (nome, ultimo_successo)
  values ('lettura_posta', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return true;
end
$fn$;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit uuid;
  v_foto jsonb;
  v_fonti text;
  v_n integer;
  v_speso numeric;
  v_ignoti integer;
  v_frase text;
  v_fermo boolean;
  v_tetto_prima numeric;
  v_sbl_prima date;
  v_mail uuid;
  v_mail2 uuid;
  v_ok boolean;
  v_detto boolean;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Verifica impossibile: nessun titolare.'; end if;

  -- (1) Nessuna fonte di spesa resta fuori dal conto.
  select string_agg(f.tabella, ', ') into v_fonti from fonti_ai_scoperte() f;
  if v_fonti is not null then
    raise exception 'Queste tabelle spendono e nessuno le conta: %', v_fonti;
  end if;

  -- (2) …e la rete NON e' cieca: se `consumi_ai` smettesse di guardare una
  --     fonte, la rete la nominerebbe. Si prova sulla fonte vera invece di
  --     inventarne una finta, perche' e' il caso che puo' davvero capitare.
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='posta_ricevuta'
                    and column_name='proposta_modello') then
    raise exception 'La prova della rete non e'' piu'' valida: posta_ricevuta non ha proposta_modello.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (3) Il conto COMPRENDE tutte e quattro le fonti.
  -- ⚠️ Si contano le fonti NOMINATE nel corpo, non quelle che oggi hanno
  -- righe: contando le righe, una fonte vuota risulterebbe «coperta» e una
  -- fonte dimenticata risulterebbe identica a una fonte senza dati.
  select count(*) into v_n
    from (values ('foto'),('voce'),('archivio'),('posta')) f(nome)
    join pg_proc p on p.proname = 'consumi_ai'
    join pg_namespace ns on ns.oid = p.pronamespace and ns.nspname = 'public'
   where pg_get_functiondef(p.oid) like '%''' || f.nome || '''%';
  if v_n <> 4 then
    raise exception 'Il conto della spesa comprende % fonti su 4.', v_n;
  end if;
  select s.speso_euro, s.non_calcolabili, s.frase into v_speso, v_ignoti, v_frase
    from spesa_ai_del_mese() s;
  if v_speso is null then
    raise exception 'La spesa del mese non risponde.';
  end if;

  -- (4) 🔴 UN COSTO CHE NON SI SA NON DIVENTA ZERO, e il totale lo DICE.
  --     Si costruisce il caso: una mail letta con un modello fuori listino.
  insert into posta_ricevuta (messaggio_id, mittente, oggetto, stato, casella, proposta_modello,
                              proposta_il, proposta_token_domanda, proposta_token_risposta)
  values ('VERIFICA-29AGO-tetto@borgo58.it', 'VERIFICA-29AGO@borgo58.it',
          'VERIFICA-29AGO tetto', 'proposta', 'info',
          'modello-che-non-esiste', now(), 1000, 500)
  returning id into v_mail;

  select s.non_calcolabili, s.frase into v_ignoti, v_frase from spesa_ai_del_mese() s;
  if v_ignoti < 1 then
    raise exception 'Una chiamata con modello fuori listino non risulta fra quelle non calcolabili.';
  end if;
  if v_frase not like '%non si sono potute valutare%' then
    raise exception 'Il totale non dichiara di essere un minimo: %', v_frase;
  end if;

  -- (5) Il blocco: superato il tetto, chi chiama come SERVIZIO si ferma.
  -- ⚠️ Il tetto NON si puo' mettere a zero (un vincolo lo vieta, ed e'
  -- giusto: un tetto a zero spegnerebbe l'assistente senza dirlo). Quindi
  -- si alza la SPESA invece di abbassare il tetto — che e' anche il caso
  -- vero. Serve un modello A LISTINO, altrimenti il costo resta vuoto e
  -- non fa superare niente: e' la prova che la fonte «posta» viene contata
  -- davvero, non solo elencata.
  insert into posta_ricevuta (messaggio_id, mittente, oggetto, stato, casella, proposta_modello,
                              proposta_il, proposta_token_domanda, proposta_token_risposta)
  select 'VERIFICA-29AGO-spesa@borgo58.it', 'VERIFICA-29AGO@borgo58.it',
         'VERIFICA-29AGO spesa', 'proposta', 'info', c.modello, now(), 200000000, 200000000
    from costo_modello_ai c limit 1
  returning id into v_mail2;

  select s.speso_euro into v_speso from spesa_ai_del_mese() s;
  if coalesce(v_speso, 0) <= 0 then
    raise exception 'La spesa della POSTA non entra nel totale: speso %', v_speso;
  end if;

  select i.tetto_mensile_euro, i.sbloccato_il into v_tetto_prima, v_sbl_prima
    from impostazioni_ai i where i.id;
  update impostazioni_ai set tetto_mensile_euro = 0.01, sbloccato_il = null where id;
  perform set_config('request.jwt.claims', null, true);
  select t.fermo, t.frase into v_fermo, v_frase from tetto_ai_raggiunto() t;
  if not v_fermo then
    raise exception 'Col tetto raggiunto, l''assistente non risulta fermo.';
  end if;
  if v_frase not like '%sblocchi%' then
    raise exception 'Il blocco non dice come si riparte: %', v_frase;
  end if;

  -- (6) …e allo specchio: senza tetto non si blocca niente. Vuoto e zero
  --     sono due risposte diverse anche qui.
  update impostazioni_ai set tetto_mensile_euro = null where id;
  select t.fermo into v_fermo from tetto_ai_raggiunto() t;
  if v_fermo then
    raise exception 'Senza nessun tetto, l''assistente risulta fermo.';
  end if;
  update impostazioni_ai set tetto_mensile_euro = v_tetto_prima, sbloccato_il = v_sbl_prima where id;

  -- (7) L'avviso delle mail illeggibili esce UNA VOLTA SOLA al giorno.
  update posta_ricevuta set stato = 'da_leggere',
         tentativi_lettura = (select coalesce(max_tentativi_lettura_posta, 3) from service_settings limit 1)
   where id = v_mail;
  v_detto := avvisa_posta_illeggibile();
  if not v_detto then
    raise exception 'Una mail su cui MEMO si e'' arreso non viene segnalata.';
  end if;
  v_detto := avvisa_posta_illeggibile();
  if v_detto then
    raise exception 'L''avviso delle mail illeggibili e'' uscito due volte nello stesso giorno.';
  end if;

  -- PULIZIA: solo cio' che ha creato questa verifica.
  delete from allarmi where tipo = 'posta_illeggibile_' || ((now() at time zone 'Europe/Rome')::date)::text;
  delete from posta_ricevuta where id in (v_mail, v_mail2);
  delete from deleted_records where record_id in (v_mail::text, v_mail2::text);

  perform pretendi_nessun_residuo(v_foto, 'la verifica del tetto di spesa');
  raise notice 'Il tetto e'' uno solo e comprende tutte e % le fonti; un costo che non si sa resta dichiarato e non diventa zero; le mail illeggibili si dicono una volta al giorno.', v_n;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000003', 'un_tetto_solo_per_tutto_l_assistente') on conflict (version) do nothing;
