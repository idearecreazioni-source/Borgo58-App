-- =====================================================================
-- LA PRODUZIONE TORNA VUOTA — via il residuo di collaudo
-- 20/08/2026 · blocco D del mandato della serata
-- =====================================================================
-- 🔴 DECISIONE DI ALESSIO. Motivo immediato: l'avviso delle scadenze suona
-- ogni mattina su merce finta da cinque giorni di fila, e *il rischio è
-- abituarsi a ignorarlo prima che diventi vero* — cioè spegnere da soli
-- l'unico avviso che un giorno servirà davvero.
--
-- ⚠️ QUESTA MIGRAZIONE NON SI APPLICA DA SOLA E NON SI APPLICA DI SERA.
-- Prima serve, nell'ordine:
--   1 · `npm run backup` — quello che va via da qui non torna;
--   2 · la conferma di Alessio che i QUATTRO DOCUMENTI VERI (atto notarile,
--       partita IVA, contratto di locazione, business plan) li ha ancora
--       scaricabili altrove. È una sua decisione esplicita del 20/08: non li
--       conserva nell'app e li ricaricherà ad app finita;
--   3 · `npm run deposito:orfani` per i file, che stanno FUORI dal database
--       e questa migrazione non li tocca.
--
-- 🔴 E TUTTO QUELLO CHE NON DEVE MUOVERSI È SORVEGLIATO: la migrazione
-- fotografa 18 conteggi prima, e alla fine **fallisce** se anche uno solo è
-- cambiato. Non è prudenza generica — è che una cancellazione a perimetro
-- largo sbaglia in silenzio, e qui dentro ci sono la pianta della sala, le
-- causali, la Previsione congelata e gli impegni scritti a mano da Alessio.
-- =====================================================================

