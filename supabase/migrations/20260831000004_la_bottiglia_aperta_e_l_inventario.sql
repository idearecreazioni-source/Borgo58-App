-- =====================================================================
-- LA BOTTIGLIA APERTA, QUELLA BUTTATA, E L'INVENTARIO — 31/08/2026
-- =====================================================================
--
-- 🔴 ROVESCIAMENTO DICHIARATO, deciso da Alessio stanotte. Il 30/08 aveva
-- detto: *«le bottiglie aperte e non finite non hanno un gesto apposta: le
-- sistema il conteggio dell'Allineamento, che esiste per questo»*. Stanotte
-- ha chiesto tutti e tre i punti dei vini, quindi quel gesto si costruisce.
-- ⚠️ **La ragione di allora non era sbagliata**, e resta scritta: il
-- conteggio dell'Allineamento *sistema* davvero una bottiglia mezza vuota.
-- Quello che non fa e' **distinguere** un fondo buttato da un calice
-- venduto: nei conti finiscono uguali, e sono due fatti diversi — uno e'
-- ricavo, l'altro e' perdita.
--
-- ---------------------------------------------------------------------
-- COSA C'ERA GIA', misurato prima di scrivere
-- ---------------------------------------------------------------------
--   · vendere un calice scarica gia' **1 / porzioni_per_unita** di
--     bottiglia (`fabbisogno_conto`): la mescita funziona;
--   · `stock_consumptions.reason` ammette gia' **'spreco'**, distinto da
--     'consumo': i due fatti si possono gia' separare nei conti;
--   · `allinea_giacenza` registra gia' in `rettifiche_giacenza` la
--     differenza **in unita' e in euro**.
-- Quindi qui non si rifa' niente di tutto questo.
--
-- ---------------------------------------------------------------------
-- COSA MANCAVA
-- ---------------------------------------------------------------------
-- 🔴 **UNA BOTTIGLIA APERTA NON E' UNA BOTTIGLIA CONSUMATA.** Stappata e
-- venduta a meta', il magazzino dice «0,667 bottiglie» — un numero giusto
-- che in cantina non si vede: li' ci sono *una bottiglia aperta con quattro
-- calici dentro* e le altre intere. Aprire non scarica niente (scaricano i
-- calici vendendosi): scrive che quella bottiglia non e' piu' intera.
--
-- 🔴 **BUTTARE IL FONDO E' UNA PERDITA, e va scritta come tale.** Senza il
-- gesto, il fondo sparisce dentro la rettifica del conteggio — cioe' dentro
-- «non torna» invece che dentro «l'ho buttato», e a fine anno non si sa
-- quanto vino e' finito nel lavandino.

-- ---------------------------------------------------------------------
-- 1. LE BOTTIGLIE APERTE
-- ---------------------------------------------------------------------
create table if not exists bottiglie_aperte (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  aperta_il timestamptz not null default now(),
  aperta_da uuid,
  porzioni_totali numeric,
  chiusa_il timestamptz,
  chiusa_come text,
  porzioni_buttate numeric,
  nota text,
  constraint bottiglie_aperte_chiusa_come_check
    check (chiusa_come is null or chiusa_come in ('finita', 'buttata')),
  constraint bottiglie_aperte_buttate_check
    check (porzioni_buttate is null or porzioni_buttate >= 0)
);

comment on table bottiglie_aperte is
  'Le bottiglie stappate e non ancora finite (31/08/2026). ⚠️ Aprire NON '
  'scarica niente: scaricano i calici vendendosi. Questa tabella dice quali '
  'bottiglie in cantina non sono piu'' intere — un fatto che la giacenza, '
  'che e'' un numero solo, non puo'' dire.';
comment on column bottiglie_aperte.chiusa_come is
  '«finita» (venduta tutta) oppure «buttata» (il fondo e'' finito nel '
  'lavandino). ⚠️ Sono due fatti diversi: il primo e'' ricavo, il secondo '
  'perdita — e senza questa colonna finiscono uguali dentro la rettifica '
  'del conteggio.';

alter table bottiglie_aperte enable row level security;

-- Chi e' in sala apre e chiude bottiglie: e' il suo mestiere.
drop policy if exists bottiglie_aperte_select on bottiglie_aperte;
create policy bottiglie_aperte_select on bottiglie_aperte
  for select to authenticated using (true);
drop policy if exists bottiglie_aperte_insert on bottiglie_aperte;
create policy bottiglie_aperte_insert on bottiglie_aperte
  for insert to authenticated with check (true);
