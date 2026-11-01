// AGGIORNARE CASA — `npm run casa:aggiorna` (01/11/2026)
//
// Porta Casa all'ultima `slave`, sempre con gli stessi passi (decisione di
// Alessio del 01/11: Casa segue slave, e ogni aggiornamento passa di qui):
//  1. controlla che sia Casa, e che la sua cartella del gestionale sia
//     pulita (niente modifiche a mano da perdere);
//  2. legge cosa arriva e lo dice PRIMA di toccare niente: le PR, le
//     migrazioni, e cosa su Casa non funzionera' (casa-differenze.mjs);
//  3. fa la copia di sicurezza (casa:copia, che la riapre per provarla);
//  4. porta il codice avanti (solo fast-forward), npm ci se serve;
//  5. applica le migrazioni nuove, una per una, e spegne i lavori
//     pianificati che una migrazione avesse riacceso;
//  6. riaccende (casa:accendi: funzioni, porte), ricostruisce l'app
//     (casa:impacchetta) e verifica (casa:verifica);
//  7. una prova veloce: l'app risponde e la funzione di Casa c'e'.
//
// ⚠️ Si lancia da C:\Casa\gestionale, la copia del gestionale da cui Casa
//    si accende. Mai da un'altra cartella: aggiornerebbe quella.
// ⚠️ Se si ferma a meta' (passo 5 o dopo), Casa si rimette com'era con la
//    copia del passo 3: il percorso e' scritto nel messaggio.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { argomentiMigrazione, fermati, titolo } from "./comune.mjs";
import {
  CARTELLA,
  FUNZIONI_DI_CASA,
  URL_CASA,
  indirizzoDiCasa,
  pretendiCasa,
  psql,
  soloLErrore,
  sql,
} from "./casa-comune.mjs";
import { differenzePerCasa, righeAggiunte, titoliDellePr } from "./casa-differenze.mjs";

const GESTIONALE = path.resolve(`${CARTELLA}/gestionale`);
const RAMO = "origin/slave";

function git(...argomenti) {
  // quotepath=false: un percorso con lettere accentate resta leggibile, non fra virgolette.
  const r = spawnSync("git", ["-c", "core.quotepath=false", ...argomenti], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) fermati(`git ${argomenti.join(" ")} non e' riuscito:`, (r.stderr || r.stdout || "").trim());
  return r.stdout;
}

function npm(comando, descrizione) {
  console.log(`\n   → npm run ${comando}`);
  const r = spawnSync("npm", ["run", "-s", comando], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) fermati(`${descrizione} non e' riuscito (npm run ${comando}).`, ...seSiFerma());
}

// ⚠️ La copia rimette il DATABASE; il codice si rimette a parte, al punto
//    di partenza: insieme, o Casa resta con codice nuovo e dati vecchi
//    (revisione ecc:security-reviewer, 01/11/2026).
let copia = null;
let partenza = null;
const seSiFerma = () =>
  copia
    ? [
        "",
        "Casa si rimette com'era in due passi, insieme (chiedi a Claude: non farlo a mano):",
        `  · il database, dalla copia fatta prima: ${copia}`,
        `  · il codice, al punto di partenza: git reset --hard ${partenza}`,
        "Non rilanciare l'aggiornamento sopra: una migrazione fermata puo' essere rimasta a meta'.",
      ]
    : [];

// --- 1. E' Casa, e la cartella e' pulita ---------------------------------
titolo("Controllo che sia Casa");
if (path.resolve(process.cwd()) !== GESTIONALE) {
  fermati(`FERMO: si lancia da ${GESTIONALE}, la copia del gestionale da cui Casa si accende.`, `Adesso sono in ${process.cwd()}.`);
}
pretendiCasa();
if (git("status", "--porcelain").trim()) {
  fermati("FERMO: nella cartella del gestionale di Casa ci sono modifiche non salvate.", "Non aggiorno sopra: si perderebbero.");
}
console.log("   e' Casa, e la cartella del gestionale e' pulita");

