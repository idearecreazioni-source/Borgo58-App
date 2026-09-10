// La VERA schermata dell'Agenda, montata da sola per la prova visiva.
// ⚠️ Stessi fogli di stile e stessa calibrazione dei centimetri dell'app
//    (`applyPxCm`), così la scheda ha la misura che ha davvero: una prova
//    visiva su una pagina con uno stile diverso misurerebbe un'altra cosa.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "../../../src/index.css";
import { applyPxCm } from "../../../src/lib/touch";
import AgendaList from "../../../src/pages/agenda/AgendaList";

applyPxCm();

createRoot(document.getElementById("root")).render(
  <MemoryRouter>
    <main className="p-4">
      <AgendaList />
    </main>
  </MemoryRouter>
);
