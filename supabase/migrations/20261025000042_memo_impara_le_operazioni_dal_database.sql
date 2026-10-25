-- ============================================================================
-- MEMO SA FARE DI PIU' — BLOCCO 1 (25/10/2026)
-- ============================================================================
-- Piano approvato da Alessio il 25/10 alle 17:22 («1 ok, 2 ok, 3 solo
-- pulsanti»): MEMO usa le STESSE operazioni dei pulsanti, l'anteprima la
-- scrive il gestionale, e parte solo dopo il si'. I gesti che non si
-- annullano — eliminare, chiudere un conto, PAGARE — restano solo sui
-- pulsanti, e qui non ce n'e' nessuno.
--
-- 🔴 IL MECCANISMO, in due colonne su `tipi_azione_vocale`:
--
--   - `istruzioni`: come MEMO deve capire quella cosa e quali dati
--     restituire. Prima ogni tipo nuovo voleva una riga scritta a mano nel
--     testo della funzione online, e un'installazione in piu'. Adesso il
--     testo arriva dal database dentro il catalogo (`voce_catalogo()`), e
--     un tipo nuovo e' una migrazione sola.
--   - `percorso`: la schermata dove si finisce a mano quella cosa. Prima
--     viveva solo dentro `azione_percorso()`; adesso la funzione guarda la
--     colonna per prima e il vecchio elenco resta come ripiego.
--
-- ⚠️ E CHIUDE UN DEBITO TROVATO SCRIVENDOLA, misurato in produzione:
--    `preparazione_da_fare` e `spesa_da_collocare` sono accesi e non hanno
--    nessuna schermata a cui mandare chi deve finirli a mano — e nemmeno i
--    due tipi dei prestiti nati stamattina (`20261025000041`). La rete
--    `tipi_vocali_senza_uscita()` esiste dal 27/08 ma la guardava solo la
--    migrazione che l'ha creata. Ora la guarda anche questa, e la pretende
--    vuota.
--
-- 🔴 LE CINQUE OPERAZIONI, tutte annullabili dal loro modulo:
--    - `prenotazione_nuova`     → Calendario (si annulla dalla scheda);
--    - `caparra_ricevuta`       → la caparra di una prenotazione che c'e'
--                                 (si toglie dalla scheda, e storna);
--    - `mancia_raccolta`        → Personale → Mance (si toglie);
--    - `nota_credito_ricevuta`  → Fatture fornitori (si rimuove);
--    - `scadenza_prevista`      → Cassa → Ce la faccio? (si chiude).
--    Fuori, dichiarati: produzione, versamento in banca e conteggio del
--    cassetto, perche' il gestionale non ha un gesto che li annulli.
--
-- ⚠️ LE DUE FUNZIONI GRANDI SI TOCCANO DAL CORPO VIVO, non ricopiandole:
--    `voce_risolvi_dati` e `fai_azione_dettata` prendono UNA riga in piu'
--    ciascuna, inserita nel testo che il database ha adesso. Ricopiarle per
--    intero da un file e' il difetto del 18/08 (si annulla in silenzio quello
--    che e' stato aggiunto dopo). Se il punto di aggancio non c'e', o c'e'
--    due volte, la migrazione si ferma.
-- ============================================================================

do $prima$
begin
  if not exists (select 1 from applied_migrations where version = '20261025000041') then
    raise exception 'Prima va applicata la 20261025000041 (i prestiti a voce): questa ci si appoggia.';
  end if;
end $prima$;

-- ---------------------------------------------------------------------------
-- 1. LE DUE COLONNE
-- ---------------------------------------------------------------------------
alter table tipi_azione_vocale add column if not exists istruzioni text;
alter table tipi_azione_vocale add column if not exists percorso text;

comment on column tipi_azione_vocale.istruzioni is
  'Come MEMO deve capire questa cosa e quali dati restituire. Arriva al modello dentro il catalogo (`voce_catalogo()`, chiave `operazioni`): un tipo nuovo non tocca piu'' la funzione online. Vuoto per i tipi piu'' vecchi, che sono ancora descritti nel testo della funzione `ascolta-voce`.';
comment on column tipi_azione_vocale.percorso is
  'La schermata dove si finisce a mano questa cosa se non si puo'' approvare. `azione_percorso()` guarda prima qui e poi il suo elenco storico.';

-- ---------------------------------------------------------------------------
-- 2. IL PERCORSO GUARDA PRIMA LA TABELLA
-- ---------------------------------------------------------------------------
-- ⚠️ Da IMMUTABLE a STABLE: legge una tabella. Il vecchio elenco resta
--    intero come ripiego, cosi' nessun tipo che oggi ha un'uscita la perde.
create or replace function public.azione_percorso(p_tipo text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(t.percorso), '') from tipi_azione_vocale t where t.tipo = p_tipo),
    case p_tipo
      when 'giacenza'        then '/magazzino/allineamento'
      when 'temperatura'     then '/haccp/temperature'
      when 'promemoria'      then '/agenda/nuovo'
      when 'pulizia'         then '/haccp/pulizia'
      when 'lista_spesa'     then '/magazzino/lista-spesa'
      when 'spesa_spicciola' then '/magazzino/spesa-spicciola'
      when 'merce_buttata'   then '/magazzino'
      when 'movimento_cassa' then '/cassa/prima-nota'
      when 'spesa_tasca'     then '/cassa/prima-nota?soggetto=tasca'
      when 'carico_merce'    then '/magazzino/carico'
      when 'prodotto_nuovo'  then '/ricettario/ingredienti/nuovo'
      when 'ricetta'         then '/ricettario/ricette/nuova'
      when 'agenda_da_segnare_fatto' then '/agenda'
      when 'agenda_da_spostare'      then '/agenda'
      when 'agenda_quale_impegno'    then '/agenda'
      when 'agenda_da_chiarire'      then '/agenda'
      -- `nota_non_capita` non ha una destinazione apposta: vuol dire «non
      -- ho capito cosa volevi», e mandare da qualche parte chi non sa dove
      -- sta andando sceglierebbe al posto suo.
      else null
    end);
