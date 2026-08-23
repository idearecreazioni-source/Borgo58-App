// CONTROLLA UNA COPIA DI SICUREZZA — `npm run backup:verifica`
//
// 🔴 PERCHE' ESISTE (23/08/2026, chiesto da Alessio). «Non limitarti a
// controllare che il file esista»: un backup che nessuno ha mai aperto e'
// una speranza, non una copia. E il modo in cui un backup fallisce e'
// quasi sempre lo stesso di §8 — **piu' corto, con l'aria di essere
// intero**: un `pg_dump` interrotto a meta' produce un file grande, ben
// formato e leggibile, a cui mancano le ultime tabelle.
//
// COSA CONTROLLA, e sono quattro domande diverse:
//   1. il file finisce dove deve finire (non e' troncato);
//   2. per OGNI tabella, quante righe ci sono DAVVERO dentro il file —
//      contate una per una, non lette da un riepilogo;
//   3. quel numero coincide con `05_conteggi.txt`, cioe' con quello che il
//      database dichiarava nel momento della copia;
//   4. e coincide con quello che il database vero dice ADESSO (con
//      `--adesso`), cosi' si vede anche se la copia e' vecchia.
//
// ⚠️ COSA NON DIMOSTRA, dichiarato perche' non si scambi per altro: che il
// file **giri** dentro un database. Per quello serve un ripristino vero, e
// l'unica procedura provata di questo progetto e' `npm run prova:ripristina`
// — che pero' **svuota il progetto di prova**. Questo comando risponde a
// «il file contiene tutto?», non a «il file si esegue?».
//
// ⚠️ SOLA LETTURA dappertutto: apre file e, con `--adesso`, fa una `select`
// di conteggio sul database vero. Non scrive niente, da nessuna parte.
//
//   npm run backup:verifica                  l'ultima copia
//   npm run backup:verifica -- "C:\\...\\2026-08-23_2120"
//   npm run backup:verifica -- --adesso      confronta anche col database vero

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import {
  fermati,
  interroga,
  leggiConfigurazione,
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

/**
 * Quante righe contiene DAVVERO il file, tabella per tabella.
 *
 * `pg_dump` scrive i dati come blocchi `COPY tabella (...) FROM stdin;`
 * chiusi da una riga con due soli caratteri: `\.`. Si contano le righe in
 * mezzo. ⚠️ Si conta, non si legge un totale scritto da qualcuno: un
 * riepilogo puo' essere giusto in un file sbagliato.
 */
export function righePerTabella(sql) {
  const per = new Map();
  const aperti = [];
  let dentro = null;
  let quante = 0;
  for (const riga of sql.split(/\r?\n/)) {
    if (dentro === null) {
      const m = riga.match(/^COPY (?:public\.)?"?([A-Za-z0-9_]+)"?\s*\(.*FROM stdin;$/);
      if (m) {
        dentro = m[1];
        quante = 0;
        aperti.push(dentro);
      }
      continue;
    }
    if (riga === "\\.") {
      per.set(dentro, (per.get(dentro) ?? 0) + quante);
      dentro = null;
      continue;
    }
    quante += 1;
  }
  // Un blocco rimasto aperto e' esattamente il file troncato a meta'.
  return { per, troncato: dentro, aperti };
}

/**
 * Quante righe ha un blocco `COPY` preciso, anche fuori da `public`.
 * ⚠️ `righePerTabella` guarda solo le tabelle del gestionale: gli utenti
 * stanno in `auth`, e senza questa non li conterebbe nessuno.
 */
export function righeDiCopy(sql, tabella) {
  let dentro = false;
  let quante = 0;
  for (const riga of sql.split(/\r?\n/)) {
    if (!dentro) {
      if (riga.startsWith(`COPY ${tabella} (`) && riga.endsWith("FROM stdin;")) dentro = true;
      continue;
    }
    if (riga === "\\.") break;
    quante += 1;
  }
  return quante;
}

/** I conteggi dichiarati al momento della copia. */
export function conteggiDichiarati(testo) {
  const per = new Map();
  for (const riga of testo.split(/\r?\n/)) {
    const m = riga.match(/^(\S+) = (\d+)$/);
    if (m) per.set(m[1], Number(m[2]));
  }
  return per;
}

/**
 * Il confronto vero e proprio: cosa non torna fra due conteggi.
 * ⚠️ Una tabella VUOTA non compare fra i blocchi COPY del file, ed e'
 * normale: zero righe non si scrivono. Non torna solo se il file ha meno
 * righe di quante ne siano dichiarate.
 */
export function differenze(dichiarati, nelFile) {
  const fuori = [];
  for (const [tabella, attese] of dichiarati) {
    const trovate = nelFile.get(tabella) ?? 0;
    if (trovate !== attese) fuori.push({ tabella, attese, trovate });
  }
  for (const [tabella, trovate] of nelFile) {
    if (!dichiarati.has(tabella)) fuori.push({ tabella, attese: 0, trovate });
  }
  return fuori.sort((a, b) => a.tabella.localeCompare(b.tabella));
}

// ---------------------------------------------------------------------
// Il comando
// ---------------------------------------------------------------------
// ⚠️ `pathToFileURL` e non una stringa costruita a mano: su Windows il
// percorso comincia con `C:\` e l'indirizzo giusto ha TRE barre
// (`file:///C:/...`). Costruendolo a mano il confronto non torna mai e il
// comando non fa niente — senza dare nessun errore, che e' il modo
// peggiore di sbagliare.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = leggiConfigurazione();
  const argomenti = process.argv.slice(2);
  const adesso = argomenti.includes("--adesso");
  const indicata = argomenti.find((a) => !a.startsWith("--"));

  const radice = config.BACKUP_CARTELLA || path.join(os.homedir(), "Desktop", "Backup Borgo 58");
  let cartella = indicata;
  if (!cartella) {
    if (!existsSync(radice)) fermati(`Non trovo nessuna copia in ${radice}.`, "Fai prima: npm run backup");
    const copie = readdirSync(radice).filter((c) => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(c)).sort();
    if (copie.length === 0) fermati(`Nessuna copia dentro ${radice}.`, "Fai prima: npm run backup");
    cartella = path.join(radice, copie[copie.length - 1]);
  }

  titolo(`Controllo la copia: ${cartella}`);

  for (const necessario of ["01_schema.sql", "02_dati.sql", "05_conteggi.txt"]) {
    const f = path.join(cartella, necessario);
    if (!existsSync(f)) fermati(`Nella copia manca ${necessario}.`);
    if (statSync(f).size === 0) fermati(`${necessario} e' vuoto: la copia NON e' valida.`);
  }

  // --- 1. Il file finisce dove deve finire -----------------------------
  // ⚠️ `pg_dump` chiude sempre con questa riga. Senza, il file e' stato
  // interrotto — ed e' il modo in cui un backup rotto sembra sano.
  // 🔴 IL MARCATORE NON E' L'ULTIMA RIGA, e il primo tentativo di questo
  // controllo ha gridato per questo. `pg_dump` 17 scrive il suo «dump
  // complete» e POI una riga `\unrestrict <chiave>`, che chiude la
  // protezione aperta in cima al file. Pretendere che il file FINISCA col
  // marcatore dava un falso allarme su una copia sanissima — cioe' il
  // guardiano che grida sempre, che si impara a spegnere.
  // ⚠️ Trovato guardando la coda del file vero, non rileggendo il codice.
  // Si cerca il marcatore nelle ULTIME righe: c'e' ed e' in fondo.
  for (const nome of ["01_schema.sql", "02_dati.sql"]) {
    const testo = readFileSync(path.join(cartella, nome), "utf8");
    const coda = testo.slice(-400);
    if (!coda.includes("PostgreSQL database dump complete")) {
      fermati(
        `${nome} NON contiene, in fondo, la riga che pg_dump scrive quando ha finito.`,
        "Il file e' stato interrotto a meta': la copia non e' utilizzabile.",
        "Rifai: npm run backup"
      );
    }
  }
  console.log("  i due file finiscono dove devono: non sono troncati");

  // --- 2 e 3. Le righe contate contro quelle dichiarate ----------------
  const dati = readFileSync(path.join(cartella, "02_dati.sql"), "utf8");
  const { per: nelFile, troncato, aperti } = righePerTabella(dati);
  if (troncato) {
    fermati(`Il blocco della tabella «${troncato}» resta aperto: il file e' troncato.`);
  }
  const dichiarati = conteggiDichiarati(readFileSync(path.join(cartella, "05_conteggi.txt"), "utf8"));

  const righeNelFile = [...nelFile.values()].reduce((a, b) => a + b, 0);
  const righeDichiarate = [...dichiarati.values()].reduce((a, b) => a + b, 0);
  console.log(`  tabelle dichiarate: ${dichiarati.size} · con dati nel file: ${aperti.length}`);
  console.log(`  righe contate nel file: ${righeNelFile} · dichiarate: ${righeDichiarate}`);

  const fuori = differenze(dichiarati, nelFile);
  if (fuori.length > 0) {
    fermati(
      "La copia NON contiene quello che dichiara di contenere.",
      ...fuori.map((d) => `  ${d.tabella}: nel file ${d.trovate}, dichiarate ${d.attese}`)
    );
  }
  console.log("  ogni tabella ha nel file esattamente le righe che dichiara");

  // --- 3-bis. E GLI UTENTI, che stanno fuori da `public` --------------
  // 🔴 Senza questo, un utente che non fosse entrato nella copia non lo
  // direbbe nessuno: `05_conteggi.txt` guarda solo le tabelle del
  // gestionale, e la prova di ripristino confrontava il file con se'
  // stesso. Trovato rompendo, non rileggendo.
  const fAccessi = path.join(cartella, "08_accessi_conteggi.txt");
  const fUtenti = path.join(cartella, "03_accessi.sql");
  if (existsSync(fAccessi) && existsSync(fUtenti)) {
    const dichiarati = conteggiDichiarati(readFileSync(fAccessi, "utf8"));
    const testo = readFileSync(fUtenti, "utf8");
    const contati = new Map([
      ["utenti", righeDiCopy(testo, "auth.users")],
      ["identita", righeDiCopy(testo, "auth.identities")],
    ]);
    const fuoriAccessi = differenze(dichiarati, contati);
    if (fuoriAccessi.length > 0) {
      fermati(
        "Gli ACCESSI nella copia non sono quelli che il database dichiarava.",
        ...fuoriAccessi.map((d) => `  ${d.tabella}: nel file ${d.trovate}, dichiarati ${d.attese}`),
        "",
        "Senza tutti gli utenti, dopo un ripristino qualcuno non entra piu'."
      );
    }
    console.log(
      `  accessi: ${contati.get("utenti")} utenti e ${contati.get("identita")} identita', come dichiarato`
    );
  } else if (existsSync(fUtenti)) {
    console.log("  ⚠️ questa copia non dichiara quanti utenti conteneva: non si puo' controllarli");
  }

  // --- 4. E il database vero, adesso -----------------------------------
  if (adesso) {
    const url = config.DB_URL_PRODUZIONE;
    if (!url) fermati("Manca DB_URL_PRODUZIONE in .env.db.");
    const vive = conteggiDichiarati(interroga(url, SQL_CONTEGGI));
    const scostamenti = differenze(vive, nelFile);
    if (scostamenti.length === 0) {
      console.log("  e il database vero, adesso, dice gli stessi numeri: la copia e' allineata");
    } else {
      // ⚠️ NON e' un errore: fra la copia e adesso il locale ha lavorato.
      // Ma va DETTO, perche' «ho un backup» e «ho un backup di ieri» sono
      // due frasi diverse.
      console.log("");
      console.log(`  il database vero e' cambiato dopo la copia (${scostamenti.length} tabelle):`);
      for (const d of scostamenti) {
        console.log(`    ${d.tabella}: nella copia ${d.trovate}, adesso ${d.attese}`);
      }
      console.log("  non e' un guasto: e' quanto lavoro c'e' stato dopo la copia.");
    }
  }

  titolo("La copia contiene tutto quello che dichiara.");
  console.log("");
  console.log("  ⚠️ Questo dimostra che il FILE e' completo, non che gira dentro");
  console.log("     un database: per quello serve un ripristino vero.");
  console.log("");
}
