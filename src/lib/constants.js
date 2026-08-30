// Etichette italiane per gli enum del database (schema Ricettario, migrazione 0001).

// 🔴 LE CATEGORIE DEGLI INGREDIENTI NON STANNO PIÙ QUI (27/08/2026).
//
// Erano lo specchio di un enum. Dal 27/08 sono DATI — la tabella
// `categorie_ingrediente` — perché Alessio deve poterne aggiungere una
// MENTRE inserisce un prodotto: era una sua decisione, e la misura che la
// motiva è che 20 prodotti su 133 finivano in «altro».
//
// ⚠️ E NON SONO STATE SOSTITUITE DA UN ELENCO NUOVO, apposta: uno specchio
// di una TABELLA è una seconda verità che il giorno in cui Alessio aggiunge
// una categoria resta indietro — cioè un valore legittimo che non si può
// scegliere, che fra i due modi di sbagliare è quello SILENZIOSO, e quello
// che la rete dei vocabolari esiste per chiudere.
//
// Si leggono con `listCategorieIngrediente()` in `lib/api/ingredients.js`.
// La riga di `SPECCHIATI` in `lib/calcoli/vocabolari.js` è stata tolta per la
// stessa ragione, e una prova impedisce di rimettere l'elenco qui.

// ⚠️ IL GRAMMO C'È DAL 23/08/2026, per i prodotti da pizzico (zafferano,
// cannella, spezie). La ragione è misurata: in kg il fabbisogno di una
// porzione di cannella vale 0,00003708, che nel campo `numeric(12,4)`
// diventa **zero** — ed è il difetto che ha fermato 148 conti su 346.
//
// ⚠️ E NON c'è il milligrammo, per una scelta che non si può correggere
// dopo: un valore di enum non si toglie, e in mg tutti i prezzi si
// vedrebbero «0,00 €» (misurato su nove spezie su nove).
// 🔴 LE UNITÀ DI MISURA NON STANNO PIÙ QUI — 29/08/2026.
//
// Sono diventate DATI (la tabella `unita_misura`) perché i materiali di
// consumo avessero le loro: su un rotolo di carta forno non si offrono kg,
// g e mazzo. Da quel momento un elenco scritto qui è una SECONDA VERITÀ, e
// il primo giorno è già rimasta indietro — il database ne ammetteva nove e
// questo elenco ne offriva cinque, cioè quattro valori legittimi che nessuna
// schermata poteva scegliere.
//
// ⚠️ NON L'HO TROVATO RILEGGENDO: l'ha trovato la rete dei vocabolari,
// diventata rossa da sola. È il caso per cui esiste.
//
// Si leggono con `useUnita()` (`src/lib/unita.js`). Stessa strada delle
// categorie degli ingredienti, uscite di qui il 27/08 per la stessa ragione.

export const STORAGE_TYPES = [
  { value: "frigo_0_4", label: "Frigo 0-4°C" },
  { value: "frigo_4_8", label: "Frigo 4-8°C" },
  { value: "freezer", label: "Freezer" },
  { value: "dispensa", label: "Dispensa" },
  { value: "temperatura_ambiente", label: "Temperatura ambiente" },
];

export const MONTHS = [
  { value: "gen", label: "Gen" },
  { value: "feb", label: "Feb" },
  { value: "mar", label: "Mar" },
  { value: "apr", label: "Apr" },
  { value: "mag", label: "Mag" },
  { value: "giu", label: "Giu" },
  { value: "lug", label: "Lug" },
  { value: "ago", label: "Ago" },
  { value: "set", label: "Set" },
  { value: "ott", label: "Ott" },
  { value: "nov", label: "Nov" },
  { value: "dic", label: "Dic" },
  { value: "tutto_anno", label: "Tutto l'anno" },
];

