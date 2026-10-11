-- =====================================================================
-- «ESTRAPOLA»: DALLE RICETTE ALLA LISTA DELLA SPESA (R11, 11/10/2026)
-- =====================================================================
-- Dalla relazione di Alessio dell'11/10: scegliere alcune ricette e per
-- quante porzioni, vedere gli ingredienti che servono — consolidati, con
-- le ricette da cui vengono — e, dopo averli guardati e corretti, metterli
-- nella lista della spesa.
--
-- 🔴 NIENTE SI COMPRA E NIENTE SI MUOVE DA SOLO. `estrapola_ricette` solo
--    LEGGE: è una proposta. Scrive soltanto `aggiungi_estrapolazione`, e
--    scrive SOLO le righe che la schermata le passa, cioè quelle che
--    Alessio ha tenuto dopo averle guardate. Nessun ordine, nessuno scarico.
--
-- ⚠️ LE RICETTE DEL LOCALE riusano `fabbisogno_preparazione`, la stessa
--    esplosione dello scarico vero del magazzino e del fabbisogno di un
--    evento: semilavorati, scarto e righe opzionali si comportano uguale.
--    Nessuna ricorsione nuova.
-- ⚠️ LE BOZZE (il ricettario virtuale) entrano anche loro, perché oggi le
--    ricette di Alessio vivono lì. Una riga di bozza ha l'unità scritta a
--    mano e può non essere collegata al magazzino: si consolida per
--    prodotto quando è collegata, per nome quando non lo è, e LO DICE.
-- ⚠️ NESSUNA CONVERSIONE INVENTATA: due unità diverse dello stesso prodotto
--    restano due righe, e una quantità che manca (q.b.) resta vuota e
--    dichiarata — mai zero.
-- ⚠️ Solo il titolare: il ricettario virtuale è suo, e la funzione RIFIUTA
--    invece di rispondere un elenco vuoto.

create or replace function estrapola_ricette(p_scelte jsonb)
returns table (
  chiave       text,
  ingredient_id uuid,
  nome         text,
  unita        text,
  quantita     numeric,
  da           text[],
  problema     text,
  gia_in_lista numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_titolare() then
    raise exception 'Estrapolare dalle ricette è riservato al titolare.';
  end if;
  if p_scelte is null or jsonb_typeof(p_scelte) <> 'array' or jsonb_array_length(p_scelte) = 0 then
    raise exception 'Scegli almeno una ricetta.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_scelte) e
     where coalesce(nullif(e->>'porzioni', '')::numeric, 0) <= 0
  ) then
    raise exception 'Per ogni ricetta scelta serve un numero di porzioni maggiore di zero.';
  end if;

  return query
  with scelte as (
    select e->>'tipo' as tipo, (e->>'id')::uuid as id, (e->>'porzioni')::numeric as porzioni
      from jsonb_array_elements(p_scelte) e
  ),
  ric as (
    select s.id, s.porzioni, r.name as titolo, r.portions_yield as resa
      from scelte s join recipes r on r.id = s.id
     where s.tipo = 'ricetta'
  ),
  bz as (
    select s.id, s.porzioni, b.titolo, b.porzioni as resa
      from scelte s join bozze_ricetta b on b.id = s.id
     where s.tipo = 'bozza'
  ),
  righe as (
    -- Le ricette del locale: la stessa esplosione dello scarico vero.
    select f.ingredient_id, i.name::text as nome, i.unit::text as unita,
           f.quantita::numeric as quantita, r.titolo as fonte, null::text as problema
      from ric r
      cross join lateral fabbisogno_preparazione(r.id, r.porzioni / nullif(r.resa, 0)) f
      join ingredients i on i.id = f.ingredient_id
     where coalesce(r.resa, 0) > 0
    union all
    -- Le bozze: la quantità scritta, riportata alle porzioni chieste.
    select bi.ingredient_id,
           coalesce(i.name, btrim(bi.nome))::text,
           nullif(btrim(bi.unita), ''),
           case when bi.quantita is null or coalesce(b.resa, 0) <= 0 then null
                else bi.quantita * b.porzioni / b.resa end,
           b.titolo,
           concat_ws('; ',
             case when bi.ingredient_id is null then 'non collegato al magazzino' end,
             case when bi.quantita is null then 'quantità non indicata' end,
             case when bi.quantita is not null and coalesce(b.resa, 0) <= 0
                  then 'la bozza non dice per quante porzioni è' end,
             case when bi.ingredient_id is not null and bi.unita is not null
                       and bi.unita <> i.unit::text
                  then 'unità diversa da quella del magazzino (' || i.unit::text || ')' end)
      from bz b
      join bozze_ricetta_ingredienti bi on bi.bozza_id = b.id
      left join ingredients i on i.id = bi.ingredient_id
  ),
  insieme as (
    select coalesce(r.ingredient_id::text, 'nome:' || lower(r.nome)) || '|' || coalesce(r.unita, '') as k,
           r.*
      from righe r
  ),
  consolidate as (
    select k,
           (array_agg(ingredient_id))[1] as ingredient_id,
           min(nome) as nome,
           min(unita) as unita,
           -- ⚠️ La somma delle parti NOTE: se una parte manca, lo dice il problema.
           sum(quantita) as quantita,
           array_agg(distinct fonte order by fonte) as da,
           nullif(concat_ws('; ',
             nullif(string_agg(distinct nullif(problema, ''), '; '), ''),
             case when bool_or(quantita is null) and bool_or(quantita is not null)
                  then 'una parte senza quantità: il totale è parziale' end), '') as problema
      from insieme
     group by k
  ),
  -- Le ricette che non si possono estrapolare affatto, dette per nome.
  intere as (
    select 'ricetta:' || r.id::text, null::uuid, r.titolo::text, null::text, null::numeric,
           array[r.titolo::text], 'la ricetta non dice per quante porzioni è'
      from ric r where coalesce(r.resa, 0) <= 0
    union all
    select 'ricetta:' || r.id::text, null::uuid, r.titolo::text, null::text, null::numeric,
           array[r.titolo::text], 'la ricetta non ha ancora ingredienti'
      from ric r
     where coalesce(r.resa, 0) > 0
       and not exists (select 1 from recipe_ingredients ri where ri.recipe_id = r.id)
    union all
    select 'bozza:' || b.id::text, null::uuid, b.titolo::text, null::text, null::numeric,
           array[b.titolo::text], 'la bozza non ha ancora ingredienti'
      from bz b
     where not exists (select 1 from bozze_ricetta_ingredienti bi where bi.bozza_id = b.id)
  )
  select c.k, c.ingredient_id, c.nome, c.unita, round(c.quantita, 4), c.da, c.problema,
         (select sum(sli.quantity_needed)
            from shopping_list_items sli
           where c.ingredient_id is not null
             and sli.ingredient_id = c.ingredient_id
             and sli.status in ('da_comprare', 'ordinata'))
    from consolidate c
  union all
  select * , null::numeric from intere
  order by 3;
