-- =====================================================================
-- I FINGER SI POSSONO COMPORRE — blocco 1 del mandato dei finger food
-- 19/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md
--
-- 🔴 IL PUNTO DI PARTENZA, misurato prima di progettare: la macchina per
-- comporre una ricetta con altre ricette **c'e' gia' e funziona**. Provato
-- sul progetto di prova con due finger e una selezione: il food cost esce
-- giusto (0,40 = due bocconcini da 0,20) e lo scarico di magazzino di due
-- porzioni toglie **due pezzi per tipo** — che e' esattamente la regola di
-- Alessio. Quindi qui non nasce nessuna tabella.
--
-- Manca una cosa sola, e non e' un pezzo mancante: e' un RIFIUTO.
-- `check_recipe_component` risponde *«Solo le ricette di tipo
-- "preparazione" possono essere usate come componente»*, e un finger non e'
-- una preparazione.
--
-- ⚠️ PERCHE' UN TIPO NUOVO E NON LA STRADA LARGA (decisione di Alessio, e la
-- ragione va scritta qui perche' non venga «semplificata» fra sei mesi):
--   · marcare un finger come **preparazione** lo farebbe finire in
--     Produzioni e sotto la sorveglianza delle rese — il gestionale gli
--     chiederebbe conto di cose che non e';
--   · lasciare entrare **qualunque ricetta dentro qualunque altra** e' meno
--     lavoro oggi, ma toglie l'unica protezione che impedisce di comporre
--     per sbaglio un piatto dentro un altro piatto. Quella protezione va
--     **conservata, non allargata**;
--   · e il tipo nuovo da' l'**elenco dei finger**, che serve per comporre le
--     selezioni e servira' al modulo preventivi.
--
-- ⚠️ COSA CAMBIA A VALLE, misurato prima di introdurlo. Chi filtra oggi per
-- tipo di ricetta:
--   · `ingrediente_di_preparazione` (chiamata da `registra_produzione`) e'
--     l'UNICA che rifiuta davvero cio' che non e' una preparazione — quindi
--     un finger **e' gia' escluso dalle Produzioni**, gratis. Cambia solo il
--     messaggio, che diceva «e' un piatto finito» e adesso sarebbe falso;
--   · `rese_preparazione` e `produzioni_display` lavorano sulle produzioni
--     registrate: senza produzione non c'e' resa, quindi un finger non
--     compare;
--   · le altre quattro funzioni nominano `preparazione_id` (la colonna
--     dell'ingrediente), non il tipo della ricetta: non c'entrano;
--   · 🔴 **il vincolo `preparazione_requires_yield` guarda SOLO il tipo
--     `preparazione`** — e questo e' il buco che il tipo nuovo aprirebbe: un
--     componente senza resa fa diventare NULL il moltiplicatore, e **costo e
--     scarico spariscono senza nessun errore**. Il vincolo va esteso, ed e'
--     la ragione per cui questa migrazione lo riscrive;
--   · lato schermate: l'elenco dei componenti (`listPreparations`) filtra
--     per `preparazione` e va allargato, altrimenti il database permette una
--     cosa che nessuna schermata puo' fare — codice che nessuno chiama.
--
-- ⚠️ E UNA NOTA DI CLAUDE.md ERA PIU' LARGA DEL VERO, misurato oggi: «il
-- nuovo valore di un enum non e' usabile nella stessa migrazione». Il
-- confine vero e' la **transazione**, non il file: dentro un solo blocco
-- fallisce con *«New enum values must be committed before they can be
-- used»*, ma in un file applicato da psql — dove ogni istruzione si chiude
-- da se' — l'`alter type` su una riga sua e' gia' committato quando il
-- blocco dopo lo usa. Provato in tutti e due i versi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Il tipo nuovo — su una riga sua, prima di chiunque lo usi
-- ---------------------------------------------------------------------
alter type recipe_type add value if not exists 'finger';


-- ---------------------------------------------------------------------
-- 2 · La resa e' obbligatoria anche per un finger
-- ---------------------------------------------------------------------
-- 🔴 SENZA QUESTO, IL TIPO NUOVO APRE UN BUCO SILENZIOSO. Il calcolo del
-- costo e quello dello scarico dividono per la resa del componente
-- (`nullif(comp.yield_quantity, 0)`): con la resa vuota il moltiplicatore
-- diventa NULL, e il costo e la merce da scaricare **spariscono senza
-- nessun errore**. Per un finger la resa e' **1 pezzo**, e il vincolo
-- pretende che ci sia.
--
-- ⚠️ Il vincolo cambia nome perche' cambia significato: non e' piu' «una
-- preparazione vuole la resa» ma «un COMPONENTE vuole la resa» — cioe'
-- chiunque possa stare dentro un'altra ricetta.
alter table recipes drop constraint if exists preparazione_requires_yield;
alter table recipes drop constraint if exists componente_richiede_resa;
alter table recipes add constraint componente_richiede_resa check (
  recipe_type = 'piatto_finito'
  or (yield_quantity is not null and yield_quantity > 0 and yield_unit is not null)
);


-- ---------------------------------------------------------------------
-- 3 · Un componente non si ripete
-- ---------------------------------------------------------------------
-- 🔴 REGOLA DI ALESSIO: **sempre un pezzo per tipo, mai ripetizioni.** Due
-- porzioni ordinate fanno due pezzi per tipo, e quel due arriva dalle
-- porzioni — non da due righe uguali nella composizione.
--
-- ⚠️ Ed e' un vincolo del DATABASE e non un controllo nella schermata,
-- perche' e' da qui che nasce lo scarico di magazzino: sbagliarlo non da'
-- nessun segnale, da' una giacenza sbagliata tutte le sere.
--
-- ⚠️ Vale per QUALUNQUE componente, non solo per i finger, ed e' una scelta:
-- due righe per lo stesso componente sono due risposte alla domanda «quanto
-- ne va dentro», e niente dice quale vince. Chi ne vuole di piu' cambia la
-- quantita' sulla riga che c'e'.
-- ⚠️ SI TOGLIE E SI RIFA', invece di «crea se non esiste»: un indice con lo
-- stesso nome ma NON unico verrebbe lasciato al suo posto in silenzio, e il
-- vincolo sembrerebbe esserci senza esserci. Trovato rompendo apposta questa
-- migrazione: la rottura successiva e' fallita col messaggio di quella prima,
-- perche' la rottura precedente aveva lasciato un indice non unico con lo
-- stesso nome. *Anche una controprova lascia residui, e i suoi residui
-- mentono come gli altri.*
drop index if exists un_componente_una_volta;
create unique index un_componente_una_volta
  on recipe_ingredients (recipe_id, component_recipe_id)
  where component_recipe_id is not null;


-- ---------------------------------------------------------------------
-- 4 · Il rifiuto si restringe invece di sparire
-- ---------------------------------------------------------------------
-- Il corpo e' ripreso dal database vivo (regola del 18/08): cambia la riga
-- del tipo ammesso e il messaggio, il controllo dei cicli resta identico.
CREATE OR REPLACE FUNCTION public.check_recipe_component()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  comp_type recipe_type;
begin
  if new.component_recipe_id is null then
    return new;
  end if;

  select recipe_type into comp_type from recipes where id = new.component_recipe_id;

  -- ⚠️ SI ELENCA CIO' CHE PUO' ENTRARE, non cio' che non puo': un tipo nuovo
  -- domani sarebbe rifiutato finche' qualcuno non lo nomina qui — che e' il
  -- verso giusto per un permesso.
  if comp_type not in ('preparazione', 'finger') then
    raise exception
      'Dentro una ricetta possono entrare solo le preparazioni e i finger: «%» e'' un piatto finito. Se e'' un bocconcino di una selezione, cambiagli tipo in «finger».',
      (select name from recipes where id = new.component_recipe_id);
  end if;

  -- Un ciclo si crea se recipe_id compare tra i discendenti di component_recipe_id
  -- (cioè component_recipe_id, direttamente o indirettamente, "userebbe" già
  -- new.recipe_id). Cerca in profondità PRIMA di permettere l'inserimento.
  if exists (
    with recursive descendants as (
      select ri.component_recipe_id as id
      from recipe_ingredients ri
      where ri.recipe_id = new.component_recipe_id and ri.component_recipe_id is not null
      union
      select ri.component_recipe_id
      from recipe_ingredients ri
      join descendants d on ri.recipe_id = d.id
      where ri.component_recipe_id is not null
    )
    select 1 from descendants where id = new.recipe_id
  ) then
    raise exception 'Collegamento non consentito: creerebbe un ciclo tra ricette (% dipenderebbe già, indirettamente, da questa ricetta)', new.component_recipe_id;
  end if;

  return new;
end;
$function$;


-- ---------------------------------------------------------------------
-- 5 · Il messaggio delle Produzioni smette di dire una cosa falsa
-- ---------------------------------------------------------------------
-- Diceva «e'' un piatto finito» a qualunque cosa non fosse una
-- preparazione. Con i finger sarebbe falso, ed e' la famiglia dei testi che
-- descrivono male il proprio programma.
CREATE OR REPLACE FUNCTION public.ingrediente_di_preparazione(p_recipe_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ric recipes%rowtype;
  v_id  uuid;
begin
  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then
    raise exception 'Ricetta non trovata';
  end if;
  if v_ric.recipe_type <> 'preparazione' then
    raise exception 'Solo una preparazione si puo'' produrre: «%» e'' %.',
      v_ric.name,
      case v_ric.recipe_type
        when 'finger' then 'un finger, e i finger non si producono a dosi'
        else 'un piatto finito'
      end;
  end if;

  select id into v_id from ingredients where preparazione_id = p_recipe_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into ingredients (
    entity_id, name, category, unit, current_price,
    preparazione_id, avvisa_rincari, alimentare, stock_minimum_threshold
  )
  select (select id from entities order by created_at limit 1),
         v_ric.name, 'altro', coalesce(v_ric.yield_unit, 'kg'), 0,
         p_recipe_id, false, true, null
  returning id into v_id;

  return v_id;
end;
$function$;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_ingr   uuid;
  v_f1     uuid;
  v_f2     uuid;
  v_sel    uuid;
  v_piatto uuid;
  v_conto  uuid;
  v_costo  numeric;
  v_kg     numeric;
  v_lap_p  integer;
  v_lap_d  integer;
  v_ok     boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  select id into v_ente from entities order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;

  -- 0 · Il tipo esiste davvero.
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'recipe_type' and e.enumlabel = 'finger'
  ) then
    raise exception 'Il tipo «finger» non e'' stato aggiunto.';
  end if;

  -- Il perimetro se lo costruisce la prova (lezione del 16/08).
  insert into ingredients (entity_id, name, category, unit, current_price)
    values (v_ente, '__VERIFICA__ alice', 'pesce', 'kg', 20) returning id into v_ingr;

  -- 1 · UN FINGER SENZA RESA E' RESPINTO — e' il buco che il tipo nuovo
  --     aprirebbe se il vincolo non fosse stato esteso.
  v_ok := false;
  begin
    insert into recipes (name, category, portions_yield, recipe_type)
      values ('__VERIFICA__ finger senza resa', 'antipasto', 1, 'finger');
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un finger senza resa e'' stato accettato: costo e scarico sparirebbero in silenzio.';
  end if;

  -- ⚠️ SEI BOCCONCINI, non due, e il numero non e' estetico: con due finger e
  -- due porzioni le due risposte SBAGLIATE coincidono (0,020 kg sia
  -- ignorando le porzioni sia contando i bocconcini come porzioni), quindi la
  -- prova non discriminerebbe niente. Con sei e due le tre risposte sono
  -- 0,120 (giusta), 0,060 (porzioni ignorate) e 0,360 (bocconcini contati
  -- come porzioni), e si distinguono.
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
  select '__VERIFICA__ bocconcino ' || g, 'antipasto', 1, 'finger', 1, 'pz'
    from generate_series(1, 6) g;
  select id into v_f1 from recipes where name = '__VERIFICA__ bocconcino 1';
  select id into v_f2 from recipes where name = '__VERIFICA__ bocconcino 2';
  insert into recipes (name, category, portions_yield, recipe_type)
    values ('__VERIFICA__ selezione', 'antipasto', 1, 'piatto_finito') returning id into v_sel;
  insert into recipes (name, category, portions_yield, recipe_type)
    values ('__VERIFICA__ altro piatto', 'secondo', 1, 'piatto_finito') returning id into v_piatto;

  -- 10 g a bocconcino, a 20 EUR/kg -> 0,20 EUR l'uno
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  select r.id, v_ingr, 0.010, 'kg' from recipes r where r.name like '__VERIFICA__ bocconcino %';

  -- 2 · I FINGER ENTRANO NELLA SELEZIONE, un pezzo per tipo.
  insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
  select v_sel, r.id, 1, 'pz' from recipes r where r.name like '__VERIFICA__ bocconcino %';

  -- 3 · LO STESSO FINGER DUE VOLTE E' RESPINTO.
  v_ok := false;
  begin
    insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
      values (v_sel, v_f1, 1, 'pz');
  exception when unique_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Lo stesso finger e'' entrato due volte nella stessa selezione.';
  end if;

  -- 4 · UN PIATTO FINITO DENTRO UN ALTRO PIATTO RESTA RESPINTO: la
  --     protezione si e'' ristretta, non tolta.
  v_ok := false;
  begin
    insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
      values (v_sel, v_piatto, 1, 'pz');
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un piatto finito e'' entrato dentro un altro piatto.';
  end if;

  -- 5 · IL COSTO DELLA SELEZIONE E' LA SOMMA DEI SUOI BOCCONCINI.
  select food_cost_base into v_costo from v_recipe_costs where recipe_id = v_sel;
  if v_costo is null or abs(v_costo - 1.20) > 0.0001 then
    raise exception 'Il costo della selezione e'' % invece di 1,20.', coalesce(v_costo::text, 'NULLO');
  end if;

  -- 6 · DUE PORZIONI SCARICANO DUE PEZZI PER TIPO — la regola di Alessio,
  --     provata sul gesto e non sulla forma.
  insert into orders (table_label, status, coperti, note)
    values ('__VERIFICA__ finger', 'aperto', 2, '__VERIFICA__ finger') returning id into v_conto;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
    values (v_conto, v_sel, 'cucina', 2, 18, now());

  select coalesce(sum(f.quantita), 0) into v_kg from fabbisogno_conto(v_conto) f
   where f.ingredient_id = v_ingr;
  -- 2 porzioni x 6 bocconcini x 0,010 kg = 0,120.
  -- ⚠️ Le due risposte sbagliate sono numeri credibili: 0,060 vuol dire che
  -- le porzioni sono state ignorate, 0,360 che i bocconcini sono stati
  -- contati come porzioni.
  if abs(v_kg - 0.120) > 0.000001 then
    raise exception 'Due porzioni di sei bocconcini scaricano % kg invece di 0,120: la regola «un pezzo per tipo» non regge.', v_kg;
  end if;

  -- 7 · UN FINGER NON SI PUO' PRODURRE: resta fuori dalle Produzioni.
  v_ok := false;
  begin
    perform ingrediente_di_preparazione(v_f1);
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un finger e'' entrato nelle Produzioni.';
  end if;

  -- =========== PULIZIA ===========
  -- ⚠️ I trigger si spengono SOLO qui: una riga di comanda gia' andata in
  -- cucina non si cancella (e' la regola del 16/08, e vale anche per noi).
  set local session_replication_role = replica;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;
  delete from recipe_ingredients
   where recipe_id in (select id from recipes where name like '__VERIFICA__%')
      or component_recipe_id in (select id from recipes where name like '__VERIFICA__%');
  delete from ingredients where id = v_ingr
     or preparazione_id in (select id from recipes where name like '__VERIFICA__%');
  delete from recipes where name like '__VERIFICA__%';
  set local session_replication_role = origin;

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from recipes where name like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle ricette finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'I finger si compongono: un pezzo per tipo, due porzioni due pezzi, e un piatto finito resta fuori.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000012', 'i_finger_si_compongono')
on conflict (version) do nothing;
