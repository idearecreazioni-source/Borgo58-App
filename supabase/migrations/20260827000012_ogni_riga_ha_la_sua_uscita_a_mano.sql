-- ============================================================================
-- OGNI RIGA IN SOSPESO HA UNA VIA D'USCITA A MANO — 27/08/2026
-- ============================================================================
--
-- 🔴 LA DECISIONE DI ALESSIO, sue parole: *«se ti dico segna trenta euro
--    pagati al fornitore, mi aspetto che un collegamento mi porti dove si
--    segnano le spese, coi campi noti gia' compilati, e io aggiungo solo il
--    nome del fornitore che ho omesso»*.
--
-- ⚠️ IL PUNTO NON E' LA COMODITA'. Quando una riga resta in sospeso, il
--    gestionale ha GIA' CAPITO quasi tutto — l'importo, il verso, che si
--    tratta di un fornitore. Rimandare Alessio a un modulo VUOTO butta via
--    quel lavoro e glielo fa rifare a mano. Precompilare non e' un
--    servizio: e' non perdere quello che si e' gia' capito.
--
-- ----------------------------------------------------------------------------
-- 1. PERCHE' LA MAPPA STA NEL DATABASE E NON NELLA SCHERMATA
-- ----------------------------------------------------------------------------
-- Sembra roba da browser — sono indirizzi di pagine. Sta qui per due
-- ragioni, e la seconda vale piu' della prima:
--
--   (a) i `dati` di un'azione parlano il vocabolario del DATABASE
--       (`ingredient_id`, `equipment_id`, `verso`), le schermate parlano il
--       proprio. La traduzione fra i due deve avvenire in UN posto: scritta
--       nel browser sarebbe la seconda definizione di «cosa contiene questa
--       azione», e il giorno che le due divergono la schermata si riempie
--       col campo sbagliato — senza nessun errore.
--
--   (b) 🔴 SOLO DA QUI UNA VERIFICA PUO' ACCORGERSENE. `tipi_vocali_senza_uscita()`
--       e' la gemella di `tipi_vocali_senza_ramo()`, nata il 27/08 dopo che
--       QUATTRO tipi accesi erano rimasti senza esecuzione per giorni senza
--       che nessuno lo dicesse. Una mappa scritta in JavaScript non la
--       guarda nessuna migrazione: il tipo nuovo nascerebbe senza uscita, e
--       lo scoprirebbe Alessio premendo.
--
-- ----------------------------------------------------------------------------
-- 2. LO STATO NUOVO: «fatta a mano»
-- ----------------------------------------------------------------------------
-- 🔴 NON BASTAVANO I QUATTRO CHE C'ERANO, e nessuno dei due candidati
--    andava bene:
--      · `annullata` vuol dire **«ho detto di no»**. Marcare cosi' una cosa
--        che Alessio ha invece FATTO racconterebbe il contrario del vero.
--      · `eseguita` vuol dire **«l'ha fatta il gestionale»**, e porta con se'
--        un `risultato` che qui non esiste: la riga in prima nota l'ha
--        scritta la schermata, non `fai_azione_dettata`.
--    Sono due informazioni diverse, e confonderle toglie l'unica cosa che
--    fra tre mesi spiega perche' quel movimento non ha un risultato accanto.
--
-- 🔴 E IL DIFETTO CHE QUESTO STATO CHIUDE E' IL PIU' GROSSO DEL BLOCCO: se
--    la riga NON si chiudesse, resterebbe in sospeso dopo essere stata
--    fatta — e la volta dopo Alessio la ridice a voce, oppure preme «Si',
--    fallo». **La stessa spesa finisce in cassa due volte**, e non se ne
--    accorge nessuno finche' il saldo non torna. E' la stessa forma del
--    doppio invio del 27/08, spostata di un giorno.
--
-- ----------------------------------------------------------------------------
-- 3. E UNA RIGA CHIUSA A MANO NON SI PUO' PIU' ESEGUIRE
-- ----------------------------------------------------------------------------
-- ⚠️ Il rifiuto sta nel DATABASE e non nel pulsante spento: la schermata
--    che ha in mano la riga vecchia puo' essere rimasta aperta su un altro
--    dispositivo, e un pulsante spento e' spento solo dove qualcuno ha
--    ricaricato.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lo stato nuovo
-- ----------------------------------------------------------------------------

