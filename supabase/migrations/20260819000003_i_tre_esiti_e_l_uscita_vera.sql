-- I TRE ESITI, E L'USCITA CHE ESCE DAVVERO
-- =====================================================================
-- Blocco 2 del mandato «la lista non scrive mai un'uscita»
-- (docs/mandati/20260817_la_lista_non_scrive_uscite.md, Alessio 17/08).
--
-- IL PRINCIPIO, che è il titolo del mandato:
--
--     la lista non scrive mai un'uscita per conto suo. Il costo nasce
--     SOLO dal documento, o da una registrazione che Alessio fa
--     esplicitamente.
--
-- 🔴 IL BUCO CHE QUESTO BLOCCO CHIUDE, ed è il motivo per cui esiste: 40 €
-- in contanti al contadino, riga chiusa senza scrivere niente, e la sera il
-- conteggio del cassetto mostra un **ammanco di 40 € che non esiste** — che
-- finisce in prima nota come rettifica di un errore mai avvenuto. **È lo
-- stesso meccanismo delle mance su carta** (16/08). Per questo «l'ho
-- comprato e pagato» non è un di più: è **la via normale**, e chiudendo a
-- mano va **proposta**.
--
-- I TRE ESITI RESTANO TRE, e il terzo non è un doppione del secondo:
--   · **comprata e pagata** → costo, merce dentro, **e uscita vera in prima
--     nota**;
--   · **avuta gratis** → nessun costo, **ma la merce entra lo stesso**;
--   · **non presa** → la riga sparisce e basta.
-- ⚠️ Confondere gli ultimi due mette in magazzino **merce mai arrivata**.
--
-- ⚠️ IL REGALO VALE ZERO PER QUELLA VOLTA, NON PER SEMPRE: il lotto nasce a
-- costo zero (quella partita è costata davvero zero), ma **non si scrive
-- niente in `price_history` e non si tocca `ingredients.current_price`** —
-- è da lì che nasce il food cost su cui Alessio decide i prezzi del menu, e
-- un regalo che abbassa il prezzo di listino li abbassa **tutti**.

-- ---------------------------------------------------------------------
-- 1 · Da dove escono i soldi: una regola sola
-- ---------------------------------------------------------------------
-- ⚠️ ESISTE PER TOGLIERE UN DOPPIONE, non per comodità: lo stesso `case`
-- stava dentro `pay_supplier_invoice` e sarebbe stato riscritto qui. Il
-- discriminante del 17/08 risponde secco — le due copie direbbero
-- **esattamente** la stessa cosa, quindi è un doppione da togliere e non un
-- caso da sorvegliare con una rete.
--
-- ⚠️ E SONO DUE CONCETTI DIVERSI, che il progetto tiene distinti dal 17/08:
-- il **metodo** è lo strumento con cui si paga (contante, bonifico,
-- assegno, carta); il **mezzo** è dove i soldi stanno (cassa o banca).
-- Questa funzione è il ponte fra i due, ed è l'unico.
create or replace function mezzo_del_pagamento(p_metodo text)
returns text
language sql
immutable
as $$
  select case when p_metodo = 'contante' then 'cassa' else 'banca' end;
$$;

