// UN LAVORO DELLA CODA, PORTATO ALL'APPARECCHIO — 28/10/2026.
//
// Riceve un lavoro come lo restituisce `ponte_prendi_lavori` e restituisce
// l'esito come lo vuole `ponte_esito_lavoro`. Non parla col gestionale:
// così si prova da solo, contro il simulatore, senza nessuna chiave.
//
// 🔴 LE TRE PAROLE DELL'ESITO (vedi rete.mjs):
//    · stampato — l'apparecchio ha detto di sì;
//    · fallito  — non è partito niente, o l'apparecchio ha detto di no:
//                 riprovare è sicuro;
//    · incerto  — è partito, e la risposta non è arrivata: forse è uscito.
//    Una lettura di stato non stampa, quindi non è mai incerta.

import * as epos from "./protocolli/epos.mjs";
import * as escpos from "./protocolli/escpos.mjs";
import * as fpmate from "./protocolli/fpmate.mjs";
import { postHttp, scambioTcp } from "./rete.mjs";
import { perchéNonSiChiama } from "./sicurezza.mjs";

/** Con quale lingua si parla a questo apparecchio. */
export function linguaDi(d) {
  if (d.protocollo === "escpos_tcp") return "escpos";
  if (d.protocollo === "fpmate_http") return "fpmate";
  if (d.protocollo === "epos_xml_http") return "epos";
  if (d.protocollo === "simulatore") return d.tipo === "registratore_fiscale" ? "fpmate" : "escpos";
  return null;
}

const esito = (stato, { codice = null, testo = null, statoApparecchio = "sconosciuto", dettaglio = null } = {}) => ({
  stato,
  errore_codice: stato === "stampato" ? null : codice ?? "sconosciuto",
  errore_testo: testo,
  stato_dispositivo: statoApparecchio,
  esito: dettaglio,
});

const dallErrore = (e, { puoEssereIncerto }) =>
  // Un «no» esplicito dell'apparecchio (HTTP 4xx) è un rifiuto, non un dubbio.
  e.codice === "rifiutato"
    ? esito("fallito", { codice: "rifiutato", testo: e.message, statoApparecchio: "errore" })
    : esito(e.inviato && puoEssereIncerto ? "incerto" : "fallito", {
    codice: e.codice ?? "sconosciuto",
    testo: e.inviato && puoEssereIncerto ? `${e.message} Forse il foglio è uscito, forse no: guarda la stampante.` : e.message,
    statoApparecchio: e.inviato && puoEssereIncerto ? "errore" : "non_risponde",
  });

async function inEscpos(lavoro, d, rete) {
  // Prima si chiede come sta: stampare con il coperchio aperto vorrebbe
  // dire un foglio che resta dentro e un «fatto» bugiardo.
  let stato;
  try {
    const risposta = await rete.scambioTcp(d.indirizzo, d.porta, escpos.DOMANDA_STATO, { byteAttesi: escpos.BYTE_RISPOSTA_STATO });
    stato = escpos.leggiStato(risposta);
  } catch (e) {
    // ⚠️ Qui non è ancora partito nessun foglio: è fallito, mai incerto.
    return esito("fallito", { codice: e.codice === "non_risponde" ? "non_risponde" : "risposta_a_meta", testo: e.message, statoApparecchio: "non_risponde" });
  }
  const dettaglio = { lingua: "escpos", byte_di_stato: stato.byte };
  if (lavoro.tipo === "stato") {
    return esito("stampato", { statoApparecchio: stato.stato, testo: stato.testo, dettaglio });
  }
  if (stato.stato !== "pronto") {
    return esito("fallito", { codice: stato.stato === "errore" ? "sconosciuto" : stato.stato, testo: stato.testo, statoApparecchio: stato.stato, dettaglio });
  }
  try {
    await rete.scambioTcp(d.indirizzo, d.porta, escpos.foglioDiProva(lavoro.contenuto), { byteAttesi: 0 });
  } catch (e) {
    return { ...dallErrore(e, { puoEssereIncerto: true }), esito: dettaglio };
  }
  return esito("stampato", { statoApparecchio: "pronto", testo: stato.testo, dettaglio });
}

async function inXml(lavoro, d, rete, modulo, lingua) {
  const corpo = lavoro.tipo === "prova"
    ? (lingua === "fpmate" ? modulo.documentoNonFiscale(lavoro.contenuto) : modulo.foglioDiProva(lavoro.contenuto))
    : modulo.DOMANDA_STATO;
  let testo;
  try {
    testo = await rete.postHttp({
      protocollo: [443, 8043].includes(Number(d.porta)) ? "https:" : "http:",
      indirizzo: d.indirizzo,
      porta: d.porta,
      percorso: modulo.PERCORSO,
      corpo,
    });
  } catch (e) {
    return dallErrore(e, { puoEssereIncerto: lavoro.tipo === "prova" });
  }
  const r = modulo.leggiRisposta(testo);
  const dettaglio = { lingua, risposta: r.grezzo };
  if (r.riuscito) return esito("stampato", { statoApparecchio: "pronto", dettaglio });
  // ⚠️ Una risposta che non è una risposta di stampa (una pagina qualunque,
  //    un apparecchio sbagliato), o un «tempo scaduto» dell'apparecchio,
  //    non dicono che il foglio non è uscito: per una prova restano un
  //    dubbio. Il registratore, se si è fermato a metà di un documento non
  //    fiscale, può restare con il documento aperto: si guarda il display.
  const nonCapita = !/<response\b/i.test(testo ?? "") || /TIMEOUT/i.test(r.grezzo.match(/code="([^"]*)"/)?.[1] ?? "");
  if (nonCapita && lavoro.tipo === "prova") {
    return esito("incerto", {
      codice: "risposta_a_meta",
      testo: `L'apparecchio ha risposto qualcosa che non dice com'è andata: forse il foglio è uscito, forse no. Guarda la stampante${lingua === "fpmate" ? " e il display del registratore" : ""}.`,
      statoApparecchio: "errore",
      dettaglio,
    });
  }
  return esito("fallito", { codice: r.codice, testo: r.testo, statoApparecchio: r.stato, dettaglio });
}

/**
 * @param {object} lavoro — come lo restituisce `ponte_prendi_lavori`
 * @param {{simulatore?: boolean, rete?: {scambioTcp: Function, postHttp: Function}}} opzioni
 */
export async function eseguiLavoro(lavoro, { simulatore = false, rete = { scambioTcp, postHttp } } = {}) {
  const d = lavoro?.dispositivo ?? {};
  const no = perchéNonSiChiama(d, { simulatore });
  if (no) return esito("fallito", { codice: "rifiutato", testo: no });
  if (!["prova", "stato"].includes(lavoro.tipo)) {
    return esito("fallito", { codice: "rifiutato", testo: `Questo ponte non sa fare lavori «${lavoro.tipo}».` });
  }
  const lingua = linguaDi(d);
  if (lingua === "escpos") return inEscpos(lavoro, d, rete);
  if (lingua === "fpmate") return inXml(lavoro, d, rete, fpmate, "fpmate");
  if (lingua === "epos") return inXml(lavoro, d, rete, epos, "epos");
  return esito("fallito", { codice: "rifiutato", testo: `Questo ponte non sa parlare «${d.protocollo}».` });
}
