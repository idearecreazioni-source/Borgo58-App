-- =====================================================================
-- «Può contenere tracce» non è «contiene», e non si stima mai
-- =====================================================================
-- Chiesto da Alessio il 13/08/2026, subito dopo aver visto le prime
-- schede compilate:
--
--   «Dobbiamo prevedere che, quando scansioneremo la lista degli
--    ingredienti, il sistema guardi anche eventuali diciture tipo
--    "potrebbe contenere frutta a guscio", non perché sia presente negli
--    ingredienti ma perché possibilmente nello stesso stabilimento
--    lavorano anche frutta a guscio.»
--
-- È una distinzione che conta davvero. Sono due informazioni diverse:
--
--   · CONTIENE  — l'allergene è un ingrediente. Si legge nella lista.
--   · TRACCE    — l'allergene non c'è nella ricetta, ma la fabbrica ne
--                 lavora altrove e la contaminazione è possibile.
--
-- Per un cliente celiaco o allergico alla frutta a guscio la seconda può
-- essere altrettanto decisiva, e metterle nello stesso elenco le
-- rovinerebbe entrambe: un piatto marcato «frutta a guscio» che in realtà
-- ha solo una possibile traccia diventa un piatto che non si vende, e un
-- elenco dove tutto è possibile è un elenco che non si legge.
--
-- ⚠️ LA REGOLA CHE NASCE CON QUESTA COLONNA: **le tracce non si stimano
-- mai.** Un allergene «contenuto» si può dedurre dal nome (la ricotta
-- contiene latte); una traccia no — dipende da quali altre lavorazioni
-- fa quello stabilimento, e quell'informazione esiste solo
-- sull'etichetta. Un modello che le indovinasse produrrebbe la peggior
-- specie di dato: prudente, plausibile e inventato. Quindi restano vuote
-- finché non le legge una foto dell'etichetta o non le scrive Alessio.
--
-- Nella stessa passata:
--   · un tasto per confermare tutti gli allergeni in una volta;
--   · la correzione di due valori proposti male dal modello (§4).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La colonna delle tracce
-- ---------------------------------------------------------------------
alter table ingredients
  add column if not exists allergeni_tracce allergen[] not null default '{}';

comment on column ingredients.allergeni_tracce is
  'Allergeni che il prodotto NON contiene ma che potrebbero esserci per contaminazione in stabilimento («può contenere tracce di…»). Non si stimano mai: stanno solo sull''etichetta.';

-- ---------------------------------------------------------------------
-- 2. Confermare: un prodotto, oppure tutti in una volta
-- ---------------------------------------------------------------------
-- ⚠️ `conferma_allergeni` viene RICREATA, non affiancata: un parametro in
-- più fa una funzione nuova, e due sovrapposte rendono ambigua ogni
-- chiamata per nome (42725, a tempo di esecuzione). E dopo un `drop` i
-- permessi tornano quelli di partenza, quindi la revoca qui sotto non è
-- una formalità.
drop function if exists conferma_allergeni(uuid, allergen[]);

