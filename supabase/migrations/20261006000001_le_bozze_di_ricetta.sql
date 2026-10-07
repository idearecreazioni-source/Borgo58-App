-- =====================================================================
-- 20261006000001 — LE BOZZE DI RICETTA (Ricettario Fase 1A, la fondazione)
-- =====================================================================
--
-- Mandato: docs/mandati/20260812_ricettario_fase1.md, Attivita' A, e il
-- mandato notturno del 06/10/2026 che ne ha ristretto il perimetro alla
-- sola fondazione. Riepilogo: docs/consegne/20261006_ricettario_bozze_fase1a.md.
--
-- Una bozza e' una ricetta NON ANCORA VERA. Vive in tabelle sue, separate
-- dal Ricettario, e il Ricettario cambia solo con un gesto esplicito del
-- titolare: «il sistema propone, Alessio conferma», lo stesso principio
-- della posta in arrivo applicato alle ricette — cioe' al food cost.
--
-- 🔴 QUESTA MIGRAZIONE NON FA PARTE DELL'ALLINEAMENTO DELLE 17
--    (20260917000001 → 20260929000001, piano G0–G7 e contratto di
--    preflight). Viene dopo tutte, non ne modifica nessuna, e NON E'
--    DICHIARATA PRONTA PER LA PRODUZIONE: e' stata scritta senza essere
--    applicata da nessuna parte.
--
-- ---------------------------------------------------------------------
-- LE DECISIONI, in breve
-- ---------------------------------------------------------------------
-- · Un BUCO resta un buco: quantita' assente = NULL, mai zero; un'unita'
--   non compresa resta scritta com'era (testo libero, «cucchiaio»); un
--   ingrediente non collegato ha `ingredient_id` vuoto. La bozza non
--   indovina e non riempie.
-- · Nessun ingrediente nasce da solo: la promozione AGGANCIA soltanto
--   ingredienti gia' presenti e scelti a mano. Un ingrediente non collegato
--   e' un buco, e la promozione a ricetta lo RIFIUTA nominandolo.
-- · La promozione e' UNA funzione (tre tabelle del Ricettario + la bozza in
--   una transazione), chiamata solo dal corridoio `operazioni-atomiche`
--   (regola B4 del Contratto).
-- · Il doppio tocco non duplica: ogni gesto di conferma porta un suo
--   identificativo (`p_gesto`). Lo stesso gesto ripetuto riceve la stessa
--   ricetta; un gesto NUOVO su una bozza gia' promossa viene rifiutato.
-- · I campi che dicono «e' diventata ricetta» (`promossa_il`, `ricetta_id`,
--   `gesto_promozione`) NON sono scrivibili dal browser: lo vieta il
--   permesso sulla colonna, non una schermata.
-- · La pulizia automatica delle bozze scartate dopo N mesi (chiesta dal
--   mandato del 12/08) NON e' qui: nessun lavoro pianificato nuovo in
--   questa fondazione. Dichiarato nel riepilogo.

-- ---------------------------------------------------------------------
-- 1. LA BOZZA
-- ---------------------------------------------------------------------
create table if not exists bozze_ricetta (
  id                  uuid primary key default gen_random_uuid(),
  titolo              text not null,
  origine_tipo        text not null default 'manuale',
  origine_riferimento text,
  sunto               text,
  categoria           recipe_category,
  porzioni            integer,
  buchi_dichiarati    text[] not null default '{}',
  stato               text not null default 'in_revisione',
  promossa_il         timestamptz,
  ricetta_id          uuid references recipes(id) on delete set null,
  gesto_promozione    uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint bozza_ricetta_titolo_scritto check (length(btrim(titolo)) > 0),
  constraint bozza_ricetta_origine_nota check (
    origine_tipo in ('manuale', 'link', 'screenshot', 'testo', 'voce')),
  constraint bozza_ricetta_stato_noto check (
    stato in ('in_revisione', 'ispirazione', 'scartata')),
  constraint bozza_ricetta_porzioni_sensate check (porzioni is null or porzioni > 0),
  constraint bozza_ricetta_promozione_intera check (
    (promossa_il is null and gesto_promozione is null and ricetta_id is null)
    or (promossa_il is not null and gesto_promozione is not null))
);

comment on table bozze_ricetta is
  'Una ricetta NON ancora vera: titolo, origine, sunto, ingredienti e passaggi proposti, e i buchi dichiarati. Il Ricettario cambia solo con promuovi_bozza_ricetta, dal corridoio. Titolare-only.';
