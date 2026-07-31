// Edge Function: notifica Telegram per nuove richieste di prenotazione dal
// form pubblico (§3.3 del brief). Attivata da un Database Webhook su INSERT
// nella tabella "reservations" (configurato separatamente nella dashboard
// Supabase — vedi supabase/functions/notify-telegram-reservation/README.md).
//
// Notifica solo le richieste con source = "form_pubblico": le prenotazioni
// che Alessio inserisce lui stesso da staff non generano un avviso a se
// stesso.

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

function formatMessage(record: Record<string, unknown>): string {
  const date = record.reservation_date as string;
  const time = (record.reservation_time as string)?.slice(0, 5);
  const partySize = record.party_size;
  const name = record.customer_name as string;
  const phone = record.customer_phone as string | null;
  const email = record.customer_email as string | null;
  const notes = record.notes as string | null;

  const contactLines = [
    phone ? `Tel: ${phone}` : null,
    email ? `Email: ${email}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "🔔 Nuova richiesta di prenotazione",
    "",
    `${date} alle ${time} — ${partySize} coperti`,
    `Cliente: ${name}`,
    contactLines,
    notes ? `Note: ${notes}` : null,
    "",
    "Apri il gestionale per confermare o rifiutare.",
  ]
    .filter((line) => line !== null && line !== "")
    .join("\n");
}

Deno.serve(async (req) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = await req.json();
  const record = payload.record;

  if (!record || record.source !== "form_pubblico") {
    // Non è una richiesta dal form pubblico (es. inserita da staff): nessuna notifica.
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const telegramRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: formatMessage(record),
      }),
    }
  );

  if (!telegramRes.ok) {
    const detail = await telegramRes.text();
    return new Response(JSON.stringify({ error: "Invio Telegram fallito", detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
