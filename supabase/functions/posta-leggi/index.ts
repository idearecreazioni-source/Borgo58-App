// Edge Function: posta-leggi — l'AI guarda la posta arrivata e propone.
//
// Giustificazione (Contratto Architetturale, §2): B2 (la chiave dell'AI
// è un segreto) e B5 (la chiama un lavoro pianificato, non una schermata).
//
// ---------------------------------------------------------------------
// PROPONE. NON DECIDE.
// ---------------------------------------------------------------------
// Regola posta da Alessio prima ancora che il modulo esistesse: *il
// sistema propone, io confermo*. Qui si scrivono solo i campi
// `proposta_*` e si porta la mail a `proposta`. Nessuna riga
// dell'Archivio Documenti viene creata da questa funzione — quello
// succede quando Alessio preme Conferma, e passa dal corridoio.
//
// ---------------------------------------------------------------------
// PERCHÉ IL MODELLO PIÙ PICCOLO
// ---------------------------------------------------------------------
// Entra tutta la posta, pubblicità compresa: è la decisione di Alessio, e
// significa che questa funzione gira su decine di messaggi al giorno che
// non valgono niente. Il lavoro chiesto qui — «che roba è, di chi, di
// quanto, quando scade» — è riconoscimento, non ragionamento. Con il
// modello grande il conto salirebbe per leggere volantini. Il tetto di
// spesa dell'account resta l'ultima rete, ma la prima è scegliere lo
// strumento giusto.
//
// Il prezzo di questa scelta è dichiarato: su una fattura scritta male un
// modello piccolo sbaglia più spesso. Va bene **perché nessuno di questi
// numeri diventa un dato del gestionale senza che Alessio lo guardi**. Se
// un giorno la conferma diventasse automatica, questa riga andrebbe
// riaperta prima di quella.
//
// ---------------------------------------------------------------------
// IL FRENO
// ---------------------------------------------------------------------
// Al massimo QUANTE_PER_GIRO messaggi per esecuzione. Se un giorno
// arrivasse una valanga — una lista di distribuzione, un attacco di spam,
// un ciclo impazzito di inoltri — il costo cresce di un gradino per
// volta, non tutto insieme. La posta in eccesso resta `da_leggere` e
// viene presa al giro dopo.

import Anthropic from "npm:@anthropic-ai/sdk@0.65.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const NOTIFICHE_FIRMA = Deno.env.get("NOTIFICHE_FIRMA");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MODELLO = "claude-haiku-4-5-20251001";
const QUANTE_PER_GIRO = 10;

const ISTRUZIONI = `Sei l'archivista di un'osteria. Ricevi un'email arrivata al locale e devi dire
se vale la pena conservarla nell'archivio documenti e, se sì, come catalogarla.

Vanno conservate: fatture, contratti, bollette, comunicazioni di consulenti,
banche, enti pubblici, assicurazioni, scadenze, certificazioni, verbali di
ispezione, buste paga, ricevute di pagamento.

NON vanno conservate: pubblicità, newsletter, offerte commerciali non richieste,
notifiche di social network, messaggi personali, richieste di prenotazione
(quelle il gestionale le tratta altrove).

Rispondi SOLO con un oggetto JSON, senza testo attorno, con queste chiavi:
{"conservare": true/false,
 "motivo": "una riga, in italiano, sul perché",
 "titolo": "titolo breve del documento, o null",
 "tipo": "es. fattura, contratto, bolletta, comunicazione, o null",
 "data": "AAAA-MM-GG o null",
 "controparte": "chi l'ha mandata, come nome leggibile, o null",
 "importo": numero senza simboli o null,
 "scadenza": "AAAA-MM-GG della scadenza di pagamento, o null"}

Il nome degli allegati conta quanto il testo: spesso è l'unica cosa che dice di
cosa si tratta (una mail inoltrata può arrivare col corpo vuoto).

Se un dato non c'è, metti null: non inventare. Meglio un campo vuoto che un
importo sbagliato.`;

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "Content-Type": "application/json" },
  });
}

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

