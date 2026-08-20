-- =====================================================================
-- UNA QUANTITÀ SI SCRIVE IN UN MODO SOLO
-- 21/08/2026
-- =====================================================================
-- 🔴 QUINTO DIFETTO TROVATO DALLE MANI DI ALESSIO, e il piu' istruttivo:
-- in Allineamento magazzino si leggeva
--   «Pomodoro ciliegino: ne risultavano 54. kg, ne hai 58.. Ce ne sono in
--    piu' 4..»
-- `FM999999990.999` su un intero lascia il punto — «54.» — e col punto della
-- frase diventa «54..». Misurato sui dati veri: **tutte** le partite in
-- magazzino hanno quantita' intere, quindi si vedeva su ognuna.
--
-- ⚠️ E' LA STESSA FAMIGLIA CHIUSA POCHE ORE FA PER LE PERCENTUALI, ed e' la
-- conferma che serviva: c'e' un posto solo per gli **euro** (17/08), da
-- stanotte uno solo per le **percentuali**, e per le **quantita'** non c'era.
-- Il difetto e' ricomparso **esattamente dove il posto unico mancava**.
--
-- 🔴 E LA PROVA CHE NON E' UN CASO: due migrazioni del **14/08** usano la
-- stessa maschera scrivendo a mano `trim(trailing '.' from trim(trailing '0'
-- from …))`. Chi le ha scritte **sapeva del punto orfano** e lo toglieva li'.
-- Nel mio del 20/08 quella cura non e' stata rifatta — e non poteva esserlo,
-- perche' non era una regola: era un rimedio locale, ripetuto a memoria.
--
-- ⚠️ PERCHE' LA MIA RICERCA DI STANOTTE L'AVEVA MANCATA, e la lezione vale
-- piu' del difetto: **quella maschera era gia' nel mio elenco**, seconda fra
-- le numeriche. L'ho vista e non l'ho provata — ho provato solo quelle che
-- *sembravano* sospette, e ho fermato la misura appena una ha confermato il
-- difetto che cercavo. *Il buco non era nella ricerca: era nel giudizio su
-- cosa valesse la pena provare.* Provarle tutte costava una riga di SQL, ed
-- e' quello che e' stato fatto adesso: **due su nove** lasciano il punto.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · L'UNICO POSTO DOVE UNA QUANTITÀ DIVENTA TESTO
-- ---------------------------------------------------------------------
-- ⚠️ Come si legge in cucina: **54 kg**, non «54.000» e non «54.». I decimali
-- ci sono solo se servono, con la **virgola** italiana: «1,5 kg».
--
-- ⚠️ Fino a TRE decimali, perche' in magazzino si pesano i grammi: 0,250 kg
-- di zafferano e' una quantita' vera, e arrotondarla a 0,25 direbbe un'altra
-- cosa. Gli zeri inutili in coda pero' se ne vanno: «1,5» e non «1,500».
create or replace function quantita(p_valore numeric)
returns text
language sql
immutable
as $fn$
  select case
    when p_valore is null then null
    when p_valore = trunc(p_valore) then to_char(p_valore, 'FM999999999990')
    else replace(rtrim(rtrim(to_char(p_valore, 'FM999999999990.999'), '0'), '.'), '.', ',')
  end;
$fn$;

comment on function quantita(numeric) is
  'L''unico posto dove una quantita'' diventa testo. Nato il 21/08/2026 da «54. kg» letto a schermo: due migrazioni del 14/08 toglievano il punto a mano, la terza non lo sapeva. Un rimedio ripetuto a memoria non e'' una regola.';

revoke all on function quantita(numeric) from public, anon, authenticated;
grant execute on function quantita(numeric) to authenticated;


