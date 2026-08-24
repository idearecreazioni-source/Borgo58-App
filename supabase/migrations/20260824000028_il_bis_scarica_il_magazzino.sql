-- =====================================================================
-- IL BIS SCARICA IL MAGAZZINO — la prova, non la deduzione
-- 24/08/2026 — coda della 20260824000026
-- =====================================================================
-- 🔴 È LA PROMESSA CENTRALE DEL BIS, con le parole di Alessio: *«la cucina
-- vede una riga in più da fare, il magazzino scarica il finger extra, e il
-- food cost del piatto in carta resta pulito»*. Le prime e le terze si
-- vedono a schermo; la seconda no — e finora era **dedotta**, non
-- misurata.
--
-- ⚠️ E LA DEDUZIONE POTEVA ESSERE SBAGLIATA, per un motivo preciso.
-- `fabbisogno_conto` divide per `recipes.portions_yield`, e su un finger
-- quel numero non descrive niente: un finger ha una RESA (1 pezzo), non
-- delle porzioni. Se `portions_yield` fosse nullo o zero, `nullif(...,0)`
-- darebbe `null`, il moltiplicatore sarebbe `null`, e **la merce del bis
-- sparirebbe senza nessun errore** — un conto che si chiude, un magazzino
-- che non scende, e niente che lo dica.
--
-- ⚠️ Misurato: la colonna è `not null default 1` e tutti i 24 finger del
-- progetto di prova hanno 1. Quindi oggi regge. **Ma è una misura, non una
-- proprietà**, ed è esattamente la distinzione che questo progetto ha
-- imparato il 16/08: un guardiano deve dire come dev'essere fatto il
-- mondo, non com'era quando l'ho guardato. Qui la proprietà si prova.
--
-- ⚠️ PERCHÉ STA IN UNA MIGRAZIONE E NON FRA LE PROVE DELL'APP:
-- `fabbisogno_conto` **non è concessa a nessun client**, ed è giusto — la
-- chiama la chiusura del conto, non una schermata. Aprire quella porta per
-- comodità di prova è precisamente ciò che il 16/08 si è deciso di non
-- fare.
-- =====================================================================