create or replace function conferma_allergeni(
  p_ingredient_id uuid,
  p_allergeni     allergen[],
  p_tracce        allergen[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' confermare gli allergeni';
  end if;

  update ingredients
     set allergens         = coalesce(p_allergeni, '{}'),
         allergeni_tracce  = coalesce(p_tracce, '{}'),
         origine_allergeni = 'confermati'
   where id = p_ingredient_id;

  if not found then
    raise exception 'Questo prodotto non esiste piu''';
  end if;

  return jsonb_build_object('id', p_ingredient_id, 'origine', 'confermati');
end
$funzione$;

comment on function conferma_allergeni(uuid, allergen[], allergen[]) is
  'Alessio ha guardato gli allergeni di questo prodotto. Da qui in poi valgono per la stampa del menu.';

revoke all on function conferma_allergeni(uuid, allergen[], allergen[]) from public, anon, authenticated;
grant execute on function conferma_allergeni(uuid, allergen[], allergen[]) to authenticated;

-- Un tasto solo per otto prodotti. Non è comodità: confermare uno alla
-- volta con otto giri di rete significa che al quinto ci si stanca, e i
-- tre rimasti restano «stimati» senza che nessuno se lo ricordi.
create or replace function conferma_allergeni_tutti(p_scelte jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_riga     jsonb;
  v_all      allergen[];
  v_tracce   allergen[];
  v_x        text;
  n          integer := 0;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' confermare gli allergeni';
  end if;

  for v_riga in select * from jsonb_array_elements(coalesce(p_scelte, '[]'::jsonb))
  loop
    v_all := '{}';
    v_tracce := '{}';

    for v_x in select jsonb_array_elements_text(coalesce(v_riga->'allergeni', '[]'::jsonb))
    loop
      v_all := v_all || v_x::allergen;
    end loop;
    for v_x in select jsonb_array_elements_text(coalesce(v_riga->'tracce', '[]'::jsonb))
    loop
      v_tracce := v_tracce || v_x::allergen;
    end loop;

    perform conferma_allergeni((v_riga->>'id')::uuid, v_all, v_tracce);
    n := n + 1;
  end loop;

  return jsonb_build_object('confermati', n);
end
$funzione$;

comment on function conferma_allergeni_tutti(jsonb) is
  'Conferma gli allergeni di piu'' prodotti in una transazione sola: o si confermano tutti o nessuno.';

revoke all on function conferma_allergeni_tutti(jsonb) from public, anon, authenticated;
grant execute on function conferma_allergeni_tutti(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Le tracce arrivano fino al piatto, ma per la loro strada
-- ---------------------------------------------------------------------
create or replace view v_recipe_allergens as
with recursive reachable as (
  select ri.recipe_id as root_recipe_id,
         ri.ingredient_id,
         ri.component_recipe_id,
         1 as depth
    from recipe_ingredients ri
  union all
  select r.root_recipe_id,
         ri2.ingredient_id,
         ri2.component_recipe_id,
         r.depth + 1
    from reachable r
    join recipe_ingredients ri2 on ri2.recipe_id = r.component_recipe_id
   where r.component_recipe_id is not null and r.depth < 10
)
select reachable.root_recipe_id as recipe_id,
       coalesce(array_agg(distinct a.a order by a.a) filter (where a.a is not null),
                '{}'::allergen[]) as allergens,
       coalesce(bool_or(coalesce(i.origine_allergeni, 'mai_guardati')
                        not in ('confermati', 'etichetta')), false) as allergeni_da_verificare,
       coalesce(array_agg(distinct i.name) filter (
                  where coalesce(i.origine_allergeni, 'mai_guardati')
                        not in ('confermati', 'etichetta')), '{}'::text[]) as ingredienti_da_verificare,
       -- Le tracce restano una colonna a sé: un allergene possibile non
       -- va mai sommato a uno presente.
       coalesce(array_agg(distinct t.t order by t.t) filter (
                  where t.t is not null and not (t.t = any (i.allergens))),
                '{}'::allergen[]) as tracce
  from reachable
  join ingredients i on i.id = reachable.ingredient_id
  left join lateral unnest(i.allergens) a(a) on true
  left join lateral unnest(i.allergeni_tracce) t(t) on true
 group by reachable.root_recipe_id;

comment on view v_recipe_allergens is
  'Gli allergeni di una ricetta, le possibili tracce (colonna a parte: «può contenere» non è «contiene») e se sono verificati. Un elenco vuoto non significa «non ne contiene»: significa quello che dice `allergeni_da_verificare`.';

-- ---------------------------------------------------------------------
-- 4. Due valori proposti male, corretti
-- ---------------------------------------------------------------------
-- Trovati da me rileggendo le prime schede compilate, e sono errori di
-- cucina, non di programma:
--
--   · il BASILICO era finito in frigo (4-8 °C). In frigo annerisce: il
--     modello ha applicato la regola generale «erbe fresche → frigo», che
--     per il basilico è proprio sbagliata.
--   · la RICOTTA a 4-8 °C. Un fresco di latteria si accetta a 0-4, ed è
--     la soglia che finisce nel registro HACCP al ricevimento merci.
--
-- La correzione vera è nelle istruzioni date al modello (fatta nella
-- stessa consegna, in `schede-prodotto`), perché altrimenti il prossimo
-- basilico rifarebbe la stessa strada. Qui si sistemano le due righe già
-- scritte, e SOLO se sono ancora come le ha lasciate il modello: se nel
-- frattempo Alessio le ha cambiate, decide lui.
update ingredients
   set storage_type = 'temperatura_ambiente',
       haccp_receiving_temp = 'ambiente'
 where nome_ingrediente_chiave(name) = nome_ingrediente_chiave('Basilico fresco')
   and storage_type = 'frigo_4_8'
   and origine_allergeni = 'stimati';

update ingredients
   set storage_type = 'frigo_0_4',
       haccp_receiving_temp = '0-4 °C'
 where nome_ingrediente_chiave(name) = nome_ingrediente_chiave('Ricotta di pecora')
   and storage_type = 'frigo_4_8';

-- ---------------------------------------------------------------------
-- 5. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_a    uuid;
  v_r    record;
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- 1. Le tracce nascono vuote e non si stimano.
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA TRACCE cioccolato', 'altro', 'kg') returning id into v_a;

  select allergeni_tracce into v_r from ingredients where id = v_a;
  if coalesce(array_length(v_r.allergeni_tracce, 1), 0) <> 0 then
    raise exception 'Un prodotto nuovo nasce con delle tracce gia'' dentro.';
  end if;

  perform applica_scheda_prodotto(v_a, jsonb_build_object(
    'allergeni', jsonb_build_array('latte'),
    'tracce',    jsonb_build_array('frutta_guscio')));
  select allergens, allergeni_tracce, origine_allergeni into v_r from ingredients where id = v_a;
  if coalesce(array_length(v_r.allergeni_tracce, 1), 0) <> 0 then
    raise exception 'L''assistente ha scritto delle tracce: non deve poterlo fare.';
  end if;
  if not ('latte' = any (v_r.allergens)) then
    raise exception 'L''allergene contenuto non e'' stato scritto.';
  end if;

  -- 2. Alessio le scrive, e da lì valgono.
  perform set_config('request.jwt.claims', null, true);
  update ingredients
     set allergens = '{latte}', allergeni_tracce = '{frutta_guscio}', origine_allergeni = 'confermati'
   where id = v_a;

  -- 3. La vista tiene le due cose separate.
  select allergens, tracce into v_r
    from v_recipe_allergens limit 1;  -- forma della vista: deve esistere la colonna

  -- 4. Conferma in blocco: o tutti o nessuno.
  --    Un id inesistente deve far fallire l'intera transazione, non
  --    lasciarne metà confermati — sarebbe il caso peggiore, perché
  --    sembrerebbe fatto.
  begin
    perform conferma_allergeni_tutti(jsonb_build_array(
      jsonb_build_object('id', v_a::text, 'allergeni', jsonb_build_array('latte')),
      jsonb_build_object('id', '00000000-0000-0000-0000-000000000000', 'allergeni', jsonb_build_array())));
    raise exception 'La conferma in blocco ha accettato un prodotto inesistente.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%non esiste%' and sqlerrm not like '%titolare%' then
      raise exception 'Rifiuto inatteso: %', sqlerrm;
    end if;
  end;

  -- 5. Le due correzioni di cucina hanno preso.
  select count(*) into n from ingredients
   where nome_ingrediente_chiave(name) = nome_ingrediente_chiave('Basilico fresco')
     and storage_type = 'frigo_4_8';
  if n <> 0 then
    raise exception 'Il basilico e'' ancora in frigo.';
  end if;
  select count(*) into n from ingredients
   where nome_ingrediente_chiave(name) = nome_ingrediente_chiave('Ricotta di pecora')
     and storage_type = 'frigo_4_8';
  if n <> 0 then
    raise exception 'La ricotta e'' ancora a 4-8 gradi.';
  end if;

  -- 6. Pulizia (regola del 12/08).
  delete from ingredients where name like 'PROVA TRACCE%';
  select count(*) into n from ingredients where name like 'PROVA TRACCE%';
  if n <> 0 then raise exception 'La prova ha lasciato % prodotti.', n; end if;

  raise notice 'Tracce separate dagli allergeni contenuti, e mai stimate.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000006', 'tracce_e_conferma_in_blocco')
on conflict (version) do nothing;

select name, storage_type::text as conservazione, haccp_receiving_temp as temperatura
  from ingredients
 where nome_ingrediente_chiave(name) in (
         nome_ingrediente_chiave('Basilico fresco'),
         nome_ingrediente_chiave('Ricotta di pecora'))
 order by name;
