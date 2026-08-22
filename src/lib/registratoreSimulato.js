// IL REGISTRATORE FINTO — quello che si rifiuta di stampare.
//
// 🔴 SERVE A PROVARE I MODI IN CUI LA STAMPA FALLISCE, non che funzioni.
// Il gesto previsto in sala è: il cameriere chiude il conto e lo scontrino
// esce da solo. Quindi il caso che fa male **non è quello in cui i totali
// coincidono** — quello è la giornata normale. È il conto chiuso e lo
// scontrino **non** uscito: l'incasso c'è, fiscalmente non esiste, e il
// cliente è già fuori dalla porta.
//
// ⚠️ È GENERICO: il modello vero non è stato scelto, e questo non parla
// nessun protocollo. Riproduce **gli esiti**, che è l'unica cosa che il
// gestionale vede.
//
// ---------------------------------------------------------------------
// 🔴 I MODI DI FALLIRE, misurati e non inventati
// ---------------------------------------------------------------------
// Letti da `registratore.js`, che dichiara cinque esiti — e confrontati coi
// quattro guasti che il mandato del 20/08 chiede. **Non combaciano**, ed è
// la misura che conta:
//
// | guasto chiesto dal mandato | esiste come esito? |
// |---|---|
// | stampante **muta** | ✅ `MUTO` |
// | risposta **a metà** | ✅ `A_META` |
// | **doppia stampa** | ❌ **non è un esito** — è `FATTO` due volte |
// | **pagina bianca** | ❌ **non può esserlo**: l'apparecchio risponde `FATTO` con un numero |
//
// ⚠️ **E le due che mancano sono le due che contano.** Non è una
// dimenticanza di chi ha scritto gli esiti: sono guasti che **il protocollo
// non può riportare**, perché dal lato della macchina è andato tutto bene.
// Un simulatore che riproducesse solo i cinque esiti dichiarati simulerebbe
// esattamente i guasti che il gestionale sa già gestire.
//
// ⚠️ Quindi la pagina bianca qui è `FATTO` **con un numero regolare** — cioè
// indistinguibile da una stampa riuscita. È voluto: serve a provare che
// **l'unica difesa è la segnalazione manuale di chi è in sala**, e che
// quella difesa funziona.

import { ESITI } from "./registratore";

/** I guasti che si possono accendere. Uno per volta. */
export const GUASTI = {
  NESSUNO: "nessuno",
  MUTO: "muto",
  A_META: "a_meta",
  ERRORE: "errore",
  NON_COLLEGATO: "non_collegato",
  DOPPIA_STAMPA: "doppia_stampa",
  PAGINA_BIANCA: "pagina_bianca",
};

/**
 * Costruisce un registratore finto che si comporta come chiesto.
 *
 * Restituisce un oggetto con la stessa forma di `registratore.js` —
 * `emettiScontrino(conto)` → `{ esito, numero, messaggio }` — più un
 * registro di quello che ha «stampato», che è ciò che permette a una prova
 * di guardare la carta invece del protocollo.
 *
 * ⚠️ `stampate` è la CARTA, `risposte` è il PROTOCOLLO, e stanno separate
 * apposta: nella pagina bianca il protocollo dice «fatto» e la carta è
 * vuota. Tenerli insieme renderebbe impossibile provare proprio il caso per
 * cui questo simulatore esiste.
 */
export function creaRegistratoreSimulato({ guasto = GUASTI.NESSUNO, daNumero = 1 } = {}) {
  let prossimo = daNumero;
  const stampate = []; // la carta uscita davvero
  const risposte = []; // cosa ha risposto l'apparecchio

  const nuovoNumero = () => String(prossimo++).padStart(4, "0");

  async function emettiScontrino(conto) {
    const contoId = conto?.id ?? conto;
    let risposta;

    switch (guasto) {
      case GUASTI.MUTO:
        // Nessuna risposta: il gestionale aspetta e poi rinuncia.
        risposta = { esito: ESITI.MUTO, numero: null, messaggio: "Il registratore non risponde." };
        break;

      case GUASTI.A_META:
        // Il protocollo si interrompe. ⚠️ Qui la carta PUÒ essere uscita o
        // no, e il gestionale non lo sa: è il caso in cui la segnalazione
        // manuale serve in tutti e due i versi.
        risposta = { esito: ESITI.A_META, numero: null, messaggio: "La risposta si è interrotta a metà." };
        break;

      case GUASTI.ERRORE:
        risposta = { esito: ESITI.ERRORE, numero: null, messaggio: "Carta finita." };
        break;

      case GUASTI.NON_COLLEGATO:
        risposta = { esito: ESITI.NON_COLLEGATO, numero: null, messaggio: "Registratore non collegato." };
        break;

      case GUASTI.DOPPIA_STAMPA: {
        // 🔴 DUE SCONTRINI, UNA RISPOSTA SOLA. La carta esce due volte e il
        // protocollo ne dichiara uno: se il gestionale contasse gli incassi
        // dalla carta invece che dai conti, questo li raddoppierebbe.
        const n = nuovoNumero();
        stampate.push({ contoId, numero: n });
        stampate.push({ contoId, numero: nuovoNumero() });
        risposta = { esito: ESITI.FATTO, numero: n, messaggio: "Scontrino emesso." };
        break;
      }

      case GUASTI.PAGINA_BIANCA: {
        // 🔴 IL CASO CHE NESSUN PROTOCOLLO COPRE. L'apparecchio crede di
        // aver stampato: risposta regolare, numero regolare. **In `stampate`
        // non finisce niente**, ed è l'unica differenza — visibile a un
        // occhio umano in sala, invisibile al gestionale.
        risposta = { esito: ESITI.FATTO, numero: nuovoNumero(), messaggio: "Scontrino emesso." };
        break;
      }

      default: {
        const n = nuovoNumero();
        stampate.push({ contoId, numero: n });
        risposta = { esito: ESITI.FATTO, numero: n, messaggio: "Scontrino emesso." };
      }
    }

    risposte.push({ contoId, ...risposta });
    return risposta;
  }

  return {
    emettiScontrino,
    guasto,
    /** La carta uscita davvero — quello che un occhio vedrebbe in sala. */
    stampate,
    /** Quello che l'apparecchio ha risposto al gestionale. */
    risposte,
    /** ⚠️ La domanda che il gestionale NON sa fare da solo. */
    cartaUscitaPer(contoId) {
      return stampate.filter((s) => s.contoId === contoId).length;
    },
  };
}
