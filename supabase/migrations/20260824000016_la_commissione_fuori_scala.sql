-- =====================================================================
-- LA COMMISSIONE FUORI SCALA SI VEDE ANCHE QUANDO E' QUELLA VERA
-- 24/08/2026 — coda della 20260824000015
-- =====================================================================
-- ⚠️ IL VINCOLO VECCHIO FACEVA DUE LAVORI IN UNO, e togliendolo se ne
-- perdeva uno. Diceva `0 <= commissione <= 10` **in punti**: metteva
-- insieme il limite CERTO (non e' una percentuale) e il limite SOSPETTO
-- (una commissione oltre il 10% e' fuori scala). Portando la colonna in
-- frazione, il vincolo nuovo dice solo la prima cosa — 0..1 — e la
-- seconda sarebbe sparita in silenzio.
--
-- 🔴 E LA DISTINZIONE E' LA REGOLA DI ALESSIO DEL 24/08, non una
-- raffinatezza: il limite certo **rifiuta**, quello sospetto **si accetta
-- e si mostra**. Una commissione dell'8% e' strana, non impossibile: una
-- banca puo' applicarla su un circuito particolare, e rifiutarla
-- costringerebbe a mentire al gestionale per andare avanti.
--
-- ⚠️ Fino a oggi la commissione **prevista** (Proiezione) aveva il suo
-- occhio addosso e quella **vera** — quella su cui si contano i soldi che
-- arrivano davvero in banca — non ce l'aveva. Stessa soglia, 5%, perche'
-- e' la stessa domanda posta sullo stesso fatto.
--
-- ⚠️ CORPO PRESO DAL DATABASE VIVO (regola del 18/08): questa funzione
-- e' nata stanotte e non e' ancora stata toccata da nessuno, ma il metodo
-- non cambia con l'eta' della funzione — e' cambiando metodo quando
-- sembrava sicuro che il 18/08 sono andate perse due cose.
-- =====================================================================

create or replace function public.numeri_sospetti()
 RETURNS TABLE(dove text, che_cosa text, valore text, perche text, riferimento uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 🔴 IL PORTIERE. `security definer` gira senza RLS, quindi il controllo
  -- va rimesso dentro (rilievo del validatore del 13/08): qui ci sono
  -- prezzi d'acquisto, importi di fatture e movimenti di cassa, che lo
  -- staff non deve vedere. E chi non deve vedere riceve un RIFIUTO, non
  -- un elenco vuoto — una schermata vuota e' una rassicurazione falsa.
  if not is_titolare() then
    raise exception 'I numeri sospetti sono riservati al titolare.';
  end if;

  return query
  -- Previsione: le percentuali strane
  select 'Previsione'::text,
         s.nome || ' — food cost',
         to_char(s.food_cost_percento * 100, 'FM990.0') || '%',
         'Sopra il 50%: possibile, ma su un piatto vuol dire che quasi meta'' del prezzo e'' materia prima.'::text,
         s.id
    from scenari_proiezione s where s.food_cost_percento > 0.5

  union all
  select 'Previsione',
         s.nome || ' — beverage cost',
         to_char(s.beverage_cost_percento * 100, 'FM990.0') || '%',
         'Sopra il 50%: sul beverage il margine e'' di solito piu'' alto che sul cibo.',
         s.id
    from scenari_proiezione s where s.beverage_cost_percento > 0.5

  union all
  select 'Previsione',
         s.nome || ' — tasse e contributi sopra il netto',
         to_char(s.pressione_personale * 100, 'FM990.0') || '%',
         'Sopra il 150%: il costo aziendale sarebbe piu'' del doppio di quello che il dipendente porta a casa.',
         s.id
    from scenari_proiezione s where s.pressione_personale > 1.5

  union all
  select 'Previsione',
         s.nome || ' — ore lavorate al giorno',
         to_char(s.ore_giorno, 'FM990.0') || ' ore',
         'Fuori dall''intervallo 4-12: possibile, ma cambia il netto orario di tutto il personale.',
         s.id
    from scenari_proiezione s where s.ore_giorno < 4 or s.ore_giorno > 12

  union all
  select 'Previsione',
         s.nome || ' — commissione POS',
         to_char(s.commissione_pos_percento * 100, 'FM990.00') || '%',
         'Sopra il 5%: e'' molto piu'' del normale per un esercizio commerciale.',
         s.id
    from scenari_proiezione s where s.commissione_pos_percento > 0.05

  -- ⚠️ LA STESSA SOGLIA SULLA STESSA COSA, nell'altra tabella. Aggiunta
  -- il 24/08 con la migrazione che ha portato le due colonne alla stessa
  -- unita': fino ad allora la commissione prevista aveva il suo occhio
  -- addosso e quella VERA — quella su cui si contano i soldi che
  -- arrivano in banca — non ce l'aveva.
  union all
  select 'Tesoreria',
         'Commissione del POS',
         to_char(t.commissione_pos_percento * 100, 'FM990.00') || '%',
         'Sopra il 5%: e'' molto piu'' del normale per un esercizio commerciale. Se la banca dice 1,5, nel campo va 1,5.',
         t.entity_id
    from impostazioni_tesoreria t where t.commissione_pos_percento > 0.05

  union all
  select 'Previsione',
         s.nome || ' — scontrino per coperto',
         to_char(s.scontrino_food + s.scontrino_beverage, 'FM999990.00') || ' €',
         'Sopra i 200 € a persona: possibile per un menu degustazione, non per il servizio normale.',
         s.id
    from scenari_proiezione s where s.scontrino_food + s.scontrino_beverage > 200

  -- Magazzino
  union all
  select 'Magazzino',
         i.name || ' — scarto',
         to_char(i.waste_percentage_default, 'FM990.0') || '%',
         'Sopra il 60%: succede (carciofi, pesce da pulire), ma triplica il fabbisogno di quel prodotto.',
         i.id
    from ingredients i where i.active and i.waste_percentage_default > 60

  union all
  select 'Magazzino',
         i.name || ' — durata dichiarata',
         i.shelf_life_days::text || ' giorni',
         'Oltre i tre anni: giusto per aceto, sale e conserve; sospetto per tutto il resto.',
         i.id
    from ingredients i where i.active and i.shelf_life_days > 1095

  union all
  select 'Magazzino',
         i.name || ' — prezzo per ' || i.unit::text,
         to_char(i.current_price, 'FM999990.00') || ' €',
         'Sopra i 500 € per unita'': vero per zafferano e tartufo, altrimenti e'' un''unita'' di misura sbagliata.',
         i.id
    from ingredients i where i.active and i.current_price > 500

  union all
  select 'Ricettario',
         r.name || ' — una riga da ' || to_char(ri.quantity, 'FM999990.0000') || ' ' ||
           coalesce(i.unit::text, ''),
         to_char(ri.quantity, 'FM999990.0000'),
         'Oltre 5 unita'' in una riga di ricetta: possibile su acqua e farina, sospetto su tutto il resto — e'' la forma dei grammi scritti come chili.',
         ri.recipe_id
    from recipe_ingredients ri
    join recipes r on r.id = ri.recipe_id
    left join ingredients i on i.id = ri.ingredient_id
   where ri.quantity > 5

  -- Denaro
  union all
  select 'Fatture fornitori',
         s.name || ' — fattura ' || f.invoice_number,
         to_char(f.amount, 'FM999990.00') || ' €',
         'Sopra i 20.000 €: per un''osteria da 34 coperti e'' fuori scala, e una virgola persa fa esattamente questo.',
         f.id
    from supplier_invoices f join suppliers s on s.id = f.supplier_id
   where f.amount > 20000

  union all
  select 'Prima nota',
         coalesce(nullif(btrim(coalesce(m.note, '')), ''), c.label, 'movimento senza descrizione'),
         to_char(m.amount, 'FM999990.00') || ' €',
         'Movimento sopra i 10.000 €: puo'' essere un finanziamento o un versamento, ma vale la pena rileggerlo.',
         m.id
    from cash_movements m left join cash_causali c on c.id = m.causale_id
   where m.amount > 10000

  union all
  select 'Editor menu',
         coalesce(r.name, 'piatto senza ricetta') || ' — prezzo di vendita',
         to_char(mi.selling_price, 'FM999990.00') || ' €',
         'Sopra i 100 € a piatto: fuori scala per questo locale.',
         mi.id
    from menu_items mi left join recipes r on r.id = mi.recipe_id
   where mi.selling_price > 100

  order by 1, 2;
end $function$;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_entita   uuid;
  v_quante   integer;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_esisteva boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_entita from entities limit 1;
  select exists(select 1 from impostazioni_tesoreria where entity_id = v_entita)
    into v_esisteva;

  -- (a) Una commissione dell'8% viene ACCETTATA — il limite sospetto non
  --     rifiuta — e compare fra i numeri da guardare.
  insert into impostazioni_tesoreria (entity_id, commissione_pos_percento)
  values (v_entita, 0.08)
  on conflict (entity_id) do update set commissione_pos_percento = 0.08;

  select count(*) into v_quante
    from numeri_sospetti() n
   where n.dove = 'Tesoreria' and n.valore like '8,00%' or n.valore like '8.00%';
  if v_quante = 0 then
    raise exception 'Una commissione dell''8%% non compare fra i numeri sospetti.';
  end if;

  -- (b) ⚠️ LA CONTROPROVA CHE DISCRIMINA: una commissione normale NON
  --     deve comparire. Senza questa, un elenco che segnala tutto
  --     passerebbe la prova (a) e sarebbe inservibile — un guardiano che
  --     grida sempre si impara a spegnere.
  update impostazioni_tesoreria set commissione_pos_percento = 0.015
   where entity_id = v_entita;

  select count(*) into v_quante
    from numeri_sospetti() n where n.dove = 'Tesoreria';
  if v_quante > 0 then
    raise exception 'Una commissione dell''1,5%% viene segnalata come sospetta: l''elenco non discrimina.';
  end if;

  -- (c) Si rimette com'era.
  if v_esisteva then
    update impostazioni_tesoreria set commissione_pos_percento = null
     where entity_id = v_entita;
  else
    delete from impostazioni_tesoreria where entity_id = v_entita;
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La commissione vera fuori scala si vede, e quella normale no.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000016', 'la_commissione_fuori_scala') on conflict (version) do nothing;