end $$;

comment on function estrapola_ricette(jsonb) is
  'R11 (11/10/2026): gli ingredienti che servono per le ricette scelte, per quante porzioni, CONSOLIDATI per prodotto e unità, con le ricette da cui vengono. Solo lettura: è una proposta. Ricette del locale via `fabbisogno_preparazione` (la stessa esplosione dello scarico); bozze dalla quantità scritta. Nessuna conversione inventata: unità diverse restano righe diverse, quantità mancanti restano vuote e dichiarate. `gia_in_lista` = quanto di quel prodotto è già in lista da comprare o ordinato.';

revoke all on function estrapola_ricette(jsonb) from public, anon, authenticated;
grant execute on function estrapola_ricette(jsonb) to authenticated;


-- Mette in lista le righe che Alessio ha TENUTO dopo averle guardate.
-- ⚠️ Una tabella sola, quindi niente corridoio (regola B4); ma una chiamata
--    sola, così o entrano tutte o nessuna — mezza lista sembrerebbe intera.
-- ⚠️ L'unità entra nella colonna solo se il magazzino la conosce: una
--    «tazza» scritta a mano finisce nella nota, invece di far fallire tutto
--    o di sparire.
create or replace function aggiungi_estrapolazione(p_righe jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e       jsonb;
  v_ing   uuid;
  v_nome  text;
  v_qta   numeric;
  v_unita text;
  v_nota  text;
  v_n     integer := 0;
  v_unita_note text[] := array(select unnest(enum_range(null::unit_type))::text);
begin
  if not is_titolare() then
    raise exception 'Mettere in lista dalle ricette è riservato al titolare.';
  end if;
  if p_righe is null or jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then
    raise exception 'Non c''è niente da mettere in lista.';
  end if;

  for e in select * from jsonb_array_elements(p_righe) loop
    v_ing   := nullif(e->>'ingredient_id', '')::uuid;
    v_nome  := nullif(btrim(e->>'nome'), '');
    v_qta   := nullif(e->>'quantita', '')::numeric;
    v_unita := nullif(btrim(e->>'unita'), '');
    v_nota  := nullif(btrim(e->>'nota'), '');
    if v_ing is null and v_nome is null then
      raise exception 'Una riga non ha né un prodotto né un nome.';
    end if;
    if v_qta is not null and v_qta <= 0 then
      raise exception 'La quantità di «%» deve essere maggiore di zero, oppure vuota.', coalesce(v_nome, 'una riga');
    end if;
    if v_unita is not null and not (v_unita = any(v_unita_note)) then
      v_nota := concat_ws(' · ', v_nota, 'unità scritta nella ricetta: ' || v_unita);
      v_unita := null;
    end if;

    insert into shopping_list_items (ingredient_id, custom_name, supplier_id, quantity_needed, unit, note)
    values (
      v_ing,
      case when v_ing is null then v_nome end,
      (select i.supplier_id from ingredients i where i.id = v_ing),
      v_qta,
      v_unita::unit_type,
      v_nota
    );
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

comment on function aggiungi_estrapolazione(jsonb) is
  'R11 (11/10/2026): mette nella lista della spesa, in una chiamata sola, le righe che Alessio ha tenuto dalla proposta di `estrapola_ricette`. Scrive solo ciò che riceve; l''unità entra nella colonna solo se il magazzino la conosce, altrimenti va nella nota.';

revoke all on function aggiungi_estrapolazione(jsonb) from public, anon, authenticated;
grant execute on function aggiungi_estrapolazione(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA — tutto dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_ent      uuid;
  v_ing      uuid;
  v_ric      uuid;
  v_vuota    uuid;
  v_bozza    uuid;
  v_bozza2   uuid;
  v_r        record;
  v_n        integer;
  v_lista0   integer;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;
  select id into v_ent from entities where entity_type = 'srls';
  if v_ent is null then raise exception 'VERIFICA: serve la società.'; end if;

  if has_function_privilege('anon', 'estrapola_ricette(jsonb)', 'execute')
     or has_function_privilege('anon', 'aggiungi_estrapolazione(jsonb)', 'execute') then
    raise exception 'VERIFICA: l''estrapolazione è eseguibile con la chiave pubblica.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
    values (v_ent, 'ZZ verifica estrapola - guanciale', 'pesce', 'g', 0.02, 0)
    returning id into v_ing;

    -- Una ricetta del locale da 4 porzioni con 200 g di guanciale.
    insert into recipes (name, category, portions_yield, recipe_type)
    values ('ZZ verifica estrapola - amatriciana', 'primo', 4, 'piatto_finito') returning id into v_ric;
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, waste_percentage)
    values (v_ric, v_ing, 200, 'g', 0);
    -- Una ricetta senza porzioni non si estrapola, e lo dice.
    insert into recipes (name, category, portions_yield, recipe_type)
    values ('ZZ verifica estrapola - senza ingredienti', 'primo', 2, 'piatto_finito') returning id into v_vuota;

    -- Una bozza da 2 porzioni: guanciale collegato, farina no, sale q.b.
    insert into bozze_ricetta (titolo, porzioni) values ('ZZ verifica estrapola - gricia', 2)
    returning id into v_bozza;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita, ingredient_id) values
      (v_bozza, 1, 'guanciale', 100, 'g', v_ing),
      (v_bozza, 2, 'ZZ farina', 50, 'g', null),
      (v_bozza, 3, 'ZZ sale', null, null, null),
      (v_bozza, 4, 'ZZ zucchero', 2, 'tazza', null);
    -- Una seconda bozza che nomina la stessa farina, ma in un'altra unità.
    insert into bozze_ricetta (titolo, porzioni) values ('ZZ verifica estrapola - pane', 1)
    returning id into v_bozza2;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita) values
      (v_bozza2, 1, 'zz FARINA', 1, 'kg'),
      (v_bozza2, 2, 'ZZ farina ', 30, 'g');

    -- 8 porzioni dell'amatriciana = 2 dosi = 400 g; 4 porzioni della gricia
    -- = 2 volte = 200 g. Insieme 600 g, da due ricette.
    -- Le risposte sbagliate danno numeri diversi: 300 (porzioni ignorate),
    -- 400 o 200 (una fonte persa), 1000 (bozza moltiplicata per le porzioni).
    select * into v_r from estrapola_ricette(jsonb_build_array(
      jsonb_build_object('tipo', 'ricetta', 'id', v_ric, 'porzioni', 8),
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza, 'porzioni', 4),
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza2, 'porzioni', 1),
      jsonb_build_object('tipo', 'ricetta', 'id', v_vuota, 'porzioni', 2)))
     where ingredient_id = v_ing;
    if v_r.quantita is distinct from 600 then
      raise exception 'VERIFICA: il guanciale consolidato doveva essere 600 g, è %.', v_r.quantita;
    end if;
    if array_length(v_r.da, 1) is distinct from 2 then
      raise exception 'VERIFICA: il guanciale doveva venire da due ricette, viene da %.', v_r.da;
    end if;

    -- La farina: stesso nome (maiuscole e spazi a parte) e stessa unità si
    -- sommano — 50 x 2 + 30 = 130 g —, l'unità diversa resta a parte.
    select count(*) into v_n from estrapola_ricette(jsonb_build_array(
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza, 'porzioni', 4),
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza2, 'porzioni', 1)))
     where lower(nome) like 'zz farina%';
    if v_n <> 2 then
      raise exception 'VERIFICA: la farina in g e in kg doveva restare su due righe, sono %.', v_n;
    end if;
    select * into v_r from estrapola_ricette(jsonb_build_array(
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza, 'porzioni', 4),
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza2, 'porzioni', 1)))
     where lower(nome) like 'zz farina%' and unita = 'g';
    if v_r.quantita is distinct from 130 or coalesce(v_r.problema, '') not like '%non collegato%' then
      raise exception 'VERIFICA: la farina in g doveva fare 130 e dirsi non collegata: % / %', v_r.quantita, v_r.problema;
    end if;

    -- Il sale q.b.: quantità VUOTA e dichiarata, mai zero.
    select * into v_r from estrapola_ricette(jsonb_build_array(
      jsonb_build_object('tipo', 'bozza', 'id', v_bozza, 'porzioni', 4)))
     where nome = 'ZZ sale';
    if v_r.quantita is not null or coalesce(v_r.problema, '') not like '%quantità non indicata%' then
      raise exception 'VERIFICA: il sale q.b. doveva restare vuoto e dichiarato: % / %', v_r.quantita, v_r.problema;
    end if;

    -- La ricetta senza ingredienti si nomina.
    select count(*) into v_n from estrapola_ricette(jsonb_build_array(
      jsonb_build_object('tipo', 'ricetta', 'id', v_vuota, 'porzioni', 2)))
     where problema = 'la ricetta non ha ancora ingredienti';
    if v_n <> 1 then raise exception 'VERIFICA: la ricetta vuota non è stata dichiarata.'; end if;

    -- Porzioni mancanti: rifiuto, non un elenco vuoto.
    v_respinto := false;
    begin
      perform * from estrapola_ricette(jsonb_build_array(jsonb_build_object('tipo', 'ricetta', 'id', v_ric)));
    exception when others then v_respinto := sqlerrm like '%porzioni%';
    end;
    if not v_respinto then raise exception 'VERIFICA: una scelta senza porzioni è stata accettata.'; end if;

    -- Si mette in lista: due righe, una col prodotto e una a nome libero con
    -- un'unità sconosciuta, che finisce nella nota.
    select count(*) into v_lista0 from shopping_list_items;
    v_n := aggiungi_estrapolazione(jsonb_build_array(
      jsonb_build_object('ingredient_id', v_ing, 'nome', 'guanciale', 'quantita', 600, 'unita', 'g',
                         'nota', 'Dalle ricette: amatriciana, gricia'),
      jsonb_build_object('nome', 'ZZ zucchero', 'quantita', 4, 'unita', 'tazza', 'nota', 'Dalle ricette: gricia')));
    if v_n <> 2 or (select count(*) from shopping_list_items) <> v_lista0 + 2 then
      raise exception 'VERIFICA: dovevano entrare in lista due righe.';
    end if;
    if not exists (select 1 from shopping_list_items where custom_name = 'ZZ zucchero'
                    and unit is null and note like '%unità scritta nella ricetta: tazza%') then
      raise exception 'VERIFICA: l''unità sconosciuta doveva finire nella nota.';
    end if;
    -- E adesso la proposta sa quanto guanciale è già in lista.
    select * into v_r from estrapola_ricette(jsonb_build_array(
      jsonb_build_object('tipo', 'ricetta', 'id', v_ric, 'porzioni', 4)))
     where ingredient_id = v_ing;
    if v_r.gia_in_lista is distinct from 600 then
      raise exception 'VERIFICA: «già in lista» doveva dire 600, dice %.', v_r.gia_in_lista;
    end if;

    -- Il portiere: lo staff riceve un rifiuto, non un elenco vuoto.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform * from estrapola_ricette(jsonb_build_array(
        jsonb_build_object('tipo', 'ricetta', 'id', v_ric, 'porzioni', 4)));
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha potuto estrapolare.'; end if;
    v_respinto := false;
    begin
      perform aggiungi_estrapolazione('[{"nome":"x"}]');
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha potuto mettere in lista dalle ricette.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di «Estrapola»');

  raise notice 'Fatto: «Estrapola» consolida per prodotto e unità (600 g da due ricette), lascia vuoto e dichiarato ciò che non sa, nomina le ricette senza ingredienti, mette in lista solo ciò che riceve e rifiuta lo staff. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261011000001', 'estrapola_dalle_ricette')
on conflict (version) do nothing;
