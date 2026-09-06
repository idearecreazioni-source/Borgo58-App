-- =====================================================================
-- SPEC-0013 — MEMO voce: appunti liberi da approvare
-- =====================================================================
-- 🔴 NESSUNA DETTATURA SCRIVE PIU' NIENTE PRIMA CHE ALESSIO APPROVI.
--    Fino a oggi `scrivi_dettatura` chiedeva a `azione_si_esegue_da_se` se
--    una cosa detta potesse salvarsi da se', e per le «misure» sicure la
--    risposta era si': una temperatura, una giacenza o una pulizia
--    entravano nel gestionale nell'istante in cui venivano dette. La
--    decisione del 06/09/2026 (DECISIONI.md, «Assistente — voce») supera
--    quel criterio: *la comodita' non giustifica una registrazione non
--    riletta*. Quella funzione non viene lasciata spenta, viene **tolta**:
--    una porta chiusa che resta al suo posto e' una porta che fra sei mesi
--    qualcuno riapre credendo di riparare qualcosa.
--
-- 🔴 E LA DESTINAZIONE NON E' PIU' UN ELENCO CHIUSO. C'era una chiave
--    esterna da `azioni_dettate.tipo` a `tipi_azione_vocale`: qualunque
--    cosa il modello capisse fuori da quei dodici tipi **non poteva essere
--    scritta**, quindi veniva ricondotta a «non ho capito». La chiave
--    esterna se ne va e il catalogo resta — ma cambia mestiere: non decide
--    piu' *cosa si puo' dire*, dice *cosa il gestionale sa gia' eseguire*.
--    Una destinazione che non c'e' produce lo stesso un appunto leggibile,
--    che **dichiara** di non avere ancora un gesto.
--
-- ⚠️ IL CATALOGO NON DIVENTA INUTILE, ed e' il motivo per cui non si
--    cancella: senza, nessuno saprebbe piu' distinguere «il gestionale non
--    sa fare questa cosa» da «il gestionale la sa fare e qualcuno ha
--    sbagliato a scrivere il nome». Il primo e' normale, il secondo e' un
--    difetto, e da fuori si vedono uguali.
--
-- ⚠️ L'UNITA' CHE ALESSIO APPROVA NON E' PIU' LA SINGOLA RIGA: e' un
--    **appunto**, che puo' contenerne piu' d'una. Tre articoli detti per la
--    stessa lista in tre momenti diversi si raccolgono in un appunto solo;
--    due pagamenti restano due. La differenza e' nella natura della
--    destinazione, non nel momento in cui si parla — e vive in una colonna
--    del catalogo (`additivo`), non in un elenco di nomi scritto dentro una
--    funzione.
--
-- ⚠️ IL RAGGRUPPAMENTO E' UN INDICE UNICO, NON UN CONTROLLO NEL CODICE.
--    «Di una lista c'e' al massimo un appunto aperto» e' un invariante, e in
--    questo progetto gli invarianti sono vincoli del database (Contratto
--    §B): se lo decidesse una `select` prima di una `insert`, due dettature
--    ravvicinate potrebbero aprirne due e nessuno se ne accorgerebbe.
--
-- 🔴 NIENTE SI CHIUDE DA SE'. Nessuna scadenza, nessuna fine giornata,
--    nessun tetto al numero di elementi. Un appunto si chiude solo perche'
--    Alessio l'ha approvato o scartato — ed e' la stessa ragione per cui la
--    coda vocale non scade dal 27/08: *buttare via una cosa detta in cella
--    e' quello che gli farebbe smettere di usare la voce*.

-- ---------------------------------------------------------------------
-- 1 · Il catalogo cambia mestiere
-- ---------------------------------------------------------------------
alter table tipi_azione_vocale
  add column if not exists additivo   boolean not null default false,
  add column if not exists eseguibile boolean not null default true;

comment on column tipi_azione_vocale.additivo is
  'Le righe di questa destinazione si raccolgono in un appunto solo, anche se dette in momenti diversi. Vero solo dove una riga in piu'' non e'' un fatto a se'': una lista. Falso su tutto cio'' che ha dati propri — un pagamento, una temperatura, una giacenza, un carico.';
comment on column tipi_azione_vocale.eseguibile is
  'Il gestionale ha davvero un gesto per questa destinazione. Falso significa: l''appunto si crea e si legge, ma approvarlo non scrive niente perche'' non c''e'' ancora niente da chiamare.';

-- La lista della spesa e' l'unica destinazione additiva che esista oggi:
-- aggiungere un articolo non e' un fatto economico a se', e' una riga in
-- piu' su un foglio. Tutto il resto ha dati propri.
update tipi_azione_vocale set additivo = true  where tipo = 'lista_spesa'  and not additivo;
update tipi_azione_vocale set additivo = false where tipo <> 'lista_spesa' and additivo;

