// Installa in PRODUZIONE una funzione online (Edge Function).
//
// Nasce il 12/08/2026, deciso da Alessio dopo che l'installazione a mano
// dal pannello si e' rotta tre volte su quattro: il codice incollato
// arrivava troncato a meta', e una funzione troncata non e' un errore
// evidente — e' un deploy fallito con un messaggio che parla di parentesi.
//
// Vale lo stesso ragionamento di `migra.mjs`: qui non c'e' piu' un essere
// umano che guarda il codice prima che entri in produzione, quindi i
// vincoli non possono essere buone intenzioni scritte in un documento.
//
//   1. SOLO FILE COMMITTATI. Cio' che gira in produzione dev'essere cio'
//      che il validatore puo' leggere su GitHub.
//   2. NON DECIDE NIENTE DA SE': senza `--conferma` mostra soltanto cosa
//      farebbe.
//   3. LA VERIFICA DEL TOKEN NON SI PERDE PER STRADA. Una sola funzione
//      del progetto e' pubblica per forza — `posta-in-arrivo`, che la
//      chiama un servizio di posta e non un utente. Installarla senza il
//      flag giusto la renderebbe irraggiungibile e la posta smetterebbe
//      di arrivare in silenzio; installare le ALTRE con quel flag
//      spalancherebbe una porta. L'elenco sta qui sotto, scritto una
//      volta, invece che in un comando da ricordarsi a memoria.
//
// Il token vive in `.env`, git-ignored, mai nel repository.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  esegui,
  fermati,
  interroga,
  leggiConfigurazione,
  migrazioniSenzaRiepilogo,
  obbligatorio,
  REF_PRODUZIONE,
  REF_PROVA,
  titolo,
} from "./comune.mjs";

const CARTELLA = "supabase/functions";

// Le funzioni che NON devono pretendere un token in ingresso, con il
// perche' accanto. Aggiungerne una qui e' una decisione di sicurezza:
// significa aprire quella funzione a chiunque ne conosca l'indirizzo.
const SENZA_TOKEN = {
  "posta-in-arrivo":
    "la chiama il servizio di posta, non un utente: la sua barriera e' la firma sulla consegna",
  // 🔴 27/08/2026 — LA SCORCIATOIA VENIVA RESPINTA PRIMA DI ENTRARE.
  //    Alessio ha costruito la Scorciatoia dell'orologio esattamente come
  //    dicevano le istruzioni, e ha ricevuto «Missing authorization header»:
  //    l'errore arrivava dal GATEWAY, prima che la funzione guardasse la
  //    chiave. Misurato: `verify_jwt = true`.
  //
  // ⚠️ LA PROTEZIONE CHE SI TOGLIE QUI NON PROTEGGEVA NIENTE, ed e' la
  //    ragione per cui questa e' la strada giusta e non la piu' comoda. La
  //    verifica del gateway pretende un token — e il token che un client
  //    qualunque manderebbe e' la **chiave anon, che e' pubblica**: sta nel
  //    pacchetto del sito, la legge chiunque. Fermava la Scorciatoia di
  //    Alessio e nessun altro.
  //
  // ⚠️ LA GUARDIA VERA RESTA, ED E' DENTRO: senza una chiave valida la
  //    funzione risponde 401 **prima** di chiamare il modello (il controllo
  //    e' alla riga della sessione, la chiamata all'assistente molto piu'
  //    sotto), quindi una richiesta di uno sconosciuto non costa un
  //    centesimo. La chiave e' 24 byte casuali, il database ne conserva la
  //    sola impronta, si revoca dal gestionale, e ha il freno delle 60
  //    dettature in un'ora con la traccia sull'uso.
  //
  // ⚠️ QUELLO CHE RESTA SCOPERTO, dichiarato: non c'e' un freno sui
  //    tentativi FALLITI di indovinare una chiave. Con 24 byte casuali e'
  //    un rischio teorico, ma e' un rischio teorico e non un rischio
  //    assente — e il giorno che quella porta servisse a qualcosa di piu'
  //    grosso, il freno va aggiunto.
  "ascolta-voce":
    "la chiama la Scorciatoia dell'orologio, che non ha nessun accesso: la sua barriera e' la chiave, controllata dentro prima di spendere",
};

const nome = process.argv[2];
const conferma = process.argv.includes("--conferma");

// Su quale progetto si installa.
//
// ⚠️ PERCHE' ESISTE «--prova» (15/08/2026). Le migrazioni hanno una rete:
// scripts/migra.mjs si rifiuta di toccare la produzione se non le ha
// viste passare dal progetto di prova. Le funzioni online NON ce l'avevano,
// e il buco si e' visto costruendo la tesoreria: due operazioni nuove del
// corridoio, le prove automatiche che le chiamavano, e il corridoio del
// progetto di prova che rispondeva 404 perche' nessuno poteva aggiornarlo
// se non dal pannello a mano. Senza questo comando, un'operazione nuova
// puo' arrivare in produzione senza essere mai stata esercitata da
// nessuna prova.
const suProva = process.argv.includes("--prova");
const REF = suProva ? REF_PROVA : REF_PRODUZIONE;

