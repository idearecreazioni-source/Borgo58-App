-- =====================================================================
-- LE PORTE CHE AVEVO APERTO — coda della 20260824000034 e della …035
-- 24/08/2026
-- =====================================================================
-- 🔴 TROVATE DALLE PROVE SUI DATI VERI, non rileggendo: `permessi.test.js`
-- è diventata rossa da sola e ha nominato quali funzioni erano comparse.
-- È esattamente il lavoro per cui quella rete esiste (13/08), e questa è la
-- terza volta che prende qualcosa.
--
-- ---------------------------------------------------------------------
-- 1 · TRE FUNZIONI DI TRIGGER APERTE AL MONDO
-- ---------------------------------------------------------------------
-- `vieta_eliminabile_scoperto`, `vieta_sostituzione_che_scopre` e
-- `vieta_sostituzione_a_conto_chiuso` sono comparse fra le funzioni
-- eseguibili con la sola chiave pubblica — che sta nel bundle del sito.
--
-- ⚠️ NESSUN DATO USCIVA (fuori da un trigger si rifiutano di girare), ed è
-- la stessa forma del 15/08: *anche una funzione trigger nasce eseguibile da
-- chiunque abbia la chiave anon*. Il difetto non è la fuga: è che
-- **l'elenco cresceva in silenzio**, e un elenco che cresce da solo smette
-- di essere un controllo.
--
-- ---------------------------------------------------------------------
-- 2 · 🔴 E UNA PORTA CHIUSA CHE HO RIAPERTO IO
-- ---------------------------------------------------------------------
-- Riscrivendo `fabbisogno_conto` per farle scambiare l'ingrediente
-- sostituito, le ho rimesso `grant execute … to authenticated`. **Prima non
-- ce l'aveva**: è un aiuto interno, la chiama `scarica_magazzino_conto` che
-- gira come proprietaria, e nessun client deve poter chiedere quanti chili
-- di ogni ingrediente esce da un conto.
--
-- ⚠️ ED È LA LEZIONE DEL «CORPO VIVO» CON UNA FACCIA NUOVA: il corpo l'ho
-- preso dal database, come vuole la regola — ma i **permessi** no, quelli
-- li ho riscritti a memoria, e a memoria erano sbagliati. *Un `revoke`/
-- `grant` ricopiato è una riscrittura come le altre.*
--
-- ⚠️ A trovarla è stata una prova che esisteva già e che diceva una cosa
-- sola: «nemmeno il titolare può chiedere il fabbisogno di un conto».
--
-- ---------------------------------------------------------------------
-- 3 · E `ingredienti_con_allergene` TORNA UN AIUTO INTERNO
-- ---------------------------------------------------------------------
-- Era `security definer` **senza portiere** e aperta a tutto lo staff. Il
-- portiere non si può aggiungere: la chiama anche il trigger, e dentro una
-- migrazione `auth.uid()` è vuoto — il divieto scatterebbe proprio dove
-- serve che funzioni.
--
-- ⚠️ LA CURA È TOGLIERE LA CHIAMATA, non aggiungere un guardiano: la
-- schermata chiedeva a lei l'elenco degli ingredienti scoperti, e
-- `allergeni_del_piatto` — che il portiere ce l'ha — restituisce già la
-- stessa identica cosa (`scoperti` e `sostituzioni`). Era una seconda
-- lettura per un dato che arrivava già.
-- =====================================================================

revoke all on function public.vieta_eliminabile_scoperto() from public, anon, authenticated;
revoke all on function public.vieta_sostituzione_che_scopre() from public, anon, authenticated;
revoke all on function public.vieta_sostituzione_a_conto_chiuso() from public, anon, authenticated;

