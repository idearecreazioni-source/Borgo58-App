// COME IL PONTE PARLA CON UN APPARECCHIO — 28/10/2026.
//
// 🔴 LA DOMANDA CHE CONTA NON È «È ANDATA BENE?», MA «HO GIÀ MANDATO?».
//    Se la connessione non si apre, l'apparecchio non ha ricevuto niente:
//    il lavoro è FALLITO, e riprovarlo è sicuro. Se invece i byte sono
//    partiti e la risposta non arriva, non si sa se il foglio è uscito: il
//    lavoro è INCERTO, e non si riprova da soli. Il giorno degli scontrini,
//    confondere i due vorrebbe dire un documento fiscale doppio.
//    Per questo qui si usano `net` e `http` di Node e non `fetch`: `fetch`
//    non dice se la connessione si era aperta prima di un errore.
//
// ⚠️ OGNI ATTESA HA UN OROLOGIO, anche quella in cui non si aspetta una
//    risposta: una stampante col buffer pieno può tenere aperta una
//    connessione per sempre, e un ponte fermo lì non stampa più niente
//    (revisione del codice, 28/10).

import http from "node:http";
import https from "node:https";
import net from "node:net";

export const ATTESA_CONNESSIONE_MS = 3000;
// ⚠️ Più lunga dei 10 secondi che si chiedono all'apparecchio
//    (`timeout=10000` nell'indirizzo FPMate ed ePOS): se l'apparecchio
//    rinuncia e risponde «no», la risposta deve arrivare prima che il ponte
//    smetta di aspettarla — altrimenti un rifiuto vero diventa un dubbio.
export const ATTESA_RISPOSTA_MS = 15000;
// Dopo aver consegnato un foglio ESC/POS, quanto si aspetta che la
// stampante chiuda da sé prima di chiudere noi.
const ATTESA_CHIUSURA_MS = 1500;

/** Un errore che sa dire se qualcosa era già partito. */
export class ErroreDiRete extends Error {
  constructor(messaggio, { inviato, codice }) {
    super(messaggio);
    this.inviato = inviato;
    this.codice = codice;
  }
}

const nonRisponde = (dettaglio) =>
  new ErroreDiRete(`L'apparecchio non risponde${dettaglio ? ` (${dettaglio})` : ""}.`, { inviato: false, codice: "non_risponde" });
const aMeta = (messaggio) => new ErroreDiRete(messaggio, { inviato: true, codice: "risposta_a_meta" });

/**
 * Manda dei byte su una connessione TCP e aspetta `byteAttesi` byte di
 * risposta. Con `byteAttesi = 0` consegna e chiude, e risolve quando la
 * connessione si è chiusa (o dopo un attimo, se la stampante la tiene).
 */
export function scambioTcp(indirizzo, porta, dati, { byteAttesi = 0, attesaConnessione = ATTESA_CONNESSIONE_MS, attesaRisposta = ATTESA_RISPOSTA_MS } = {}) {
  return new Promise((risolvi, rifiuta) => {
    let connesso = false;
    let consegnato = false;
    let finito = false;
    const ricevuti = [];
    let quanti = 0;
    let orologio = null;
    let presa = null;

    const chiudi = (esito, errore) => {
      if (finito) return;
      finito = true;
      clearTimeout(orologio);
      presa?.destroy();
      if (errore) rifiuta(errore);
      else risolvi(esito);
    };
    const arma = (ms, errore) => {
      clearTimeout(orologio);
      orologio = setTimeout(() => chiudi(null, errore()), ms);
    };

    try {
      presa = net.createConnection({ host: indirizzo, port: porta });
    } catch (e) {
      rifiuta(nonRisponde(e.code ?? e.message));
      return;
    }
    arma(attesaConnessione, () => new ErroreDiRete("L'apparecchio non ha aperto la connessione in tempo.", { inviato: false, codice: "non_risponde" }));

    presa.on("connect", () => {
      connesso = true;
      arma(attesaRisposta, () => aMeta(byteAttesi > 0 ? "Mandato, ma l'apparecchio non ha risposto in tempo." : "Mandato, ma la stampante non ha preso tutto in tempo."));
      if (byteAttesi > 0) {
        presa.write(dati);
        return;
      }
      presa.end(dati, () => {
        // Consegnato al sistema: si aspetta che la stampante chiuda, per
        // non tagliarle i byte che sta ancora leggendo.
        consegnato = true;
        arma(ATTESA_CHIUSURA_MS, () => {
          finito = true;
          clearTimeout(orologio);
          presa.destroy();
          risolvi(Buffer.alloc(0));
          return null;
        });
      });
    });
    presa.on("data", (pezzo) => {
      ricevuti.push(pezzo);
      quanti += pezzo.length;
      if (byteAttesi > 0 && quanti >= byteAttesi) chiudi(Buffer.concat(ricevuti));
    });
    presa.on("error", (e) =>
      chiudi(null, connesso ? aMeta(`La connessione si è interrotta: ${e.code ?? e.message}.`) : nonRisponde(e.code ?? e.message)),
    );
    presa.on("close", () => {
      if (finito) return;
      if (byteAttesi === 0 && consegnato) chiudi(Buffer.alloc(0));
      else chiudi(null, connesso ? aMeta("L'apparecchio ha chiuso prima di rispondere per intero.") : nonRisponde());
    });
  });
}

