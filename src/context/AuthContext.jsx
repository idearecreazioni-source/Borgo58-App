import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ambienteCorrente } from "../lib/ambiente";

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

// 🔴 SU CASA IL RUOLO SI RICORDA (fase 4, 31/10/2026). Casa si apre anche
// senza rete (la coda delle foto): se il ruolo si potesse solo chiedere al
// database, all'avvio senza rete il titolare risulterebbe nessuno e la coda
// gli sarebbe chiusa. Quindi l'ultimo ruolo LETTO si tiene nel telefono, per
// utente, e si usa solo quando la lettura fallisce.
// ⚠️ SOLO SU CASA: sul locale niente cambia. E non apre niente che il
// database non apra: la barriera vera resta la RLS, e senza rete il database
// non si tocca comunque.
const SU_CASA = ambienteCorrente().genere === "casa";
const chiaveRuolo = (userId) => `casa-ruolo:${userId}`;
function ricordaRuolo(userId, ruolo) {
  if (!SU_CASA) return;
  try {
    if (ruolo) localStorage.setItem(chiaveRuolo(userId), ruolo);
    else localStorage.removeItem(chiaveRuolo(userId));
  } catch {
    // Senza memoria del browser si torna al comportamento di sempre.
  }
}
function ruoloRicordato(userId) {
  if (!SU_CASA) return null;
  try {
    return localStorage.getItem(chiaveRuolo(userId));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  // 🔴 «NON SO CHI SEI» NON E' «NON SEI NESSUNO» (notte del 28/10/2026,
  //    dalla revisione): se la lettura del ruolo falliva per la rete, il
  //    ruolo diventava vuoto e il titolare, gia' dentro, si ritrovava senza
  //    permessi e senza nessun messaggio. Adesso un ruolo gia' noto resta, e
  //    il Layout dice che non si e' riusciti a verificarlo, con «Riprova».
  const [ruoloNonLetto, setRuoloNonLetto] = useState(false);
  const [sessioneAttuale, setSessioneAttuale] = useState(null);

  // ⚠️ Solo l'ultima lettura conta (01/11/2026, revisione
  //    ecc:react-reviewer): al ritorno della rete partono insieme la
  //    rilettura dell'evento «online» e quella del token rinnovato, e una
  //    vecchia fallita arrivata dopo rimetteva il riquadro sull'accesso.
  const ultimaLettura = useRef(0);

  const fetchRole = async (activeSession) => {
    const questa = ++ultimaLettura.current;
    if (!activeSession) {
      setRole(null);
      setRuoloNonLetto(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", activeSession.user.id)
        .maybeSingle();
      if (questa !== ultimaLettura.current) return;
      if (error) throw error;
      setRole(data?.role ?? null);
      ricordaRuolo(activeSession.user.id, data?.role ?? null);
      setRuoloNonLetto(false);
    } catch (e) {
      if (questa !== ultimaLettura.current) return;
      const ricordato = ruoloRicordato(activeSession.user.id);
      if (ricordato) setRole((attuale) => attuale ?? ricordato);
      setRuoloNonLetto(e?.message || true);
    }
  };

  useEffect(() => {
    // ⚠️ `finally`: senza, un errore qui lasciava il gestionale sul
    //    «Caricamento…» per sempre, senza una via d'uscita.
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        setSessioneAttuale(data.session);
        await fetchRole(data.session);
      })
      .catch((e) => setRuoloNonLetto(e?.message || true))
      .finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setSessioneAttuale(newSession);
        await fetchRole(newSession);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Quando la rete torna il ruolo si rilegge da solo: senza, il riquadro
  // sull'accesso restava finche' non si premeva «Riprova» o si cambiava
  // pagina (prova in modalita' aereo, 01/11/2026).
  useEffect(() => {
    if (!sessioneAttuale) return undefined;
    const rileggi = () => fetchRole(sessioneAttuale);
    window.addEventListener("online", rileggi);
    return () => window.removeEventListener("online", rileggi);
  }, [sessioneAttuale]);

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

  const logout = async () => {
    // Su Casa il ruolo ricordato si dimentica uscendo.
    // SILENZIO MOTIVATO: senza sessione leggibile non c'e' ruolo da
    // dimenticare, e l'uscita deve avvenire comunque.
    const { data } = await supabase.auth.getSession().catch(() => ({ data: null }));
    if (data?.session) ricordaRuolo(data.session.user.id, null);
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        role,
        isTitolare: role === "titolare",
        isStaff: role === "staff",
        loading,
        ruoloNonLetto,
        riprovaRuolo: () => fetchRole(sessioneAttuale),
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
