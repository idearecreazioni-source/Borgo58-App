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

// ---------------------------------------------------------------------
// E UNA CONSEGNA SI FA UNA VOLTA SOLA — 17/09/2026
// ---------------------------------------------------------------------
// 🔴 PERCHE' QUESTA FUNZIONE HA DOVUTO IMPARARE A RICORDARE. Il giro dei
//    promemoria puo' sapere di aver ACCODATO una richiesta; non puo' sapere
//    se sia ARRIVATA. Fra le due cose ci sta il caso che produce il
//    doppione: risposta persa, si riprova, e il secondo Telegram parte.
//    L'unico posto da cui si vede la differenza e' QUESTO — ed e' per questo
//    che la memoria sta qui e non dalla parte di chi manda.
//
// ⚠️ LA DECISIONE STA IN `consegna.ts` PER POTERLA PROVARE: qui dentro
//    l'unico modo di metterla alla prova sarebbe mandare messaggi veri.
//
// ⚠️ E LE PRENOTAZIONI E GLI ALLARMI NON CAMBIANO DI UNA RIGA: arrivano
//    senza chiave, e per loro la strada e' quella di sempre.
import { consegnaUnaVoltaSola, stradaDellaConsegna } from "./consegna.ts";
// ⚠️ Da Prova ogni messaggio comincia con «TEST PROVA»: il perche' sta in
//    `ambiente.ts`, e l'unico punto che lo applica e' `sendTelegram` qui sotto.
import { testoPerIlProgetto } from "./ambiente.ts";
import { deveTacere } from "./silenzio.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const NOTIFICHE_FIRMA = Deno.env.get("NOTIFICHE_FIRMA");
// ⚠️ Le stesse due che usa gia' `posta-leggi` per scrivere nel database: la
//    strada c'e', non se ne inventa una seconda.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Una chiamata al database con la chiave di servizio, come in `posta-leggi`. */
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
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${await r.text()}`);
  // 🔴 «NESSUN CONTENUTO» E' UNA RISPOSTA GIUSTA, NON UN GUASTO — 20/09/2026,
  //    misurato su Prova. Le due scritture della consegna — quella che la
  //    conferma e quella che la rilascia — non restituiscono niente (i nomi
  //    non si scrivono qui: una prova controlla che compaiano solo dentro il
  //    ramo della chiave, e in un commento sarebbero un falso allarme),
  //    quindi il database risponde **204 senza corpo**:
  //    leggerlo come JSON solleva, e l'eccezione usciva dalla funzione
  //    trasformando un promemoria GIA' CONSEGNATO in un «500 Internal Server
  //    Error». Chi manda lo leggeva come «non arrivato» — allarme falso alle
  //    15:25 e un tentativo buttato.
  // ⚠️ Si guarda il CORPO, non solo il codice: una risposta vuota con 200 si
  //    comporta allo stesso modo.
  const testo = await r.text();
  return testo.trim() === "" ? null : JSON.parse(testo);
}

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
//
// E un RINCARO non è un guasto: è il gestionale che funziona e riferisce
// che un fornitore ha alzato un prezzo. Fino al 13/08/2026 arrivava sotto
// lo stesso titolo di un guasto, con la riga tecnica del tipo attaccata e
// una frase in fondo che dal 13/08 è anche falsa per i rincari («ne
// arriva uno solo all'ora»: il freno ora distingue un rincaro dall'altro).
// Mettere le due cose sotto lo stesso titolo insegna a leggere quel
// triangolo come rumore, e il costo si paga il giorno del guasto vero.
//
// La categoria arriva dal database (`segnala_allarme`), non si indovina
// da come comincia il testo del tipo: sarebbe legare il titolo alla
// chiave del freno anti-tempesta, due cose che oggi coincidono e domani
// no, senza che niente lo segnali.
function formatAlarmMessage(allarme: Record<string, unknown>): string {
  const tipo = allarme.tipo as string;
  const messaggio = allarme.messaggio as string;
  const categoria = (allarme.categoria as string) ?? "guasto";

  if (categoria === "scadenze") {
    return [
      "📅 SCADENZE",
      "",
      messaggio,
      "Un messaggio al giorno, alle 10:00. La lista intera sta in Magazzino → Scadenze.",
    ].join("\n");
  }

  // Un evento annullato non e' un guasto: e' una serata che si e' liberata,
  // e chi legge non deve chiamare aiuto — deve decidere se rimetterla in
  // vendita. Sotto il triangolo dei guasti si leggerebbe come rumore, ed e'
  // esattamente l'errore chiuso il 13/08 per i rincari.
  if (categoria === "evento") {
    return [
      "📆 EVENTO ANNULLATO",
      "",
      messaggio,
      "",
      "Se la sala si e' liberata, quella sera torna prenotabile.",
    ].join("\n");
  }

  if (categoria === "rincaro") {
    return [
      "💶 RINCARO",
      "",
      messaggio,
      "",
      "Lo stesso rincaro non si ripete. Un rincaro diverso arriva sempre.",
    ].join("\n");
  }

  return [
    "⚠️ QUALCOSA NON VA",
    "",
    messaggio,
    "",
    // Il tipo resta solo qui: su un guasto serve a capire cos'è che si è
    // rotto, e chi lo legge lo legge per decidere se chiamare aiuto.
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
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: testoPerIlProgetto(text, SUPABASE_URL) }),
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

  // ⚠️ Su Prova, durante un giro di prove automatiche, allarmi e prenotazioni
  //    non squillano (migrazione 20260919000001, regola in `silenzio.ts`).
  //    I promemoria non passano mai da qui.
  const tacere = await deveTacere({
    payload,
    supabaseUrl: SUPABASE_URL,
    zittite: async () => Boolean(await rpc("notifiche_zittite", {})),
  });
  if (tacere) {
    return new Response(JSON.stringify({ skipped: true, muto: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rispondi =(r: { stato: number; corpo: Record<string, unknown> }) =>
    new Response(JSON.stringify(r.corpo), {
      status: r.stato,
      headers: { "Content-Type": "application/json" },
    });

  // 🔴 LA CHIAVE SI PRENDE SOLO SE ARRIVA SCRITTA, e non si ricompone MAI da
  //    altri campi. Il perche' — l'ordine del rilascio — sta in `consegna.ts`,
  //    accanto alla regola, e non qui dove verrebbe letto una volta sola.
  const strada = stradaDellaConsegna(payload);

  if (strada.dedup) {
    // 🔴 SENZA MEMORIA NON SI MANDA, e si dice perche'. Mandare comunque
    //    sarebbe esattamente il difetto: un avviso che parte due volte perche'
    //    nessuno ha potuto ricordarsi del primo. Si fallisce CHIUSI e
    //    rumorosamente — chi manda lo registra e riprova — invece di aprire
    //    in silenzio la porta al doppione.
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return rispondi({
        stato: 500,
        corpo: {
          ok: false,
          error:
            "Non posso ricordare che cosa ho gia' consegnato: senza quella memoria un avviso rischia di partire due volte, quindi non parte.",
        },
      });
    }

    return rispondi(
      await consegnaUnaVoltaSola({
        chiave: strada.chiave,
        prendi: (c) => rpc("prendi_consegna", { p_chiave: c }) as Promise<never>,
        conferma: async (c) => {
          await rpc("conferma_consegna", { p_chiave: c });
        },
        rilascia: async (c) => {
          await rpc("rilascia_consegna", { p_chiave: c });
        },
        manda: async () => {
          const res = await sendTelegram(message);
          // ⚠️ Una risposta di NO e' un fatto certo: Telegram non ha ricevuto
          //    niente. Un'eccezione no — e `consegnaUnaVoltaSola` le tratta
          //    diversamente apposta.
          return res.ok
            ? { riuscito: true }
            : { riuscito: false, dettaglio: await res.text() };
        },
      }),
    );
  }

  // ⚠️ SENZA CHIAVE — prenotazioni, allarmi, posta — la strada e' quella di
  //    sempre: quelle notifiche nascono da un fatto che avviene una volta
  //    sola, e non vengono ritentate da nessuno.
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
