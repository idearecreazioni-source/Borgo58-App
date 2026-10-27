-- =====================================================================
-- LA VOCE SI CHIUDE COL DATO — magazzino, HACCP, lista della spesa
-- 27/10/2026 (secondo lotto)
-- =====================================================================
-- Il primo lotto (20261026000002) ha tolto il doppione da Prima nota e
-- Spesa spicciola: una cosa detta a MEMO e finita a mano si salvava in due
-- chiamate, prima il dato e poi la chiusura, e un errore fra le due lasciava
-- il dato scritto e la cosa «da fare». Qui la stessa cura per le altre sei
-- schermate che finiscono una cosa detta:
--
--   consumo e merce buttata   /magazzino                 record_stock_consumption
--   giacenza                  /magazzino/allineamento    allinea_giacenza
--   carico merce              /magazzino/carico          register_stock_delivery
--   temperatura               /haccp/temperature         registra_temperatura
--   pulizia                   /haccp/pulizia             (insert diretto di oggi)
--   lista della spesa         /magazzino/lista-spesa     add_shopping_list_item
--
-- ⚠️ LE FUNZIONI DI OGGI NON SI TOCCANO. Per ognuna nasce una gemella
--    `<nome>_da_voce` che prima chiude la cosa detta e poi chiama quella di
--    sempre, nella stessa transazione. Senza voce le schermate chiamano la
--    funzione di sempre, con la stessa firma: niente da ritestare per chi
--    non usa MEMO, e nessuna firma doppia per PostgREST.
--
-- ⚠️ «SOLO SE È QUELLA CHE AVEVA DETTO» RESTA ALLA SCHERMATA: se Alessio
--    aveva nominato un frigo e la lettura va su un altro, la schermata non
--    passa l'id e la cosa detta resta aperta, come oggi.
--
-- ⚠️ SECURITY INVOKER: le gemelle non aggiungono permessi. Le funzioni di
--    sempre hanno i loro controlli (sono security definer), la chiusura ha
--    il suo portiere (`is_titolare()`), e la pulizia scrive con la RLS di
--    `haccp_cleaning_logs` come l'insert diretto di oggi.
-- =====================================================================

