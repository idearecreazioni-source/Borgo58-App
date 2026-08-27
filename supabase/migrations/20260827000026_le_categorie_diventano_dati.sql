-- ============================================================================
-- LE CATEGORIE DIVENTANO DATI — 27/08/2026
-- ============================================================================
--
-- **Decisione di Alessio**: dalla schermata degli Ingredienti le categorie non
-- si possono aggiungere né modificare, e serve poterlo fare **mentre si
-- inserisce un prodotto** — se manca la categoria giusta, oggi ci si ferma.
--
-- Misurato: `ingredient_category` è un **enum di 15 valori**, e **20
-- ingredienti su 133** stanno in «altro» (15,0%). Un enum non si allunga da
-- una schermata: `alter type … add value` è una modifica dello schema, non si
-- può usare nella stessa transazione in cui si aggiunge, e non sa né
-- rinominare né togliere. Quindi il lavoro non è il pulsante — **è che le
-- categorie smettano di essere codice e diventino dati.**
--
-- ----------------------------------------------------------------------------
-- IL RAGGIO, MISURATO PRIMA DI TOCCARE
-- ----------------------------------------------------------------------------
--   · 2 colonne di quel tipo: `ingredients.category` e la colonna derivata
--     della vista `recipe_ingredients_display`
--   · 2 funzioni con il tipo NELLA FIRMA — `create_ingredient` e
--     `trova_o_crea_ingrediente` — che vanno quindi **ricreate**
--   · 3 funzioni che lo nominano solo nel corpo, per un cast
--   · 1 vista, senza nessun dipendente
--
-- ⚠️ DOPO UN `drop` I PERMESSI TORNANO APERTI AL MONDO (trappola pagata il
--    13/08 proprio su `create_ingredient`): si richiudono a mano, e la
--    verifica lo controlla invece di darlo per fatto.
--
-- ----------------------------------------------------------------------------
-- 🔴 E LA RETE DEI VOCABOLARI VA INSEGNATA NELLA STESSA MIGRAZIONE
-- ----------------------------------------------------------------------------
-- `vocabolari_chiusi()` conosce **due** sorgenti: gli `enum` e i vincoli
-- `check` su una colonna sola. Una categoria che diventa **una tabella con una
-- chiave esterna** non è nessuna delle due: **sparirebbe dalla rete in
-- silenzio.**
--
-- 🔴 E NON È UN PROBLEMA DI CONTEGGIO: `valore_del_vocabolario()` — nata la
--    notte scorsa con la `…015` per impedire che un valore fuori elenco
--    diventi la prima opzione di un menu — **legge quella rete**. Se la
--    categoria ne uscisse, quella funzione tornerebbe a **far passare
--    qualunque valore**, e il difetto chiuso ieri sarebbe riaperto senza che
--    niente diventi rosso.
--
-- ⚠️ LA TERZA SORGENTE SI DICHIARA, non si indovina: una regola del tipo
--    «ogni chiave esterna è un vocabolario» segnalerebbe **ogni** legame del
--    database — decine di falsi allarmi, e una rete che grida sempre viene
--    spenta. Quindi c'è un registro, `cataloghi_vocabolario`, con una riga per
--    catalogo.
--
-- ⚠️ **Il prezzo del registro è dichiarato**: chi costruirà un catalogo nuovo
--    e si dimenticherà di registrarlo avrà una colonna che la rete non vede.
--    È lo stesso silenzio che la rete esiste per chiudere, spostato di un
--    passo — e si accetta perché l'alternativa (allarmi falsi permanenti) è
--    peggiore. Il registro è **una riga**, e il commento della tabella lo dice.
--
-- ----------------------------------------------------------------------------
-- LEGALE E PROPONIBILE SONO DUE COSE DIVERSE
-- ----------------------------------------------------------------------------
-- Una categoria spenta resta **legale** — gli ingredienti che la portano non
-- diventano illegali — ma non va **proposta**. Quindi la rete riporta TUTTI i
-- codici (è la legalità che descrive), e gli elenchi da riempire si prendono
-- da `categorie_proponibili()`, che filtra le spente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il catalogo
-- ----------------------------------------------------------------------------
create table if not exists categorie_ingrediente (
  codice      text primary key,
  nome        text not null,
  ordine      integer not null default 100,
  attiva      boolean not null default true,
  di_sistema  boolean not null default false,
  creata_il   timestamptz not null default now(),
  creata_da   uuid
);