-- ⚠️ `nota_non_capita` non e' eseguibile e non lo e' mai stata: e' il posto
--    dove finisce cio' che non si e' capito. Dichiararlo toglie un caso
--    speciale dal codice e lo mette dove si legge.
update tipi_azione_vocale set eseguibile = false where tipo = 'nota_non_capita' and eseguibile;

-- ---------------------------------------------------------------------
-- 2 · La destinazione si libera
-- ---------------------------------------------------------------------
alter table azioni_dettate drop constraint if exists azioni_dettate_tipo_fkey;

alter table azioni_dettate
  add column if not exists alternative          jsonb,
  add column if not exists destinazione_libera  text;

comment on column azioni_dettate.alternative is
  'Le altre strade che MEMO ha considerato prima di scegliere questa, quando ce n''erano. Array di oggetti { destinazione, perche }. Vuoto non vuol dire «non c''erano alternative»: vuol dire che MEMO non ne ha dichiarate.';
comment on column azioni_dettate.destinazione_libera is
  'Il nome leggibile della destinazione quando non e'' una del catalogo. E'' cio'' che Alessio legge sull''appunto al posto del titolo: senza, resterebbe una sigla.';

-- ---------------------------------------------------------------------
-- 3 · L'appunto
-- ---------------------------------------------------------------------
create table if not exists appunti_vocali (
  id            uuid primary key default gen_random_uuid(),
  destinazione  text not null,
  titolo        text not null,
  eseguibile    boolean not null,
  chiave_gruppo text,
  stato         text not null default 'aperto',
  creato_il     timestamptz not null default now(),
  chiuso_il     timestamptz,
  chiuso_da     uuid,
  constraint appunto_stato_noto
    check (stato in ('aperto', 'approvato', 'scartato')),
  constraint appunto_chiuso_ha_la_sua_ora
    check ((stato <> 'aperto') = (chiuso_il is not null))
);

comment on table appunti_vocali is
  'Cio'' che Alessio approva, corregge o scarta: un appunto raccoglie una o piu'' cose dette per la stessa destinazione. Non scade e non si chiude da se''.';
comment on constraint appunto_stato_noto on appunti_vocali is
  'Lo stato di un appunto puo'' essere solo: aperto, approvato, scartato.';
comment on constraint appunto_chiuso_ha_la_sua_ora on appunti_vocali is
  'Un appunto chiuso deve dire quando e'' stato chiuso, e uno aperto non puo'' averlo gia'' scritto.';

comment on column appunti_vocali.chiave_gruppo is
  'La chiave con cui una riga in piu'' ritrova il proprio appunto. Vuota significa **non si raggruppa mai**, ed e'' il caso normale: si riempie solo per le destinazioni additive.';

-- 🔴 L'INVARIANTE, COME VINCOLO E NON COME CONTROLLO NEL CODICE: di una
--    stessa lista non puo' esistere piu' di un appunto aperto. Deciderlo con
--    una lettura prima della scrittura lascerebbe passare due dettature
--    ravvicinate, e il difetto sarebbe due appunti mezzi pieni che nessuno
--    sa di dover approvare insieme.
create unique index if not exists un_appunto_aperto_per_gruppo
  on appunti_vocali (chiave_gruppo)
  where stato = 'aperto' and chiave_gruppo is not null;

alter table appunti_vocali enable row level security;

drop policy if exists appunti_vocali_titolare on appunti_vocali;
create policy appunti_vocali_titolare on appunti_vocali
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

alter table azioni_dettate add column if not exists appunto_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.azioni_dettate'::regclass
       and conname  = 'azioni_dettate_appunto_id_fkey'
  ) then
    alter table azioni_dettate
      add constraint azioni_dettate_appunto_id_fkey
      foreign key (appunto_id) references appunti_vocali (id) on delete restrict;
  end if;
end $$;

-- ⚠️ LE RIGHE CHE C'ERANO GIA' NON RESTANO SENZA APPUNTO. Una colonna
--    lasciata vuota sulle righe vecchie vorrebbe dire due rappresentazioni
--    della stessa cosa — «l'appunto» e «la riga sciolta» — e ogni lettura
--    dovrebbe gestirle tutt'e due per sempre. Ognuna prende il proprio
--    appunto di un elemento, che e' esattamente cio' che era.
do $$
declare v_a record; v_app uuid;
begin
  for v_a in
    select a.id, a.tipo, a.stato, a.creato_il, coalesce(t.titolo, a.tipo) as titolo,
           coalesce(t.eseguibile, false) as eseguibile
      from azioni_dettate a
      left join tipi_azione_vocale t on t.tipo = a.tipo
     where a.appunto_id is null
     order by a.creato_il, a.progressivo
  loop
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo,
                                stato, creato_il, chiuso_il)
    values (v_a.tipo, v_a.titolo, v_a.eseguibile, null,
            case when v_a.stato in ('in_attesa', 'fallita') then 'aperto'
                 when v_a.stato = 'annullata' then 'scartato'
                 else 'approvato' end,
            v_a.creato_il,
            case when v_a.stato in ('in_attesa', 'fallita') then null else v_a.creato_il end)
    returning id into v_app;

    update azioni_dettate set appunto_id = v_app where id = v_a.id;
  end loop;
