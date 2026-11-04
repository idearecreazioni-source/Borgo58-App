// IL REGISTRATORE TELEMATICO EPSON FP-81 II RT, IN FPMATE — 28/10/2026.
//
// Il registratore si comanda con documenti XML mandati con POST al suo
// indirizzo (`/cgi-bin/fpmate.cgi`), e risponde con un XML che dice se è
// andata (`success`), perché no (`code`) e come sta.
//
// 🔴 TRE COSE:
//    · il DOCUMENTO NON FISCALE (`printerNonFiscal`): un foglio stampato dal
//      registratore che non è uno scontrino, non ha numero fiscale e non va
//      all'Agenzia delle Entrate;
//    · la LETTURA DELLO STATO (`queryPrinterStatus`);
//    · dal 04/11 lo SCONTRINO FISCALE di un conto (`printerFiscalReceipt`),
//      provato sul registratore vero al collaudo: prezzi con la virgola,
//      reparto 1 per tutto; e il suo ANNULLO e la CHIUSURA GIORNALIERA (Z),
//      più sotto. Niente reso con le righe.
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

// 🔴 COME SI PAGA SUL REGISTRATORE: contanti (0, 0) e carta (2, 1), tutti e
//    due provati sul registratore vero al collaudo del 04/11.
export const PAGAMENTI = {
  contante: { descrizione: "CONTANTI", paymentType: 0, index: 0 },
  carta: { descrizione: "CARTA DI CREDITO", paymentType: 2, index: 1 },
};

// Quanto è lunga, al massimo, la descrizione di una riga sullo scontrino.
export const DESCRIZIONE_MAX = 38;

/** 12.5 → «12,50»: il registratore vuole la virgola. */
export function euro(n) {
  const v = Number(n);
  if (n === null || n === "" || !Number.isFinite(v) || v <= 0) throw new Error(`Importo non valido: «${n}».`);
  return v.toFixed(2).replace(".", ",");
}

function quantita(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`Quantità non valida: «${n}».`);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(".", ",");
}

/**
 * Lo scontrino fiscale di un conto, da `contenuto` come lo scrive
 * `accoda_scontrino`: `{ righe: [{descrizione, quantita, prezzo, reparto}],
 * pagamenti: [{mezzo, importo}] }`.
 * ⚠️ Lancia se qualcosa non va, PRIMA di mandare: il lavoro è fallito e non
 *    incerto, perché al registratore non è partito niente.
 */
export function scontrinoFiscale(contenuto) {
  const righe = Array.isArray(contenuto?.righe) ? contenuto.righe : [];
  const pagamenti = Array.isArray(contenuto?.pagamenti) ? contenuto.pagamenti : [];
  if (righe.length === 0) throw new Error("Lo scontrino non ha nessuna riga.");
  if (pagamenti.length === 0) throw new Error("Lo scontrino non dice come è stato pagato.");
  const voci = righe.map((r) => {
    // Tagliata per caratteri e non per unità UTF-16: un segno doppio non
    // si spezza a metà.
    const descrizione =
      Array.from(String(r.descrizione ?? "").replace(/\s+/g, " ").trim()).slice(0, DESCRIZIONE_MAX).join("").trim() || "Piatto";
    const reparto = Number.isInteger(Number(r.reparto)) && Number(r.reparto) > 0 ? Number(r.reparto) : 1;
    return `<printRecItem operator="1" description="${perXml(descrizione)}" quantity="${quantita(r.quantita)}" unitPrice="${euro(r.prezzo)}" department="${reparto}" justification="1" />`;
  });
  const totali = pagamenti.map((p) => {
    const modo = PAGAMENTI[p.mezzo];
    if (!modo) throw new Error(`Mezzo di pagamento sconosciuto: «${p.mezzo}».`);
    return `<printRecTotal operator="1" description="${modo.descrizione}" payment="${euro(p.importo)}" paymentType="${modo.paymentType}" index="${modo.index}" justification="1" />`;
  });
  return busta(`<printerFiscalReceipt>\n<beginFiscalReceipt operator="1" />\n${voci.join("\n")}\n${totali.join("\n")}\n<endFiscalReceipt operator="1" />\n</printerFiscalReceipt>`);
}

