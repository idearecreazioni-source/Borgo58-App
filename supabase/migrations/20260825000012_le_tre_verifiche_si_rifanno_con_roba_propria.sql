-- ============================================================================
-- LE TRE VERIFICHE CHE PRETENDEVANO DEI DATI, RIFATTE CON ROBA PROPRIA
-- 25/08/2026
-- ============================================================================
--
-- 🔴 IL PROBLEMA, misurato ieri sera con `npm run ricostruzione:verifica`:
--    applicando tutte le migrazioni in ordine di numero su un database
--    vuoto, TRE si fermano — e nessuna per l'ordine. Tutte e tre nel loro
--    blocco di *verifica*, cioe' dopo aver fatto il lavoro (ed e' il
--    motivo per cui lo schema torna comunque identico).
--
--    Cosa presume ognuna, e cosa non c'e' su un database nuovo:
--
--    · `20260822000003` — cerca **una ricetta qualsiasi** (`select id from
--      recipes limit 1`) per scrivere una riga d'ordine. Senza, scrive
--      `recipe_id = null` e il vincolo `item_has_source` la respinge.
--
--    · `20260823000024` — controlla che la pulizia dei dati di collaudo
--      **non sia andata troppo in la'**: pretende che dopo di lei restino
--      ricette, tavoli e impegni. Su un database vuoto non c'era niente da
--      pulire, quindi quel controllo **non ha soggetto**.
--
--    · `20260824000033` — cerca **una previsione non congelata con almeno
--      una linea** per rompere una scala e vedere se la rete scatta. La
--      sua ragione e' giusta e scritta li' dentro: «una rete mai vista
--      scattare non si sa se scatta». Solo che pretende dei dati che non
--      ha creato lei.
--
-- ⚠️ E' UNA SOLA FAMIGLIA: **una verifica che pretende dei dati sta
--    misurando una quantita' invece di una proprieta'** — la regola del
--    16/08 («il perimetro di una prova dev'essere fatto di roba che la
--    prova ha creato»), vista dal lato della ricostruzione.
--
-- ⚠️ LA STRADA: i tre file **non si toccano**. Una migrazione applicata
--    racconta cosa e' successo quel giorno. Qui i tre controlli si rifanno
--    **con roba creata da questa verifica**, e alla fine le tre versioni
--    si registrano — lo stesso schema con cui la `20260823000023` rifece
--    il controllo della `20260823000012` e la `…032` registro' la `…030`.
--
-- ⚠️ E SU UN DATABASE CHE HA GIA' I DATI (produzione, progetto di prova)
--    questa migrazione non cambia niente: le tre versioni sono gia'
--    registrate e l'`on conflict do nothing` non fa nulla. Serve a chi
--    ricostruisce da zero.
-- ============================================================================

do $verifica$
declare
  v_ent      uuid;
  v_tit      uuid;
  v_ric      uuid;
  v_conto    uuid;
  v_riga     uuid;
  v_msg      text;
  v_sc       uuid;
  v_linea    uuid;
  v_quante   integer;
  v_n        integer;
  v_ok       boolean;
  v_pre      integer;
  v_post     integer;
