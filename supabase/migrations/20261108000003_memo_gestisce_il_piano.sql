-- =====================================================================
-- MEMO GESTISCE IL PIANO DELL'INVESTIMENTO — 08/11/2026 (PR8a, aggiunta D)
-- =====================================================================
--
-- Dal piano del 07/11, aggiunta D voluta da Alessio: MEMO deve poter
-- lavorare sul piano dell'investimento come lavora sul resto, cioè
-- PROPONENDO e aspettando il sì. Tre cose nuove, dette a voce o scritte:
--
--   · `piano_collega`        una spesa del progetto va su una voce
--                            («i 1.200 del falegname mettili sugli arredi»);
--   · `piano_voce_aggiorna`  una voce cambia stato, previsto o nota
--                            («il forno adesso è confermato a 9.800»);
--   · `piano_voce_nuova`     una voce che nel piano non c'era.
--
-- Come le cinque operazioni del 25/10 (20261025000042), da cui questa
-- copia la forma:
--   · le istruzioni per il modello stanno in `tipi_azione_vocale`, e
--     arrivano a `ascolta-voce` dal catalogo: la funzione online non cambia;
--   · il catalogo porta, NUMERATE come il resto, le voci del piano e le
--     spese del progetto ancora da assegnare: il modello abbina col numero,
--     mai col nome, e il numero diventa l'id qui dentro;
--   · cosa manca si dice PRIMA del sì (`voce_risolvi_piano`), e si
--     ricontrolla AL sì (`fai_piano_memo`);
--   · il collegamento passa da `segna_investimento`, la stessa porta della
--     spunta in Prima nota, Anticipi e Fatture: stesse regole, stesso resto
--     non assegnato, stessi rifiuti.
--   · con un dubbio il modello mette "sicuro": false e le alternative (il
--     prompt di `ascolta-voce` lo prevede già per ogni tipo).
--
-- ⚠️ Funzioni NUOVE e separate da quelle del 25/10: `voce_risolvi_operazione`
--    e `fai_operazione_memo` non si riscrivono. Si aggiunge un passaggio nei
--    corpi vivi di `voce_risolvi_dati` e `fai_azione_dettata`, con le stesse
--    ancore della 0042 (che restano una sola volta ciascuna).
--
-- rete-portieri: 20261108000003 chiama fai_piano_memo — il nome sta solo nel testo dei rami incollati nel corpo di fai_azione_dettata ed eseguito come definizione; le chiamate vere sono nella verifica, con i claims del titolare
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. I TRE TIPI, CON LE ISTRUZIONI PER IL MODELLO
-- ---------------------------------------------------------------------------
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile, percorso, istruzioni)
values
  ('piano_collega', 'creazione', 'Spesa sul piano dell''investimento',
   'Una spesa del progetto già segnata «investimento» va su una voce del piano. Si collega tutto quello che non è ancora assegnato.',
   true, false, true, '/cassa/costo-progetto/piano',
   'vuole METTERE UNA SPESA DEL PROGETTO SU UNA VOCE DEL PIANO DELL''INVESTIMENTO («i 1200 del falegname mettili sugli arredi», «la spesa del notaio va sulla costituzione della società»). dati: { "spesa": <numero del catalogo spese_piano>|null, "voce": <numero del catalogo voci_piano>|null, "nome_sentito": "come ha chiamato la spesa o la voce" }
  ⚠️ Spesa e voce col NUMERO dei loro cataloghi. Se due voci o due spese potrebbero andare bene, metti null, "sicuro": false e nelle "alternative" scrivi quali.
  ⚠️ Si collega tutto il resto non ancora assegnato della spesa: non c''è un importo da dire.
  ⚠️ Non è un pagamento e non è un movimento_cassa: la spesa c''è già, si dice solo a quale voce va.'),
  ('piano_voce_aggiorna', 'creazione', 'Voce del piano aggiornata',
   'Una voce del piano dell''investimento cambia stato (stimato, preventivato, confermato), previsto IVA inclusa o nota.',
   true, false, true, '/cassa/costo-progetto/piano',
   'vuole AGGIORNARE UNA VOCE DEL PIANO DELL''INVESTIMENTO («il forno adesso è confermato a 9.800», «la voce arredi passala a preventivato», «sulla cappa scrivi che il preventivo è di Rossi»). dati: { "voce": <numero del catalogo voci_piano>|null, "stato": "stimato"|"preventivato"|"confermato"|null, "importo": <nuovo previsto IVA inclusa>|null, "nota": "..."|null, "nome_sentito": "come ha chiamato la voce" }
  ⚠️ Solo quello che ha detto: quello che non cambia resta null.
  ⚠️ «ho il preventivo» → "preventivato"; «è confermato», «ho firmato», «ho ordinato» → "confermato".
  ⚠️ Se non è chiaro quale voce, null, "sicuro": false e le alternative.'),
  ('piano_voce_nuova', 'creazione', 'Voce nuova nel piano',
   'Una voce che nel piano dell''investimento non c''era. Nasce stimata se non dici altro.',
   true, false, true, '/cassa/costo-progetto/piano',
   'vuole AGGIUNGERE UNA VOCE AL PIANO DELL''INVESTIMENTO («aggiungi al piano l''insegna, 1.500 euro», «metti nel piano anche il sito internet, 800 più IVA»). dati: { "gruppo": "A"|"B"|"C"|"D"|"E"|null, "descrizione": "cos''è", "importo": <previsto IVA inclusa>, "aliquota_iva": 0|4|5|10|22|null, "stato": "stimato"|"preventivato"|"confermato"|null }
  ⚠️ I gruppi: A attrezzature cucina; B impianti; C lavori edili e adeguamenti; D arredi e allestimento; E avvio attività e spese tecniche. Se non è chiaro, null.
  ⚠️ L''importo è IVA INCLUSA: «800 più IVA» al 22% → 976. Se l''aliquota non l''ha detta, null (il gestionale mette 22).
  ⚠️ Se nel catalogo voci_piano c''è già una voce uguale, non è una voce nuova: è piano_voce_aggiorna o piano_collega.')
on conflict (tipo) do update
   set natura     = excluded.natura,
       titolo     = excluded.titolo,
       spiega     = excluded.spiega,
       attivo     = excluded.attivo,
       additivo   = excluded.additivo,
       eseguibile = excluded.eseguibile,
       percorso   = excluded.percorso,
       istruzioni = excluded.istruzioni;

-- ---------------------------------------------------------------------------
-- 2. I DUE ELENCHI NUMERATI, LETTI DA UNA FUNZIONE SOLA
-- ---------------------------------------------------------------------------
-- ⚠️ Il numero deve voler dire la stessa riga nel catalogo e qui dentro:
--    per questo l'ordine sta in UNA funzione, usata da tutti e due.
create or replace function piano_per_memo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Il piano dell''investimento è riservato al titolare.';
  end if;
  return jsonb_build_object(
    'voci_piano', coalesce((
      select jsonb_agg(jsonb_build_object(
               'n', r.n, 'id', r.id, 'gruppo', r.gruppo, 'descrizione', r.descrizione,
               'previsto', r.importo_ivato, 'stato', r.stato) order by r.n)
        from (select row_number() over (order by v.gruppo, v.ordine, v.descrizione, v.id) as n, v.*
                from piano_voci v
               where v.archiviata_il is null) r), '[]'::jsonb),
    -- Le spese del progetto con un resto da assegnare: le 40 più recenti.
    'spese_piano', coalesce((
      select jsonb_agg(jsonb_build_object(
               'n', r.n, 'fonte', r.fonte, 'id', r.id, 'data', r.data,
               'descrizione', r.nome, 'importo', r.importo, 'da_assegnare', r.resto) order by r.n)
        from (select row_number() over (order by s.data desc, s.fonte, s.id) as n,
                     s.fonte, s.id, s.data, s.importo, s.importo - s.assegnato as resto,
                     coalesce(nullif(btrim(s.descrizione), ''), nullif(btrim(s.fattura), ''),
                              nullif(btrim(s.causale), ''), nullif(btrim(s.nota), ''), 'spesa') as nome
                from piano_spese_del_progetto() s
               where s.importo - s.assegnato > 0
               order by s.data desc, s.fonte, s.id
               limit 40) r), '[]'::jsonb));
end $$;

comment on function piano_per_memo() is
  'Le voci del piano e le spese del progetto da assegnare, numerate, per MEMO (08/11/2026). Un ordine solo per il catalogo e per la traduzione numero → riga. Solo il titolare.';
revoke all on function piano_per_memo() from public, anon, authenticated;

do $catalogo$
declare
  v_def    text := replace(pg_get_functiondef('public.voce_catalogo()'::regprocedure), E'\r', '');
  v_ancora text := E'\n  return v_out;\nend';
  v_quante integer;
begin
  if v_def like '%piano_per_memo()%' then
    return;  -- già fatto
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'voce_catalogo nel database non finisce con «return v_out;» una volta sola (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  -- Il modello vede numero, gruppo, descrizione, previsto e stato: gli id
  -- restano qui dentro.
  v_def := replace(v_def, v_ancora,
    E'\n  -- 🔴 IL PIANO DELL''INVESTIMENTO (08/11/2026): le voci e le spese da'
    || E'\n  --    assegnare, numerate. Gli id non escono.'
    || E'\n  v_out := coalesce(v_out, ''{}''::jsonb) || jsonb_build_object('
    || E'\n    ''voci_piano'', coalesce((select jsonb_agg(e - ''id'') from jsonb_array_elements(piano_per_memo()->''voci_piano'') e), ''[]''::jsonb),'
    || E'\n    ''spese_piano'', coalesce((select jsonb_agg(e - ''id'' - ''fonte'') from jsonb_array_elements(piano_per_memo()->''spese_piano'') e), ''[]''::jsonb));'
    || v_ancora);
  execute v_def;
end $catalogo$;

-- ---------------------------------------------------------------------------
-- 3. COSA MANCA, PRIMA DEL SI'
-- ---------------------------------------------------------------------------
create or replace function voce_risolvi_piano(p_tipo text, p_dati jsonb, p_manca text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dati   jsonb := coalesce(p_dati, '{}'::jsonb);
  v_manca  text := p_manca;
  v_piano  jsonb;
  v_voce   jsonb;
  v_spesa  jsonb;
  v_imp    numeric;
  v_aliq   integer;
  v_testo  text;
  v_sentito text := nullif(btrim(coalesce(p_dati->>'nome_sentito', '')), '');
begin
  if not is_titolare() then
    return jsonb_build_object('dati', v_dati, 'manca', 'Il piano dell''investimento lo gestisce il titolare.');
  end if;
  v_piano := piano_per_memo();

  -- La voce: con l'id già tradotto (quando si ricontrolla al sì), oppure
  -- col numero del catalogo. ⚠️ L'id vince: il numero vale solo per il
  -- catalogo di quel momento, e fra la dettatura e il sì l'elenco può
  -- essere cambiato (revisione ECC dell'08/11).
  if p_tipo in ('piano_collega', 'piano_voce_aggiorna') then
    if nullif(v_dati->>'voce_id', '') is not null then
      select e into v_voce from jsonb_array_elements(v_piano->'voci_piano') e
       where e->>'id' = v_dati->>'voce_id';
    elsif coalesce(v_dati->>'voce', '') ~ '^\d{1,6}$' then
      select e into v_voce from jsonb_array_elements(v_piano->'voci_piano') e
       where (e->>'n')::integer = (v_dati->>'voce')::integer;
    end if;
    if v_voce is null then
      v_manca := coalesce(v_manca,
        case when v_sentito is null then 'Non ho capito quale voce del piano.'
             else 'Non trovo «' || v_sentito || '» fra le voci del piano: dimmi quale, oppure falla dalla pagina del piano.' end);
      v_dati := v_dati - 'voce_id';
    else
      -- L'anteprima dice QUALE voce, con le parole del piano.
      v_dati := (v_dati - 'voce') || jsonb_build_object(
        'voce_id', v_voce->>'id',
        'voce_nome', (v_voce->>'gruppo') || ' · ' || (v_voce->>'descrizione'));
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'piano_collega' then
    if nullif(v_dati->>'spesa_id', '') is not null then
      -- Al sì la spesa si cerca per id fra TUTTE quelle del progetto: se
      -- intanto è stata assegnata tutta, qui non c'è più resto e si dice.
      -- ⚠️ E solo fra quelle: un id estraneo non trova niente.
      select jsonb_build_object('fonte', s.fonte, 'id', s.id, 'data', s.data,
               'descrizione', coalesce(nullif(btrim(s.descrizione), ''), nullif(btrim(s.fattura), ''),
                                       nullif(btrim(s.causale), ''), nullif(btrim(s.nota), ''), 'spesa'),
               'importo', s.importo, 'da_assegnare', s.importo - s.assegnato)
        into v_spesa
        from piano_spese_del_progetto() s
       where s.id::text = v_dati->>'spesa_id' and s.fonte = v_dati->>'spesa_fonte';
    elsif coalesce(v_dati->>'spesa', '') ~ '^\d{1,6}$' then
      select e into v_spesa from jsonb_array_elements(v_piano->'spese_piano') e
       where (e->>'n')::integer = (v_dati->>'spesa')::integer;
    end if;
    if v_spesa is null then
      v_manca := coalesce(v_manca, 'Non ho capito quale spesa: deve essere fra quelle del progetto ancora da assegnare.');
      v_dati := v_dati - 'spesa_id' - 'spesa_fonte';
    elsif (v_spesa->>'da_assegnare')::numeric <= 0 then
      v_manca := coalesce(v_manca, 'Questa spesa è già assegnata tutta: se va spostata, fallo dalla pagina del piano.');
    else
      v_dati := (v_dati - 'spesa') || jsonb_build_object(
        'spesa_id', v_spesa->>'id',
        'spesa_fonte', v_spesa->>'fonte',
        'spesa_nome', (v_spesa->>'descrizione') || ' del ' || to_char((v_spesa->>'data')::date, 'DD/MM/YYYY'),
        'importo', (v_spesa->>'da_assegnare')::numeric);
      -- Già in parte su questa stessa voce: il collegamento è uno per voce,
      -- l'importo si cambia dalla pagina.
      if v_voce is not null and exists (
        select 1 from piano_collegamenti c
         where c.voce_id = (v_voce->>'id')::uuid
           and (c.cash_movement_id::text = v_spesa->>'id' or c.anticipazione_id::text = v_spesa->>'id')) then
        v_manca := coalesce(v_manca, 'Questa spesa è già in parte su questa voce: cambia l''importo dalla pagina del piano.');
      end if;
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'piano_voce_aggiorna' then
    if nullif(v_dati->>'stato', '') is not null and v_dati->>'stato' not in ('stimato', 'preventivato', 'confermato') then
      v_manca := coalesce(v_manca, 'Non ho capito lo stato: stimato, preventivato o confermato?');
    end if;
    if nullif(v_dati->>'importo', '') is not null then
      begin
        v_imp := (v_dati->>'importo')::numeric;
      exception when others then
        v_imp := null;
      end;
      -- ⚠️ Zero, «NaN» e numeri oltre il campo (12 cifre) sono «non capito»,
      --    non un errore tecnico al sì.
      if v_imp is null or v_imp <= 0 or v_imp = 'NaN'::numeric or v_imp >= 1e10 then
        v_manca := coalesce(v_manca, 'Non ho capito il nuovo importo.');
      end if;
    end if;
    if nullif(v_dati->>'stato', '') is null and nullif(v_dati->>'importo', '') is null
       and nullif(btrim(coalesce(v_dati->>'nota', '')), '') is null then
      v_manca := coalesce(v_manca, 'Non ho capito cosa cambia: lo stato, l''importo o la nota?');
    end if;
    if v_voce is not null then
      v_dati := v_dati || jsonb_build_object(
        'prima_stato', v_voce->>'stato',
        'prima_previsto', (v_voce->>'previsto')::numeric,
        'prima_nota', (select nota from piano_voci where id = (v_voce->>'id')::uuid));
    end if;
  end if;

  -- -------------------------------------------------------------------------
  if p_tipo = 'piano_voce_nuova' then
    if coalesce(v_dati->>'gruppo', '') not in ('A', 'B', 'C', 'D', 'E') then
      v_manca := coalesce(v_manca, 'Non ho capito in quale gruppo va: attrezzature, impianti, lavori, arredi o avvio?');
    end if;
    v_testo := nullif(btrim(coalesce(v_dati->>'descrizione', '')), '');
    if v_testo is null then
      v_manca := coalesce(v_manca, 'Non ho capito cos''è la voce nuova.');
    elsif exists (select 1 from piano_voci where archiviata_il is null and lower(btrim(descrizione)) = lower(v_testo)) then
      v_manca := coalesce(v_manca, 'Nel piano c''è già una voce «' || v_testo || '»: dimmi se va aggiornata quella.');
    end if;
    begin
      v_imp := nullif(v_dati->>'importo', '')::numeric;
    exception when others then
      v_imp := null;
    end;
    if v_imp is null or v_imp <= 0 or v_imp = 'NaN'::numeric or v_imp >= 1e10 then
      v_manca := coalesce(v_manca, 'Non ho capito quanto è previsto, IVA inclusa.');
    end if;
    if nullif(v_dati->>'aliquota_iva', '') is null then
      v_dati := v_dati || jsonb_build_object('aliquota_iva', 22);
    elsif coalesce(v_dati->>'aliquota_iva', '') !~ '^\d{1,2}$'
          or (v_dati->>'aliquota_iva')::integer not in (0, 4, 5, 10, 22) then
      v_manca := coalesce(v_manca, 'Non ho capito l''aliquota IVA: 0, 4, 5, 10 o 22?');
    end if;
    if nullif(v_dati->>'stato', '') is null then
      v_dati := v_dati || jsonb_build_object('stato', 'stimato');
    elsif v_dati->>'stato' not in ('stimato', 'preventivato', 'confermato') then
      v_manca := coalesce(v_manca, 'Non ho capito lo stato: stimato, preventivato o confermato?');
    end if;
  end if;

  return jsonb_build_object('dati', v_dati, 'manca', v_manca);
end $$;

comment on function voce_risolvi_piano(text, jsonb, text) is
  'Cosa manca alle tre operazioni del piano dell''investimento di MEMO (08/11/2026) prima del sì, e quale voce o spesa intende. La chiama solo `voce_risolvi_dati`: chiusa a tutti.';
revoke all on function voce_risolvi_piano(text, jsonb, text) from public, anon, authenticated;

do $risolvi$
declare
  v_def    text := replace(pg_get_functiondef('public.voce_risolvi_dati(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := E'\n  return jsonb_build_object(''dati'', v_dati, ''manca'', v_manca);\nend';
  v_quante integer;
begin
  if v_def like '%voce_risolvi_piano(%' then
    return;
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'voce_risolvi_dati nel database non ha un solo ritorno finale (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora,
    E'\n  -- 🔴 IL PIANO DELL''INVESTIMENTO (08/11/2026): la regola sta in una'
    || E'\n  --    funzione a sé, qui c''è solo il passaggio.'
    || E'\n  if p_tipo in (''piano_collega'', ''piano_voce_aggiorna'', ''piano_voce_nuova'') then'
    || E'\n    return voce_risolvi_piano(p_tipo, v_dati, v_manca);'
    || E'\n  end if;'
    || v_ancora);
  execute v_def;
end $risolvi$;

revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. LO SCRIVE, COME I PULSANTI
-- ---------------------------------------------------------------------------
create or replace function fai_piano_memo(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb;
  v_d     jsonb;
  v_id    uuid;
  v_ord   integer;
begin
  if not (select is_titolare()) then
    raise exception 'Il piano dell''investimento lo gestisce il titolare.';
  end if;
  -- Si ricontrolla al momento del sì: fra l'anteprima e la firma la spesa
  -- può essere stata assegnata, la voce archiviata.
  v_check := voce_risolvi_piano(p_tipo, p_dati, null);
  if v_check->>'manca' is not null then
    raise exception '%', v_check->>'manca';
  end if;
  v_d := v_check->'dati';

  case p_tipo
    when 'piano_collega' then
      -- La stessa porta della spunta: segna «investimento» (già lo è) e
      -- collega il resto non assegnato, con tutti i controlli del piano.
      -- ⚠️ `segna_investimento` è «security invoker», ma da qui gira coi
      --    permessi di questa funzione, cioè senza la RLS: la barriera è il
      --    controllo del titolare in cima, e l'id della spesa ritrovato fra
      --    quelle del progetto. Non togliere né l'uno né l'altro.
      perform segna_investimento(v_d->>'spesa_fonte', (v_d->>'spesa_id')::uuid, (v_d->>'voce_id')::uuid, null);
      return jsonb_build_object('voce_id', v_d->>'voce_id', 'spesa_id', v_d->>'spesa_id');

    when 'piano_voce_aggiorna' then
      update piano_voci
         set stato         = coalesce(nullif(v_d->>'stato', ''), stato),
             importo_ivato = coalesce(nullif(v_d->>'importo', '')::numeric, importo_ivato),
             -- Una nota nuova si aggiunge a quella che c'era, non la cancella.
             nota          = case
                               when nullif(btrim(coalesce(v_d->>'nota', '')), '') is null then nota
                               when nullif(btrim(coalesce(nota, '')), '') is null then btrim(v_d->>'nota')
                               else nota || ' · ' || btrim(v_d->>'nota')
                             end
       where id = (v_d->>'voce_id')::uuid and archiviata_il is null
      returning id into v_id;
      if v_id is null then
        raise exception 'Questa voce del piano non c''è più.';
      end if;
      return jsonb_build_object('voce_id', v_id);

    when 'piano_voce_nuova' then
      select coalesce(max(ordine), 0) + 1 into v_ord from piano_voci where gruppo = v_d->>'gruppo';
      insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato, nota)
      values (v_d->>'gruppo', v_ord, btrim(v_d->>'descrizione'), (v_d->>'importo')::numeric,
              (v_d->>'aliquota_iva')::integer, v_d->>'stato', 'Aggiunta con MEMO')
      returning id into v_id;
      return jsonb_build_object('voce_id', v_id);

    else
      raise exception 'fai_piano_memo non conosce «%».', p_tipo;
  end case;
end $$;

comment on function fai_piano_memo(text, jsonb) is
  'Esegue le tre operazioni del piano dell''investimento di MEMO (08/11/2026): il collegamento con `segna_investimento`, come la spunta. La chiama solo `fai_azione_dettata`: chiusa a tutti.';
revoke all on function fai_piano_memo(text, jsonb) from public, anon, authenticated;

do $fai$
declare
  v_def    text := replace(pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := E'\n    else\n      raise exception ''Questa cosa il gestionale non la sa ancora fare a voce';
  v_quante integer;
begin
  if v_def like '%fai_piano_memo(%' then
    return;
  end if;
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'fai_azione_dettata nel database non ha un solo «else» finale (%): guarda il corpo vivo prima di toccarla.', v_quante;
  end if;
  -- ⚠️ Un «when» per tipo: la rete `tipi_vocali_senza_ramo()` cerca «when 'tipo'».
  v_def := replace(v_def, v_ancora,
    E'\n    -- 🔴 IL PIANO DELL''INVESTIMENTO (08/11/2026)'
    || E'\n    when ''piano_collega'' then return fai_piano_memo(p_tipo, p_dati);'
    || E'\n    when ''piano_voce_aggiorna'' then return fai_piano_memo(p_tipo, p_dati);'
    || E'\n    when ''piano_voce_nuova'' then return fai_piano_memo(p_tipo, p_dati);'
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
  v_srls     uuid;
  v_cat      jsonb;
  v_r        jsonb;
  v_voce     uuid;
  v_mov      uuid;
  v_n_voce   integer;
  v_n_spesa  integer;
  v_n        integer;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_staff is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare, uno staff e Borgo 58.';
  end if;

  -- Le porte restano chiuse.
  if has_function_privilege('authenticated', 'fai_piano_memo(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'voce_risolvi_piano(text, jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'piano_per_memo()', 'execute')
     or has_function_privilege('anon', 'fai_piano_memo(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'piano_per_memo()', 'execute') then
    raise exception 'VERIFICA: una porta del piano per MEMO è aperta a chi non deve.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 0. Le reti: ogni tipo acceso ha un ramo e un'uscita.
    if exists (select 1 from tipi_vocali_senza_ramo()) then
      raise exception 'VERIFICA: tipi accesi senza ramo: %.', (select string_agg(tipo, ', ') from tipi_vocali_senza_ramo());
    end if;
    if exists (select 1 from tipi_vocali_senza_uscita()) then
      raise exception 'VERIFICA: tipi accesi senza uscita a mano: %.', (select string_agg(tipo, ', ') from tipi_vocali_senza_uscita());
    end if;

    -- Una voce e una spesa costruite qui.
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 999, 'ZZ voce verifica MEMO', 1000, 22, 'stimato')
    returning id into v_voce;
    insert into cash_movements (entity_id, direction, amount, movement_date, business_purpose, e_investimento)
    values (v_srls, 'uscita', 300, current_date, 'ZZ spesa verifica MEMO', false)
    returning id into v_mov;
    -- Segnata investimento come farebbe la spunta, ma senza voce: è una
    -- «spesa da assegnare» (le righe vecchie restano così, 20261107000003).
    update cash_movements set e_investimento = true where id = v_mov;

    -- 1. Il catalogo porta voce e spesa, numerate, senza id.
    v_cat := voce_catalogo();
    select (e->>'n')::integer into v_n_voce from jsonb_array_elements(v_cat->'voci_piano') e
     where e->>'descrizione' = 'ZZ voce verifica MEMO';
    select (e->>'n')::integer into v_n_spesa from jsonb_array_elements(v_cat->'spese_piano') e
     where e->>'descrizione' = 'ZZ spesa verifica MEMO';
    if v_n_voce is null or v_n_spesa is null then
      raise exception 'VERIFICA: il catalogo non porta la voce (%) o la spesa (%).', v_n_voce, v_n_spesa;
    end if;
    if exists (select 1 from jsonb_array_elements(v_cat->'voci_piano') e where e ? 'id')
       or exists (select 1 from jsonb_array_elements(v_cat->'spese_piano') e where e ? 'id') then
      raise exception 'VERIFICA: il catalogo fa uscire gli id del piano.';
    end if;
    select count(*) into v_n from jsonb_array_elements(v_cat->'operazioni') e
     where e->>'tipo' in ('piano_collega', 'piano_voce_aggiorna', 'piano_voce_nuova')
       and length(e->>'istruzioni') > 50;
    if v_n <> 3 then
      raise exception 'VERIFICA: il catalogo porta % istruzioni del piano su 3.', v_n;
    end if;

    -- 2. Collega: numeri tradotti, anteprima con i nomi, poi il collegamento.
    v_r := voce_risolvi_dati('piano_collega', jsonb_build_object('spesa', v_n_spesa, 'voce', v_n_voce));
    if v_r->>'manca' is not null or (v_r->'dati'->>'voce_id')::uuid is distinct from v_voce
       or (v_r->'dati'->>'spesa_id')::uuid is distinct from v_mov
       or (v_r->'dati'->>'importo')::numeric is distinct from 300 then
      raise exception 'VERIFICA: il collegamento non trova voce e spesa (%).', v_r;
    end if;
    v_r := voce_risolvi_dati('piano_collega', jsonb_build_object('spesa', v_n_spesa, 'nome_sentito', 'zz voce che non c''è'));
    if coalesce(v_r->>'manca', '') not like '%Non trovo «zz voce che non c''è»%' then
      raise exception 'VERIFICA: una voce sconosciuta passa (%).', v_r->>'manca';
    end if;
    perform fai_azione_dettata('piano_collega', jsonb_build_object('spesa', v_n_spesa, 'voce', v_n_voce));
    if not exists (select 1 from piano_collegamenti
                    where voce_id = v_voce and cash_movement_id = v_mov and importo_attribuito = 300) then
      raise exception 'VERIFICA: la spesa non è finita sulla voce.';
    end if;
    -- Al sì si ricontrolla: la stessa spesa, già tutta assegnata, si ferma.
    v_respinto := false;
    begin
      perform fai_azione_dettata('piano_collega', jsonb_build_object(
        'spesa_id', v_mov, 'spesa_fonte', 'prima_nota', 'voce_id', v_voce));
    exception when others then v_respinto := sqlerrm like '%già assegnata tutta%';
    end;
    if not v_respinto then
      raise exception 'VERIFICA: una spesa già assegnata tutta è passata al sì.';
    end if;

    -- 3. Aggiorna: solo quello che è detto.
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce', v_n_voce));
    if coalesce(v_r->>'manca', '') not like '%cosa cambia%' then
      raise exception 'VERIFICA: un aggiornamento senza niente da cambiare passa (%).', v_r->>'manca';
    end if;
    perform fai_azione_dettata('piano_voce_aggiorna', jsonb_build_object(
      'voce', v_n_voce, 'stato', 'confermato', 'importo', 1200));
    if not exists (select 1 from piano_voci where id = v_voce and stato = 'confermato'
                      and importo_ivato = 1200 and aliquota_iva = 22) then
      raise exception 'VERIFICA: la voce non è stata aggiornata come detto.';
    end if;

    -- 4. Nuova: con l'IVA di ripiego e lo stato stimato; un doppione si ferma.
    v_r := voce_risolvi_dati('piano_voce_nuova', jsonb_build_object(
      'gruppo', 'E', 'descrizione', 'ZZ insegna verifica', 'importo', 1500));
    if v_r->>'manca' is not null or (v_r->'dati'->>'aliquota_iva')::integer is distinct from 22
       or v_r->'dati'->>'stato' is distinct from 'stimato' then
      raise exception 'VERIFICA: una voce nuova completa non passa, o senza i ripieghi (%).', v_r;
    end if;
    v_r := fai_azione_dettata('piano_voce_nuova', jsonb_build_object(
      'gruppo', 'E', 'descrizione', 'ZZ insegna verifica', 'importo', 1500));
    if not exists (select 1 from piano_voci where id = (v_r->>'voce_id')::uuid and gruppo = 'E'
                      and importo_ivato = 1500 and stato = 'stimato') then
      raise exception 'VERIFICA: la voce nuova non è quella attesa.';
    end if;
    v_r := voce_risolvi_dati('piano_voce_nuova', jsonb_build_object(
      'gruppo', 'E', 'descrizione', 'zz insegna verifica', 'importo', 900));
    if coalesce(v_r->>'manca', '') not like '%c''è già una voce%' then
      raise exception 'VERIFICA: una voce doppia passa (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('piano_voce_nuova', jsonb_build_object('descrizione', 'ZZ senza gruppo', 'importo', 10));
    if coalesce(v_r->>'manca', '') not like '%quale gruppo%' then
      raise exception 'VERIFICA: una voce senza gruppo passa (%).', v_r->>'manca';
    end if;

    -- 4bis. L'id salvato vince sul numero, che nel frattempo può indicare
    --       un'altra riga (revisione ECC dell'08/11).
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object(
      'voce_id', v_voce, 'voce', 999999, 'nota', 'ZZ nota'));
    if v_r->>'manca' is not null or (v_r->'dati'->>'voce_id')::uuid is distinct from v_voce then
      raise exception 'VERIFICA: l''id salvato non ha vinto sul numero (%).', v_r;
    end if;
    -- Zero e uno stato inventato non passano.
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'importo', 0));
    if coalesce(v_r->>'manca', '') not like '%nuovo importo%' then
      raise exception 'VERIFICA: un importo zero passa (%).', v_r->>'manca';
    end if;
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'stato', 'firmato'));
    if coalesce(v_r->>'manca', '') not like '%lo stato%' then
      raise exception 'VERIFICA: uno stato inventato passa (%).', v_r->>'manca';
    end if;
    -- La nota si aggiunge, non cancella.
    perform fai_azione_dettata('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'nota', 'ZZ prima'));
    perform fai_azione_dettata('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'nota', 'ZZ seconda'));
    if (select nota from piano_voci where id = v_voce) is distinct from 'ZZ prima · ZZ seconda' then
      raise exception 'VERIFICA: la nota nuova ha cancellato la vecchia (%).', (select nota from piano_voci where id = v_voce);
    end if;
    -- Una spesa già in parte sulla stessa voce: si dice, non si raddoppia.
    insert into cash_movements (entity_id, direction, amount, movement_date, business_purpose, e_investimento)
    values (v_srls, 'uscita', 500, current_date, 'ZZ spesa divisa verifica MEMO', true)
    returning id into v_mov;
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov, 200);
    v_r := voce_risolvi_dati('piano_collega', jsonb_build_object(
      'spesa_id', v_mov, 'spesa_fonte', 'prima_nota', 'voce_id', v_voce));
    if coalesce(v_r->>'manca', '') not like '%già in parte su questa voce%' then
      raise exception 'VERIFICA: una spesa già in parte sulla voce passa (%).', v_r->>'manca';
    end if;

    -- 5. Il portiere: lo staff non tocca il piano.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform fai_azione_dettata('piano_voce_nuova', jsonb_build_object(
        'gruppo', 'E', 'descrizione', 'ZZ staff', 'importo', 5));
    exception when others then v_respinto := sqlerrm like '%titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha aggiunto una voce al piano.'; end if;
    -- E l'anteprima glielo dice, senza errori tecnici.
    v_r := voce_risolvi_dati('piano_voce_nuova', jsonb_build_object(
      'gruppo', 'E', 'descrizione', 'ZZ staff', 'importo', 5));
    if coalesce(v_r->>'manca', '') not like '%titolare%' then
      raise exception 'VERIFICA: l''anteprima dello staff non dice che è del titolare (%).', v_r->>'manca';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del piano per MEMO');

  raise notice 'Fatto: MEMO propone tre operazioni sul piano dell''investimento (collega una spesa, aggiorna una voce, crea una voce), con il catalogo numerato, le domande quando manca qualcosa, il ricontrollo al sì e il portiere. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261108000003', 'memo_gestisce_il_piano')
on conflict (version) do nothing;
