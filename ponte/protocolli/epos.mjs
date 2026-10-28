// LE STAMPANTI EPSON IN ePOS-PRINT (XML su HTTP) — 28/10/2026.
//
// Alternativa a ESC/POS per le TM in rete che hanno il servizio ePOS
// acceso: stesso foglio, mandato come XML a `/cgi-bin/epos/service.cgi`.
// Serve se il fornitore preferisce lasciare chiusa la porta 9100.
//
// ⚠️ Codici di errore dalla documentazione ePOS-Print pubblica di Epson,
//    da confermare il giorno del collaudo: la risposta intera finisce in
//    `lavori_stampa.esito`.

import { perXml, righeDelLavoro } from "./testo.mjs";

export const PERCORSO = "/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000";
const SPAZIO = "http://www.epson-pos.com/schemas/2011/03/epos-print";

const busta = (corpo) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">\n<s:Body>\n<epos-print xmlns="${SPAZIO}">${corpo}</epos-print>\n</s:Body>\n</s:Envelope>`;

export function foglioDiProva(contenuto) {
  const [titolo, ...righe] = righeDelLavoro(contenuto, 42);
  return busta(
    `<text align="center"/><text em="true">${perXml(titolo ?? "")}&#10;</text><text em="false"/>` +
      righe.map((r) => `<text>${perXml(r)}&#10;</text>`).join("") +
      `<feed line="3"/><cut type="feed"/>`,
  );
}

/** Un documento vuoto: non stampa niente, e la risposta dice come sta. */
export const DOMANDA_STATO = busta("");

export function leggiRisposta(xml) {
  const testo = String(xml ?? "");
  const grezzo = testo.slice(0, 2000);
  const attributo = (nome) => new RegExp(`<response\\b[^>]*\\b${nome}="([^"]*)"`, "i").exec(testo)?.[1] ?? null;
  if (!/<response\b/i.test(testo)) {
    return { riuscito: false, stato: "errore", codice: "sconosciuto", testo: "La stampante ha risposto qualcosa che non è una risposta ePOS.", grezzo };
  }
  const riuscito = /^true$/i.test(attributo("success") ?? "");
  const codice = attributo("code") || null;
  if (riuscito) return { riuscito, stato: "pronto", codice: null, testo: null, grezzo };
  if (/REC_EMPTY|RECEIPT_END|PAPER/i.test(codice ?? "")) {
    return { riuscito, stato: "carta_finita", codice: "carta_finita", testo: "La stampante dice che la carta è finita: cambia il rotolo e riprova.", grezzo };
  }
  if (/COVER/i.test(codice ?? "")) {
    return { riuscito, stato: "coperchio_aperto", codice: "coperchio_aperto", testo: "Il coperchio della stampante è aperto: chiudilo e riprova.", grezzo };
  }
  return { riuscito, stato: "errore", codice: "rifiutato", testo: `La stampante ha rifiutato il foglio${codice ? ` (${codice})` : ""}.`, grezzo };
}
