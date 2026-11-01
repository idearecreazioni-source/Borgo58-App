// LA COPIA DI SICUREZZA DI CASA — `npm run casa:copia`
//
// Pensata per partire da sola ogni giorno (attivita' di Windows «Casa -
// copia»), si lancia anche a mano. Non cancella niente di Casa: legge e basta.
//
// Una copia e' una cartella C:\Casa\copie\<data_ora> con dentro:
//  · database.dump — tutto il database (pg_dump, formato custom), compresi
//    utenti, Vault e i metadati dei file;
//  · file.tar     — i file caricati (foto degli scontrini, documenti);
//  · chiavi/      — la chiave di firma, la configurazione e la chiave che
//    cifra il Vault (pgsodium_root.key). ⚠️ Senza queste una copia del
//    database non si riapre su un altro PC: per questo stanno insieme.
//    ⚠️ Sono chiavi IN CHIARO: chi ha la cartella ha Casa. Il disco
//    esterno va tenuto come si tiene una chiave di casa (meglio cifrato,
//    con BitLocker To Go);
//  · copia.json   — cosa c'e' dentro e i conteggi verificati. Solo le
//    cartelle con copia.json sono copie buone.
//
// 🔴 OGNI COPIA SI RIAPRE PRIMA DI DIRLA BUONA: si ripristina in un
// database a parte (casa_copia_prova, nello stesso Postgres di Casa, poi
// cancellato) e si confronta il numero di righe di OGNI tabella di public
// e auth, e dei segreti del Vault che si leggono, con Casa. E la chiave del
// Vault copiata deve essere identica, byte per byte, a quella di Casa:
// riaprire nello stesso Postgres da solo non lo dimostrerebbe.
//
// ⚠️ I conteggi di Casa si leggono PRIMA e DOPO la copia: se sono diversi,
// Casa stava cambiando mentre si copiava, e la copia si rifa' (una volta).
//
// Se esiste C:\Casa\copia-esterna.txt con dentro una cartella (il disco
// esterno o la chiavetta, es. «E:\CopieCasa»), la copia va anche li'. Se
// quel disco non e' attaccato, lo si dice e la copia sul PC resta valida.
//
// Si tengono le ultime 14 copie sul PC e le ultime 30 sul disco esterno.

import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fermati, timbroLocale, titolo } from "./comune.mjs";
import { CARTELLA, CONTENITORE, docker, pretendiCasa, soloLErrore } from "./casa-comune.mjs";

const COPIE = path.join(CARTELLA, "copie");
const ESTERNA_TXT = path.join(CARTELLA, "copia-esterna.txt");
const TIENI_SUL_PC = 14;
const TIENI_FUORI = 30;
const CONTENITORE_FILE = "supabase_storage_casa";
const DB_DI_PROVA = "casa_copia_prova";
const DUMP_NEL_CONTENITORE = "/tmp/casa-copia.dump";
const CHIAVE_VAULT = "/etc/postgresql-custom/pgsodium_root.key";
const NOME_COPIA = /^\d{4}-\d{2}-\d{2}_\d{6}$/;

function annota(riga) {
  try {
    appendFileSync(path.join(CARTELLA, "copie.log"), `${new Date().toISOString()}  ${riga}\n`, "utf8");
  } catch {
    // Il registro e' un aiuto, non una condizione.
  }
}

// Quello che la copia lascia in giro mentre lavora: si toglie sempre, anche
// quando si ferma.
let inCorso = null;
function pulisci() {
  docker(["exec", CONTENITORE, "psql", "-U", "supabase_admin", "-d", "postgres", "-c", `drop database if exists ${DB_DI_PROVA} with (force)`]);
  docker(["exec", CONTENITORE, "rm", "-f", DUMP_NEL_CONTENITORE]);
  docker(["exec", CONTENITORE_FILE, "rm", "-f", "/tmp/casa-file.tar"]);
}

function fine(...righe) {
  annota(`FERMO: ${righe[0]}`);
  pulisci();
  if (inCorso) rmSync(inCorso, { recursive: true, force: true });
  fermati(...righe, "", "Questa copia non e' buona e l'ho tolta: le copie di prima restano.");
}

/** Esegue `comando` nel contenitore, o si ferma dicendo cosa non e' riuscito. */
function nelContenitore(contenitore, argomenti, descrizione) {
  const r = docker(["exec", contenitore, ...argomenti]);
  if (!r.ok) fine(`${descrizione} non e' riuscito:`, soloLErrore(r.uscita) || r.uscita.trim().slice(-400));
  return r.stdout;
}

const psqlAdmin = (db, sql, descrizione) =>
  nelContenitore(CONTENITORE, ["psql", "-U", "supabase_admin", "-d", db, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], descrizione);

