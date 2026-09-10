// La VERA scheda di un impegno (`TaskForm`), montata da sola per la prova
// visiva. Finte sono solo le letture e la voce (`tests/visive/finti/`).
// ⚠️ Stessi fogli di stile e stessa calibrazione dei centimetri dell'app
//    (`applyPxCm`): le caselle di data e ora hanno la misura che hanno
//    davvero, e sul telefono i centimetri veri le fanno crescere.
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../src/index.css";
import { applyPxCm } from "../../../src/lib/touch";
import TaskForm from "../../../src/pages/agenda/TaskForm";

applyPxCm();

createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={["/agenda/scheda-finta"]}>
    <main className="p-4">
      <Routes>
        <Route path="/agenda/:id" element={<TaskForm />} />
      </Routes>
    </main>
  </MemoryRouter>
);
