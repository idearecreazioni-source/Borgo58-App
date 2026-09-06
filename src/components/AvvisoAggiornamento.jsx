import { useEffect, useState } from "react";
import {
  aggiornamentoDisponibile,
  ascoltaAggiornamento,
  prendiLAggiornamento,
} from "../lib/versione";

// LA RIGA CHE DICE «CE N'E' UNA NUOVA».
//
// 🔴 Dal 06/09/2026: un tablet che aveva gia' aperto il gestionale poteva
// mostrare l'interfaccia di settimane prima senza che niente lo dicesse. La
// misura sta nel cappello di `src/lib/calcoli/versione.js`: non era la
// memoria del browser, era che **nessuno ricaricava mai**.
//
// ⚠️ STA NEL TELAIO E NON NELLE SCHERMATE, per la stessa ragione dell'avviso
// delle letture tagliate: una schermata nuova e' coperta senza che nessuno
// si ricordi di aggiungerlo.
//
// ⚠️ E NON SPARISCE DA SOLO. Non e' un fatto gia' avvenuto e verificabile
// come la ripresa di una bozza — e' una cosa che **resta da fare**, e finche'
// non e' fatta chi guarda sta usando una versione superata. Un avviso che se
// ne va allo scadere di un tempo lascerebbe il gestionale vecchio e nessuno
// che lo sappia, cioe' esattamente il difetto di partenza.
//
// ⚠️ SI AGGIORNA CON UN DITO, E SOLO COSI'. Il pulsante e' l'unica strada che
// ricarica; nessun timer la percorre. Chi sta scrivendo una fattura la finisce
// e preme dopo — e se preme mentre sta scrivendo, `prendiLAggiornamento`
// fotografa i campi prima di ricaricare e la riga verde di `RipresaBozza` li
// rimette e lo dice.
export default function AvvisoAggiornamento() {
  const [ceNeUnaNuova, setCeNeUnaNuova] = useState(aggiornamentoDisponibile);

  useEffect(() => ascoltaAggiornamento(setCeNeUnaNuova), []);

  if (!ceNeUnaNuova) return null;

  return (
    <div className="bg-b58-olive/15 ring-1 ring-b58-olive/40 rounded-lg px-3 py-2 mb-4 print:hidden">
      <p className="testo-sala text-b58-charcoal">
        <strong>Aggiornamento disponibile.</strong> Questo dispositivo sta ancora usando la
        versione di prima.{" "}
        <button
          type="button"
          onClick={prendiLAggiornamento}
          className="tocco-bottone underline text-b58-terracotta-dark hover:text-b58-charcoal"
        >
          Aggiorna adesso
        </button>{" "}
        — quello che stai scrivendo non si perde.
      </p>
    </div>
  );
}