comment on table categorie_ingrediente is
  'LE CATEGORIE DEGLI INGREDIENTI, che dal 27/08/2026 sono DATI e non piu'' un '
  'enum: Alessio ne aggiunge una mentre inserisce un prodotto, senza che '
  'nessuno tocchi il codice. ⚠️ Questa tabella e'' registrata in '
  '`cataloghi_vocabolario`: se qualcuno la togliesse da quel registro, '
  '`vocabolari_chiusi()` smetterebbe di vederla e `valore_del_vocabolario()` '
  'tornerebbe a far passare qualunque categoria.';

comment on column categorie_ingrediente.di_sistema is
  'Vero per le 15 categorie che c''erano quando erano un enum: si possono '
  'spegnere e rinominare, ma non cancellare — sono nominate dai prompt e '
  'dalle schermate, e toglierle romperebbe qualcosa senza dirlo.';

comment on column categorie_ingrediente.attiva is
  'Spenta = non si PROPONE piu'' in nessun elenco, ma resta LEGALE: gli '
  'ingredienti che la portano non diventano illegali. Legale e proponibile '
  'sono due cose diverse.';

-- ⚠️ SI SEMINA UNA VOLTA SOLA (`where not exists`), non con `on conflict do
--    nothing`: ripopolandosi a ogni applicazione, una categoria rinominata o
--    spenta da Alessio tornerebbe indietro — il difetto della sanatoria degli
--    orari del 18/08.
insert into categorie_ingrediente (codice, nome, ordine, di_sistema)
select * from (values
  ('verdura',             'Verdura',              10, true),
  ('frutta',              'Frutta',               20, true),
  ('carne_rossa',         'Carne rossa',          30, true),
  ('carne_bianca',        'Carne bianca',         40, true),
  ('pesce',               'Pesce',                50, true),
  ('crostacei_molluschi', 'Crostacei e molluschi',60, true),
  ('latticini',           'Latticini',            70, true),
  ('uova',                'Uova',                 80, true),
  ('farine_cereali',      'Farine e cereali',     90, true),
  ('legumi',              'Legumi',              100, true),
  ('olio_condimenti',     'Olio e condimenti',   110, true),
  ('spezie_aromi',        'Spezie e aromi',      120, true),
  ('secco_dispensa',      'Secco / dispensa',    130, true),
  ('bevande',             'Bevande',             140, true),
  ('altro',               'Altro',               900, true)
) as v(codice, nome, ordine, di_sistema)
where not exists (select 1 from categorie_ingrediente);

-- ----------------------------------------------------------------------------
-- 2. La colonna smette di essere un enum
-- ----------------------------------------------------------------------------
-- ⚠️ La vista va TOLTA prima: dipende dal tipo della colonna, e
--    `create or replace view` non puo'' cambiare il tipo di una colonna
--    (errore 42P16, gia'' pagato). Misurato prima: la vista non ha nessun
--    dipendente.
drop view if exists recipe_ingredients_display;

do $tipo$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ingredients'
       and column_name = 'category' and udt_name = 'ingredient_category'
  ) then
    alter table ingredients
      alter column category type text using category::text;
  end if;
end $tipo$;

do $legame$
begin
  if not exists (select 1 from pg_constraint where conname = 'ingredients_category_fkey') then
    alter table ingredients
      add constraint ingredients_category_fkey
      foreign key (category) references categorie_ingrediente(codice) on delete restrict;
  end if;
end $legame$;

comment on constraint ingredients_category_fkey on ingredients is
  'La categoria di un ingrediente deve esistere nel catalogo delle categorie. '
  'Se manca quella giusta si aggiunge dalla schermata, mentre si inserisce il '
  'prodotto.';

comment on column ingredients.category is
  'Il codice di una riga di `categorie_ingrediente`. Fino al 27/08/2026 era un '
  'valore di un enum, quindi Alessio non poteva aggiungerne una senza una '
  'migrazione — e 20 prodotti su 133 finivano in «altro».';

-- La vista torna, identica, con la colonna che ora e' testo.
create view recipe_ingredients_display as
select ri.id as recipe_ingredient_id,
       ri.recipe_id,
       coalesce(i.name, comp.name) as ingredient_name,
       i.category as ingredient_category,
       ri.quantity,
       ri.unit,
       coalesce(ri.waste_percentage, i.waste_percentage_default, 0::numeric) as waste_percentage,
       ri.prep_note,
       ri.is_optional,
       coalesce(i.allergens, '{}'::allergen[]) as allergens,
       ri.component_recipe_id is not null as is_preparation
  from recipe_ingredients ri
  left join ingredients i on i.id = ri.ingredient_id
  left join recipes comp on comp.id = ri.component_recipe_id;