-- ---------------------------------------------------------------------
-- 2 · LA FUNZIONE CHE SCRIVEVA «54.»
-- ---------------------------------------------------------------------
-- ⚠️ Riscritta dal corpo VIVO letto dal database vero, non dal file che
-- l'aveva creata (regola del 18/08). Cambiano 4 righe: le tre della
-- frase piu' quella del caso «e' gia' questo».
CREATE OR REPLACE FUNCTION public.allinea_giacenza(p_ingredient_id uuid, p_quanto_ce numeric, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_atteso   numeric;
  v_diff     numeric;
  v_resta    numeric;
  v_valore   numeric := 0;
  v_costo    numeric;
  v_lotto    record;
  v_nome     text;
  v_unita    unit_type;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per correggere una giacenza.';
  end if;
  if p_quanto_ce is null or p_quanto_ce < 0 then
    raise exception 'Scrivi quanto ce n''è: un numero, anche zero.';
  end if;

  select name, unit into v_nome, v_unita from ingredients where id = p_ingredient_id;
  if v_nome is null then
    raise exception 'Questo prodotto non esiste più.';
  end if;

  select coalesce(sum(quantity_remaining), 0) into v_atteso
    from stock_lots where ingredient_id = p_ingredient_id;

  v_diff := p_quanto_ce - v_atteso;

  -- ⚠️ Scrivere lo stesso numero che il gestionale già mostra NON produce
  -- nessuno scostamento, e non è un dettaglio: distingue «registro le
  -- differenze» da «registro i salvataggi». Con la seconda, il trend si
  -- riempirebbe di zeri e la media direbbe che va tutto bene.
  if v_diff = 0 then
    return jsonb_build_object(
      'prodotto', v_nome, 'atteso', v_atteso, 'dichiarato', p_quanto_ce,
      'differenza', 0, 'valore', 0, 'registrata', false,
      'frase', format('%s: %s %s, come diceva il gestionale. Non ho scritto niente.',
                      v_nome, quantita(p_quanto_ce), v_unita)
    );
  end if;

  if v_diff < 0 then
    -- MENO DEL PREVISTO: si toglie FEFO, e si conta quanto vale.
    v_resta := -v_diff;
    for v_lotto in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = p_ingredient_id and quantity_remaining > 0
       order by expiry_date nulls last, received_at, id
    loop
      exit when v_resta <= 0;
      v_costo := least(v_lotto.quantity_remaining, v_resta);
      update stock_lots
         set quantity_remaining = quantity_remaining - v_costo
       where id = v_lotto.id;
      v_valore := v_valore + v_costo * coalesce(v_lotto.unit_cost, 0);
      v_resta := v_resta - v_costo;
    end loop;
    -- ⚠️ Se le partite non bastano a coprire la differenza, la giacenza
    -- scende a zero e il resto è comunque REGISTRATO: il gestionale credeva
    -- di avere meno di quanto ha tolto, e nasconderlo cancellerebbe proprio
    -- lo scostamento che serve a vedere.
    v_valore := -v_valore;
  else
    -- PIÙ DEL PREVISTO: entra all'ULTIMO PREZZO PAGATO per quel prodotto.
    --
    -- 🔴 QUI C'ERA «il costo dell'ultima partita», ED ERA AMBIGUO — trovato
    -- dalla prova, non rileggendo. Un carico da fattura scrive tutte le sue
    -- partite in UNA transazione, quindi hanno lo stesso `received_at`:
    -- l'ordinamento ne sceglieva una **a caso**, e il valore della merce
    -- trovata in più cambiava da un'esecuzione all'altra. È la trappola del
    -- 16/08 (*«dentro una transazione `now()` è un istante solo»*),
    -- ricomparsa per la terza volta.
    --
    -- ⚠️ E la cura non è un ordinamento più furbo: è **usare la regola che
    -- il progetto ha già deciso**. Dal 13/08 il food cost segue l'ULTIMO
    -- PREZZO PAGATO, e quel numero vive in `ingredients.current_price`, in
    -- un posto solo. Niente seconda regola, niente ambiguità.
    select current_price into v_costo from ingredients where id = p_ingredient_id;
    if v_costo is null then
      -- Ripiego: un prodotto che non ha mai avuto un prezzo di listino ma ha
      -- delle partite. Si prende il costo più alto fra quelle rimaste —
      -- ⚠️ **scelto perché è deterministico**, non perché sia più giusto:
      -- fra due partite scritte nello stesso istante «la più cara» è sempre
      -- la stessa, «l'ultima» no.
      select max(unit_cost) into v_costo
        from stock_lots where ingredient_id = p_ingredient_id;
    end if;
    if v_costo is null then
      raise exception
        'Di % non so quanto costa, quindi non posso dire quanto vale la merce in più. Registra prima un carico, oppure scrivi il prezzo sulla sua scheda.',
        v_nome;
    end if;
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, note)
    values (p_ingredient_id, v_diff, v_diff, v_costo,
            'Trovata in più durante un allineamento');
    v_valore := v_diff * v_costo;
  end if;

  insert into rettifiche_giacenza (ingredient_id, atteso, dichiarato, differenza, valore, note)
  values (p_ingredient_id, v_atteso, p_quanto_ce, v_diff, v_valore, nullif(btrim(p_note), ''))
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'prodotto', v_nome, 'atteso', v_atteso, 'dichiarato', p_quanto_ce,
    'differenza', v_diff, 'valore', v_valore, 'registrata', true,
    -- ⚠️ La frase esce insieme ai numeri: un messaggio composto dalla
    -- schermata sarebbe un secondo posto dove dire la stessa cosa.
    'frase', format('%s: ne risultavano %s %s, ne hai %s. %s %s.',
                    v_nome,
                    quantita(v_atteso), v_unita,
                    quantita(p_quanto_ce),
                    case when v_diff < 0 then 'Mancano' else 'Ce ne sono in più' end,
                    quantita(abs(v_diff)))
  );
