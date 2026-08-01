import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import PublicReservationForm from "./pages/public/PublicReservationForm";

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
        <Route path="/calendario-eventi/:id" element={<ReservationForm />} />

        {/* Placeholder degli altri moduli — riservati al titolare */}
        <Route path="/moduli/:moduleId" element={<RequireTitolare><ModulePlaceholder /></RequireTitolare>} />
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
