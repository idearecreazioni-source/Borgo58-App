-- ---------------------------------------------------------------------
-- Il registro HACCP si riempie alla porta, non dalla fattura
-- ---------------------------------------------------------------------
-- Correzione di un difetto di progetto della migrazione precedente
-- (`20260812000011`), trovato da una domanda di Alessio poche ore dopo:
-- «arriverà mai una fattura per email, o le troverò tutte in Fatture in
-- Cloud?».
--
-- La risposta ha portato a galla la cosa vera: **le fatture elettroniche
-- arrivano giorni o settimane dopo la merce.** Il carico del magazzino da
-- un documento tardivo è solo impreciso nella data. Il registro HACCP di
-- ricevimento merci, no:
--
--   la temperatura si misura quando il furgone è alla porta.
--
-- Scriverla partendo da una fattura significa registrare un controllo che
-- in quel momento nessuno ha fatto — e siccome il registro è un documento
-- esibibile a un'ispezione, è **peggio di non averlo scritto**: un
-- registro vuoto è una mancanza, un registro pieno di controlli mai
-- avvenuti è una dichiarazione falsa.
--
-- COSA CAMBIA: una riga sola, e il suo verso.
--
-- `registra_haccp` passa da «acceso salvo diverso avviso» a **spento salvo
-- richiesta esplicita**. Scelta di Alessio del 12/08/2026, fra tre
-- proposte. Il carico del magazzino resta automatico; la casella si accende
-- quando la merce è davvero lì — cioè quando arriva una bolla insieme al
-- furgone, che è il caso in cui la posta serve davvero.
--
-- PERCHÉ IL VERSO CONTA PIÙ DEL VALORE. Con il default acceso, dimenticare
-- di spegnerlo sporca un registro legale in silenzio. Con il default
-- spento, dimenticare di accenderlo lascia un buco che si vede — e che si
-- riempie dalla schermata Ricevimento Merci, che esiste da luglio ed è il
-- posto giusto. **Fra un errore silenzioso e un errore visibile si sceglie
-- sempre il secondo.**
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

  elsif v_azione.tipo = 'carico_magazzino' then
    v_forn := nullif(v_par->>'fornitore_id', '')::uuid;
    v_nota := nullif(v_par->>'documento', '');

    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'righe', '[]'::jsonb))
    loop
      v_ingr := nullif(v_riga->>'ingrediente_id', '')::uuid;
      v_qta  := nullif(v_riga->>'quantita', '')::numeric;

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

      -- ⚠️ QUI IL VERSO È CAMBIATO IL 12/08/2026, e non è una preferenza.
      -- Serve un `true` esplicito: se il campo manca, NON si scrive nulla
      -- nel registro. Un documento tardivo (una fattura elettronica arriva
      -- giorni dopo la merce) non può testimoniare una temperatura che
      -- nessuno ha misurato. Il registro si riempie alla porta.
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
  'Esegue una singola azione proposta sulla posta, dal ruolo del titolare. Il carico da fattura scrive nel registro HACCP solo su richiesta esplicita: la temperatura si misura alla porta, non si deduce da una fattura arrivata dopo.';

revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3) — il verso, nei due sensi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_ente  uuid;
  v_forn  uuid;
  v_ing   uuid;
  v_posta uuid;
  v_az    uuid;
  v_out   jsonb;
  n       integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles.';
  end if;
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then
    raise exception 'Nessuna entità in `entities`.';
  end if;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA HACCP fornitore', 'ortofrutta') returning id into v_forn;
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA HACCP pomodori', 'verdura', 'kg') returning id into v_ing;

  insert into posta_ricevuta (messaggio_id, casella, oggetto, stato)
  values ('PROVA-HACCP-1', 'info@borgo58.it', 'Fattura', 'proposta')
  returning id into v_posta;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1. Campo ASSENTE: il magazzino si carica, il registro NON si tocca.
  --    È il caso normale — una fattura che arriva dopo la merce.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico senza HACCP', 'Carico 1 riga',
          jsonb_build_object('fornitore_id', v_forn, 'righe', jsonb_build_array(
            jsonb_build_object('ingrediente_id', v_ing, 'descrizione', 'Pomodori',
                               'quantita', 5))))
  returning id into v_az;

  v_out := esegui_azione_posta(v_az);
  if (v_out->>'lotti')::integer <> 1 then
    raise exception 'Il carico non è avvenuto: lotti = %.', v_out->>'lotti';
  end if;
  if (v_out->>'haccp')::integer <> 0 then
    raise exception 'Senza richiesta esplicita il registro HACCP è stato scritto lo stesso (% righe).', v_out->>'haccp';
  end if;
  select count(*) into n from haccp_goods_receiving where supplier_id = v_forn;
  if n <> 0 then
    raise exception 'Il registro HACCP contiene % righe che nessuno ha chiesto.', n;
  end if;

  -- 2. Campo a `true`: il registro si scrive, perché la merce era lì.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico con HACCP', 'Carico 1 riga',
          jsonb_build_object('fornitore_id', v_forn, 'registra_haccp', true,
            'temperatura', 4, 'righe', jsonb_build_array(
              jsonb_build_object('ingrediente_id', v_ing, 'descrizione', 'Pomodori',
                                 'quantita', 5))))
  returning id into v_az;

  v_out := esegui_azione_posta(v_az);
  if (v_out->>'haccp')::integer <> 1 then
    raise exception 'Con la richiesta esplicita il registro non è stato scritto (% righe).', v_out->>'haccp';
  end if;

  -- 3. E `false` resta `false`: non basta che il campo ci sia.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico con HACCP spento', 'Carico 1 riga',
          jsonb_build_object('fornitore_id', v_forn, 'registra_haccp', false,
            'righe', jsonb_build_array(
              jsonb_build_object('ingrediente_id', v_ing, 'descrizione', 'Pomodori',
                                 'quantita', 5))))
  returning id into v_az;

  v_out := esegui_azione_posta(v_az);
  if (v_out->>'haccp')::integer <> 0 then
    raise exception 'Con la casella spenta il registro è stato scritto lo stesso.';
  end if;

  select count(*) into n from haccp_goods_receiving where supplier_id = v_forn;
  if n <> 1 then
    raise exception 'Attesa una sola riga di registro su tre carichi, trovate %.', n;
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 4. Pulizia (regola del 12/08).
  delete from haccp_goods_receiving where supplier_id = v_forn;
  delete from stock_lots where ingredient_id = v_ing;
  delete from posta_azioni where posta_id = v_posta;
  delete from posta_ricevuta where id = v_posta;
  delete from ingredients where id = v_ing;
  delete from suppliers where id = v_forn;

  select count(*) into n from ingredients where name like 'PROVA HACCP%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from suppliers where name like 'PROVA HACCP%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;

  raise notice 'HACCP alla porta: campo assente = niente registro, true = registro, false = niente.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000012', 'haccp_alla_porta')
on conflict (version) do nothing;

select count(*) as righe_registro_haccp from haccp_goods_receiving;
