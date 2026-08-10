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

console.log("");
console.log("Copia completata.");
console.log("");
console.log("  ORA COPIA QUESTA CARTELLA FUORI DAL COMPUTER");
console.log("  (chiavetta USB, disco esterno o cloud personale).");
console.log("");

if (!existsSync(path.join(cartella, "02_dati.sql"))) fermati("Copia incompleta.");
