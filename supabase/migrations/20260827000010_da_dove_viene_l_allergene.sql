-- ============================================================================
-- DA DOVE VIENE L'ALLERGENE, DENTRO LA RICETTA — 27/08/2026
-- ============================================================================
--
-- Le parole di Alessio, che spiegano il bisogno meglio di una specifica:
--
--   *«come mai è presente l'uovo in questo piatto di tortellini in brodo se
--    la pasta è acqua e farina?»* — *«l'uovo è nel brodo, non nella pasta»*
--
-- 🔴 IL GESTIONALE SOMMAVA E NON DICEVA DA DOVE. `v_recipe_allergens`
--    risale le preparazioni e restituisce l'elenco degli allergeni di un
--    piatto — che è quello che serve al menu — ma perde per strada **quale
--    pezzo porta dentro ciascuno**. Davanti a un cliente che chiede, un
--    elenco senza provenienza non si può spiegare: si può solo ripeterlo.
--
-- ----------------------------------------------------------------------------
-- LA CATENA, E DOVE VA
-- ----------------------------------------------------------------------------
-- Per ogni allergene di una ricetta: **il prodotto che lo porta**, e **la
-- strada** per cui ci arriva — cioè le preparazioni attraversate, in ordine.
-- Più l'origine di quell'allergene su quel prodotto, e la fonte quando c'è.
--
-- ⚠️ DOVE NON VA: **in comanda, niente catena.** Si vede l'allergene e
--    basta, con gli eliminabili premibili (decisione del 24/08). Alessio
--    interviene di persona per le spiegazioni, e la postilla — *«l'uovo
--    serve da coagulante per chiarificare»* — è sapere suo, non del
--    gestionale. Inventarla sarebbe mettere in bocca al gestionale una
--    ragione che nessuno gli ha dato.
--
-- ----------------------------------------------------------------------------
-- LA STRADA SI COSTRUISCE SCENDENDO, e non si ricostruisce dopo
-- ----------------------------------------------------------------------------
-- La ricorsione porta con sé l'elenco dei nomi attraversati. Ricostruirlo a
-- posteriori dai legami vorrebbe dire indovinare quale delle strade
-- possibili è stata percorsa quando un prodotto entra da due parti — e il
-- caso non è teorico: la farina sta nella frolla **e** nella pasta.
--
-- ⚠️ E UN PRODOTTO CHE ARRIVA DA DUE STRADE DÀ DUE RIGHE. Fonderle
--    direbbe che l'uovo viene «dal brodo o dalla pasta», che non è una
--    risposta: davanti al cliente serve sapere se togliendo il brodo se ne
--    va o no.
--
-- ⚠️ Il tetto di profondità è lo stesso della vista (10): non è una
--    convenzione nuova, è la stessa e va tenuta uguale — se un giorno
--    cambia, cambia in tutti e due i posti o i due elenchi divergono.
-- ============================================================================

