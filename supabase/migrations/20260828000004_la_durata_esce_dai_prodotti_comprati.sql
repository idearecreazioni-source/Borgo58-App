-- ============================================================================
-- LA DURATA ESCE DAI PRODOTTI COMPRATI — 28/08/2026
-- ============================================================================
--
-- La meta' che TOGLIE. La `20260828000003` ha messo la durata sulla ricetta e
-- ha insegnato alle produzioni a calcolare da se' la propria scadenza; questa
-- porta via la durata dai prodotti che si comprano, come Alessio ha deciso il
-- 27/08 sera: non la vuole compilata a mano e non la vuole dedotta da MEMO.
--
-- ⚠️ SONO SEPARATE APPOSTA, e l'ordine conta: se entrasse prima questa, ci
--    sarebbe un momento in cui nessuna durata esiste da nessuna parte.
--
-- ----------------------------------------------------------------------------
-- IL RAGGIO, misurato e non stimato
-- ----------------------------------------------------------------------------
--    `ingredients.shelf_life_days` e' nominata da NOVE funzioni — contate sul
--    catalogo, in produzione e sulla prova, e sono le stesse nove. Nessuna
--    vista dipende dalla colonna. Fuori dal database la nominano cinque file
--    dell'app, due funzioni online e quattro prove.
--
--    · applica_lettura_etichetta ... MEMO scriveva la durata letta   → smette
--    · applica_scheda_prodotto ..... idem                            → smette
--    · create_ingredient ........... aveva la durata fra i parametri → sparisce
--    · numeri_sospetti ............. segnalava le durate > 1095 gg   → sparisce
--    · partite_ferme ............... IL FERMO                        → muore
--    · partite_in_giacenza ......... esponeva durata e giudizio      → perde il giudizio
--    · partite_in_scadenza ......... la usava per il PREAVVISO       → resta, con due fonti
--    · prodotti_da_compilare ....... «durata» fra i campi da riempire→ sparisce
--    · tocca_campo_confermato ...... seguiva chi cambiava la durata  → sparisce
--
-- ----------------------------------------------------------------------------
-- 🔴 COSA MUORE DAVVERO, e Alessio l'ha accettato espressamente
-- ----------------------------------------------------------------------------
--    L'avviso «prodotto aperto e fermo da troppo». `partite_ferme` pretende
--    `shelf_life_days is not null` e non ha nessun'altra fonte: senza quel
--    dato non puo' produrre nemmeno una riga.
--
-- ⚠️ QUINDI SI TOGLIE, NON SI LASCIA A RISPONDERE VUOTO. Una funzione viva che
--    non puo' piu' dire niente risponde «nessuna partita ferma» — che si legge
--    «va tutto bene» ed e' invece «non lo so piu'». Uno zero non e' una
--    risposta. Stessa ragione per cui `partite_in_giacenza` perde le colonne
--    `e_ferma` e `perche`: un giudizio sempre negativo e' peggio di nessun
--    giudizio.
--
-- ⚠️ E IL FATTO RESTA: «ferma da N giorni» si calcola dall'ultima mossa e non
--    ha bisogno di nessuna durata. Quello che sparisce e' «ferma da TROPPO»,
--    che senza durata nessuno puo' dire. La schermata elenca cio' che sta
--    fermo da piu' tempo, e a giudicare e' chi guarda.
--
-- ----------------------------------------------------------------------------
-- COSA NON MUORE — lo scadenziario
-- ----------------------------------------------------------------------------
--    `partite_in_scadenza` prende la DATA da `stock_lots.expiry_date`, che e'
--    la scadenza stampata sulla confezione e resta dov'e' (MEMO continua a
--    leggerla dall'etichetta). La durata la usava solo per decidere il
--    PREAVVISO, e `preavviso_giorni` ha tre fonti in ordine: quella scritta a
--    mano sul prodotto, la durata, il tipo di conservazione. Ne perde una di
--    mezzo e le altre due bastano.
--
-- 🔴 MA IL PREAVVISO CAMBIA PER SETTE PRODOTTI SU 133, MISURATO sulla prova, e
--    va detto perche' nessuno lo ha chiesto:
--      · basilico, cavolfiore, cipollotto, finocchietto (ambiente, 3-7 giorni)
--        passano da 2 a 14 giorni di preavviso — si fanno vedere prima;
--      · burro, caciocavallo, crema di pistacchio (frigo, 30 giorni) passano
--        da 14 a 2 — si fanno vedere piu' tardi.
--    Gli altri 126 non cambiano. Nessun prodotto ha un preavviso scritto a
--    mano, quindi oggi decide tutto il tipo di conservazione.
--
-- ⚠️ E LE 53 DURATE CHE SPARISCONO ERANO TUTTE DEDOTTE DA MEMO: il preavviso
--    smette di dipendere da un numero che una macchina aveva indovinato. Chi
--    vuole un preavviso diverso lo scrive, ed e' un campo che esiste gia'.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA PER IL LOCALE
-- ----------------------------------------------------------------------------
--    Sparisce un campo dalla scheda di un prodotto, e sparisce l'avviso sui
--    prodotti fermi. Lo scadenziario continua a funzionare sulle date vere
--    stampate sulle confezioni.
-- ============================================================================

-- ---------------------------------------------------------------------
-- 1 · Il preavviso perde una fonte, e diventa una funzione nuova
-- ---------------------------------------------------------------------
-- ⚠️ NON SI LASCIA IL PARAMETRO A PRENDERE `null`: un parametro che nessuno
--    puo' piu' riempire e' una promessa scaduta scritta nella firma, e fra sei
--    mesi qualcuno prova a usarlo.
create or replace function public.preavviso_giorni(p_esplicito integer, p_conservazione storage_type)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_esplicito is not null and p_esplicito >= 0 then p_esplicito
    -- Senza un numero scritto a mano, lo dice dove si conserva.
    when p_conservazione in ('frigo_0_4', 'frigo_4_8') then 2
    else 14
  end;
$function$;

comment on function public.preavviso_giorni(integer, storage_type) is
  'Quanti giorni prima della scadenza una partita si fa vedere. Due fonti in ordine: il numero scritto a mano sul prodotto, altrimenti il tipo di conservazione. ⚠️ Ne aveva una terza — la durata dichiarata del prodotto — tolta il 28/08/2026 con la durata stessa: era un numero dedotto da MEMO, e il preavviso non deve dipendere da un''ipotesi di una macchina.';

revoke all on function public.preavviso_giorni(integer, storage_type) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2 · Le funzioni che cambiano forma si lasciano cadere prima
-- ---------------------------------------------------------------------
-- ⚠️ `create or replace` non basta: `partite_in_giacenza` cambia le colonne
--    che restituisce (Postgres rifiuta un cambio di tipo di ritorno) e
--    `create_ingredient` perde un parametro, cioe' e' una funzione diversa —
--    e due funzioni sovrapposte rendono ambigua ogni chiamata per nome.
drop function if exists public.partite_in_giacenza(text);
drop function if exists public.create_ingredient(uuid, text, text, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, integer, numeric, text, text, numeric, boolean, boolean);

-- 🔴 IL FERMO MUORE, non resta a rispondere vuoto.
drop function if exists public.partite_ferme();

-- ---------------------------------------------------------------------
-- Dichiarazioni alla rete delle guardie
-- ---------------------------------------------------------------------
-- ⚠️ La rete che sorveglia le riscritture ha fermato questa migrazione, ed
--    e' il suo lavoro: da cinque funzioni spariscono righe che nel corpo vivo
--    ci sono. Qui si dichiara che spariscono APPOSTA, una per una — perche'
--    quattro volte in questo progetto una funzione riscritta ha annullato in
--    silenzio qualcosa che era stato aggiunto dopo.
-- rete-guardie: prodotti_da_compilare — «durata» non e' piu' un campo da riempire: la durata dei prodotti comprati non esiste piu', quindi chiederla sarebbe chiedere una cosa che non si puo' dare
-- rete-guardie: tocca_campo_confermato — non c'e' piu' nessun campo «durata» da seguire: seguire un campo che non esiste e' una riga morta che il prossimo lettore prende per buona
-- rete-guardie: applica_lettura_etichetta — MEMO non scrive piu' la durata letta dall'etichetta: e' la meta' della decisione di Alessio del 27/08, non un effetto collaterale
-- rete-guardie: applica_scheda_prodotto — idem: nessun assistente deduce piu' la durata di un prodotto comprato
-- rete-guardie: partite_in_giacenza — perde «durata_giorni», «perche» ed «e_ferma»: senza durata il giudizio «e' ferma da troppo» non si puo' dare, e una colonna sempre falsa direbbe «va tutto bene» a chi la guarda. Il fatto «ferma da N giorni» resta.

-- --- partite_in_scadenza ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.partite_in_scadenza()
 RETURNS TABLE(lotto_id uuid, ingrediente text, ingrediente_id uuid, quantita numeric, unita text, scadenza date, giorni_mancanti integer, preavviso integer, lotto_fornitore text, da_segnalare boolean, perche_muta text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as g),
  aperte as (
    select l.id, l.ingredient_id, l.quantity_remaining, l.expiry_date,
           l.received_at, l.supplier_batch_number,
           i.name, i.unit::text as unita,
           preavviso_giorni(i.giorni_preavviso_scadenza, i.storage_type) as preavviso
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
     where l.quantity_remaining > 0
       and l.expiry_date is not null
       and l.chiusa_il is null
  )
  select a.id, a.name, a.ingredient_id, a.quantity_remaining, a.unita,
         a.expiry_date,
         (a.expiry_date - o.g)::integer,
         a.preavviso,
         a.supplier_batch_number,
         (a.expiry_date - o.g) <= a.preavviso and not exists (
           select 1 from aperte n
            where n.ingredient_id = a.ingredient_id
              and n.id <> a.id
              and n.received_at > a.received_at
         ),
         case
           when exists (
             select 1 from aperte n
              where n.ingredient_id = a.ingredient_id
                and n.id <> a.id
                and n.received_at > a.received_at
           ) then 'ne e'' entrata una partita piu'' recente, ancora in giacenza'
           when (a.expiry_date - o.g) > a.preavviso
             then 'mancano piu'' di ' || a.preavviso || ' giorni'
           else null
         end
    from aperte a cross join oggi o
   order by a.expiry_date, a.name;
$function$;

-- --- prodotti_da_compilare ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.prodotti_da_compilare()
 RETURNS TABLE(id uuid, nome text, unita text, categoria text, alimentare boolean, mancano text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere l''anagrafica dei prodotti';
  end if;

  return query
  select i.id, i.name, i.unit::text, i.category::text, i.alimentare,
         array_remove(array[
           case when i.storage_type is null            then 'conservazione'   end,
           case when i.temperatura_attesa is null    then 'temperatura'     end,
           case when coalesce(array_length(i.seasonality, 1), 0) = 0
                                                       then 'stagionalita'    end,
           -- Lo scarto manca solo se NESSUNO ha ancora compilato la
           -- scheda: uno zero scritto dall'assistente e' una risposta.
           -- 🔴 LO SCARTO NON E' PIU' UN CAMPO CHE MANCA (23/08):
           -- non lo propone piu' nessuno, si scrive a mano quando si sa, e
           -- il dato vero emerge dalla preparazione.

           case when i.origine_allergeni is null       then 'allergeni'       end
         ], null)
    from ingredients i
   where i.active
     and (i.storage_type is null
          or i.temperatura_attesa is null
          or coalesce(array_length(i.seasonality, 1), 0) = 0

          or i.origine_allergeni is null)
   order by i.name;
end
$function$;

-- --- tocca_campo_confermato ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.tocca_campo_confermato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_tolti text[] := '{}';
begin
  -- ⚠️ Solo se il VALORE cambia davvero: un salvataggio che riscrive lo
  -- stesso numero non e' uno sguardo. Ed e' la differenza fra «l'ha
  -- confermato» e «ha premuto Salva».
  -- ⚠️ IL `::text` NON E' PIGNOLERIA: senza, Postgres legge 'durata' come
  -- un letterale di ARRAY e si ferma con «malformed array literal». Trovato
  -- applicando, non rileggendo — la verifica chiama la funzione, e una
  -- funzione che si crea non e' una funzione che funziona (17/08).
  if new.seasonality is distinct from old.seasonality then v_tolti := v_tolti || 'stagionalita'::text; end if;
  if new.storage_type is distinct from old.storage_type then v_tolti := v_tolti || 'conservazione'::text; end if;
  if new.temperatura_attesa is distinct from old.temperatura_attesa then v_tolti := v_tolti || 'temperatura'::text; end if;
  if new.waste_percentage_default is distinct from old.waste_percentage_default then v_tolti := v_tolti || 'scarto'::text; end if;

  -- 🔴 AGGIUNTI IL 25/08: i campi che una lettura d'etichetta puo'
  -- proporre e che prima nessuno sorvegliava. Senza queste due righe, il
  -- nome e la categoria resterebbero marcati «l'ha messi l'assistente»
  -- anche dopo che Alessio li ha riscritti — cioe' la marcatura direbbe
  -- il falso proprio nel caso in cui serve.
  if new.name is distinct from old.name then v_tolti := v_tolti || 'nome'::text; end if;
  if new.category is distinct from old.category then v_tolti := v_tolti || 'categoria'::text; end if;
  if new.unit is distinct from old.unit then v_tolti := v_tolti || 'unita'::text; end if;

  -- 🔴 AGGIUNTO IL 27/08: la mano che tocca gli allergeni si registra da
  --    se'. Chi sa da dove vengono lo DICHIARA scrivendo anche l'origine;
  --    chi cambia il solo elenco e' una persona che ha guardato.
  if new.allergens is distinct from old.allergens
     and new.origine_allergeni is not distinct from old.origine_allergeni then
    new.origine_allergeni := 'confermati';
    v_tolti := v_tolti || 'allergeni'::text;
  end if;

  if array_length(v_tolti, 1) > 0 then
    new.campi_da_confermare := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_da_confermare) x
       where x <> all (v_tolti)
    ), '{}');

    new.campi_dall_assistente := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_dall_assistente) x
       where x <> all (v_tolti)
    ), '{}');
  end if;
  return new;
