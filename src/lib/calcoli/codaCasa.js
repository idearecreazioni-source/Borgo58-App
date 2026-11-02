// LA CODA DI CASA — la parte che DECIDE, senza telefono e senza rete
// (fase 4 di Casa, 31/10/2026). Il resto sta in src/lib/casa/.
//
// Sul telefono, anche senza rete, una foto di scontrino entra in coda. Poi,
// quando Casa risponde, la coda si svuota: prima il file, poi la spesa «da
// collocare» con la sola foto. La lettura (importo, data, fornitore) la
// fara' il PC piu' avanti: la spesa intanto e' al sicuro, e si vede in Cassa.
//
// ⚠️ OGNI VOCE HA UNA CHIAVE SUA DALL'INIZIO (crypto.randomUUID sul
// telefono): la stessa che il database usa contro i doppioni
// (20261011000004) e che da' il nome al file. Un invio interrotto si rifa'
// da capo con la stessa chiave, e non nasce ne' un secondo file ne' una
// seconda spesa.
//
// ⚠️ Una voce diventa «arrivata» SOLO quando il database ha risposto con la
// spesa: fino ad allora la foto resta nel telefono.

export const STATI = Object.freeze({
  IN_CODA: "in_coda",
  ARRIVATA: "arrivata",
});

// Dopo un errore si riprova sempre, ma sempre piu' piano: 30 s, 1 min,
// 2 min… fino a 15 minuti. Un errore non toglie mai la foto dalla coda.
const ATTESA_MINIMA_MS = 30_000;
const ATTESA_MASSIMA_MS = 15 * 60_000;

/** Quanto aspettare prima del tentativo numero `tentativi + 1`. */
export function attesaDopo(tentativi) {
  if (!tentativi) return 0;
  return Math.min(ATTESA_MINIMA_MS * 2 ** (tentativi - 1), ATTESA_MASSIMA_MS);
}

/** Una voce nuova, appena scattata. */
export function voceNuova({ chiave, foto, adesso = Date.now() }) {
  if (!chiave) throw new Error("Una voce della coda nasce con la sua chiave.");
  if (!foto) throw new Error("Una voce della coda nasce con la sua foto.");
  return { chiave, foto, creata: adesso, stato: STATI.IN_CODA, tentativi: 0, ultimoTentativo: 0, errore: null };
}

/**
 * Le voci da mandare adesso, dalla piu' vecchia. `forza` ignora l'attesa
 * dopo gli errori (il pulsante «Invia adesso»).
 */
export function daInviare(voci, { adesso = Date.now(), forza = false } = {}) {
  return voci
    .filter((v) => v.stato === STATI.IN_CODA)
    .filter((v) => forza || adesso - (v.ultimoTentativo || 0) >= attesaDopo(v.tentativi))
    .sort((a, b) => a.creata - b.creata);
}

/** Dopo un tentativo fallito: la voce resta in coda, con l'errore detto. */
export function dopoUnErrore(voce, messaggio, adesso = Date.now()) {
  return { ...voce, tentativi: (voce.tentativi || 0) + 1, ultimoTentativo: adesso, errore: String(messaggio || "errore") };
}

/**
 * Casa non si raggiunge (fuori casa senza Tailscale, modalita' aereo): NON
 * e' un errore della voce, e non allunga l'attesa. Altrimenti, rientrati a
 * casa, la foto aspetterebbe fino a un quarto d'ora per colpa dei tentativi
 * fatti per strada (revisione ecc:code-reviewer, 31/10).
 */
export function dopoCasaIrraggiungibile(voce, motivo = "Casa non si raggiunge adesso: parte appena si raggiunge.") {
  return { ...voce, errore: motivo };
}

/**
 * L'errore e' della rete (niente risposta) e non di Casa? Si guarda il tipo
 * prima del testo: fetch senza risposta e' un TypeError, e i testi cambiano
 * da browser a browser (Safari: «Load failed», «The Internet connection
 * appears to be offline»; Chrome: «Failed to fetch»).
 */
export function eDellaRete(errore) {
  if (!errore) return false;
  if (errore.name === "TypeError" || errore.name === "AbortError" || errore.name === "TimeoutError" || errore.rete) return true;
  return /Failed to fetch|Load failed|NetworkError|Internet connection|offline|network connection was lost|TypeError|tempo scaduto/i.test(
    String(errore.message || errore)
  );
}

/**
 * Dopo la risposta del database: arrivata. La foto non serve piu' nel
 * telefono — e' su Casa — e si toglie, per non riempire la memoria.
 */
export function dopoLArrivo(voce, spesaId, adesso = Date.now()) {
  return { ...voce, stato: STATI.ARRIVATA, foto: null, spesaId: spesaId ?? null, arrivata: adesso, errore: null };
}

// Le arrivate restano visibili due giorni («e' arrivata»), poi si tolgono.
const TIENI_ARRIVATE_MS = 2 * 24 * 60 * 60_000;

/** Le chiavi delle voci arrivate da abbastanza tempo da toglierle. */
export function arrivateDaTogliere(voci, adesso = Date.now()) {
  return voci.filter((v) => v.stato === STATI.ARRIVATA && adesso - (v.arrivata || 0) > TIENI_ARRIVATE_MS).map((v) => v.chiave);
}

/** Per la spia nella fascia: quante aspettano, e se qualcuna ha un errore. */
export function riassunto(voci) {
  const inCoda = voci.filter((v) => v.stato === STATI.IN_CODA);
  return {
    inCoda: inCoda.length,
    conErrore: inCoda.filter((v) => v.errore).length,
    arrivate: voci.filter((v) => v.stato === STATI.ARRIVATA).length,
  };
}

/** Il nome del file su Casa: dipende solo dalla chiave (niente doppioni). */
export const percorsoFoto = (chiave) => `da-collocare/${chiave}.jpg`;
