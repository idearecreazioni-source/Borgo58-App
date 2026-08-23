-- =====================================================================
-- LA FUNZIONE RISCRITTA A MEMORIA — quattro cose perse in silenzio
-- 23/08/2026
-- =====================================================================
-- 🔴 DIFETTO MIO, e non e' nuovo: e' **la trappola del 18/08 ripetuta
-- tale e quale**. *«Una funzione si riscrive dal DATABASE, mai dal file
-- che l'ha creata»* — e stamattina, curando il pizzico nelle produzioni,
-- ho letto solo il pezzo di corpo che mi serviva e **ho ricostruito il
-- resto**. Che e' la stessa cosa, fatta peggio.
--
-- Cosa e' sparito, misurato confrontando col corpo vivo di stamattina:
--
--   1. 🔴 **IL PORTIERE**: `if auth.uid() is null then raise exception`.
--      `registra_produzione` e' `security definer` — gira senza RLS — e
--      senza quella riga chiunque avesse la chiave anon, che e' pubblica e
--      sta nel sito, avrebbe potuto muovere il magazzino.
--   2. 🔴 **IL NOME DI UN CAMPO DELLA RISPOSTA**: `righe_non_scaricate`
--      era diventato `ingredienti_mancanti`. La schermata Produzioni legge
--      `r?.righe_non_scaricate ?? 0` — quindi l'avviso «N ingredienti non
--      scaricati» avrebbe detto **zero per sempre**, senza errore.
--   3. e 4. due messaggi d'errore riscritti peggio: *«Quante dosi hai
--      fatto? Il numero serve: senza, un calo e mezza dose sono la stessa
--      cosa»* — che spiega **perche'** — era diventato una frase generica.
--
-- ⚠️ **UNA SOLA DELLE QUATTRO L'HA PRESA UNA RETE**: la prova sui permessi
-- (`funzioni_senza_portiere`), che e' diventata rossa da sola. Le altre tre
-- sarebbero passate verdi — e la seconda e' quella che in cucina avrebbe
-- fatto sparire un avviso.
--
-- ⚠️ **E LA VERIFICA DEL BLOCCO 1 NON POTEVA ACCORGERSENE**: girava come
-- proprietaria del database, dove `auth.uid()` non c'entra, e non chiamava
-- `registra_produzione`. *Un difetto che vive nei permessi si prova solo
-- dal client, col token di un utente vero* — regola del 16/08.
--
-- Qui il corpo riparte da quello vivo **di prima dell'errore**, e le sole
-- due cose che cambiano sono quelle volute: il pizzico e i prodotti fuori
-- magazzino.
-- =====================================================================