end;
$function$;


-- ---------------------------------------------------------------------
-- 3 · E LA BOZZA D'ORDINE, che il punto se lo toglieva DA SOLA
-- ---------------------------------------------------------------------
-- ⚠️ Questa non era rotta: dal 14/08 scriveva
--   trim(trailing '.' from trim(trailing '0' from to_char(…)))
-- cioe' chi l'ha scritta **sapeva** del punto orfano e lo toglieva li'.
--
-- 🔴 E PROPRIO PER QUESTO VA PORTATA SULLA REGOLA UNICA: un rimedio
-- ripetuto a memoria in ogni funzione e' esattamente cio' che stanotte ha
-- fallito — la terza volta nessuno se l'e' ricordato, e Alessio ha letto
-- «54. kg». Portandola qui, il controllo di sotto smette di avere un elenco
-- di eccezioni scritte a mano: **un controllo con delle eccezioni invecchia
-- come il rimedio che sta sorvegliando.**
CREATE OR REPLACE FUNCTION public.bozza_ordine(p_supplier_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_forn      suppliers%rowtype;
  v_righe     jsonb;
  v_testo     text;
  v_telefono  text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' preparare un ordine';
  end if;

  select * into v_forn from suppliers where id = p_supplier_id;
  if v_forn.id is null then
    raise exception 'Fornitore non trovato';
  end if;

  -- Il numero per WhatsApp: si tolgono spazi e simboli e si scarta lo 00
  -- internazionale. Se non c'e' gia' il prefisso, si mette 39.
  --
  -- ⚠️ **Lo zero iniziale NON si toglie.** In quasi tutto il mondo il
  --    prefisso urbano perde lo zero passando al formato internazionale;
  --    **in Italia no**: +39 0932 123456 e' la forma giusta, e togliere
  --    quello zero manderebbe l'ordine a un numero diverso da quello
  --    scritto in rubrica. Un errore che non si vede: il messaggio parte
  --    lo stesso, e arriva a uno sconosciuto.
  --
  -- ⚠️ Un numero gia' internazionale si riconosce da 39 **e** dalla
  --    lunghezza: un cellulare come 391 234 5678 comincia per 39 senza
  --    essere prefissato, e trattarlo come tale lo storpierebbe.
  --
  -- Comunque vada, il numero completo torna indietro e la schermata lo
  -- MOSTRA accanto al pulsante: e' Alessio a vedere dove sta per
  -- scrivere, non il gestionale a indovinare per lui.
  v_telefono := regexp_replace(coalesce(v_forn.contact_phone, ''), '[^0-9]', '', 'g');
  if v_telefono like '00%' then v_telefono := substring(v_telefono from 3); end if;
  if v_telefono <> '' and not (v_telefono like '39%' and length(v_telefono) >= 12) then
    v_telefono := '39' || v_telefono;
  end if;
  v_telefono := nullif(v_telefono, '');

  with righe as (
    select
      sli.id                                             as riga_lista_id,
      sli.ingredient_id,
      a.id                                               as articolo_id,
      -- Se non so come lo chiama lui, uso il nome interno E LO DICO.
      coalesce(a.descrizione, i.name, sli.custom_name)   as descrizione,
      (a.id is not null)                                 as dicitura_sua,
      a.unita_fattura,
      a.fattore,
      sli.quantity_needed                                as quantita_base,
      coalesce(sli.unit, i.unit)::text                   as unita_base,
      -- Quante confezioni chiedere: per eccesso, perche' nessuno vende
      -- due terzi di cassa e mancare merce costa piu' che avanzarne.
      case
        when a.fattore is not null and a.fattore > 0 and sli.quantity_needed is not null
          then ceil(sli.quantity_needed / a.fattore)
        else sli.quantity_needed
      end                                                as quantita,
      ultimo.price                                       as prezzo_atteso
    from shopping_list_items sli
    left join ingredients i on i.id = sli.ingredient_id
    -- Fra le diciture di quel fornitore per quell'ingrediente si prende
    -- quella comprata piu' di recente: e' quella che lui riconosce.
    left join lateral (
      select af.*
        from articoli_fornitore af
        left join lateral (
          select max(ph.recorded_at) as quando
            from price_history ph where ph.articolo_id = af.id
        ) u on true
       where af.supplier_id = p_supplier_id
         and af.ingredient_id = sli.ingredient_id
         and not af.ignora
       order by u.quando desc nulls last, af.creato_il desc
       limit 1
    ) a on true
    left join lateral (
      select ph.price
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    where sli.supplier_id = p_supplier_id
      and sli.status = 'da_comprare'
    order by coalesce(a.descrizione, i.name, sli.custom_name)
  )
  select
    coalesce(jsonb_agg(to_jsonb(righe)), '[]'::jsonb),
    string_agg(
      '• ' || righe.descrizione
        || case when righe.quantita is not null
             then ' — ' || quantita(righe.quantita)
                  || coalesce(' ' || righe.unita_fattura, '')
             else '' end,
      E'\n' order by righe.descrizione)
  into v_righe, v_testo
  from righe;

  if v_testo is null then
    return jsonb_build_object(
      'fornitore', v_forn.name,
      'supplier_id', v_forn.id,
      'telefono', v_telefono,
      'telefono_scritto', v_forn.contact_phone,
      'email', v_forn.contact_email,
      'canale', v_forn.canale_ordine,
      'oggetto', null,
      'righe', '[]'::jsonb,
      'testo', null);
  end if;

  v_testo :=
    'Buongiorno, ordine per Borgo 58 — '
    || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
    || E'\n\n' || v_testo || E'\n\nGrazie!';

  return jsonb_build_object(
    'fornitore', v_forn.name,
    'supplier_id', v_forn.id,
    'telefono', v_telefono,
    'telefono_scritto', v_forn.contact_phone,
    'email', v_forn.contact_email,
    -- Il canale lo ha scritto lui sulla scheda. Vuoto vuol dire «non
    -- l'ha detto»: la schermata offre le strade che i recapiti
    -- permettono, senza preferirne una.
    'canale', v_forn.canale_ordine,
    -- L'oggetto della mail: chi riceve venti ordini al giorno lo legge
    -- prima del corpo, e «Borgo 58» dev'esserci dentro.
    'oggetto', 'Ordine Borgo 58 — '
               || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY'),
    'righe', v_righe,
    'testo', v_testo);
end;
$function$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid; v_ente uuid; v_ing uuid; v_r jsonb;
  v_quante integer; v_lap_p integer; v_lap_d integer; v_ok boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- 1 · IL CASO CHE ALESSIO HA LETTO A SCHERMO.
  if quantita(54) <> '54' then
    raise exception 'quantita(54) dice «%» invece di «54».', quantita(54);
  end if;
  if quantita(0) <> '0' then
    raise exception 'quantita(0) dice «%» invece di «0».', quantita(0);
  end if;

  -- 2 · I DECIMALI CI SONO QUANDO SERVONO, con la virgola.
  if quantita(1.5) <> '1,5' then
    raise exception 'quantita(1.5) dice «%» invece di «1,5».', quantita(1.5);
  end if;
  -- ⚠️ Tre decimali: in magazzino si pesano i grammi, e 0,250 kg e' una
  --    quantita' vera. Arrotondarla direbbe un'altra cosa.
  if quantita(0.250) <> '0,25' then
    raise exception 'quantita(0.250) dice «%» invece di «0,25».', quantita(0.250);
  end if;
  if quantita(0.125) <> '0,125' then
    raise exception 'quantita(0.125) dice «%» invece di «0,125».', quantita(0.125);
  end if;

  -- 3 · VUOTO NON E' ZERO.
  if quantita(null) is not null then
    raise exception 'quantita(null) dice «%» invece di niente.', quantita(null);
  end if;

  -- 4 · 🔴 LA FRASE VERA, provata sui dati veri: era li' che si leggeva
  --     «ne risultavano 54. kg, ne hai 58.. Ce ne sono in piu' 4..».
  --     ⚠️ Un ingrediente TUTTO NOSTRO (lezione del 16/08: il perimetro di una
  --     prova e' fatto di roba che la prova ha creato).
  insert into ingredients (entity_id, name, category, unit, waste_percentage_default, current_price)
  values (v_ente, '__VERIFICA__ quantita', 'verdura', 'kg', 0, 3.00)
  returning id into v_ing;
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
  values (v_ing, 54, 54, 3.00);

  v_r := allinea_giacenza(v_ing, 58);

  if v_r->>'frase' not like '%54 kg%' then
    raise exception 'La frase non dice «54 kg»: %', v_r->>'frase';
  end if;
  -- ⚠️ QUI IL PRIMO CONTROLLO ERA SBAGLIATO, ed e' la lezione di questa
  --    verifica: cercavo «58.» e prendeva anche il PUNTO DELLA FRASE, che e'
  --    legittimo. Una prova che non distingue il difetto dal testo normale
  --    fallisce su codice giusto — e chi la legge corregge il codice sano.
  --    Il difetto vero si riconosce da DUE segni: il punto doppio «58..» e
  --    il punto attaccato all'unita' «54. kg».
  if v_r->>'frase' like '%..%' then
    raise exception 'La frase ha il punto doppio: %', v_r->>'frase';
  end if;
  if v_r->>'frase' like '%. kg%' then
    raise exception 'La frase ha il punto orfano prima dell''unita di misura: %', v_r->>'frase';
  end if;
  if v_r->>'frase' not like '%58%' then
    raise exception 'La frase non dice il numero dichiarato: %', v_r->>'frase';
  end if;

  -- 5 · E LA FRASE DEL «e' gia' questo», che usava la stessa maschera.
  v_r := allinea_giacenza(v_ing, 58);
  if (v_r->>'registrata')::boolean then
    raise exception 'Scrivere lo stesso numero ha prodotto uno scostamento.';
  end if;
  if v_r->>'frase' like '%..%' or v_r->>'frase' like '%. kg%' then
    raise exception 'La frase del «e'' gia'' questo» ha il punto orfano: %', v_r->>'frase';
  end if;

  -- 6 · 🔴 IL CONTROLLO CHE VALE PIU' DEGLI ALTRI, ed e' una PROPRIETA':
  --     nessuna funzione scrive piu' una quantita' con la maschera che lascia
  --     il punto. Se domani qualcuno la riscrive, questa riga la prende —
  --     ⚠️ ed e' precisamente cio' che il 14/08 mancava: li' il punto si
  --     toglieva a mano, e un rimedio ripetuto a memoria non e' una regola.
  select count(*) into v_quante
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname not in ('quantita', 'percento', 'euro')
     and pg_get_functiondef(p.oid) like '%FM999999990.999%'
     -- ⚠️ NESSUNA ECCEZIONE, e non e' rigore per il gusto: un controllo con
     --    un elenco di nomi scritti a mano invecchia come il rimedio che
     --    sorveglia. `bozza_ordine` si curava da sola e ora passa da qui.
     ;
  if v_quante > 0 then
    raise exception
      'Ci sono ancora % funzioni che scrivono una quantita'' con la maschera che lascia il punto.', v_quante;
  end if;

  -- =========== PULIZIA ===========
  delete from rettifiche_giacenza where ingredient_id = v_ing;
  delete from stock_lots where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  if exists (select 1 from ingredients where name like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Una quantita'' si scrive in un modo solo: «54 kg», non «54.» ne'' «54,000».';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260821000003', 'una_quantita_si_scrive_in_un_modo_solo')
on conflict (version) do nothing;
