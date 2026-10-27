// =====================================================================
// PROMEMORIA PER LUOGO — 28/10/2026, chiesto da Alessio: «ricordami di
// fare questo quando arrivo a casa».
// =====================================================================
// La chiama un'automazione dell'app Comandi dell'iPhone («quando arrivo a
// Casa»), con un POST e un corpo JSON:  { "chiave": "...", "luogo": "casa" }
// e risponde col testo della notifica (vuoto se non c'e' niente da fare).
//
// 🔴 IL PORTIERE E' LA CHIAVE, controllata nel database
//    (`luogo_promemoria`, migrazione 20261028000003): impronta sha256,
//    revocabile, 30 letture all'ora. Qui non si usa mai la chiave di
//    servizio: si entra da anonimi, come `ascolta-voce`.
// ⚠️ La chiave sta nel CORPO, mai nell'indirizzo: un indirizzo finisce nei
//    registri di rete, un corpo no. E il corpo non si scrive nei log.
// ⚠️ Installata senza verifica del token (`SENZA_TOKEN` in
//    scripts/funzione.mjs): il gateway pretenderebbe un'intestazione che
//    l'automazione non ha, e la chiave anon che la soddisferebbe e' pubblica.

import { createClient } from "npm:@supabase/supabase-js@2";
import { LUOGHI, testoNotifica } from "./testo.ts";

const TESTO = { "Content-Type": "text/plain; charset=utf-8" };

const risposta = (stato: number, testo: string) => new Response(testo, { status: stato, headers: TESTO });

Deno.serve(async (req) => {
  if (req.method !== "POST") return risposta(405, "Si chiama con POST.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnon) return risposta(500, "Configurazione dell'ambiente mancante.");

  let chiave = req.headers.get("x-chiave-luogo") ?? "";
  let luogo = "";
  try {
    const corpo = await req.json();
    if (!chiave && typeof corpo?.chiave === "string") chiave = corpo.chiave;
    luogo = String(corpo?.luogo ?? "").trim().toLowerCase();
  } catch {
    return risposta(400, "La richiesta non è leggibile: serve un corpo JSON con chiave e luogo.");
  }

  if (!chiave) return risposta(401, "Manca la chiave.");
  if (!LUOGHI[luogo]) return risposta(400, `Il luogo «${luogo}» non lo conosco: i luoghi sono casa e ristorante.`);

  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { data, error } = await supabase.rpc("luogo_promemoria", { p_chiave: chiave, p_luogo: luogo });
  if (error) {
    const msg = error.message ?? "";
    if (msg.startsWith("Troppe richieste")) return risposta(429, msg);
    if (msg === "Questa chiave non vale." || msg === "Manca la chiave.") return risposta(401, msg);
    return risposta(400, msg);
  }

  const impegni = Array.isArray(data?.impegni) ? data.impegni : [];
  return risposta(200, testoNotifica(luogo, impegni, Number(data?.quanti ?? impegni.length)));
});