// --- 2. Cosa arriva -------------------------------------------------------
titolo("Guardo cosa arriva");
git("fetch", "--quiet", "origin", "slave");
partenza = git("rev-parse", "HEAD").trim();
const prima = partenza.slice(0, 8);
const dopo = git("rev-parse", "--short", RAMO).trim();
// ⚠️ Solo avanti: se Casa avesse commit che slave non ha, un merge li
//    mescolerebbe in silenzio.
if (spawnSync("git", ["merge-base", "--is-ancestor", "HEAD", RAMO]).status !== 0) {
  fermati(`FERMO: Casa (${prima}) non e' un antenato di slave (${dopo}): non si porta avanti e basta.`);
}

const registrate = new Set(
  sql("select coalesce(string_agg(version, ' '), '') from applied_migrations;", "La lettura del registro").split(/\s+/).filter(Boolean),
);
const fileCambiati = git("diff", "--name-only", `HEAD..${RAMO}`).split(/\r?\n/).filter(Boolean);
const elencoMigrazioni = git("ls-tree", "--name-only", `${RAMO}`, "supabase/migrations/")
  .split(/\r?\n/)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => path.basename(f))
  .sort();
// La versione finisce in una SQL: solo nomi della forma delle migrazioni.
const strane = elencoMigrazioni.filter((f) => !/^\d{14}_[A-Za-z0-9_.-]+\.sql$/.test(f));
if (strane.length) fermati("FERMO: in supabase/migrations ci sono file con un nome che non e' da migrazione:", ...strane);
const daApplicare = elencoMigrazioni.filter((f) => !registrate.has(f.slice(0, 14)));
const migrazioniNuove = daApplicare.map((nome) => ({ nome, testo: git("show", `${RAMO}:supabase/migrations/${nome}`) }));
const differenze = differenzePerCasa({
  file: fileCambiati,
  fileNuovi: git("diff", "--name-only", "--diff-filter=A", `HEAD..${RAMO}`).split(/\r?\n/).filter(Boolean),
  aggiunte: righeAggiunte(git("diff", "--unified=0", `HEAD..${RAMO}`, "--", "src")),
  migrazioniNuove,
  funzioniDiCasa: FUNZIONI_DI_CASA,
});
const pr = titoliDellePr(git("log", "--merges", "--first-parent", "--format=%s%x1f%b%x1e", `HEAD..${RAMO}`));

if (prima === dopo && !daApplicare.length) {
  console.log(`   Casa e' gia' all'ultima slave (${dopo}): niente da aggiornare. Faccio solo la verifica.`);
  npm("casa:verifica", "La verifica di Casa");
  process.exit(0);
}
console.log(`   da ${prima} a ${dopo}`);
console.log(`   PR unite: ${pr.length ? "" : "nessuna"}`);
for (const p of pr) console.log(`     · ${p}`);
console.log(`   migrazioni nuove: ${differenze.migrazioni.length ? differenze.migrazioni.join(", ") : "nessuna"}`);
if (differenze.funzioniDaRiavviare.length) console.log(`   funzioni di Casa cambiate: ${differenze.funzioniDaRiavviare.join(", ")}`);
if (differenze.avvisi.length) {
  console.log("   ⚠️ su Casa non funzionera' tutto:");
  for (const a of differenze.avvisi) console.log(`     · ${a}`);
} else {
  console.log("   niente che su Casa resti spento");
}

// --- 3. La copia di sicurezza ---------------------------------------------
titolo("Faccio la copia di sicurezza");
// Solo le cartelle con copia.json sono copie buone (casa-copia.mjs), e deve
// essere NUOVA: una copia vecchia non salva quello che e' entrato dopo.
const COPIE = path.join(CARTELLA, "copie");
const copieBuone = () =>
  existsSync(COPIE) ? readdirSync(COPIE).filter((d) => existsSync(path.join(COPIE, d, "copia.json"))) : [];
