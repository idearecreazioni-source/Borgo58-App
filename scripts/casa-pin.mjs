// IL PIN DEL TITOLARE DI CASA — `npm run casa:pin`
//
// `casa:costruisci` crea il titolare con una password casuale che nessuno
// conosce. Qui Alessio sceglie il SUO PIN, scrivendolo nel suo terminale:
// non passa da Claude, non finisce in nessun file, non si vede mentre lo
// scrive.

import { createInterface } from "node:readline";
import { fermati, titolo } from "./comune.mjs";
import { TITOLARE, leggiChiavi, pretendiCasa, sql } from "./casa-comune.mjs";

/** Chiede un testo senza mostrarlo mentre si scrive. */
function chiediNascosto(domanda) {
  return new Promise((risolvi) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let silenzio = false;
    rl._writeToOutput = (s) => {
      if (!silenzio) rl.output.write(s);
    };
    let risposto = false;
    rl.question(domanda, (risposta) => {
      risposto = true;
      rl.output.write("\n");
      rl.close();
      risolvi(risposta);
    });
    // Ctrl+C o fine dell'ingresso: la risposta e' vuota, e il PIN non cambia.
    rl.on("close", () => {
      if (!risposto) risolvi("");
    });
    silenzio = true;
  });
}

titolo("Il PIN del titolare di Casa");
pretendiCasa();
const { api, servizio } = leggiChiavi();
const id = sql(`select id from auth.users where email = '${TITOLARE}';`, "La ricerca del titolare");
if (!/^[0-9a-f-]{36}$/.test(id)) fermati("Il titolare non c'e': lancia prima  npm run casa:costruisci");

const pin = await chiediNascosto("   Nuovo PIN (almeno 6 caratteri, non si vede): ");
if (pin.length < 6) fermati("Il PIN deve avere almeno 6 caratteri. Non ho cambiato niente.");
const ancora = await chiediNascosto("   Riscrivilo: ");
if (ancora !== pin) fermati("I due PIN non coincidono. Non ho cambiato niente.");

const r = await fetch(`${api}/auth/v1/admin/users/${id}`, {
  method: "PUT",
  headers: { apikey: servizio, Authorization: `Bearer ${servizio}`, "Content-Type": "application/json" },
  body: JSON.stringify({ password: pin }),
});
if (!r.ok) fermati(`Il cambio del PIN non e' riuscito (${r.status}).`, (await r.text()).slice(0, 300));
console.log("   fatto: da ora si entra in Casa con questo PIN.");
