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
import { unzipSync } from "npm:fflate@0.8.2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const NOTIFICHE_FIRMA = Deno.env.get("NOTIFICHE_FIRMA");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MODELLO = "claude-haiku-4-5-20251001";
const QUANTE_PER_GIRO = 10;

// ---------------------------------------------------------------------
// GLI ALLEGATI CHE SI POSSONO LEGGERE DAVVERO
// ---------------------------------------------------------------------
// Una fattura è un PDF: leggerne solo il nome significa non leggerla.
const NATIVI = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Documenti di videoscrittura: il modello non li apre, ma il testo è già
// dentro il file — sono pacchetti compressi con un XML dentro. Si apre e
// si passa il testo. Nessun convertitore esterno, nessun servizio in più.
// Aggiunti il 12/08/2026: il primo contratto vero è arrivato in .odt, che
// è il formato di LibreOffice — quello di chi non ha Word, e in Italia
// capita spesso negli atti scritti da studi e privati.
const DA_SPACCHETTARE: Record<string, string> = {
  "application/vnd.oasis.opendocument.text": "content.xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "word/document.xml",
};

// Nessun limite al NUMERO di allegati (deciso da Alessio il 12/08: se una
// mail merita di entrare, merita di essere letta tutta). Resta un limite
// di dimensione, e non è una precauzione nostra: oltre una certa taglia è
// il servizio AI a rifiutare la richiesta. Tenuto sotto quella soglia con
// margine, così le fatture vere non lo toccano mai.
//
// ⚠️ Il freno serve **contro le mail che nessuno ha chiesto**, non contro
// Alessio: la lettura avviene PRIMA della sua conferma, su tutto ciò che
// entra automaticamente da quattro caselle.
const MAX_BYTE_PER_ALLEGATO = 10 * 1024 * 1024;
const MAX_BYTE_TOTALI = 20 * 1024 * 1024;
const MAX_CARATTERI_TESTO_ESTRATTO = 20000;

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

Se sopra al testo trovi uno o più documenti allegati (PDF o immagini), **quelli
sono il documento vero**: importo, data, scadenza e controparte si leggono lì
dentro, non nel corpo della mail. Il corpo serve solo a capire il contesto.

Il nome degli allegati conta quanto il testo: spesso è l'unica cosa che dice di
cosa si tratta (una mail inoltrata può arrivare col corpo vuoto), e alcuni
allegati non sono leggibili da qui — in quel caso vale il nome.

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

/**
 * Da byte a base64, a blocchi.
 *
 * `String.fromCharCode(...array)` su un file da qualche megabyte fa
 * esplodere lo stack: gli argomenti di una chiamata non sono infiniti.
 * È un guasto che compare solo sui file grandi, cioè in produzione.
 */
function inBase64(byte: Uint8Array): string {
  let s = "";
  const passo = 0x8000;
  for (let i = 0; i < byte.length; i += passo) {
    s += String.fromCharCode(...byte.subarray(i, i + passo));
  }
  return btoa(s);
}

/**
 * Cava il testo da un documento di videoscrittura.
 *
 * Un .odt e un .docx sono cartelle compresse con dentro un XML: il testo
 * è già lì, in chiaro. Si apre il pacchetto, si prende il pezzo giusto e
 * si tolgono i marcatori. Niente convertitore, niente servizio esterno,
 * nessun file che esce dal nostro perimetro.
 */
function testoDaPacchetto(byte: Uint8Array, dentro: string): string | null {
  try {
    const contenuto = unzipSync(byte)[dentro];
    if (!contenuto) return null;
    return new TextDecoder()
      .decode(contenuto)
      // Fine paragrafo → a capo, così le righe non si incollano fra loro.
      .replace(/<\/(text:p|w:p)>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_CARATTERI_TESTO_ESTRATTO);
  } catch {
    return null;
  }
}

/** Scarica un allegato dall'archivio e lo prepara per il modello. */
async function allegatoPerIlModello(a: {
  storage_path: string;
  mime: string;
  file_name: string;
}) {
  const r = await fetch(
    `${SUPABASE_URL}/storage/v1/object/documents/${a.storage_path}`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!r.ok) return null;

  const byte = new Uint8Array(await r.arrayBuffer());
  if (byte.byteLength > MAX_BYTE_PER_ALLEGATO) return null;

  const dentro = DA_SPACCHETTARE[a.mime];
  if (dentro) {
    const testo = testoDaPacchetto(byte, dentro);
    return testo
      ? { type: "text", text: `--- Contenuto di ${a.file_name} ---\n${testo}` }
      : null;
  }

  const data = inBase64(byte);
  return a.mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: a.mime, data } };
}

/**
 * Avvisa Alessio sul telefono, passando dal canale che esiste già.
 *
 * Se anche l'avviso fallisce non si fa altro: la nota resta scritta sulla
 * mail, che è il posto dove la si cerca comunque.
 */