comment on column bozze_ricetta.buchi_dichiarati is
  'Cio'' che chi ha proposto la bozza non ha capito, scritto in parole («unita'' non capita al passo 2»). Finche'' ce n''e'' uno, la bozza non diventa ricetta.';
comment on column bozze_ricetta.stato is
  'in_revisione · ispirazione (si tiene titolo, sunto e link: la ricetta la costruisci tu) · scartata. «Diventata ricetta» NON e'' uno stato scrivibile: e'' promossa_il, che scrive solo la promozione.';
comment on column bozze_ricetta.ricetta_id is
  'La ricetta nata da questa bozza. Se la ricetta viene tolta dal Ricettario, il collegamento si svuota e la bozza resta come traccia di quando e'' stata promossa.';

comment on constraint bozza_ricetta_titolo_scritto on bozze_ricetta is
  'Una bozza ha bisogno almeno di un titolo: anche provvisorio, ma scritto.';
comment on constraint bozza_ricetta_origine_nota on bozze_ricetta is
  'L''origine di una bozza e'' una di queste: scritta a mano, da un link, da uno screenshot, da un testo, dalla voce.';
comment on constraint bozza_ricetta_stato_noto on bozze_ricetta is
  'Una bozza e'' in revisione, un''ispirazione o scartata. Che sia diventata ricetta lo dice la promozione, non questo campo.';
comment on constraint bozza_ricetta_porzioni_sensate on bozze_ricetta is
  'Le porzioni o non si sanno ancora (vuoto) o sono almeno una. Zero porzioni non e'' una ricetta.';
comment on constraint bozza_ricetta_promozione_intera on bozze_ricetta is
  'Una promozione e'' tutta o niente: o la bozza non e'' mai diventata ricetta, o ha la data e il gesto che l''hanno fatta.';

-- ---------------------------------------------------------------------
-- 2. GLI INGREDIENTI PROPOSTI
-- ---------------------------------------------------------------------
create table if not exists bozze_ricetta_ingredienti (
  id               uuid primary key default gen_random_uuid(),
  bozza_id         uuid not null references bozze_ricetta(id) on delete cascade,
  posizione        integer not null,
  testo_originale  text,
  nome             text not null,
  quantita         numeric(12,4),
  unita            text,
  ingredient_id    uuid references ingredients(id) on delete set null,
  nota             text,
  constraint bozza_ingrediente_nome_scritto check (length(btrim(nome)) > 0),
  constraint bozza_ingrediente_quantita_sensata check (quantita is null or quantita > 0)
);

create index if not exists bozze_ricetta_ingredienti_bozza_idx
  on bozze_ricetta_ingredienti (bozza_id, posizione);
create index if not exists bozze_ricetta_ingredienti_ingrediente_idx
  on bozze_ricetta_ingredienti (ingredient_id);

comment on table bozze_ricetta_ingredienti is
  'Gli ingredienti PROPOSTI da una bozza. Quantita'' vuota, unita'' non compresa e ingrediente non collegato sono BUCHI, e restano visibili come tali: mai zero, mai un ingrediente creato da solo.';
comment on column bozze_ricetta_ingredienti.unita is
  'Come l''ha scritta chi ha proposto la bozza («g», «cucchiaio»). Testo libero apposta: un''unita'' che il gestionale non conosce resta leggibile come buco, invece di sparire.';
comment on column bozze_ricetta_ingredienti.ingredient_id is
  'L''ingrediente dell''anagrafica SCELTO A MANO. Vuoto = non collegato, ed e'' un buco. Se l''ingrediente viene tolto, il collegamento si svuota e il buco torna.';

comment on constraint bozza_ingrediente_nome_scritto on bozze_ricetta_ingredienti is
  'Un ingrediente proposto ha almeno un nome, anche se non e'' ancora collegato all''anagrafica.';
comment on constraint bozza_ingrediente_quantita_sensata on bozze_ricetta_ingredienti is
  'La quantita'' o non si sa ancora (vuoto: e'' un buco) o e'' maggiore di zero. Zero non vuol dire «non lo so».';

-- ---------------------------------------------------------------------
-- 3. I PASSAGGI PROPOSTI
-- ---------------------------------------------------------------------
create table if not exists bozze_ricetta_passaggi (
  id           uuid primary key default gen_random_uuid(),
  bozza_id     uuid not null references bozze_ricetta(id) on delete cascade,
  posizione    integer not null,
  fase         step_phase,
  descrizione  text
);

