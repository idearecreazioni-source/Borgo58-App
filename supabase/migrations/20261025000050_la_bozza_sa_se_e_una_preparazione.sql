-- =====================================================================
-- LA BOZZA SA SE È UN PIATTO, UNA PREPARAZIONE O UN FINGER — 25/10/2026
-- =====================================================================
-- Trovato da Alessio provando la «Crema al burro meringata»: fra le scelte
-- della bozza mancavano «Preparazione» e «Finger». Non sono CATEGORIE —
-- nel Ricettario la categoria è la parte del menu (antipasto, primo,
-- secondo, dolce) e il TIPO è un'altra domanda (`recipes.recipe_type`):
-- una crema al burro è una preparazione di categoria dolce. Metterle fra
-- le categorie avrebbe mescolato le due cose, e la promozione avrebbe
-- creato sempre un piatto finito.
--
-- ⚠️ IL TIPO VUOLE LA RESA. Una preparazione e un finger entrano dentro
--    altre ricette e il Ricettario li costa per unità di resa
--    (`componente_richiede_resa`): senza resa costo e merce da scaricare
--    diventerebbero vuoti. Quindi la bozza di una preparazione pretende la
--    resa invece delle porzioni, e la promozione lo dice come ogni altro
--    buco.
--
-- ⚠️ IL PREDEFINITO È UNA RISPOSTA VERA, non una comoda: fino a oggi ogni
--    bozza diventava un piatto finito (la promozione lo scriveva fisso),
--    quindi «piatto_finito» sulle bozze esistenti descrive quello che
--    sarebbe successo comunque. Chi ha una bozza che è una preparazione lo
--    cambia dalla scheda.
-- =====================================================================

alter table bozze_ricetta add column if not exists tipo text not null default 'piatto_finito';
alter table bozze_ricetta add column if not exists resa_quantita numeric;
alter table bozze_ricetta add column if not exists resa_unita unit_type;

alter table bozze_ricetta drop constraint if exists bozza_ricetta_tipo_noto;
alter table bozze_ricetta add constraint bozza_ricetta_tipo_noto check (
  tipo in ('piatto_finito', 'preparazione', 'finger'));
alter table bozze_ricetta drop constraint if exists bozza_ricetta_resa_sensata;
alter table bozze_ricetta add constraint bozza_ricetta_resa_sensata check (
  resa_quantita is null or resa_quantita > 0);

comment on column bozze_ricetta.tipo is
  'Che cosa diventera'': un piatto finito, una preparazione (semilavorato) o un finger. E'' il recipe_type della ricetta che nascera''; la categoria resta un''altra domanda.';
comment on column bozze_ricetta.resa_quantita is
  'Per preparazioni e finger: quanto ne viene da una dose. Vuota finche'' non la scrive nessuno; sui piatti finiti non si usa.';
comment on column bozze_ricetta.resa_unita is
  'L''unita'' della resa (kg, l, pz…). Sui piatti finiti non si usa.';
comment on constraint bozza_ricetta_tipo_noto on bozze_ricetta is
  'Una bozza diventa un piatto finito, una preparazione o un finger: nient''altro.';
comment on constraint bozza_ricetta_resa_sensata on bozze_ricetta is
  'La resa o non si sa ancora (vuota) o e'' maggiore di zero.';