async function avvisa(messaggio: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-telegram-reservation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "x-borgo58-firma": NOTIFICHE_FIRMA!,
      },
      body: JSON.stringify({
        type: "allarme",
        allarme: { tipo: "posta_letta_a_meta", messaggio },
      }),
    });
  } catch {
    // niente
  }
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
      `&select=id,mittente,oggetto,testo,casella,posta_allegati(file_name,mime,storage_path)`,
  );
  if (!elenco.ok) {
    return risposta({ errore: "Non riesco a leggere la posta in attesa" }, 500);
  }
  const messaggi = await elenco.json();
  if (!messaggi.length) return risposta({ letti: 0 });

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  let letti = 0;
  let falliti = 0;
  // Cosa dire ad Alessio a fine giro. Un solo messaggio per esecuzione,
  // non uno per mail: venti avvisi di fila si smettono di leggere, ed è
  // esattamente quando serve leggerli.
  const saltati: string[] = [];

  for (const m of messaggi) {
    try {
      const tutti = m.posta_allegati ?? [];

      // I documenti veri vanno letti, non nominati: su una fattura il
      // nome del file non dice l'importo né la scadenza.
      // Cosa non si riesce a leggere, e perché. Non è cronaca: è la sola
      // differenza fra «il gestionale ha guardato tutto» e «il gestionale
      // ha guardato quello che poteva», che davanti a una fattura è la
      // differenza che conta.
      const scartati: string[] = [];

      const daLeggere = tutti.filter((a: {
        storage_path?: string;
        mime?: string;
        file_name?: string;
      }) => {
        if (!a.storage_path) {
          scartati.push(`${a.file_name}: non è stato salvato nell'archivio`);
          return false;
        }
        if (!NATIVI.has(a.mime ?? "") && !DA_SPACCHETTARE[a.mime ?? ""]) {
          scartati.push(`${a.file_name}: formato che non so aprire (${a.mime ?? "?"})`);
          return false;
        }
        return true;
      });

      // Si prendono in ordine finché si sta dentro la taglia massima che
      // il servizio AI accetta: meglio leggere i primi tre allegati che
      // vedersi rifiutare l'intera richiesta e non leggerne nessuno.
      // deno-lint-ignore no-explicit-any
      const documenti: any[] = [];
      let peso = 0;
      for (const a of daLeggere) {
        // deno-lint-ignore no-explicit-any
        const blocco: any = await allegatoPerIlModello(a);
        if (!blocco) {
          scartati.push(`${a.file_name}: troppo grande o illeggibile`);
          continue;
        }
        const dim = blocco.type === "text"
          ? blocco.text.length
          : blocco.source.data.length;
        if (peso + dim > MAX_BYTE_TOTALI) {
          scartati.push(`${a.file_name}: non ci stava, la mail era già troppo pesante`);
          continue;
        }
        peso += dim;
        documenti.push(blocco);
      }

      const esito = await anthropic.messages.create({
        model: MODELLO,
        max_tokens: 400,
        system: ISTRUZIONI,
        messages: [
          {
            role: "user",
            content: [
              ...documenti,
              {
                type: "text",
                text:
                  `Casella: ${m.casella}\nDa: ${m.mittente ?? "?"}\n` +
                  `Oggetto: ${m.oggetto ?? "(nessuno)"}\n` +
                  `Allegati: ${
                    tutti.map((a: { file_name: string }) => a.file_name).join(", ") || "nessuno"
                  }\n` +
                  `Allegati che stai leggendo qui sopra: ${documenti.length}\n\n` +
                  `${(m.testo ?? "").slice(0, 6000)}`,
              },
            ],
            // deno-lint-ignore no-explicit-any
          } as any,
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
          lettura_note: scartati.length ? scartati.join("; ") : null,
        }),
      });
      letti++;
      if (scartati.length) {
        saltati.push(`«${m.oggetto ?? "senza oggetto"}» — ${scartati.join("; ")}`);
      }
    } catch {
      // Una mail che il modello non digerisce resta `da_leggere` e verrà
      // ripresa: se il guasto è permanente resterà lì, visibile, invece
      // di sparire con una proposta inventata.
      falliti++;
    }
  }

  // Un avviso solo, a fine giro, e solo se c'è davvero qualcosa da dire.
  if (saltati.length || falliti) {
    const righe = [
      saltati.length
        ? `Ho letto la posta ma qualcosa non sono riuscito ad aprirlo:\n${saltati.join("\n")}`
        : null,
      falliti
        ? `${falliti} messaggi non sono stati letti del tutto: restano in attesa e ci riprovo fra un quarto d'ora.`
        : null,
      "Li trovi in Archivio Documenti → Posta in arrivo: il documento c'è comunque, l'ho solo letto meno bene.",
    ].filter(Boolean);
    await avvisa(righe.join("\n\n"));
  }

  return risposta({ letti, falliti, saltati: saltati.length, in_coda: messaggi.length });
});
