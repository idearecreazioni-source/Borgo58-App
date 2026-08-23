// COSA C'È ANCORA DI PROVA NEL GESTIONALE VERO — `npm run collaudo:stato`
//
// 🔴 PERCHÉ ESISTE, ed è una storia breve. Dal 13/08 in CLAUDE.md c'era un
// paragrafo che elencava i dati di collaudo rimasti in produzione: quello
// che va tolto **prima della prima fattura vera di un fornitore vero**, che
// è il momento in cui un prodotto finto e uno vero smettono di
// distinguersi. Era scritto a mano, e **ha sbagliato tre volte in sei
// giorni** — sempre sulle stesse voci (i conti, le prenotazioni), sempre
// perché nel frattempo Alessio usava l'app.
//
// ⚠️ *Un elenco di cose da togliere che si fida della memoria di chi l'ha
// scritto fallisce nel solo giorno in cui serve davvero* — la sera prima
// dell'apertura, quando non c'è tempo per accorgersene.
//
// La forma giusta esiste già in questo progetto: `npm run prova:stato`
// ricava l'elenco dal database a ogni esecuzione invece di contenerlo.
// Questo comando fa lo stesso. **Il paragrafo a mano è stato tolto.**
//
// ⚠️ NON CANCELLA NIENTE: legge e stampa. La cancellazione resta un gesto
// di Alessio, e queste sono righe sue.
//
// ⚠️ LEGGE LA PRODUZIONE, ed è il punto: un comando che leggesse il
// progetto di prova risponderebbe a un'altra domanda.

import {
  leggiConfigurazione,
  obbligatorio,
  interroga,
  titolo,
  timbroLocale,
} from "./comune.mjs";

// ⚠️ L'elenco delle COSE DA GUARDARE è scritto qui, e questo è il limite
// dichiarato del comando: se domani nascesse una tabella nuova che si
// riempie di dati di collaudo, non comparirebbe finché nessuno la aggiunge.
// I NUMERI invece non sono mai scritti: si chiedono al database a ogni
// esecuzione, ed è ciò che l'elenco a mano non faceva.
//
// La divisione in tre gruppi non è estetica. È la distinzione su cui il
// paragrafo a mano faceva cercare una cosa che non c'era: «le sei fatture
// di collaudo» erano DOCUMENTI, e quello che resta in giro sono i loro
// EFFETTI — ingredienti, diciture, lotti, storico prezzi.
const GRUPPI = [
  {
    nome: "I GESTI DI COLLAUDO — le prove fatte con le mani",
    voci: [
      { che: "conti (di cui APERTI)", sql: "select count(*) || ' (' || count(*) filter (where status = 'aperto') || ')' from orders" },
      { che: "righe di comanda", sql: "select count(*) from order_items" },
      { che: "prenotazioni (di cui confermate)", sql: "select count(*) || ' (' || count(*) filter (where status = 'confermata') || ')' from reservations" },
      { che: "ordini ai fornitori", sql: "select count(*) from ordini_fornitore" },
      { che: "righe in lista della spesa", sql: "select count(*) from shopping_list_items" },
      { che: "scarichi di magazzino", sql: "select count(*) from stock_consumptions" },
      { che: "clienti", sql: "select count(*) from customers" },
    ],
  },
  {
    nome: "I DOCUMENTI ENTRATI DALLA POSTA",
    voci: [
      { che: "documenti in archivio (col file)", sql: "select count(*) || ' (' || count(*) filter (where file_name is not null) || ')' from documents" },
      { che: "mail ricevute", sql: "select count(*) from posta_ricevuta" },
      { che: "fatture REGISTRATE (supplier_invoices)", sql: "select count(*) from supplier_invoices" },
    ],
  },
  {
    nome: "GLI EFFETTI di quei documenti — quello che il carico ha creato",
    voci: [
      { che: "ingredienti", sql: "select count(*) from ingredients" },
      { che: "diciture dei fornitori (col fornitore)", sql: "select count(*) || ' (' || count(*) filter (where supplier_id is not null) || ')' from articoli_fornitore" },
      { che: "fornitori", sql: "select count(*) from suppliers" },
      { che: "lotti di magazzino", sql: "select count(*) from stock_lots" },
      { che: "righe di storico prezzi", sql: "select count(*) from price_history" },
    ],
  },
  {
    nome: "QUELLO CHE NON È DI PROVA, e non va toccato",
    voci: [
      {
        che: "avvisi: di collaudo / VERI",
        sql:
          "select count(*) filter (where tipo like 'rincaro%') || ' / ' || " +
          "count(*) filter (where tipo not like 'rincaro%') from allarmi",
      },
      { che: "tracce di cancellazione (non ripulibili)", sql: "select count(*) from deleted_records" },
      // 🔴 QUANTE DI QUELLE TRACCE NON SONO GESTI VERI (23/08/2026). Il
      // numero sopra da solo non dice niente: cresce coi dati veri e con le
      // prove insieme. Misurato quel giorno: 43 tracce, di cui 24 nate e
      // morte nello stesso istante — e il controllo ne vedeva 2, perche'
      // cercava una parola sola mentre le prove ne usano cinque.
      // ⚠️ Le due colonne restano SEPARATE apposta: la prima e' certa (la
      // riga porta un marcatore), la seconda e' un indizio — anche un gesto
      // vero puo' durare un istante.
      {
        che: "di cui: marcate come prova / nate e morte in un istante",
        sql:
          "select count(*) filter (where record::text ilike '%verifica%' " +
          "or record::text ilike '%__PROVA%' or record::text ilike '%TEST-AUTO%' " +
          "or record::text ilike '%PROVA BANCA%' or record::text ilike '%PROVA PAGA%') " +
          "|| ' / ' || count(*) filter (where (record->>'created_at') is not null " +
          "and deleted_at - (record->>'created_at')::timestamptz < interval '1 minute') " +
          "from deleted_records",
      },
      // ⚠️ Niente caratteri fuori dall'alfabeto inglese DENTRO la SQL: qui la
      // domanda passa dalla riga di comando, e li' si rompe con «invalid byte
      // sequence» (trappola del 18/08). Nel testo italiano fuori dalla SQL
      // stanno benissimo.
      { che: "ricette / menu / movimenti di cassa", sql: "select (select count(*) from recipes) || ' / ' || (select count(*) from menus) || ' / ' || (select count(*) from cash_movements)" },
    ],
  },
];