export const ALLERGENS = [
  { value: "glutine", label: "Glutine" },
  { value: "crostacei", label: "Crostacei" },
  { value: "uova", label: "Uova" },
  { value: "pesce", label: "Pesce" },
  { value: "arachidi", label: "Arachidi" },
  { value: "soia", label: "Soia" },
  { value: "latte", label: "Latte" },
  { value: "frutta_guscio", label: "Frutta a guscio" },
  { value: "sedano", label: "Sedano" },
  { value: "senape", label: "Senape" },
  { value: "sesamo", label: "Sesamo" },
  { value: "anidride_solforosa", label: "Anidride solforosa" },
  { value: "lupini", label: "Lupini" },
  { value: "molluschi", label: "Molluschi" },
];

export const SUPPLIER_CATEGORIES = [
  { value: "ortofrutta", label: "Ortofrutta" },
  { value: "carne", label: "Carne" },
  { value: "pesce", label: "Pesce" },
  { value: "latticini", label: "Latticini" },
  { value: "secco", label: "Secco" },
  { value: "bevande", label: "Bevande" },
  { value: "economato", label: "Economato" },
  { value: "altro", label: "Altro" },
];

// LE LINEE DELLA PREVISIONE (24/08/2026, disegno chiuso da Alessio in
// docs/mandati/20260824_le_linee_della_previsione.md).
//
// ⚠️ LA SALA NON È QUI, ed è voluto: vive nelle colonne dello scenario —
// scontrino, coperti dei mesi — perché è la linea attorno a cui tutto il
// resto è costruito. Queste cinque sono quelle che si aggiungono.
export const LINEE_PREVISIONE = [
  { value: "lunch", label: "Lunch" },
  { value: "chef_table", label: "Chef table" },
  { value: "lounge", label: "Lounge apericena" },
  { value: "eventi", label: "Eventi" },
  { value: "barattoli", label: "Barattoli trasformati" },
];

// COME SI CONTA UNA LINEA.
//
// 🔴 Alessio, sui barattoli: *«non è un coperto: non forzarlo in quella
// forma»*. La distinzione non è un dettaglio di calcolo — è il modo in cui
// quella linea si vende, e serve al pareggio (che in coperti conta solo
// ciò che è a coperto) e domani al confronto col reale.
export const FORME_LINEA = [
  { value: "a_coperto", label: "a coperto (persone × scontrino)" },
  { value: "a_forfait", label: "a forfait (quanti × incasso medio)" },
  { value: "a_pezzo", label: "a pezzo (quanti pezzi × prezzo)" },
];

// La forma con cui una linea si conta di solito: si PROPONE scegliendo la
// linea, e resta correggibile. ⚠️ Un evento a coperto o un lunch a forfait
// sono possibili — è il suo locale, non una regola nostra.
export const FORMA_TIPICA = {
  lunch: "a_coperto",
  chef_table: "a_coperto",
  lounge: "a_coperto",
  eventi: "a_forfait",
  barattoli: "a_pezzo",
};

export const RECIPE_CATEGORIES = [
  { value: "antipasto", label: "Antipasto" },
  { value: "primo", label: "Primo" },
  { value: "secondo", label: "Secondo" },
  { value: "dolce", label: "Dolce" },
  // 🔴 IL FINGER FOOD È UNA CATEGORIA, non più un'etichetta accanto al
  // nome (24/08/2026, decisione di Alessio). ⚠️ La differenza non è di
  // forma: un piatto di questa categoria ha un **formato diverso** — al
  // posto di ingredienti e preparazioni ha una lista di finger, il costo
  // è la somma dei finger che contiene, e gli allergeni si sommano da
  // quelli. Un'etichetta non poteva reggere niente di tutto questo.
  { value: "finger_food", label: "Finger food" },
];

// È un piatto composto di finger? — la domanda in un posto solo.
// ⚠️ Si guarda la CATEGORIA e non «contiene finger»: un piatto di finger
// food appena creato non ne contiene ancora nessuno, e deve comunque
// aprirsi col formato giusto. Dedurlo dal contenuto vorrebbe dire che il
// formato cambia sotto le mani mentre lo si compone.
export const eFingerFood = (category) => category === "finger_food";

