-- L'AVVISO DI RINCARO VALE ANCHE SULLE SPESE, CON UN CONFRONTO SOLO
-- =====================================================================
-- Coda del blocco 2 del mandato «la lista non scrive mai un'uscita»,
-- decisione di Alessio del 19/08.
--
-- 🔴 L'OBIEZIONE ERA CHE I DUE NUMERI NON SONO CONFRONTABILI — un prezzo
-- pagato al mercato contro un imponibile letto da una fattura — e che
-- l'avviso avrebbe suonato su un salto che non è un rincaro. **Alessio l'ha
-- smontata**: *«un acquisto con IVA comporta sì un esborso momentaneo
-- maggiore, ma quell'IVA si recupera»*. Al netto dell'IVA recuperabile i due
-- numeri sono **tutti e due il costo vero per il locale**, quindi una
-- differenza fra loro è **reale** e va detta.
--
-- ⚠️ E IL GRUPPO DI CONFRONTO NON È LO STESSO NELLE DUE STRADE, ed è
-- deliberato:
--   · **dalle fatture** si confronta per **versione** (`articoli_fornitore`)
--     — decisione del 12/08: una cassa da 5 L e una bottiglia da 1 L non
--     sono lo stesso acquisto, e metterle in fila farebbe gridare a ogni
--     cambio di formato;
--   · **dalla spesa** si confronta sul **prodotto**, perché una spesa al
--     mercato non ha nessuna dicitura di fornitore. Sono le parole di
--     Alessio: *«il confronto si fa sul prodotto»*.
-- **Ma la funzione che decide è UNA**, e le due strade la chiamano con un
-- parametro diverso: non due regole che possono divergere.

