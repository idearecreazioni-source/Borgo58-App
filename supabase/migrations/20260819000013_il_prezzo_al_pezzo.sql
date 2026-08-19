-- =====================================================================
-- IL PREZZO A PEZZO DEL FINGER — blocco 2 del mandato dei finger food
-- 19/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md
--
-- Alessio: *«il prezzo di vendita si riferisce alla composizione, ma serve
-- anche un prezzo sul singolo finger, A PEZZO, per i clienti che se li
-- scelgono per un evento»*.
--
-- 🔴 DOVE STA, E PERCHE' NON E' UN SECONDO PREZZO DELLA STESSA COSA.
-- Deciso da Alessio: sta **sulla ricetta del finger**. L'obiezione posta
-- prima di costruirlo era che i prezzi di vendita vivono gia' in tre posti
-- (`menu_items.selling_price` per la carta, `bar_items.selling_price` per
-- le bevande, `daily_menu_items.price` per il piatto del giorno) e che un
-- quarto e' la premessa di due numeri che si contraddicono.
--
-- La sua risposta, e regge: **non sono due prezzi dello stesso oggetto.** Il
-- prezzo della carta e' di un **piatto**; questo e' di un **bocconcino**.
-- Cose diverse, ognuna col suo, e non si contraddicono perche' non parlano
-- della stessa cosa.
--
-- ⚠️ IL CASO IN CUI SI CONTRADDIREBBERO ESISTE, E SI SCRIVE INVECE DI
-- RISOLVERLO (decisione sua): il giorno in cui **lo stesso finger andasse in
-- carta anche da solo** — cioe' diventasse un `menu_items` per conto suo —
-- ci sarebbero due prezzi per la stessa cosa e servirebbe una regola su
-- quale vince. **Oggi non succede**, e niente lo impedisce. Sta scritto qui,
-- nel commento della colonna e nel mandato, perche' *chi lo scoprira'
-- vendendo non avra' tempo di cercarne la ragione*.
--
-- ⚠️ E IL VUOTO NON E' ZERO: la colonna nasce `null`, che vuol dire «non
-- l'ho ancora deciso» — diverso da 0,00, che vorrebbe dire «lo regalo». E'
-- la regola gia' applicata quattro volte il 16/08 (prezzo di un piatto,
-- porzioni, resa, parametri della previsione).
-- =====================================================================

alter table recipes
  add column if not exists prezzo_al_pezzo numeric(10,2);

-- ⚠️ SOLO SUI FINGER, ed e' il vincolo che impedisce meta' della
-- contraddizione: un prezzo a pezzo su un piatto finito sarebbe un secondo
-- prezzo dello stesso oggetto, quello vero. Su un finger no.
alter table recipes drop constraint if exists prezzo_al_pezzo_solo_sui_finger;
alter table recipes add constraint prezzo_al_pezzo_solo_sui_finger check (
  prezzo_al_pezzo is null or recipe_type = 'finger'
);

alter table recipes drop constraint if exists prezzo_al_pezzo_non_negativo;
alter table recipes add constraint prezzo_al_pezzo_non_negativo check (
  prezzo_al_pezzo is null or prezzo_al_pezzo >= 0
);

comment on column recipes.prezzo_al_pezzo is
  'Quanto costa UN bocconcino venduto singolarmente, per i clienti che compongono una selezione per un evento (19/08/2026). Vuoto = non ancora deciso, che e'' diverso da 0,00. ⚠️ Il giorno in cui lo stesso finger andasse in carta anche da solo ci sarebbero due prezzi per la stessa cosa: oggi non succede, e servira'' una regola su quale vince.';


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_f     uuid;
  v_p     uuid;
  v_ok    boolean;
  v_lap_p integer;
  v_lap_d integer;
  v_letto numeric;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;

  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit)
    values ('__VERIFICA__ prezzo finger', 'antipasto', 1, 'finger', 1, 'pz') returning id into v_f;
  insert into recipes (name, category, portions_yield, recipe_type)
    values ('__VERIFICA__ prezzo piatto', 'secondo', 4, 'piatto_finito') returning id into v_p;

  -- 1 · Un finger puo' avere un prezzo a pezzo, e si rilegge com'e' stato
  --     scritto. ⚠️ Si CONTROLLA il valore riletto e non solo che la
  --     scrittura non dia errore: una colonna che accetta e poi arrotonda
  --     male direbbe un prezzo diverso da quello digitato.
  update recipes set prezzo_al_pezzo = 2.50 where id = v_f;
  select prezzo_al_pezzo into v_letto from recipes where id = v_f;
  if v_letto is distinct from 2.50 then
    raise exception 'Il prezzo a pezzo riletto e'' % invece di 2,50.', coalesce(v_letto::text, 'NULLO');
  end if;

  -- 2 · Il vuoto resta ammesso: «non l'ho ancora deciso» e'' una risposta.
  update recipes set prezzo_al_pezzo = null where id = v_f;
  select prezzo_al_pezzo into v_letto from recipes where id = v_f;
  if v_letto is not null then
    raise exception 'Il prezzo a pezzo non si puo'' piu'' svuotare.';
  end if;

  -- 3 · UN PIATTO FINITO NON PUO' AVERLO: sarebbe un secondo prezzo dello
  --     stesso oggetto, accanto a quello della carta.
  v_ok := false;
  begin
    update recipes set prezzo_al_pezzo = 9.00 where id = v_p;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un piatto finito ha accettato un prezzo a pezzo.';
  end if;

  -- 4 · E nemmeno negativo.
  v_ok := false;
  begin
    update recipes set prezzo_al_pezzo = -1 where id = v_f;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'Un prezzo a pezzo negativo e'' stato accettato.';
  end if;

  -- =========== PULIZIA ===========
  delete from recipes where name like '__VERIFICA__ prezzo %';
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from recipes where name like '__VERIFICA__ prezzo %') then
    raise exception 'La verifica ha lasciato delle ricette finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il prezzo a pezzo sta sui finger e su nessun altro, e il vuoto resta vuoto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000013', 'il_prezzo_al_pezzo')
on conflict (version) do nothing;
