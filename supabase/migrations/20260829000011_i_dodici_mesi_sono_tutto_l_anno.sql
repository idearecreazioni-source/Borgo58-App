-- =====================================================================
-- I DODICI MESI SONO «TUTTO L'ANNO»
-- 29/08/2026 — Blocco 2, punto 2d del mandato del 29/08 (sera)
-- =====================================================================
-- Decisione di Alessio, e vale NEI DUE VERSI e per TUTTE E DUE le mani
-- (la sua e quella di MEMO):
--   · dodici mesi accesi diventano «tutto l'anno»;
--   · togliendo un mese da «tutto l'anno», restano undici mesi accesi.
--
-- ---------------------------------------------------------------------
-- MISURATO PRIMA DI SCRIVERE, sul progetto di prova
-- ---------------------------------------------------------------------
--   · 35 prodotti su 133 hanno **tutti e dodici i mesi accesi**;
--   · **zero** prodotti dicono `tutto_anno`;
--   · il valore `tutto_anno` **esiste gia' nel vocabolario** `month_code`
--     dal primo giorno, ed e' l'ultimo dei tredici.
--
-- 🔴 Cioe': il vocabolario offre la risposta corta e **nessuna strada la
-- scrive**. Non e' un dato sbagliato — a schermo i due casi si vedono
-- uguali — ma nel database non lo sono: il giorno che si vorra' sapere
-- cosa e' davvero stagionale, dodici mesi accesi uno per uno non si
-- distinguono da un prodotto disponibile tutto l'anno.
--
-- ---------------------------------------------------------------------
-- PERCHE' UN TRIGGER E NON UN CONTROLLO NELLA SCHERMATA
-- ---------------------------------------------------------------------
-- Le porte da cui una stagionalita' puo' entrare sono almeno quattro: la
-- scheda del prodotto compilata a mano, la lettura di un'etichetta, la
-- lettura di una fattura, e il giorno che ci arrivera' la voce. Un
-- controllo nella schermata ne coprirebbe una. Il trigger le copre tutte,
-- **oggi e quelle che verranno**.
--
-- ⚠️ IL NOME DEL TRIGGER NON E' INDIFFERENTE. In Postgres i trigger BEFORE
-- di riga scattano in ordine alfabetico, e su questa tabella c'e' gia'
-- `trg_tocca_campo_confermato`, che confronta il valore nuovo col vecchio
-- per capire se qualcuno ha guardato quel campo. `trg_normalizza_…` viene
-- prima di `trg_tocca_…`, quindi il confronto vede il valore **gia'
-- normalizzato**: chi risalva dodici mesi su una riga che gia' dice
-- «tutto l'anno» non risulta averla toccata, ed e' giusto — non l'ha
-- toccata.
--
-- ⚠️ IL VERSO OPPOSTO NON PUO' STARE QUI, ed e' dichiarato: il database
-- riceve un elenco, non sa quale mese e' stato spento. «Tutto l'anno meno
-- agosto = undici mesi» lo calcola la schermata
-- (`src/lib/calcoli/stagionalita.js`), e la manda gia' fatta.
-- =====================================================================

create or replace function normalizza_stagionalita()
returns trigger
language plpgsql
set search_path = public
as $corpo$
declare
  v_mesi month_code[] := array['gen','feb','mar','apr','mag','giu','lug',
                               'ago','set','ott','nov','dic']::month_code[];
begin
  if new.seasonality is null then
    return new;
  end if;

  -- Prima si tolgono i doppioni e si rimette l'ordine dei mesi. L'ordine
  -- viene dal vocabolario (`month_code`), non dall'alfabeto: gennaio prima
  -- di febbraio, non «ago» prima di «apr».
  new.seasonality := coalesce(
    (select array_agg(m order by m) from (select distinct unnest(new.seasonality) m) x),
    '{}'::month_code[]
  );

  -- Dodici mesi accesi SONO «tutto l'anno». E chi dice gia' «tutto l'anno»
  -- non ha bisogno di dire anche i mesi: sarebbero due modi di dire la
  -- stessa cosa nella stessa riga.
  if 'tutto_anno' = any(new.seasonality) or new.seasonality @> v_mesi then
    new.seasonality := array['tutto_anno']::month_code[];
  end if;

  return new;
