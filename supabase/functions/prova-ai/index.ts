// =====================================================================
// prova-ai — verifica che la catena verso l'intelligenza artificiale regga
// =====================================================================
// Perché è una Edge Function e non codice nel browser: **condizione B2 del
// Contratto Architetturale** — la chiave dell'account AI è un segreto che
// non può mai arrivare al client. Vive nei Secrets della funzione
// (`Deno.env`), mai nel repository, mai nel bundle del sito.
//
// Cosa fa: legge la chiave dai Secrets, manda la domanda più corta
// possibile al modello, restituisce la risposta. Nessuna funzionalità di
// prodotto — è il collaudo della catena
//   chiave nei Secrets → chiamata → risposta,
// cioè l'ultimo blocco del Mandato strutturale. I moduli AI veri
// (assistente, importatore ricette, monitoraggio) si costruiscono dopo,
// e solo se questa risponde.
//
// Chi può chiamarla: il solo titolare. Non è una schermata di sala, ed è
// una funzione che costa soldi a ogni chiamata: la barriera sta qui e
// nella RLS, non in un pulsante nascosto.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const chiaveAI = Deno.env.get("ANTHROPIC_API_KEY");

  if (!supabaseUrl || !supabaseAnon) {
    return errore(500, "config", "Configurazione dell'ambiente mancante");
  }
  if (!chiaveAI) {
    // Messaggio esplicito: è il guasto più probabile del primo giorno.
    return errore(
      500,
      "chiave",
      "La chiave dell'account AI non è nei Secrets di questa funzione (ANTHROPIC_API_KEY)."
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errore(401, "auth", "Autenticazione mancante");

  // Stessa verifica del corridoio: si passa il token dell'utente vero a
  // valle, e la funzione del database dice se è il titolare.
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: utente, error: authError } = await supabase.auth.getUser();
  if (authError || !utente?.user) {
    return errore(401, "auth", "Sessione non valida: rifare l'accesso");
  }

  const { data: titolare, error: ruoloError } = await supabase.rpc("is_titolare");
  if (ruoloError) return errore(500, "ruolo", "Impossibile verificare il ruolo");
  if (titolare !== true) {
    return errore(403, "ruolo", "Solo il titolare può usare l'intelligenza artificiale");
  }

  // -------------------------------------------------------------------
  // La chiamata più corta che dimostri qualcosa.
  //
  // Ragionamento SPENTO di proposito: su questo modello è acceso da solo,
  // e il tetto di token vale per ragionamento e risposta insieme — una
  // prova con tetto basso verrebbe troncata a metà. Qui non serve pensare:
  // serve sapere se la chiave apre la porta.
  // -------------------------------------------------------------------
  const anthropic = new Anthropic({ apiKey: chiaveAI });

  try {
    const risposta = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 64,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: "Rispondi con una sola parola.",
      messages: [{ role: "user", content: "Se ricevi questo messaggio, rispondi: FUNZIONA" }],
    });

    const testo = risposta.content
      .filter((blocco) => blocco.type === "text")
      .map((blocco) => (blocco as { text: string }).text)
      .join(" ")
      .trim();

    return new Response(
      JSON.stringify({
        risultato: {
          ok: true,
          modello: risposta.model,
          risposta: testo,
          motivo_arresto: risposta.stop_reason,
          token: {
            domanda: risposta.usage.input_tokens,
            risposta: risposta.usage.output_tokens,
          },
        },
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    // I due guasti che contano il primo giorno, detti in italiano:
    // chiave sbagliata (401) e credito/tetto di spesa esaurito (400/429).
    const stato = (e as { status?: number }).status;
    const dettaglio = (e as { message?: string }).message ?? "errore sconosciuto";

    if (stato === 401) {
      return errore(502, "chiave", "La chiave dell'account AI non è valida o è stata revocata.");
    }
    if (stato === 429) {
      return errore(502, "limite", "Limite di spesa o di richieste raggiunto sull'account AI.");
    }
    return errore(502, "ai", `L'account AI ha risposto con un errore: ${dettaglio}`);
  }
});
