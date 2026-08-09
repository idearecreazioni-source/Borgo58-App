// Edge Function: operazioni-atomiche — il corridoio unico per le
// operazioni "tutto o niente" del gestionale.
//
// Giustificazione (Contratto Architetturale v2, §2): B4 — orchestrazione
// di scritture multi-tabella. Confermato da Alessio il 09/08/2026: il
// client non chiama mai direttamente la RPC di un'operazione
// multi-tabella — passa da qui. Dentro, ogni operazione resta UNA
// funzione Postgres (una chiamata RPC = una transazione): questo file
// non contiene logica di dominio e non deve mai contenerne.
//
// Regole del Contratto §6 rispettate da questo unico punto:
//  - verifica del JWT in un solo posto (non reimplementata per endpoint);
//  - formato di errore uniforme: { errore: { codice, messaggio } };
//  - nessuna autorizzazione duplicata: decidono la RLS e la funzione
//    Postgres, che riceve il JWT dell'utente REALE — mai service_role;
//  - nessun segreto nel codice (SUPABASE_URL/ANON_KEY sono iniettate
//    dall'ambiente, e la anon key non è un segreto).
//
// Per aggiungere un'operazione nuova: una riga nell'elenco OPERAZIONI.
// Può precedere la migrazione che crea la funzione Postgres: un nome in
// elenco senza funzione nel database è inerte (la chiamata fallisce con
// "funzione inesistente" e nessun client la invoca finché non viene
// attivata) — così il corridoio si ridistribuisce una volta per blocco di
// lavoro, non a ogni singola funzione.

import { createClient } from "npm:@supabase/supabase-js@2";

// Elenco CHIUSO delle operazioni invocabili. Tutto ciò che non è qui
// dentro riceve un rifiuto: il corridoio non è un passacarte generico
// verso qualunque RPC del database.
const OPERAZIONI = new Set([
  // Comande / cassa (attiva dall'09/08/2026)
  "close_order_as_discount_gift",
  // Blocco 1 — cessioni intercompany e mance
  "create_intercompany_cession",
  "create_tip_distribution",
  // Blocco 2 — record + promemoria collegato
  "create_document",
  "create_fiscal_tool",
  "create_employee_document",
  "create_supplier_invoice",
  "pay_supplier_invoice",
  // Blocco 3 — cancellazioni con chiusura del promemoria
  "delete_document",
  "delete_fiscal_tool",
  "delete_employee_document",
  "delete_employee",
  "delete_supplier_invoice",
  // Blocco 4 — rifiniture
  "create_ingredient",
  "set_active_menu",
  "swap_recipe_steps",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errore(status: number, codice: string, messaggio: string) {
  return new Response(JSON.stringify({ errore: { codice, messaggio } }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return errore(405, "metodo", "Metodo non ammesso");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return errore(500, "config", "Configurazione dell'ambiente mancante");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errore(401, "auth", "Autenticazione mancante");

  // Client costruito con il token dell'UTENTE: da qui in poi RLS e
  // auth.uid() valgono dentro la funzione Postgres esattamente come se
  // la chiamata partisse dal tablet.
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: utente, error: authError } = await supabase.auth.getUser();
  if (authError || !utente?.user) {
    return errore(401, "auth", "Sessione non valida: rifare l'accesso");
  }

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return errore(400, "corpo", "Richiesta senza corpo JSON valido");
  }

  const operazione = corpo?.operazione;
  const parametri = corpo?.parametri ?? {};
  if (typeof operazione !== "string" || !OPERAZIONI.has(operazione)) {
    return errore(404, "operazione", "Operazione non ammessa");
  }

  const { data, error } = await supabase.rpc(operazione, parametri);
  if (error) {
    // Il messaggio della funzione Postgres è scritto per chi lavora in
    // sala (es. "Questo conto è già stato chiuso"): va restituito intatto.
    return errore(409, error.code ?? "db", error.message);
  }

  return new Response(JSON.stringify({ risultato: data ?? null }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
