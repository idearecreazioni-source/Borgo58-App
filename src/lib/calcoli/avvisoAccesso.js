// IL RIQUADRO SULL'ACCESSO, IN ALTO IN OGNI PAGINA (01/11/2026).
//
// Quando il ruolo non si legge ci sono due casi diversi:
//  - il telefono e' senza rete: non e' un guasto, e appena la rete torna il
//    ruolo si rilegge da solo (AuthContext, evento «online»). Dirlo in rosso
//    con «Riprova» spaventava e mandava a premere un pulsante inutile
//    (prova in modalita' aereo di Alessio sull'iPhone, 01/11);
//  - la rete c'e' ma la lettura e' fallita: quello si' va detto, con «Riprova».

/** Cosa dire, o null se non c'e' niente da dire. */
export function avvisoAccesso({ ruoloNonLetto, inRete }) {
  if (!ruoloNonLetto) return null;
  if (inRete === false) {
    return {
      tipo: "senza_rete",
      testo: "Sei senza rete: alcune parti potrebbero mancare. Quando torna, ricontrollo da solo.",
      riprova: false,
    };
  }
  return {
    tipo: "non_letto",
    testo: "Non riesco a verificare il tuo accesso: alcune parti potrebbero mancare.",
    riprova: true,
  };
}
