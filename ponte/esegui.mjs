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

// `nonPartito`: l'apparecchio non ha ricevuto niente (non ha aperto la
// connessione, o ha detto di non essere pronto prima che partisse il
// foglio). È l'unico caso in cui una comanda si può riprovare da sola.
const esito = (stato, { codice = null, testo = null, statoApparecchio = "sconosciuto", dettaglio = null, nonPartito = false } = {}) => ({
  stato,
  errore_codice: stato === "stampato" ? null : codice ?? "sconosciuto",
  errore_testo: testo,
  stato_dispositivo: statoApparecchio,
  esito: dettaglio,
  ...(nonPartito ? { nonPartito: true } : {}),
});

// 🔴 COMANDE E BIGLIETTI CHE RIPROVANO DA SOLI (04/11/2026, chiesto da
//    Alessio dopo una comanda persa con la stampante spenta): solo se NON
//    È PARTITO NIENTE, il ponte dice «riprova» e il gestionale la rimette
//    in coda; esce alla riaccensione, una volta sola. Un incerto non si
//    riprova mai, e il fiscale nemmeno con «non è partito niente».
export const SI_RIPROVANO = ["comanda", "chiamata"];

// I lavori fiscali: lo scontrino, il suo annullo, la chiusura giornaliera.
export const FISCALI = ["scontrino", "annullo", "chiusura"];

const dallErrore = (e, { puoEssereIncerto, scontrino = false }) =>
  // Un «no» esplicito dell'apparecchio (HTTP 4xx) è un rifiuto, non un dubbio.
  e.codice === "rifiutato"
    ? esito("fallito", { codice: "rifiutato", testo: e.message, statoApparecchio: "errore" })
    : esito(e.inviato && puoEssereIncerto ? "incerto" : "fallito", {
    nonPartito: !e.inviato,
    codice: e.codice ?? "sconosciuto",
    testo: e.inviato && puoEssereIncerto
      ? scontrino
        ? `${e.message} Forse il registratore l'ha fatto, forse no: guardalo prima di rifarlo.`
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
    return esito("fallito", { codice: e.codice === "non_risponde" ? "non_risponde" : "risposta_a_meta", testo: e.message, statoApparecchio: "non_risponde", nonPartito: true });
  }
  const dettaglio = { lingua: "escpos", byte_di_stato: stato.byte };
  if (lavoro.tipo === "stato") {
    return esito("stampato", { statoApparecchio: stato.stato, testo: stato.testo, dettaglio });
  }
  if (stato.stato !== "pronto") {
    // Nemmeno qui è partito il foglio: la stampante ha detto di non essere pronta.
    return esito("fallito", { codice: stato.stato === "errore" ? "sconosciuto" : stato.stato, testo: stato.testo, statoApparecchio: stato.stato, dettaglio, nonPartito: true });
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
  // `scontrino` qui vuol dire «documento fiscale»: scontrino, annullo o
  // chiusura giornaliera seguono tutti le regole più strette.
  const scontrino = FISCALI.includes(lavoro.tipo);
  const chiusura = lavoro.tipo === "chiusura";
  let corpo;
  try {
    corpo = !stampa
      ? modulo.DOMANDA_STATO
      : lavoro.tipo === "scontrino"
        ? modulo.scontrinoFiscale(lavoro.contenuto)
        : lavoro.tipo === "annullo"
          ? modulo.annulloFiscale(lavoro.contenuto)
          : chiusura
            ? modulo.CHIUSURA_GIORNALIERA
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
      // ⚠️ La chiusura giornaliera trasmette all'Agenzia e ci mette di più:
      //    indirizzo e attesa più lunghi, perché un «fatto» in ritardo non
      //    diventi un dubbio.
      percorso: chiusura ? modulo.PERCORSO_CHIUSURA : modulo.PERCORSO,
      ...(chiusura ? { attesaRisposta: modulo.ATTESA_CHIUSURA_MS } : {}),
      corpo,
    });
  } catch (e) {
    return dallErrore(e, { puoEssereIncerto: stampa, scontrino });
  }
  const r = modulo.leggiRisposta(testo);
  const dettaglio = { lingua, risposta: r.grezzo };
  // Lo scontrino emesso lascia numero, data, ora e chiusura nell'esito:
  // è quello che il conto mostra.
  if (r.riuscito && lavoro.tipo === "scontrino") dettaglio.scontrino = modulo.datiScontrino(testo);
  if (r.riuscito && lavoro.tipo === "annullo") dettaglio.annullo = modulo.datiScontrino(testo);
  if (r.riuscito && chiusura) dettaglio.chiusura = modulo.datiChiusura(testo);
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
  const testoNo = scontrino ? `${r.testo} Prima di rifarlo guarda il display del registratore.` : r.testo;
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
  if (!["prova", "stato", "comanda", "chiamata", ...FISCALI].includes(lavoro.tipo)) {
    return esito("fallito", { codice: "rifiutato", testo: `Questo ponte non sa fare lavori «${lavoro.tipo}».` });
  }
  const lingua = linguaDi(d);
  // 🔴 Scontrino, annullo e chiusura vanno solo al registratore.
  if (FISCALI.includes(lavoro.tipo) && lingua !== "fpmate") {
    return esito("fallito", { codice: "rifiutato", testo: "Un documento fiscale si fa solo sul registratore." });
  }
  // 🔴 Una comanda va solo a una stampante delle comande: il registratore
  //    non stampa comande (e sul registratore un foglio in più è carta
  //    fiscale sprecata, o peggio).
  if (["comanda", "chiamata"].includes(lavoro.tipo) && lingua === "fpmate") {
    return esito("fallito", { codice: "rifiutato", testo: "Una comanda non si stampa sul registratore: scegli una stampante delle comande." });
  }
  let r;
  if (lingua === "escpos") r = await inEscpos(lavoro, d, rete);
  else if (lingua === "fpmate") r = await inXml(lavoro, d, rete, fpmate, "fpmate");
  else if (lingua === "epos") r = await inXml(lavoro, d, rete, epos, "epos");
  else return esito("fallito", { codice: "rifiutato", testo: `Questo ponte non sa parlare «${d.protocollo}».` });
  // Solo una comanda o un biglietto che l'apparecchio non ha ricevuto.
  const { nonPartito, ...resto } = r;
  return r.stato === "fallito" && nonPartito && SI_RIPROVANO.includes(lavoro.tipo) ? { ...resto, riprova: true } : resto;
}
