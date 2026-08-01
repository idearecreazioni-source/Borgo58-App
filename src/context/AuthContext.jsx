import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// Due account (§3.5 del brief): titolare e staff (condiviso). Il PIN digitato
// è la password dell'account. L'app prova prima il titolare, poi lo staff —
// il PIN stesso determina il ruolo (i due PIN devono essere diversi). Gli
// account vanno creati dalla dashboard Supabase; Claude non gestisce credenziali.
const TITOLARE_EMAIL = "alessio@borgo58.app";
const STAFF_EMAIL = "staff@borgo58.app";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (activeSession) => {
    if (!activeSession) {
      setRole(null);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", activeSession.user.id)
      .maybeSingle();
    setRole(data?.role ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await fetchRole(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        await fetchRole(newSession);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Prova titolare, poi staff: il PIN corretto determina l'account e quindi il ruolo.
  const login = async (pin) => {
    let result = await supabase.auth.signInWithPassword({
      email: TITOLARE_EMAIL,
      password: pin,
    });
    if (result.error) {
      result = await supabase.auth.signInWithPassword({
        email: STAFF_EMAIL,
        password: pin,
      });
    }
    if (result.error) return { ok: false, message: result.error.message };
    return { ok: true };
  };

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        role,
        isTitolare: role === "titolare",
        isStaff: role === "staff",
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
