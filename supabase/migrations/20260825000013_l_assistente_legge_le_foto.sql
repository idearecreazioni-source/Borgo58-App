-- ============================================================================
-- L'ASSISTENTE CHE LEGGE LE FOTO — il motore — 25/08/2026
-- ============================================================================
--
-- Si fotografa una cosa, l'assistente la legge, e il gestionale ne fa
-- qualcosa. Questa migrazione costruisce il MOTORE, che serve a qualunque
-- foto e si fa una volta sola; la prima destinazione — l'etichetta di un
-- prodotto — sta nella migrazione accanto.
--
-- ⚠️ SCRITTA SAPENDO CHE NE ARRIVERANNO ALTRE DUE (bolle del fornitore,
--    fatture). Per questo `letture_foto.genere` e' un vocabolario chiuso e
--    non un booleano, e per questo il tetto di spesa non sa niente delle
--    etichette: conta i soldi, non le destinazioni.
--
-- ----------------------------------------------------------------------------
-- LE TRE COSE CHE QUESTA MIGRAZIONE DECIDE
-- ----------------------------------------------------------------------------
--
-- 1. 🔴 LA FOTO NON ENTRA MAI NEL DATABASE, E NEMMENO NEL DEPOSITO.
--    Il mandato chiede che la foto si butti alla conferma della scheda e
--    che si verifichi che sia sparita «ovunque sia stata appoggiata».
--    ⚠️ La strada scelta rende quella verifica una PROPRIETA' invece che
--    un controllo: la foto vive nella memoria del browser fra lo scatto e
--    la conferma, viaggia dentro la richiesta, e non viene mai scritta da
--    nessuna parte. Non si cancella cio' che non e' mai stato salvato.
--    Il prezzo, dichiarato: ricaricando la pagina prima di confermare, la
--    foto si perde e va rifatta. E' un prezzo piccolo — fra lo scatto e la
--    conferma passano secondi — e si paga una volta sola, mentre una foto
--    dimenticata in un deposito resta li' per sempre.
--
-- 2. ⚠️ IL TETTO DI SPESA NASCE VUOTO, e vuoto NON vuol dire zero.
--    Il mandato dice che il tetto lo imposta Alessio. Un numero messo da
--    me sarebbe un limite deciso da chi non paga il conto, e sbaglierebbe
--    sempre nella stessa direzione. Finche' e' vuoto la spesa si CONTA e
--    si MOSTRA ma non blocca — ed e' dichiarato a schermo, non taciuto.
--    ⚠️ E non e' un buco: sull'account AI c'e' gia' un tetto suo, messo
--    l'11/08, che ferma tutto quando il credito finisce. Questo tetto
--    serve a fermarsi PRIMA, e a sapere perche'.
--
-- 3. ⚠️ I PREZZI DEL MODELLO SONO UN DATO, non un numero nel codice.
--    Cambiano quando cambia il listino di chi vende le chiamate, e il
--    giorno che cambiano si corregge una riga invece di un programma.
--    Stessa forma delle aliquote fiscali e delle regole di deducibilita'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quanto costa un modello
-- ----------------------------------------------------------------------------
create table if not exists costo_modello_ai (
  modello            text primary key,
  euro_milione_in    numeric(10,4) not null,
  euro_milione_out   numeric(10,4) not null,
  nota               text,
  aggiornato_il      timestamptz not null default now()
);

comment on table costo_modello_ai is
  'Quanto costa un milione di parole verso il modello e un milione di ritorno. E'' un dato e non un numero scritto nel programma: il giorno che il listino cambia si corregge una riga, e ogni conto gia'' registrato resta com''era.';
comment on column costo_modello_ai.euro_milione_in is
  'Costo di un milione di token di DOMANDA. Una foto conta come domanda, ed e'' la parte che pesa: un''etichetta vale circa mille-millecinquecento token.';

alter table costo_modello_ai drop constraint if exists costo_modello_non_negativo;
alter table costo_modello_ai
  add constraint costo_modello_non_negativo
  check (euro_milione_in >= 0 and euro_milione_out >= 0 and euro_milione_in <= 1000 and euro_milione_out <= 1000);

