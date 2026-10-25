-- =====================================================================
-- LE RICETTE SI CATALOGANO SENZA IL MAGAZZINO (25/10/2026)
-- =====================================================================
-- Richiesta di Alessio, con le sue parole: *«vorrei poter già catalogare
-- tutte le mie ricette fin d'ora, quindi vorrei che l'associazione
-- avvenisse solo quando si dovrà calcolare il food cost e mettere
-- effettivamente una ricetta tra le preparazioni e/o in menu»*.
--
-- Com'era: una bozza diventava ricetta solo se OGNI ingrediente era
-- collegato a un prodotto del magazzino. Misurato in produzione il
-- 25/10/2026: zero prodotti in anagrafica, quindi nessuna bozza poteva
-- uscire dalle bozze — il Ricettario era chiuso a chiave finché non si
-- comprava qualcosa.
--
-- Come diventa:
--   1. Una bozza diventa ricetta anche con ingredienti NON collegati.
--      Quelli collegati vanno in `recipe_ingredients` come prima; gli
--      altri in una tabella nuova, `ricetta_ingredienti_da_collegare`,
--      scritti come li ha scritti chi ha proposto la bozza.
--   2. Il collegamento si fa dopo, sulla ricetta, da un gesto solo
--      (`collega_ingrediente_ricetta`, dal corridoio: due tabelle).
--   3. Il collegamento diventa OBBLIGATORIO in tre punti, e solo lì, con
--      un rifiuto che nomina tutti gli ingredienti mancanti:
--        - segnare la ricetta «pronta per la carta»;
--        - metterla in un menu;
--        - usarla come preparazione dentro un'altra ricetta.
--
-- ⚠️ PERCHÉ UNA TABELLA A PARTE E NON UNA RIGA SENZA PRODOTTO DENTRO
--    `recipe_ingredients`: quella tabella la leggono 19 funzioni e 4 viste
--    (misurato il 25/10 dal catalogo di produzione) — costo, scarico del
--    magazzino, allergeni, estrapola, duplica… Una riga «né prodotto né
--    preparazione» avrebbe chiesto di insegnarla a tutte e ventitré, e
--    quella dimenticata avrebbe sbagliato in silenzio. Con la tabella a
--    parte nessuna di loro cambia: vedono la ricetta com'è collegata.
--
-- ⚠️ IL PREZZO, DICHIARATO: il costo e gli allergeni di una ricetta con
--    ingredienti da collegare sono PARZIALI. Il database non inventa niente
--    (le righe non collegate non hanno né prezzo né allergeni), e le
--    schermate lo DICONO invece di mostrare un numero che sembra intero.
--    I tre punti chiusi qui sotto sono quelli dove un numero parziale
--    diventerebbe una promessa: la carta, il menu, il costo di un'altra
--    ricetta.
--
-- ⚠️ ESTRAPOLA e DUPLICA, le due funzioni che leggono una ricetta per
--    intero, imparano la tabella nuova: senza, una ricetta catalogata
--    sparirebbe dalla lista della spesa proposta, e una copia perderebbe
--    gli ingredienti non collegati. Corpi ripresi dall'ultima definizione
--    viva (produzione al 25/10/2026, ultima migrazione 20261025000001,
--    identica ai file 20261011000001 e 20260922000001).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA TABELLA
-- ---------------------------------------------------------------------
create table if not exists ricetta_ingredienti_da_collegare (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references recipes(id) on delete cascade,
  posizione   integer not null default 0,
  nome        text not null,
  quantita    numeric(12,4),
  unita       text,
  nota        text,
  created_at  timestamptz not null default now(),
  constraint da_collegare_nome_scritto check (length(btrim(nome)) > 0),
  constraint da_collegare_quantita_sensata check (quantita is null or quantita > 0)
);

create index if not exists ricetta_ingredienti_da_collegare_ricetta_idx
  on ricetta_ingredienti_da_collegare (recipe_id, posizione);

comment on table ricetta_ingredienti_da_collegare is
  'Gli ingredienti di una ricetta NON ancora collegati a un prodotto del magazzino, scritti come li ha scritti chi l''ha proposta. Non entrano nel costo ne'' negli allergeni: la ricetta li dichiara. Il collegamento e'' obbligatorio per segnarla pronta per la carta, metterla in un menu o usarla come preparazione (25/10/2026).';
