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

// Elenco chiuso, come per il corridoio: un tipo inventato dal modello
// diventerebbe un bottone che non fa niente, ed è peggio che non
// proporlo — insegna a non fidarsi dei bottoni.
const TIPI_AZIONE = new Set([
  "archivia_documento",
  "archivia_testo",
  "promemoria",
  "nessuna",
]);

const ISTRUZIONI = `Sei l'assistente di un'osteria. Ricevi un'email arrivata al locale e proponi al
titolare COSA FARE con essa. Non decidi tu: lui conferma o rifiuta ogni cosa che
proponi, una per una.

Puoi proporre solo azioni che il gestionale sa eseguire davvero:

- "archivia_documento": un allegato diventa un documento dell'Archivio.
- "archivia_testo": il contenuto che conta è nella mail stessa, non in un
  allegato (una comunicazione, un IBAN nuovo, una condizione concordata).
- "promemoria": una data che deve finire in Agenda. Puoi proporne più d'uno se
  le date importanti sono più d'una (es. la scadenza di un contratto E la
  disdetta da dare qualche mese prima).
- "nessuna": non c'è niente da fare. Usala da sola, senza altre azioni.

Rispondi SOLO con un oggetto JSON, senza testo attorno:
{"sintesi": "una riga che dice cosa è arrivato",
 "azioni": [
   {"tipo": "archivia_documento",
    "titolo": "come si chiamerà il documento",
    "perche": "una riga sul perché lo propongo",
    "allegato": "nome esatto del file allegato",
    "dati": {"tipo": "fattura|contratto|bolletta|comunicazione|...",
             "data": "AAAA-MM-GG o null",
             "controparte": "chi l'ha mandata, o null",
             "importo": numero o null,
             "scadenza": "AAAA-MM-GG o null"}},
   {"tipo": "promemoria",
    "titolo": "cosa deve ricordare",
    "perche": "una riga",
    "dati": {"data": "AAAA-MM-GG", "note": "testo breve o null"}}
 ]}

Regole:
- Se ci sono documenti allegati (PDF o immagini) sopra al testo, QUELLI sono il
  documento vero: importi, date e controparti si leggono lì dentro. Il corpo
  della mail serve solo al contesto.
- Il nome degli allegati conta quanto il testo: spesso una mail inoltrata arriva
  col corpo vuoto, e alcuni allegati non sono leggibili da qui — in quel caso
  vale il nome.
- Un'azione per ogni allegato che vale la pena archiviare.
- Se un dato non c'è, metti null: NON inventare. Meglio un campo vuoto che un
  importo sbagliato: il titolare si fida di quello che scrivi.
- Pubblicità, newsletter, offerte non richieste, notifiche di social e messaggi
  personali: "nessuna", con il perché in una riga.
- Le richieste di prenotazione le tratta un'altra parte del gestionale:
  "nessuna".`;

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
  // `apikey` **e** `Authorization`: l'archivio rifiuta la sola seconda
  // con «Invalid Compact JWS» — la chiave di servizio non è un JWT e lui
  // prova a leggerla come tale (trovato dal vivo il 12/08/2026).
  const r = await fetch(
    `${SUPABASE_URL}/storage/v1/object/documents/${a.storage_path}`,
    {
      headers: {
        apikey: SERVICE_ROLE!,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    },
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

/**
 * Un importo, oppure niente.
 *
 * Lo zero diventa niente di proposito: al modello è stato chiesto di
 * mettere `null` dove il dato non c'è, e a volte scrive `0` — su un
 * certificato dell'Agenzia delle Entrate o su un promemoria significa
 * «non pertinente», non «zero euro». Uno zero finto in archivio è peggio
 * di un campo vuoto: sembra un dato letto, e nessuno lo ricontrolla.
 *
 * Il prezzo di questa scelta: un documento il cui importo è davvero zero
 * arriverebbe vuoto. Non esiste nel mondo di un'osteria, e comunque
 * Alessio lo vede prima di confermare.
 */
function numeroValido(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
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
      `&select=id,mittente,oggetto,testo,casella,posta_allegati(id,file_name,mime,storage_path)`,
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
        // Con l'elenco di azioni la risposta è molto più lunga di prima
        // (sei campi contro tre azioni con i loro dati e i loro perché).
        // Con 400 veniva troncata a metà, e una risposta troncata non è
        // JSON: la lettura falliva senza dire perché — trovato dal vivo
        // il 12/08/2026, alla prima mail dopo il passaggio alle azioni.
        max_tokens: 1500,
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
      if (!p) {
        throw new Error(
          `non ho capito la risposta della lettura (motivo d'arresto: ${
            esito.stop_reason ?? "?"
          })`,
        );
      }

      // Le azioni proposte. Solo i tipi che il gestionale sa eseguire: se
      // il modello ne inventasse uno, proporrebbe un bottone che non fa
      // niente — peggio che non proporlo, perché insegna a non fidarsi.
      const azioni = (Array.isArray(p.azioni) ? p.azioni : [])
        .filter((a: Record<string, unknown>) => TIPI_AZIONE.has(String(a?.tipo)))
        .slice(0, 6)
        .map((a: Record<string, unknown>) => {
          const dati = (a.dati ?? {}) as Record<string, unknown>;
          // Il modello nomina l'allegato; qui si ritrova la riga vera.
          const allegato = tutti.find(
            (x: { file_name: string }) => x.file_name === a.allegato,
          );
          return {
            posta_id: m.id,
            tipo: a.tipo,
            titolo: String(a.titolo ?? "Senza titolo").slice(0, 200),
            perche: a.perche ? String(a.perche).slice(0, 300) : null,
            parametri: {
              allegato_id: allegato?.id ?? null,
              titolo: a.titolo ?? null,
              tipo: dati.tipo ?? null,
              data: dataValida(dati.data),
              controparte: dati.controparte ?? null,
              importo: numeroValido(dati.importo),
              scadenza: dataValida(dati.scadenza),
              note: dati.note ?? null,
            },
          };
        });

      if (azioni.length) {
        await db("posta_azioni", { method: "POST", body: JSON.stringify(azioni) });
      }

      await db(`posta_ricevuta?id=eq.${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          stato: "proposta",
          proposta_sintesi: typeof p.sintesi === "string" ? p.sintesi.slice(0, 300) : null,
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
    } catch (e) {
      // Una mail che il modello non digerisce resta `da_leggere` e verrà
      // ripresa: se il guasto è permanente resterà lì, visibile, invece
      // di sparire con una proposta inventata.
      //
      // Il motivo si scrive sulla mail. Senza, l'unico segnale era un
      // avviso su Telegram che diceva «non ci sono riuscito» e basta —
      // e si torna a indovinare, che è la cosa che stiamo togliendo di
      // mezzo da tutta la sera.
      falliti++;
      const motivo = (e as Error).message?.slice(0, 300) ?? "errore sconosciuto";
      await db(`posta_ricevuta?id=eq.${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ lettura_note: `lettura fallita: ${motivo}` }),
      });
      saltati.push(`«${m.oggetto ?? "senza oggetto"}» — ${motivo}`);
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
