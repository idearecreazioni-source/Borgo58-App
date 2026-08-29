// LA META' DI `calcoli/bozza.js` CHE TOCCA LA PAGINA.
//
// La regola sta di là ed è provabile da sola; qui c'è soltanto il modo di
// leggere i campi dalla schermata e di rimetterceli. Vedi il cappello di
// `src/lib/calcoli/bozza.js` per il perché di tutto questo.

import { cosaSiConserva, nomeDelCampo, numera, daConservare, siRimette } from "./calcoli/bozza";

// ⚠️ `sessionStorage` E NON `localStorage`, ed è una scelta di merito.
// Quello che si sta scrivendo appartiene a **questa** apertura del
// gestionale: una ricarica lo ritrova, chiudere l'app lo lascia andare. Con
// la memoria lunga bisognerebbe inventare una scadenza, spazzare le vecchie
// e decidere cosa fare di una bozza di tre giorni fa trovata sopra dei dati
// nel frattempo cambiati. Qui quel problema non esiste.
const CHIAVE = "borgo58.bozza";

// Per quanti secondi si insiste a rimettere i valori dopo una ricarica.
//
// ⚠️ NON È UNA PRUDENZA: i campi di una schermata compaiono quando i dati
// arrivano dal database, cioè **dopo** che la pagina è pronta. Rimettendoli
// una volta sola si arriverebbe sempre troppo presto.
const SECONDI_DI_INSISTENZA = 5;
const OGNI_MS = 250;

const ascoltatori = new Set();
let ripresa = null; // { quanti } quando qualcosa è stato rimesso

export function ripresaInCorso() {
  return ripresa;
}