/** Il modello a volte incornicia il JSON: si prende quello che c'è fra le graffe. */
function leggiJson(testo: string): Record<string, unknown> | null {
  const inizio = testo.indexOf("{");
  const fine = testo.lastIndexOf("}");
  if (inizio < 0 || fine <= inizio) return null;
  try {
    return JSON.parse(testo.slice(inizio, fine + 1));
  } catch {
    return null;
  }
}

/** Una data inventata o malformata non deve entrare nel database. */
function dataValida(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

function numeroValido(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (!NOTIFICHE_FIRMA || req.headers.get("x-borgo58-firma") !== NOTIFICHE_FIRMA) {
    return risposta({ errore: "Chiamante non riconosciuto" }, 401);
  }
  if (!ANTHROPIC_API_KEY || !SERVICE_ROLE) {
    return risposta({ errore: "Funzione non configurata" }, 500);
  }

  // Gli allegati arrivano insieme al messaggio, e non per completezza: il
  // nome di un file dice spessissimo tutto — «Locazione Parlato
  // Borgo58-10.08.2026.odt» si spiega da solo. Trovato alla prima prova
  // vera, dove la mail inoltrata aveva il corpo vuoto e l'unica
  // informazione utile era il nome dell'allegato.
  const elenco = await db(
    `posta_ricevuta?stato=eq.da_leggere&order=ricevuta_il.asc&limit=${QUANTE_PER_GIRO}` +
      `&select=id,mittente,oggetto,testo,casella,posta_allegati(file_name)`,
  );
  if (!elenco.ok) {
    return risposta({ errore: "Non riesco a leggere la posta in attesa" }, 500);
  }
  const messaggi = await elenco.json();
  if (!messaggi.length) return risposta({ letti: 0 });

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  let letti = 0;
  let falliti = 0;

  for (const m of messaggi) {
    try {
      const esito = await anthropic.messages.create({
        model: MODELLO,
        max_tokens: 400,
        system: ISTRUZIONI,
        messages: [
          {
            role: "user",
            content:
              `Casella: ${m.casella}\nDa: ${m.mittente ?? "?"}\n` +
              `Oggetto: ${m.oggetto ?? "(nessuno)"}\n` +
              `Allegati: ${
                (m.posta_allegati ?? []).map((a: { file_name: string }) => a.file_name).join(", ") ||
                "nessuno"
              }\n\n` +
              `${(m.testo ?? "").slice(0, 6000)}`,
          },
        ],
      });

      const testo = esito.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("");
      const p = leggiJson(testo);
      if (!p) throw new Error("risposta non interpretabile");

      await db(`posta_ricevuta?id=eq.${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          stato: "proposta",
          proposta_conservare: p.conservare === true,
          proposta_motivo: typeof p.motivo === "string" ? p.motivo.slice(0, 300) : null,
          proposta_titolo: typeof p.titolo === "string" ? p.titolo.slice(0, 200) : null,
          proposta_tipo: typeof p.tipo === "string" ? p.tipo.slice(0, 80) : null,
          proposta_data: dataValida(p.data),
          proposta_controparte:
            typeof p.controparte === "string" ? p.controparte.slice(0, 200) : null,
          proposta_importo: numeroValido(p.importo),
          proposta_scadenza: dataValida(p.scadenza),
          proposta_modello: MODELLO,
          proposta_token:
            (esito.usage?.input_tokens ?? 0) + (esito.usage?.output_tokens ?? 0),
          proposta_il: new Date().toISOString(),
        }),
      });
      letti++;
    } catch {
      // Una mail che il modello non digerisce resta `da_leggere` e verrà
      // ripresa: se il guasto è permanente resterà lì, visibile, invece
      // di sparire con una proposta inventata.
      falliti++;
    }
  }

  return risposta({ letti, falliti, in_coda: messaggi.length });
});