end;
$function$;

-- --- numeri_sospetti ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.numeri_sospetti()
 RETURNS TABLE(dove text, che_cosa text, valore text, perche text, riferimento uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 🔴 IL PORTIERE. `security definer` gira senza RLS, quindi il controllo
  -- va rimesso dentro (rilievo del validatore del 13/08): qui ci sono
  -- prezzi d'acquisto, importi di fatture e movimenti di cassa, che lo
  -- staff non deve vedere. E chi non deve vedere riceve un RIFIUTO, non
  -- un elenco vuoto — una schermata vuota e' una rassicurazione falsa.
  if not is_titolare() then
    raise exception 'I numeri sospetti sono riservati al titolare.';
  end if;

  return query
  -- Previsione: le percentuali strane
  select 'Previsione'::text,
         s.nome || ' — food cost',
         to_char(s.food_cost_percento * 100, 'FM990.0') || '%',
         'Sopra il 50%: possibile, ma su un piatto vuol dire che quasi meta'' del prezzo e'' materia prima.'::text,
         s.id
    from scenari_proiezione s where s.food_cost_percento > 0.5

  union all
  select 'Previsione',
         s.nome || ' — beverage cost',
         to_char(s.beverage_cost_percento * 100, 'FM990.0') || '%',
         'Sopra il 50%: sul beverage il margine e'' di solito piu'' alto che sul cibo.',
         s.id
    from scenari_proiezione s where s.beverage_cost_percento > 0.5

  union all
  select 'Previsione',
         s.nome || ' — tasse e contributi sopra il netto',
         to_char(s.pressione_personale * 100, 'FM990.0') || '%',
         'Sopra il 150%: il costo aziendale sarebbe piu'' del doppio di quello che il dipendente porta a casa.',
         s.id
    from scenari_proiezione s where s.pressione_personale > 1.5

  union all
  select 'Previsione',
         s.nome || ' — ore lavorate al giorno',
         to_char(s.ore_giorno, 'FM990.0') || ' ore',
         'Fuori dall''intervallo 4-12: possibile, ma cambia il netto orario di tutto il personale.',
         s.id
    from scenari_proiezione s where s.ore_giorno < 4 or s.ore_giorno > 12

  union all
  select 'Previsione',
         s.nome || ' — commissione POS',
         to_char(s.commissione_pos_percento * 100, 'FM990.00') || '%',
         'Sopra il 5%: e'' molto piu'' del normale per un esercizio commerciale.',
         s.id
    from scenari_proiezione s where s.commissione_pos_percento > 0.05

  -- ⚠️ LA STESSA SOGLIA SULLA STESSA COSA, nell'altra tabella. Aggiunta
  -- il 24/08 con la migrazione che ha portato le due colonne alla stessa
  -- unita': fino ad allora la commissione prevista aveva il suo occhio
  -- addosso e quella VERA — quella su cui si contano i soldi che
  -- arrivano in banca — non ce l'aveva.
  union all
  select 'Tesoreria',
         'Commissione del POS',
         to_char(t.commissione_pos_percento * 100, 'FM990.00') || '%',
         'Sopra il 5%: e'' molto piu'' del normale per un esercizio commerciale. Se la banca dice 1,5, nel campo va 1,5.',
         t.entity_id
    from impostazioni_tesoreria t where t.commissione_pos_percento > 0.05

  union all
  select 'Previsione',
         s.nome || ' — scontrino per coperto',
         to_char(s.scontrino_food + s.scontrino_beverage, 'FM999990.00') || ' €',
         'Sopra i 200 € a persona: possibile per un menu degustazione, non per il servizio normale.',
         s.id
    from scenari_proiezione s where s.scontrino_food + s.scontrino_beverage > 200

  -- Magazzino
  union all
  select 'Magazzino',
         i.name || ' — scarto',
         to_char(i.waste_percentage_default, 'FM990.0') || '%',
         'Sopra il 60%: succede (carciofi, pesce da pulire), ma triplica il fabbisogno di quel prodotto.',
         i.id
    from ingredients i where i.active and i.waste_percentage_default > 60


  union all
  select 'Magazzino',
         i.name || ' — prezzo per ' || i.unit::text,
         to_char(i.current_price, 'FM999990.00') || ' €',
         'Sopra i 500 € per unita'': vero per zafferano e tartufo, altrimenti e'' un''unita'' di misura sbagliata.',
         i.id
    from ingredients i where i.active and i.current_price > 500

  union all
  select 'Ricettario',
         r.name || ' — una riga da ' || to_char(ri.quantity, 'FM999990.0000') || ' ' ||
           coalesce(i.unit::text, ''),
         to_char(ri.quantity, 'FM999990.0000'),
         'Oltre 5 unita'' in una riga di ricetta: possibile su acqua e farina, sospetto su tutto il resto — e'' la forma dei grammi scritti come chili.',
         ri.recipe_id
    from recipe_ingredients ri
    join recipes r on r.id = ri.recipe_id
    left join ingredients i on i.id = ri.ingredient_id
   where ri.quantity > 5

  -- Denaro
  union all
  select 'Fatture fornitori',
         s.name || ' — fattura ' || f.invoice_number,
         to_char(f.amount, 'FM999990.00') || ' €',
         'Sopra i 20.000 €: per un''osteria da 34 coperti e'' fuori scala, e una virgola persa fa esattamente questo.',
         f.id
    from supplier_invoices f join suppliers s on s.id = f.supplier_id
   where f.amount > 20000

  union all
  select 'Prima nota',
         coalesce(nullif(btrim(coalesce(m.note, '')), ''), c.label, 'movimento senza descrizione'),
         to_char(m.amount, 'FM999990.00') || ' €',
         'Movimento sopra i 10.000 €: puo'' essere un finanziamento o un versamento, ma vale la pena rileggerlo.',
         m.id
    from cash_movements m left join cash_causali c on c.id = m.causale_id
   where m.amount > 10000

  union all
  select 'Editor menu',
         coalesce(r.name, 'piatto senza ricetta') || ' — prezzo di vendita',
         to_char(mi.selling_price, 'FM999990.00') || ' €',
         'Sopra i 100 € a piatto: fuori scala per questo locale.',
         mi.id
    from menu_items mi left join recipes r on r.id = mi.recipe_id
   where mi.selling_price > 100

  order by 1, 2;
end $function$;

-- --- applica_lettura_etichetta ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.applica_lettura_etichetta(p_ingredient_id uuid, p_campi jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ing       ingredients%rowtype;
  v_allergeni allergen[] := '{}';
  v_scartati  text[] := '{}';
  v_scritti   text[] := '{}';
  v_voce      jsonb;
  v_codice    text;
  v_origine   text;
  v_a         allergen;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' applicare la lettura di un''etichetta.';
  end if;

  select * into v_ing from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Questo prodotto non esiste piu''.';
  end if;

  if v_ing.origine_allergeni = 'confermati' then
    -- Un rifiuto senza via d'uscita e' un vicolo cieco: si dice cosa fare.
    return jsonb_build_object(
      'id', p_ingredient_id,
      'scritti', to_jsonb('{}'::text[]),
      'scartati', to_jsonb(array['allergeni: li hai gia'' verificati tu, e una lettura automatica non li scavalca. Per cambiarli, correggili a mano nella scheda.']),
      'allergeni_toccati', 0);
  end if;

  -- ------------------------------------------------------------------
  -- Gli allergeni, con la loro origine uno per uno
  -- ------------------------------------------------------------------
  if p_campi ? 'allergeni' then
    for v_voce in select jsonb_array_elements(p_campi->'allergeni')
    loop
      v_codice  := v_voce->>'codice';
      v_origine := coalesce(v_voce->>'origine', 'dedotto');

      -- ⚠️ Un codice che non esiste si SCARTA e si dichiara, invece di
      --    far fallire tutta la lettura: un allergene inventato dal
      --    modello non deve portarsi via gli altri tredici che ha preso.
      begin
        v_a := v_codice::allergen;
      exception when others then
        v_scartati := v_scartati || ('allergene sconosciuto: ' || coalesce(v_codice, '(vuoto)'));
        continue;
      end;

      if v_origine not in ('etichetta','fonte','dedotto') then
        v_scartati := v_scartati || ('origine sconosciuta per ' || v_codice || ': ' || v_origine);
        continue;
      end if;

      -- ⚠️ `fonte` senza il nome della fonte SCENDE a `dedotto`, non viene
      --    scartato: l'allergene c'e' comunque e toglierlo sarebbe la cosa
      --    pericolosa. Quello che si perde e' la pretesa di attendibilita'.
      if v_origine = 'fonte' and coalesce(btrim(v_voce->>'fonte'), '') = '' then
        v_origine := 'dedotto';
        v_scartati := v_scartati || ('fonte non indicata per ' || v_codice || ': vale come dedotto');
      end if;

      v_allergeni := v_allergeni || v_a;

      insert into allergeni_prodotto (ingredient_id, allergene, origine, fonte, creato_da)
      values (p_ingredient_id, v_a, v_origine, nullif(btrim(v_voce->>'fonte'), ''), auth.uid())
      on conflict (ingredient_id, allergene) do update
        set origine   = excluded.origine,
            fonte     = excluded.fonte,
            creato_il = now(),
            creato_da = excluded.creato_da
        -- Una lettura non declassa mai quello che Alessio ha scritto.
        where allergeni_prodotto.origine <> 'alessio';
    end loop;

    -- ⚠️ SI SCRIVE L'INSIEME LETTO, non l'unione con quello di prima.
    --    Un'etichetta e' una dichiarazione completa: se il glutine non c'e'
    --    piu', tenerlo perche' c'era prima vorrebbe dire non aver letto
    --    l'etichetta. Le righe di origine rimaste senza allergene se le
    --    porta via il trigger.
    update ingredients set allergens = v_allergeni where id = p_ingredient_id;
    v_scritti := v_scritti || 'allergeni'::text;
  end if;

  -- ------------------------------------------------------------------
  -- Gli altri campi: solo dove non c'e' gia' qualcosa
  -- ------------------------------------------------------------------
  if v_ing.storage_type is null and nullif(p_campi->>'conservazione', '') is not null then
    begin
      update ingredients set storage_type = (p_campi->>'conservazione')::storage_type
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'conservazione'::text;
    exception when others then
      v_scartati := v_scartati || ('conservazione: ' || (p_campi->>'conservazione'));
    end;
  end if;

  if v_ing.temperatura_attesa is null and nullif(p_campi->>'temperatura', '') is not null then
    update ingredients set temperatura_attesa = p_campi->>'temperatura'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'temperatura'::text;
  end if;

  -- ⚠️ Gli allergeni NON entrano fra i «campi da confermare»: ce l'hanno
  --    gia' una loro origine, con quattro stati invece di due. Metterli
  --    anche li' sarebbero due posti che dicono la stessa cosa — la stessa
  --    ragione per cui `applica_scheda_prodotto` li tiene fuori.
  update ingredients
     set campi_compilati_il = now(),
         campi_da_confermare = coalesce((
           select array_agg(distinct x order by x)
             from unnest(campi_da_confermare || v_scritti) x
            where x <> 'allergeni'
         ), '{}')
   where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati),
    'allergeni_toccati', coalesce(array_length(v_allergeni, 1), 0));
