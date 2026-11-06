import { Component } from "react";

// SE UN PEZZO DEL GESTIONALE NON ARRIVA — 27/10/2026
//
// Dal 27/10 le schermate si scaricano quando si aprono. Un tablet rimasto
// acceso da prima di un aggiornamento chiede il pezzo col nome vecchio, che
// non esiste più: senza questa rete React smonterebbe tutto e resterebbe uno
// schermo bianco, cioè il Bar o la Cucina fermi senza una parola
// (revisione ecc:react-reviewer del 27/10). Qui si dice cosa è successo e si
// offre l'unico rimedio che serve: ricaricare.
//
// ⚠️ NON RICARICA DA SOLO, ed è la regola di src/lib/versione.js: quando esce
//    una versione nuova il gestionale lo dice e basta. Qui la ricarica la
//    sceglie chi guarda lo schermo, col pulsante.
export default class PezzoMancante extends Component {
  constructor(props) {
    super(props);
    this.state = { rotto: false };
  }

  static getDerivedStateFromError() {
    return { rotto: true };
  }

  render() {
    if (!this.state.rotto) return this.props.children;
    return (
      <div role="alert" className="p-6 max-w-xl">
        <p className="testo-sala font-semibold text-b58-charcoal">Questa schermata non si è caricata.</p>
        <p className="mt-2 testo-sala text-b58-charcoal-soft">
          Di solito vuol dire che il gestionale è stato aggiornato mentre questo schermo era aperto. Ricaricando arriva la
          versione nuova; quello che era già salvato resta.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 tocco-bottone rounded-lg bg-b58-azione px-4 text-b58-parchment font-semibold"
        >
          Aggiorna
        </button>
      </div>
    );
  }
}
