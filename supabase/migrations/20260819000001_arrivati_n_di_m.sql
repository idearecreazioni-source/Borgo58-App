-- ARRIVATI N DI M — la riga della lista sa quanto ne è arrivato
-- =====================================================================
-- Blocco 1 del mandato «la lista non scrive mai un'uscita»
-- (docs/mandati/20260817_la_lista_non_scrive_uscite.md, deciso da Alessio
-- il 17/08/2026; ampiezza confermata il 19/08).
--
-- IL PROBLEMA, in una riga: oggi `shopping_list_items` non conserva quanto
-- è arrivato. Se in lista ci sono 20 kg di pomodoro e la fattura ne porta
-- 5, il gestionale non ha nessun posto dove scriverlo — quindi o la riga
-- resta uguale (e sembra che non sia arrivato niente) o sparisce (e restano
-- 15 kg da comprare che nessuno comprerà). ⚠️ «20 in lista, 5 in fattura»
-- è la NORMALITÀ coi fornitori, non un'eccezione.
--
-- ⚠️ PERCHÉ ADESSO E NON FRA UN MESE — misurato in produzione, in sola
-- lettura, il 19/08: `shopping_list_items` ha **2 righe**, entrambe
-- «ordinata», **nessuna chiusa**, **nessuna** con un mezzo di pagamento.
-- Oggi la colonna non costa niente. Fra un mese sarebbe la stessa
-- migrazione **più** una sanatoria **più** il dubbio su cosa fare delle
-- righe già chiuse — e quel dubbio non ha una risposta giusta.
--
-- IL COMPORTAMENTO, deciso da Alessio:
--   · arrivo PARZIALE  → la riga **resta aperta**, dice «arrivati 5 di 20»
--     e **propone** la chiusura. Non si chiude da sola e **non si riscrive
--     a 15 senza dirlo**: il gestionale segnala, lui decide.
--   · arrivo COMPLETO  → la riga si chiude da sé. Non c'è niente da
--     decidere: quello che serviva è arrivato tutto.
--   ⚠️ Le due righe qui sopra sciolgono l'unica ambiguità del mandato, che
--   in un punto dice «la riga si chiude da sé» e in un altro «propone la
--   chiusura». Sono due casi diversi, non due regole in conflitto.
--
-- ⚠️ E NESSUNO DEI DUE SCRIVE UN'USCITA, che è il principio del mandato:
-- la merce arrivata con un documento ha già il suo costo nel documento.
-- Il costo nasce **solo** dal documento o da una registrazione esplicita
-- di Alessio (i tre esiti a mano — blocco 2 di questo mandato).

-- ---------------------------------------------------------------------
-- 1 · La colonna
-- ---------------------------------------------------------------------
-- ⚠️ NASCE `null`, NON ZERO, ed è la lezione del 14/08: un predefinito è
-- una risposta, e su righe già esistenti è una risposta data da chi scrive
-- la migrazione al posto di chi usa il gestionale. `null` = «nessuna
-- consegna abbinata»; `0` direbbe «è arrivato, ed era zero». Sono due
-- cose diverse, e la prima è quella vera per le 2 righe che ci sono.
alter table shopping_list_items
  add column if not exists quantita_arrivata numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'shopping_list_items'::regclass
      and conname = 'shopping_list_items_quantita_arrivata_check'
  ) then
    alter table shopping_list_items
      add constraint shopping_list_items_quantita_arrivata_check
      check (quantita_arrivata is null or quantita_arrivata >= 0);
  end if;
end $$;

comment on column shopping_list_items.quantita_arrivata is
  'Quanto ne è arrivato finora, sommato dai carichi. null = nessuna consegna abbinata (diverso da «ne è arrivato zero»). Non si tocca mai quantity_needed: la riga dice «arrivati 5 di 20», non si riscrive a 15.';