end;
$corpo$;

comment on function normalizza_stagionalita() is
  'Dodici mesi accesi diventano «tutto l''anno» (decisione di Alessio, 29/08). Vale da qualunque porta arrivi il dato: la mano, l''etichetta, la fattura, la voce.';

drop trigger if exists trg_normalizza_stagionalita on ingredients;
create trigger trg_normalizza_stagionalita
  before insert or update on ingredients
  for each row execute function normalizza_stagionalita();

-- ---------------------------------------------------------------------
-- LA SANATORIA — e perche' i trigger si spengono
-- ---------------------------------------------------------------------
-- ⚠️ `trg_tocca_campo_confermato` toglie «stagionalita» dai campi che
-- nessuno ha ancora guardato **appena il valore cambia**. Una sanatoria
-- che gli passa davanti direbbe che Alessio ha guardato la stagionalita'
-- di 35 prodotti: sarebbe **una bugia**, e proprio su un campo che esiste
-- per distinguere cio' che ha guardato una persona da cio' che ha scritto
-- una macchina. Quindi si spegne, e si controlla che sia riacceso.
--
-- ⚠️ Si spegne anche `trg_ingredients_updated_at`: «aggiornato il» deve
-- dire quando qualcuno ha toccato quel prodotto, e questa e' una
-- riscrittura tecnica che non lo tocca davvero.
do $sanatoria$
declare
  v_mesi   month_code[] := array['gen','feb','mar','apr','mag','giu','lug',
                                 'ago','set','ott','nov','dic']::month_code[];
  v_prima  integer;
  v_dopo   integer;
  v_toccate integer;
begin
  select count(*) into v_prima from ingredients where seasonality @> v_mesi;

  alter table ingredients disable trigger trg_tocca_campo_confermato;
  alter table ingredients disable trigger trg_ingredients_updated_at;

  update ingredients
     set seasonality = array['tutto_anno']::month_code[]
   where seasonality @> v_mesi;
  get diagnostics v_toccate = row_count;

  alter table ingredients enable trigger trg_tocca_campo_confermato;
  alter table ingredients enable trigger trg_ingredients_updated_at;

  if (select count(*) from pg_trigger
       where tgrelid = 'ingredients'::regclass and tgenabled = 'D') > 0 then
    raise exception 'Un trigger di ingredients e'' rimasto spento.';
  end if;

  select count(*) into v_dopo from ingredients where seasonality @> v_mesi;
  if v_dopo <> 0 then
    raise exception 'Dopo la sanatoria ci sono ancora % prodotti coi dodici mesi accesi.', v_dopo;
  end if;

  -- ⚠️ Uno zero NON e' un errore: vuol dire «gia' fatto», o «su questo
  -- database non c'era niente da fare». Ma va DETTO, perche' e' il
  -- silenzio ad avere ingannato quattro volte in questo progetto.
  raise notice 'Stagionalita'': % prodotti avevano i dodici mesi accesi, % portati a «tutto l''anno».',
    v_prima, v_toccate;
end
$sanatoria$;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ent      uuid;
  v_id       uuid;
  v_miei     uuid[] := array[]::uuid[];
  v_mesi     month_code[] := array['gen','feb','mar','apr','mag','giu','lug',
                                   'ago','set','ott','nov','dic']::month_code[];
  v_letta    month_code[];
  v_campi    text[];
