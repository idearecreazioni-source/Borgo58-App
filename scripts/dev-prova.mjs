// IL GESTIONALE PUNTATO AL PROGETTO DI PROVA — `npm run dev:prova`
//
// `npm run dev` apre il gestionale sul database VERO del locale, ed è
// giusto così: è quello che si usa tutti i giorni. Questo comando apre lo
// stesso gestionale sul progetto di prova, che è dove si collauda.
//
// ⚠️ PERCHE' NON BASTA CAMBIARE UN FILE. Fino al 16/08/2026 l'unico modo
// di provare qualcosa era cambiare a mano `.env` e ricordarsi di
// rimetterlo com'era. Due difetti in uno: si dimentica (e il giorno dopo
// il gestionale vero è collegato alla prova, quindi Alessio scrive
// prenotazioni e movimenti in un database usa-e-getta), oppure non si
// dimentica ma nel frattempo non c'è **nessun segno in schermata** di
// dove si sta scrivendo. Le due schermate sono identiche.
//
// Qui i valori non si copiano da nessuna parte: si leggono da `.env`,
// che è già il file che dice qual è il progetto di prova (lo usa
// `npm run test:app`), e si passano a Vite solo per questa esecuzione.
// `.env` resta intatto, quindi `npm run dev` continua ad aprire il
// locale vero senza che nessuno debba rimettere niente a posto.
//
// L'altra metà del lavoro è in `src/components/SegnaleDatabase.jsx`: il
// database collegato si vede nella pagina, in tutte e due le direzioni.

import { networkInterfaces } from "node:os";
import { leggiConfigurazione, obbligatorio, esegui, fermati, titolo, REF_PRODUZIONE, REF_PROVA } from "./comune.mjs";
import { assicuraTunnel } from "./telefono.mjs";

const config = leggiConfigurazione();
const url = obbligatorio(
  config,
  "PROVA_SUPABASE_URL",
  "E' l'indirizzo del progetto Borgo58-Prova (Settings -> Data API)."
);
const chiave = obbligatorio(
  config,
  "PROVA_ANON_KEY",
  "E' la chiave anon del progetto di prova (Settings -> API Keys)."
);

// La stessa barriera dei comandi che scrivono: qui però il pericolo non è
// riscrivere il database vero, è APRIRLO credendo di stare sulla prova e
// riempirlo di dati finti a mano. Che è peggio, perché non lascia tracce
// riconoscibili — un movimento di cassa inventato è identico a uno vero.
if (url.includes(REF_PRODUZIONE)) {
  fermati(
    "FERMO: PROVA_SUPABASE_URL punta al database VERO del locale.",
    "Questo comando serve ad aprire il gestionale sul progetto di PROVA.",
    "Controlla PROVA_SUPABASE_URL in .env (vedi docs/AMBIENTE_PROVA.md)."
  );
}

// ⚠️ LA PORTA SI LEGGE DA QUELLA VERA DI QUESTO AVVIO. Fino al 27/08 le
// righe qui sotto scrivevano 5173 a mano, e con `--port 5199` dicevano il
// falso: mandavano il telefono su un gestionale diverso da quello appena
// aperto — senza nessun errore, mostrandone semplicemente un altro.
const extraArgomenti = process.argv.slice(2).filter((a) => a !== "--");
const portaScelta = (() => {
  const i = extraArgomenti.indexOf("--port");
  if (i >= 0 && extraArgomenti[i + 1]) return Number(extraArgomenti[i + 1]);
  const attaccata = extraArgomenti.find((a) => a.startsWith("--port="));
  return attaccata ? Number(attaccata.split("=")[1]) : 5173;
})();

const riferimento = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\./i)?.[1] ?? "?";

titolo("Gestionale collegato al progetto di PROVA");
console.log(`   database:  ${riferimento}${riferimento === REF_PROVA ? "  (Borgo58-Prova)" : "  ⚠ non e' il progetto di prova dichiarato"}`);
console.log(`   indirizzo: http://localhost:${portaScelta}`);

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
    console.log(`     http://${r.indirizzo}:${portaScelta}     (${r.nome})`);
  }
  console.log("");
  console.log("   Se non si apre: il telefono e' su un'altra rete, oppure");
  console.log("   l'hotspot e' stato riacceso e l'indirizzo e' cambiato.");
} else {
  console.log("");
  console.log("   Nessuna rete: da fuori questo computer non e' raggiungibile.");
}
// 🔴 QUESTA FRASE ERA DIVENTATA FALSA, ed e' stata falsa per quattro
//    giorni. Diceva: «in alto in ogni schermata c'e' la fascia rossa
//    DATABASE DI PROVA — se NON la vedi, sei sul locale vero: chiudi e
//    ricontrolla». Ma il 21/08 Alessio ha deciso che la striscia diventa
//    un **pallino in basso a destra** (rubava spazio verticale sul
//    tablet, che e' proprio la cosa che li' si sta misurando).
//    Misurato: il messaggio e' del 16/08 (`833a087`), il pallino del
//    21/08 (`7b4314d`).
//
// ⚠️ E NON ERA UN DETTAGLIO DI PAROLE: quell'istruzione mandava a cercare
//    una fascia che non esiste piu', e — non trovandola — diceva da se'
//    «sei sul locale vero, chiudi e ricontrolla». Cioe' un **falso
//    allarme garantito, ogni volta**. Un avviso che grida sempre si
//    impara a spegnere, e questo avvisa della cosa piu' pericolosa che ci
//    sia: scrivere dati finti nel gestionale vero.
console.log("");
console.log("   In basso a destra, in ogni schermata, c'e' un pallino:");
console.log("   ARANCIONE = database di prova, quello che scrivi non e' vero.");
console.log("   SCURO     = locale vero. Se lo vedi scuro, chiudi e ricontrolla.");
console.log("   Passandoci sopra col dito o col mouse dice quale progetto e'.");
console.log("");
console.log("   Per tornare al locale vero: chiudi questa finestra e usa `npm run dev`.");

