import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// Applicazione monoutente (§3.3 del brief): un solo account Supabase Auth,
// email fissa nota all'app. Il "PIN" digitato dall'utente è la password
// di quell'unico account. L'utente va creato una volta dalla dashboard
// Supabase (Authentication → Add user) — Claude non gestisce credenziali.
const SINGLE_USER_EMAIL = "alessio@borgo58.app";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const login = async (pin) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: SINGLE_USER_EMAIL,
      password: pin,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  };

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!session, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