-- ---------------------------------------------------------------------
-- 2 · La merce che entra spegne la voce della lista
-- ---------------------------------------------------------------------
-- ⚠️ QUALE RIGA RICEVE L'ARRIVO, dichiarato perché non è ovvio: la **più
-- vecchia ancora aperta** di quell'ingrediente, per intero. Se ce ne sono
-- due, la seconda non viene toccata. Spalmare l'arrivo su più righe
-- sarebbe una regola inventata da noi su come Alessio compra — e la
-- lista è sua.
--
-- ⚠️ SENZA `quantity_needed` NON SI PUÒ DIRE «COMPLETO»: la riga registra
-- l'arrivo e resta aperta. Chiuderla vorrebbe dire sapere quanto ne
-- serviva, e quel numero non c'è.
create or replace function registra_arrivo_in_lista(
  p_ingredient_id uuid,
  p_quantita      numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga shopping_list_items;
  v_tot  numeric;
begin
  if p_ingredient_id is null or p_quantita is null or p_quantita <= 0 then
    return null;
  end if;

  select * into v_riga
    from shopping_list_items
   where ingredient_id = p_ingredient_id
     and status in ('da_comprare', 'ordinata')
   order by created_at
   limit 1;

  if v_riga.id is null then
    return null;
  end if;

  v_tot := coalesce(v_riga.quantita_arrivata, 0) + p_quantita;

  update shopping_list_items
     set quantita_arrivata = v_tot,
         -- L'arrivo completo chiude la riga. ⚠️ Nessun importo e nessun
         -- mezzo di pagamento: il costo di questa merce sta nel documento
         -- che l'ha portata, e la lista non scrive mai un'uscita.
         status = case
                    when v_riga.quantity_needed is not null
                     and v_tot >= v_riga.quantity_needed then 'acquistato'
                    else status
                  end,
         purchased_at = case
                          when v_riga.quantity_needed is not null
                           and v_tot >= v_riga.quantity_needed then now()
                          else purchased_at
                        end
   where id = v_riga.id;

  return v_riga.id;
end;
$$;

revoke all on function registra_arrivo_in_lista(uuid, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3 · Il carico chiama l'arrivo
-- ---------------------------------------------------------------------
-- ⚠️ RISCRITTA DAL DATABASE, NON DAL FILE CHE L'AVEVA CREATA (regola del
-- 18/08): fra i due ci stanno tutte le migrazioni che l'hanno toccata, e
-- ricopiare dall'originale annullerebbe in silenzio ciò che è stato
-- aggiunto dopo. Il corpo qui sotto è quello vivo del 19/08 più la
-- chiamata nuova.
--
-- ⚠️ È PIÙ LARGO DI QUANTO IL MANDATO CHIEDA, e va detto: il mandato parla
-- del **carico da fattura**, e questa è la porta da cui passano il carico
-- da fattura **e** la registrazione a mano di una consegna. Sono lo stesso
-- fatto — *è arrivata merce* — e ticchettare la lista in un caso solo
-- vorrebbe dire che registrare una consegna a mano lascia in lista roba
-- che è già in cella.
create or replace function register_stock_delivery(
  p_ingredient_id         uuid,
  p_quantity              numeric,
  p_supplier_id           uuid    default null,
  p_expiry_date           date    default null,
  p_note                  text    default null,
  p_unit_cost             numeric default null,
  p_supplier_batch_number text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  -- Invariato: lo staff registra una consegna, ma non ne scrive il costo.
  -- Non è un controllo di schermata che si possa aggirare.
  if p_unit_cost is not null and not is_titolare() then
    raise exception 'Solo il titolare può registrare il costo di un carico';
  end if;

  insert into stock_lots (
    ingredient_id, supplier_id, quantity_received, quantity_remaining,
    unit_cost, expiry_date, note, supplier_batch_number
  )
  values (
    p_ingredient_id, p_supplier_id, p_quantity, p_quantity,
    p_unit_cost, p_expiry_date, p_note, nullif(p_supplier_batch_number, '')
  )
  returning id into v_id;

  -- La lista della spesa smette di chiedere ciò che è appena entrato.
  perform registra_arrivo_in_lista(p_ingredient_id, p_quantity);

  return v_id;
end;
$$;

revoke all on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text)
  from public, anon;
grant execute on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4 · La chiusura proposta: «è arrivato, chiudo la riga»
-- ---------------------------------------------------------------------
-- ⚠️ È LA VIA DEL DOCUMENTO, e si distingue dai tre esiti a mano (blocco
-- 2) proprio in questo: **non scrive nessun costo e non carica nessun
-- lotto**. Il lotto c'è già — l'ha creato il carico — e il costo sta nella
-- fattura. Chiudere qui vuol dire solo «non me ne serve altro».
--
-- ⚠️ E SI RIFIUTA SE NON È ARRIVATO NIENTE, col messaggio che dice cosa
-- fare al posto suo: una riga senza arrivi si chiude dai tre esiti, non
-- da qui. Un rifiuto senza via d'uscita è un vicolo cieco (regola del
-- 16/08).
create or replace function chiudi_riga_arrivata(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga shopping_list_items;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può chiudere una riga della lista della spesa';
  end if;

  select * into v_riga from shopping_list_items where id = p_item_id;
  if v_riga.id is null then
    raise exception 'Riga non trovata';
  end if;
  if v_riga.status = 'acquistato' then
    raise exception 'Questa riga è già chiusa';
  end if;
  if coalesce(v_riga.quantita_arrivata, 0) <= 0 then
    raise exception 'Di questa riga non è ancora arrivato niente: chiudila dicendo com''è andata (comprata, avuta gratis, o non presa)';
  end if;

  update shopping_list_items
     set status = 'acquistato',
         purchased_at = now()
   where id = p_item_id;
end;
$$;

revoke all on function chiudi_riga_arrivata(uuid) from public, anon;
grant execute on function chiudi_riga_arrivata(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · I due elenchi che la schermata legge
-- ---------------------------------------------------------------------
-- ⚠️ `lista_spesa()` si CANCELLA e si ricrea: cambia il tipo restituito, e
-- Postgres non lo permette con un `create or replace`. Dopo un `drop` i
-- permessi tornano aperti al mondo (trappola del 13/08) → si richiudono a
-- mano, e la verifica lo controlla.
drop function if exists lista_spesa();

create function lista_spesa()
returns table (
  id                   uuid,
  ingredient_id        uuid,
  nome                 text,
  unita                text,
  quantita_da_comprare numeric,
  origine              text,
  stato                text,
  nota                 text,
  supplier_id          uuid,
  fornitore            text,
  in_lista_dal         timestamptz,
  giacenza             numeric,
  soglia               numeric,
  mancante             numeric,
  rientrata            boolean,
  quantita_arrivata    numeric,
  arrivo_parziale      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro.
  -- Qui escono nomi di fornitori e quantita' d'acquisto.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere la lista della spesa completa';
  end if;

  return query
  select
    sli.id,
    sli.ingredient_id,
    coalesce(i.name, sli.custom_name)::text,
    coalesce(sli.unit, i.unit)::text,
    sli.quantity_needed,
    sli.source::text,
    sli.status::text,
    sli.note,
    sli.supplier_id,
    f.name::text,
    -- La giacenza si legge dalla stessa vista che usa il Magazzino: due
    -- conteggi diversi finirebbero per dire due numeri diversi davanti
    -- allo stesso prodotto.
    sli.created_at,
    v.current_quantity,
    i.stock_minimum_threshold,
    case
      when i.stock_minimum_threshold is null then null
      else greatest(i.stock_minimum_threshold - coalesce(v.current_quantity, 0), 0)
    end,
    -- «Rientrata»: la riga e' nata perche' mancava, e adesso ce n'e'
    -- abbastanza. Non si cancella da sola — la lista e' di Alessio, e il
    -- sistema propone senza decidere — ma smette di far comprare roba
    -- che c'e' gia'.
    (sli.source = 'soglia_minima'
     and sli.status = 'da_comprare'
     and i.stock_minimum_threshold is not null
     and coalesce(v.current_quantity, 0) >= i.stock_minimum_threshold),
    sli.quantita_arrivata,
    -- «Arrivato in parte»: ne è arrivato qualcosa ma non abbastanza. È il
    -- caso in cui la schermata propone la chiusura invece di deciderla.
    (sli.status <> 'acquistato'
     and coalesce(sli.quantita_arrivata, 0) > 0
     and (sli.quantity_needed is null
          or sli.quantita_arrivata < sli.quantity_needed))
  from shopping_list_items sli
  left join ingredients i    on i.id = sli.ingredient_id
  left join suppliers f      on f.id = sli.supplier_id
  left join v_stock_levels v on v.ingredient_id = sli.ingredient_id
  order by
    case sli.status when 'da_comprare' then 0 when 'ordinata' then 1 else 2 end,
    sli.created_at desc;
end;
$$;

revoke all on function lista_spesa() from public, anon;
grant execute on function lista_spesa() to authenticated;

-- La vista dello staff: colonne SOLO IN FONDO (42P16), e nessun importo.
-- Quanto ne è arrivato non è un dato economico — è la stessa cosa che si
-- legge sullo scaffale.
create or replace view shopping_list_display as
select
  sli.id,
  sli.ingredient_id,
  i.name as ingredient_name,
  i.unit as ingredient_unit,
  sli.custom_name,
  sli.supplier_id,
  s.name as supplier_name,
  sli.quantity_needed,
  sli.unit,
  sli.source,
  sli.status,
  sli.note,
  sli.created_at,
  sli.status = 'acquistato' as is_purchased,
  sli.quantita_arrivata
from shopping_list_items sli
  left join ingredients i on i.id = sli.ingredient_id
  left join suppliers s on s.id = sli.supplier_id;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_ingr     uuid;
  v_riga     uuid;
  v_riga2    uuid;
  v_lotto    uuid;
  v_stato    text;
  v_arrivata numeric;
  v_lapidi   integer;
  respinto   boolean := false;
  v_sl       shopping_list_items;
begin
  select count(*) into v_lapidi from deleted_records;

  -- ⚠️ IL PERIMETRO È FATTO DI ROBA CHE LA VERIFICA HA CREATO (lezione del
  -- 16/08): un ingrediente vero avrebbe altri lotti, e FEFO non prende
  -- quello di prova — si finisce per lasciare la giacenza vera storta.
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then
    raise exception 'Non esiste nessuna entita'': la verifica non puo'' creare il suo perimetro.';
  end if;

  insert into ingredients (entity_id, name, unit, category)
  values (v_ente, 'VERIFICA arrivi lista', 'kg', 'altro')
  returning id into v_ingr;

  -- --- Arrivo PARZIALE: la riga resta aperta e conta ---
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 20, 'kg', 'manuale')
  returning id into v_riga;

  select register_stock_delivery(
    p_ingredient_id => v_ingr, p_quantity => 5, p_note => 'VERIFICA'
  ) into v_lotto;

  select status, quantita_arrivata into v_stato, v_arrivata
    from shopping_list_items where id = v_riga;
  if v_arrivata is distinct from 5 then
    raise exception 'Arrivo parziale: la riga dice % invece di 5.', v_arrivata;
  end if;
  if v_stato = 'acquistato' then
    raise exception 'Arrivo parziale: la riga si e'' chiusa da sola.';
  end if;
  -- ⚠️ E il fabbisogno NON si riscrive: la riga dice «arrivati 5 di 20»,
  -- non diventa una riga da 15.
  if (select quantity_needed from shopping_list_items where id = v_riga) <> 20 then
    raise exception 'Arrivo parziale: il fabbisogno e'' stato riscritto.';
  end if;

  -- --- Il secondo arrivo si SOMMA, e completa ---
  perform register_stock_delivery(
    p_ingredient_id => v_ingr, p_quantity => 15, p_note => 'VERIFICA'
  );
  select status, quantita_arrivata into v_stato, v_arrivata
    from shopping_list_items where id = v_riga;
  if v_arrivata is distinct from 20 then
    raise exception 'Secondo arrivo: la riga dice % invece di 20.', v_arrivata;
  end if;
  if v_stato <> 'acquistato' then
    raise exception 'Arrivo completo: la riga e'' rimasta aperta (stato %).', v_stato;
  end if;
  -- ⚠️ E NESSUN COSTO: la lista non scrive mai un'uscita. Il costo di
  -- questa merce sta nel documento che l'ha portata.
  select * into v_sl from shopping_list_items where id = v_riga;
  if v_sl.purchased_amount is not null or v_sl.payment_method is not null then
    raise exception 'La chiusura dal carico ha scritto un importo o un mezzo di pagamento.';
  end if;

  -- --- Una riga chiusa non riceve piu' arrivi: li prende la successiva ---
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 3, 'kg', 'manuale')
  returning id into v_riga2;
  perform register_stock_delivery(
    p_ingredient_id => v_ingr, p_quantity => 1, p_note => 'VERIFICA'
  );
  if (select quantita_arrivata from shopping_list_items where id = v_riga) <> 20 then
    raise exception 'Un arrivo e'' finito su una riga gia'' chiusa.';
  end if;
  if (select quantita_arrivata from shopping_list_items where id = v_riga2) <> 1 then
    raise exception 'L''arrivo non e'' finito sulla riga aperta.';
  end if;

  -- --- «Chiudo la riga»: si puo' se e' arrivato qualcosa ---
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);
  perform chiudi_riga_arrivata(v_riga2);
  if (select status from shopping_list_items where id = v_riga2) <> 'acquistato' then
    raise exception 'La chiusura proposta non ha chiuso la riga.';
  end if;

  -- --- E si RIFIUTA se non e' arrivato niente ---
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 7, 'kg', 'manuale')
  returning id into v_riga2;
  begin
    perform chiudi_riga_arrivata(v_riga2);
  exception when others then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Una riga senza nessun arrivo si e'' lasciata chiudere come «arrivata».';
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- --- I permessi dopo il drop ---
  if has_function_privilege('anon', 'lista_spesa()', 'execute') then
    raise exception 'Dopo il drop, lista_spesa() e'' rimasta eseguibile da anon.';
  end if;
  if not has_function_privilege('authenticated', 'lista_spesa()', 'execute') then
    raise exception 'lista_spesa() non e'' piu'' eseguibile dal gestionale.';
  end if;
  if has_function_privilege('anon', 'registra_arrivo_in_lista(uuid, numeric)', 'execute') then
    raise exception 'registra_arrivo_in_lista e'' eseguibile da anon.';
  end if;

  -- --- Pulizia del perimetro ---
  delete from shopping_list_items where ingredient_id = v_ingr;
  delete from stock_lots where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;

  -- ⚠️ Il registro delle cancellazioni non si puo' ripulire da nessuno: la
  -- verifica controlla che il perimetro non si sia allargato, che e' una
  -- PROPRIETA' e non un conteggio fotografato.
  if (select count(*) from deleted_records) <> v_lapidi then
    raise exception 'Le lapidi sono passate da % a %.', v_lapidi,
      (select count(*) from deleted_records);
  end if;

  raise notice 'Arrivi in lista: parziale conta e non chiude, completo chiude senza costo, la riga chiusa non ruba gli arrivi, la chiusura proposta rifiuta chi non ha ricevuto niente.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000001', 'arrivati_n_di_m')
on conflict (version) do nothing;