export const RECIPE_TYPES = [
  { value: "piatto_finito", label: "Piatto finito" },
  { value: "preparazione", label: "Preparazione (semilavorato)" },
  // 🔴 IL FINGER (19/08/2026, blocco 1 del mandato dei finger food). È un
  // pezzo finito che entra in un piatto di finger food — non una
  // preparazione, e la differenza non è di parole: una preparazione si
  // PRODUCE a dosi, e finisce in Produzioni e sotto la sorveglianza delle
  // rese. Un finger no: si compone e basta.
  //
  // ⚠️ SI CHIAMAVA «BOCCONCINO» fino al 24/08, e la parola è stata tolta
  // ovunque su richiesta di Alessio: due nomi per la stessa cosa fanno
  // cercare due cose. Il valore nel database era già `finger`.
  //
  // ⚠️ E come una preparazione, un finger DEVE avere una resa (1 pezzo): il
  // calcolo del costo e dello scarico divide per la resa del componente, e
  // senza resa il risultato è NULL — cioè costo e merce che spariscono
  // senza nessun errore. Il vincolo è nel database (`componente_richiede_resa`).
  { value: "finger", label: "Finger (un pezzo di un piatto di finger food)" },
];

// PUÒ STARE DENTRO UN'ALTRA RICETTA? — la domanda in un posto solo.
//
// Preparazioni e finger sì, piatti finiti no: è la regola che il database
// impone in `check_recipe_component`, e qui serve alle schermate per sapere
// quando chiedere la RESA — che per un componente è obbligatoria (senza, il
// calcolo del costo e dello scarico dà NULL e sparisce in silenzio).
//
// ⚠️ Si scrive «non è un piatto finito» e non «è preparazione o finger»
// apposta: un tipo nuovo domani sarebbe trattato da componente, che è il
// verso prudente — gli si chiederebbe la resa invece di lasciarlo passare
// senza. Il permesso vero lo dà comunque il database.
export const eComponente = (recipeType) => recipeType !== "piatto_finito";

// I QUATTRO STATI DI UNA RICETTA (24/08/2026, riscritti su richiesta di
// Alessio: *«una striscia sola con quattro stati»*).
//
// ⚠️ NON SONO UNA COLONNA, e non devono diventarlo: «in sviluppo» e
// «pronta» sono `pronta_per_carta`, «in carta» è un **RIFLESSO** che dice
// se la ricetta sta in un menu attivo (16/08), «ritirata» è una data.
// Fondere le tre cose in un enum sarebbe più bello a vedersi e
// distruggerebbe il riflesso, cioè l'unica ragione per cui «in carta» non
// può mentire. L'etichetta si deriva, non si salva.
//
// ⚠️ L'ORDINE È QUELLO DEL PERCORSO DI UN PIATTO, e la striscia lo mostra:
// in sviluppo → pronta → in carta → ritirata. Le prime tre si attraversano
// in avanti, l'ultima è un'uscita di lato.
export const RECIPE_STATI = [
  { value: "in_sviluppo", label: "In sviluppo", colorClass: "bg-b58-charcoal-soft" },
  { value: "pronta", label: "Pronta per la carta", colorClass: "bg-b58-gold" },
  { value: "in_carta", label: "In carta", colorClass: "bg-b58-olive" },
  { value: "ritirata", label: "Ritirata", colorClass: "bg-b58-charcoal-soft/60" },
];

// ⚠️ «Ritirata» VINCE su tutto il resto, e non è una scelta di comodo: il
// database impedisce che una ricetta ritirata sia anche in carta (le due
// porte chiuse dalla 20260824000025), quindi qui i due casi non si possono
// presentare insieme. Se un giorno si presentassero, sarebbe un difetto —
// e mostrare «ritirata» è il verso prudente: fa cercare il problema.
export const statoRicetta = (prontaPerCarta, inCarta, ritirataIl) => {
  if (ritirataIl) return "ritirata";
  if (inCarta) return "in_carta";
  if (prontaPerCarta) return "pronta";
  return "in_sviluppo";
};

export const recipeStatusLabel = (prontaPerCarta, inCarta, ritirataIl) => {
  const stato = statoRicetta(prontaPerCarta, inCarta, ritirataIl);
  return RECIPE_STATI.find((s) => s.value === stato);
};

