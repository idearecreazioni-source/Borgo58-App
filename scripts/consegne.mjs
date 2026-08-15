// Cosa manca da documentare — sola lettura.
//
// ⚠️ Questo comando NON e' la rete: la rete sta dentro `migra.mjs` e
// `funzione.mjs`, che si rifiutano di toccare la produzione finche'
// l'arretrato e' aperto. Questo serve solo a guardare senza aspettare che
// sia un blocco a dirtelo — perche' un controllo che si scopre solo
// sbattendoci contro fa perdere tempo a chi stava lavorando bene.

import {
  interroga,
  leggiConfigurazione,
  migrazioniSenzaRiepilogo,
  obbligatorio,
  PRIMA_CON_RIEPILOGO,
  titolo,
} from "./comune.mjs";

const config = leggiConfigurazione();
const url = obbligatorio(
  config,
  "DB_URL_PRODUZIONE",
  "Serve la stringa di collegamento del database vero."
);

const applicate = new Set(
  interroga(url, "select version from applied_migrations;")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean)
);

const scoperte = migrazioniSenzaRiepilogo(applicate);

titolo("Migrazioni in produzione senza riepilogo");
console.log(`  applicate in produzione: ${applicate.size}`);
console.log(`  sotto controllo (dalla ${PRIMA_CON_RIEPILOGO} in poi): ${
  [...applicate].filter((v) => v >= PRIMA_CON_RIEPILOGO).length
}`);
console.log("");

if (scoperte.length === 0) {
  console.log("  Nessun arretrato: ogni migrazione recente e' nominata da un riepilogo.");
  console.log("");
  process.exit(0);
}

for (const v of scoperte) console.log(`  · ${v}`);
console.log("");
console.log("  Finche' restano scoperte, migra.mjs e funzione.mjs non toccano la produzione.");
console.log("");
process.exit(1);
