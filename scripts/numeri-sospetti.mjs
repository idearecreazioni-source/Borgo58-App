// I NUMERI CHE MERITANO UN'OCCHIATA — `npm run numeri`
//
// 🔴 PERCHE' UN COMANDO E NON UNA SCHERMATA, per adesso. La regola di
// questo progetto e' che una funzione che nessuno chiama e' «tutto acceso
// e muto» — la forma della soglia di magazzino del 13/08. Ma dove vada a
// stare questo elenco dentro il gestionale e' una decisione di Alessio
// (in Proiezione? in Magazzino? una voce sua?), e indovinarla vorrebbe
// dire mettere una schermata dove nessuno la cerca.
//
// Nel frattempo il comando lo rende leggibile subito, ed e' anche il modo
// giusto di guardarlo prima di una consegna: un giro solo, tutto il
// gestionale.
//
// ⚠️ LEGGE SOLO. Nessuna scrittura, in nessuna delle due direzioni.
//
//   npm run numeri            il gestionale VERO
//   npm run numeri -- --prova il progetto di prova
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fermati, strumento, titolo } from "./comune.mjs";

const prova = process.argv.includes("--prova");
const chiave = prova ? "DB_URL_PROVA" : "DB_URL_PRODUZIONE";

const env = readFileSync(".env", "utf8");
const riga = env.match(new RegExp(`^${chiave}=(.*)$`, "m"));
if (!riga) {
  fermati(
    `In .env manca ${chiave}.`,
    "Il modello dei valori attesi e' in .env.example."
  );
}

// ⚠️ Il portiere della funzione pretende il titolare, e una migrazione o
// un comando non hanno un utente: si impostano i claims come fanno i
// blocchi di verifica delle migrazioni. Il titolare si legge da
// `user_roles`, non si scrive qui.
const sql = `
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id, 'role', 'authenticated')::text
       from user_roles where role = 'titolare' limit 1), false);
  select dove, che_cosa, valore, perche from numeri_sospetti();
`;

const esito = spawnSync(strumento("psql"), [riga[1].trim(), "-At", "-F", "", "-c", sql], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

if (esito.status !== 0) {
  fermati("Non sono riuscito a leggere i numeri sospetti.", esito.stderr?.trim() ?? "");
}

titolo(`I numeri che meritano un'occhiata — ${prova ? "progetto di prova" : "gestionale vero"}`);

const righe = esito.stdout
  .split("\n")
  .map((r) => r.split(""))
  .filter((c) => c.length === 4);

if (righe.length === 0) {
  console.log("  Niente fuori dall'ordinario.\n");
  console.log("  ⚠️ Non vuol dire che i numeri sono giusti: vuol dire che");
  console.log("     nessuno di loro esce dagli intervalli che il gestionale");
  console.log("     sa giudicare. I limiti CERTI sono vincoli del database,");
  console.log("     e quelli non li vede questo elenco: li' un dato assurdo");
  console.log("     non entra proprio.\n");
} else {
  let ultimoDove = "";
  for (const [dove, cheCosa, valore, perche] of righe) {
    if (dove !== ultimoDove) {
      console.log(`\n── ${dove}`);
      ultimoDove = dove;
    }
    console.log(`   · ${cheCosa}`);
    console.log(`     ${valore}`);
    console.log(`     ${perche}`);
  }
  console.log(
    `\n  ${righe.length} ${righe.length === 1 ? "segnalazione" : "segnalazioni"}.`
  );
  // 🔴 La riga che impedisce la conclusione sbagliata: un setaccio dice
  // dove guardare, non cosa e' vero. Lo zafferano a 2.400 €/kg e' il
  // prezzo dello zafferano.
  console.log("  ⚠️ NON sono errori: sono i numeri fuori dall'ordinario.");
  console.log("     Alcuni sono giusti — lo zafferano costa davvero cosi'.\n");
}