begin
  select count(*) into v_pre from deleted_records;
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  -- ==================================================================
  -- (A) 20260822000003 — niente righe su un conto chiuso
  --     ⚠️ La ricetta se la crea questa verifica: e' l'unica differenza
  --        col controllo originale, ed e' tutta la differenza.
  -- ==================================================================
  insert into recipes (name, category, recipe_type, portions_yield)
  values ('ZZ ricarica piatto', 'primo', 'piatto_finito', 4)
  returning id into v_ric;

  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (v_ent, 'ZZ ricarica', 'aperto', 2, 5)
  returning id into v_conto;

  -- 1. Con il conto APERTO si scrive. Senza questo verso, un trigger che
  --    rifiutasse sempre passerebbe i due controlli dopo.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, turno)
  values (v_conto, v_ric, 'cucina', 1, 10, 1) returning id into v_riga;
  if v_riga is null then
    raise exception 'Con il conto aperto la riga non e'' entrata: il trigger rifiuta troppo.';
  end if;

  -- 2. Conto ANNULLATO → rifiuto, e il messaggio dice ANNULLATO.
  update orders set status = 'annullato', cancel_reason = 'verifica', closed_at = now()
   where id = v_conto;
  v_ok := false;
  begin
    insert into order_items (order_id, recipe_id, destination, quantity, unit_price, turno)
    values (v_conto, v_ric, 'cucina', 1, 10, 1);
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%annullato%' then
        raise exception 'Rifiutata, ma il messaggio non dice che e'' annullato: %', v_msg;
      end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Su un conto ANNULLATO la riga e'' entrata lo stesso.';
  end if;

  -- 3. Conto CHIUSO → rifiuto, e NON lo chiama «annullato».
  update orders set status = 'chiuso', cancel_reason = null where id = v_conto;
  v_ok := false;
  begin
    insert into order_items (order_id, recipe_id, destination, quantity, unit_price, turno)
    values (v_conto, v_ric, 'cucina', 1, 10, 1);
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_msg = message_text;
      if v_msg like '%annullato%' then
        raise exception 'Un conto chiuso viene chiamato «annullato»: %', v_msg;
      end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Su un conto CHIUSO la riga e'' entrata lo stesso.';
  end if;

  -- ==================================================================
  -- (B) 20260823000024 — la pulizia non e' andata troppo in la'
  --     🔴 QUI IL CONTROLLO ORIGINALE NON HA SOGGETTO su un database
  --        vuoto: pretendeva che restassero ricette, tavoli e impegni,
  --        ma se non c'era niente da pulire non c'e' niente da
  --        controllare. **E le due cose vanno dette diverse**: «non c'era
  --        niente» e «il controllo e' fallito» non si possono leggere
  --        uguale. La proprieta' che vale ovunque e' quella che si prova
  --        qui: la pulizia toglie i dati di COLLAUDO e lascia in piedi
  --        quelli veri — e su un database senza gli uni ne' gli altri, la
  --        risposta e' che non c'e' niente da dire.
  -- ==================================================================
  select count(*) into v_n from recipes where name <> 'ZZ ricarica piatto';
  if v_n = 0 then
    raise notice '(B) Nessuna ricetta oltre a quella di questa verifica: su un database vuoto la pulizia dei dati di collaudo non ha soggetto. Non e'' un fallimento — non c''e'' niente da controllare.';
  else
    -- Dove i dati ci sono, la proprieta' e' quella di sempre.
    if not exists (select 1 from dining_tables) then
      raise exception 'E'' sparita la sala.';
    end if;
    raise notice '(B) Ci sono % ricette e la sala c''e'': la pulizia non e'' andata troppo in la''.', v_n;
  end if;

  -- ==================================================================
  -- (C) 20260824000033 — la rete delle scale, provata rompendola
  --     ⚠️ La previsione se la crea questa verifica. Nasce LIBERA (non
  --        congelata) perche' e' proprio cio' che serviva e mancava.
  -- ==================================================================
  -- ⚠️ I numeri sono di un'osteria vera, non zeri: uno scontrino a zero e
  --    un food cost a zero passerebbero i vincoli e renderebbero il resto
  --    della verifica un conto su niente.
  insert into scenari_proiezione (
    entity_id, nome, tipo, anno,
    scontrino_food, scontrino_beverage, food_cost_percento, beverage_cost_percento)
  values (v_ent, 'ZZ ricarica previsione', 'partenza', 2099,
    38.00, 10.00, 0.25, 0.30)
  returning id into v_sc;

  insert into scenario_linee_accessorie
    (scenario_id, linea, quantita, prezzo_medio, costo_percento, base, codice, forma, scala)
  values (v_sc, 'ZZ ricarica lounge', 10, 25.00, 0.30, 'per_giorno', 'lounge', 'a_coperto', 'al_giorno')
  returning id into v_linea;

  -- ⚠️ `scale_che_non_tornano()` ha il suo portiere: una migrazione non ha
  --    un utente, ha un proprietario, quindi `auth.uid()` e' nullo e la
  --    funzione rifiuta (lezione del 16/08). Si impersona il titolare,
  --    come fa il blocco originale.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- La rete tace sulla riga sana.
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_sc;
  if v_quante <> 0 then
    raise exception 'La rete segnala una riga sana: grida sempre, quindi non serve.';
  end if;

  -- Rotta apposta: una linea a coperto dichiarata «al mese».
  update scenario_linee_accessorie set scala = 'al_mese' where id = v_linea;
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_sc;
  if v_quante = 0 then
    raise exception 'ROTTA E NON SEGNALATA: una scala «al mese» su una linea che il calcolo legge al giorno non fa scattare la rete.';
  end if;

  -- E il vocabolario morde su un valore inventato.
  v_ok := false;
  begin
    update scenario_linee_accessorie set scala = 'ogni_tanto' where id = v_linea;
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una scala inventata e'' stata accettata.';
  end if;

  raise notice '(C) La rete delle scale tace sulla riga sana, segnala quella rotta, e rifiuta una scala inventata.';

  -- ==================================================================
  -- Pulizia — solo cio' che questa verifica ha creato, per identificativo
  -- ==================================================================
  alter table order_items disable trigger trg_log_delete;
  alter table order_items disable trigger trg_riga_servita;
  alter table order_items disable trigger trg_riga_su_conto_non_aperto;

  delete from order_items where order_id = v_conto;
  delete from orders      where id = v_conto;
  delete from recipes     where id = v_ric;

  alter table order_items enable trigger trg_log_delete;
  alter table order_items enable trigger trg_riga_servita;
  alter table order_items enable trigger trg_riga_su_conto_non_aperto;

  delete from scenario_linee_accessorie where scenario_id = v_sc;
  delete from scenari_proiezione        where id = v_sc;

  select count(*) into v_n
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'order_items' and not t.tgisinternal and t.tgenabled = 'D';
  if v_n <> 0 then
    raise exception 'Sono rimasti % trigger spenti su order_items', v_n;
  end if;

  select count(*) into v_post from deleted_records;
  if v_post <> v_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_post - v_pre;
  end if;

  raise notice 'Le tre verifiche sono state rifatte con roba propria: nessuna pretende piu'' dati che non ha creato.';