export const VIDEO_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "altro", label: "Altro" },
];

export const SEASONS = [
  { value: "primavera", label: "Primavera" },
  { value: "estate", label: "Estate" },
  { value: "autunno", label: "Autunno" },
  { value: "inverno", label: "Inverno" },
  { value: "tutto_anno", label: "Tutto l'anno" },
];

export const STEP_PHASES = [
  { value: "mise_en_place", label: "Mise en place" },
  { value: "cottura", label: "Cottura" },
  { value: "finitura", label: "Finitura" },
  { value: "impiattamento", label: "Impiattamento" },
];

export const COOKING_TECHNIQUES = [
  { value: "tradizionale", label: "Tradizionale" },
  { value: "sottovuoto", label: "Sottovuoto" },
  { value: "CBT", label: "CBT" },
  { value: "abbattitore", label: "Abbattitore" },
  { value: "bagnomaria", label: "Bagnomaria" },
  { value: "frittura", label: "Frittura" },
  { value: "griglia", label: "Griglia" },
  { value: "forno", label: "Forno" },
  { value: "crudo", label: "Crudo" },
  { value: "altro", label: "Altro" },
];

// ⚠️ Vocabolario CHIUSO, e in tre posti che devono restare d'accordo: qui,
// dentro `record_stock_consumption` e nel vincolo della tabella
// `stock_consumptions`. Testo libero produrrebbe «vitto», «Vitto
// personale» e «pasto staff», cioè tre totali che non si sommano.
export const CONSUMPTION_REASONS = [
  { value: "consumo", label: "Consumo" },
  { value: "spreco", label: "Spreco" },
  // Il cibo che mangia la brigata è food cost che non genera ricavo: se
  // non lo si distingue, gonfia il food cost dei piatti venduti e fa
  // cercare un problema in cucina che non esiste (16/08/2026).
  { value: "vitto_personale", label: "Vitto del personale" },
  { value: "rettifica", label: "Rettifica (correzione da conteggio fisico)" },
  // La merce torna da chi l'ha venduta (23/08/2026, blocco 3 del mandato).
  // ⚠️ Esce dal magazzino come uno spreco e NON è uno spreco: contarla lì
  // farebbe cercare un problema in cucina che non esiste.
  { value: "reso_fornitore", label: "Reso al fornitore" },
];

// Dove sono finite le mance: quelle in contanti restano nel cassetto,
// quelle su carta arrivano in banca insieme agli incassi.
export const TIP_MEZZI = [
  { value: "contanti", label: "Contanti" },
  { value: "carta", label: "Carta" },
];

// Come si paga una FATTURA FORNITORE.
//
// ⚠️ L'assegno c'è dal 17/08/2026: mancava, e Alessio conta di usarne una
// trentina prima dell'apertura. Un pagamento vero che il gestionale non sa
// nominare finisce registrato come qualcos'altro.
// ⚠️ Il vocabolario è chiuso in TRE posti che devono restare d'accordo: qui,
// nella funzione `pay_supplier_invoice` e nel vincolo su
// `supplier_invoices`. Da oggi c'è una rete che lo controlla —
// `src/lib/calcoli/vocabolari.js` e `tests/app/vocabolari.test.js`.
export const PAYMENT_METHODS = [
  { value: "contante", label: "Contante" },
  { value: "bonifico", label: "Bonifico" },
  { value: "assegno", label: "Assegno" },
  { value: "carta", label: "Carta" },
];

// 🔴 `PAYMENT_METHODS_SPESA` NON ESISTE PIÙ — 19/08/2026, decisione di
// Alessio. Era nato il 17/08 perché la lista della spesa e le fatture
// avevano due vocabolari diversi: la lista rifiutava l'assegno, e il menu
// lo offriva lo stesso. ⚠️ Ma la separazione poggiava su una ragione che
// è caduta: quella schermata **non sapeva cosa farsene del mezzo** — lo
// registrava e non ne conseguiva niente. Da quando «l'ho comprato e
// pagato» scrive un'uscita vera in prima nota, il mezzo *serve*, e i due
// elenchi sono tornati uno solo: `PAYMENT_METHODS`, assegno compreso.
//
// ⚠️ Se qualcuno li riseparasse, la rete del 17/08 se ne accorge: il
// vincolo sul database e questo elenco vengono confrontati da
// `tests/app/vocabolari.test.js`.