const disponibili = existsSync(CARTELLA)
  ? readdirSync(CARTELLA, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  : [];

if (!nome || nome.startsWith("--")) {
  fermati(
    "Serve il nome della funzione da installare.",
    `Disponibili: ${disponibili.join(", ")}`,
    "",
    "Esempio: npm run funzione posta-leggi -- --conferma"
  );
}
if (!disponibili.includes(nome)) {
  fermati(`Non esiste nessuna funzione «${nome}».`, `Disponibili: ${disponibili.join(", ")}`);
}

// La chiave puo' arrivare da due strade, e la seconda e' quella buona.
//
// `.env` funziona, ma pretende che qualcuno copi il token a mano — e
// il 12/08/2026 si e' scoperto che dal pannello Supabase non c'e' un
// momento in cui lo si possa copiare per intero: dopo la generazione la
// pagina lo mostra gia' mascherato. Copiarlo «da dove si vede» produce
// una chiave che sembra giusta e viene rifiutata.
//
// `npx supabase login` apre il browser, Alessio autorizza, e la chiave se
// la prende il programma da solo: nessuno la vede e nessuno la incolla.
// Se in `.env` non c'e' niente, si usa quella — ed e' la strada
// preferita, non un ripiego.
const config = leggiConfigurazione();
const token = config.SUPABASE_ACCESS_TOKEN || null;

// --- Vincolo: file committati ----------------------------------------
const stato = esegui("git", ["status", "--porcelain", "--", path.join(CARTELLA, nome)], {
  silenzioso: true,
});
if (!stato.ok && !suProva) {
  fermati("FERMO: non riesco a interrogare git, quindi non posso garantire che il file sia committato.");
}
// ⚠️ Sulla PROVA anche questo vincolo non si applica, per la stessa
// ragione di quello su GitHub: il progetto di prova serve a esercitare il
// codice PRIMA di committarlo, ed e' esattamente l'ordine che il
// protocollo chiede (§7 punto 7). Pretendere il commit qui creerebbe un
// giro chiuso — non posso provarlo finche' non lo committo, e non voglio
// committarlo finche' non l'ho provato. In produzione resta intero.
if (stato.uscita.trim() && !suProva) {
  fermati(
    `FERMO: «${nome}» ha modifiche non committate.`,
    "Cio' che gira in produzione dev'essere cio' che si puo' leggere su GitHub.",
    "Committa prima, poi installa."
  );
}

// --- Vincolo: gia' su GitHub, non solo committato --------------------
// Stesso irrigidimento chiesto dal validatore per `npm run migra` il
// 13/08/2026, e vale identico qui: fra il commit e il push c'e' Alessio,
// e una funzione online installata prima del push gira in produzione
// mentre nessuno puo' leggerne il codice. Se quel commit venisse
// riscritto, il progetto Supabase resterebbe l'unico posto dove quella
// versione e' mai esistita.
// ⚠️ Sulla PROVA questo vincolo non si applica, ed e' il punto: il
// progetto di prova serve proprio a esercitare codice non ancora spinto.
// In produzione resta intero.
const fetch = suProva ? { ok: true } : esegui("git", ["fetch", "--quiet", "origin"], { silenzioso: true });
if (!fetch.ok) {
  fermati(
    "FERMO: non riesco a leggere cosa c'e' su GitHub, quindi non posso garantire",
    "che la produzione non stia per correre avanti al repository.",
    "",
    "Riprova quando la rete risponde."
  );
}
const diverso = suProva
  ? { ok: true }
  : esegui("git", ["diff", "--quiet", "origin/master", "--", path.join(CARTELLA, nome)], { silenzioso: true });
if (!diverso.ok) {
  fermati(
    `FERMO: «${nome}» non e' ancora su GitHub.`,
    "La produzione non deve mai correre avanti al repository.",
    "",
    "Serve il push di Alessio, poi si riprova.",
    "  git push"
  );
}

// ⚠️ La stessa rete di `migra.mjs` (16/08/2026): finche' c'e' una
// migrazione applicata in produzione che nessun riepilogo nomina, la
// produzione non si tocca — nemmeno da questa parte. Una funzione online
// installata mentre l'arretrato e' aperto e' un altro cambiamento del
// sistema vero che chi controlla non puo' ricostruire.
//
// Sulla PROVA non si applica: quel progetto e' usa-e-getta, e il suo scopo
// e' esercitare il codice prima che diventi una consegna.
if (!suProva) {
  // ⚠️ La stringa e' OBBLIGATORIA, non facoltativa (rilievo della
  // validazione del 16/08). Nella prima stesura il controllo stava dentro
  // un `if (urlProduzione)`: senza quella variabile nel .env la rete
  // non scattava **e non lo diceva**. Una rete che si disattiva quando
  // manca una variabile e' una rete che non c'e' — e si sarebbe scoperto
  // solo dopo, guardando cos'e' finito in produzione senza riepilogo.
  // In `migra.mjs` l'url era gia' obbligatorio: qui si chiude l'asimmetria.
  const urlProduzione = obbligatorio(
    config,
    "DB_URL_PRODUZIONE",
    "Serve per sapere quali migrazioni sono in produzione: senza, non si puo' garantire che siano tutte documentate."
  );
  const applicate = new Set(
    interroga(urlProduzione, "select version from applied_migrations;")
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean)
  );
  const scoperte = migrazioniSenzaRiepilogo(applicate);
  if (scoperte.length > 0) {
    fermati(
      "FERMO: ci sono migrazioni in produzione che nessun riepilogo nomina.",
      ...scoperte.map((v) => `  · ${v}`),
      "",
      "Finche' l'arretrato e' aperto non si tocca la produzione, nemmeno",
      "installando una funzione. Scrivi il riepilogo in docs/consegne/."
    );
  }
}

