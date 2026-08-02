-- =====================================================================
-- Borgo 58 · Migrazione 0011 — Preparazioni/semilavorati (§4, modulo 1)
-- =====================================================================
-- Una ricetta può essere di tipo "preparazione" (semilavorato riutilizzabile,
-- es. crema pasticcera) o "piatto_finito". Un ingrediente di ricetta può ora
-- puntare a un ingrediente semplice OPPURE a un'altra ricetta (preparazione).
-- Il food cost si ricalcola a cascata su più livelli.
--
-- Due protezioni strutturali, non solo "buona pratica":
--   1. Solo le ricette di tipo "preparazione" possono essere usate come
--      componente (un piatto finito non ha senso come ingrediente di un altro).
--   2. Nessun ciclo (A usa B che usa A) — verificato con una ricerca
--      ricorsiva PRIMA di permettere l'inserimento, non dopo.
-- =====================================================================

create type recipe_type as enum ('preparazione', 'piatto_finito');

alter table recipes add column recipe_type recipe_type not null default 'piatto_finito';
alter table recipes add column yield_quantity numeric(12,4);
alter table recipes add column yield_unit unit_type;

-- Una preparazione deve dichiarare quanto produce (es. "1 kg"), è la base
-- per calcolare il costo per unità quando viene usata come componente altrove.
alter table recipes add constraint preparazione_requires_yield check (
  recipe_type <> 'preparazione' or (yield_quantity is not null and yield_unit is not null)
);

comment on column recipes.recipe_type is
  'piatto_finito (default) o preparazione (semilavorato riutilizzabile in altre ricette, es. crema pasticcera).';
comment on column recipes.yield_quantity is
  'Solo per recipe_type=preparazione: quanto produce la ricetta base (es. 1 per "1 kg di crema"). Base del costo per unità quando usata come componente.';

-- ---------------------------------------------------------------------
-- recipe_ingredients: un ingrediente O un componente (ricetta), mai entrambi
-- ---------------------------------------------------------------------
alter table recipe_ingredients alter column ingredient_id drop not null;
alter table recipe_ingredients add column component_recipe_id uuid references recipes(id) on delete restrict;

alter table recipe_ingredients add constraint exactly_one_component check (
  (ingredient_id is not null and component_recipe_id is null)
  or (ingredient_id is null and component_recipe_id is not null)
);
alter table recipe_ingredients add constraint no_self_component check (
  component_recipe_id is distinct from recipe_id
);

comment on column recipe_ingredients.component_recipe_id is
  'Alternativa a ingredient_id: questa riga usa un''altra ricetta (una preparazione) come componente, con quantity/unit riferiti al suo yield_quantity/yield_unit.';

-- ---------------------------------------------------------------------
-- Protezione: solo "preparazione" come componente, niente cicli
-- ---------------------------------------------------------------------
create or replace function check_recipe_component()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  comp_type recipe_type;
begin
  if new.component_recipe_id is null then
    return new;
  end if;

  select recipe_type into comp_type from recipes where id = new.component_recipe_id;
  if comp_type is distinct from 'preparazione' then
    raise exception 'Solo le ricette di tipo "preparazione" possono essere usate come componente';
  end if;

  -- Un ciclo si crea se recipe_id compare tra i discendenti di component_recipe_id
  -- (cioè component_recipe_id, direttamente o indirettamente, "userebbe" già
  -- new.recipe_id). Cerca in profondità PRIMA di permettere l'inserimento.
  if exists (
    with recursive descendants as (
      select ri.component_recipe_id as id
      from recipe_ingredients ri
      where ri.recipe_id = new.component_recipe_id and ri.component_recipe_id is not null
      union
      select ri.component_recipe_id
      from recipe_ingredients ri
      join descendants d on ri.recipe_id = d.id
      where ri.component_recipe_id is not null
    )
    select 1 from descendants where id = new.recipe_id
  ) then
    raise exception 'Collegamento non consentito: creerebbe un ciclo tra ricette (% dipenderebbe già, indirettamente, da questa ricetta)', new.component_recipe_id;
  end if;

  return new;
end;
$$;

create trigger trg_check_recipe_component
  before insert or update on recipe_ingredients
  for each row execute function check_recipe_component();

