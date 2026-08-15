// Attrezzi condivisi dai comandi di copia, ricostruzione e confronto.
//
// Regola non negoziabile di questo file: NESSUNA credenziale nel
// repository. Tutto viene letto da `.env.db`, che vive solo sul PC di
// Alessio ed e' escluso da git (.gitignore copre `.env.*`).
//
// Seconda regola: i comandi che scrivono o cancellano puntano SOLO al
// progetto di prova. Il controllo non e' una raccomandazione scritta in
// un documento — e' la funzione `soloProva()` qui sotto, che ferma il
// programma se nella stringa di collegamento compare il progetto vero.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

/** Il progetto di produzione. Se compare dove non deve, si interrompe tutto. */
export const REF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";

/**
 * Il progetto di prova, usa-e-getta e ricostruibile da zero.
 * Serve a installarci le funzioni online PRIMA della produzione: senza,
 * un'operazione nuova del corridoio potrebbe arrivare in produzione senza
 * essere mai stata esercitata da nessuna prova automatica.
 */
export const REF_PROVA = "bnwqgpuyzmzujxfbtyvs";

export function leggiConfigurazione(file = ".env.db") {
  if (!existsSync(file)) {
    fermati(
      `Manca il file ${file}.`,
      "Copia `.env.db.example` in `.env.db` e completalo seguendo docs/BACKUP.md."
    );
  }
  const out = {};
  for (const riga of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function obbligatorio(config, nome, aiuto) {
  const v = config[nome];
  if (!v) fermati(`Manca ${nome} nel file .env.db.`, aiuto);
  return v;
}

/**
 * Barriera di sicurezza: usata da ogni comando che SCRIVE.
 * Un errore di copia-incolla nella stringa di collegamento non deve
 * poter riscrivere il database vero.
 */
export function soloProva(url) {
  if (url.includes(REF_PRODUZIONE)) {
    fermati(
      "FERMO: questa stringa di collegamento punta al database VERO.",
      "I comandi di ricostruzione e ripristino lavorano solo sul progetto di prova.",
      "Controlla DB_URL_PROVA in .env.db."
    );
  }
  return url;
}

/**
 * Trova pg_dump/psql: prima nel PATH, poi nelle cartelle standard di
 * PostgreSQL su Windows (l'installazione non aggiunge il PATH da sola).
 */
export function strumento(nome) {
  const eseguibile = process.platform === "win32" ? `${nome}.exe` : nome;
  if (spawnSync(eseguibile, ["--version"], { encoding: "utf8" }).status === 0) return eseguibile;

  for (const base of ["C:/Program Files/PostgreSQL", "C:/Program Files (x86)/PostgreSQL"]) {
    if (!existsSync(base)) continue;
    const versioni = readdirSync(base).sort().reverse();
    for (const v of versioni) {
      const candidato = path.join(base, v, "bin", eseguibile);
      if (existsSync(candidato)) return candidato;
    }
  }

  fermati(
    `Non trovo ${nome} su questo computer.`,
    "Vanno installati una volta sola gli strumenti a riga di comando di PostgreSQL 17:",
    "le istruzioni passo passo sono in docs/BACKUP.md, paragrafo 1."
  );
}

/**
 * Esegue un programma mostrandone l'uscita. Restituisce true se e' andato
 * bene.
 *
 * `opzioni.shell` serve su Windows per i comandi che non sono veri
 * eseguibili ma file `.cmd` — `npx` e' uno di questi. Da Node 24 un
 * `.cmd` non si avvia piu' senza shell e l'errore che si vede e'
 * `ENOENT`, cioe' "non trovo il programma": indistinguibile da "non e'
 * installato". Trovato il 13/08/2026, quando l'installazione di una
 * funzione online falliva dando la colpa alla chiave d'accesso.
 *
 * `errore` distingue "non sono riuscito ad AVVIARE il programma" da "il
 * programma ha risposto male": sono due guasti diversi e mandano a
 * cercare in due posti diversi.
 */
export function esegui(programma, argomenti, opzioni = {}) {
  const r = spawnSync(programma, argomenti, {
    stdio: opzioni.silenzioso ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: opzioni.shell === true,
    env: { ...process.env, PGCLIENTENCODING: "UTF8", ...(opzioni.env || {}) },
  });
  const errore = r.error ? r.error.code || String(r.error.message) : null;
  if (opzioni.silenzioso) {
    return { ok: r.status === 0, uscita: (r.stdout || "") + (r.stderr || ""), errore };
  }
  return { ok: r.status === 0, uscita: "", errore };
}

/** Interroga un database e restituisce il risultato come testo grezzo. */
export function interroga(url, sql) {
  const psql = strumento("psql");
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-A", "-t", "-d", url, "-c", sql], {
    silenzioso: true,
  });
  if (!r.ok) fermati("Il database non ha risposto:", r.uscita.trim());
  return r.uscita.trim();
}

export function fermati(...righe) {
  console.error("");
  for (const r of righe) console.error(`  ${r}`);
  console.error("");
  process.exit(1);
}

export function titolo(testo) {
  console.log("");
  console.log(`── ${testo}`);
}

/** Data e ora locali in formato ordinabile, per i nomi delle cartelle. */
export function timbroLocale() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
