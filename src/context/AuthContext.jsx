import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// Due account (§3.5 del brief): titolare e staff (condiviso). Il PIN digitato
// è la password dell'account. L'app prova prima il titolare, poi lo staff —
// il PIN stesso determina il ruolo (i due PIN devono essere diversi). Gli
// account vanno creati dalla dashboard Supabase; Claude non gestisce credenziali.
//
// 🔴 GLI INDIRIZZI NON SONO PIÙ SCRITTI QUI — 02/09/2026.
//
// Erano due costanti, e ha funzionato per un mese: un database solo, nessun
// ambiente separato. Dal 01/09 gli ambienti sono **due** — l'anteprima
// collegata al progetto di prova e `borgo58.it` — e **lo stesso pacchetto**
// serve tutti e due: cambiare l'indirizzo per entrare nell'uno cambierebbe
// anche l'altro. Il 01/09 Alessio ha aperto l'anteprima e non è potuto
// entrare, perché questa schermata prova **solo** i due indirizzi che aveva
// dentro e l'indirizzo non si digita.
//
// ⚠️ QUELLO CHE ARRIVA QUI È GIÀ VALIDATO. La decisione — quali indirizzi, e
// il rifiuto di quelli storti — avviene **a tempo di costruzione**, in
// `scripts/indirizzi-accesso.mjs`. Qui non si sceglie e non si controlla
// niente: si legge. Se un valore fosse sbagliato, la costruzione sarebbe già
// fallita e questo pacchetto non esisterebbe.
//
// 🔴 E QUESTO FILE NON IMPORTA QUEL MODULO, né oggi né mai: è solo-Node, e
// tirandolo dentro finirebbe `node:fs` nel pacchetto del browser. Riceve
// **soltanto** la stringa iniettata da `define`, e la spezza con
// `decodeURIComponent`, che è una funzione del linguaggio e non di Node.
// C'è una prova che legge tutti i file di `src/` e diventa rossa se qualcuno
// lo importa «solo per riusare una funzione».
//
// ⚠️ Senza nessuna variabile impostata, questi due valgono esattamente
// `alessio@borgo58.app` e `staff@borgo58.app`: la produzione non cambia.
const [, TITOLARE_CODIFICATO, STAFF_CODIFICATO] = __INDIRIZZI_ACCESSO__.split(",");
const TITOLARE_EMAIL = decodeURIComponent(TITOLARE_CODIFICATO);
const STAFF_EMAIL = decodeURIComponent(STAFF_CODIFICATO);

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

// Il linter segnala che esportare useAuth accanto al componente riduce
// l'efficacia del ricaricamento a caldo in sviluppo. Spostarlo in un file
// a parte significherebbe però toccare gli import di una trentina di
// pagine per un guadagno di sola comodità in sviluppo, senza alcun effetto
// sul comportamento dell'app: non vale il rischio di un cambiamento così
// diffuso. Valutato durante la pulizia lint del 05/08/2026.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