alter table azioni_dettate drop constraint if exists azione_stato_noto;
alter table azioni_dettate
  add constraint azione_stato_noto
  check (stato in ('eseguita', 'in_attesa', 'annullata', 'fallita', 'fatta_a_mano'));
comment on constraint azione_stato_noto on azioni_dettate is
  'Gli stati di un''azione dettata sono cinque. Se ne serve uno nuovo si aggiunge qui insieme a chi lo legge, altrimenti la schermata e il database si raccontano due storie diverse.';

-- ⚠️ ANCHE «fatta a mano» HA LA SUA ORA, e per la stessa ragione delle
--    eseguite: senza, una riga chiusa ieri e una chiusa un mese fa sono
--    indistinguibili, e non si puo' piu' dire quando quella spesa e' stata
--    davvero registrata.
alter table azioni_dettate drop constraint if exists azione_eseguita_ha_la_sua_ora;
alter table azioni_dettate
  add constraint azione_eseguita_ha_la_sua_ora
  check ((stato in ('eseguita', 'fatta_a_mano')) = (eseguita_il is not null));
comment on constraint azione_eseguita_ha_la_sua_ora on azioni_dettate is
  'Una cosa fatta — dal gestionale o a mano da Alessio — ha l''ora in cui e'' stata fatta, e una che aspetta non ce l''ha. Le due cose devono dire lo stesso: un''ora su un''azione in attesa farebbe credere che sia gia'' successa.';

-- ⚠️ IL COMMENTO DELLA COLONNA E' UNO DEI POSTI CHE RACCONTANO LA REGOLA,
--    e va corretto insieme al vincolo: il 27/08 una regola tolta dal
--    database era rimasta scritta in altri quattro punti, che hanno
--    continuato a raccontarla per due giorni.
comment on column azioni_dettate.stato is
  '`eseguita` (l''ha fatta il gestionale), `fatta_a_mano` (Alessio l''ha finita lui nella schermata giusta, partendo dal collegamento coi campi gia'' compilati), `in_attesa` (aspetta Alessio, e aspetta per sempre), `annullata` (Alessio ha detto di no), `fallita` (si e'' provato e il database ha rifiutato, e il motivo e'' scritto accanto).';

-- ----------------------------------------------------------------------------
-- 2. Dove si va a mano, e con che cosa gia' scritto
-- ----------------------------------------------------------------------------
-- ⚠️ I NOMI DEI CAMPI SONO QUELLI DELLA SCHERMATA, non quelli del database:
--    e' precisamente questa la traduzione che deve stare in un posto solo.
--    `ingredient_id` di qua diventa `prodotto` di la', perche' e' cosi' che
--    lo chiama chi guarda.
--
-- ⚠️ UN CAMPO CHE NON SI SA RESTA FUORI, mai riempito con un valore
--    plausibile: e' il pezzo che Alessio deve aggiungere, ed e' il motivo
--    per cui sta andando li'.

create or replace function azione_percorso(p_tipo text)
returns text
language sql
immutable
as $$
  select case p_tipo
    when 'giacenza'        then '/magazzino/allineamento'
    when 'temperatura'     then '/haccp/temperature'
    when 'promemoria'      then '/agenda/nuovo'
    when 'pulizia'         then '/haccp/pulizia'
    when 'lista_spesa'     then '/magazzino/lista-spesa'
    when 'merce_buttata'   then '/magazzino'
    when 'movimento_cassa' then '/cassa/prima-nota'
    when 'carico_merce'    then '/magazzino/carico'
    when 'prodotto_nuovo'  then '/ricettario/ingredienti/nuovo'
    when 'ricetta'         then '/ricettario/ricette/nuova'
    -- 🔴 `nota_non_capita` NON HA UNA DESTINAZIONE, e non e' una
    --    dimenticanza: vuol dire «non ho capito cosa volevi». Mandare da
    --    qualche parte chi non sa dove sta andando e' peggio che non
    --    mandarlo: sceglierebbe il gestionale al posto suo, a caso.
    else null
  end;
$$;

comment on function azione_percorso(text) is
  'Dove si va per finire a mano una cosa detta a voce. Sta nel database e non nella schermata perche'' e'' l''unico posto da cui una verifica puo'' accorgersi che un tipo nuovo e'' rimasto senza via d''uscita — vedi tipi_vocali_senza_uscita().';

