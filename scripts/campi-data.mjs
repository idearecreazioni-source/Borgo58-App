// =====================================================================
// LE CASELLE DI DATA E ORA HANNO UNA LARGHEZZA DICHIARATA
// 21/09/2026 — mandato «interfaccia operativa desktop/mobile», punto 2
// =====================================================================
// 🔴 PERCHE' ESISTE. L'11/09/2026 il mandato «telefono ordinato» ha misurato
// il difetto e ha scritto la cura in `src/index.css`: una casella di data
// chiede circa 11,5 volte la grandezza del suo testo, una di ora circa 7,5,
// un mese 12,5 — quindi `.campo-data`, `.campo-ora`, `.campo-mese`. Senza,
// Chrome la stringe e **taglia la data**, Safari la tiene larga e **la fa
// uscire dal riquadro**.
//
// ⚠️ MA LA CURA ERA STATA APPLICATA A META', e non si vedeva: rileggendo il
// codice ogni casella sembra a posto, perche' la classe che manca non
// produce nessun errore. Misurato il 21/09 su tutto `src/`:
//
//     68 caselle di data, ora o mese
//     31 con la larghezza dichiarata
//     37 senza  ← una su due
//
// ⚠️ E NON E' UNA DIMENTICANZA DA RECUPERARE UNA VOLTA: la prossima casella
// scritta senza classe non fara' diventare rosso niente. Per questo qui c'e'
// un setaccio e non un elenco — `caselleSenzaLarghezza()` legge i file veri e
// nomina chi manca, e la prova pura in `tests/unita/campi-data.test.js`
// diventa rossa da sola il giorno che ne ricompare una.
//
// ---------------------------------------------------------------------
// IL SETACCIO E' STATO PROVATO SU CASI DI RISPOSTA NOTA
// ---------------------------------------------------------------------
// 🔴 La prima stesura ritagliava il tag con un'espressione regolare non
// ingorda fino al primo «>»: e `onChange={(e) => ...}` contiene un «>», cosi'
// il tag si chiudeva prima della classe e **31 caselle sane risultavano
// malate**. La seconda non saltava i commenti, e ha classificato come casella
// una frase che *parla* di `<input type="date">` in `PublicReservationForm`.
//
// ⚠️ E' la regola del 26/08 («un misuratore nuovo si prova prima su un caso
// di cui si conosce gia' la risposta»): i due sbagli sono emersi solo
// confrontando due righe di cui la risposta era gia' sotto gli occhi.
// Per questo il ritaglio tiene il conto di graffe, virgolette e commenti, e
// la prova pura lo esercita su tutti e due i casi.
// =====================================================================

import { readFileSync } from "node:fs";

/** La classe che dichiara la larghezza di ciascun tipo di casella. */
export const LARGHEZZA_ATTESA = {
  date: "campo-data",
  time: "campo-ora",
  month: "campo-mese",
};

/**
 * Sostituisce i soli COMMENTI con spazi, conservando la lunghezza del testo
 * (quindi righe e posizioni restano quelle vere). Le stringhe si
 * attraversano senza toccarle — dentro ci sono le classi e i `type="date"`
 * che si stanno cercando — ma vanno attraversate lo stesso: un indirizzo
 * `https://…` dentro una stringa comincia con due barre, e preso per
 * commento cancellerebbe il resto della riga.
 */
export function senzaCommenti(testo) {
  const fuori = [...testo];
  let i = 0;
  const cancella = (da, a) => {
    for (let k = da; k < a && k < fuori.length; k++) if (fuori[k] !== "\n" && fuori[k] !== "\r") fuori[k] = " ";
  };
  while (i < testo.length) {
    const c = testo[i];
    const d = testo[i + 1];
    if (c === "/" && d === "/") {
      const fine = testo.indexOf("\n", i);
      cancella(i, fine === -1 ? testo.length : fine);
      i = fine === -1 ? testo.length : fine;
      continue;
    }
    if (c === "/" && d === "*") {
      const fine = testo.indexOf("*/", i + 2);
      const a = fine === -1 ? testo.length : fine + 2;
      cancella(i, a);
      i = a;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let k = i + 1;
      while (k < testo.length && !(testo[k] === c && testo[k - 1] !== "\\")) k++;
      i = k + 1;
      continue;
    }
    i++;
  }
  return fuori.join("");
}

/**
 * Ritaglia il tag che comincia a `inizio`, tenendo conto delle graffe: un
 * `onChange={(e) => ...}` contiene un «>» che non chiude niente.
 */
export function tagDa(testo, inizio) {
  let i = inizio;
  let graffe = 0;
  let apice = null;
  while (i < testo.length) {
    const c = testo[i];
    if (apice) {
      if (c === apice && testo[i - 1] !== "\\") apice = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      apice = c;
      i++;
      continue;
    }
    if (c === "{") graffe++;
    else if (c === "}") graffe--;
    else if (c === ">" && graffe === 0) return testo.slice(inizio, i + 1);
    i++;
  }
  return testo.slice(inizio);
}

/**
 * Una larghezza e' «dichiarata» in tre forme, e valgono tutte e tre:
 *   · la classe misurata dell'11/09 (`campo-data`, `campo-ora`, `campo-mese`);
 *   · una larghezza scritta a mano in Tailwind (`w-40`, `w-[11rem]`);
 *   · una larghezza scritta nello stile (`largoAlmeno(2.6)` della scheda
 *     dell'Agenda, che ha margini piu' stretti delle altre schermate e per
 *     questo ha una misura sua — vedi il commento di `.campo-ora`).
 *
 * ⚠️ Le ultime due contano come dichiarate perche' il difetto da chiudere e'
 *    la larghezza **lasciata al browser**, non una misura diversa dalla
 *    nostra: sostituire d'ufficio una misura presa altrove sarebbe cambiare
 *    una decisione senza rimisurarla.
 */
