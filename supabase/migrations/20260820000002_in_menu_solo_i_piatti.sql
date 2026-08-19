-- =====================================================================
-- IN UN MENU CI VANNO SOLO I PIATTI — e il caso dei due prezzi non
-- esistera' piu'
-- 20/08/2026
-- =====================================================================
-- Due decisioni di Alessio, prese la sera del 20/08 guardando la misura
-- fatta applicando il blocco 2 dei finger food.
--
-- 🔴 PRIMA: *«le preparazioni non devono stare nell'elenco del menu, ci
-- devono stare solo i piatti taggati pronti per la carta»*. Fino a oggi
-- l'elenco della carta e quello dei piatti del giorno offrivano TUTTE le
-- ricette — preparazioni comprese, da sempre — e dal 19/08 anche i
-- bocconcini.
--
-- ⚠️ IL CRITERIO NON ELENCA I TIPI, CHIEDE UNA PROPRIETA', ed e' la forma
-- che si difende da sola: «restano i piatti pronti per la carta», non
-- «togliamo i tipi che non servono». Un tipo nuovo domani non ricompare
-- dove non deve, perche' non c'e' nessun elenco da ricordarsi di
-- aggiornare. E' la stessa cura appena fatta sulla colonna delle porzioni
-- nell'elenco delle ricette.
--
-- ⚠️ IL CRITERIO E' DOPPIO E LE DUE META' STANNO IN DUE POSTI DIVERSI,
-- apposta:
--   · **«e' un piatto»** e' un invariante — una preparazione dentro un
--     menu e' un errore di categoria, come un piatto dentro un altro
--     piatto — quindi vive QUI, come vincolo del database. Il Contratto
--     e' esplicito: gli invarianti sono vincoli del database, non
--     controlli nella schermata.
--   · **«e' pronto per la carta»** e' una condizione di MATURITA', e
--     cambia nel tempo: vive nella schermata che propone l'elenco. Un
--     vincolo la renderebbe una gabbia — togliere il segno «pronta» a un
--     piatto che sta in un menu in bozza verrebbe respinto, e non e' una
--     cosa che qualcuno ha deciso.
--
-- 🔴 POI: il caso dei due prezzi NON ESISTERA'. La migrazione
-- `20260819000013` aveva scritto, nel commento della colonna
-- `prezzo_al_pezzo`, che il giorno in cui lo stesso finger fosse andato in
-- carta anche da solo sarebbero serviti due prezzi per la stessa cosa e
-- una regola su quale vince. Alessio l'ha superata: *«semmai un bocconcino
-- dovesse diventare un piatto a se', creero' una ricetta nuova con un nome
-- diverso»*. Non sara' la stessa cosa, quindi non ci saranno due prezzi
-- della stessa cosa.
--
-- ⚠️ L'avvertenza non si cancella in silenzio: si SOSTITUISCE dichiarando
-- che una decisione l'ha superata. Chi la trovera' fra sei mesi deve
-- sapere che c'era e perche' non c'e' piu' — vedi il n. 19 di
-- docs/decisioni_rovesciate.md.
-- =====================================================================

create or replace function solo_piatti_in_menu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
      case v_tipo when 'finger' then 'un bocconcino' else 'una preparazione' end;
  end if;

  return new;
end;
$$;

comment on function solo_piatti_in_menu() is
  'Un menu contiene piatti (20/08/2026, decisione di Alessio). Una preparazione o un bocconcino dentro un menu e'' un errore di categoria, come un piatto dentro un altro piatto. ⚠️ NON controlla «pronta per carta»: quella e'' una condizione di maturita'' che cambia nel tempo, e vive nella schermata che propone l''elenco.';

-- ⚠️ `security definer` per NECESSITA', non per comodita': legge `recipes`
-- per dire il NOME nel messaggio, e chi scrive un menu e' il titolare —
-- ma la stessa funzione difende anche `daily_menu_items`, e il giorno che
-- i piatti del giorno li scrivesse la sala, un `invoker` non vedrebbe la
-- ricetta e lascerebbe passare tutto. Stessa ragione dei riflessi (16/08).
revoke all on function solo_piatti_in_menu() from public, anon, authenticated;

drop trigger if exists trg_solo_piatti_in_menu on menu_items;
create trigger trg_solo_piatti_in_menu
  before insert or update of recipe_id on menu_items
  for each row execute function solo_piatti_in_menu();

drop trigger if exists trg_solo_piatti_in_menu_giorno on daily_menu_items;
create trigger trg_solo_piatti_in_menu_giorno
  before insert or update of recipe_id on daily_menu_items
  for each row execute function solo_piatti_in_menu();


