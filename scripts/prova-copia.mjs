// LA COPIA DELLO SCENARIO — `npm run prova:copia` e `npm run prova:rimetti`
//
// 🔴 PERCHE' ESISTE, e viene da un vincolo del mandato del 23/08/2026.
//
// Lo scenario di collaudo e' passato da 52 conti a ~330: due mesi veri, con
// le bevande, i turni, gli scontrini e la merce che arriva ogni settimana.
// Costruirlo richiede molti minuti — e **un comando da un quarto d'ora si
// smette di rilanciare**, proprio nel momento in cui servirebbe: quando il
// collaudo ha rotto qualcosa e bisogna ripartire puliti.
//
// La cura NON e' rimpicciolire i dati (era la strada di ieri, e il mandato
// la esclude): e' **non rigenerarli**. Si genera una volta, si porta via una
// copia, e da li' in poi «rimettere lo scenario» e' un ripristino.
//
//   npm run prova:scenario   costruisce da zero (lento) e salva la copia
//   npm run prova:rimetti    rimette la copia (veloce)
//
// ⚠️ IL RIPRISTINO NON E' RISCRITTO QUI. Lo fa `prova-ripristina.mjs`, che
// esiste dal 10/08 ed e' l'unica procedura di ripristino provata di questo
// progetto: riscriverne una seconda vorrebbe dire tenerne allineate due, e
// la copia che conta e' proprio quella che nessuno vuole scoprire rotta nel
// giorno peggiore. Qui si chiama quella, passandole la cartella.
//
// Non tocca MAI il database vero: legge e scrive solo dove punta
// DB_URL_PROVA, e `soloProva()` interrompe il programma se quella stringa
// fosse quella di produzione.

import { mkdirSync, statSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  strumento,
  esegui,
  interroga,
  fermati,
  titolo,
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

/** Dove vive la copia dello scenario. Una sola, sempre la stessa. */
export function cartellaDelloScenario(config = leggiConfigurazione()) {
  const radice = config.BACKUP_CARTELLA || path.join(os.homedir(), "Desktop", "Backup Borgo 58");
  return path.join(radice, "Scenario di collaudo (progetto di prova)");
}

/**
 * Porta via una copia del progetto di prova cosi' com'e' adesso.
 *
 * ⚠️ La copia si rifa' **intera** ogni volta: una cartella mezza vecchia e
 * mezza nuova e' peggio di nessuna copia, perche' il ripristino
 * funzionerebbe e rimetterebbe uno stato che non e' mai esistito.
 */
export function copiaLoScenario({ silenzioso = false } = {}) {
  const config = leggiConfigurazione();
  const url = soloProva(
    obbligatorio(config, "DB_URL_PROVA", "E' la stringa 'Session pooler' del progetto Borgo58-Prova.")
  );
  const pgDump = strumento("pg_dump");
  const cartella = cartellaDelloScenario(config);

  if (!silenzioso) titolo("Porto via la copia dello scenario");
  if (existsSync(cartella)) rmSync(cartella, { recursive: true, force: true });
  mkdirSync(cartella, { recursive: true });

  const dump = (nomeFile, argomenti) => {
    const destinazione = path.join(cartella, nomeFile);
    const r = esegui(pgDump, [...argomenti, "--no-owner", "-f", destinazione, "-d", url], {
      silenzioso: true,
    });
    if (!r.ok) fermati(`Non sono riuscito a salvare ${nomeFile}.`, r.uscita.trim());
    const kb = Math.round(statSync(destinazione).size / 1024);
    if (kb === 0) fermati(`${nomeFile} e' vuoto: la copia NON e' valida.`);
    if (!silenzioso) console.log(`   ${nomeFile} — ${kb} KB`);
  };

  dump("01_schema.sql", ["--schema-only", "--schema=public"]);
  dump("02_dati.sql", ["--data-only", "--schema=public"]);
  // ⚠️ Gli accessi servono: i dati sono agganciati a chi li ha scritti (chi
  // ha chiuso un conto, chi ha registrato un incasso). Senza gli utenti, il
  // ripristino si ferma a meta' — scoperto ripristinando davvero, il 10/08.
  dump("03_accessi.sql", ["--data-only", "--table=auth.users", "--table=auth.identities"]);

  // ⚠️ LA COPIA DICHIARA DA DOVE VIENE, e non e' una decorazione: il
  // comando di ripristino e' lo stesso che rimette una copia di sicurezza
  // del database VERO, e alla fine avvisava sempre «adesso il progetto di
  // prova contiene i dati veri dei clienti». Rimettendo lo scenario quella
  // frase e' falsa, e manda a rifare da zero un database che sta benissimo.
  // Con questo file, a decidere cosa dire e' la copia.
  writeFileSync(
    path.join(cartella, "00_origine.txt"),
    [
      "scenario di collaudo — copia del progetto di PROVA, dati finti",
      "Si rimette con: npm run prova:rimetti",
      "",
    ].join("\n"),
    "utf8"
  );

  // I conteggi: sono quelli che trasformano «ho un file» in «ho una copia».
  // Il ripristino li riconfronta riga per riga.
  const conteggi = interroga(url, SQL_CONTEGGI);
  writeFileSync(path.join(cartella, "05_conteggi.txt"), conteggi + "\n", "utf8");
  const righe = conteggi.split(/\r?\n/).filter(Boolean).length;
  if (!silenzioso) {
    console.log(`   05_conteggi.txt — ${righe} tabelle contate`);
    console.log(`   cartella: ${cartella}`);
  }
  return cartella;
}

/**
 * Rimette la copia. Chiama il comando di ripristino gia' esistente: e' la
 * stessa procedura che dimostra che una copia di sicurezza funziona.
 */
function rimettiLoScenario() {
  const cartella = cartellaDelloScenario();
  if (!existsSync(path.join(cartella, "02_dati.sql"))) {
    fermati(
      "Non c'e' nessuna copia dello scenario da rimettere.",
      `Cercata in: ${cartella}`,
      "Si crea costruendo lo scenario:  npm run prova:scenario",
      "(oppure, se lo scenario e' gia' in piedi:  npm run prova:copia)"
    );
  }
  titolo("Rimetto lo scenario dalla copia");
  console.log(`   copia: ${cartella}`);
  const r = esegui(process.execPath, ["scripts/prova-ripristina.mjs", cartella], {});
  if (!r.ok) {
    fermati(
      "Il ripristino non e' riuscito.",
      "La copia potrebbe essere vecchia rispetto alle migrazioni applicate dopo:",
      "in quel caso si ricostruisce da zero con  npm run prova:scenario"
    );
  }
}

// --- che cosa fare -------------------------------------------------------
const soloSeChiamatoDaRigaDiComando = process.argv[1]?.includes("prova-copia");
if (soloSeChiamatoDaRigaDiComando) {
  if (process.argv.includes("--rimetti")) {
    rimettiLoScenario();
  } else {
    copiaLoScenario();
    console.log("");
    console.log("   Da adesso, per rimettere il gestionale di prova com'e' ora:");
    console.log("   npm run prova:rimetti");
    console.log("");
  }
}
