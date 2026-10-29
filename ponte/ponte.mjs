// IL PONTE — il programma che gira sul mini-PC del ristorante (28/10/2026).
//
// Il gestionale è un sito e non può parlare con le stampanti della rete
// del locale (ARCHITETTURA §3b). Questo programma sì: ogni due secondi
// chiede al gestionale se c'è qualcosa da stampare, lo porta
// all'apparecchio e riscrive com'è andata (ARCHITETTURA §4.2). Ogni trenta
// secondi dice «ci sono», ed è così che la pagina «Stampanti» sa se è
// acceso.
//
// ⚠️ NIENTE DIPENDENZE: solo Node (22 o più recente). Sul mini-PC basta
//    copiare la cartella `ponte/` e scrivere `config.json`.
//
// ⚠️ GLI INDIRIZZI DEGLI APPARECCHI NON SI SCRIVONO QUI: si scrivono nel
//    gestionale, e il ponte li riceve a ogni battito.
//
// Avvio:  node ponte/ponte.mjs            (legge ponte/config.json)
//         PONTE_CONFIG=altro.json node ponte/ponte.mjs

import { appendFileSync, existsSync, readFileSync, renameSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eseguiLavoro } from "./esegui.mjs";
import { gestionale } from "./gestionale.mjs";
import { senzaControlli } from "./protocolli/testo.mjs";

export const VERSIONE = "0.2.0";
const CARTELLA = path.dirname(fileURLToPath(import.meta.url));

export const OGNI_QUANTO = {
  coda: 2000,
  battito: 30000,
  // Quando il gestionale non risponde (internet caduto) si riprova più
  // piano, per non riempire il registro di righe uguali.
  dopoUnErrore: 15000,
};

// ⚠️ Mai la chiave nel registro.
function registro(file) {
  return (...parti) => {
    const riga = `${new Date().toISOString()} ${parti.join(" ")}`;
    console.log(riga);
    if (!file) return;
    try {
      if (existsSync(file) && statSync(file).size > 2_000_000) renameSync(file, `${file}.vecchio`);
      appendFileSync(file, `${riga}\n`, "utf8");
    } catch {
      // Un registro che non si scrive non deve fermare le stampe.
    }
  };
}

export function leggiConfigurazione(file = process.env.PONTE_CONFIG ?? path.join(CARTELLA, "config.json")) {
  if (!existsSync(file)) {
    throw new Error(`Non trovo la configurazione del ponte in ${file}. Copia config.esempio.json in config.json e riempila.`);
  }
  // ⚠️ Il messaggio di JSON.parse può riportare un pezzo del file, cioè
  //    della chiave: a schermo va solo la frase nostra (revisione, 29/10).
  let c;
  try {
    c = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${path.basename(file)} non è scritto bene: controlla virgole e virgolette, come in config.esempio.json.`);
  }
  return {
    indirizzo: c.indirizzo,
    chiavePubblica: c.chiavePubblica,
    chiavePonte: c.chiavePonte,
    simulatore: c.simulatore === true,
    registro: c.registro === false ? null : (c.registro ?? path.join(CARTELLA, "ponte.log")),
  };
}

/**
 * Un giro: prende i lavori in coda, li porta agli apparecchi, scrive gli
 * esiti. Restituisce quanti ne ha fatti. Esportato per le prove.
 */
export async function unGiro(g, { simulatore, scrivi = () => {}, esegui = eseguiLavoro, limiteMs = LIMITE_DI_UN_LAVORO_MS } = {}) {
  const lavori = await g.prendiLavori(5);
  for (const lavoro of lavori ?? []) {
    // 🔴 OGNI LAVORO HA UN TETTO, E UN GUASTO DEL PONTE NON FERMA GLI ALTRI
    //    (revisione del codice, 28/10). Se `esegui` si inceppa o si rompe,
    //    non si sa cosa sia partito: il lavoro è INCERTO, e si passa al
    //    prossimo invece di lasciarli tutti in corso.
    let orologio;
    let e;
    try {
      e = await Promise.race([
        esegui(lavoro, { simulatore }),
        new Promise((_, ko) => {
          orologio = setTimeout(() => ko(new Error(`il lavoro non è finito in ${limiteMs / 1000} secondi`)), limiteMs);
        }),
      ]);
    } catch (guasto) {
      e = {
        stato: "incerto",
        errore_codice: "sconosciuto",
        errore_testo: `Il ponte si è inceppato su questo lavoro (${guasto.message}): forse è uscito, forse no. Guarda la stampante.`,
        stato_dispositivo: "errore",
        esito: null,
      };
    } finally {
      clearTimeout(orologio);
    }
    scrivi(`lavoro ${lavoro.id} (${lavoro.tipo}) su «${perIlRegistro(lavoro.dispositivo?.nome)}»: ${e.stato}${e.errore_testo ? ` — ${perIlRegistro(e.errore_testo)}` : ""}`);
    // La risposta grezza dell'apparecchio anche nel registro, non solo in
    // `lavori_stampa.esito`: al collaudo si legge sul portatile, subito, ed
    // è quella che serve per correggere `protocolli/` (29/10/2026).
    if (e.esito) scrivi(`  risposta dell'apparecchio: ${perIlRegistro(JSON.stringify(e.esito)).slice(0, 2000)}`);
    try {
      await g.esito(lavoro.id, e);
    } catch (errore) {
      // ⚠️ Se l'esito non arriva, il lavoro resta «in corso» e dopo cinque
      //    minuti il gestionale lo segna incerto: nessuno lo ristampa da
      //    solo. Si riprova a scriverlo una volta, poi si lascia (se arriva
      //    più tardi, il gestionale lo accetta lo stesso).
      scrivi(`l'esito del lavoro ${lavoro.id} non è arrivato al gestionale (${errore.message}); riprovo fra poco`);
      await new Promise((ok) => setTimeout(ok, 2000));
      await g.esito(lavoro.id, e).catch((x) => scrivi(`ancora no: ${x.message}`));
    }
  }
  return lavori?.length ?? 0;
}