export function ascoltaRipresa(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

function annuncia(v) {
  ripresa = v;
  for (const fn of ascoltatori) fn(v);
}

/** La schermata su cui siamo: indirizzo e basta, senza l'ancora. */
const doveSiamo = () => window.location.pathname + window.location.search;

/**
 * Descrive i campi della pagina nella forma che la regola sa leggere.
 *
 * `attorno` è la parola che sta accanto al campo — il suo suggerimento, o
 * l'etichetta, o il titolo della colonna. Serve a **non** rimettere un
 * valore nel campo sbagliato quando l'ordine cambia.
 */
function campiDellaPagina() {
  const elementi = [...document.querySelectorAll("input, textarea, select")];
  return elementi.map((el) => ({
    el,
    tipo: (el.getAttribute("type") || el.tagName.toLowerCase()).toLowerCase(),
    nome: el.getAttribute("name") || el.getAttribute("id") || "",
    soloLettura: el.readOnly === true,
    spento: el.disabled === true,
    fuoriBozza: !!el.closest("[data-senza-bozza]"),
    valore: el.value,
    spuntato: el.checked === true,
    attorno: (
      el.getAttribute("placeholder") ||
      el.getAttribute("aria-label") ||
      el.closest("label")?.textContent ||
      ""
    )
      .trim()
      .slice(0, 40),
  }));
}

/** Fotografa quello che c'è scritto adesso. */
export function fotografa() {
  try {
    const campi = cosaSiConserva(campiDellaPagina());
    if (Object.keys(campi).length === 0) {
      sessionStorage.removeItem(CHIAVE);
      return;
    }
    sessionStorage.setItem(
      CHIAVE,
      JSON.stringify({ dove: doveSiamo(), quando: Date.now(), campi })
    );
  } catch {
    // Finestra privata, spazio esaurito: si perde la rete di sicurezza, mai
    // il gestionale. Non c'è niente da dire a chi sta scrivendo.
  }
}

export function dimenticaLaBozza() {
  try {
    sessionStorage.removeItem(CHIAVE);
  } catch { /* vedi sopra */ }
  annuncia(null);
}

/**
 * Scrive un valore in un campo COME SE LO AVESSE DIGITATO UNA MANO.
 *
 * ⚠️ NON BASTA `el.value = …`. React tiene il proprio conto di cosa c'è nei
 * campi, e un valore messo così non gli arriva: a schermo comparirebbe e al
 * salvataggio partirebbe quello di prima. Si passa dal metodo originale del
 * browser e poi si annuncia il cambiamento, che è la stessa strada scritta
 * in CLAUDE.md §9 per verificare le schermate dal vivo.
 */
function scriviComeUnaMano(el, valore) {
  const prototipo =
    el instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : el instanceof window.HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
  if (typeof valore === "boolean") {
    const set = Object.getOwnPropertyDescriptor(prototipo, "checked")?.set;
    if (!set || el.checked === valore) return false;
    set.call(el, valore);
  } else {
    const set = Object.getOwnPropertyDescriptor(prototipo, "value")?.set;
    if (!set || el.value === valore) return false;
    set.call(el, valore);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/** Rimette quello che si stava scrivendo. Torna quanti campi ha ripreso. */
function rimetti(campi) {
  const presenti = numera(campiDellaPagina().filter(daConservare));
  let quanti = 0;
  for (const c of presenti) {
    const atteso = campi[nomeDelCampo(c)];
    if (atteso === undefined) continue;
    if (scriviComeUnaMano(c.el, atteso)) quanti += 1;
  }
  return quanti;
}

/**
 * Si accende una volta sola, all'avvio della pagina.
 *
 * ⚠️ NON SI ACCENDE quando si passa da una schermata all'altra dentro il
 * gestionale — lì la pagina non riparte, quindi questo codice non gira
 * affatto. È voluto: la ripresa deve rispondere a una **ricarica**, non a
 * un giro nel menu.
 */
export function accendiLaBozza() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // --- si fotografa ---
  let attesa = null;
  const fotografaFraPoco = () => {
    if (attesa) clearTimeout(attesa);
    attesa = setTimeout(fotografa, 400);
  };
  document.addEventListener("input", fotografaFraPoco, true);
  document.addEventListener("change", fotografaFraPoco, true);
  // ⚠️ Questi due sono quelli che contano davvero: sono ciò che il browser
  // manda **prima** di lasciare la pagina in secondo piano, cioè un istante
  // prima della ricarica che ci interessa. L'attesa di 0,4 secondi qui non
  // si aspetta: si fotografa subito.
  window.addEventListener("pagehide", fotografa);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") fotografa();
  });

  // --- si rimette ---
  let foto = null;
  try {
    foto = JSON.parse(sessionStorage.getItem(CHIAVE) || "null");
  } catch { foto = null; }

  const esito = siRimette(foto, doveSiamo(), Date.now());
  if (!esito.rimetti) {
    if (foto) dimenticaLaBozza();
    return;
  }

  let ripresi = 0;
  let unaManoHaToccato = false;
  const smetti = () => { unaManoHaToccato = true; };
  document.addEventListener("keydown", smetti, { once: true });
  document.addEventListener("pointerdown", smetti, { once: true });

  const fine = Date.now() + SECONDI_DI_INSISTENZA * 1000;
  const battito = setInterval(() => {
    // ⚠️ Si insiste finché nessuno tocca niente: i dati che arrivano dal
    // database possono sovrascrivere i campi **dopo** che li abbiamo
    // rimessi, e allora vanno rimessi di nuovo. Appena una mano si muove si
    // smette, perché da lì in poi comanda lei.
    if (unaManoHaToccato || Date.now() > fine) {
      clearInterval(battito);
      document.removeEventListener("keydown", smetti);
      document.removeEventListener("pointerdown", smetti);
      if (ripresi > 0) annuncia({ quanti: ripresi });
      // La fotografia ha fatto il suo mestiere: da qui in poi comanda
      // quello che c'è sullo schermo.
      try { sessionStorage.removeItem(CHIAVE); } catch { /* vedi sopra */ }
      return;
    }
    ripresi = Math.max(ripresi, rimetti(foto.campi));
  }, OGNI_MS);
}
