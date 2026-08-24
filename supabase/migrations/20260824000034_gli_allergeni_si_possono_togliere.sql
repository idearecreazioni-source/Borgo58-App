-- =====================================================================
-- GLI ALLERGENI AL TAVOLO — la meta' che sta nel Ricettario
-- 24/08/2026 — blocco 1 del mandato del collaudo, prima parte
-- =====================================================================
-- Alessio: *«per ogni allergene presente nel piatto devo poter dichiarare
-- se e' ELIMINABILE, CON COSA si sostituisce l'ingrediente e QUANTO COSTA
-- IN PIU'»*.
--
-- ---------------------------------------------------------------------
-- LE RISPOSTE SONO TRE, NON DUE — ed e' la prima decisione del blocco
-- ---------------------------------------------------------------------
-- «Si puo' togliere», «non si puo' togliere» e **«non l'ha ancora detto
-- nessuno»**. Un valore predefinito «non eliminabile» sarebbe comodo — in
-- sala il pulsante resta spento e nessuno promette niente — ma renderebbe
-- indistinguibile un piatto **esaminato** da uno **mai guardato**, e su
-- una materia di salute quella differenza e' tutta la differenza. Quindi:
-- l'assenza di una riga in `scelte_allergene` e' il terzo stato, e la
-- scheda del piatto lo dice.
--
-- ⚠️ IN SALA I DUE «NO» SI COMPORTANO UGUALE (spento, si avvisa il
-- cliente), e va bene cosi': fra i due, il gestionale sbaglia sempre dalla
-- parte di non promettere. Il posto dove la differenza serve e' il
-- Ricettario, dove si decide.
--
-- ---------------------------------------------------------------------
-- DUE TABELLE, PERCHE' SONO DUE DOMANDE
-- ---------------------------------------------------------------------
--   · `scelte_allergene`       — LA DECISIONE: si puo' togliere, si'/no.
--   · `sostituzioni_allergene` — COME SI FA: quale ingrediente esce, quale
--                                entra, quanto costa in piu'.
--
-- 🔴 E LA SECONDA E' PER INGREDIENTE, NON PER ALLERGENE. Il lattosio di un
-- piatto puo' arrivare dal burro **e** dalla panna: dichiarando la
-- sostituzione del solo burro e promettendo «senza lattosio» si servirebbe
-- a un intollerante un piatto che il lattosio ce l'ha ancora. Nessun
-- errore, nessun avviso — e un cliente che sta male. Per questo:
--
-- ⚠️ **«ELIMINABILE» NON SI PUO' DICHIARARE SE LA COPERTURA NON E'
--    COMPLETA**, e a rifiutare e' un trigger del database, non un
--    controllo nella schermata. Il rifiuto NOMINA TUTTI gli ingredienti
--    scoperti: dirne uno per volta fa scoprire il secondo dopo aver
--    risolto il primo, e alla terza si smette di leggere.
--
-- ⚠️ E VALE ALLO SPECCHIO: togliere una sostituzione che regge una
--    dichiarazione «si puo' togliere» e' **respinto**, con la via d'uscita
--    scritta dentro il messaggio — prima si toglie la promessa, poi il
--    modo di mantenerla. Un rifiuto senza gesto d'uscita e' un vicolo
--    cieco.
--
-- ---------------------------------------------------------------------
-- IL SOSTITUTO PUO' MANCARE, ED E' UN CASO VERO
-- ---------------------------------------------------------------------
-- «Senza noci» spesso vuol dire *toglierle e basta*, non metterci altro.
-- `sostituto_id` e' quindi facoltativo: vuoto = si toglie e non entra
-- niente al suo posto, e il magazzino non scarica niente per quella riga.
-- ⚠️ Il verso opposto e' vietato da un vincolo: non si puo' dire «ci metto
-- il burro senza lattosio» senza dire **al posto di cosa** — senza quello
-- il magazzino non saprebbe cosa smettere di scaricare.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La decisione
-- ---------------------------------------------------------------------
create table if not exists scelte_allergene (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,
  allergene     allergen not null,
  eliminabile   boolean not null,
  nota          text,
  deciso_da     uuid,
  deciso_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint scelta_allergene_unica unique (recipe_id, allergene)
);