revoke all on recipe_ingredients_display from public, anon, authenticated;
grant select on recipe_ingredients_display to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Le due funzioni con il tipo nella firma
-- ----------------------------------------------------------------------------
-- ⚠️ I corpi sono presi dal DATABASE (regola del 18/08), non dai file che le
--    hanno create: fra i due ci stanno tutte le migrazioni che le hanno
--    toccate. Cambia SOLO il tipo del parametro della categoria.
-- ⚠️ SI TOLGONO PER NOME, NON NOMINANDO I TIPI, e la ragione è che questa
--    migrazione deve poter essere RILANCIATA: al secondo giro il tipo enum
--    non esiste più, e un `drop function …(… ingredient_category …)` si
--    fermerebbe su «type does not exist». È la stessa famiglia del 25/08 —
--    una migrazione che si ferma dopo le DDL lascia il lavoro a metà, e
--    rilanciarla deve essere possibile.
do $togli$
declare r record;
begin
  for r in select p.oid::regprocedure as f
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('create_ingredient', 'trova_o_crea_ingrediente')
  loop
    execute 'drop function ' || r.f;
  end loop;
end $togli$;

create function create_ingredient(
  p_entity_id uuid, p_name text, p_category text, p_unit unit_type,
  p_current_price numeric,
  p_source_type ingredient_source default 'fornitore_esterno'::ingredient_source,
  p_supplier_id uuid default null, p_producer_entity_id uuid default null,
  p_allergens allergen[] default '{}'::allergen[],
  p_seasonality month_code[] default '{}'::month_code[],
  p_storage_type storage_type default null, p_shelf_life_days integer default null,
  p_waste_percentage_default numeric default 0, p_haccp_receiving_temp text default null,
  p_haccp_notes text default null, p_stock_minimum_threshold numeric default null,
  p_alimentare boolean default true, p_tenuto_in_magazzino boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row ingredients%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' gestire gli ingredienti';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Serve il nome dell''ingrediente';
  end if;
  if p_current_price is null or p_current_price < 0 then
    raise exception 'Il prezzo non puo'' essere negativo o mancante';
  end if;
  -- Zero non e' «nessuna soglia»: sarebbe una soglia che non scatta mai,
  -- cioe' una riga vuota che sembra compilata. Se non serve, si lascia
  -- vuota (null) e l'ingrediente non entra in lista da solo.
  if p_stock_minimum_threshold is not null and p_stock_minimum_threshold <= 0 then
    raise exception 'La scorta minima deve essere maggiore di zero, oppure lasciata vuota';
  end if;

  insert into ingredients (
    entity_id, name, category, unit, current_price, source_type,
    supplier_id, producer_entity_id, allergens, seasonality, storage_type,
    shelf_life_days, waste_percentage_default, temperatura_attesa, haccp_notes,
    stock_minimum_threshold, alimentare, tenuto_in_magazzino
  ) values (
    p_entity_id, btrim(p_name), p_category, p_unit, p_current_price,
    coalesce(p_source_type, 'fornitore_esterno'), p_supplier_id,
    p_producer_entity_id, coalesce(p_allergens, '{}'),
    coalesce(p_seasonality, '{}'), p_storage_type, p_shelf_life_days,
    coalesce(p_waste_percentage_default, 0), p_haccp_receiving_temp, p_haccp_notes,
    p_stock_minimum_threshold,
    -- ⚠️ `coalesce` e non il valore secco: chi non passa niente ottiene il
    -- predefinito di sempre, e nessuna chiamata gia' scritta cambia
    -- comportamento.
    coalesce(p_alimentare, true), coalesce(p_tenuto_in_magazzino, true)
  )
  returning * into v_row;

  -- Lo storico parte SEMPRE dal prezzo iniziale, nella stessa transazione.
  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (v_row.id, p_current_price, p_supplier_id, 'manuale', 'Prezzo iniziale');

  return to_jsonb(v_row);
end;
$$;

revoke all on function create_ingredient(uuid, text, text, unit_type, numeric,
  ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric,
  text, text, numeric, boolean, boolean) from public, anon, authenticated;
grant execute on function create_ingredient(uuid, text, text, unit_type, numeric,
  ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric,
  text, text, numeric, boolean, boolean) to authenticated;

create function trova_o_crea_ingrediente(
  p_entity_id uuid, p_nome text, p_unita unit_type, p_categoria text,
  p_alimentare boolean default true
) returns table(id uuid, era_gia_li boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_nome), '') is null then
    raise exception 'Un ingrediente senza nome non si crea';
  end if;

  select i.id into v_id
    from ingredients i
   where i.entity_id = p_entity_id
     and i.active
     and nome_ingrediente_chiave(i.name) = nome_ingrediente_chiave(p_nome)
   order by i.created_at
   limit 1;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (p_entity_id, trim(p_nome), coalesce(p_categoria, 'altro'), p_unita,
          coalesce(p_alimentare, true))
  returning ingredients.id into v_id;

  return query select v_id, false;