create index if not exists bozze_ricetta_passaggi_bozza_idx
  on bozze_ricetta_passaggi (bozza_id, posizione);

comment on table bozze_ricetta_passaggi is
  'I passaggi PROPOSTI da una bozza. Fase vuota o descrizione vuota sono buchi.';

-- ---------------------------------------------------------------------
-- 4. UNA BOZZA DIVENTATA RICETTA NON SI TOCCA PIU'
-- ---------------------------------------------------------------------
-- E' la traccia di da dove viene una ricetta. ⚠️ Con DUE eccezioni: se la
-- ricetta viene tolta dal Ricettario, la chiave esterna svuota `ricetta_id`
-- — e bloccare quel gesto vorrebbe dire non poter piu' togliere una
-- ricetta nata da una bozza, cioe' un vicolo cieco. E una volta tolta la
-- ricetta, la bozza si puo' anche cancellare.
create or replace function vieta_bozza_promossa()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  -- ⚠️ Si cancella solo quando la ricetta non c'e' piu': a quel punto la
  --    traccia non racconta piu' niente, e tenerla per forza sarebbe un
  --    vicolo cieco.
  if tg_op = 'DELETE' then
    if old.promossa_il is not null and old.ricetta_id is not null then
      raise exception 'Questa bozza e'' gia'' diventata ricetta il %, e resta come traccia di da dove viene. Se la ricetta non ti serve, toglila dal Ricettario.',
        to_char(old.promossa_il at time zone 'Europe/Rome', 'DD/MM/YYYY');
    end if;
    return old;
  end if;

  if old.promossa_il is not null then
    if new.ricetta_id is null
       and (to_jsonb(new) - 'ricetta_id' - 'updated_at')
         = (to_jsonb(old) - 'ricetta_id' - 'updated_at') then
      return new;
    end if;
    raise exception 'Questa bozza e'' gia'' diventata ricetta: le correzioni si fanno sulla ricetta, nel Ricettario.';
  end if;
  return new;
end
$fn$;

revoke all on function vieta_bozza_promossa() from public, anon, authenticated;

drop trigger if exists trg_bozza_promossa_ferma on bozze_ricetta;
create trigger trg_bozza_promossa_ferma
  before update or delete on bozze_ricetta
  for each row execute function vieta_bozza_promossa();