comment on table scelte_allergene is
  'Per un piatto e un allergene: si puo'' togliere, si'' o no. L''ASSENZA di riga e'' il terzo stato — nessuno l''ha ancora guardato — e in sala si comporta come un no.';
comment on column scelte_allergene.deciso_da is
  'Chi l''ha dichiarato. Oggi si entra per ruolo e non per persona, ma l''identificativo si conserva: il giorno degli accessi personali la storia diventa attribuibile all''indietro.';

-- ---------------------------------------------------------------------
-- 2 · Come si fa
-- ---------------------------------------------------------------------
create table if not exists sostituzioni_allergene (
  id               uuid primary key default gen_random_uuid(),
  recipe_id        uuid not null references recipes(id) on delete cascade,
  allergene        allergen not null,
  ingrediente_id   uuid not null references ingredients(id) on delete restrict,
  sostituto_id     uuid references ingredients(id) on delete restrict,
  costo_aggiuntivo numeric(12,2) not null default 0,
  nota             text,
  creato_il        timestamptz not null default now(),
  aggiornato_il    timestamptz not null default now(),
  constraint sostituzione_allergene_unica unique (recipe_id, allergene, ingrediente_id),
  constraint sostituzione_non_e_se_stessa check (sostituto_id is null or sostituto_id <> ingrediente_id),
  constraint sostituzione_costo_sensato check (costo_aggiuntivo >= 0 and costo_aggiuntivo <= 50)
);

comment on table sostituzioni_allergene is
  'In questo piatto, per togliere questo allergene: quale ingrediente esce, quale entra al suo posto (vuoto = si toglie e basta) e quanto si chiede in piu'' al cliente.';
comment on constraint sostituzione_costo_sensato on sostituzioni_allergene is
  'Il supplemento per una sostituzione va da 0 a 50 euro. Zero e'' normale — quasi sempre non costa niente. Sopra i 50 non e'' un supplemento: e'' una virgola sbagliata, e finirebbe sul conto di un cliente.';
comment on constraint sostituzione_non_e_se_stessa on sostituzioni_allergene is
  'Un ingrediente non si sostituisce con se stesso: sarebbe una sostituzione che non toglie niente, e il piatto prometterebbe di essere senza un allergene che ha ancora.';

create index if not exists idx_sostituzioni_allergene_ricetta
  on sostituzioni_allergene (recipe_id, allergene);
create index if not exists idx_sostituzioni_allergene_ingrediente
  on sostituzioni_allergene (ingrediente_id);
create index if not exists idx_sostituzioni_allergene_sostituto
  on sostituzioni_allergene (sostituto_id);
create index if not exists idx_scelte_allergene_ricetta
  on scelte_allergene (recipe_id);

drop trigger if exists trg_scelte_allergene_aggiornato on scelte_allergene;
create trigger trg_scelte_allergene_aggiornato
  before update on scelte_allergene
  for each row execute function set_aggiornato_il();

drop trigger if exists trg_sostituzioni_allergene_aggiornato on sostituzioni_allergene;
create trigger trg_sostituzioni_allergene_aggiornato
  before update on sostituzioni_allergene
  for each row execute function set_aggiornato_il();

-- ---------------------------------------------------------------------
-- 3 · Quali ingredienti di un piatto portano un allergene
-- ---------------------------------------------------------------------
-- ⚠️ LA STESSA DISCESA CHE USA `v_recipe_allergens`: si scende dentro le
-- preparazioni e dentro i finger, perche' il lattosio di una selezione di
-- finger sta dentro un bocconcino e non nella selezione.
create or replace function public.ingredienti_con_allergene(
  p_recipe_id uuid,
  p_allergene allergen
)
returns table(ingrediente_id uuid, nome text, coperto boolean, sostituto text)
language sql
stable
security definer
set search_path = public
as $function$
  with recursive raggiunti as (
    select ri.ingredient_id, ri.component_recipe_id, 1 as profondita
      from recipe_ingredients ri
     where ri.recipe_id = p_recipe_id
    union all
    select ri2.ingredient_id, ri2.component_recipe_id, g.profondita + 1
      from raggiunti g
      join recipe_ingredients ri2 on ri2.recipe_id = g.component_recipe_id
     where g.component_recipe_id is not null and g.profondita < 10
  )
  select distinct
         i.id,
         i.name,
         s.id is not null,
         sub.name
    from raggiunti g
    join ingredients i on i.id = g.ingredient_id
    left join sostituzioni_allergene s
           on s.recipe_id = p_recipe_id
          and s.allergene = p_allergene
          and s.ingrediente_id = i.id
    left join ingredients sub on sub.id = s.sostituto_id
   where p_allergene = any(i.allergens)
   order by 2;
