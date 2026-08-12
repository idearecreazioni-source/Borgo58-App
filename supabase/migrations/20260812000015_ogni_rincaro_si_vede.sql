-- ---------------------------------------------------------------------
-- Ogni rincaro si vede, e l'interruttore è per prodotto
-- ---------------------------------------------------------------------
-- Ripensamento di Alessio, un'ora dopo aver scelto la soglia del 10%:
--
--   «togliamo il limite del 10% mantenendo l'on/off sugli avvisi per tutti
--    i prodotti. Riflettendoci meglio: se un fornitore applicasse piccoli
--    ma costanti rincari non me ne accorgerei. Sui prodotti che variano
--    spesso o regolarmente tolgo gli avvisi.»
--
-- Ha ragione, e il caso che descrive è quello che una soglia non prende
-- **per costruzione**: dodici aumenti del 3% in un anno fanno +42% e non
-- superano mai il 10%. Una soglia protegge dal rumore e lascia passare
-- esattamente la cosa peggiore — l'aumento che non si vede.
--
-- COSA CAMBIA
--
-- 1. **La soglia va a zero.** Qualunque aumento produce un avviso. Resta
--    il numero in `service_settings`, perché rialzarlo un giorno non deve
--    richiedere una migrazione — ma il valore di partenza ora è 0.
-- 2. **L'interruttore diventa per prodotto e per qualunque motivo.**
--    `prezzo_stagionale` era un nome che descriveva un solo caso;
--    `avvisa_rincari` descrive la decisione. Il verso si inverte: gli
--    avvisi sono accesi salvo che Alessio li spenga su quel prodotto.
-- 3. **L'avviso dice anche da dove si è partiti.** È la parte che nasce
--    dalla sua osservazione e che nessuno dei due aveva chiesto: accanto
--    a «+3% rispetto all'ultima volta» compare «+42% da quando lo compri».
--    Il singolo passo è innocuo, la somma no — e la somma è il vero
--    argomento con cui si telefona a un fornitore.
--
-- ⚠️ IL PREZZO DI PARTENZA È QUELLO PIÙ VECCHIO REGISTRATO PER QUEL
-- FORNITORE, non il minimo storico. Il minimo darebbe la variazione più
-- spettacolare invece di quella vera, e un numero scelto per fare effetto
-- è un numero di cui poi non ci si fida.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. L'interruttore cambia nome e verso
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'ingredients' and column_name = 'prezzo_stagionale'
  ) then
    alter table ingredients rename column prezzo_stagionale to avvisa_rincari;
    -- Il verso si inverte: chi era «stagionale» (muto) resta muto.
    update ingredients set avvisa_rincari = not avvisa_rincari;
    alter table ingredients alter column avvisa_rincari set default true;
  end if;
end $$;

alter table ingredients
  add column if not exists avvisa_rincari boolean not null default true;

comment on column ingredients.avvisa_rincari is
  'Se avvisare quando il prezzo di questo prodotto sale. Acceso di partenza; si spegne sui prodotti che variano spesso per stagione o per mercato — altrimenti l''avviso suona sempre e si smette di leggerlo.';

-- ---------------------------------------------------------------------
-- 2. La soglia va a zero
-- ---------------------------------------------------------------------
-- Resta configurabile: rialzarla un giorno non deve costare una
-- migrazione. Ma il valore giusto oggi e' zero, perche' il rincaro che fa
-- danno e' quello piccolo e ripetuto.
alter table service_settings alter column soglia_rincaro_percento set default 0;
update service_settings set soglia_rincaro_percento = 0
 where id = 1 and soglia_rincaro_percento = 10;

comment on column service_settings.soglia_rincaro_percento is
  'Di quanto deve salire un prezzo perche'' scatti l''avviso. Zero dal 12/08/2026: dodici aumenti del 3%%%% fanno +42%%%% e non superano mai il 10%%%%. Il silenzio si compra per prodotto, non per percentuale.';

-- ---------------------------------------------------------------------
-- 3. La decisione: quanto rispetto all'ultima volta, e quanto dall'inizio
-- ---------------------------------------------------------------------
-- Le colonne restituite cambiano, quindi la funzione va tolta e rifatta:
-- `create or replace` non puo' cambiare il tipo di ritorno.
drop function if exists variazione_prezzo(uuid, uuid, numeric);

