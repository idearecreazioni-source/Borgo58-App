-- =====================================================================
-- LA SOSTITUZIONE DICE ANCHE «CON COSA», per identificativo
-- 24/08/2026 — coda della 20260824000037
-- =====================================================================
-- 🔴 TROVATO DALLA RILETTURA PRIMA DELLA CONSEGNA. La 037 ha messo nel
-- quadro l'identificativo dell'ingrediente da sostituire, e con quello la
-- scheda scrive la sostituzione giusta. Ma **non** ha messo quello del
-- SOSTITUTO: quindi riaprendo il pannello di una sostituzione già scritta,
-- la tendina «con cosa» ripartiva vuota.
--
-- ⚠️ E UN CAMPO CHE RIPARTE VUOTO NON È UN FASTIDIO: chi lo riapre per
-- correggere il prezzo salva, e il sostituto scelto la volta prima
-- diventa «si toglie e basta» — cioè il piatto smette di dire al cliente
-- che al posto del burro ci va il burro senza lattosio. Nessun errore,
-- nessun avviso: la famiglia del campo che non arriva.
--
-- ⚠️ Il nome c'era già, e col nome si poteva riempire la tendina cercando
-- l'ingrediente che si chiama così. **Non si fa**: due ingredienti si
-- possono chiamare uguale, e allora si sceglierebbe l'altro — in silenzio.
--
-- Il tipo di ritorno non cambia (è dentro lo stesso `jsonb`), quindi basta
-- riscrivere il corpo. ⚠️ E il corpo è quello VIVO letto dal database, non
-- ricopiato dal file della 037.
-- =====================================================================

create or replace function public.allergeni_del_piatto(p_recipe_id uuid)
returns table(
  allergene        allergen,
  stato            text,
  scoperti         text[],
  portatori        jsonb,
  sostituzioni     jsonb,
  costo_aggiuntivo numeric,
  nota             text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select
    a.valore,
    case
      when sc.eliminabile is null then 'non_deciso'
      when sc.eliminabile        then 'eliminabile'
      else                            'non_eliminabile'
    end,
    coalesce((
      select array_agg(x.nome order by x.nome)
        from ingredienti_con_allergene(p_recipe_id, a.valore) x
       where not x.coperto
    ), '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',      x.ingrediente_id,
               'nome',    x.nome,
               'coperto', x.coperto
             ) order by x.nome)
        from ingredienti_con_allergene(p_recipe_id, a.valore) x
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',             s.id,
               'ingrediente_id', s.ingrediente_id,
               'ingrediente',    i1.name,
               -- 🔴 L'IDENTIFICATIVO DEL SOSTITUTO, non solo il suo nome:
               --    è quello che fa ripartire la tendina da dove l'aveva
               --    lasciata chi ha scritto la sostituzione.
               'sostituto_id',   s.sostituto_id,
               'sostituto',      i2.name,
               'costo',          s.costo_aggiuntivo,
               'nota',           s.nota
             ) order by i1.name)
        from sostituzioni_allergene s
        join ingredients i1 on i1.id = s.ingrediente_id
        left join ingredients i2 on i2.id = s.sostituto_id
       where s.recipe_id = p_recipe_id and s.allergene = a.valore
    ), '[]'::jsonb),
    coalesce((
      select sum(s2.costo_aggiuntivo)
        from sostituzioni_allergene s2
       where s2.recipe_id = p_recipe_id and s2.allergene = a.valore
    ), 0::numeric),
    sc.nota
  from (
    select unnest(va.allergens) as valore
      from v_recipe_allergens va
     where va.recipe_id = p_recipe_id
  ) a
  left join scelte_allergene sc
         on sc.recipe_id = p_recipe_id and sc.allergene = a.valore
  order by 1;
end;
$function$;

-- ⚠️ `create or replace` NON tocca i permessi, ma si riscrivono lo stesso:
-- è la riga che la 036 ha dovuto aggiungere dopo aver riaperto una porta
-- per distrazione, e ripeterla costa niente.
revoke all on function public.allergeni_del_piatto(uuid) from public, anon, authenticated;
grant execute on function public.allergeni_del_piatto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_entita   uuid;
  v_a        uuid;
  v_sub      uuid;
  v_piatto   uuid;
  r          record;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_entita from entities limit 1;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ con cosa uno', 'latticini', 'kg', array['latte']::allergen[])
  returning id into v_a;
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ con cosa sostituto', 'latticini', 'kg', '{}'::allergen[])
  returning id into v_sub;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto con cosa', 'primo', 'piatto_finito', 1)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_a, 0.1, 'kg');

  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'latte', v_a, v_sub, 1.20);

  select * into r from allergeni_del_piatto(v_piatto) x where x.allergene = 'latte';
  if (r.sostituzioni -> 0 ->> 'sostituto_id')::uuid <> v_sub then
    raise exception 'La sostituzione non dichiara l''identificativo del sostituto.';
  end if;

  -- ⚠️ E IL CASO «SI TOGLIE E BASTA» deve restare distinguibile: l'assenza
  --    di sostituto è vuota, non un identificativo qualunque.
  update sostituzioni_allergene set sostituto_id = null
   where recipe_id = v_piatto and allergene = 'latte';
  select * into r from allergeni_del_piatto(v_piatto) x where x.allergene = 'latte';
  if (r.sostituzioni -> 0 ->> 'sostituto_id') is not null then
    raise exception 'Senza sostituto l''identificativo dovrebbe essere vuoto.';
  end if;

  delete from sostituzioni_allergene where recipe_id = v_piatto;
  delete from recipe_ingredients where recipe_id = v_piatto;
  delete from recipes where id = v_piatto;
  delete from ingredients where id in (v_a, v_sub);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La sostituzione dice anche con cosa, per identificativo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000038', 'la_sostituzione_dice_anche_con_cosa') on conflict (version) do nothing;
