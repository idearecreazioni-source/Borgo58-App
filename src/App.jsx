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
import MenuList from "./pages/ricettario/MenuList";
import MenuForm from "./pages/ricettario/MenuForm";
import MenuDetail from "./pages/ricettario/MenuDetail";
import ReservationsList from "./pages/calendario/ReservationsList";
import ReservationForm from "./pages/calendario/ReservationForm";

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/" replace />;
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
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ricettario" element={<RicettarioHome />} />
        <Route path="/ricettario/ingredienti" element={<IngredientiList />} />
        <Route path="/ricettario/ingredienti/nuovo" element={<IngredienteForm />} />
        <Route path="/ricettario/ingredienti/:id" element={<IngredienteForm />} />
        <Route path="/ricettario/ricette" element={<RicetteList />} />
        <Route path="/ricettario/ricette/nuova" element={<RicettaForm />} />
        <Route path="/ricettario/ricette/:id" element={<RicettaDetail />} />
        <Route path="/ricettario/menu" element={<MenuList />} />
        <Route path="/ricettario/menu/nuovo" element={<MenuForm />} />
        <Route path="/ricettario/menu/:id" element={<MenuDetail />} />
        <Route path="/calendario-eventi" element={<ReservationsList />} />
        <Route path="/calendario-eventi/nuova" element={<ReservationForm />} />
        <Route path="/calendario-eventi/:id" element={<ReservationForm />} />
        <Route path="/moduli/:moduleId" element={<ModulePlaceholder />} />
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