comment on constraint costo_modello_non_negativo on costo_modello_ai is
  'Il costo di un milione di parole sta fra zero e mille euro: fuori di li'' e'' quasi certamente un numero scritto nell''unita'' sbagliata, e sballerebbe ogni conto della spesa.';

alter table costo_modello_ai enable row level security;
drop policy if exists costo_modello_ai_titolare on costo_modello_ai;
create policy costo_modello_ai_titolare on costo_modello_ai
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ SI SEMINANO SOLO SE NON CI SONO GIA': `on conflict do nothing` e non
--    `do update`, perche' qui il valore vecchio significa ancora la stessa
--    cosa — e sovrascriverlo cancellerebbe una correzione di Alessio
--    (lezione del 12/08, che vale al contrario proprio in questo caso).
insert into costo_modello_ai (modello, euro_milione_in, euro_milione_out, nota) values
  ('claude-sonnet-5',            2.7500, 13.7500, 'Listino di agosto 2026 convertito da dollari a euro con un cambio prudente. Da ricontrollare quando arriva la prima fattura vera dell''account AI.'),
  ('claude-haiku-4-5-20251001',  0.9200,  4.6000, 'Listino di agosto 2026, stessa conversione.')
on conflict (modello) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Il registro di cosa e' stato letto
-- ----------------------------------------------------------------------------
-- ⚠️ NON CONSERVA LA FOTO NE' LA RISPOSTA INTERA: conserva quanto e'
--    costata, che genere di cosa era e com'e' finita. Serve a due domande
--    — «quanto sto spendendo» e «l'assistente ci prende?» — e nessuna
--    delle due ha bisogno dell'immagine.
create table if not exists letture_foto (
  id             uuid primary key default gen_random_uuid(),
  genere         text not null,
  riconosciuto   text,
  sicuro         boolean,
  esito          text not null,
  modello        text,
  token_domanda  integer not null default 0,
  token_risposta integer not null default 0,
  costo_euro     numeric(10,5) not null default 0,
  bytes_immagine integer,
  messaggio      text,
  ingredient_id  uuid references ingredients(id) on delete set null,
  creato_il      timestamptz not null default now(),
  creato_da      uuid references auth.users(id) on delete set null
);

comment on table letture_foto is
  'Ogni foto mandata all''assistente: che genere di cosa era, se l''ha riconosciuta, quanto e'' costata. La foto NON e'' qui e non e'' da nessun''altra parte: vive nella memoria del browser fra lo scatto e la conferma, e poi se ne va.';
comment on column letture_foto.genere is
  'Che cosa il gestionale ha CHIESTO di leggere: `etichetta` oggi, `bolla` e `fattura` quando ci saranno. `qualunque` e'' la foto partita dalla Dashboard, dove il contesto non e'' noto.';
comment on column letture_foto.riconosciuto is
  'Che cosa l''assistente dice di aver visto. Puo'' non coincidere col genere chiesto: e'' il caso in cui si fotografa una bolla dalla schermata di un prodotto, e va detto invece che forzato.';
comment on column letture_foto.sicuro is
  'Se l''assistente si e'' dichiarato sicuro di cosa stava guardando. Vuoto quando la lettura non e'' arrivata in fondo.';
comment on column letture_foto.esito is
  'Come e'' finita: `letta`, `non_riconosciuta` (non e'' nessuna delle cose che sa leggere), `destinazione_mancante` (l''ha riconosciuta ma non c''e'' ancora dove metterla), `tetto` (la spesa del mese ha raggiunto il limite), `errore`.';
comment on column letture_foto.costo_euro is
  'Quanto e'' costata questa lettura, calcolata coi prezzi del giorno in cui e'' avvenuta. Si fotografa qui e non si ricalcola: se domani il listino cambia, la spesa di ieri resta quella che e'' stata.';

alter table letture_foto drop constraint if exists lettura_genere_noto;
alter table letture_foto
  add constraint lettura_genere_noto
  check (genere in ('etichetta','bolla','fattura','qualunque'));
comment on constraint lettura_genere_noto on letture_foto is
  'Le cose che l''assistente sa provare a leggere sono queste: un''etichetta, una bolla, una fattura, oppure «guarda tu cos''e''». Un genere diverso e'' un errore di chi chiama.';

