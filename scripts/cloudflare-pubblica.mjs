#!/usr/bin/env node
// =====================================================================
// LA PUBBLICAZIONE PARTE DAI CONTROLLI — 01/09/2026
// =====================================================================
//
// 🔴 PERCHE'. Misurato il 01/09 leggendo Cloudflare in sola lettura:
//    la versione `797262b8` risulta **in PRODUZIONE, riuscita**, il 31/08
//    alle 23:11:12, mentre i controlli di quello stesso commit erano
//    **rossi**; e la `5d3b7a86` risulta pubblicata alle 19:10:02.596, cioe'
//    **prima** che i controlli partissero (19:10:03). Non e' una teoria:
//    *oggi borgo58.it va online senza aspettare niente.*
//
// ⚠️ COSTRUISCE CLOUDFLARE, NON GITHUB. Questo comando dice soltanto
//    «costruisci il ramo», e la costruzione avviene con le variabili del
//    progetto Cloudflare, dove gia' vivono. Facendo compilare a GitHub
//    bisognerebbe portare indirizzo e chiave del gestionale anche fra i
//    segreti di GitHub: un secondo posto dove vivono le stesse cose, cioe'
//    il problema che questo mese e' stato speso a togliere.
//
// ⚠️ NON DECIDE LUI QUANDO. La condizione «i controlli sono verdi» non e'
//    scritta qui dentro e non deve esserlo: sta nel `needs:` del lavoro che
//    lo lancia, dove GitHub la fa rispettare da se' — un lavoro con `needs`
//    su due lavori rossi **non parte**. Una condizione scritta nello script
//    sarebbe una condizione che lo script puo' sbagliare.
// =====================================================================

import { verifica, costruisci, accountDalRepository, RAMO_DI_PRODUZIONE } from "./cloudflare-verifica.mjs";

const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
const account = process.env.CLOUDFLARE_ACCOUNT_ID || accountDalRepository();
const progetto = process.env.CLOUDFLARE_PROJECT || "borgo58-app";

// I tre valori: assente/`no` = non fa niente · `prova` = costruisce
// un'ANTEPRIMA del ramo di produzione · `si` = pubblica davvero.
//
// 🔴 IL VALORE `prova` E' LA DIMOSTRAZIONE DAL VIVO, ed e' il motivo per cui
//    i valori sono tre e non due. Quella nel repository e' un controllo
//    sulla FORMA del workflow, e dice solo che la riga c'e'. Qui il giro
//    intero — controlli verdi →
//    pubblicazione, controlli rossi → nessuna pubblicazione — si puo'
//    provare per davvero **senza mettere in gioco borgo58.it**: quello che
//    esce e' un indirizzo di anteprima. *Un interruttore che si puo'
//    accendere solo sulla cosa vera non si prova mai prima.*
const MODO = (process.env.PUBBLICAZIONE_DA_GITHUB ?? "").trim();

const ramoRichiesto = process.env.RAMO ?? RAMO_DI_PRODUZIONE;

async function principale() {
  if (MODO !== "si" && MODO !== "prova") {
    console.log(
      `PUBBLICAZIONE_DA_GITHUB vale «${MODO || "(non impostata)"}»: non pubblico niente.\n` +
        "Come si accende, e in che ordine: docs/CLOUDFLARE.md, sezione 9.",
    );
    return;
  }
  if (ramoRichiesto !== RAMO_DI_PRODUZIONE) {
    console.error(`::error::Questo comando pubblica solo «${RAMO_DI_PRODUZIONE}», non «${ramoRichiesto}».`);
    process.exit(1);
  }

  const esiti = await verifica({ token, account, progetto });
  for (const e of esiti) console.log(`  ${e.ok ? "OK  " : "NO  "}${e.domanda}\n      ${e.dettaglio}`);
  if (esiti.some((e) => !e.ok)) {
    console.error("::error::La chiave di Cloudflare non passa le letture: non pubblico. Il sito resta com'e'.");
    process.exit(1);
  }

  if (MODO === "prova") {
    // ⚠️ Il ramo di produzione costruito come ANTEPRIMA: stesso commit,
    //    stesso giro, indirizzo diverso. E' il giro generale.
    const esito = await costruisci({ token, account, progetto, ramo: `${RAMO_DI_PRODUZIONE}` });
    console.log(`\n  PROVA GENERALE — nessuna produzione toccata.\n  ${esito.ok ? "OK" : "NO"}  ${esito.dettaglio}`);
    if (!esito.ok) process.exit(1);
    if (esito.ambiente === "production") {
      console.error("::error::Cloudflare ha costruito in PRODUZIONE invece che in anteprima. Rileggi il pannello prima di continuare.");
      process.exit(1);
    }
    return;
  }

  const esito = await costruisci({ token, account, progetto, ramo: RAMO_DI_PRODUZIONE });
  console.log(`\n  ${esito.ok ? "OK" : "NO"}  ${esito.dettaglio}`);
  if (!esito.ok) {
    console.error("::error::La pubblicazione non e' partita. Il sito resta sulla versione di prima.");
    process.exit(1);
  }
}

await principale();
