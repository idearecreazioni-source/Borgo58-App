// =====================================================================
// MEMO STA REGISTRANDO? — 12/09/2026, mandato notturno, blocco C
// =====================================================================
// 🔴 PERCHÉ ESISTE. Dal collaudo sull'iPhone: aperto il menu laterale da
//    MEMO voce, toccare una voce cambiava pagina. Se il microfono era
//    acceso, MEMO si chiudeva e quello che si era detto spariva — né
//    mandato né conservato, e nessuno lo diceva.
//
// ⚠️ IL MENU STA NEL TELAIO, IL MICROFONO NELLA PAGINA: il telaio non può
//    guardare dentro MEMO. Qui MEMO dice «sto registrando» e lascia il modo
//    di lasciar perdere; il telaio chiede soltanto, al momento del tocco.
//
// ⚠️ LASCIAR PERDERE NON MANDA NIENTE. Chi sceglie «Lascia perdere e vai»
//    ha detto di no a quello che aveva dettato: lo si spegne e basta. Chi
//    vuole mandarlo resta e preme «Ferma e manda», come sempre.

let annulla = null;

/**
 * MEMO la chiama quando il microfono si accende, con la funzione che lo
 * spegne SENZA mandare. Restituisce la funzione che toglie il segno.
 */
export function segnaRegistrazione(fAnnulla) {
  annulla = fAnnulla;
  return () => {
    if (annulla === fAnnulla) annulla = null;
  };
}

export const registrazioneInCorso = () => annulla !== null;

/** Spegne il microfono senza mandare niente: è la scelta esplicita. */
export function lasciaPerdereRegistrazione() {
  const f = annulla;
  annulla = null;
  f?.();
}