alter table letture_foto drop constraint if exists lettura_esito_noto;
alter table letture_foto
  add constraint lettura_esito_noto
  check (esito in ('letta','non_riconosciuta','destinazione_mancante','tetto','errore'));
comment on constraint lettura_esito_noto on letture_foto is
  'Come puo'' finire una lettura. Se ne serve uno nuovo si aggiunge qui, cosi'' il conto della spesa e la schermata restano d''accordo.';

alter table letture_foto drop constraint if exists lettura_costo_sensato;
alter table letture_foto
  add constraint lettura_costo_sensato
  check (costo_euro >= 0 and costo_euro <= 5 and token_domanda >= 0 and token_risposta >= 0);
comment on constraint lettura_costo_sensato on letture_foto is
  'Una lettura non puo'' costare piu'' di cinque euro: una foto sola non ci arriva nemmeno lontanamente, e un numero cosi'' vorrebbe dire un prezzo scritto nell''unita'' sbagliata. Meglio fermarsi che registrare una spesa falsa.';

create index if not exists idx_letture_foto_data on letture_foto (creato_il desc);

alter table letture_foto enable row level security;
drop policy if exists letture_foto_titolare on letture_foto;
create policy letture_foto_titolare on letture_foto
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ----------------------------------------------------------------------------
-- 3. Il tetto di spesa — e nasce vuoto apposta
-- ----------------------------------------------------------------------------
create table if not exists impostazioni_ai (
  id                 boolean primary key default true,
  tetto_mensile_euro numeric(8,2),
  sbloccato_il       date,
  aggiornato_il      timestamptz not null default now(),
  constraint impostazioni_ai_una_riga check (id)
);

comment on table impostazioni_ai is
  'Il tetto di spesa mensile dell''assistente. Una riga sola: e'' un''impostazione del locale, non un dato che si moltiplica.';
comment on column impostazioni_ai.tetto_mensile_euro is
  'Quanto si e'' disposti a spendere in un mese. VUOTO vuol dire «non l''ha ancora detto nessuno», non «zero»: finche'' e'' vuoto la spesa si conta e si mostra ma non blocca niente, e la schermata lo dichiara. Un numero messo dal programma sarebbe un limite deciso da chi non paga il conto.';
comment on column impostazioni_ai.sbloccato_il is
  'Il giorno in cui Alessio ha detto «vai avanti lo stesso» dopo aver raggiunto il tetto. Vale per il mese di quella data e basta: uno sblocco che dura per sempre e'' un tetto tolto, non superato.';

alter table impostazioni_ai drop constraint if exists tetto_sensato;
alter table impostazioni_ai
  add constraint tetto_sensato
  check (tetto_mensile_euro is null or (tetto_mensile_euro > 0 and tetto_mensile_euro <= 1000));
comment on constraint tetto_sensato on impostazioni_ai is
  'Il tetto mensile sta fra un euro e mille. Zero non e'' ammesso: un tetto a zero spegne l''assistente senza dirlo, e per spegnerlo c''e'' un modo piu'' chiaro — non usarlo. Vuoto invece va benissimo e vuol dire «non l''ho ancora deciso».';

alter table impostazioni_ai enable row level security;
drop policy if exists impostazioni_ai_titolare on impostazioni_ai;
create policy impostazioni_ai_titolare on impostazioni_ai
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

insert into impostazioni_ai (id) values (true) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Quanto abbiamo speso questo mese
-- ----------------------------------------------------------------------------
-- ⚠️ IL MESE E' QUELLO ITALIANO, non quello di Greenwich. Una lettura
--    fatta l'ultima notte del mese dopo mezzanotte finirebbe nel mese
--    sbagliato, e il primo del mese il conto ripartirebbe da un numero che
--    non e' zero. E' la trappola che questo progetto ha gia' incontrato
--    cinque volte, chiusa qui prima che morda.
--    ⚠️ E qui il mese e' quello di CALENDARIO e non la serata di servizio:
--    il tetto e' una spesa mensile, e chi la paga ragiona a mesi veri.
create or replace function spesa_ai_del_mese()
returns table(
  speso_euro    numeric,
  tetto_euro    numeric,
  percentuale   numeric,
  blocca        boolean,
  avvisa        boolean,
  sbloccato     boolean,
  letture       integer,
  frase         text
)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  v_primo   date;
  v_speso   numeric;
  v_n       integer;
  v_tetto   numeric;
  v_sblocco date;
  v_perc    numeric;
  v_sbl     boolean;
