-- =====================================================================
-- I QUATTRO STATI DI UNA RICETTA, E IL FINGER FOOD COME CATEGORIA
-- 24/08/2026 — blocco 2 (c) ed (e) del mandato del collaudo
-- =====================================================================
-- Alessio: *«voglio UNA striscia sola con quattro stati: IN SVILUPPO →
-- PRONTA PER LA CARTA → IN CARTA → RITIRATA (i piatti che non faccio più
-- ma non voglio cancellare)»*, e *«"FINGER FOOD" diventa una CATEGORIA a
-- sé, accanto ad Antipasto, Primo, Secondo, Dolce»*.
--
-- ⚠️ TRE DEI QUATTRO STATI ESISTONO GIÀ, e non come una colonna sola:
-- «in sviluppo» e «pronta per la carta» sono `pronta_per_carta`, «in
-- carta» è `in_carta`, che dal 16/08 è un **RIFLESSO** — lo scrive solo un
-- trigger, mai l'applicazione, e dice se la ricetta sta in un menu attivo.
-- Quindi la striscia nuova NON è una colonna di stato nuova: è il modo di
-- mostrare insieme cose che il database già sa. Fondere le due colonne in
-- un enum sarebbe stato più bello a vedersi e avrebbe distrutto il
-- riflesso — cioè l'unica ragione per cui oggi «in carta» non può mentire.
--
-- 🔴 QUELLO CHE MANCA DAVVERO È IL QUARTO: **ritirata**. Ed è uno stato
-- vero, non un riflesso — è una decisione di Alessio su un piatto, e
-- nessun'altra cosa nel gestionale la può dedurre.
--
-- ⚠️ È UNA DATA, non un interruttore: `ritirata_il`. Un booleano
-- risponderebbe a «l'ho ritirata?» e tacerebbe su «da quando?» — ed è
-- esattamente il debito dichiarato il 14/08 su `tasks`, che sa se un
-- impegno è fatto e non quando. Costa una colonna oggi e un problema fra
-- un anno; qui la si scrive giusta subito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La categoria «finger food»
-- ---------------------------------------------------------------------
-- ⚠️ `alter type ... add value` STA SU UNA RIGA SUA, fuori da ogni blocco
-- `do $$` che poi lo adoperi: dentro lo stesso blocco fallirebbe con «New
-- enum values must be committed before they can be used». Applicato da
-- `psql`, dove ogni istruzione si chiude da sé, il valore è già committato
-- quando il blocco successivo lo usa (misurato il 19/08 nei due versi).
alter type recipe_category add value if not exists 'finger_food';

-- ---------------------------------------------------------------------
-- 2 · Lo stato «ritirata»
-- ---------------------------------------------------------------------
alter table recipes add column if not exists ritirata_il timestamptz;
alter table recipes add column if not exists ritirata_da uuid references auth.users(id) on delete set null;

comment on column recipes.ritirata_il is
  'Quando questa ricetta e'' stata tolta dal giro. Vuota = e'' ancora viva. E'' una data e non un interruttore perche'' «da quando non la faccio piu''» e'' meta'' dell''informazione.';

-- ---------------------------------------------------------------------
-- 3 · Ritirata e in carta non possono convivere
-- ---------------------------------------------------------------------
-- ⚠️ DUE DIVIETI CHE SEMBRANO UNO SOLO, e servono tutti e due perché si
-- può arrivare allo stesso stato sbagliato da due porte: ritirando un
-- piatto che è in carta, oppure mettendo in carta un piatto ritirato.
-- Chiuderne una sola lascerebbe l'altra aperta, in silenzio.
--
-- ⚠️ E SI RIFIUTA DOVE NASCE IL PROBLEMA, dicendo cosa fare prima: è la
-- regola del 16/08 sul vincolo del riflesso spostato a monte. Un piatto
-- ritirato che restasse in carta sarebbe un piatto che il gestionale dice
-- di non fare più e che il menu del cliente continua a offrire.
create or replace function public.vieta_ritiro_di_una_in_carta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_menu text;
begin
  if new.ritirata_il is null or old.ritirata_il is not null then
    return new;  -- non si sta ritirando adesso: non è affar nostro
  end if;

  if coalesce(new.in_carta, false) then
    -- ⚠️ Il rifiuto NOMINA i menu attivi che la contengono: dire «è in
    -- carta» e basta lascerebbe a cercare in quale, e un rifiuto senza via
    -- d'uscita è un vicolo cieco.
    select string_agg(m.name, ', ') into v_menu
      from menu_items mi join menus m on m.id = mi.menu_id
     where mi.recipe_id = new.id and m.is_active;

    raise exception
      'Non posso ritirare «%»: è ancora in carta%. Toglila prima dal menu, poi ritirala.',
      new.name,
      coalesce(' nel menu ' || v_menu, '');
  end if;

  return new;
