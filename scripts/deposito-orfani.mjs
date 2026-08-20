// I FILE CHE NESSUN DOCUMENTO NOMINA PIÙ — 20/08/2026.
//
// 🔴 PERCHÉ ESISTE. Fino al 20/08 cancellare un documento dall'app toglieva
// la riga e poi provava a togliere il file, **ingoiando il fallimento**. Se
// il secondo passo non riusciva, il file restava nel deposito e nessuno
// poteva più nominarlo: misurati **tre** file in questa condizione.
//
// L'ordine è stato invertito (`src/lib/api/documents.js`), quindi da oggi il
// caso non si crea più. Ma i tre di ieri restano, e dall'app non si toccano:
// serve questo comando.
//
// ⚠️ IN SOLA LETTURA, come `npm run migra`: dice cosa c'è e non tocca
// niente. Per rimuovere davvero serve `-- --conferma`, e il confronto si
// rifà dentro la stessa esecuzione — non si cancella su un elenco letto
// prima.
//
// ⚠️ E NON SI FIDA DI UN ELENCO PARZIALE: se la lettura del deposito o
// quella dei documenti non riesce, il comando SI FERMA. Cancellare
// «i file che non compaiono in un elenco che non sono riuscito a leggere»
// è il modo di perdere un documento vero.
import { createClient } from "@supabase/supabase-js";
import { fermati, interroga, leggiConfigurazione, obbligatorio, titolo } from "./comune.mjs";

const BUCKET = "documents";
const conferma = process.argv.includes("--conferma");

const config = leggiConfigurazione();
const url = obbligatorio(config, "SUPABASE_URL_PRODUZIONE", "docs/BACKUP.md §2");
const service = obbligatorio(config, "SERVICE_ROLE_PRODUZIONE", "docs/BACKUP.md §2");
// ⚠️ L'archivio si legge da psql e NON con la chiave di servizio, e la
// ragione è una misura del 20/08: in questo progetto `service_role` **non ha
// il permesso di leggere le tabelle di `public`** — ce l'ha solo
// `authenticated`, e sopra c'è la RLS. È una postura difensiva voluta, non
// un guasto: chi scrive uno script che legge dati passa da qui.
const dbUrl = obbligatorio(config, "DB_URL_PRODUZIONE", "docs/BACKUP.md §2");

const sb = createClient(url, service, { auth: { persistSession: false } });

async function elenca(prefisso = "") {
  const { data, error } = await sb.storage.from(BUCKET).list(prefisso, { limit: 1000 });
  // ⚠️ Ci si ferma: un elenco corto qui diventa una cancellazione sbagliata.
  if (error) fermati(`Non riesco a leggere ${BUCKET}/${prefisso}:`, error.message);
  const trovati = [];
  for (const voce of data) {
    const completo = prefisso ? `${prefisso}/${voce.name}` : voce.name;
    // Una "cartella" non ha metadati: si riconosce così.
    if (voce.id === null) trovati.push(...(await elenca(completo)));
    else trovati.push(completo);
  }
  return trovati;
}

titolo("I file del deposito che nessun documento nomina");

const files = await elenca();
const righe = interroga(
  dbUrl,
  "select storage_path from documents where storage_path is not null;"
)
  .split(String.fromCharCode(10))
  .map((r) => r.trim())
  .filter(Boolean);

const nominati = new Set(righe);
const orfani = files.filter((f) => !nominati.has(f));

console.log(`  file nel deposito: ${files.length}`);
console.log(`  documenti che ne nominano uno: ${nominati.size}`);
console.log(`  file che nessuno nomina: ${orfani.length}`);

if (orfani.length === 0) {
  console.log("\n  Niente da togliere.");
  process.exit(0);
}

console.log("");
for (const f of orfani) console.log(`    · ${f}`);

if (!conferma) {
  console.log("\n  Nessuna modifica fatta: questa e' la modalita' di sola lettura.");
  console.log("  Per toglierli davvero: npm run deposito:orfani -- --conferma");
  console.log("\n  ⚠️ Prima di farlo: `npm run backup`. Un file tolto da qui non torna,");
  console.log("     e questi file NON sono nel gestionale — sono solo nel deposito.");
  process.exit(0);
}

console.log("\n── Li tolgo");
const { error: e2 } = await sb.storage.from(BUCKET).remove(orfani);
if (e2) fermati("La rimozione non e' riuscita:", e2.message);

// ⚠️ Si RIMISURA invece di dichiarare «fatto»: è la stessa regola delle
// migrazioni — i numeri veri dopo, non la promessa di prima.
const dopo = await elenca();
const restati = dopo.filter((f) => !nominati.has(f));
console.log(`\n── Com'e' andata`);
console.log(`  file nel deposito: ${files.length} → ${dopo.length}`);
console.log(`  file che nessuno nomina: ${orfani.length} → ${restati.length}`);
if (restati.length > 0) {
  fermati("Alcuni file non sono stati tolti:", ...restati.map((f) => `  · ${f}`));
}