// Com'è finita una riga della lista della spesa. ⚠️ «Non presa» non c'è, e
// non è una dimenticanza: quella riga viene cancellata, quindi non lascia
// un esito da conservare.
export const ESITI_RIGA_LISTA = [
  { value: "comprata", label: "Comprata e pagata" },
  { value: "gratis", label: "Avuta gratis" },
  { value: "arrivata_con_documento", label: "Arrivata con un documento" },
];
export const CLEANING_FREQUENCIES = [
  { value: "giornaliera", label: "Giornaliera" },
  { value: "settimanale", label: "Settimanale" },
  { value: "mensile", label: "Mensile" },
  { value: "altro", label: "Altro" },
];

export const PEST_CONTROL_TYPES = [
  { value: "ispezione", label: "Ispezione" },
  { value: "trattamento", label: "Trattamento" },
];

export const NC_CATEGORIES = [
  { value: "temperatura", label: "Temperatura" },
  { value: "ricevimento", label: "Ricevimento merci" },
  { value: "pulizia", label: "Pulizia e sanificazione" },
  { value: "disinfestazione", label: "Disinfestazione" },
  // Nasce dallo scadenziario (13/08/2026): buttare una partita scaduta
  // scrive da sé la riga qui. In "Altro" non la ritroverebbe nessuno.
  { value: "scadenza", label: "Prodotto scaduto o eliminato" },
  { value: "altro", label: "Altro" },
];

export const CASH_DIRECTIONS = [
  { value: "entrata", label: "Entrata" },
  { value: "uscita", label: "Uscita" },
];

// solo fattura/scontrino/autofattura/documento_raccoglitore_occasionale
// entrano nei calcoli fiscali (§3.4, §3.17)
export const CASH_DOCUMENT_TYPES = [
  { value: "fattura", label: "Fattura" },
  { value: "scontrino", label: "Scontrino" },
  { value: "autofattura", label: "Autofattura" },
  { value: "documento_raccoglitore_occasionale", label: "Documento raccoglitore occasionale" },
  { value: "non_documentato", label: "Non documentato" },
];

export const DISCOUNT_GIFT_TYPES = [
  { value: "sconto", label: "Sconto" },
  { value: "omaggio", label: "Omaggio" },
];

export const ORDER_DESTINATIONS = [
  { value: "cucina", label: "Cucina" },
  { value: "bar", label: "Bar" },
];

export const ORDER_PAYMENT_METHODS = [
  { value: "contante", label: "Contante" },
  { value: "carta", label: "Carta" },
];

// Soglia fattura semplificata (§3.4/§6): scontrino ≤400€ → promemoria IVA.
export const SIMPLIFIED_INVOICE_THRESHOLD = 400;

// Le regole di deducibilità NON stanno più qui (15/08/2026).
// Vivevano in questo file come DEDUCTION_CATEGORIES, con sopra scritto
// «unica fonte di verità», e il calcolo stava in src/lib/deducibility.js.
// Erano due cose sbagliate insieme: percentuali fiscali dentro il bundle
// pubblico — e sono proprio quelle che il quesito L4 aspetta da Laura,
// quindi cambiarle voleva dire fare un deploy invece di riempire un campo —
// e un secondo calcolo accanto a quello che il mandato «personale e
// tesoreria» chiedeva di costruire, cioè due risposte alla stessa domanda.
// Ora: tabella regole_deducibilita e funzione quota_deducibile() nel
// database, governate da Alessio da «Proiezione fiscale → Deducibilità dei
// costi». Il client le legge da src/lib/api/deducibilita.js e non ricalcola.

export const FISCAL_PAYMENT_METHODS = [
  { value: "bonifico", label: "Bonifico", tracciato: true },
  { value: "carta", label: "Carta", tracciato: true },
  { value: "app", label: "App di pagamento", tracciato: true },
  { value: "altro_tracciato", label: "Altro tracciato", tracciato: true },
  { value: "contante", label: "Contante", tracciato: false },
];

