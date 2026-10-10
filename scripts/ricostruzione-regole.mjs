// LE REGOLE DELLA PROVA DI RICARICA — separate dallo strumento perche'
// si possano provare senza database (tests/unita/ricostruzione-regole.test.js).
//
// 🔴 PERCHE' ESISTE (30/09/2026, mandato M20-B). La corsa del 30/09 notte ha
// dato 72 fermate e un registro corto di 69 righe, e il referto diceva lo
// stesso «il registro qui sopra risulta completo». Le cause, misurate:
//
//   1. Dal 28/08 (commit 733ed25) lo strumento applica ogni migrazione in
//      UNA transazione, come i comandi veri. Giusto per i comandi veri: ma
//      la storia vera di alcune migrazioni e' stata un'applicazione A META'
//      (tabelle e funzioni entrate, verifica fallita, registro vuoto),
//      sanata piu' tardi da un'altra migrazione. Ricostruendo in una
//      transazione sola, quelle tabelle spariscono e tutto cio' che viene
//      dopo si ferma a catena. Da 3 fermate a 72.
//   2. La verifica della 20260820000010 confronta `current_date` (che segue
//      il fuso della SESSIONE, UTC su Supabase) con la data italiana della
//      riga appena scritta. Fra le 00:00 e le 02:00 italiane i due giorni
//      non coincidono: misurato il 30/09 alle 01:50 — current_date
//      2026-09-29, data italiana 2026-09-30. La ricostruzione cambiava esito
//      secondo l'ora di lancio.
//
// ⚠️ COSA QUESTO MODULO NON FA: non tocca i comandi veri. `argomentiMigrazione()`
//    in comune.mjs resta com'e' — atomica salvo enum — per `npm run migra` e
//    `npm run prova:migra`. Le eccezioni qui sotto valgono SOLO dentro il
//    database usa-e-getta della prova di ricarica.
//
// 🔴 CORRETTO IL 30/09 (mandato M20-H): la 20260826000013 NON e' piu' una
//    eccezione storica. Della produzione si sa solo che la funzione esiste e
//    la versione e' registrata: non il valore del tetto, ne' come la
//    migrazione sia arrivata. Nella prova le serve una FIXTURE dichiarata
//    (PREPARAZIONI_PROVA), che non e' un fatto storico ne' un dato di produzione.
//
// ⚠️ NESSUNA ECCEZIONE NASCONDE UN ERRORE. Ogni eccezione dichiara il
//    messaggio con cui DEVE fermarsi: se si ferma con un altro, e' un errore
//    inatteso. E nessuna eccezione registra niente: se nessuna migrazione la
//    sana, il registro resta incompleto e il referto lo dice.

/**
 * Le eccezioni storiche note, una per riga. `come`:
 *   · "a_meta" — si applica ISTRUZIONE PER ISTRUZIONE, come prima del 28/08
 *     si applicavano tutte: le DDL restano, la verifica si ferma, la
 *     registrazione non arriva. Riproduce cio' che e' successo davvero.
 *   · "fuso"   — si applica con la sessione sul fuso di Roma, cosi'
 *     `current_date` e' il giorno italiano a qualunque ora.
 *   · "nota"   — si applica come tutte (atomica); la sua fermata e' attesa
 *     e spiegata.
 * `attesa` e' un pezzo del messaggio d'errore con cui deve fermarsi
 * (null se non deve fermarsi). `sanataDa` e' la migrazione che, piu'
 * avanti, rifa' il controllo e la registra (null se nessuna).
 *
 * `origineAttesa` si scrive SOLO quando il messaggio atteso non sta nel file
 * dell'eccezione: e' la migrazione che definisce cio' che lo produce (un
 * vincolo, per esempio). Senza, la provenienza del messaggio non sarebbe
 * dimostrabile — e una prova che lo esclude per nome non dimostra niente.
 */
