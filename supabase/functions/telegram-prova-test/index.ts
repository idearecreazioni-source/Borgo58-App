// Edge Function: telegram-prova-test — UNA notifica «TEST PROVA», a mano, solo
// su Borgo58-Prova. Il perche' e i limiti stanno in `prova.ts`.
//
// ⚠️ IL CORPO DELLA RICHIESTA NON SI LEGGE MAI: il testo e' fisso e non c'e'
//    niente che il chiamante possa far arrivare su Telegram.
import { eseguiLaProva, INTESTAZIONE_CHIAVE } from "./prova.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const TELEGRAM_PROVA_CHIAVE = Deno.env.get("TELEGRAM_PROVA_CHIAVE");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function rpc(nome: string, corpo: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE!,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status}`);
  return await r.json();
}

Deno.serve(async (req) => {
  let risposta;
  try {
    risposta = await eseguiLaProva({
      metodo: req.method,
      supabaseUrl: SUPABASE_URL,
      chiaveAttesa: TELEGRAM_PROVA_CHIAVE,
      chiaveRicevuta: req.headers.get(INTESTAZIONE_CHIAVE),
      botPresente: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID),
      memoriaPresente: Boolean(SUPABASE_URL && SERVICE_ROLE),
      prendi: (c) => rpc("prendi_consegna", { p_chiave: c }) as Promise<never>,
      conferma: async (c) => {
        await rpc("conferma_consegna", { p_chiave: c });
      },
      rilascia: async (c) => {
        await rpc("rilascia_consegna", { p_chiave: c });
      },
      manda: async (testo) => {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: testo }),
        });
        return res.ok ? { riuscito: true } : { riuscito: false };
      },
    });
  } catch {
    risposta = { stato: 500, corpo: { ok: false, error: "Errore interno: non si manda" } };
  }
  return new Response(JSON.stringify(risposta.corpo), {
    status: risposta.stato,
    headers: { "Content-Type": "application/json" },
  });
});
