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

const dallErrore = (e, { puoEssereIncerto, scontrino = false }) =>
  // Un «no» esplicito dell'apparecchio (HTTP 4xx) è un rifiuto, non un dubbio.
  e.codice === "rifiutato"
    ? esito("fallito", { codice: "rifiutato", testo: e.message, statoApparecchio: "errore" })
    : esito(e.inviato && puoEssereIncerto ? "incerto" : "fallito", {
    codice: e.codice ?? "sconosciuto",
    testo: e.inviato && puoEssereIncerto
      ? scontrino
        ? `${e.message} Forse lo scontrino è uscito, forse no: guarda il registratore prima di rifarlo.`
        : `${e.message} Forse il foglio è uscito, forse no: guarda la stampante.`
      : e.message,
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
    const foglio = lavoro.tipo === "prova" ? escpos.foglioDiProva(lavoro.contenuto) : escpos.foglioComanda(lavoro.contenuto);
    await rete.scambioTcp(d.indirizzo, d.porta, foglio, { byteAttesi: 0 });
  } catch (e) {
    return { ...dallErrore(e, { puoEssereIncerto: true }), esito: dettaglio };
  }
  return esito("stampato", { statoApparecchio: "pronto", testo: stato.testo, dettaglio });
}

async function inXml(lavoro, d, rete, modulo, lingua) {
  const stampa = lavoro.tipo !== "stato";
  const scontrino = lavoro.tipo === "scontrino";
  let corpo;
  try {
    corpo = !stampa
      ? modulo.DOMANDA_STATO
      : scontrino
        ? modulo.scontrinoFiscale(lavoro.contenuto)
        : lavoro.tipo === "prova"
          ? (lingua === "fpmate" ? modulo.documentoNonFiscale(lavoro.contenuto) : modulo.foglioDiProva(lavoro.contenuto))
          : modulo.foglioComanda(lavoro.contenuto);
  } catch (e) {
    // ⚠️ Il documento non si è potuto comporre: non è partito niente.
    return esito("fallito", { codice: "rifiutato", testo: `Il ponte non ha potuto comporre il documento: ${e.message}`, statoApparecchio: "sconosciuto" });
  }
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
    return dallErrore(e, { puoEssereIncerto: stampa, scontrino });
  }
  const r = modulo.leggiRisposta(testo);
  const dettaglio = { lingua, risposta: r.grezzo };
  // Lo scontrino emesso lascia numero, data, ora e chiusura nell'esito:
  // è quello che il conto mostra.
  if (r.riuscito && scontrino) dettaglio.scontrino = modulo.datiScontrino(testo);
  if (r.riuscito) return esito("stampato", { statoApparecchio: "pronto", dettaglio });
  // ⚠️ Una risposta che non è una risposta di stampa (una pagina qualunque,
  //    un apparecchio sbagliato), o un «tempo scaduto» dell'apparecchio,
  //    non dicono che il foglio non è uscito: per una prova restano un
  //    dubbio. Il registratore, se si è fermato a metà di un documento non
  //    fiscale, può restare con il documento aperto: si guarda il display.
  const codiceGrezzo = r.grezzo.match(/<response\b[^>]*\bcode="([^"]*)"/i)?.[1] ?? "";
  // 🔴 PER UNO SCONTRINO, «NON È USCITO» SOLO CON UNA RISPOSTA INTERA CHE
  //    DICE NO PER UN MOTIVO CHE FERMA LA STAMPA (carta, coperchio, spento)
  //    — revisione del codice, 04/11. Una risposta tagliata (`<response
  //    suc` senza la fine) o un codice che non conosciamo restano un dubbio:
  //    confonderli con un «no» vorrebbe dire uno scontrino rifatto due volte.
  const noSicuro =
    /<\/response>/i.test(testo ?? "") &&
    /<response\b[^>]*\bsuccess="false"/i.test(testo ?? "") &&
    /PAPER|REC_EMPTY|RECEIPT_END|COVER|OFFLINE/i.test(codiceGrezzo);
  const nonCapita = !/<response\b/i.test(testo ?? "") || /TIMEOUT/i.test(codiceGrezzo) || (scontrino && !noSicuro);
  if (nonCapita && stampa) {
    return esito("incerto", {
      codice: "risposta_a_meta",
      testo: `L'apparecchio ha risposto qualcosa che non dice com'è andata: forse il foglio è uscito, forse no. Guarda la stampante${lingua === "fpmate" ? " e il display del registratore" : ""}.`,
      statoApparecchio: "errore",
      dettaglio,
    });
  }
  // ⚠️ Un «no» esplicito del registratore su uno scontrino: non riprova
  //    nessuno, e prima di rifarlo si guarda il display (un documento
  //    fiscale fermato a metà può restare aperto).
  const testoNo = scontrino ? `${r.testo} Prima di rifare lo scontrino guarda il display del registratore.` : r.testo;
  return esito("fallito", { codice: r.codice, testo: testoNo, statoApparecchio: r.stato, dettaglio });
}

/**
 * @param {object} lavoro — come lo restituisce `ponte_prendi_lavori`
 * @param {{simulatore?: boolean, rete?: {scambioTcp: Function, postHttp: Function}}} opzioni
 */
export async function eseguiLavoro(lavoro, { simulatore = false, rete = { scambioTcp, postHttp } } = {}) {
  const d = lavoro?.dispositivo ?? {};
  const no = perchéNonSiChiama(d, { simulatore });
  if (no) return esito("fallito", { codice: "rifiutato", testo: no });
  if (!["prova", "stato", "comanda", "chiamata", "scontrino"].includes(lavoro.tipo)) {
    return esito("fallito", { codice: "rifiutato", testo: `Questo ponte non sa fare lavori «${lavoro.tipo}».` });
  }
  const lingua = linguaDi(d);
  // 🔴 Uno scontrino va solo al registratore.
  if (lavoro.tipo === "scontrino" && lingua !== "fpmate") {
    return esito("fallito", { codice: "rifiutato", testo: "Uno scontrino fiscale si emette solo sul registratore." });
  }
  // 🔴 Una comanda va solo a una stampante delle comande: il registratore
  //    non stampa comande (e sul registratore un foglio in più è carta
  //    fiscale sprecata, o peggio).
  if (["comanda", "chiamata"].includes(lavoro.tipo) && lingua === "fpmate") {
    return esito("fallito", { codice: "rifiutato", testo: "Una comanda non si stampa sul registratore: scegli una stampante delle comande." });
  }
  if (lingua === "escpos") return inEscpos(lavoro, d, rete);
  if (lingua === "fpmate") return inXml(lavoro, d, rete, fpmate, "fpmate");
  if (lingua === "epos") return inXml(lavoro, d, rete, epos, "epos");
  return esito("fallito", { codice: "rifiutato", testo: `Questo ponte non sa parlare «${d.protocollo}».` });
}