end $function$;

-- --- applica_scheda_prodotto ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.applica_scheda_prodotto(p_ingredient_id uuid, p_campi jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ing        ingredients%rowtype;
  v_allergeni  allergen[] := '{}';
  v_mesi       month_code[] := '{}';
  v_scartati   text[] := '{}';
  v_x          text;
  v_scritti    text[] := '{}';
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' compilare la scheda di un prodotto';
  end if;

  select * into v_ing from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Questo prodotto non esiste piu''';
  end if;

  -- Gli allergeni si scrivono solo se nessuno li ha ancora guardati:
  -- una stima non sovrascrive mai un'etichetta letta ne' una conferma.
  if v_ing.origine_allergeni is null and p_campi ? 'allergeni' then
    for v_x in select jsonb_array_elements_text(p_campi->'allergeni')
    loop
      begin
        v_allergeni := v_allergeni || v_x::allergen;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    update ingredients
       set allergens = v_allergeni,
           origine_allergeni = 'stimati'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'allergeni'::text;
  end if;

  if coalesce(array_length(v_ing.seasonality, 1), 0) = 0 and p_campi ? 'stagionalita' then
    for v_x in select jsonb_array_elements_text(p_campi->'stagionalita')
    loop
      begin
        v_mesi := v_mesi || v_x::month_code;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    if array_length(v_mesi, 1) > 0 then
      update ingredients set seasonality = v_mesi where id = p_ingredient_id;
      v_scritti := v_scritti || 'stagionalita'::text;
    end if;
  end if;

  if v_ing.storage_type is null and nullif(p_campi->>'conservazione', '') is not null then
    begin
      update ingredients
         set storage_type = (p_campi->>'conservazione')::storage_type
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'conservazione'::text;
    exception when others then
      v_scartati := v_scartati || (p_campi->>'conservazione');
    end;
  end if;

  if v_ing.temperatura_attesa is null and nullif(p_campi->>'temperatura', '') is not null then
    update ingredients
       set temperatura_attesa = p_campi->>'temperatura'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'temperatura'::text;
  end if;

  -- Lo scarto: zero e' il valore di partenza e vuol dire «non lo so»,
  -- non «non si scarta niente». Sopra il 95% e' quasi certamente un
  -- errore del modello, e sfalserebbe il costo di ogni piatto.
  -- 🔴 LO SCARTO NON SI SCRIVE PIU' QUI (23/08/2026, decisione di
  -- Alessio). Se il modello lo mandasse lo stesso, si dichiara come
  -- scartato invece di finire nel costo dei piatti.
  if (p_campi->>'scarto_percento') is not null then
    v_scartati := v_scartati || 'scarto (non si indovina: lo dice la preparazione)'::text;
  end if;

  -- 🔴 «NON E' UN ALIMENTO» (23/08/2026). Solo in questa direzione:
  -- marcarlo alimento non farebbe niente, marcarlo non-alimento lo toglie
  -- dal Ricettario — e quello si vede. E si scrive solo se nessuno ha gia'
  -- deciso il contrario a mano.
  if (p_campi->>'alimentare') = 'false' and v_ing.alimentare
     and not ('alimentare' = any (coalesce(v_ing.campi_da_confermare, '{}'::text[]))) then
    update ingredients set alimentare = false where id = p_ingredient_id;
    v_scritti := v_scritti || 'alimentare'::text;
  end if;

  -- Da dove viene cio' che la macchina ha proposto. Non cambia il valore:
  -- dichiara su cosa si regge.
  if nullif(p_campi->>'fonte_stagionalita', '') is not null
     or nullif(p_campi->>'fonte_durata', '') is not null then
    update ingredients
       set fonti_campi = fonti_campi
             || jsonb_strip_nulls(jsonb_build_object(
                  'stagionalita', nullif(p_campi->>'fonte_stagionalita', ''),
                  'durata',       nullif(p_campi->>'fonte_durata', '')))
     where id = p_ingredient_id;
  end if;

  -- 🔴 IL SEGNO (23/08/2026). Prima questa riga scriveva solo QUANDO la
  -- macchina aveva compilato; adesso scrive anche COSA, cosi' che a schermo
  -- si veda quale numero e' una stima e quale l'ha guardato Alessio.
  --
  -- ⚠️ Gli allergeni restano fuori dalla lista, e non e' una dimenticanza:
  -- ce l'hanno gia' una loro (`origine_allergeni`), con tre stati invece di
  -- due perche' li' esiste l'etichetta, che e' la fonte legale. Metterli
  -- anche qui vorrebbe dire due posti che dicono la stessa cosa e possono
  -- contraddirsi — che in questo progetto e' un difetto, non una comodita'.
  update ingredients
     set campi_compilati_il = now(),
         campi_da_confermare = coalesce((
           select array_agg(distinct x order by x)
             from unnest(campi_da_confermare || v_scritti) x
            where x <> 'allergeni'
         ), '{}')
   where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati));
end
$function$;

-- --- create_ingredient ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_ingredient(p_entity_id uuid, p_name text, p_category text, p_unit unit_type, p_current_price numeric, p_source_type ingredient_source DEFAULT 'fornitore_esterno'::ingredient_source, p_supplier_id uuid DEFAULT NULL::uuid, p_producer_entity_id uuid DEFAULT NULL::uuid, p_allergens allergen[] DEFAULT '{}'::allergen[], p_seasonality month_code[] DEFAULT '{}'::month_code[], p_storage_type storage_type DEFAULT NULL::storage_type, p_waste_percentage_default numeric DEFAULT 0, p_haccp_receiving_temp text DEFAULT NULL::text, p_haccp_notes text DEFAULT NULL::text, p_stock_minimum_threshold numeric DEFAULT NULL::numeric, p_alimentare boolean DEFAULT true, p_tenuto_in_magazzino boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row ingredients%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' gestire gli ingredienti';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Serve il nome dell''ingrediente';
  end if;
  if p_current_price is null or p_current_price < 0 then
    raise exception 'Il prezzo non puo'' essere negativo o mancante';
  end if;
  -- Zero non e' «nessuna soglia»: sarebbe una soglia che non scatta mai,
  -- cioe' una riga vuota che sembra compilata. Se non serve, si lascia
  -- vuota (null) e l'ingrediente non entra in lista da solo.
  if p_stock_minimum_threshold is not null and p_stock_minimum_threshold <= 0 then
    raise exception 'La scorta minima deve essere maggiore di zero, oppure lasciata vuota';
  end if;

  insert into ingredients (
    entity_id, name, category, unit, current_price, source_type,
    supplier_id, producer_entity_id, allergens, seasonality, storage_type,
    waste_percentage_default, temperatura_attesa, haccp_notes,
    stock_minimum_threshold, alimentare, tenuto_in_magazzino
  ) values (
    p_entity_id, btrim(p_name), p_category, p_unit, p_current_price,
    coalesce(p_source_type, 'fornitore_esterno'), p_supplier_id,
    p_producer_entity_id, coalesce(p_allergens, '{}'),
    coalesce(p_seasonality, '{}'), p_storage_type,
    coalesce(p_waste_percentage_default, 0), p_haccp_receiving_temp, p_haccp_notes,
    p_stock_minimum_threshold,
    -- ⚠️ `coalesce` e non il valore secco: chi non passa niente ottiene il
    -- predefinito di sempre, e nessuna chiamata gia' scritta cambia
    -- comportamento.
    coalesce(p_alimentare, true), coalesce(p_tenuto_in_magazzino, true)
  )
  returning * into v_row;

  -- Lo storico parte SEMPRE dal prezzo iniziale, nella stessa transazione.
  insert into price_history (ingredient_id, price, supplier_id, source, note)
  values (v_row.id, p_current_price, p_supplier_id, 'manuale', 'Prezzo iniziale');

  return to_jsonb(v_row);
end;
$function$;

-- --- partite_in_giacenza ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.partite_in_giacenza(p_cerca text DEFAULT NULL::text)
 RETURNS TABLE(lotto_id uuid, ingrediente_id uuid, prodotto text, unita text, giacenza numeric, trasformata numeric, da_guardare numeric, ultima_mossa date, ferma_da integer, scadenza date, ricordamelo_il date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_oggi date := oggi_a_roma();
  v_q    text := nullif(btrim(coalesce(p_cerca, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  with mosse as (
    select c.ingredient_id,
           max((c.created_at at time zone 'Europe/Rome')::date) as ultima
      from stock_consumptions c
     group by c.ingredient_id
  ),
  trasf as (
    select t.lotto_id, sum(t.quantita) as quanta
      from trasformazioni_dichiarate t
     group by t.lotto_id
  ),
  base as (
    select l.id, l.ingredient_id, i.name, i.unit::text as u,
           l.quantity_remaining as giac,
           coalesce(tr.quanta, 0) as trasf,
           greatest(
             coalesce(m.ultima, (l.received_at at time zone 'Europe/Rome')::date),
             coalesce((l.abbattuta_il at time zone 'Europe/Rome')::date,
                      (l.received_at at time zone 'Europe/Rome')::date)
           ) as ultima_mossa,
           l.expiry_date, l.ricordamelo_il
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
      left join mosse m on m.ingredient_id = l.ingredient_id
      left join trasf tr on tr.lotto_id = l.id
     where l.quantity_remaining > 0
       and l.chiusa_il is null
       and i.tenuto_in_magazzino
       and (v_q is null or i.name ilike '%' || v_q || '%')
  )
  select b.id, b.ingredient_id, b.name, b.u,
         b.giac, b.trasf,
         greatest(b.giac - b.trasf, 0),
         b.ultima_mossa,
         (v_oggi - b.ultima_mossa)::int,
         b.expiry_date,
         b.ricordamelo_il
    from base b
   where b.giac > b.trasf
   order by (v_oggi - b.ultima_mossa) desc, b.name;
end $function$;

-- ---------------------------------------------------------------------
-- 3 · I permessi delle due ricreate — LETTI DAL DATABASE, non a memoria
-- ---------------------------------------------------------------------
-- 🔴 Dopo un `drop` i permessi tornano aperti al mondo, e ricopiarli dal
--    modello delle funzioni accanto e' come ha aperto una porta il 24/08 e
--    di nuovo il 27/08. Questi sono quelli misurati sul database prima di
--    lasciarle cadere: `postgres` ed `authenticated`, niente altro.
revoke all on function public.create_ingredient(uuid, text, text, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, numeric, text, text, numeric, boolean, boolean) from public, anon, authenticated;
grant execute on function public.create_ingredient(uuid, text, text, unit_type, numeric, ingredient_source, uuid, uuid, allergen[], month_code[], storage_type, numeric, text, text, numeric, boolean, boolean) to authenticated;

revoke all on function public.partite_in_giacenza(text) from public, anon, authenticated;
grant execute on function public.partite_in_giacenza(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4 · Il vecchio preavviso a tre fonti se ne va
-- ---------------------------------------------------------------------
drop function if exists public.preavviso_giorni(integer, integer, storage_type);

-- ---------------------------------------------------------------------
-- 5 · E la colonna
-- ---------------------------------------------------------------------
-- ⚠️ PER ULTIMA, e non per scaramanzia: Postgres non guarda i CORPI delle
--    funzioni quando si toglie una colonna (lezione del 27/08 sull'enum), e
--    lasciarne una indietro non darebbe nessun errore adesso — lo darebbe al
--    primo prodotto salvato.
alter table ingredients drop column if exists shelf_life_days;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA in due modi diversi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   bigint;
  v_lapidi2  bigint;
  v_n        integer;
  v_nomi     text;
  v_ing      uuid;
  v_miei     uuid[] := '{}';
  v_preav    integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- (a) LA COLONNA NON C'E' PIU'.
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'ingredients' and column_name = 'shelf_life_days';
  if v_n <> 0 then
    raise exception 'La colonna shelf_life_days e'' ancora li''.';
  end if;

  -- (b) 🔴 E NESSUNA FUNZIONE LA NOMINA PIU'. ⚠️ Si guardano i CORPI, non le
  --     firme: togliere una colonna non rompe niente finche' nessuno esegue,
  --     e una funzione rimasta indietro morirebbe al primo prodotto salvato
  --     (lezione del 27/08 sull'enum). E' la stessa forma del setaccio che
  --     quel giorno ha trovato i tre cast.
  select count(*), coalesce(string_agg(p.proname, ', '), '')
    into v_n, v_nomi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%shelf_life_days%';
  if v_n <> 0 then
    raise exception 'Nominano ancora shelf_life_days: %', v_nomi;
  end if;

  -- (c) 🔴 E LE FUNZIONI RISPONDONO. Un corpo che si crea non e' un corpo che
  --     funziona (17/08): Postgres controlla le firme, non le chiamate dentro
  --     i corpi. Quindi si CHIAMANO.
  perform * from prodotti_da_compilare();
  perform * from numeri_sospetti();
  perform * from partite_in_scadenza();
  perform * from partite_in_giacenza(null);

  -- (d) IL FERMO NON C'E' PIU', e non e' rimasto a rispondere vuoto.
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'partite_ferme';
  if v_n <> 0 then
    raise exception 'partite_ferme e'' ancora viva: risponderebbe «nessuna partita ferma», che si legge «va tutto bene».';
  end if;

  -- (e) E NEMMENO IL PREAVVISO A TRE FONTI.
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'preavviso_giorni' and p.pronargs = 3;
  if v_n <> 0 then
    raise exception 'Il preavviso a tre fonti e'' ancora li'': un parametro che nessuno puo'' riempire.';
  end if;

  -- (f) LE DUE FONTI RIMASTE FUNZIONANO, tutte e due. ⚠️ Una sola proverebbe
  --     che la funzione risponde, non che SCEGLIE: senza il primo caso, un
  --     corpo che ignorasse il numero scritto a mano passerebbe.
  if preavviso_giorni(7, 'dispensa') <> 7 then
    raise exception 'Il numero scritto a mano non vince sul preavviso.';
  end if;
  if preavviso_giorni(null, 'frigo_0_4') <> 2 then
    raise exception 'Il frigo non da'' piu'' due giorni di preavviso.';
  end if;
  if preavviso_giorni(null, 'dispensa') <> 14 then
    raise exception 'La dispensa non da'' piu'' quattordici giorni di preavviso.';
  end if;

  -- (g) UN PRODOTTO NUOVO SI CREA ANCORA. ⚠️ L'esempio si COSTRUISCE: in
  --     produzione gli ingredienti sono zero, e una verifica che ne pescasse
  --     uno passerebbe qui e si fermerebbe la'.
  v_ing := (create_ingredient(
    (select id from entities order by created_at limit 1),
    'PROVA DURATA VIA 28082026', 'altro', 'kg', 1
  )->>'id')::uuid;
  v_miei := v_miei || v_ing;
  if v_ing is null then
    raise exception 'create_ingredient non restituisce piu'' un prodotto.';
  end if;

  delete from ingredients where id = any(v_miei);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La durata e'' uscita dai prodotti comprati: zero funzioni la nominano, il fermo e'' tolto, lo scadenziario risponde.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000004', 'la_durata_esce_dai_prodotti_comprati') on conflict (version) do nothing;