$function$;

comment on function public.ingredienti_con_allergene(uuid, allergen) is
  'Gli ingredienti di questo piatto che portano questo allergene, e se per ognuno c''e'' gia'' una sostituzione. E'' la domanda su cui poggia il divieto di promettere una cosa a meta''.';

revoke all on function public.ingredienti_con_allergene(uuid, allergen) from public, anon, authenticated;
grant execute on function public.ingredienti_con_allergene(uuid, allergen) to authenticated;

-- ---------------------------------------------------------------------
-- 4 · Il quadro di un piatto, allergene per allergene
-- ---------------------------------------------------------------------
create or replace function public.allergeni_del_piatto(p_recipe_id uuid)
returns table(
  allergene        allergen,
  stato            text,
  scoperti         text[],
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
               'id',          s.id,
               'ingrediente', i1.name,
               'sostituto',   i2.name,
               'costo',       s.costo_aggiuntivo,
               'nota',        s.nota
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
  'Per ogni allergene del piatto: se si puo'' togliere, cosa manca ancora per poterlo promettere, come si sostituisce e quanto costa in piu''.';

revoke all on function public.allergeni_del_piatto(uuid) from public, anon, authenticated;
grant execute on function public.allergeni_del_piatto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Non si promette una cosa a meta'
-- ---------------------------------------------------------------------
create or replace function public.vieta_eliminabile_scoperto()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scoperti text[];
  v_quanti   integer;
begin
  if not new.eliminabile then return new; end if;

  select count(*) into v_quanti
    from ingredienti_con_allergene(new.recipe_id, new.allergene) x;
  if v_quanti = 0 then
    raise exception
      'Questo allergene non risulta fra gli ingredienti di questo piatto: non c''e'' niente da togliere. Controlla gli ingredienti prima di dichiararlo.';
  end if;

  select array_agg(x.nome order by x.nome) into v_scoperti
    from ingredienti_con_allergene(new.recipe_id, new.allergene) x
   where not x.coperto;

  -- ⚠️ Il rifiuto li nomina TUTTI: uno per volta si scopre il secondo dopo
  --    aver risolto il primo, e alla terza si smette di leggere.
  if v_scoperti is not null and cardinality(v_scoperti) > 0 then
    raise exception
      'Non si puo'' promettere questo piatto senza questo allergene: manca ancora la sostituzione per %. Scrivila prima, poi la dichiarazione si potra'' salvare.',
      array_to_string(v_scoperti, ', ');
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_vieta_eliminabile_scoperto on scelte_allergene;
create trigger trg_vieta_eliminabile_scoperto
  before insert or update on scelte_allergene
  for each row execute function vieta_eliminabile_scoperto();

-- ---------------------------------------------------------------------
-- 6 · E allo specchio: non si toglie il modo di mantenere una promessa
-- ---------------------------------------------------------------------
create or replace function public.vieta_sostituzione_che_scopre()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_eliminabile boolean;
  v_piatto      text;
begin
  select sc.eliminabile into v_eliminabile
    from scelte_allergene sc
   where sc.recipe_id = old.recipe_id and sc.allergene = old.allergene;

  if coalesce(v_eliminabile, false) then
    select r.name into v_piatto from recipes r where r.id = old.recipe_id;
    raise exception
      'Su «%» questo allergene e'' dichiarato come togliibile: senza questa sostituzione il piatto prometterebbe in sala una cosa che non puo'' piu'' fare. Prima togli la dichiarazione, poi la sostituzione.',
      coalesce(v_piatto, 'questo piatto');
  end if;

  return old;
end;
$function$;

drop trigger if exists trg_vieta_sostituzione_che_scopre on sostituzioni_allergene;
create trigger trg_vieta_sostituzione_che_scopre
  before delete on sostituzioni_allergene
  for each row execute function vieta_sostituzione_che_scopre();

-- ---------------------------------------------------------------------
-- 7 · I permessi
-- ---------------------------------------------------------------------
-- Titolare-only in tutto: e' il Ricettario, e le decisioni sugli allergeni
-- sono sue. In sala nessuno legge queste tabelle direttamente — passa
-- tutto dalle funzioni con portiere.
alter table scelte_allergene enable row level security;
alter table sostituzioni_allergene enable row level security;

drop policy if exists scelte_allergene_titolare on scelte_allergene;
create policy scelte_allergene_titolare on scelte_allergene
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists sostituzioni_allergene_titolare on sostituzioni_allergene;
create policy sostituzioni_allergene_titolare on sostituzioni_allergene
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_piatto   uuid;
  v_farina   uuid;
  v_senza    uuid;
  v_ing2     uuid;
  v_prep     uuid;
  v_entita   uuid;
  v_n        integer;
  v_msg      text;
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

  -- ⚠️ IL PERIMETRO E' FATTO DI ROBA CHE LA VERIFICA HA CREATO LEI (regola
  --    del 16/08): niente ingredienti veri, niente ricette vere. Un
  --    ingrediente vero preso in prestito lascia dietro di se' effetti che
  --    nessuno collega a questa migrazione.
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ farina allergeni', 'farine_cereali', 'kg', array['glutine']::allergen[])
  returning id into v_farina;

  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ farina senza glutine', 'farine_cereali', 'kg', '{}'::allergen[])
  returning id into v_senza;

  -- ⚠️ IL SECONDO INGREDIENTE CON LO STESSO ALLERGENE E' IL CUORE DELLA
  --    PROVA: con uno solo, «coperto» e «tutti coperti» darebbero la stessa
  --    risposta e la verifica non distinguerebbe niente.
  insert into ingredients (entity_id, name, category, unit, allergens)
  values (v_entita, '__VERIFICA__ pangrattato', 'farine_cereali', 'kg', array['glutine']::allergen[])
  returning id into v_ing2;

  -- E il secondo sta DENTRO UNA PREPARAZIONE, non nel piatto: se la discesa
  -- ricorsiva non funzionasse, la copertura risulterebbe completa con un
  -- ingrediente ancora scoperto — cioe' proprio la bugia da evitare.
  insert into recipes (name, category, recipe_type, portions_yield, yield_unit, yield_quantity)
  values ('__VERIFICA__ panatura', 'antipasto', 'preparazione', 1, 'kg', 1)
  returning id into v_prep;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_prep, v_ing2, 0.1, 'kg');

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto allergeni', 'secondo', 'piatto_finito', 1)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_farina, 0.2, 'kg');
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_piatto, v_prep, 0.05, 'kg');

  -- (a) I DUE INGREDIENTI SI VEDONO ENTRAMBI, e nessuno e' coperto.
  select count(*) into v_n from ingredienti_con_allergene(v_piatto, 'glutine');
  if v_n <> 2 then
    raise exception 'Il glutine dovrebbe arrivare da 2 ingredienti (uno dentro una preparazione), ne risultano %.', v_n;
  end if;
  select count(*) into v_n from ingredienti_con_allergene(v_piatto, 'glutine') x where x.coperto;
  if v_n <> 0 then
    raise exception 'Nessuna sostituzione e'' stata scritta, eppure % risultano coperti.', v_n;
  end if;

  -- (b) DICHIARARLO ELIMINABILE ADESSO DEVE ESSERE RESPINTO, e il rifiuto
  --     deve nominare TUTTI E DUE gli ingredienti.
  begin
    insert into scelte_allergene (recipe_id, allergene, eliminabile)
    values (v_piatto, 'glutine', true);
    raise exception 'Il glutine e'' stato dichiarato eliminabile senza nessuna sostituzione: il divieto non ha funzionato.';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%farina allergeni%' or v_msg not like '%pangrattato%' then
      raise exception 'Il rifiuto non nomina tutti gli ingredienti scoperti: «%».', v_msg;
    end if;
  end;

  -- (c) «NON ELIMINABILE» invece si scrive sempre: e' una dichiarazione che
  --     non promette niente.
  insert into scelte_allergene (recipe_id, allergene, eliminabile, nota)
  values (v_piatto, 'glutine', false, 'La panatura non si puo'' togliere.');

  select count(*) into v_n from allergeni_del_piatto(v_piatto) a where a.stato = 'non_eliminabile';
  if v_n <> 1 then
    raise exception 'Lo stato «non eliminabile» non risulta: % righe.', v_n;
  end if;

  -- (d) COPERTURA A META': una sostituzione sola non basta ancora.
  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'glutine', v_farina, v_senza, 1.50);

  select cardinality(a.scoperti) into v_n from allergeni_del_piatto(v_piatto) a where a.allergene = 'glutine';
  if v_n <> 1 then
    raise exception 'Con una sostituzione su due, gli scoperti dovrebbero essere 1: sono %.', v_n;
  end if;

  begin
    update scelte_allergene set eliminabile = true
     where recipe_id = v_piatto and allergene = 'glutine';
    raise exception 'Con la copertura a meta'' la dichiarazione e'' passata: il divieto non guarda le modifiche.';
  exception when sqlstate 'P0001' then
    null;
  end;

  -- (e) COPERTURA COMPLETA: adesso si puo' promettere, e il costo e' la somma.
  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'glutine', v_ing2, null, 0.50);

  update scelte_allergene set eliminabile = true
   where recipe_id = v_piatto and allergene = 'glutine';

  select * into r from allergeni_del_piatto(v_piatto) a where a.allergene = 'glutine';
  if r.stato <> 'eliminabile' then
    raise exception 'Con tutti gli ingredienti coperti lo stato dovrebbe essere «eliminabile», e'' «%».', r.stato;
  end if;
  if r.costo_aggiuntivo <> 2.00 then
    raise exception 'Il supplemento dovrebbe essere 1,50 + 0,50 = 2,00: e'' %.', r.costo_aggiuntivo;
  end if;
  if jsonb_array_length(r.sostituzioni) <> 2 then
    raise exception 'Le sostituzioni dovrebbero essere 2, sono %.', jsonb_array_length(r.sostituzioni);
  end if;

  -- (f) E ORA NON SI PUO' PIU' TOGLIERE UNA SOSTITUZIONE senza prima
  --     togliere la promessa.
  begin
    delete from sostituzioni_allergene
     where recipe_id = v_piatto and allergene = 'glutine' and ingrediente_id = v_farina;
    raise exception 'La sostituzione e'' stata tolta lasciando in piedi la promessa: il divieto allo specchio non funziona.';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%Prima togli la dichiarazione%' then
      raise exception 'Il rifiuto non dice come uscirne: «%».', v_msg;
    end if;
  end;

  -- (g) LA VIA D'USCITA FUNZIONA DAVVERO — un divieto senza uscita e' un
  --     vicolo cieco, e va provato che l'uscita esista.
  delete from scelte_allergene where recipe_id = v_piatto and allergene = 'glutine';
  delete from sostituzioni_allergene
   where recipe_id = v_piatto and allergene = 'glutine' and ingrediente_id = v_farina;

  select count(*) into v_n from allergeni_del_piatto(v_piatto) a where a.stato = 'non_deciso';
  if v_n <> 1 then
    raise exception 'Tolta la dichiarazione, lo stato dovrebbe tornare «non deciso»: % righe.', v_n;
  end if;

  -- (h) IL COSTO ASSURDO E' RESPINTO, e quello alto ma legittimo passa.
  --     ⚠️ Le due prove servono tutte e due: un limite che rifiuta anche i
  --     casi buoni e' peggio di nessun limite.
  begin
    insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
    values (v_piatto, 'latte', v_farina, v_senza, 250);
    raise exception 'Un supplemento di 250 euro e'' entrato: il limite non c''e''.';
  exception when sqlstate '23514' then
    null;
  end;
  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'latte', v_farina, v_senza, 12.00);
  delete from sostituzioni_allergene where recipe_id = v_piatto and allergene = 'latte';

  -- Pulizia: solo quello che questa verifica ha creato, e nell'ordine che
  -- le chiavi esterne accettano.
  delete from sostituzioni_allergene where recipe_id in (v_piatto, v_prep);
  delete from scelte_allergene where recipe_id in (v_piatto, v_prep);
  delete from recipe_ingredients where recipe_id in (v_piatto, v_prep);
  delete from recipes where id in (v_piatto, v_prep);
  delete from ingredients where id in (v_farina, v_senza, v_ing2);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Gli allergeni si possono togliere, e non si puo'' prometterlo a meta''.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000034', 'gli_allergeni_si_possono_togliere') on conflict (version) do nothing;