export const ECCEZIONI_STORICHE = [
  {
    versione: "20260820000010",
    come: "fuso",
    attesa: null,
    sanataDa: null,
    motivo:
      "la verifica confronta current_date (fuso della sessione) con la data italiana della riga: fra le 00 e le 02 italiane falliva",
  },
  {
    versione: "20260822000003",
    come: "a_meta",
    attesa: "item_has_source",
    // Il messaggio non lo scrive lei: e' il nome del VINCOLO di order_items,
    // nato nella 20260804000005. Lei lo fa scattare inserendo una riga con
    // la ricetta presa da «select id from recipes limit 1», che su un
    // database vuoto e' null.
    origineAttesa: "20260804000005",
    sanataDa: "20260825000012",
    motivo: "la verifica cerca una ricetta qualsiasi, e un database vuoto non ne ha",
  },
  {
    versione: "20260823000024",
    come: "a_meta",
    attesa: "Sono sparite le ricette",
    sanataDa: "20260825000012",
    motivo: "la verifica pretende ricette, tavoli e impegni gia' presenti",
  },
  {
    versione: "20260824000033",
    come: "a_meta",
    attesa: "Nessuna previsione libera",
    sanataDa: "20260825000012",
    motivo: "la verifica cerca una previsione non congelata che non ha creato lei",
  },
  {
    versione: "20260827000006",
    come: "a_meta",
    attesa: "si e' fermata su un prodotto noto",
    sanataDa: "20260827000017",
    motivo:
      "la verifica prende in prestito un ingrediente qualunque, e un magazzino vuoto non ne ha: in produzione e' entrata a meta' e l'ha registrata la 20260827000017, che ne rifa' il controllo",
  },
  {
    versione: "20260827000018",
    come: "a_meta",
    attesa: "Il pareggio di istante sceglie a caso",
    sanataDa: "20260828000007",
    motivo:
      "la verifica contiene un istante scritto a mano (27/08 alle 9) ed e' scaduta: nella storia vera e' entrata a meta' e l'ha registrata la 20260828000007",
  },
  {
    versione: "20260829000006",
    come: "nota",
    attesa: "nessuna partita con scadenza in giacenza",
    sanataDa: "20260829000022",
    motivo:
      "guardia voluta: si rifiuta di passare su un magazzino vuoto; la 20260829000022 reinstalla lo stesso corpo, lo verifica con roba propria e la registra",
  },
  {
    versione: "20260917000001",
    come: "nota",
    attesa: "manca il segreto «url_funzioni»",
    sanataDa: null,
    motivo:
      "in ordine di numero arriva prima della 20260929000001, l'unica che crea url_funzioni: limite dichiarato, nel rilascio la 20260929000001 va per prima",
  },
  {
    versione: "20260920000001",
    come: "nota",
    attesa: "nominano ancora il gestionale vero",
    sanataDa: null,
    motivo: "conseguenza della 20260917000001 non applicata: la funzione dei promemoria resta quella con l'indirizzo scritto fisso",
  },
  {
    versione: "20260921000001",
    come: "nota",
    attesa: "nella forma uuid + jsonb, non esiste",
    sanataDa: "20260921000002",
    motivo: "la sua guardia non riconosce la funzione; e' superata dalla 20260921000002, che la registra",
  },
  {
    versione: "20261006000001",
    come: "nota",
    attesa: "Restano colonne non classificate",
    sanataDa: "20261010000001",
    motivo:
      "riscrive il censimento delle unita' da un corpo anteriore alla 20260923000002 e perde il lordo: la sua verifica si ferma; la porta per intero la 20261010000001, che la registra (misurato in produzione il 10/10/2026)",
  },
];

/**
 * LE PREPARAZIONI DELLA PROVA — fixture, NON fatti storici e NON dati di
 * produzione. Il SQL gira SOLO nel database usa-e-getta della ricostruzione,
 * immediatamente prima della migrazione indicata, e per nessun'altra.
 *
 * 20260826000013: la sua verifica (A) pretende una riga di `impostazioni_ai`
 * con `tetto_da` vuoto, e la frase «non l'ha messo nessuno» esce solo se il
 * tetto ha un valore (con il tetto vuoto la funzione dice «Nessun tetto…»).
 * `impostazioni_ai` nasce con la riga e il tetto vuoto (20260825000013), e il
 * vincolo `tetto_sensato` ammette 1..1000. La fixture mette il solo valore
 * finto 10 (lo stesso che la verifica usa come ripiego) e lascia VUOTI
 * `tetto_da`, `tetto_il`, `sbloccato_il`, `sbloccato_da`: nessun valore di
 * produzione e' noto, copiato o citato.
 */
export const PREPARAZIONI_PROVA = [
  {
    versione: "20260826000013",
    sql: "update impostazioni_ai set tetto_mensile_euro = 10 where id;",
  },
];

const PREPARAZIONE_PER_VERSIONE = new Map(PREPARAZIONI_PROVA.map((p) => [p.versione, p]));

/** Il SQL della fixture da applicare PRIMA di una versione, o null. */
export function preparazioneDi(versione) {
  return PREPARAZIONE_PER_VERSIONE.get(versione)?.sql ?? null;
}

/**
 * Gli argomenti dello strumento. L'elenco e' chiuso: un argomento
 * sconosciuto e' un errore, non viene ignorato.
 */
