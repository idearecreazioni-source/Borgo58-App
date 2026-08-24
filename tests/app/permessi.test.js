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
  it("solo 10 funzioni si possono eseguire con la sola chiave pubblica", async () => {
    const attese = [
      "check_recipe_component",
      "generate_foraged_lot",
      "is_titolare",
      "normalize_phone",
      "public_reservation_options",
      "set_aggiornato_il",
      "set_task_visibility",
      "set_updated_at",
      "submit_public_reservation",
      "task_origin_visible_to_staff",
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
  it("solo 20 funzioni scavalcano la RLS senza chiedere chi sei", async () => {
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
    ].sort();

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
});
