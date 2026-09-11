// La VERA schermata dell'Agenda, montata da sola per la prova visiva.
// ⚠️ Stessi fogli di stile e stessa calibrazione dei centimetri dell'app
//    (`applyPxCm`), così la scheda ha la misura che ha davvero: una prova
//    visiva su una pagina con uno stile diverso misurerebbe un'altra cosa.
//
// ⚠️ CON `?telaio` LA SCHERMATA SI MONTA DENTRO LO STESSO TELAIO DEL
//    GESTIONALE (11/09/2026, per la settimana): la barra laterale larga
//    come in `Layout.jsx` e `<main>` con le sue classi, `contenuto-ampio`
//    compreso. Serve perché la settimana passa a sette colonne secondo la
//    larghezza del SUO riquadro, e senza la barra laterale un computer da
//    1280 punti le darebbe ~250 punti che nel gestionale non ha.
//    Le classi sono ricopiate da `Layout.jsx`: se cambiano là, vanno
//    cambiate qui, o la prova misura un telaio che non c'è più.
//    Senza `?telaio` resta com'era, e le misure dell'elenco non cambiano.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "../../../src/index.css";
import { applyPxCm } from "../../../src/lib/touch";
import AgendaList from "../../../src/pages/agenda/AgendaList";

applyPxCm();

const telaio = new URLSearchParams(location.search).has("telaio");

createRoot(document.getElementById("root")).render(
  <MemoryRouter>
    {telaio ? (
      <div className="min-h-screen bg-b58-cream flex">
        <aside className="hidden lg:block lg:w-64 xl:w-80 shrink-0 border-r border-b58-charcoal/10" />
        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8 contenuto-ampio">
            <AgendaList />
          </main>
        </div>
      </div>
    ) : (
      <main className="p-4">
        <AgendaList />
      </main>
    )}
  </MemoryRouter>
);
