import { dettaglioCompleto, eUnAnticipo, nelCostoDelProgetto, sommaRighe, totaliDelProgetto } from "./investimento";

// «IL PROGETTO FINORA» — il quarto riquadro di «Cassa, Banca e Prima Nota»
// fino al primo scontrino.
//
// 🔴 NESSUN CALCOLO NUOVO: il totale e' quello di «Quanto e' costato il
//    progetto» (`totaliDelProgetto` sull'aggregazione `costo_del_progetto`),
//    che gia' contiene le anticipazioni del socio marcate investimento e che
//    non conta due volte una nota legata a una fattura (lo garantiscono i due
//    trigger della migrazione 20260921000003). Qui si legge, non si rifa'.
// ⚠️ «Di cui anticipati» somma le righe di dettaglio che sono anticipazioni e
//    che stanno nel totale (l'orto no). Se il dettaglio non e' intero la cifra
//    sarebbe corta con l'aria di essere intera: allora e' `null` e la
//    schermata tace.

/**
 * @param aggregato  righe di `costo_del_progetto()`
 * @param righe      righe di `righe_costo_del_progetto()`
 * @returns { totale, anticipato }  `anticipato` e' null se il dettaglio e' troncato
 */
export function riepilogoProgetto(aggregato, righe) {
  const totali = totaliDelProgetto(aggregato);
  const elenco = Array.isArray(righe) ? righe : [];
  if (!dettaglioCompleto(totali, elenco).completo) {
    return { totale: totali.totale, anticipato: null };
  }
  const anticipi = elenco.filter((r) => eUnAnticipo(r) && nelCostoDelProgetto(r?.tipo));
  return { totale: totali.totale, anticipato: sommaRighe(anticipi) };
}

/**
 * Quale riquadro va in quarta posizione.
 *
 * 🔴 SI CAMBIA DA SOLO AL PRIMO SCONTRINO, non a una data (scelta di
 *    Alessio). Se non si sa (`null`/`undefined`: lettura fallita) resta il
 *    riquadro di sempre, gli omaggi: e' il comportamento di prima.
 *
 * @param scontrinoEmesso  true / false / null (non si sa)
 */
export function riquadroInQuartaPosizione(scontrinoEmesso) {
  return scontrinoEmesso === false ? "progetto" : "omaggi";
}