// Il numero di righe di ogni tabella di public e auth, e dei segreti del
// Vault che si leggono, in una riga sola e in un ordine fisso.
const SQL_CONTEGGI =
  "select string_agg(table_schema || '.' || table_name || '=' || " +
  "(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text, ',' " +
  "order by table_schema, table_name) " +
  "|| ',vault.leggibili=' || (select count(*) from vault.decrypted_secrets where decrypted_secret is not null) " +
  "from information_schema.tables where table_schema in ('public', 'auth') and table_type = 'BASE TABLE'";

const impronta = (buf) => createHash("sha256").update(buf).digest("hex");

titolo("Copia di sicurezza di Casa");
pretendiCasa();
// I secondi nel nome: una copia a mano e una dell'attivita' nello stesso
// minuto non finiscono nella stessa cartella.
const nome = `${timbroLocale()}${String(new Date().getSeconds()).padStart(2, "0")}`;
const dove = path.join(COPIE, nome);
if (existsSync(dove)) fermati(`La cartella ${dove} c'e' gia': c'e' un'altra copia in corso?`);

// Le cartelle rimaste da una copia interrotta a meta' (PC spento, processo
// chiuso): senza copia.json non sono copie, e si tolgono.
mkdirSync(COPIE, { recursive: true });
for (const n of readdirSync(COPIE).filter((x) => NOME_COPIA.test(x))) {
  if (!existsSync(path.join(COPIE, n, "copia.json"))) rmSync(path.join(COPIE, n), { recursive: true, force: true });
}
mkdirSync(path.join(dove, "chiavi"), { recursive: true });
inCorso = dove;
pulisci();

// ---------------------------------------------------------------------
// 1. Il database — con i conteggi di Casa letti prima e dopo.
// ---------------------------------------------------------------------
let casa = "";
for (let tentativo = 1; ; tentativo++) {
  const prima = psqlAdmin("postgres", SQL_CONTEGGI, "La lettura di Casa");
  nelContenitore(CONTENITORE, ["pg_dump", "-U", "supabase_admin", "-d", "postgres", "-Fc", "-f", DUMP_NEL_CONTENITORE], "La copia del database");
  const dopo = psqlAdmin("postgres", SQL_CONTEGGI, "La lettura di Casa");
  if (prima === dopo) {
    casa = dopo;
    break;
  }
  if (tentativo === 2) fine("Casa stava cambiando mentre la copiavo, per due volte di fila.", "Riprova piu' tardi: npm run casa:copia");
  console.log("   Casa e' cambiata durante la copia: la rifaccio");
}
if (!docker(["cp", `${CONTENITORE}:${DUMP_NEL_CONTENITORE}`, path.join(dove, "database.dump")]).ok) fine("Non riesco a portare fuori la copia del database.");
console.log(`   database: ${Math.round(statSync(path.join(dove, "database.dump")).size / 1024)} KB`);

// ---------------------------------------------------------------------
// 2. I file caricati e le chiavi.
// ---------------------------------------------------------------------
nelContenitore(CONTENITORE_FILE, ["tar", "-cf", "/tmp/casa-file.tar", "-C", "/mnt", "."], "La copia dei file");
if (!docker(["cp", `${CONTENITORE_FILE}:/tmp/casa-file.tar`, path.join(dove, "file.tar")]).ok) fine("Non riesco a portare fuori la copia dei file.");
const nelTar = nelContenitore(CONTENITORE_FILE, ["tar", "-tf", "/tmp/casa-file.tar"], "La lettura dei file copiati")
  .split(/\r?\n/)
  .filter((r) => r && !r.endsWith("/")).length;
const oggetti = Number(psqlAdmin("postgres", "select count(*) from storage.objects", "Il conteggio dei file"));
console.log(`   file caricati: ${oggetti} registrati, ${nelTar} file copiati (${Math.round(statSync(path.join(dove, "file.tar")).size / 1024)} KB)`);
// ⚠️ Solo un avviso: il deposito puo' tenere piu' file per oggetto. Un
// numero di file minore degli oggetti registrati invece va guardato.
if (nelTar < oggetti) {
  console.log("   ⚠ ci sono meno file che oggetti registrati: guarda C:\\Casa\\copie.log");
  annota(`AVVISO ${nome}: ${oggetti} oggetti registrati, ${nelTar} file nel tar`);
}

for (const f of ["config.toml", "signing_keys.json"]) cpSync(path.join(CARTELLA, "supabase", f), path.join(dove, "chiavi", f));
const chiaveCopiata = path.join(dove, "chiavi", "pgsodium_root.key");
if (!docker(["cp", `${CONTENITORE}:${CHIAVE_VAULT}`, chiaveCopiata]).ok) fine("Non riesco a copiare la chiave del Vault.");
const improntaDiCasa = nelContenitore(CONTENITORE, ["sha256sum", CHIAVE_VAULT], "La lettura della chiave del Vault").split(/\s+/)[0];
const chiave = readFileSync(chiaveCopiata);
if (chiave.length === 0 || impronta(chiave) !== improntaDiCasa) fine("La chiave del Vault copiata non e' identica a quella di Casa.");
console.log("   chiavi: firma, configurazione, Vault (identica a quella di Casa)");

