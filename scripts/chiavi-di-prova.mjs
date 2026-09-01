// «LE CHIAVI CI SONO E SONO SANE?» — il passo che apre il giro delle prove
// contro il database (01/09/2026).
//
// Sostituisce il controllo che guardava una casella sola. La ragione,
// coi numeri, sta in `scripts/chiavi.mjs`: il 31/08 quel controllo ha
// detto di si' con due segreti vuoti e un indirizzo malformato, e il
// giro e' morto sei minuti dopo con 67 file falliti che non nominavano
// la causa.
//
// ⚠️ NON STAMPA NESSUN VALORE che non sia gia' nel messaggio d'errore, e
//    su GitHub i segreti escono comunque mascherati: quello che serve e'
//    il NOME della casella e cosa le manca.

import { SEGRETI_VERI, leggiChiaviDiProva, problemiDelleChiavi, righeIgnorate } from "./chiavi.mjs";

// ⚠️ Legge dall'ambiente E da `.env`, con la precedenza dichiarata in
//    `leggiChiaviDiProva()`: cosi' lo stesso comando serve alla pipeline
//    (dove `.env` non esiste) e al computer di Alessio (dove esiste). Un
//    controllo che vale solo in un posto e' il difetto del 31/08.
const dentroLaPipeline = Boolean(process.env.GITHUB_ACTIONS);
const valori = leggiChiaviDiProva();
const problemi = problemiDelleChiavi(valori, dentroLaPipeline ? "env" : "file");

// ⚠️ Le caselle scritte male ma non necessarie NON fermano il lavoro: si
//    dicono. Fermarsi su una cosa che il repository sa gia' sarebbe
//    chiedere a una persona di rimettere a posto un valore per far girare
//    un controllo che quel valore non gli serve.
for (const nota of righeIgnorate()) console.log(`⚠️  ${nota}`);

if (problemi.length === 0) {
  console.log(
  "Le prove hanno tutto quello che serve: i tre segreti ci sono, e il bersaglio\n" +
    "e' il progetto di prova."
);
  process.exit(0);
}

console.error(`${dentroLaPipeline ? "::error::" : ""}Le chiavi del progetto di prova non vanno bene. Le prove NON sono state eseguite.`);
for (const riga of problemi) console.error(`  · ${riga}`);
console.error("");
console.error("Se questa e' una proposta di modifica che arriva da un repository");
console.error("forestiero e' normale: GitHub non passa i segreti, ed e' una");
console.error("protezione. In quel caso le prove contro il database vanno lanciate");
console.error("a mano prima di approvare.");
console.error("");
console.error("Se invece e' un ramo di questo repository, le caselle nominate qui");
console.error("sopra vanno messe a posto nei Secrets del repository:");
console.error("  Settings -> Secrets and variables -> Actions");
console.error(`I segreti da avere sono TRE, e sono questi: ${SEGRETI_VERI.join(", ")}.`);
console.error("Tutto il resto — l'indirizzo del progetto di prova e le due");
console.error("caselle di posta degli utenti di collaudo — lo sa gia' il");
console.error("repository e non va messo in nessun segreto.");
console.error("Guida passo passo in docs/CI.md.");
process.exit(1);
