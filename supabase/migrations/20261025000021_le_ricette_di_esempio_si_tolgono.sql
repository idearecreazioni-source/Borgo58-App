-- =====================================================================
-- LE RICETTE DI ESEMPIO SI TOLGONO — 25/10/2026
-- =====================================================================
-- Decisione di Alessio del 25/10 (*«le 14 ricette le puoi togliere»*),
-- data sull'elenco esatto che gli è stato mostrato prima: le 14 ricette di
-- prova, il menu «Carta di prova» che le contiene, e i 2 conti di prova che
-- ne usano 6 (uno annullato su T2 del 05/09, uno aperto su T3 dal 22/09).
-- ⚠️ Le sue 3 bozze NON si toccano (Crema Catalana allo Zafferano, Panna
--    Cotta al Mandarino, Crema al Caffè simil Coppa del Nonno).
--
-- ⚠️ IL PERIMETRO SONO GLI IDENTIFICATIVI, letti dalla produzione il 25/10
--    (connettore in sola lettura), mai un criterio come «tutte le ricette» o
--    «il menu attivo»: una ricetta vera scritta nel frattempo non deve
--    poter finire dentro. Se anche UNO dei 17 identificativi non c'è più, o
--    se una ricetta ha preso ingredienti, passaggi, un'altra casa (bozza,
--    preparazione, preventivo, produzione…) o un conto ha soldi sopra, la
--    migrazione SI FERMA e non cancella niente.
--
-- ⚠️ SUL PROGETTO DI PROVA nessuno di quegli identificativi esiste: la
--    migrazione lo dice e non fa niente. Il ramo che cancella gira solo in
--    produzione, ed è dichiarato nel riepilogo.
--
-- ⚠️ COSA RESTA: `orders` e `order_items` sono nel registro delle
--    cancellazioni, quindi restano 9 lapidi (2 conti + 7 righe), che nessuno
--    può togliere dall'app. Ricette, menu e storico di stato non sono nel
--    registro.
-- =====================================================================

do $pulizia$
declare
  v_ricette uuid[] := array[
    '2e76ff8f-e99d-4b14-bd82-cf451960d7dc', -- Anelletti al forno
    'b263cb15-e9ba-43e8-91ae-60729efa5629', -- Busiate al pesto trapanese
    '9e4aab38-0130-4510-b593-0e2894eb4ca3', -- Cannolo scomposto
    '01f1b085-c41c-4f02-a036-06011ad45cd3', -- Caponata di melanzane
    'aa4da1fa-3796-4e50-b86a-c0f9fd3a2a55', -- Cassata siciliana
    'd983797c-a6ff-41a7-90ce-d36388bd5d08', -- Crudo di gambero rosso
    '131b7c8d-a30a-4161-a6fe-175317bdaf30', -- Involtini di pesce spada
    '11bee7bb-98b1-4ef7-8e6d-44d4f9d92598', -- Maialino nero dei Nebrodi
    '20e7c04b-d4bd-45b9-ba76-bf60e592d3c7', -- Parmigiana di melanzane
    '866083be-889c-4144-ba8e-c482c578b5e8', -- Risotto agli agrumi
    'd9c9aefa-753b-46bf-8914-b0a117b15c90', -- Sarde a beccafico
    'd41bdd17-72b3-45ad-bdc1-ffeefa8051b6', -- Sformato di broccoli e ricotta
    '6c7adf48-9dce-4e00-8b14-29c0afbc6c26', -- Spaghetti con le vongole
    '40a1c55f-0d0f-4192-8298-12bbbd3cc401'  -- Tonno in crosta di pistacchio
  ]::uuid[];
  v_menu  uuid := '7098378f-27dd-4b18-80a0-93f62c885ff2';  -- Carta di prova
  v_conti uuid[] := array[
    'c944b2fe-7588-4178-b542-46e672e8147d',  -- T2, annullato, 05/09
    'a4942b15-4e4b-4ce8-a367-af05b3ed128b'   -- T3, aperto, 22/09
  ]::uuid[];
  v_trovate  int;
  v_lapidi   bigint;
  v_bozze    bigint;
  v_n_conti  int;
  v_n_righe  int;
  v_n_voci   int;
  v_n_storia int;
  v_n_ric    int;
