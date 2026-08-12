-- ---------------------------------------------------------------------
-- Le versioni di uno stesso prodotto, e quale conviene
-- ---------------------------------------------------------------------
-- Idea di Alessio, 12/08/2026, in risposta a un buco che gli avevo
-- dichiarato («se cambia il formato il confronto al litro grida al lupo»).
-- La sua proposta risolve più di quanto chiedessi:
--
--   «se il sistema rileva lo stesso prodotto ma con variabili diverse non
--    mi avverte? Io vedo tutte le versioni di olio che ho comprato e
--    scelgo consapevolmente cosa continuare a comprare:
--      · olio A da 5 L, 1 €/l, fornitore A
--      · olio B da 1 L, 2 €/l, fornitore A
--      · olio B da 1 L, 3 €/l, fornitore B
--    così vedo anche se ci sono fornitori più convenienti sullo stesso
--    identico prodotto.»
--
-- Avevo separato due cose che per lui sono una sola, e aveva ragione lui.
--
-- COSA CAMBIA
--
-- 1. **Il prezzo si lega alla versione, non solo all'ingrediente.**
--    `price_history.articolo_id`. Senza, «olio da 5 L» e «olio da 1 L»
--    finivano nella stessa fila e ogni cambio di formato sembrava un
--    rincaro del 100%: un allarme che grida per una cosa normale è
--    quello che insegna a non leggere gli allarmi.
-- 2. **L'allarme confronta la stessa versione**, non l'ingrediente:
--    lattina da 5 con lattina da 5, dallo stesso fornitore. È la sola
--    domanda a cui un allarme può rispondere onestamente — «mi hanno
--    aumentato il prezzo».
-- 3. **`varianti_ingrediente()` risponde all'altra domanda**, quella che
--    non è un allarme ma una decisione: cosa compro, da chi, a quanto.
--    È la tabella che Alessio ha disegnato, ordinata dalla più
--    conveniente.
-- 4. **`stesso_di`**: due diciture di fornitori diversi possono essere lo
--    stesso identico prodotto, e il gestionale **non può saperlo** — vede
--    due stringhe. Le mette una sotto l'altra e lo vede lui; se le
--    collega una volta, da lì in poi le confronta da sole e il rincaro
--    fra fornitori diventa un allarme vero.
--
-- ⚠️ IL PREZZO SI CONFRONTA ANCORA PRIMA DI SCRIVERLO, e adesso c'è un
-- ordine in più da rispettare: la dicitura va memorizzata **prima**, per
-- avere l'identità della versione, ma il confronto va fatto **prima** che
-- il prezzo nuovo entri nello storico. Invertendo l'uno o l'altro non si
-- rompe niente: semplicemente nessun rincaro viene mai visto.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Il prezzo appartiene a una versione
-- ---------------------------------------------------------------------
alter table price_history
  add column if not exists articolo_id uuid references articoli_fornitore(id) on delete set null;

comment on column price_history.articolo_id is
  'La versione comprata: marca e formato, cioe'' la dicitura del fornitore. Senza, formati diversi finiscono nella stessa fila e ogni cambio di confezione sembra un rincaro.';

create index if not exists idx_price_history_articolo
  on price_history (articolo_id, recorded_at desc);

-- Due diciture di fornitori diversi che sono lo stesso identico prodotto.
-- Nullo quasi sempre: lo compila Alessio quando lo nota, non il modello.
alter table articoli_fornitore
  add column if not exists stesso_di uuid references articoli_fornitore(id) on delete set null;

comment on column articoli_fornitore.stesso_di is
  'Punta alla versione «capo» quando due fornitori vendono lo stesso identico prodotto con diciture diverse. Lo collega Alessio, perche'' il gestionale vede due stringhe e non puo'' saperlo.';