drop policy if exists bottiglie_aperte_update on bottiglie_aperte;
create policy bottiglie_aperte_update on bottiglie_aperte
  for update to authenticated using (true);
drop policy if exists bottiglie_aperte_delete on bottiglie_aperte;
create policy bottiglie_aperte_delete on bottiglie_aperte
  for delete to authenticated using ((select is_titolare()));

create index if not exists idx_bottiglie_aperte_aperte
  on bottiglie_aperte (ingredient_id) where chiusa_il is null;

-- ---------------------------------------------------------------------
-- 2. APRIRE UNA BOTTIGLIA
-- ---------------------------------------------------------------------
create or replace function apri_bottiglia(p_ingredient_id uuid, p_nota text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_porzioni numeric; v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per aprire una bottiglia.';
  end if;

  select name into v_nome from ingredients where id = p_ingredient_id;
  if v_nome is null then
    raise exception 'Questo prodotto non esiste.';
  end if;

  -- Quante porzioni ha dentro: si legge dalla riga di carta che la vende al
  -- calice. ⚠️ VUOTO NON E' UNO: una bottiglia che si vende solo intera non
  -- ha porzioni, e scrivere 1 direbbe «un calice» di una cosa che al calice
  -- non si versa.
  select max(b.porzioni_per_unita) into v_porzioni
    from bar_items b
   where b.ingredient_id = p_ingredient_id and b.active
     and b.porzioni_per_unita is not null and b.porzioni_per_unita > 1;

  insert into bottiglie_aperte (ingredient_id, aperta_da, porzioni_totali, nota)
  values (p_ingredient_id, auth.uid(), v_porzioni, p_nota)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function apri_bottiglia is
  'Registra che una bottiglia e'' stata stappata. ⚠️ NON scarica niente: '
  'scaricano i calici quando si vendono. Serve a sapere quali bottiglie in '
  'cantina non sono piu'' intere.';

revoke all on function apri_bottiglia(uuid, text) from public, anon, authenticated;
grant execute on function apri_bottiglia(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. CHIUDERE UNA BOTTIGLIA — finita, oppure buttata
-- ---------------------------------------------------------------------
create or replace function chiudi_bottiglia(
  p_id uuid, p_come text, p_porzioni_buttate numeric default null, p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b bottiglie_aperte%rowtype; v_quanto numeric; v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per chiudere una bottiglia.';
  end if;
  if p_come not in ('finita', 'buttata') then
    raise exception 'Una bottiglia si chiude «finita» o «buttata», non «%».', p_come;
  end if;

  select * into v_b from bottiglie_aperte where id = p_id;
  if v_b.id is null then
    raise exception 'Questa bottiglia non risulta aperta.';
  end if;
  if v_b.chiusa_il is not null then
    raise exception 'Questa bottiglia e'' gia'' stata chiusa il %.',
      to_char(v_b.chiusa_il at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI');
  end if;

  select name into v_nome from ingredients where id = v_b.ingredient_id;

  if p_come = 'buttata' then
    if p_porzioni_buttate is null or p_porzioni_buttate <= 0 then
      raise exception 'Quanto ne restava? Scrivi quanti calici sono finiti nel lavandino: senza quel numero la perdita non si puo'' contare.';
    end if;
    -- 🔴 LA PERDITA SI SCARICA COME SPRECO, non come consumo: sono due fatti
    --    diversi, e il motivo esisteva gia' nel vocabolario degli scarichi.
    --    Senza questo, il fondo sparirebbe dentro la rettifica del conteggio
    --    — cioe' dentro «non torna» invece che dentro «l'ho buttato».
    -- ⚠️ Si scarica la FRAZIONE di bottiglia, non i calici: il magazzino
    --    conta bottiglie. Senza porzioni note, un calice non e' misurabile e
    --    si dichiara invece di indovinare.
    if coalesce(v_b.porzioni_totali, 0) <= 0 then
      raise exception 'Di questa bottiglia non si sa in quanti calici si versa: mettilo sulla riga della carta, poi riprova.';
    end if;
    v_quanto := p_porzioni_buttate / v_b.porzioni_totali;
    -- ⚠️ `record_stock_consumption` restituisce VOID: si chiama con
    --    `perform`, non con `select … into`. Scoperto applicando — leggendo
    --    la riga sembrava giusta.
    perform record_stock_consumption(v_b.ingredient_id, v_quanto, 'spreco',
      coalesce(p_nota, 'Fondo di bottiglia buttato: ' || coalesce(v_nome, '')));
  end if;

  update bottiglie_aperte
     set chiusa_il = now(), chiusa_come = p_come,
         porzioni_buttate = case when p_come = 'buttata' then p_porzioni_buttate else null end,
         nota = coalesce(p_nota, nota)
   where id = p_id;

  return jsonb_build_object(
    'prodotto', v_nome,
    'come', p_come,
    'scaricato', v_quanto);
end;
$$;

comment on function chiudi_bottiglia is
  'Chiude una bottiglia aperta: «finita» non scarica niente (l''hanno gia'' '
  'scaricata i calici venduti), «buttata» scarica il fondo come SPRECO. '
  '⚠️ I due casi devono restare distinti nei conti: uno e'' ricavo, l''altro '
  'perdita.';

revoke all on function chiudi_bottiglia(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function chiudi_bottiglia(uuid, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. QUALI BOTTIGLIE SONO APERTE ADESSO
-- ---------------------------------------------------------------------
create or replace function bottiglie_aperte_adesso()
returns table (
  id uuid, ingredient_id uuid, prodotto text, aperta_il timestamptz,
  da_giorni integer, porzioni_totali numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select b.id, b.ingredient_id, i.name, b.aperta_il,
         ((now() at time zone 'Europe/Rome')::date
          - (b.aperta_il at time zone 'Europe/Rome')::date)::integer,
         b.porzioni_totali
    from bottiglie_aperte b
    join ingredients i on i.id = b.ingredient_id
   where b.chiusa_il is null
   order by b.aperta_il;
$$;

comment on function bottiglie_aperte_adesso is
  'Le bottiglie stappate e non ancora chiuse, con da quanti giorni sono '
  'aperte. `security invoker`: decide la RLS, non una seconda serratura.';

revoke all on function bottiglie_aperte_adesso() from public, anon, authenticated;
grant execute on function bottiglie_aperte_adesso() to authenticated;

-- ---------------------------------------------------------------------
-- 5. L'INVENTARIO — in bottiglie E in euro
-- ---------------------------------------------------------------------
-- 🔴 «IN BOTTIGLIE E IN EURO», non solo in euro: e' cosi' che l'ha chiesto
--    Alessio. Un valore da solo non dice se manca una bottiglia da cento o
--    dieci da dieci, e sono due problemi diversi.
-- ⚠️ NON e' una rettifica silenziosa: i due numeri si mostrano. Le rettifiche
--    le scrive `allinea_giacenza`, che esisteva gia'; questa le RILEGGE.
create or replace function inventario_cantina(p_dal date default null, p_al date default null)
returns table (
  ingredient_id uuid, prodotto text, mondo text,
  differenza_unita numeric, differenza_euro numeric, quante_volte integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select is_titolare()) then
    raise exception 'L''inventario lo vede solo il titolare: porta i valori d''acquisto.';
  end if;

  return query
  select r.ingredient_id, i.name, c.mondo,
         sum(r.differenza)::numeric,
         sum(coalesce(r.valore, 0))::numeric,
         count(*)::integer
    from rettifiche_giacenza r
    join ingredients i on i.id = r.ingredient_id
    join categorie_ingrediente c on c.codice = i.category
   where c.mondo in ('vini', 'bevande', 'liquori')
     and (p_dal is null or (r.creato_il at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (r.creato_il at time zone 'Europe/Rome')::date <= p_al)
   group by r.ingredient_id, i.name, c.mondo
  having sum(r.differenza) <> 0
   order by abs(sum(coalesce(r.valore, 0))) desc;
end;
$$;

comment on function inventario_cantina is
  'Lo scostamento della cantina in un periodo, IN BOTTIGLIE E IN EURO — '
  'com''e'' stato chiesto. ⚠️ Rilegge le rettifiche gia'' scritte da '
  '`allinea_giacenza`: non ne scrive nessuna, e non corregge niente in '
  'silenzio.';

revoke all on function inventario_cantina(date, date) from public, anon, authenticated;
grant execute on function inventario_cantina(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 6. VERIFICA — dentro una sotto-transazione ANNULLATA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_lap_prima integer; v_lap_dopo integer;
  v_ent uuid; v_ing uuid; v_tit uuid; v_bot uuid; v_bar uuid;
  v_esito jsonb; v_g numeric; v_n integer; r record;
begin
  select count(*) into v_lap_prima from deleted_records;

  begin
    select id into v_ent from entities where entity_type = 'srls';
    select user_id into v_tit from user_roles where role = 'titolare' limit 1;

    -- Roba MIA (regola del 16/08): un prodotto proprio, con un lotto proprio.
    insert into ingredients (entity_id, name, category, unit, alimentare, va_in_carta)
    values (v_ent, '__prova bottiglia__', 'vino_rosso', 'pz', true, true)
    returning id into v_ing;

    insert into bar_items (section, category, name, serving, selling_price,
                           ingredient_id, porzioni_per_unita)
    values ('vini', 'Prova', '__prova calice__', 'Calice', 6, v_ing, 6)
    returning id into v_bar;

    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
    values (v_ing, 3, 3, 12, now());

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- (1) APRIRE NON SCARICA NIENTE.
    select coalesce(sum(quantity_remaining), 0) into v_g
      from stock_lots where ingredient_id = v_ing;
    select apri_bottiglia(v_ing) into v_bot;
    if (select coalesce(sum(quantity_remaining), 0) from stock_lots where ingredient_id = v_ing)
       is distinct from v_g then
      raise exception 'Aprire una bottiglia ha scaricato il magazzino: non deve.';
    end if;

    -- (2) E la bottiglia risulta aperta, con le sue porzioni.
    select * into r from bottiglie_aperte_adesso() where id = v_bot;
    if r.id is null then
      raise exception 'La bottiglia aperta non compare fra quelle aperte.';
    end if;
    if r.porzioni_totali is distinct from 6 then
      raise exception 'Le porzioni lette sono %, dovevano essere 6',
        coalesce(r.porzioni_totali::text, '(vuote)');
    end if;

    -- (3) BUTTARE IL FONDO SCARICA, e lo scarica come SPRECO.
    select chiudi_bottiglia(v_bot, 'buttata', 3, null) into v_esito;
    if (v_esito ->> 'scaricato')::numeric is distinct from 0.5 then
      raise exception 'Tre calici su sei sono mezza bottiglia, scaricato: %',
        coalesce(v_esito ->> 'scaricato', '(niente)');
    end if;
    select count(*)::integer into v_n from stock_consumptions
     where ingredient_id = v_ing and reason = 'spreco';
    if v_n < 1 then
      raise exception 'Il fondo buttato non e'' finito fra gli sprechi.';
    end if;
    -- ⚠️ E NON fra i consumi: e' la distinzione che questa migrazione esiste
    --    per fare — uno e' ricavo, l'altro perdita.
    select count(*)::integer into v_n from stock_consumptions
     where ingredient_id = v_ing and reason = 'consumo';
    if v_n <> 0 then
      raise exception 'Il fondo buttato e'' stato contato come consumo.';
    end if;

    -- (4) UNA BOTTIGLIA CHIUSA NON SI CHIUDE DUE VOLTE.
    begin
      perform chiudi_bottiglia(v_bot, 'finita', null, null);
      raise exception 'UNA BOTTIGLIA GIA'' CHIUSA E'' STATA CHIUSA DI NUOVO';
    exception when others then
      if sqlerrm like 'UNA BOTTIGLIA GIA%' then raise; end if;
    end;

    -- (5) «finita» NON scarica niente.
    select apri_bottiglia(v_ing) into v_bot;
    select coalesce(sum(quantity_remaining), 0) into v_g
      from stock_lots where ingredient_id = v_ing;
    perform chiudi_bottiglia(v_bot, 'finita', null, null);
    if (select coalesce(sum(quantity_remaining), 0) from stock_lots where ingredient_id = v_ing)
       is distinct from v_g then
      raise exception 'Chiudere «finita» ha scaricato: l''hanno gia'' scaricata i calici venduti.';
    end if;

    -- (6) L'INVENTARIO risponde, e legge le rettifiche vere.
    perform allinea_giacenza(v_ing, 0, '__prova inventario__');
    select * into r from inventario_cantina() where ingredient_id = v_ing;
    if r.ingredient_id is null then
      raise exception 'L''inventario non vede una rettifica appena scritta.';
    end if;
    if r.differenza_unita is null or r.differenza_euro is null then
      raise exception 'L''inventario deve dire bottiglie E euro: % / %',
        coalesce(r.differenza_unita::text, '(vuoto)'), coalesce(r.differenza_euro::text, '(vuoto)');
    end if;

    perform set_config('request.jwt.claims', null, true);
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  select count(*) into v_lap_dopo from deleted_records;
  if v_lap_prima <> v_lap_dopo then
    raise exception 'la verifica ha lasciato % lapidi', v_lap_dopo - v_lap_prima;
  end if;

  raise notice 'Fatto: aprire non scarica, buttare scarica come SPRECO (non consumo), una chiusa non si richiude, e l''inventario dice bottiglie e euro. Annullato: % lapidi prima e dopo.', v_lap_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000004', 'la_bottiglia_aperta_e_l_inventario') on conflict (version) do nothing;
