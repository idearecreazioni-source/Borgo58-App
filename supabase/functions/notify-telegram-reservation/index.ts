// Edge Function: notify-telegram-reservation — notifiche Telegram del
// gestionale. Un solo motore, due origini (stesso principio degli
// assistenti AI nel brief: un'infrastruttura, più punti d'uso):
//
// 1) Nuove richieste di prenotazione dal form pubblico (§3.3) — chiamata
//    dal trigger su INSERT in "reservations", payload { record: {...} }.
//    Notifica solo source = "form_pubblico".
// 2) Promemoria Agenda (§3.9) — chiamata dal job pg_cron ogni 5 minuti,
//    payload { type: "task_reminder", task: {...} }.
//
// Giustificazione (Contratto Architetturale, §2): B2 — custodisce un
// segreto che non può mai arrivare al client (il token del bot Telegram)
// — e B5, perché serve anche un job pianificato.
//
// ---------------------------------------------------------------------
// CHI PUÒ CHIAMARLA (blindatura del 09/08/2026)
// ---------------------------------------------------------------------
// Fino a oggi bastava la chiave anon, che è PUBBLICA e si legge nel
// bundle del sito: chiunque poteva far arrivare sul telefono di Alessio
// un messaggio identico a una vera notifica del gestionale — per esempio
// una prenotazione inventata con un numero da richiamare. Nessun dato
// usciva, ma un canale fidato diventava scrivibile da fuori.
//
// Ora serve anche una PAROLA D'ORDINE condivisa (header x-borgo58-firma),
// che vive: qui nelle variabili d'ambiente della funzione, e nel Vault
// del database — cifrata, mai nel repository. La conoscono solo il
// trigger delle prenotazioni e il job dei promemoria.
//
// La verifica JWT del gateway Supabase resta attiva: due barriere, non
// una. Chi ha solo la chiave pubblica supera la prima e si ferma qui.

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const NOTIFICHE_FIRMA = Deno.env.get("NOTIFICHE_FIRMA");

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

// Un avviso di guasto deve distinguersi al primo sguardo da una
// prenotazione o da un promemoria: chi lo riceve durante un servizio deve
// capire in mezzo secondo se può aspettare la fine del turno.
function formatAlarmMessage(allarme: Record<string, unknown>): string {
  const tipo = allarme.tipo as string;
  const messaggio = allarme.messaggio as string;

  return [
    "⚠️ QUALCOSA NON VA",
    "",
    messaggio,
    "",
    `Tipo: ${tipo}`,
    "Di questo avviso ne arriva uno solo all'ora, anche se il guasto si ripete.",
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
  // 1. LA PAROLA D'ORDINE — prima di leggere qualunque cosa del payload.
  // Se non è configurata la funzione non parte: meglio nessuna notifica
  // che una porta aperta senza saperlo.
  if (!NOTIFICHE_FIRMA) {
    return new Response(
      JSON.stringify({ error: "NOTIFICHE_FIRMA non configurata" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  if (req.headers.get("x-borgo58-firma") !== NOTIFICHE_FIRMA) {
    return new Response(JSON.stringify({ error: "Chiamante non riconosciuto" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo non valido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let message: string | null = null;

  if (payload.type === "task_reminder" && payload.task) {
    message = formatTaskReminderMessage(payload.task);
  } else if (payload.type === "allarme" && payload.allarme) {
    message = formatAlarmMessage(payload.allarme);
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