comment on column ricetta_ingredienti_da_collegare.unita is
  'Testo libero, come scritto («g», «cucchiaio»): diventa un''unita'' del gestionale solo al collegamento.';
comment on constraint da_collegare_nome_scritto on ricetta_ingredienti_da_collegare is
  'Un ingrediente da collegare ha almeno un nome.';
comment on constraint da_collegare_quantita_sensata on ricetta_ingredienti_da_collegare is
  'La quantita'' o non si sa ancora (vuota) o e'' maggiore di zero. Zero non vuol dire «non lo so».';

alter table ricetta_ingredienti_da_collegare enable row level security;

-- Stessa forma di recipe_ingredients: si legge da tutti quelli che entrano
-- (la ricetta in cucina deve dire cosa c'è dentro), si scrive dal titolare.
drop policy if exists da_collegare_select on ricetta_ingredienti_da_collegare;
create policy da_collegare_select on ricetta_ingredienti_da_collegare
  for select to authenticated using (true);
drop policy if exists da_collegare_ins_titolare on ricetta_ingredienti_da_collegare;
create policy da_collegare_ins_titolare on ricetta_ingredienti_da_collegare
  for insert to authenticated with check ((select is_titolare()));
drop policy if exists da_collegare_upd_titolare on ricetta_ingredienti_da_collegare;
create policy da_collegare_upd_titolare on ricetta_ingredienti_da_collegare
  for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
drop policy if exists da_collegare_del_titolare on ricetta_ingredienti_da_collegare;
create policy da_collegare_del_titolare on ricetta_ingredienti_da_collegare
  for delete to authenticated using ((select is_titolare()));

revoke all on table ricetta_ingredienti_da_collegare from anon;

-- Il registro delle cancellazioni: fuori, come recipe_ingredients.
insert into perimetro_registro (tabella, dentro, ragione) values
  ('ricetta_ingredienti_da_collegare', false,
   'Parte di una ricetta, come recipe_ingredients: il sapere del locale, non un fatto economico. Fuori dal 25/10/2026.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 2. I TRE PUNTI DOVE IL COLLEGAMENTO E' OBBLIGATORIO
-- ---------------------------------------------------------------------
-- ⚠️ Ogni rifiuto NOMINA TUTTI gli ingredienti da collegare (regola del
--    16/08: dirne uno per volta fa scoprire il secondo dopo il primo), e
--    dice dove si fa il gesto.
-- ⚠️ Il controllo e' scritto dentro ogni funzione e non in un aiuto
--    comune: un aiuto chiamato da un trigger vorrebbe il permesso di
--    esecuzione per chi scrive, e questo progetto le funzioni non le
--    lascia aperte (§8).

create or replace function vieta_pronta_con_ingredienti_da_collegare()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nomi text;
begin
  if new.pronta_per_carta and not coalesce(old.pronta_per_carta, false) then
    select string_agg('«' || nome || '»', ', ' order by posizione, nome) into v_nomi
      from ricetta_ingredienti_da_collegare where recipe_id = new.id;
    if v_nomi is not null then
      raise exception 'Per segnarla pronta per la carta, collega prima al magazzino questi ingredienti: %. Si fa dalla ricetta, sezione «Da collegare».', v_nomi;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_pronta_con_ingredienti_da_collegare on recipes;
create trigger trg_pronta_con_ingredienti_da_collegare
  before update on recipes
  for each row execute function vieta_pronta_con_ingredienti_da_collegare();

create or replace function vieta_menu_con_ingredienti_da_collegare()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nomi text;
begin
  select string_agg('«' || nome || '»', ', ' order by posizione, nome) into v_nomi
    from ricetta_ingredienti_da_collegare where recipe_id = new.recipe_id;
  if v_nomi is not null then
    raise exception 'Per metterla in un menu, collega prima al magazzino questi ingredienti: %. Si fa dalla ricetta, sezione «Da collegare».', v_nomi;
  end if;
  return new;
end $$;

drop trigger if exists trg_menu_con_ingredienti_da_collegare on menu_items;
create trigger trg_menu_con_ingredienti_da_collegare
  before insert or update on menu_items
  for each row execute function vieta_menu_con_ingredienti_da_collegare();

create or replace function vieta_preparazione_con_ingredienti_da_collegare()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nomi text;
begin
  if new.component_recipe_id is not null then
    select string_agg('«' || nome || '»', ', ' order by posizione, nome) into v_nomi
      from ricetta_ingredienti_da_collegare where recipe_id = new.component_recipe_id;
    if v_nomi is not null then
      raise exception 'Per usarla come preparazione, collega prima al magazzino questi ingredienti: %. Si fa dalla ricetta, sezione «Da collegare».', v_nomi;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_preparazione_con_ingredienti_da_collegare on recipe_ingredients;
create trigger trg_preparazione_con_ingredienti_da_collegare
  before insert or update on recipe_ingredients
  for each row execute function vieta_preparazione_con_ingredienti_da_collegare();

-- E allo specchio: a una ricetta che è già in uno di quei tre posti non si
-- aggiunge un ingrediente non collegato — le farebbe perdere il costo
-- proprio dove il costo conta.
create or replace function vieta_da_collegare_su_ricetta_in_uso()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from recipes where id = new.recipe_id and pronta_per_carta)
     or exists (select 1 from menu_items where recipe_id = new.recipe_id)
     or exists (select 1 from recipe_ingredients where component_recipe_id = new.recipe_id) then
    raise exception 'Questa ricetta e'' gia'' pronta per la carta, in un menu o usata come preparazione: un ingrediente va collegato al magazzino subito, non lasciato da collegare.';
  end if;
  return new;
end $$;

drop trigger if exists trg_da_collegare_su_ricetta_in_uso on ricetta_ingredienti_da_collegare;
create trigger trg_da_collegare_su_ricetta_in_uso
  before insert or update on ricetta_ingredienti_da_collegare
  for each row execute function vieta_da_collegare_su_ricetta_in_uso();

revoke all on function vieta_pronta_con_ingredienti_da_collegare() from public, anon, authenticated;
revoke all on function vieta_menu_con_ingredienti_da_collegare() from public, anon, authenticated;
revoke all on function vieta_preparazione_con_ingredienti_da_collegare() from public, anon, authenticated;
revoke all on function vieta_da_collegare_su_ricetta_in_uso() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. IL COLLEGAMENTO: un gesto, due tabelle → dal corridoio (regola B4)
-- ---------------------------------------------------------------------
-- La riga da collegare diventa una riga vera della ricetta, con la sua
-- quantita' e la sua unita', e sparisce dalle «da collegare». A meta'
-- sarebbe lo stesso ingrediente contato due volte, o sparito.
-- ⚠️ Non indovina niente: se la quantita' manca o l'unita' non e' una del
--    gestionale lo dice, e la si corregge sulla riga prima di collegarla.
create or replace function collega_ingrediente_ricetta(
  p_riga          uuid,
  p_ingredient_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga  ricetta_ingredienti_da_collegare%rowtype;
  v_nuova uuid;
begin
  if not is_titolare() then
    raise exception 'Collegare gli ingredienti di una ricetta e'' riservato al titolare.';
  end if;
  select * into v_riga from ricetta_ingredienti_da_collegare where id = p_riga for update;
  if not found then
    raise exception 'Questo ingrediente non e'' piu'' da collegare: forse l''hai gia'' collegato o tolto.';
  end if;
  if p_ingredient_id is null or not exists (select 1 from ingredients where id = p_ingredient_id) then
    raise exception 'Scegli un prodotto del magazzino a cui collegare «%».', v_riga.nome;
  end if;
  if v_riga.quantita is null then
    raise exception 'Per collegare «%» scrivi prima la quantita''.', v_riga.nome;
  end if;
  if v_riga.unita is null
     or not exists (select 1 from unnest(enum_range(null::unit_type)) u where u::text = v_riga.unita) then
    raise exception 'Per collegare «%» scegli prima un''unita'' del gestionale (ora e'' «%»).',
      v_riga.nome, coalesce(v_riga.unita, 'vuota');
  end if;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, prep_note)
  values (v_riga.recipe_id, p_ingredient_id, v_riga.quantita, v_riga.unita::unit_type, v_riga.nota)
  returning id into v_nuova;
  delete from ricetta_ingredienti_da_collegare where id = p_riga;

  return jsonb_build_object(
    'riga_id', v_nuova,
    'ancora_da_collegare',
    (select count(*) from ricetta_ingredienti_da_collegare where recipe_id = v_riga.recipe_id)
  );
end $$;

comment on function collega_ingrediente_ricetta(uuid, uuid) is
  'Collega un ingrediente scritto di una ricetta a un prodotto del magazzino: la riga entra in recipe_ingredients con la sua quantita'' e la sua unita'' e lascia le «da collegare», in una transazione. Rifiuta se manca la quantita'' o l''unita'' non e'' del gestionale. Solo titolare, solo dal corridoio.';

revoke all on function collega_ingrediente_ricetta(uuid, uuid) from public, anon, authenticated;
grant execute on function collega_ingrediente_ricetta(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. LA PROMOZIONE DI UNA BOZZA: «non collegato» non e' piu' un buco
-- ---------------------------------------------------------------------
-- Corpo ripreso dalla 20261010000001 (l'ultima che la definisce, identica
-- in produzione al 25/10/2026). Cambiano due punti, segnati dentro.
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
  if v_bozza.porzioni is null then
    v_buchi := v_buchi || 'mancano le porzioni'::text;
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
  insert into recipes (name, category, portions_yield, recipe_type, notes)
  values (btrim(v_bozza.titolo), v_bozza.categoria, v_bozza.porzioni, 'piatto_finito', v_bozza.sunto)
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
  'La conferma del titolare su una bozza: come ispirazione (nessuna ricetta) o come ricetta (ricetta + ingredienti + passaggi in una transazione). Dal 25/10/2026 un ingrediente non collegato non blocca: entra fra quelli da collegare. Rifiuta gli altri buchi nominandoli tutti, non crea mai prodotti, rifiuta le bozze scartate o gia'' promosse; lo stesso gesto ripetuto riceve la stessa ricetta. Solo titolare, e solo attraverso il corridoio.';

revoke all on function promuovi_bozza_ricetta(uuid, text, uuid) from public, anon, authenticated;
grant execute on function promuovi_bozza_ricetta(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ESTRAPOLA impara le righe da collegare
-- ---------------------------------------------------------------------
create or replace function estrapola_ricette(p_scelte jsonb)
returns table (
  chiave       text,
  ingredient_id uuid,
  nome         text,
  unita        text,
  quantita     numeric,
  da           text[],
  problema     text,
  gia_in_lista numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_titolare() then
    raise exception 'Estrapolare dalle ricette è riservato al titolare.';
  end if;
  if p_scelte is null or jsonb_typeof(p_scelte) <> 'array' or jsonb_array_length(p_scelte) = 0 then
    raise exception 'Scegli almeno una ricetta.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_scelte) e
     where coalesce(nullif(e->>'porzioni', '')::numeric, 0) <= 0
  ) then
    raise exception 'Per ogni ricetta scelta serve un numero di porzioni maggiore di zero.';
  end if;

  return query
  with scelte as (
    select e->>'tipo' as tipo, (e->>'id')::uuid as id, (e->>'porzioni')::numeric as porzioni
      from jsonb_array_elements(p_scelte) e
  ),
  ric as (
    select s.id, s.porzioni, r.name as titolo, r.portions_yield as resa
      from scelte s join recipes r on r.id = s.id
     where s.tipo = 'ricetta'
  ),
  bz as (
    select s.id, s.porzioni, b.titolo, b.porzioni as resa
      from scelte s join bozze_ricetta b on b.id = s.id
     where s.tipo = 'bozza'
  ),
  righe as (
    -- Le ricette del locale: la stessa esplosione dello scarico vero.
    select f.ingredient_id, i.name::text as nome, i.unit::text as unita,
           f.quantita::numeric as quantita, r.titolo as fonte, null::text as problema
      from ric r
      cross join lateral fabbisogno_preparazione(r.id, r.porzioni / nullif(r.resa, 0)) f
      join ingredients i on i.id = f.ingredient_id
     where coalesce(r.resa, 0) > 0
    union all
    -- Le bozze: la quantità scritta, riportata alle porzioni chieste.
    select bi.ingredient_id,
           coalesce(i.name, btrim(bi.nome))::text,
           nullif(btrim(bi.unita), ''),
           case when bi.quantita is null or coalesce(b.resa, 0) <= 0 then null
                else bi.quantita * b.porzioni / b.resa end,
           b.titolo,
           concat_ws('; ',
             case when bi.ingredient_id is null then 'non collegato al magazzino' end,
             case when bi.quantita is null then 'quantità non indicata' end,
             case when bi.quantita is not null and coalesce(b.resa, 0) <= 0
                  then 'la bozza non dice per quante porzioni è' end,
             case when bi.ingredient_id is not null and bi.unita is not null
                       and bi.unita <> i.unit::text
                  then 'unità diversa da quella del magazzino (' || i.unit::text || ')' end)
      from bz b
      join bozze_ricetta_ingredienti bi on bi.bozza_id = b.id
      left join ingredients i on i.id = bi.ingredient_id
    union all
    -- 🔴 25/10/2026: le righe di una ricetta NON ANCORA COLLEGATE al
    --    magazzino. Senza, una ricetta catalogata da una bozza sparirebbe
    --    da qui, o direbbe «non ha ancora ingredienti» pur avendone.
    --    Stessa forma delle righe di bozza: per nome, e lo dice.
    select null::uuid,
           btrim(dc.nome)::text,
           nullif(btrim(dc.unita), ''),
           case when dc.quantita is null or coalesce(r.resa, 0) <= 0 then null
                else dc.quantita * r.porzioni / r.resa end,
           r.titolo,
           concat_ws('; ',
             'non collegato al magazzino',
             case when dc.quantita is null then 'quantità non indicata' end)
      from ric r
      join ricetta_ingredienti_da_collegare dc on dc.recipe_id = r.id
     where coalesce(r.resa, 0) > 0
  ),
  insieme as (
    select coalesce(r.ingredient_id::text, 'nome:' || lower(r.nome)) || '|' || coalesce(r.unita, '') as k,
           r.*
      from righe r
  ),
  consolidate as (
    select k,
           (array_agg(ingredient_id))[1] as ingredient_id,
           min(nome) as nome,
           min(unita) as unita,
           -- ⚠️ La somma delle parti NOTE: se una parte manca, lo dice il problema.
           sum(quantita) as quantita,
           array_agg(distinct fonte order by fonte) as da,
           nullif(concat_ws('; ',
             nullif(string_agg(distinct nullif(problema, ''), '; '), ''),
             case when bool_or(quantita is null) and bool_or(quantita is not null)
                  then 'una parte senza quantità: il totale è parziale' end), '') as problema
      from insieme
     group by k
  ),
  -- Le ricette che non si possono estrapolare affatto, dette per nome.
  intere as (
    select 'ricetta:' || r.id::text, null::uuid, r.titolo::text, null::text, null::numeric,
           array[r.titolo::text], 'la ricetta non dice per quante porzioni è'
      from ric r where coalesce(r.resa, 0) <= 0
    union all
    select 'ricetta:' || r.id::text, null::uuid, r.titolo::text, null::text, null::numeric,
           array[r.titolo::text], 'la ricetta non ha ancora ingredienti'
      from ric r
     where coalesce(r.resa, 0) > 0
       and not exists (select 1 from recipe_ingredients ri where ri.recipe_id = r.id)
       and not exists (select 1 from ricetta_ingredienti_da_collegare dc where dc.recipe_id = r.id)
    union all
    select 'bozza:' || b.id::text, null::uuid, b.titolo::text, null::text, null::numeric,
           array[b.titolo::text], 'la bozza non ha ancora ingredienti'
      from bz b
     where not exists (select 1 from bozze_ricetta_ingredienti bi where bi.bozza_id = b.id)
  )
  select c.k, c.ingredient_id, c.nome, c.unita, round(c.quantita, 4), c.da, c.problema,
         (select sum(sli.quantity_needed)
            from shopping_list_items sli
           where c.ingredient_id is not null
             and sli.ingredient_id = c.ingredient_id
             and sli.status in ('da_comprare', 'ordinata'))
    from consolidate c
  union all
  select * , null::numeric from intere
  order by 3;
end $$;
comment on function estrapola_ricette(jsonb) is
  'R11 (11/10/2026): gli ingredienti che servono per le ricette scelte, per quante porzioni, CONSOLIDATI per prodotto e unità, con le ricette da cui vengono. Solo lettura: è una proposta. Ricette del locale via `fabbisogno_preparazione` (la stessa esplosione dello scarico); bozze dalla quantità scritta. Nessuna conversione inventata: unità diverse restano righe diverse, quantità mancanti restano vuote e dichiarate. `gia_in_lista` = quanto di quel prodotto è già in lista da comprare o ordinato.';

revoke all on function estrapola_ricette(jsonb) from public, anon, authenticated;
grant execute on function estrapola_ricette(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6. DUPLICA copia anche le righe da collegare
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo (produzione, 25/10/2026), con la sola
-- copia delle righe da collegare in piu', contata in `righe`. Permessi
-- invariati: eseguibile da `authenticated` (il corridoio), nessun
-- `security definer` — com'era.
create or replace function public.duplica_ricetta(p_recipe_id uuid, p_nome text default null::text)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_orig   recipes%rowtype;
  v_nuova  uuid;
  v_nome   text;
  v_righe  integer;
  v_scritte integer;
  v_passi  integer;
begin
  select * into v_orig from recipes where id = p_recipe_id;
  if not found then
    raise exception 'La ricetta da copiare non esiste piu''.';
  end if;

  -- ⚠️ Il nome NON puo' restare identico: due schede con lo stesso nome in
  -- un elenco sono indistinguibili, e la prima cosa che si fa dopo una
  -- copia e' cercarla. Se chi chiama non ne propone uno, «(copia)».
  v_nome := coalesce(nullif(btrim(p_nome), ''), v_orig.name || ' (copia)');

  insert into recipes (
    name, category, subcategory, seasonality, portions_yield, tags, notes,
    menu_description, recipe_type, yield_quantity, yield_unit, prezzo_al_pezzo
  ) values (
    v_nome, v_orig.category, v_orig.subcategory, v_orig.seasonality,
    v_orig.portions_yield, v_orig.tags, v_orig.notes, v_orig.menu_description,
    v_orig.recipe_type, v_orig.yield_quantity, v_orig.yield_unit,
    v_orig.prezzo_al_pezzo
  )
  returning id into v_nuova;

  -- ⚠️ Si copiano i DUE NUMERI, non lo scarto: lo scarto e' un riflesso, e
  --    scriverlo verrebbe rifiutato. Copiando lordo e netto, la percentuale
  --    della copia esce identica a quella dell'originale da se'.
  insert into recipe_ingredients (
    recipe_id, ingredient_id, component_recipe_id, quantity, quantita_lorda, unit,
    prep_note
  )
  select v_nuova, ingredient_id, component_recipe_id, quantity, quantita_lorda, unit,
         prep_note
  from recipe_ingredients
  where recipe_id = p_recipe_id;
  get diagnostics v_righe = row_count;

  -- 🔴 25/10/2026: anche gli ingredienti non ancora collegati. Senza, la
  --    copia di una ricetta catalogata nascerebbe con meno ingredienti
  --    dell'originale, senza nessun errore.
  insert into ricetta_ingredienti_da_collegare (recipe_id, posizione, nome, quantita, unita, nota)
  select v_nuova, posizione, nome, quantita, unita, nota
  from ricetta_ingredienti_da_collegare
  where recipe_id = p_recipe_id;
  get diagnostics v_scritte = row_count;
  v_righe := v_righe + v_scritte;

  insert into recipe_steps (
    recipe_id, step_number, phase, description, technique, duration_min,
    is_active_time, temperature_c, is_haccp_ccp, haccp_limit, haccp_action,
    equipment
  )
  select v_nuova, step_number, phase, description, technique, duration_min,
         is_active_time, temperature_c, is_haccp_ccp, haccp_limit,
         haccp_action, equipment
  from recipe_steps
  where recipe_id = p_recipe_id;
  get diagnostics v_passi = row_count;

  return jsonb_build_object(
    'id', v_nuova,
    'nome', v_nome,
    'righe', v_righe,
    'passi', v_passi
  );
end;
$function$;

revoke all on function duplica_ricetta(uuid, text) from public, anon, authenticated;
grant execute on function duplica_ricetta(uuid, text) to authenticated;

-- =====================================================================
-- 7. VERIFICA — dentro una sotto-transazione annullata, su roba propria
-- =====================================================================
-- ⚠️ Cosa NON prova: la RLS (una migrazione gira come proprietaria). Quella
--    sta in tests/app/ricette-da-collegare.test.js, col token vero.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_staff     uuid;
  v_ent       uuid;
  v_ing       uuid;
  v_bozza     uuid;
  v_ricetta   uuid;
  v_altra     uuid;
  v_menu      uuid;
  v_riga_dc   uuid;
  v_r         jsonb;
  v_msg       text;
  v_respinto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ent from entities where entity_type = 'srls';
  if v_titolare is null or v_staff is null or v_ent is null then
    raise exception 'Servono un titolare, uno staff e la societa'' per verificare.';
  end if;

  -- (0) Dal catalogo: niente aperto alla chiave pubblica.
  if has_function_privilege('anon', 'collega_ingrediente_ricetta(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'promuovi_bozza_ricetta(uuid, text, uuid)', 'execute')
     or has_function_privilege('anon', 'duplica_ricetta(uuid, text)', 'execute') then
    raise exception 'Una funzione delle ricette e'' eseguibile con la chiave pubblica.';
  end if;
  if has_function_privilege('authenticated', 'vieta_pronta_con_ingredienti_da_collegare()', 'execute')
     or has_function_privilege('authenticated', 'vieta_menu_con_ingredienti_da_collegare()', 'execute')
     or has_function_privilege('authenticated', 'vieta_preparazione_con_ingredienti_da_collegare()', 'execute')
     or has_function_privilege('authenticated', 'vieta_da_collegare_su_ricetta_in_uso()', 'execute') then
    raise exception 'Una funzione di trigger delle ricette da collegare e'' eseguibile dal client.';
  end if;
  if has_table_privilege('anon', 'ricetta_ingredienti_da_collegare', 'select') then
    raise exception 'Gli ingredienti da collegare sono leggibili con la chiave pubblica.';
  end if;
  if not exists (select 1 from perimetro_registro where tabella = 'ricetta_ingredienti_da_collegare') then
    raise exception 'La tabella nuova non e'' classificata nel perimetro del registro.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
    values (v_ent, 'ZZ verifica catalogo - guanciale', 'pesce', 'g', 0.02, 0)
    returning id into v_ing;

    -- (1) Una bozza con un ingrediente collegato e uno NO (con un'unita'
    --     che il gestionale non conosce e senza quantita'): diventa ricetta.
    insert into bozze_ricetta (titolo, categoria, porzioni)
    values ('ZZ verifica catalogo - amatriciana', 'primo', 4) returning id into v_bozza;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita, ingredient_id)
    values (v_bozza, 1, 'guanciale', 200, 'g', v_ing);
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita)
    values (v_bozza, 2, 'ZZ pecorino', null, 'cucchiaio');
    insert into bozze_ricetta_passaggi (bozza_id, posizione, fase, descrizione)
    values (v_bozza, 1, 'cottura', 'rosolare');

    v_r := promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    v_ricetta := (v_r ->> 'ricetta_id')::uuid;
    if v_ricetta is null then
      raise exception 'La bozza con un ingrediente non collegato non e'' diventata ricetta: %', v_r;
    end if;
    if (select count(*) from recipe_ingredients where recipe_id = v_ricetta) <> 1
       or (select count(*) from ricetta_ingredienti_da_collegare where recipe_id = v_ricetta) <> 1 then
      raise exception 'Le righe non sono finite al posto giusto.';
    end if;
    select id into v_riga_dc from ricetta_ingredienti_da_collegare where recipe_id = v_ricetta;
    if (select unita from ricetta_ingredienti_da_collegare where id = v_riga_dc) is distinct from 'cucchiaio'
       or (select quantita from ricetta_ingredienti_da_collegare where id = v_riga_dc) is not null then
      raise exception 'La riga da collegare non e'' rimasta come era scritta.';
    end if;

    -- (2) Un ingrediente COLLEGATO senza quantita' resta un buco.
    insert into bozze_ricetta (titolo, categoria, porzioni)
    values ('ZZ verifica catalogo - buco', 'primo', 2) returning id into v_altra;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita, ingredient_id)
    values (v_altra, 1, 'guanciale', null, 'g', v_ing);
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_altra, 'ricetta', gen_random_uuid());
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%«guanciale»: quantita'' mancante%' then
      raise exception 'Un ingrediente collegato senza quantita'' e'' passato: %', coalesce(v_msg, 'nessun errore');
    end if;
    v_altra := null;

    -- (3) I tre punti chiusi, e ognuno nomina l'ingrediente.
    v_respinto := false;
    begin
      update recipes set pronta_per_carta = true where id = v_ricetta;
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%pronta per la carta%«ZZ pecorino»%' then
      raise exception 'Pronta per la carta con un ingrediente da collegare: %', coalesce(v_msg, 'nessun errore');
    end if;

    insert into menus (name, is_active) values ('ZZ verifica catalogo', false) returning id into v_menu;
    v_respinto := false;
    begin
      insert into menu_items (menu_id, recipe_id, category, selling_price)
      values (v_menu, v_ricetta, 'primo', 12);
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%in un menu%«ZZ pecorino»%' then
      raise exception 'In menu con un ingrediente da collegare: %', coalesce(v_msg, 'nessun errore');
    end if;

    insert into recipes (name, category, portions_yield, recipe_type)
    values ('ZZ verifica catalogo - contenitore', 'primo', 2, 'piatto_finito') returning id into v_altra;
    v_respinto := false;
    begin
      insert into recipe_ingredients (recipe_id, component_recipe_id, quantity, unit)
      values (v_altra, v_ricetta, 1, 'g');
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%preparazione%«ZZ pecorino»%' then
      raise exception 'Usata come preparazione con un ingrediente da collegare: %', coalesce(v_msg, 'nessun errore');
    end if;

    -- (4) La duplica porta con se' anche la riga da collegare.
    v_r := duplica_ricetta(v_ricetta, 'ZZ verifica catalogo - copia');
    if (select count(*) from ricetta_ingredienti_da_collegare where recipe_id = (v_r ->> 'id')::uuid) <> 1
       or (v_r ->> 'righe')::int <> 2 then
      raise exception 'La copia ha perso gli ingredienti da collegare: %', v_r;
    end if;

    -- (5) Il collegamento: senza quantita' e con un'unita' sconosciuta si
    --     rifiuta e lo dice; corrette, la riga passa e la ricetta si sblocca.
    v_respinto := false;
    begin
      perform collega_ingrediente_ricetta(v_riga_dc, v_ing);
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%scrivi prima la quantita''%' then
      raise exception 'Il collegamento senza quantita'' e'' passato: %', coalesce(v_msg, 'nessun errore');
    end if;
    update ricetta_ingredienti_da_collegare set quantita = 30 where id = v_riga_dc;
    v_respinto := false;
    begin
      perform collega_ingrediente_ricetta(v_riga_dc, v_ing);
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%un''unita'' del gestionale%cucchiaio%' then
      raise exception 'Il collegamento con un''unita'' sconosciuta e'' passato: %', coalesce(v_msg, 'nessun errore');
    end if;
    update ricetta_ingredienti_da_collegare set unita = 'g' where id = v_riga_dc;

    -- Il portiere: lo staff non collega.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform collega_ingrediente_ricetta(v_riga_dc, v_ing);
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%riservato al titolare%' then
      raise exception 'Lo staff ha collegato un ingrediente: %', coalesce(v_msg, 'nessun errore');
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    v_r := collega_ingrediente_ricetta(v_riga_dc, v_ing);
    if (v_r ->> 'ancora_da_collegare')::int <> 0
       or (select count(*) from recipe_ingredients where recipe_id = v_ricetta) <> 2
       or exists (select 1 from ricetta_ingredienti_da_collegare where id = v_riga_dc)
       or not exists (select 1 from recipe_ingredients where recipe_id = v_ricetta
                       and quantity = 30 and unit::text = 'g') then
      raise exception 'Il collegamento non ha spostato la riga intera: %', v_r;
    end if;

    -- (6) Collegato tutto, i tre punti si aprono.
    update recipes set pronta_per_carta = true where id = v_ricetta;
    insert into menu_items (menu_id, recipe_id, category, selling_price)
    values (v_menu, v_ricetta, 'primo', 12);

    -- (7) Allo specchio: a una ricetta pronta non si aggiunge un ingrediente
    --     non collegato.
    v_respinto := false;
    begin
      insert into ricetta_ingredienti_da_collegare (recipe_id, nome) values (v_ricetta, 'ZZ dopo');
    exception when others then v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%va collegato al magazzino subito%' then
      raise exception 'A una ricetta pronta si e'' aggiunto un ingrediente da collegare: %', coalesce(v_msg, 'nessun errore');
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle ricette da collegare');

  raise notice 'Fatto: una bozza diventa ricetta anche senza magazzino, e il collegamento e'' obbligatorio solo per carta, menu e preparazioni. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000020', 'le_ricette_si_catalogano_senza_magazzino')
on conflict (version) do nothing;
