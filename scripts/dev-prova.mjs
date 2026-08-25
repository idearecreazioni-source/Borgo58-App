// IL GESTIONALE PUNTATO AL PROGETTO DI PROVA — `npm run dev:prova`
//
// `npm run dev` apre il gestionale sul database VERO del locale, ed è
// giusto così: è quello che si usa tutti i giorni. Questo comando apre lo
// stesso gestionale sul progetto di prova, che è dove si collauda.
//
// ⚠️ PERCHE' NON BASTA CAMBIARE UN FILE. Fino al 16/08/2026 l'unico modo
// di provare qualcosa era cambiare a mano `.env.local` e ricordarsi di
// rimetterlo com'era. Due difetti in uno: si dimentica (e il giorno dopo
// il gestionale vero è collegato alla prova, quindi Alessio scrive
// prenotazioni e movimenti in un database usa-e-getta), oppure non si
// dimentica ma nel frattempo non c'è **nessun segno in schermata** di
// dove si sta scrivendo. Le due schermate sono identiche.
//
// Qui i valori non si copiano da nessuna parte: si leggono da `.env.test`,
// che è già il file che dice qual è il progetto di prova (lo usa
// `npm run test:app`), e si passano a Vite solo per questa esecuzione.
// `.env.local` resta intatto, quindi `npm run dev` continua ad aprire il
// locale vero senza che nessuno debba rimettere niente a posto.
//
// L'altra metà del lavoro è in `src/components/SegnaleDatabase.jsx`: il
// database collegato si vede nella pagina, in tutte e due le direzioni.

import { networkInterfaces } from "node:os";
import { leggiConfigurazione, obbligatorio, esegui, fermati, titolo, REF_PRODUZIONE, REF_PROVA } from "./comune.mjs";

const config = leggiConfigurazione(".env.test");
const url = obbligatorio(
  config,
  "VITE_SUPABASE_URL",
  "E' l'indirizzo del progetto Borgo58-Prova (Settings -> Data API)."
);
const chiave = obbligatorio(
  config,
  "VITE_SUPABASE_ANON_KEY",
  "E' la chiave anon del progetto di prova (Settings -> API Keys)."
);

// La stessa barriera dei comandi che scrivono: qui però il pericolo non è
// riscrivere il database vero, è APRIRLO credendo di stare sulla prova e
// riempirlo di dati finti a mano. Che è peggio, perché non lascia tracce
// riconoscibili — un movimento di cassa inventato è identico a uno vero.
if (url.includes(REF_PRODUZIONE)) {
  fermati(
    "FERMO: .env.test punta al database VERO del locale.",
    "Questo comando serve ad aprire il gestionale sul progetto di PROVA.",
    "Controlla VITE_SUPABASE_URL in .env.test (vedi docs/AMBIENTE_PROVA.md)."
  );
}

const riferimento = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\./i)?.[1] ?? "?";

titolo("Gestionale collegato al progetto di PROVA");
console.log(`   database:  ${riferimento}${riferimento === REF_PROVA ? "  (Borgo58-Prova)" : "  ⚠ non e' il progetto di prova dichiarato"}`);
console.log("   indirizzo: http://localhost:5173");

// --- Gli indirizzi da scrivere sul telefono ---------------------------
//
// 🔴 NASCE IL 25/08/2026 DA UNA COSA CHE NON SI SAPEVA FARE. Il collaudo
// vero si fa sul progetto di prova, che gira qui sul computer; ma lo
// schermo dove i difetti di ingombro si vedono davvero e' il telefono, e
// dal telefono Alessio vedeva solo il gestionale VERO — che e' quasi
// vuoto. Il server ascoltava gia' su tutta la rete (`host: true` in
// vite.config.js): quello che mancava era **sapere l'indirizzo**.
//
// ⚠️ L'indirizzo si CALCOLA a ogni avvio, non si scrive qui: cambia ogni
// volta che l'hotspot del telefono si riaccende. Un numero scritto a mano
// in un messaggio e' una frase che diventa falsa.
const daFuori = Object.entries(networkInterfaces())
  .flatMap(([nome, righe]) =>
    (righe ?? [])
      .filter((r) => r.family === "IPv4" && !r.internal)
      // 169.254.x.x e' l'indirizzo che Windows si da' da solo quando una
      // scheda non ha una rete: non ci arriva nessuno.
      .filter((r) => !r.address.startsWith("169.254."))
      .map((r) => ({ nome, indirizzo: r.address }))
  );

if (daFuori.length) {
  console.log("");
  console.log("   Dal telefono o dal tablet, sulla stessa rete:");
  for (const r of daFuori) {
    console.log(`     http://${r.indirizzo}:5173     (${r.nome})`);
  }
  console.log("");
  console.log("   Se non si apre: il telefono e' su un'altra rete, oppure");
  console.log("   l'hotspot e' stato riacceso e l'indirizzo e' cambiato.");
} else {
  console.log("");
  console.log("   Nessuna rete: da fuori questo computer non e' raggiungibile.");
}
console.log("");
console.log("   In alto in ogni schermata c'e' la fascia rossa «DATABASE DI PROVA».");
console.log("   Se NON la vedi, sei sul locale vero: chiudi e ricontrolla.");
console.log("");
console.log("   Per tornare al locale vero: chiudi questa finestra e usa `npm run dev`.");

// Vite espone al browser le variabili `VITE_*` dell'ambiente, e queste
// vincono su `.env.local` — verificato compilando e cercando l'indirizzo
// dentro il pacchetto prodotto, non dato per buono dalla documentazione.
// ⚠️ Quello che si scrive dopo `--` arriva a Vite. Serve per la porta: il
//    gestionale vero gira sulla 5173 e non si ferma mai dopo una verifica
//    (è condiviso con Alessio), quindi il collaudo deve poter aprire una
//    porta sua invece di rubargli quella.
//    Es. `npm run dev:prova -- --port 5199`.
const extra = process.argv.slice(2).filter((a) => a !== "--");

const r = esegui("npx", ["vite", ...extra], {
  shell: true,
  env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: chiave },
});
process.exit(r.ok ? 0 : 1);
