// =====================================================================
// LE FUNZIONI ONLINE SONO INDIETRO RISPETTO AL SITO CHE STA PER USCIRE?
// =====================================================================
// 🔴 NATO DA UN GUASTO VERO, il 06/09/2026. Il sito era stato pubblicato con
//    dentro il pulsante «Approva» degli appunti vocali; la funzione online
//    `operazioni-atomiche` era rimasta a due versioni prima e **non conosceva
//    quel gesto**. Alessio ha premuto, il pulsante ha detto «Lo sto
//    scrivendo…», e non e' successo niente.
//
// ⚠️ NESSUN CONTROLLO ESISTENTE POTEVA PRENDERLO, e il perche' e' la cosa da
//    conservare: il codice nel repository era **giusto** — il corridoio
//    elencava l'operazione, il client la chiamava col nome esatto, le prove
//    erano verdi. Cio' che era sbagliato non stava in nessun file: stava
//    **nella differenza fra il repository e cio' che gira online**. Un
//    controllo che legge dei file non puo' vedere una differenza fra un file
//    e un server.
//
// ⚠️ E LA META' CHE SI LEGGE DAI FILE HA GIA' IL SUO GUARDIANO:
//    `tests/unita/corridoio-conosce-i-gesti.test.js` pretende che ogni
//    operazione chiamata dal gestionale sia nell'elenco del corridoio. Questo
//    file chiude l'altra meta', quella che si puo' solo *chiedere*.
//
// 🔴 IL LIMITE, DICHIARATO PERCHE' E' GROSSO: per chiedere quali versioni
//    sono installate serve un accesso a Supabase, e **i controlli di GitHub
//    non ce l'hanno**. Quindi questo controllo protegge una pubblicazione
//    lanciata da qui, e non quella lanciata dalla coda di GitHub — che e' la
//    strada normale. Chiuderlo davvero vuol dire dare a quel lavoro un
//    accesso in lettura a Supabase, ed e' una decisione di Alessio
//    (credenziali). *Meglio un controllo che copre una strada sola e lo dice,
//    che nessun controllo e la convinzione di essere coperti.*

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CARTELLA = join("supabase", "functions");

/** Le funzioni online che esistono nel repository. */
export function funzioniDelRepository(cartella = CARTELLA) {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella, { withFileTypes: true })
    .filter((v) => v.isDirectory() && existsSync(join(cartella, v.name, "index.ts")))
    .map((v) => v.name);
}

/** Quando e' stata toccata l'ultima volta, secondo la storia del progetto. */
export function ultimaModifica(nome, cartella = CARTELLA) {
  const r = spawnSync("git", ["log", "-1", "--format=%cI", "--", join(cartella, nome)], {
    encoding: "utf8",
  });
  const quando = (r.stdout || "").trim();
  return quando === "" ? null : new Date(quando);
}

/**
 * Confronta cio' che c'e' nel repository con cio' che e' installato.
 *
 * ⚠️ SI CONFRONTANO DUE ISTANTI, non due contenuti: del pacchetto installato
 * non si puo' rileggere il sorgente. Un'installazione piu' recente dell'ultima
 * modifica **non dimostra** che dentro ci sia proprio quel codice — dimostra
 * che nessuno ha toccato il file dopo aver installato. E' meno di una prova,
 * ed e' molto piu' di niente: il guasto del 06/09 aveva l'installazione
 * vecchia di due giorni rispetto al file.
 *
 * @param installate elenco `{ slug, updated_at }` come lo restituisce Supabase
 */
export function funzioniIndietro(installate, quandoModificata = ultimaModifica, cartella = CARTELLA) {
  const suSupabase = new Map(
    (installate ?? []).map((f) => [f.slug, new Date(Number(f.updated_at))]),
  );
  const indietro = [];

  for (const nome of funzioniDelRepository(cartella)) {
    const modificata = quandoModificata(nome, cartella);
    if (!modificata) continue; // mai committata: non c'e' niente da confrontare
    const installata = suSupabase.get(nome);
    if (!installata) {
      indietro.push({ nome, perche: "non e' mai stata installata su questo progetto" });
      continue;
    }
    if (installata < modificata) {
      indietro.push({
        nome,
        perche:
          `il file e' stato cambiato il ${modificata.toISOString().slice(0, 16).replace("T", " ")}, ` +
          `l'ultima installazione e' del ${installata.toISOString().slice(0, 16).replace("T", " ")}`,
      });
    }
  }
  return indietro;
}

/** La frase da mostrare quando qualcuna e' indietro. */
export function fraseFunzioniIndietro(indietro) {
  if (!indietro || indietro.length === 0) return null;
  return [
    "FERMO: il sito che sta per uscire e' piu' avanti delle funzioni online.",
    ...indietro.map((f) => `  · ${f.nome} — ${f.perche}`),
    "",
    "  Il 06/09/2026 e' successo esattamente questo: il pulsante «Approva»",
    "  degli appunti vocali era online e la funzione che lo esegue non lo",
    "  conosceva. Chi ha premuto ha visto «Lo sto scrivendo…» e poi niente.",
    "",
    "  Si installano cosi', una per una:",
    ...indietro.map((f) => `    npm run funzione ${f.nome} -- --conferma`),
  ].join("\n");
}