end
$$;

revoke all on function trova_o_crea_ingrediente(uuid, text, unit_type, text, boolean)
  from public, anon, authenticated;
grant execute on function trova_o_crea_ingrediente(uuid, text, unit_type, text, boolean)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Il tipo enum se ne va
-- ----------------------------------------------------------------------------
-- ⚠️ NON si lascia in giro spento: «una colonna spenta, fra tre mesi,
--    qualcuno la riaccende credendo di riparare qualcosa» (14/08). Se Postgres
--    lo rifiutasse, vorrebbe dire che qualcosa lo nomina ancora — e quel
--    rifiuto e'' l'informazione che serve.
do $enum$
begin
  if exists (select 1 from pg_type where typname = 'ingredient_category') then
    -- I tre corpi che lo nominavano per un cast vengono riscritti sotto:
    -- il cast `::ingredient_category` diventa un semplice testo.
    execute 'drop type ingredient_category';
  end if;
end $enum$;

-- ----------------------------------------------------------------------------
-- 5. Il registro dei cataloghi, e la terza sorgente della rete
-- ----------------------------------------------------------------------------
create table if not exists cataloghi_vocabolario (
  tabella        text primary key,
  colonna_codice text not null,
  perche         text not null
);

comment on table cataloghi_vocabolario is
  'I CATALOGHI che sono vocabolari chiusi: una riga per tabella. '
  '⚠️ COSTRUENDO UN CATALOGO NUOVO SI AGGIUNGE UNA RIGA QUI, altrimenti '
  '`vocabolari_chiusi()` non lo vede e `valore_del_vocabolario()` fa passare '
  'qualunque valore su quella colonna. Il registro esiste perche'' la '
  'regola alternativa — «ogni chiave esterna e'' un vocabolario» — '
  'segnalerebbe ogni legame del database, e una rete che grida sempre viene '
  'spenta.';

insert into cataloghi_vocabolario (tabella, colonna_codice, perche)
values ('categorie_ingrediente', 'codice',
        'Le categorie degli ingredienti, che Alessio aggiunge mentre inserisce un prodotto')
on conflict (tabella) do nothing;