create or replace function catena_allergeni(p_recipe_id uuid)
returns table (
  allergene    allergen,
  prodotto     text,
  prodotto_id  uuid,
  strada       text[],
  origine      text,
  fonte        text
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive giu as (
    -- Il primo passo: quello che sta direttamente nella ricetta. La strada
    -- e' vuota — questo pezzo ci sta dentro e basta.
    select ri.ingredient_id,
           ri.component_recipe_id,
           '{}'::text[] as strada,
           1 as profondita
      from recipe_ingredients ri
     where ri.recipe_id = p_recipe_id
    union all
    -- Ogni passo dentro una preparazione allunga la strada col suo nome.
    select ri2.ingredient_id,
           ri2.component_recipe_id,
           g.strada || c.name,
           g.profondita + 1
      from giu g
      join recipes c on c.id = g.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = g.component_recipe_id
     where g.component_recipe_id is not null and g.profondita < 10
  )
  select a.a as allergene,
         i.name as prodotto,
         i.id as prodotto_id,
         g.strada,
         -- ⚠️ Quando l'allergene non ha una riga sua, si ricade sull'origine
         --    del PRODOTTO: e' meno preciso ma e' vero, e un vuoto qui si
         --    leggerebbe «non lo sa nessuno» anche dove qualcuno lo sa.
         coalesce(ap.origine,
                  case i.origine_allergeni
                    when 'confermati' then 'alessio'
                    when 'etichetta'  then 'etichetta'
                    when 'stimati'    then 'dedotto'
                  end) as origine,
         ap.fonte
    from giu g
    join ingredients i on i.id = g.ingredient_id
    cross join lateral unnest(i.allergens) a(a)
    left join allergeni_prodotto ap
           on ap.ingredient_id = i.id and ap.allergene = a.a
   order by a.a, array_length(g.strada, 1) nulls first, i.name;
$$;

comment on function catena_allergeni(uuid) is
  'Per ogni allergene di una ricetta: quale prodotto lo porta e per quale strada — le preparazioni attraversate, in ordine. Risponde a «come mai c''e'' l''uovo se la pasta e'' acqua e farina»: l''uovo e'' nel brodo. ⚠️ Un prodotto che arriva da due strade da'' DUE righe: fonderle direbbe «dal brodo o dalla pasta», che non e'' una risposta per chi deve decidere se togliere il brodo.';

revoke all on function catena_allergeni(uuid) from public, anon, authenticated;
grant execute on function catena_allergeni(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_ent   uuid;
  v_uovo  uuid;
  v_far   uuid;
  v_brodo uuid;
  v_pasta uuid;
  v_tort  uuid;
  v_ingr  text[] := '{}';
  v_ric   text[] := '{}';
  v_r     record;
  v_n     integer;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- 🔴 IL CASO DI ALESSIO, COSTRUITO PER INTERO: tortellini in brodo, dove
  --    la pasta e' acqua e farina e l'uovo sta nel BRODO.
  v_far  := (create_ingredient(v_ent, 'VERIFICA farina', 'farine_cereali', 'kg', 1)->>'id')::uuid;
  v_uovo := (create_ingredient(v_ent, 'VERIFICA uovo', 'uova', 'pz', 1)->>'id')::uuid;
  v_ingr := v_ingr || v_far::text || v_uovo::text;
  update ingredients set allergens = array['glutine']::allergen[], origine_allergeni = 'stimati'
   where id = v_far;
  update ingredients set allergens = array['uova']::allergen[], origine_allergeni = 'etichetta'
   where id = v_uovo;
  insert into allergeni_prodotto (ingredient_id, allergene, origine, fonte)
  values (v_far, 'glutine', 'dedotto', null),
         (v_uovo, 'uova', 'etichetta', null);

  -- ⚠️ Una preparazione vuole la sua RESA (`componente_richiede_resa`):
  --    e' il vincolo che impedisce a un semilavorato di entrare in un
  --    piatto senza dire quanto ne esce. Trovato applicando.
  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('VERIFICA pasta', 'primo', 'preparazione', 1, 'kg')
  returning id into v_pasta;
  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('VERIFICA brodo', 'primo', 'preparazione', 2, 'l')
  returning id into v_brodo;
  insert into recipes (name, category) values ('VERIFICA tortellini in brodo', 'primo')
  returning id into v_tort;
  v_ric := v_ric || v_pasta::text || v_brodo::text || v_tort::text;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_pasta, v_far, 1, 'kg'), (v_brodo, v_uovo, 2, 'pz');
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_tort, v_pasta, 1, 'kg'), (v_tort, v_brodo, 1, 'l');

  -- (1) L'UOVO ARRIVA DAL BRODO, E LO DICE.
  select * into v_r from catena_allergeni(v_tort) where allergene = 'uova';
  if v_r.prodotto is null then
    raise exception 'L''uovo non compare nella catena del piatto.';
  end if;
  if not ('VERIFICA brodo' = any(v_r.strada)) then
    raise exception 'La catena non dice che l''uovo arriva dal brodo: strada «%»',
      array_to_string(v_r.strada, ' → ');
  end if;
  -- 🔴 E LA PROVA DISCRIMINA: se dicesse «dalla pasta» sarebbe la risposta
  --    sbagliata alla domanda di Alessio, e passerebbe lo stesso senza
  --    questo controllo.
  if 'VERIFICA pasta' = any(v_r.strada) then
    raise exception 'La catena mette l''uovo nella pasta, che e'' acqua e farina.';
  end if;
  if v_r.origine <> 'etichetta' then
    raise exception 'L''uovo letto in etichetta non risulta letto in etichetta: «%»', v_r.origine;
  end if;

  -- (2) E IL GLUTINE ARRIVA DALLA PASTA, con la sua ragione.
  select * into v_r from catena_allergeni(v_tort) where allergene = 'glutine';
  if not ('VERIFICA pasta' = any(v_r.strada)) then
    raise exception 'Il glutine non risulta arrivare dalla pasta.';
  end if;
  if v_r.origine <> 'dedotto' then
    raise exception 'Il glutine dedotto non dice di essere dedotto: «%»', v_r.origine;
  end if;

  -- (3) 🔴 DUE STRADE, DUE RIGHE. Se la farina entra anche nel brodo, la
  --     catena lo dice due volte: fonderle direbbe «dal brodo o dalla
  --     pasta», che non aiuta chi deve decidere cosa togliere.
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_brodo, v_far, 1, 'kg');
  select count(*) into v_n from catena_allergeni(v_tort) where allergene = 'glutine';
  if v_n <> 2 then
    raise exception 'Un prodotto che arriva da due strade da'' % righe invece di 2.', v_n;
  end if;

  -- (4) L'ELENCO RESTA D'ACCORDO CON LA VISTA che alimenta il menu: due
  --     posti che dicono gli allergeni dello stesso piatto non possono
  --     dire cose diverse.
  if exists (
    select 1 from catena_allergeni(v_tort) c
     where not (c.allergene = any (
             (select v.allergens from v_recipe_allergens v where v.recipe_id = v_tort)::allergen[]))
  ) then
    raise exception 'La catena nomina un allergene che l''elenco del piatto non ha.';
  end if;
  select count(distinct allergene) into v_n from catena_allergeni(v_tort);
  if v_n <> array_length((select allergens from v_recipe_allergens where recipe_id = v_tort), 1) then
    raise exception 'La catena e l''elenco del piatto contano allergeni diversi.';
  end if;

  -- Pulizia — solo roba mia, per identificativo, in un elenco.
  delete from recipe_ingredients where recipe_id::text = any(v_ric);
  delete from recipes where id::text = any(v_ric);
  delete from allergeni_prodotto where ingredient_id::text = any(v_ingr);
  delete from price_history where ingredient_id::text = any(v_ingr);
  delete from ingredients where id::text = any(v_ingr);
  delete from deleted_records
   where record_id = any(v_ingr) or record_id = any(v_ric)
      or (record ->> 'ingredient_id') = any(v_ingr)
      or (record ->> 'recipe_id') = any(v_ric);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della catena degli allergeni');
  raise notice 'verifica: l''uovo arriva dal brodo e non dalla pasta, e due strade danno due righe';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000010', 'da_dove_viene_l_allergene')
on conflict (version) do nothing;
