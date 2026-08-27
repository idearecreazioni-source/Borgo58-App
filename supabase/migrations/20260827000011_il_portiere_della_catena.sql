-- ============================================================================
-- IL PORTIERE DELLA CATENA — 27/08/2026
-- ============================================================================
--
-- 🔴 TROVATA DALLA RETE, non da una rilettura. `tests/app/permessi.test.js`
--    conta le funzioni che scavalcano la RLS senza chiedere chi sei, ed e'
--    diventata rossa un'ora dopo che `catena_allergeni` era nata: **23
--    attese, 24 trovate**. E' la terza volta in due giorni che quella prova
--    prende un difetto mio.
--
-- ----------------------------------------------------------------------------
-- PERCHE' IL TITOLARE, E NON LA SALA
-- ----------------------------------------------------------------------------
-- La tentazione era aprirla a tutti: la decisione del 24/08 dice che
-- l'origine di un allergene *«serve al cameriere quando un cliente chiede»*,
-- e questa funzione porta anche quella.
--
-- ⚠️ Ma oggi **in sala non la chiama nessuno**: la catena vive nella scheda
--    della ricetta, e la scheda che vede lo staff (`StaffRicettaDetail`) non
--    la usa — in comanda si vede l'allergene e basta, che e' la decisione
--    del 24/08 ribadita stamattina. Aprire una porta perche' un giorno
--    potrebbe servire vuol dire lasciarla aperta **adesso**, quando non
--    serve, e questo elenco nomina prodotti e preparazioni del locale.
--
-- ⚠️ E c'e' il precedente del 25/08, quando due funzioni erano nella stessa
--    condizione: una fu **chiusa**, l'altra **dichiarata** perche' la deve
--    leggere chi e' in sala col cliente davanti. Il discriminante fu «chi la
--    chiama oggi», non «chi potrebbe chiamarla». Qui la risposta e' il
--    titolare.
--
-- ⚠️ Il giorno che la catena servira' in sala, si apre **con una decisione
--    esplicita** e questa migrazione e' il posto dove leggere perche' era
--    chiusa.
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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- 🔴 UN RIFIUTO, NON UN ELENCO VUOTO: una catena vuota davanti a un
  --    cliente che chiede si legge «questo piatto non ha allergeni», che e'
  --    la frase piu' pericolosa che questo gestionale possa scrivere.
  if not (select is_titolare()) then
    raise exception 'Da dove vengono gli allergeni lo vede il titolare.';
  end if;

  return query
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
  select a.a,
         i.name,
         i.id,
         g.strada,
         -- ⚠️ Quando l'allergene non ha una riga sua, si ricade sull'origine
         --    del PRODOTTO: e' meno preciso ma e' vero, e un vuoto qui si
         --    leggerebbe «non lo sa nessuno» anche dove qualcuno lo sa.
         coalesce(ap.origine,
                  case i.origine_allergeni
                    when 'confermati' then 'alessio'
                    when 'etichetta'  then 'etichetta'
                    when 'stimati'    then 'dedotto'
                  end),
         ap.fonte
    from giu g
    join ingredients i on i.id = g.ingredient_id
    cross join lateral unnest(i.allergens) a(a)
    left join allergeni_prodotto ap
           on ap.ingredient_id = i.id and ap.allergene = a.a
   order by a.a, array_length(g.strada, 1) nulls first, i.name;
end $$;

comment on function catena_allergeni(uuid) is
  'Per ogni allergene di una ricetta: quale prodotto lo porta e per quale strada — le preparazioni attraversate, in ordine. Risponde a «come mai c''e'' l''uovo se la pasta e'' acqua e farina»: l''uovo e'' nel brodo. ⚠️ Un prodotto che arriva da due strade da'' DUE righe. ⚠️ La vede il TITOLARE: in comanda si vede l''allergene e basta (24/08), e finche'' in sala nessuno la chiama la porta resta chiusa.';

revoke all on function catena_allergeni(uuid) from public, anon, authenticated;
grant execute on function catena_allergeni(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto jsonb;
  v_tit  uuid;
  v_ric  uuid;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ric from recipes order by created_at limit 1;

  -- (1) SENZA IDENTITA' RIFIUTA. La migrazione gira come proprietaria e
  --     `is_titolare()` e' falso: e' il caso di chi non deve vedere.
  begin
    perform * from catena_allergeni(v_ric);
    raise exception 'La catena si legge senza essere il titolare.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%titolare%' then raise; end if;
  end;

  -- (2) COL TITOLARE RISPONDE.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  perform * from catena_allergeni(v_ric);

  -- (3) E NON E' PIU' FRA QUELLE SENZA PORTIERE.
  --     ⚠️ Si chiede al catalogo, non si crede al fatto di averla riscritta.
  if exists (select 1 from funzioni_senza_portiere() where nome = 'catena_allergeni') then
    raise exception 'La catena risulta ancora senza portiere.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del portiere della catena');
  raise notice 'verifica: la catena rifiuta chi non e'' il titolare e non compare piu'' fra le funzioni scoperte';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000011', 'il_portiere_della_catena')
on conflict (version) do nothing;
