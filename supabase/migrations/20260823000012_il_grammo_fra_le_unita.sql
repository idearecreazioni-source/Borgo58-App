-- =====================================================================
-- IL GRAMMO FRA LE UNITA', E LA SOGLIA CHE SI DICHIARA
-- 23/08/2026
-- =====================================================================
-- Blocco 2 del mandato del 23/08. Entra **dentro** la protezione del
-- blocco 1, che non viene toccata: da oggi kg e g sono l'unica coppia
-- convertibile, e la conversione avviene solo se non perde nessun numero.
--
-- ---------------------------------------------------------------------
-- PERCHE' I GRAMMI E NON LE BUSTINE NE' I MILLIGRAMMI (deciso da Alessio)
-- ---------------------------------------------------------------------
-- Le bustine danno piu' margine (667 volte contro 67) ma **legano al
-- formato**: cambiando fornitore o taglia i conti vanno rifatti. I grammi
-- sono universali, il prezzo resta leggibile (zafferano 2,40 al grammo) e
-- 67 volte sul caso peggiore e' ampio — servirebbe una ricetta da cento
-- volte piu' porzioni per tornare al limite.
--
-- 🔴 E NON IL MILLIGRAMMO, per una ragione che non si puo' correggere
-- dopo: **un valore di enum non si toglie**. In mg tutti i prezzi si
-- vedrebbero «0,00 EUR» — misurato il 23/08 su nove spezie su nove, sale
-- e zafferano compresi. Si aggiunge il grammo e basta.
--
-- ---------------------------------------------------------------------
-- 🔴 LA SOGLIA, CHE E' LA META' PIU' IMPORTANTE DI QUESTO BLOCCO
-- ---------------------------------------------------------------------
-- Il limite e' **0,0001 in qualunque unita'**, e non e' una proprieta'
-- dell'unita': sta nei CAMPI. `recipe_ingredients.quantity`,
-- `stock_lots.quantity_remaining` e `stock_consumptions.quantity` sono
-- tutti `numeric(12,4)`.
--
-- ⚠️ E morde **gia' nella riga di ricetta**, prima di ogni scarico. E'
-- il difetto della cannella alla radice: un fabbisogno che non entra nel
-- campo diventa zero, e da li' in poi tutto il resto e' coerente con uno
-- zero che nessuno ha scritto.
--
-- **Misurato, non dedotto** (23/08, progetto di prova): scrivendo 0,00003
-- in una riga di ricetta il database ha conservato **0,0000**, senza
-- errore e senza avviso.
--
-- 🔴 E UN TRIGGER NON PUO' DISTINGUERE «zero scritto» da «zero
-- arrotondato»: misurato con una spia: messo un trigger BEFORE INSERT
-- davanti a quella colonna, davanti a un 0,00003 **il trigger vede gia'
-- 0.0000**. L'arrotondamento avviene nella coercizione al tipo della
-- colonna, cioe' PRIMA che qualunque nostro codice possa guardare.
--
-- ⚠️ Quindi la cura non e' distinguere i due casi: e' **rifiutarli
-- entrambi**, che e' anche giusto nel merito — una riga di ricetta con
-- quantita' zero non ha senso comunque. Il messaggio li nomina tutti e
-- due, perche' chi lo legge sappia in quale dei due si trova.
--
-- ⚠️ **Nessuna sanatoria**, e la ragione e' misurata: righe di ricetta a
-- zero **0 su 317**, scarichi a zero **0**, righe di lista a zero **0**,
-- produzioni a zero **0**. La quantita' piu' piccola che esiste oggi e'
-- **0,0002 kg** — due volte il limite, che e' quanto stretto sia il
-- margine senza i grammi.
--
-- ---------------------------------------------------------------------
-- ⚠️ COSA QUESTO BLOCCO NON CHIUDE, e va detto
-- ---------------------------------------------------------------------
-- Il rifiuto e' sulla **riga di ricetta**, che e' dove il mandato dice
-- che morde e dove il difetto della cannella e' nato. Gli altri posti in
-- cui una quantita' puo' arrotondarsi a zero:
--
--   * `stock_lots.quantity_received` — gia' protetto da un check `> 0`
--     dal primo giorno, ma con un messaggio da database;
--   * `stock_consumptions.quantity` — e' una **conseguenza**, non un dato
--     scritto a mano: nasce dal fabbisogno, che ora e' protetto a monte;
--   * `shopping_list_items.quantity_needed` — un ordine da zero e' inutile
--     ma non falso, e la riga si vede.
--
-- *Un limite dichiarato e' una scelta; uno taciuto e' una trappola.*
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il grammo entra nel vocabolario
-- ---------------------------------------------------------------------
-- ⚠️ SU UNA RIGA SUA, fuori da qualunque blocco che poi lo adopera: un
-- valore di enum non e' usabile nella stessa TRANSAZIONE in cui viene
-- aggiunto. In un file applicato da psql ogni istruzione si chiude da se',
-- quindi qui basta che stia da sola (precisazione del 19/08, che corregge
-- la regola scritta piu' larga del vero).
alter type unit_type add value if not exists 'g';

-- ---------------------------------------------------------------------
-- 2. Una quantita' che non entra nel campo si dichiara, non si scrive
-- ---------------------------------------------------------------------
create or replace function vieta_quantita_che_sparisce()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_nome  text;
  v_unita text;
begin
  if new.quantity > 0 then
    return new;
  end if;

  select i.name, i.unit::text into v_nome, v_unita
    from ingredients i where i.id = new.ingredient_id;

  -- ⚠️ IL MESSAGGIO NOMINA TUTTI E DUE I CASI, perche' il database non
  -- puo' saperne di piu': davanti a un 0,00003 vede gia' 0,0000, quindi
  -- «hai scritto zero» e «hai scritto un numero troppo piccolo» qui sono
  -- lo stesso fatto. Chi legge sa in quale dei due si trova.
  --
  -- ⚠️ E la via d'uscita c'e' SOLO quando esiste davvero: proporre i
  -- grammi a chi e' gia' in grammi sarebbe un consiglio che non si puo'
  -- seguire — un vicolo cieco travestito da aiuto.
  raise exception using
    errcode = 'P0001',
    message =
      format('La quantità di %s non può essere zero. ', coalesce(v_nome, 'questo ingrediente'))
      || case
           when v_unita = 'kg' then
             'E se hai scritto un numero più piccolo di 0,0001 kg (un decimo di grammo), '
             || 'il gestionale non riesce a conservarlo e lo ridurrebbe a zero — che poi '
             || 'vuol dire che dal magazzino non scenderebbe niente. '
             || 'Per le spezie e i prodotti da pizzico, cambia l''unità del prodotto in grammi: '
             || 'lì lo stesso pizzico si scrive senza perderlo.'
           when v_unita = 'g' then
             'E se hai scritto un numero più piccolo di 0,0001 g (un decimo di milligrammo), '
             || 'il gestionale non riesce a conservarlo e lo ridurrebbe a zero. '
             || 'Sotto quella soglia non c''è un''unità più piccola: se la quantità è davvero '
             || 'così, conviene metterla nella preparazione che la contiene invece che nel piatto.'
           else
             'E se hai scritto un numero più piccolo di 0,0001, il gestionale non riesce a '
             || 'conservarlo e lo ridurrebbe a zero.'
         end;
end $trigger$;

revoke all on function vieta_quantita_che_sparisce() from public, anon, authenticated;

drop trigger if exists trg_vieta_quantita_che_sparisce on recipe_ingredients;
create trigger trg_vieta_quantita_che_sparisce
  before insert or update of quantity on recipe_ingredients
  for each row execute function vieta_quantita_che_sparisce();

comment on column recipe_ingredients.quantity is
  'Quanto ne serve, nell''unità dell''ingrediente. ⚠️ È numeric(12,4): sotto 0,0001 il numero non entra nel campo e diventerebbe zero, quindi un trigger lo rifiuta invece di scriverlo (23/08/2026). È il difetto della cannella alla radice — un fabbisogno che vale zero non scarica niente, e tutto il resto resta coerente con uno zero che nessuno ha scritto.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente    uuid;
  v_ric     uuid;
  v_ing     uuid;
  v_riga    uuid;
  v_q       numeric;
  v_passato boolean;
  v_motivo  text;
  v_lapidi  int;
  v_lapidi2 int;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- ===== 1. Il grammo c'e' ed e' usabile.
  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ prova grammo', 'spezie_aromi', 'g', 2.4000)
  returning id into v_ing;

  if (select unit from ingredients where id = v_ing) <> 'g' then
    raise exception 'Il grammo non e'' entrato nel vocabolario.';
  end if;

  -- ===== 2. 🔴 LA CONVERSIONE VERA, che il blocco 1 non poteva provare:
  -- =====    kg e g sono l'unica coppia convertibile.
  if unita_conversione('kg', 'g') <> 1000 or unita_conversione('g', 'kg') <> 0.001 then
    raise exception 'La conversione fra chili e grammi non e'' quella giusta.';
  end if;
  if unita_conversione('g', 'l') is not null or unita_conversione('g', 'pz') is not null then
    raise exception 'Il grammo si converte in qualcosa in cui non si converte.';
  end if;

  -- ===== 3. 🔴 IL RAMO CHE CONVERTE, mai girato prima di oggi.
  -- =====    Un prodotto a 12,50 al kg con un lotto da 2 kg: tutti numeri
  -- =====    che reggono il viaggio, quindi il cambio deve PASSARE e i
  -- =====    numeri devono seguirlo.
  declare
    v_conv  uuid;
    v_lotto uuid;
    v_prezzo numeric;
  begin
    insert into ingredients (entity_id, name, category, unit, current_price,
                             stock_minimum_threshold)
    values (v_ente, 'ZZ prova conversione', 'spezie_aromi', 'kg', 12.5000, 1.0000)
    returning id into v_conv;

    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
    values (v_conv, 2.0000, 2.0000, 12.5000)
    returning id into v_lotto;

    update ingredients set unit = 'g' where id = v_conv;

    if (select unit from ingredients where id = v_conv) <> 'g' then
      raise exception 'Un cambio da chili a grammi con numeri esatti e'' stato rifiutato.';
    end if;

    -- La quantita' si MOLTIPLICA: 2 kg sono 2000 g.
    select quantity_remaining into v_q from stock_lots where id = v_lotto;
    if v_q <> 2000 then
      raise exception 'La giacenza non ha seguito l''unita'': % invece di 2000.', v_q;
    end if;

    -- Il prezzo si DIVIDE: 12,50 al kg sono 0,0125 al grammo.
    select current_price into v_prezzo from ingredients where id = v_conv;
    if v_prezzo <> 0.0125 then
      raise exception 'Il prezzo non ha seguito l''unita'': % invece di 0,0125.', v_prezzo;
    end if;

    -- ⚠️ E il costo del lotto anche: se restasse 12,50 al grammo, quel
    -- lotto varrebbe 25.000 euro invece di 25.
    select unit_cost into v_prezzo from stock_lots where id = v_lotto;
    if v_prezzo <> 0.0125 then
      raise exception 'Il costo del lotto non ha seguito l''unita'': %.', v_prezzo;
    end if;

    -- E la scorta minima: 1 kg sono 1000 g.
    select stock_minimum_threshold into v_q from ingredients where id = v_conv;
    if v_q <> 1000 then
      raise exception 'La scorta minima non ha seguito l''unita'': %.', v_q;
    end if;

    -- ===== 4. E TORNANDO INDIETRO i numeri tornano quelli di prima:
    -- =====    e' la controprova che la conversione non perde niente.
    update ingredients set unit = 'kg' where id = v_conv;

    select quantity_remaining into v_q from stock_lots where id = v_lotto;
    if v_q <> 2 then
      raise exception 'Tornando ai chili la giacenza non e'' tornata 2: %.', v_q;
    end if;
    select current_price into v_prezzo from ingredients where id = v_conv;
    if v_prezzo <> 12.5 then
      raise exception 'Tornando ai chili il prezzo non e'' tornato 12,50: %.', v_prezzo;
    end if;

    delete from stock_lots where id = v_lotto;
    delete from ingredients where id = v_conv;
  end;

  -- ===== 5. 🔴 LA SOGLIA: una quantita' che sparirebbe viene RIFIUTATA.
  select id into v_ric from recipes limit 1;
  if v_ric is not null then
    v_passato := false;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
      values (v_ric, v_ing, 0.00003, 'g') returning id into v_riga;
      v_passato := true;
    exception when sqlstate 'P0001' then
      v_motivo := sqlerrm;
    end;

    if v_passato then
      delete from recipe_ingredients where id = v_riga;
      raise exception 'Una quantita'' che il campo non sa conservare e'' stata scritta come zero.';
    end if;
    if v_motivo not like '%non può essere zero%' then
      raise exception 'Il rifiuto non spiega cosa e'' successo: %', v_motivo;
    end if;

    -- ⚠️ E il messaggio deve dare la via d'uscita GIUSTA per l'unita' in
    -- cui ci si trova: qui siamo gia' in grammi, quindi proporre i grammi
    -- sarebbe un consiglio che non si puo' seguire.
    if v_motivo like '%cambia l''unità del prodotto in grammi%' then
      raise exception 'A un prodotto gia'' in grammi viene proposto di passare ai grammi.';
    end if;

    -- 🔴 E DEVE DIRE LA COSA GIUSTA, non solo tacere quella sbagliata.
    -- Trovato rompendo: spegnendo il ramo dei grammi il messaggio cadeva
    -- nel caso generico, la via d'uscita spariva del tutto, e il controllo
    -- qui sopra restava verde — perche' controllava un'assenza. *Una prova
    -- che verifica solo cio' che NON deve esserci passa anche quando non
    -- c'e' piu' niente.*
    if v_motivo not like '%preparazione che la contiene%' then
      raise exception 'A un prodotto in grammi non viene detta nessuna via d''uscita: %', v_motivo;
    end if;

    -- ===== 6. Ma una quantita' che il campo CONSERVA passa: il rifiuto
    -- =====    non deve essere «tutto cio' che e' piccolo».
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_ric, v_ing, 0.0371, 'g') returning id into v_riga;

    select quantity into v_q from recipe_ingredients where id = v_riga;
    if v_q <> 0.0371 then
      raise exception 'Una quantita'' che il campo conserva e'' stata cambiata: %.', v_q;
    end if;
    delete from recipe_ingredients where id = v_riga;

    -- ===== 7. E la via d'uscita e' quella giusta per un prodotto in kg.
    v_motivo := null;
    begin
      insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
      select v_ric, i.id, 0.00003, 'kg' from ingredients i
       where i.active and i.unit = 'kg' limit 1;
    exception when sqlstate 'P0001' then
      v_motivo := sqlerrm;
    end;

    if v_motivo is null then
      raise exception 'Su un prodotto in chili la soglia non viene fatta rispettare.';
    end if;
    if v_motivo not like '%in grammi%' then
      raise exception 'A un prodotto in chili non viene proposta l''unita'' piu'' piccola: %', v_motivo;
    end if;
  end if;

  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: il grammo c''è, la conversione regge nei due versi, e una quantità che sparirebbe viene rifiutata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000012', 'il_grammo_fra_le_unita') on conflict (version) do nothing;
