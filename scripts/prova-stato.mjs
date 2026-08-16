// COSA MANCA AL PROGETTO DI PROVA — `npm run prova:stato`
//
// La regola, in una riga: **le tabelle che nel locale vero non sono vuote
// non devono essere vuote nemmeno sul progetto di prova.**
//
// ⚠️ PERCHE'. Ogni difetto trovato in questi giorni ha avuto la stessa
// forma: la prova girava su uno stato di partenza diverso da quello vero
// **esattamente nel punto rilevante**, quindi diceva verde. Il default
// che rispondeva al posto dell'utente (14/08) non aveva righe su cui
// scrivere; la colonna nuova senza sanatoria (15/08) non aveva righe da
// sanare; la verifica del vitto (16/08) saltava proprio la parte che in
// produzione sarebbe scattata. Tre volte la stessa cosa, e nessuna delle
// tre era colpa della prova: era colpa del suo essere vuota.
//
// ⚠️ E PERCHE' L'ELENCO NON E' SCRITTO A MANO. Un elenco di tabelle
// scritto oggi sarebbe una fotografia della produzione di oggi travestita
// da regola — lo stesso errore del guardiano che contava tre righe
// (16/08). Qui l'elenco si **ricava dal locale vero a ogni esecuzione**:
// man mano che il locale si riempie, questo comando chiede di più da solo.
//
// ⚠️ E DICE COSA MANCA, non «tutto a posto». Un comando che risponde sì o
// no non si sa dove mettere le mani; questo nomina le tabelle scoperte e
// quante righe hanno di là.
//
// Non scrive niente da nessuna parte: due letture e un confronto.

import {
  leggiConfigurazione,
  obbligatorio,
  interroga,
  titolo,
  REF_PRODUZIONE,
  fermati,
} from "./comune.mjs";

// Il conteggio riga per riga di tutte le tabelle, in una interrogazione
// sola. `n_live_tup` di pg_stat sarebbe una stima, e su tabelle con tre
// righe una stima può dire zero: qui si contano davvero.
const CONTA_TUTTE = `
select table_name || '=' ||
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE'
 order by table_name;`;

function conteggi(url) {
  const out = new Map();
  for (const riga of interroga(url, CONTA_TUTTE).split(/\r?\n/)) {
    const [nome, quante] = riga.split("=");
    if (nome) out.set(nome.trim(), Number(quante));
  }
  return out;
}

const config = leggiConfigurazione();
const urlVero = obbligatorio(config, "DB_URL_PRODUZIONE", "E' la stringa di collegamento del progetto del locale (sola lettura).");
const urlProva = obbligatorio(config, "DB_URL_PROVA", "E' la stringa 'Session pooler' del progetto Borgo58-Prova.");

if (!urlVero.includes(REF_PRODUZIONE)) {
  fermati("DB_URL_PRODUZIONE non punta al progetto del locale: il confronto non avrebbe senso.");
}
if (urlProva.includes(REF_PRODUZIONE)) {
  fermati("DB_URL_PROVA punta al database VERO. Controlla .env.db.");
}

titolo("Leggo il locale vero e il progetto di prova");
const vero = conteggi(urlVero);
const prova = conteggi(urlProva);
console.log(`   tabelle nel locale vero:      ${vero.size}`);
console.log(`   tabelle nel progetto di prova: ${prova.size}`);

// ---------------------------------------------------------------------
// 1. Le tabelle scoperte: piene di là, vuote di qua.
// ---------------------------------------------------------------------
const pieneNelVero = [...vero.entries()].filter(([, n]) => n > 0);
const scoperte = pieneNelVero
  .filter(([nome]) => (prova.get(nome) ?? 0) === 0)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// ⚠️ Una tabella che nel vero esiste e sulla prova NO non è «scoperta»: è
// una migrazione che non è stata applicata, ed è un problema diverso e
// più grave. Si dice a parte invece di confonderla con le altre.
const assenti = pieneNelVero.filter(([nome]) => !prova.has(nome)).map(([nome]) => nome);

titolo("Cosa manca al progetto di prova");
console.log(`   tabelle non vuote nel locale vero: ${pieneNelVero.length}`);
console.log(`   di queste, vuote sulla prova:      ${scoperte.length}`);
console.log("");

if (scoperte.length === 0) {
  console.log("   Nessuna tabella scoperta: ogni tabella che nel locale ha dei dati");
  console.log("   ne ha anche sulla prova.");
} else {
  const largo = Math.max(...scoperte.map(([n]) => n.length));
  for (const [nome, quante] of scoperte) {
    console.log(`   ${nome.padEnd(largo)}   ${String(quante).padStart(4)} righe nel locale vero`);
  }
  console.log("");
  console.log("   Queste tabelle esistono sulla prova ma sono vuote: una verifica che");
  console.log("   le tocca passa senza aver verificato niente. Lo stato di partenza si");
  console.log("   costruisce con  npm run prova:base");
}

if (assenti.length > 0) {
  titolo("⚠ Tabelle che sulla prova NON ESISTONO");
  for (const nome of assenti) console.log(`   ${nome}`);
  console.log("");
  console.log("   Non e' uno stato di partenza mancante: e' il progetto di prova indietro");
  console.log("   con le migrazioni.  npm run prova:migra");
}

// ---------------------------------------------------------------------
// 2. Lo stato di partenza c'è ancora? (le righe marcate BASE-)
// ---------------------------------------------------------------------
const marcate = interroga(
  urlProva,
  `select coalesce((select count(*) from ingredients where name like 'BASE-%'), 0)
        + coalesce((select count(*) from suppliers where name like 'BASE-%'), 0)
        + coalesce((select count(*) from recipes where name like 'BASE-%'), 0);`
);
titolo("Stato di partenza marcato");
console.log(`   righe «BASE-» riconoscibili sulla prova: ${marcate}`);
if (Number(marcate) === 0) {
  console.log("   Non c'e'. Si costruisce con  npm run prova:base");
}
console.log("");