export const FISCAL_TOOL_CATEGORIES = [
  { value: "deduzione", label: "Deduzione" },
  { value: "credito_imposta", label: "Credito d'imposta" },
  { value: "bando", label: "Bando" },
  { value: "incentivo", label: "Incentivo" },
];

export const FISCAL_TOOL_STATUSES = [
  { value: "attivo", label: "Attivo" },
  { value: "da_verificare", label: "Da verificare" },
  { value: "scaduto", label: "Scaduto" },
  { value: "abolito", label: "Abolito" },
];

export const EMPLOYEE_STATUSES = [
  { value: "attivo", label: "Attivo" },
  { value: "cessato", label: "Cessato" },
];

export const CONTRACT_TYPES = [
  { value: "indeterminato", label: "Indeterminato" },
  { value: "determinato", label: "Determinato" },
  { value: "apprendistato", label: "Apprendistato" },
  { value: "stagionale", label: "Stagionale" },
  { value: "extra", label: "Extra / a chiamata" },
  { value: "altro", label: "Altro" },
];

export const LEAVE_TYPES = [
  { value: "ferie", label: "Ferie" },
  { value: "permesso", label: "Permesso" },
  { value: "malattia", label: "Malattia" },
  { value: "altro", label: "Altro" },
];

export const COMPLIANCE_DOC_TYPES = [
  { value: "contratto", label: "Contratto" },
  { value: "idoneita_sanitaria", label: "Idoneità sanitaria" },
  { value: "formazione_haccp", label: "Formazione HACCP" },
  { value: "formazione_sicurezza", label: "Formazione sicurezza" },
  { value: "documento_identita", label: "Documento d'identità" },
  { value: "permesso_soggiorno", label: "Permesso di soggiorno" },
  { value: "altro", label: "Altro" },
];

// Regime fiscale mance (§6): imposta sostitutiva 5%, si applica se il reddito
// da lavoro dipendente dell'anno precedente ≤75.000€; le mance agevolate sono
// nel limite del 30% del reddito annuo.
export const MANCE_REGIME_INCOME_THRESHOLD = 75000;
export const MANCE_CAP_RATE = 0.3;
export const MANCE_SUBSTITUTE_TAX_RATE = 0.05;

export const CROP_STATUSES = [
  { value: "pianificato", label: "Pianificato" },
  { value: "seminato", label: "Seminato" },
  { value: "in_crescita", label: "In crescita" },
  { value: "raccolto", label: "Raccolto" },
  { value: "chiuso", label: "Chiuso" },
];

export const RESERVATION_TYPES = [
  { value: "prenotazione", label: "Prenotazione" },
  { value: "evento", label: "Evento" },
];

// Elenco CHIUSO: prima erano testo libero e su venti righe convivevano
// quattro convenzioni diverse ("Adempimenti societari", "Documenti",
// "amministrativo", vuoto). Il database normalizza e rifiuta il resto —
// qui vivono solo le etichette da mostrare.
export const TASK_CATEGORIES = [
  { value: "fisco_scadenze", label: "Fisco e scadenze" },
  { value: "documenti", label: "Documenti" },
  { value: "fornitori_pagamenti", label: "Fornitori e pagamenti" },
  { value: "personale", label: "Personale" },
  { value: "haccp_locale", label: "HACCP e locale" },
  { value: "altro", label: "Altro" },
];

export const TASK_RICORRENZE = [
  { value: "", label: "Non si ripete" },
  { value: "mensile", label: "Ogni mese" },
  { value: "trimestrale", label: "Ogni tre mesi" },
  { value: "semestrale", label: "Ogni sei mesi" },
  { value: "annuale", label: "Ogni anno" },
];

// ⚠️ Non si usa più in Agenda: l'urgenza la dice la scadenza, non un
// campo dichiarato a mano (su venti righe valeva "alta" per tutti gli
// adempimenti e "media" per tutto il resto — non distingueva niente).
// Resta perché la colonna è `not null` e alcuni moduli la scrivono ancora.
export const TASK_PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "bassa", label: "Bassa" },
];