const config = leggiConfigurazione();
const url = obbligatorio(
  config,
  "DB_URL_PRODUZIONE",
  "Serve la stringa di collegamento del database vero (docs/BACKUP.md, paragrafo 2)."
);

titolo(`Cosa c'è ancora di prova nel gestionale vero — ${timbroLocale()}`);

for (const gruppo of GRUPPI) {
  console.log(`  ${gruppo.nome}`);
  for (const voce of gruppo.voci) {
    const risposta = interroga(url, voce.sql);
    console.log(`    ${voce.che.padEnd(42)} ${risposta}`);
  }
  console.log("");
}

console.log("  IN CHE ORDINE SI TOGLIE");
console.log("    ⚠️ L'ordine e' IMPOSTO DAI VINCOLI, misurato, e dal 20/08 e' scritto in");
console.log("       una migrazione: supabase/migrations/20260820000012_la_produzione_torna_vuota.sql");
console.log("       Non si toglie a mano — quella migrazione controlla anche che non si sia");
console.log("       toccato niente di quello che deve restare.");
console.log("");
console.log("    1. gli SCARICHI DI MAGAZZINO, e vanno PRIMA dei conti:");
console.log("       stock_consumptions.order_id e' ON DELETE SET NULL, quindi cancellando i");
console.log("       conti per primi il legame si azzera IN SILENZIO — e poi gli ingredienti");
console.log("       restano bloccati, perche' stock_consumptions→ingredients e' RESTRICT.");
console.log("       🔴 E' il motivo per cui l'ordine scritto qui fino al 20/08 non arrivava");
console.log("       in fondo: cominciava dai conti.");
console.log("    2. i CONTI, e SOLO i conti: righe, tavoli, pagamenti, anomalie e");
console.log("       segnalazioni fiscali scendono in cascata. ⚠️ Cancellare le righe PRIMA");
console.log("       viene respinto da un trigger («il totale su cui hai incassato non deve");
console.log("       cambiare dopo»), e quel trigger e' giusto: si toglie il conto, non la riga.");
console.log("    3. le PRENOTAZIONI — e non prima: il legame conto→prenotazione e' `restrict`,");
console.log("       quindi cancellare prima la prenotazione viene RESPINTO");
console.log("    4. gli ordini ai fornitori e le righe di lista");
console.log("    5. i lotti, le diciture, lo storico prezzi, gli ingredienti, i fornitori");
console.log("    6. le non conformita' HACCP");
console.log("    7. la POSTA prima dei DOCUMENTI: posta_ricevuta.documento_id e");
console.log("       posta_azioni.documento_id sono SET NULL, e invertendo si perde il legame");
console.log("       senza che nessuno se ne accorga");
console.log("    8. gli impegni GENERATI (si riconoscono da `origine_modulo`, non dal titolo:");
console.log("       gli altri li ha scritti Alessio e contengono codici F24), poi i documenti");
console.log("    9. gli avvisi di collaudo, i clienti, e i file nel deposito");
console.log("       (npm run deposito:orfani — stanno FUORI dal database)");
console.log("   10. la pagina /prova-voce: TOLTA dal codice il 20/08, non c'e' piu' niente da fare");
console.log("");
console.log("  DUE COSE CHE NON TORNANO COME PRIMA");
console.log("    · i documenti sono una tabella TRACCIATA: cancellarli lascia una traccia");
console.log("      per ognuno nel registro delle cancellazioni, e quel registro non lo");
console.log("      puo' ripulire nessuno dall'app. Il numero qui sopra SALIRA', non scendera'.");
console.log("    · e di quelle tracce una buona parte NON sono gesti veri: sono le");
console.log("      righe che le prove e i collaudi hanno creato e cancellato. La riga");
console.log("      «di cui» qui sopra le conta — la prima colonna e' certa, la seconda");
console.log("      e' un indizio (anche un gesto vero puo' durare un istante). Toglierle");
console.log("      si puo' solo con una migrazione: dall'app quel registro non si tocca.");
console.log("    · gli avvisi VERI (scadenze, lavori fermi) non sono dati di prova: sono la");
console.log("      storia di cio' che ha funzionato, e toglierli la cancella.");
// ---------------------------------------------------------------------
// IL PROMEMORIA DEL PIANO A PAGAMENTO — 23/08/2026, chiesto da Alessio.
// ---------------------------------------------------------------------
// 🔴 «Il giorno che entra il primo conto vero, l'unica copia non puo'
// dipendere da me che lancio un comando la sera dopo il servizio.»
//
// ⚠️ STA QUI, e non in un calendario o in un documento, perche' QUESTO e'
// il comando che si guarda proprio nel momento giusto: prima di caricare
// i primi dati veri si viene qui a vedere cosa c'e' ancora di prova. Un
// promemoria in un'agenda si rimanda; uno che compare mentre si sta per
// fare la cosa, no.
//
// ⚠️ E non e' una data: e' un FATTO che si misura. Finche' il gestionale
// vero e' vuoto la riga e' un ricordo tranquillo; appena dentro ci sono
// fatture, movimenti o conti che non sono di collaudo, diventa un avviso.
const roba = Number(
  interroga(
    url,
    "select (select count(*) from supplier_invoices) + (select count(*) from cash_movements);"
  ).trim() || 0
);
console.log("");
console.log("  ── I BACKUP: su cosa puoi contare");
console.log("  Il piano gratuito di Supabase NON fa nessun backup: l'unica copia");
console.log("  esiste se qualcuno lancia `npm run backup`.");
console.log("  Ogni copia si controlla da se' appena fatta. La PROVA DI RIPRISTINO");
console.log("  completa invece NO, ed e' voluto: un backup lento e' un backup che");
console.log("  si smette di fare, e quello e' il rischio peggiore di tutti.");
console.log("  ⚠️ Lanciala tu ogni tanto, e SEMPRE prima di un momento importante:");
console.log("     npm run backup:ripristina");
if (roba === 0) {
  console.log("  Oggi non c'e' niente di vero da perdere (zero fatture, zero movimenti),");
  console.log("  quindi va bene cosi'.");
  console.log("  ⚠️ IL GIORNO CHE CARICHI I PRIMI DATI VERI, attiva il piano a pagamento:");
  console.log("     da li' in poi i backup diventano giornalieri e automatici, e non");
  console.log("     dipendono piu' da te che ti ricordi la sera dopo il servizio.");
} else {
  console.log(`  🔴 IN PRODUZIONE CI SONO GIA' ${roba} FRA FATTURE E MOVIMENTI.`);
  console.log("  Se non e' ancora attivo, ATTIVA ADESSO il piano a pagamento di Supabase:");
  console.log("  da adesso c'e' roba vera da perdere, e l'unica copia dipende da un");
  console.log("  comando lanciato a mano.");
}

console.log("");
console.log("  Nessuna riga e' stata toccata: questo comando legge e basta.");