$$;

-- ---------------------------------------------------------------------------
-- 3. LE CINQUE OPERAZIONI, E LE USCITE CHE MANCAVANO
-- ---------------------------------------------------------------------------
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile, percorso, istruzioni)
values
  ('prenotazione_nuova', 'creazione', 'Nuova prenotazione',
   'Una prenotazione presa al telefono o di persona. Nasce confermata, senza tavolo: il tavolo lo dai tu dalla pianta.',
   true, false, true, '/calendario-eventi/nuova',
   'vuole SEGNARE UNA PRENOTAZIONE presa adesso («prenota Rossi sabato alle nove, quattro persone», «segna un tavolo per due stasera alle 20:30 a nome Bianchi»). dati: { "nome": "il nome come l''ha detto", "data": "AAAA-MM-GG", "ora": "HH:MM", "persone": <numero>, "telefono": "solo cifre, se l''ha detto"|null, "note": "..."|null }
  ⚠️ «stasera» e «oggi» sono la serata di adesso; dopo mezzanotte «stasera» e'' ancora la sera appena iniziata. «alle nove» di sera e'' "21:00".
  ⚠️ Se manca il giorno, l''ora o il numero di persone, lascialo null: il gestionale glielo chiede. Non inventare un orario plausibile.
  ⚠️ Non e'' una caparra: se nella stessa frase dice anche che ha lasciato dei soldi, sono DUE azioni.'),
  ('caparra_ricevuta', 'creazione', 'Caparra ricevuta',
   'Soldi lasciati come caparra su una prenotazione che c''e'' gia''. Entrano in cassa o in banca con la causale di sistema.',
   true, false, true, '/calendario-eventi',
   'qualcuno ha LASCIATO UNA CAPARRA per una prenotazione («i Rossi di sabato hanno lasciato cinquanta euro di caparra in contanti»). dati: { "cliente": "il nome della prenotazione come l''ha detto", "data": "AAAA-MM-GG"|null, "importo": <numero>, "mezzo": "cassa"|"banca"|null }
  ⚠️ La prenotazione giusta la trova il gestionale dal nome e, se l''ha detto, dal giorno. Tu non scegli.
  ⚠️ "mezzo": «in contanti» → "cassa"; «bonifico», «sul conto» → "banca". Se non l''ha detto resta null.
  ⚠️ Non e'' un prestito e non e'' un movimento_cassa: la causale la mette il gestionale.'),
  ('mancia_raccolta', 'creazione', 'Mancia raccolta',
   'Le mance della serata. Non sono un ricavo: sono soldi del personale finche'' non si distribuiscono.',
   true, false, true, '/personale/mance',
   'ha RACCOLTO DELLE MANCE («stasera trenta euro di mance in contanti», «venti di mance sul pos»). dati: { "importo": <numero>, "mezzo": "contanti"|"carta"|null, "data": "AAAA-MM-GG"|null, "note": "..."|null }
  ⚠️ «sul pos», «con la carta» → "carta"; «in contanti», «nel barattolo» → "contanti". Se non l''ha detto resta null.
  ⚠️ "data" solo se ha detto un giorno diverso da adesso: altrimenti null, e il gestionale mette la serata.'),
  ('nota_credito_ricevuta', 'creazione', 'Nota di credito di un fornitore',
   'Una nota di credito arrivata da un fornitore. Se c''e'' una sua fattura da pagare, la riduce; altrimenti resta come credito.',
   true, false, true, '/fatture-fornitori',
   'e'' ARRIVATA UNA NOTA DI CREDITO da un fornitore («Mililli mi ha mandato una nota di credito di quaranta euro»). dati: { "fornitore": <numero del catalogo fornitori>|null, "importo": <numero>, "data": "AAAA-MM-GG"|null, "numero": "il numero della nota, se l''ha detto"|null, "note": "..."|null, "nome_sentito": "come ha chiamato il fornitore" }
  ⚠️ Il fornitore col NUMERO del catalogo; se non c''e'' o ce ne sono due possibili, null e "sicuro": false.
  ⚠️ Non e'' un pagamento e non e'' un movimento_cassa: nessun soldo esce.'),
  ('scadenza_prevista', 'creazione', 'Uscita prevista',
   'Una spesa che arrivera'' (affitto, rata, bolletta). Entra in «Ce la faccio?» e non tocca i saldi finche'' non la paghi.',
   true, false, true, '/cassa/previsione',
   'vuole SEGNARSI UN''USCITA CHE ARRIVERA'' («il 10 di novembre devo pagare 800 euro di affitto, ogni mese», «segna che a fine mese c''e'' la rata di 300»). dati: { "descrizione": "cos''e'', in parole sue", "importo": <numero>, "data": "AAAA-MM-GG", "ogni_mesi": <numero da 0 a 12>|null, "mezzo": "cassa"|"banca"|null }
  ⚠️ "ogni_mesi": «ogni mese» → 1, «ogni tre mesi» → 3, una volta sola → 0 o null.
  ⚠️ Non e'' un promemoria in Agenda e non e'' un pagamento: e'' una previsione di cassa. Se dice di averla GIA'' pagata, e'' un movimento_cassa.')
on conflict (tipo) do update
   set natura     = excluded.natura,
       titolo     = excluded.titolo,
       spiega     = excluded.spiega,
       attivo     = excluded.attivo,
       additivo   = excluded.additivo,
       eseguibile = excluded.eseguibile,
       percorso   = excluded.percorso,
       istruzioni = excluded.istruzioni;

-- ⚠️ Le uscite che mancavano. Solo dove la colonna e' vuota: un percorso
--    scritto dopo non si sovrascrive rilanciando.
update tipi_azione_vocale set percorso = '/cassa/prestiti'
 where tipo in ('prestito_ricevuto', 'prestito_restituito') and percorso is null;
update tipi_azione_vocale set percorso = '/magazzino/produzioni'
 where tipo = 'preparazione_da_fare' and percorso is null;
update tipi_azione_vocale set percorso = '/cassa/da-collocare'
 where tipo = 'spesa_da_collocare' and percorso is null;

-- ---------------------------------------------------------------------------
-- 4. IL CATALOGO PORTA LE ISTRUZIONI — inserite nel corpo vivo
-- ---------------------------------------------------------------------------
-- ⚠️ I CORPI VIVI POSSONO AVERE L'«A CAPO» DI WINDOWS (misurato il 25/10
--    sul progetto di prova): le migrazioni si applicano da un computer con
--    `core.autocrlf = true`, quindi il file arriva a psql con \r\n e la
--    funzione nasce con \r dentro. Un'ancora scritta con \n soli non la
--    trova, e la migrazione si ferma. Per questo i tre passi qui sotto
--    tolgono i \r dal corpo PRIMA di cercare: la funzione riscritta esce
--    con l'«a capo» di Linux, e fa esattamente le stesse cose.
do $catalogo$
declare
  v_def    text := replace(pg_get_functiondef('public.voce_catalogo()'::regprocedure), E'\r', '');
  v_ancora text := E'\n  return v_out;\nend';
  v_quante integer;
begin
  if v_def like '%''operazioni''%' then
    return;  -- gia' fatto: la migrazione si rilancia senza raddoppiare
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'voce_catalogo nel database non finisce con «return v_out;» una volta sola (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora,
    E'\n  -- 🔴 LE OPERAZIONI DESCRITTE NEL DATABASE (25/10/2026): come MEMO deve'
    || E'\n  --    capire ognuna. Solo quelle accese, e solo quelle che hanno il testo.'
    || E'\n  v_out := coalesce(v_out, ''{}''::jsonb) || jsonb_build_object(''operazioni'', coalesce(('
    || E'\n    select jsonb_agg(jsonb_build_object(''tipo'', t.tipo, ''istruzioni'', t.istruzioni) order by t.tipo)'
    || E'\n      from tipi_azione_vocale t'
    || E'\n     where t.attivo and nullif(btrim(t.istruzioni), '''') is not null), ''[]''::jsonb));'
    || v_ancora);
  execute v_def;
end $catalogo$;

-- ---------------------------------------------------------------------------
-- 5. COSA MANCA, PRIMA DEL SI'
-- ---------------------------------------------------------------------------
create or replace function memo_data(p_testo text)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_testo is null or p_testo !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_testo::date;
exception when others then
  return null;
end $$;

comment on function memo_data(text) is
  'Una data detta a MEMO, solo se e'' una data vera in forma AAAA-MM-GG. Altrimenti vuota: una data storta non diventa un errore a meta'' approvazione, diventa una domanda.';
revoke all on function memo_data(text) from public, anon, authenticated;

create or replace function voce_risolvi_operazione(p_tipo text, p_dati jsonb, p_manca text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dati    jsonb := coalesce(p_dati, '{}'::jsonb);
  v_manca   text := p_manca;
  v_testo   text;
  v_data    date;
  v_imp     numeric;
  v_n       integer;
  v_id      uuid;
  v_serata  date := serata_di_servizio(now());
  v_r       reservations%rowtype;
  v_caparra numeric;
  v_nome    text;
begin
  -- L'importo, per tutte quelle che ne hanno uno.
  if p_tipo in ('caparra_ricevuta', 'mancia_raccolta', 'nota_credito_ricevuta', 'scadenza_prevista') then
    begin
      v_imp := nullif(v_dati->>'importo', '')::numeric;
    exception when others then
      v_imp := null;
    end;
    if v_imp is null or v_imp <= 0 then
      v_manca := coalesce(v_manca, 'Non ho capito di quanti soldi si tratta.');
    end if;
  end if;

  -- Una data detta male non passa: si chiede.
  if nullif(v_dati->>'data', '') is not null and memo_data(v_dati->>'data') is null then
    v_manca := coalesce(v_manca, 'Non ho capito il giorno («' || (v_dati->>'data') || '»).');
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'prenotazione_nuova' then
    if nullif(btrim(coalesce(v_dati->>'nome', '')), '') is null then
      v_manca := coalesce(v_manca, 'Non ho capito a che nome e'' la prenotazione.');
    end if;
    v_data := memo_data(v_dati->>'data');
    if v_data is null then
      v_manca := coalesce(v_manca, 'Non ho capito per che giorno.');
    elsif v_data < v_serata then
      v_manca := coalesce(v_manca, 'Il ' || to_char(v_data, 'DD/MM/YYYY') || ' e'' gia'' passato: dimmi il giorno giusto.');
    end if;
    if coalesce(v_dati->>'ora', '') !~ '^([01]\d|2[0-3]):[0-5]\d(:\d\d)?$' then
      v_manca := coalesce(v_manca, 'Non ho capito a che ora.');
    end if;
    if coalesce(v_dati->>'persone', '') !~ '^\d+$' or (v_dati->>'persone')::integer <= 0 then
      v_manca := coalesce(v_manca, 'Non ho capito per quante persone.');
    end if;
    -- Il telefono si tiene solo se sono cifre: una parola sentita male non
    -- diventa un numero da chiamare.
    if nullif(v_dati->>'telefono', '') is not null
       and regexp_replace(v_dati->>'telefono', '[\s.+-]', '', 'g') !~ '^\d{6,15}$' then
      v_dati := v_dati - 'telefono'
        || jsonb_build_object('telefono_non_capito', v_dati->>'telefono');
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'caparra_ricevuta' then
    v_nome := nullif(btrim(coalesce(v_dati->>'cliente', '')), '');
    v_data := memo_data(v_dati->>'data');
    if v_nome is null then
      v_manca := coalesce(v_manca, 'Non ho capito di quale prenotazione e'' la caparra.');
    else
      -- 🔴 QUALE PRENOTAZIONE: si cerca qui. Se non e'' esattamente una, non
      --    sceglie nessuno e lo dice.
      select count(*) into v_n
        from reservations r
       where r.status in ('confermata', 'richiesta_in_attesa')
         and r.reservation_date >= v_serata
         and (v_data is null or r.reservation_date = v_data)
         and lower(r.customer_name) like '%' || lower(v_nome) || '%';
      if v_n = 0 then
        v_manca := coalesce(v_manca,
          'Non trovo nessuna prenotazione da stasera in poi a nome «' || v_nome || '»'
          || case when v_data is not null then ' per il ' || to_char(v_data, 'DD/MM') else '' end
          || '. Prima va segnata la prenotazione.');
      elsif v_n > 1 then
        v_manca := coalesce(v_manca,
          'Ci sono ' || v_n || ' prenotazioni a nome «' || v_nome || '»'
          || case when v_data is null then ': dimmi anche il giorno.'
                  else ' quel giorno: la caparra registrala dalla scheda della prenotazione giusta.' end);
      else
        select r.* into v_r
          from reservations r
         where r.status in ('confermata', 'richiesta_in_attesa')
           and r.reservation_date >= v_serata
           and (v_data is null or r.reservation_date = v_data)
           and lower(r.customer_name) like '%' || lower(v_nome) || '%';
        -- L'anteprima dice QUALE prenotazione, con le parole del Calendario.
        v_dati := v_dati || jsonb_build_object(
          'prenotazione_id', v_r.id,
          'prenotazione', v_r.customer_name || ', ' || to_char(v_r.reservation_date, 'DD/MM/YYYY')
                          || ' alle ' || to_char(v_r.reservation_time, 'HH24:MI')
                          || ', ' || v_r.party_size || ' persone');
        select d.amount into v_caparra from reservation_deposits d where d.reservation_id = v_r.id;
        if coalesce(v_caparra, 0) > 0 then
          v_manca := coalesce(v_manca,
            'Questa prenotazione ha gia'' una caparra di ' || euro(v_caparra) || ': per cambiarla vai sulla sua scheda.');
        end if;
      end if;
    end if;
    if nullif(v_dati->>'mezzo', '') is null or v_dati->>'mezzo' not in ('cassa', 'banca') then
      v_manca := coalesce(v_manca, 'Non ho capito se la caparra l''hai ricevuta in contanti o in banca.');
    elsif v_dati->>'mezzo' = 'banca' and not exists (select 1 from conti_bancari where attivo) then
      v_manca := coalesce(v_manca,
        'La caparra e'' arrivata in banca, ma i Conti correnti non sono ancora stati inseriti: aggiungine uno da Cassa, poi ridimmelo.');
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'mancia_raccolta' then
    if nullif(v_dati->>'mezzo', '') is null or v_dati->>'mezzo' not in ('contanti', 'carta') then
      v_manca := coalesce(v_manca, 'Non ho capito se le mance sono in contanti o con la carta.');
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'nota_credito_ricevuta' then
    v_id := null;
    if coalesce(v_dati->>'fornitore', '') ~ '^\d+$' then
      v_id := voce_fornitore_numero((v_dati->>'fornitore')::integer);
    elsif nullif(v_dati->>'supplier_id', '') is not null then
      v_id := (v_dati->>'supplier_id')::uuid;
    end if;
    select s.name into v_nome from suppliers s where s.id = v_id;
    if v_nome is null then
      v_testo := nullif(btrim(coalesce(v_dati->>'nome_sentito', '')), '');
      v_manca := coalesce(v_manca,
        case when v_testo is null then 'Non ho capito di quale fornitore e'' la nota di credito.'
             else 'Non trovo «' || v_testo || '» fra i fornitori: se e'' nuovo, aggiungilo da Fatture fornitori e ridimmelo.' end);
      v_dati := v_dati - 'supplier_id';
    else
      v_dati := (v_dati - 'fornitore') || jsonb_build_object('supplier_id', v_id, 'fornitore_nome', v_nome);
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'scadenza_prevista' then
    if nullif(btrim(coalesce(v_dati->>'descrizione', '')), '') is null then
      v_manca := coalesce(v_manca, 'Non ho capito che uscita e''.');
    end if;
    if memo_data(v_dati->>'data') is null then
      v_manca := coalesce(v_manca, 'Non ho capito quando scade.');
    end if;
    if nullif(v_dati->>'ogni_mesi', '') is not null
       and (v_dati->>'ogni_mesi' !~ '^\d+$' or (v_dati->>'ogni_mesi')::integer > 12) then
      v_manca := coalesce(v_manca, 'Non ho capito ogni quanti mesi si ripete.');
    end if;
    -- ⚠️ Come nella schermata: se non l'ha detto, la banca. Si VEDE
    --    nell'anteprima prima del si', quindi non e' una scelta nascosta.
    if nullif(v_dati->>'mezzo', '') is null then
      v_dati := v_dati || jsonb_build_object('mezzo', 'banca');
    elsif v_dati->>'mezzo' not in ('cassa', 'banca') then
      v_manca := coalesce(v_manca, 'Non ho capito se uscira'' dalla cassa o dalla banca.');
    end if;
  end if;

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $$;

comment on function voce_risolvi_operazione(text, jsonb, text) is
  'Cosa manca alle operazioni del blocco 1 di MEMO (25/10/2026) prima del si'', e quale riga intende. La chiama solo `voce_risolvi_dati`: chiusa a tutti.';
revoke all on function voce_risolvi_operazione(text, jsonb, text) from public, anon, authenticated;

do $risolvi$
declare
  v_def    text := replace(pg_get_functiondef('public.voce_risolvi_dati(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := E'\n  return jsonb_build_object(''dati'', v_dati, ''manca'', v_manca);\nend';
  v_quante integer;
begin
  if v_def like '%voce_risolvi_operazione(%' then
    return;
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'voce_risolvi_dati nel database non ha un solo ritorno finale (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora,
    E'\n  -- 🔴 LE OPERAZIONI DEL BLOCCO 1 DI MEMO (25/10/2026): la loro regola'
    || E'\n  --    sta in una funzione a se'', qui c''e'' solo il passaggio.'
    || E'\n  if p_tipo in (''prenotazione_nuova'', ''caparra_ricevuta'', ''mancia_raccolta'','
    || E'\n                ''nota_credito_ricevuta'', ''scadenza_prevista'') then'
    || E'\n    return voce_risolvi_operazione(p_tipo, v_dati, v_manca);'
    || E'\n  end if;'
    || v_ancora);
  execute v_def;
end $risolvi$;

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. LO SCRIVE, COME I PULSANTI
-- ---------------------------------------------------------------------------
create or replace function fai_operazione_memo(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_ent   uuid;
  v_check jsonb;
begin
  -- Si ricontrolla al momento del si': fra l'anteprima e la firma il
  -- mondo puo' essere cambiato (una caparra messa intanto dalla scheda).
  v_check := voce_risolvi_operazione(p_tipo, p_dati, null);
  if v_check->>'manca' is not null then
    raise exception '%', v_check->>'manca';
  end if;
  select id into v_ent from entities where entity_type = 'srls' limit 1;

  case p_tipo
    when 'prenotazione_nuova' then
      -- Come «Nuova prenotazione» del Calendario: nasce confermata, interna,
      -- senza tavolo. Nessuna email parte (l'email segue un cambio di stato).
      insert into reservations (type, status, source, reservation_date, reservation_time,
                                party_size, customer_name, customer_phone, notes)
      values ('prenotazione', 'confermata', 'interno',
              (p_dati->>'data')::date, (p_dati->>'ora')::time, (p_dati->>'persone')::integer,
              btrim(p_dati->>'nome'),
              nullif(regexp_replace(coalesce(p_dati->>'telefono', ''), '[\s.+-]', '', 'g'), ''),
              coalesce(nullif(btrim(coalesce(p_dati->>'note', '')), ''), 'Segnata a voce'))
      returning id into v_id;
      return jsonb_build_object('reservation_id', v_id);

    when 'caparra_ricevuta' then
      return registra_caparra((v_check->'dati'->>'prenotazione_id')::uuid,
                              (p_dati->>'importo')::numeric, p_dati->>'mezzo', null);

    when 'mancia_raccolta' then
      if not (select is_titolare()) then
        raise exception 'Le mance le registra il titolare.';
      end if;
      insert into tips_collected (entity_id, amount, collected_date, mezzo, note)
      values (v_ent, (p_dati->>'importo')::numeric,
              coalesce(memo_data(p_dati->>'data'), serata_di_servizio(now())),
              p_dati->>'mezzo',
              coalesce(nullif(btrim(coalesce(p_dati->>'note', '')), ''), 'Registrata a voce'))
      returning id into v_id;
      return jsonb_build_object('mancia_id', v_id);

    when 'nota_credito_ricevuta' then
      -- ⚠️ La data di un documento e' quella del calendario, non la serata.
      return registra_nota_credito(v_ent, (v_check->'dati'->>'supplier_id')::uuid,
        coalesce(memo_data(p_dati->>'data'), (now() at time zone 'Europe/Rome')::date),
        (p_dati->>'importo')::numeric, null,
        nullif(btrim(coalesce(p_dati->>'numero', '')), ''),
        coalesce(nullif(btrim(coalesce(p_dati->>'note', '')), ''), 'Registrata a voce'));

    when 'scadenza_prevista' then
      if not (select is_titolare()) then
        raise exception 'Le uscite previste le segna il titolare.';
      end if;
      insert into scadenze_previste (entity_id, descrizione, importo, scade_il, ogni_mesi, mezzo, nota)
      values (v_ent, btrim(p_dati->>'descrizione'), (p_dati->>'importo')::numeric,
              (p_dati->>'data')::date, coalesce(nullif(p_dati->>'ogni_mesi', '')::integer, 0),
              v_check->'dati'->>'mezzo', 'Segnata a voce')
      returning id into v_id;
      return jsonb_build_object('scadenza_id', v_id);

    else
      raise exception 'fai_operazione_memo non conosce «%».', p_tipo;
  end case;
end $$;

comment on function fai_operazione_memo(text, jsonb) is
  'Esegue le operazioni del blocco 1 di MEMO con le stesse funzioni e le stesse righe dei pulsanti. La chiama solo `fai_azione_dettata`: chiusa a tutti.';
revoke all on function fai_operazione_memo(text, jsonb) from public, anon, authenticated;

do $fai$
declare
  v_def    text := replace(pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := E'\n    else\n      raise exception ''Questa cosa il gestionale non la sa ancora fare a voce';
  v_quante integer;
begin
  if v_def like '%fai_operazione_memo(%' then
    return;
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'fai_azione_dettata nel database non ha un solo «else» finale (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  -- ⚠️ Un «when» per tipo, e non uno solo con l'elenco: la rete
  --    `tipi_vocali_senza_ramo()` cerca «when 'tipo'» nel corpo.
  v_def := replace(v_def, v_ancora,
    E'\n    -- 🔴 LE OPERAZIONI DEL BLOCCO 1 DI MEMO (25/10/2026)'
    || E'\n    when ''prenotazione_nuova'' then return fai_operazione_memo(p_tipo, p_dati);'
    || E'\n    when ''caparra_ricevuta'' then return fai_operazione_memo(p_tipo, p_dati);'
    || E'\n    when ''mancia_raccolta'' then return fai_operazione_memo(p_tipo, p_dati);'
    || E'\n    when ''nota_credito_ricevuta'' then return fai_operazione_memo(p_tipo, p_dati);'
    || E'\n    when ''scadenza_prevista'' then return fai_operazione_memo(p_tipo, p_dati);'
    || v_ancora);
  execute v_def;
end $fai$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_r        jsonb;
  v_cat      jsonb;
  v_res      uuid;
  v_sup      uuid;
  v_n        integer;
  v_respinto boolean;
  v_domani   date := serata_di_servizio(now()) + 1;
  v_sup_n    integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- Le porte restano chiuse.
  if has_function_privilege('authenticated', 'fai_operazione_memo(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'voce_risolvi_operazione(text, jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'fai_azione_dettata(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'voce_risolvi_dati(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'fai_operazione_memo(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'voce_risolvi_operazione(text, jsonb, text)', 'execute')
     or has_function_privilege('anon', 'memo_data(text)', 'execute') then
    raise exception 'VERIFICA: una porta delle operazioni di MEMO e'' aperta a chi non deve.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 0. Le reti: nessun tipo acceso senza ramo, e nessuno senza uscita.
    if exists (select 1 from tipi_vocali_senza_ramo()) then
      raise exception 'VERIFICA: tipi accesi senza ramo: %.', (select string_agg(tipo, ', ') from tipi_vocali_senza_ramo());
    end if;
    if exists (select 1 from tipi_vocali_senza_uscita()) then
      raise exception 'VERIFICA: tipi accesi senza uscita a mano: %.', (select string_agg(tipo, ', ') from tipi_vocali_senza_uscita());
    end if;
    -- E il vecchio elenco non ha perso nessuno.
    if azione_percorso('spesa_tasca') is distinct from '/cassa/prima-nota?soggetto=tasca'
       or azione_percorso('nota_non_capita') is not null
       or azione_percorso('prestito_ricevuto') is distinct from '/cassa/prestiti' then
      raise exception 'VERIFICA: azione_percorso non risponde come prima.';
    end if;

    -- 1. Il catalogo porta le cinque istruzioni.
    v_cat := voce_catalogo();
    select count(*) into v_n from jsonb_array_elements(v_cat->'operazioni') e
     where e->>'tipo' in ('prenotazione_nuova', 'caparra_ricevuta', 'mancia_raccolta',
                          'nota_credito_ricevuta', 'scadenza_prevista')
       and length(e->>'istruzioni') > 50;
    if v_n <> 5 then
      raise exception 'VERIFICA: il catalogo porta % istruzioni su 5.', v_n;
    end if;

    -- 2. Prenotazione: completa passa, incompleta chiede, passata rifiuta.
    v_r := voce_risolvi_dati('prenotazione_nuova', jsonb_build_object(
      'nome', 'ZZ Rossi verifica', 'data', v_domani, 'ora', '21:00', 'persone', 4));
    if v_r->>'manca' is not null then
      raise exception 'VERIFICA: una prenotazione completa risulta incompleta (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('prenotazione_nuova', jsonb_build_object(
      'nome', 'ZZ Rossi verifica', 'data', v_domani, 'persone', 4));
    if coalesce(v_r->>'manca', '') not like '%che ora%' then
      raise exception 'VERIFICA: una prenotazione senza ora non la chiede (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('prenotazione_nuova', jsonb_build_object(
      'nome', 'ZZ Rossi verifica', 'data', v_domani - 10, 'ora', '21:00', 'persone', 4));
    if coalesce(v_r->>'manca', '') not like '%gia'' passato%' then
      raise exception 'VERIFICA: una prenotazione nel passato passa (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('prenotazione_nuova', jsonb_build_object(
      'nome', 'ZZ Rossi verifica', 'data', '2026-02-31', 'ora', '21:00', 'persone', 4));
    if coalesce(v_r->>'manca', '') not like '%il giorno%' then
      raise exception 'VERIFICA: una data impossibile passa (%).', v_r->>'manca';
    end if;
    v_r := fai_azione_dettata('prenotazione_nuova', jsonb_build_object(
      'nome', 'ZZ Rossi verifica', 'data', v_domani, 'ora', '21:00', 'persone', 4, 'telefono', '333 123 4567'));
    v_res := (v_r->>'reservation_id')::uuid;
    if not exists (select 1 from reservations
                    where id = v_res and status = 'confermata' and source = 'interno'
                      and reservation_date = v_domani and reservation_time = '21:00'
                      and party_size = 4 and customer_phone = '3331234567') then
      raise exception 'VERIFICA: la prenotazione dettata non e'' quella attesa.';
    end if;

    -- 3. Caparra: trova QUELLA prenotazione, chiede il mezzo, poi scrive.
    v_r := voce_risolvi_dati('caparra_ricevuta', jsonb_build_object(
      'cliente', 'zz rossi', 'importo', 50));
    if coalesce(v_r->>'manca', '') not like '%contanti o in banca%'
       or (v_r->'dati'->>'prenotazione_id')::uuid is distinct from v_res then
      raise exception 'VERIFICA: la caparra non trova la prenotazione o non chiede il mezzo (%).', v_r;
    end if;
    v_r := fai_azione_dettata('caparra_ricevuta', jsonb_build_object(
      'cliente', 'zz rossi', 'importo', 50, 'mezzo', 'cassa'));
    if (select amount from reservation_deposits where reservation_id = v_res) is distinct from 50.00 then
      raise exception 'VERIFICA: la caparra dettata non e'' sulla prenotazione (%).', v_r;
    end if;
    -- Una seconda caparra sulla stessa si ferma.
    v_r := voce_risolvi_dati('caparra_ricevuta', jsonb_build_object(
      'cliente', 'zz rossi', 'importo', 20, 'mezzo', 'cassa'));
    if coalesce(v_r->>'manca', '') not like '%ha gia'' una caparra%' then
      raise exception 'VERIFICA: una seconda caparra non si ferma (%).', v_r->>'manca';
    end if;
    -- Due prenotazioni con lo stesso nome: non sceglie.
    perform fai_azione_dettata('prenotazione_nuova', jsonb_build_object(
      'nome', 'ZZ Rossi verifica bis', 'data', v_domani + 1, 'ora', '20:00', 'persone', 2));
    v_r := voce_risolvi_dati('caparra_ricevuta', jsonb_build_object(
      'cliente', 'zz rossi', 'importo', 20, 'mezzo', 'cassa'));
    if coalesce(v_r->>'manca', '') not like '%Ci sono 2 prenotazioni%'
       or v_r->'dati' ? 'prenotazione_id' then
      raise exception 'VERIFICA: con due prenotazioni la caparra ne ha scelta una (%).', v_r;
    end if;
    -- Nessuna: lo dice.
    v_r := voce_risolvi_dati('caparra_ricevuta', jsonb_build_object(
      'cliente', 'zz nessuno verifica', 'importo', 20, 'mezzo', 'cassa'));
    if coalesce(v_r->>'manca', '') not like '%Non trovo nessuna prenotazione%' then
      raise exception 'VERIFICA: una caparra senza prenotazione non si ferma (%).', v_r->>'manca';
    end if;

    -- 4. Mancia: senza mezzo chiede, con mezzo scrive sulla serata.
    v_r := voce_risolvi_dati('mancia_raccolta', jsonb_build_object('importo', 30));
    if coalesce(v_r->>'manca', '') not like '%contanti o con la carta%' then
      raise exception 'VERIFICA: una mancia senza mezzo non lo chiede (%).', v_r->>'manca';
    end if;
    v_r := fai_azione_dettata('mancia_raccolta', jsonb_build_object('importo', 30, 'mezzo', 'carta'));
    if not exists (select 1 from tips_collected
                    where id = (v_r->>'mancia_id')::uuid and amount = 30 and mezzo = 'carta'
                      and collected_date = serata_di_servizio(now())) then
      raise exception 'VERIFICA: la mancia dettata non e'' quella attesa.';
    end if;

    -- 5. Nota di credito: un fornitore costruito qui, cercato col suo numero.
    -- Un fornitore appartiene sempre a una societa' (entity_id e' obbligatorio):
    -- lo si mette nella S.r.l.s., la stessa su cui la voce registra la nota.
    insert into suppliers (name, entity_id)
    values ('ZZ Fornitore verifica note', (select id from entities where entity_type = 'srls' limit 1))
    returning id into v_sup;
    select (e->>'n')::integer into v_sup_n
      from jsonb_array_elements(voce_catalogo()->'fornitori') e
     where e->>'nome' = 'ZZ Fornitore verifica note';
    if v_sup_n is null then
      raise exception 'VERIFICA: il fornitore costruito non e'' nel catalogo.';
    end if;
    v_r := voce_risolvi_dati('nota_credito_ricevuta', jsonb_build_object(
      'fornitore', v_sup_n, 'importo', 40));
    if v_r->>'manca' is not null or (v_r->'dati'->>'supplier_id')::uuid is distinct from v_sup
       or v_r->'dati'->>'fornitore_nome' is distinct from 'ZZ Fornitore verifica note' then
      raise exception 'VERIFICA: la nota di credito non trova il fornitore (%).', v_r;
    end if;
    v_r := voce_risolvi_dati('nota_credito_ricevuta', jsonb_build_object(
      'importo', 40, 'nome_sentito', 'zz sconosciuto'));
    if coalesce(v_r->>'manca', '') not like '%Non trovo «zz sconosciuto»%' then
      raise exception 'VERIFICA: una nota con un fornitore sconosciuto passa (%).', v_r->>'manca';
    end if;
    perform fai_azione_dettata('nota_credito_ricevuta', jsonb_build_object(
      'fornitore', v_sup_n, 'importo', 40, 'numero', 'NC-ZZ'));
    if not exists (select 1 from note_credito where supplier_id = v_sup and importo = 40) then
      raise exception 'VERIFICA: la nota di credito dettata non c''e''.';
    end if;

    -- 6. Uscita prevista: la banca se non l'ha detto, ogni quanti mesi.
    v_r := voce_risolvi_dati('scadenza_prevista', jsonb_build_object(
      'descrizione', 'ZZ affitto verifica', 'importo', 800, 'data', v_domani, 'ogni_mesi', 1));
    if v_r->>'manca' is not null or v_r->'dati'->>'mezzo' is distinct from 'banca' then
      raise exception 'VERIFICA: un''uscita prevista completa non passa, o non dice la banca (%).', v_r;
    end if;
    v_r := fai_azione_dettata('scadenza_prevista', jsonb_build_object(
      'descrizione', 'ZZ affitto verifica', 'importo', 800, 'data', v_domani, 'ogni_mesi', 1));
    if not exists (select 1 from scadenze_previste
                    where id = (v_r->>'scadenza_id')::uuid and importo = 800 and ogni_mesi = 1
                      and mezzo = 'banca' and scade_il = v_domani) then
      raise exception 'VERIFICA: l''uscita prevista dettata non e'' quella attesa.';
    end if;
    v_r := voce_risolvi_dati('scadenza_prevista', jsonb_build_object(
      'descrizione', 'ZZ affitto verifica', 'importo', 800));
    if coalesce(v_r->>'manca', '') not like '%quando scade%' then
      raise exception 'VERIFICA: un''uscita senza data passa (%).', v_r->>'manca';
    end if;

    -- 7. Al momento del si' si ricontrolla: una caparra arrivata intanto ferma.
    v_respinto := false;
    begin
      perform fai_azione_dettata('caparra_ricevuta', jsonb_build_object(
        'cliente', 'ZZ Rossi verifica bis', 'importo', 10, 'mezzo', 'cassa'));
      perform fai_azione_dettata('caparra_ricevuta', jsonb_build_object(
        'cliente', 'ZZ Rossi verifica bis', 'importo', 10, 'mezzo', 'cassa'));
    exception when others then v_respinto := sqlerrm like '%ha gia'' una caparra%';
    end;
    if not v_respinto then
      raise exception 'VERIFICA: la seconda caparra e'' passata al momento del si''.';
    end if;

    -- 8. Il portiere: lo staff non registra mance ne' uscite previste.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform fai_azione_dettata('mancia_raccolta', jsonb_build_object('importo', 5, 'mezzo', 'contanti'));
    exception when others then v_respinto := sqlerrm like '%titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha registrato una mancia a voce.'; end if;
    v_respinto := false;
    begin
      perform fai_azione_dettata('scadenza_prevista', jsonb_build_object(
        'descrizione', 'ZZ staff', 'importo', 5, 'data', v_domani));
    exception when others then v_respinto := sqlerrm like '%titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha segnato un''uscita prevista a voce.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del blocco 1 di MEMO');

  raise notice 'Fatto: cinque operazioni nuove (prenotazione, caparra, mancia, nota di credito, uscita prevista) con anteprima, domande quando manca qualcosa, nessuna scelta fra due candidati, ricontrollo al si'' e portiere; ogni tipo acceso ha un ramo e un''uscita a mano. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000042', 'memo_impara_le_operazioni_dal_database')
on conflict (version) do nothing;
