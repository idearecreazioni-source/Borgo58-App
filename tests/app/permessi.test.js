import { beforeAll, describe, expect, it } from "vitest";
import { almenoUnaRiga, clientAnonimo, clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, primaEntita } from "./aiuto";

// Il corridoio si cerca PRIMA di definire le prove: se la funzione online
// non è installata su questo progetto, le prove che la riguardano vengono
// saltate invece di passare per il motivo sbagliato (un 404 è un errore
// anche lui, e "mi aspetto un errore" sarebbe soddisfatto da quello).
const sonda = await clientAutenticato(credenziali().staff);
const CORRIDOIO = await corridoioInstallato(sonda);
// ⚠️ La sentinella sta in OGNI file che salta prove, non in uno solo: chi
// lancia solo questo file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);
await sonda.auth.signOut({ scope: "local" });

// La matrice dei permessi, riprovabile in venti secondi.
//
// È il protocollo §7 punto 1-2 trasformato in automazione: ogni verifica
// che finora richiedeva due login manuali e occhi attenti. Tutte le prove
// di questo file sono di sola lettura o scritture RESPINTE: non lasciano
// nulla nel database.
describe("permessi: la barriera è nel database, non nella schermata", () => {
  let staff;
  let titolare;
  let anonimo;

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);
    anonimo = clientAnonimo();
  });

  it("lo staff NON vede gli ingredienti (lì vivono i prezzi d'acquisto)", async () => {
    const pulisci = await almenoUnaRiga(titolare, "ingredients", {
      entity_id: await primaEntita(titolare),
      name: "__PROVA__ ingrediente",
      category: "altro",
      unit: "kg",
      current_price: 1,
    });
    try {
      const [perStaff, perTitolare] = await Promise.all([
        staff.from("ingredients").select("id"),
        titolare.from("ingredients").select("id"),
      ]);
      expect(perStaff.error).toBeNull();
      expect(perStaff.data).toHaveLength(0); // la RLS filtra: zero righe, non un errore
      expect(perTitolare.data.length).toBeGreaterThan(0);
    } finally {
      await pulisci();
    }
  });

  it("lo staff NON vede i fornitori (anagrafica riservata)", async () => {
    const pulisci = await almenoUnaRiga(titolare, "suppliers", {
      entity_id: await primaEntita(titolare),
      name: "__PROVA__ fornitore",
    });
    try {
      const [perStaff, perTitolare] = await Promise.all([
        staff.from("suppliers").select("id"),
        titolare.from("suppliers").select("id"),
      ]);
      expect(perStaff.data).toHaveLength(0);
      expect(perTitolare.data.length).toBeGreaterThan(0);
    } finally {
      await pulisci();
    }
  });

  it("gli adempimenti riservati in Agenda restano invisibili allo staff", async () => {
    const [perStaff, perTitolare] = await Promise.all([
      staff.from("tasks").select("id"),
      titolare.from("tasks").select("id"),
    ]);
    expect(perStaff.error).toBeNull();
    // Il titolare vede tutto; lo staff strettamente di meno (i 7 adempimenti
    // societari con importi e codici F24 sono riservati).
    expect(perTitolare.data.length).toBeGreaterThan(perStaff.data.length);
  });

  it("lo staff legge le causali (gli servono per chiudere un conto) ma non può modificarle", async () => {
    const lettura = await staff.from("cash_causali").select("id, label");
    expect(lettura.error).toBeNull();
    expect(lettura.data.length).toBeGreaterThan(0);

    const scrittura = await staff.from("cash_causali").insert({ label: "__PROVA__", kind: "entrata" });
    expect(scrittura.error).not.toBeNull(); // respinta dalla RLS
  });

  it("lo staff vede il menu di sala e la carta bevande, senza colonne economiche riservate", async () => {
    const menu = await staff.from("menu_items_display").select("*");
    expect(menu.error).toBeNull();
    if (menu.data.length > 0) {
      // Il prezzo di VENDITA deve esserci; food cost e margini non esistono
      // proprio come colonne: il dato riservato è strutturalmente assente.
      const colonne = Object.keys(menu.data[0]);
      expect(colonne).toContain("selling_price");
      expect(colonne).not.toContain("food_cost");
      expect(colonne).not.toContain("margin");
    }
    const carta = await staff.from("bar_items").select("id");
    expect(carta.error).toBeNull();
  });

  it("lo staff legge il prezzo del coperto ma non può cambiarlo", async () => {
    const lettura = await staff.from("service_settings").select("coperto_price").eq("id", 1).single();
    expect(lettura.error).toBeNull();
    expect(Number(lettura.data.coperto_price)).toBeGreaterThanOrEqual(0);

    const scrittura = await staff.from("service_settings").update({ coperto_price: 999 }).eq("id", 1).select();
    // Update respinto dalla RLS: nessuna riga toccata (o errore esplicito).
    expect(scrittura.error ? true : scrittura.data.length === 0).toBe(true);
  });

  it("senza login non si legge niente, nemmeno l'elenco dei tavoli", async () => {
    const r = await anonimo.from("dining_tables").select("id");
    expect(r.error ? true : r.data.length === 0).toBe(true);
  });

  it("il form pubblico valida anche per chi non è loggato (funzione raggiungibile, dati respinti)", async () => {
    // Data nel passato: la funzione deve rispondere col SUO messaggio.
    const r = await anonimo.rpc("submit_public_reservation", {
      p_reservation_date: "2020-01-01",
      p_reservation_time: "20:00",
      p_party_size: 2,
      p_customer_name: "Prova",
      p_customer_phone: "000",
    });
    expect(r.error).not.toBeNull();
    expect(r.error.message).toContain("Data non valida");
  });

  // Il controllo anti-deriva che il validatore rifaceva a mano. L'11/08
  // erano 35 le funzioni aperte a chiunque avesse la chiave pubblica del
  // sito; chiuse tutte tranne quelle del form. Il 12/08 l'elenco è
  // ricresciuto da 12 a 14 senza che nessuno lo dicesse — ed è quello il
  // difetto, non il contenuto: due normalizzatori non facevano male, la
  // prossima funzione potrebbe. Qui l'elenco diventa una prova che
  // diventa rossa da sola.
  // ⚠️ SCESO DA 12 A 11 il 16/08/2026, e il modo in cui e' sceso e' la
  // parte che conta: `abbina_righe_carico` aveva i permessi PREDEFINITI
  // di Postgres — nessun revoke le era mai stato fatto — quindi era
  // eseguibile da chiunque avesse la chiave pubblica del sito. E' una
  // funzione di trigger: la esegue il motore per conto di
  // `posta_azioni`, e non ha bisogno di nessun permesso. Controllato
  // prima di togliere che non la chiamasse nessun altro.
  //
  // ⚠️ Questo numero scende SOLO cosi': con una riga tolta e dichiarata
  // nella stessa consegna. Se cambiasse senza che nessuno lo dica,
  // sarebbe il difetto del 12/08 — ed e' il motivo per cui questa prova
  // esiste.
  // ⚠️ SCESO DA 11 A 10 il 16/08/2026, e anche stavolta il modo conta:
  // `log_recipe_status_change` è diventata `security definer` perché era
  // ROTTA — girando coi permessi del chiamante non poteva scrivere nello
  // storico, quindi nessuno poteva marcare una ricetta «pronta per
  // carta». Diventata definer, lasciarla eseguibile con la chiave
  // pubblica sarebbe stata una porta aperta: revocata nella stessa
  // migrazione (`20260816000017`). Anche lei è una funzione di trigger:
  // la esegue il motore per conto di `recipes`, senza bisogno di permessi.
  // ⚠️ SALITO DA 10 A 12 il 26/08/2026 CON I COMANDI VOCALI, e le due
  // nuove sono aperte ad `anon` PER FORZA: una Scorciatoia dell iPhone non
  // ha e non puo avere un accesso al gestionale. Il portiere non manca —
  // e la CHIAVE, che il gestionale confronta per impronta e che si revoca
  // in un tocco; e il freno anti-abuso che il Contratto §4 pretende su
  // tutto cio che e esposto ad `anon` vive dentro `voce_apri_sessione`
  // (60 dettature all ora, poi si ferma e lo dice).
  // ⚠️ SALITO DA 12 A 13 il 29/08/2026 col giorno chiuso, e la nuova e'
  // aperta ad `anon` per la stessa ragione delle due sorelle del form
  // pubblico: la legge il modulo di prenotazione, che nessuno ha ancora
  // fatto entrare. `giorni_chiusi_prenotabili` restituisce SOLO delle
  // date — quali giorni il locale e' chiuso — cioe' un'informazione che
  // un ristorante scrive sulla porta. **Il motivo NON esce**: quello e'
  // un appunto che Alessio scrive per se', e resta dentro
  // `public_reservation_options`, che gia' lo mostrava.
  it("solo 13 funzioni si possono eseguire con la sola chiave pubblica", async () => {
    const attese = [
      "check_recipe_component",
      "generate_foraged_lot",
      "giorni_chiusi_prenotabili",
      "is_titolare",
      "normalize_phone",
      "public_reservation_options",
      "registra_dettatura_da_chiave",
      "set_aggiornato_il",
      "set_task_visibility",
      "set_updated_at",
      "submit_public_reservation",
      "task_origin_visible_to_staff",
      "voce_apri_sessione",
    ];

    const r = await titolare.rpc("funzioni_aperte_ad_anon");
    expect(r.error).toBeNull();

    const ora = (r.data ?? []).map((x) => x.nome ?? x).sort();
    // Il messaggio di errore deve dire QUALE è comparsa, non solo che il
    // numero non torna: chi legge una prova rossa deve poter decidere.
    expect(ora).toEqual(attese);
  });

  // 🔴 IL SECONDO ELENCO CONGELATO, e nasce da un difetto vivo: fino al
  // 19/08/2026 `uscite_future` era `security definer` SENZA il controllo del
  // titolare — quindi chi entrava con l'accesso della sala (uno solo,
  // condiviso) poteva chiedere quanto doveva uscire e quando. Non era una
  // scelta: le funzioni accanto a lei il portiere ce l'hanno tutte.
  //
  // ⚠️ E il numero era DICHIARATO in CLAUDE.md — «13» — mentre erano 15.
  // Un conteggio scritto a mano in un documento è un'affermazione che
  // nessuna verifica controlla: qui diventa un elenco che il database si
  // costruisce dal catalogo, e questa prova diventa rossa da sola.
  //
  // ⚠️ QUESTO ELENCO SCENDE SOLO CON UNA RIGA TOLTA E DICHIARATA nella
  // stessa consegna, e sale solo se qualcuno spiega perché. Le tre che il
  // 13/08 erano nominate solo come gruppo («la lista della spesa») adesso
  // hanno il loro nome: un elenco per categorie non si può confrontare.
  //
  // ⚠️ E DUE SONO SPARITE ACCENDENDO LA RETE, non prima: le diagnostiche
  // che raccontano com'è fatto il database — `funzioni_multi_tabella` e le
  // due reti stesse — erano eseguibili da chiunque avesse fatto il login.
  // Hanno preso il portiere nella stessa consegna, come
  // `funzioni_aperte_ad_anon` dal 13/08.
  it("solo 30 funzioni scavalcano la RLS senza chiedere chi sei", async () => {
    const attese = [
      // La lista della spesa: la scrive chi va a fare la spesa.
      "add_below_threshold_items",
      "add_shopping_list_item",
      "remove_shopping_list_item",
      // ⚠️ NATA OGGI SENZA DICHIARAZIONE, ed è il motivo per cui questa
      // prova esiste: `righe_lista_aperte` è comparsa il 19/08 con il
      // blocco degli arrivi. Non espone prezzi — quantità e date di righe
      // che chi va a fare la spesa vede comunque — ma nessuno lo aveva
      // scritto da nessuna parte.
      "righe_lista_aperte",
      // Lo scadenziario: chi butta una partita scaduta è chi la trova.
      "chiudi_partita",
      "partite_in_scadenza",
      "record_stock_consumption",
      // Il totale di un conto, che in sala si vede comunque. Il portiere ce
      // l'ha per interposta persona: passa da `totale_conto()`, che pretende
      // un utente autenticato.
      "incasso_conto",
      // Funzioni di trigger e di sistema: le esegue il motore.
      "link_reservation_customer",
      "notify_reservation_telegram",
      "segnala_allarme",
      "send_due_task_reminders",
      "set_order_entity_srls",
      // Il form pubblico.
      "public_reservation_options",
      // ⚠️ COMPARSE QUANDO LA RETE HA SMESSO DI CERCARE LA PAROLA E HA
      // CERCATO IL GESTO: non sono nuove, non si vedevano. Chiudere un
      // conto come sconto o omaggio è un gesto di sala, e gli importi che
      // tocca sono quelli del conto che il cameriere ha davanti;
      // `log_deleted_record` è il trigger che scrive nel registro delle
      // cancellazioni, e usa `auth.uid()` per annotare CHI ha cancellato,
      // non per chiedere chi sta chiamando.
      "close_order_as_discount_gift",
      "log_deleted_record",
      // ⚠️ AGGIUNTA IL 20/08 col blocco 4 dei preventivi, e dichiarata qui
      // perché è li' che si rischia di promettere un tavolo per una sera
      // che Alessio sta trattando: l'avviso serve a chi prende la
      // prenotazione, e in sala si prenota. Restituisce il minimo per
      // decidere — quante persone, in che stato — e il NOME del cliente
      // solo al titolare: nessun prezzo, nessun costo.
      "trattative_del_giorno",
      // ⚠️ AGGIUNTA IL 20/08 col mandato dell'allineamento, aperta a tutto lo
      // staff APPOSTA: chi si accorge che di un prodotto ne manca è chi sta
      // guardando lo scaffale, non chi ha il gestionale aperto in ufficio
      // (decisione di Alessio). Dice quanto dovrebbe esserci e la soglia —
      // numeri che in sala si vedono già in Magazzino. Nessun costo.
      // ⚠️ E `allinea_giacenza` NON è in questo elenco pur essendo aperta
      // allo staff: un portiere ce l'ha — pretende un accesso — e la rete lo
      // riconosce. Il food cost e gli scostamenti in euro restano
      // titolare-only e si RIFIUTANO, non tornano vuoti.
      "da_allineare",
      // ⚠️ COMPARSA IL 23/08 col blocco dei campi messi dalla macchina, e
      // **non era stata dichiarata**: la rete l'ha trovata il giorno dopo,
      // che è precisamente il lavoro per cui esiste. Resta senza portiere
      // perché quello che dice — quali campi nessuno ha ancora guardato e
      // su quanti prodotti, con tre nomi d'esempio — è roba che in cucina
      // si vede comunque aprendo il Ricettario: nessun prezzo, nessun
      // costo, nessun fornitore.
      "campi_da_confermare",
      // ⚠️ AGGIUNTA IL 24/08 col bis di un finger, e aperta alla sala
      // APPOSTA: il bis lo batte il cameriere al tavolo, e per batterlo
      // deve vedere quali finger compongono quel piatto e quanto costano.
      // ⚠️ Quello che passa di qui è un prezzo di VENDITA — lo stesso che
      // il cliente legge sul menu — non un food cost. Il food cost del bis
      // sta in `prezzo_bis`, che il portiere ce l'ha e NON è in questo
      // elenco: chi non deve vedere riceve un rifiuto, e c'è una prova che
      // lo controlla nella verifica della 20260824000026.
      "finger_bissabili",
      // ⚠️ COMPARSA IL 24/08 con la 20260824000032 e **non dichiarata**: la
      // rete l'ha trovata lo stesso giorno. Resta senza portiere perche' il
      // portiere ce l'ha per interposta persona — conta le righe di
      // `confronto_col_foglio`, che pretende il titolare e RIFIUTA gli
      // altri. Stessa forma di `incasso_conto`, che passa da
      // `totale_conto`.
      "confronti_storti",
      // ⚠️ AGGIUNTA IL 25/08 con l'assistente che legge le etichette, e
      // aperta alla sala APPOSTA: è la funzione che risponde al cameriere
      // quando un cliente chiede di un'allergia, e dice se quell'allergene
      // è scritto sull'etichetta o soltanto dedotto. Chiuderla al solo
      // titolare vorrebbe dire costruirla per chi non è al tavolo nel
      // momento in cui serve.
      // ⚠️ Non espone niente di economico: quali allergeni ha un prodotto
      // la sala li vede già dal Ricettario, e qui si aggiunge solo da dove
      // vengono. L'aiuto interno che le sta sotto — `origine_dell_insieme`
      // — è stato invece CHIUSO il 25/08 (migrazione 20260825000017): lo
      // chiama solo un trigger, che gira come proprietario e non ha
      // bisogno del permesso di nessun utente.
      "allergeni_con_origine",
      // ⚠️ AGGIUNTA IL 26/08 coi comandi vocali, ed e dichiarata invece che
      // corretta: risponde a UNA domanda sola — «questo tipo di azione si
      // salva da se?» — leggendo il catalogo `tipi_azione_vocale`, che ha
      // gia la lettura aperta a tutto lo staff. Non espone nessun dato, e
      // non decide niente per conto proprio: chi la interroga sono
      // `scrivi_dettatura` e le prove.
      // ⚠️ Il portiere ce l ha dove conta: `registra_dettatura` pretende il
      // titolare, e senza passare da li nessuno arriva a eseguire niente.
      "azione_si_esegue_da_se",
      // ⚠️ AGGIUNTA IL 29/08 col giorno chiuso, e SENZA portiere per forza:
      // la chiama il modulo di prenotazione pubblico, dove chi legge non ha
      // e non puo' avere un accesso al gestionale. Un `is_titolare()` qui
      // dentro non sarebbe una barriera, sarebbe un muro davanti all'unico
      // che deve passare — e' la lezione del 27/08 sui portieri messi dove
      // i chiamanti hanno identita' diverse.
      // ⚠️ E `security definer` serve davvero: `service_hours`,
      // `service_closures` e `service_settings` hanno la lettura concessa
      // al solo `authenticated`, quindi senza non risponderebbe niente.
      // Quello che esce sono DATE e basta: nessun motivo, nessun prezzo,
      // nessun nome. Chi e' chiuso quando, un ristorante lo scrive sulla
      // porta.
      "giorni_chiusi_prenotabili",
      // ⚠️ LE SEI DELLE COSE DA FARE IN CUCINA — 29/08, Blocco 3. Sono senza
      // portiere **apposta**, ed e' la stessa ragione per cui la lista
      // della spesa e lo scadenziario lo sono: quello che passa di qui e'
      // roba di cucina — quali preparazioni ci sono, cosa c'e' da fare
      // oggi, cosa manca per farlo — e chi la legge e' chi cucina, non chi
      // ha il gestionale aperto in ufficio.
      // 🔴 E un `is_titolare()` qui NON sarebbe una barriera in piu': sarebbe
      // un muro davanti a chi deve passare. E' la lezione del 27/08 sui
      // portieri messi dove i chiamanti hanno identita' diverse.
      // ⚠️ Nessuna delle sei espone un prezzo o un costo d'acquisto.
      // `riepilogo_preparazioni` il costo lo porta, ma **solo al titolare**:
      // dentro c'e' `is_titolare()` su quella colonna sola, ed e' un filtro
      // — non un portiere — perche' l'elenco deve rispondere anche agli
      // altri. Compare in questo elenco proprio perche' la rete cerca il
      // RIFIUTO e qui non c'e', ed e' giusto cosi'.
      "aggiungi_da_fare",
      "cose_da_fare",
      "togli_da_fare",
      "imposta_ricorrenza",
      "ingredienti_che_mancano",
      "riepilogo_preparazioni",
    ].sort();

    // ⚠️ `viste_che_scavalcano_rls` NON è in questo elenco, ed è una cosa
    //    da sapere invece che da scoprire: il portiere ce l'ha, e RIFIUTA
    //    — solo che è scritto `not (select public.is_titolare())`, cioè
    //    qualificato dallo schema, ed è la forma che `pg_get_functiondef`
    //    restituisce quando una funzione si riprende dal corpo vivo. Fino
    //    al 05/09 la rete riconosceva solo il nome nudo e la accusava. Il
    //    criterio vive ora in `gesto_del_portiere()`, in un posto solo,
    //    perché questa rete e `funzioni_col_portiere()` non possano più
    //    dire due cose diverse della stessa funzione.
    const r = await titolare.rpc("funzioni_senza_portiere");
    expect(r.error).toBeNull();
    const ora = (r.data ?? []).map((x) => x.nome).sort();
    expect(ora).toEqual(attese);
  });

  it("lo staff non può chiedere quanto deve uscire dalla cassa", async () => {
    const entita = await primaEntita(titolare);
    const r = await staff.rpc("uscite_future", { p_entity_id: entita });
    // ⚠️ Un RIFIUTO, non un elenco vuoto: una schermata vuota è una
    // rassicurazione falsa (regola del 13/08).
    expect(r.error, "lo staff ha ottenuto le uscite future").not.toBeNull();
  });

  it("...e il titolare sì, altrimenti il portiere sarebbe un muro", async () => {
    const entita = await primaEntita(titolare);
    const r = await titolare.rpc("uscite_future", { p_entity_id: entita });
    expect(r.error).toBeNull();
    expect(Array.isArray(r.data) ? r.data.length : 0).toBe(1);
  });

  it.skipIf(!CORRIDOIO)("il corridoio respinge chi non è autenticato", async () => {
    const r = await anonimo.functions.invoke("operazioni-atomiche", {
      body: { operazione: "close_order_as_discount_gift", parametri: {} },
    });
    expect(r.error).not.toBeNull();
  });

  it.skipIf(!CORRIDOIO)("il corridoio respinge le operazioni fuori elenco anche da autenticati", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: { operazione: "operazione_inventata", parametri: {} },
    });
    expect(r.error).not.toBeNull();
  });

  it.skipIf(!CORRIDOIO)("il corridoio arriva fino al database con un utente vero (conto inesistente → messaggio del database)", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "close_order_as_discount_gift",
        parametri: { p_order_id: crypto.randomUUID(), p_is_gift: true },
      },
    });
    expect(r.error).not.toBeNull();
    const corpo = await r.error.context?.json().catch(() => null);
    expect(corpo?.errore?.messaggio).toContain("Conto non trovato");
  });

  // ⚠️ LA SENTINELLA È USCITA DA QUI il 20/08, e non è sparita: sta in
  // `denunciaSaltiCorridoio()` (tests/app/aiuto.js), chiamata in cima a
  // questo file e agli altri OTTO che saltano prove. Il suo messaggio
  // diceva «le tre prove del corridoio»: erano tre quando è stata scritta,
  // oggi sono 26 — adesso il numero se lo conta da solo.

  // ===================================================================
  // IL TERZO ELENCO CONGELATO: LE VISTE — 04/09/2026
  // ===================================================================
  //
  // 🔴 NASCE DA UN DIFETTO VIVO, non da un sospetto. `v_cash_balance` e
  //    `v_discounts_gifts_monthly` erano nate con `security_invoker` il
  //    02/08 e l'hanno perso il 13/08, a un `create or replace view` che
  //    non ripeteva l'opzione: Postgres non la conserva, e non dice
  //    niente. Da quel giorno le due viste giravano coi permessi del
  //    proprietario — che ha `rolbypassrls` — e la RLS delle tabelle
  //    sotto non veniva applicata.
  //
  // ⚠️ PROVATO DAL VIVO sul progetto di prova il 04/09, non dedotto: con
  //    l'utente staff di collaudo `is_titolare()` risponde NO e le
  //    tabelle sorgenti rispondono vuote, mentre le due viste — stessa
  //    sessione, stesso istante — rispondevano piene, con lo stesso
  //    numero di righe del titolare.
  //
  // 🔴 PERCHÉ UN ELENCO E NON UN «devono essere tutte protette»: otto
  //    viste scavalcano la RLS **apposta**, e sono il pattern `_display`
  //    del Contratto §6 — mostrare allo staff le colonne operative di
  //    tabelle titolare-only. Metterle `security_invoker` per uniformità
  //    le renderebbe mute in cucina (è scritto nella migrazione del
  //    29/08). Il discriminante non è la meccanica, identica in tutte:
  //    è che quelle otto **non espongono colonne economiche** e che
  //    qualcuno le ha decise per iscritto.
  //
  // ⚠️ QUESTO ELENCO SCENDE SOLO CON UNA RIGA TOLTA E DICHIARATA nella
  //    stessa consegna, e sale solo se qualcuno spiega perché — come i
  //    due elenchi qui sopra.
  it("solo 8 viste scavalcano la RLS, e sono le aperture volute", async () => {
    const attese = [
      // Le sei `_display`: il pattern del Contratto §6. Ognuna porta il
      // proprio commento in tabella che dice cosa NON espone.
      "menu_items_display",
      "produzioni_display",
      "recipe_ingredients_display",
      "shopping_list_display",
      "stock_lots_display",
      "suppliers_display",
      // Non sono `_display` ma hanno la stessa ragione, scritta nella
      // migrazione che le ha create.
      "v_recipe_allergens", // 01/08: «leggibile anche dallo staff … sicura»
      "v_stock_levels", // 02/08: «Nessun dato economico: sicura per titolare e staff»
    ];

    const r = await titolare.rpc("viste_che_scavalcano_rls");
    expect(r.error).toBeNull();

    // Il messaggio deve dire QUALE è comparsa, non solo che il numero non
    // torna: chi legge una prova rossa deve poter decidere.
    const ora = (r.data ?? []).map((x) => x.vista ?? x).sort();
    expect(ora).toEqual(attese);
  });

  it("🔴 e le due viste dei soldi NON sono fra quelle: è il difetto che questa rete chiude", async () => {
    // ⚠️ Ridondante col confronto qui sopra, e voluto: quello dice «l'elenco
    //    è cambiato», questo dice **quale difetto è tornato**. Il giorno che
    //    qualcuno aggiorna l'elenco senza guardare, questa riga resta rossa.
    const r = await titolare.rpc("viste_che_scavalcano_rls");
    expect(r.error).toBeNull();
    const nomi = (r.data ?? []).map((x) => x.vista ?? x);
    expect(nomi).not.toContain("v_cash_balance");
    expect(nomi).not.toContain("v_discounts_gifts_monthly");
  });

  it("nessuna vista che scavalca espone colonne economiche RISERVATE", async () => {
    // 🔴 LA PROPRIETÀ CHE CONTA DAVVERO, ed è più forte dell'elenco: una
    //    vista `_display` nuova, o una colonna aggiunta a una che c'è,
    //    passerebbe il confronto dei nomi e non questo. È il modo in cui
    //    il difetto tornerebbe senza chiamarsi allo stesso modo.
    //
    // 🔴 LA REGOLA È CAMBIATA DI UNA PAROLA IL 05/09, e la parola è tutto:
    //    era «zero colonne economiche», è «zero colonne economiche
    //    **riservate**». Il prezzo di listino di un piatto non è riservato
    //    — lo legge il cliente sul menu, e senza di esso nessuno in sala
    //    può prendere una comanda. Sono riservati i costi d'acquisto, i
    //    margini, il food cost, i saldi, gli incassi e le imposte.
    //
    // ⚠️ L'UNICA ESENZIONE è la coppia `menu_items_display` ×
    //    `selling_price`, ed è una coppia e non un nome di colonna: la
    //    prova qui sotto lo pretende, e la verifica della migrazione
    //    20260905000001 lo dimostra costruendo una vista finta con quella
    //    stessa colonna e facendola segnalare.
    //
    // ⚠️ Il setaccio dice dove guardare, non cosa è vero (26/08): se un
    //    giorno segnalasse una colonna che è una quantità e non un
    //    importo, si guarda la colonna — non si allarga il setaccio per
    //    farlo tacere, e non si aggiunge una seconda esenzione senza
    //    scriverne la ragione qui e nel Contratto.
    const r = await titolare.rpc("viste_che_scavalcano_rls");
    expect(r.error).toBeNull();
    // ⚠️ Il messaggio nomina le COLONNE, non solo la vista: chi legge una
    //    prova rossa deve poter decidere senza andare a interrogare lo
    //    schema (regola del «rifiuto che nomina»).
    const conDenaro = (r.data ?? [])
      .filter((x) => x.espone_denaro)
      .map((x) => `${x.vista} → ${x.colonne_riservate}`);
    expect(conDenaro, conDenaro.join(" · ")).toEqual([]);
  });

  it("...e l'esenzione dichiarata ha ancora il suo caso: il prezzo che la sala legge", async () => {
    // 🔴 TARATURA SU UN CASO DI RISPOSTA NOTA (regola del 26/08). Senza
    //    questa prova, la precedente sarebbe soddisfatta anche da una rete
    //    ROTTA che risponde sempre «nessuna colonna»: uno zero e un elenco
    //    vuoto si assomigliano troppo.
    //
    // ⚠️ E chiude il caso opposto, che è un'esenzione RIMASTA SENZA IL SUO
    //    CASO: se un giorno `menu_items_display` diventasse
    //    `security_invoker`, o perdesse `selling_price`, quella riga nella
    //    rete smetterebbe di servire e resterebbe lì a esentare qualcosa
    //    che non esiste — cioè una porta socchiusa che nessuno guarda più.
    const r = await titolare.rpc("viste_che_scavalcano_rls");
    expect(r.error).toBeNull();
    const menu = (r.data ?? []).find((x) => x.vista === "menu_items_display");
    expect(
      menu,
      "menu_items_display non è più fra le viste che scavalcano la RLS: l'esenzione dentro viste_che_scavalcano_rls() non serve più e va tolta"
    ).toBeDefined();
    expect(menu.espone_denaro, "menu_items_display risulta esporre denaro riservato: l'esenzione non ha preso").toBe(false);
    expect(menu.colonne_riservate).toBeNull();

    // La colonna esentata esiste davvero. `head: true` non scarica nessuna
    // riga, ma un nome di colonna sbagliato viene comunque rifiutato.
    const colonna = await titolare
      .from("menu_items_display")
      .select("selling_price", { count: "exact", head: true });
    expect(
      colonna.error,
      "menu_items_display non ha più selling_price: l'esenzione nella rete è rimasta senza il suo caso"
    ).toBeNull();
  });

  it("la rete delle viste è riservata al titolare, e RIFIUTA invece di rispondere vuoto", async () => {
    // ⚠️ La differenza è tutta qui: un elenco vuoto si legge «nessuna vista
    //    scavalca la RLS» — una rassicurazione falsa proprio sulla rete che
    //    esiste per non farsi rassicurare (regola del 27/08).
    const r = await staff.rpc("viste_che_scavalcano_rls");
    expect(r.error).not.toBeNull();
    expect(r.data).toBeNull();
  });

  it("🔴 lo staff non riceve niente dalle due viste dei soldi", async () => {
    // LA PROVA CHE LA MIGRAZIONE ESISTE PER SUPERARE, e l'unica che guarda
    // il COMPORTAMENTO invece della forma dello schema: una verifica dentro
    // una migrazione non potrebbe scriverla, perché lì si gira come
    // proprietari e la RLS non esiste (lezione del 16/08).
    // ⚠️ `head: true` chiede il solo conteggio: nessuna riga di cassa viene
    //    scaricata nemmeno dalla prova.
    for (const vista of ["v_cash_balance", "v_discounts_gifts_monthly"]) {
      const r = await staff.from(vista).select("*", { count: "exact", head: true });
      // Vuoto o rifiutato vanno bene entrambi: quello che non deve
      // succedere è che arrivino righe.
      expect(r.error ? true : r.count === 0).toBe(true);
    }
  });

  it("...e il titolare invece sì, altrimenti la correzione avrebbe rotto la schermata", async () => {
    // 🔴 IL VERSO OPPOSTO, e senza di lui la prova qui sopra sarebbe
    //    soddisfatta anche da una vista rotta o revocata a tutti: «vuoto per
    //    tutti» non è la correzione, è un guasto diverso.
    //
    // ⚠️ E NON BASTA `error === null`: una vista revocata al titolare, o
    //    svuotata da una `where` sbagliata, risponde **senza errore e con
    //    zero righe**. Quel silenzio soddisfa la prova qui sopra («lo staff
    //    non riceve niente») e passerebbe anche qui — cioè le due prove
    //    insieme direbbero «corretto» di un gestionale in cui la cassa non
    //    si vede più da nessuno. Si pretende un conteggio **positivo**: è
    //    la sola forma che distingue «la RLS morde» da «la vista è rotta».
    //
    // ⚠️ PREZZO DICHIARATO: da qui in avanti questa prova DIPENDE DAI DATI
    //    del progetto di prova. `v_cash_balance` regge da sé (fa un `left
    //    join` sulle entità, quindi risponde una riga per entità anche
    //    senza movimenti), ma `v_discounts_gifts_monthly` aggrega gli
    //    sconti: su un progetto ricostruito da zero e mai popolato sarebbe
    //    vuota, e questa prova diventerebbe rossa **per assenza di dati,
    //    non per un difetto**. Chi la vede rossa guardi prima se lo stato
    //    di partenza c'è (`npm run prova:base`).
    for (const vista of ["v_cash_balance", "v_discounts_gifts_monthly"]) {
      const r = await titolare.from(vista).select("*", { count: "exact", head: true });
      expect(r.error, `${vista}: il titolare non riesce a leggerla`).toBeNull();
      expect(r.count, `${vista}: il titolare la legge ma è vuota — vista rotta o svuotata, non protetta`).toBeGreaterThan(0);
    }
  });
});