-- Il commento della colonna: l'avvertenza vecchia e' superata, e lo dice.
comment on column recipes.prezzo_al_pezzo is
  'Quanto costa UN bocconcino venduto singolarmente, per i clienti che compongono una selezione per un evento (19/08/2026). Vuoto = non ancora deciso, che e'' diverso da 0,00. ⚠️ Il 20/08 questa colonna portava l''avvertenza che un finger finito in carta da solo avrebbe dato due prezzi per la stessa cosa: DECADUTA, perche'' Alessio ha deciso che in quel caso creera'' una ricetta nuova con un nome suo — e un menu ora accetta solo i piatti (trigger solo_piatti_in_menu). Questo resta l''unico prezzo di un bocconcino.';


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_prep   uuid;
  v_fing   uuid;
  v_piatto uuid;
  v_menu   uuid;
  v_giorno uuid;
  v_ok     boolean;
  v_msg    text;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;

  -- ⚠️ TUTTE E TRE NASCONO «PRONTE PER LA CARTA», ed e' la condizione che
  -- rende la verifica capace di distinguere: se la preparazione e il
  -- bocconcino fossero respinti solo perche' quel segno e' spento, questo
  -- blocco non starebbe misurando il criterio giusto. La trappola del caso
  -- vuoto del 17/08, letta sulla condizione invece che sui dati.
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit, pronta_per_carta)
    values ('__VERIFICA__ menu prep', 'antipasto', 1, 'preparazione', 1, 'kg', true)
    returning id into v_prep;
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit, pronta_per_carta)
    values ('__VERIFICA__ menu finger', 'antipasto', 1, 'finger', 1, 'pz', true)
    returning id into v_fing;
  insert into recipes (name, category, portions_yield, recipe_type, pronta_per_carta)
    values ('__VERIFICA__ menu piatto', 'antipasto', 2, 'piatto_finito', true)
    returning id into v_piatto;

  -- ⚠️ Il menu di prova nasce SPENTO: `uniq_single_active_menu` ammette un
  -- solo menu attivo, e accenderne uno qui spegnerebbe la carta vera.
  insert into menus (name, structure, is_active)
    values ('__VERIFICA__ menu', 'alla_carta', false) returning id into v_menu;
  insert into daily_menus (service_date, title)
    values (date '1995-03-01', '__VERIFICA__ giorno') returning id into v_giorno;

  -- 1 · UNA PREPARAZIONE NON ENTRA IN CARTA.
  v_ok := false;
  begin
    insert into menu_items (menu_id, recipe_id, category, selling_price)
      values (v_menu, v_prep, 'antipasto', 9.00);
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    v_ok := v_msg like '%una preparazione%';
  end;
  if not v_ok then
    raise exception 'Una preparazione e'' entrata in un menu (messaggio: %).', coalesce(v_msg, 'nessuno');
  end if;

  -- 2 · NEMMENO UN BOCCONCINO, e il messaggio lo chiama col suo nome.
  v_ok := false;
  begin
    insert into menu_items (menu_id, recipe_id, category, selling_price)
      values (v_menu, v_fing, 'antipasto', 3.00);
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    v_ok := v_msg like '%un bocconcino%';
  end;
  if not v_ok then
    raise exception 'Un bocconcino e'' entrato in un menu (messaggio: %).', coalesce(v_msg, 'nessuno');
  end if;

  -- 3 · UN PIATTO SI', altrimenti il vincolo avrebbe chiuso la porta a
  --     tutti e la verifica passerebbe lo stesso.
  insert into menu_items (menu_id, recipe_id, category, selling_price)
    values (v_menu, v_piatto, 'antipasto', 12.00);

  -- 4 · E LA STESSA REGOLA SUI PIATTI DEL GIORNO, che sono un'altra porta.
  v_ok := false;
  begin
    insert into daily_menu_items (daily_menu_id, recipe_id, category, price)
      values (v_giorno, v_fing, 'antipasto', 3.00);
  exception when raise_exception then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un bocconcino e'' entrato nei piatti del giorno.';
  end if;

  -- 5 · Una voce libera (senza ricetta) resta ammessa nei piatti del giorno.
  insert into daily_menu_items (daily_menu_id, custom_name, category, price)
    values (v_giorno, '__VERIFICA__ voce libera', 'antipasto', 5.00);

  -- 6 · E lo SPOSTAMENTO su una ricetta sbagliata e'' respinto come
  --     l'inserimento: il trigger guarda anche gli aggiornamenti.
  v_ok := false;
  begin
    update menu_items set recipe_id = v_prep where menu_id = v_menu;
  exception when raise_exception then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un piatto in carta e'' stato sostituito con una preparazione.';
  end if;

  -- =========== PULIZIA ===========
  delete from menu_items where menu_id = v_menu;
  delete from menus where id = v_menu;
  delete from daily_menu_items where daily_menu_id = v_giorno;
  delete from daily_menus where id = v_giorno;
  delete from recipes where name like '__VERIFICA__ menu %';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from recipes where name like '__VERIFICA__ menu %')
     or exists (select 1 from menus where name = '__VERIFICA__ menu')
     or exists (select 1 from daily_menus where title = '__VERIFICA__ giorno') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'In un menu entrano solo i piatti, dalle due porte, e le voci libere restano ammesse.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000002', 'in_menu_solo_i_piatti')
on conflict (version) do nothing;
