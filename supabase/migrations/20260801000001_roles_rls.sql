-- =====================================================================
-- Borgo 58 · Migrazione 0005 — Ruoli e Row Level Security (§3.5 del brief)
-- =====================================================================
-- Passaggio da "single user + pin" a due ruoli reali:
--   titolare (Alessio) → accesso completo
--   staff (account condiviso) → sola vista operativa, niente dati economici
--
-- Doppia barriera (§3.5): questa migrazione costruisce quella di DATABASE
-- (RLS) — la barriera vera, indipendente dal frontend. Il frontend nasconde
-- in più le voci di menu, ma anche un accesso diretto via API viene rifiutato
-- qui se il ruolo non ha permesso.
--
-- Principio: restringere di default (§3.5). Tutto ciò che non è esplicitamente
-- concesso allo staff resta riservato al titolare.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Ruoli
-- ---------------------------------------------------------------------
create type app_role as enum ('titolare', 'staff');

create table user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    app_role not null,
  created_at timestamptz not null default now()
);
comment on table user_roles is
  'Ruolo applicativo di ogni account. Fonte di verità per la RLS. Modificabile solo via SQL/service_role (nessuna policy di scrittura per authenticated: lo staff non può auto-promuoversi).';

alter table user_roles enable row level security;

-- Ogni utente può leggere SOLO la propria riga (sapere di essere "staff" non è
-- un dato sensibile; serve a is_titolare() e al frontend per costruire il menu).
create policy user_roles_select_own on user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on user_roles to authenticated;

-- Funzione helper: l'utente corrente è titolare?
-- SECURITY INVOKER: gira coi permessi del chiamante; legge la propria riga
-- grazie alla policy sopra, senza bisogno di SECURITY DEFINER (più sicuro).
-- STABLE + uso via (select is_titolare()) nelle policy → valutata una volta
-- per query, non per riga (Supabase performance best practice).
create or replace function is_titolare()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = (select auth.uid()) and role = 'titolare'
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Caparra fuori dalla tabella prenotazioni
-- ---------------------------------------------------------------------
-- La caparra è l'unico dato commerciale in reservations. Spostandola in una
-- tabella separata (solo titolare), reservations non contiene più dati
-- economici e può essere letta/modificata liberamente dallo staff.
create table reservation_deposits (
  reservation_id uuid primary key references reservations(id) on delete cascade,
  amount         numeric(12,2) not null,
  created_at     timestamptz not null default now()
);

insert into reservation_deposits (reservation_id, amount)
select id, deposit_amount from reservations where deposit_amount is not null;

alter table reservations drop column deposit_amount;

alter table reservation_deposits enable row level security;
create policy reservation_deposits_titolare_all on reservation_deposits
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
grant select, insert, update, delete on reservation_deposits to authenticated;

-- ---------------------------------------------------------------------
-- 3. Riscrittura policy: tabelle SOLO TITOLARE
-- ---------------------------------------------------------------------
-- Rimpiazza le vecchie policy "*_authenticated_all" (che davano tutto a
-- chiunque fosse autenticato) con policy legate al ruolo.
do $$
declare t text;
begin
  foreach t in array array[
    'entities','suppliers','ingredients','price_history',
    'intercompany_cessions','menus','menu_items'
  ]
  loop
    execute format('drop policy if exists %I on %I;', t || '_authenticated_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));',
      t || '_titolare_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Riscrittura policy: RICETTE — lettura a tutti, scrittura solo titolare
-- ---------------------------------------------------------------------
-- Lo staff consulta le ricette (sola lettura). La definizione di ricette e
-- schede HACCP resta al titolare. Nessuna colonna economica in queste tabelle
-- a livello di riga (i prezzi stanno in ingredients, riservata al titolare).
do $$
declare t text;
begin
  foreach t in array array['recipes','recipe_ingredients','recipe_steps']
  loop
    execute format('drop policy if exists %I on %I;', t || '_authenticated_all', t);
    execute format('create policy %I on %I for select to authenticated using (true);', t || '_select_all', t);
    execute format('create policy %I on %I for insert to authenticated with check ((select is_titolare()));', t || '_ins_titolare', t);
    execute format('create policy %I on %I for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));', t || '_upd_titolare', t);
    execute format('create policy %I on %I for delete to authenticated using ((select is_titolare()));', t || '_del_titolare', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Riscrittura policy: PRENOTAZIONI — staff opera, non cancella
-- ---------------------------------------------------------------------
drop policy if exists reservations_authenticated_all on reservations;
create policy reservations_select_all on reservations
  for select to authenticated using (true);
create policy reservations_insert_all on reservations
  for insert to authenticated with check (true);
create policy reservations_update_all on reservations
  for update to authenticated using (true) with check (true);
-- Solo il titolare può eliminare una prenotazione (operazione distruttiva).
create policy reservations_delete_titolare on reservations
  for delete to authenticated using ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 6. Viste "display" per lo staff (dati operativi, ZERO economia)
-- ---------------------------------------------------------------------
-- SECURITY DEFINER (default nelle view Postgres 15+): bypassano la RLS di
-- ingredients (riservata al titolare) MA espongono solo colonne non
-- economiche — quindi lo staff ottiene nomi/allergeni/quantità senza mai
-- vedere prezzi. Il dato sensibile non è nascosto: è strutturalmente assente.

-- Nomi + allergeni + quantità degli ingredienti di ogni ricetta, senza prezzi.
create view recipe_ingredients_display as
select
  ri.id           as recipe_ingredient_id,
  ri.recipe_id,
  i.name          as ingredient_name,
  i.category      as ingredient_category,
  ri.quantity,
  ri.unit,
  coalesce(ri.waste_percentage, i.waste_percentage_default, 0) as waste_percentage,
  ri.prep_note,
  ri.is_optional,
  i.allergens
from recipe_ingredients ri
join ingredients i on i.id = ri.ingredient_id;
grant select on recipe_ingredients_display to authenticated;

-- Allergeni aggregati per ricetta — ricreata come SECURITY DEFINER così è
-- leggibile anche dallo staff (contiene solo recipe_id + allergeni, sicura).
drop view if exists v_recipe_allergens;
create view v_recipe_allergens as
select
  ri.recipe_id,
  array_agg(distinct a order by a) as allergens
from recipe_ingredients ri
join ingredients i on i.id = ri.ingredient_id
cross join lateral unnest(i.allergens) as a
group by ri.recipe_id;
grant select on v_recipe_allergens to authenticated;

-- Le viste economiche (v_recipe_costs, v_menu_item_economics) restano
-- security_invoker: poggiano su ingredients/menu_items (solo titolare), quindi
-- sono di fatto accessibili solo al titolare. Nessuna modifica necessaria.

-- ---------------------------------------------------------------------
-- 7. Dato fondamentale: assegna il ruolo titolare ad Alessio
-- ---------------------------------------------------------------------
-- L'account staff (staff@borgo58.app) va creato da Alessio nella dashboard
-- Supabase; il suo ruolo si assegna con lo snippet fornito a parte dopo la
-- creazione. Qui assegniamo il titolare all'account esistente.
insert into user_roles (user_id, role)
select id, 'titolare' from auth.users where email = 'alessio@borgo58.app'
on conflict (user_id) do update set role = excluded.role;