begin
  if not is_titolare() then
    raise exception 'La spesa dell''assistente e'' riservata al titolare.';
  end if;

  v_primo := date_trunc('month', (now() at time zone 'Europe/Rome'))::date;

  select coalesce(sum(l.costo_euro), 0), count(*)
    into v_speso, v_n
    from letture_foto l
   where (l.creato_il at time zone 'Europe/Rome')::date >= v_primo;

  select i.tetto_mensile_euro, i.sbloccato_il into v_tetto, v_sblocco
    from impostazioni_ai i where i.id;

  -- Uno sblocco vale per il mese in cui e' stato dato, e non oltre.
  v_sbl := v_sblocco is not null and v_sblocco >= v_primo;

  if v_tetto is null then
    return query select
      round(v_speso, 5), null::numeric, null::numeric,
      false, false, v_sbl, v_n,
      'Non c''e'' nessun tetto di spesa: le letture non si fermano mai da sole. Il tetto si mette da qui.'::text;
    return;
  end if;

  v_perc := round(v_speso / v_tetto * 100, 1);

  return query select
    round(v_speso, 5),
    v_tetto,
    v_perc,
    -- 🔴 AL CENTO PER CENTO SI BLOCCA, a meno che Alessio non abbia detto
    -- di andare avanti. E bloccare non ferma il lavoro: la scheda si
    -- compila a mano come sempre, ed e' il motivo per cui questo blocco
    -- puo' permettersi di essere netto invece che gentile.
    (v_perc >= 100 and not v_sbl),
    (v_perc >= 80 and v_perc < 100),
    v_sbl,
    v_n,
    case
      when v_perc >= 100 and v_sbl then
        'La spesa del mese ha superato il tetto, ma e'' stata sbloccata: le letture continuano.'
      when v_perc >= 100 then
        'La spesa del mese ha raggiunto il tetto: le letture sono ferme. Le schede si compilano a mano come sempre, oppure si sblocca da qui.'
      when v_perc >= 80 then
        'La spesa del mese si sta avvicinando al tetto.'
      else
        'La spesa del mese e'' sotto il tetto.'
    end::text;
end $funzione$;

