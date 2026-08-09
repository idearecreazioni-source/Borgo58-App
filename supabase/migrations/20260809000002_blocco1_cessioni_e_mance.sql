-- ---------------------------------------------------------------------
-- Blocco 1 del Piano correzioni: cessioni intercompany e mance atomiche
-- ---------------------------------------------------------------------
-- Le due operazioni a rischio fiscale diretto del Piano (Attivita' 2 e 3),
-- oggi eseguite dal browser come scritture separate:
--
--  - createCession: insert della cessione, POI aggiornamento del costo
--    ingrediente. Un fallimento a meta' lascia una cessione fatturata fra
--    le due aziende senza il costo che la giustifica — o viceversa.
--  - createTipDistribution: insert dell'intestazione col totale, POI le
--    righe per dipendente. Un fallimento a meta' lascia un totale
--    "distribuito" che non ha assegnato nulla a nessuno: il saldo mance
--    risulterebbe scalato senza destinatari.
--
-- Da questa migrazione entrambe diventano UNA funzione Postgres (una
-- chiamata = una transazione), invocata dal client solo attraverso la
-- Edge Function `operazioni-atomiche` (Contratto B4, decisione di Alessio
-- del 09/08/2026).
--
-- Miglioramenti che arrivano insieme all'atomicita':
--  1. il TOTALE della distribuzione mance lo calcola il database dalle
--     righe (il client lo calcolava sommando anche importi negativi che
--     poi non inseriva: totale e righe potevano divergere gia' in
--     partenza);
--  2. respinti importi negativi e dipendenti duplicati nella stessa
--     distribuzione;
--  3. update_ingredient_price (esistente dal 30/07) viene blindata: prima
--     accettava prezzi NULL o negativi senza batter ciglio — un prezzo
--     negativo finiva in ingredients E nello storico. Ora rifiuta. Lo
--     ZERO resta ammesso: la raccolta propria (erbe spontanee) ha
--     legittimamente costo zero.
--
-- Idempotente (§7 punto 3): rieseguibile senza danni.

-- ---------------------------------------------------------------------
-- 0. Blindatura di update_ingredient_price (falla trovata nell'audit)
-- ---------------------------------------------------------------------
-- Resta SECURITY INVOKER com'era (la RLS del chiamante deve applicarsi:
-- i prezzi sono materia del titolare); aggiunti il search_path esplicito
-- e il rifiuto di prezzi nulli o negativi.
create or replace function update_ingredient_price(
  p_ingredient_id uuid,
  p_new_price     numeric,
  p_source        price_source default 'manuale',
  p_note          text default null,
  p_supplier_id   uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_new_price is null or p_new_price < 0 then
    raise exception 'Il prezzo non puo'' essere negativo o mancante';
  end if;

  update ingredients
     set current_price = p_new_price,
         updated_at = now()
   where id = p_ingredient_id;

  if not found then
    raise exception 'Ingrediente % inesistente', p_ingredient_id;
  end if;

  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (p_ingredient_id, p_new_price, p_supplier_id, p_source, p_note);
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Cessione intercompany atomica
-- ---------------------------------------------------------------------
create or replace function create_intercompany_cession(
  p_seller_entity_id       uuid,
  p_buyer_entity_id        uuid,
  p_product_description    text,
  p_quantity               numeric,
  p_unit                   unit_type,
  p_unit_price             numeric,
  p_cession_date           date,
  p_ingredient_id          uuid default null,
  p_vat_rate               numeric default null,
  p_fiscal_document_type   text default null,
  p_invoice_reference      text default null,
  p_notes                  text default null,
  p_update_ingredient_cost boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- 1. AUTORIZZAZIONE — la funzione e' SECURITY DEFINER e scavalca la
  -- RLS, quindi il controllo va rifatto qui, non dato per scontato.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare una cessione fra le due aziende';
  end if;

  -- 2. VALIDAZIONI
  if p_product_description is null or btrim(p_product_description) = '' then
    raise exception 'Serve la descrizione del prodotto ceduto';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantita'' deve essere maggiore di zero';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Il prezzo unitario non puo'' essere negativo o mancante';
  end if;
  if p_cession_date is null then
    raise exception 'Serve la data della cessione';
  end if;
  if p_seller_entity_id = p_buyer_entity_id then
    raise exception 'Le due aziende della cessione devono essere diverse';
  end if;

  -- 3. SCRITTURE — tutte nella stessa transazione.
  -- Il totale lo calcola il database, non il client.
  insert into intercompany_cessions (
    seller_entity_id, buyer_entity_id, ingredient_id, product_description,
    quantity, unit, unit_price, vat_rate, total_amount, cession_date,
    fiscal_document_type, invoice_reference, notes
  ) values (
    p_seller_entity_id, p_buyer_entity_id, p_ingredient_id,
    btrim(p_product_description), p_quantity, p_unit, p_unit_price,
    p_vat_rate, round(p_quantity * p_unit_price, 2), p_cession_date,
    p_fiscal_document_type, p_invoice_reference, p_notes
  )
  returning id into v_id;

  -- Aggiornamento del costo ingrediente nella STESSA transazione: se
  -- fallisce, anche la cessione sparisce (§1: costo produzione interna =
  -- prezzo di trasferimento — o entrambi o nessuno).
  -- Comportamento invariato rispetto al client di prima: se manca
  -- l'ingrediente collegato, l'aggiornamento si salta in silenzio.
  if p_update_ingredient_cost and p_ingredient_id is not null then
    perform update_ingredient_price(
      p_ingredient_id, p_unit_price, 'cessione_interna',
      'Cessione intercompany del ' || p_cession_date::text, null
    );
  end if;

  return v_id;
end;
$$;

comment on function create_intercompany_cession is
  'Registra una cessione agricola->S.r.l.s. e (se richiesto) aggiorna il costo dell''ingrediente nella stessa transazione. Totale calcolato dal database. Solo titolare — il controllo e'' interno, non delegato alla schermata.';

revoke all on function create_intercompany_cession(uuid, uuid, text, numeric, unit_type, numeric, date, uuid, numeric, text, text, text, boolean) from public;
grant execute on function create_intercompany_cession(uuid, uuid, text, numeric, unit_type, numeric, date, uuid, numeric, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Distribuzione mance atomica
-- ---------------------------------------------------------------------
create or replace function create_tip_distribution(
  p_entity_id    uuid,
  p_period_month date,
  p_lines        jsonb,
  p_note         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_totale  numeric(12,2);
  v_righe   integer;
  v_distinti integer;
begin
  -- 1. AUTORIZZAZIONE
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' distribuire le mance';
  end if;

  -- 2. VALIDAZIONI
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Nessuna riga da distribuire';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) as r
    where (r->>'amount')::numeric < 0
  ) then
    raise exception 'Un importo negativo non e'' ammesso in una distribuzione';
  end if;

  select count(*), count(distinct (r->>'employee_id')::uuid),
         coalesce(sum((r->>'amount')::numeric), 0)
    into v_righe, v_distinti, v_totale
  from jsonb_array_elements(p_lines) as r
  where (r->>'amount')::numeric > 0;

  if v_righe = 0 then
    raise exception 'Nessun importo da distribuire: tutte le righe sono a zero';
  end if;
  if v_distinti <> v_righe then
    raise exception 'Lo stesso dipendente compare piu'' di una volta nella distribuzione';
  end if;

  -- 3. SCRITTURE — intestazione e righe nella stessa transazione, col
  -- totale calcolato QUI dalle righe che verranno davvero inserite.
  insert into tip_distributions (entity_id, period_month, total_amount, note)
  values (p_entity_id, p_period_month, v_totale, p_note)
  returning id into v_id;

  insert into tip_distribution_lines (distribution_id, employee_id, amount)
  select v_id, (r->>'employee_id')::uuid, (r->>'amount')::numeric
  from jsonb_array_elements(p_lines) as r
  where (r->>'amount')::numeric > 0;

  return v_id;
end;
$$;

comment on function create_tip_distribution is
  'Distribuzione mance: intestazione + righe per dipendente in una transazione, totale calcolato dal database dalle sole righe > 0. Respinge importi negativi e dipendenti duplicati. Solo titolare.';

revoke all on function create_tip_distribution(uuid, date, jsonb, text) from public;
grant execute on function create_tip_distribution(uuid, date, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica sul campo (§7 punto 2-3)
-- ---------------------------------------------------------------------
-- Impersona il TITOLARE vero (is_titolare() durante una migrazione e'
-- falso: l'SQL Editor gira come postgres), esegue le operazioni su dati
-- di prova, forza i fallimenti, controlla i rollback e ripulisce tutto —
-- registro delle cancellazioni compreso.
--
-- Nota dichiarata: il fallimento A META' e' forzato empiricamente sulla
-- distribuzione mance (dipendente inesistente nella seconda scrittura ->
-- l'intestazione gia' inserita deve sparire). Per la cessione non esiste
-- un modo onesto di far fallire la SOLA seconda scrittura senza simulare
-- concorrenza: l'atomicita' e' garantita dallo stesso identico meccanismo
-- (una funzione = una transazione) qui dimostrato sulle mance.
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  e1 uuid; e2 uuid;
  v_ing  uuid;
  v_cess uuid;
  v_emp  uuid;
  v_dist uuid;
  v_num  numeric;
  n integer;
  respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;
  select id into e2 from entities where id <> e1 order by created_at limit 1;
  if e2 is null then
    raise exception 'Servono due entita'' per provare una cessione.';
  end if;

  -- Ingrediente di prova (niente dati reali toccati)
  insert into ingredients (entity_id, name, category, unit, current_price)
  values (e1, '__prova_cessione__', (enum_range(null::ingredient_category))[1], 'kg', 1.00)
  returning id into v_ing;

  -- CESSIONE, successo con aggiornamento costo: 2.5 kg x 7.77
  v_cess := create_intercompany_cession(
    p_seller_entity_id => e1, p_buyer_entity_id => e2,
    p_product_description => 'Prova cessione', p_quantity => 2.5,
    p_unit => 'kg', p_unit_price => 7.77, p_cession_date => current_date,
    p_ingredient_id => v_ing, p_update_ingredient_cost => true);

  select total_amount into v_num from intercompany_cessions where id = v_cess;
  if v_num is distinct from 19.43 then
    raise exception 'Totale cessione calcolato male: atteso 19.43, trovato %', v_num;
  end if;
  select current_price into v_num from ingredients where id = v_ing;
  if v_num is distinct from 7.77 then
    raise exception 'Costo ingrediente non aggiornato dalla cessione: %', v_num;
  end if;
  if not exists (select 1 from price_history where ingredient_id = v_ing and source = 'cessione_interna') then
    raise exception 'Storico prezzi senza la riga della cessione.';
  end if;

  -- CESSIONE, quantita' zero respinta
  respinto := false;
  begin
    perform create_intercompany_cession(
      p_seller_entity_id => e1, p_buyer_entity_id => e2,
      p_product_description => 'x', p_quantity => 0,
      p_unit => 'kg', p_unit_price => 1, p_cession_date => current_date);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Una cessione con quantita'' zero NON e'' stata respinta.';
  end if;

  -- PREZZO NEGATIVO respinto dalla blindatura di update_ingredient_price
  respinto := false;
  begin
    perform update_ingredient_price(v_ing, -1);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un prezzo negativo NON e'' stato respinto dallo storico prezzi.';
  end if;

  -- STAFF respinto su entrambe le operazioni
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform create_intercompany_cession(
        p_seller_entity_id => e1, p_buyer_entity_id => e2,
        p_product_description => 'x', p_quantity => 1,
        p_unit => 'kg', p_unit_price => 1, p_cession_date => current_date);
    exception when others then respinto := true;
    end;
    if not respinto then
      raise exception 'Un utente STAFF ha potuto registrare una cessione.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- MANCE: dipendente di prova
  insert into employees (entity_id, first_name, last_name)
  values (e1, '__Prova__', 'Mance')
  returning id into v_emp;

  -- Successo: una riga da 12.34
  v_dist := create_tip_distribution(
    p_entity_id => e1, p_period_month => date_trunc('month', current_date)::date,
    p_lines => jsonb_build_array(jsonb_build_object('employee_id', v_emp, 'amount', 12.34)),
    p_note => '__prova_mance__');
  select total_amount into v_num from tip_distributions where id = v_dist;
  if v_num is distinct from 12.34 then
    raise exception 'Totale distribuzione calcolato male: %', v_num;
  end if;
  select count(*) into n from tip_distribution_lines where distribution_id = v_dist;
  if n <> 1 then
    raise exception 'Attesa 1 riga di distribuzione, trovate %', n;
  end if;

  -- Dipendente duplicato respinto
  respinto := false;
  begin
    perform create_tip_distribution(
      p_entity_id => e1, p_period_month => date_trunc('month', current_date)::date,
      p_lines => jsonb_build_array(
        jsonb_build_object('employee_id', v_emp, 'amount', 5),
        jsonb_build_object('employee_id', v_emp, 'amount', 7)));
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un dipendente duplicato NON e'' stato respinto.';
  end if;

  -- Importo negativo respinto
  respinto := false;
  begin
    perform create_tip_distribution(
      p_entity_id => e1, p_period_month => date_trunc('month', current_date)::date,
      p_lines => jsonb_build_array(jsonb_build_object('employee_id', v_emp, 'amount', -3)));
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un importo negativo NON e'' stato respinto.';
  end if;

  -- FALLIMENTO A META' FORZATO: seconda riga con dipendente inesistente.
  -- La violazione di chiave esterna scatta sull'insert delle RIGHE, cioe'
  -- DOPO che l'intestazione e' gia' stata inserita: se l'atomicita'
  -- funziona, anche l'intestazione deve sparire.
  respinto := false;
  begin
    perform create_tip_distribution(
      p_entity_id => e1, p_period_month => date_trunc('month', current_date)::date,
      p_lines => jsonb_build_array(
        jsonb_build_object('employee_id', v_emp, 'amount', 5),
        jsonb_build_object('employee_id', gen_random_uuid(), 'amount', 7)),
      p_note => '__prova_rollback_mance__');
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'La distribuzione con dipendente inesistente NON e'' stata respinta.';
  end if;
  if exists (select 1 from tip_distributions where note = '__prova_rollback_mance__') then
    raise exception 'ROLLBACK FALLITO: e'' rimasta un''intestazione di distribuzione senza righe.';
  end if;

  -- PULIZIA COMPLETA, registro delle cancellazioni compreso
  delete from tip_distribution_lines where distribution_id = v_dist;
  delete from tip_distributions where id = v_dist;
  delete from employees where id = v_emp;
  delete from intercompany_cessions where id = v_cess;
  delete from ingredients where id = v_ing; -- lo storico prezzi segue a cascata
  delete from deleted_records
   where record_id in (v_dist::text, v_emp::text, v_cess::text)
      or (table_name = 'tip_distribution_lines' and record->>'distribution_id' = v_dist::text);

  raise notice 'Blocco 1 verificato: cessione con costo aggiornato in transazione (totale 19.43), staff respinto, prezzo negativo respinto, mance con totale dal database, fallimento a meta'' -> intestazione annullata. Prove ripulite.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260809000002', 'blocco1_cessioni_e_mance')
on conflict (version) do nothing;

-- Riepilogo: 2 funzioni nuove + 1 blindata, zero residui di prova.
select
  (select count(*) from pg_proc where proname in ('create_intercompany_cession', 'create_tip_distribution')) as funzioni_create,
  (select count(*) from ingredients where name = '__prova_cessione__')                                        as ingredienti_prova_rimasti,
  (select count(*) from employees where first_name = '__Prova__')                                             as dipendenti_prova_rimasti,
  (select count(*) from tip_distributions where note like '__prova%')                                         as distribuzioni_prova_rimaste;
