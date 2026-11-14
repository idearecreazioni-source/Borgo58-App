/**
 * Le risposte dello SdI alle fatture AI CLIENTI (13/11/2026, pezzo 4 di 5).
 *
 * Dopo che una fattura parte dalla PEC (pezzo 3), lo SdI risponde alla
 * stessa PEC con un file XML firmato, il cui nome dice cos'è:
 *
 *   IT01343950869_0000A_RC_001.xml   RicevutaConsegna         → consegnata
 *   IT01343950869_0000A_MC_001.xml   NotificaMancataConsegna  → messa a
 *                                    disposizione nel cassetto fiscale del
 *                                    cliente: per il fisco è emessa
 *   IT01343950869_0000A_NS_001.xml   NotificaScarto           → scartata,
 *                                    con l'elenco degli errori
 *
 * (AT, NE, DT riguardano le fatture alla Pubblica Amministrazione: si
 * riconoscono e si archiviano, ma non cambiano niente.)
 *
 * ⚠️ IL TIPO SI LEGGE DAL CONTENUTO, NON DAL NOME: il nome serve a capire
 *    che il file va aperto, poi decide la radice dell'XML. Un file che si
 *    chiama _RC_ ma dentro è altro non vale come consegna.
 *
 * ⚠️ NIENTE MODELLO: sono documenti strutturati, si leggono campo per
 *    campo come le fatture (`fatturaPA.js`). Non costano niente e non si
 *    possono leggere male.
 *
 * Le prove: `tests/unita/ricevute-sdi.test.js`, con ricevute finte passate
 * anche dallo schema ufficiale `MessaggiTypes_v1.1.xsd`.
 */

import { leggiXml, xmlDaFile } from "./fatturaPA.js";

/** Il nome di una ricevuta dello SdI per una fattura che abbiamo mandato. */
const NOME = /^IT[A-Z0-9]{11,28}_[A-Za-z0-9]{1,5}_(RC|NS|MC|AT|NE|DT)_\d{3}\.xml$/i;

export function eNomeRicevutaSdi(nome) {
  return NOME.test(String(nome ?? "").trim());
}

const TIPI = {
  RicevutaConsegna: "RC",
  NotificaScarto: "NS",
  NotificaMancataConsegna: "MC",
  AttestazioneTrasmissioneFattura: "AT",
  NotificaEsito: "NE",
  NotificaDecorrenzaTermini: "DT",
};

function figlio(el, nome) {
  return el?.children?.find((c) => c.localName === nome) ?? null;
}
function testo(el, nome) {
  const t = figlio(el, nome)?.textContent?.replace(/\s+/g, " ").trim();
  return t || null;
}

/**
 * La ricevuta letta, oppure null se il file non è una ricevuta dello SdI.
 * @param {Uint8Array|string} contenuto i byte del file (anche firmato .p7m) o il testo XML
 * @returns {null | {tipo: string, nomeFile: string, identificativoSdi: string|null,
 *   ricezione: string|null, consegna: string|null, errori: {codice: string, descrizione: string}[],
 *   descrizione: string|null, note: string|null}}
 */
export function leggiRicevutaSdi(contenuto) {
  let radice;
  try {
    const xml = typeof contenuto === "string" ? contenuto : xmlDaFile(contenuto);
    radice = leggiXml(xml);
  } catch {
    return null;
  }
  const tipo = TIPI[radice.localName];
  if (!tipo) return null;
  const nomeFile = testo(radice, "NomeFile");
  if (!nomeFile) return null;
  const lista = figlio(radice, "ListaErrori");
  const errori = (lista?.children ?? [])
    .filter((e) => e.localName === "Errore")
    .map((e) => ({ codice: testo(e, "Codice") ?? "?", descrizione: testo(e, "Descrizione") ?? "" }));
  return {
    tipo,
    nomeFile,
    identificativoSdi: testo(radice, "IdentificativoSdI"),
    ricezione: testo(radice, "DataOraRicezione"),
    consegna: testo(radice, "DataOraConsegna"),
    errori,
    descrizione: testo(radice, "Descrizione"),
    note: testo(radice, "Note"),
  };
}

/** Cosa vuol dire per la fattura, in italiano: lo stato nuovo e la nota da tenere. */
export function esitoDellaRicevuta(r) {
  if (!r) return null;
  if (r.tipo === "RC") {
    return { stato: "consegnata", nota: "Consegnata al cliente dallo SdI." };
  }
  if (r.tipo === "MC") {
    return {
      stato: "messa_a_disposizione",
      nota:
        "Lo SdI non è riuscito a consegnarla al cliente e l'ha messa nel suo cassetto fiscale: per il fisco è emessa. " +
        "Conviene mandargliene una copia (PDF o stampa)." +
        (r.descrizione ? ` Motivo dello SdI: ${r.descrizione}` : ""),
    };
  }
  if (r.tipo === "NS") {
    const elenco = r.errori.length
      ? r.errori.map((e) => `${e.codice} ${e.descrizione}`.trim()).join("; ")
      : "lo SdI non ha detto perché";
    return {
      stato: "scartata",
      nota: `Scartata dallo SdI: ${elenco}. Correggila e premi «Rimanda allo SdI»: il numero resta lo stesso.`,
    };
  }
  // AT, NE, DT: fatture alla Pubblica Amministrazione, qui non cambiano niente.
  return { stato: null, nota: `Ricevuta ${r.tipo} dello SdI: archiviata, non cambia la fattura.` };
}