const giaFatte = new Set(copieBuone());
npm("casa:copia", "La copia di sicurezza");
const nuove = copieBuone().filter((d) => !giaFatte.has(d)).sort();
if (nuove.length !== 1) fermati("FERMO: non trovo la copia di sicurezza appena fatta: non aggiorno senza.");
copia = path.join(COPIE, nuove[0]);
console.log(`   copia: ${copia}`);

// --- 4. Il codice -----------------------------------------------------------
titolo("Porto avanti il codice");
git("merge", "--ff-only", "--quiet", RAMO);
console.log(`   codice a ${dopo}`);
if (differenze.npmCi) {
  console.log("   le librerie sono cambiate: npm ci");
  const r = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) fermati("npm ci non e' riuscito.", ...seSiFerma());
}

// --- 5. Le migrazioni -------------------------------------------------------
titolo(`Applico ${daApplicare.length} migrazioni nuove`);
for (const nome of daApplicare) {
  const percorso = path.join("supabase/migrations", nome);
  const { atomica } = argomentiMigrazione(URL_CASA, percorso);
  const r = psql(readFileSync(percorso, "utf8").replace(/\r\n/g, "\n"), { atomica });
  if (!r.ok) fermati(`La migrazione ${nome} si e' fermata:`, soloLErrore(r.uscita), ...seSiFerma());
  const versione = nome.slice(0, 14);
  const registro = psql(`select count(*) from applied_migrations where version = '${versione}';`);
  if (!registro.ok || registro.stdout !== "1") {
    fermati(`La migrazione ${nome} e' passata ma non si e' registrata.`, ...seSiFerma());
  }
  console.log(`   ok   ${nome}`);
}
// Una migrazione puo' programmare o riaccendere un lavoro: su Casa restano spenti.
const spenti = psql("select cron.alter_job(jobid, active := false) from cron.job where active;");
if (!spenti.ok) fermati("Lo spegnimento dei lavori pianificati non e' riuscito:", soloLErrore(spenti.uscita), ...seSiFerma());

// --- 6. Riaccendo, ricostruisco, verifico ------------------------------------
titolo("Riaccendo, ricostruisco e verifico");
npm("casa:accendi", "La riaccensione di Casa");
npm("casa:impacchetta", "La ricostruzione dell'app");
npm("casa:verifica", "La verifica di Casa");

// --- 7. Prova veloce ---------------------------------------------------------
titolo("Prova veloce");
const indirizzo = indirizzoDiCasa();
const prove = [
  ["l'app", `${indirizzo}/`, (s) => s === 200],
  // Senza accesso la funzione risponde 401: vuol dire che c'e'. 404 vuol dire spenta.
  ["la funzione operazioni-atomiche", `${indirizzo}/functions/v1/operazioni-atomiche`, (s) => s !== 404 && s < 500],
];
const mancate = [];
for (const [cosa, url, buona] of prove) {
  const stato = await fetch(url, { method: cosa === "l'app" ? "GET" : "POST" }).then((r) => r.status, () => 0);
  console.log(`   ${buona(stato) ? "ok  " : "NO  "} ${cosa} (${stato || "non risponde"})`);
  if (!buona(stato)) mancate.push(cosa);
}
if (mancate.length) fermati(`Casa e' aggiornata ma non risponde bene: ${mancate.join(", ")}.`, ...seSiFerma());

// --- Il riassunto per Alessio -------------------------------------------------
titolo("Fatto");
console.log(`   Casa aggiornata a ${dopo}: ${pr.length} PR, ${daApplicare.length} migrazioni, verifica verde.`);
console.log(
  differenze.avvisi.length
    ? `   Da sapere: ${differenze.avvisi.length} cose su Casa restano spente (elenco sopra). Sull'iPhone chiudi e riapri Casa.`
    : "   Niente resta spento. Sull'iPhone chiudi e riapri Casa per avere la versione nuova.",
);
