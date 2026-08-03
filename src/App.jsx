import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ModulePlaceholder from "./pages/ModulePlaceholder";
import RicettarioHome from "./pages/ricettario/RicettarioHome";
import IngredientiList from "./pages/ricettario/IngredientiList";
import IngredienteForm from "./pages/ricettario/IngredienteForm";
import RicetteList from "./pages/ricettario/RicetteList";
import RicettaForm from "./pages/ricettario/RicettaForm";
import RicettaDetail from "./pages/ricettario/RicettaDetail";
import StaffRicettaDetail from "./pages/ricettario/StaffRicettaDetail";
import MenuList from "./pages/ricettario/MenuList";
import MenuForm from "./pages/ricettario/MenuForm";
import MenuDetail from "./pages/ricettario/MenuDetail";
import ReservationsList from "./pages/calendario/ReservationsList";
import ReservationForm from "./pages/calendario/ReservationForm";
import ClientiList from "./pages/calendario/ClientiList";
import ClienteDetail from "./pages/calendario/ClienteDetail";
import PublicReservationForm from "./pages/public/PublicReservationForm";
import AgendaList from "./pages/agenda/AgendaList";
import TaskForm from "./pages/agenda/TaskForm";
import MagazzinoHome from "./pages/magazzino/MagazzinoHome";
import RegistraCarico from "./pages/magazzino/RegistraCarico";
import ListaSpesa from "./pages/magazzino/ListaSpesa";
import Tracciabilita from "./pages/magazzino/Tracciabilita";
import HaccpHome from "./pages/haccp/HaccpHome";
import TemperatureLog from "./pages/haccp/TemperatureLog";
import RicevimentoMerci from "./pages/haccp/RicevimentoMerci";
import PuliziaESanificazione from "./pages/haccp/PuliziaESanificazione";
import NonConformita from "./pages/haccp/NonConformita";
import ManualeCompleto from "./pages/haccp/ManualeCompleto";
import StampaAdempimenti from "./pages/agenda/StampaAdempimenti";
import FattureFornitoriHome from "./pages/fatture/FattureFornitoriHome";
import CassaHome from "./pages/cassa/CassaHome";
import PrimaNota from "./pages/cassa/PrimaNota";
import ScontiOmaggi from "./pages/cassa/ScontiOmaggi";
import Causali from "./pages/cassa/Causali";
import ProiezioneFiscaleHome from "./pages/fiscale/ProiezioneFiscaleHome";
import DeduzioniFiscali from "./pages/fiscale/DeduzioniFiscali";
import CatalogoStrumenti from "./pages/fiscale/CatalogoStrumenti";
import SimulatoreFiscale from "./pages/fiscale/SimulatoreFiscale";
import PersonaleHome from "./pages/personale/PersonaleHome";
import DipendenteDetail from "./pages/personale/DipendenteDetail";
import Mance from "./pages/personale/Mance";
import ArchivioDocumentiHome from "./pages/documenti/ArchivioDocumentiHome";
import DocumentoDetail from "./pages/documenti/DocumentoDetail";
import { getModule } from "./data/modules";

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

// Rotte riservate al titolare: lo staff che le raggiunge viene rimandato alla
// dashboard. La barriera vera resta la RLS (§3.5); questa è la difesa frontend.
function RequireTitolare({ children }) {
  const { isTitolare, loading } = useAuth();
  if (loading) return null;
  return isTitolare ? children : <Navigate to="/dashboard" replace />;
}

// Placeholder dei moduli non ancora costruiti: il blocco dipende dal modulo
// specifico (staffVisible in data/modules.js), non è un blanket "solo titolare".
function ModulePlaceholderGuarded() {
  const { moduleId } = useParams();
  const { isTitolare, loading } = useAuth();
  const module = getModule(moduleId);
  if (loading) return null;
  if (!isTitolare && !module?.staffVisible) return <Navigate to="/dashboard" replace />;
  return <ModulePlaceholder />;
}

