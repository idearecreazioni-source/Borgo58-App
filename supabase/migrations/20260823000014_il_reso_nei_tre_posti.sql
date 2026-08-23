-- =====================================================================
-- IL RESO NEI TRE POSTI, E IL PORTIERE CHE MANCAVA
-- 23/08/2026
-- =====================================================================
-- Coda del blocco 3. 🔴 Non l'ha trovata una rilettura: l'hanno trovata
-- **le reti**, diventando rosse da sole appena il valore nuovo è entrato
-- nel database.
--
-- ---------------------------------------------------------------------
-- 1. UN VOCABOLARIO CHIUSO VIVE IN TRE POSTI (regola del 17/08)
-- ---------------------------------------------------------------------
-- Il database decide, una funzione ridice l'elenco per dare un messaggio
-- leggibile, e `constants.js` lo ridice per riempire un menu. Il blocco 3
-- ne ha aggiornati **due su tre**: `record_stock_consumption` — lo
-- scarico a mano — continuava a rifiutare `reso_fornitore`.
--
-- ⚠️ E il difetto sarebbe stato **silenzioso dal lato giusto**: il reso
-- fatto dall'avviso del prodotto fermo funziona (passa da
-- `chiudi_partita`), quello fatto dallo scarico a mano no. Due porte per
-- la stessa cosa, una aperta e una chiusa — e nessuno se ne accorge
-- finché non prova la seconda.
--
-- ---------------------------------------------------------------------
-- 2. IL PORTIERE CHE MANCAVA
-- ---------------------------------------------------------------------
-- 🔴 `sprechi_e_resi()` è nata `security definer` **senza chiedere chi
-- bussa**, e dentro somma un `costo`. È la rete del 19/08 che l'ha
-- nominata, e ha ragione due volte: la regola del progetto è che ogni
-- `security definer` abbia il suo portiere, e questa espone denaro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il terzo posto del vocabolario
-- ---------------------------------------------------------------------
-- 🔴 Il corpo è preso VIVO dal database (`npm run funzione:viva`), non
-- dal file che l'ha creata: fra i due ci stanno tutte le migrazioni che
-- l'hanno toccata.
create or replace function record_stock_consumption(
  p_ingredient_id uuid,
  p_quantity      numeric,
  p_reason        text default 'consumo',
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_da_togliere numeric := p_quantity;
  v_lotto       record;
  v_quota       numeric;
  v_disponibile numeric;
  v_costo       numeric := 0;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  -- ⚠️ «reso_fornitore» (23/08/2026): la merce torna da chi l'ha
  -- venduta. Esce dal magazzino come uno spreco e NON è uno spreco —
  -- contarla lì farebbe cercare un problema in cucina che non esiste.
  if p_reason not in ('consumo', 'spreco', 'rettifica', 'vitto_personale', 'reso_fornitore') then
    raise exception 'Motivo non valido: %', p_reason;
  end if;

  select coalesce(sum(quantity_remaining), 0) into v_disponibile
    from stock_lots where ingredient_id = p_ingredient_id;

  if v_disponibile < p_quantity then
    raise exception 'Giacenza insufficiente: disponibili %, richiesti %', v_disponibile, p_quantity;
  end if;

  for v_lotto in
    select id, quantity_remaining, unit_cost
      from stock_lots
     where ingredient_id = p_ingredient_id and quantity_remaining > 0
     order by expiry_date asc nulls last, received_at asc
     for update
  loop
    exit when v_da_togliere <= 0;
    v_quota := least(v_lotto.quantity_remaining, v_da_togliere);
    update stock_lots
       set quantity_remaining = quantity_remaining - v_quota
     where id = v_lotto.id;
    v_costo := v_costo + v_quota * coalesce(v_lotto.unit_cost, 0);
    v_da_togliere := v_da_togliere - v_quota;
  end loop;

  insert into stock_consumptions (ingredient_id, quantity, reason, note, costo)
  values (p_ingredient_id, p_quantity, p_reason, p_note, v_costo);
end;
$function$;

revoke all on function record_stock_consumption(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function record_stock_consumption(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Il portiere su sprechi_e_resi
-- ---------------------------------------------------------------------
create or replace function sprechi_e_resi(p_dal date default null, p_al date default null)
returns table (motivo text, quante bigint, valore numeric)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  -- ⚠️ Somma un COSTO: è denaro, e il denaro è del titolare. Trovato
  -- dalla rete del 19/08, che l'ha nominata fra le funzioni che
  -- scavalcano la RLS senza chiedere chi sei.
  if not (select is_titolare()) then
    raise exception 'Gli sprechi in euro sono riservati al titolare.';
  end if;

  return query
  select c.reason::text,
         count(*),
         coalesce(sum(c.costo), 0)
    from stock_consumptions c
   where (p_dal is null or c.created_at::date >= p_dal)
     and (p_al  is null or c.created_at::date <= p_al)
     and c.reason in ('spreco', 'reso_fornitore')
   group by c.reason
   order by c.reason;
end $funzione$;

revoke all on function sprechi_e_resi(date, date) from public, anon, authenticated;
grant execute on function sprechi_e_resi(date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente    uuid;
  v_tit     uuid;
  v_staff   uuid;
  v_ing     uuid;
  v_lotto   uuid;
  v_n       int;
  v_passato boolean;
  v_motivo  text;
  v_lapidi  int;
  v_lapidi2 int;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  insert into ingredients (entity_id, name, category, unit, current_price, tenuto_in_magazzino)
  values (v_ente, 'ZZ prova reso a mano', 'secco_dispensa', 'kg', 3.0000, true)
  returning id into v_ing;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 5.0000, 5.0000, 3.0000)
  returning id into v_lotto;

  -- ===== 1. Lo scarico a mano accetta il reso: era il terzo posto.
  perform record_stock_consumption(v_ing, 2.0000, 'reso_fornitore', 'prova');

  select count(*) into v_n from stock_consumptions c
   where c.ingredient_id = v_ing and c.reason = 'reso_fornitore';
  if v_n <> 1 then
    raise exception 'Lo scarico a mano non accetta il reso al fornitore: il vocabolario è d''accordo solo in due posti su tre.';
  end if;

  -- ===== 2. E il vocabolario resta CHIUSO: non è diventato testo libero.
  v_passato := false;
  begin
    perform record_stock_consumption(v_ing, 1.0000, 'regalato_agli_amici', null);
    v_passato := true;
  exception when others then
    null;
  end;
  if v_passato then
    raise exception 'Il vocabolario degli scarichi accetta un valore qualsiasi.';
  end if;

  -- ===== 3. 🔴 IL PORTIERE: dalla sala gli sprechi in euro non si vedono.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    v_passato := false;
    begin
      perform * from sprechi_e_resi();
      v_passato := true;
    exception when others then
      v_motivo := sqlerrm;
    end;

    perform set_config('request.jwt.claims', null, true);

    if v_passato then
      raise exception 'Dalla sala si possono leggere gli sprechi in euro.';
    end if;
    if v_motivo not like '%riservati al titolare%' then
      raise exception 'Il portiere ha rifiutato per un altro motivo: %', v_motivo;
    end if;
  end if;

  -- ===== 4. E al titolare risponde, tenendo i due numeri SEPARATI.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*) into v_n from sprechi_e_resi() s where s.motivo = 'reso_fornitore';
  if v_n <> 1 then
    raise exception 'Al titolare i resi non compaiono.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- ===== pulizia
  delete from stock_consumptions where ingredient_id = v_ing;
  delete from stock_lots where id = v_lotto;
  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: il reso è ammesso in tutti e tre i posti, e gli sprechi in euro hanno il portiere.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000014', 'il_reso_nei_tre_posti') on conflict (version) do nothing;