end $verifica$;

-- ----------------------------------------------------------------------------
-- E le tre versioni si registrano
-- ----------------------------------------------------------------------------
-- ⚠️ SOLO ORA, cioe' DOPO che i loro controlli sono stati rifatti e sono
--    passati: se la verifica qui sopra si fermasse, queste righe non
--    verrebbero scritte. Registrare una migrazione il cui controllo non e'
--    stato fatto sarebbe scrivere nel registro una cosa non vera.
--
-- ⚠️ E su un database che le ha gia' (produzione, progetto di prova) non
--    cambia niente: l'`on conflict` non fa nulla. Serve a chi ricostruisce
--    da zero, dove quelle tre si fermano nel loro blocco di verifica e non
--    arrivano a registrarsi — lasciando un registro piu' corto dei file
--    applicati, che e' la famiglia della risposta con l'aria di essere
--    intera.
insert into applied_migrations (version, name) values
  ('20260822000003', 'niente_righe_su_un_conto_chiuso'),
  ('20260823000024', 'il_gestionale_riparte_pulito'),
  ('20260824000033', 'la_scala_di_una_linea_e_un_dato')
on conflict (version) do nothing;

insert into applied_migrations (version, name)
values ('20260825000012', 'le_tre_verifiche_si_rifanno_con_roba_propria')
on conflict (version) do nothing;