export function leggiArgomenti(argv) {
  const sconosciuti = argv.filter((a) => a !== "--senza-produzione");
  return { senzaProduzione: argv.includes("--senza-produzione"), sconosciuti };
}

/**
 * Con `--senza-produzione` ogni chiave di configurazione che nomina la
 * produzione viene scartata APPENA letta: nessun blocco successivo puo'
 * trovarla, quindi nessun percorso puo' collegarsi, interrogare o confrontare.
 * Senza l'argomento la configurazione passa com'e' (non e' resa piu' permissiva).
 */
export function configurazioneSenzaProduzione(config, senzaProduzione) {
  if (!senzaProduzione) return config;
  return Object.fromEntries(Object.entries(config).filter(([k]) => !/PRODUZIONE/i.test(k)));
}

const PER_VERSIONE = new Map(ECCEZIONI_STORICHE.map((e) => [e.versione, e]));

/** L'eccezione storica di una versione, o null. */
export function eccezioneDi(versione) {
  return PER_VERSIONE.get(versione) ?? null;
}

/**
 * Come si applica UNA migrazione nella prova di ricarica.
 * `atomicaDiRegola` e' la risposta di `argomentiMigrazione()` (la regola
 * dei comandi veri): qui la si cambia solo per le eccezioni "a_meta".
 */
export function modoRicostruzione(versione, atomicaDiRegola) {
  const e = eccezioneDi(versione);
  return {
    atomica: e?.come === "a_meta" ? false : atomicaDiRegola,
    fusoRoma: e?.come === "fuso",
    eccezione: e,
  };
}

/** Gli argomenti di psql per una migrazione della prova di ricarica. */
export function argomentiRicostruzione(url, file, { atomica, fusoRoma, chiedeIlCatalogo }) {
  return [
    "-v", "ON_ERROR_STOP=1",
    ...(atomica ? ["--single-transaction"] : []),
    "-d", url,
    ...(fusoRoma ? ["-c", "set timezone = 'Europe/Rome'"] : []),
    ...(chiedeIlCatalogo ? ["-c", "set enable_seqscan = off"] : []),
    "-f", file,
  ];
}

/**
 * Divide le fermate in NOTE (eccezione storica con il messaggio atteso) e
 * INATTESE (tutto il resto — compresa un'eccezione che si ferma con un
 * messaggio DIVERSO da quello dichiarato, o una "fuso" che si ferma).
 * Restituisce anche le eccezioni che dovevano fermarsi e non l'hanno fatto:
 * non sono errori, ma sono una storia che non corrisponde piu'.
 */
export function classificaFermate(fermate, versioniApplicate) {
  const note = [];
  const inattese = [];
  const fermateVersioni = new Set();
  for (const f of fermate) {
    fermateVersioni.add(f.versione);
    const e = eccezioneDi(f.versione);
    if (e && e.attesa && f.motivo.includes(e.attesa)) note.push({ ...f, eccezione: e });
    else inattese.push({ ...f, eccezione: e });
  }
  const nonScattate = ECCEZIONI_STORICHE.filter(
    (e) => e.attesa && versioniApplicate.includes(e.versione) && !fermateVersioni.has(e.versione)
  );
  return { note, inattese, nonScattate };
}

/**
 * Il registro e' completo SOLO se ogni file ha la sua riga e non ci sono
 * righe senza file. Mai un conteggio: due numeri uguali possono nascondere
 * una riga in piu' e una in meno.
 */
export function esitoRegistro(versioniFile, versioniRegistrate) {
  const registrate = new Set(versioniRegistrate);
  const file = new Set(versioniFile);
  const mancanti = versioniFile.filter((v) => !registrate.has(v));
  const estranee = versioniRegistrate.filter((v) => !file.has(v));
  return { completo: mancanti.length === 0 && estranee.length === 0, mancanti, estranee };
}

/**
 * L'esito complessivo. Verde solo se: nessuna fermata inattesa, registro
 * completo, nessuna differenza di schema. Le fermate NOTE non lo rendono
 * rosso da sole; ma se lasciano il registro incompleto, rosso lo e' lo stesso.
 */
export function esitoComplessivo({ inattese, registro, differenze }) {
  const motivi = [];
  if (inattese.length) motivi.push(`${inattese.length} fermate inattese`);
  if (!registro.completo) motivi.push(`registro incompleto (${registro.mancanti.length} mancanti, ${registro.estranee.length} senza file)`);
  if (differenze) motivi.push(`${differenze} differenze di schema`);
  return { verde: motivi.length === 0, motivi };
}