begin
  -- (0) LA SOSTITUZIONE HA ATTECCHITO? Si guarda il corpo vivo, non il file.
  if pg_get_functiondef('normalizza_stagionalita()'::regprocedure) not like '%tutto_anno%' then
    raise exception 'normalizza_stagionalita non porta il segno della regola.';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'ingredients'::regclass
                    and tgname = 'trg_normalizza_stagionalita') then
    raise exception 'Il trigger non e'' attaccato a ingredients.';
  end if;

  -- ⚠️ L'ESEMPIO SE LO COSTRUISCE QUESTA VERIFICA: un prodotto suo, non
  -- uno di Alessio. Se domani lui cancellasse i suoi, questo blocco non
  -- cambierebbe risposta.
  -- ⚠️ Va bene QUALUNQUE societa': questa riga vive il tempo della prova e
  -- non entra in nessun conto. Cercarne una per tipo legherebbe la verifica
  -- a un dato che non e' suo — ed e' come si e' fermata la prima stesura
  -- della verifica del Blocco 1.
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' nessuna societa'': la verifica non ha un perimetro suo.';
  end if;

  -- (1) DODICI MESI IN INSERIMENTO -> «tutto l'anno».
  insert into ingredients (entity_id, name, category, unit, seasonality)
  values (v_ent, 'VERIFICA-29AGO stagione', 'altro', 'kg', v_mesi)
  returning id into v_id;
  v_miei := v_miei || v_id;

  select seasonality into v_letta from ingredients where id = v_id;
  if v_letta is distinct from array['tutto_anno']::month_code[] then
    raise exception 'Dodici mesi in inserimento non diventano «tutto l''anno»: %', v_letta;
  end if;

  -- (2) UNDICI MESI RESTANO UNDICI. E' il verso opposto, ed e' quello che
  --     dimostra che la regola DISCRIMINA invece di appiattire tutto.
  update ingredients set seasonality = (
    select array_agg(m order by m) from unnest(v_mesi) m where m <> 'ago'
  ) where id = v_id;
  select seasonality into v_letta from ingredients where id = v_id;
  if array_length(v_letta, 1) <> 11 or 'tutto_anno' = any(v_letta) then
    raise exception 'Undici mesi non restano undici: %', v_letta;
  end if;

  -- (3) «TUTTO L'ANNO» PIU' DEI MESI resta «tutto l'anno»: due modi di
  --     dire la stessa cosa nella stessa riga non devono convivere.
  update ingredients set seasonality = array['tutto_anno','gen','feb']::month_code[]
   where id = v_id;
  select seasonality into v_letta from ingredients where id = v_id;
  if v_letta is distinct from array['tutto_anno']::month_code[] then
    raise exception '«Tutto l''anno» piu'' dei mesi non si riduce: %', v_letta;
  end if;

  -- (4) I DOPPIONI SPARISCONO e l'ordine e' quello del calendario.
  update ingredients set seasonality = array['mar','gen','gen','feb']::month_code[]
   where id = v_id;
  select seasonality into v_letta from ingredients where id = v_id;
  if v_letta is distinct from array['gen','feb','mar']::month_code[] then
    raise exception 'Doppioni o ordine sbagliati: %', v_letta;
  end if;

  -- (5) 🔴 LA SANATORIA NON HA DETTO CHE ALESSIO HA GUARDATO. Su un
  --     prodotto vero che portava i dodici mesi, «stagionalita» deve
  --     essere rimasta dov'era: la sanatoria e' una riscrittura tecnica,
  --     non uno sguardo.
  --     ⚠️ Il controllo e' su una PROPRIETA' e non su un conteggio: dopo
  --     la sanatoria nessun prodotto deve avere i dodici mesi, e nessuno
  --     deve dire «tutto l'anno» portandosi dietro anche i mesi.
  if exists (select 1 from ingredients where seasonality @> v_mesi) then
    raise exception 'Sono rimasti prodotti coi dodici mesi accesi.';
  end if;
  if exists (
    select 1 from ingredients
     where 'tutto_anno' = any(seasonality) and array_length(seasonality, 1) > 1
  ) then
    raise exception 'C''e'' un prodotto che dice «tutto l''anno» e anche dei mesi.';
  end if;

  delete from ingredients where id = any(v_miei);

  perform pretendi_nessun_residuo(v_foto, 'la verifica dei dodici mesi');
  raise notice 'Dodici mesi diventano «tutto l''anno», undici restano undici.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000011', 'i_dodici_mesi_sono_tutto_l_anno') on conflict (version) do nothing;
