// L'ACCENSIONE DI CASA — `npm run casa:accendi`
//
// Pensato per partire da solo all'accesso di Alessio al PC (Utilita' di
// pianificazione di Windows), ma si lancia anche a mano. Non costruisce e
// non cancella niente:
//  1. aspetta Docker (all'accesso parte dopo qualche decina di secondi);
//  2. mette nella cartella di Casa SOLO le funzioni di FUNZIONI_DI_CASA
//     (oggi `operazioni-atomiche`, 01/11/2026) e accende il loro motore in
//     config.toml; se Casa e' spenta la accende, dalla sua cartella, e se
//     e' accesa senza il motore la riavvia (`stop` senza --no-backup: i
//     dati restano);
//  3. rimette il blocco del cloud nel database, se mancasse, e richiude
//     le porte verso il cloud — 🔴 misurato il 31/10: /etc/hosts
//     del contenitore torna quello di fabbrica a ogni riavvio, quindi la
//     seconda protezione va rimessa a ogni accensione (database e funzioni);
//  4. rifa' la verifica di Casa, funzioni comprese;
//  5. accende il server dell'app (casa-sito.mjs) se non risponde, e fa
//     mandare da Tailscale la 8443 a quel server (fase 2).
// Ogni accensione lascia una riga in C:\Casa\accensioni.log.

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, openSync, readdirSync } from "node:fs";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fermati, titolo } from "./comune.mjs";
import { esitoRegistro } from "./ricostruzione-regole.mjs";
import {
  CARTELLA,
  CARTELLA_FUNZIONI,
  CLOUD,
  CONTENITORE,
  CONTENITORE_FUNZIONI,
  FUNZIONI_DI_CASA,
  PORTA_SITO_CASA,
  accendiIlRuntimeNellaConfigurazione,
  preparaLeFunzioni,
  preparaIlFileDellaChiave,
  chiaveDiClaudePresente,
  quandoECambiataLaChiave,
  problemiDelleFunzioni,
  apriTailscaleVersoCasa,
  indirizzoDiCasa,
  VERSIONE_CLI,
  bloccaIlCloudNelDatabase,
  chiudiIlCloud,
  docker,
  nomiApertiDelCloud,
  pretendiCasa,
  problemiDiCasa,
  sql,
} from "./casa-comune.mjs";

const ATTESA_DOCKER_MINUTI = 5;

function annota(riga) {
  try {
    appendFileSync(path.join(CARTELLA, "accensioni.log"), `${new Date().toISOString()}  ${riga}\n`, "utf8");
  } catch {
    // Il registro e' un aiuto, non una condizione: se non si scrive, si va avanti.
  }
}

function fine(...righe) {
  annota(`FERMO: ${righe[0]}`);
  fermati(...righe);
}

titolo("Accendo Casa");
const scadenza = Date.now() + ATTESA_DOCKER_MINUTI * 60_000;
while (!docker(["info", "--format", "{{.ServerVersion}}"]).ok) {
  if (Date.now() > scadenza) fine(`Docker non risponde dopo ${ATTESA_DOCKER_MINUTI} minuti.`, "Apri Docker Desktop e rilancia.");
  spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 5000)"]);
}
console.log("   Docker risponde");