export function larghezzaDichiarata(tag, tipo) {
  if (tag.includes(LARGHEZZA_ATTESA[tipo])) return true;
  // ⚠️ La classe deve COMINCIARE per `w-`: `min-w-0` e `max-w-full` sono il
  //    contrario di una larghezza dichiarata — dicono quanto puo' stringersi,
  //    non quanto e' larga. Cercando `\bw-` ci cascavano dentro tutti e due,
  //    perche' il trattino che li precede vale come confine di parola.
  if (/(^|[\s"'`{])w-(\d|\[|fit|min|max)/.test(tag)) return true;
  if (/\b(minWidth|width)\s*:/.test(tag) || /largoAlmeno\s*\(/.test(tag)) return true;
  return false;
}

/**
 * Le caselle di data/ora/mese di un file, ognuna con la riga e se porta o no
 * la sua larghezza dichiarata.
 */
export function caselleDelFile(percorso, contenuto) {
  const pulito = senzaCommenti(contenuto);
  const trovate = [];
  for (let i = pulito.indexOf("<input"); i !== -1; i = pulito.indexOf("<input", i + 1)) {
    const tag = tagDa(pulito, i);
    const tipo = /type="(date|time|month)"/.exec(tag);
    if (!tipo) continue;
    trovate.push({
      file: percorso,
      riga: pulito.slice(0, i).split("\n").length,
      tipo: tipo[1],
      dichiarata: larghezzaDichiarata(tag, tipo[1]),
    });
  }
  return trovate;
}

/** Le caselle senza larghezza dichiarata, su un elenco di file. */
export function caselleSenzaLarghezza(file, leggi = (f) => readFileSync(f, "utf8")) {
  return file.flatMap((f) => caselleDelFile(f, leggi(f))).filter((c) => !c.dichiarata);
}

/** Quante ne restano senza larghezza, file per file. */
export function contaPerFile(caselle) {
  const per = {};
  for (const c of caselle) per[c.file] = (per[c.file] ?? 0) + 1;
  return per;
}

// =====================================================================
// LO STATO DI PARTENZA CONGELATO — 21/09/2026
// =====================================================================
// 🔴 PERCHE' SI CONGELA INVECE DI PRETENDERE ZERO. Al 21/09 le caselle senza
// larghezza dichiarata erano **29 su 67**. Il mandato di oggi tocca Agenda,
// Sala, Comande, Cassa e la schermata iniziale: li' sono state chiuse tutte
// (8, piu' quella del componente riutilizzabile `CampoGiornata`, che ora la
// porta da se' e i suoi tre chiamanti non la possono piu' dimenticare).
// Restano **21**, tutte in schermate fuori dal perimetro di oggi.
//
// ⚠️ Pretendere zero adesso vorrebbe dire entrare in dieci moduli che il
// mandato vieta; non sorvegliare niente vorrebbe dire che le 21 diventano 25
// senza che nessuno se ne accorga — che e' esattamente come sono diventate
// 29. Quindi si congela quello che c'e' e si vieta che CRESCA, come il
// progetto fa gia' con i vincoli muti e con le funzioni senza portiere.
//
// ⚠️ Si conta PER FILE e non per riga: il numero di riga cambia a ogni
// modifica vicina, e un elenco che diventa rosso quando qualcuno sposta una
// riga e' un elenco che si impara a disattivare.
//
// COME SI TOGLIE UNA VOCE: si aggiunge la classe misurata alla casella, si
// rimisura, e si abbassa (o si toglie) la riga qui sotto. Il numero non si
// abbassa mai «per far passare la prova»: si abbassa perche' e' sceso.
export const SENZA_LARGHEZZA_NOTE = {
  "src/pages/calendario/ReservationsList.jsx": 1,
  "src/pages/documenti/DocumentoDetail.jsx": 2,
  "src/pages/documenti/PostaInArrivo.jsx": 1,
  "src/pages/fatture/FattureFornitoriHome.jsx": 1,
  "src/pages/fiscale/Deducibilita.jsx": 1,
  "src/pages/fiscale/SimulatoreFiscale.jsx": 1,
  "src/pages/haccp/ManualeCompleto.jsx": 2,
  "src/pages/haccp/RaccoltaPropria.jsx": 1,
  "src/pages/magazzino/Allineamento.jsx": 2,
  "src/pages/magazzino/Cantina.jsx": 2,
  "src/pages/magazzino/Fermi.jsx": 1,
  "src/pages/magazzino/ListaSpesa.jsx": 1,
  "src/pages/magazzino/Produzioni.jsx": 1,
  "src/pages/personale/DipendenteDetail.jsx": 2,
  "src/pages/public/PublicReservationForm.jsx": 1,
  "src/pages/ricettario/MenuForm.jsx": 1,
};

/**
 * I file che hanno PIU' caselle senza larghezza di quante lo stato di
 * partenza ne ammetta — cioe' quelli in cui il difetto e' cresciuto.
 */
export function cresciuti(perFile, note = SENZA_LARGHEZZA_NOTE) {
  return Object.entries(perFile)
    .filter(([f, n]) => n > (note[f] ?? 0))
    .map(([f, n]) => `${f}: ${n} senza larghezza, ne erano ammesse ${note[f] ?? 0}`);
}
