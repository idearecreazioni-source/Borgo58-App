// COPIA DI SICUREZZA del database vero — `npm run backup`
//
// Perche' esiste: il piano gratuito di Supabase NON fa nessun backup
// automatico. Oggi i dati del locale vivono in un posto solo. Questo
// comando ne porta fuori una copia completa, su questo computer.
//
// Cosa salva, in una cartella datata:
//   01_schema.sql   la forma del database (tabelle, regole, permessi)
//   02_dati.sql     il contenuto delle tabelle dell'app
//   03_accessi.sql  gli utenti che entrano nell'app
//   04_archivio.sql l'elenco dei documenti caricati
//   file/           i documenti veri e propri (PDF, foto): NON sono
//                   dentro il database, e un backup che li dimentica
//                   sembra completo senza esserlo
//   06_estensioni.sql le estensioni del motore: senza, alcuni vincoli non
//                   si ricreano e il ripristino non lo dice
//   05_conteggi.txt quante righe c'era in ogni tabella al momento della
//                   copia — serve a dimostrare che un ripristino ha
//                   davvero rimesso tutto
//
// Sola lettura sul database vero: non scrive nulla, non cancella nulla.

import { mkdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import {
  leggiConfigurazione,
  obbligatorio,
  strumento,
  esegui,
  interroga,
  fermati,
  titolo,
  timbroLocale,
} from "./comune.mjs";

const SQL_CONTEGGI = `
select relname || ' = ' || (xpath('/row/c/text()', xml_count))[1]::text as riga
from (
  select c.relname,
         query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '') as xml_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
) s
order by relname;
`;

const config = leggiConfigurazione();
const url = obbligatorio(config, "DB_URL_PRODUZIONE", "E' la stringa 'Session pooler' del progetto vero (docs/BACKUP.md).");
const pgDump = strumento("pg_dump");

const radice = config.BACKUP_CARTELLA || path.join(os.homedir(), "Desktop", "Backup Borgo 58");
const cartella = path.join(radice, timbroLocale());
mkdirSync(cartella, { recursive: true });

console.log(`Copia di sicurezza in corso.`);
console.log(`Cartella: ${cartella}`);

function dump(nomeFile, argomenti, descrizione) {
  titolo(descrizione);
  const destinazione = path.join(cartella, nomeFile);
  const r = esegui(pgDump, [...argomenti, "--no-owner", "-f", destinazione, "-d", url], {
    silenzioso: true,
  });
  if (!r.ok) {
    fermati(`Non sono riuscito a salvare ${nomeFile}.`, r.uscita.trim());
  }
  const kb = Math.round(statSync(destinazione).size / 1024);
  if (kb === 0) fermati(`${nomeFile} e' vuoto: la copia NON e' valida.`);
  console.log(`   ${nomeFile} — ${kb} KB`);
}

dump("01_schema.sql", ["--schema-only", "--schema=public"], "Forma del database");
// I controlli si spengono al RIPRISTINO, non qui (vedi prova-ripristina):
// `--disable-triggers` produrrebbe comandi che su Supabase nessuno ha il
// diritto di eseguire, perché toccano i trigger di sistema.
dump("02_dati.sql", ["--data-only", "--schema=public"], "Contenuto delle tabelle");
dump(
  "03_accessi.sql",
  ["--data-only", "--table=auth.users", "--table=auth.identities"],
  "Utenti che entrano nell'app"
);
dump(
  "04_archivio.sql",
  ["--data-only", "--table=storage.buckets", "--table=storage.objects"],
  "Elenco dei documenti caricati"
);

// 🔴 LE ESTENSIONI DEL MOTORE, che fino al 23/08 NON erano nella copia.
//
// La copia si prende con `--schema=public`, e le estensioni vivono altrove
// (`extensions`, `pg_catalog`, `vault`): non ci finivano dentro. Sembrava un
// dettaglio da rimontare a mano — la prova di ripristino del 23/08 ha
// mostrato che non lo e'.
//
// ⚠️ IL CASO MISURATO: senza `btree_gist` il vincolo
// `employee_leaves_niente_sovrapposizioni` **non si ricrea**, e il
// ripristino non da' nessun errore sui dati. Si tornerebbe in piedi con un
// database che accetta due periodi di ferie sovrapposti sullo stesso
// dipendente — cioe' una regola sparita in silenzio. E' la famiglia del §8:
// piu' corto, con l'aria di essere intero.
titolo("Le estensioni del motore");
const estensioni = interroga(
  url,
  `select 'create extension if not exists "' || e.extname || '" with schema ' ||
          quote_ident(n.nspname) || ';'
     from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname <> 'plpgsql'
    order by e.extname;`
);
writeFileSync(
  path.join(cartella, "06_estensioni.sql"),
  "-- Da eseguire PRIMA di 01_schema.sql su un progetto nuovo.\n" +
    "-- Senza queste, alcuni vincoli non si ricreano e nessuno lo dice.\n" +
    estensioni + "\n",
  "utf8"
);
console.log(`   ${estensioni.split("\n").filter(Boolean).length} estensioni`);

titolo("Conteggio delle righe, tabella per tabella");
const conteggi = interroga(url, SQL_CONTEGGI);
writeFileSync(path.join(cartella, "05_conteggi.txt"), conteggi + "\n", "utf8");
const righeTotali = conteggi
  .split("\n")
  .map((r) => Number(r.split(" = ")[1] || 0))
  .reduce((a, b) => a + b, 0);
console.log(`   ${conteggi.split("\n").length} tabelle, ${righeTotali} righe in tutto`);

// ---------------------------------------------------------------------
// I documenti veri (Archivio Documenti). Vivono fuori dal database.
// ---------------------------------------------------------------------
const service = config.SERVICE_ROLE_PRODUZIONE;
const urlApi = config.SUPABASE_URL_PRODUZIONE;
if (!service || !urlApi) {
  console.log("");
  console.log("  ATTENZIONE: i documenti caricati (PDF, foto) NON sono stati copiati.");
  console.log("  Mancano SUPABASE_URL_PRODUZIONE e SERVICE_ROLE_PRODUZIONE in .env.db.");
} else {
  titolo("Documenti caricati");
  const sb = createClient(urlApi, service, { auth: { persistSession: false } });
  const { data: buckets, error: e1 } = await sb.storage.listBuckets();
  if (e1) fermati("Non riesco a leggere l'archivio documenti:", e1.message);

  let quanti = 0;
  for (const bucket of buckets) {
    for (const oggetto of await elenca(sb, bucket.name, "")) {
      const { data, error } = await sb.storage.from(bucket.name).download(oggetto);
      if (error) fermati(`Non riesco a scaricare ${bucket.name}/${oggetto}:`, error.message);
      const destinazione = path.join(cartella, "file", bucket.name, oggetto);
      mkdirSync(path.dirname(destinazione), { recursive: true });
      writeFileSync(destinazione, Buffer.from(await data.arrayBuffer()));
      quanti++;
    }
  }
  console.log(`   ${quanti} documenti salvati in file/`);
}

async function elenca(sb, bucket, prefisso) {
  const { data, error } = await sb.storage.from(bucket).list(prefisso, { limit: 1000 });
  if (error) fermati(`Non riesco a elencare ${bucket}/${prefisso}:`, error.message);
  const trovati = [];
  for (const voce of data) {
    const completo = prefisso ? `${prefisso}/${voce.name}` : voce.name;
    // Una "cartella" non ha metadati: si riconosce cosi'.
    if (voce.id === null) trovati.push(...(await elenca(sb, bucket, completo)));
    else trovati.push(completo);
  }
  return trovati;
}

writeFileSync(
  path.join(cartella, "LEGGIMI.txt"),
  [
    `Copia di sicurezza Borgo 58 — ${new Date().toLocaleString("it-IT")}`,
    "",
    "Questa cartella contiene tutto il database del gestionale.",
    "Va tenuta anche FUORI da questo computer: una copia su chiavetta o",
    "sul cloud personale. Un backup che vive solo qui non protegge da un",
    "guasto del computer.",
    "",
    "Per rimettere in piedi i dati serve il documento docs/BACKUP.md del",
    "progetto, paragrafo 4.",
    "",
    `Righe salvate in tutto: ${righeTotali}`,
  ].join("\n"),
  "utf8"
);

// ---------------------------------------------------------------------
// UN FILE SOLO — chiesto da Alessio il 23/08.
// ---------------------------------------------------------------------
// «Un passaggio a mano in meno e' un passaggio in meno che si dimentica»:
// la cartella resta (serve a `npm run backup:verifica` e alla prova di
// ripristino), ma accanto nasce lo zip, che e' quello che si porta via.
//
// ⚠️ Se lo zip non riesce, la copia NON e' persa: la cartella c'e' e il
// comando lo dice. Un guasto qui non deve far sembrare fallito un backup
// riuscito.
titolo("Un file solo da portare via");
const zip = path.join(radice, `Borgo58_backup_${path.basename(cartella)}.zip`);
const fattoZip = esegui(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${cartella.replace(/'/g, "''")}\\*' -DestinationPath '${zip.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`,
  ],
  { silenzioso: true }
);
if (fattoZip.ok && existsSync(zip)) {
  console.log(`   ${zip}`);
  console.log(`   ${Math.round(statSync(zip).size / 1024)} KB — e' questo il file da copiare fuori`);
} else {
  console.log("   ATTENZIONE: non sono riuscito a fare lo zip.");
  console.log(`   La copia pero' c'e' tutta, nella cartella: ${cartella}`);
  if (fattoZip.uscita) console.log("   " + fattoZip.uscita.trim().split("\n")[0]);
}

console.log("");
console.log("Copia completata.");
console.log("");
console.log("  ORA COPIA QUESTA CARTELLA FUORI DAL COMPUTER");
console.log("  (chiavetta USB, disco esterno o cloud personale).");
console.log("");

if (!existsSync(path.join(cartella, "02_dati.sql"))) fermati("Copia incompleta.");