end $$;

alter table azioni_dettate alter column appunto_id set not null;

-- ---------------------------------------------------------------------
-- 4 · Che destinazione e', e dove va a finire questa riga
-- ---------------------------------------------------------------------

-- ⚠️ UN POSTO SOLO DOVE SI DECIDE COS'E' UNA DESTINAZIONE. Chi scrive una
--    dettatura, chi disegna l'elenco e chi approva devono rispondere tutti
--    e tre allo stesso modo: se ognuno guardasse il catalogo per conto suo,
--    prima o poi uno direbbe «eseguibile» e un altro no.
create or replace function destinazione_vocale(p_tipo text, p_libera text default null)
returns table (titolo text, eseguibile boolean, additivo boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(t.titolo, nullif(btrim(coalesce(p_libera, '')), ''), p_tipo),
         coalesce(t.eseguibile, false),
         coalesce(t.additivo, false)
    from (select 1) uno
    left join tipi_azione_vocale t on t.tipo = p_tipo and t.attivo;
$$;

comment on function destinazione_vocale(text, text) is
  'Titolo leggibile, se il gestionale la sa eseguire e se le sue righe si raccolgono. Una destinazione che il catalogo non conosce NON e'' un errore: non e'' eseguibile e non e'' additiva, e il titolo e'' quello che MEMO ha scritto in parole sue.';

-- La chiave con cui una riga additiva ritrova il proprio appunto aperto.
-- ⚠️ Comprende gia' *quale* lista, che e' cio' che serve a SPEC-0012 senza
--    dover rifare niente qui: due liste diverse sono due appunti diversi.
create or replace function chiave_gruppo_vocale(p_tipo text, p_additivo boolean, p_dati jsonb)
returns text
language sql
immutable
as $$
  select case when coalesce(p_additivo, false)
              then p_tipo || ':' || coalesce(nullif(btrim(coalesce(p_dati->>'lista', '')), ''), '')
         end;
$$;

comment on function chiave_gruppo_vocale(text, boolean, jsonb) is
  'La chiave di raggruppamento, o NULL quando la destinazione non e'' additiva. Vuota per costruzione su tutto cio'' che ha dati propri: un pagamento non si fonde con un altro pagamento nemmeno se e'' della stessa causale.';

-- Trova l'appunto aperto di quel gruppo, o ne apre uno.
create or replace function appunto_per(p_tipo text, p_libera text, p_dati jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_d   record;
  v_key text;
  v_id  uuid;
begin
  select * into v_d from destinazione_vocale(p_tipo, p_libera);
  v_key := chiave_gruppo_vocale(p_tipo, v_d.additivo, p_dati);

  if v_key is not null then
    select id into v_id from appunti_vocali
     where chiave_gruppo = v_key and stato = 'aperto'
     limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
  values (p_tipo, v_d.titolo, v_d.eseguibile, v_key)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5 · Si scrive, non si esegue
-- ---------------------------------------------------------------------
-- ⚠️ LA RETE DELLE GUARDIE MI HA FERMATO QUI, ED E' SERVITA: si accorge che
--    questa riscrittura perde `azione_si_esegue_da_se`, `fai_azione_dettata`
--    e gli stati `eseguita`/`fallita`. E' esattamente cio' che SPEC-0013
--    chiede — questa funzione non esegue piu' niente, quindi non chiama
--    l'esecutore e non puo' scrivere quei due stati. Si dichiara invece di
--    aggirarla, e la riga resta nella storia del commit.
-- rete-guardie: scrivi_dettatura — SPEC-0013: non esegue piu' niente da se', quindi perde l'esecutore e gli stati che solo un'esecuzione poteva scrivere
create or replace function scrivi_dettatura(
  p_utente uuid, p_testo text, p_provenienza text, p_azioni jsonb, p_esito text,
  p_modello text, p_token_domanda integer, p_token_risposta integer, p_messaggio text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prezzo    costo_modello_ai%rowtype;
  v_costo     numeric := 0;
  v_msg       text := p_messaggio;
  v_dettatura uuid;
  v_azione    jsonb;
  v_i         integer := 0;
  v_tipo      text;
  v_libera    text;
  v_sicuro    boolean;
  v_dati      jsonb;
  v_frase     text;
  v_motivo    text;
  v_alt       jsonb;
  v_risolto   jsonb;
  v_manca     text;
  v_d         record;
  v_appunto   uuid;
  v_appunti   uuid[] := '{}';
begin
  if p_modello is not null then
    select * into v_prezzo from costo_modello_ai where modello = p_modello;
    if found then
      v_costo := round(
        coalesce(p_token_domanda, 0)::numeric  / 1000000 * v_prezzo.euro_milione_in +
        coalesce(p_token_risposta, 0)::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    else
      -- Uno zero silenzioso in un conto di spesa si legge «gratis».
      v_msg := coalesce(v_msg || ' — ', '') ||
        'Il costo di questa dettatura non e'' stato conteggiato: il modello «' || p_modello ||
        '» non e'' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu'' bassa del vero.';
    end if;
  end if;

  insert into dettature (testo, provenienza, esito, modello,
                         token_domanda, token_risposta, costo_euro, messaggio, creato_da)
  values (p_testo, p_provenienza, p_esito, p_modello,
          coalesce(p_token_domanda, 0), coalesce(p_token_risposta, 0), v_costo, v_msg, p_utente)
  returning id into v_dettatura;

  for v_azione in select * from jsonb_array_elements(coalesce(p_azioni, '[]'::jsonb))
  loop
    v_i      := v_i + 1;
    v_tipo   := nullif(btrim(coalesce(v_azione->>'tipo', '')), '');
    v_tipo   := coalesce(v_tipo, 'nota_non_capita');
    v_libera := nullif(btrim(coalesce(v_azione->>'destinazione', '')), '');
    v_sicuro := coalesce((v_azione->>'sicuro')::boolean, false);
    v_dati   := coalesce(v_azione->'dati', '{}'::jsonb);
    v_frase  := nullif(btrim(coalesce(v_azione->>'frase', '')), '');
    v_motivo := nullif(btrim(coalesce(v_azione->>'motivo', '')), '');
    v_alt    := case when jsonb_typeof(v_azione->'alternative') = 'array'
                       and jsonb_array_length(v_azione->'alternative') > 0
                     then v_azione->'alternative' end;

    select * into v_d from destinazione_vocale(v_tipo, v_libera);

    -- ⚠️ SI RITRADUCE SOLO CIO' CHE IL GESTIONALE SA ESEGUIRE. Su una
    --    destinazione che non esiste non c'e' nessun catalogo in cui
    --    cercare, e chiamare lo stesso il traduttore vorrebbe dire farlo
    --    ragionare su un tipo che non conosce.
    if v_d.eseguibile then
      v_risolto := voce_risolvi_dati(v_tipo, v_dati);
      v_dati    := v_risolto->'dati';
      v_manca   := nullif(v_risolto->>'manca', '');
      if v_manca is not null then
        -- Quello che manca VINCE su qualunque sicurezza dichiarata: il
        -- modello puo' essere sicuro di aver capito «bottarga», e il
        -- gestionale non averla in magazzino. Sono due cose diverse.
        v_sicuro := false;
        v_motivo := coalesce(v_motivo, v_manca);
      end if;
    else
      -- 🔴 NON E' UN'INCERTEZZA DI MEMO, ED E' IMPORTANTE NON CONFONDERLE:
      --    MEMO puo' aver capito benissimo. E' il gestionale che non ha il
      --    gesto. Detto in parole, perche' «non sicuro» da solo farebbe
      --    credere ad Alessio che il problema sia nell'ascolto.
      v_motivo := coalesce(v_motivo,
        'Ho capito cosa vuoi, ma il gestionale non ha ancora un modo per farlo: '
        || 'questo appunto resta qui come promemoria.');
    end if;

    if v_frase is null then
      v_frase := coalesce(v_d.titolo, 'Una cosa che non ho capito');
    end if;

    if v_motivo is null and not v_sicuro then
      v_motivo := 'Non ero sicuro: guardala tu.';
    end if;

    v_appunto := appunto_per(v_tipo, v_libera, v_dati);
    if not (v_appunto = any(v_appunti)) then
      v_appunti := v_appunti || v_appunto;
    end if;

    -- 🔴 SEMPRE `in_attesa`. Non c'e' nessun ramo che scriva altrove, e non
    --    e' una cautela: e' la forma. Un ramo che esegue, anche stretto,
    --    e' un ramo che qualcuno allarghera'.
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,
                                frase, motivo, stato, alternative,
                                destinazione_libera, appunto_id)
    values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,
            v_frase, v_motivo, 'in_attesa', v_alt, v_libera, v_appunto);
  end loop;

  return jsonb_build_object(
    'dettatura_id', v_dettatura,
    'costo_euro',   v_costo,
    'nel_listino',  v_prezzo.modello is not null,
    'azioni',       v_i,
    'eseguite',     0,
    'appunti',      coalesce(array_length(v_appunti, 1), 0),
    'da_guardare',  v_i);
end $function$;

-- 🔴 LA PORTA SI TOGLIE, NON SI CHIUDE. Si cancella **per nome** e con un
--    ciclo: scriverne la firma qui dentro farebbe fallire il secondo
--    lancio di questa migrazione con «il tipo non esiste».
do $$
declare v record;
begin
  for v in
    select p.oid::regprocedure as f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'azione_si_esegue_da_se'
  loop
    execute 'drop function ' || v.f;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6 · Cosa si legge
-- ---------------------------------------------------------------------

-- ⚠️ `left join` SUL CATALOGO, e non e' una rifinitura: con l'incrocio
--    stretto di prima una destinazione libera **sparirebbe dall'elenco**.
--    Non darebbe nessun errore: darebbe una schermata con un appunto in
--    meno, cioe' la forma peggiore.
create or replace function azioni_dettate_in_attesa()
returns table (id uuid, dettatura_id uuid, tipo text, titolo text, natura text,
               dati jsonb, sicuro boolean, frase text, motivo text, stato text,
               errore text, testo_detto text, quando timestamptz, giorni integer,
               domanda text, scelte jsonb, percorso text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.dettatura_id, a.tipo,
         (select d.titolo from destinazione_vocale(a.tipo, a.destinazione_libera) d),
         coalesce(t.natura, 'libera'),
         a.dati, a.sicuro, a.frase, a.motivo, a.stato, a.errore, d2.testo, a.creato_il,
         (((now() at time zone 'Europe/Rome')::date) - ((a.creato_il at time zone 'Europe/Rome')::date))::integer,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati),
         azione_percorso(a.tipo)
    from azioni_dettate a
    left join tipi_azione_vocale t on t.tipo = a.tipo
    join dettature d2 on d2.id = a.dettatura_id
   where a.stato in ('in_attesa', 'fallita')
   order by a.creato_il, a.progressivo;
end $function$;

-- L'elenco unico che si apre dalla Dashboard.
create or replace function appunti_da_approvare()
returns table (id uuid, destinazione text, titolo text, eseguibile boolean,
               quanti integer, incerto boolean, aperto_da_ore integer,
               aperto_da_giorni integer, creato_il timestamptz, elementi jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Gli appunti dettati sono riservati al titolare.';
  end if;

  return query
  select p.id, p.destinazione, p.titolo, p.eseguibile,
         count(a.id)::integer,
         bool_or(not a.sicuro),
         (extract(epoch from (now() - p.creato_il)) / 3600)::integer,
         (((now() at time zone 'Europe/Rome')::date) - ((p.creato_il at time zone 'Europe/Rome')::date))::integer,
         p.creato_il,
         -- ⚠️ Ogni elemento porta i DATI CONCRETI che verrebbero scritti,
         --    non una sintesi: e' la richiesta esplicita di SPEC-0013, e
         --    senza di essa «approva» sarebbe una firma in bianco.
         coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'frase', a.frase, 'dati', a.dati, 'sicuro', a.sicuro,
           'motivo', a.motivo, 'alternative', coalesce(a.alternative, '[]'::jsonb),
           'stato', a.stato, 'errore', a.errore, 'detto', d.testo
         ) order by a.creato_il, a.progressivo), '[]'::jsonb)
    from appunti_vocali p
    join azioni_dettate a on a.appunto_id = p.id and a.stato in ('in_attesa', 'fallita')
    join dettature d on d.id = a.dettatura_id
   where p.stato = 'aperto'
   group by p.id
   order by p.creato_il;
