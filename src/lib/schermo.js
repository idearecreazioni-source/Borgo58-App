import { useSyncExternalStore } from "react";

// LO SCHERMO DI QUESTO APPARECCHIO — 29/10/2026, decisione di Alessio del
// 28/10: «i task sono molto grandi e non mi piace, preferirei delle scritte
// più piccole e pulite e questa cosa vale per tutte le schermate del
// gestionale su pc praticamente. Su iphone invece sono perfette».
//
// 🔴 UNA SCELTA PER APPARECCHIO, ricordata lì come il tema e come la
//    calibrazione del tocco (`touch.js`): il computer dell'ufficio, il
//    tablet della sala e il telefono vogliono misure diverse, e nessuno dei
//    tre deve cambiare quelle degli altri.
//
// 🔴 PERCHÉ IL COMPUTER ERA GRANDE: le misure del gestionale sono in
//    centimetri veri (`--pxcm`), pensate per il dito. Col mouse un
//    centimetro di riga è il doppio di quello che serve. Il profilo
//    «computer» passa le misure in punti fissi (`index.css`, sotto
//    `[data-schermo="computer"]`); gli altri tre lasciano le formule di
//    sempre, quindi il telefono resta com'era per costruzione.
//
// ⚠️ LA PRIMA VOLTA la propone il gestionale: un puntatore fine (mouse o
//    trackpad) su uno schermo da almeno 1024 punti è un computer; un dito
//    sotto i 768 è un telefono; il resto è un tablet. Poi decide Alessio,
//    dal piede del menu.

export const CHIAVE_SCHERMO = "b58-schermo";
export const SCELTE_SCHERMO = [
  { valore: "telefono", etichetta: "Telefono" },
  { valore: "mini_tablet", etichetta: "Mini tablet" },
  { valore: "tablet", etichetta: "Tablet" },
  { valore: "computer", etichetta: "Computer" },
];
const VALORI = new Set(SCELTE_SCHERMO.map((s) => s.valore));

/** Quello che il gestionale propone, guardando questo apparecchio. */
// ⚠️ DUE LARGHEZZE, NON UNA (revisione ecc:react-reviewer, 29/10): per
//    «è un computer?» conta lo SCHERMO, non la finestra — un browser aperto
//    stretto su un monitor largo resta un computer, invece di diventare un
//    tablet a una visita e un computer alla successiva. Per «è un
//    telefono?» conta la più stretta delle due (su iPhone lo schermo è
//    sempre quello verticale, anche girato).
export function propostaSchermo({ larghezza, larghezzaSchermo = larghezza, puntatoreFine } = {}) {
  if (puntatoreFine && larghezzaSchermo >= 1024) return "computer";
  if (larghezza < 768) return "telefono";
  return "tablet";
}

function comeEFatto() {
  try {
    const finestra = globalThis.innerWidth ?? 1024;
    const schermo = globalThis.screen?.width ?? finestra;
    return {
      larghezza: Math.min(schermo, finestra),
      larghezzaSchermo: schermo,
      puntatoreFine: Boolean(globalThis.matchMedia?.("(pointer: fine)").matches),
    };
  } catch {
    return { larghezza: globalThis.innerWidth ?? 1024, puntatoreFine: false };
  }
}

/** La scelta salvata su questo apparecchio, o null se non c'è. */
export function sceltaSalvata(memoria = globalThis.localStorage) {
  try {
    const s = memoria?.getItem(CHIAVE_SCHERMO);
    return VALORI.has(s) ? s : null;
  } catch {
    return null;
  }
}

export function leggiSchermo(memoria) {
  return sceltaSalvata(memoria) ?? propostaSchermo(comeEFatto());
}

function applica(schermo) {
  document.documentElement.setAttribute("data-schermo", schermo);
}

/** Prima del primo disegno, come `applyPxCm()`: nessuna schermata salta. */
export function applicaSchermo() {
  applica(leggiCorrente());
}

// Una scelta sola per tutto il gestionale: il menu è montato due volte
// (telefono e computer), stessa ragione di `tema.js`.
let sceltaCorrente = null;
const chiAscolta = new Set();

// ⚠️ La prima lettura mette anche l'attributo sulla pagina (revisione
//    ecc:react-reviewer): se il gestionale si apre senza passare da
//    `applicaSchermo()`, il menu e le misure dicono comunque la stessa cosa.
const leggiCorrente = () => {
  if (sceltaCorrente === null) {
    sceltaCorrente = leggiSchermo();
    if (globalThis.document) applica(sceltaCorrente);
  }
  return sceltaCorrente;
};

const ascolta = (avvisa) => {
  chiAscolta.add(avvisa);
  return () => chiAscolta.delete(avvisa);
};

export function scegliSchermo(nuova) {
  if (!VALORI.has(nuova)) return;
  try {
    localStorage.setItem(CHIAVE_SCHERMO, nuova);
  } catch {
    // Senza memoria vale finché la pagina resta aperta.
  }
  sceltaCorrente = nuova;
  applica(nuova);
  chiAscolta.forEach((avvisa) => avvisa());
}

export function useSchermo() {
  const scelta = useSyncExternalStore(ascolta, leggiCorrente, () => "telefono");
  return [scelta, scegliSchermo];
}