export const TASK_STATUSES = [
  { value: "da_fare", label: "Da fare" },
  { value: "in_corso", label: "In corso" },
  { value: "completato", label: "Completato" },
];

export const RESERVATION_STATUSES = [
  { value: "richiesta_in_attesa", label: "Richiesta in attesa" },
  { value: "confermata", label: "Confermata" },
  // 🔴 «SERVITA» È NATA IL 21/08 da un difetto trovato da Alessio: chiudendo
  // il conto, il tavolo tornava «prenotato» invece di liberarsi. Mancava lo
  // stato che dice *è venuto, ha mangiato, se n'è andato*.
  // ⚠️ Non la scrive nessuno a mano: la scrive il database quando un conto
  // si chiude (`trg_conto_chiuso_servita`). È qui perché i filtri e gli
  // elenchi possano nominarla, non perché si scelga.
  { value: "servita", label: "Servita" },
  // 🔴 «NON PRESENTATA» È NATA IL 22/08, dal difetto trovato costruendo i
  // due mesi finti: chi non veniva restava «confermata» per sempre, e non
  // si distingueva da un conto che qualcuno si era dimenticato di
  // chiudere. Due fatti opposti con la stessa faccia.
  // ⚠️ Questa invece SI SCEGLIE a mano — è l'unico modo di saperlo: nessun
  // gesto del gestionale dice «non è venuto», perché non è successo
  // niente. È il contrario di «servita», che la scrive il database.
  { value: "non_presentata", label: "Non si è presentato" },
  { value: "rifiutata", label: "Rifiutata" },
  { value: "annullata", label: "Annullata" },
];

// Soglie food cost (§5.3 del doc): >25% rosso, >22% giallo, altrimenti verde.
export const foodCostLevel = (pct) => {
  if (pct == null) return "neutral";
  if (pct > 25) return "danger";
  if (pct > 22) return "warning";
  return "ok";
};

export const labelFor = (list, value) =>
  list.find((item) => item.value === value)?.label ?? value;

// 🔴 `useGrouping: "always"` — TROVATO IL 22/08 GUARDANDO I PRESTITI, e
// non è una preferenza tipografica: l'italiano di `Intl` **non raggruppa
// sotto le cinque cifre**, quindi 4.990 usciva «4990,00 €» a schermo mentre
// la funzione `euro()` del database, nello stesso gestionale e a volte
// nella stessa schermata, scriveva «4.990,00 €».
//
// ⚠️ È la famiglia chiusa il 17/08 col database — *un importo si scrive in
// un modo solo* — vista dal lato che era rimasto fuori. E si notava poco
// perché quasi tutti gli importi di prova sono sotto i 1.000 o sopra i
// 10.000: **i numeri a quattro cifre sono la fascia in cui i due mondi
// divergono**, e sono quelli dei prestiti, degli stipendi e delle fatture
// grosse.
//
// 🔴 E UN IMPORTO PICCOLISSIMO NON SI SCRIVE «0,00 €» (30/08/2026). Nasce da
// una cosa vista da Alessio: nelle Produzioni «Busiate trafilate» diceva
// **costata 0,00 €**, e misurando il costo vero era **0,0034 €**. Non era un
// dato mancante: era un dato vero scritto in un modo che si legge «gratis».
// ⚠️ È la famiglia che questo progetto insegue — un numero *plausibile* al
// posto di uno vero — e qui la cura sta in un posto solo, non nella
// schermata dove è stato visto.
// ⚠️ Vale nei due versi: anche −0,004 € non è zero.
// ⚠️ E NON tocca il caso «vuoto»: un importo che non c'è continua a
// scriversi 0,00 € come prima. È un difetto suo, di un'altra famiglia, e
// cambiarlo qui toccherebbe ogni schermata del gestionale in una notte in
// cui nessuno può guardarle tutte.
const SOTTO_UN_CENTESIMO = 0.005;
export const formatEUR = (value) => {
  const n = Number(value ?? 0);
  const scritto = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always",
  }).format(n);
  if (n !== 0 && Math.abs(n) < SOTTO_UN_CENTESIMO) {
    return n > 0 ? "meno di 0,01 €" : "meno di −0,01 €";
  }
  return scritto;
};