function supabase(comando) {
  const r = spawnSync("npx", ["--yes", "--prefer-offline", `supabase@${VERSIONE_CLI}`, comando], {
    cwd: CARTELLA,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  // ⚠️ L'uscita di `supabase start` contiene le chiavi: non si stampa.
  if (r.status !== 0) fine(`Supabase di Casa: «${comando}» non e' riuscito.`, (r.stderr || "").trim().split("\n").slice(-3).join("\n  "));
}

// Le funzioni prima di accendere: il motore serve quello che trova nella
// cartella, e config.toml si legge solo all'avvio.
const elenco = () => (existsSync(CARTELLA_FUNZIONI) ? readdirSync(CARTELLA_FUNZIONI).filter((v) => !v.startsWith(".")).sort().join(",") : "");
const primaDiPreparare = elenco();
const funzioniCambiate = preparaLeFunzioni();
// Il file della chiave c'e' prima della partenza: Supabase CLI lo legge solo allora.
preparaIlFileDellaChiave();
if (accendiIlRuntimeNellaConfigurazione()) console.log("   motore delle funzioni acceso in config.toml");
const acceso = (contenitore) => docker(["inspect", "-f", "{{.State.Running}}", contenitore]).stdout === "true";
// 🔴 Misurato il 01/11 sera: una funzione AGGIUNTA o tolta non la vede un
// semplice riavvio del motore (risponde 404); l'elenco lo fa `supabase
// start`. Allora si riparte tutto (`stop` senza --no-backup: i dati restano).
// ⚠️ Anche la chiave di Claude si legge solo a `supabase start`: se il file
// e' piu' recente della partenza del motore, il motore ha quella vecchia.
const partitoIl = Date.parse(docker(["inspect", "-f", "{{.State.StartedAt}}", CONTENITORE_FUNZIONI]).stdout) || 0;
const chiaveNuova = acceso(CONTENITORE_FUNZIONI) && quandoECambiataLaChiave() > partitoIl;
if ((elenco() !== primaDiPreparare || chiaveNuova) && acceso(CONTENITORE)) {
  console.log(`   ${chiaveNuova ? "la chiave di Claude e' cambiata" : "l'elenco delle funzioni e' cambiato"}: riavvio Casa (un minuto circa, i dati restano)`);
  supabase("stop");
}
if (funzioniCambiate && acceso(CONTENITORE_FUNZIONI)) {
  // Il motore potrebbe tenere in memoria il codice vecchio: si riavvia solo
  // lui (pochi secondi; /etc/hosts si richiude qui sotto).
  console.log("   funzioni aggiornate: riavvio il loro motore");
  if (!docker(["restart", CONTENITORE_FUNZIONI]).ok) fine("Il motore delle funzioni non si e' riavviato.");
}
if (!acceso(CONTENITORE)) {
  console.log("   Casa era spenta: la accendo (un minuto circa)");
  supabase("start");
} else if (!acceso(CONTENITORE_FUNZIONI)) {
  // 🔴 MAI `stop --no-backup`: cancellerebbe i dati di Alessio. `stop` da
  // solo spegne i contenitori e lascia il database nel suo volume.
  console.log("   Casa e' accesa senza il motore delle funzioni: la riavvio (un minuto circa, i dati restano)");
  supabase("stop");
  supabase("start");
}
pretendiCasa();

for (const [contenitore, chi] of [[CONTENITORE, "dal database"], [CONTENITORE_FUNZIONI, "dalle funzioni"]]) {
  chiudiIlCloud(CLOUD, contenitore);
  const aperti = nomiApertiDelCloud(CLOUD, contenitore);
  if (aperti.length > 0) fine(`Su Casa ${chi} si raggiunge ancora ${aperti.join(", ")}.`);
}
console.log("   porte verso il cloud chiuse (database e funzioni)");

// Casa accesa ma ancora vuota (prima di `casa:costruisci`): non c'e' niente
// da bloccare ne' da verificare, e non e' un errore.
if (sql("select to_regclass('public.applied_migrations') is null;", "Il controllo del database") === "t") {
  annota("accesa, ma vuota");
  console.log("   Casa e' accesa ma vuota: costruiscila con  npm run casa:costruisci");
  process.exit(0);
}
if (!bloccaIlCloudNelDatabase(CLOUD)) fine("Il blocco del cloud nel database non c'e' e non si e' potuto mettere.");
console.log("   blocco del cloud nel database presente");

const { problemi, registrate } = problemiDiCasa({ esitoRegistro });
problemi.push(...(await problemiDelleFunzioni()));
if (problemi.length > 0) fine("Casa NON e' a posto:", ...problemi.map((p) => `  · ${p}`));
console.log(`   database a posto (${registrate} migrazioni)`);
console.log(`   funzioni accese: solo ${FUNZIONI_DI_CASA.join(", ")}`);
console.log(chiaveDiClaudePresente() ? "   chiave di Claude per MEMO: presente" : "   chiave di Claude per MEMO: manca (MEMO non risponde finche' non la metti:  npm run casa:chiave)");

// ---------------------------------------------------------------------
// Il server dell'app, e Tailscale verso di lui. Il server resta acceso da
// solo dopo che questo comando finisce; scrive in C:\Casa\sito.log.
// ---------------------------------------------------------------------
const risponde = () =>
  new Promise((risolvi) => {
    const s = connect(PORTA_SITO_CASA, "127.0.0.1", () => {
      s.destroy();
      risolvi(true);
    });
    s.on("error", () => risolvi(false));
  });

if (!(await risponde())) {
  const registro = openSync(path.join(CARTELLA, "sito.log"), "a");
  const figlio = spawn(process.execPath, [fileURLToPath(new URL("./casa-sito.mjs", import.meta.url))], {
    detached: true,
    stdio: ["ignore", registro, registro],
    windowsHide: true,
  });
  figlio.unref();
  for (let i = 0; i < 60 && !(await risponde()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await risponde())) fine(`Il server di Casa non si e' acceso: guarda ${path.join(CARTELLA, "sito.log")}.`);
  console.log("   server dell'app acceso");
} else {
  console.log("   server dell'app gia' acceso");
}
apriTailscaleVersoCasa();
const indirizzo = indirizzoDiCasa();
annota(`ok: ${registrate} migrazioni, porte chiuse, app su ${indirizzo}`);
console.log(`   Casa accesa e a posto: ${indirizzo}`);