// 🔴 L'ANNULLO (DOCUMENTO DI ANNULLO), dal manuale Epson «ePOS Fiscal Print
//    Solution Development Guide» Rev. U, §5.6.2 (pag. 45) e SOLO l'esempio
//    §11.29 «Automatic Voiding» (pag. 96): un `printRecMessage` di tipo 4
//    con «VOID zzzz nnnn ggmmaaaa matricola», e NIENT'ALTRO.
// 🔴 MAI LE RIGHE DOPO IL VOID (collaudo del 04/11): le mandavamo come
//    rete di sicurezza (§11.30, annullo «a mano»), e su un registratore in
//    modalità MF — dove il VOID non esiste (§5.6: «Epson RT fiscal
//    printers…») — il VOID è diventato una riga di testo e le righe una
//    VENDITA NUOVA. Per questo il ponte, prima, chiede lo stato RT
//    (`DOMANDA_STATO_RT`) e non manda l'annullo a un registratore che non
//    risponde come un RT.
export const RIFERIMENTO_ANNULLO = /^VOID \d{4} \d{4} \d{8} [0-9A-Z]{11}$/;

/** L'annullo di uno scontrino, da `contenuto` come lo scrive `accoda_annullo`: solo il VOID. */
export function annulloFiscale(contenuto) {
  const riferimento = String(contenuto?.riferimento ?? "");
  if (!RIFERIMENTO_ANNULLO.test(riferimento)) throw new Error(`Riferimento dell'annullo non valido: «${riferimento}».`);
  return busta(`<printerFiscalReceipt>\n<printRecMessage operator="1" messageType="4" message="${riferimento}" />\n</printerFiscalReceipt>`);
}

// Lo stato RT (§5.9.16, pag. 61-62): un registratore in modalità RT
// risponde con `rtType` e `rtMainStatus`. Solo una domanda, niente carta.
export const DOMANDA_STATO_RT = busta(`<printerCommand>\n<queryPrinterStatus operator="1" statusType="1" />\n</printerCommand>`);

/** Se la risposta allo stato RT dice che il registratore è un RT. */
export function eUnRt(xml) {
  const testo = String(xml ?? "");
  return /<response\b[^>]*\bsuccess="true"/i.test(testo) && Boolean(elemento(testo, "rtType")) && Boolean(elemento(testo, "rtMainStatus"));
}

// 🔴 LA CHIUSURA GIORNALIERA (Z), dal manuale §5.8 e esempio §11.9: un
//    `printerFiscalReport` con `printZReport`. Trasmette all'Agenzia, quindi
//    si dà più tempo al registratore (30 secondi come nell'esempio) e
//    all'indirizzo, e il ponte aspetta ancora di più.
export const PERCORSO_CHIUSURA = "/cgi-bin/fpmate.cgi?devid=local_printer&timeout=40000";
export const ATTESA_CHIUSURA_MS = 50000;
export const CHIUSURA_GIORNALIERA = busta(`<printerFiscalReport>\n<printZReport operator="1" timeout="30000" />\n</printerFiscalReport>`);

const elemento = (xml, nome) => new RegExp(`<${nome}>\\s*([^<]*?)\\s*</${nome}>`, "i").exec(xml)?.[1] || null;

/**
 * Cosa dice la risposta del registratore di uno scontrino emesso: numero,
 * data, ora, importo e numero della chiusura giornaliera (`zRepNumber`).
 */
export function datiScontrino(xml) {
  const testo = String(xml ?? "");
  return {
    numero: elemento(testo, "fiscalReceiptNumber"),
    data: elemento(testo, "fiscalReceiptDate"),
    ora: elemento(testo, "fiscalReceiptTime"),
    importo: elemento(testo, "fiscalReceiptAmount"),
    chiusura: elemento(testo, "zRepNumber"),
    // Solo dalla versione 1.042 di fpmate.cgi (manuale §5.4.1).
    matricola: elemento(testo, "serialNumber"),
  };
}

/** Cosa dice la risposta di una chiusura giornaliera (manuale §5.8.1). */
export function datiChiusura(xml) {
  const testo = String(xml ?? "");
  return {
    chiusura: elemento(testo, "zRepNumber"),
    importo: elemento(testo, "dailyAmount"),
    matricola: elemento(testo, "serialNumber"),
  };
}

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
