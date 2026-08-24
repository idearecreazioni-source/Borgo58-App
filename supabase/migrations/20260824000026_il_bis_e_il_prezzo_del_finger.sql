-- =====================================================================
-- IL BIS DI UN FINGER, E IL PREZZO CHE IL GESTIONALE PROPONE
-- 24/08/2026 — blocco 2(e), seconda metà
-- =====================================================================
-- Alessio: *«il cliente può chiedere un finger in più. Il bis è una RIGA A
-- SÉ SUL CONTO, non una modifica del piatto — "finger food di mare" resta
-- quello che è, e accanto compare "bis di finger X". Così la cucina vede
-- una riga in più da fare, il magazzino scarica il finger extra, e il food
-- cost del piatto in carta resta pulito»*.
--
-- 🔴 LA MISURA HA DETTO CHE IL BIS NON HA BISOGNO DI NIENTE DI NUOVO, ed è
-- la parte che vale di più di questa migrazione. Un bis è **una riga di
-- `order_items` il cui `recipe_id` è un finger**, e da lì:
--   · la cucina la vede, perché è una riga come le altre;
--   · il magazzino scarica il finger, perché `fabbisogno_conto` esplode i
--     componenti di qualunque ricetta ordinata;
--   · il piatto in carta non si muove, perché nessuno lo tocca.
-- Misurato prima di scrivere: **nessun trigger su `order_items` impedisce
-- un finger**, e i tre che ci sono guardano altro. Non nasce nessuna
-- tabella e nessuna colonna.
--
-- ⚠️ E «È UN BIS» NON SI SCRIVE, si riconosce: una riga di comanda che
-- punta a un finger **è** un bis, perché un finger non si vende da solo —
-- il database lo impedisce già in un menu (`solo_piatti_in_menu`). Una
-- colonna «è_un_bis» direbbe la stessa cosa del tipo della ricetta, e per
-- la regola del 16/08 la seconda sarebbe un riflesso: si toglie, non si
-- costruisce.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Il prezzo del bis, proposto invece che indovinato
-- ---------------------------------------------------------------------
-- Alessio: *«hai già i food cost di ognuno, quindi proponimi il prezzo
-- giusto invece di farmi perdere margine sui finger cari»*.
--
-- ⚠️ IL NUMERO PROPOSTO NON È ARROTONDATO, ed è una scelta: il taglio con
-- cui si scrivono i prezzi in un menu (mezzo euro, dieci centesimi, il
-- 9,90) è una decisione commerciale sua, e arrotondare al posto suo
-- vorrebbe dire far comparire un numero che nessuno ha deciso. Qui si dice
-- da dove viene: food cost diviso l'obiettivo che ha scritto lui.
--
-- ⚠️ E RESTITUISCE ANCHE IL FOOD COST DEL PREZZO GIÀ SCRITTO, che è la
-- domanda vera dietro la sua frase: non «quanto dovrei chiedere», ma **«su
-- questo sto perdendo margine?»**. Un prezzo tondo scritto due mesi fa su
-- un finger che nel frattempo è rincarato non si vede in nessun altro
-- modo.
create or replace function public.prezzo_bis(p_finger_id uuid)
returns table (
  food_cost          numeric,
  obiettivo_percento numeric,
  proposto           numeric,
  scritto            numeric,
  food_cost_scritto  numeric,
  avvertenza         text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_tipo      recipe_type;
  v_costo     numeric;
  v_obiettivo numeric;
  v_scritto   numeric;
begin
  -- 🔴 IL PORTIERE: qui dentro passa il food cost, che è un prezzo
  -- d'acquisto (rilievo del validatore del 13/08). E chi non deve vedere
  -- riceve un RIFIUTO, non una riga vuota.
  if not is_titolare() then
    raise exception 'Il prezzo di un bis è riservato al titolare.';
  end if;

  select r.recipe_type, r.prezzo_al_pezzo into v_tipo, v_scritto
    from recipes r where r.id = p_finger_id;
  if v_tipo is null then
    raise exception 'Questa ricetta non esiste.';
  end if;
  if v_tipo <> 'finger' then
    raise exception 'Il prezzo a pezzo vale solo per un finger: questa è %.',
      case v_tipo when 'preparazione' then 'una preparazione' else 'un piatto' end;
  end if;

  select c.food_cost_portion into v_costo from v_recipe_costs c where c.recipe_id = p_finger_id;
  select ss.food_cost_obiettivo_percento into v_obiettivo from service_settings ss limit 1;

  return query
  select
    v_costo,
    v_obiettivo,
    -- ⚠️ Niente proposta se manca un pezzo del conto: uno zero qui si
    -- leggerebbe «regalalo». È la regola del vuoto che non è zero,
    -- ripetuta quattro volte il 16/08.
    case when v_costo is null or v_costo = 0 or coalesce(v_obiettivo, 0) = 0
         then null
         else round(v_costo / (v_obiettivo / 100), 2) end,
    v_scritto,
    case when v_scritto is null or v_scritto = 0 or v_costo is null
         then null
         else round(v_costo / v_scritto * 100, 1) end,
    case
      when v_costo is null or v_costo = 0 then
        'Questo finger non ha ancora un food cost: senza, non si può dire quanto chiedere.'
      when coalesce(v_obiettivo, 0) = 0 then
        'Non c''è un food cost obiettivo in Sala e orari: senza, non si può proporre un prezzo.'
      when v_scritto is null or v_scritto = 0 then null
      when v_costo / v_scritto * 100 > v_obiettivo then
        'A questo prezzo il food cost è più alto dell''obiettivo: su un bis ci guadagni meno che sul piatto.'
      else null
    end;
end $function$;

comment on function public.prezzo_bis(uuid) is
  'Quanto chiedere per un bis di questo finger: il food cost, l''obiettivo, il prezzo che ne verrebbe, e — se un prezzo e'' gia'' scritto — che food cost produce davvero.';

revoke all on function public.prezzo_bis(uuid) from public, anon, authenticated;
grant execute on function public.prezzo_bis(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · Quali finger si possono bissare, dato un piatto
-- ---------------------------------------------------------------------
-- ⚠️ Il bis si offre in SALA, e in sala non si sceglie da tutto il
-- ricettario: si sceglie fra i finger **di quel piatto**, perché è quello
-- che il cliente ha davanti. Offrire l'elenco intero vorrebbe dire far
-- battere al cameriere un bis di una cosa che a quel tavolo non c'è.
--
-- ⚠️ E il prezzo viene via insieme: senza, la sala dovrebbe fare una
-- seconda domanda per ogni finger, oppure batterlo senza prezzo.
--
-- ⚠️ `security invoker` NON serve qui e `definer` sì: `recipes` porta
-- `prezzo_al_pezzo` e la sala deve vederlo per battere il bis — è un
-- prezzo di VENDITA, che il cameriere legge già sul menu.
create or replace function public.finger_bissabili(p_piatto_id uuid)
returns table (
  finger_id uuid,
  nome      text,
  prezzo    numeric
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select c.id, c.name, c.prezzo_al_pezzo
    from recipe_ingredients ri
    join recipes c on c.id = ri.component_recipe_id
   where ri.recipe_id = p_piatto_id
     and c.recipe_type = 'finger'
   order by c.name;
$function$;

comment on function public.finger_bissabili(uuid) is
  'I finger che compongono questo piatto, col loro prezzo a pezzo: sono quelli di cui il cliente puo'' chiedere il bis.';

revoke all on function public.finger_bissabili(uuid) from public, anon, authenticated;
grant execute on function public.finger_bissabili(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · La parola «bocconcino» sparisce anche dal database
-- ---------------------------------------------------------------------
-- ⚠️ IL CORPO VIENE DAL DATABASE VIVO (regola del 18/08): cambia solo la
-- parola nel messaggio, e il resto resta identico a com'è adesso.
create or replace function public.solo_piatti_in_menu()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo recipe_type;
  v_nome text;
begin
  if new.recipe_id is null then
    return new;   -- i piatti del giorno ammettono una voce libera
  end if;

  select recipe_type, name into v_tipo, v_nome from recipes where id = new.recipe_id;
  if v_tipo is null then
    return new;   -- la chiave esterna dira' la sua
  end if;

  if v_tipo <> 'piatto_finito' then
    raise exception
      'In un menu ci vanno solo i piatti: «%» e'' %. Se vuoi venderlo da solo, creane una ricetta a se'', con un nome suo.',
      v_nome,
      case v_tipo when 'finger' then 'un finger' else 'una preparazione' end;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- Verifica — nei DUE versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_staff     uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_finger    uuid;
  v_piatto    uuid;
  v_ingr      uuid;
  v_entita    uuid;
  v_r         record;
  v_rifiutato boolean;
  v_alle      text;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_entita from entities limit 1;

  -- ⚠️ IL PERIMETRO È FATTO DI ROBA CREATA DA QUESTA VERIFICA (regola del
  -- 16/08, nata da un ingrediente vero rimasto corto di 2 kg): un
  -- ingrediente proprio, con un allergene CONFERMATO, così si può provare
  -- anche l'ereditarietà.
  insert into ingredients (entity_id, name, unit, category, current_price,
                           allergens, origine_allergeni)
  values (v_entita, '__VERIFICA__ tonno del bis', 'kg', 'pesce', 20,
          array['pesce']::allergen[], 'confermati')
  returning id into v_ingr;

  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit,
                       portions_yield, prezzo_al_pezzo)
  values ('__VERIFICA__ finger di tonno', 'antipasto', 'finger', 1, 'pz', 1, 3.00)
  returning id into v_finger;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_finger, v_ingr, 0.05, 'kg');   -- 50 g a 20 €/kg = 1,00 € di food cost

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto di finger', 'finger_food', 'piatto_finito', 1)
  returning id into v_piatto;

  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  values (v_piatto, v_finger, 1, 'pz');

  -- (a) IL PREZZO PROPOSTO. Food cost 1,00 e obiettivo 25% → 4,00.
  --     ⚠️ I numeri sono scelti perché le risposte sbagliate diano numeri
  --     DIVERSI (regola del 19/08): moltiplicando invece di dividere
  --     verrebbe 0,25; dimenticando il /100 verrebbe 0,04.
  select * into v_r from prezzo_bis(v_finger);
  if v_r.food_cost is null or round(v_r.food_cost, 2) <> 1.00 then
    raise exception 'Il food cost del finger di prova non e'' 1,00 ma %.', v_r.food_cost;
  end if;
  if v_r.proposto is null or round(v_r.proposto, 2) <> 4.00 then
    raise exception 'Il prezzo proposto non e'' 4,00 ma %.', v_r.proposto;
  end if;

  -- (b) IL FOOD COST DEL PREZZO SCRITTO: 1,00 su 3,00 = 33,3%, sopra il
  --     25% dell'obiettivo → l'avvertenza deve esserci.
  if v_r.food_cost_scritto is null or round(v_r.food_cost_scritto, 1) <> 33.3 then
    raise exception 'Il food cost del prezzo scritto non e'' 33,3%% ma %.', v_r.food_cost_scritto;
  end if;
  if v_r.avvertenza is null then
    raise exception 'Un prezzo che sfora l''obiettivo non produce nessuna avvertenza.';
  end if;

  -- (c) LA CONTROPROVA CHE DISCRIMINA: col prezzo proposto, l'avvertenza
  --     NON deve esserci. Senza questa, una funzione che avverte SEMPRE
  --     passerebbe la (b) — e un guardiano che grida sempre si spegne.
  update recipes set prezzo_al_pezzo = 4.00 where id = v_finger;
  select * into v_r from prezzo_bis(v_finger);
  if v_r.avvertenza is not null then
    raise exception 'Col prezzo proposto l''avvertenza compare lo stesso: «%»', v_r.avvertenza;
  end if;

  -- (d) I FINGER BISSABILI di quel piatto: uno, col suo prezzo.
  if (select count(*) from finger_bissabili(v_piatto)) <> 1 then
    raise exception 'I finger bissabili del piatto di prova non sono uno.';
  end if;
  if (select prezzo from finger_bissabili(v_piatto)) <> 4.00 then
    raise exception 'Il prezzo del finger bissabile non arriva.';
  end if;

  -- (e) GLI ALLERGENI RISALGONO dal finger al piatto composto. ⚠️ È il
  --     requisito che Alessio ha scritto («con una composizione che cambia
  --     nel tempo non posso tenerli a memoria») e che nessuno aveva mai
  --     misurato su una ricetta fatta di ricette: sul progetto di prova
  --     nessun ingrediente ha allergeni confermati, quindi il caso non si
  --     poteva vedere — è la trappola del caso vuoto (17/08).
  select array_to_string(allergens, ',') into v_alle
    from v_recipe_allergens where recipe_id = v_piatto;
  if v_alle is null or v_alle not like '%pesce%' then
    raise exception 'L''allergene del finger non risale al piatto composto: «%»', coalesce(v_alle, '(nessuno)');
  end if;

  -- (f) Un finger NON entra in un menu, e il rifiuto ora dice «un finger».
  v_rifiutato := false;
  begin
    insert into menu_items (menu_id, recipe_id, category, selling_price)
    values ((select id from menus limit 1), v_finger, 'antipasto', 5);
  exception when others then
    v_rifiutato := true;
    if sqlerrm like '%bocconcino%' then
      raise exception 'Il rifiuto dice ancora «bocconcino»: «%»', sqlerrm;
    end if;
  end;
  if not v_rifiutato then
    raise exception 'Un finger e'' entrato in un menu.';
  end if;

  -- (g) IL PORTIERE, col ruolo vero.
  select ur.user_id into v_staff from user_roles ur where ur.role <> 'titolare' limit 1;
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform * from prezzo_bis(v_finger);
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Lo staff puo'' leggere il food cost di un bis.';
    end if;
    -- ⚠️ Ma i finger bissabili SÌ: in sala servono per battere il bis, e
    -- lì c'è solo il prezzo di vendita, che il cameriere legge sul menu.
    if (select count(*) from finger_bissabili(v_piatto)) <> 1 then
      raise exception 'La sala non puo'' leggere i finger bissabili: il bis non si potrebbe battere.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  else
    raise notice 'Nessun utente non-titolare: il portiere non e'' stato esercitato.';
  end if;

  -- (h) Si ripulisce cio' che questa verifica ha creato, e SOLO quello,
  --     riconosciuto dagli identificativi che si e' segnata.
  delete from recipe_ingredients where recipe_id in (v_piatto, v_finger);
  delete from recipe_status_history where recipe_id in (v_piatto, v_finger);
  delete from recipes where id in (v_piatto, v_finger);
  delete from price_history where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il bis ha il suo prezzo, i suoi finger, e gli allergeni risalgono.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000026', 'il_bis_e_il_prezzo_del_finger') on conflict (version) do nothing;