// Vite espone al browser le variabili `VITE_*` dell'ambiente, e queste
// vincono su `.env` — verificato compilando e cercando l'indirizzo
// dentro il pacchetto prodotto, non dato per buono dalla documentazione.
// ⚠️ Quello che si scrive dopo `--` arriva a Vite. Serve per la porta: il
//    gestionale vero gira sulla 5173 e non si ferma mai dopo una verifica
//    (è condiviso con Alessio), quindi il collaudo deve poter aprire una
//    porta sua invece di rubargli quella.
//    Es. `npm run dev:prova -- --port 5199`.
const extra = extraArgomenti;

// ---------------------------------------------------------------------
// L'INDIRIZZO CIFRATO — 27/08/2026
// ---------------------------------------------------------------------
// 🔴 PERCHE' SERVE, e non e' una comodita': **senza indirizzo cifrato il
//    microfono non parte**. I browser danno il microfono solo alle pagine
//    protette, e `localhost` e' l'unica eccezione — cioe' funziona dal
//    computer e non dal telefono. Alessio l'ha misurato con le sue mani la
//    notte del 27/08: stesso iPhone, stesso Safari, `http://…:5173` muto e
//    `https://….ts.net` che detta.
//
// ⚠️ COSA RIPARTE DA SOLO E COSA NO, misurato invece che supposto:
//    `tailscaled` gira come **servizio di Windows** e la configurazione di
//    `tailscale serve` e' salvata nello stato del nodo — quindi
//    l'indirizzo cifrato **sopravvive al riavvio da se'**. Quello che non
//    sopravvive e' il **server del gestionale**, che e' questo comando.
//    Per questo la cura non e' un servizio in piu': e' che *un comando
//    solo* faccia tutte e due le cose.
//
// ⚠️ La porta si legge da quella VERA di questo avvio: con `--port 5199`
//    un indirizzo cifrato puntato alla 5173 aprirebbe un altro gestionale
//    — e non darebbe nessun errore, mostrerebbe l'altro.
//
// ⚠️ E' la rete privata di Alessio (`tailnet only`), non un indirizzo
//    pubblico: ci arrivano solo i suoi dispositivi. Si toglie con
//    `tailscale serve reset`.
// ⚠️ LA REGOLA NON VIVE PIU' QUI: sta in scripts/telefono.mjs, perche' la
//    usano in due (questo comando e `npm run telefono`) e una regola
//    scritta in due corpi fra sei mesi cambia in uno solo.
// 🔴 E DAL 28/08 NON RUBA PIU' L'INDIRIZZO A CHI STA LAVORANDO. Prima
//    ripuntava sempre alla porta di questo avvio: cosi' `dev:collaudo`,
//    che apre la 5199 solo per misurare le schermate, si portava via
//    l'indirizzo del telefono di Alessio — e quando quel server veniva
//    chiuso il telefono restava con una pagina bianca. Adesso si prende il
//    posto solo se dall'altra parte non risponde piu' nessuno.

const { indirizzo: cifrato, esito, portaAltrui, portaMorta } = await assicuraTunnel(portaScelta);
console.log("");
if (cifrato && esito === "occupato-da-vivo") {
  // ⚠️ NON gli si ruba il posto: dall'altra parte c'e' un gestionale acceso,
  //    e quasi sempre e' quello che Alessio sta usando col telefono.
  console.log(`   ⚠ L'indirizzo del telefono sta servendo la porta ${portaAltrui}, non questa.`);
  console.log(`     ${cifrato}`);
  console.log("   Questo server lo apri col numero qui sopra. Se volevi il telefono,");
  console.log(`   chiudi il gestionale sulla porta ${portaAltrui} e riapri questo.`);
} else if (cifrato) {
  console.log("   🎙 PER PARLARE DAL TELEFONO serve questo indirizzo, non il numero:");
  console.log(`     ${cifrato}`);
  if (esito === "ripreso") {
    console.log(`   (era rimasto puntato alla porta ${portaMorta}, dove non rispondeva`);
    console.log("    piu' nessuno: da li' veniva la pagina bianca sul telefono.)");
  }
  console.log("   Il microfono del browser funziona solo su un indirizzo protetto.");
  console.log("   (E' la tua rete privata: ci arrivano solo i tuoi dispositivi.)");
} else {
  console.log("   ⚠ Nessun indirizzo protetto: dal telefono il MICROFONO NON PARTIRA'.");
  console.log("   Tutto il resto del gestionale funziona lo stesso col numero qui sopra.");
}

const r = esegui("npx", ["vite", ...extra], {
  shell: true,
  env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: chiave },
});
process.exit(r.ok ? 0 : 1);