create or replace function promuovi_bozza_ricetta(
  p_bozza_id uuid,
  p_esito    text,
  p_gesto    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_bozza   bozze_ricetta%rowtype;
  v_buchi   text[] := '{}';
  v_riga    record;
  v_ricetta uuid;
  v_numero  integer := 0;
  v_unita   unit_type;
begin
  if not is_titolare() then
    raise exception 'Confermare una bozza di ricetta e'' riservato al titolare.';
  end if;
  if p_gesto is null then
    raise exception 'Manca l''identificativo del gesto di conferma: senza, un doppio tocco potrebbe creare due ricette.';
  end if;

  select * into v_bozza from bozze_ricetta where id = p_bozza_id for update;
  if not found then
    raise exception 'Questa bozza non esiste piu''.';
  end if;

  -- Gia' diventata ricetta: lo STESSO gesto ripetuto riceve la stessa
  -- risposta (doppio tocco), un gesto nuovo viene rifiutato.
  if v_bozza.promossa_il is not null then
    if v_bozza.gesto_promozione = p_gesto then
      return jsonb_build_object('esito', 'ricetta', 'ricetta_id', v_bozza.ricetta_id, 'gia_fatto', true);
    end if;
    raise exception 'Questa bozza e'' gia'' diventata ricetta il %: non se ne crea una seconda.',
      to_char(v_bozza.promossa_il at time zone 'Europe/Rome', 'DD/MM/YYYY');
  end if;

  if v_bozza.stato = 'scartata' then
    raise exception 'Questa bozza e'' stata scartata: riaprila, se vuoi confermarla.';
  end if;

  if p_esito = 'ispirazione' then
    if v_bozza.stato = 'ispirazione' then
      return jsonb_build_object('esito', 'ispirazione', 'ricetta_id', null, 'gia_fatto', true);
    end if;
    update bozze_ricetta set stato = 'ispirazione' where id = p_bozza_id;
    return jsonb_build_object('esito', 'ispirazione', 'ricetta_id', null, 'gia_fatto', false);
  elsif p_esito is distinct from 'ricetta' then
    raise exception 'Una bozza si conferma come ispirazione o come ricetta.';
  end if;

  -- ---- i buchi, tutti ----
  if v_bozza.categoria is null then
    v_buchi := v_buchi || 'manca la categoria'::text;
  elsif v_bozza.categoria = 'finger_food' then
    v_buchi := v_buchi || 'i finger si creano dal Ricettario: questa bozza non puo'' diventarne uno'::text;
  end if;
  -- 🔴 25/10/2026: il TIPO decide cosa si pretende. Un piatto vuole le
  --    porzioni; una preparazione e un finger vogliono la RESA, perche' il
  --    Ricettario li costa per unita' di resa quando entrano in un'altra
  --    ricetta (`componente_richiede_resa`), e le porzioni non servono.
  if v_bozza.tipo = 'piatto_finito' then
    if v_bozza.porzioni is null then
      v_buchi := v_buchi || 'mancano le porzioni'::text;
    end if;
  elsif v_bozza.resa_quantita is null or v_bozza.resa_unita is null then
    v_buchi := v_buchi || format('manca la resa (quanto ne viene da una dose di questa %s)',
      case v_bozza.tipo when 'finger' then 'ricetta di finger' else 'preparazione' end);
  end if;
  if cardinality(v_bozza.buchi_dichiarati) > 0 then
    v_buchi := v_buchi || ('segnalazioni ancora aperte: ' || array_to_string(v_bozza.buchi_dichiarati, '; '));
  end if;
  if not exists (select 1 from bozze_ricetta_ingredienti where bozza_id = p_bozza_id) then
    v_buchi := v_buchi || 'nessun ingrediente'::text;
  end if;

  for v_riga in
    select * from bozze_ricetta_ingredienti where bozza_id = p_bozza_id order by posizione, id
  loop
    -- 🔴 25/10/2026: un ingrediente NON collegato non e' piu' un buco.
    --    Entra nella ricetta com'e' scritto, fra quelli da collegare, e il
    --    collegamento diventa obbligatorio solo dove serve davvero: pronta
    --    per la carta, in un menu, usata come preparazione. Quantita' e
    --    unita' si pretendono solo sulle righe collegate, perche' sono le
    --    sole che entrano nel costo; le altre si correggono al collegamento.
    continue when v_riga.ingredient_id is null;
    if v_riga.quantita is null then
      v_buchi := v_buchi || format('«%s»: quantita'' mancante', v_riga.nome);
    end if;
    if v_riga.unita is null or btrim(v_riga.unita) = '' then
      v_buchi := v_buchi || format('«%s»: unita'' mancante', v_riga.nome);
    elsif not exists (select 1 from unnest(enum_range(null::unit_type)) u where u::text = v_riga.unita) then
      v_buchi := v_buchi || format('«%s»: unita'' non compresa («%s»)', v_riga.nome, v_riga.unita);
    end if;
  end loop;

  for v_riga in
    select * from bozze_ricetta_passaggi where bozza_id = p_bozza_id order by posizione, id
  loop
    v_numero := v_numero + 1;
    if v_riga.fase is null then
      v_buchi := v_buchi || format('passaggio %s: manca la fase', v_numero);
    end if;
    if v_riga.descrizione is null or btrim(v_riga.descrizione) = '' then
      v_buchi := v_buchi || format('passaggio %s: manca la descrizione', v_numero);
    end if;
  end loop;

  if cardinality(v_buchi) > 0 then
    raise exception 'Questa bozza ha ancora dei buchi, e non diventa ricetta: %.',
      array_to_string(v_buchi, ' · ');
  end if;

  -- ---- tutto insieme ----
  insert into recipes (name, category, portions_yield, recipe_type, yield_quantity, yield_unit, notes)
  values (btrim(v_bozza.titolo), v_bozza.categoria,
          case when v_bozza.tipo = 'piatto_finito' then v_bozza.porzioni else 1 end,
          v_bozza.tipo::recipe_type,
          case when v_bozza.tipo = 'piatto_finito' then null else v_bozza.resa_quantita end,
          case when v_bozza.tipo = 'piatto_finito' then null else v_bozza.resa_unita end,
          v_bozza.sunto)
  returning id into v_ricetta;

  for v_riga in
    select * from bozze_ricetta_ingredienti where bozza_id = p_bozza_id order by posizione, id
  loop
    if v_riga.ingredient_id is null then
      insert into ricetta_ingredienti_da_collegare (recipe_id, posizione, nome, quantita, unita, nota)
      values (v_ricetta, v_riga.posizione, btrim(v_riga.nome), v_riga.quantita,
              nullif(btrim(v_riga.unita), ''), v_riga.nota);
    else
      v_unita := v_riga.unita::unit_type;
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, prep_note)
      values (v_ricetta, v_riga.ingredient_id, v_riga.quantita, v_unita, v_riga.nota);
    end if;
  end loop;

  v_numero := 0;
  for v_riga in
    select * from bozze_ricetta_passaggi where bozza_id = p_bozza_id order by posizione, id
  loop
    v_numero := v_numero + 1;
    insert into recipe_steps (recipe_id, step_number, phase, description)
    values (v_ricetta, v_numero, v_riga.fase, btrim(v_riga.descrizione));
  end loop;

  update bozze_ricetta
     set promossa_il = now(), ricetta_id = v_ricetta, gesto_promozione = p_gesto
   where id = p_bozza_id;

  return jsonb_build_object('esito', 'ricetta', 'ricetta_id', v_ricetta, 'gia_fatto', false);
