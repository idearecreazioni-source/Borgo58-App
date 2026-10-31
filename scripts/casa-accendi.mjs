// L'ACCENSIONE DI CASA — `npm run casa:accendi`
//
// Pensato per partire da solo all'accesso di Alessio al PC (Utilita' di
// pianificazione di Windows), ma si lancia anche a mano. Non costruisce e
// non cancella niente:
//  1. aspetta Docker (all'accesso parte dopo qualche decina di secondi);
//  2. se Casa e' spenta la accende, dalla sua cartella;
//  3. rimette il blocco del cloud nel database, se mancasse, e richiude
//     le porte verso il cloud — 🔴 misurato il 31/10: /etc/hosts
//     del contenitore torna quello di fabbrica a ogni riavvio, quindi la
//     seconda protezione va rimessa a ogni accensione;
//  4. rifa' la verifica di Casa.
// Ogni accensione lascia una riga in C:\Casa\accensioni.log.

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fermati, titolo } from "./comune.mjs";
import { esitoRegistro } from "./ricostruzione-regole.mjs";
import {
  CARTELLA,
  CLOUD,
  CONTENITORE,
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

if (docker(["inspect", "-f", "{{.State.Running}}", CONTENITORE]).stdout !== "true") {
  console.log("   Casa era spenta: la accendo (un minuto circa)");
  const r = spawnSync("npx", ["--yes", "--prefer-offline", `supabase@${VERSIONE_CLI}`, "start"], {
    cwd: CARTELLA,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  // ⚠️ L'uscita di `supabase start` contiene le chiavi: non si stampa.
  if (r.status !== 0) fine("Supabase di Casa non si e' acceso.", (r.stderr || "").trim().split("\n").slice(-3).join("\n  "));
}
pretendiCasa();

chiudiIlCloud(CLOUD);
const aperti = nomiApertiDelCloud(CLOUD);
if (aperti.length > 0) fine(`Dal database di Casa si raggiunge ancora ${aperti.join(", ")}.`);
console.log("   porte verso il cloud chiuse");

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
if (problemi.length > 0) fine("Casa NON e' a posto:", ...problemi.map((p) => `  · ${p}`));
annota(`ok: ${registrate} migrazioni, porte chiuse`);
console.log(`   Casa accesa e a posto (${registrate} migrazioni)`);