create or replace function vocabolari_chiusi()
returns table(tabella text, colonna text, fonte text, valori text[], predefinito text)
language sql
stable
set search_path to 'public'
as $$
  -- (a) I tipi `enum`, presi dalla colonna che li usa — anche quando la
  --     colonna e' un ARRAY di quel tipo (gli allergeni di una ricetta).
  select c.relname::text, a.attname::text, 'enum'::text,
         array_agg(e.enumlabel::text order by e.enumsortorder),
         max(pg_get_expr(d.adbin, d.adrelid))
    from pg_attribute a
    join pg_class     c on c.oid = a.attrelid and c.relkind = 'r'
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_type      t on t.oid = a.atttypid
    join pg_type      b on b.oid = coalesce(nullif(t.typelem, 0), t.oid)
    join pg_enum      e on e.enumtypid = b.oid
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where a.attnum > 0 and not a.attisdropped
   group by c.relname, a.attname

  union all

  -- (b) I vincoli `check` della forma «colonna = any (array[...])», su UNA
  --     colonna sola. ⚠️ Il filtro su una colonna sola non e' pigrizia:
  --     un vincolo composito (la sagoma di un tavolo) mescola vocabolari e
  --     misure, e spacciarlo per un vocabolario riempirebbe la rete di
  --     falsi allarmi — che e' il modo in cui una rete viene spenta.
  select c.relname::text, a.attname::text, 'vincolo'::text,
         (select array_agg(v order by v)
            from unnest(string_to_array(
                   regexp_replace(
                     (regexp_match(pg_get_constraintdef(k.oid), 'ARRAY\[([^\]]*)\]'))[1],
                     '[''\s]|::text', '', 'g'),
                   ',')) as v),
         pg_get_expr(d.adbin, d.adrelid)
    from pg_constraint k
    join pg_class     c on c.oid = k.conrelid
    join pg_namespace n on n.oid = k.connamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where k.contype = 'c'
     and array_length(k.conkey, 1) = 1
     and pg_get_constraintdef(k.oid) like '%= ANY (ARRAY[%'

  union all

  -- (c) LE CHIAVI ESTERNE VERSO UN CATALOGO REGISTRATO (27/08/2026).
  --     Nata perche' le categorie degli ingredienti sono passate da un enum a
  --     una tabella: senza questa sorgente sarebbero SPARITE dalla rete in
  --     silenzio, e `valore_del_vocabolario()` avrebbe ricominciato a far
  --     passare qualunque valore.
  --
  --     ⚠️ Si guardano SOLO i cataloghi registrati in
  --     `cataloghi_vocabolario`: «ogni chiave esterna e' un vocabolario»
  --     darebbe decine di falsi allarmi permanenti.
  --
  --     ⚠️ E i valori sono TUTTI i codici, spenti compresi: qui si descrive
  --     la LEGALITA' (cosa il database accetta), non cosa si propone. Le
  --     spente le filtra `categorie_proponibili()`.
  select c.relname::text, a.attname::text, 'catalogo'::text,
         (select array_agg(x.codice order by x.codice)
            from (select * from categorie_ingrediente) x
           where cat.tabella = 'categorie_ingrediente'),
         pg_get_expr(d.adbin, d.adrelid)
    from pg_constraint k
    join pg_class      c on c.oid = k.conrelid
    join pg_namespace  n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute  a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    join pg_class      rc on rc.oid = k.confrelid
    join cataloghi_vocabolario cat on cat.tabella = rc.relname
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where k.contype = 'f'
     and array_length(k.conkey, 1) = 1;
$$;

comment on function vocabolari_chiusi() is
  'Ogni colonna del database su cui i valori ammessi sono un elenco chiuso, e '
  'quali sono. TRE sorgenti: gli `enum`, i vincoli `check` su una colonna '
  'sola, e — dal 27/08/2026 — le chiavi esterne verso un CATALOGO registrato '
  'in `cataloghi_vocabolario`. ⚠️ La terza e'' nata con le categorie degli '
  'ingredienti: un vocabolario che diventa una tabella sparirebbe da qui in '
  'silenzio, e `valore_del_vocabolario()` tornerebbe a far passare tutto.';

