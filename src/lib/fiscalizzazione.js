// LO SCONTRINO CHE ESCE DA SOLO — 22/08/2026, blocco 2 del mandato.
//
// 🔴 LA REGOLA, con le parole di Alessio: *«lo scontrino viene considerato
// EMESSO FINO A PROVA CONTRARIA, non viceversa. Il sistema deve essere
// automatico e la rettifica è solo una via d'uscita per le rare volte che
// servirà.»*
//
// Quindi qui dentro **non si chiede niente a nessuno**: la stampante dice di
// sì e il conto è fiscalizzato. Nessuna conferma, nessuna spunta, nessun
// «hai controllato?» — il flusso normale non prende attriti in più.
//
// ⚠️ E LA CHIUSURA DEL CONTO NON DIPENDE DA QUI. Questa funzione **non
// lancia mai**: se la stampante è muta, se il protocollo si interrompe, se
// la scrittura del documento fallisce, il conto resta chiuso e senza
// documento — e finisce nell'elenco «da fiscalizzare», che a fine giornata
// si fa notare da solo. È la stessa regola dello scarico di magazzino del
// 13/08: *una scrittura di conseguenza non impedisce il gesto principale, e
// il cliente non aspetta.*
//
// ⚠️ IL REGISTRATORE SI PASSA DA FUORI, e non è un dettaglio di comodo: è
// ciò che permette alle prove di far fallire la stampa nei modi veri
// (`registratoreSimulato.js`) senza nessun interruttore globale. Uno stato
// nascosto che cambia il comportamento è la cosa che questo progetto evita.

import * as registratoreVero from "./registratore";
import { setDocumentoFiscale } from "./api/orders";

/**
 * Chiede lo scontrino al registratore e, se è uscito, lo scrive sul conto.
 *
 * Restituisce `{ emesso, esito, numero, messaggio }` — e **non lancia mai**.
 *
 * @param conto        il conto appena chiuso (serve `id`)
 * @param serata       la serata di servizio, per la data del documento
 * @param registratore sostituibile: il simulatore nelle prove
 */
export async function fiscalizzaConto(conto, { serata, registratore = registratoreVero } = {}) {
  const id = conto?.id ?? conto;
  let risposta;

  try {
    risposta = await registratore.emettiScontrino(conto);
  } catch (e) {
    // Un guasto del collegamento non è diverso da una stampante muta: il
    // conto resta senza documento e lo dice l'elenco.
    return { emesso: false, esito: "errore", numero: null, messaggio: e.message };
  }

  if (!registratoreVero.scontrinoEmesso(risposta)) {
    return { emesso: false, ...risposta };
  }

  try {
    // ⚠️ LA DATA È LA SERATA DEL CONTO, non «oggi»: un conto e il suo
    // documento devono stare sulla stessa giornata, o la quadratura fra
    // incassato e scontrinato accusa una differenza che non esiste. Lo
    // scarto vero — quello di un conto fiscalizzato il giorno dopo — nasce
    // dalla serata, non dall'ora in cui esce la carta.
    await setDocumentoFiscale(id, {
      tipo: "scontrino",
      numero: risposta.numero,
      emessoIl: serata ?? null,
    });
    return { emesso: true, ...risposta };
  } catch (e) {
    // 🔴 LO SCONTRINO È USCITO E IL GESTIONALE NON È RIUSCITO A SCRIVERLO.
    // È il caso peggiore di questa funzione — carta stampata, conto che
    // risulta da fiscalizzare — e si dichiara invece di tacere: chi guarda
    // l'elenco a fine giornata trova un conto che *sembra* scoperto e non
    // lo è. Meglio così del contrario: un conto segnato a posto senza che
    // niente sia uscito.
    return {
      emesso: false,
      esito: risposta.esito,
      numero: risposta.numero,
      messaggio: `Lo scontrino n. ${risposta.numero} è uscito, ma non sono riuscito a segnarlo sul conto: ${e.message}`,
    };
  }
}
