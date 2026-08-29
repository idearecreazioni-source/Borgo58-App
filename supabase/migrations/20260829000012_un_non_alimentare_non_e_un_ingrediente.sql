-- =====================================================================
-- UN NON ALIMENTARE NON È UN INGREDIENTE
-- 29/08/2026 — Blocco 2, punti 2a e 2c del mandato del 29/08 (sera)
-- =====================================================================
-- Decisione di Alessio, scelta esplicitamente fra due: **sezione
-- separata**, e non un filtro nella stessa schermata.
--
-- ⚠️ NON È UN SECONDO MAGAZZINO. Carta forno, detersivi e guanti hanno
-- comunque prezzo, fornitore, giacenza, entrano nella lista della spesa e
-- sono costi che finiscono nella proiezione fiscale. Quello che va tolto
-- loro è il VESTITO DA INGREDIENTE: allergeni, stagionalità, temperatura
-- attesa alla consegna, e **la possibilità di finire in una ricetta**.
--
-- ---------------------------------------------------------------------
-- MISURATO PRIMA DI SCRIVERE, sul progetto di prova
-- ---------------------------------------------------------------------
-- I non alimentari sono **4 su 133**, e portano addosso esattamente il
-- vestito che non gli serve:
--
--   nome                       stagionalità   temp. consegna   scarto
--   Carta forno                tutto l'anno   ambiente         3,00 %
--   Detergente per superfici   tutto l'anno   ambiente         3,00 %
--   Sacchetti sottovuoto       —              —                3,00 %
--   Sgrassatore per cucina     —              —                3,00 %
--
-- 🔴 «Carta forno, disponibile tutto l'anno, da consegnare a temperatura
-- ambiente, con il 3% di scarto» è una scheda che descrive un alimento e
-- parla di un rotolo di carta.
--
-- ✅ **E LA MISURA CHE DECIDEVA IL BLOCCO (punto 2b del mandato): quanti
-- non alimentari compaiono OGGI dentro una ricetta? ZERO.** Nessuna riga
-- di `recipe_ingredients` nomina un prodotto non alimentare. Quindi
-- vietarlo non toglie niente a nessun food cost — non si vieta un uso, si
-- scrive nel programma una cosa già vera. (Stessa forma della L capovolta
-- della sala, 19/08.)
--
-- ---------------------------------------------------------------------
-- 🔴 IL 2c: LA MISURA HA CORRETTO LA DIAGNOSI
-- ---------------------------------------------------------------------
-- Il mandato dice che «Fotografa l'etichetta» è rimasto sulla scheda
-- dell'ingrediente **da prima della separazione del 27/08**, e chiede di
-- misurare dove nasce oggi il prodotto comprato e di portarlo lì.
--
-- Misurato: **il prodotto comprato non nasce da nessun'altra parte.** Il
-- pulsante non è rimasto indietro — è stato **ricablato** il 27/08 dalla
-- `20260827000024`, che gli passa `ingredient_id` apposta perché il
-- prodotto si appenda all'ingrediente giusto invece di farne nascere uno
-- nuovo. Salvando, quella scheda chiama `registra_prodotto_letto`, che è
-- l'unica strada per cui una confezione entra in `articoli_fornitore`
-- partendo da una foto.
--
-- 🔴 **MA CERCANDO DOVE SPOSTARLO È SALTATO FUORI IL DIFETTO VERO, ed è
-- della stessa famiglia.** Da MEMO foto il percorso è:
--
--     /fotografa  →  «Apri la scheda di un prodotto nuovo»
--                 →  /ricettario/ingredienti/NUOVO
--                 →  create_ingredient
--
-- e `create_ingredient` **non accorpa niente**: misurato, non contiene
-- `nome_ingrediente_chiave`, non ha nessun `on conflict`, e su
-- `ingredients` **non esiste nessun indice unico sul nome**. Quindi
-- fotografare l'etichetta di una seconda marca di un prodotto che c'è già
-- fa nascere **un secondo ingrediente generico** — cioè il difetto che la
-- separazione del 27/08 era andata a togliere, rientrato dalla porta
-- principale.
--
-- ⚠️ Oggi non ha ancora morso: doppioni sul progetto di prova, **zero**.
--
-- La cura non è un vincolo — due prodotti possono legittimamente
-- chiamarsi quasi uguali, e l'accorpamento lo decide l'assistente
-- (decisione del 25/08) — è **dirlo prima di salvare, con la via
-- d'uscita**: `ingrediente_con_questo_nome()` risponde se un generico con
-- quel nome esiste già, e la scheda offre di aprirlo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Un non alimentare non entra in una ricetta
-- ---------------------------------------------------------------------
-- ⚠️ È un TRIGGER e non un `check`: il vincolo dovrebbe guardare una
-- colonna di un'altra tabella, e in Postgres un `check` non ci arriva.
create or replace function vieta_non_alimentare_in_ricetta()
returns trigger
language plpgsql
set search_path = public
as $corpo$
declare
  v_nome text;
