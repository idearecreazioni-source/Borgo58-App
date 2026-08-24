// Il censimento dei numeri che potrebbero avere un limite naturale.
//
// 🔴 PERCHE' E' PIU' LARGO DI QUELLO DEL 24/08 (rifatto il 24/08 sera, su
// rilievo di Alessio). Il primo giro cercava fra le colonne **numeriche**,
// e la temperatura attesa di un ingrediente è una colonna di **testo** —
// perché deve poter contenere «0-4 °C» e «ambiente», non solo un numero.
// Risultato: `-100` come temperatura di consegna è entrata senza un fiato,
// mentre uno scarto al 100% veniva respinto con la sua spiegazione.
//
// ⚠️ LA LEZIONE, che vale oltre le temperature: **un numero scritto in una
// colonna di testo non compare in un censimento dei numeri.** È la stessa
// forma del difetto del 22/08 — un censimento «per posti» tace su ciò che
// non è un posto — letta sui tipi invece che sulle schermate.
//
// ⚠️ E IL CENSIMENTO E' UN SETACCIO, NON UN VERDETTO: dice dove guardare.
// Una colonna numerica senza vincolo può essere legittima (un identificativo
// progressivo, un conteggio), e una testuale con numeri dentro può essere
// una nota libera. Prima di mettere un limite si guarda cosa contiene.
import { leggiConfigurazione, REF_PRODUZIONE, strumento } from "./comune.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = leggiConfigurazione(".env.db");
const vero = process.argv.includes("--vero");
const url = vero ? config.DB_URL_PRODUZIONE : config.DB_URL_PROVA;
if (!url) {
  console.error("Manca l'indirizzo del database in .env.db");
  process.exit(1);
}
if (!vero && url.includes(REF_PRODUZIONE)) {
  console.error("FERMO: .env.db punta al database vero sulla riga della prova.");
  process.exit(1);
}

// ⚠️ DA FILE, MAI COME ARGOMENTO: `psql -c "…"` fa passare il testo dalla
// riga di comando, e lì gli accenti e le virgolette si rompono (§8, 18/08).
// È anche l'unico modo di mandare UNA query sola invece di una per colonna:
// con una connessione per colonna il censimento non finiva.
const chiedi = (sql) => {
  const f = path.join(os.tmpdir(), `b58-censimento-${process.pid}.sql`);
  fs.writeFileSync(f, sql, "utf8");
  try {
    return execFileSync(strumento("psql"), [url, "-At", "-F", "\t", "-f", f], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      // ⚠️ Il ritorno a capo di Windows va tolto PRIMA di spezzare: senza,
      // l'ultimo campo di ogni riga se lo porta appiccicato e ogni
      // confronto con una stringa fallisce. Qui il censimento diceva «zero
      // colonne senza vincolo» — cioè «va tutto bene» — mentre erano 76.
      // Terza trappola del CRLF in una notte sola.
      .replace(/\r/g, "")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((r) => r.split("\t"));
  } finally {
    fs.rmSync(f, { force: true });
  }
};

// 1 · Le colonne numeriche, con o senza un vincolo che le nomini.
const numeriche = chiedi(`
  select t.relname, a.attname, format_type(a.atttypid, a.atttypmod),
         (select count(*) from pg_constraint c
           where c.conrelid = t.oid and c.contype = 'c'
             and a.attnum = any(c.conkey))
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and t.relkind = 'r'
     and format_type(a.atttypid, a.atttypmod) ~ '^(numeric|integer|smallint|bigint|real|double)'
     and a.attname not like '%\\_id'
   order by 1, 2;`);

// 2 · ⚠️ LE TESTUALI CHE CONTENGONO NUMERI — l'elenco che mancava.
//     Si guardano i DATI, non i nomi: una colonna si tradisce da quello che
//     ci hanno scritto dentro, non da come si chiama. E si guarda su TUTTE
//     le righe, perché basta una riga assurda per rendere falso un registro.
// ⚠️ Una funzione anonima invece di comporre la query in JavaScript: il
// `string_agg` produceva una riga lunghissima che tornava vuota o spezzata,
// e componendola qui il conto lo fa il database — che le tabelle le ha.
const conNumeri = chiedi(`
-- ⚠️ NIENTE "on commit drop": psql chiude una transazione per istruzione,
-- quindi la tabella spariva fra il blocco che la riempie e la select che la
-- legge. Vive per la sessione, e la sessione e' una sola perche' il file
-- passa da un solo psql con -f.
drop table if exists _censimento;
do $$
declare r record; q text; n bigint; tot bigint; es text;
begin
  create temp table _censimento(tab text, col text, quante bigint, su bigint, esempi text);
  for r in
    select t.relname as tab, a.attname as col
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
     where n.nspname = 'public' and t.relkind = 'r'
       and format_type(a.atttypid, a.atttypmod) in ('text', 'character varying')
  loop
    q := format(
      'select count(*) filter (where %1$I ~ ''[0-9]''), count(%1$I),
              left(coalesce(string_agg(distinct left(%1$I, 20), '' | '')
                filter (where %1$I ~ ''[0-9]''), ''''), 70)
         from %2$I', r.col, r.tab);
    begin
      execute q into n, tot, es;
    exception when others then continue;
    end;
    if n > 0 then
      insert into _censimento values (r.tab, r.col, n, tot, es);
    end if;
  end loop;
end $$;
select tab, col, quante, su, esempi from _censimento order by tab, col;`).filter((r) => r.length === 5);

const senza = numeriche.filter((r) => r[3] === "0");
const con = numeriche.filter((r) => r[3] !== "0");

console.log(`\n── I numeri del gestionale ${vero ? "VERO" : "di prova"}\n`);
console.log(
  `  colonne numeriche: ${numeriche.length}  ·  con un vincolo: ${con.length}  ·  senza: ${senza.length}\n`
);

console.log("  ── 1 · NUMERICHE SENZA VINCOLO");
for (const [tab, col, tipo] of senza) console.log(`     ${(tab + "." + col).padEnd(44)} ${tipo}`);

console.log("\n  ── 2 · TESTUALI CHE CONTENGONO NUMERI");
console.log("     ⚠️ Qui un valore assurdo non lo vede nemmeno un censimento dei numeri.");
if (conNumeri.length === 0) console.log("     (nessuna)");
for (const [tab, col, quante, su, esempi] of conNumeri)
  console.log(`     ${(tab + "." + col).padEnd(44)} ${quante}/${su} · ${esempi}`);

console.log(
  `\n  ${senza.length} numeriche scoperte, ${conNumeri.length} testuali con numeri dentro.`
);
console.log("  ⚠️ È un setaccio: dice dove guardare, non cosa è vero.\n");