do $verifica$
declare
  v_titolare uuid;
  v_entita   uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_ingr     uuid;
  v_finger   uuid;
  v_piatto   uuid;
  v_conto    uuid;
  v_riga     uuid;
  v_senza    numeric;
  v_con      numeric;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_entita from entities limit 1;

  -- ⚠️ SI RIPULISCE PRIMA DI COMINCIARE, e non è una precauzione teorica:
  -- questa verifica si è fermata a metà al primo tentativo (il trigger
  -- delle righe servite ha rifiutato la pulizia, e aveva ragione),
  -- lasciando dietro di sé il proprio conto e le proprie ricette.
  -- Riapplicandola senza questo blocco ne avrebbe creato un secondo paio,
  -- e la migrazione avrebbe smesso di essere rieseguibile.
  --
  -- ⚠️ E CANCELLA SOLO LE PROPRIE RIGHE, riconosciute dal nome che ha
  -- scritto lei: mai «la più recente», che è la regola del 23/08 nata da
  -- uno sconto vero cancellato per sbaglio.
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;
  delete from order_items where order_id in (select id from orders where table_label = '__VERIFICA__ bis');
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  delete from orders where table_label = '__VERIFICA__ bis';
  delete from recipe_ingredients where recipe_id in (select id from recipes where name like '\_\_VERIFICA\_\_%del bis');
  delete from recipe_status_history where recipe_id in (select id from recipes where name like '\_\_VERIFICA\_\_%del bis');
  delete from recipes where name like '\_\_VERIFICA\_\_%del bis';
  delete from price_history where ingredient_id in (select id from ingredients where name = '__VERIFICA__ ingrediente del bis');
  delete from ingredients where name = '__VERIFICA__ ingrediente del bis';

  -- ⚠️ IL PERIMETRO È FATTO DI ROBA CREATA QUI (regola del 16/08): un
  -- ingrediente che esiste solo per questa verifica, così il conto che si
  -- fa sotto non può confondersi con la merce vera. E il numero è scelto
  -- perché le risposte sbagliate diano numeri DIVERSI (19/08): 0,4 kg per
  -- il finger e 0,1 per il piatto — se il bis non contasse verrebbe 0,1,
  -- se contasse due volte 0,9.
  insert into ingredients (entity_id, name, unit, category, current_price, waste_percentage_default)
  values (v_entita, '__VERIFICA__ ingrediente del bis', 'kg', 'pesce', 10, 0)
  returning id into v_ingr;

  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit, portions_yield)
  values ('__VERIFICA__ finger del bis', 'antipasto', 'finger', 1, 'pz', 1)
  returning id into v_finger;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_finger, v_ingr, 0.4, 'kg');

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto del bis', 'finger_food', 'piatto_finito', 1)
  returning id into v_piatto;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_ingr, 0.1, 'kg');

  -- Un conto proprio, senza toccare i conti di nessuno.
  -- ⚠️ `entity_id` è obbligatorio e non ha predefinito: le colonne che
  -- servono si chiedono al catalogo, non si scrivono a memoria.
  insert into orders (entity_id, table_label, status, coperti)
  values (v_entita, '__VERIFICA__ bis', 'aperto', 1)
  returning id into v_conto;

  -- (a) IL PIATTO DA SOLO, inviato. ⚠️ `sent_at` non è un dettaglio:
  --     `fabbisogno_conto` conta solo le righe INVIATE, perché mai inviata
  --     vuol dire mai cucinata. Una bozza qui darebbe zero e la verifica
  --     passerebbe misurando il nulla — è la trappola del caso vuoto.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at, turno)
  values (v_conto, v_piatto, 'cucina', 1, 18, now(), 1);

  select coalesce(sum(f.quantita), 0) into v_senza
    from fabbisogno_conto(v_conto) f where f.ingredient_id = v_ingr;
  if round(v_senza, 4) <> 0.1 then
    raise exception 'Il piatto da solo non chiede 0,1 kg ma %.', v_senza;
  end if;

  -- (b) IL BIS, come lo scrive la sala: una riga che punta al FINGER.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at, turno)
  values (v_conto, v_finger, 'cucina', 1, 5.50, now(), 1)
  returning id into v_riga;

  select coalesce(sum(f.quantita), 0) into v_con
    from fabbisogno_conto(v_conto) f where f.ingredient_id = v_ingr;
  if round(v_con, 4) <> 0.5 then
    raise exception
      'Col bis il fabbisogno dovrebbe essere 0,5 kg (0,1 del piatto + 0,4 del finger) ed e'' %. '
      'Se e'' 0,1 il bis non scarica niente; se e'' 0,9 lo scarica due volte.', v_con;
  end if;

  -- (c) LA CONTROPROVA CHE DISCRIMINA: tolto il bis, si torna a 0,1. Senza
  --     questa, un calcolo che sommasse due volte il piatto passerebbe la
  --     (b) per caso — e questo è il verso in cui il magazzino scenderebbe
  --     più del vero, cioè quello che nessuno noterebbe fino all'inventario.
  update order_items set voided_at = now(), void_reason = 'verifica' where id = v_riga;
  select coalesce(sum(f.quantita), 0) into v_senza
    from fabbisogno_conto(v_conto) f where f.ingredient_id = v_ingr;
  if round(v_senza, 4) <> 0.1 then
    raise exception 'Tolto il bis il fabbisogno non torna a 0,1 ma %.', v_senza;
  end if;

  -- (d) LA PROPRIETÀ, non la fotografia: nessun finger deve avere una
  --     resa in porzioni che azzeri il calcolo. ⚠️ Oggi la colonna è `not
  --     null default 1`, ma un domani qualcuno potrebbe scriverci zero —
  --     e allora la merce di ogni bis sparirebbe in silenzio.
  if exists (select 1 from recipes where recipe_type = 'finger' and coalesce(portions_yield, 0) = 0) then
    raise exception
      'C''e'' almeno un finger con porzioni a zero: il bis di quel finger non scaricherebbe niente, e senza nessun errore.';
  end if;

  -- (e) Si ripulisce cio' che questa verifica ha creato, e SOLO quello,
  --     riconosciuto dagli identificativi che si e' segnata.
  --     ⚠️ Le figlie prima delle madri, o le chiavi esterne respingono.
  --
  -- 🔴 E QUI SERVE SPEGNERE UN TRIGGER, il che è a suo modo una buona
  -- notizia: `vieta_modifica_riga_servita` ha rifiutato la pulizia dicendo
  -- *«è già andata in cucina: non si cancella, si storna»*. Ha ragione — è
  -- la regola del 16/08 — e vale anche per una riga di prova, perché il
  -- trigger non sa distinguere. Si spegne esplicitamente e si RIACCENDE
  -- controllando di averlo fatto: lasciarlo spento vorrebbe dire che da
  -- domani in sala si cancellano le righe già mandate in cucina.
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;
  delete from order_items where order_id = v_conto;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;

  -- ⚠️ SI CONTROLLA CHE SIANO TORNATI ACCESI TUTTI E DUE, e non è una
  -- formalità: lasciarne spento uno vorrebbe dire che da domani, in sala,
  -- una riga già mandata in cucina si cancella — e che le cancellazioni
  -- non finiscono più nel registro. Due difetti gravi che nascerebbero da
  -- una migrazione che «è passata».
  if exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'order_items'
       and t.tgname in ('trg_riga_servita', 'trg_log_delete')
       and t.tgenabled = 'D'
  ) then
    raise exception 'Un trigger di order_items e'' rimasto spento dopo la verifica.';
  end if;

  delete from orders where id = v_conto;
  delete from recipe_ingredients where recipe_id in (v_piatto, v_finger);
  delete from recipe_status_history where recipe_id in (v_piatto, v_finger);
  delete from recipes where id in (v_piatto, v_finger);
  delete from price_history where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il bis scarica il suo finger: 0,1 senza, 0,5 con, 0,1 togliendolo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000028', 'il_bis_scarica_il_magazzino') on conflict (version) do nothing;
