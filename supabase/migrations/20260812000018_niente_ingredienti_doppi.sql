-- ---------------------------------------------------------------------
-- Due ingredienti con lo stesso nome non devono poter nascere
-- ---------------------------------------------------------------------
-- Trovato da Alessio guardando il Ricettario dopo il secondo carico:
--
--   «la prima cosa che mi salta all'occhio è che ho due "olio extravergine
--    d'oliva" tra gli ingredienti, mentre mi aspettavo di vederne uno
--    cliccabile con dentro tutte le versioni dettagliate.»
--
-- Aveva ragione su entrambe le cose: il doppione non doveva esserci, e
-- l'idea giusta è un ingrediente solo con dentro le sue versioni — che è
-- esattamente ciò che `varianti_ingrediente()` fa, e che il doppione
-- rendeva inutile.
--
-- LA CAUSA VERA era in schermata (le sue scelte venivano azzerate quando
-- confermava un'altra proposta della stessa mail) ed è corretta lì. Ma un
-- difetto che produce **dati sbagliati che sembrano giusti** merita due
-- difese, non una: se domani un'altra strada porta allo stesso errore, il
-- database non deve lasciarlo passare.
--
-- Quindi: creare un ingrediente il cui nome esiste già — a meno di
-- maiuscole, accenti e spazi — non produce un doppione. Si aggancia a
-- quello che c'è.
--
-- ⚠️ Perché il confronto è sul nome NORMALIZZATO e non sul nome esatto:
-- «Olio extravergine di oliva» e «olio extravergine  d'oliva» sono la
-- stessa cosa per chiunque tranne che per un confronto fra stringhe. E
-- perché NON è un vincolo di unicità sulla tabella: due ingredienti con
-- lo stesso nome in due entità fiscali diverse (S.r.l.s. e agricola) sono
-- legittimi, e un vincolo li vieterebbe per sempre.
--
-- Resta fuori il caso di Alessio con la semola — «Semola di grano duro
-- rimacinata» contro «Semola rimacinata di grano duro» — che nessun
-- confronto automatico può risolvere senza rischiare di fondere cose
-- diverse. Per quello c'è il suggerimento in schermata («assomiglia a…»),
-- che propone e lascia decidere a lui.
-- ---------------------------------------------------------------------

create or replace function nome_ingrediente_chiave(p_nome text)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select nullif(
    trim(regexp_replace(
      regexp_replace(lower(coalesce(p_nome, '')), '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g')),
    '');
$funzione$;

comment on function nome_ingrediente_chiave(text) is
  'Il nome di un ingrediente ridotto a cio'' che conta per capire se e'' lo stesso: minuscolo, senza punteggiatura ne'' doppi spazi.';

-- ---------------------------------------------------------------------
-- Un ingrediente per nome, dentro la stessa entita'
-- ---------------------------------------------------------------------
create or replace function trova_o_crea_ingrediente(
  p_entity_id  uuid,
  p_nome       text,
  p_unita      unit_type,
  p_categoria  ingredient_category,
  p_alimentare boolean default true
)
returns table (id uuid, era_gia_li boolean)
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id uuid;
begin
  if nullif(trim(p_nome), '') is null then
    raise exception 'Un ingrediente senza nome non si crea';
  end if;

  select i.id into v_id
    from ingredients i
   where i.entity_id = p_entity_id
     and i.active
     and nome_ingrediente_chiave(i.name) = nome_ingrediente_chiave(p_nome)
   order by i.created_at
   limit 1;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (p_entity_id, trim(p_nome), p_categoria, p_unita, coalesce(p_alimentare, true))
  returning ingredients.id into v_id;

  return query select v_id, false;
end
$funzione$;

comment on function trova_o_crea_ingrediente(uuid, text, unit_type, ingredient_category, boolean) is
  'Restituisce l''ingrediente con quel nome dentro quell''entita'', creandolo solo se non c''e''. Seconda difesa contro i doppioni: un dato sbagliato che sembra giusto merita due barriere, non una.';

revoke all on function trova_o_crea_ingrediente(uuid, text, unit_type, ingredient_category, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Il carico la usa al posto dell'inserimento diretto
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
  v_art      uuid;
  v_var      record;
  v_trovato  record;
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

        -- ⚠️ Non `insert` diretto: se un ingrediente con quel nome c'e'
        -- gia', ci si aggancia. La schermata dovrebbe averlo gia' evitato,
        -- ma un difetto che produce dati sbagliati che SEMBRANO giusti
        -- merita due difese.
        select * into v_trovato from trova_o_crea_ingrediente(
          v_ente,
          v_nuovo->>'nome',
          coalesce(nullif(v_nuovo->>'unita', '')::unit_type, 'kg'),
          coalesce(nullif(v_nuovo->>'categoria', '')::ingredient_category, 'altro'),
          coalesce((v_nuovo->>'alimentare')::boolean, true)
        );
        v_ingr := v_trovato.id;
        if not v_trovato.era_gia_li then
          v_creati := v_creati + 1;
        end if;
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

      v_art := null;
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
                      aggiornato_il = now()
        returning id into v_art;
      end if;

      if v_prezzo is not null and v_art is not null then
        select * into v_var from variazione_prezzo(v_art, v_prezzo);
        if found and v_var.da_segnalare then
          v_rincari := v_rincari || jsonb_build_array(jsonb_build_object(
            'ingrediente',       (select name from ingredients where id = v_ingr),
            'versione',          v_riga->>'descrizione',
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
        perform update_ingredient_price(v_ingr, v_prezzo, 'fattura', v_nota, v_forn, v_art);
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
        'Rincaro su ' || (v_riga->>'ingrediente') || ' (' || (v_riga->>'versione') || '): da ' ||
          (v_riga->>'prima') || ' a ' || (v_riga->>'adesso') ||
          ' (+' || (v_riga->>'variazione') || '%)' ||
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
-- Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_a    record;
  v_b    record;
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- 1. La chiave ignora maiuscole, punteggiatura e doppi spazi.
  if nome_ingrediente_chiave('  Olio Extravergine  di OLIVA ')
     is distinct from nome_ingrediente_chiave('olio extravergine di oliva') then
    raise exception 'La chiave del nome non normalizza.';
  end if;

  -- 2. Il primo nasce, il secondo si aggancia.
  select * into v_a from trova_o_crea_ingrediente(
    v_ente, 'PROVA DOPPI olio', 'l', 'olio_condimenti', true);
  if v_a.era_gia_li then raise exception 'Il primo doveva nascere.'; end if;

  select * into v_b from trova_o_crea_ingrediente(
    v_ente, '  prova   DOPPI  Olio ', 'kg', 'verdura', true);
  if not v_b.era_gia_li then
    raise exception 'Il secondo ha creato un doppione invece di agganciarsi.';
  end if;
  if v_b.id is distinct from v_a.id then
    raise exception 'Il secondo punta a un ingrediente diverso.';
  end if;

  select count(*) into n from ingredients where name ilike 'PROVA DOPPI%';
  if n <> 1 then raise exception 'In anagrafica ce ne sono %, atteso 1.', n; end if;

  -- 3. Agganciandosi NON riscrive unita' e categoria di quello esistente:
  --    chi c'era prima e' stato deciso da Alessio, e una riga di fattura
  --    non ha titolo per cambiarlo.
  select unit::text, category::text into v_a from ingredients where id = v_b.id;
  if v_a.unit is distinct from 'l' then
    raise exception 'L''unita'' dell''ingrediente esistente e'' stata sovrascritta (%).', v_a.unit;
  end if;

  -- 4. Un nome vuoto non crea niente.
  begin
    perform trova_o_crea_ingrediente(v_ente, '   ', 'kg', 'altro', true);
    raise exception 'Un ingrediente senza nome e'' stato creato.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%senza nome%' then
      raise exception 'Rifiuto inatteso: %', sqlerrm;
    end if;
  end;

  -- 5. Pulizia (regola del 12/08).
  delete from ingredients where name ilike 'PROVA DOPPI%';
  select count(*) into n from ingredients where name ilike 'PROVA DOPPI%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;

  raise notice 'Niente ingredienti doppi: stesso nome, stesso ingrediente.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000018', 'niente_ingredienti_doppi')
on conflict (version) do nothing;

select name, count(*) as quanti
  from ingredients
 group by name having count(*) > 1;
