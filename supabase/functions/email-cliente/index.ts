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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFICHE_FIRMA = Deno.env.get("NOTIFICHE_FIRMA");
// Il mittente deve stare su un dominio verificato presso Resend,
// altrimenti l'invio viene rifiutato (ed è giusto così: è la stessa
// verifica che impedisce a chiunque di scrivere a nome del locale).
const MITTENTE = Deno.env.get("EMAIL_MITTENTE") ?? "Borgo 58 <prenotazioni@borgo58.it>";
const RISPOSTE_A = Deno.env.get("EMAIL_RISPOSTE_A") ?? "info@borgo58.it";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

type Prenotazione = {
  id?: string;
  nome?: string;
  email?: string;
  data?: string;
  ora?: string;
  coperti?: number;
};

/** 2027-03-15 → 15/03/2027. Il formato americano confonde chi legge in fretta. */
function dataItaliana(iso: string): string {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}

function testoConferma(p: Prenotazione): { oggetto: string; testo: string; html: string } {
  const data = p.data ? dataItaliana(p.data) : "";
  const ora = (p.ora ?? "").slice(0, 5);
  const coperti = p.coperti ?? 0;
  const nome = p.nome ?? "";

  const oggetto = `Prenotazione confermata — ${data} alle ${ora}`;

  const righe = [
    `Gentile ${nome},`,
    "",
    "la sua prenotazione è confermata.",
    "",
    `Quando: ${data} alle ${ora}`,
    `Persone: ${coperti}`,
    "",
    "Se qualcosa cambia — anche solo il numero di persone — risponda a",
    "questa email: ci permette di liberare il tavolo per qualcun altro.",
    "",
    "A presto,",
    "Borgo 58 — Osteria Contemporanea",
  ];

  const html = `<div style="font-family: Georgia, serif; font-size: 16px; line-height: 1.6; color: #2b2b2b;">
  <p>Gentile ${nome},</p>
  <p><strong>la sua prenotazione è confermata.</strong></p>
  <p style="background:#f6f3ee; padding:16px; border-radius:8px;">
    <strong>Quando:</strong> ${data} alle ${ora}<br>
    <strong>Persone:</strong> ${coperti}
  </p>
  <p>Se qualcosa cambia — anche solo il numero di persone — risponda a questa
  email: ci permette di liberare il tavolo per qualcun altro.</p>
  <p>A presto,<br><em>Borgo 58 — Osteria Contemporanea</em></p>
</div>`;

  return { oggetto, testo: righe.join("\n"), html };
}

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

// IL FOGLIO DEL PREVENTIVO (20/08/2026, blocco 3 del mandato).
//
// 🔴 IL CONTENUTO ARRIVA GIÀ COMPOSTO DAL DATABASE (`foglio_preventivo`), e
// qui si impagina soltanto. Non si legge niente dal database e non si
// aggiunge nessun numero: **il foglio viaggia**, finisce nella posta del
// cliente e magari lo gira a qualcun altro, e comporlo in due posti sarebbe
// due occasioni di lasciarci dentro un costo.
function testoPreventivo(v: Record<string, unknown>) {
  const persone = Number(v.persone ?? 0);
  const menu = (v.menu as { nome: string }[] ?? []).map((r) => `· ${r.nome}`).join("\n");
  const extra = (v.extra as { descrizione: string; importo: number }[] ?? [])
    .map((r) => `· ${r.descrizione} — ${euro(r.importo)}`)
    .join("\n");
  const data = v.data_evento ? dataItaliana(String(v.data_evento)) : "";
  const scadenza = v.valido_fino_al ? dataItaliana(String(v.valido_fino_al)) : "";

  const oggetto = `Borgo 58 — preventivo per il ${data}`;
  const testo = [
    `Gentile ${v.cliente ?? ""},`,
    "",
    `ecco il preventivo per il ${data}, per ${persone} ${persone === 1 ? "persona" : "persone"}.`,
    "",
    menu ? "IL MENU\n" + menu : "",
    extra ? "\nIN PIÙ\n" + extra : "",
    "",
    `Prezzo a persona: ${euro(Number(v.prezzo_a_persona))}`,
    `Totale: ${euro(Number(v.totale))}`,
    "",
    // ⚠️ La scadenza è la riga che impedisce a questo foglio di restare
    // valido per sempre in mano a chi lo riceve.
    `Questo preventivo è valido fino al ${scadenza}.`,
    "",
    "A presto,",
    "Borgo 58 — Osteria Contemporanea",
  ]
    .filter((r) => r !== "")
    .join("\n");

  const html = testo
    .split("\n")
    .map((r) => `<p style="margin:0 0 8px">${r || "&nbsp;"}</p>`)
    .join("");

  return { oggetto, testo, html };
}

function euro(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n ?? 0);
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