// Più lungo di tutte le attese di rete messe in fila (connessione, stato,
// stampa, chiusura), più corto dei cinque minuti dopo cui il gestionale
// dichiara incerto un lavoro abbandonato.
export const LIMITE_DI_UN_LAVORO_MS = 45000;

// Un nome con un a capo dentro non deve spezzare una riga del registro.
const perIlRegistro = (t) => senzaControlli(t);

export async function avvia(config = leggiConfigurazione()) {
  const scrivi = registro(config.registro);
  const g = gestionale(config);
  const host = os.hostname();
  let fermo = false;
  let ultimoBattito = 0;
  let ultimoErrore = "";

  scrivi(`ponte ${VERSIONE} acceso su ${host}${config.simulatore ? " (apparecchi finti ammessi)" : ""}`);
  const ferma = () => {
    fermo = true;
    scrivi("ponte spento");
  };
  process.on("SIGINT", ferma);
  process.on("SIGTERM", ferma);
  // Un guasto che sfugge a tutto si scrive nel registro prima di uscire:
  // il servizio di Windows riavvia il ponte, ma la causa deve restare.
  const cade = (e) => {
    scrivi(`guasto imprevisto, il ponte esce e ripartirà: ${e?.stack ?? e}`);
    process.exit(1);
  };
  process.on("uncaughtException", cade);
  process.on("unhandledRejection", cade);

  while (!fermo) {
    let attesa = OGNI_QUANTO.coda;
    try {
      if (Date.now() - ultimoBattito >= OGNI_QUANTO.battito) {
        const b = await g.battito(VERSIONE, host);
        ultimoBattito = Date.now();
        if (ultimoErrore) scrivi(`il gestionale risponde di nuovo; apparecchi attivi: ${b?.dispositivi?.length ?? 0}`);
        ultimoErrore = "";
      }
      await unGiro(g, { simulatore: config.simulatore, scrivi });
    } catch (e) {
      // Lo stesso errore si scrive una volta sola, non ogni due secondi.
      if (e.message !== ultimoErrore) scrivi(`errore: ${e.message}`);
      ultimoErrore = e.message;
      attesa = OGNI_QUANTO.dopoUnErrore;
    }
    await new Promise((ok) => setTimeout(ok, attesa));
  }
}

// `--verifica`: un battito solo, e dice cosa ha ricevuto. Serve durante
// l'installazione, per sapere subito se chiave e indirizzo sono giusti.
async function verifica(config = leggiConfigurazione()) {
  const b = await gestionale(config).battito(VERSIONE, os.hostname());
  const elenco = b?.dispositivi ?? [];
  console.log(`Il gestionale risponde. Apparecchi attivi: ${elenco.length}.`);
  for (const d of elenco) console.log(`  · ${d.nome} — ${d.indirizzo}:${d.porta} (${d.protocollo})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--verifica")) await verifica();
    else await avvia();
  } catch (e) {
    console.error(e.message);
    // ⚠️ `exitCode` e non `process.exit(1)`: su Windows, con una chiamata di
    //    rete appena chiusa, Node 24 stampava «Assertion failed … async.c»
    //    sotto il messaggio, ed è la prima cosa che Alessio leggeva (29/10).
    process.exitCode = 1;
  }
}
