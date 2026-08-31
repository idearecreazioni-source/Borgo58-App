// Stampa il corpo VIVO di una funzione del database, com'è adesso.
//
// 🔴 PERCHÉ ESISTE. Dal 18/08/2026 vale una regola nata da un difetto vero:
// **una funzione si riscrive dal DATABASE, mai dal file che l'ha creata** —
// fra i due ci stanno tutte le migrazioni che l'hanno toccata dopo, e
// ricopiare dall'originale le annulla in silenzio. Quel giorno erano sparite
// una colonna (che ha fatto fallire subito) e il battito di una sentinella
// (che sarebbe passato verde, annunciando ogni quarto d'ora un guasto
// inesistente).
//
// Finché quel gesto è stato «apri il connettore e scrivi una query a mano»,
// era disciplina. Questo comando lo rende un gesto solo — *l'automazione non
// si degrada, la disciplina sì*.
//
//   npm run funzione:viva -- esegui_azione_posta
//   npm run funzione:viva -- esegui_azione_posta > pezzo.sql
//   npm run funzione:viva -- lista_spesa --prova
//
// ⚠️ LEGGE LA PRODUZIONE, non il progetto di prova, e non è un dettaglio: la
// regola parla di ciò che è VIVO. Se i due database divergessero, il file
// giusto da cui ripartire è quello che gira sui dati veri. Con `--prova` si
// legge l'altro, e serve a confrontarli.
//
// ⚠️ SOLO LETTURA: una `select`, niente altro.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fermati, strumento } from "./comune.mjs";

const argomenti = process.argv.slice(2);
const nome = argomenti.find((a) => !a.startsWith("--"));
const prova = argomenti.includes("--prova");

if (!nome) {
  fermati(
    "Manca il nome della funzione.",
    "Esempio:  npm run funzione:viva -- esegui_azione_posta",
    "Con --prova si legge il progetto di prova invece della produzione."
  );
}

const chiave = prova ? "DB_URL_PROVA" : "DB_URL_PRODUZIONE";
const env = readFileSync(".env", "utf8");
const riga = env.match(new RegExp(`^${chiave}=(.*)$`, "m"));
if (!riga) {
  fermati(
    `In .env manca ${chiave}.`,
    "Il modello dei valori attesi è in .env.example."
  );
}

const esito = spawnSync(
  strumento("psql"),
  [
    riga[1].trim(),
    "-At",
    "-c",
    `select pg_get_functiondef(p.oid)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = '${nome.replace(/'/g, "''")}'`,
  ],
  { encoding: "utf8" }
);

if (esito.status !== 0) {
  fermati("Non sono riuscito a leggere la funzione.", esito.stderr?.trim() ?? "");
}

const corpo = esito.stdout.trim();
if (!corpo) {
  fermati(
    `Nel database ${prova ? "di prova" : "vero"} non c'è nessuna funzione che si chiama «${nome}».`,
    "⚠️ Non vuol dire che non esiste: vuol dire che lì non c'è.",
    "Controlla il nome, oppure prova con --prova (o senza)."
  );
}

// ⚠️ Il punto e virgola NON c'è in ciò che restituisce Postgres, e senza,
// incollando il corpo in una migrazione, l'istruzione dopo gli si attacca e
// l'errore che si vede parla di un'altra riga. Costato mezz'ora il 19/08.
process.stdout.write(corpo.endsWith(";") ? `${corpo}\n` : `${corpo};\n`);
