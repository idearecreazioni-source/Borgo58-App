-- =====================================================================
-- NON E' UN CONTO, E' UNA PRODUZIONE
-- 23/08/2026
-- =====================================================================
-- 🔴 DIFETTO TROVATO APRENDO LA SCHERMATA, non rileggendo il codice. Fatto
-- il blocco 2, l'elenco «Cosa non e' sceso dal magazzino» e' passato da
-- 1.843 righe a 3 — e quelle 3 dicevano tutte:
--
--     «— · non ce n'era abbastanza: Mascarpone — di questo conto non e'
--      sceso niente»
--
-- Misurato: **non sono conti, sono produzioni**. `order_id` e' vuoto,
-- `produzione_id` no, e da quelle produzioni erano scesi rispettivamente
-- 3, 7 e 2 ingredienti. Quindi la riga sbagliava **due volte**: chiamava
-- conto una produzione, e diceva «non e' sceso niente» dove era sceso
-- quasi tutto.
--
-- ⚠️ META' DIFETTO ERA GIA' LI' DA PRIMA, e nessuno l'aveva visto: dal
-- 14/08 `registra_produzione` scrive in `anomalie_scarico`, ma
-- `scarichi_non_riusciti` fa `left join orders` e basta — quindi le
-- anomalie delle produzioni comparivano da sempre con il tavolo vuoto, in
-- un riquadro intitolato «righe di conti chiusi». **Erano invisibili
-- perche' sepolte sotto 1.840 bevande.**
--
-- ⚠️ E L'ALTRA META' L'HO AGGIUNTA IO STAMATTINA: la frase «di questo
-- conto non e' sceso niente» e' nata col blocco 1, per non lasciare
-- silenzioso uno scarico parziale. Su una produzione afferma una cosa
-- falsa con calma — che e' peggio del silenzio che voleva togliere.
--
-- *Una cura che non guarda tutti i casi che il suo dato puo' avere
-- diventa una bugia sui casi che non ha guardato.*
-- =====================================================================

-- ⚠️ Cambia il tipo di ritorno: va tolta e rifatta, e i permessi si
-- richiudono a mano (dopo un `drop` tornano aperti al mondo).
drop function if exists scarichi_non_riusciti(date, date);

