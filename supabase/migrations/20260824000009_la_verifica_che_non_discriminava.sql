-- =====================================================================
-- LA VERIFICA CHE NON DISCRIMINAVA IL VINCOLO CHE DOVEVA PROVARE
-- 24/08/2026 — correzione della 20260824000008, aggiunta e non riscritta
-- =====================================================================
-- 🔴 TROVATO ROMPENDO, non rileggendo — ed e' il metodo che Alessio ha
-- chiesto per queste reti: *«Provale ROMPENDO: scrivi il valore assurdo e
-- verifica che venga respinto o segnalato.»*
--
-- Ho allargato apposta il limite nuovo da `food_cost_percento <= 1` a
-- `<= 100`, cioe' l'ho reso inutile, e ho riapplicato la migrazione: **la
-- verifica e' rimasta verde**. Provava un vincolo che non c'era piu'.
--
-- ⚠️ PERCHE'. Il valore assurdo che provava era `food_cost_percento = 25`,
-- e su quello scenario interviene **un altro vincolo, gia' esistente dal
-- 15/08**: `scenario_scontrino_sopra_il_costo`, che pretende
--   (scontrino_food + scontrino_beverage)
--     - (scontrino_food * food_cost + scontrino_beverage * beverage_cost
--        + lavanderia) > 0
-- Con 40 e 10 di scontrino, un food cost di 25 rende quel calcolo
-- **negativo di 953 euro**, quindi la riga veniva respinta comunque —
-- dal vincolo vecchio, non da quello nuovo.
--
-- 🔴 E' la trappola del CASO VUOTO in una forma nuova: non «non c'era
-- niente da fare», ma **«c'era gia' qualcun altro che lo faceva»**. La
-- prova non era falsa: misurava una coincidenza invece di una differenza.
--
-- ---------------------------------------------------------------------
-- IL VALORE CHE DISCRIMINA, E COME SI TROVA
-- ---------------------------------------------------------------------
-- Serve un numero che violi **solo** il vincolo nuovo. Il vincolo vecchio
-- lascia passare tutto cio' che tiene il margine positivo:
--   50 - (40 * fc + 3) > 0   →   fc < 1,175
-- Quindi **1,1** sta dentro il vecchio e fuori dal nuovo: e' l'unico
-- intervallo in cui i due si distinguono, ed e' li' che va messa la prova.
--
-- ⚠️ La regola generale, perche' tornera': prima di scegliere il valore
-- di una prova, **si guarda quali ALTRI vincoli esistono gia' su quella
-- riga**. Un valore abbastanza assurdo li viola tutti insieme, e allora
-- la prova non dice quale dei due l'ha fermato.
--
-- ⚠️ E la 008 non si riscrive (regola di Alessio, 23/08): quel file
-- racconta cosa e' successo ieri, verifica insufficiente compresa.
-- =====================================================================

do $verifica$
declare
  v_titolare uuid;
  v_ente     uuid;
  v_scen     uuid;
  v_respinto boolean;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;

  insert into scenari_proiezione (
    entity_id, nome, tipo, anno,
    scontrino_food, scontrino_beverage, food_cost_percento, beverage_cost_percento
  ) values (v_ente, 'VERIFICA 829 discrimina', 'riproiezione', 2099, 40, 10, 0.25, 0.30)
  returning id into v_scen;

  -- (a) 1,1 viola SOLO il limite nuovo: il margine resta positivo
  --     (50 - 47 = 3), quindi il vincolo del 15/08 non c'entra.
  v_respinto := false;
  begin
    update scenari_proiezione set food_cost_percento = 1.1 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    update scenari_proiezione set food_cost_percento = 0.25 where id = v_scen;
    delete from scenari_proiezione where id = v_scen;
    raise exception 'Un food cost di 1,1 (110%%) e'' stato accettato: il limite delle frazioni non morde.';
  end if;

  -- (b) Il verso opposto, e conta quanto il primo: **un limite che
  --     rifiuta anche i casi buoni e' peggio di nessun limite**. Un food
  --     cost dell'80% e' un piatto che guadagna pochissimo — strano, non
  --     impossibile — e deve passare.
  update scenari_proiezione set food_cost_percento = 0.80 where id = v_scen;
  if (select food_cost_percento from scenari_proiezione where id = v_scen) <> 0.80 then
    raise exception 'Un food cost dell''80%% doveva passare e non e'' stato scritto.';
  end if;
  update scenari_proiezione set food_cost_percento = 0.25 where id = v_scen;

  -- (c) Stessa cosa sulla commissione POS, dove nessun altro vincolo
  --     interviene: 1,5 (cioe' 150%) fuori, 0,05 (5%, carissima ma vera)
  --     dentro.
  v_respinto := false;
  begin
    update scenari_proiezione set commissione_pos_percento = 1.5 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    delete from scenari_proiezione where id = v_scen;
    raise exception 'Una commissione POS del 150%% e'' stata accettata.';
  end if;
  update scenari_proiezione set commissione_pos_percento = 0.05 where id = v_scen;

  -- (d) E il caso al bordo: esattamente 1 deve passare — il 100%% di
  --     pagamenti elettronici e' un locale che non prende contanti, che
  --     esiste.
  update scenari_proiezione set pagamenti_elettronici_percento = 1 where id = v_scen;
  if (select pagamenti_elettronici_percento from scenari_proiezione where id = v_scen) <> 1 then
    raise exception 'Il 100%% di pagamenti elettronici doveva passare.';
  end if;

  delete from scenari_proiezione where id = v_scen;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'I limiti delle frazioni discriminano davvero: provati con valori che solo loro respingono.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000009', 'la_verifica_che_non_discriminava') on conflict (version) do nothing;
