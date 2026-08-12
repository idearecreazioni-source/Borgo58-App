-- ---------------------------------------------------------------------
-- Il carico impara: converte le unità, crea l'ingrediente, sorveglia il prezzo
-- ---------------------------------------------------------------------
-- Seconda metà del lavoro nato dalle due obiezioni di Alessio (la prima è
-- `20260812000013`, la memoria delle diciture). Qui il carico la usa.
--
-- COSA SA FARE ADESSO, riga per riga:
--
-- 1. **Convertire.** Se la fattura conta casse e l'ingrediente sta in
--    chili, `fattore` fa il resto: 2 casse da 6 diventano 12 kg, e 19,20 a
--    cassa diventano 3,20 al chilo. Senza questa divisione lo storico dei
--    prezzi sarebbe pieno di numeri incomparabili fra loro — e la
--    sorveglianza costruita sopra non varrebbe niente.
-- 2. **Creare l'ingrediente**, se Alessio lo chiede da quella riga.
--    Il Ricettario si riempie lavorando invece che in una serata di
--    digitazione. Non lo decide il modello: arriva col nome già scritto e
--    lui lo conferma o lo cambia.
-- 3. **Ricordare la dicitura**, così la volta dopo non chiede più. Anche
--    il «questa riga non è merce» si ricorda (trasporto, CONAI, sconti):
--    è la differenza fra un sistema che impara e uno che ogni mese fa la
--    stessa domanda.
-- 4. **Scrivere lo storico prezzi** con `source = 'fattura'`, passando da
--    `update_ingredient_price` — che resta l'unico punto di scrittura.
-- 5. **Accorgersi dei rincari** e dirlo su Telegram, uno per prodotto.
--
-- L'AVVISO ARRIVA IN DUE POSTI, deciso da Alessio: nella schermata di
-- conferma **prima** che confermi (con `variazione_prezzo()`, che non
-- avvisa nessuno) e su Telegram **dopo**, da qui. Il primo serve a
-- accorgersi che il fornitore ha sbagliato la fattura mentre si può ancora
-- non registrarla; il secondo a saperlo anche se in quel momento si stava
-- guardando altro.
--
-- ⚠️ IL PREZZO SI CONFRONTA PRIMA DI SCRIVERLO. Se si scrivesse prima lo
-- storico, il confronto troverebbe se stesso e non ci sarebbe mai nessun
-- rincaro. È un errore che non lascia tracce: il sistema tace, e sembra
-- che i prezzi non salgano mai.
-- ---------------------------------------------------------------------

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

      -- «Questa riga non è merce, non chiedermelo più»: trasporto, CONAI,
      -- sconti. Si ricorda come tale e sparisce dalle proposte future.
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

      -- L'ingrediente nato dalla riga. L'entità è quella del fornitore
      -- (S.r.l.s. o azienda agricola: il vincolo portante del progetto),
      -- e solo se manca si ripiega sulla prima.
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

      -- La conversione. `fattore` porta l'unità della fattura in quella
      -- dell'ingrediente: senza, lo storico prezzi conterrebbe numeri non
      -- confrontabili e la sorveglianza costruita sopra non varrebbe nulla.
      v_fatt := coalesce(nullif(v_riga->>'fattore', '')::numeric, 1);
      if v_fatt is null or v_fatt <= 0 then v_fatt := 1; end if;
      v_prezzo := nullif(v_riga->>'costo_unitario', '')::numeric;
      if v_prezzo is not null then v_prezzo := v_prezzo / v_fatt; end if;

      -- ⚠️ PRIMA di scrivere lo storico, altrimenti il confronto trova se
      -- stesso e non c'è mai nessun rincaro. Errore che non lascia tracce.
      if v_prezzo is not null then
        select * into v_var from variazione_prezzo(v_ingr, v_forn, v_prezzo);
        if found and v_var.oltre_soglia then
          v_rincari := v_rincari || jsonb_build_array(jsonb_build_object(
            'ingrediente', (select name from ingredients where id = v_ingr),
            'prima',       v_var.prezzo_precedente,
            'adesso',      round(v_prezzo, 4),
            'variazione',  v_var.variazione));
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

      -- La dicitura si ricorda, con la sua conversione: è ciò che rende
      -- la prossima fattura una conferma invece di una compilazione.
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

    -- Un avviso per prodotto rincarato: il freno di `segnala_allarme` è
    -- per tipo, e con un tipo solo il secondo rincaro della stessa ora
    -- resterebbe muto.
    for v_riga in select * from jsonb_array_elements(v_rincari)
    loop
      perform segnala_allarme(
        'rincaro_' || (v_riga->>'ingrediente'),
        'Rincaro su ' || (v_riga->>'ingrediente') || ': da ' || (v_riga->>'prima') ||
          ' a ' || (v_riga->>'adesso') || ' (+' || (v_riga->>'variazione') || '%)' ||
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

comment on function esegui_azione_posta(uuid, jsonb) is
  'Esegue una singola azione proposta sulla posta, dal ruolo del titolare. Il carico converte le unita'', puo'' creare l''ingrediente, ricorda la dicitura, scrive lo storico prezzi e avvisa dei rincari.';

revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3) — dal ruolo vero del titolare
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_ente  uuid;
  v_forn  uuid;
  v_posta uuid;
  v_az    uuid;
  v_out   jsonb;
  v_ing   uuid;
  v_lotto stock_lots%rowtype;
  v_art   articoli_fornitore%rowtype;
  n       integer;
  v_all   integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Servono un titolare e un''entita'' per la verifica.';
  end if;

  select count(*) into v_all from allarmi;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA IMPARA fornitore', 'ortofrutta') returning id into v_forn;

  insert into posta_ricevuta (messaggio_id, casella, oggetto, stato)
  values ('PROVA-IMPARA-1', 'info@borgo58.it', 'Bolla', 'proposta') returning id into v_posta;

  -- Riga 1: ingrediente creato dalla riga, conta CASSE da 6 kg.
  -- Riga 2: si dichiara «non è merce» e non deve tornare mai più.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico', 'Carico 1 riga',
          jsonb_build_object('fornitore_id', v_forn, 'documento', 'DDT PROVA IMPARA',
            'righe', jsonb_build_array(
              jsonb_build_object(
                'descrizione', 'PROVA IMPARA ciliegini cassa 6 kg',
                'quantita', 2, 'costo_unitario', 19.20,
                'fattore', 6, 'unita_fattura', 'cassa',
                'nuovo_ingrediente', jsonb_build_object(
                  'nome', 'PROVA IMPARA ciliegino', 'unita', 'kg', 'categoria', 'verdura')),
              jsonb_build_object(
                'descrizione', 'PROVA IMPARA contributo trasporto',
                'quantita', 1, 'ignora', true))))
  returning id into v_az;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_out := esegui_azione_posta(v_az);

  -- 1. Un ingrediente creato, un lotto, una riga saltata e ricordata.
  if (v_out->>'creati')::integer <> 1 then
    raise exception 'Atteso 1 ingrediente creato, %.', v_out->>'creati';
  end if;
  if (v_out->>'lotti')::integer <> 1 then
    raise exception 'Atteso 1 lotto, %.', v_out->>'lotti';
  end if;
  if (v_out->>'saltate')::integer <> 1 then
    raise exception 'Attesa 1 riga saltata, %.', v_out->>'saltate';
  end if;

  select id into v_ing from ingredients where name = 'PROVA IMPARA ciliegino';
  if v_ing is null then raise exception 'L''ingrediente non e'' nato.'; end if;

  -- 2. LA CONVERSIONE — 2 casse da 6 diventano 12 kg, e 19,20 a cassa
  --    diventano 3,20 al chilo. È il cuore della sorveglianza dei prezzi.
  select * into v_lotto from stock_lots where ingredient_id = v_ing;
  if v_lotto.quantity_received is distinct from 12 then
    raise exception 'La conversione della quantita'' e'' sbagliata: % invece di 12.', v_lotto.quantity_received;
  end if;
  if round(v_lotto.unit_cost, 2) is distinct from 3.20 then
    raise exception 'La conversione del prezzo e'' sbagliata: % invece di 3.20.', v_lotto.unit_cost;
  end if;

  -- 3. Lo storico prezzi parla in unità dell'ingrediente, non della cassa.
  select count(*) into n from price_history
   where ingredient_id = v_ing and round(price, 2) = 3.20 and source = 'fattura';
  if n <> 1 then
    raise exception 'Lo storico prezzi non ha registrato 3,20 al chilo (% righe).', n;
  end if;

  -- 4. La dicitura è stata ricordata col suo fattore.
  select * into v_art from articoli_fornitore
   where chiave = chiave_articolo('PROVA IMPARA ciliegini cassa 6 kg');
  if v_art.ingredient_id is distinct from v_ing or v_art.fattore is distinct from 6 then
    raise exception 'La dicitura non e'' stata ricordata correttamente.';
  end if;

  -- 5. E anche il «non è merce».
  select * into v_art from articoli_fornitore
   where chiave = chiave_articolo('PROVA IMPARA contributo trasporto');
  if not v_art.ignora or v_art.ingredient_id is not null then
    raise exception 'La riga «non e'' merce» non e'' stata ricordata come tale.';
  end if;

  -- 6. IL RINCARO. Secondo carico, stesso fornitore, +25%: deve produrre
  --    un avviso. E il confronto deve avvenire PRIMA della scrittura,
  --    altrimenti troverebbe se stesso.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico 2', 'Carico 1 riga',
          jsonb_build_object('fornitore_id', v_forn, 'documento', 'DDT PROVA IMPARA 2',
            'righe', jsonb_build_array(
              jsonb_build_object('descrizione', 'PROVA IMPARA ciliegini cassa 6 kg',
                                 'quantita', 1, 'costo_unitario', 24.00))))
  returning id into v_az;

  -- Il trigger deve aver riconosciuto la dicitura e messo fattore 6.
  select parametri into v_out from posta_azioni where id = v_az;
  if (v_out->'righe'->0->>'fattore')::numeric is distinct from 6 then
    raise exception 'Il secondo carico non ha ereditato il fattore dalla memoria.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_out := esegui_azione_posta(v_az);

  if jsonb_array_length(v_out->'rincari') <> 1 then
    raise exception 'Un +25%% non ha prodotto nessun avviso di rincaro.';
  end if;
  if round((v_out->'rincari'->0->>'adesso')::numeric, 2) is distinct from 4.00 then
    raise exception 'Il prezzo nuovo riportato nell''avviso e'' %, atteso 4.00.',
      v_out->'rincari'->0->>'adesso';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 7. Pulizia (regola del 12/08), allarmi della prova compresi.
  delete from allarmi where tipo like 'rincaro_PROVA IMPARA%';
  delete from price_history where ingredient_id = v_ing;
  delete from stock_lots where ingredient_id = v_ing;
  delete from articoli_fornitore where chiave like chiave_articolo('PROVA IMPARA') || '%';
  delete from posta_azioni where posta_id = v_posta;
  delete from posta_ricevuta where id = v_posta;
  delete from ingredients where id = v_ing;
  delete from suppliers where id = v_forn;

  select count(*) into n from ingredients where name like 'PROVA IMPARA%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from articoli_fornitore where descrizione like 'PROVA IMPARA%';
  if n <> 0 then raise exception 'La prova ha lasciato % articoli.', n; end if;
  select count(*) into n from allarmi;
  if n <> v_all then
    raise exception 'La prova ha lasciato % allarmi.', n - v_all;
  end if;

  raise notice 'Carico con memoria: 2 casse -> 12 kg a 3,20; dicitura ricordata; rincaro del 25%% visto.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000014', 'carico_con_memoria')
on conflict (version) do nothing;

select (select count(*) from articoli_fornitore) as diciture_ricordate,
       (select count(*) from price_history where source = 'fattura') as prezzi_da_fattura;