end $function$;

comment on function public.vieta_ritiro_di_una_in_carta() is
  'Impedisce di ritirare una ricetta che un menu attivo sta ancora offrendo, e dice quale menu.';

revoke all on function public.vieta_ritiro_di_una_in_carta() from public, anon, authenticated;

drop trigger if exists trg_recipes_ritiro on recipes;
create trigger trg_recipes_ritiro
  before update on recipes
  for each row execute function vieta_ritiro_di_una_in_carta();

-- ⚠️ IL CORPO VIENE DAL DATABASE VIVO, non dalla migrazione che l'ha
-- creata (regola del 18/08, e il progetto ci è caduto cinque volte): fra
-- il file d'origine e oggi ci stanno tutte le migrazioni che l'hanno
-- toccata. Qui si aggiunge un rifiuto e non si tocca altro.
create or replace function public.vieta_non_pronta_in_menu_attivo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  attivo   boolean;
  pronta   boolean;
  nome     text;
  ritirata timestamptz;
begin
  select m.is_active into attivo from menus m where m.id = new.menu_id;
  if not coalesce(attivo, false) then return new; end if;

  select r.pronta_per_carta, r.name, r.ritirata_il
    into pronta, nome, ritirata
    from recipes r where r.id = new.recipe_id;

  if not coalesce(pronta, false) then
    raise exception
      'Non posso mettere «%» in un menu attivo: non e'' ancora segnata «pronta per carta». Segnala pronta dal Ricettario, oppure mettila in un menu non attivo finche'' la stai provando.',
      coalesce(nome, '(senza nome)');
  end if;

  -- Il divieto nuovo del 24/08, dall'altra porta.
  if ritirata is not null then
    raise exception
      'Non posso mettere «%» in un menu attivo: e'' stata ritirata il %. Rimettila in giro dal Ricettario, poi mettila in carta.',
      coalesce(nome, '(senza nome)'), to_char(ritirata, 'DD/MM/YYYY');
  end if;

  return new;
end $function$;