/**
 * Manda un documento con POST e restituisce il testo della risposta.
 * ⚠️ Niente redirezioni: un apparecchio della rete non ne ha bisogno, e
 *    seguirle vorrebbe dire andare dove dice lui.
 */
export function postHttp({ protocollo = "http:", indirizzo, porta, percorso, corpo, tipo = "text/xml; charset=utf-8", attesaConnessione = ATTESA_CONNESSIONE_MS, attesaRisposta = ATTESA_RISPOSTA_MS }) {
  return new Promise((risolvi, rifiuta) => {
    const sicuro = protocollo === "https:";
    let connesso = false;
    let finito = false;
    let orologio = null;
    let richiesta = null;
    const dati = Buffer.from(corpo, "utf8");

    const chiudi = (esito, errore) => {
      if (finito) return;
      finito = true;
      clearTimeout(orologio);
      if (errore) {
        richiesta?.destroy();
        rifiuta(errore);
      } else risolvi(esito);
    };
    const arma = (ms, errore) => {
      clearTimeout(orologio);
      orologio = setTimeout(() => chiudi(null, errore()), ms);
    };

    try {
      richiesta = (sicuro ? https : http).request(
        {
          host: indirizzo,
          port: porta,
          path: percorso,
          method: "POST",
          headers: { "Content-Type": tipo, "Content-Length": dati.length },
          // ⚠️ Gli apparecchi della rete hanno certificati fatti da sé, a
          //    volte vecchi: in https si accetta il loro, che tanto non
          //    dimostra niente. La protezione è l'indirizzo (sicurezza.mjs).
          rejectUnauthorized: false,
          minVersion: "TLSv1",
          agent: false,
        },
        (risposta) => {
          const pezzi = [];
          risposta.on("data", (p) => pezzi.push(p));
          risposta.on("end", () => {
            const testo = Buffer.concat(pezzi).toString("utf8");
            if (risposta.statusCode >= 400) {
              // Un «no» esplicito dell'apparecchio: non ha stampato.
              chiudi(null, new ErroreDiRete(`L'apparecchio ha risposto ${risposta.statusCode}.`, { inviato: true, codice: "rifiutato" }));
            } else if (risposta.statusCode >= 300) {
              chiudi(null, aMeta(`L'apparecchio ha risposto ${risposta.statusCode}, che non è una risposta di stampa.`));
            } else chiudi(testo);
          });
          risposta.on("error", () => chiudi(null, aMeta("La risposta si è interrotta a metà.")));
        },
      );
    } catch (e) {
      rifiuta(nonRisponde(e.code ?? e.message));
      return;
    }
    arma(attesaConnessione, () => new ErroreDiRete("L'apparecchio non ha aperto la connessione in tempo.", { inviato: false, codice: "non_risponde" }));

    richiesta.on("socket", (presa) => {
      // ⚠️ In https la connessione conta da quando la cifratura è a posto:
      //    se fallisce prima, il documento non è partito.
      presa.once(sicuro ? "secureConnect" : "connect", () => {
        connesso = true;
        arma(attesaRisposta, () => aMeta("Mandato, ma l'apparecchio non ha risposto in tempo."));
      });
    });
    richiesta.on("error", (e) =>
      chiudi(null, connesso ? aMeta(`La connessione si è interrotta: ${e.code ?? e.message}.`) : nonRisponde(e.code ?? e.message)),
    );
    richiesta.end(dati);
  });
}
