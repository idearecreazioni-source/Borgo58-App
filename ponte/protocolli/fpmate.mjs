// IL REGISTRATORE TELEMATICO EPSON FP-81 II RT, IN FPMATE — 28/10/2026.
//
// Il registratore si comanda con documenti XML mandati con POST al suo
// indirizzo (`/cgi-bin/fpmate.cgi`), e risponde con un XML che dice se è
// andata (`success`), perché no (`code`) e come sta.
//
// 🔴 IN QUESTO PASSO SOLO DUE COSE, e nessuna delle due è fiscale:
//    · il DOCUMENTO NON FISCALE (`printerNonFiscal`): un foglio stampato dal
//      registratore che non è uno scontrino, non ha numero fiscale e non va
//      all'Agenzia delle Entrate;
//    · la LETTURA DELLO STATO (`queryPrinterStatus`).
//    Niente `printerFiscalReceipt`, niente chiusura giornaliera: il database
//    non accetta lavori fiscali (vincolo `lavoro_tipo_di_questo_passo`), e
//    questo file non saprebbe nemmeno scriverli.
//
// ⚠️ NOMI DEI COMANDI E CODICI DI ERRORE DA CONFERMARE sul manuale «Fiscal
//    ePOS-Print / FPMate» che il fornitore deve consegnare: qui sono quelli
//    della documentazione Epson pubblica, non provati su un FP-81 II RT vero.
//    La risposta intera finisce in `lavori_stampa.esito`, così il giorno del
//    collaudo si legge cosa dice davvero.

import { perXml, righeDelLavoro } from "./testo.mjs";

export const PERCORSO = "/cgi-bin/fpmate.cgi?devid=local_printer&timeout=10000";
export const LARGHEZZA = 46;

const busta = (corpo) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">\n<s:Body>\n${corpo}\n</s:Body>\n</s:Envelope>`;

/** Il foglio di prova come documento NON fiscale. */
export function documentoNonFiscale(contenuto) {
  const righe = righeDelLavoro(contenuto, LARGHEZZA)
    .map((r) => `<printNormal operator="1" font="1" data="${perXml(r)}" />`)
    .join("\n");
  return busta(`<printerNonFiscal>\n<beginNonFiscal operator="1" />\n${righe}\n<endNonFiscal operator="1" />\n</printerNonFiscal>`);
}

export const DOMANDA_STATO = busta(`<printerCommand>\n<queryPrinterStatus operator="1" statusType="1" />\n</printerCommand>`);

const attributo = (xml, nome) => new RegExp(`<response\\b[^>]*\\b${nome}="([^"]*)"`, "i").exec(xml)?.[1] ?? null;

/**
 * Cosa ha risposto il registratore.
 * @returns {{riuscito: boolean, stato: string, codice: string|null, testo: string|null, grezzo: string}}
 */
export function leggiRisposta(xml) {
  const testo = String(xml ?? "");
  const grezzo = testo.slice(0, 2000);
  if (!/<response\b/i.test(testo)) {
    return { riuscito: false, stato: "errore", codice: "sconosciuto", testo: "Il registratore ha risposto qualcosa che non è una risposta FPMate.", grezzo };
  }
  const riuscito = /^true$/i.test(attributo(testo, "success") ?? "");
  const codice = attributo(testo, "code") || null;
  if (riuscito) return { riuscito, stato: "pronto", codice: null, testo: null, grezzo };
  if (/PAPER|REC_EMPTY|RECEIPT_END/i.test(codice ?? "")) {
    return { riuscito, stato: "carta_finita", codice: "carta_finita", testo: "Il registratore dice che la carta è finita: cambia il rotolo e riprova.", grezzo };
  }
  if (/COVER/i.test(codice ?? "")) {
    return { riuscito, stato: "coperchio_aperto", codice: "coperchio_aperto", testo: "Il coperchio del registratore è aperto: chiudilo e riprova.", grezzo };
  }
  return { riuscito, stato: "errore", codice: "rifiutato", testo: `Il registratore ha rifiutato il documento${codice ? ` (${codice})` : ""}.`, grezzo };
}