create or replace function variazione_prezzo(
  p_ingredient_id uuid,
  p_supplier_id   uuid,
  p_prezzo        numeric
)
returns table (
  prezzo_precedente numeric,
  quando            timestamptz,
  variazione        numeric,
  prezzo_primo      numeric,
  quando_primo      timestamptz,
  variazione_totale numeric,
  da_segnalare      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_prec   numeric;
  v_quando timestamptz;
  v_primo  numeric;
  v_quando_primo timestamptz;
  v_soglia numeric;
  v_avvisa boolean;
begin
  if p_ingredient_id is null or p_prezzo is null or p_prezzo <= 0 then
    return;
  end if;

  -- L'ultimo prezzo pagato allo STESSO fornitore: e' il confronto che
  -- risponde a «mi ha aumentato senza dirmelo». Il confronto fra fornitori
  -- diversi e' un'altra domanda, e si guarda nello storico: due fornitori
  -- hanno prezzi diversi per mille ragioni lecite.
  select ph.price, ph.recorded_at into v_prec, v_quando
    from price_history ph
   where ph.ingredient_id = p_ingredient_id
     and ph.supplier_id is not distinct from p_supplier_id
   order by ph.recorded_at desc
   limit 1;

  if v_prec is null or v_prec <= 0 then
    return;   -- primo acquisto: non c'e' niente da confrontare
  end if;

  -- ⚠️ Il piu' VECCHIO, non il minimo: il minimo darebbe la variazione
  -- piu' spettacolare invece di quella vera, e un numero scelto per fare
  -- effetto e' un numero di cui poi non ci si fida.
  select ph.price, ph.recorded_at into v_primo, v_quando_primo
    from price_history ph
   where ph.ingredient_id = p_ingredient_id
     and ph.supplier_id is not distinct from p_supplier_id
   order by ph.recorded_at asc
   limit 1;

  select coalesce(s.soglia_rincaro_percento, 0) into v_soglia
    from service_settings s where s.id = 1;
  v_soglia := coalesce(v_soglia, 0);

  select i.avvisa_rincari into v_avvisa from ingredients i where i.id = p_ingredient_id;

  return query select
    v_prec,
    v_quando,
    round((p_prezzo - v_prec) / v_prec * 100, 1),
    v_primo,
    v_quando_primo,
    case when v_primo > 0 then round((p_prezzo - v_primo) / v_primo * 100, 1) end,
    coalesce(v_avvisa, true)
      and p_prezzo > v_prec * (1 + v_soglia / 100);
end
$funzione$;

comment on function variazione_prezzo(uuid, uuid, numeric) is
  'Quanto e'' salito un prezzo rispetto all''ultima volta E rispetto al primo acquisto dallo stesso fornitore. Decide e basta: non avvisa nessuno. Il secondo numero e'' quello che prende i rincari piccoli e ripetuti, che una soglia non prende per costruzione.';

revoke all on function variazione_prezzo(uuid, uuid, numeric) from public, anon;
grant execute on function variazione_prezzo(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4. L'esecuzione del carico usa il nome nuovo
-- ---------------------------------------------------------------------
-- Solo il pezzo che leggeva `oltre_soglia` cambia; il resto della
-- funzione e' identico a `20260812000014`.
create or replace function esegui_azione_posta(
  p_azione_id uuid,
  p_parametri jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_azione   posta_azioni%rowtype;
  v_par      jsonb;
  v_allegato posta_allegati%rowtype;
  v_posta    posta_ricevuta%rowtype;
  v_doc      uuid;
  v_task     uuid;
  v_riga     jsonb;
  v_elenco   text := '';
  n_aperte   integer;
  v_forn     uuid;
  v_ingr     uuid;
  v_qta      numeric;
  v_lotti    integer := 0;
  v_haccp    integer := 0;
  v_saltate  integer := 0;
  v_creati   integer := 0;
  v_nota     text;
  v_esito    jsonb;
  v_nuovo    jsonb;
  v_ente     uuid;
  v_fatt     numeric;
  v_prezzo   numeric;
  v_chiave   text;
  v_var      record;
  v_rincari  jsonb := '[]'::jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' decidere sulla posta';
  end if;

  select * into v_azione from posta_azioni where id = p_azione_id for update;
  if not found then
    raise exception 'Questa proposta non esiste piu''';
  end if;

  if v_azione.stato = 'fatta' then
    return jsonb_build_object('gia_fatta', true,
      'documento_id', v_azione.documento_id, 'task_id', v_azione.task_id);
  end if;

  v_par := coalesce(p_parametri, v_azione.parametri);
  select * into v_posta from posta_ricevuta where id = v_azione.posta_id;

  if v_azione.tipo in ('archivia_documento', 'archivia_testo') then
    if v_azione.tipo = 'archivia_documento' then
      select * into v_allegato from posta_allegati
       where id = nullif(v_par->>'allegato_id', '')::uuid;
    end if;

    v_doc := create_document(
      p_title          => coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
      p_doc_type       => nullif(v_par->>'tipo', ''),
      p_document_date  => nullif(v_par->>'data', '')::date,
      p_counterparties => nullif(v_par->>'controparte', ''),
      p_amount         => nullif(v_par->>'importo', '')::numeric,
      p_expiry_date    => nullif(v_par->>'scadenza', '')::date,
      p_note           => nullif(v_par->>'note', ''),
      p_storage_path   => v_allegato.storage_path,
      p_file_name      => v_allegato.file_name
    );

    update documents
       set testo = coalesce(nullif(v_par->>'contenuto', ''), v_posta.testo)
     where id = v_doc;

  elsif v_azione.tipo = 'promemoria' then
    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(v_par->>'note', ''), nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'promemoria_multipli' then
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'scadenze', '[]'::jsonb))
    loop
      if nullif(v_riga->>'data', '') is not null then
        insert into tasks (title, description, due_date, category, origine_modulo)
        values (coalesce(nullif(v_riga->>'titolo', ''), v_azione.titolo),
                nullif(v_riga->>'note', ''), (v_riga->>'data')::date,
                'amministrativo', 'posta')
        returning id into v_task;
      end if;
    end loop;

  elsif v_azione.tipo = 'carico_magazzino' then
    v_forn := nullif(v_par->>'fornitore_id', '')::uuid;
    v_nota := nullif(v_par->>'documento', '');

    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'righe', '[]'::jsonb))
    loop
      v_chiave := chiave_articolo(v_riga->>'descrizione');

      if coalesce((v_riga->>'ignora')::boolean, false) then
        if v_chiave is not null then
          insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, ignora)
          values (v_forn, v_riga->>'descrizione', v_chiave, null, true)
          on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave)
          do update set ingredient_id = null, ignora = true, aggiornato_il = now();
        end if;
        v_saltate := v_saltate + 1;
        continue;
      end if;

      v_ingr := nullif(v_riga->>'ingrediente_id', '')::uuid;
      v_qta  := nullif(v_riga->>'quantita', '')::numeric;
      v_nuovo := v_riga->'nuovo_ingrediente';

      if v_ingr is null
         and v_nuovo is not null
         and nullif(v_nuovo->>'nome', '') is not null
         and not coalesce((v_riga->>'salta')::boolean, false) then
        select entity_id into v_ente from suppliers where id = v_forn;
        if v_ente is null then
          select id into v_ente from entities order by created_at limit 1;
        end if;
        if v_ente is null then
          raise exception 'Non esiste nessuna entita'' a cui intestare l''ingrediente nuovo';
        end if;

        insert into ingredients (entity_id, name, category, unit, alimentare)
        values (v_ente,
                trim(v_nuovo->>'nome'),
                coalesce(nullif(v_nuovo->>'categoria', '')::ingredient_category, 'altro'),
                coalesce(nullif(v_nuovo->>'unita', '')::unit_type, 'kg'),
                coalesce((v_nuovo->>'alimentare')::boolean, true))
        returning id into v_ingr;
        v_creati := v_creati + 1;
      end if;

      if coalesce((v_riga->>'salta')::boolean, false)
         or v_ingr is null or v_qta is null or v_qta <= 0 then
        v_saltate := v_saltate + 1;
        continue;
      end if;

      v_fatt := coalesce(nullif(v_riga->>'fattore', '')::numeric, 1);
      if v_fatt is null or v_fatt <= 0 then v_fatt := 1; end if;
      v_prezzo := nullif(v_riga->>'costo_unitario', '')::numeric;
      if v_prezzo is not null then v_prezzo := v_prezzo / v_fatt; end if;

      -- PRIMA di scrivere lo storico, altrimenti il confronto trova se
      -- stesso e non c'e' mai nessun rincaro.
      if v_prezzo is not null then
        select * into v_var from variazione_prezzo(v_ingr, v_forn, v_prezzo);
        if found and v_var.da_segnalare then
          v_rincari := v_rincari || jsonb_build_array(jsonb_build_object(
            'ingrediente',       (select name from ingredients where id = v_ingr),
            'prima',             v_var.prezzo_precedente,
            'adesso',            round(v_prezzo, 4),
            'variazione',        v_var.variazione,
            'primo',             v_var.prezzo_primo,
            'variazione_totale', v_var.variazione_totale));
        end if;
      end if;

      perform register_stock_delivery(
        p_ingredient_id         => v_ingr,
        p_quantity              => v_qta * v_fatt,
        p_supplier_id           => v_forn,
        p_expiry_date           => nullif(v_riga->>'scadenza', '')::date,
        p_note                  => v_nota,
        p_unit_cost             => v_prezzo,
        p_supplier_batch_number => nullif(v_riga->>'lotto', '')
      );
      v_lotti := v_lotti + 1;

      if v_prezzo is not null then
        perform update_ingredient_price(v_ingr, v_prezzo, 'fattura', v_nota, v_forn);
      end if;

      if coalesce((v_riga->>'ricorda')::boolean, true) and v_chiave is not null then
        insert into articoli_fornitore (
          supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore, ignora
        )
        values (
          v_forn, v_riga->>'descrizione', v_chiave, v_ingr,
          nullif(v_riga->>'unita_fattura', ''), v_fatt, false
        )
        on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave)
        do update set ingredient_id = excluded.ingredient_id,
                      unita_fattura = excluded.unita_fattura,
                      fattore       = excluded.fattore,
                      ignora        = false,
                      aggiornato_il = now();
      end if;

      if (v_par->>'registra_haccp')::boolean is true then
        insert into haccp_goods_receiving (
          supplier_id, product_description, temperature_c,
          packaging_ok, conformity, note
        )
        values (
          v_forn,
          coalesce(nullif(v_riga->>'descrizione', ''),
                   (select name from ingredients where id = v_ingr)),
          nullif(v_par->>'temperatura', '')::numeric,
          coalesce((v_par->>'imballo_integro')::boolean, true),
          coalesce((v_par->>'conformita')::boolean, true),
          nullif(concat_ws(' — ', v_nota, nullif(v_riga->>'lotto', '')), '')
        );
        v_haccp := v_haccp + 1;
      end if;
    end loop;

    if v_lotti = 0 then
      raise exception 'Nessuna riga da caricare: scegli almeno un ingrediente e una quantità';
    end if;

    for v_riga in select * from jsonb_array_elements(v_rincari)
    loop
      perform segnala_allarme(
        'rincaro_' || (v_riga->>'ingrediente'),
        'Rincaro su ' || (v_riga->>'ingrediente') || ': da ' || (v_riga->>'prima') ||
          ' a ' || (v_riga->>'adesso') || ' (+' || (v_riga->>'variazione') || '%)' ||
          coalesce(', +' || (v_riga->>'variazione_totale') || '% da quando lo compri', '') ||
          coalesce(' — ' || v_nota, ''),
        v_riga
      );
    end loop;

    v_esito := jsonb_build_object('lotti', v_lotti, 'haccp', v_haccp,
                                  'saltate', v_saltate, 'creati', v_creati,
                                  'rincari', v_rincari);

  elsif v_azione.tipo = 'da_fare_a_mano' then
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'passi', '[]'::jsonb))
    loop
      v_elenco := v_elenco || '· ' || coalesce(v_riga #>> '{}', '') || E'\n';
    end loop;

    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(coalesce(nullif(v_elenco, ''), nullif(v_par->>'note', '')), ''),
            nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'nessuna' then
    null;
  end if;

  update posta_azioni
     set stato = 'fatta', decisa_il = now(),
         parametri = v_par, documento_id = v_doc, task_id = v_task
   where id = p_azione_id;

  select count(*) into n_aperte
    from posta_azioni where posta_id = v_azione.posta_id and stato = 'proposta';
  if n_aperte = 0 then
    update posta_ricevuta
       set stato = case
             when exists (select 1 from posta_azioni
                           where posta_id = v_azione.posta_id
                             and stato = 'fatta' and tipo <> 'nessuna')
             then 'archiviata'::stato_posta else 'scartata'::stato_posta end,
           documento_id = coalesce(documento_id, v_doc)
     where id = v_azione.posta_id;
  end if;

  return coalesce(v_esito, '{}'::jsonb)
         || jsonb_build_object('documento_id', v_doc, 'task_id', v_task);
end
$funzione$;

revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_forn uuid;
  v_ing  uuid;
  v_var  record;
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- 1. Il nome vecchio non esiste più, il nuovo sì e nasce acceso.
  select count(*) into n from information_schema.columns
   where table_name = 'ingredients' and column_name = 'prezzo_stagionale';
  if n <> 0 then raise exception 'La colonna vecchia e'' ancora li''.'; end if;
  select count(*) into n from information_schema.columns
   where table_name = 'ingredients' and column_name = 'avvisa_rincari'
     and column_default = 'true';
  if n <> 1 then raise exception 'Gli avvisi non nascono accesi.'; end if;

  -- 2. La soglia è zero.
  select soglia_rincaro_percento into n from service_settings where id = 1;
  if n is distinct from 0 then raise exception 'La soglia e'' % invece di 0.', n; end if;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA RINCARO fornitore', 'ortofrutta') returning id into v_forn;
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA RINCARO ciliegino', 'verdura', 'kg') returning id into v_ing;

  -- Tre acquisti in crescita lenta: 3,00 → 3,09 → 3,18 (+3% ogni volta).
  insert into price_history (ingredient_id, price, supplier_id, source, recorded_at)
  values (v_ing, 3.00, v_forn, 'fattura', now() - interval '60 days'),
         (v_ing, 3.09, v_forn, 'fattura', now() - interval '30 days'),
         (v_ing, 3.18, v_forn, 'fattura', now() - interval '1 day');

  -- 3. IL CASO DI ALESSIO: +3%, che la vecchia soglia del 10% lasciava
  --    passare in silenzio. Adesso si vede.
  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.28);
  if not v_var.da_segnalare then
    raise exception 'Un rincaro del 3%% non viene segnalato: e'' il caso che ha fatto togliere la soglia.';
  end if;
  if v_var.variazione is distinct from 3.1 then
    raise exception 'La variazione sull''ultimo prezzo e'' % invece di 3.1.', v_var.variazione;
  end if;

  -- 4. E LA SOMMA, che è la cosa nuova: +9,3% da quando lo compra.
  if v_var.prezzo_primo is distinct from 3.00 then
    raise exception 'Il prezzo di partenza e'' % invece di 3.00 (deve essere il piu'' vecchio, non il minimo).', v_var.prezzo_primo;
  end if;
  if v_var.variazione_totale is distinct from 9.3 then
    raise exception 'La variazione totale e'' %%% invece di 9.3%%.', v_var.variazione_totale;
  end if;

  -- 5. Un prezzo che scende non segnala niente.
  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.00);
  if v_var.da_segnalare then
    raise exception 'Un prezzo in calo ha prodotto un avviso.';
  end if;

  -- 6. L'interruttore spento zittisce, ma non smette di calcolare.
  update ingredients set avvisa_rincari = false where id = v_ing;
  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.28);
  if v_var.da_segnalare then
    raise exception 'Un prodotto con gli avvisi spenti ha prodotto un avviso.';
  end if;
  if v_var.variazione_totale is distinct from 9.3 then
    raise exception 'Con gli avvisi spenti deve tacere, non smettere di calcolare.';
  end if;

  -- 7. Pulizia (regola del 12/08).
  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  delete from suppliers where id = v_forn;

  select count(*) into n from ingredients where name like 'PROVA RINCARO%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;

  raise notice 'Ogni rincaro si vede: +3%% segnalato, +9,3%% dall''inizio, interruttore per prodotto.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000015', 'ogni_rincaro_si_vede')
on conflict (version) do nothing;

select (select soglia_rincaro_percento from service_settings where id = 1) as soglia,
       (select count(*) from ingredients where avvisa_rincari) as con_avvisi_accesi;