create or replace function azione_campi(p_tipo text, p_dati jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case p_tipo
      when 'giacenza' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto', nullif(p_dati->>'ingredient_id', ''),
        'quanto',   nullif(p_dati->>'quanto_ce', ''),
        'note',     nullif(p_dati->>'note', '')))

      when 'temperatura' then jsonb_strip_nulls(jsonb_build_object(
        'attrezzatura', nullif(p_dati->>'equipment_id', ''),
        'gradi',        nullif(p_dati->>'gradi', ''),
        'note',         nullif(p_dati->>'note', '')))

      when 'promemoria' then jsonb_strip_nulls(jsonb_build_object(
        'titolo',      nullif(p_dati->>'titolo', ''),
        'descrizione', nullif(p_dati->>'descrizione', ''),
        'scadenza',    nullif(p_dati->>'data', ''),
        'priorita',    nullif(p_dati->>'priorita', ''),
        'categoria',   nullif(p_dati->>'categoria', '')))

      when 'pulizia' then jsonb_strip_nulls(jsonb_build_object(
        'compito', nullif(p_dati->>'task_id', ''),
        'note',    nullif(p_dati->>'note', '')))

      when 'lista_spesa' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto',  nullif(p_dati->>'ingredient_id', ''),
        'nome',      nullif(p_dati->>'nome_libero', ''),
        'quantita',  nullif(p_dati->>'quantita', ''),
        'unita',     nullif(p_dati->>'unita', ''),
        'note',      nullif(p_dati->>'note', '')))

      when 'merce_buttata' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto', nullif(p_dati->>'ingredient_id', ''),
        'quantita', nullif(p_dati->>'quantita', ''),
        -- ⚠️ Il motivo e' fissato: questo tipo di azione E' lo spreco. Non
        --    e' un valore indovinato, e' cio' che l'azione significa.
        'motivo',   'spreco',
        'note',     nullif(p_dati->>'note', '')))

      when 'movimento_cassa' then jsonb_strip_nulls(jsonb_build_object(
        'verso',       nullif(p_dati->>'verso', ''),
        'importo',     nullif(p_dati->>'importo', ''),
        'data',        nullif(p_dati->>'data', ''),
        'causale',     nullif(p_dati->>'causale_id', ''),
        'mezzo',       nullif(p_dati->>'mezzo', ''),
        -- ⚠️ Il fornitore riconosciuto arriva come FRASE e non come legame:
        --    su `cash_movements` non c'e' nessuna colonna «fornitore», ed e'
        --    la stessa scelta che fa `fai_azione_dettata`. Due posti che
        --    scrivono la stessa frase in due modi direbbero due cose.
        'descrizione', nullif(concat_ws(' · ',
          (select 'Fornitore: ' || s.name from suppliers s
            where s.id = nullif(p_dati->>'supplier_id', '')::uuid),
          nullif(p_dati->>'descrizione', '')), ''),
        'note',        nullif(p_dati->>'note', '')))

      when 'carico_merce' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto',  nullif(p_dati->>'ingredient_id', ''),
        'quantita',  nullif(p_dati->>'quantita', ''),
        'fornitore', nullif(p_dati->>'supplier_id', ''),
        'scadenza',  nullif(p_dati->>'scadenza', ''),
        'costo',     nullif(p_dati->>'costo_unitario', ''),
        'lotto',     nullif(p_dati->>'lotto', ''),
        'note',      nullif(p_dati->>'note', '')))

      when 'prodotto_nuovo' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome', ''),
        'categoria', nullif(p_dati->>'categoria', ''),
        'unita',     nullif(p_dati->>'unita', '')))

      when 'ricetta' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome', ''),
        'categoria', nullif(p_dati->>'categoria', ''),
        'porzioni',  nullif(p_dati->>'porzioni', ''),
        'note',      nullif(p_dati->>'sentito', '')))

      else null
    end, '{}'::jsonb);
$$;

comment on function azione_campi(text, jsonb) is
  'Quello che il gestionale ha gia'' capito, tradotto nel vocabolario della SCHERMATA dove si va a finirlo a mano. La traduzione sta qui e non nel browser: due posti che la fanno divergono in silenzio, e la schermata si riempirebbe col campo sbagliato senza nessun errore. Un campo che non si sa resta fuori, mai riempito con un valore plausibile.';

