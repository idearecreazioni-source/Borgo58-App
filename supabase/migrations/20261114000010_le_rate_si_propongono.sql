-- =====================================================================
-- MEMO PROPONE LE RATE QUANDO CAMBIA IL PREVISTO — 14/11/2026
-- =====================================================================
--
-- Prima di applicare: confrontare il corpo di `voce_risolvi_piano`,
-- `fai_piano_memo` e `scrivi_dettatura` con quello vivo nel database.
-- Il primo parte dall'ultima definizione nel repository
-- (`20261108000003`, più l'avviso inserito dalla `20261111000003`); gli
-- altri due riprendono il corpo vivo e cambiano solo le ancore controllate.
--
-- Quando MEMO cambia il previsto di una voce che ha rate, non lascia più
-- il titolare a rifarle a mano: propone una seconda azione, già compilata.
-- I mesi e il numero restano gli stessi; le rate ancora intatte seguono le
-- loro proporzioni, al centesimo, e l'ultima prende il resto.
--
-- Una rata anche solo in parte coperta da un collegamento non si riscrive:
-- è la scelta prudente, perché a quel valore sono già appoggiati soldi veri.
-- Se il nuovo previsto non lascia abbastanza per quelle rate, non si
-- propone niente e l'anteprima lo dice in italiano.
--
-- rete-portieri: 20261114000010 chiama piano_rate_da_ricalcolare — la chiama qui nella verifica coi claims del titolare
-- rete-portieri: 20261114000010 chiama fai_piano_memo — il nome sta solo nel testo del ramo incollato in fai_azione_dettata ed eseguito come definizione; la chiamata vera è nella verifica coi claims del titolare
-- rete-portieri: 20261114000010 chiama voce_risolvi_piano — il nome sta solo nel testo del ramo incollato in voce_risolvi_dati ed eseguito come definizione; la chiamata vera è nella verifica coi claims del titolare
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. IL TIPO E IL CALCOLO IN UN POSTO SOLO
-- ---------------------------------------------------------------------------
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile, percorso, istruzioni)
values (
  'piano_rate_ricalcola', 'creazione', 'Rate del piano ricalcolate',
  'Le rate di una voce del piano restano negli stessi mesi e vengono ricalcolate sul previsto attuale.',
  true, false, true, '/cassa/costo-progetto/piano',
  'RICALCOLA LE RATE DI UNA VOCE DEL PIANO DELL''INVESTIMENTO solo quando la proposta arriva già compilata dal gestionale dopo un cambio di previsto. dati: { "voce": <numero del catalogo voci_piano>|null }. I mesi e il numero delle rate non cambiano mai.'
)
on conflict (tipo) do update
   set natura     = excluded.natura,
       titolo     = excluded.titolo,
       spiega     = excluded.spiega,
       attivo     = excluded.attivo,
       additivo   = excluded.additivo,
       eseguibile = excluded.eseguibile,
       percorso   = excluded.percorso,
       istruzioni = excluded.istruzioni;