end $function$;

-- Il numero in Dashboard conta gli APPUNTI, non le righe: e' quello che
-- Alessio deve guardare, e tre articoli di una lista sono un gesto solo.
create or replace function voce_da_guardare()
returns table (quante integer, la_piu_vecchia integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    return query select 0, 0;
    return;
  end if;

  return query
  select count(*)::integer,
         coalesce(max(
           ((now() at time zone 'Europe/Rome')::date) - ((p.creato_il at time zone 'Europe/Rome')::date)
         ), 0)::integer
    from appunti_vocali p
   where p.stato = 'aperto'
     and exists (select 1 from azioni_dettate a
                  where a.appunto_id = p.id and a.stato in ('in_attesa', 'fallita'));
end $function$;

-- ---------------------------------------------------------------------
-- 7 · Approva, correggi, scarta
-- ---------------------------------------------------------------------
create or replace function approva_appunto(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_p    appunti_vocali%rowtype;
  v_a    azioni_dettate%rowtype;
  v_ris  jsonb;
  v_dati jsonb;
  v_manca text;
  v_n    integer := 0;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' approvare quello che ha dettato.';
  end if;

  select * into v_p from appunti_vocali where id = p_id for update;
  if not found then
    raise exception 'Questo appunto non c''e'' piu''.';
  end if;
  if v_p.stato <> 'aperto' then
    raise exception 'Questo appunto era gia'' stato chiuso.';
  end if;

  -- 🔴 IL RIFIUTO DICE COSA MANCA E COSA FARE, e non e' un vicolo cieco:
  --    l'appunto resta li' — e' un promemoria di una cosa che il gestionale
  --    imparera' a fare, non un errore da cui uscire.
  if not v_p.eseguibile then
    raise exception 'Questo appunto non si puo'' approvare: «%» non e'' una cosa che il gestionale sappia ancora fare. Resta qui finche'' non la costruiamo, oppure scartalo.', v_p.titolo;
  end if;

  for v_a in
    select * from azioni_dettate
     where appunto_id = p_id and stato in ('in_attesa', 'fallita')
     order by creato_il, progressivo
     for update
  loop
    v_ris   := voce_risolvi_dati(v_a.tipo, v_a.dati);
    v_dati  := v_ris->'dati';
    v_manca := nullif(v_ris->>'manca', '');
    if v_manca is not null then
      raise exception '%', v_manca;
    end if;

    v_ris := fai_azione_dettata(v_a.tipo, v_dati);

    update azioni_dettate
       set stato = 'eseguita', eseguita_il = now(), dati = v_dati,
           risultato = v_ris, errore = null, motivo = null
     where id = v_a.id;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'In questo appunto non c''e'' piu'' niente da approvare.';
  end if;

  update appunti_vocali
     set stato = 'approvato', chiuso_il = now(), chiuso_da = auth.uid()
   where id = p_id;

  return jsonb_build_object('titolo', v_p.titolo, 'quanti', v_n);
end $function$;

create or replace function scarta_appunto(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_p appunti_vocali%rowtype; v_n integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' scartare quello che ha dettato.';
  end if;

  select * into v_p from appunti_vocali where id = p_id for update;
  if not found then
    raise exception 'Questo appunto non c''e'' piu''.';
  end if;
  if v_p.stato <> 'aperto' then
    raise exception 'Questo appunto era gia'' stato chiuso.';
  end if;

  update azioni_dettate
     set stato = 'annullata', motivo = 'Scartato da Alessio'
   where appunto_id = p_id and stato in ('in_attesa', 'fallita');
  get diagnostics v_n = row_count;

  update appunti_vocali
     set stato = 'scartato', chiuso_il = now(), chiuso_da = auth.uid()
   where id = p_id;

  return jsonb_build_object('titolo', v_p.titolo, 'quanti', v_n);
end $function$;

-- Correggere un elemento: i dati cambiano, l'appunto resta aperto.
-- ⚠️ Si ritraduce subito, cosi' la correzione si vede sull'appunto invece di
--    scoprirsi al momento di approvare.
create or replace function correggi_elemento_appunto(p_id uuid, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_a azioni_dettate%rowtype; v_ris jsonb; v_dati jsonb; v_manca text; v_ese boolean;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' correggere quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa riga non c''e'' piu''.';
  end if;
  if v_a.stato not in ('in_attesa', 'fallita') then
    raise exception 'Questa riga non e'' piu'' da approvare: e'' «%».', v_a.stato;
  end if;

  select d.eseguibile into v_ese from destinazione_vocale(v_a.tipo, v_a.destinazione_libera) d;

  v_dati  := coalesce(p_dati, '{}'::jsonb);
  v_manca := null;
  if v_ese then
    v_ris   := voce_risolvi_dati(v_a.tipo, v_dati);
    v_dati  := v_ris->'dati';
    v_manca := nullif(v_ris->>'manca', '');
  end if;

  update azioni_dettate
     set dati   = v_dati,
         sicuro = (v_manca is null),
         motivo = v_manca,
         errore = null,
         stato  = 'in_attesa'
   where id = p_id;

  return jsonb_build_object('manca', v_manca, 'dati', v_dati);
end $function$;

-- ---------------------------------------------------------------------
-- 8 · Chi puo' chiamarle
-- ---------------------------------------------------------------------
revoke all on function destinazione_vocale(text, text)        from public, anon, authenticated;
revoke all on function chiave_gruppo_vocale(text, boolean, jsonb) from public, anon, authenticated;
revoke all on function appunto_per(text, text, jsonb)         from public, anon, authenticated;
revoke all on function appunti_da_approvare()                 from public, anon, authenticated;
revoke all on function approva_appunto(uuid)                  from public, anon, authenticated;
revoke all on function scarta_appunto(uuid)                   from public, anon, authenticated;
revoke all on function correggi_elemento_appunto(uuid, jsonb) from public, anon, authenticated;

-- Le tre che Alessio chiama dal gestionale passano dal corridoio col suo
-- token: il portiere `is_titolare()` sta dentro ognuna.
grant execute on function appunti_da_approvare()                 to authenticated;
grant execute on function approva_appunto(uuid)                  to authenticated;
grant execute on function scarta_appunto(uuid)                   to authenticated;
grant execute on function correggi_elemento_appunto(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 9 · Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit     uuid;
  v_det     uuid;
  v_id      uuid;
  v_libero  uuid;   -- l'appunto della destinazione che il gestionale non conosce
  v_lista   uuid;   -- l'appunto della lista della spesa
  v_cassa1  uuid;
  v_cassa2  uuid;
  v_miei    uuid[] := '{}';
  v_app     uuid[] := '{}';
  v_dett    uuid[] := '{}';
  v_ris     jsonb;
  v_n       integer;
  v_lapidi  bigint;
  v_lapidi2 bigint;
begin
  select count(*) into v_lapidi from deleted_records;

  -- (1) La porta dell'autoesecuzione non esiste piu'.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'azione_si_esegue_da_se') then
    raise exception 'VERIFICA: azione_si_esegue_da_se esiste ancora.';
  end if;

  -- (2) E nessuna funzione la nomina piu'. E' il controllo che serve davvero:
  --     Postgres non risolve le chiamate finche' non le esegue, quindi una
  --     funzione che la nominasse ancora si creerebbe senza un lamento e
  --     morirebbe alla prima dettatura.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prokind = 'f'
                and pg_get_functiondef(p.oid) like '%azione_si_esegue_da_se%') then
    raise exception 'VERIFICA: qualcuno chiama ancora azione_si_esegue_da_se.';
  end if;

  -- (3) La chiave esterna sul tipo non c'e' piu': le destinazioni sono libere.
  if exists (select 1 from pg_constraint
              where conrelid = 'public.azioni_dettate'::regclass
                and conname  = 'azioni_dettate_tipo_fkey') then
    raise exception 'VERIFICA: il tipo e'' ancora incatenato al catalogo.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- (4) Una destinazione LIBERA non viene ricondotta a niente, e si legge.
  v_ris := scrivi_dettatura(
    v_tit, 'prova migrazione: chiedi un preventivo al fabbro', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'preventivo_fabbro_prova',
      'destinazione', 'Chiedere un preventivo',
      'sicuro', true,
      'frase', 'Chiedi un preventivo al fabbro',
      'alternative', jsonb_build_array(jsonb_build_object(
        'destinazione', 'Annota in Agenda', 'perche', 'poteva essere un promemoria')),
      'dati', jsonb_build_object('chi', 'fabbro'))),
    'capita', null, 0, 0, null);
  v_det  := (v_ris->>'dettatura_id')::uuid;
  v_dett := v_dett || v_det;

  select a.id, a.appunto_id into v_id, v_libero
    from azioni_dettate a where a.dettatura_id = v_det;
  v_miei := v_miei || v_id;
  v_app  := v_app || v_libero;

  if (select tipo from azioni_dettate where id = v_id) is distinct from 'preventivo_fabbro_prova' then
    raise exception 'VERIFICA: la destinazione libera e'' stata ricondotta ad altro.';
  end if;
  if (select stato from azioni_dettate where id = v_id) is distinct from 'in_attesa' then
    raise exception 'VERIFICA: qualcosa e'' stato scritto senza approvazione.';
  end if;
  if (select eseguibile from appunti_vocali where id = v_libero) then
    raise exception 'VERIFICA: una destinazione sconosciuta risulta eseguibile.';
  end if;
  if (select titolo from appunti_vocali where id = v_libero) is distinct from 'Chiedere un preventivo' then
    raise exception 'VERIFICA: l''appunto libero non porta il nome che MEMO gli ha dato.';
  end if;
  if not exists (select 1 from appunti_da_approvare() where id = v_libero) then
    raise exception 'VERIFICA: l''appunto libero non compare nell''elenco.';
  end if;
  if jsonb_array_length((select elementi->0->'alternative' from appunti_da_approvare() where id = v_libero)) <> 1 then
    raise exception 'VERIFICA: le alternative considerate non arrivano nell''elenco.';
  end if;

  -- (5) Approvare una destinazione che non esiste viene RIFIUTATO, e il
  --     rifiuto dice cosa fare invece di essere un vicolo cieco.
  begin
    perform approva_appunto(v_libero);
    raise exception 'VERIFICA: ha approvato una destinazione che non esiste.';
  exception when others then
    if sqlerrm like 'VERIFICA:%' then raise; end if;
    if position('sappia ancora fare' in sqlerrm) = 0 then
      raise exception 'VERIFICA: il rifiuto non spiega perche'': %', sqlerrm;
    end if;
  end;

  -- (6) Tre righe della stessa lista fanno UN appunto solo, anche se dette
  --     in tre momenti diversi (tre dettature separate).
  for v_n in 1..3 loop
    v_ris := scrivi_dettatura(
      v_tit, 'prova migrazione: lista ' || v_n, 'app',
      jsonb_build_array(jsonb_build_object(
        'tipo', 'lista_spesa', 'sicuro', true,
        'frase', 'articolo di prova ' || v_n,
        'dati', jsonb_build_object('nome_libero', 'articolo di prova ' || v_n))),
      'capita', null, 0, 0, null);
    v_det  := (v_ris->>'dettatura_id')::uuid;
    v_dett := v_dett || v_det;
    select a.id, a.appunto_id into v_id, v_lista
      from azioni_dettate a where a.dettatura_id = v_det;
    v_miei := v_miei || v_id;
  end loop;
  v_app := v_app || v_lista;

  select count(distinct appunto_id) into v_n from azioni_dettate
   where id = any(v_miei) and tipo = 'lista_spesa';
  if v_n <> 1 then
    raise exception 'VERIFICA: tre righe della stessa lista hanno fatto % appunti invece di uno.', v_n;
  end if;
  if (select quanti from appunti_da_approvare() where id = v_lista) <> 3 then
    raise exception 'VERIFICA: l''appunto della lista non dichiara tre elementi.';
  end if;

  -- (7) Due movimenti di cassa restano DUE appunti: hanno dati propri.
  v_ris := scrivi_dettatura(
    v_tit, 'prova migrazione: pagamento uno', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'movimento_cassa', 'sicuro', false, 'frase', 'pagamento di prova 1',
      'dati', jsonb_build_object('verso', 'uscita', 'importo', 10))),
    'capita', null, 0, 0, null);
  v_det := (v_ris->>'dettatura_id')::uuid; v_dett := v_dett || v_det;
  select a.id, a.appunto_id into v_id, v_cassa1 from azioni_dettate a where a.dettatura_id = v_det;
  v_miei := v_miei || v_id; v_app := v_app || v_cassa1;

  v_ris := scrivi_dettatura(
    v_tit, 'prova migrazione: pagamento due', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'movimento_cassa', 'sicuro', false, 'frase', 'pagamento di prova 2',
      'dati', jsonb_build_object('verso', 'uscita', 'importo', 20))),
    'capita', null, 0, 0, null);
  v_det := (v_ris->>'dettatura_id')::uuid; v_dett := v_dett || v_det;
  select a.id, a.appunto_id into v_id, v_cassa2 from azioni_dettate a where a.dettatura_id = v_det;
  v_miei := v_miei || v_id; v_app := v_app || v_cassa2;

  if v_cassa1 = v_cassa2 then
    raise exception 'VERIFICA: due pagamenti si sono fusi nello stesso appunto.';
  end if;

  -- (8) L'incertezza si distingue dalla certezza.
  if not (select incerto from appunti_da_approvare() where id = v_cassa1) then
    raise exception 'VERIFICA: un elemento incerto non risulta incerto.';
  end if;
  if (select incerto from appunti_da_approvare() where id = v_lista) then
    raise exception 'VERIFICA: la lista, tutta sicura, risulta incerta.';
  end if;

  -- (9) Il numero in Dashboard conta gli APPUNTI, non le righe: la lista da
  --     tre elementi deve valere uno.
  select quante into v_n from voce_da_guardare();
  if v_n < 4 then
    raise exception 'VERIFICA: la Dashboard conta % appunti, e i miei da soli sono 4.', v_n;
  end if;

  -- (10) Correggere lascia l'appunto aperto e non scrive niente.
  perform correggi_elemento_appunto(
    (select id from azioni_dettate where appunto_id = v_cassa1 limit 1),
    jsonb_build_object('verso', 'uscita', 'importo', 15));
  if (select stato from appunti_vocali where id = v_cassa1) is distinct from 'aperto' then
    raise exception 'VERIFICA: correggere ha chiuso l''appunto.';
  end if;
  if (select (dati->>'importo')::numeric from azioni_dettate where appunto_id = v_cassa1 limit 1) <> 15 then
    raise exception 'VERIFICA: la correzione non e'' arrivata nei dati.';
  end if;

  -- (11) Scartare chiude senza scrivere niente.
  perform scarta_appunto(v_lista);
  if (select stato from appunti_vocali where id = v_lista) is distinct from 'scartato' then
    raise exception 'VERIFICA: scartare non ha chiuso l''appunto.';
  end if;
  if exists (select 1 from azioni_dettate where id = any(v_miei)
              and tipo = 'lista_spesa' and stato <> 'annullata') then
    raise exception 'VERIFICA: scartando, qualche riga e'' rimasta in attesa.';
  end if;

  -- --- pulizia: solo cio' che ha creato questa verifica ---------------
  delete from azioni_dettate where id = any(v_miei);
  delete from appunti_vocali where id = any(v_app);
  delete from dettature where id = any(v_dett);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro delle cancellazioni.',
      v_lapidi2 - v_lapidi;
  end if;

  raise notice 'VERIFICA superata: niente si esegue da se'', le destinazioni restano libere, la lista si raggruppa in un appunto e i pagamenti restano separati.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000001', 'gli appunti vocali si approvano') on conflict (version) do nothing;