// La scheda ricetta cambia in base al ruolo: editor completo per il titolare,
// vista in sola lettura senza dati economici per lo staff.
function RecipeDetailByRole() {
  const { isTitolare } = useAuth();
  return isTitolare ? <RicettaDetail /> : <StaffRicettaDetail />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading ? null : isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/prenota" element={<PublicReservationForm />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Ricettario */}
        <Route path="/ricettario" element={<RicettarioHome />} />
        <Route path="/ricettario/ricette" element={<RicetteList />} />
        <Route path="/ricettario/ricette/nuova" element={<RequireTitolare><RicettaForm /></RequireTitolare>} />
        <Route path="/ricettario/ricette/:id" element={<RecipeDetailByRole />} />
        <Route path="/ricettario/ingredienti" element={<RequireTitolare><IngredientiList /></RequireTitolare>} />
        <Route path="/ricettario/ingredienti/nuovo" element={<RequireTitolare><IngredienteForm /></RequireTitolare>} />
        <Route path="/ricettario/ingredienti/:id" element={<RequireTitolare><IngredienteForm /></RequireTitolare>} />
        <Route path="/ricettario/menu" element={<RequireTitolare><MenuList /></RequireTitolare>} />
        <Route path="/ricettario/menu/nuovo" element={<RequireTitolare><MenuForm /></RequireTitolare>} />
        <Route path="/ricettario/menu/:id" element={<RequireTitolare><MenuDetail /></RequireTitolare>} />

        {/* Calendario eventi (staff: vista operativa) */}
        <Route path="/calendario-eventi" element={<ReservationsList />} />
        <Route path="/calendario-eventi/nuova" element={<ReservationForm />} />
        <Route path="/calendario-eventi/clienti" element={<ClientiList />} />
        <Route path="/calendario-eventi/clienti/:id" element={<ClienteDetail />} />
        <Route path="/calendario-eventi/:id" element={<ReservationForm />} />

        {/* Agenda (condivisa titolare/staff) */}
        <Route path="/agenda" element={<AgendaList />} />
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        <Route path="/agenda/adempimenti" element={<StampaAdempimenti />} />
        <Route path="/agenda/:id" element={<TaskForm />} />

        {/* Magazzino (condiviso titolare/staff, senza valore economico per lo staff — §3.5) */}
        <Route path="/magazzino" element={<MagazzinoHome />} />
        <Route path="/magazzino/carico" element={<RegistraCarico />} />
        <Route path="/magazzino/lista-spesa" element={<ListaSpesa />} />
        <Route path="/magazzino/tracciabilita" element={<Tracciabilita />} />

        {/* HACCP (condiviso: staff fa solo immissione operativa, non modifica struttura/storico — §3.5) */}
        <Route path="/haccp" element={<HaccpHome />} />
        <Route path="/haccp/temperature" element={<TemperatureLog />} />
        <Route path="/haccp/ricevimento" element={<RicevimentoMerci />} />
        <Route path="/haccp/pulizia" element={<PuliziaESanificazione />} />
        <Route path="/haccp/non-conformita" element={<NonConformita />} />
        <Route path="/haccp/manuale" element={<ManualeCompleto />} />

        {/* Fatture Fornitori (solo titolare, esplicito nel brief) */}
        <Route path="/fatture-fornitori" element={<RequireTitolare><FattureFornitoriHome /></RequireTitolare>} />

        {/* Cassa, Banca e Prima Nota (solo titolare — §3.5) */}
        <Route path="/cassa" element={<RequireTitolare><CassaHome /></RequireTitolare>} />
        <Route path="/cassa/prima-nota" element={<RequireTitolare><PrimaNota /></RequireTitolare>} />
        <Route path="/cassa/sconti-omaggi" element={<RequireTitolare><ScontiOmaggi /></RequireTitolare>} />
        <Route path="/cassa/causali" element={<RequireTitolare><Causali /></RequireTitolare>} />

        {/* Proiezione Fiscale (solo titolare — §3.5, materia sensibile §6) */}
        <Route path="/fiscale" element={<RequireTitolare><ProiezioneFiscaleHome /></RequireTitolare>} />
        <Route path="/fiscale/deduzioni" element={<RequireTitolare><DeduzioniFiscali /></RequireTitolare>} />
        <Route path="/fiscale/strumenti" element={<RequireTitolare><CatalogoStrumenti /></RequireTitolare>} />
        <Route path="/fiscale/simulatore" element={<RequireTitolare><SimulatoreFiscale /></RequireTitolare>} />

        {/* Personale & Buste Paga (solo titolare — §4 mod. 11) */}
        <Route path="/personale" element={<RequireTitolare><PersonaleHome /></RequireTitolare>} />
        <Route path="/personale/mance" element={<RequireTitolare><Mance /></RequireTitolare>} />
        <Route path="/personale/:id" element={<RequireTitolare><DipendenteDetail /></RequireTitolare>} />

        {/* Archivio Documenti (solo titolare — §3.13) */}
        <Route path="/documenti" element={<RequireTitolare><ArchivioDocumentiHome /></RequireTitolare>} />
        <Route path="/documenti/:id" element={<RequireTitolare><DocumentoDetail /></RequireTitolare>} />

        {/* Placeholder degli altri moduli — bloccati per modulo (staffVisible) */}
        <Route path="/moduli/:moduleId" element={<ModulePlaceholderGuarded />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
