// Edge Function: email-cliente — l'email che il cliente riceve quando
// Alessio conferma la sua richiesta.
//
// Giustificazione (Contratto Architetturale, §2): B2 — custodisce la
// chiave del servizio di invio, che non può mai arrivare al client.
//
// Chiamata SOLO dal database, dal trigger sulle prenotazioni
// (migrazione 20260811000001), con la stessa parola d'ordine condivisa
// delle notifiche Telegram: la chiave anon è pubblica e da sola non basta.
//
// ---------------------------------------------------------------------
// PERCHÉ UN FALLIMENTO QUI FINISCE SU TELEGRAM
// ---------------------------------------------------------------------
// Un'email di conferma che non parte è invisibile: Alessio ha premuto
// "conferma", il gestionale dice confermata, e il cliente non sa niente.
// Se ne accorge la sera, quando il tavolo resta vuoto o arriva qualcuno
// che non era atteso. Quindi: se l'invio fallisce, arriva un avviso sul
// telefono — così può telefonare al cliente, che è quello che avrebbe
// fatto comunque prima di avere il gestionale.

import { type Prenotazione, testoConferma, testoPreventivo } from "./testi.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFICHE_FIRMA = Deno.env.get("NOTIFICHE_FIRMA");
// Il mittente deve stare su un dominio verificato presso Resend,
// altrimenti l'invio viene rifiutato (ed è giusto così: è la stessa
// verifica che impedisce a chiunque di scrivere a nome del locale).
const MITTENTE = Deno.env.get("EMAIL_MITTENTE") ?? "Borgo 58 <prenotazioni@borgo58.it>";
const RISPOSTE_A = Deno.env.get("EMAIL_RISPOSTE_A") ?? "info@borgo58.it";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

/** Un guasto invisibile non è un guasto minore: è un guasto peggiore. */
async function avvisaSuTelegram(messaggio: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !NOTIFICHE_FIRMA) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-telegram-reservation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-borgo58-firma": NOTIFICHE_FIRMA,
      },
      body: JSON.stringify({
        type: "allarme",
        allarme: { tipo: "email_conferma_fallita", messaggio },
      }),
    });
  } catch {
    // Se anche l'avviso fallisce non c'è altro da fare da qui: resta la
    // risposta di errore, che il database vede nella coda delle chiamate.
  }
}

Deno.serve(async (req) => {
  // 1. La parola d'ordine, prima di leggere qualunque cosa.
  if (!NOTIFICHE_FIRMA) {
    return new Response(JSON.stringify({ errore: "NOTIFICHE_FIRMA non configurata" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.headers.get("x-borgo58-firma") !== NOTIFICHE_FIRMA) {
    return new Response(JSON.stringify({ errore: "Chiamante non riconosciuto" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    await avvisaSuTelegram(
      "La chiave del servizio di invio email non è nei Secrets: le conferme ai clienti non partono.",
    );
    return new Response(JSON.stringify({ errore: "RESEND_API_KEY non configurata" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ errore: "Corpo non valido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ⚠️ DUE TIPI, non un «manda mail» generico: la conferma di una
  // prenotazione e un preventivo sono due cose diverse, e il giorno che
  // arriveranno le comunicazioni commerciali (mandato della posta dei
  // clienti) quelle vorranno il consenso — che qui non c'entra.
  const destinatario =
    payload.tipo === "conferma"
      ? payload.prenotazione?.email
      : payload.tipo === "preventivo"
        ? payload.preventivo?.email
        : null;

  if (!destinatario) {
    return new Response(JSON.stringify({ saltata: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const p = (payload.prenotazione ?? {}) as Prenotazione;
  const { oggetto, testo, html } =
    payload.tipo === "preventivo" ? testoPreventivo(payload.preventivo) : testoConferma(p);

  const risposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MITTENTE,
      to: [destinatario],
      reply_to: RISPOSTE_A,
      subject: oggetto,
      text: testo,
      html,
    }),
  });

  if (!risposta.ok) {
    const dettaglio = await risposta.text();
    await avvisaSuTelegram(
      `Non sono riuscito a mandare ${payload.tipo === "preventivo" ? "il preventivo" : "la conferma"} ` +
        `a ${p.nome ?? payload.preventivo?.cliente ?? "un cliente"} ` +
        `(${p.data ?? "?"} alle ${(p.ora ?? "").slice(0, 5)}). Chiamalo tu. ` +
        `Motivo: ${risposta.status}.`,
    );
    return new Response(JSON.stringify({ errore: "Invio email fallito", dettaglio }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const esito = await risposta.json();
  return new Response(JSON.stringify({ ok: true, id: esito?.id ?? null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
