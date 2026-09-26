// LE SCHERMATE VERE, MONTATE COME NEL GESTIONALE — prova visiva del 26/09/2026.
//
// Una pagina sola, e la schermata si sceglie dall'indirizzo:
//   ?pagina=dashboard | agenda | primanota | causali | salaorari | spesa | ingrediente | archivio
//
// ⚠️ Il telaio è quello vero (`Layout.jsx`): la barra laterale occupa lo
//    stesso spazio da 1024 punti in su, e il contenuto ha gli stessi
//    margini e la stessa classe `contenuto-ampio`. Senza, sul computer si
//    misurerebbe una pagina più larga di quella che Alessio vede.
//
// ⚠️ I dati sono FINTI (`tests/visive/finti/supabase.js`) e scelti per
//    mettere alla prova i casi difficili: titoli lunghi, categorie, una
//    chiusura di più giorni, un avviso con una descrizione lunga.
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../src/index.css";
// Inter locale, come quello che il gestionale carica da Google Fonts (27/09/2026).
import "../caratteri/inter.css";
import { applyPxCm } from "../../../src/lib/touch";
import Dashboard from "../../../src/pages/Dashboard";
import AgendaList from "../../../src/pages/agenda/AgendaList";
import PrimaNota from "../../../src/pages/cassa/PrimaNota";
import Causali from "../../../src/pages/cassa/Causali";
import SalaEOrari from "../../../src/pages/calendario/SalaEOrari";
import SpesaSpicciola from "../../../src/pages/magazzino/SpesaSpicciola";
import IngredienteForm from "../../../src/pages/ricettario/IngredienteForm";
import ArchivioDocumentiHome from "../../../src/pages/documenti/ArchivioDocumentiHome";
import { agendaCorsie } from "../finti/tasks.js";

applyPxCm();

const impegno = (id, title, category, priority) => ({
  id,
  title,
  category,
  priority,
  status: "da_fare",
  due_date: null,
  due_time: null,
  description: "",
  preferito: false,
  visibile_staff: true,
  origine_modulo: null,
});

const fraGiorni = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const causale = (id, label, kind = "uscita") => ({
  id,
  label,
  kind,
  active: true,
  di_sistema: false,
  e_costo_fisso: false,
});

const DATI = {
  dashboard: {
    tabelle: {
      tasks: [
        impegno("t1", "Titolare effettivo — verificare con Laura e la Camera di commercio", "fisco_scadenze", "alta"),
        impegno("t2", "Comunicazione dell'occupazione del suolo pubblico per il dehors", "documenti", "media"),
        impegno("t3", "Valutare il secondo forno", "altro", "bassa"),
      ],
    },
    rpc: {
      avvisi_del_gestionale: [
        {
          chiave: "haccp",
          quanti: 2,
          titolo: "Non conformità aperte in HACCP",
          dettaglio: "Congelatore: −17,0 °C, fuori dal range −22,0/−18,0 °C, registrato ieri sera",
          gravita: "alta",
          dove: "/haccp/non-conformita",
          rimandato_a: null,
        },
      ],
    },
  },
  // Le stesse righe difficili della prova visiva dell'Agenda.
  agenda: { rpc: { agenda_corsie: await agendaCorsie(), agenda_fatti: [] } },
  primanota: {
    tabelle: {
      cash_causali: [causale("c1", "Spesa alimentare"), causale("c2", "Manutenzione"), causale("c3", "Incasso", "entrata")],
      entities: [{ id: "e1", name: "Borgo 58", entity_type: "srls" }],
    },
  },
  causali: {
    tabelle: {
      cash_causali: [
        causale("c1", "Spesa alimentare"),
        causale("c2", "Materiale di consumo / economato"),
        causale("c3", "Trasporti"),
        causale("c4", "Incasso extra", "entrata"),
      ],
    },
  },
  salaorari: {
    tabelle: {
      service_closures: [
        { id: "k1", dal: "2026-12-24", al: "2026-12-27", motivo: "Chiusura per le feste", si_lavora_in_cucina: false },
        { id: "k2", dal: "2026-11-02", al: "2026-11-02", motivo: "", si_lavora_in_cucina: null },
      ],
    },
  },
  spesa: {},
  ingrediente: {},
  archivio: {
    tabelle: {
      entities: [{ id: "e1", name: "Borgo 58", entity_type: "srls" }],
      documents: [
        { id: "d1", title: "Polizza assicurativa del locale", doc_type: "contratto", expiry_date: fraGiorni(20), entity_id: "e1" },
        { id: "d2", title: "Certificato di prevenzione incendi", doc_type: "certificato", expiry_date: fraGiorni(45), entity_id: "e1" },
      ],
    },
  },
};

const PAGINE = {
  dashboard: ["/dashboard", <Dashboard key="d" />],
  agenda: ["/agenda", <AgendaList key="a" />],
  primanota: ["/cassa/prima-nota", <PrimaNota key="p" />],
  causali: ["/cassa/causali", <Causali key="c" />],
  salaorari: ["/calendario-eventi/sala-e-orari", <SalaEOrari key="s" />],
  spesa: ["/magazzino/spesa-spicciola", <SpesaSpicciola key="sp" />],
  ingrediente: ["/ricettario/ingredienti/nuovo", <IngredienteForm key="i" />],
  archivio: ["/documenti", <ArchivioDocumentiHome key="ar" />],
};

const nome = new URLSearchParams(location.search).get("pagina") ?? "dashboard";
window.__DATI_FINTI = DATI[nome] ?? {};
const [percorso, schermata] = PAGINE[nome] ?? PAGINE.dashboard;

createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={[percorso]}>
    <div className="min-h-screen bg-b58-cream flex">
      <aside className="hidden lg:block lg:w-64 xl:w-80 shrink-0 border-r border-b58-charcoal/10" />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 contenuto-ampio" data-pagina={nome}>
          <Routes>
            <Route path={percorso} element={schermata} />
          </Routes>
        </main>
      </div>
    </div>
  </MemoryRouter>,
);