end
$funzione$;
comment on function promuovi_bozza_ricetta(uuid, text, uuid) is
  'La conferma del titolare su una bozza: come ispirazione (nessuna ricetta) o come ricetta (ricetta + ingredienti + passaggi in una transazione). Il tipo della ricetta viene dalla bozza: un piatto pretende le porzioni, una preparazione o un finger la resa. Un ingrediente non collegato non blocca: entra fra quelli da collegare. Rifiuta gli altri buchi nominandoli tutti, non crea mai prodotti, rifiuta le bozze scartate o gia'' promosse; lo stesso gesto ripetuto riceve la stessa ricetta. Solo titolare, e solo attraverso il corridoio.';

revoke all on function promuovi_bozza_ricetta(uuid, text, uuid) from public, anon, authenticated;
grant execute on function promuovi_bozza_ricetta(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- LA VERIFICA, dentro una sotto-transazione che si annulla.
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_bozza    uuid;
  v_ricetta  uuid;
  v_r        jsonb;
  v_msg      text;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  if has_function_privilege('anon', 'promuovi_bozza_ricetta(uuid, text, uuid)', 'execute') then
    raise exception 'La promozione delle bozze e'' eseguibile con la chiave pubblica.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Una preparazione SENZA resa non diventa ricetta, e lo dice;
    --     le porzioni vuote invece non sono un buco.
    insert into bozze_ricetta (titolo, categoria, porzioni, tipo)
    values ('ZZ verifica tipo - crema', 'dolce', null, 'preparazione') returning id into v_bozza;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome)
    values (v_bozza, 1, 'ZZ burro');
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%manca la resa%preparazione%' or v_msg like '%porzioni%' then
      raise exception 'Una preparazione senza resa: %', coalesce(v_msg, 'nessun errore');
    end if;

    -- (2) Con la resa diventa una PREPARAZIONE con la sua resa.
    update bozze_ricetta set resa_quantita = 0.8, resa_unita = 'kg' where id = v_bozza;
    v_r := promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    v_ricetta := (v_r ->> 'ricetta_id')::uuid;
    if not exists (select 1 from recipes where id = v_ricetta and recipe_type = 'preparazione'
                     and yield_quantity = 0.8 and yield_unit = 'kg' and portions_yield = 1
                     and category = 'dolce') then
      raise exception 'La preparazione non e'' nata come preparazione con la sua resa: %', v_r;
    end if;

    -- (3) Un finger diventa un finger.
    insert into bozze_ricetta (titolo, categoria, tipo, resa_quantita, resa_unita)
    values ('ZZ verifica tipo - bocconcino', 'antipasto', 'finger', 12, 'pz') returning id into v_bozza;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome) values (v_bozza, 1, 'ZZ tonno');
    v_r := promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    if not exists (select 1 from recipes where id = (v_r ->> 'ricetta_id')::uuid
                     and recipe_type = 'finger' and yield_quantity = 12 and yield_unit = 'pz') then
      raise exception 'Il finger non e'' nato come finger: %', v_r;
    end if;

    -- (4) Un piatto continua a pretendere le porzioni, e la resa non conta.
    insert into bozze_ricetta (titolo, categoria, resa_quantita, resa_unita)
    values ('ZZ verifica tipo - piatto', 'primo', 3, 'kg') returning id into v_bozza;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome) values (v_bozza, 1, 'ZZ pasta');
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%mancano le porzioni%' then
      raise exception 'Un piatto senza porzioni: %', coalesce(v_msg, 'nessun errore');
    end if;
    update bozze_ricetta set porzioni = 4 where id = v_bozza;
    v_r := promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    if not exists (select 1 from recipes where id = (v_r ->> 'ricetta_id')::uuid
                     and recipe_type = 'piatto_finito' and portions_yield = 4
                     and yield_quantity is null) then
      raise exception 'Il piatto non e'' nato come piatto finito: %', v_r;
    end if;

    -- (5) Il vincolo sul tipo.
    v_respinto := false;
    begin
      insert into bozze_ricetta (titolo, tipo) values ('ZZ verifica tipo - strano', 'selezione');
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'Una bozza ha accettato un tipo che non esiste.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del tipo delle bozze');

  raise notice 'Fatto: una bozza diventa piatto, preparazione o finger; la preparazione e il finger pretendono la resa. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000050', 'la_bozza_sa_se_e_una_preparazione')
on conflict (version) do nothing;