titolo(`Installazione di ${nome}${suProva ? " — PROGETTO DI PROVA" : ""}`);
console.log(`  progetto: ${REF}${suProva ? " (prova)" : " (PRODUZIONE)"}`);
console.log(`  chiave: ${token ? "da .env" : "quella lasciata da `npx supabase login`"}`);
console.log(
  `  verifica del token in ingresso: ${
    SENZA_TOKEN[nome] ? `SPENTA — ${SENZA_TOKEN[nome]}` : "accesa"
  }`
);

if (!conferma) {
  console.log("");
  console.log("  Nessuna modifica fatta: questa e' la modalita' di sola lettura.");
  console.log(`  Per installarla davvero: npm run funzione ${nome} --${suProva ? " --prova" : ""} --conferma`);
  console.log("");
  process.exit(0);
}

// `npx` su Windows e' un `.cmd`: senza `shell` non parte affatto (vedi
// `esegui` in comune.mjs).
const conShell = { shell: process.platform === "win32" };
const ambiente = token ? { ...conShell, env: { SUPABASE_ACCESS_TOKEN: token } } : conShell;

/**
 * La versione installata adesso, o null se non si riesce a chiederlo.
 * Il numero cresce di uno a ogni installazione riuscita: e' l'unico modo
 * onesto di sapere se il deploy e' andato — il comando puo' impiegarci
 * piu' di due minuti e stampare `WARNING: Docker is not running` anche
 * quando riesce (CLAUDE.md §8).
 */
function versioneInstallata() {
  const r = esegui(
    "npx",
    ["supabase", "functions", "list", "--project-ref", REF],
    { ...ambiente, silenzioso: true }
  );
  if (!r.ok) return null;
  try {
    const elenco = JSON.parse(r.uscita.slice(r.uscita.indexOf("{"))).functions || [];
    return elenco.find((f) => f.slug === nome)?.version ?? null;
  } catch {
    return null;
  }
}

const prima = versioneInstallata();

const argomenti = ["supabase", "functions", "deploy", nome, "--project-ref", REF];
if (SENZA_TOKEN[nome]) argomenti.push("--no-verify-jwt");

const r = esegui("npx", argomenti, ambiente);

// Prima di dare la colpa a qualcuno, si guarda com'e' finita davvero.
const dopo = versioneInstallata();
const cresciuta = prima !== null && dopo !== null && dopo > prima;

if (!r.ok && !cresciuta) {
  if (r.errore) {
    // Non e' un rifiuto del server: il programma non e' proprio partito.
    // Mandare a controllare la chiave qui significa far cercare per
    // mezz'ora nel posto sbagliato.
    fermati(
      `Non sono riuscito ad avviare npx su questo computer (${r.errore}).`,
      `${nome} NON e' stata installata: in produzione resta la versione precedente.`,
      "",
      "Non e' un problema di chiave d'accesso ne' di permessi: e' il comando che non parte."
    );
  }
  fermati(
    `L'installazione di ${nome} non e' andata a buon fine.`,
    "In produzione resta attiva la versione precedente: un deploy fallito non spegne niente.",
    "",
    "Se il motivo e' la chiave: lanciare `npx supabase login` in una finestra PowerShell",
    "normale (apre il browser, si autorizza, e la chiave resta li')."
  );
}

titolo("Fatta");
if (cresciuta) {
  console.log(`  ${nome} e' installata: versione ${prima} → ${dopo}.`);
} else if (dopo !== null) {
  console.log(`  ${nome} risulta installata alla versione ${dopo}.`);
  if (prima !== null && dopo === prima) {
    console.log("  ATTENZIONE: il numero di versione non e' cambiato. Il comando dice di aver");
    console.log("  finito, ma in produzione potrebbe esserci ancora quella di prima.");
  }
} else {
  console.log(`  ${nome} risulta installata, ma non sono riuscito a rileggerne la versione.`);
}
console.log("  I Secrets del progetto non vengono toccati da un'installazione.");
console.log("");
