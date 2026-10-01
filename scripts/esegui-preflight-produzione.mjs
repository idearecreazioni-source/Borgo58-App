// =====================================================================
// L'ORCHESTRATORE DEL PREFLIGHT DI PRODUZIONE
// 01/10/2026 · mandato M21-F — SCRITTO E PROVATO, MAI ESEGUITO
// =====================================================================
// 🔴 PERCHE' E' COSI'. La prima stesura (M21-E) portava dentro il
//    repository anche il cavo verso il database, e passava il collegamento
//    a un programma esterno come argomento: chiunque guardasse l'elenco dei
//    processi della macchina lo avrebbe visto. Qui quel cavo NON c'e' piu'.
//    Il repository non riceve, non costruisce e non trasporta nessun
//    collegamento.
//
// 🔴 COSA FA. Chiede a un ADATTATORE PROTETTO, che vive FUORI dal
//    repository ed e' lui responsabile del collegamento, una misura alla
//    volta, per NOME, scelto da un elenco fisso. Accetta come risposta solo:
//    · si'/no;
//    · un conteggio intero, da zero in su;
//    · una versione di migrazione di 14 cifre, o un elenco di versioni;
//    · null, che vuol dire «questa misura non si puo' ottenere ridotta» e
//      diventa NON VERIFICATO — mai un'approssimazione.
//    Qualunque altra cosa ferma tutto. Poi passa i campi al modulo
//    `preflight-produzione-sanitizzato.mjs`, che decide.
//
// ⚠️ NON RIPETE MAI CIO' CHE RICEVE. Se l'adattatore sbaglia, il risultato
//    dice un motivo scelto da un elenco fisso, mai il valore ricevuto ne' il
//    messaggio di un errore.
//
// ⚠️ UNA SOLA IMPORTAZIONE, il modulo che decide. Niente variabili
//    d'ambiente, niente file, niente processi, niente rete, nessuna
//    interrogazione scritta qui. La prova
//    `tests/unita/esegui-preflight-produzione.test.js` lo controlla.
// =====================================================================

import { CAMPI, ESITI, STATI, valutaPreflight } from "./preflight-produzione-sanitizzato.mjs";

/** I due consensi espliciti, gli stessi del mandato M21-E. */
export const CONSENSI = Object.freeze(["--produzione", "--confermo-sola-lettura"]);

/** Le sole misure che si possono chiedere: i 20 campi del modulo che decide. */
export const MISURE_CONSENTITE = Object.freeze(Object.keys(CAMPI));

/** I motivi di rifiuto: un elenco fisso, nessun valore dentro. */
export const MOTIVI = Object.freeze({
  CONSENSI: "consensi mancanti o argomenti inattesi",
  ADATTATORE: "adattatore mancante o di forma inattesa",
  MISURA: "una misura non e' riuscita",
  RISPOSTA: "una risposta non e' fra quelle ammesse",
});

const VERSIONE = /^[0-9]{14}$/;

/** La risposta e' ammessa per quel tipo? null e' sempre ammesso: vuol dire non ottenuta. */
function ammessa(tipo, v) {
  if (v === null) return true;
  if (tipo === "booleano") return typeof v === "boolean";
  if (tipo === "conteggio") return Number.isSafeInteger(v) && v >= 0;
  if (tipo === "versione") return typeof v === "string" && VERSIONE.test(v);
  if (tipo === "versioni") {
    return (
      Array.isArray(v) &&
      Object.getPrototypeOf(v) === Array.prototype &&
      Object.keys(v).length === v.length &&
      v.every((x) => typeof x === "string" && VERSIONE.test(x))
    );
  }
  return false;
}

function rifiuto(motivo) {
  return { esito: ESITI.NON_PRONTO, controlliNonValidi: [], motivo };
}

/**
 * L'orchestratore. `consensi` sono gli argomenti di chi lo lancia;
 * `adattatore` e' l'oggetto protetto, esterno, con `misura(nome)` e,
 * se vuole, `chiudi()`.
 */
export async function eseguiPreflight({ consensi, adattatore } = {}) {
  const args = Array.isArray(consensi) ? consensi : [];
  const consensiOk =
    args.length === CONSENSI.length && CONSENSI.every((c) => args.includes(c)) && args.every((a) => CONSENSI.includes(a));
  if (!consensiOk) return rifiuto(MOTIVI.CONSENSI);

  if (!adattatore || typeof adattatore !== "object" || typeof adattatore.misura !== "function") {
    return rifiuto(MOTIVI.ADATTATORE);
  }

  const campi = {};
  let motivo = null;
  try {
    for (const nome of MISURE_CONSENTITE) {
      // All'adattatore si passa SOLO il nome della misura, nient'altro.
      const v = await adattatore.misura(nome);
      if (!ammessa(CAMPI[nome], v)) {
        motivo = MOTIVI.RISPOSTA;
        break;
      }
      campi[nome] = Array.isArray(v) ? [...v] : v;
    }
  } catch {
    motivo = MOTIVI.MISURA;
  } finally {
    if (typeof adattatore.chiudi === "function") {
      try {
        await adattatore.chiudi();
      } catch {
        // chiudere non deve far uscire niente
      }
    }
  }
  if (motivo) return rifiuto(motivo);

  const r = valutaPreflight(campi);
  return {
    esito: r.esito,
    controlliNonValidi: r.controlli.filter((c) => c.stato !== STATI.OK).map((c) => c.id),
  };
}