-- ---------------------------------------------------------------------
-- 4 · La sanatoria della categoria
-- ---------------------------------------------------------------------
-- ⚠️ SI RICLASSIFICA SOLO CIÒ CHE È DEDUCIBILE SENZA AMBIGUITÀ: una
-- ricetta **composta di finger** È un piatto di finger food, e non c'è una
-- seconda lettura possibile. Tutto il resto resta dov'è: scegliere la
-- categoria di un piatto è una decisione di Alessio, e una migrazione che
-- la prende al posto suo è la trappola del 14/08.
--
-- ⚠️ E DICHIARA QUANTE RIGHE TOCCA (regola del 16/08): uno zero non è un
-- errore — vuol dire «niente da fare su questo database» — ma va detto,
-- perché è il silenzio ad aver ingannato quattro volte.
do $sanatoria$
declare v_quante integer;
begin
  update recipes r
     set category = 'finger_food'
   where r.recipe_type = 'piatto_finito'
     and r.category <> 'finger_food'
     and exists (
       select 1 from recipe_ingredients ri
         join recipes c on c.id = ri.component_recipe_id
        where ri.recipe_id = r.id and c.recipe_type = 'finger'
     );
  get diagnostics v_quante = row_count;
  raise notice 'Piatti composti di finger passati alla categoria «finger food»: %.', v_quante;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- Verifica — nei DUE versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_ricetta   uuid;
  v_menu      uuid;
  v_rifiutato boolean;
  v_messaggio text;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) La categoria nuova è utilizzabile davvero. ⚠️ Non basta che
  --     l'enum la elenchi: si SCRIVE, perché è nell'uso che un valore
  --     appena aggiunto può ancora rifiutarsi.
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ finger food', 'finger_food', 'piatto_finito', 1)
  returning id into v_ricetta;

  -- (b) Una ricetta si ritira, e la data resta.
  update recipes set ritirata_il = now(), ritirata_da = v_titolare where id = v_ricetta;
  if not exists (select 1 from recipes where id = v_ricetta and ritirata_il is not null) then
    raise exception 'La ricetta non risulta ritirata.';
  end if;

  -- (c) Si rimette in giro: il ritiro non è una porta a senso unico.
  update recipes set ritirata_il = null, ritirata_da = null where id = v_ricetta;

  -- (d) ⚠️ IL RIFIUTO, PROVATO SUL CASO CHE LO FA SCATTARE — non sul caso
  --     vuoto (regola del 17/08). Serve una ricetta DAVVERO in carta,
  --     quindi pronta e dentro un menu attivo.
  --     ⚠️ E il menu attivo è UNO SOLO in questo database
  --     (`uniq_single_active_menu`, scoperto il 16/08): non se ne può
  --     accendere un secondo, quindi si usa quello che c'è.
  select m.id into v_menu from menus m where m.is_active limit 1;
  if v_menu is null then
    raise notice 'Nessun menu attivo: il divieto di ritirare una ricetta in carta NON e'' stato esercitato qui.';
  else
    update recipes set pronta_per_carta = true where id = v_ricetta;
    insert into menu_items (menu_id, recipe_id, category, selling_price) values (v_menu, v_ricetta, 'finger_food', 10);

    if not exists (select 1 from recipes where id = v_ricetta and in_carta) then
      raise exception 'Il riflesso «in carta» non si e'' acceso: la verifica non puo'' provare il divieto.';
    end if;

    v_rifiutato := false;
    begin
      update recipes set ritirata_il = now() where id = v_ricetta;
    exception when others then
      v_rifiutato := true;
      v_messaggio := sqlerrm;
    end;
    if not v_rifiutato then
      raise exception 'Si e'' potuta ritirare una ricetta che e'' in carta.';
    end if;
    -- ⚠️ E il rifiuto deve dire QUALE menu: un rifiuto che non nomina il
    -- menu lascia a cercarlo, ed è il vicolo cieco del difetto n. 8.
    if v_messaggio not like '%nel menu%' then
      raise exception 'Il rifiuto non nomina il menu: «%»', v_messaggio;
    end if;

    -- (e) LA PORTA OPPOSTA: una ricetta ritirata non entra in un menu attivo.
    delete from menu_items where menu_id = v_menu and recipe_id = v_ricetta;
    update recipes set ritirata_il = now() where id = v_ricetta;

    v_rifiutato := false;
    begin
      insert into menu_items (menu_id, recipe_id, category, selling_price) values (v_menu, v_ricetta, 'finger_food', 10);
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Si e'' potuta mettere in carta una ricetta ritirata.';
    end if;

    -- (f) LA CONTROPROVA CHE DISCRIMINA: rimessa in giro, ci entra. Senza
    --     questa, un divieto che rifiuta SEMPRE passerebbe la (e).
    update recipes set ritirata_il = null where id = v_ricetta;
    insert into menu_items (menu_id, recipe_id, category, selling_price) values (v_menu, v_ricetta, 'finger_food', 10);
    delete from menu_items where menu_id = v_menu and recipe_id = v_ricetta;
  end if;

  -- (g) Si ripulisce cio' che questa verifica ha creato, e SOLO quello:
  --     la riga si riconosce dall'identificativo che si e' segnata.
  delete from menu_items where recipe_id = v_ricetta;
  delete from recipe_status_history where recipe_id = v_ricetta;
  delete from recipes where id = v_ricetta;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il quarto stato esiste, e le due porte sbagliate sono chiuse.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000025', 'i_quattro_stati_e_il_finger_food') on conflict (version) do nothing;