revoke all on function mezzo_del_pagamento(text) from public, anon;
grant execute on function mezzo_del_pagamento(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · Il vocabolario unico dei mezzi di pagamento
-- ---------------------------------------------------------------------
-- 🔴 DECISIONE DI ALESSIO DEL 19/08. Fino a oggi la lista della spesa aveva
-- un vocabolario suo (contante, bonifico, carta) separato da quello delle
-- fatture (che dal 17/08 ha anche l'assegno). ⚠️ **La separazione esisteva
-- per una ragione che oggi cade**: quella schermata non sapeva cosa farsene
-- del mezzo — lo registrava e non ne conseguiva niente. Con l'esito
-- «comprata e pagata» che scrive un'uscita vera, il mezzo *serve*, e i due
-- elenchi tornano uno.
--
-- ⚠️ E la rete del 17/08 resta a sorvegliare che non si riseparino: la
-- dichiarazione di `PAYMENT_METHODS_SPESA` sparisce da
-- `src/lib/calcoli/vocabolari.js`, e **una prova diventa rossa se qualcuno
-- la rimette senza rimettere anche il vincolo**. È voluto.
alter table shopping_list_items
  drop constraint if exists shopping_list_items_payment_method_check;

alter table shopping_list_items
  add constraint shopping_list_items_payment_method_check
  check (payment_method is null
         or payment_method in ('contante', 'bonifico', 'assegno', 'carta'));

-- ---------------------------------------------------------------------
-- 3 · Com'è finita quella riga
-- ---------------------------------------------------------------------
-- ⚠️ SI SCRIVE, NON SI DEDUCE DALL'IMPORTO. Senza questa colonna, «avuta
-- gratis» e «comprata a zero euro» sarebbero la stessa riga, e la
-- differenza fra le due è tutto il senso del secondo esito. Un importo a
-- zero è un numero; un esito è un fatto.
--
-- ⚠️ `null` sulle righe aperte, ed è il terzo stato vero: «non è ancora
-- finita». Le 2 righe che esistono in produzione sono lì (regola del 14/08:
-- un predefinito su righe esistenti è una risposta data al posto loro).
--
-- «non presa» non c'è, e non è una dimenticanza: quella riga viene
-- cancellata, quindi non ha un esito da conservare.
alter table shopping_list_items
  add column if not exists esito text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'shopping_list_items'::regclass
      and conname = 'shopping_list_items_esito_check'
  ) then
    alter table shopping_list_items
      add constraint shopping_list_items_esito_check
      check (esito is null or esito in ('comprata', 'gratis', 'arrivata_con_documento'));
  end if;
end $$;

comment on column shopping_list_items.esito is
  'Com''è finita: comprata (con costo e uscita in prima nota), gratis (merce dentro, nessun costo), arrivata_con_documento (chiusa da un carico). null = ancora aperta. «Non presa» non c''è: quella riga si cancella.';

-- ---------------------------------------------------------------------
-- 4 · L'arrivo da un documento dichiara il proprio esito
-- ---------------------------------------------------------------------
create or replace function registra_arrivo_in_lista(
  p_ingredient_id uuid,
  p_quantita      numeric,
  p_riga_lista    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga shopping_list_items;
  v_tot  numeric;
  v_completa boolean;
begin
  if p_ingredient_id is null or p_quantita is null or p_quantita <= 0 then
    return null;
  end if;

  if p_riga_lista is not null then
    select * into v_riga from shopping_list_items where id = p_riga_lista;
    -- ⚠️ UNA SCELTA SBAGLIATA SI RIFIUTA, non si corregge in silenzio
    -- tornando alla più vecchia: ripiegare vorrebbe dire scrivere
    -- l'arrivo da un'altra parte **dicendo di aver fatto quel che si
    -- chiedeva**, ed è il modo silenzioso di far mentire la lista.
    if v_riga.id is null then
      raise exception 'La riga della lista scelta non esiste';
    end if;
    if v_riga.ingredient_id is distinct from p_ingredient_id then
      raise exception 'La riga della lista scelta è di un altro prodotto';
    end if;
    if v_riga.status not in ('da_comprare', 'ordinata') then
      raise exception 'La riga della lista scelta è già chiusa';
    end if;
  else
    select * into v_riga
      from shopping_list_items
     where ingredient_id = p_ingredient_id
       and status in ('da_comprare', 'ordinata')
     order by created_at
     limit 1;
    if v_riga.id is null then
      return null;
    end if;
  end if;

  v_tot := coalesce(v_riga.quantita_arrivata, 0) + p_quantita;
  v_completa := v_riga.quantity_needed is not null and v_tot >= v_riga.quantity_needed;

  update shopping_list_items
     set quantita_arrivata = v_tot,
         -- L'arrivo completo chiude la riga. ⚠️ Nessun importo e nessun
         -- mezzo di pagamento: il costo di questa merce sta nel documento
         -- che l'ha portata, e la lista non scrive mai un'uscita.
         status       = case when v_completa then 'acquistato' else status end,
         esito        = case when v_completa then 'arrivata_con_documento' else esito end,
         purchased_at = case when v_completa then now() else purchased_at end
   where id = v_riga.id;

  return v_riga.id;
end;
$$;

revoke all on function registra_arrivo_in_lista(uuid, numeric, uuid) from public, anon, authenticated;

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
         esito = 'arrivata_con_documento',
         purchased_at = now()
   where id = p_item_id;
end;
$$;

revoke all on function chiudi_riga_arrivata(uuid) from public, anon;
grant execute on function chiudi_riga_arrivata(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · I tre esiti
-- ---------------------------------------------------------------------
-- ⚠️ TRE TABELLE IN UNA TRANSAZIONE — `shopping_list_items`, `stock_lots`,
-- `cash_movements` — quindi **corridoio** (Contratto B4). A metà sarebbe
-- merce comprata che non risulta arrivata, o soldi usciti dal cassetto per
-- roba che non c'è.
--
-- ⚠️ NON PASSA DA `register_stock_delivery`, e la ragione va scritta: quella
-- funzione, dal blocco 1, spegne una voce della lista — chiamandola da qui
-- l'arrivo tornerebbe sulla riga che stiamo chiudendo (o, peggio, su
-- un'altra riga aperta dello stesso prodotto). Il lotto si scrive dritto,
-- come faceva la funzione che questa sostituisce.
drop function if exists close_shopping_list_item(uuid, numeric, text, numeric, text, date);

create or replace function chiudi_riga_lista(
  p_item_id               uuid,
  p_esito                 text,
  p_importo               numeric default null,
  p_metodo_pagamento      text    default null,
  p_quantita_ricevuta     numeric default null,
  p_scadenza              date    default null,
  p_riferimento_documento text    default null,
  p_causale_id            uuid    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga    shopping_list_items;
  v_qta     numeric;
  v_ente    uuid;
  v_nome    text;
  v_causale cash_causali;
  v_lotto   uuid;
  v_mov     uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può chiudere una riga della lista della spesa';
  end if;
  if p_esito is null or p_esito not in ('comprata', 'gratis', 'non_presa') then
    raise exception 'Esito non valido: %. I tre esiti sono comprata, gratis, non_presa', coalesce(p_esito, '(mancante)');
  end if;

  select * into v_riga from shopping_list_items where id = p_item_id for update;
  if v_riga.id is null then
    raise exception 'Riga non trovata';
  end if;
  if v_riga.status = 'acquistato' then
    raise exception 'Questa riga è già chiusa';
  end if;

  -- ⚠️ «NON PRESA»: la riga sparisce e basta. Niente lotto, niente costo,
  -- niente movimento. È il terzo esito, e confonderlo con «gratis»
  -- metterebbe in magazzino merce mai arrivata.
  if p_esito = 'non_presa' then
    delete from shopping_list_items where id = p_item_id;
    return jsonb_build_object('esito', 'non_presa', 'riga_cancellata', true);
  end if;

  v_qta := coalesce(p_quantita_ricevuta, v_riga.quantity_needed);
  select name into v_nome from ingredients where id = v_riga.ingredient_id;
  v_nome := coalesce(v_nome, v_riga.custom_name, 'spesa');

  if p_esito = 'comprata' then
    if p_importo is null or p_importo <= 0 then
      raise exception 'Per «l''ho comprato e pagato» serve l''importo: è quello che esce dalla cassa';
    end if;
    if p_metodo_pagamento is null
       or p_metodo_pagamento not in ('contante', 'bonifico', 'assegno', 'carta') then
      raise exception 'Metodo di pagamento non valido: %', coalesce(p_metodo_pagamento, '(mancante)');
    end if;
  end if;

  -- --- La riga si chiude ---
  update shopping_list_items
     set status            = 'acquistato',
         esito             = p_esito,
         -- ⚠️ Il regalo scrive 0, non `null`: quella partita è costata
         -- davvero zero, ed è un fatto — non un'informazione mancante.
         purchased_amount  = case when p_esito = 'comprata' then p_importo else 0 end,
         payment_method    = case when p_esito = 'comprata' then p_metodo_pagamento else null end,
         document_reference = nullif(p_riferimento_documento, ''),
         quantita_arrivata = coalesce(quantita_arrivata, 0) + coalesce(v_qta, 0),
         purchased_at      = now()
   where id = p_item_id;

  -- --- La merce entra, in tutti e due gli esiti ---
  if v_riga.ingredient_id is not null and v_qta is not null and v_qta > 0 then
    insert into stock_lots (
      ingredient_id, supplier_id, quantity_received, quantity_remaining,
      unit_cost, expiry_date, note
    )
    values (
      v_riga.ingredient_id, v_riga.supplier_id, v_qta, v_qta,
      -- ⚠️ IL REGALO VALE ZERO PER QUELLA VOLTA, NON PER SEMPRE: il lotto
      -- costa zero — ed è vero, quello che si consuma da lì è gratis — ma
      -- `price_history` e `ingredients.current_price` **non si toccano**.
      -- Da lì nasce il food cost su cui Alessio decide i prezzi del menu.
      case when p_esito = 'comprata' then p_importo / v_qta else 0 end,
      p_scadenza,
      case when p_esito = 'gratis' then 'Omaggio del fornitore' else 'Da lista della spesa' end
    )
    returning id into v_lotto;
  end if;

  -- --- E i soldi escono davvero ---
  if p_esito = 'comprata' then
    select entity_id into v_ente from ingredients where id = v_riga.ingredient_id;
    if v_ente is null then
      select id into v_ente from entities order by created_at limit 1;
    end if;
    if v_ente is null then
      raise exception 'Non esiste nessuna entità a cui intestare l''uscita';
    end if;

    if p_causale_id is not null then
      select * into v_causale from cash_causali where id = p_causale_id;
      if v_causale.id is null then
        raise exception 'La causale scelta non esiste';
      end if;
      if v_causale.kind <> 'uscita' or not v_causale.active then
        raise exception 'La causale scelta non è una causale di uscita attiva';
      end if;
    end if;

    insert into cash_movements (
      entity_id, direction, amount, movement_date, mezzo,
      causale_id, tipo_documento, document_reference, business_purpose
    )
    values (
      v_ente, 'uscita', p_importo,
      -- ⚠️ La data di CALENDARIO di Roma, non `current_date`: il database
      -- vive in UTC e fra mezzanotte e le due direbbe ieri. E non è una
      -- «serata di servizio» — una spesa fatta al mercato alle dieci del
      -- mattino appartiene a quel giorno lì.
      (now() at time zone 'Europe/Rome')::date,
      mezzo_del_pagamento(p_metodo_pagamento),
      p_causale_id,
      -- ⚠️ Senza un riferimento non si dichiara un documento che non c'è:
      -- «non documentato» è la verità, e dal 15/08 è anche ciò che decide
      -- se quel costo si può dedurre.
      case when nullif(p_riferimento_documento, '') is null
           then 'non_documentato' else 'scontrino' end::cash_document_type,
      nullif(p_riferimento_documento, ''),
      'Spesa: ' || v_nome
    )
    returning id into v_mov;
  end if;

  return jsonb_build_object(
    'esito', p_esito,
    'lotto_id', v_lotto,
    'movimento_id', v_mov,
    'quantita', v_qta
  );
end;
$$;

revoke all on function chiudi_riga_lista(uuid, text, numeric, text, numeric, date, text, uuid)
  from public, anon;
grant execute on function chiudi_riga_lista(uuid, text, numeric, text, numeric, date, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 6 · Il pagamento di una fattura usa la stessa regola sul mezzo
-- ---------------------------------------------------------------------
-- ⚠️ RIPRESA DAL DATABASE (regola del 18/08), con una sola riga cambiata:
-- il `case` inline diventa `mezzo_del_pagamento()`.

CREATE OR REPLACE FUNCTION public.pay_supplier_invoice(p_invoice_id uuid, p_payment_method text, p_data_uscita date DEFAULT NULL::date, p_riferimento text DEFAULT NULL::text, p_note_da_usare uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inv       supplier_invoices%rowtype;
  v_fornitore text;
  v_mezzo     text;
  v_data      date;
  v_netto     numeric;
  v_scalato   numeric;
  r           record;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un pagamento';
  end if;
  if p_payment_method is null or p_payment_method not in ('contante', 'bonifico', 'carta', 'assegno') then
    raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(mancante)');
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status = 'pagata' then
    raise exception 'Questa fattura risulta gia'' pagata';
  end if;

  -- ⚠️ I CREDITI SI APPLICANO PRIMA di segnare pagata la fattura: il
  -- trigger del §3 rifiuta ogni movimento di credito su una fattura
  -- pagata, e ha ragione. L'ordine non e' un dettaglio, e' la regola.
  --
  -- ⚠️ E si applicano ESATTAMENTE come li ha mostrati l'anteprima: la
  -- stessa funzione, non lo stesso ragionamento riscritto qui.
  if p_note_da_usare is not null then
    -- Il blocco sulle note serve a impedire che due pagamenti in corso
    -- spendano lo stesso credito: `crediti_da_applicare` legge e basta.
    perform 1 from note_credito where id = any(p_note_da_usare) for update;

    for r in select * from crediti_da_applicare(p_invoice_id, p_note_da_usare) loop
      insert into note_credito_utilizzi (nota_id, fattura_id, importo)
      values (r.nota_id, p_invoice_id, r.importo)
      on conflict (nota_id, fattura_id)
        do update set importo = note_credito_utilizzi.importo + excluded.importo;
    end loop;

    select * into v_inv from supplier_invoices where id = p_invoice_id;
  end if;

  v_scalato := note_scalate(v_inv);
  v_netto   := da_pagare(v_inv);
  v_data    := coalesce(p_data_uscita, (now() at time zone 'Europe/Rome')::date);

  update supplier_invoices
     set status = 'pagata', paid_at = now(), payment_method = p_payment_method
   where id = p_invoice_id;

  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  -- ⚠️ DOVE VANNO A FINIRE I SOLDI lo decide una funzione sola, dal 19/08:
  -- qui c era lo stesso «case» che serviva alla chiusura di una riga della
  -- lista della spesa, e due copie della stessa regola prima o poi dicono
  -- due cose diverse. Il discriminante del 17/08 risponde: direbbero
  -- ESATTAMENTE la stessa cosa, quindi è un doppione da togliere, non un
  -- caso da sorvegliare con una rete.
  v_mezzo := mezzo_del_pagamento(p_payment_method);
  select name into v_fornitore from suppliers where id = v_inv.supplier_id;

  -- ⚠️ SE IL NETTO E' ZERO NON SI SCRIVE NESSUN MOVIMENTO, e non e' una
  -- svista: una fattura coperta per intero da una nota di credito non fa
  -- uscire un euro da nessuna parte, e una riga da 0,00 in prima nota
  -- sarebbe un'uscita che non e' avvenuta. Il prezzo di questa scelta e'
  -- che `quadratura_pagamenti` avrebbe segnalato «pagata senza
  -- movimento» per sempre: e' corretta nel §7, nella stessa migrazione.
  if v_netto > 0 then
    insert into cash_movements (
      entity_id, direction, amount, movement_date, mezzo,
      tipo_documento, document_reference, riferimento_pagamento, business_purpose,
      supplier_invoice_id
    ) values (
      v_inv.entity_id, 'uscita', v_netto,
      v_data,
      v_mezzo,
      'fattura',
      coalesce(nullif(v_inv.document_reference, ''), v_inv.invoice_number),
      nullif(p_riferimento, ''),
      'Pagamento fattura ' || coalesce(v_inv.invoice_number, '')
        || coalesce(' — ' || v_fornitore, '')
        || case when v_scalato > 0
                then ' (' || euro(v_inv.amount)
                     || ' meno ' || euro(v_scalato)
                     || ' di nota di credito)'
                else '' end,
      p_invoice_id
    );
  end if;

  return p_invoice_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_ingr     uuid;
  v_riga     uuid;
  v_lapidi   integer;
  v_mov      integer;
  v_prezzi   integer;
  v_prezzo   numeric;
  v_causale  uuid;
  v_esito    jsonb;
  v_lotto    stock_lots;
  v_sl       shopping_list_items;
  respinto   boolean;
begin
  -- ⚠️ Il blocco impersona il titolare: una migrazione non ha un utente, ha
  -- un proprietario, e le funzioni qui sotto hanno un portiere.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;
  select count(*) into v_mov from cash_movements;
  select id into v_ente from entities order by created_at limit 1;
  select id into v_causale from cash_causali where kind = 'uscita' and active limit 1;

  insert into ingredients (entity_id, name, unit, category, current_price)
  values (v_ente, 'VERIFICA tre esiti', 'kg', 'altro', 4.00)
  returning id into v_ingr;
  select count(*) into v_prezzi from price_history where ingredient_id = v_ingr;

  -- =========== 1 · COMPRATA E PAGATA ===========
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 10, 'kg', 'manuale') returning id into v_riga;

  select chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'comprata', p_importo => 40,
    p_metodo_pagamento => 'contante', p_quantita_ricevuta => 10,
    p_causale_id => v_causale
  ) into v_esito;

  select * into v_sl from shopping_list_items where id = v_riga;
  if v_sl.status <> 'acquistato' or v_sl.esito <> 'comprata' then
    raise exception 'Comprata: la riga non risulta chiusa come comprata (% / %).', v_sl.status, v_sl.esito;
  end if;
  if v_sl.purchased_amount <> 40 or v_sl.payment_method <> 'contante' then
    raise exception 'Comprata: importo o metodo non scritti.';
  end if;

  select * into v_lotto from stock_lots where id = (v_esito->>'lotto_id')::uuid;
  if v_lotto.id is null or v_lotto.unit_cost <> 4 then
    raise exception 'Comprata: il lotto manca o costa % invece di 4.', v_lotto.unit_cost;
  end if;

  -- ⚠️ IL CUORE DEL BLOCCO: i soldi escono davvero. Senza questa riga il
  -- cassetto accuserebbe un ammanco di 40 euro che non esiste.
  if (select count(*) from cash_movements where id = (v_esito->>'movimento_id')::uuid) <> 1 then
    raise exception 'Comprata: nessun movimento in prima nota.';
  end if;
  if (select mezzo from cash_movements where id = (v_esito->>'movimento_id')::uuid) <> 'cassa' then
    raise exception 'Comprata in contanti: il movimento non e'' uscito dalla cassa.';
  end if;
  if (select direction::text from cash_movements where id = (v_esito->>'movimento_id')::uuid) <> 'uscita' then
    raise exception 'Comprata: il movimento non e'' un''uscita.';
  end if;
  if (select tipo_documento::text from cash_movements where id = (v_esito->>'movimento_id')::uuid) <> 'non_documentato' then
    raise exception 'Comprata senza riferimento: il movimento dichiara un documento che non c''e''.';
  end if;

  -- =========== 2 · AVUTA GRATIS ===========
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 5, 'kg', 'manuale') returning id into v_riga;

  select chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'gratis', p_quantita_ricevuta => 5
  ) into v_esito;

  select * into v_sl from shopping_list_items where id = v_riga;
  if v_sl.esito <> 'gratis' or v_sl.payment_method is not null then
    raise exception 'Gratis: esito o metodo sbagliati.';
  end if;

  -- ⚠️ LA MERCE ENTRA LO STESSO — e' la differenza dal terzo esito.
  select * into v_lotto from stock_lots where id = (v_esito->>'lotto_id')::uuid;
  if v_lotto.id is null then
    raise exception 'Gratis: la merce non e'' entrata in magazzino.';
  end if;
  if v_lotto.unit_cost <> 0 then
    raise exception 'Gratis: il lotto costa % invece di zero.', v_lotto.unit_cost;
  end if;
  if v_esito->>'movimento_id' is not null then
    raise exception 'Gratis: e'' uscito denaro per una cosa regalata.';
  end if;

  -- ⚠️ E IL PREZZO DI LISTINO NON SI MUOVE: il regalo vale zero per quella
  -- volta, non per sempre. Da current_price nasce il food cost su cui
  -- Alessio decide i prezzi del menu.
  select current_price into v_prezzo from ingredients where id = v_ingr;
  if v_prezzo is distinct from 4.00 then
    raise exception 'Gratis: il prezzo di listino e'' passato a %.', v_prezzo;
  end if;
  if (select count(*) from price_history where ingredient_id = v_ingr) <> v_prezzi then
    raise exception 'Gratis: e'' stata scritta una riga nello storico dei prezzi.';
  end if;

  -- =========== 3 · NON PRESA ===========
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 7, 'kg', 'manuale') returning id into v_riga;

  select chiudi_riga_lista(p_item_id => v_riga, p_esito => 'non_presa') into v_esito;

  if exists (select 1 from shopping_list_items where id = v_riga) then
    raise exception 'Non presa: la riga e'' ancora li''.';
  end if;
  if v_esito->>'lotto_id' is not null then
    raise exception 'Non presa: e'' entrata merce mai arrivata.';
  end if;

  -- =========== I RIFIUTI ===========
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 3, 'kg', 'manuale') returning id into v_riga;

  respinto := false;
  begin
    perform chiudi_riga_lista(p_item_id => v_riga, p_esito => 'comprata', p_importo => 10);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Comprata senza metodo di pagamento: si e'' lasciata chiudere.';
  end if;

  respinto := false;
  begin
    perform chiudi_riga_lista(
      p_item_id => v_riga, p_esito => 'comprata', p_metodo_pagamento => 'contante'
    );
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Comprata senza importo: si e'' lasciata chiudere, e dal cassetto non e'' uscito niente.';
  end if;

  respinto := false;
  begin
    perform chiudi_riga_lista(p_item_id => v_riga, p_esito => 'boh');
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un esito inventato si e'' lasciato scrivere.';
  end if;

  -- ⚠️ L'assegno e' il valore che il 17/08 questa schermata rifiutava: e'
  -- il vocabolario unificato, ed e' la prova che l'unificazione e' viva.
  select chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'comprata', p_importo => 12,
    p_metodo_pagamento => 'assegno', p_quantita_ricevuta => 3
  ) into v_esito;
  if (select mezzo from cash_movements where id = (v_esito->>'movimento_id')::uuid) <> 'banca' then
    raise exception 'Assegno: il movimento non e'' uscito dalla banca.';
  end if;

  -- =========== LA VECCHIA PORTA NON C'E' PIU' ===========
  -- ⚠️ Lasciarla in piedi vorrebbe dire due modi di chiudere una riga, uno
  -- dei quali col vocabolario vecchio e senza uscita in prima nota: cioe'
  -- il difetto che questo blocco chiude, ancora raggiungibile.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'close_shopping_list_item'
  ) then
    raise exception 'La vecchia close_shopping_list_item e'' ancora li''.';
  end if;

  -- =========== IL DOPPIONE DEL MEZZO E'' SPARITO ===========
  if pg_get_functiondef('pay_supplier_invoice(uuid, text, date, text, uuid[])'::regprocedure)
     like '%then ''cassa'' else ''banca''%' then
    raise exception 'Il pagamento delle fatture ha ancora la sua copia della regola sul mezzo.';
  end if;
  if mezzo_del_pagamento('contante') <> 'cassa' or mezzo_del_pagamento('assegno') <> 'banca' then
    raise exception 'La regola sul mezzo non risponde come deve.';
  end if;

  -- =========== I PERMESSI ===========
  if has_function_privilege('anon', 'chiudi_riga_lista(uuid, text, numeric, text, numeric, date, text, uuid)', 'execute') then
    raise exception 'chiudi_riga_lista e'' eseguibile da anon.';
  end if;
  if not has_function_privilege('authenticated', 'chiudi_riga_lista(uuid, text, numeric, text, numeric, date, text, uuid)', 'execute') then
    raise exception 'chiudi_riga_lista non e'' eseguibile dal gestionale.';
  end if;

  -- =========== PULIZIA DEL PERIMETRO ===========
  delete from cash_movements where business_purpose like 'Spesa: VERIFICA tre esiti%';
  delete from shopping_list_items where ingredient_id = v_ingr;
  delete from stock_lots where ingredient_id = v_ingr;
  delete from price_history where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;

  if (select count(*) from cash_movements) <> v_mov then
    raise exception 'Restano % movimenti di prova in prima nota.',
      (select count(*) from cash_movements) - v_mov;
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- ⚠️ Le lapidi: `cash_movements` e `shopping_list_items` sono fra le
  -- tabelle sorvegliate? Il controllo guarda la PROPRIETA' — il perimetro
  -- non si allarga — invece di un numero fotografato.
  if (select count(*) from deleted_records) < v_lapidi then
    raise exception 'Il registro delle cancellazioni si e'' accorciato.';
  end if;

  raise notice 'Tre esiti: comprata scrive uscita in cassa, gratis fa entrare la merce a costo zero senza toccare il listino, non presa cancella e basta. Assegno ammesso, vecchia porta chiusa, doppione del mezzo tolto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000003', 'i_tre_esiti_e_l_uscita_vera')
on conflict (version) do nothing;