revoke all on function spesa_ai_del_mese() from public, anon, authenticated;
grant execute on function spesa_ai_del_mese() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Registrare una lettura — ed e' qui che il costo si calcola
-- ----------------------------------------------------------------------------
-- ⚠️ IL COSTO SI CALCOLA QUI E NON NELLA FUNZIONE ONLINE: il listino vive
--    in una tabella del database, e farlo leggere anche a chi chiama
--    vorrebbe dire due posti che fanno lo stesso conto. Se il modello non
--    e' in listino il costo resta zero e la riga lo DICHIARA nel
--    messaggio: uno zero silenzioso in un conto di spesa si legge «gratis».
create or replace function registra_lettura_foto(
  p_genere         text,
  p_esito          text,
  p_riconosciuto   text default null,
  p_sicuro         boolean default null,
  p_modello        text default null,
  p_token_domanda  integer default 0,
  p_token_risposta integer default 0,
  p_bytes          integer default null,
  p_messaggio      text default null,
  p_ingredient_id  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_prezzo costo_modello_ai%rowtype;
  v_costo  numeric := 0;
  v_msg    text := p_messaggio;
  v_id     uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' usare l''assistente.';
  end if;

  if p_modello is not null then
    select * into v_prezzo from costo_modello_ai where modello = p_modello;
    if found then
      v_costo := round(
        coalesce(p_token_domanda, 0)::numeric  / 1000000 * v_prezzo.euro_milione_in +
        coalesce(p_token_risposta, 0)::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    else
      v_msg := coalesce(v_msg || ' — ', '') ||
        'Il costo di questa lettura non e'' stato conteggiato: il modello «' || p_modello ||
        '» non e'' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu'' bassa del vero.';
    end if;
  end if;

  insert into letture_foto (
    genere, riconosciuto, sicuro, esito, modello,
    token_domanda, token_risposta, costo_euro, bytes_immagine, messaggio,
    ingredient_id, creato_da)
  values (
    p_genere, p_riconosciuto, p_sicuro, p_esito, p_modello,
    coalesce(p_token_domanda, 0), coalesce(p_token_risposta, 0), v_costo, p_bytes, v_msg,
    p_ingredient_id, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'costo_euro', v_costo, 'nel_listino', v_prezzo.modello is not null);
end $funzione$;

revoke all on function registra_lettura_foto(text,text,text,boolean,text,integer,integer,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function registra_lettura_foto(text,text,text,boolean,text,integer,integer,integer,text,uuid)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Il tetto si mette, e si sblocca
-- ----------------------------------------------------------------------------
create or replace function imposta_tetto_ai(p_euro numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' cambiare il tetto di spesa.';
  end if;

  -- ⚠️ Togliere il tetto e metterlo a zero sono due gesti diversi, e uno
  --    dei due non esiste: si passa un valore vuoto per toglierlo, e il
  --    vincolo rifiuta lo zero.
  update impostazioni_ai
     set tetto_mensile_euro = p_euro, aggiornato_il = now()
   where id;

  return jsonb_build_object('tetto', p_euro);
end $funzione$;

revoke all on function imposta_tetto_ai(numeric) from public, anon, authenticated;
grant execute on function imposta_tetto_ai(numeric) to authenticated;

create or replace function sblocca_spesa_ai()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare v_oggi date;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' sbloccare la spesa.';
  end if;

  -- ⚠️ LA DATA E' QUELLA ITALIANA, come il mese che il tetto conta. Se le
  --    due si chiedessero a orologi diversi, uno sblocco dato all'una di
  --    notte dell'ultimo del mese varrebbe per il mese gia' finito.
  v_oggi := (now() at time zone 'Europe/Rome')::date;
  update impostazioni_ai set sbloccato_il = v_oggi, aggiornato_il = now() where id;

  return jsonb_build_object('sbloccato_il', v_oggi);
end $funzione$;

revoke all on function sblocca_spesa_ai() from public, anon, authenticated;
grant execute on function sblocca_spesa_ai() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di roba che la verifica ha creato, e si
--    cancella per identificativo (23/08). Il tetto che c'era prima si
--    salva e si rimette com'era: e' una scelta di Alessio, non un dato
--    della migrazione.
do $verifica$
declare
  v_tit         uuid;
  v_speso       numeric;
  v_tetto_pre   numeric;
  v_sblocco_pre date;
  v_miei        uuid[] := '{}';
  v_r           record;
  v_riga        letture_foto%rowtype;
  v_esito       jsonb;
  v_ok          boolean;
  v_n           integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select tetto_mensile_euro, sbloccato_il into v_tetto_pre, v_sblocco_pre
    from impostazioni_ai where id;

  -- Le funzioni hanno un portiere: dentro una migrazione non c'e' nessun
  -- utente, quindi ci si dichiara titolare per il tempo della verifica.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La verifica non riesce a presentarsi come titolare: senza, ogni funzione rifiuta e non si prova niente.';
  end if;

  -- ------------------------------------------------------------------
  -- (A) Senza tetto non si blocca niente, e lo si DICHIARA.
  --     ⚠️ E' lo stato in cui la produzione si trova oggi: se questo caso
  --     rispondesse «blocca», l'assistente nascerebbe spento.
  -- ------------------------------------------------------------------
  update impostazioni_ai set tetto_mensile_euro = null, sbloccato_il = null where id;
  select * into v_r from spesa_ai_del_mese();
  if v_r.blocca then
    raise exception 'Senza tetto la spesa risulta bloccata: l''assistente nascerebbe spento';
  end if;
  if v_r.tetto_euro is not null then
    raise exception 'Senza tetto viene fuori un tetto dal nulla: %', v_r.tetto_euro;
  end if;
  if v_r.frase not like '%nessun tetto%' then
    raise exception 'Il tetto vuoto non e'' dichiarato: «%»', v_r.frase;
  end if;

  -- ------------------------------------------------------------------
  -- (B) Il costo si calcola dal listino, e il conto e' quello giusto.
  --     ⚠️ I NUMERI SONO QUELLI DI UNA FOTO VERA: un'etichetta vale circa
  --     millecinquecento token di domanda e la risposta quattrocento. Con
  --     quelli il costo giusto e' 0,00963 €, e le tre risposte sbagliate
  --     possibili sono tutte DIVERSE — solo la domanda darebbe 0,00413,
  --     solo la risposta 0,00550, i token sommati a un prezzo solo
  --     0,00523. Un conto che sbaglia non puo' azzeccare per caso.
  --
  --     🔴 IL PRIMO TENTATIVO DI QUESTA VERIFICA E' STATO RESPINTO DAL
  --     VINCOLO QUI SOPRA: usava un milione e mezzo di token, cioe' 9,63 €
  --     per una foto sola. Il vincolo ha fatto esattamente il suo mestiere
  --     — e la lezione e' che i dati di una prova devono essere
  --     plausibili, o e' la prova a essere sbagliata, non la regola.
  -- ------------------------------------------------------------------
  v_esito := registra_lettura_foto(
    'etichetta', 'letta', 'etichetta', true, 'claude-sonnet-5',
    1500, 400, 412000, 'riga della verifica');
  v_miei := v_miei || (v_esito->>'id')::uuid;

  if (v_esito->>'costo_euro')::numeric <> 0.00963 then
    raise exception 'Il costo di una lettura normale e'' % invece di 0,00963', v_esito->>'costo_euro';
  end if;
  if (v_esito->>'nel_listino')::boolean is not true then
    raise exception 'Il modello non e'' stato trovato nel listino';
  end if;

  -- ------------------------------------------------------------------
  -- (C) Un modello fuori listino non costa zero in silenzio: lo dice.
  --     ⚠️ E' il caso che arrivera' davvero, il giorno che si cambia
  --     modello e nessuno aggiorna il listino. Uno zero muto in un conto
  --     di spesa si legge «gratis».
  -- ------------------------------------------------------------------
  v_esito := registra_lettura_foto(
    'etichetta', 'letta', 'etichetta', true, 'modello-che-non-esiste',
    1000, 100, 999, null);
  v_miei := v_miei || (v_esito->>'id')::uuid;

  if (v_esito->>'nel_listino')::boolean is not false then
    raise exception 'Un modello inesistente risulta in listino';
  end if;
  select * into v_riga from letture_foto where id = (v_esito->>'id')::uuid;
  if coalesce(v_riga.messaggio, '') not like '%non e%nel listino%' then
    raise exception 'Il modello fuori listino non lo dichiara: «%»', v_riga.messaggio;
  end if;

  -- ------------------------------------------------------------------
  -- (C-bis) Una lettura pesante, per avere una spesa su cui provare le
  --     soglie. ⚠️ Questi token NON sono quelli di una foto e non
  --     pretendono di esserlo: servono a portare la spesa del mese
  --     all'ordine dell'euro, che e' l'ordine in cui un tetto vive. Con
  --     centesimi, un tetto a due decimali non riesce a esprimere una
  --     soglia dell'ottanta per cento, e la prova fallirebbe per gli
  --     arrotondamenti invece che per un difetto.
  -- ------------------------------------------------------------------
  v_esito := registra_lettura_foto(
    'qualunque', 'letta', 'etichetta', true, 'claude-sonnet-5',
    300000, 40000, 900000, 'riga della verifica: spesa su cui provare le soglie');
  v_miei := v_miei || (v_esito->>'id')::uuid;

  -- ------------------------------------------------------------------
  -- (D) Le tre soglie, e il tetto si calcola DALLA SPESA MISURATA.
  --     ⚠️ UNA PROPRIETA', NON UNA QUANTITA': se un domani questa tabella
  --     avesse gia' delle letture vere, un tetto scritto a mano
  --     racconterebbe una percentuale diversa da quella che si aspetta, e
  --     la verifica fallirebbe senza che niente sia rotto. Chiedendo alla
  --     funzione quanto si e' speso e mettendo il tetto in rapporto a
  --     quello, le tre soglie si provano su qualunque database.
  -- ------------------------------------------------------------------
  select * into v_r from spesa_ai_del_mese();
  v_speso := v_r.speso_euro;
  if v_speso < 1 then
    raise exception 'La verifica non ha prodotto abbastanza spesa per provare le soglie: %', v_speso;
  end if;

  -- Tranquillo: il tetto e' quattro volte la spesa — non avvisa, non blocca.
  perform imposta_tetto_ai(round(v_speso * 4, 2));
  select * into v_r from spesa_ai_del_mese();
  if v_r.blocca or v_r.avvisa then
    raise exception 'Con la spesa a un quarto del tetto avvisa o blocca: % per cento.', v_r.percentuale;
  end if;

  -- Vicino: circa il novanta per cento — avvisa, ma non blocca.
  -- ⚠️ Senza questo verso, l'avviso potrebbe non scattare mai e nessuno
  --    se ne accorgerebbe: un avviso che non arriva somiglia in tutto a
  --    una spesa che sta sotto.
  perform imposta_tetto_ai(round(v_speso / 0.9, 2));
  select * into v_r from spesa_ai_del_mese();
  if v_r.blocca then
    raise exception 'Al novanta per cento blocca gia'': % per cento.', v_r.percentuale;
  end if;
  if not v_r.avvisa then
    raise exception 'Al novanta per cento non avvisa: % per cento.', v_r.percentuale;
  end if;

  -- Superato: il tetto e' meta' della spesa — blocca.
  perform imposta_tetto_ai(greatest(0.01, round(v_speso / 2, 2)));
  select * into v_r from spesa_ai_del_mese();
  if not v_r.blocca then
    raise exception 'Col tetto superato non blocca (speso %, tetto %)', v_r.speso_euro, v_r.tetto_euro;
  end if;
  if v_r.frase not like '%a mano%' then
    raise exception 'Il blocco non dice che si puo'' fare a mano: «%»', v_r.frase;
  end if;

  perform sblocca_spesa_ai();
  select * into v_r from spesa_ai_del_mese();
  if v_r.blocca then
    raise exception 'Dopo lo sblocco continua a bloccare';
  end if;
  if not v_r.sbloccato then
    raise exception 'Lo sblocco non risulta';
  end if;

  -- ------------------------------------------------------------------
  -- (E) Uno sblocco del mese scorso NON vale per questo mese.
  --     ⚠️ Senza questo verso, un solo sblocco toglierebbe il tetto per
  --     sempre — cioe' il tetto non esisterebbe piu', e nessuno se ne
  --     accorgerebbe perche' tutto continuerebbe a funzionare.
  -- ------------------------------------------------------------------
  update impostazioni_ai
     set sbloccato_il = (date_trunc('month', (now() at time zone 'Europe/Rome')) - interval '1 day')::date
   where id;
  select * into v_r from spesa_ai_del_mese();
  if not v_r.blocca then
    raise exception 'Uno sblocco del mese scorso vale ancora: il tetto e'' tolto per sempre';
  end if;

  -- ------------------------------------------------------------------
  -- (F) Un tetto a zero e' respinto, uno vuoto no.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    perform imposta_tetto_ai(0);
    raise exception 'ATTESO RIFIUTO: tetto a zero accettato';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then raise exception 'Il tetto a zero non e'' stato respinto'; end if;

  perform imposta_tetto_ai(null);
  select * into v_r from spesa_ai_del_mese();
  if v_r.tetto_euro is not null then
    raise exception 'Il tetto non si e'' potuto togliere';
  end if;

  -- ------------------------------------------------------------------
  -- (G) Un genere fuori vocabolario e' respinto.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    perform registra_lettura_foto('scontrino', 'letta');
    raise exception 'ATTESO RIFIUTO: genere inventato accettato';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then raise exception 'Un genere inventato e'' passato'; end if;

  -- ------------------------------------------------------------------
  -- Pulizia — solo le righe di cui conosco l'identificativo
  -- ------------------------------------------------------------------
  delete from letture_foto where id = any(v_miei);
  select count(*) into v_n from letture_foto where id = any(v_miei);
  if v_n <> 0 then
    raise exception 'Sono rimaste % righe della verifica', v_n;
  end if;

  update impostazioni_ai
     set tetto_mensile_euro = v_tetto_pre, sbloccato_il = v_sblocco_pre where id;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Il motore c''e'': senza tetto non blocca, col tetto superato blocca, sbloccando riparte, uno sblocco vecchio non vale, e un modello fuori listino lo dichiara invece di costare zero in silenzio.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000013', 'l_assistente_legge_le_foto')
on conflict (version) do nothing;