begin
  if new.ingredient_id is null then
    return new;
  end if;

  select i.name into v_nome
    from ingredients i
   where i.id = new.ingredient_id and i.alimentare = false;

  if found then
    -- ⚠️ IL RIFIUTO DICE COSA FARE, non solo che non si può: un rifiuto
    -- senza gesto d'uscita è un vicolo cieco (regola del 16/08).
    raise exception
      '«%» non è un alimento: sta fra i materiali di consumo e non può entrare in una ricetta. Se è un alimento, togli la spunta «materiale di consumo» dalla sua scheda.',
      v_nome;
  end if;

  return new;
end;
$corpo$;

comment on function vieta_non_alimentare_in_ricetta() is
  'Carta forno e detersivi restano fuori dalle ricette. Misurato il 29/08: nessuna riga li conteneva, quindi il vincolo scrive una cosa già vera invece di vietare un uso.';

drop trigger if exists trg_vieta_non_alimentare_in_ricetta on recipe_ingredients;
create trigger trg_vieta_non_alimentare_in_ricetta
  before insert or update of ingredient_id on recipe_ingredients
  for each row execute function vieta_non_alimentare_in_ricetta();

-- ---------------------------------------------------------------------
-- 2. «Questo nome ce l'ha già qualcuno» — la via d'uscita del 2c
-- ---------------------------------------------------------------------
-- ⚠️ Confronta per CHIAVE, non per stringa: `nome_ingrediente_chiave` è la
-- stessa regola con cui l'assistente decide se accorpare, quindi «Olio
-- EVO» e «olio evo» sono lo stesso ingrediente qui come là. Due
-- definizioni diverse della stessa domanda direbbero due cose diverse
-- proprio nel momento in cui una serve a fermare l'altra.
--
-- ⚠️ Esclude le PREPARAZIONI (`preparazione_id` non vuoto): quelle non si
-- creano a mano da questa scheda, e nominarle qui manderebbe Alessio ad
-- aprire una cosa che non può modificare da lì.
create or replace function ingrediente_con_questo_nome(p_nome text)
returns table (id uuid, name text, alimentare boolean)
language sql
stable
set search_path = public
as $corpo$
  select i.id, i.name, i.alimentare
    from ingredients i
   where i.preparazione_id is null
     and nome_ingrediente_chiave(i.name) = nome_ingrediente_chiave(p_nome)
   order by i.name
   limit 5;
$corpo$;

comment on function ingrediente_con_questo_nome(text) is
  'Esiste già un ingrediente generico con questo nome? Serve alla scheda per dirlo PRIMA di salvare, invece di far nascere un doppione in silenzio.';

revoke all on function ingrediente_con_questo_nome(text) from public, anon, authenticated;
grant execute on function ingrediente_con_questo_nome(text) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ent      uuid;
  v_mat      uuid;
  v_cibo     uuid;
  v_ric      uuid;
  v_miei_i   uuid[] := array[]::uuid[];
  v_miei_r   uuid[] := array[]::uuid[];
  v_riga     uuid;
  v_respinto boolean;
  v_quanti   integer;
  v_nome     text;
