import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ModulePlaceholder from "./pages/ModulePlaceholder";
import RicettarioHome from "./pages/ricettario/RicettarioHome";
import IngredientiList from "./pages/ricettario/IngredientiList";
import SchedeProdotti from "./pages/ricettario/SchedeProdotti";
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
import SalaEOrari from "./pages/calendario/SalaEOrari";
import PublicReservationForm from "./pages/public/PublicReservationForm";
import InformativaPrivacy from "./pages/public/InformativaPrivacy";
import AgendaList from "./pages/agenda/AgendaList";
import TaskForm from "./pages/agenda/TaskForm";
import MagazzinoHome from "./pages/magazzino/MagazzinoHome";
import RegistraCarico from "./pages/magazzino/RegistraCarico";
import ListaSpesa from "./pages/magazzino/ListaSpesa";
import Tracciabilita from "./pages/magazzino/Tracciabilita";
import Scadenze from "./pages/magazzino/Scadenze";
import FornitoriList from "./pages/magazzino/FornitoriList";
import FornitoreDetail from "./pages/magazzino/FornitoreDetail";
import HaccpHome from "./pages/haccp/HaccpHome";
import TemperatureLog from "./pages/haccp/TemperatureLog";
import RicevimentoMerci from "./pages/haccp/RicevimentoMerci";
import PuliziaESanificazione from "./pages/haccp/PuliziaESanificazione";
import NonConformita from "./pages/haccp/NonConformita";
import ManualeCompleto from "./pages/haccp/ManualeCompleto";
import RaccoltaPropria from "./pages/haccp/RaccoltaPropria";
import StampaAdempimenti from "./pages/agenda/StampaAdempimenti";
import FattureFornitoriHome from "./pages/fatture/FattureFornitoriHome";
import CassaHome from "./pages/cassa/CassaHome";
import PrimaNota from "./pages/cassa/PrimaNota";
import ScontiOmaggi from "./pages/cassa/ScontiOmaggi";
import Causali from "./pages/cassa/Causali";
import Bar from "./pages/comande/Bar";
import Cucina from "./pages/comande/Cucina";
import Sala from "./pages/comande/Sala";
import ProiezioneFiscaleHome from "./pages/fiscale/ProiezioneFiscaleHome";
import DeduzioniFiscali from "./pages/fiscale/DeduzioniFiscali";
import CatalogoStrumenti from "./pages/fiscale/CatalogoStrumenti";
import SimulatoreFiscale from "./pages/fiscale/SimulatoreFiscale";
import PersonaleHome from "./pages/personale/PersonaleHome";
import DipendenteDetail from "./pages/personale/DipendenteDetail";
import Mance from "./pages/personale/Mance";
import ArchivioDocumentiHome from "./pages/documenti/ArchivioDocumentiHome";
import DocumentoDetail from "./pages/documenti/DocumentoDetail";
import PostaInArrivo from "./pages/documenti/PostaInArrivo";
import ChiediArchivio from "./pages/documenti/ChiediArchivio";
import ProvaVoce from "./pages/ProvaVoce";
import EditorMenuHome from "./pages/menu-editor/EditorMenuHome";
import BevandeVini from "./pages/menu-editor/BevandeVini";
import PiattiDelGiorno from "./pages/menu-editor/PiattiDelGiorno";
import AgricoloHome from "./pages/agricolo/AgricoloHome";
import Cessioni from "./pages/agricolo/Cessioni";
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
      <Route path="/privacy" element={<InformativaPrivacy />} />
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
        <Route path="/ricettario/schede" element={<RequireTitolare><SchedeProdotti /></RequireTitolare>} />
        <Route path="/ricettario/ingredienti/nuovo" element={<RequireTitolare><IngredienteForm /></RequireTitolare>} />
        <Route path="/ricettario/ingredienti/:id" element={<RequireTitolare><IngredienteForm /></RequireTitolare>} />
        <Route path="/ricettario/menu" element={<RequireTitolare><MenuList /></RequireTitolare>} />
        <Route path="/ricettario/menu/nuovo" element={<RequireTitolare><MenuForm /></RequireTitolare>} />
        <Route path="/ricettario/menu/:id" element={<RequireTitolare><MenuDetail /></RequireTitolare>} />

        {/* Calendario eventi (staff: vista operativa) */}
        <Route path="/calendario-eventi" element={<ReservationsList />} />
        <Route path="/calendario-eventi/nuova" element={<ReservationForm />} />
        <Route
          path="/calendario-eventi/sala-e-orari"
          element={<RequireTitolare><SalaEOrari /></RequireTitolare>}
        />
        <Route path="/calendario-eventi/clienti" element={<ClientiList />} />
        <Route path="/calendario-eventi/clienti/:id" element={<ClienteDetail />} />
        <Route path="/calendario-eventi/:id" element={<ReservationForm />} />

        {/* Agenda (condivisa titolare/staff) */}
        <Route path="/agenda" element={<AgendaList />} />
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        {/* Adempimenti societari: riservati al titolare (§3.5/§3.18) */}
        <Route
          path="/agenda/adempimenti"
          element={
            <RequireTitolare>
              <StampaAdempimenti />
            </RequireTitolare>
          }
        />
        <Route path="/agenda/:id" element={<TaskForm />} />

        {/* Magazzino (condiviso titolare/staff, senza valore economico per lo staff — §3.5) */}
        <Route path="/magazzino" element={<MagazzinoHome />} />
        <Route path="/magazzino/carico" element={<RegistraCarico />} />
        <Route path="/magazzino/lista-spesa" element={<ListaSpesa />} />
        <Route path="/magazzino/tracciabilita" element={<Tracciabilita />} />
        <Route path="/magazzino/scadenze" element={<Scadenze />} />
        {/* Anagrafica Fornitori (§3.11): dati economici (P.IVA, condizioni di
            pagamento) — titolare-only, coerente col resto di §3.5. */}
        <Route
          path="/magazzino/fornitori"
          element={
            <RequireTitolare>
              <FornitoriList />
            </RequireTitolare>
          }
        />
        <Route
          path="/magazzino/fornitori/:id"
          element={
            <RequireTitolare>
              <FornitoreDetail />
            </RequireTitolare>
          }
        />

        {/* HACCP (condiviso: staff fa solo immissione operativa, non modifica struttura/storico — §3.5) */}
        <Route path="/haccp" element={<HaccpHome />} />
        <Route path="/haccp/temperature" element={<TemperatureLog />} />
        <Route path="/haccp/ricevimento" element={<RicevimentoMerci />} />
        <Route path="/haccp/pulizia" element={<PuliziaESanificazione />} />
        <Route path="/haccp/non-conformita" element={<NonConformita />} />
        <Route path="/haccp/manuale" element={<ManualeCompleto />} />
        <Route path="/haccp/raccolta-propria" element={<RaccoltaPropria />} />

        {/* Fatture Fornitori (solo titolare, esplicito nel brief) */}
        <Route path="/fatture-fornitori" element={<RequireTitolare><FattureFornitoriHome /></RequireTitolare>} />

        {/* Cassa, Banca e Prima Nota (solo titolare — §3.5) */}
        <Route path="/cassa" element={<RequireTitolare><CassaHome /></RequireTitolare>} />
        <Route path="/cassa/prima-nota" element={<RequireTitolare><PrimaNota /></RequireTitolare>} />
        <Route path="/cassa/sconti-omaggi" element={<RequireTitolare><ScontiOmaggi /></RequireTitolare>} />
        <Route path="/cassa/causali" element={<RequireTitolare><Causali /></RequireTitolare>} />
        {/* Comande (§3.2, §4 mod. 5): staff-accessibile, voce propria in
            sidebar — non sotto /cassa, dato che è una modalità operativa
            diversa dal resto del gestionale (uno schermo che resta aperto
            tutto il servizio, non una pagina consultata ogni tanto). Il
            legame dati col modulo 5 (conto -> futuro RT) resta nello
            schema, non nell'URL.

            Una postazione, una schermata (§3.2.1): /comande è la SALA
            (tablet verticale), /comande/bar il BAR (tablet orizzontale,
            anche cassa), /comande/cucina la postazione di STAMPA della
            cucina — che per scelta lavora solo di carta. Il vecchio
            schermo unico a tre colonne è stato spento il 09/08/2026,
            quando tutte e tre le postazioni hanno avuto la propria. */}
        <Route path="/comande" element={<Sala />} />
        <Route path="/comande/bar" element={<Bar />} />
        <Route path="/comande/cucina" element={<Cucina />} />
        {/* Il vecchio indirizzo resta come reindirizzo: qualche tablet
            potrebbe averlo ancora nei preferiti. */}
        <Route path="/comande/reparti" element={<Navigate to="/comande/cucina" replace />} />

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
        {/* Prima di /documenti/:id, altrimenti "posta" verrebbe letto come un id. */}
        <Route path="/documenti/posta" element={<RequireTitolare><PostaInArrivo /></RequireTitolare>} />
        <Route path="/documenti/chiedi" element={<RequireTitolare><ChiediArchivio /></RequireTitolare>} />
        {/* Schermata usa-e-getta: prova della dettatura in cucina prima di
            comprare qualunque microfono. Da togliere dopo la decisione. */}
        <Route path="/prova-voce" element={<RequireTitolare><ProvaVoce /></RequireTitolare>} />
        <Route path="/documenti/:id" element={<RequireTitolare><DocumentoDetail /></RequireTitolare>} />

        {/* Editor Menu Cartaceo (solo titolare — i menu sono titolare-only) */}
        <Route path="/editor-menu" element={<RequireTitolare><EditorMenuHome /></RequireTitolare>} />
        <Route path="/editor-menu/giorno" element={<RequireTitolare><PiattiDelGiorno /></RequireTitolare>} />
        <Route path="/editor-menu/bevande" element={<RequireTitolare><BevandeVini /></RequireTitolare>} />

        {/* Agricolo / Orto (solo titolare — §1) */}
        <Route path="/agricolo" element={<RequireTitolare><AgricoloHome /></RequireTitolare>} />
        <Route path="/agricolo/cessioni" element={<RequireTitolare><Cessioni /></RequireTitolare>} />

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
