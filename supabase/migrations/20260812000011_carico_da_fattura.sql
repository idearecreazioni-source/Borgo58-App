-- ---------------------------------------------------------------------
-- Il carico da fattura: da «cose da fare a mano» a una conferma sola
-- ---------------------------------------------------------------------
-- Punto 2 dell'ordine di Alessio del 12/08/2026. Oggi, quando arriva una
-- fattura o un documento di trasporto, l'assistente propone
-- `da_fare_a_mano` con dentro «carica il magazzino» e «registra i lotti in
-- HACCP»: una lista di compiti scritta in Agenda. Onesta, e da fare a
-- mano venti volte al mese.
--
-- Nasce il tipo di azione `carico_magazzino`. Confermandolo, per ogni riga
-- della fattura nasce un lotto in magazzino e — se richiesto — la riga nel
-- registro HACCP di ricevimento merci.
--
-- PERCHÉ È UNA SOLA FUNZIONE (regola B4). Un carico sono N lotti più N
-- righe di registro. A metà strada si otterrebbe la cosa peggiore: merce
-- in giacenza che non risulta ricevuta, o un registro HACCP che dichiara
-- un controllo su roba che il magazzino non ha mai visto. **Il registro
-- HACCP è un documento esibibile a un'ispezione**: una sua riga scritta a
-- metà non è un fastidio, è una dichiarazione falsa.
--
-- QUATTRO SCELTE, E LE RAGIONI
--
-- 1. **Una riga senza ingrediente non si carica, e si dice.** L'assistente
--    propone l'abbinamento leggendo la fattura, ma «Pomodoro pelato 3kg»
--    e l'ingrediente `Pomodori pelati` sono due stringhe diverse. Chi
--    conferma vede l'abbinamento e lo corregge. Inventare un ingrediente
--    nuovo a ogni nome diverso riempirebbe il Ricettario di doppioni —
--    e i doppioni in magazzino significano giacenze sbagliate per sempre.
-- 2. **Una riga per prodotto nel registro HACCP, non una per consegna.**
--    Un registro che dice «spesa Mililli, 4 °C» non serve a un'ispezione:
--    serve sapere *cosa* è arrivato. La temperatura invece è una sola —
--    è quella del furgone, misurata una volta.
-- 3. **Il numero di lotto del fornitore si conserva** (`supplier_batch_
--    number`, già in tabella e finora mai riempito). È il dato che serve
--    a rintracciare la merce se un lotto viene richiamato: senza, un
--    richiamo obbliga a buttare tutto invece di una cassa.
-- 4. **Il carico passa da `register_stock_delivery`**, che resta l'unico
--    punto di scrittura di `stock_lots`. Le è stato aggiunto il numero di
--    lotto; per farlo va ricreata, perché in Postgres un parametro in più
--    è una funzione nuova e due sovrapposte renderebbero ambigua ogni
--    chiamata per nome. Semantica e permessi identici a prima.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Il tipo nuovo
-- ---------------------------------------------------------------------
alter table posta_azioni drop constraint if exists posta_azioni_tipo_check;
alter table posta_azioni add constraint posta_azioni_tipo_check check (tipo in (
  'archivia_documento',    -- un allegato diventa un documento
  'archivia_testo',        -- il contenuto che conta è nella mail
  'promemoria',            -- una data in Agenda
  'promemoria_multipli',   -- più date dello stesso documento, in un colpo
  'carico_magazzino',      -- le righe di una fattura diventano lotti + HACCP
  'da_fare_a_mano',        -- cose che il gestionale non sa ancora fare
  'nessuna'
));

-- ---------------------------------------------------------------------
-- 2. Il carico conserva il numero di lotto del fornitore
-- ---------------------------------------------------------------------
-- La vecchia firma va tolta: `create or replace` con un parametro in più
-- crea una seconda funzione, e una chiamata per nome con sei argomenti
-- diventerebbe ambigua fra le due (errore 42725, a runtime, sul carico
-- manuale che oggi funziona).
drop function if exists register_stock_delivery(uuid, numeric, uuid, date, text, numeric);

