// Edge Function: notifiche Telegram del gestionale. Un solo motore, due
// origini possibili (stesso principio già adottato per gli assistenti AI
// nel brief — un'infrastruttura, più punti d'uso):
//
// 1) Nuove richieste di prenotazione dal form pubblico (§3.3) — chiamata dal
//    trigger su INSERT in "reservations" (migrazione 0006), payload
//    { record: {...} }. Notifica solo source = "form_pubblico".
// 2) Promemoria Agenda (§3.9) — chiamata dal job pg_cron ogni 5 minuti
//    (migrazione 0008), payload { type: "task_reminder", task: {...} }.
//    L'utente sceglie liberamente data/ora del promemoria per ogni task.

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

function formatReservationMessage(record: Record<string, unknown>): string {
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

function formatTaskReminderMessage(task: Record<string, unknown>): string {
  const title = task.title as string;
  const description = task.description as string | null;
  const dueDate = task.due_date as string | null;
  const dueTime = (task.due_time as string | null)?.slice(0, 5);
  const category = task.category as string | null;

  return [
    "📌 Promemoria",
    "",
    title,
    category ? `Categoria: ${category}` : null,
    dueDate ? `Scadenza: ${dueDate}${dueTime ? ` alle ${dueTime}` : ""}` : null,
    description ? description : null,
  ]
    .filter((line) => line !== null && line !== "")
    .join("\n");
}

async function sendTelegram(text: string) {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
}

Deno.serve(async (req) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = await req.json();
  let message: string | null = null;

  if (payload.type === "task_reminder" && payload.task) {
    message = formatTaskReminderMessage(payload.task);
  } else if (payload.record?.source === "form_pubblico") {
    message = formatReservationMessage(payload.record);
  }

  if (!message) {
    // Payload non riconosciuto o notifica non dovuta (es. prenotazione
    // inserita da staff): nessun invio.
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const telegramRes = await sendTelegram(message);

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