create or replace function piano_rate_da_ricalcolare(p_voce_id uuid, p_previsto numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_rata          record;
  v_bloccate      numeric := 0;
  v_libere        numeric := 0;
  v_quante        integer := 0;
  v_ultima        integer := 0;
  v_viste         integer := 0;
  v_resto         numeric;
  v_gia_ripartito numeric := 0;
  v_dopo          numeric;
  v_rate          jsonb := '[]'::jsonb;
begin
  if not is_titolare() then
    raise exception 'Il piano dell''investimento lo gestisce il titolare.';
  end if;
  if p_previsto is null or p_previsto <= 0 or p_previsto = 'NaN'::numeric then
    return jsonb_build_object('possibile', false, 'motivo', 'Non ho capito il nuovo previsto delle rate.');
  end if;
  -- Piano e rate sono al centesimo: la proposta deve usare esattamente il
  -- valore che finirà nella colonna numeric(12,2), non un terzo decimale.
  p_previsto := round(p_previsto, 2);

  -- Una rata con anche un solo euro già coperto resta intera: abbassarla
  -- cambierebbe a posteriori un importo a cui è collegata una spesa vera.
  select coalesce(sum(r.importo) filter (where a.aperto < r.importo), 0),
         coalesce(sum(r.importo) filter (where a.aperto = r.importo), 0),
         count(*) filter (where a.aperto = r.importo)
    into v_bloccate, v_libere, v_quante
    from piano_rate r
    join piano_rate_aperte() a on a.rata_id = r.id
   where r.voce_id = p_voce_id;

  if v_bloccate + v_libere = 0 then
    return jsonb_build_object('possibile', false, 'motivo', 'Questa voce non ha rate da ricalcolare.');
  end if;
  if v_quante = 0 then
    return jsonb_build_object('possibile', false,
      'motivo', 'Tutte le rate di questa voce sono già pagate o in parte pagate: non le cambio.');
  end if;
  if p_previsto < v_bloccate then
    return jsonb_build_object('possibile', false,
      'motivo', 'Il nuovo previsto è più basso delle rate già pagate o in parte pagate: non posso ricalcolare le altre.');
  end if;

  v_resto := p_previsto - v_bloccate;
  if v_resto <= 0 then
    return jsonb_build_object('possibile', false,
      'motivo', 'Il nuovo previsto non lascia niente da distribuire sulle rate ancora aperte.');
  end if;

  v_ultima := v_quante;
  for v_rata in
    select r.id, r.mese_rel, r.importo, a.aperto
      from piano_rate r
      join piano_rate_aperte() a on a.rata_id = r.id
     where r.voce_id = p_voce_id
     order by r.mese_rel, r.id
  loop
    if v_rata.aperto < v_rata.importo then
      v_dopo := v_rata.importo;
    else
      v_viste := v_viste + 1;
      if v_viste = v_ultima then
        -- L'ultima prende tutti i centesimi rimasti: la somma torna sempre.
        v_dopo := v_resto - v_gia_ripartito;
      else
        v_dopo := round(v_rata.importo * v_resto / v_libere, 2);
        v_gia_ripartito := v_gia_ripartito + v_dopo;
      end if;
    end if;
    v_rate := v_rate || jsonb_build_array(jsonb_build_object(
      'rata_id', v_rata.id,
      'mese_rel', v_rata.mese_rel,
      'prima', v_rata.importo,
      'dopo', v_dopo,
      'gia_pagata', v_rata.aperto < v_rata.importo
    ));
  end loop;

  return jsonb_build_object('possibile', true, 'rate', v_rate);
end $funzione$;

comment on function piano_rate_da_ricalcolare(uuid, numeric) is
  'Le rate proposte da MEMO per una voce del piano: conserva mesi, numero e rate già coperte; ripartisce il resto in proporzione e dà all''ultima i centesimi rimasti (14/11/2026).';
revoke all on function piano_rate_da_ricalcolare(uuid, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. L'ANTEPRIMA: LA VOCE E LE RATE, SENZA L'AVVISO VECCHIO
-- ---------------------------------------------------------------------------
create or replace function voce_risolvi_piano(p_tipo text, p_dati jsonb, p_manca text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_dati    jsonb := coalesce(p_dati, '{}'::jsonb);
  v_manca   text := p_manca;
  v_piano   jsonb;
  v_voce    jsonb;
  v_spesa   jsonb;
  v_rate    jsonb;
  v_imp     numeric;
  v_aliq    integer;
  v_testo   text;
  v_sentito text := nullif(btrim(coalesce(p_dati->>'nome_sentito', '')), '');
begin
  if not is_titolare() then
    return jsonb_build_object('dati', v_dati, 'manca', 'Il piano dell''investimento lo gestisce il titolare.');
  end if;
  v_piano := piano_per_memo();

  -- L'id salvato vince sempre sul numero del catalogo, che può cambiare.
  if p_tipo in ('piano_collega', 'piano_voce_aggiorna', 'piano_rate_ricalcola') then
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
      v_dati := (v_dati - 'voce') || jsonb_build_object(
        'voce_id', v_voce->>'id',
        'voce_nome', (v_voce->>'gruppo') || ' · ' || (v_voce->>'descrizione'));
    end if;
  end if;

  if p_tipo = 'piano_collega' then
    if nullif(v_dati->>'spesa_id', '') is not null then
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
        'spesa_id', v_spesa->>'id', 'spesa_fonte', v_spesa->>'fonte',
        'spesa_nome', (v_spesa->>'descrizione') || ' del ' || to_char((v_spesa->>'data')::date, 'DD/MM/YYYY'),
        'importo', (v_spesa->>'da_assegnare')::numeric);
      if v_voce is not null and exists (
        select 1 from piano_collegamenti c
         where c.voce_id = (v_voce->>'id')::uuid
           and (c.cash_movement_id::text = v_spesa->>'id' or c.anticipazione_id::text = v_spesa->>'id')) then
        v_manca := coalesce(v_manca, 'Questa spesa è già in parte su questa voce: cambia l''importo dalla pagina del piano.');
      end if;
    end if;
  end if;

  if p_tipo = 'piano_voce_aggiorna' then
    if nullif(v_dati->>'stato', '') is not null and v_dati->>'stato' not in ('stimato', 'preventivato', 'confermato') then
      v_manca := coalesce(v_manca, 'Non ho capito lo stato: stimato, preventivato o confermato?');
    end if;
    if nullif(v_dati->>'importo', '') is not null then
      begin v_imp := (v_dati->>'importo')::numeric; exception when others then v_imp := null; end;
      if v_imp is null or v_imp <= 0 or v_imp = 'NaN'::numeric or v_imp >= 1e10 then
        v_manca := coalesce(v_manca, 'Non ho capito il nuovo importo.');
      else
        -- La colonna salva due decimali: anche l'anteprima deve parlare di
        -- quella cifra, o rate e previsto potrebbero differire di un centesimo.
        v_imp := round(v_imp, 2);
        v_dati := v_dati || jsonb_build_object('importo', v_imp);
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
      if v_imp is not null and v_imp > 0 and v_imp <> (v_voce->>'previsto')::numeric
         and exists (select 1 from piano_rate r where r.voce_id = (v_voce->>'id')::uuid) then
        v_rate := piano_rate_da_ricalcolare((v_voce->>'id')::uuid, v_imp);
        if coalesce((v_rate->>'possibile')::boolean, false) then
          v_dati := v_dati || jsonb_build_object('rate_ricalcolate', v_rate->'rate');
        else
          v_dati := v_dati || jsonb_build_object('avviso_rate', v_rate->>'motivo');
        end if;
      end if;
    end if;
  end if;

  if p_tipo = 'piano_rate_ricalcola' and v_voce is not null then
    -- Da sola la proposta usa il previsto di adesso: è il comportamento più
    -- sicuro se l'aggiornamento della voce non è stato approvato insieme.
    v_rate := piano_rate_da_ricalcolare((v_voce->>'id')::uuid, (v_voce->>'previsto')::numeric);
    if not coalesce((v_rate->>'possibile')::boolean, false) then
      v_manca := coalesce(v_manca, v_rate->>'motivo');
    else
      v_dati := jsonb_build_object(
        'voce_id', v_voce->>'id',
        'voce_nome', (v_voce->>'gruppo') || ' · ' || (v_voce->>'descrizione'),
        'prima_previsto', (v_voce->>'previsto')::numeric,
        'previsto', (v_voce->>'previsto')::numeric,
        'rate', v_rate->'rate');
    end if;
  end if;

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
    begin v_imp := nullif(v_dati->>'importo', '')::numeric; exception when others then v_imp := null; end;
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
end $funzione$;

comment on function voce_risolvi_piano(text, jsonb, text) is
  'Cosa manca alle operazioni del piano dell''investimento di MEMO prima del sì, compresa la proposta delle rate ricalcolate (14/11/2026). La chiama solo voce_risolvi_dati: chiusa a tutti.';
revoke all on function voce_risolvi_piano(text, jsonb, text) from public, anon, authenticated;

-- Il passaggio già esistente riconosce il quarto tipo senza riscrivere il
-- corpo intero che contiene tutti gli altri gesti vocali.
do $risolvi$
declare
  v_def text := replace(pg_get_functiondef('public.voce_risolvi_dati(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := 'if p_tipo in (''piano_collega'', ''piano_voce_aggiorna'', ''piano_voce_nuova'') then';
begin
  if v_def like '%piano_rate_ricalcola%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'voce_risolvi_dati non ha il passaggio atteso per i tre tipi del piano: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora,
    'if p_tipo in (''piano_collega'', ''piano_voce_aggiorna'', ''piano_voce_nuova'', ''piano_rate_ricalcola'') then');
end $risolvi$;
revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. IL SÌ: RICALCOLA NELLA STESSA TRANSAZIONE
-- ---------------------------------------------------------------------------
create or replace function fai_piano_memo(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_check jsonb;
  v_d     jsonb;
  v_id    uuid;
  v_ord   integer;
  v_prev  numeric;
  v_rate  jsonb;
begin
  if not (select is_titolare()) then
    raise exception 'Il piano dell''investimento lo gestisce il titolare.';
  end if;
  v_check := voce_risolvi_piano(p_tipo, p_dati, null);
  if v_check->>'manca' is not null then raise exception '%', v_check->>'manca'; end if;
  v_d := v_check->'dati';

  case p_tipo
    when 'piano_collega' then
      perform segna_investimento(v_d->>'spesa_fonte', (v_d->>'spesa_id')::uuid, (v_d->>'voce_id')::uuid, null);
      return jsonb_build_object('voce_id', v_d->>'voce_id', 'spesa_id', v_d->>'spesa_id');

    when 'piano_voce_aggiorna' then
      update piano_voci
         set stato = coalesce(nullif(v_d->>'stato', ''), stato),
             importo_ivato = coalesce(nullif(v_d->>'importo', '')::numeric, importo_ivato),
             nota = case
                      when nullif(btrim(coalesce(v_d->>'nota', '')), '') is null then nota
                      when nullif(btrim(coalesce(nota, '')), '') is null then btrim(v_d->>'nota')
                      else nota || ' · ' || btrim(v_d->>'nota')
                    end
       where id = (v_d->>'voce_id')::uuid and archiviata_il is null
      returning id into v_id;
      if v_id is null then raise exception 'Questa voce del piano non c''è più.'; end if;
      return jsonb_build_object('voce_id', v_id);

    when 'piano_rate_ricalcola' then
      -- Se questa riga viene approvata da sola, vince il previsto attuale:
      -- così non può mettere le rate di una cifra che la voce non ha mai avuto.
      select importo_ivato into v_prev from piano_voci
       where id = (v_d->>'voce_id')::uuid and archiviata_il is null for update;
      if v_prev is null then raise exception 'Questa voce del piano non c''è più.'; end if;
      perform 1 from piano_rate where voce_id = (v_d->>'voce_id')::uuid for update;
      v_rate := piano_rate_da_ricalcolare((v_d->>'voce_id')::uuid, v_prev);
      if not coalesce((v_rate->>'possibile')::boolean, false) then
        raise exception '%', v_rate->>'motivo';
      end if;
      update piano_rate r
         set importo = (e->>'dopo')::numeric
        from jsonb_array_elements(v_rate->'rate') e
       where r.id = (e->>'rata_id')::uuid
         and r.importo is distinct from (e->>'dopo')::numeric;
      return jsonb_build_object('voce_id', v_d->>'voce_id', 'rate', v_rate->'rate');

    when 'piano_voce_nuova' then
      select coalesce(max(ordine), 0) + 1 into v_ord from piano_voci where gruppo = v_d->>'gruppo';
      insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato, nota)
      values (v_d->>'gruppo', v_ord, btrim(v_d->>'descrizione'), (v_d->>'importo')::numeric,
              (v_d->>'aliquota_iva')::integer, v_d->>'stato', 'Aggiunta con MEMO')
      returning id into v_id;
      return jsonb_build_object('voce_id', v_id);

    else raise exception 'fai_piano_memo non conosce «%».', p_tipo;
  end case;
end $funzione$;

comment on function fai_piano_memo(text, jsonb) is
  'Esegue le operazioni del piano dell''investimento di MEMO, compreso il ricalcolo ricontrollato delle rate (14/11/2026). La chiama solo fai_azione_dettata: chiusa a tutti.';
revoke all on function fai_piano_memo(text, jsonb) from public, anon, authenticated;

do $fai$
declare
  v_def text := replace(pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure), E'\r', '');
  v_ancora text := 'when ''piano_voce_nuova'' then return fai_piano_memo(p_tipo, p_dati);';
begin
  if v_def like '%when ''piano_rate_ricalcola'' then return fai_piano_memo%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'fai_azione_dettata non ha il ramo atteso della voce nuova del piano: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora,
    v_ancora || E'\n    when ''piano_rate_ricalcola'' then return fai_piano_memo(p_tipo, p_dati);');
end $fai$;
revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- Il secondo elemento nasce nella stessa scrittura e porta lo stesso
-- appunto_id del primo: altrimenti i due tipi non additivi si dividerebbero.
do $scrivi_rate$
declare
  v_def text := replace(pg_get_functiondef('public.scrivi_dettatura(uuid,text,text,jsonb,text,text,integer,integer,text)'::regprocedure), E'\r', '');
  v_ancora text := E'      insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,\n                                  frase, parole_dette, motivo, stato, alternative, destinazione_libera)\n      values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,\n              v_frase, v_parole_dette, v_motivo, ''in_attesa'', v_alt, v_libera);';
  v_nuovo text;
begin
  if v_def like '%v_appunto_rate%' then return; end if;
  if position('v_appunti   integer := 0;' in v_def) = 0 then
    raise exception 'scrivi_dettatura non ha la dichiarazione attesa degli appunti: confronta il corpo vivo prima di applicare.';
  end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'scrivi_dettatura non ha un inserimento atteso delle azioni: confronta il corpo vivo prima di applicare.';
  end if;
  v_nuovo := replace(v_ancora, ';', ' returning appunto_id into v_appunto_rate;')
    || E'\n\n    -- Se il previsto cambia e il calcolo è possibile, MEMO aggiunge qui la'
    || E'\n    -- seconda proposta già pronta, nello STESSO appunto della voce.'
    || E'\n    if v_tipo = ''piano_voce_aggiorna'' and v_dati ? ''rate_ricalcolate'' then'
    || E'\n      v_i := v_i + 1;'
    || E'\n      insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,'
    || E'\n                                  frase, parole_dette, motivo, stato, alternative, destinazione_libera, appunto_id)'
    || E'\n      values (v_dettatura, v_i, ''piano_rate_ricalcola'','
    || E'\n              jsonb_build_object(''voce_id'', v_dati->>''voce_id'', ''voce_nome'', v_dati->>''voce_nome'','
    || E'\n                                 ''prima_previsto'', v_dati->>''prima_previsto'', ''previsto'', v_dati->>''importo'','
    || E'\n                                 ''rate'', v_dati->''rate_ricalcolate''),'
    || E'\n              true, ''Rate ricalcolate per '' || coalesce(v_dati->>''voce_nome'', ''questa voce''),'
    || E'\n              v_parole_dette, ''Questa la guardi sempre tu prima che venga scritta.'', ''in_attesa'', null, null, v_appunto_rate);'
    || E'\n    end if;';
  v_def := replace(v_def, 'v_appunti   integer := 0;', 'v_appunti   integer := 0;' || E'\n  v_appunto_rate uuid;');
  execute replace(v_def, v_ancora, v_nuovo);
end $scrivi_rate$;

-- ---------------------------------------------------------------------------
-- 4. VERIFICA: LA PROPOSTA, I CENTESIMI, IL PORTIERE E ZERO RESIDUI
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid;
  v_staff uuid;
  v_voce uuid;
  v_voce_senza uuid;
  v_r0 uuid;
  v_r1 uuid;
  v_r2 uuid;
  v_srls uuid;
  v_forn uuid;
  v_fat uuid;
  v_r jsonb;
  v_dett uuid;
  v_app uuid;
  v_rate jsonb;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_staff is null or v_srls is null then raise exception 'VERIFICA: servono un titolare, uno staff e Borgo 58.'; end if;
  if has_function_privilege('authenticated', 'piano_rate_da_ricalcolare(uuid, numeric)', 'execute')
     or has_function_privilege('anon', 'piano_rate_da_ricalcolare(uuid, numeric)', 'execute') then
    raise exception 'VERIFICA: il calcolo delle rate è aperto a chi non deve.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if exists (select 1 from tipi_vocali_senza_ramo()) or exists (select 1 from tipi_vocali_senza_uscita()) then
      raise exception 'VERIFICA: il tipo nuovo non ha ramo o uscita.';
    end if;

    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 997, 'ZZ voce rate proposte', 9000, 22, 'stimato') returning id into v_voce;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 0, 3000) returning id into v_r0;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 1, 3000), (v_voce, 2, 3000);
    select id into v_r1 from piano_rate where voce_id = v_voce and mese_rel = 1;
    select id into v_r2 from piano_rate where voce_id = v_voce and mese_rel = 2;

    -- 1. Anteprima: tre mesi invariati, proporzione e ultimo centesimo.
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce, 'importo', 9800));
    if not (v_r->'dati' ? 'rate_ricalcolate') or jsonb_array_length(v_r->'dati'->'rate_ricalcolate') <> 3 then
      raise exception 'VERIFICA (1): l''aggiornamento non prepara le tre rate (%).', v_r;
    end if;
    if (select sum((e->>'dopo')::numeric) from jsonb_array_elements(v_r->'dati'->'rate_ricalcolate') e) <> 9800
       or (select array_agg((e->>'mese_rel')::integer order by (e->>'mese_rel')::integer) from jsonb_array_elements(v_r->'dati'->'rate_ricalcolate') e) <> array[0,1,2] then
      raise exception 'VERIFICA (1): rate o mesi proposti non tornano (%).', v_r;
    end if;

    -- 2. L'appunto porta una seconda azione, nello stesso appunto, già compilata.
    v_r := registra_dettatura('ZZ aggiorna le rate', jsonb_build_array(jsonb_build_object(
      'tipo', 'piano_voce_aggiorna', 'sicuro', true, 'frase', 'ZZ aggiorna la voce',
      'dati', jsonb_build_object('voce_id', v_voce, 'importo', 9800))), 'capita', null, 0, 0, null);
    v_dett := (v_r->>'dettatura_id')::uuid;
    if (select count(*) from azioni_dettate where dettatura_id = v_dett) <> 2
       or (select count(distinct appunto_id) from azioni_dettate where dettatura_id = v_dett) <> 1
       or not exists (select 1 from azioni_dettate where dettatura_id = v_dett and tipo = 'piano_rate_ricalcola' and dati ? 'rate') then
      raise exception 'VERIFICA (2): la seconda proposta delle rate manca, non è compilata o è in un altro appunto.';
    end if;

    -- 3. Approvate insieme, somme e mesi restano esatti.
    select appunto_id into v_app from azioni_dettate where dettatura_id = v_dett limit 1;
    perform approva_appunto(v_app);
    if (select importo_ivato from piano_voci where id = v_voce) <> 9800
       or (select sum(importo) from piano_rate where voce_id = v_voce) <> 9800
       or (select array_agg(mese_rel::integer order by mese_rel) from piano_rate where voce_id = v_voce) <> array[0,1,2] then
      raise exception 'VERIFICA (3): dopo il sì, previsto, somma o mesi non tornano.';
    end if;

    -- 4. Una rata già in parte coperta non cambia; il resto solo sulle aperte.
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 996, 'ZZ voce rata già pagata', 900, 22, 'stimato') returning id into v_voce_senza;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce_senza, 0, 300), (v_voce_senza, 1, 300), (v_voce_senza, 2, 300);
    -- Il collegamento della verifica della previsione distingue la rata già coperta.
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore rata già pagata') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount, e_investimento)
    values (v_srls, v_forn, 'ZZ-RATE-PAGATE', current_date, current_date, 300, true) returning id into v_fat;
    insert into piano_collegamenti (voce_id, rata_id, supplier_invoice_id, importo_attribuito)
    select v_voce_senza, r.id, v_fat, 300
      from piano_rate r
     where r.voce_id = v_voce_senza and r.mese_rel = 0;
    v_rate := piano_rate_da_ricalcolare(v_voce_senza, 1000);
    if not coalesce((v_rate->>'possibile')::boolean, false)
       or (select (e->>'dopo')::numeric from jsonb_array_elements(v_rate->'rate') e where (e->>'mese_rel')::integer = 0) <> 300
       or (select sum((e->>'dopo')::numeric) from jsonb_array_elements(v_rate->'rate') e) <> 1000 then
      raise exception 'VERIFICA (4): la rata già pagata non è rimasta intatta (%).', v_rate;
    end if;

    -- 5. Senza rate non esce una seconda azione; id batte un numero vecchio.
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 995, 'ZZ voce senza rate', 100, 22, 'stimato') returning id into v_voce_senza;
    v_r := voce_risolvi_dati('piano_voce_aggiorna', jsonb_build_object('voce_id', v_voce_senza, 'voce', 1, 'importo', 120));
    if v_r->'dati' ? 'rate_ricalcolate' or (v_r->'dati'->>'voce_id')::uuid is distinct from v_voce_senza then
      raise exception 'VERIFICA (5): senza rate è uscita una proposta o il numero ha battuto l''id (%).', v_r;
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin perform fai_azione_dettata('piano_rate_ricalcola', jsonb_build_object('voce_id', v_voce));
    exception when others then v_respinto := sqlerrm like '%titolare%'; end;
    if not v_respinto then raise exception 'VERIFICA (6): lo staff ha ricalcolato le rate.'; end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle rate proposte da MEMO');
  raise notice 'Fatto: MEMO propone le rate ricalcolate, conserva mesi e rate già coperte, e ricontrolla tutto al sì. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000010', 'le_rate_si_propongono')
on conflict (version) do nothing;