// ---------------------------------------------------------------------
// 3. La prova: la copia si riapre, e ogni tabella ha le righe di Casa.
// ---------------------------------------------------------------------
titolo("Riapro la copia in un database a parte");
psqlAdmin("postgres", `create database ${DB_DI_PROVA}`, "La creazione del database di prova");
// ⚠️ cron si crea solo nel database «postgres» (regola di pg_cron): nella
// prova si salta. I lavori pianificati di Casa sono comunque spenti.
const ripristino = docker(["exec", CONTENITORE, "pg_restore", "-U", "supabase_admin", "-d", DB_DI_PROVA, "--exclude-schema=cron", DUMP_NEL_CONTENITORE]);
const errori = ripristino.uscita
  .split(/\r?\n/)
  .filter((l) => /error:/.test(l))
  .filter((l) => !/pg_cron|can only create extension in database postgres/.test(l));
if (errori.length) fine(`La copia non si riapre: ${errori.length} errori.`, ...errori.slice(0, 5));
const copia = psqlAdmin(DB_DI_PROVA, SQL_CONTEGGI, "La lettura della copia");
if (copia !== casa) {
  const nellaCopia = copia.split(",");
  const diverse = casa.split(",").filter((t, i) => t !== nellaCopia[i]).slice(0, 5);
  fine("La copia riaperta non ha le stesse righe di Casa:", ...diverse);
}
pulisci();
const voci = casa.split(",");
const righe = voci.filter((v) => !v.startsWith("vault.")).reduce((s, t) => s + Number(t.split("=")[1] || 0), 0);
console.log(`   riaperta: ${voci.length - 1} tabelle, ${righe} righe e i segreti del Vault, identici a Casa`);

writeFileSync(
  path.join(dove, "copia.json"),
  JSON.stringify({ fatta: new Date().toISOString(), tabelle: voci.length - 1, righe, file: nelTar, oggetti, riaperta: true }, null, 2),
  "utf8"
);
inCorso = null;

// ---------------------------------------------------------------------
// 4. A rotazione sul PC, e sul disco esterno se c'e'.
// ---------------------------------------------------------------------
/** Tiene le ultime `quante` copie BUONE (con copia.json) di una cartella. */
function tieniLeUltime(cartella, quante) {
  const vecchie = readdirSync(cartella)
    .filter((n) => NOME_COPIA.test(n) && existsSync(path.join(cartella, n, "copia.json")))
    .sort()
    .slice(0, -quante);
  for (const n of vecchie) rmSync(path.join(cartella, n), { recursive: true, force: true });
  return vecchie.length;
}
const tolte = tieniLeUltime(COPIE, TIENI_SUL_PC);
console.log(`   sul PC: ${dove}${tolte ? ` (tolte ${tolte} copie vecchie)` : ""}`);

let fuori = "nessun disco esterno indicato";
if (existsSync(ESTERNA_TXT)) {
  // Senza BOM, virgolette o spazi: un percorso copiato da Esplora risorse
  // spesso li porta con se'.
  const esterna = readFileSync(ESTERNA_TXT, "utf8").replace(/^\uFEFF/, "").trim().replace(/^"(.*)"$/, "$1");
  if (!esterna) {
    fuori = `${ESTERNA_TXT} e' vuoto`;
  } else if (!existsSync(esterna)) {
    fuori = `il disco esterno (${esterna}) non e' attaccato: la copia e' solo sul PC`;
  } else {
    // Prima in una cartella provvisoria, poi il nome vero: un disco staccato
    // a meta' non lascia una copia monca col nome di una copia buona.
    const provvisoria = path.join(esterna, `${nome}.in-corso`);
    try {
      cpSync(dove, provvisoria, { recursive: true });
      renameSync(provvisoria, path.join(esterna, nome));
      tieniLeUltime(esterna, TIENI_FUORI);
      fuori = `anche su ${path.join(esterna, nome)}`;
    } catch (e) {
      rmSync(provvisoria, { recursive: true, force: true });
      fuori = `la copia sul disco esterno NON e' riuscita (${e.code || e.message}): c'e' solo quella sul PC`;
    }
  }
}
console.log(`   fuori dal PC: ${fuori}`);
annota(`ok: ${nome}, ${voci.length - 1} tabelle, ${righe} righe, ${nelTar} file; fuori: ${fuori}`);
console.log("");
console.log("Copia fatta e riaperta.");
