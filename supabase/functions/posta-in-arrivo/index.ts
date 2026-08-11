// Edge Function: posta-in-arrivo — la porta da cui la posta del locale
// entra nel gestionale.
//
// Giustificazione (Contratto Architetturale, §2): B2 (custodisce la
// chiave del servizio di posta) e B5 (riceve una chiamata dall'esterno,
// che nessuna schermata può ricevere al posto suo).
//
// ---------------------------------------------------------------------
// COME CI ARRIVA LA POSTA
// ---------------------------------------------------------------------
// Aruba manda una copia di ogni messaggio a un indirizzo del servizio di
// ricezione, che lo consegna qui come "webhook". La casella vera di
// Alessio non viene toccata: il suo dominio continua a consegnare la
// posta ad Aruba come sempre — vedi docs/DOMINIO.md, dove è scritto
// perché il record MX della radice non va spostato.
//
// ---------------------------------------------------------------------
// QUESTA FUNZIONE È PUBBLICA. LA PROTEGGE LA FIRMA, NON IL SEGRETO.
// ---------------------------------------------------------------------
// Un webhook lo chiama un estraneo per definizione: non c'è un utente
// loggato, quindi la verifica del gateway Supabase è spenta e l'indirizzo
// è raggiungibile da chiunque. L'unica barriera è la **firma** che il
// servizio di ricezione mette su ogni consegna, calcolata con un segreto
// condiviso. Qui la si verifica prima di leggere qualunque cosa del
// corpo, e se non torna si risponde 401 senza guardare oltre.
//
// Il confronto è a tempo costante: un confronto normale si ferma al primo
// carattere diverso, e da quanto ci mette si può indovinare la firma un
// carattere alla volta.
//
// ---------------------------------------------------------------------
// COSA NON FA, DI PROPOSITO
// ---------------------------------------------------------------------
// Non chiama l'intelligenza artificiale. Chi consegna la posta si aspetta
// una risposta in pochi secondi e **riprova** se non la riceve: legare la
// consegna a una chiamata lenta e a pagamento significherebbe, nelle
// giornate storte, pagare tre volte la stessa lettura. Qui si registra e
// basta; a leggere ci pensa `posta-leggi`, chiamata dal lavoro
// pianificato ogni quarto d'ora.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CARTELLA = "documents"; // stesso bucket dell'Archivio: niente copie

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "Content-Type": "application/json" },
  });
}

/** Confronto a tempo costante: la durata non deve dipendere da dove differiscono. */
function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifica la firma del servizio di ricezione (formato Svix).
 * Firma su `id.timestamp.corpo`, HMAC-SHA256 con il segreto, in base64.
 * L'intestazione può contenere più firme separate da spazio (rotazione
 * della chiave): basta che una torni.
 */
async function firmaValida(req: Request, corpo: string): Promise<boolean> {
  const id = req.headers.get("svix-id") ?? req.headers.get("webhook-id");
  const ts = req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp");
  const firme = req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");
  if (!id || !ts || !firme || !WEBHOOK_SECRET) return false;

  // Una consegna vecchia di ore è una consegna ripescata da qualcuno: la
  // firma resterebbe valida per sempre senza questo controllo.
  const eta = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(eta) || eta > 300) return false;

  const segreto = WEBHOOK_SECRET.startsWith("whsec_")
    ? WEBHOOK_SECRET.slice(6)
    : WEBHOOK_SECRET;

  const chiave = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(segreto), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firmato = await crypto.subtle.sign(
    "HMAC",
    chiave,
    new TextEncoder().encode(`${id}.${ts}.${corpo}`),
  );
  const attesa = btoa(String.fromCharCode(...new Uint8Array(firmato)));

  return firme
    .split(" ")
    .map((f) => (f.includes(",") ? f.split(",")[1] : f))
    .some((f) => uguali(f, attesa));
}