-- ---------------------------------------------------------------------
-- 2. Il punto di scrittura del prezzo impara la versione
-- ---------------------------------------------------------------------
-- Un parametro in piu' e' una funzione nuova: la vecchia firma va tolta,
-- altrimenti le chiamate per nome diventano ambigue (42725, a runtime).
drop function if exists update_ingredient_price(uuid, numeric, price_source, text, uuid);

create or replace function update_ingredient_price(
  p_ingredient_id uuid,
  p_new_price     numeric,
  p_source        price_source default 'manuale',
  p_note          text default null,
  p_supplier_id   uuid default null,
  p_articolo_id   uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update ingredients
     set current_price = p_new_price,
         updated_at = now()
   where id = p_ingredient_id;

  if not found then
    raise exception 'Ingrediente % inesistente', p_ingredient_id;
  end if;

  insert into price_history (ingredient_id, price, supplier_id, source, note, articolo_id)
  values (p_ingredient_id, p_new_price, p_supplier_id, p_source, p_note, p_articolo_id);
end;
$$;

comment on function update_ingredient_price(uuid, numeric, price_source, text, uuid, uuid) is
  'Unico punto di scrittura del prezzo di un ingrediente e del suo storico. Dal 12/08/2026 registra anche QUALE versione si e'' comprata: senza, formati diversi si confrontano fra loro.';

revoke all on function update_ingredient_price(uuid, numeric, price_source, text, uuid, uuid) from public, anon;
grant execute on function update_ingredient_price(uuid, numeric, price_source, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. La decisione: e' salito il prezzo DELLA STESSA VERSIONE?
-- ---------------------------------------------------------------------
drop function if exists variazione_prezzo(uuid, uuid, numeric);

create or replace function variazione_prezzo(
  p_articolo_id uuid,
  p_prezzo      numeric
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
  v_capo   uuid;
  v_ingr   uuid;
  v_prec   numeric;
  v_quando timestamptz;
  v_primo  numeric;
  v_qprimo timestamptz;
  v_soglia numeric;
  v_avvisa boolean;
begin
  if p_articolo_id is null or p_prezzo is null or p_prezzo <= 0 then
    return;
  end if;

  -- Il gruppo di confronto: la versione stessa, piu' le diciture che
  -- Alessio ha dichiarato essere lo stesso identico prodotto. Finche' non
  -- collega niente, il gruppo e' una versione sola.
  select coalesce(a.stesso_di, a.id), a.ingredient_id into v_capo, v_ingr
    from articoli_fornitore a where a.id = p_articolo_id;
  if v_capo is null then
    return;
  end if;

  select ph.price, ph.recorded_at into v_prec, v_quando
    from price_history ph
    join articoli_fornitore a on a.id = ph.articolo_id
   where coalesce(a.stesso_di, a.id) = v_capo
   order by ph.recorded_at desc
   limit 1;

  if v_prec is null or v_prec <= 0 then
    return;   -- prima volta che si compra questa versione
  end if;

  -- Il piu' VECCHIO, non il minimo: il minimo darebbe la variazione piu'
  -- spettacolare invece di quella vera.
  select ph.price, ph.recorded_at into v_primo, v_qprimo
    from price_history ph
    join articoli_fornitore a on a.id = ph.articolo_id
   where coalesce(a.stesso_di, a.id) = v_capo
   order by ph.recorded_at asc
   limit 1;

  select coalesce(s.soglia_rincaro_percento, 0) into v_soglia
    from service_settings s where s.id = 1;
  v_soglia := coalesce(v_soglia, 0);

  select i.avvisa_rincari into v_avvisa from ingredients i where i.id = v_ingr;

  return query select
    v_prec,
    v_quando,
    round((p_prezzo - v_prec) / v_prec * 100, 1),
    v_primo,
    v_qprimo,
    case when v_primo > 0 then round((p_prezzo - v_primo) / v_primo * 100, 1) end,
    coalesce(v_avvisa, true)
      and p_prezzo > v_prec * (1 + v_soglia / 100);
end
$funzione$;

comment on function variazione_prezzo(uuid, numeric) is
  'Se e di quanto e'' salito il prezzo della STESSA versione (marca e formato) dallo stesso fornitore, o dalle diciture dichiarate equivalenti. Decide e basta: non avvisa nessuno.';

revoke all on function variazione_prezzo(uuid, numeric) from public, anon;
grant execute on function variazione_prezzo(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4. La tabella di Alessio: cosa compro di questo, da chi, a quanto
-- ---------------------------------------------------------------------
create or replace function varianti_ingrediente(p_ingredient_id uuid)
returns table (
  articolo_id   uuid,
  descrizione   text,
  fornitore     text,
  fornitore_id  uuid,
  unita_fattura text,
  fattore       numeric,
  prezzo        numeric,
  ultima_volta  timestamptz,
  acquisti      integer,
  stesso_di     uuid
)
language sql
stable
security definer
set search_path = public
as $funzione$
  select a.id,
         a.descrizione,
         s.name,
         a.supplier_id,
         a.unita_fattura,
         a.fattore,
         ultimo.price,
         ultimo.recorded_at,
         coalesce(conta.n, 0)::integer,
         a.stesso_di
    from articoli_fornitore a
    left join suppliers s on s.id = a.supplier_id
    left join lateral (
      select ph.price, ph.recorded_at
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    left join lateral (
      select count(*) as n from price_history ph where ph.articolo_id = a.id
    ) conta on true
   where a.ingredient_id = p_ingredient_id
     and not a.ignora
   -- Dalla piu' conveniente: e' la domanda che si fa guardando questa
   -- tabella. Chi non ha ancora un prezzo sta in fondo, non in cima.
   order by ultimo.price asc nulls last, a.descrizione;
$funzione$;

comment on function varianti_ingrediente(uuid) is
  'Le versioni di un ingrediente che sono state comprate davvero: marca, formato, fornitore, ultimo prezzo per unita''. Ordinate dalla piu'' conveniente. Risponde a «chi me lo fa meglio», che e'' una decisione e non un allarme.';

revoke all on function varianti_ingrediente(uuid) from public, anon;
grant execute on function varianti_ingrediente(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. «Queste due sono lo stesso identico prodotto»
-- ---------------------------------------------------------------------
create or replace function collega_articoli(p_articolo uuid, p_stesso_di uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_a articoli_fornitore%rowtype;
  v_b articoli_fornitore%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' collegare due versioni';
  end if;

  select * into v_a from articoli_fornitore where id = p_articolo;
  if not found then raise exception 'Versione inesistente'; end if;

  -- Scollegare: si passa null e torna indipendente.
  if p_stesso_di is null then
    update articoli_fornitore set stesso_di = null where id = p_articolo;
    return;
  end if;

  select * into v_b from articoli_fornitore where id = p_stesso_di;
  if not found then raise exception 'Versione inesistente'; end if;

  if v_a.ingredient_id is distinct from v_b.ingredient_id then
    raise exception 'Sono due ingredienti diversi: non possono essere lo stesso prodotto';
  end if;
  if p_articolo = p_stesso_di then
    raise exception 'Una versione non puo'' essere lo stesso prodotto di se stessa';
  end if;

  -- Si punta sempre al capo, mai a un anello intermedio: due salti
  -- renderebbero il gruppo di confronto dipendente dall'ordine in cui
  -- sono stati fatti i collegamenti.
  update articoli_fornitore
     set stesso_di = coalesce(v_b.stesso_di, v_b.id)
   where id = p_articolo;
end
$funzione$;

comment on function collega_articoli(uuid, uuid) is
  'Dichiara che due diciture sono lo stesso identico prodotto, cosi'' il confronto dei prezzi le tratta insieme anche fra fornitori diversi. Lo decide Alessio: il gestionale vede due stringhe e non puo'' saperlo.';

revoke all on function collega_articoli(uuid, uuid) from public, anon;
grant execute on function collega_articoli(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5-bis. La riga proposta porta con sé quale versione è
-- ---------------------------------------------------------------------
-- Serve alla schermata di conferma: senza l'identità della versione non
-- può dire «questa l'hai già comprata a tanto» PRIMA che tu confermi, che
-- è il solo momento in cui non registrare una fattura sbagliata è ancora
-- gratis.
create or replace function abbina_righe_carico()
returns trigger
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_forn  uuid;
  v_riga  jsonb;
  v_out   jsonb := '[]'::jsonb;
  v_art   articoli_fornitore%rowtype;
  n_noti  integer := 0;
begin
  if new.tipo <> 'carico_magazzino' then
    return new;
  end if;

  v_forn := nullif(new.parametri->>'fornitore_id', '')::uuid;

  for v_riga in select * from jsonb_array_elements(coalesce(new.parametri->'righe', '[]'::jsonb))
  loop
    select * into v_art from articoli_fornitore a
     where a.chiave = chiave_articolo(v_riga->>'descrizione')
       and (a.supplier_id is not distinct from v_forn or v_forn is null)
     order by (a.supplier_id is not distinct from v_forn) desc
     limit 1;

    if found then
      n_noti := n_noti + 1;
      v_riga := v_riga
        || jsonb_build_object(
             'ingrediente_id', v_art.ingredient_id,
             'articolo_id',    v_art.id,
             'fattore',        v_art.fattore,
             'unita_fattura',  v_art.unita_fattura,
             'salta',          v_art.ignora,
             'gia_noto',       true);
    end if;

    v_out := v_out || jsonb_build_array(v_riga);
  end loop;

  new.parametri := new.parametri
    || jsonb_build_object('righe', v_out, 'righe_note', n_noti);
  return new;
end
$funzione$;

-- ---------------------------------------------------------------------
-- 6. Il carico scrive la versione, e confronta la versione
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

      -- ⚠️ ORDINE. La dicitura si memorizza PRIMA, perche' serve
      -- l'identita' della versione per confrontare; il confronto avviene
      -- PRIMA che il prezzo nuovo entri nello storico, altrimenti trova
      -- se stesso. Invertendo l'uno o l'altro non si rompe niente: non si
      -- vede mai nessun rincaro, ed e' un guasto che non lascia tracce.
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
-- 7. Verifica (§7 punti 1-3) — la scena di Alessio, per intero
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_ente  uuid;
  v_fa    uuid;
  v_fb    uuid;
  v_ing   uuid;
  v_a5    uuid;
  v_a1a   uuid;
  v_a1b   uuid;
  v_var   record;
  n       integer;
  v_riga  record;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Servono un titolare e un''entita''.';
  end if;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA VARIANTI fornitore A', 'secco') returning id into v_fa;
  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA VARIANTI fornitore B', 'secco') returning id into v_fb;
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA VARIANTI olio', 'olio_condimenti', 'l') returning id into v_ing;

  -- Le tre versioni dell'esempio di Alessio.
  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore)
  values (v_fa, 'Olio A lattina 5 L', chiave_articolo('Olio A lattina 5 L'), v_ing, 'lattina', 5)
  returning id into v_a5;
  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore)
  values (v_fa, 'Olio B bottiglia 1 L', chiave_articolo('Olio B bottiglia 1 L'), v_ing, 'pz', 1)
  returning id into v_a1a;
  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore)
  values (v_fb, 'Olio B bott. da 1 litro', chiave_articolo('Olio B bott. da 1 litro'), v_ing, 'pz', 1)
  returning id into v_a1b;

  insert into price_history (ingredient_id, price, supplier_id, source, articolo_id)
  values (v_ing, 1.00, v_fa, 'fattura', v_a5),
         (v_ing, 2.00, v_fa, 'fattura', v_a1a),
         (v_ing, 3.00, v_fb, 'fattura', v_a1b);

  -- 1. IL DIFETTO CHE QUESTA MIGRAZIONE CHIUDE: comprare il formato da 1 L
  --    a 2 €/l dopo averne comprato uno da 5 L a 1 €/l NON è un rincaro.
  --    Prima il confronto era per ingrediente e avrebbe gridato +100%.
  select * into v_var from variazione_prezzo(v_a1a, 2.00);
  if v_var.da_segnalare then
    raise exception 'Un formato diverso viene ancora scambiato per un rincaro.';
  end if;
  if v_var.prezzo_precedente is distinct from 2.00 then
    raise exception 'Il confronto non e'' sulla stessa versione (precedente = %).', v_var.prezzo_precedente;
  end if;

  -- 2. Sulla STESSA versione, invece, il rincaro si vede.
  select * into v_var from variazione_prezzo(v_a5, 1.10);
  if not v_var.da_segnalare then
    raise exception 'Un rincaro sulla stessa versione non viene segnalato.';
  end if;
  if v_var.variazione is distinct from 10.0 then
    raise exception 'La variazione e'' % invece di 10.', v_var.variazione;
  end if;

  -- 3. LA TABELLA DI ALESSIO: tre versioni, dalla piu' conveniente.
  select count(*) into n from varianti_ingrediente(v_ing);
  if n <> 3 then raise exception 'Attese 3 versioni, trovate %.', n; end if;

  select * into v_riga from varianti_ingrediente(v_ing) limit 1;
  if v_riga.prezzo is distinct from 1.00 then
    raise exception 'La prima versione non e'' la piu'' conveniente (%).', v_riga.prezzo;
  end if;
  if v_riga.fornitore is distinct from 'PROVA VARIANTI fornitore A' then
    raise exception 'La tabella non riporta il fornitore.';
  end if;

  -- 4. Finché non sono collegate, lo stesso prodotto da due fornitori
  --    resta due versioni distinte: il gestionale vede due stringhe.
  select * into v_var from variazione_prezzo(v_a1b, 3.00);
  if v_var.da_segnalare then
    raise exception 'Due diciture non collegate vengono confrontate lo stesso.';
  end if;

  -- 5. Collegate da Alessio, il confronto le tratta insieme — ed e' li'
  --    che «lo stesso prodotto da B lo paghi 3 invece di 2» diventa un
  --    allarme vero.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform collega_articoli(v_a1b, v_a1a);

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  select stesso_di into v_riga from articoli_fornitore where id = v_a1b;
  select * into v_var from variazione_prezzo(v_a1b, 3.00);
  if not v_var.da_segnalare then
    raise exception 'Dopo il collegamento, 3 contro 2 non produce nessun avviso.';
  end if;
  if v_var.variazione is distinct from 50.0 then
    raise exception 'La differenza fra i due fornitori e'' % invece di 50.', v_var.variazione;
  end if;

  -- 6. Non si collegano versioni di ingredienti diversi.
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform collega_articoli(v_a5, v_a5);
    raise exception 'Una versione e'' stata collegata a se stessa.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%se stessa%' then
      raise exception 'Rifiuto inatteso: %', sqlerrm;
    end if;
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 7. Pulizia (regola del 12/08).
  delete from price_history where ingredient_id = v_ing;
  delete from articoli_fornitore where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  delete from suppliers where id in (v_fa, v_fb);

  select count(*) into n from ingredients where name like 'PROVA VARIANTI%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from suppliers where name like 'PROVA VARIANTI%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;

  raise notice 'Varianti: formato diverso non e'' rincaro, stessa versione si'', tabella dalla piu'' conveniente, collegamento fra fornitori.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000016', 'varianti_e_convenienza')
on conflict (version) do nothing;

select (select count(*) from articoli_fornitore) as versioni,
       (select count(*) from price_history where articolo_id is not null) as prezzi_con_versione;