create or replace function scarichi_non_riusciti(p_dal date default null, p_al date default null)
returns table (
  id                uuid,
  quando            timestamptz,
  tavolo            text,
  tipo              text,
  descrizione       text,
  quantita_mancante numeric,
  unita             text,
  conto_id          uuid,
  serata            date,
  altri_scesi       integer,
  produzione        text
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro.
  -- E chi non deve vedere riceve un rifiuto, non un elenco vuoto: una
  -- schermata vuota direbbe "e'' andato tutto bene", che qui e'' falso.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere cosa non e'' stato scaricato dal magazzino';
  end if;

  return query
  select a.id,
         a.creato_il,
         o.table_label,
         a.tipo,
         a.descrizione,
         a.quantita_mancante,
         i.unit::text,
         a.order_id,
         -- La serata, non il giorno di calendario: un conto chiuso all'una
         -- di notte appartiene alla sera prima.
         case when o.closed_at is not null then serata_di_servizio(o.closed_at) end,
         -- 🔴 QUANTI SONO SCESI LO STESSO — dal conto **o dalla
         -- produzione**. Contare solo il conto faceva dire «non e' sceso
         -- niente» su una produzione da cui era sceso quasi tutto.
         (select count(*)::integer from stock_consumptions sc
           where (a.order_id is not null and sc.order_id = a.order_id)
              or (a.produzione_id is not null and sc.produzione_id = a.produzione_id)),
         -- Il nome della preparazione, quando la riga viene da una
         -- produzione: senza, quella riga non ha nessun padrone a schermo.
         r.name
    from anomalie_scarico a
    left join orders o      on o.id = a.order_id
    left join ingredients i on i.id = a.ingredient_id
    left join produzioni p  on p.id = a.produzione_id
    left join recipes r     on r.id = p.recipe_id
   where (p_dal is null or (a.creato_il at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (a.creato_il at time zone 'Europe/Rome')::date <= p_al)
   order by a.creato_il desc;
end;
$funzione$;

comment on function scarichi_non_riusciti(date, date) is
  'Le righe che il magazzino non ha potuto scaricare nel periodo, col motivo. Riguarda DUE cose diverse: i conti chiusi e le produzioni — e dal 23/08/2026 le distingue, perche'' chiamare conto una produzione e dire che non e'' sceso niente dove era sceso quasi tutto e'' peggio del silenzio che quella frase voleva togliere.';

revoke all on function scarichi_non_riusciti(date, date) from public, anon, authenticated;
grant execute on function scarichi_non_riusciti(date, date) to authenticated;


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- ⚠️ Non gira sul caso vuoto: si costruisce una produzione che lascia
-- un'anomalia E scarica qualcosa, perche' e' il caso in cui la riga
-- sbagliava. Su una tabella vuota questo blocco passerebbe senza provare
-- niente (regola del 17/08).
do $verifica$
declare
  v_ente     uuid;
  v_tit      uuid;
  v_a        uuid;   -- ingrediente che c'e'
  v_b        uuid;   -- ingrediente che non basta
  v_prep     uuid;
  v_prod     uuid;
  v_riga     record;
  v_lapidi   integer;
  v_lapidi_2 integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ prod pieno', 'kg', 'verdura', v_ente, true) returning id into v_a;
  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ prod scarso', 'kg', 'verdura', v_ente, true) returning id into v_b;

  -- Il primo abbonda, il secondo non basta: cosi' la produzione scarica
  -- qualcosa E lascia un'anomalia. Con un ingrediente solo non si potrebbe
  -- distinguere «non e' sceso niente» da «e' sceso il resto».
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_a, 10, 10, 3), (v_b, 0.1, 0.1, 5);

  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('ZZ preparazione', 'primo', 'preparazione', 1, 1, 'kg') returning id into v_prep;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_prep, v_a, 1, 'kg'), (v_prep, v_b, 1, 'kg');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  perform registra_produzione(v_prep, 1, 0.9, null, 'ZZ verifica');
  select id into v_prod from produzioni where recipe_id = v_prep;

  select * into v_riga from scarichi_non_riusciti(null, null)
   where descrizione = 'ZZ prod scarso' limit 1;

  if v_riga.id is null then
    raise exception 'L''anomalia della produzione non compare nell''elenco.';
  end if;
  if v_riga.produzione is distinct from 'ZZ preparazione' then
    raise exception 'La riga non dice da quale produzione viene: %.', v_riga.produzione;
  end if;
  if v_riga.conto_id is not null then
    raise exception 'La riga di una produzione porta un conto che non esiste.';
  end if;
  -- 🔴 IL CUORE: da questa produzione un ingrediente E' sceso.
  if coalesce(v_riga.altri_scesi, 0) < 1 then
    raise exception 'La riga dice che non e'' sceso niente, e invece era sceso qualcosa (%).',
      v_riga.altri_scesi;
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- pulizia
  delete from anomalie_scarico where produzione_id = v_prod;
  delete from stock_consumptions where produzione_id = v_prod;
  delete from stock_lots where ingredient_id in (v_a, v_b)
      or id = (select lotto_id from produzioni where id = v_prod);
  delete from produzioni where id = v_prod;
  delete from recipe_ingredients where recipe_id = v_prep;
  delete from ingredients where preparazione_id = v_prep;
  delete from recipes where id = v_prep;
  delete from ingredients where id in (v_a, v_b);

  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.',
      v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: una riga che viene da una produzione lo dice, e dice quanto e'' sceso lo stesso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000004', 'non_e_un_conto_e_una_produzione') on conflict (version) do nothing;
