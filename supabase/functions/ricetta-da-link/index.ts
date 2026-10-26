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
//
// 🔴 L'ASSISTENTE (10/10/2026, decisione di Alessio): letta la ricetta, un
//    modello PROPONE categoria, fasi e nomi puliti (`proposte.ts`), e dal 25/10
//    anche tipo, stagioni, tag e allergeni — tutto da confermare. Non tocca
//    i numeri. Se non risponde, se manca la chiave o se il tetto di spesa e'
//    raggiunto, la ricetta arriva lo stesso, senza proposte, e lo si dice:
//    l'importazione non dipende dall'assistente.
// ⚠️ Ogni chiamata si registra (`registra_lettura_ricetta`) e quindi entra
//    nel tetto unico della spesa (`consumi_ai`), anche quella fallita.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { indirizzoAmmesso, PESO_MASSIMO, ricettaDallaPagina, type RicettaLetta } from "./lettura.ts";
import { domandaPerAssistente, ISTRUZIONI, jsonDallaRisposta, proposteValide, type Proposte } from "./proposte.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMPO_MASSIMO_MS = 10_000;
const RINVII_MASSIMI = 3;

// 🔴 25/10/2026: DAL MODELLO PICCOLO AL MEDIO. Fino a ieri qui si chiedevano
// solo classificazioni e nomi, «niente che riguardi la salute», e il modello
// piccolo bastava. Adesso si chiedono anche gli ALLERGENI (l'archivio delle
// ricette, approvato da Alessio): restano proposte da confermare, ma una
// proposta sbagliata su un allergene costa più di qualche centesimo. Lo
// stesso modello che legge le etichette (`leggi-foto`).
const MODELLO = "claude-sonnet-5";
// Il tetto si alza nello stesso momento in cui si chiede di scrivere di piu'
// (CLAUDE.md §8): una riga per ingrediente e una per passaggio. Non si paga
// cio' che non si scrive.
const TETTO_RISPOSTA = 4000;

type Assistente = {
  esito: "proposte" | "saltato" | "errore";
  messaggio: string | null;
  proposte: Proposte | null;
};

/**
 * Le etichette già usate nell'archivio, perché l'assistente riusi quelle
 * invece di inventarne di simili («pesce» e «di pesce»).
 * ⚠️ Una lettura fallita non ferma niente: senza la lista l'assistente
 *    propone lo stesso, solo senza il suggerimento. I tag si leggono dalle
 *    righe, e il gateway ne restituisce al
 *    più mille per tabella SENZA dirlo: oltre, la lista è parziale. Qui si
 *    accetta, perché è un suggerimento e non un dato — una lista più corta
 *    fa solo proporre qualche etichetta nuova in più.
 */
async function tagGiaUsati(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const [ricette, bozze] = await Promise.all([
    supabase.from("recipes").select("tags").limit(1000),
    supabase.from("bozze_ricetta").select("tags").limit(1000),
  ]);
  const tutti = new Set<string>();
  for (const r of [...(ricette.data ?? []), ...(bozze.data ?? [])]) {
    for (const t of (r as { tags?: string[] }).tags ?? []) tutti.add(t);
  }
  return [...tutti].sort().slice(0, 200);
}

async function chiediAssistente(
  supabase: ReturnType<typeof createClient>,
  ricetta: RicettaLetta,
): Promise<Assistente> {
  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) {
    return { esito: "saltato", messaggio: "L'assistente non è configurato: categoria e fasi vanno scelte a mano.", proposte: null };
  }

  // Il tetto, PRIMA di spendere.
  const { data: spesa, error: erroreSpesa } = await supabase.rpc("spesa_ai_del_mese");
  const stato = Array.isArray(spesa) ? spesa[0] : spesa;
  if (erroreSpesa || stato?.blocca) {
    const messaggio = erroreSpesa
      ? "Non riesco a leggere la spesa dell'assistente: categoria e fasi vanno scelte a mano."
      : `${stato?.frase ?? "La spesa del mese ha raggiunto il tetto."} Categoria e fasi vanno scelte a mano.`;
    await supabase.rpc("registra_lettura_ricetta", { p_esito: "tetto", p_messaggio: messaggio });
    return { esito: "saltato", messaggio, proposte: null };
  }

  let tokenDomanda = 0;
  let tokenRisposta = 0;
  try {
    const anthropic = new Anthropic({ apiKey: chiave });
    const esito = await anthropic.messages.create({
      model: MODELLO,
      max_tokens: TETTO_RISPOSTA,
      system: ISTRUZIONI,
      messages: [{ role: "user", content: domandaPerAssistente(ricetta, await tagGiaUsati(supabase)) }],
    });
    tokenDomanda = esito.usage.input_tokens;
    tokenRisposta = esito.usage.output_tokens;
    if (esito.stop_reason === "max_tokens") throw new Error("La risposta si è interrotta a metà.");
    const testo = esito.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
    const proposte = proposteValide(jsonDallaRisposta(testo), ricetta.ingredienti.length, ricetta.passaggi.length);
    await supabase.rpc("registra_lettura_ricetta", {
      p_esito: "proposte",
      p_modello: MODELLO,
      p_token_domanda: tokenDomanda,
      p_token_risposta: tokenRisposta,
    });
    return { esito: "proposte", messaggio: null, proposte };
  } catch (e) {
    // ⚠️ Una chiamata fallita a meta' si paga lo stesso: i token si registrano.
    await supabase.rpc("registra_lettura_ricetta", {
      p_esito: "errore",
      p_modello: tokenDomanda || tokenRisposta ? MODELLO : null,
      p_token_domanda: tokenDomanda,
      p_token_risposta: tokenRisposta,
      p_messaggio: (e as Error).message,
    });
    return {
      esito: "errore",
      messaggio: "L'assistente non ha risposto: la ricetta è importata, categoria e fasi vanno scelte a mano.",
      proposte: null,
    };
  }
}

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

  const assistente = await chiediAssistente(supabase, letta.ricetta);

  return risposta(200, { risultato: { url: indirizzo.url, ricetta: letta.ricetta, assistente } });
});
