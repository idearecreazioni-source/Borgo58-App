// IL COLLEGAMENTO AL DATABASE, FINTO — per le prove visive a pagina intera.
//
// 🔴 PERCHÉ ESISTE (26/09/2026). Le prove visive dell'Agenda sostituiscono
//    un modulo di letture solo. Per misurare nel browser le schermate VERE
//    di Dashboard, Prima nota, Causali, Sala e orari, Spesa spicciola e
//    scheda di un ingrediente servirebbe un finto per ogni modulo di
//    letture; si sostituisce invece il collegamento stesso. Ogni lettura
//    restituisce le righe preparate dalla pagina di prova in
//    `window.__DATI_FINTI` (per tabella e per funzione), e niente esce dal
//    computer: le scritture tornano «riuscite» senza andare da nessuna parte.
//
// ⚠️ È una prova della FORMA, non dei dati: chi vuole provare cosa fa una
//    lettura usa le prove sul progetto di prova.

const dati = () => window.__DATI_FINTI ?? {};
const righeDi = (tabella) => dati().tabelle?.[tabella] ?? [];

// Una risposta che si può ancora concatenare (`.eq().order()…`) e che,
// attesa, restituisce quello che serve.
function risposta(calcola) {
  let unica = false;
  let intervallo = null;
  const esito = () => {
    const tutte = calcola();
    if (!Array.isArray(tutte)) return { data: tutte, error: null, count: null };
    if (unica) return { data: tutte[0] ?? null, error: null, count: null };
    const righe = intervallo ? tutte.slice(intervallo[0], intervallo[1] + 1) : tutte;
    return { data: righe, error: null, count: tutte.length };
  };
  const catena = new Proxy(function () {}, {
    get(_, nome) {
      if (nome === "then") return (ok, ko) => Promise.resolve(esito()).then(ok, ko);
      if (nome === "single" || nome === "maybeSingle") {
        return () => {
          unica = true;
          return catena;
        };
      }
      if (nome === "range") {
        return (da, a) => {
          intervallo = [da, a];
          return catena;
        };
      }
      return () => catena;
    },
  });
  return catena;
}

const canale = { on: () => canale, subscribe: () => canale, unsubscribe: () => {} };

export const supabase = {
  from: (tabella) => risposta(() => righeDi(tabella)),
  rpc: (nome) => risposta(() => dati().rpc?.[nome] ?? null),
  channel: () => canale,
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null }),
      createSignedUrl: async () => ({ data: null, error: null }),
      download: async () => ({ data: null, error: null }),
    }),
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
};

export const supabasePubblico = supabase;