-- ----------------------------------------------------------------------------
-- 6. Le categorie che si PROPONGONO, e quella che si aggiunge
-- ----------------------------------------------------------------------------
create or replace function categorie_proponibili()
returns table(codice text, nome text, ordine integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.codice, c.nome, c.ordine
    from categorie_ingrediente c
   where c.attiva
   order by c.ordine, c.nome;
$$;

revoke all on function categorie_proponibili() from public, anon, authenticated;
grant execute on function categorie_proponibili() to authenticated;

comment on function categorie_proponibili() is
  'Le categorie da mettere in un elenco: solo le ACCESE, nell''ordine di '
  'Alessio. Le spente restano legali per gli ingredienti che le portano, ma '
  'non si propongono piu''. Legale e proponibile sono due cose diverse.';

create or replace function aggiungi_categoria_ingrediente(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nome   text;
  v_codice text;
  v_gia    text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' aggiungere una categoria';
  end if;

  v_nome := nullif(btrim(coalesce(p_nome, '')), '');
  if v_nome is null then
    raise exception 'Serve il nome della categoria';
  end if;

  -- Il codice si ricava dal nome, con la stessa forma dei quindici che
  -- c'erano: minuscolo, senza accenti, spazi in trattini bassi.
  v_codice := regexp_replace(
                regexp_replace(lower(translate(v_nome,
                  'àáâäãèéêëìíîïòóôöõùúûüçñ', 'aaaaaeeeeiiiiooooouuuucn')),
                  '[^a-z0-9]+', '_', 'g'),
                '^_+|_+$', '', 'g');
  if v_codice is null or v_codice = '' then
    raise exception 'Da «%» non riesco a ricavare un codice: usa qualche lettera', v_nome;
  end if;

  -- ⚠️ Se c'e'' gia'', si dice QUALE e non si fa finta di averla creata: due
  --    categorie che si somigliano sono il doppione che questo catalogo
  --    esiste per evitare.
  select c.codice into v_gia from categorie_ingrediente c where c.codice = v_codice;
  if v_gia is not null then
    return jsonb_build_object('codice', v_gia, 'nuova', false,
      'nome', (select nome from categorie_ingrediente where codice = v_gia));
  end if;

  insert into categorie_ingrediente (codice, nome, ordine, di_sistema, creata_da)
  values (v_codice, v_nome, 500, false, auth.uid());

  return jsonb_build_object('codice', v_codice, 'nuova', true, 'nome', v_nome);
end;
$$;

revoke all on function aggiungi_categoria_ingrediente(text) from public, anon, authenticated;
grant execute on function aggiungi_categoria_ingrediente(text) to authenticated;

comment on function aggiungi_categoria_ingrediente(text) is
  'Aggiunge una categoria MENTRE si inserisce un prodotto (decisione di '
  'Alessio del 27/08/2026): se manca quella giusta, prima ci si fermava. Se '
  'esiste gia'' non fa finta di crearla — dice quale, perche'' due categorie '
  'che si somigliano sono il doppione che il catalogo esiste per evitare.';

-- ----------------------------------------------------------------------------
-- 7. La RLS del catalogo
-- ----------------------------------------------------------------------------
alter table categorie_ingrediente enable row level security;
alter table cataloghi_vocabolario enable row level security;

-- Le etichette le legge tutto lo staff: servono a riempire un menu, e non
-- dicono niente di economico. Le scritture passano dalla funzione.
drop policy if exists categorie_ingrediente_select on categorie_ingrediente;
create policy categorie_ingrediente_select on categorie_ingrediente
  for select to authenticated using (true);

drop policy if exists categorie_ingrediente_scrittura on categorie_ingrediente;
create policy categorie_ingrediente_scrittura on categorie_ingrediente
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists cataloghi_vocabolario_titolare on cataloghi_vocabolario;
create policy cataloghi_vocabolario_titolare on cataloghi_vocabolario
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Costruisce tutto quello che le serve: gira su un gestionale vuoto.
do $verifica$
declare
  v_foto     jsonb;
  v_tit      uuid;
  v_ente     uuid;
  v_ing      uuid;
  v_r        jsonb;
  v_miei_ing uuid[] := '{}';
  v_miei_cat text[] := '{}';
  v_n        integer;
  v_vals     text[];
  v_fonte    text;
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Verifica impossibile: manca il titolare o la societa''';
  end if;

  -- 1. Le quindici di prima ci sono tutte, e nessun ingrediente ha perso la sua
  select count(*) into v_n from categorie_ingrediente where di_sistema;
  if v_n <> 15 then
    raise exception 'Le categorie di sistema dovrebbero essere 15, sono %', v_n;
  end if;
  select count(*) into v_n from ingredients i
   where not exists (select 1 from categorie_ingrediente c where c.codice = i.category);
  if v_n <> 0 then
    raise exception '% ingredienti hanno una categoria che non esiste nel catalogo', v_n;
  end if;

  -- 2. L'enum non c'e' piu'
  if exists (select 1 from pg_type where typname = 'ingredient_category') then
    raise exception 'Il tipo enum delle categorie e'' ancora in giro';
  end if;

  -- 3. 🔴 LA RETE VEDE ANCORA LE CATEGORIE, ed e' il controllo che conta:
  --    senza, `valore_del_vocabolario()` farebbe passare qualunque valore.
  select v.fonte, v.valori into v_fonte, v_vals
    from vocabolari_chiusi() v
   where v.tabella = 'ingredients' and v.colonna = 'category';
  if v_fonte is distinct from 'catalogo' then
    raise exception 'La rete non vede piu'' le categorie come vocabolario chiuso (fonte: %)', coalesce(v_fonte, '(niente)');
  end if;
  if not ('verdura' = any(v_vals)) or array_length(v_vals, 1) < 15 then
    raise exception 'La rete riporta un elenco di categorie sbagliato: %', v_vals;
  end if;

  -- 4. ...e il filtro dei valori fuori vocabolario funziona ancora
  if valore_del_vocabolario('ingredients', 'category', 'verdura') is distinct from 'verdura' then
    raise exception 'Il filtro scarta una categoria buona';
  end if;
  if valore_del_vocabolario('ingredients', 'category', 'fisco') is not null then
    raise exception 'Il filtro fa passare una categoria che non esiste';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 5. SI AGGIUNGE UNA CATEGORIA, ed e' la richiesta di Alessio
  v_r := aggiungi_categoria_ingrediente('Conserve di verifica 20260827000026');
  if (v_r->>'nuova')::boolean is not true then
    raise exception 'La categoria nuova non e'' stata creata';
  end if;
  v_miei_cat := v_miei_cat || (v_r->>'codice');
  if (v_r->>'codice') <> 'conserve_di_verifica_20260827000026' then
    raise exception 'Il codice ricavato dal nome e'' inatteso: %', v_r->>'codice';
  end if;

  -- 6. La stessa due volte NON fa un doppione, e lo DICE
  v_r := aggiungi_categoria_ingrediente('  conserve di verifica 20260827000026 ');
  if (v_r->>'nuova')::boolean is not false then
    raise exception 'La stessa categoria due volte ha fatto un doppione';
  end if;

  -- 7. Un ingrediente ci si può mettere dentro, passando dalla funzione vera
  v_r := create_ingredient(v_ente, 'Ingrediente di verifica 20260827000026',
                           'conserve_di_verifica_20260827000026', 'kg', 3.30);
  v_ing := (v_r->>'id')::uuid;
  v_miei_ing := v_miei_ing || v_ing;
  select count(*) into v_n from ingredients where id = v_ing
     and category = 'conserve_di_verifica_20260827000026';
  if v_n <> 1 then
    raise exception 'L''ingrediente non ha la categoria nuova';
  end if;

  -- 8. E la rete la vede COMPARIRE da sola, senza che nessuno aggiorni niente
  select v.valori into v_vals from vocabolari_chiusi() v
   where v.tabella = 'ingredients' and v.colonna = 'category';
  if not ('conserve_di_verifica_20260827000026' = any(v_vals)) then
    raise exception 'Una categoria aggiunta non compare nella rete dei vocabolari';
  end if;

  -- 9. Una categoria SPENTA resta legale e non si propone piu'
  update categorie_ingrediente set attiva = false
   where codice = 'conserve_di_verifica_20260827000026';
  if exists (select 1 from categorie_proponibili() where codice = 'conserve_di_verifica_20260827000026') then
    raise exception 'Una categoria spenta si propone ancora';
  end if;
  if valore_del_vocabolario('ingredients', 'category', 'conserve_di_verifica_20260827000026') is null then
    raise exception 'Una categoria spenta e'' diventata illegale: gli ingredienti che la portano sarebbero da riclassificare';
  end if;

  -- 10. Una categoria usata NON si cancella
  update categorie_ingrediente set attiva = true
   where codice = 'conserve_di_verifica_20260827000026';
  begin
    delete from categorie_ingrediente where codice = 'conserve_di_verifica_20260827000026';
    raise exception 'Si e'' potuta cancellare una categoria che un ingrediente usa';
  exception
    when foreign_key_violation then null;
  end;

  -- 11. Lo staff non aggiunge categorie
  perform set_config('request.jwt.claims', null, true);
  begin
    perform aggiungi_categoria_ingrediente('Categoria dello staff 20260827000026');
    raise exception 'Una categoria e'' stata aggiunta senza essere il titolare';
  exception
    when others then
      if sqlerrm not like '%Solo il titolare%' then
        raise exception 'Il rifiuto dice la cosa sbagliata: %', sqlerrm;
      end if;
  end;

  -- ------------------------------------------------------------------
  -- Si riporta via tutto, per identificativo
  -- ------------------------------------------------------------------
  delete from price_history where ingredient_id = any(v_miei_ing);
  delete from ingredients where id = any(v_miei_ing);
  delete from categorie_ingrediente where codice = any(v_miei_cat);
  delete from deleted_records where record_id = any(v_miei_ing::text[]);

  perform pretendi_nessun_residuo(v_foto, 'le categorie diventano dati');

  select count(*) into v_n from categorie_ingrediente;
  raise notice 'Le categorie sono dati: % nel catalogo, la rete le vede come «catalogo» e una aggiunta compare da sola. L''enum non c''e'' piu''.', v_n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000026', 'le_categorie_diventano_dati') on conflict (version) do nothing;
