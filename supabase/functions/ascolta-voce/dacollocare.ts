// =====================================================================
// TUTTE LE SPESE DETTE VANNO «DA COLLOCARE» — 11/10/2026 (C12)
// =====================================================================
// 🔴 DECISO DA ALESSIO L'11/10: ogni spesa detta a MEMO finisce nell'elenco
//    «Da collocare», non in contabilita'. Prima la voce sceglieva da se' fra
//    tre soggetti — la cassa dell'osteria, la tasca, l'anticipo — e una
//    scelta sbagliata dava una riga plausibile nel posto sbagliato. Adesso
//    la voce PROPONE (la regola delle parole di tasca.ts resta e decide la
//    proposta) e la scelta la fa lui davanti al computer, una volta sola.
//
// ⚠️ SOLO LE USCITE. Un'entrata detta a voce («ho incassato…») non e' una
//    spesa e resta il movimento di cassa di sempre: la relazione parla di
//    spese, e allargare il perimetro non e' stato chiesto.
//
// ⚠️ QUESTO PASSO VIENE DOPO `correggiSpese`, e non lo sostituisce: quella
//    regola sa leggere «di tasca mia» e «poi mi rimborso», e il suo esito
//    diventa la destinazione PROPOSTA. Cosi' le sue diciassette prove
//    restano vere e continuano a proteggere la parte che conta — leggere le
//    parole giuste.

import {
  type AzioneDettata,
  TIPO_CASSA,
  TIPO_DA_RIMBORSARE,
  TIPO_DI_CHI_SONO,
  TIPO_TASCA,
} from "./tasca.ts";

/** Il tipo del catalogo che scrive un appunto in «Da collocare». */
export const TIPO_DA_COLLOCARE = "spesa_da_collocare";

/** Dove la regola delle parole manderebbe la spesa: diventa la proposta. */
const PROPOSTA: Record<string, string | null> = {
  [TIPO_CASSA]: "prima_nota",
  [TIPO_TASCA]: "tasca",
  [TIPO_DA_RIMBORSARE]: "anticipo",
  // Non ha detto se i soldi tornano: nessuna proposta, e il dubbio si scrive.
  [TIPO_DI_CHI_SONO]: null,
};

const testo = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** È una spesa? Una delle quattro forme, e il verso non è un'entrata. */
export function eUnaSpesa(azione: AzioneDettata): boolean {
  if (!azione || !(azione.tipo in PROPOSTA)) return false;
  const verso = testo(azione.dati?.verso)?.toLowerCase();
  return verso !== "entrata";
}

/** Una spesa detta diventa un appunto da collocare. */
export function daCollocare(azione: AzioneDettata, dettato = ""): AzioneDettata {
  if (!eUnaSpesa(azione)) return azione;
  const d = azione.dati ?? {};
  const pezzo = testo((azione as Record<string, unknown>).pezzo);

  // ⚠️ IL DUBBIO SI SCRIVE QUANDO C'È: un «non ero sicuro» del modello, o la
  //    domanda «questi soldi tornano?» che la regola delle parole aveva
  //    posto. Su una spesa chiara resta vuoto — un'incertezza scritta sempre
  //    si smette di leggere.
  const incertezza =
    azione.tipo === TIPO_DI_CHI_SONO || azione.sicuro === false ? testo(azione.motivo) : null;

  const dati: Record<string, unknown> = {
    importo: d.importo ?? null,
    data: d.data ?? null,
    descrizione: d.descrizione ?? null,
    fornitore: d.fornitore ?? null,
    causale: d.causale ?? null,
    mezzo: d.mezzo ?? null,
    documento: d.documento ?? null,
    natura_proposta: PROPOSTA[azione.tipo],
    testo_originale: pezzo ?? testo(dettato),
    incertezza,
  };

  return {
    ...azione,
    tipo: TIPO_DA_COLLOCARE,
    destinazione: "Da collocare",
    sicuro: true,
    motivo:
      "Non è ancora contabilità: va fra le spese «Da collocare», e da lì scegli tu se è prima nota, la tua tasca, un anticipo o un documento da archiviare.",
    dati,
  };
}

/** La stessa regola su tutta la filza. */
export function collocaLeSpese(azioni: AzioneDettata[], dettato = ""): AzioneDettata[] {
  return (azioni ?? []).map((a) => daCollocare(a, dettato));
}