do $prerequisiti$
begin
  -- ⚠️ Nome e argomenti separati: la rete `migrazioni-senza-portieri`
  --    legge «nome(» come una chiamata, e qui le funzioni si nominano soltanto.
  if to_regprocedure('public.chiudi_azione_dalla_schermata' || '(uuid,text,text)') is null then
    raise exception 'FERMO: manca la funzione chiudi_azione_dalla_schermata, che arriva con la 20261026000002.';
  end if;
end $prerequisiti$;

create or replace function record_stock_consumption_da_voce(
  p_azione_dettata_id uuid,
  p_ingredient_id uuid,
  p_quantity numeric,
  p_reason text default 'consumo',
  p_note text default null)
returns void
language plpgsql
security invoker -- non aggiunge permessi: chiude e poi chiama la funzione di sempre
set search_path = public
as $$
begin
  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/magazzino', 'lo scarico non e'' stato registrato.');
  perform record_stock_consumption(p_ingredient_id, p_quantity, p_reason, p_note);
end $$;

create or replace function allinea_giacenza_da_voce(
  p_azione_dettata_id uuid,
  p_ingredient_id uuid,
  p_quanto_ce numeric,
  p_note text default null)
returns jsonb
language plpgsql
security invoker -- non aggiunge permessi: chiude e poi chiama la funzione di sempre
set search_path = public
as $$
begin
  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/magazzino/allineamento', 'la giacenza non e'' stata allineata.');
  return allinea_giacenza(p_ingredient_id, p_quanto_ce, p_note);
end $$;

create or replace function register_stock_delivery_da_voce(
  p_azione_dettata_id uuid,
  p_ingredient_id uuid,
  p_quantity numeric,
  p_supplier_id uuid default null,
  p_expiry_date date default null,
  p_note text default null,
  p_unit_cost numeric default null,
  p_supplier_batch_number text default null,
  p_riga_lista uuid default null)
returns uuid
language plpgsql
security invoker -- non aggiunge permessi: chiude e poi chiama la funzione di sempre
set search_path = public
as $$
begin
  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/magazzino/carico', 'il carico non e'' stato registrato.');
  return register_stock_delivery(p_ingredient_id, p_quantity, p_supplier_id, p_expiry_date, p_note,
                                 p_unit_cost, p_supplier_batch_number, p_riga_lista);
end $$;

create or replace function registra_temperatura_da_voce(
  p_azione_dettata_id uuid,
  p_equipment_id uuid,
  p_recorded_temp_c numeric,
  p_note text default null,
  p_corrective_action text default null)
returns jsonb
language plpgsql
security invoker -- non aggiunge permessi: chiude e poi chiama la funzione di sempre
set search_path = public
as $$
begin
  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/haccp/temperature', 'la temperatura non e'' stata registrata.');
  return registra_temperatura(p_equipment_id, p_recorded_temp_c, p_note, p_corrective_action);
end $$;

create or replace function registra_pulizia_da_voce(
  p_azione_dettata_id uuid,
  p_task_id uuid,
  p_note text default null)
returns uuid
language plpgsql
security invoker -- scrive con la RLS di haccp_cleaning_logs, come l'insert diretto
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/haccp/pulizia', 'la pulizia non e'' stata registrata.');
  insert into haccp_cleaning_logs (task_id, note)
  values (p_task_id, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function add_shopping_list_item_da_voce(
  p_azione_dettata_id uuid,
  p_ingredient_id uuid default null,
  p_custom_name text default null,
  p_supplier_id uuid default null,
  p_quantity_needed numeric default null,
  p_unit unit_type default null,
  p_note text default null)
returns uuid
language plpgsql
security invoker -- non aggiunge permessi: chiude e poi chiama la funzione di sempre
set search_path = public
as $$
begin
  perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/magazzino/lista-spesa', 'la riga non e'' stata aggiunta alla lista.');
  return add_shopping_list_item(p_ingredient_id, p_custom_name, p_supplier_id, p_quantity_needed, p_unit, p_note);
end $$;

revoke all on function record_stock_consumption_da_voce(uuid, uuid, numeric, text, text) from public, anon;
revoke all on function allinea_giacenza_da_voce(uuid, uuid, numeric, text) from public, anon;
revoke all on function register_stock_delivery_da_voce(uuid, uuid, numeric, uuid, date, text, numeric, text, uuid) from public, anon;
revoke all on function registra_temperatura_da_voce(uuid, uuid, numeric, text, text) from public, anon;
revoke all on function registra_pulizia_da_voce(uuid, uuid, text) from public, anon;
revoke all on function add_shopping_list_item_da_voce(uuid, uuid, text, uuid, numeric, unit_type, text) from public, anon;
grant execute on function record_stock_consumption_da_voce(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function allinea_giacenza_da_voce(uuid, uuid, numeric, text) to authenticated;
grant execute on function register_stock_delivery_da_voce(uuid, uuid, numeric, uuid, date, text, numeric, text, uuid) to authenticated;
grant execute on function registra_temperatura_da_voce(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function registra_pulizia_da_voce(uuid, uuid, text) to authenticated;
grant execute on function add_shopping_list_item_da_voce(uuid, uuid, text, uuid, numeric, unit_type, text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — tutto provato e annullato
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto    jsonb := foto_righe();
  v_tit     uuid;
  v_det     uuid;
  v_az      uuid;
  v_sbagliata uuid;
  v_riga    uuid;
  v_rifiuti integer := 0;
  v_prima   jsonb;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    insert into dettature (testo, provenienza, esito)
    values ('prova migrazione: secondo lotto della voce', 'app', 'capita') returning id into v_det;

    -- (1) Una cosa detta di un tipo che NON si finisce da nessuna di queste
    --     schermate (`movimento_cassa` → prima nota): tutte e sei la
    --     rifiutano, e nessuna scrive niente. Il rifiuto arriva prima di
    --     ogni scrittura, quindi non servono prodotti, frighi o compiti veri.
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det, 1, 'movimento_cassa', '{}'::jsonb, true, 'ZZ verifica lotto 2', 'prova', 'in_attesa')
    returning id into v_sbagliata;

    v_prima := jsonb_build_object(
      'lotti', (select count(*) from stock_lots),
      'lista', (select count(*) from shopping_list_items),
      'pulizie', (select count(*) from haccp_cleaning_logs),
      'temperature', (select count(*) from haccp_temperature_logs));

    begin perform record_stock_consumption_da_voce(v_sbagliata, gen_random_uuid(), 1); exception when others then v_rifiuti := v_rifiuti + 1; end;
    begin perform allinea_giacenza_da_voce(v_sbagliata, gen_random_uuid(), 1); exception when others then v_rifiuti := v_rifiuti + 1; end;
    begin perform register_stock_delivery_da_voce(v_sbagliata, gen_random_uuid(), 1); exception when others then v_rifiuti := v_rifiuti + 1; end;
    begin perform registra_temperatura_da_voce(v_sbagliata, gen_random_uuid(), 4); exception when others then v_rifiuti := v_rifiuti + 1; end;
    begin perform registra_pulizia_da_voce(v_sbagliata, gen_random_uuid()); exception when others then v_rifiuti := v_rifiuti + 1; end;
    begin perform add_shopping_list_item_da_voce(v_sbagliata, null, 'ZZ verifica'); exception when others then v_rifiuti := v_rifiuti + 1; end;

    if v_rifiuti <> 6 then
      raise exception 'VERIFICA: una cosa detta di prima nota e'' stata accettata da % schermate su 6 che non la finiscono.', 6 - v_rifiuti;
    end if;
    if (select stato from azioni_dettate where id = v_sbagliata) <> 'in_attesa' then
      raise exception 'VERIFICA: la cosa detta sbagliata si e'' chiusa.';
    end if;
    if v_prima <> jsonb_build_object(
      'lotti', (select count(*) from stock_lots),
      'lista', (select count(*) from shopping_list_items),
      'pulizie', (select count(*) from haccp_cleaning_logs),
      'temperature', (select count(*) from haccp_temperature_logs)) then
      raise exception 'VERIFICA: un rifiuto ha lasciato scritto qualcosa.';
    end if;

    -- (2) Il giro completo sulla lista della spesa: la riga c'è, la cosa
    --     detta è finita a mano, e la seconda volta viene rifiutata.
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det, 2, 'lista_spesa', '{}'::jsonb, true, 'ZZ verifica lista', 'prova', 'in_attesa')
    returning id into v_az;

    v_riga := add_shopping_list_item_da_voce(v_az, null, 'ZZ verifica lotto 2');
    if not exists (select 1 from shopping_list_items where id = v_riga) then
      raise exception 'VERIFICA: la riga della lista non e'' stata scritta.';
    end if;
    if (select stato from azioni_dettate where id = v_az) is distinct from 'fatta_a_mano' then
      raise exception 'VERIFICA: la cosa detta della lista non si e'' chiusa insieme alla riga.';
    end if;

    v_rifiuti := 0;
    begin perform add_shopping_list_item_da_voce(v_az, null, 'ZZ verifica lotto 2 bis'); exception when others then v_rifiuti := 1; end;
    if v_rifiuti <> 1 or exists (select 1 from shopping_list_items where custom_name = 'ZZ verifica lotto 2 bis') then
      raise exception 'VERIFICA: la stessa cosa detta ha aggiunto una seconda riga.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del secondo lotto della voce');

  raise notice 'Fatto: consumo, giacenza, carico, temperatura, pulizia e lista della spesa dette a MEMO si chiudono col dato in una transazione; una cosa detta sbagliata viene rifiutata da tutte e sei senza scrivere. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261027000001', 'la_voce_si_chiude_col_dato_magazzino_e_haccp')
on conflict (version) do nothing;
