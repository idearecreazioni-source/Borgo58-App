-- QUELLO CHE HAI PAGATO DIVENTA IL PREZZO — E L'IVA NON SI CHIEDE
-- =====================================================================
-- Coda del blocco 2 del mandato «la lista non scrive mai un'uscita», dopo
-- la risposta di Alessio del 19/08.
--
-- 🔴 LA DOMANDA CHE GLI ERA STATA POSTA ERA SBAGLIATA, e l'ha detto lui.
-- `ingredients.current_price` è dichiarato «per unità, IVA esclusa» (dal
-- 30/07), e una spesa in contanti è un importo *pagato*: la proposta era di
-- **chiedere** se l'importo fosse con o senza IVA. Alessio ha scartato la
-- domanda perché la risposta esiste già:
--
--     «esistono solo due tipi di acquisti, con documento e senza. Quelli
--      con documento deducono da esso se c'è l'IVA e a quanto ammonta;
--      quelli senza, per forza di cose, non hanno IVA.»
--
-- Quindi la base del prezzo si **deriva dal tipo di acquisto**, non da una
-- domanda a chi sta comprando:
--   · con documento  → imponibile e IVA vengono dal documento (la strada
--     del carico da fattura, invariata);
--   · senza documento → l'importo pagato **è** il costo, e non c'è nessuna
--     IVA da scorporare: si scrive quello.
--
-- ⚠️ E DA OGGI IN `current_price` CONVIVONO DUE NUMERI FORMATI IN MODO
-- DIVERSO — un imponibile da fattura e un pagato al mercato — ed **è giusto
-- così**: tutti e due sono il costo vero per il locale. *Chi li uniformasse
-- scorporando un'IVA che non c'è mai stata abbasserebbe il food cost di
-- circa un quinto, in silenzio.* La stessa avvertenza è scritta accanto al
-- codice, perché è lì che qualcuno passerà a «correggere».
--
-- ⚠️ IL REGALO RESTA FUORI, come il 17/08: costo zero per quella volta, non
-- per sempre.