-- ----------------------------------------------------------------------------
-- 3. La porta: dove vado, e con che cosa
-- ----------------------------------------------------------------------------
-- 🔴 SI PASSA L'IDENTIFICATIVO, NON I CAMPI, e i campi li chiede la
--    schermata a questa funzione. Tre ragioni:
--      · l'indirizzo resta corto e non ci finiscono dentro importi e nomi
--        di fornitori — questo progetto non mette dati nelle query string;
--      · i campi arrivano dal database, quindi non c'e' modo che la
--        schermata riceva valori diversi da quelli dell'azione;
--      · l'identificativo serve comunque per chiudere la riga dopo.
--
-- ⚠️ IL PORTIERE RIFIUTA, NON FILTRA. Un `where is_titolare()` risponderebbe
--    «non c'e'» a chi non deve vedere, che si legge come una riga sparita:
--    e' il difetto trovato il 27/08 su `caparre_trattenute()`.

create or replace function azione_a_mano(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a       azioni_dettate%rowtype;
  v_testo   text;
  v_risolto jsonb;
  v_dati    jsonb;
  v_perc    text;
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  select * into v_a from azioni_dettate where id = p_id;
  if not found then
    raise exception 'Questa cosa detta non c''e'' piu''.';
  end if;

  select d.testo into v_testo from dettature d where d.id = v_a.dettatura_id;

  -- ⚠️ Si prendono i dati RISOLTI anche quando qualcosa manca: e' proprio
  --    il caso per cui esiste questa strada. Se il prodotto non e' stato
  --    riconosciuto, tutto il resto — la quantita', la nota — e' comunque
  --    gia' buono, e farglielo ridigitare sarebbe buttare via il lavoro
  --    che il gestionale ha gia' fatto.
  v_risolto := voce_risolvi_dati(v_a.tipo, v_a.dati);
  v_dati    := coalesce(v_risolto->'dati', v_a.dati);
  v_perc    := azione_percorso(v_a.tipo);

  return jsonb_build_object(
    'id',          v_a.id,
    'tipo',        v_a.tipo,
    'stato',       v_a.stato,
    'frase',       v_a.frase,
    'testo_detto', v_testo,
    'percorso',    v_perc,
    'campi',       case when v_perc is null then '{}'::jsonb
                        else azione_campi(v_a.tipo, v_dati) end,
    -- ⚠️ «Si puo' ancora finire a mano?» lo dice il database, non la
    --    schermata: una riga gia' chiusa apre un modulo precompilato che
    --    non chiudera' niente, e chi salva scrive la stessa cosa due volte.
    'da_finire',   v_a.stato in ('in_attesa', 'fallita'));
end $$;

comment on function azione_a_mano(uuid) is
  'Dove si va per finire a mano una cosa detta a voce, e con quali campi gia'' riempiti. Si passa l''identificativo e i campi arrivano da qui: cosi'' l''indirizzo non porta importi e nomi in giro, e la schermata non puo'' ricevere valori diversi da quelli dell''azione.';

revoke all on function azione_a_mano(uuid) from public, anon, authenticated;
grant execute on function azione_a_mano(uuid) to authenticated;
revoke all on function azione_percorso(text) from public, anon, authenticated;
grant execute on function azione_percorso(text) to authenticated;
revoke all on function azione_campi(text, jsonb) from public, anon, authenticated;
grant execute on function azione_campi(text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Chiudere la riga: «l'ho fatta io»
-- ----------------------------------------------------------------------------

create or replace function chiudi_azione_a_mano(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_a azioni_dettate%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' chiudere quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa detta non c''e'' piu''.';
  end if;

  if v_a.stato = 'eseguita' then
    raise exception 'Questa l''aveva gia'' fatta il gestionale: non serve rifarla a mano.';
  end if;
  if v_a.stato = 'fatta_a_mano' then
    raise exception 'Questa l''avevi gia'' finita a mano.';
  end if;
  if v_a.stato = 'annullata' then
    raise exception 'Questa l''avevi annullata. Se la vuoi, ridettala.';
  end if;

  update azioni_dettate
     set stato       = 'fatta_a_mano',
         eseguita_il = now(),
         errore      = null,
         motivo      = 'L''hai finita tu a mano.'
   where id = p_id;

  return jsonb_build_object('frase', v_a.frase);
end $$;

comment on function chiudi_azione_a_mano(uuid) is
  'Alessio ha finito a mano una cosa che aveva detto: la riga smette di aspettare. Senza questo passaggio la riga resterebbe in sospeso DOPO essere stata fatta, e la volta dopo verrebbe ridetta o riconfermata — cioe'' la stessa spesa registrata due volte.';

revoke all on function chiudi_azione_a_mano(uuid) from public, anon, authenticated;
grant execute on function chiudi_azione_a_mano(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Una riga chiusa a mano non si esegue piu'
-- ----------------------------------------------------------------------------
-- ⚠️ CORPO PRESO DAL DATABASE (`npm run funzione:viva`), non dal file che
--    l'aveva creata: fra i due ci stanno tutte le migrazioni che l'hanno
--    toccata. Qui cambia SOLO il rifiuto nuovo.

create or replace function esegui_azione_dettata(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_a      azioni_dettate%rowtype;
  v_ris    jsonb;
  v_risolto jsonb;
  v_dati   jsonb;
  v_manca  text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' confermare quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa da confermare non c''e'' piu''.';
  end if;
  if v_a.stato = 'eseguita' then
    raise exception 'Questa era gia'' stata fatta.';
  end if;
  -- 🔴 IL RIFIUTO CHE IMPEDISCE LA DOPPIA SCRITTURA. Se questa riga si
  --    potesse ancora eseguire dopo essere stata finita a mano, la stessa
  --    spesa entrerebbe in cassa due volte — una scritta da Alessio nella
  --    schermata, una dal gestionale qui — e non se ne accorgerebbe
  --    nessuno finche' il saldo non torna.
  if v_a.stato = 'fatta_a_mano' then
    raise exception 'Questa l''avevi gia'' finita a mano: farla di nuovo la scriverebbe due volte.';
  end if;
  if v_a.stato = 'annullata' then
    raise exception 'Questa l''avevi annullata. Se la vuoi, ridettala.';
  end if;

  v_risolto := voce_risolvi_dati(v_a.tipo, v_a.dati);
  v_dati    := v_risolto->'dati';
  v_manca   := nullif(v_risolto->>'manca', '');
  if v_manca is not null then
    raise exception '%', v_manca;
  end if;

  v_ris := fai_azione_dettata(v_a.tipo, v_dati);

  update azioni_dettate
     set stato = 'eseguita', eseguita_il = now(), dati = v_dati,
         risultato = v_ris, errore = null, motivo = null
   where id = p_id;

  return jsonb_build_object('frase', v_a.frase, 'risultato', v_ris);
end $funzione$;

revoke all on function esegui_azione_dettata(uuid) from public, anon, authenticated;
grant execute on function esegui_azione_dettata(uuid) to authenticated;

-- ⚠️ E NON SI ANNULLA PIU', per la stessa ragione per cui non si annulla
--    una eseguita: l'effetto c'e' gia', e farlo sparire da qui lascerebbe
--    in piedi il movimento togliendo l'unica cosa che lo spiega.
create or replace function annulla_azione_dettata(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare v_a azioni_dettate%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' annullare quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa non c''e'' piu''.';
  end if;
  if v_a.stato = 'eseguita' then
    raise exception 'Questa e'' gia'' stata fatta: per disfarla si passa dal modulo dove e'' finita — % .', v_a.frase;
  end if;
  if v_a.stato = 'fatta_a_mano' then
    raise exception 'Questa l''hai gia'' finita tu a mano: per disfarla si passa dal modulo dove l''hai scritta — % .', v_a.frase;
  end if;

  update azioni_dettate set stato = 'annullata', motivo = 'Annullata da Alessio' where id = p_id;
  return jsonb_build_object('frase', v_a.frase);
end $funzione$;

revoke all on function annulla_azione_dettata(uuid) from public, anon, authenticated;
grant execute on function annulla_azione_dettata(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. LA RETE — un tipo acceso senza via d'uscita a mano
-- ----------------------------------------------------------------------------
-- ⚠️ Gemella di `tipi_vocali_senza_ramo()`, e nata dalla stessa lezione: il
--    27/08 quattro tipi accesi erano rimasti SENZA ESECUZIONE, e a
--    scoprirlo e' stato Alessio premendo un pulsante. Un elenco scritto a
--    mano sarebbe gia' scaduto al tipo successivo.
--
-- ⚠️ `nota_non_capita` e' esente e la ragione e' scritta nella funzione
--    stessa: non ha una destinazione perche' non si sa cosa volesse.

create or replace function tipi_vocali_senza_uscita()
returns table (tipo text, natura text, titolo text)
language sql
stable
security definer
set search_path = public
as $$
  select t.tipo, t.natura, t.titolo
    from tipi_azione_vocale t
   where t.attivo
     and t.tipo <> 'nota_non_capita'
     and azione_percorso(t.tipo) is null;
$$;

comment on function tipi_vocali_senza_uscita() is
  'I tipi di azione vocale accesi che non hanno una schermata dove finirli a mano. Dovrebbe essere sempre vuoto: una riga qui vuol dire che qualcuno ha acceso un tipo nuovo e chi lo detta si trova davanti a un vicolo cieco. `nota_non_capita` e'' fuori apposta — non ha una destinazione perche'' non si sa cosa volesse.';

revoke all on function tipi_vocali_senza_uscita() from public, anon, authenticated;
grant execute on function tipi_vocali_senza_uscita() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_az     uuid;
  v_miei   uuid[] := '{}';
  v_lapidi bigint;
  v_dopo   bigint;
  v_ris    jsonb;
  v_n      integer;
  v_stato  text;
  v_ok     boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: non c''e'' nessun titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- ------------------------------------------------------------------
  -- 1. Ogni tipo acceso ha la sua via d'uscita
  -- ------------------------------------------------------------------
  select count(*) into v_n from tipi_vocali_senza_uscita();
  if v_n > 0 then
    raise exception 'Ci sono % tipi di azione vocale senza una schermata dove finirli a mano: %',
      v_n, (select string_agg(tipo, ', ') from tipi_vocali_senza_uscita());
  end if;

  -- ⚠️ E la rete deve DISCRIMINARE, non limitarsi a rispondere zero: un
  --    tipo finto senza percorso deve farla parlare. E' la lezione del
  --    26/08 — un guardiano che risponde zero al primo colpo non ha
  --    ancora detto niente.
  insert into tipi_azione_vocale (tipo, natura, titolo, spiega)
  values ('_prova_senza_uscita', 'misura', 'Prova', 'Riga di verifica, tolta subito.');
  select count(*) into v_n from tipi_vocali_senza_uscita();
  if v_n <> 1 then
    raise exception 'La rete delle uscite non discrimina: con un tipo senza percorso ha detto %.', v_n;
  end if;
  delete from tipi_azione_vocale where tipo = '_prova_senza_uscita';

  -- ------------------------------------------------------------------
  -- 2. I campi arrivano tradotti, e quello che manca resta fuori
  -- ------------------------------------------------------------------
  -- ⚠️ E' il caso di Alessio parola per parola: «segna trenta euro pagati
  --    al fornitore» — importo e verso ci sono, il fornitore no.
  insert into dettature (testo, provenienza, esito)
  values ('ho pagato trenta euro al fornitore', 'app', 'capita')
  returning id into v_det;
  v_miei := v_miei || v_det;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'movimento_cassa',
          jsonb_build_object('verso', 'uscita', 'importo', '30', 'mezzo', 'cassa'),
          true, 'Uscita di 30,00 euro dalla cassa', 'Questa la guardi sempre tu.', 'in_attesa')
  returning id into v_az;

  v_ris := azione_a_mano(v_az);

  if v_ris->>'percorso' <> '/cassa/prima-nota' then
    raise exception 'L''uscita a mano di un movimento porta a «%» invece che alla prima nota.', v_ris->>'percorso';
  end if;
  if v_ris->'campi'->>'importo' <> '30' or v_ris->'campi'->>'verso' <> 'uscita' then
    raise exception 'I campi gia'' capiti non sono arrivati: %', v_ris->'campi';
  end if;
  -- 🔴 Quello che NON si sa deve restare VUOTO, non riempito con un valore
  --    plausibile: e' il pezzo che Alessio va ad aggiungere.
  if v_ris->'campi' ? 'causale' then
    raise exception 'La causale non era stata detta e il gestionale l''ha inventata: %', v_ris->'campi';
  end if;
  if v_ris->'campi' ? 'descrizione' then
    raise exception 'Il fornitore non era stato detto e il gestionale l''ha inventato: %', v_ris->'campi';
  end if;
  if (v_ris->>'da_finire')::boolean is not true then
    raise exception 'Una riga in attesa dovrebbe potersi finire a mano, e il database dice di no.';
  end if;

  -- ------------------------------------------------------------------
  -- 3. Chiudere a mano: la riga smette di aspettare
  -- ------------------------------------------------------------------
  select count(*) into v_n from azioni_dettate a where a.id = v_az and a.stato = 'in_attesa';
  if v_n <> 1 then
    raise exception 'La riga di prova non e'' in attesa come dovrebbe.';
  end if;

  perform chiudi_azione_a_mano(v_az);

  select stato into v_stato from azioni_dettate where id = v_az;
  if v_stato <> 'fatta_a_mano' then
    raise exception 'Dopo averla finita a mano lo stato e'' «%» invece di «fatta_a_mano».', v_stato;
  end if;
  select count(*) into v_n from azioni_dettate a where a.id = v_az and a.eseguita_il is not null;
  if v_n <> 1 then
    raise exception 'Una cosa finita a mano deve avere l''ora in cui e'' stata finita.';
  end if;

  -- 🔴 IL CONTATORE NON LA CONTA PIU'. Se la contasse, la Dashboard
  --    continuerebbe a dire «una cosa aspetta» su una cosa gia' fatta, e
  --    Alessio andrebbe a rifarla.
  if exists (select 1 from azioni_dettate a
              where a.id = v_az and a.stato in ('in_attesa', 'fallita')) then
    raise exception 'Una riga finita a mano risulta ancora fra quelle che aspettano.';
  end if;
  if exists (select 1 from azioni_dettate_in_attesa() z where z.id = v_az) then
    raise exception 'Una riga finita a mano compare ancora nell''elenco delle cose in sospeso.';
  end if;

  -- ------------------------------------------------------------------
  -- 4. 🔴 E NON SI PUO' PIU' ESEGUIRE — il difetto peggiore del blocco
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    perform esegui_azione_dettata(v_az);
  exception when others then
    v_ok := true;
    if position('due volte' in sqlerrm) = 0 then
      raise exception 'Il rifiuto c''e'' ma non spiega il rischio: «%»', sqlerrm;
    end if;
  end;
  if not v_ok then
    raise exception 'Una riga finita a mano si e'' potuta eseguire di nuovo: la stessa spesa sarebbe entrata in cassa DUE VOLTE.';
  end if;

  -- E nemmeno annullare, ne' richiuderla una seconda volta.
  v_ok := false;
  begin
    perform annulla_azione_dettata(v_az);
  exception when others then v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una riga finita a mano si e'' potuta annullare: l''effetto resterebbe senza niente che lo spieghi.';
  end if;

  v_ok := false;
  begin
    perform chiudi_azione_a_mano(v_az);
  exception when others then v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una riga finita a mano si e'' potuta richiudere una seconda volta.';
  end if;

  -- ------------------------------------------------------------------
  -- 5. La nota non capita non manda da nessuna parte
  -- ------------------------------------------------------------------
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 2, 'nota_non_capita',
          jsonb_build_object('sentito', 'una cosa che non si capisce'),
          false, 'Da riguardare: una cosa detta a voce', 'Non ho capito.', 'in_attesa')
  returning id into v_az;

  v_ris := azione_a_mano(v_az);
  if v_ris->>'percorso' is not null then
    raise exception 'Una nota non capita manda a «%»: ma non si sa cosa volesse.', v_ris->>'percorso';
  end if;

  -- ------------------------------------------------------------------
  -- 6. Pulizia — solo le righe che questa verifica ha creato
  -- ------------------------------------------------------------------
  -- ⚠️ In un ARRAY e non in una variabile riusata: il 26/08 una variabile
  --    riusata tre volte ha lasciato una riga di prova in produzione.
  delete from azioni_dettate where dettatura_id = any(v_miei);
  delete from dettature where id = any(v_miei);

  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_lapidi then
    raise exception 'La verifica ha lasciato % tracce nel registro delle cancellazioni.', v_dopo - v_lapidi;
  end if;

  select count(*) into v_n from tipi_azione_vocale where tipo = '_prova_senza_uscita';
  if v_n <> 0 then
    raise exception 'La verifica ha lasciato il tipo di prova nel catalogo.';
  end if;

  raise notice 'Uscita a mano: 10 tipi su 11 hanno la loro schermata, la nota non capita no (voluto). Riga chiusa a mano: non si esegue, non si annulla, non si richiude.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000012', 'ogni_riga_ha_la_sua_uscita_a_mano') on conflict (version) do nothing;
