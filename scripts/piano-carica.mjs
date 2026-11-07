// npm run piano:carica -- <file.json> [--prova] [--conferma]
//
// IL PUNTO DI PARTENZA DEL PIANO DELL'INVESTIMENTO (07/11/2026).
//
// Carica in una volta sola le voci e le rate del piano da un file JSON:
//   · senza --prova scrive su work (DB_URL_PRODUZIONE), e il file deve
//     essere quello vero, che sta FUORI dal repository;
//   · con --prova scrive su Prova (DB_URL_PROVA), e il file deve essere
//     finto («"finto": true», per esempio scripts/dati/piano-finto.json).
//
// 🔴 SENZA --conferma NON SCRIVE E NON LEGGE NIENTE: controlla il file e
//    mostra il riepilogo. Con --conferma carica tutto in una transazione
//    sola, a tabelle bloccate, solo se il piano è vuoto, e verifica i conti
//    prima di chiudere.
// 🔴 SU WORK SOLO COL SÌ DI ALESSIO, dopo il rilascio che crea le tabelle
//    del piano (migrazione 20261107000001) e con una copia di sicurezza
//    recente, come `npm run migra`.
//
// Revisione ecc:security-reviewer del 07/11: barriere fatte come quelle di
// comune.mjs (chi si collega e dove, non «il riferimento compare»), opzioni
// sconosciute rifiutate, file temporaneo in una cartella sua.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ORE_MASSIME_BACKUP,
  REF_PRODUZIONE,
  backupTroppoVecchio,
  copiaPiuRecente,
  esegui,
  fermati,
  leggiConfigurazione,
  obbligatorio,
  problemiDiProgetto,
  soloProva,
  strumento,
  titolo,
} from "./comune.mjs";
import { problemiDelPiano, riepilogoDelPiano, sqlDelPiano } from "./piano-carica-regole.mjs";

const OPZIONI = ["--prova", "--conferma"];
const argomenti = process.argv.slice(2);
const sconosciute = argomenti.filter((a) => a.startsWith("--") && !OPZIONI.includes(a));
if (sconosciute.length > 0) {
  fermati(`Non conosco ${sconosciute.join(", ")}: le opzioni sono solo --prova e --conferma.`, "Non ho letto, scritto ne' cancellato niente.");
}
const suProva = argomenti.includes("--prova");
const conferma = argomenti.includes("--conferma");
const file = argomenti.find((a) => !a.startsWith("--"));
const dove = suProva ? "prova" : "work";

if (!file) {
  fermati("Manca il file del piano.", "Uso: npm run piano:carica -- <file.json> [--prova] [--conferma]");
}

// 🔴 IL FILE VERO STA FUORI DAL REPOSITORY: sono i conti di Alessio.
const assoluto = path.resolve(file);
const dentroIlRepo = !path.relative(process.cwd(), assoluto).startsWith("..") && !path.isAbsolute(path.relative(process.cwd(), assoluto));
if (!suProva && dentroIlRepo) {
  fermati("FERMO: su work si carica solo il file vero, che sta fuori dal repository.", `Questo sta dentro: ${file}`);
}

let dati;
try {
  dati = JSON.parse(readFileSync(assoluto, "utf8"));
} catch (e) {
  fermati(`Non riesco a leggere ${file}:`, e.message);
}

const cfg = leggiConfigurazione();
let url;
if (suProva) {
  url = soloProva(obbligatorio(cfg, "DB_URL_PROVA", "Serve il progetto di prova. Vedi docs/AMBIENTE_PROVA.md."));
} else {
  url = obbligatorio(cfg, "DB_URL_PRODUZIONE", "Serve la stringa di collegamento del database vero (docs/BACKUP.md, paragrafo 2).");
  const problemi = problemiDiProgetto(REF_PRODUZIONE, { dbUrl: url });
  // psql legge anche ?host= e ?user= dai parametri: lo scavalcherebbero.
  if (/[?&](host|hostaddr|user|service)=/i.test(url)) problemi.push("La stringa del database ha parametri che cambiano host o utente.");
  if (problemi.length > 0) {
    fermati("FERMO: DB_URL_PRODUZIONE non è quella del gestionale vero.", ...problemi, "Non ho letto, scritto ne' cancellato niente. Controlla .env.");
  }
}

titolo(`Il piano dell'investimento — ${suProva ? "Prova (dati finti)" : "work, il gestionale vero"}`);

const problemi = problemiDelPiano(dati, dove);
if (problemi.length > 0) fermati("Il file non va bene, non ho scritto niente:", ...problemi.map((p) => `· ${p}`));

const r = riepilogoDelPiano(dati);
const euro = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log(`  ${r.voci} voci, ${r.rate} rate, ${euro(r.totale)} € IVA inclusa`);
console.log(`  per gruppo: ${Object.entries(r.perGruppo).map(([g, t]) => `${g} ${euro(t)}`).join(" · ")}`);
console.log(`  per mese (0 = acconto): ${Object.entries(r.perMese).map(([m, t]) => `${m}: ${euro(t)}`).join(" · ")}`);
console.log(`  apertura: ${dati.mese_apertura}`);

if (!conferma) {
  console.log("");
  console.log("  Nessuna modifica fatta: questa è la prova a vuoto.");
  console.log(`  Per caricare davvero: npm run piano:carica -- "${file}"${suProva ? " --prova" : ""} --conferma`);
  process.exit(0);
}

// Su work, come `npm run migra`: niente senza una copia recente.
if (!suProva) {
  const motivo = backupTroppoVecchio(copiaPiuRecente(cfg.BACKUP_CARTELLA), new Date(), ORE_MASSIME_BACKUP);
  if (motivo) fermati("FERMO: non si tocca il gestionale vero senza una copia di sicurezza recente.", motivo, "Prima: npm run backup");
}

const cartella = mkdtempSync(path.join(tmpdir(), "borgo58-piano-"));
const sql = path.join(cartella, "carica.sql");
let esito;
try {
  writeFileSync(sql, sqlDelPiano(dati, dove), { encoding: "utf8", flag: "wx", mode: 0o600 });
  esito = esegui(strumento("psql"), ["-v", "ON_ERROR_STOP=1", "--single-transaction", "-d", url, "-f", sql], { silenzioso: true });
} finally {
  rmSync(cartella, { recursive: true, force: true });
}

// I messaggi di psql, senza mai la stringa di collegamento.
const righe = esito.uscita
  .split("\n")
  .filter((l) => /NOTICE|ERROR|ERRORE|FATAL|psql:/.test(l))
  .map((l) => `  ${l.replace(/:\/\/[^@\s]*@/g, "://…@")}`);
if (righe.length > 0) console.log(righe.join("\n"));
if (!esito.ok) fermati("Il caricamento si è fermato: il piano è rimasto com'era.");
console.log("");
console.log("  Caricato.");