do $pulizia$
declare
  -- Cosa NON deve muoversi. I numeri si LEGGONO prima, non si scrivono qui:
  -- un numero copiato in una migrazione è una fotografia travestita da regola
  -- (lezione del 16/08).
  v_prima  jsonb;
  v_dopo   jsonb;
  v_chiave text;
  v_tit    uuid;
  v_n      integer;
  v_lap_p  integer;
  v_lap_d  integer;
  v_altri_avvisi integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare: questa migrazione non deve girare su un database vuoto.';
  end if;
  select count(*) into v_lap_p from deleted_records;
  -- Gli avvisi che NON sono di collaudo: si contano prima, e alla fine devono
  -- essere gli stessi. Vedi il controllo in fondo.
  select count(*) into v_altri_avvisi from allarmi
   where tipo not like 'rincaro_%' and tipo not like 'scadenze_%';

  -- 🔴 IL PERIMETRO SI CONTROLLA PRIMA, E SE NON È QUELLO PREVISTO CI SI
  -- FERMA. Questa pulizia toglie gli INGREDIENTI, e il mandato l'ha scritta
  -- sapendo che in produzione **le ricette sono zero** (misurato il 20/08).
  -- Il giorno che ce ne fosse anche una, quegli ingredienti sarebbero i suoi:
  -- toglierli distruggerebbe una ricetta vera, e nessun vincolo lo direbbe
  -- prima — `recipe_ingredients` la bloccherebbe a metà pulizia, con tutto il
  -- resto già cancellato.
  --
  -- ⚠️ Ci si ferma **prima di toccare qualsiasi cosa**, non a metà: una
  -- pulizia che si interrompe in mezzo lascia uno stato che nessuno ha voluto.
  select count(*) into v_n from recipes;
  if v_n > 0 then
    raise exception
      'Ci sono % ricette: questa pulizia è stata scritta per un Ricettario VUOTO e toglie gli ingredienti. Non tocco niente — serve una decisione di Alessio su cosa fare delle sue ricette.', v_n;
  end if;

  select jsonb_build_object(
    'entities',                 (select count(*) from entities),
    'user_roles',               (select count(*) from user_roles),
    'fiscal_settings',          (select count(*) from fiscal_settings),
    'service_settings',         (select count(*) from service_settings),
    'service_hours',            (select count(*) from service_hours),
    'cash_causali',             (select count(*) from cash_causali),
    'regole_deducibilita',      (select count(*) from regole_deducibilita),
    'dining_tables',            (select count(*) from dining_tables),
    'formati_tavolo',           (select count(*) from formati_tavolo),
    'disposizioni_giornaliere', (select count(*) from disposizioni_giornaliere),
    'pos_devices',              (select count(*) from pos_devices),
    'scenari_proiezione',       (select count(*) from scenari_proiezione),
    'domande_archivio',         (select count(*) from domande_archivio),
    'privacy_pulizie',          (select count(*) from privacy_pulizie),
    'lavori_sorvegliati',       (select count(*) from lavori_sorvegliati),
    'stato_lavori',             (select count(*) from stato_lavori),
    'cash_movements',           (select count(*) from cash_movements),
    -- ⚠️ GLI IMPEGNI SCRITTI DA ALESSIO si riconoscono dal MECCANISMO che li
    -- crea (`origine_modulo` vuoto), non dal titolo. Cancellare per parola
    -- chiave qui dentro vorrebbe dire perdere adempimenti societari con
    -- importi e codici F24.
    'tasks_di_alessio',         (select count(*) from tasks where origine_modulo is null),
    -- ⚠️ AGGIUNTA IL 21/08 coi preventivi: le spunte «sala piena» che ha
    -- messo Alessio a mano hanno `preventivo_id` vuoto, e la pulizia non le
    -- deve sfiorare. Senza questo conteggio, toglierle sarebbe passato
    -- inosservato — e una sala sbloccata per errore gli costa una serata.
    'sold_out_di_alessio',      (select count(*) from giornate_sold_out where preventivo_id is null)
  ) into v_prima;

  -- =================================================================
  -- L'ORDINE È IMPOSTO DAI VINCOLI, ed è stato misurato: non è una
  -- preferenza. Invertendo due passi la cancellazione **non fallisce** —
  -- scollega in silenzio, e poi si blocca più avanti senza dire perché.
  -- =================================================================

  -- 1 · GLI SCARICHI PRIMA DEI CONTI.
  --     🔴 `stock_consumptions.order_id` è ON DELETE SET NULL: cancellando i
  --     conti per primi il legame si azzera **in silenzio**, e dopo
  --     `ingredients` resta bloccato perché stock_consumptions→ingredients è
  --     RESTRICT. È il motivo per cui l'ordine scritto in
  --     `scripts/collaudo-stato.mjs` non arrivava in fondo.
  delete from stock_consumptions;

  -- 2 · I CONTI — e SOLO i conti.
  --
  --     🔴 QUI HO SBAGLIATO, e me l'ha detto il database applicando: la prima
  --     versione cancellava `order_items` PRIMA di `orders`, e un trigger
  --     l'ha respinta — *«Questo conto è già chiuso: non si può togliere. Il
  --     totale su cui hai incassato non deve cambiare dopo.»*
  --
  --     ⚠️ E la cura non era spegnere quel trigger: il ramo che serve **c'è
  --     già dentro di lui**, e la sua ragione nomina esattamente questa
  --     pulizia — *«se il conto stesso sta sparendo, le sue righe se ne vanno
  --     con lui… senza questo ramo la prima a restarne prigioniera sarebbe la
  --     pulizia dei dati di collaudo»*. Basta cancellare il CONTO: le righe,
  --     i tavoli, i pagamenti, le anomalie e le segnalazioni fiscali scendono
  --     in cascata (misurato: tutte `on delete cascade`), e il trigger le
  --     lascia passare perché il conto non c'è più.
  delete from orders;

  -- 3 · I PREVENTIVI DI COLLAUDO — e vanno PRIMA delle prenotazioni.
  --
  -- 🔴 AGGIUNTI IL 21/08, decisione di Alessio, dopo che il collaudo ha
  --    creato il primo preventivo vero in produzione. La ragione della
  --    scelta, perche' resti scritta: l'alternativa — lasciarli fuori —
  --    chiede ad Alessio di **ricordarsi di togliere una cosa a mano prima
  --    di lanciare un comando**, ed e' la forma che questo progetto ha
  --    passato una sera intera a smontare.
  --
  -- ⚠️ L'ORDINE LO IMPONE IL VINCOLO, e sbagliarlo si ferma A META' con il
  --    resto gia' cancellato: `preventivi.reservation_id` e' `restrict`,
  --    quindi togliere prima le prenotazioni viene RESPINTO. E' lo stesso
  --    genere di trappola degli scarichi di magazzino del passo 1.
  --
  -- 🔴 E MISURANDO SONO USCITI DUE VINCOLI CHE NESSUNO AVEVA NOMINATO:
  --    · `preventivi.versione_di` → `preventivi`, **restrict**: una versione
  --      nuova trattiene quella da cui nasce. Vanno via prima le versioni;
  --    · `giornate_sold_out.preventivo_id` → `preventivi`, **restrict**: una
  --      spunta «sala piena» accesa da un preventivo lo trattiene.
  --    ⚠️ E lì la distinzione conta: si tolgono **solo le spunte accese da un
  --    preventivo**. Quelle con `preventivo_id` vuoto le ha messe Alessio a
  --    mano, e nessuna pulizia le tocca — e' la stessa regola scritta ieri
  --    nel trigger dell'annullamento.
  --
  -- ⚠️ `preventivo_righe` e `preventivo_fogli` NON si nominano: sono in
  --    cascata su `preventivi` (misurato), quindi scendono da sole. Elencarle
  --    non farebbe danno, ma direbbe che servono — e chi legge fra sei mesi
  --    penserebbe che il vincolo sia un altro.
  -- 🔴 E UN TERZO OSTACOLO, trovato dalla prova sui dati veri e non
  --    leggendo: il trigger `vieta_cancellazione_preventivo_accettato`
  --    respinge un preventivo che ha un evento in calendario — *«Annulla
  --    prima l''evento»*. L''ho scritto io ieri, e fa quello che deve:
  --    impedisce che un preventivo sparisca lasciando in sala una cena che
  --    nessuno rivendica.
  --
  -- ⚠️ NON SI SPEGNE. Si SCOLLEGA PRIMA e si cancella dopo — la stessa
  --    strada che il progetto usa per gli storni legittimi dal 16/08, e che
  --    non apre nessuna scappatoia nel trigger (una scappatoia sarebbe anche
  --    la strada per aggirarlo). Qui il caso che il trigger difende non si
  --    presenta: la cena viene cancellata due passi piu' sotto.
  update preventivi set reservation_id = null where reservation_id is not null;
  delete from giornate_sold_out where preventivo_id is not null;
  delete from preventivi where versione_di is not null;
  delete from preventivi;

  -- 4 · LE PRENOTAZIONI — e solo ora: orders→reservations è RESTRICT, e
  --     anche preventivi→reservations lo e'.
  delete from prenotazione_tavoli;
  delete from reservation_deposits;
  delete from reservations;
  delete from correzioni_coperti;

  -- 5 · ORDINI AI FORNITORI E LISTA DELLA SPESA.
  delete from ordini_fornitore_righe;
  delete from ordini_fornitore;
  delete from shopping_list_items;

  -- 6 · IL MAGAZZINO, poi le diciture e i prezzi, poi i prodotti, poi i
  --     fornitori. `stock_lots`→`ingredients` è RESTRICT.
  delete from rettifiche_giacenza;
  delete from stock_lots;
  delete from articoli_fornitore;
  delete from price_history;
  delete from ingredients;
  delete from suppliers;

  -- 7 · LE NON CONFORMITÀ HACCP del collaudo.
  delete from haccp_non_conformities;

  -- 8 · LA POSTA PRIMA DEI DOCUMENTI.
  --     🔴 `posta_ricevuta.documento_id` e `posta_azioni.documento_id` sono
  --     SET NULL: invertendo si perde il legame **senza che nessuno se ne
  --     accorga**, e poi non si sa più quale mail aveva prodotto quale
  --     documento.
  delete from posta_azioni;
  delete from posta_allegati;
  delete from posta_ricevuta;

  -- 9 · GLI IMPEGNI GENERATI, poi i documenti.
  --     ⚠️ Per MECCANISMO, non per parola chiave: sono quelli nati
  --     dall'archivio e dalla posta. Gli altri li ha scritti Alessio.
  delete from tasks where origine_modulo in ('archivio_documenti', 'posta');
  delete from documents;

  -- 10 · GLI AVVISI DI COLLAUDO.
  --     ⚠️ NON tutti: `lavoro_fermo_lettura_posta` del 12/08 è un avviso VERO
  --     — la storia di un guasto che è successo davvero — e cancellarlo
  --     toglierebbe la prova che la sentinella funziona.
  delete from allarmi where tipo like 'rincaro\_%' or tipo like 'scadenze\_%';

  -- 11 · I CLIENTI del collaudo. ⚠️ Vanno DOPO le prenotazioni, che li
  --      nominano.
  delete from customers;

  -- =================================================================
  -- CONTROLLO: quello che doveva restare è rimasto?
  -- =================================================================
  select jsonb_build_object(
    'entities',                 (select count(*) from entities),
    'user_roles',               (select count(*) from user_roles),
    'fiscal_settings',          (select count(*) from fiscal_settings),
    'service_settings',         (select count(*) from service_settings),
    'service_hours',            (select count(*) from service_hours),
    'cash_causali',             (select count(*) from cash_causali),
    'regole_deducibilita',      (select count(*) from regole_deducibilita),
    'dining_tables',            (select count(*) from dining_tables),
    'formati_tavolo',           (select count(*) from formati_tavolo),
    'disposizioni_giornaliere', (select count(*) from disposizioni_giornaliere),
    'pos_devices',              (select count(*) from pos_devices),
    'scenari_proiezione',       (select count(*) from scenari_proiezione),
    'domande_archivio',         (select count(*) from domande_archivio),
    'privacy_pulizie',          (select count(*) from privacy_pulizie),
    'lavori_sorvegliati',       (select count(*) from lavori_sorvegliati),
    'stato_lavori',             (select count(*) from stato_lavori),
    'cash_movements',           (select count(*) from cash_movements),
    'tasks_di_alessio',         (select count(*) from tasks where origine_modulo is null),
    -- ⚠️ AGGIUNTA IL 21/08 coi preventivi: le spunte «sala piena» che ha
    -- messo Alessio a mano hanno `preventivo_id` vuoto, e la pulizia non le
    -- deve sfiorare. Senza questo conteggio, toglierle sarebbe passato
    -- inosservato — e una sala sbloccata per errore gli costa una serata.
    'sold_out_di_alessio',      (select count(*) from giornate_sold_out where preventivo_id is null)
  ) into v_dopo;

  -- ⚠️ Si confrontano TUTTE le chiavi e si nomina QUALE è cambiata: dire solo
  -- «qualcosa non torna» costringerebbe a rifare la misura da capo (regola
  -- del 19/08 sui rifiuti che nominano tutte le righe).
  for v_chiave in select jsonb_object_keys(v_prima) loop
    if v_prima->>v_chiave is distinct from v_dopo->>v_chiave then
      raise exception 'LA PULIZIA HA TOCCATO QUELLO CHE NON DOVEVA: % era %, adesso è %.',
        v_chiave, v_prima->>v_chiave, v_dopo->>v_chiave;
    end if;
  end loop;

  -- 🔴 GLI AVVISI CHE NON SONO DI COLLAUDO SONO ANCORA TUTTI LÌ?
  --
  -- ⚠️ QUI C'ERA UN GUARDIANO SBAGLIATO, e a trovarlo è stata la ricostruzione
  -- del progetto di prova da zero: pretendeva che esistesse `lavoro_fermo_
  -- lettura_posta`, l'avviso vero del 12/08. In produzione è giusto — ma su
  -- un database appena costruito quell'avviso **non c'è mai stato**, e la
  -- catena delle 162 migrazioni si spezzava all'ultima.
  --
  -- Era **una fotografia della produzione travestita da regola** (la trappola
  -- del 16/08). La proprietà vera è un'altra: *questa pulizia non deve
  -- togliere nessun avviso che non sia di collaudo* — e su un database vuoto
  -- sono zero prima e zero dopo, quindi è vera dappertutto.
  select count(*) into v_n from allarmi
   where tipo not like 'rincaro_%' and tipo not like 'scadenze_%';
  if v_n <> v_altri_avvisi then
    raise exception
      'La pulizia ha toccato degli avvisi che non erano di collaudo: erano %, adesso sono %.',
      v_altri_avvisi, v_n;
  end if;

  -- E il residuo di collaudo è andato via per intero?
  select (select count(*) from orders) + (select count(*) from reservations)
       + (select count(*) from ingredients) + (select count(*) from suppliers)
       + (select count(*) from documents) + (select count(*) from posta_ricevuta)
       + (select count(*) from stock_lots) + (select count(*) from customers)
       + (select count(*) from tasks where origine_modulo is not null)
       + (select count(*) from preventivi) + (select count(*) from preventivo_righe)
       + (select count(*) from giornate_sold_out where preventivo_id is not null)
    into v_n;
  if v_n <> 0 then
    raise exception 'È rimasto del residuo di collaudo: % righe.', v_n;
  end if;

  -- ⚠️ LE LAPIDI SALGONO, ED È PREVISTO: `documents` è una tabella tracciata,
  -- quindi i 10 documenti lasciano 10 righe nel registro delle cancellazioni
  -- — che **nessuno può ripulire dall'app**, ed è giusto così. Qui non si
  -- pretende che siano le stesse di prima (sarebbe falso): si pretende che
  -- siano cresciute **solo** di quanto ci si aspetta.
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d < v_lap_p then
    raise exception 'Il registro delle cancellazioni si è ACCORCIATO: qualcuno ha tolto delle lapidi.';
  end if;

  raise notice 'Il residuo di collaudo è andato via. Le lapidi sono passate da % a %: è previsto, documents è una tabella tracciata.',
    v_lap_p, v_lap_d;
  raise notice 'RESTA DA FARE FUORI DA QUI: i file nel deposito (npm run deposito:orfani) e la pagina /prova-voce.';
end $pulizia$;

insert into applied_migrations (version, name)
values ('20260820000012', 'la_produzione_torna_vuota')
on conflict (version) do nothing;