-- ---------------------------------------------------------------------
-- Food cost ricorsivo (bill-of-materials multi-livello)
-- ---------------------------------------------------------------------
-- Espande ogni ricetta fino agli ingredienti foglia, moltiplicando le
-- quantità lungo il percorso (quando si attraversa una preparazione, si
-- scala per il suo yield_quantity). depth < 10 come rete di sicurezza
-- oltre al trigger anti-ciclo (difesa in profondità, non sostituisce il
-- controllo a scrittura).
--
-- CREATE OR REPLACE (non drop+create): v_menu_item_economics dipende da
-- questa vista, e le colonne restano identiche (recipe_id, portions_yield,
-- food_cost_base, food_cost_portion) — evita di dover fare un drop cascade
-- e ricreare anche la vista dipendente.
create or replace view v_recipe_costs
with (security_invoker = true) as
with recursive expansion as (
  select
    ri.recipe_id as root_recipe_id,
    ri.ingredient_id,
    ri.component_recipe_id,
    ri.quantity::numeric as multiplier,
    ri.waste_percentage,
    ri.is_optional,
    1 as depth
  from recipe_ingredients ri

  union all

  select
    e.root_recipe_id,
    ri2.ingredient_id,
    ri2.component_recipe_id,
    e.multiplier * ri2.quantity / nullif(comp.yield_quantity, 0),
    ri2.waste_percentage,
    (e.is_optional or ri2.is_optional),
    e.depth + 1
  from expansion e
  join recipes comp on comp.id = e.component_recipe_id
  join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
  where e.component_recipe_id is not null
    and e.depth < 10
),
base as (
  select
    r.id as recipe_id,
    r.portions_yield,
    coalesce(sum(
      case when exp.ingredient_id is not null and not exp.is_optional then
        exp.multiplier * i.current_price
          * (1 + coalesce(exp.waste_percentage, i.waste_percentage_default, 0) / 100.0)
      else 0 end
    ), 0)::numeric(14,4) as food_cost_base
  from recipes r
  left join expansion exp on exp.root_recipe_id = r.id
  left join ingredients i on i.id = exp.ingredient_id
  group by r.id, r.portions_yield
)
select
  recipe_id,
  portions_yield,
  food_cost_base,
  (food_cost_base / nullif(portions_yield, 0))::numeric(14,4) as food_cost_portion
from base;

grant select on v_recipe_costs to authenticated;

comment on view v_recipe_costs is
  'Food cost calcolato ricorsivamente: attraversa i componenti (preparazioni) fino agli ingredienti foglia. security_invoker rispetta la RLS di ingredients (solo titolare) — resta di fatto una vista riservata al titolare.';

-- ---------------------------------------------------------------------
-- "Dove è usata questa preparazione" — solo uso diretto (un livello)
-- ---------------------------------------------------------------------
create view v_preparation_usage
with (security_invoker = true) as
select
  ri.component_recipe_id as preparation_id,
  ri.recipe_id as used_in_recipe_id,
  r.name as used_in_recipe_name,
  ri.quantity,
  ri.unit
from recipe_ingredients ri
join recipes r on r.id = ri.recipe_id
where ri.component_recipe_id is not null;

grant select on v_preparation_usage to authenticated;

-- ---------------------------------------------------------------------
-- Correzione: allergeni e vista display dovevano fermarsi a un livello
-- ---------------------------------------------------------------------
-- v_recipe_allergens si fermava agli ingredienti diretti: un piatto che usa
-- una preparazione contenente uova non segnalava "uova". Reso ricorsivo
-- (stesso principio della cascata dei costi) — sicurezza alimentare, non
-- un dettaglio rimandabile. Resta SENZA security_invoker (come nella
-- migrazione 0005): deve restare leggibile anche dallo staff, che non ha
-- accesso diretto a ingredients.
create or replace view v_recipe_allergens as
with recursive reachable as (
  select ri.recipe_id as root_recipe_id, ri.ingredient_id, ri.component_recipe_id, 1 as depth
  from recipe_ingredients ri

  union all

  select r.root_recipe_id, ri2.ingredient_id, ri2.component_recipe_id, r.depth + 1
  from reachable r
  join recipe_ingredients ri2 on ri2.recipe_id = r.component_recipe_id
  where r.component_recipe_id is not null and r.depth < 10
)
select
  root_recipe_id as recipe_id,
  array_agg(distinct a order by a) as allergens
from reachable
join ingredients i on i.id = reachable.ingredient_id
cross join lateral unnest(i.allergens) as a
group by root_recipe_id;

grant select on v_recipe_allergens to authenticated;

-- recipe_ingredients_display: con l'INNER JOIN originale, le righe
-- "componente" (ingredient_id null) sparivano silenziosamente dalla vista
-- che usa lo staff. LEFT JOIN su entrambe le fonti + nome del componente
-- quando non è un ingrediente semplice.
create or replace view recipe_ingredients_display as
select
  ri.id                as recipe_ingredient_id,
  ri.recipe_id,
  coalesce(i.name, comp.name) as ingredient_name,
  i.category            as ingredient_category,
  ri.quantity,
  ri.unit,
  coalesce(ri.waste_percentage, i.waste_percentage_default, 0) as waste_percentage,
  ri.prep_note,
  ri.is_optional,
  coalesce(i.allergens, '{}') as allergens,
  (ri.component_recipe_id is not null) as is_preparation
from recipe_ingredients ri
left join ingredients i on i.id = ri.ingredient_id
left join recipes comp on comp.id = ri.component_recipe_id;

grant select on recipe_ingredients_display to authenticated;