create or replace function register_stock_delivery(
  p_ingredient_id         uuid,
  p_quantity              numeric,
  p_supplier_id           uuid default null,
  p_expiry_date           date default null,
  p_note                  text default null,
  p_unit_cost             numeric default null,
  p_supplier_batch_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  -- Invariato: lo staff registra una consegna, ma non ne scrive il costo.
  -- Non è un controllo di schermata che si possa aggirare.
  if p_unit_cost is not null and not is_titolare() then
    raise exception 'Solo il titolare può registrare il costo di un carico';
  end if;

  insert into stock_lots (
    ingredient_id, supplier_id, quantity_received, quantity_remaining,
    unit_cost, expiry_date, note, supplier_batch_number
  )
  values (
    p_ingredient_id, p_supplier_id, p_quantity, p_quantity,
    p_unit_cost, p_expiry_date, p_note, nullif(p_supplier_batch_number, '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text) is
  'Unico punto di scrittura di stock_lots. Lo staff può registrare una consegna, il costo solo il titolare. Dal 12/08/2026 conserva anche il numero di lotto del fornitore, che serve a rintracciare la merce in caso di richiamo.';

revoke all on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text) from public, anon;
grant execute on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. L'esecutore impara il carico
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
  v_nota     text;
  v_esito    jsonb;
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

  -- -------------------------------------------------------------------
  -- Il carico: N lotti + N righe di registro, o niente
  -- -------------------------------------------------------------------
  elsif v_azione.tipo = 'carico_magazzino' then
    v_forn := nullif(v_par->>'fornitore_id', '')::uuid;

    -- La nota resta attaccata a ogni lotto: fra sei mesi, davanti a una
    -- giacenza che non torna, «da dove viene questa roba» ha una risposta.
    v_nota := nullif(v_par->>'documento', '');

    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'righe', '[]'::jsonb))
    loop
      v_ingr := nullif(v_riga->>'ingrediente_id', '')::uuid;
      v_qta  := nullif(v_riga->>'quantita', '')::numeric;

      -- Una riga senza ingrediente, o saltata, o senza quantità, non si
      -- carica — e si conta. Il conteggio torna a chi ha confermato:
      -- «caricate 7 righe su 9» è un'informazione, «fatto» no.
      if coalesce((v_riga->>'salta')::boolean, false)
         or v_ingr is null or v_qta is null or v_qta <= 0 then
        v_saltate := v_saltate + 1;
        continue;
      end if;

      perform register_stock_delivery(
        p_ingredient_id         => v_ingr,
        p_quantity              => v_qta,
        p_supplier_id           => v_forn,
        p_expiry_date           => nullif(v_riga->>'scadenza', '')::date,
        p_note                  => v_nota,
        p_unit_cost             => nullif(v_riga->>'costo_unitario', '')::numeric,
        p_supplier_batch_number => nullif(v_riga->>'lotto', '')
      );
      v_lotti := v_lotti + 1;

      -- Il registro HACCP: una riga per prodotto, perché è ciò che
      -- un'ispezione chiede di vedere. La temperatura è una sola: è quella
      -- del furgone, misurata una volta.
      if coalesce((v_par->>'registra_haccp')::boolean, true) then
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

    v_esito := jsonb_build_object('lotti', v_lotti, 'haccp', v_haccp, 'saltate', v_saltate);

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
  'Esegue una singola azione proposta sulla posta, dal ruolo del titolare. Dal 12/08/2026 include il carico da fattura: N lotti di magazzino e N righe del registro HACCP in una sola transazione.';

revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica (§7 punti 1-3) — dal ruolo vero del titolare
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_forn   uuid;
  v_ing_a  uuid;
  v_ing_b  uuid;
  v_posta  uuid;
  v_az     uuid;
  v_out    jsonb;
  n        integer;
  v_lotto  stock_lots%rowtype;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: la verifica non può impersonare nessuno.';
  end if;

  -- Fornitori e ingredienti appartengono a un'entità fiscale (il vincolo
  -- portante del progetto: S.r.l.s. e azienda agricola sono separate fin
  -- dallo schema). Si prende quella che c'è, non se ne inventa una.
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then
    raise exception 'Nessuna entità in `entities`: la verifica non può creare un fornitore.';
  end if;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA CARICO fornitore', 'ortofrutta')
  returning id into v_forn;
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA CARICO pomodori', 'verdura', 'kg')
  returning id into v_ing_a;
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA CARICO basilico', 'spezie_aromi', 'kg')
  returning id into v_ing_b;

  insert into posta_ricevuta (messaggio_id, casella, oggetto, testo, stato)
  values ('PROVA-CARICO-1', 'info@borgo58.it', 'Fattura', 'fattura di prova', 'proposta')
  returning id into v_posta;

  -- Tre righe: due caricabili, una senza ingrediente — che deve essere
  -- saltata e CONTATA, non far fallire il resto.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico da fattura',
          'Carico 2 righe in magazzino',
          jsonb_build_object(
            'fornitore_id', v_forn,
            'documento', 'FT PROVA 1 del 12/08',
            'temperatura', 4.5,
            'conformita', true,
            'registra_haccp', true,
            'righe', jsonb_build_array(
              jsonb_build_object('ingrediente_id', v_ing_a, 'descrizione', 'Pomodori cassa 6 kg',
                                 'quantita', 6, 'costo_unitario', 1.80,
                                 'scadenza', (current_date + 10)::text, 'lotto', 'LOTTO-A'),
              jsonb_build_object('ingrediente_id', v_ing_b, 'descrizione', 'Basilico mazzi',
                                 'quantita', 0.5, 'costo_unitario', 12.00),
              jsonb_build_object('descrizione', 'Detersivo piatti 5 L', 'quantita', 2))))
  returning id into v_az;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_out := esegui_azione_posta(v_az);

  -- 1. Due lotti caricati, una riga saltata e dichiarata.
  if (v_out->>'lotti')::integer <> 2 then
    raise exception 'Attesi 2 lotti, ne risultano %.', v_out->>'lotti';
  end if;
  if (v_out->>'saltate')::integer <> 1 then
    raise exception 'La riga senza ingrediente doveva essere saltata e contata: saltate = %.', v_out->>'saltate';
  end if;
  if (v_out->>'haccp')::integer <> 2 then
    raise exception 'Attese 2 righe nel registro HACCP, ne risultano %.', v_out->>'haccp';
  end if;

  -- 2. Il lotto porta con sé costo, scadenza e numero di lotto del
  --    fornitore — quest'ultimo è il motivo per cui la funzione è stata
  --    ricreata, e senza verifica resterebbe una promessa.
  select * into v_lotto from stock_lots where ingredient_id = v_ing_a;
  if v_lotto.supplier_batch_number is distinct from 'LOTTO-A' then
    raise exception 'Il numero di lotto del fornitore non è stato conservato (%).', v_lotto.supplier_batch_number;
  end if;
  if v_lotto.unit_cost is distinct from 1.80 then
    raise exception 'Il costo unitario non è stato conservato (%).', v_lotto.unit_cost;
  end if;
  if v_lotto.quantity_remaining is distinct from 6 then
    raise exception 'La giacenza del lotto non parte dalla quantità ricevuta (%).', v_lotto.quantity_remaining;
  end if;

  -- 3. Il registro HACCP dice COSA è arrivato, non solo che è arrivato.
  select count(*) into n from haccp_goods_receiving
   where supplier_id = v_forn and product_description = 'Pomodori cassa 6 kg'
     and temperature_c = 4.5;
  if n <> 1 then
    raise exception 'Il registro HACCP non riporta il prodotto e la temperatura.';
  end if;

  -- 4. Secondo tocco: nessun doppione. Un carico eseguito due volte
  --    raddoppierebbe la giacenza in silenzio.
  v_out := esegui_azione_posta(v_az);
  if not coalesce((v_out->>'gia_fatta')::boolean, false) then
    raise exception 'Il secondo tocco non ha riconosciuto un carico già fatto.';
  end if;
  select count(*) into n from stock_lots where ingredient_id in (v_ing_a, v_ing_b);
  if n <> 2 then
    raise exception 'Il secondo tocco ha creato altri lotti: ora sono %.', n;
  end if;

  -- 5. La mail si chiude da sé quando non resta niente di indeciso.
  select count(*) into n from posta_ricevuta where id = v_posta and stato = 'archiviata';
  if n <> 1 then
    raise exception 'La mail non è stata archiviata dopo l''ultima azione.';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 6. Un carico senza nemmeno una riga valida non passa in silenzio.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico vuoto', 'Carico 0 righe',
          jsonb_build_object('righe', jsonb_build_array(
            jsonb_build_object('descrizione', 'roba non abbinata', 'quantita', 3))))
  returning id into v_az;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    v_out := esegui_azione_posta(v_az);
    raise exception 'Un carico senza righe valide è stato accettato.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%Nessuna riga da caricare%' then
      raise exception 'Rifiuto inatteso sul carico vuoto: %', sqlerrm;
    end if;
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 7. Pulizia (regola del 12/08): via tutto, nell'ordine dei vincoli.
  delete from haccp_goods_receiving where supplier_id = v_forn;
  delete from stock_lots where ingredient_id in (v_ing_a, v_ing_b);
  delete from posta_azioni where posta_id = v_posta;
  delete from posta_ricevuta where id = v_posta;
  delete from ingredients where id in (v_ing_a, v_ing_b);
  delete from suppliers where id = v_forn;

  select count(*) into n from stock_lots where ingredient_id in (v_ing_a, v_ing_b);
  if n <> 0 then raise exception 'La prova ha lasciato % lotti.', n; end if;
  select count(*) into n from ingredients where name like 'PROVA CARICO%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from suppliers where name like 'PROVA CARICO%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;

  raise notice 'Carico da fattura: 2 lotti, 2 righe HACCP, 1 riga saltata e dichiarata, doppio tocco innocuo.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000011', 'carico_da_fattura')
on conflict (version) do nothing;

select count(*) as lotti_in_magazzino,
       count(*) filter (where supplier_batch_number is not null) as con_numero_di_lotto
  from stock_lots;