-- Le righe di una bozza promossa: niente aggiunte, correzioni o cancellazioni.
-- ⚠️ Tranne la cascata: quando la bozza stessa sparisce la riga madre non
--    c'e' piu', e il controllo la lascia andare.
create or replace function vieta_righe_bozza_promossa()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_bozze uuid[];
begin
  -- ⚠️ `old` non esiste in un INSERT e `new` non esiste in un DELETE: si
  --    guarda solo quello che c'e', e in un UPDATE tutte e due le bozze
  --    (spostare una riga DA una bozza promossa e' come toglierla).
  if tg_op = 'INSERT' then
    v_bozze := array[new.bozza_id];
  elsif tg_op = 'UPDATE' then
    v_bozze := array[new.bozza_id, old.bozza_id];
  else
    v_bozze := array[old.bozza_id];
  end if;
  if exists (select 1 from bozze_ricetta b
              where b.id = any(v_bozze) and b.promossa_il is not null) then
    raise exception 'Questa bozza e'' gia'' diventata ricetta: le correzioni si fanno sulla ricetta, nel Ricettario.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$fn$;

revoke all on function vieta_righe_bozza_promossa() from public, anon, authenticated;

drop trigger if exists trg_righe_bozza_promossa_ferme on bozze_ricetta_ingredienti;
create trigger trg_righe_bozza_promossa_ferme
  before insert or update or delete on bozze_ricetta_ingredienti
  for each row execute function vieta_righe_bozza_promossa();

drop trigger if exists trg_passi_bozza_promossa_fermi on bozze_ricetta_passaggi;
create trigger trg_passi_bozza_promossa_fermi
  before insert or update or delete on bozze_ricetta_passaggi
  for each row execute function vieta_righe_bozza_promossa();

drop trigger if exists trg_bozze_ricetta_updated_at on bozze_ricetta;
create trigger trg_bozze_ricetta_updated_at
  before update on bozze_ricetta
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 5. PERMESSI: titolare-only, e le colonne della promozione non si scrivono
-- ---------------------------------------------------------------------
alter table bozze_ricetta enable row level security;
alter table bozze_ricetta_ingredienti enable row level security;
alter table bozze_ricetta_passaggi enable row level security;

drop policy if exists bozze_ricetta_titolare_all on bozze_ricetta;
create policy bozze_ricetta_titolare_all on bozze_ricetta
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists bozze_ricetta_ingredienti_titolare_all on bozze_ricetta_ingredienti;
create policy bozze_ricetta_ingredienti_titolare_all on bozze_ricetta_ingredienti
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists bozze_ricetta_passaggi_titolare_all on bozze_ricetta_passaggi;
create policy bozze_ricetta_passaggi_titolare_all on bozze_ricetta_passaggi
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ Il permesso sulle COLONNE e' cio' che impedisce di dichiarare
--    «diventata ricetta» senza che la ricetta sia nata: dal browser
--    `promossa_il`, `ricetta_id` e `gesto_promozione` non si scrivono, e lo
--    `stato` non si sceglie alla creazione.
revoke all on bozze_ricetta from public, anon, authenticated;
grant select, delete on bozze_ricetta to authenticated;
grant insert (titolo, origine_tipo, origine_riferimento, sunto, categoria, porzioni, buchi_dichiarati)
  on bozze_ricetta to authenticated;
grant update (titolo, origine_tipo, origine_riferimento, sunto, categoria, porzioni, buchi_dichiarati, stato)
  on bozze_ricetta to authenticated;

revoke all on bozze_ricetta_ingredienti from public, anon, authenticated;
grant select, insert, update, delete on bozze_ricetta_ingredienti to authenticated;
revoke all on bozze_ricetta_passaggi from public, anon, authenticated;
grant select, insert, update, delete on bozze_ricetta_passaggi to authenticated;

-- Il perimetro del registro delle cancellazioni si DICHIARA (26/08).
insert into perimetro_registro (tabella, dentro, ragione) values
  ('bozze_ricetta', false,
   'Una bozza e'' lavoro in corso, non soldi ne'' un documento: si cancella liberamente finche'' non diventa ricetta, e da li'' non si cancella piu'' (trigger). La ricetta nata da una bozza ha la sua traccia nel Ricettario. Fuori dal 06/10/2026.'),
  ('bozze_ricetta_ingredienti', false,
   'Righe di una bozza: stessa ragione di bozze_ricetta. Fuori dal 06/10/2026.'),
  ('bozze_ricetta_passaggi', false,
   'Righe di una bozza: stessa ragione di bozze_ricetta. Fuori dal 06/10/2026.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 6. LA PROMOZIONE — una funzione, dal corridoio
-- ---------------------------------------------------------------------
-- Due esiti, scelti dal titolare:
--   'ispirazione' → nessuna ricetta: la bozza si tiene (titolo, sunto, link);
--   'ricetta'     → ricetta + righe ingredienti + passaggi, tutto o niente.
--
-- 🔴 I BUCHI SI NOMINANO TUTTI INSIEME (regola del 16/08): dirne uno per
--    volta fa scoprire il secondo dopo aver risolto il primo.
-- ⚠️ La stessa definizione di «buco» vive anche in
--    src/lib/calcoli/bozzeRicetta.js, che la MOSTRA prima della conferma;
--    qui la si FA RISPETTARE. Sono due ruoli diversi (dire / impedire), e la
--    prova pura tiene d'accordo i nomi dei buchi con questo corpo.
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
    if v_riga.ingredient_id is null then
      v_buchi := v_buchi || format('«%s»: non collegato a un ingrediente dell''anagrafica', v_riga.nome);
    end if;
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
    v_unita := v_riga.unita::unit_type;
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit, prep_note)
    values (v_ricetta, v_riga.ingredient_id, v_riga.quantita, v_unita, v_riga.nota);
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
  'La conferma del titolare su una bozza: come ispirazione (nessuna ricetta) o come ricetta (ricetta + ingredienti + passaggi in una transazione). Rifiuta i buchi nominandoli tutti, non crea mai ingredienti, rifiuta le bozze scartate o gia'' promosse; lo stesso gesto ripetuto riceve la stessa ricetta. Solo titolare, e solo attraverso il corridoio.';

-- ⚠️ `authenticated` resta perche' il corridoio la invoca col token
--    dell'utente vero (§8, 11/08): e' l'unica concessione, ed e' quella del
--    corridoio.
revoke all on function promuovi_bozza_ricetta(uuid, text, uuid) from public, anon, authenticated;
grant execute on function promuovi_bozza_ricetta(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. IL CENSIMENTO DELLE UNITA' IMPARA LA COLONNA NUOVA
-- ---------------------------------------------------------------------
-- `bozze_ricetta_ingredienti` ha un `ingredient_id` e una colonna numerica,
-- quindi il censimento la chiede. ⚠️ NON SI CONVERTE: la quantita' di una
-- bozza e' nell'unita' scritta da chi l'ha proposta (testo libero), non in
-- quella del prodotto, e cambiare l'unita' del prodotto non le dice niente.
-- Corpo ripreso dall'ultima definizione nel repository
-- (20260831000005), con la sola riga in piu'.

create or replace function colonne_unita_non_classificate()
returns table (tabella text, colonna text)
language sql
stable
set search_path = public
as $function$
  with conosciute(t, c) as (values
    -- si convertono: quantita'
    ('ingredients','stock_minimum_threshold'),
    ('recipe_ingredients','quantity'),
    ('stock_lots','quantity_received'), ('stock_lots','quantity_remaining'),
    ('stock_consumptions','quantity'), ('stock_consumptions','quantita_richiesta'),
    -- 30/08: quanta merce e' uscita da lotti senza prezzo. E' una QUANTITA'
    -- nell'unita' del prodotto, quindi segue l'unita' come le sue sorelle.
    ('stock_consumptions','quantita_senza_costo'),
    ('shopping_list_items','quantity_needed'), ('shopping_list_items','quantita_arrivata'),
    ('anomalie_scarico','quantita_mancante'), ('anomalie_scarico','quantita_richiesta'),
    ('ordini_fornitore_righe','quantita_base'),
    ('rettifiche_giacenza','atteso'), ('rettifiche_giacenza','dichiarato'),
    ('rettifiche_giacenza','differenza'),
    ('intercompany_cessions','quantity'),
    ('crops','harvested_quantity'),
    ('produzioni','quantita_ottenuta'), ('produzioni','resa_attesa'),
    -- si convertono: prezzi per unita' (si dividono) e il fattore
    ('ingredients','current_price'),
    ('stock_lots','unit_cost'),
    ('price_history','price'),
    ('intercompany_cessions','unit_price'),
    ('ordini_fornitore_righe','prezzo_atteso'),
    ('articoli_fornitore','fattore'),
    -- 🔴 30/08 — QUANTE PORZIONI DA UNA UNITA' DEL PRODOTTO. Si divide come
    --    un prezzo, e la ragione e' la stessa: se un caffe' passa da chili a
    --    grammi, «140 tazzine da un chilo» diventa 0,14 da un grammo. E' un
    --    numero PER unita', quindi si rimpicciolisce quando l'unita' si
    --    rimpicciolisce.
    ('bar_items','porzioni_per_unita'),
    -- NON si convertono, e la ragione e' la stessa per tutte: sono euro
    -- gia' spesi, percentuali o conteggi, e non cambiano con l'unita' di
    -- misura del prodotto.
    ('ingredients','waste_percentage_default'), ('recipe_ingredients','waste_percentage'),
    ('stock_consumptions','costo'), ('produzioni','costo'), ('produzioni','dosi'),
    ('intercompany_cessions','total_amount'), ('intercompany_cessions','vat_rate'),
    ('shopping_list_items','purchased_amount'),
    ('rettifiche_giacenza','valore'),
    -- ⚠️ 30/08 — IL PREZZO DI UNA VOCE DELLA CARTA NON SI CONVERTE: e' quello
    --    che il cliente paga per una porzione, deciso da Alessio, e non
    --    cambia perche' il magazzino misura il vino in un altro modo. Se si
    --    convertisse, cambiare unita' a un prodotto RISCRIVEREBBE la carta.
    ('bar_items','selling_price'),
    -- ⚠️ Il costo di una foto letta e' in EURO GIA' SPESI: se domani un
    -- prodotto passasse da chili a pezzi, quei centesimi resterebbero
    -- quelli. Non si converte.
    ('letture_foto','costo_euro'),
    -- ⚠️ La quantita' dell'ordine e' nell'unita' del FORNITORE (2 casse):
    -- e' quantita_base a parlare la lingua dell'ingrediente.
    ('ordini_fornitore_righe','quantita'),
    -- 🔴 31/08 — I CALICI DI UNA BOTTIGLIA APERTA **NON SI CONVERTONO**: sono
    --    un conteggio di porzioni servite, non una quantita' nell'unita' del
    --    prodotto. Sei calici restano sei calici che il magazzino misuri il
    --    vino in bottiglie o in litri.
    -- ⚠️ Da non confondere con `bar_items.porzioni_per_unita` qui sopra, che
    --    invece si converte: quello e' un numero PER unita' di prodotto,
    --    questi sono porzioni contate dentro una bottiglia sola.
    ('bottiglie_aperte','porzioni_totali'), ('bottiglie_aperte','porzioni_buttate'),
    -- ⚠️ La quantita' di una BOZZA di ricetta e' nell'unita' scritta da chi
    --    l'ha proposta (testo libero), non in quella del prodotto: cambiare
    --    l'unita' del prodotto non le dice niente. Non si converte (06/10/2026).
    ('bozze_ricetta_ingredienti','quantita')
  )
  select c.table_name::text, c.column_name::text
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
   where c.table_schema = 'public'
     and c.data_type = 'numeric'
     and c.table_name in (
       select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'ingredient_id')
     and not exists (select 1 from conosciute k
                      where k.t = c.table_name and k.c = c.column_name)
   order by 1, 2;
$function$;

revoke all on function colonne_unita_non_classificate() from public, anon, authenticated;
grant execute on function colonne_unita_non_classificate() to authenticated;

-- =====================================================================
-- 8. VERIFICA — tutto dentro una sotto-transazione annullata (regola del
--    30/08): il registro delle cancellazioni resta acceso e non nasce
--    nessuna lapide da togliere.
-- ⚠️ Cosa NON prova: la RLS. Una migrazione gira come proprietaria e la
--    scavalca (§8, 16/08): i permessi si provano dal client, in
--    tests/app/bozze-ricetta.test.js. Qui si prova il portiere della
--    funzione e i permessi sulle colonne, che si leggono dal catalogo.
-- =====================================================================
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_staff     uuid;
  v_ent       uuid;
  v_ing       uuid;
  v_bozza     uuid;
  v_isp       uuid;
  v_scart     uuid;
  v_riga_a    uuid;
  v_riga_b    uuid;
  v_passo     uuid;
  v_gesto     uuid := gen_random_uuid();
  v_r         jsonb;
  v_r2        jsonb;
  v_ricetta   uuid;
  v_msg       text;
  v_respinto  boolean;
  v_ricette0  integer;
  v_ingr0     integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_staff is null then
    raise exception 'Nessuno staff in user_roles: impossibile verificare il portiere.';
  end if;
  select id into v_ent from entities where entity_type = 'srls';
  if v_ent is null then
    raise exception 'Serve la societa'' per verificare.';
  end if;

  -- (0) Dal catalogo: niente ad anon, e le colonne della promozione chiuse.
  if has_function_privilege('anon', 'promuovi_bozza_ricetta(uuid, text, uuid)', 'execute') then
    raise exception 'La promozione e'' eseguibile con la chiave pubblica.';
  end if;
  if has_function_privilege('authenticated', 'vieta_bozza_promossa()', 'execute')
     or has_function_privilege('anon', 'vieta_righe_bozza_promossa()', 'execute') then
    raise exception 'Una funzione di trigger delle bozze e'' eseguibile dal client.';
  end if;
  if has_column_privilege('authenticated', 'bozze_ricetta', 'promossa_il', 'UPDATE')
     or has_column_privilege('authenticated', 'bozze_ricetta', 'ricetta_id', 'UPDATE')
     or has_column_privilege('authenticated', 'bozze_ricetta', 'gesto_promozione', 'INSERT')
     or has_column_privilege('authenticated', 'bozze_ricetta', 'stato', 'INSERT') then
    raise exception 'Dal browser si potrebbe dichiarare una bozza promossa senza la ricetta.';
  end if;
  if has_table_privilege('anon', 'bozze_ricetta', 'select')
     or has_table_privilege('anon', 'bozze_ricetta_ingredienti', 'select')
     or has_table_privilege('anon', 'bozze_ricetta_passaggi', 'select') then
    raise exception 'Le bozze sono leggibili con la chiave pubblica.';
  end if;
  if exists (select 1 from colonne_unita_non_classificate()) then
    raise exception 'Restano colonne non classificate: %',
      (select string_agg(tabella || '.' || colonna, ', ') from colonne_unita_non_classificate());
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    insert into ingredients (entity_id, name, category, unit, current_price)
    values (v_ent, 'ZZ verifica bozze - guanciale', 'pesce', 'g', 0.02)
    returning id into v_ing;

    select count(*) into v_ricette0 from recipes;
    select count(*) into v_ingr0 from ingredients;

    -- (1) Una bozza, con un ingrediente collegato e uno no, uno senza
    --     quantita', e un passaggio senza fase.
    insert into bozze_ricetta (titolo, sunto, origine_tipo)
    values ('ZZ verifica bozze - amatriciana', 'prova', 'manuale')
    returning id into v_bozza;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita, ingredient_id)
    values (v_bozza, 1, 'guanciale', 200, 'g', v_ing) returning id into v_riga_a;
    insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome, quantita, unita)
    values (v_bozza, 2, 'ZZ pecorino mai visto', null, 'cucchiaio') returning id into v_riga_b;
    insert into bozze_ricetta_passaggi (bozza_id, posizione, descrizione)
    values (v_bozza, 1, 'rosolare il guanciale') returning id into v_passo;

    -- Una bozza da sola non crea niente.
    if (select count(*) from recipes) <> v_ricette0 then
      raise exception 'Una bozza ha creato una ricetta da sola.';
    end if;

    -- (2) Con i buchi la promozione si rifiuta, e li nomina TUTTI.
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_bozza, 'ricetta', v_gesto);
    exception when others then
      v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto then
      raise exception 'Una bozza coi buchi e'' diventata ricetta.';
    end if;
    if v_msg not like '%manca la categoria%' or v_msg not like '%mancano le porzioni%'
       or v_msg not like '%ZZ pecorino mai visto»: non collegato%'
       or v_msg not like '%ZZ pecorino mai visto»: quantita'' mancante%'
       or v_msg not like '%unita'' non compresa («cucchiaio»)%'
       or v_msg not like '%passaggio 1: manca la fase%' then
      raise exception 'Il rifiuto non nomina tutti i buchi: %', v_msg;
    end if;
    -- Tutto o niente: nessuna ricetta, nessun ingrediente creato, e il
    -- buco e' ancora un buco (non uno zero).
    if (select count(*) from recipes) <> v_ricette0 then
      raise exception 'Un rifiuto ha lasciato una ricetta a meta''.';
    end if;
    if (select count(*) from ingredients) <> v_ingr0 then
      raise exception 'Un ingrediente non collegato e'' stato creato da solo.';
    end if;
    if (select quantita from bozze_ricetta_ingredienti where id = v_riga_b) is not null then
      raise exception 'Un buco di quantita'' e'' diventato un numero.';
    end if;

    -- (3) Il portiere: lo staff non conferma.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_bozza, 'ricetta', v_gesto);
    exception when others then
      v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%riservato al titolare%' then
      raise exception 'Lo staff non e'' stato respinto dalla promozione: %', coalesce(v_msg, 'nessun errore');
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (4) Chiusi i buchi, la promozione crea tutto insieme.
    update bozze_ricetta set categoria = 'primo', porzioni = 4 where id = v_bozza;
    delete from bozze_ricetta_ingredienti where id = v_riga_b;
    update bozze_ricetta_passaggi set fase = 'cottura' where id = v_passo;

    v_r := promuovi_bozza_ricetta(v_bozza, 'ricetta', v_gesto);
    v_ricetta := (v_r ->> 'ricetta_id')::uuid;
    if v_ricetta is null or (v_r ->> 'gia_fatto')::boolean then
      raise exception 'La promozione non ha restituito una ricetta nuova: %', v_r;
    end if;
    if (select count(*) from recipe_ingredients where recipe_id = v_ricetta) <> 1
       or (select count(*) from recipe_steps where recipe_id = v_ricetta) <> 1
       or (select quantity from recipe_ingredients where recipe_id = v_ricetta) <> 200
       or (select unit::text from recipe_ingredients where recipe_id = v_ricetta) <> 'g' then
      raise exception 'La ricetta e'' nata incompleta.';
    end if;

    -- (5) Il doppio tocco: stesso gesto, stessa ricetta, nessun duplicato.
    v_r2 := promuovi_bozza_ricetta(v_bozza, 'ricetta', v_gesto);
    if (v_r2 ->> 'ricetta_id')::uuid is distinct from v_ricetta
       or not (v_r2 ->> 'gia_fatto')::boolean then
      raise exception 'Il doppio tocco non ha restituito la stessa ricetta: %', v_r2;
    end if;
    if (select count(*) from recipes) <> v_ricette0 + 1 then
      raise exception 'Il doppio tocco ha creato una seconda ricetta.';
    end if;

    -- (6) Un gesto NUOVO su una bozza gia' promossa e' rifiutato.
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_bozza, 'ricetta', gen_random_uuid());
    exception when others then
      v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%gia'' diventata ricetta%' then
      raise exception 'Una bozza gia'' promossa e'' stata ripromossa: %', coalesce(v_msg, 'nessun errore');
    end if;

    -- (7) Una bozza promossa non si corregge piu', ne' lei ne' le sue righe.
    v_respinto := false;
    begin
      update bozze_ricetta set titolo = 'altro' where id = v_bozza;
    exception when others then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'Una bozza promossa si e'' lasciata correggere.';
    end if;
    v_respinto := false;
    begin
      insert into bozze_ricetta_ingredienti (bozza_id, posizione, nome)
      values (v_bozza, 9, 'aggiunto dopo');
    exception when others then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'A una bozza promossa si e'' aggiunta una riga.';
    end if;

    -- (8) Finche' la ricetta c'e' la bozza non si cancella; la ricetta pero'
    --     si puo' togliere dal Ricettario: il collegamento si svuota, la bozza
    --     resta, e da li' si puo' cancellare.
    v_respinto := false;
    begin
      delete from bozze_ricetta where id = v_bozza;
    exception when others then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'Una bozza promossa si e'' lasciata cancellare con la sua ricetta ancora viva.';
    end if;

    delete from recipe_steps where recipe_id = v_ricetta;
    delete from recipe_ingredients where recipe_id = v_ricetta;
    delete from recipes where id = v_ricetta;
    if (select ricetta_id from bozze_ricetta where id = v_bozza) is not null
       or (select promossa_il from bozze_ricetta where id = v_bozza) is null then
      raise exception 'Togliendo la ricetta, la bozza non e'' rimasta come traccia.';
    end if;
    delete from bozze_ricetta where id = v_bozza;
    if exists (select 1 from bozze_ricetta where id = v_bozza)
       or exists (select 1 from bozze_ricetta_ingredienti where bozza_id = v_bozza) then
      raise exception 'Tolta la ricetta, la bozza non si e'' lasciata cancellare.';
    end if;

    -- (9) Una bozza scartata non si promuove.
    insert into bozze_ricetta (titolo) values ('ZZ verifica bozze - scartata')
    returning id into v_scart;
    update bozze_ricetta set stato = 'scartata' where id = v_scart;
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_scart, 'ispirazione', gen_random_uuid());
    exception when others then
      v_respinto := true; v_msg := sqlerrm;
    end;
    if not v_respinto or v_msg not like '%scartata%' then
      raise exception 'Una bozza scartata e'' stata confermata: %', coalesce(v_msg, 'nessun errore');
    end if;

    -- (10) Ispirazione: nessuna ricetta, e ripetuta resta una.
    select count(*) into v_ricette0 from recipes;
    insert into bozze_ricetta (titolo, sunto, origine_tipo, origine_riferimento)
    values ('ZZ verifica bozze - ispirazione', 'un''idea', 'link', 'https://esempio.invalid/ricetta')
    returning id into v_isp;
    v_r := promuovi_bozza_ricetta(v_isp, 'ispirazione', v_gesto);
    v_r2 := promuovi_bozza_ricetta(v_isp, 'ispirazione', v_gesto);
    if (select stato from bozze_ricetta where id = v_isp) <> 'ispirazione'
       or (select count(*) from recipes) <> v_ricette0
       or not (v_r2 ->> 'gia_fatto')::boolean then
      raise exception 'L''ispirazione ha toccato il Ricettario o non si e'' salvata.';
    end if;

    -- (11) Un esito sconosciuto non passa.
    v_respinto := false;
    begin
      perform promuovi_bozza_ricetta(v_isp, 'pubblica', gen_random_uuid());
    exception when others then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'Un esito sconosciuto e'' stato accettato.';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle bozze di ricetta');

  raise notice 'Fatto: le bozze vivono da sole, i buchi restano buchi, la promozione e'' tutta o niente e il doppio tocco non duplica. Provato e annullato: zero residui.';
end $verifica$;

-- La migrazione si registra da sé
insert into applied_migrations (version, name)
values ('20261006000001', 'le_bozze_di_ricetta')
on conflict (version) do nothing;