create or replace function registra_produzione(
  p_recipe_id         uuid,
  p_dosi              numeric,
  p_quantita_ottenuta numeric,
  p_scadenza          date default null,
  p_note              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ric        recipes%rowtype;
  v_ingr       uuid;
  v_prod       uuid;
  v_lotto      uuid;
  v_riga       record;
  v_lot        record;
  v_da         numeric;
  v_tolto      numeric;
  v_costo      numeric := 0;   -- il totale della produzione
  v_costo_riga numeric;        -- quanto e' costato QUESTO ingrediente
  v_quota      numeric;
  v_mancanti   integer := 0;
begin
  -- Registrare una produzione e' compito della cucina: il controllo e'
  -- che ci sia un utente vero, non che sia il titolare. Il COSTO pero'
  -- non torna indietro da qui — vive sul lotto, che lo staff non legge.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then raise exception 'Preparazione non trovata'; end if;
  if p_dosi is null or p_dosi <= 0 then
    raise exception 'Quante dosi hai fatto? Il numero serve: senza, un calo e mezza dose sono la stessa cosa';
  end if;
  if p_quantita_ottenuta is null or p_quantita_ottenuta <= 0 then
    raise exception 'Quanto ne e'' uscito? Serve il peso vero, non quello della ricetta';
  end if;

  v_ingr := ingrediente_di_preparazione(p_recipe_id);

  insert into produzioni (
    recipe_id, ingredient_id, dosi, quantita_ottenuta, unita,
    resa_attesa, scadenza, note, creato_da
  ) values (
    p_recipe_id, v_ingr, p_dosi, p_quantita_ottenuta,
    coalesce(v_ric.yield_unit::text, 'kg'),
    case when v_ric.yield_quantity is not null then v_ric.yield_quantity * p_dosi end,
    p_scadenza, p_note, auth.uid()
  )
  returning id into v_prod;

  -- Lo scarico, dai lotti che scadono prima (FEFO).
  -- ⚠️ Dal fabbisogno che salta i prodotti fuori magazzino (23/08): senza,
  -- un ragu' scaricherebbe la cannella che la sala non scarica, e i due
  -- posti direbbero due cose diverse.
  for v_riga in
    select f.ingredient_id, f.quantita from fabbisogno_preparazione_seguito(p_recipe_id, p_dosi) f
  loop
    v_da := v_riga.quantita;
    v_tolto := 0;
    v_costo_riga := 0;

    for v_lot in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = v_riga.ingredient_id and quantity_remaining > 0
       order by expiry_date asc nulls last, received_at asc
       for update
    loop
      exit when v_da <= 0;
      v_quota := least(v_lot.quantity_remaining, v_da);
      update stock_lots set quantity_remaining = quantity_remaining - v_quota where id = v_lot.id;
      v_tolto      := v_tolto + v_quota;
      v_costo_riga := v_costo_riga + v_quota * coalesce(v_lot.unit_cost, 0);
      v_da         := v_da - v_quota;
    end loop;

    v_costo := v_costo + v_costo_riga;

    -- 🔴 Come nello scarico di un conto: sotto il decimo di grammo non
    -- c'e' nessun numero da scrivere (23/08).
    if not pizzico_trascurabile(v_tolto) then
      insert into stock_consumptions
        (ingredient_id, quantity, reason, note, produzione_id, quantita_richiesta, costo)
      values
        (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
         'Produzione: ' || v_ric.name, v_prod, v_riga.quantita,
         round(v_costo_riga, 4));
    end if;

    -- Non si inventa e non si blocca: il semilavorato e' gia' fatto.
    if not pizzico_trascurabile(v_da) then
      v_mancanti := v_mancanti + 1;
      insert into anomalie_scarico
        (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
      values
        (v_prod, v_riga.ingredient_id, 'giacenza_insufficiente',
         (select name from ingredients where id = v_riga.ingredient_id),
         round(v_da, 4));
    end if;
  end loop;

  -- Il lotto del semilavorato, col costo di oggi.
  insert into stock_lots (
    ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note
  ) values (
    v_ingr, p_quantita_ottenuta, p_quantita_ottenuta,
    round(v_costo / p_quantita_ottenuta, 4), p_scadenza,
    'Produzione del ' || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
  )
  returning id into v_lotto;

  update produzioni set lotto_id = v_lotto, costo = round(v_costo, 4) where id = v_prod;

  -- Niente costi nella risposta: la chiama anche la cucina.
  -- ⚠️ I NOMI DEI CAMPI SONO UN PATTO CON LA SCHERMATA: `Produzioni.jsx`
  -- legge `righe_non_scaricate`, e rinominarlo non da' nessun errore —
  -- l'avviso direbbe zero per sempre.
  return jsonb_build_object(
    'produzione_id', v_prod,
    'lotto_id', v_lotto,
    'quantita', p_quantita_ottenuta,
    'righe_non_scaricate', v_mancanti
  );
end;
$funzione$;

revoke all on function registra_produzione(uuid, numeric, numeric, date, text) from public, anon, authenticated;
grant execute on function registra_produzione(uuid, numeric, numeric, date, text) to authenticated;


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_def text;
  v_tit uuid;
begin
  -- ⚠️ `funzioni_senza_portiere()` ha un portiere, e una migrazione non ha
  -- un utente: si impersona il titolare (trappola del 16/08).
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registra_produzione';

  -- 1. Il portiere e' tornato. ⚠️ Si legge il CORPO VIVO, non si spera:
  --    e' la stessa cosa che questa migrazione esiste per riparare.
  if position('auth.uid() is null' in v_def) = 0 then
    raise exception 'Il portiere non e'' tornato al suo posto.';
  end if;

  -- 2. Il patto con la schermata.
  if position('righe_non_scaricate' in v_def) = 0 then
    raise exception 'La risposta non porta piu'' righe_non_scaricate: la schermata Produzioni direbbe zero per sempre.';
  end if;
  if position('''quantita'', p_quantita_ottenuta' in v_def) = 0 then
    raise exception 'La risposta non porta piu'' la quantita'' prodotta.';
  end if;

  -- 3. E le due cose volute ci sono ancora.
  if position('fabbisogno_preparazione_seguito' in v_def) = 0 then
    raise exception 'La produzione non salta piu'' i prodotti fuori magazzino.';
  end if;
  if position('pizzico_trascurabile' in v_def) = 0 then
    raise exception 'La produzione non ha piu'' la cura del pizzico.';
  end if;

  -- 4. E la rete lo conferma dal suo lato: non e' piu' fra le funzioni
  --    che scavalcano la RLS senza chiedere chi sei.
  if exists (
    select 1 from funzioni_senza_portiere() f where f.nome = 'registra_produzione'
  ) then
    raise exception 'La rete dei permessi la vede ancora senza portiere.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: portiere al suo posto, patto con la schermata intatto, e le due cure ci sono.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000005', 'la_funzione_riscritta_a_memoria') on conflict (version) do nothing;
