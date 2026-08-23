// =====================================================================
// UNA PULIZIA CANCELLA SOLO LE RIGHE CHE HA CREATO LEI
// 23/08/2026 — regola di Alessio, nata da un danno vero
// =====================================================================
// 🔴 IL FATTO. Ripulendo dopo una prova, uno script ha cancellato «l'ultima
// riga di `discounts_gifts`» invece di quella che aveva creato lui: e' finito
// via uno **sconto vero** dello scenario (112,83 €, 25 luglio). Rimesso dalla
// copia conservata nel registro delle cancellazioni, ma il punto non e' il
// danno — e' che la riga da cancellare era stata scelta con un criterio
// **che poteva pescare un dato vero**.
//
// LA REGOLA, con le parole di Alessio:
//
//   uno script di prova cancella SOLO righe di cui conosce
//   l'identificativo, perche' le ha create lui e se l'e' segnato. Mai «la
//   piu' recente», mai «l'ultima inserita», mai un criterio che potrebbe
//   pescare un dato vero. Se una pulizia non puo' identificare le proprie
//   righe con certezza, non cancella niente e lo segnala.
//
// ---------------------------------------------------------------------
// COSA GUARDA QUESTO CONTROLLO, e perche' proprio questo
// ---------------------------------------------------------------------
// ⚠️ MISURATO PRIMA DI SCRIVERLO, su 150 file. Tre forme candidate:
//
//   · cancellazione **senza nessun filtro**            → 0 casi
//   · cancellazione scelta con `order`/`limit`         → 0 casi
//   · file che contiene una cancellazione **e** una lettura «la piu'
//     recente»                                          → 1 caso, e quel
//     caso e' LEGITTIMO: la lettura e' gia' ristretta alla riga che la
//     prova ha creato (`.eq("preventivo_id", prev)`).
//
// ⚠️ E LA MISURA HA CORRETTO IL SETACCIO DUE VOLTE, guardando i casi uno
// per uno invece di fidarsi del conteggio:
//   · leggendo le catene INTERE (e non riga per riga) sono comparsi 4
//     casi «senza filtro» che erano pulizie per intervallo di date:
//     `gte`/`lte` sono filtri, e mancavano dall'elenco;
//   · e 3 casi «per recenza» che erano letture innocue (`select("id")
//     .limit(1)` per pescare un soggetto qualunque su cui provare).
//
// Da qui la forma finale: si guarda la CATENA, e «la piu' recente» vuole
// TUTTI E DUE i segni — ordinamento all'indietro **e** taglio — e nessun
// filtro. E' il «la piu' recente FRA TUTTE», cioe' esattamente lo script
// che ha fatto il danno, e lascia stare «la piu' recente FRA LE MIE».
//
// ⚠️ E GUARDA ANCHE GLI SCRIPT USA-E-GETTA (`_*.local.mjs`), che sono fuori
// dal repository e quindi non passano da nessun controllo: **e' li' che il
// danno e' successo**. Un controllo che guardasse solo il codice committato
// avrebbe dato zero, e avrebbe avuto ragione — sul posto sbagliato.
//
// ⚠️ IL LIMITE, dichiarato: questo e' un setaccio sul testo, non capisce da
// dove viene un identificativo che ha viaggiato dentro una variabile.
// Copre le forme grossolane. La difesa vera e' costruttiva ed e' in
// `tests/app/aiuto.js`: `righeMie()`, che segna gli identificativi mentre
// si creano e cancella solo quelli.
// =====================================================================

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * I filtri di PostgREST che restringono una lettura a righe precise.
 *
 * ⚠️ `gte`/`lte` CI SONO, e la prima versione del setaccio li aveva
 * dimenticati: quattro pulizie che cancellano per intervallo di date
 * risultavano «senza nessun filtro». Un intervallo restringe — e' un
 * filtro, anche se largo. (Resta vero, e sta scritto nel §8, che una data
 * lontana come marcatore smette di essere neutra il giorno in cui quella
 * dimensione acquista significato: quello e' un altro problema, non
 * questo.)
 */
