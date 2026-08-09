import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // In sviluppo: se manca la configurazione, lo diciamo chiaramente in console.
  console.warn(
    "Configurazione Supabase mancante. Imposta VITE_SUPABASE_URL e " +
      "VITE_SUPABASE_ANON_KEY nel file .env.local (vedi .env.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Il varco pubblico (/prenota) parla SEMPRE da anonimo, anche se in quel
// browser il gestionale è aperto e loggato.
//
// Perché serve un secondo collegamento (trovato dal vivo il 09/08/2026,
// Alessio non riusciva a inviare dal proprio form): il collegamento qui
// sopra allega la sessione di chi è dentro, e la funzione delle richieste
// pubbliche è concessa al solo ruolo anonimo. Risultato: chiunque avesse
// il gestionale aperto — il titolare, un tablet di sala che mostra il
// link a un cliente al telefono — riceveva un rifiuto secco.
//
// La cura giusta non è allargare il permesso (il varco pubblico deve
// restare l'unica porta del ruolo anonimo, §6 del CLAUDE.md) ma far sì
// che una pagina pubblica si comporti da pubblica per tutti. Senza
// sessione salvata: nessun token da allegare, nessuna eccezione.
export const supabasePubblico = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "borgo58-pubblico",
  },
});