begin
  -- (0) LE SOSTITUZIONI HANNO ATTECCHITO? Si guarda il corpo vivo.
  if pg_get_functiondef('vieta_non_alimentare_in_ricetta()'::regprocedure)
       not like '%materiali di consumo%' then
    raise exception 'vieta_non_alimentare_in_ricetta non porta il segno della regola.';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'recipe_ingredients'::regclass
                    and tgname = 'trg_vieta_non_alimentare_in_ricetta') then
    raise exception 'Il trigger non e'' attaccato a recipe_ingredients.';
  end if;

  -- ⚠️ IL PERIMETRO SE LO COSTRUISCE QUESTA VERIFICA: una ricetta sua, un
  -- alimento suo, un materiale suo. Se domani Alessio cancellasse tutto,
  -- questo blocco non cambierebbe risposta.
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' nessuna societa'': la verifica non ha un perimetro suo.';
  end if;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_ent, 'VERIFICA-29AGO detersivo', 'altro', 'l', false)
  returning id into v_mat;
  v_miei_i := v_miei_i || v_mat;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_ent, 'VERIFICA-29AGO farina', 'farine_cereali', 'kg', true)
  returning id into v_cibo;
  v_miei_i := v_miei_i || v_cibo;

  -- ⚠️ `recipes` NON ha `entity_id`, misurato aprendo le colonne: le
  -- ricette non appartengono a una societa'.
  insert into recipes (name, category)
  values ('VERIFICA-29AGO ricetta', 'antipasto')
  returning id into v_ric;
  v_miei_r := v_miei_r || v_ric;

  -- (1) IL CASO POSITIVO PRIMA DI TUTTO: un alimento entra. Senza, il
  --     rifiuto di sotto non dimostrerebbe che la causa e' «non e' un
  --     alimento» — potrebbe essere qualunque altro controllo.
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_cibo, 1, 'kg')
  returning id into v_riga;
  if v_riga is null then
    raise exception 'Un alimento non entra in una ricetta: la verifica sta misurando un''altra cosa.';
  end if;

  -- (2) IL MATERIALE DI CONSUMO VIENE RESPINTO.
  v_respinto := false;
  begin
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_ric, v_mat, 1, 'l');
  exception when sqlstate 'P0001' then
    v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Un materiale di consumo e'' entrato in una ricetta.';
  end if;

  -- (3) E VALE ALLO SPECCHIO: non si puo' nemmeno SPOSTARE una riga buona
  --     su un materiale di consumo. Un divieto che copre solo l'ingresso
  --     lascia aperta la porta di servizio.
  v_respinto := false;
  begin
    update recipe_ingredients set ingredient_id = v_mat where id = v_riga;
  exception when sqlstate 'P0001' then
    v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Una riga di ricetta e'' stata spostata su un materiale di consumo.';
  end if;

  -- (4) IL NOME GIA' PRESO SI TROVA, e si trova anche scritto diverso:
  --     e' la stessa chiave con cui l'assistente decide se accorpare.
  select count(*) into v_quanti from ingrediente_con_questo_nome('VERIFICA-29AGO farina');
  if v_quanti <> 1 then
    raise exception 'Il nome gia'' preso non viene trovato (trovati %).', v_quanti;
  end if;
  select count(*) into v_quanti from ingrediente_con_questo_nome('  VERIFICA-29AGO   FARINA  ');
  if v_quanti <> 1 then
    raise exception 'Il nome scritto diverso non viene riconosciuto (trovati %).', v_quanti;
  end if;

  -- (5) E UN NOME LIBERO NON DEVE DARE FALSI ALLARMI: un guardiano che
  --     grida sempre si impara a spegnere.
  select count(*) into v_quanti
    from ingrediente_con_questo_nome('VERIFICA-29AGO qualcosa che non esiste');
  if v_quanti <> 0 then
    raise exception 'Un nome libero risulta gia'' preso (trovati %).', v_quanti;
  end if;

  -- Si rimette tutto com'era: prima le figlie, poi le madri.
  delete from recipe_ingredients where recipe_id = any(v_miei_r);
  delete from recipes where id = any(v_miei_r);
  delete from ingredients where id = any(v_miei_i);

  perform pretendi_nessun_residuo(v_foto, 'la verifica dei materiali di consumo');
  raise notice 'Un materiale di consumo non entra in una ricetta, e un nome gia'' preso si dice prima di salvare.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000012', 'un_non_alimentare_non_e_un_ingrediente') on conflict (version) do nothing;