// UNA PERCENTUALE COME LA SCRIVE UNA PERSONA (24/08/2026).
//
// 🔴 Nasce da un difetto VISTO a schermo, non dedotto: la scheda di un
// finger diceva «il food cost è il 26.6%» — col punto inglese, in mezzo a
// una frase in italiano dove tutti gli altri numeri hanno la virgola. È la
// stessa famiglia dei «5.8785 kg» del 17/08.
//
// ⚠️ Il numero arriva già arrotondato dal database: qui si SCRIVE, non si
// arrotonda una seconda volta. Due arrotondamenti in fila su uno stesso
// numero sono il modo in cui due schermate cominciano a dire due cifre
// diverse.
export const formatPercento = (value, decimali = 1) =>
  value == null
    ? "—"
    : `${new Intl.NumberFormat("it-IT", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimali,
      }).format(value)}%`;

// Una quantità come la scrive una persona.
//
// ⚠️ Nasce da una piccolezza del collaudo (17/08): in Magazzino si leggeva
// «5.8785 kg» — il residuo di uno scarico calcolato, col punto inglese e
// quattro decimali che nessuno userà mai per prendere una decisione.
// Al massimo due decimali, e gli zeri in coda si tolgono: «10 kg» si legge
// meglio di «10,00 kg», e «5,88 kg» dice tutto quello che serve.
export const formatQta = (value) =>
  value == null || value === ""
    ? "—"
    : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(value));

export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "—";

// ---------------------------------------------------------------------
// Date "di calendario" nel fuso orario del locale
// ---------------------------------------------------------------------
// ⚠️ NON usare `new Date().toISOString().slice(0, 10)` per sapere che
// giorno è: quella è la data UTC, e l'Italia è avanti di 1-2 ore. Fra
// mezzanotte e le 02:00 restituisce IERI.
//
// Per un ufficio è ininfluente, per un'osteria che chiude all'una no: la
// prima nota di fine servizio, le registrazioni HACCP, le mance e i task
// finivano datati al giorno prima — senza errori e senza avvisi, su
// registri che devono reggere anni. Trovato nell'audit dell'08/08/2026 in
// 14 punti diversi.
//
// Queste funzioni leggono giorno, mese e anno dall'orologio locale, che è
// esattamente quello che intende una persona quando dice "oggi".
//
// 🔴 E QUI SI FERMANO, perché rispondono a UNA delle due domande. «Che
// giorno è» non è «che serata è»: alle 00:30, col locale aperto,
// `oggiLocale()` dice **domani**, ed è giusto — un giorno di calendario è
// cambiato davvero. Chi data un gesto della **cassa** o di un **conto**
// non vuole quella risposta: vuole `useGiornataOperativa()` in
// `lib/giornataOperativa.js`, che risponde come il database.
//
// ⚠️ DOVE `oggiLocale()` È LA RISPOSTA GIUSTA, e va lasciata: prenotazioni,
// turni e ferie, scadenze e adempimenti, fatture e spese dei fornitori,
// registrazioni HACCP, giorni bancari. Sono tutte cose che parlano di
// giorni di calendario, non di serate. *Uniformarle alla serata sarebbe un
// difetto, non una pulizia* — ed è scritto qui perché il prossimo che passa
// non lo faccia credendo di sistemare una dimenticanza.
export const dataLocale = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const oggiLocale = () => dataLocale();

export const meseLocale = (d = new Date()) => dataLocale(d).slice(0, 7);

// Primo giorno del mese corrente, in locale.
export const primoDelMeseLocale = (d = new Date()) =>
  dataLocale(new Date(d.getFullYear(), d.getMonth(), 1));

// Data fra N giorni (N negativo = indietro), in locale.
export const traGiorniLocale = (giorni, d = new Date()) => {
  const data = new Date(d);
  data.setDate(data.getDate() + giorni);
  return dataLocale(data);
};