CREATE OR REPLACE FUNCTION public.chiudi_riga_lista(p_item_id uuid, p_esito text, p_importo numeric DEFAULT NULL::numeric, p_metodo_pagamento text DEFAULT NULL::text, p_quantita_ricevuta numeric DEFAULT NULL::numeric, p_scadenza date DEFAULT NULL::date, p_riferimento_documento text DEFAULT NULL::text, p_causale_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- --- E il prezzo di listino segue quello che hai pagato ---
  -- 🔴 DECISIONE DI ALESSIO, 19/08. La domanda che gli era stata posta era
  -- «l'importo è con o senza IVA?», e lui l'ha scartata perché la risposta
  -- esiste già: *«esistono solo due tipi di acquisti, con documento e senza.
  -- Quelli con documento deducono da esso se c'è l'IVA e a quanto ammonta;
  -- quelli senza, per forza di cose, non hanno IVA.»*
  --
  -- ⚠️ QUINDI QUI NON SI SCORPORA NIENTE, e non è una svista: quello che
  -- esce dalla tasca al mercato **è** il costo. L'imponibile arriva dai
  -- documenti, per la strada del carico da fattura.
  --
  -- ⚠️ E VA LETTO PRIMA DI «UNIFORMARE»: in `ingredients.current_price`
  -- convivono da oggi due numeri formati in modo diverso — un imponibile
  -- letto da una fattura e un pagato senza documento — ed **è giusto così**,
  -- perché tutti e due sono il costo vero per il locale. Chi li uniformasse
  -- scorporando un'IVA che non c'è mai stata abbasserebbe il food cost di
  -- circa un quinto, in silenzio, su tutte le ricette che usano quel
  -- prodotto.
  --
  -- ⚠️ IL REGALO RESTA FUORI: costo zero per quella volta, non per sempre.
  -- `price_history` e `current_price` non si toccano (mandato del 17/08).
  --
  -- ⚠️ La fonte è `manuale` e non un valore suo: `price_source` è un enum, e
  -- in Postgres un valore aggiunto non è usabile nella stessa migrazione che
  -- lo aggiunge. Un valore dedicato costerebbe due migrazioni per
  -- un'etichetta; la nota dice da dove viene.
  if p_esito = 'comprata'
     and v_riga.ingredient_id is not null
     and v_qta is not null and v_qta > 0 then
    perform update_ingredient_price(
      v_riga.ingredient_id,
      p_importo / v_qta,
      'manuale',
      'Lista della spesa — comprato e pagato'
        || coalesce(' (' || nullif(p_riferimento_documento, '') || ')', ' (senza documento)'),
      v_riga.supplier_id
    );
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
$function$;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente    uuid;
  v_ingr    uuid;
  v_riga    uuid;
  v_prezzo  numeric;
  v_storico integer;
  v_ultima  price_history;
  v_esito   jsonb;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;
  insert into ingredients (entity_id, name, unit, category, current_price)
  values (v_ente, 'VERIFICA prezzo dalla spesa', 'kg', 'altro', 9.99)
  returning id into v_ingr;

  -- =========== COMPRATA SENZA DOCUMENTO: il pagato E' il prezzo ===========
  -- ⚠️ 40 euro per 10 kg fanno 4,00 al chilo, TALI E QUALI. Se qualcuno ci
  -- infilasse uno scorporo dell'IVA al 22% verrebbero 3,28, e questo
  -- controllo diventerebbe rosso: e' la prova che puo' fallire chiesta
  -- insieme alla decisione.
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 10, 'kg', 'manuale') returning id into v_riga;

  select chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'comprata', p_importo => 40,
    p_metodo_pagamento => 'contante', p_quantita_ricevuta => 10
  ) into v_esito;

  select current_price into v_prezzo from ingredients where id = v_ingr;
  if v_prezzo is distinct from 4.00 then
    raise exception 'Il prezzo dopo una spesa senza documento e'' % invece di 4,00: qualcuno scorpora un''IVA che non c''e'' mai stata.', v_prezzo;
  end if;

  select * into v_ultima from price_history
   where ingredient_id = v_ingr order by recorded_at desc limit 1;
  if v_ultima.id is null then
    raise exception 'La spesa non ha lasciato nessuna riga nello storico dei prezzi.';
  end if;
  if v_ultima.price <> 4.00 then
    raise exception 'Lo storico dei prezzi dice % invece di 4,00.', v_ultima.price;
  end if;
  if v_ultima.note not like '%senza documento%' then
    raise exception 'La riga dello storico non dice da dove viene: «%».', v_ultima.note;
  end if;

  -- =========== CON UN RIFERIMENTO: la nota lo dice ===========
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 4, 'kg', 'manuale') returning id into v_riga;
  perform chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'comprata', p_importo => 20,
    p_metodo_pagamento => 'contante', p_quantita_ricevuta => 4,
    p_riferimento_documento => 'Scontrino 12'
  );
  -- ⚠️ SI CERCA PER FIRMA, NON PER POSIZIONE: dentro una transazione
  -- `now()` e' UN ISTANTE SOLO, quindi le due righe dello storico hanno lo
  -- stesso `recorded_at` e «l'ultima» la sceglie l'ordinamento a caso.
  -- Trovato da questa verifica stessa, che al primo colpo ha pescato la
  -- riga sbagliata: e' la trappola del 16/08, e continua a mordere.
  select * into v_ultima from price_history
   where ingredient_id = v_ingr and price = 5.00 limit 1;
  if v_ultima.id is null then
    raise exception 'La seconda spesa non ha lasciato la sua riga nello storico.';
  end if;
  if v_ultima.note not like '%Scontrino 12%' then
    raise exception 'La riga dello storico non nomina il documento: «%».', v_ultima.note;
  end if;
  if (select current_price from ingredients where id = v_ingr) <> 5.00 then
    raise exception 'Il prezzo non e'' passato a 5,00 dopo la seconda spesa.';
  end if;

  -- =========== IL REGALO NON TOCCA NIENTE ===========
  select count(*) into v_storico from price_history where ingredient_id = v_ingr;
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 3, 'kg', 'manuale') returning id into v_riga;
  perform chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'gratis', p_quantita_ricevuta => 3
  );
  if (select current_price from ingredients where id = v_ingr) <> 5.00 then
    raise exception 'Il regalo ha cambiato il prezzo di listino.';
  end if;
  if (select count(*) from price_history where ingredient_id = v_ingr) <> v_storico then
    raise exception 'Il regalo ha scritto una riga nello storico dei prezzi.';
  end if;

  -- =========== PULIZIA DEL PERIMETRO ===========
  delete from cash_movements where business_purpose like 'Spesa: VERIFICA prezzo dalla spesa%';
  delete from shopping_list_items where ingredient_id = v_ingr;
  delete from stock_lots where ingredient_id = v_ingr;
  delete from price_history where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Il prezzo segue la spesa: 40 euro per 10 kg fanno 4,00 tali e quali, la nota dice se c''era un documento, e il regalo non tocca ne'' il listino ne'' lo storico.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000004', 'il_pagato_diventa_il_prezzo')
on conflict (version) do nothing;
