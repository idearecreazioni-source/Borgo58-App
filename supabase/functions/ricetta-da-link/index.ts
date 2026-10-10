// Edge Function: ricetta-da-link — apre il link di una ricetta e restituisce
// la ricetta che la pagina dichiara. NON salva niente: la bozza la crea il
// gestionale, dal corridoio, dopo averla smontata col lettore di sempre.
//
// ⚠️ Solo il titolare. Le bozze di ricetta sono titolare-only, e una funzione
//    che apre pagine su richiesta non resta aperta a chi ha solo la chiave
//    pubblica.
// ⚠️ Solo i siti di `SITI_AMMESSI` (lettura.ts), ANCHE dopo un rinvio: ogni
//    rinvio si ricontrolla prima di seguirlo, altrimenti un sito ammesso
//    potrebbe mandare la funzione dove vuole.
// La regola di lettura vive in `lettura.ts`, provata senza rete in
// tests/unita/ricetta-da-link.test.js.

import { createClient } from "npm:@supabase/supabase-js@2";
import { indirizzoAmmesso, PESO_MASSIMO, ricettaDallaPagina } from "./lettura.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMPO_MASSIMO_MS = 10_000;
const RINVII_MASSIMI = 3;

function risposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function errore(status: number, codice: string, messaggio: string) {
  return risposta(status, { errore: { codice, messaggio } });
}

/** Scarica la pagina seguendo i rinvii a mano, e solo verso siti ammessi. */
async function scarica(url: string): Promise<{ ok: true; html: string } | { ok: false; messaggio: string }> {
  let attuale = url;
  for (let giro = 0; giro <= RINVII_MASSIMI; giro++) {
    const controllo = new AbortController();
    const timer = setTimeout(() => controllo.abort(), TEMPO_MASSIMO_MS);
    let r: Response;
    try {
      r = await fetch(attuale, {
        redirect: "manual",
        signal: controllo.signal,
        headers: { "User-Agent": "Borgo58-Gestionale/1.0 (importazione ricette)", Accept: "text/html" },
      });
    } catch {
      clearTimeout(timer);
      return { ok: false, messaggio: "Non riesco ad aprire la pagina: riprova fra poco." };
    }
    clearTimeout(timer);

    if (r.status >= 300 && r.status < 400) {
      const dove = r.headers.get("location");
      if (!dove) return { ok: false, messaggio: "La pagina rimanda altrove senza dire dove." };
      const prossimo = indirizzoAmmesso(new URL(dove, attuale).toString());
      if (!prossimo.ok) return { ok: false, messaggio: "La pagina rimanda a un sito che non leggo." };
      attuale = prossimo.url;
      continue;
    }
    if (r.status === 404) {
      return { ok: false, messaggio: "Questa ricetta non esiste più, o il link è sbagliato." };
    }
    if (!r.ok) {
      return { ok: false, messaggio: `La pagina ha risposto con un errore (${r.status}).` };
    }
    const dichiarato = Number(r.headers.get("content-length") ?? "0");
    if (dichiarato > PESO_MASSIMO) {
      return { ok: false, messaggio: "La pagina è troppo grande per essere una ricetta." };
    }
    const html = await r.text();
    if (html.length > PESO_MASSIMO) {
      return { ok: false, messaggio: "La pagina è troppo grande per essere una ricetta." };
    }
    return { ok: true, html };
  }
  return { ok: false, messaggio: "La pagina rimanda altrove troppe volte." };
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
    return errore(403, "ruolo", "Importare una ricetta da un link è riservato al titolare.");
  }

  let corpo: { url?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return errore(400, "richiesta", "Richiesta non leggibile.");
  }

  const indirizzo = indirizzoAmmesso(corpo?.url);
  if (!indirizzo.ok) return errore(400, "indirizzo", indirizzo.messaggio);

  const pagina = await scarica(indirizzo.url);
  if (!pagina.ok) return errore(502, "pagina", pagina.messaggio);

  const letta = ricettaDallaPagina(pagina.html);
  if (!letta.ok) return errore(422, "ricetta", letta.messaggio);

  return risposta(200, { risultato: { url: indirizzo.url, ricetta: letta.ricetta } });
});