revoke all on function public.fabbisogno_conto(uuid) from public, anon, authenticated;
revoke all on function public.ingredienti_con_allergene(uuid, allergen) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Verifica — proprietà, non conteggi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_entita   uuid;
  v_burro    uuid;
  v_senza    uuid;
  v_piatto   uuid;
  v_conto    uuid;
  v_riga     uuid;
  v_n        integer;
  f          text;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_entita from entities limit 1;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;

  -- (a) NESSUNA DELLE FUNZIONI NATE COL BLOCCO DEGLI ALLERGENI E'
  --     ESEGUIBILE CON LA SOLA CHIAVE PUBBLICA. È una proprietà: vale su
  --     tutte e cinque, e resta vera domani.
  foreach f in array array[
    'vieta_eliminabile_scoperto()',
    'vieta_sostituzione_che_scopre()',
    'vieta_sostituzione_a_conto_chiuso()',
    'ingredienti_con_allergene(uuid, allergen)',
    'allergeni_del_piatto(uuid)',
    'allergeni_della_riga(uuid)',
    'applica_sostituzione_riga(uuid, allergen)',
    'togli_sostituzione_riga(uuid, allergen)'
  ]
  loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'La funzione % e'' ancora eseguibile con la chiave pubblica.', f;
    end if;
  end loop;

  -- (b) I DUE AIUTI INTERNI NON SI CHIAMANO DA FUORI, nemmeno dal titolare.
  if has_function_privilege('authenticated', 'fabbisogno_conto(uuid)', 'execute') then
    raise exception 'fabbisogno_conto e'' ancora chiamabile da un client: era chiusa prima del 24/08.';
  end if;
  if has_function_privilege('authenticated', 'ingredienti_con_allergene(uuid, allergen)', 'execute') then
    raise exception 'ingredienti_con_allergene e'' ancora chiamabile da un client.';
  end if;

  -- (c) 🔴 E LA CATENA REGGE LO STESSO — è la metà che conta: un `revoke`
  --     che chiude anche le strade legittime non è una cura, è un guasto.
  --     La sala deve continuare a vedere gli allergeni di una riga, e lo
  --     scarico deve continuare a scambiare l'ingrediente.
  insert into ingredients (entity_id, name, category, unit, allergens, current_price)
  values (v_entita, '__VERIFICA__ burro porte', 'latticini', 'kg', array['latte']::allergen[], 10)
  returning id into v_burro;
  insert into ingredients (entity_id, name, category, unit, allergens, current_price)
  values (v_entita, '__VERIFICA__ burro porte senza', 'latticini', 'kg', '{}'::allergen[], 14)
  returning id into v_senza;

  insert into recipes (name, category, recipe_type, portions_yield)
  values ('__VERIFICA__ piatto porte', 'primo', 'piatto_finito', 1)
  returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_piatto, v_burro, 0.05, 'kg');

  insert into orders (table_label, status, coperti, entity_id)
  values ('__VERIFICA__ porte', 'aperto', 2, v_entita)
  returning id into v_conto;
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
  values (v_conto, v_piatto, 'cucina', 1, 20.00, now())
  returning id into v_riga;

  insert into sostituzioni_allergene (recipe_id, allergene, ingrediente_id, sostituto_id, costo_aggiuntivo)
  values (v_piatto, 'latte', v_burro, v_senza, 1.00);
  insert into scelte_allergene (recipe_id, allergene, eliminabile)
  values (v_piatto, 'latte', true);

  -- ⚠️ Col token dello STAFF, che è chi sta in sala: se il `revoke` avesse
  --    rotto la catena, qui si vedrebbe.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    select count(*) into v_n from allergeni_della_riga(v_riga);
    if v_n <> 1 then
      raise exception 'In sala gli allergeni della riga non arrivano piu'': % righe invece di 1.', v_n;
    end if;
    perform applica_sostituzione_riga(v_riga, 'latte');
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    perform applica_sostituzione_riga(v_riga, 'latte');
    raise notice 'Nessuno staff in user_roles: la catena e'' stata provata col titolare.';
  end if;

  select count(*) into v_n from fabbisogno_conto(v_conto) f2 where f2.ingredient_id = v_senza;
  if v_n <> 1 then
    raise exception 'Lo scarico non scambia piu'' l''ingrediente: il sostituto non risulta.';
  end if;

  -- Pulizia — solo la roba di questa verifica.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_log_delete;

  delete from order_item_sostituzioni where order_item_id = v_riga;
  delete from order_items where order_id = v_conto;
  delete from orders where id = v_conto;

  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_log_delete;
  if (select count(*) from pg_trigger
       where tgrelid = 'order_items'::regclass and tgenabled = 'D') > 0 then
    raise exception 'Un guardiano delle righe e'' rimasto spento.';
  end if;

  delete from scelte_allergene where recipe_id = v_piatto;
  delete from sostituzioni_allergene where recipe_id = v_piatto;
  delete from recipe_ingredients where recipe_id = v_piatto;
  delete from recipes where id = v_piatto;
  delete from ingredients where id in (v_burro, v_senza);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Le porte sono richiuse, e la catena regge lo stesso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000036', 'le_due_porte_che_avevo_aperto') on conflict (version) do nothing;