const FILTRI = /\.(eq|in|match|like|ilike|neq|contains|filter|or|gte|lte|gt|lt|is)\(/;

/** Un taglio a N righe: «dammene una, non importa quale». */
const A_NUMERO = /\.limit\(/;

/**
 * «La piu' recente»: ordinamento all'indietro E taglio.
 *
 * ⚠️ SERVONO TUTTI E DUE, e la prima versione chiedeva l'uno O l'altro:
 * dava tre falsi allarmi su letture che prendono **un soggetto qualsiasi**
 * (`select("id").limit(1)` per pescare un dipendente su cui provare). Quelle
 * non cancellano niente e non pretendono di essere «l'ultima»: chiedere
 * entrambi i segni lascia stare loro e prende comunque, per intero, lo
 * script che ha fatto il danno del 23/08.
 */
const ORDINATA = /ascending:\s*false/;

const PIU_RECENTE = (catena) => ORDINATA.test(catena) && A_NUMERO.test(catena);

/**
 * Le catene di query di un file, ognuna col numero di riga in cui comincia.
 * Una catena va da `.from(` fino al punto e virgola che la chiude.
 */
export function catene(testo) {
  const righe = testo.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < righe.length; i += 1) {
    if (!righe[i].includes(".from(")) continue;
    let fine = i;
    while (fine < righe.length - 1 && !righe[fine].includes(";") && fine - i < 15) fine += 1;
    out.push({ riga: i + 1, testo: righe.slice(i, fine + 1).join(" ") });
  }
  return out;
}

/**
 * Cosa, in questo file, sceglie delle righe con un criterio che potrebbe
 * pescare un dato vero.
 *
 * @returns {{riga: number, perche: string, catena: string}[]}
 */
export function pulizieACaso(testo) {
  const fuori = [];
  const cancella = testo.includes(".delete(");

  for (const c of catene(testo)) {
    const dopoDelete = c.testo.includes(".delete(")
      ? c.testo.slice(c.testo.indexOf(".delete("))
      : null;

    // 1. Una cancellazione senza NESSUN filtro: svuota la tabella.
    if (dopoDelete !== null && !FILTRI.test(dopoDelete)) {
      fuori.push({
        riga: c.riga,
        perche: "cancella senza nessun filtro: svuoterebbe la tabella",
        catena: c.testo.trim().slice(0, 120),
      });
      continue;
    }

    // 2. Una cancellazione scelta per ordine o per numero.
    if (dopoDelete !== null && (A_NUMERO.test(c.testo) || ORDINATA.test(c.testo))) {
      fuori.push({
        riga: c.riga,
        perche: "sceglie cosa cancellare per ordine o per numero, non per identificativo",
        catena: c.testo.trim().slice(0, 120),
      });
      continue;
    }

    // 3. «La piu' recente FRA TUTTE» in un file che cancella: e' il modo
    //    in cui un identificativo che non e' tuo finisce in una delete.
    //    ⚠️ Ristretta da un filtro non conta: «la piu' recente fra le mie»
    //    e' un gesto legittimo, ed e' l'unico caso che la misura del 23/08
    //    ha trovato nel codice esistente.
    if (cancella && dopoDelete === null && PIU_RECENTE(c.testo) && !FILTRI.test(c.testo)) {
      fuori.push({
        riga: c.riga,
        perche: "prende «la piu' recente fra tutte» in un file che cancella",
        catena: c.testo.trim().slice(0, 120),
      });
    }
  }
  return fuori;
}

/** Tutti i file di codice sotto una cartella. */
export function fileDiCodice(radice) {
  const out = [];
  for (const voce of readdirSync(radice)) {
    const p = path.join(radice, voce);
    if (statSync(p).isDirectory()) out.push(...fileDiCodice(p));
    else if (/\.(mjs|js|jsx)$/.test(voce)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

/**
 * Dove guardare: le prove, gli strumenti, e **gli script usa-e-getta**.
 * ⚠️ Questi ultimi sono fuori dal repository e sono il posto dove il danno
 * del 23/08 e' successo: un controllo che li salta guarda dove non serve.
 */
export function fileDaSetacciare(radice = ".") {
  const usaEGetta = readdirSync(radice)
    .filter((f) => /^_.*\.local\.(mjs|js)$/.test(f))
    .map((f) => path.join(radice, f).replace(/\\/g, "/"));
  return [
    ...fileDiCodice(path.join(radice, "tests")),
    ...fileDiCodice(path.join(radice, "scripts")),
    ...usaEGetta,
  ];
}
