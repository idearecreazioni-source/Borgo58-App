-- =====================================================================
-- I PORTATORI ARRIVANO COL QUADRO — coda della 20260824000036
-- 24/08/2026
-- =====================================================================
-- La 20260824000036 ha chiuso `ingredienti_con_allergene` — era
-- `security definer` senza portiere e aperta a tutto lo staff — dicendo che
-- la schermata poteva ricavare la stessa cosa da `allergeni_del_piatto`.
--
-- ⚠️ RILEGGENDOLA PRIMA DI CONSEGNARE, quella frase era vera a metà: dal
-- quadro arrivano i NOMI degli ingredienti scoperti, ma per scrivere una
-- sostituzione serve il loro **identificativo** — e quello non c'era.
-- Correggere la schermata a nomi vorrebbe dire cercare un ingrediente per
-- nome, cioè sbagliare il giorno che due si chiamano uguale.
--
-- ⚠️ E NON SI RIAPRE LA PORTA: la risposta giusta è che il quadro porti
-- tutto quello che serve, non che la schermata faccia una seconda lettura
-- verso una funzione senza guardiano. Una chiamata sola, un portiere solo.
--
-- 🔴 SI CANCELLA E SI RICREA perché la colonna in più cambia il tipo di
-- ritorno. Dopo un `drop` i permessi tornano aperti al mondo: il `revoke`
-- qui sotto non è un di più — è la porta che la 036 ha appena chiuso, e
-- lasciarla fuori la riaprirebbe nello stesso file che la difende.
-- =====================================================================

drop function if exists public.allergeni_del_piatto(uuid);

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
    -- 🔴 TUTTI GLI INGREDIENTI CHE PORTANO L'ALLERGENE, coperti e no, con
    --    il loro identificativo: è l'elenco su cui la scheda fa scegliere
    --    cosa sostituire. Col nome soltanto, due ingredienti omonimi si
    --    scambierebbero senza nessun errore.
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

comment on function public.allergeni_del_piatto(uuid) is
  'Per ogni allergene del piatto: se si puo'' togliere, da quali ingredienti arriva, cosa manca ancora per poterlo promettere, come si sostituisce e quanto costa in piu''.';

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
  v_b        uuid;
  v_sub      uuid;
  v_piatto   uuid;
  r          record;
  v_ids      uuid[];
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_entita from entities limit 1;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ⚠️ DUE PORTATORI CON LO STESSO ALLERGENE, e uno solo coperto: con uno
  --    solo, «tutti i portatori» e «i coperti» darebbero lo stesso elenco e
  --    la verifica non distinguerebbe niente.
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ portatore uno', 'latticini', 'kg', array['latte']::allergen[])
  returning id into v_a;
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ portatore due', 'latticini', 'kg', array['latte']::allergen[])
  returning id into v_b;
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ portatore sostituto', 'latticini', 'kg', '{}'::allergen[])
  returning id into v_sub;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto portatori', 'primo', 'piatto_finito', 1)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_a, 0.1, 'kg'), (v_piatto, v_b, 0.2, 'kg');

  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id)
  values (v_piatto, 'latte', v_a, v_sub);

  select * into r from allergeni_del_piatto(v_piatto) x where x.allergene = 'latte';

  if jsonb_array_length(r.portatori) <> 2 then
    raise exception 'I portatori dovrebbero essere 2, sono %.', jsonb_array_length(r.portatori);
  end if;

  -- Gli identificativi devono essere quelli veri: è la ragione per cui la
  -- colonna esiste.
  select array_agg((p ->> 'id')::uuid order by p ->> 'nome')
    into v_ids
    from jsonb_array_elements(r.portatori) p;
  if not (v_a = any(v_ids) and v_b = any(v_ids)) then
    raise exception 'Gli identificativi dei portatori non sono quelli degli ingredienti veri.';
  end if;

  -- Uno coperto e uno no: la differenza deve vedersi.
  select count(*) into v_lapidi2
    from jsonb_array_elements(r.portatori) p
   where (p ->> 'coperto')::boolean;
  if v_lapidi2 <> 1 then
    raise exception 'Dovrebbe risultare coperto 1 portatore su 2, ne risultano %.', v_lapidi2;
  end if;

  -- E la sostituzione porta con sé l'ingrediente che sostituisce.
  if (r.sostituzioni -> 0 ->> 'ingrediente_id')::uuid <> v_a then
    raise exception 'La sostituzione non dichiara quale ingrediente sostituisce.';
  end if;

  delete from sostituzioni_allergene where recipe_id = v_piatto;
  delete from recipe_ingredients where recipe_id = v_piatto;
  delete from recipes where id = v_piatto;
  delete from ingredients where id in (v_a, v_b, v_sub);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il quadro porta anche i portatori, coi loro identificativi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000037', 'i_portatori_arrivano_col_quadro') on conflict (version) do nothing;