/** Chiamata al database con i permessi di servizio: qui non c'è un utente. */
async function db(percorso: string, opzioni: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${percorso}`, {
    ...opzioni,
    headers: {
      apikey: SERVICE_ROLE!,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      ...(opzioni.headers ?? {}),
    },
  });
}

async function resend(percorso: string) {
  const r = await fetch(`https://api.resend.com/${percorso}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!r.ok) throw new Error(`Resend ${percorso}: ${r.status}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return risposta({ errore: "Metodo non ammesso" }, 405);

  if (!WEBHOOK_SECRET || !RESEND_API_KEY || !SERVICE_ROLE) {
    // Meglio rifiutare che accettare senza sapere da chi: se la funzione
    // è configurata a metà, chi consegna riproverà e nulla va perso.
    return risposta({ errore: "Funzione non configurata" }, 500);
  }

  const corpo = await req.text();
  if (!(await firmaValida(req, corpo))) {
    return risposta({ errore: "Firma non valida" }, 401);
  }

  let evento;
  try {
    evento = JSON.parse(corpo);
  } catch {
    return risposta({ errore: "Corpo non valido" }, 400);
  }

  if (evento?.type !== "email.received") {
    return risposta({ ignorato: evento?.type ?? null });
  }

  const d = evento.data ?? {};
  const emailId: string = d.email_id;
  if (!emailId) return risposta({ errore: "Manca l'identificativo del messaggio" }, 400);

  // Il corpo non viaggia nel webhook (solo i dati di testa): si va a
  // prenderlo.
  //
  // Se non ci riusciamo, la mail si registra **lo stesso** con quello che
  // il webhook ha portato: mittente, oggetto, elenco degli allegati.
  // Trovato dal vivo l'11/08: la prima chiave creata aveva il permesso di
  // *inviare* e non di *leggere*, questa chiamata rispondeva 401 e la
  // funzione moriva con un 500 generico — la mail veniva ritentata e
  // riperduta per sempre, senza che nessuno vedesse mai niente. Una mail
  // senza corpo è un problema; una mail persa è un problema peggiore.
  let messaggio: Record<string, unknown> = {};
  let corpoMancante = false;
  try {
    messaggio = await resend(`emails/receiving/${emailId}`);
  } catch {
    corpoMancante = true;
  }

  const destinatari: string[] = [
    ...(d.received_for ?? []),
    ...(d.to ?? []),
  ].filter(Boolean);

  const inserimento = await db("posta_ricevuta?on_conflict=messaggio_id", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      messaggio_id: emailId,
      casella: destinatari[0] ?? "sconosciuta",
      mittente: d.from ?? messaggio?.from ?? null,
      oggetto: d.subject ?? messaggio?.subject ?? null,
      // Solo il testo: l'HTML di una newsletter è enorme, non aggiunge
      // niente a chi deve capire di che documento si tratta, e costerebbe
      // in token a ogni lettura.
      testo: corpoMancante
        ? "[Il testo di questa mail non è stato scaricato: la chiave del servizio " +
          "di posta non ha il permesso di leggere la posta ricevuta. La mail è " +
          "registrata lo stesso, con mittente, oggetto e allegati.]"
        : (String(messaggio?.text ?? "")).slice(0, 20000) || null,
      ricevuta_il: d.created_at ?? new Date().toISOString(),
    }),
  });

  if (!inserimento.ok) {
    const dettaglio = await inserimento.text();
    return risposta({ errore: "Registrazione fallita", dettaglio }, 500);
  }

  const righe = await inserimento.json();
  if (!righe?.length) {
    // Doppione: la stessa consegna era già arrivata. Non è un errore, è
    // il vincolo `messaggio_id UNIQUE` che fa il suo mestiere.
    return risposta({ gia_registrata: true });
  }
  const postaId = righe[0].id;

  // Allegati: si scaricano e si mettono nel bucket dell'Archivio, sotto
  // `posta/`. Se poi la mail diventa un documento, il file è già dove
  // deve stare.
  const allegati = d.attachments ?? [];
  const salvati: string[] = [];
  for (const a of allegati) {
    const nomeOriginale = a.filename ?? "allegato";
    let errore: string | null = null;
    try {
      const dettagli = await resend(`emails/receiving/${emailId}/attachments/${a.id}`);
      if (!dettagli?.download_url) {
        throw new Error("il servizio non ha dato un indirizzo da cui scaricarlo");
      }

      const file = await fetch(dettagli.download_url);
      if (!file.ok) throw new Error(`scaricamento fallito (${file.status})`);
      const contenuto = new Uint8Array(await file.arrayBuffer());

      // Il nome arriva da fuori: potrebbe contenere percorsi (`../`) e
      // finire a scrivere dove non deve.
      const nome = (a.filename ?? "allegato").replace(/[^\w.-]+/g, "_").slice(-120);
      const percorso = `posta/${postaId}/${nome}`;

      const su = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${CARTELLA}/${percorso}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": a.content_type ?? "application/octet-stream",
          },
          body: contenuto,
        },
      );

      // Se il salvataggio fallisce, il motivo va conservato: senza, in
      // schermata resta solo «mancante» e si torna a tentare al buio.
      if (!su.ok) {
        errore = `salvataggio nell'archivio fallito (${su.status}): ${
          (await su.text()).slice(0, 300)
        }`;
      }

      await db("posta_allegati", {
        method: "POST",
        body: JSON.stringify({
          posta_id: postaId,
          file_name: nome,
          mime: a.content_type ?? null,
          dimensione: contenuto.byteLength,
          storage_path: su.ok ? percorso : null,
          errore,
        }),
      });
      if (su.ok) salvati.push(nome);
    } catch (e) {
      // Un allegato che non si salva non deve far perdere la mail: resta
      // registrata, con scritto accanto perché il file non c'è.
      await db("posta_allegati", {
        method: "POST",
        body: JSON.stringify({
          posta_id: postaId,
          file_name: nomeOriginale.replace(/[^\w.-]+/g, "_").slice(-120),
          mime: a.content_type ?? null,
          storage_path: null,
          errore: (e as Error).message?.slice(0, 300) ?? "errore sconosciuto",
        }),
      });
    }
  }

  return risposta({
    ok: true,
    id: postaId,
    allegati: salvati.length,
    corpo_mancante: corpoMancante,
  });
});