-- ---------------------------------------------------------------------
-- 1 · Il confronto, con il gruppo come parametro
-- ---------------------------------------------------------------------
-- ⚠️ È la vecchia `variazione_prezzo` con una sola cosa cambiata: **da dove
-- prende le righe con cui confrontare**. Il resto — la soglia di Alessio,
-- l'interruttore per prodotto, il «primo prezzo» che è il più VECCHIO e non
-- il minimo — non è stato toccato.
create or replace function variazione_prezzo_su(
  p_ingredient_id uuid,
  p_articolo_id   uuid,
  p_prezzo        numeric
)
returns table (
  prezzo_precedente numeric,
  quando            timestamptz,
  variazione        numeric,
  prezzo_primo      numeric,
  quando_primo      timestamptz,
  variazione_totale numeric,
  da_segnalare      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capo   uuid;
  v_ingr   uuid;
  v_prec   numeric;
  v_quando timestamptz;
  v_primo  numeric;
  v_qprimo timestamptz;
  v_soglia numeric;
  v_avvisa boolean;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere i prezzi d''acquisto';
  end if;

  if p_prezzo is null or p_prezzo <= 0 then
    return;
  end if;

  if p_articolo_id is not null then
    -- Il gruppo di confronto: la versione stessa, piu' le diciture che
    -- Alessio ha dichiarato essere lo stesso identico prodotto.
    select coalesce(a.stesso_di, a.id), a.ingredient_id into v_capo, v_ingr
      from articoli_fornitore a where a.id = p_articolo_id;
    if v_capo is null then
      return;
    end if;

    select ph.price, ph.recorded_at into v_prec, v_quando
      from price_history ph
      join articoli_fornitore a on a.id = ph.articolo_id
     where coalesce(a.stesso_di, a.id) = v_capo
     order by ph.recorded_at desc
     limit 1;

    -- Il piu' VECCHIO, non il minimo: il minimo darebbe la variazione piu'
    -- spettacolare invece di quella vera.
    select ph.price, ph.recorded_at into v_primo, v_qprimo
      from price_history ph
      join articoli_fornitore a on a.id = ph.articolo_id
     where coalesce(a.stesso_di, a.id) = v_capo
     order by ph.recorded_at asc
     limit 1;
  else
    -- ⚠️ SENZA VERSIONE SI GUARDA IL PRODOTTO INTERO: e' la strada della
    -- spesa al mercato, dove una dicitura di fornitore non c'e'.
    v_ingr := p_ingredient_id;
    if v_ingr is null then
      return;
    end if;

    select ph.price, ph.recorded_at into v_prec, v_quando
      from price_history ph
     where ph.ingredient_id = v_ingr
     order by ph.recorded_at desc
     limit 1;

    select ph.price, ph.recorded_at into v_primo, v_qprimo
      from price_history ph
     where ph.ingredient_id = v_ingr
     order by ph.recorded_at asc
     limit 1;
  end if;

  if v_prec is null or v_prec <= 0 then
    return;   -- prima volta che si compra questo prodotto
  end if;

  select coalesce(s.soglia_rincaro_percento, 0) into v_soglia
    from service_settings s where s.id = 1;
  v_soglia := coalesce(v_soglia, 0);

  select i.avvisa_rincari into v_avvisa from ingredients i where i.id = v_ingr;

  return query select
    v_prec,
    v_quando,
    round((p_prezzo - v_prec) / v_prec * 100, 1),
    v_primo,
    v_qprimo,
    case when v_primo > 0 then round((p_prezzo - v_primo) / v_primo * 100, 1) end,
    coalesce(v_avvisa, true)
      and p_prezzo > v_prec * (1 + v_soglia / 100);
end;
$$;

revoke all on function variazione_prezzo_su(uuid, uuid, numeric) from public, anon;
grant execute on function variazione_prezzo_su(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · La vecchia porta resta, e diventa un guscio
-- ---------------------------------------------------------------------
-- ⚠️ NON SI CANCELLA: la chiamano il carico da fattura e la schermata della
-- posta, e cambiare tre chiamanti per rinominare una funzione sarebbe
-- lavoro senza guadagno. Ma **non contiene più nessuna regola**: se la
-- regola cambia, cambia in un posto solo.
create or replace function variazione_prezzo(p_articolo_id uuid, p_prezzo numeric)
returns table (
  prezzo_precedente numeric,
  quando            timestamptz,
  variazione        numeric,
  prezzo_primo      numeric,
  quando_primo      timestamptz,
  variazione_totale numeric,
  da_segnalare      boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select * from variazione_prezzo_su(null, p_articolo_id, p_prezzo);
$$;

revoke all on function variazione_prezzo(uuid, numeric) from public, anon;
grant execute on function variazione_prezzo(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · La chiusura della riga confronta e avvisa
-- ---------------------------------------------------------------------
-- ⚠️ Ripresa dal database (regola del 18/08), con due pezzi aggiunti: il
-- confronto **prima** di scrivere il prezzo, e l'avviso **dopo**.


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
  v_var     record;
  -- ⚠️ Un record mai assegnato non si puo' nemmeno interrogare: leggere
  -- v_var.da_segnalare su un regalo faceva fallire la chiusura con un 500,
  -- e la prova del regalo l'ha preso subito. Il flag e' assegnato sempre.
  v_avvisare boolean := false;
  v_unit    numeric;
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
  -- ⚠️ IL CONFRONTO VIENE PRIMA DELLA SCRITTURA, sempre: dopo, il prezzo
  -- nuovo è già nello storico e la funzione troverebbe se stessa —
  -- nessun rincaro, mai, e nessuna traccia dell'errore. È la trappola
  -- del 12/08, e vale identica su questa strada.
  if p_esito = 'comprata'
     and v_riga.ingredient_id is not null
     and v_qta is not null and v_qta > 0 then
    v_unit := p_importo / v_qta;
    select * into v_var from variazione_prezzo_su(v_riga.ingredient_id, null, v_unit);
    v_avvisare := coalesce(v_var.da_segnalare, false);
  end if;

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

  -- --- E se hai pagato più del solito, lo dice ---
  -- 🔴 DECISIONE DI ALESSIO, 19/08: l'avviso di rincaro vale anche sulle
  -- spese, con **un confronto solo**. Alla domanda se un prezzo pagato al
  -- mercato sia confrontabile con un imponibile da fattura ha risposto di
  -- sì: *«un acquisto con IVA comporta un esborso momentaneo maggiore, ma
  -- quell'IVA si recupera»* — quindi i due numeri sono tutti e due il
  -- costo vero per il locale, e una differenza fra loro è reale.
  --
  -- ⚠️ IL GRUPPO DI CONFRONTO QUI È IL PRODOTTO, non la versione: una
  -- spesa al mercato non ha una dicitura di fornitore. Sulle fatture il
  -- confronto resta per versione (decisione del 12/08: una cassa da 5 kg
  -- e una bottiglia da 1 L non sono lo stesso acquisto), e le due strade
  -- passano dalla stessa funzione.
  --
  -- ⚠️ SI AVVISA DOPO AVER SCRITTO, ma si CONFRONTA prima: l'avviso è una
  -- conseguenza, e non deve poter far fallire una spesa già registrata.
  if v_avvisare then
    perform segnala_allarme(
      tipo_allarme_rincaro(v_nome, 'spesa', v_unit),
      'Hai pagato ' || euro(v_unit) || ' per ' || v_nome
        || ', prima era ' || euro(v_var.prezzo_precedente)
        || ' (' || v_var.variazione || '%)',
      jsonb_build_object('ingrediente', v_nome, 'prezzo', v_unit,
                         'prima', v_var.prezzo_precedente,
                         'variazione', v_var.variazione),
      'attenzione'
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
-- ⚠️ QUI NON SI FA SUONARE NESSUN TELEFONO. `segnala_allarme` inserisce E
-- manda su Telegram, e questa migrazione girera' anche in produzione: la
-- verifica guarda la DECISIONE (`da_segnalare`), che e' separata dall'invio
-- esattamente per questo (13/08). Che l'avviso poi parta davvero si
-- controlla leggendo il CORPO della funzione, non facendolo partire.
do $verifica$
declare
  v_ente   uuid;
  v_ingr   uuid;
  v_riga   uuid;
  v_var    record;
  v_corpo  text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;
  insert into ingredients (entity_id, name, unit, category)
  values (v_ente, 'VERIFICA rincaro spesa', 'kg', 'altro')
  returning id into v_ingr;

  -- --- La prima spesa non e' un rincaro: non c'e' niente prima ---
  select * into v_var from variazione_prezzo_su(v_ingr, null, 4.00);
  if v_var.da_segnalare then
    raise exception 'La prima spesa di un prodotto risulta un rincaro.';
  end if;

  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ingr, 10, 'kg', 'manuale') returning id into v_riga;
  perform chiudi_riga_lista(
    p_item_id => v_riga, p_esito => 'comprata', p_importo => 40,
    p_metodo_pagamento => 'contante', p_quantita_ricevuta => 10
  );

  -- --- La seconda al doppio: l'avviso DEVE scattare ---
  select * into v_var from variazione_prezzo_su(v_ingr, null, 8.00);
  if not v_var.da_segnalare then
    raise exception 'Una spesa al doppio del prezzo non fa scattare nessun avviso.';
  end if;
  if v_var.prezzo_precedente <> 4.00 then
    raise exception 'Il confronto guarda % invece di 4,00.', v_var.prezzo_precedente;
  end if;
  if v_var.variazione <> 100.0 then
    raise exception 'La variazione dice %%% invece di 100.', v_var.variazione;
  end if;

  -- --- ...e allo stesso prezzo DEVE tacere ---
  -- ⚠️ E' la meta' che rende la prova capace di fallire: un avviso che non
  -- sa tacere non sta misurando niente.
  select * into v_var from variazione_prezzo_su(v_ingr, null, 4.00);
  if v_var.da_segnalare then
    raise exception 'Una spesa allo stesso prezzo fa scattare un avviso.';
  end if;

  -- --- L'interruttore per prodotto vale anche qui ---
  update ingredients set avvisa_rincari = false where id = v_ingr;
  select * into v_var from variazione_prezzo_su(v_ingr, null, 8.00);
  if v_var.da_segnalare then
    raise exception 'Il prodotto ha gli avvisi spenti e l''avviso scatta lo stesso.';
  end if;
  update ingredients set avvisa_rincari = true where id = v_ingr;

  -- --- E la chiusura di una riga chiama davvero l'avviso ---
  -- ⚠️ Si legge il CORPO: si puo' correggere l'aiuto e lasciare il chiamante
  -- com'era, e la migrazione passerebbe verde col difetto vivo (13/08).
  v_corpo := pg_get_functiondef(
    'chiudi_riga_lista(uuid, text, numeric, text, numeric, date, text, uuid)'::regprocedure);
  if v_corpo not like '%segnala_allarme%' then
    raise exception 'La chiusura di una riga non chiama l''avviso di rincaro.';
  end if;
  if v_corpo not like '%variazione_prezzo_su%' then
    raise exception 'La chiusura di una riga non confronta il prezzo.';
  end if;
  -- ⚠️ E CONFRONTA PRIMA DI SCRIVERE: invertendo, la funzione troverebbe se
  -- stessa e nessun rincaro verrebbe mai segnalato — senza nessun errore.
  if position('variazione_prezzo_su' in v_corpo) > position('update_ingredient_price' in v_corpo) then
    raise exception 'Il confronto avviene DOPO aver scritto il prezzo: non troverebbe mai nessun rincaro.';
  end if;

  -- --- Le fatture continuano a confrontare per VERSIONE ---
  if pg_get_functiondef('variazione_prezzo(uuid, numeric)'::regprocedure)
     not like '%variazione_prezzo_su%' then
    raise exception 'La vecchia porta non passa piu'' dalla regola unica.';
  end if;

  -- --- Pulizia del perimetro ---
  delete from cash_movements where business_purpose like 'Spesa: VERIFICA rincaro spesa%';
  delete from shopping_list_items where ingredient_id = v_ingr;
  delete from stock_lots where ingredient_id = v_ingr;
  delete from price_history where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;
  delete from allarmi where tipo like 'rincaro_VERIFICA rincaro spesa%';

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Rincaro sulle spese: il doppio fa scattare l''avviso, lo stesso prezzo lo fa tacere, l''interruttore del prodotto vale, e il confronto avviene prima della scrittura.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000005', 'il_rincaro_vale_anche_sulle_spese')
on conflict (version) do nothing;