begin
  select count(*) into v_trovate from recipes where id = any(v_ricette);
  if v_trovate = 0
     and not exists (select 1 from menus where id = v_menu)
     and not exists (select 1 from orders where id = any(v_conti)) then
    raise notice 'Le ricette di esempio non ci sono su questo database: niente da togliere (0 ricette, 0 menu, 0 conti).';
    return;
  end if;

  -- ---------------------------------------------------------------
  -- I GUARDIANI: o è tutto come il 25/10, o non si tocca niente.
  -- ---------------------------------------------------------------
  if v_trovate <> 14
     or (select count(*) from orders where id = any(v_conti)) <> 2
     or not exists (select 1 from menus where id = v_menu and name = 'Carta di prova') then
    raise exception 'Il perimetro non e'' piu'' quello del 25/10 (ricette trovate: %): mi fermo e non cancello niente.', v_trovate;
  end if;

  -- Il menu contiene solo quelle ricette.
  if exists (select 1 from menu_items where menu_id = v_menu and recipe_id <> all(v_ricette)) then
    raise exception 'Nel menu «Carta di prova» c''e'' una ricetta che non e'' fra le 14: mi fermo.';
  end if;
  -- Le ricette non stanno in nessun altro menu.
  if exists (select 1 from menu_items where recipe_id = any(v_ricette) and menu_id <> v_menu) then
    raise exception 'Una delle 14 ricette e'' anche in un altro menu: mi fermo.';
  end if;
  -- Nessun conto, fuori dai due di prova, usa quelle ricette.
  if exists (select 1 from order_items where recipe_id = any(v_ricette) and order_id <> all(v_conti)) then
    raise exception 'Una delle 14 ricette e'' su un conto che non e'' di prova: mi fermo.';
  end if;
  -- Le ricette sono rimaste vuote: nessun lavoro di Alessio dentro.
  if exists (select 1 from recipe_ingredients where recipe_id = any(v_ricette) or component_recipe_id = any(v_ricette))
     or exists (select 1 from recipe_steps where recipe_id = any(v_ricette))
     or exists (select 1 from recipe_videos where recipe_id = any(v_ricette))
     or exists (select 1 from bozze_ricetta where ricetta_id = any(v_ricette))
     or exists (select 1 from daily_menu_items where recipe_id = any(v_ricette))
     or exists (select 1 from ingredients where preparazione_id = any(v_ricette))
     or exists (select 1 from preventivo_righe where recipe_id = any(v_ricette))
     or exists (select 1 from produzioni where recipe_id = any(v_ricette))
     or exists (select 1 from trasformazioni_dichiarate where ricetta_id = any(v_ricette))
     or exists (select 1 from scelte_allergene where recipe_id = any(v_ricette))
     or exists (select 1 from sostituzioni_allergene where recipe_id = any(v_ricette)) then
    raise exception 'Una delle 14 ricette ha ricevuto ingredienti, passaggi o un collegamento dopo il 25/10: mi fermo e non cancello niente.';
  end if;
  -- Sui due conti non sono passati soldi né merce.
  if exists (select 1 from order_payments where order_id = any(v_conti))
     or exists (select 1 from stock_consumptions where order_id = any(v_conti))
     or exists (select 1 from cash_movements where caparra_usata_su_conto = any(v_conti))
     or exists (select 1 from segnalazioni_fiscali where order_id = any(v_conti)) then
    raise exception 'Su uno dei due conti di prova ci sono pagamenti, scarichi o segnalazioni: mi fermo.';
  end if;

  select count(*) into v_lapidi from deleted_records;
  select count(*) into v_bozze from bozze_ricetta;
  select count(*) into v_n_righe from order_items where order_id = any(v_conti);
  select count(*) into v_n_voci from menu_items where menu_id = v_menu;
  select count(*) into v_n_storia from recipe_status_history where recipe_id = any(v_ricette);

  -- ---------------------------------------------------------------
  -- LA CANCELLAZIONE, nell'ordine delle chiavi esterne.
  -- ⚠️ Il conto prima delle sue righe: col conto già sparito, il trigger
  --    che protegge le righe inviate le lascia andare (è scritto così).
  -- ---------------------------------------------------------------
  delete from orders where id = any(v_conti);
  get diagnostics v_n_conti = row_count;
  delete from menus where id = v_menu;
  delete from recipes where id = any(v_ricette);
  get diagnostics v_n_ric = row_count;

  -- ---------------------------------------------------------------
  -- LA VERIFICA DI CIÒ CHE È CAMBIATO DAVVERO.
  -- ---------------------------------------------------------------
  if v_n_conti <> 2 or v_n_ric <> 14
     or exists (select 1 from recipes where id = any(v_ricette))
     or exists (select 1 from order_items where order_id = any(v_conti))
     or exists (select 1 from menu_items where menu_id = v_menu)
     or exists (select 1 from recipe_status_history where recipe_id = any(v_ricette)) then
    raise exception 'La pulizia non ha tolto tutto: conti %, ricette %.', v_n_conti, v_n_ric;
  end if;
  if (select count(*) from bozze_ricetta) <> v_bozze then
    raise exception 'Le bozze sono cambiate durante la pulizia: non doveva succedere.';
  end if;
  if (select count(*) from deleted_records) - v_lapidi <> 2 + v_n_righe then
    raise exception 'Le lapidi nate sono %, ne aspettavo % (2 conti + % righe).',
      (select count(*) from deleted_records) - v_lapidi, 2 + v_n_righe, v_n_righe;
  end if;

  raise notice 'Tolti: % ricette, 1 menu con % voci, % conti con % righe, % righe di storico di stato. Lapidi nuove: %. Bozze intatte: %.',
    v_n_ric, v_n_voci, v_n_conti, v_n_righe, v_n_storia, 2 + v_n_righe, v_bozze;
end $pulizia$;

insert into applied_migrations (version, name)
values ('20261025000021', 'le_ricette_di_esempio_si_tolgono')
on conflict (version) do nothing;
