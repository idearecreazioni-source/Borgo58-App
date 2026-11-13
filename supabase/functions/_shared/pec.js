/**
 * Come si legge una PEC arrivata nel gestionale (08/11/2026).
 *
 * Una PEC inoltrata alla casella del gestionale non arriva «pulita»: Aruba
 * la incarta in una busta. Il mittente diventa
 * `posta-certificata@pec.aruba.it`, l'oggetto prende davanti
 * «POSTA CERTIFICATA:» (anche più volte, se è un inoltro di un inoltro), e
 * tra gli allegati compaiono i file della busta (`daticert.xml`,
 * `smime.p7s`, a volte con un numero: `daticert_1.xml`, `smime_5.p7s`).
 *
 * Qui ci sono solo letture PURE, senza rete e senza database: le usano le
 * funzioni online della posta e la pagina Posta, e si provano in
 * tests/unita/pec.test.js con copie finte fedeli alla forma delle PEC vere
 * del 07/11 (le vere non entrano nel repository: è pubblico).
 *
 * ⚠️ UNA FATTURA SI RICONOSCE DAL CONTENUTO, MAI DAL NOME. Il nome di un
 *    file lo sceglie chi lo manda: `SubmissionAcceptance.xml` (una distinta
 *    SEPA) è un XML vero che non è una fattura, e una fattura può chiamarsi
 *    in qualunque modo. Dal nome si riconoscono solo i file della busta PEC
 *    e i metadati dello SdI, che hanno nomi fissati dalle regole tecniche.
 */

import { TIPI_REGISTRABILI, leggiFatturaPA, leggiXml, payloadFattura, xmlDaFile } from "./fatturaPA.js";

// --- gli allegati -----------------------------------------------------------

/** I file della busta PEC: nomi fissati dalle regole tecniche, con l'eventuale `_N`. */
const TECNICI = [/^daticert(_\d+)?\.xml$/i, /^smime(_\d+)?\.p7s$/i];

/** I metadati che lo SdI manda insieme alla fattura (`…_MT_001.xml`). */
const METADATI_SDI = /_MT_\d+\.xml$/i;

/** Estensioni che possono contenere un XML (in chiaro o dentro una busta firmata). */
const FORSE_XML = /\.(xml|p7m)$/i;

/**
 * Il file contiene una fattura elettronica? Si guarda dentro: si apre la
 * busta firmata se c'è, si legge l'XML e si controlla la radice.
 *
 * @param {Uint8Array} byte
 * @returns {boolean}
 */
export function eFatturaPA(byte) {
  try {
    return leggiXml(xmlDaFile(byte)).localName === "FatturaElettronica";
  } catch {
    return false;
  }
}

/**
 * Che cos'è un allegato di una mail arrivata.
 *
 * - `tecnico`: un file della busta PEC (daticert, smime). Non dice niente a
 *   chi legge.
 * - `metadati_sdi`: il file `_MT_` dello SdI che accompagna la fattura.
 * - `fattura`: una fattura elettronica, riconosciuta dal contenuto.
 * - `xml_generico`: un XML vero che non è una fattura (per esempio una
 *   distinta SEPA).
 * - `da_aprire`: potrebbe essere un XML ma il contenuto non c'è, quindi non
 *   si può ancora dire.
 * - `normale`: tutto il resto (PDF, immagini, una busta firmata che non
 *   contiene XML…).
 *
 * @param {string} nome il nome del file com'è arrivato
 * @param {Uint8Array} [byte] il contenuto; senza, si decide solo dal nome
 * @returns {"tecnico"|"metadati_sdi"|"fattura"|"xml_generico"|"da_aprire"|"normale"}
 */
export function classificaAllegato(nome, byte) {
  const n = String(nome ?? "").trim();
  if (TECNICI.some((r) => r.test(n))) return "tecnico";
  if (METADATI_SDI.test(n)) return "metadati_sdi";
  if (!FORSE_XML.test(n)) return "normale";
  if (!byte) return "da_aprire";
  if (eFatturaPA(byte)) return "fattura";
  try {
    leggiXml(xmlDaFile(byte));
    return "xml_generico";
  } catch {
    return "normale";
  }
}

/**
 * Un allegato che si salta SENZA dirlo e senza aprirlo: i file della busta
 * PEC (daticert, smime), con i nomi fissati dalle regole della PEC. Ogni
 * volta facevano scattare l'avviso «formato che non so aprire» (07/11).
 *
 * ⚠️ Solo questi. Il file `_MT_` dello SdI NON è qui: si apre, perché il
 *    nome lo sceglie chi manda e una fattura chiamata «…_MT_001.xml»
 *    sparirebbe; si tace solo dopo aver visto che non è una fattura (vedi
 *    `xmlPerIlModello`). Qualunque altra cosa che non si legge continua ad
 *    avvisare: uno scarto silenzioso è indistinguibile da una cosa mai
 *    arrivata (20260812000005).
 *
 * @param {string} nome
 * @returns {boolean}
 */
export function allegatoDaTacere(nome) {
  return classificaAllegato(nome) === "tecnico";
}

/** Quanto XML si passa al modello: una fattura vera sta in poche decine di migliaia di caratteri. */
export const MAX_CARATTERI_XML = 200000;

/**
 * Il testo da far leggere al modello per un allegato XML o `.p7m`: l'XML
 * in chiaro, anche tirato fuori dalla busta firmata. Così una fattura
 * elettronica o una distinta SEPA si leggono come testo invece di finire
 * fra i «formati che non so aprire» (e di far improvvisare al modello il
 * consiglio di un programma per aprire il .p7m).
 *
 * Il file `_MT_` dello SdI si apre come gli altri: se dentro c'è davvero
 * una fattura si legge, altrimenti (i metadati veri) torna `silenzio`.
 *
 * @param {string} nome
 * @param {Uint8Array} byte
 * @returns {{testo: string, fattura: boolean, tagliato: boolean, intero: string}|{silenzio: true}|null}
 *   null se non è un XML leggibile
 */
export function xmlPerIlModello(nome, byte) {
  const tipo = classificaAllegato(nome);
  if (tipo !== "da_aprire" && tipo !== "metadati_sdi") return null;
  let xml;
  try {
    xml = xmlDaFile(byte);
    leggiXml(xml);
  } catch {
    return tipo === "metadati_sdi" ? { silenzio: true } : null;
  }
  const fattura = eFatturaPA(byte);
  if (tipo === "metadati_sdi" && !fattura) return { silenzio: true };
  const tagliato = xml.length > MAX_CARATTERI_XML;
  return {
    testo: tagliato ? `${xml.slice(0, MAX_CARATTERI_XML)}\n[… tagliato: il file è più lungo]` : xml,
    fattura,
    tagliato,
    // L'XML intero, per costruire la registrazione: il taglio vale solo per il modello.
    intero: xml,
  };
}

// --- la fattura diventa una proposta ------------------------------------------

const dataItaliana = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")) ? d.split("-").reverse().join("/") : d ?? "?");
/** Il giorno di un istante, a Roma: un orario fra mezzanotte e le 2 non deve cadere il giorno prima. */
function giornoARoma(istante) {
  const d = new Date(istante ?? "");
  if (Number.isNaN(d.getTime())) return "?";
  return d.toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });
}
const euroItaliano = (c) =>
  c == null ? "?" : `${(c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Le proposte che nascono da una fattura elettronica arrivata per posta.
 *
 * Le costruisce il CODICE dall'XML, non il modello: numero, data, importi e
 * partita IVA si leggono dai loro campi (08/11/2026). Quattro casi:
 *
 * - una fattura registrabile e non ancora registrata → `registra_fattura`,
 *   con dentro i dati pronti per `registra_fattura_elettronica`;
 * - già registrata (stesso file SdI) → `nessuna`, che dice quando, e la
 *   conferma chiude soltanto (non c'è niente da rifare);
 * - una fattura con un problema (nota di credito, numero mancante…) →
 *   `da_fare_a_mano`, col problema scritto;
 * - un file con più fatture dentro (un «lotto») → `da_fare_a_mano`: si
 *   registrano da «Importa fattura elettronica», che le mostra una per una.
 *
 * Un XML che non si legge come fattura non produce niente: l'ha già visto
 * il modello come testo.
 *
 * 🔴 «ARRIVATA DALLO SDI» SOLO SE È VERO (revisione dell'11/11, punto 3).
 *    Prima si diceva per ogni file-fattura, chiunque l'avesse mandato: un
 *    truffatore poteva scrivere in un XML il nome di un fornitore vero e il
 *    proprio IBAN, e compariva «Registra la fattura», con scritto che veniva
 *    dallo SdI. Adesso il pulsante nasce solo se la mail viene davvero dallo
 *    SdI (`vieneDalloSdi`). Altrimenti la proposta è «da fare a mano», con
 *    scritto «mittente NON verificato» e chi l'ha mandata: la si registra da
 *    Fatture → Importa fattura elettronica dopo averla controllata, oppure
 *    si aspetta la copia dello SdI.
 * ⚠️ E L'IBAN NUOVO SI DICE SEMPRE, anche dallo SdI: l'IBAN lo scrive il
 *    fornitore, e uno mai visto per lui è il primo segno di una truffa.
 *
 * @param {string} nomeFile il nome del file SdI (diventa `file_sdi`)
 * @param {string} xml l'XML intero
 * @param {{invoice_number?: string, invoice_date?: string, created_at?: string}|null} [giaRegistrata]
 *   la fattura già presente con lo stesso file SdI, se c'è
 * @param {{dalloSdi?: boolean, mittente?: string|null, ibanNuovi?: string[]}} [provenienza]
 *   se la mail viene davvero dallo SdI (senza, NON si crede), chi l'ha
 *   mandata, e gli IBAN della fattura mai visti per questo fornitore
 * @returns {Array<{tipo: string, titolo: string, descrizione: string, perche: string, parametri: object}>}
 */
export function proposteDaFattura(nomeFile, xml, giaRegistrata = null, provenienza = {}) {
  const { fatture, errori } = leggiFatturaPA(xml);
  if (errori.length || !fatture.length) return [];
  const dalloSdi = provenienza?.dalloSdi === true;
  const daChi = String(provenienza?.mittente ?? "").trim() || "un mittente sconosciuto";
  const ibanNuovi = [...new Set((provenienza?.ibanNuovi ?? []).map(ibanNormale).filter(Boolean))];
  const avvisoIban = ibanNuovi.length
    ? `IBAN nuovo per questo fornitore (${ibanNuovi.join(", ")}): controllalo col fornitore prima di pagare.`
    : null;
  const perche = dalloSdi
    ? "È una fattura elettronica arrivata dallo SdI: i dati si leggono dai campi del file, senza interpretarli."
    : `Mittente NON verificato: il file l'ha mandato ${daChi}, non lo SdI. Chiunque può scrivere in un file il nome di un fornitore vero.`;

  if (fatture.length > 1) {
    const titolo = `Registra le ${fatture.length} fatture del file ${nomeFile}`;
    return [{
      tipo: "da_fare_a_mano",
      titolo,
      descrizione: `Il file ${nomeFile} contiene ${fatture.length} fatture: registrale da Fatture → Importa fattura elettronica, che le mostra una per una.`,
      perche,
      parametri: { titolo, passi: ["Scarica l'allegato dalla Posta", "Aprilo da Fatture → Importa fattura elettronica"] },
    }];
  }

  const f = fatture[0];
  const chi = f.fornitore?.denominazione ?? "fornitore senza nome";
  const numero = f.numero ?? "senza numero";

  if (f.errori.length) {
    const titolo = `Controlla la fattura ${numero} di ${chi}`;
    return [{
      tipo: "da_fare_a_mano",
      titolo,
      descrizione: `Non si registra da sola: ${f.errori.join(" ")}`,
      perche,
      parametri: { titolo, passi: f.errori },
    }];
  }

  if (giaRegistrata) {
    return [{
      tipo: "nessuna",
      titolo: `La fattura n. ${numero} di ${chi} è già registrata`,
      descrizione:
        `Registrata il ${giornoARoma(giaRegistrata.created_at)}` +
        ` (n. ${giaRegistrata.invoice_number ?? numero} del ${dataItaliana(giaRegistrata.invoice_date)}): non c'è niente da rifare.`,
      perche,
      // Chi, numero e totale anche qui: servono alla testata della Posta (11/11).
      parametri: { gia_registrata: giaRegistrata, file_sdi: nomeFile, fornitore: chi, numero, totale: f.totaleCentesimi / 100 },
    }];
  }

  const tipo = TIPI_REGISTRABILI[f.tipo] ?? "Fattura";
  const scadenza = f.scadenza ? `, da pagare entro il ${dataItaliana(f.scadenza)}` : "";
  const avvisi = avvisoIban ? [...f.avvisi, avvisoIban] : f.avvisi;

  if (!dalloSdi) {
    const titolo = `Mittente NON verificato: controlla la fattura n. ${numero} di ${chi} (${euroItaliano(f.totaleCentesimi)})`;
    const passi = [
      `Chiedi a ${chi}, con un numero che conosci già (non quelli scritti nella fattura), se l'ha mandata davvero`,
      "Oppure aspetta la copia dallo SdI: arriva da sola nella PEC",
      "Se è vera, registrala da Fatture → Importa fattura elettronica",
    ];
    if (avvisoIban) passi.unshift(avvisoIban);
    return [{
      tipo: "da_fare_a_mano",
      titolo,
      descrizione:
        `Non arriva dallo SdI: l'ha mandata ${daChi}. ${tipo} del ${dataItaliana(f.data)}, totale ${euroItaliano(f.totaleCentesimi)}${scadenza}.` +
        ` Non si registra da qui finché non sei sicuro che sia vera.` +
        (avvisi.length ? ` Attenzione: ${avvisi.join(" ")}` : ""),
      perche,
      parametri: { titolo, passi, file_sdi: nomeFile, mittente_verificato: false, iban_nuovi: ibanNuovi },
    }];
  }

  return [{
    tipo: "registra_fattura",
    titolo: `Registra la fattura n. ${numero} di ${chi} (${euroItaliano(f.totaleCentesimi)})`,
    descrizione:
      `${tipo} del ${dataItaliana(f.data)}, totale ${euroItaliano(f.totaleCentesimi)}${scadenza}. Va su Borgo 58.` +
      (avvisi.length ? ` Attenzione: ${avvisi.join(" ")}` : ""),
    perche,
    parametri: { fattura: payloadFattura(f, nomeFile), file_sdi: nomeFile, avvisi, mittente_verificato: true, iban_nuovi: ibanNuovi },
  }];
}

/** Un IBAN scritto in qualunque modo, in maiuscolo e senza spazi; null se vuoto. */
export function ibanNormale(iban) {
  const s = String(iban ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s || null;
}

/**
 * Partita IVA del fornitore e IBAN di una fattura, per chiedere al database
 * se quegli IBAN sono già noti. Null se il file non è UNA fattura leggibile
 * (un lotto si registra dall'import, che mostra tutto).
 *
 * @param {string} xml
 * @returns {{partitaIva: string|null, iban: string[]}|null}
 */
export function ibanDellaFattura(xml) {
  let letto;
  try {
    letto = leggiFatturaPA(xml);
  } catch {
    return null;
  }
  if (letto.errori.length || letto.fatture.length !== 1) return null;
  const f = letto.fatture[0];
  const iban = [...new Set((f.scadenze ?? []).map((s) => ibanNormale(s.iban)).filter(Boolean))];
  return { partitaIva: f.fornitore?.partitaIva ?? f.fornitore?.codiceFiscale ?? null, iban };
}

/**
 * La radice SdI di un nome di file: `IT01234567890_ab12C.xml.p7m` →
 * `it01234567890_ab12c`. Lo SdI chiama così tutti i file della stessa
 * fattura (la fattura, i metadati `_MT_`, l'eventuale stampa).
 *
 * @param {string} nome
 * @returns {string}
 */
function radiceSdi(nome) {
  return String(nome ?? "")
    .trim()
    .toLowerCase()
    .replace(/(\.(xml|p7m|pdf|html?))+$/i, "")
    .replace(/_mt_\d+$/i, "");
}

/**
 * Toglie le proposte di archiviare il file di una fattura già registrata
 * (08/11/2026, prima PEC vera dopo il rilascio: la 330/F era già registrata,
 * eppure accanto a «è già registrata» il modello proponeva anche «Archivia
 * Fattura notaio 330/F». Era un doppione: registrandola, il suo file SdI era
 * già stato salvato).
 *
 * ⚠️ Si toglie l'archiviazione dello STESSO file (o di un file con la stessa
 *    radice SdI), dei file della busta (daticert, smime, metadati SdI) e
 *    l'archiviazione della mail senza allegato (11/11/2026: la busta di una
 *    fattura SdI non è un documento da archiviare: la fattura c'è già). Un
 *    altro allegato vero della stessa mail, per esempio un contratto, resta
 *    proposto com'era.
 *
 * @param {Array<Record<string, unknown>>} azioni
 * @param {Array<{id: string, file_name: string}>} allegati gli allegati della mail
 * @param {string[]} giaRegistrate i nomi dei file delle fatture già registrate
 * @returns {Array<Record<string, unknown>>}
 */
export function senzaArchiviareLeGiaRegistrate(azioni, allegati, giaRegistrate) {
  if (!giaRegistrate?.length) return azioni;
  const radici = new Set(giaRegistrate.map(radiceSdi));
  const daTogliere = new Set(
    (allegati ?? [])
      .filter((x) => {
        const c = classificaAllegato(x.file_name);
        return radici.has(radiceSdi(x.file_name)) || c === "tecnico" || c === "metadati_sdi";
      })
      .map((x) => String(x.id)),
  );
  return azioni.filter((a) => {
    if (a.tipo !== "archivia_documento" && a.tipo !== "archivia_testo") return true;
    const p = /** @type {{allegato_id?: unknown}} */ (a.parametri ?? {});
    // Il testo della mail resta proposto: un fornitore può scriverci condizioni
    //    o scadenze (revisione ECC dell'11/11). Si toglie solo un «documento»
    //    senza file, che di una busta SdI non ha niente da archiviare.
    if (!p.allegato_id) return a.tipo === "archivia_testo";
    return !daTogliere.has(String(p.allegato_id));
  });
}

/**
 * Cosa dire nella testata di una mail con una fattura elettronica (11/11/2026:
 * di una PEC dello SdI si vedevano solo «borgo58@pec.it» e «Invio File
 * 18141078362»). Si legge dalle proposte costruite dal codice: chi ha fatto
 * la fattura, il numero e il totale. Null se la mail non porta una fattura.
 *
 * @param {Array<{tipo?: string, parametri?: Record<string, any>}>} azioni
 * @returns {{chi: string|null, numero: string|null, totale: number|null}|null}
 */
export function testataFattura(azioni) {
  for (const a of azioni ?? []) {
    const p = a?.parametri ?? {};
    if (a?.tipo === "registra_fattura" && p.fattura) {
      return {
        chi: p.fattura.fornitore?.denominazione ?? null,
        numero: p.fattura.numero ?? null,
        totale: p.fattura.totale != null && Number.isFinite(Number(p.fattura.totale)) ? Number(p.fattura.totale) : null,
      };
    }
    if (a?.tipo === "nessuna" && p.gia_registrata) {
      return {
        chi: p.fornitore ?? null,
        numero: p.numero ?? p.gia_registrata.invoice_number ?? null,
        totale: p.totale != null && Number.isFinite(Number(p.totale)) ? Number(p.totale) : null,
      };
    }
  }
  return null;
}

/** Si apre in `posta-leggi` come XML (anche i metadati SdI, per controllarli). */
export function daAprireComeXml(nome) {
  const tipo = classificaAllegato(nome);
  return tipo === "da_aprire" || tipo === "metadati_sdi";
}

// --- la busta: mittente e oggetto -------------------------------------------

/**
 * Il testo è quello della busta di una PEC? Aruba lo apre con una riga
 * fissa, in italiano e poi in inglese.
 */
export function eBustaPec(testo) {
  return /--\s*(Messaggio di posta certificata|Certified mail message)\s*--/i.test(String(testo ?? ""));
}

/**
 * Chi firma le buste e le ricevute: la PEC del locale è di Aruba, quindi
 * solo da questo indirizzo una busta si crede.
 */
const GESTORE_PEC = "posta-certificata@pec.aruba.it";

/**
 * Il mittente è il gestore della PEC? Il mittente può arrivare nudo
 * («posta-certificata@pec.aruba.it») o col nome davanti («Posta
 * Certificata <posta-certificata@pec.aruba.it>»).
 *
 * ⚠️ IL NOME DAVANTI LO SCRIVE CHI MANDA: si confronta solo l'indirizzo tra
 *    `<…>` (o tutto, se non c'è), e per intero. Con una ricerca dentro la
 *    stringa, «"posta-certificata@x" <truffa@esempio.it>» passava per
 *    busta PEC e il mittente mostrato diventava quello scritto dal truffatore
 *    (revisione ECC dell'08/11).
 */
export function eGestorePec(mittente) {
  const s = String(mittente ?? "").trim();
  const tra = s.match(/<([^<>]*)>\s*$/);
  return (tra ? tra[1] : s).trim().toLowerCase() === GESTORE_PEC;
}

/** È il mittente tecnico che incarta le PEC (vuoto = non lo si sa, si guarda solo il testo). */
function daGestorePec(mittenteBusta) {
  return mittenteBusta == null || eGestorePec(mittenteBusta);
}

/** Un indirizzo email, senza parentesi, virgolette o punteggiatura attaccate. */
const INDIRIZZO = /[^\s"'<>()[\]]+@[^\s"'<>()[\],;]+/;
const INVIATO_DA = /(?:inviato da|sent by)[ \t]*"([^"\n]*)"/gi;
const PER_CONTO_DI = /Per conto di:[ \t]*/i;

/**
 * Chi ha mandato davvero la PEC, letto dalla busta.
 *
 * La busta di Aruba dice, su una riga: `il messaggio con oggetto "…" è
 * stato inviato da "X" ed indirizzato a:`. X è l'indirizzo
 * («"borgo58@pec.it"») oppure, per lo SdI, «"Per conto di:
 * sdi01@pec.fatturapa.it" <posta-certificata@…>»: in quel caso vale
 * l'indirizzo dopo «Per conto di:».
 *
 * ⚠️ L'OGGETTO LO SCRIVE CHI MANDA, e la busta lo ripete PRIMA del
 *    mittente vero, sulla stessa riga: un oggetto «inviato da "x"» o «Per
 *    conto di: x» non deve diventare il mittente. Per questo si prende
 *    l'ULTIMO «inviato da "…"» del blocco italiano (o di quello inglese se
 *    l'italiano manca), e «Per conto di:» si cerca solo dentro quelle
 *    virgolette. (Revisione ECC dell'08/11.)
 * ⚠️ Si legge SOLO dentro la busta PEC, e solo se la mail arriva dal
 *    gestore (`posta-certificata@…`) quando il mittente è noto: una mail
 *    normale che cita «inviato da» non deve cambiare mittente.
 *    Le lettere accentate rovinate («ï¿½ stato inviato da», 07/11) non
 *    contano: la frase che si cerca non ha accenti.
 *
 * @param {string} testo il testo della mail
 * @param {string|null} [mittenteBusta] il mittente com'è arrivato
 * @returns {string|null} l'indirizzo in minuscolo, oppure null
 */
export function mittenteReale(testo, mittenteBusta) {
  const t = String(testo ?? "");
  if (!eBustaPec(t) || !daGestorePec(mittenteBusta)) return null;
  const inglese = t.search(/--\s*Certified mail message\s*--/i);
  const italiano = inglese > 0 ? t.slice(0, inglese) : t;
  const trovati = [...italiano.matchAll(INVIATO_DA)];
  const ultimo = (trovati.length ? trovati : [...t.matchAll(INVIATO_DA)]).at(-1);
  if (!ultimo) return null;
  let dentro = ultimo[1];
  const pcd = dentro.search(PER_CONTO_DI);
  if (pcd >= 0) dentro = dentro.slice(pcd).replace(PER_CONTO_DI, "");
  const m = dentro.match(INDIRIZZO);
  return m ? m[0].replace(/[.:]+$/, "").toLowerCase() : null;
}

/** Le caselle da cui scrive lo SdI: «sdi01@pec.fatturapa.it», «sdi38@…». */
const CASELLA_SDI = /^sdi\d{1,3}@pec\.fatturapa\.it$/;

/** È una casella dello SdI, scritta per intero (non «…fatturapa.it» qualunque)? */
export function eCasellaSdi(indirizzo) {
  return CASELLA_SDI.test(String(indirizzo ?? "").trim().toLowerCase());
}

/** In un blocco della busta: c'è UNA sola riga «inviato da», ed è «Per conto di: <casella SdI>»? */
function bloccoDelloSdi(blocco) {
  const trovati = [...blocco.matchAll(INVIATO_DA)];
  if (trovati.length !== 1) return false;
  // ⚠️ Tutto quello che sta fra le virgolette, e nient'altro: con una
  //    ricerca dentro, «x@truffa Per conto di: sdi01@…» passava (revisione
  //    di sicurezza del 12/11).
  const m = /^\s*Per conto di:\s*(\S+)\s*$/i.exec(trovati[0][1]);
  return Boolean(m) && eCasellaSdi(m[1]);
}

/**
 * La mail viene DAVVERO dallo SdI? (revisione dell'11/11, punto 3)
 *
 * Tre cose insieme, tutte e tre:
 * 1. l'ha consegnata il gestore della PEC: il mittente COM'È ARRIVATO
 *    (non quello ripulito che si mostra) è `posta-certificata@pec.aruba.it`.
 *    Una mail normale, anche con scritto «sdi01@pec.fatturapa.it», non lo è;
 * 2. il testo è la busta del gestore, e dice UNA volta sola chi l'ha
 *    mandata, nella forma che il gestore usa per lo SdI: «Per conto di:
 *    sdiNN@pec.fatturapa.it». Se le righe «inviato da» sono più d'una (un
 *    oggetto o un testo scritti apposta per imitarla), non si crede;
 * 3. fra gli allegati ci sono `daticert.xml` e `smime.p7s`, i due file che il
 *    gestore mette in ogni busta vera (anche col numero: `daticert_1.xml`).
 *
 * ⚠️ Senza il mittente com'è arrivato (le mail registrate prima di questa
 *    correzione) la risposta è NO: meglio un «da fare a mano» in più che un
 *    pulsante creduto per sbaglio.
 * ⚠️ Una PEC la può mandare solo chi ha quella casella (il gestore lo
 *    controlla): per questo «Per conto di: sdiNN@pec.fatturapa.it» vale.
 *    Quello che qui NON si può escludere è una mail scritta apposta e
 *    mandata direttamente all'indirizzo tecnico di ricezione, fingendo
 *    tutto: per quella servirebbe controllare la firma della busta
 *    (`smime.p7s`), che non si fa.
 *
 * @param {{mittenteBusta?: string|null, testo?: string|null, allegati?: Array<{file_name?: string}>}} mail
 * @returns {boolean}
 */
export function vieneDalloSdi({ mittenteBusta = null, testo = null, allegati = [] } = {}) {
  if (!eGestorePec(mittenteBusta)) return false;
  const t = String(testo ?? "");
  if (!eBustaPec(t)) return false;
  const inglese = t.search(/--\s*Certified mail message\s*--/i);
  const blocchi = inglese > 0 ? [t.slice(0, inglese), t.slice(inglese)] : [t];
  if (!blocchi.every(bloccoDelloSdi)) return false;
  // La busta vera porta tutti e due i file del gestore: i dati e la firma.
  const nomi = (allegati ?? []).map((a) => String(a?.file_name ?? "").trim());
  return TECNICI.every((r) => nomi.some((n) => r.test(n)));
}

/** I prefissi che la busta e gli inoltri mettono davanti all'oggetto. */
const PREFISSO = /^\s*(POSTA CERTIFICATA:|Fwd?\s*:|R\s*:|RE\s*:|I\s*:|TR\s*:)\s*/i;

/**
 * L'oggetto senza i prefissi della busta e degli inoltri, anche ripetuti e
 * anche senza spazio («POSTA CERTIFICATA: Fw:Invio File 1814…» →
 * «Invio File 1814…»). Se togliendo tutto non resta niente, si tiene
 * l'oggetto com'era.
 *
 * @param {string} oggetto
 * @returns {string}
 */
export function oggettoPulito(oggetto) {
  const originale = String(oggetto ?? "").trim();
  let o = originale;
  for (let giri = 0; giri < 20 && PREFISSO.test(o); giri++) o = o.replace(PREFISSO, "");
  return o.trim() || originale;
}

/**
 * È una ricevuta della PEC (accettazione o consegna di una PEC mandata da
 * noi)? Alessio, 08/11: «spariscono del tutto».
 *
 * ⚠️ Solo le ricevute che dicono «è andato tutto bene». «MANCATA CONSEGNA»,
 *    «NON ACCETTAZIONE» e gli avvisi di errore restano visibili: vogliono
 *    dire che una PEC importante NON è arrivata, e nasconderle sarebbe
 *    nascondere un problema.
 *
 * ⚠️ Conta anche CHI la manda: le ricevute le firma il gestore
 *    (`posta-certificata@…`). Una mail normale con oggetto «Consegna:
 *    ordine 5» (un corriere, un fornitore) non deve sparire. Una ricevuta
 *    inoltrata a mano («Fwd: ACCETTAZIONE: …») resta: l'ha mandata una
 *    persona, apposta. (Revisione ECC dell'08/11.)
 *
 * @param {string} oggetto l'oggetto com'è arrivato, non ripulito
 * @param {string|null} mittenteBusta il mittente com'è arrivato
 * @returns {boolean}
 */
export function eRicevutaPec(oggetto, mittenteBusta) {
  if (!eGestorePec(mittenteBusta)) return false;
  return /^\s*(ACCETTAZIONE|AVVENUTA CONSEGNA|CONSEGNA|PRESA IN CARICO)\s*:/i.test(String(oggetto ?? ""));
}

/**
 * Mittente e oggetto da registrare e da mostrare: quelli veri se la mail è
 * una busta PEC del gestore, altrimenti quelli arrivati, invariati.
 *
 * Lo usano sia la funzione che riceve la posta (le righe nuove nascono già
 * pulite) sia la pagina Posta (le righe vecchie si mostrano pulite senza
 * riscriverle). Passarci due volte non cambia niente: dopo la prima il
 * mittente non è più il gestore e la mail non viene più trattata come busta.
 * Quello che arriva resta comunque leggibile nel testo della mail.
 *
 * @param {{mittente?: string|null, oggetto?: string|null, testo?: string|null}} mail
 * @returns {{mittente: string|null, oggetto: string|null}}
 */
export function testaDellaMail({ mittente = null, oggetto = null, testo = null } = {}) {
  const busta = eGestorePec(mittente) && eBustaPec(testo);
  if (!busta) return { mittente, oggetto };
  return {
    mittente: mittenteReale(testo, mittente) ?? mittente,
    oggetto: oggetto == null ? oggetto : oggettoPulito(oggetto),
  };
}

// --- la casella --------------------------------------------------------------

/** Le caselle del gestionale si mostrano col nome vero, non con l'indirizzo tecnico. */
const NOMI_CASELLE = { pec: "borgo58@pec.it" };

/**
 * Il nome della casella da mostrare. La posta arriva a un indirizzo tecnico
 * del servizio di ricezione (`pec@….resend.app`): a schermo si mostra
 * quello vero (Alessio, 08/11: «borgo58@pec.it» per intero), oppure solo la
 * parte prima della chiocciola per le caselle senza un nome fissato.
 *
 * @param {string} casella
 * @returns {string}
 */
export function etichettaCasella(casella) {
  const c = String(casella ?? "").trim();
  const at = c.indexOf("@");
  if (at <= 0) return c;
  const locale = c.slice(0, at).toLowerCase();
  if (!/\.resend\.app$/i.test(c)) return c;
  // Object.hasOwn: «constructor@…» non deve pescare nel prototipo.
  return Object.hasOwn(NOMI_CASELLE, locale) ? NOMI_CASELLE[locale] : `${locale}@`;
}

// --- l'avviso di Aruba senza la fattura (13/11/2026) -------------------------
//
// 🔴 Il 13/11 è arrivata da `noreply@fatturazioneelettronica.aruba.it` la mail
//    «Hai ricevuto una nuova fattura elettronica» (Fabio Lorito, n. 1992/2026,
//    235,00 €) SENZA il file della fattura: il file resta nel pannello di
//    Aruba, «Fatture ricevute». MEMO ha scritto «il gestionale la registrerà
//    da solo» e l'ha messa fra le «Niente da fare». Era falso: senza un XML
//    (o un .p7m) allegato nessuno registra niente, e la fattura si perdeva.
//
// La regola è nel CODICE, non solo nelle istruzioni del modello: un avviso di
// Aruba senza fattura leggibile produce SEMPRE la stessa cosa da fare, con i
// dati letti dall'avviso. Le PEC dello SdI con l'xml.p7m («Invio File …») non
// passano di qui: la loro fattura si legge, e la proposta resta quella di
// `proposteDaFattura`.

/** Il dominio da cui Aruba manda gli avvisi della fatturazione elettronica. */
const DOMINIO_ARUBA_FE = "@fatturazioneelettronica.aruba.it";

/** L'indirizzo vero di un mittente: quello fra `<…>` se c'è, altrimenti tutto. */
function soloIndirizzo(mittente) {
  const s = String(mittente ?? "").trim();
  const tra = s.match(/<([^<>]*)>\s*$/);
  return (tra ? tra[1] : s).trim().toLowerCase();
}

/**
 * È l'avviso di Aruba di una fattura RICEVUTA? Mittente del dominio della
 * fatturazione elettronica di Aruba (l'indirizzo fra `<…>`, non il nome
 * davanti, che lo scrive chi manda) e oggetto «Hai ricevuto una nuova
 * fattura…», anche con «Fwd:» davanti.
 *
 * ⚠️ Chiunque può scrivere quel mittente: per questo l'avviso produce solo
 *    una cosa da fare a mano («scaricala da Aruba»), mai un bottone che
 *    registra. Il peggio che può fare una mail finta è farti aprire Aruba.
 *
 * @param {{mittente?: string|null, oggetto?: string|null}} mail
 * @returns {boolean}
 */
export function eAvvisoArubaFattura({ mittente = null, oggetto = null } = {}) {
  if (!soloIndirizzo(mittente).endsWith(DOMINIO_ARUBA_FE)) return false;
  // ⚠️ «Hai ricevuto … fattura» o «fattura ricevuta», non un «ricevut…»
  //    qualunque: «Ricevuta di consegna della fattura n. 12» (una fattura
  //    EMESSA da noi) non è un avviso di fattura da scaricare (revisione ECC).
  return /\bhai\s+ricevuto\b.*\bfattur[ae]\b|\bfattur[ae]\b(?:\s+\S+){0,2}\s+ricevut[ae]\b/i.test(
    oggettoPulito(oggetto ?? ""),
  );
}

/** Una data scritta all'italiana (o già AAAA-MM-GG) → «AAAA-MM-GG»; null se non è una data vera. */
function dataIso(v) {
  const s = String(v ?? "").trim();
  let g, m, a;
  let r = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (r) [, a, m, g] = r;
  else {
    r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
    if (!r) return null;
    [, g, m, a] = r;
  }
  const iso = `${a}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** «1.235,00 €», «€ 235,00», «235.00», «EUR 235» → numero; null se non c'è un importo. */
function importoDa(v) {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const r = String(v ?? "").match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!r) return null;
  let t = r[1];
  // «1.235,00» e «235,00»: la virgola è dei decimali, i punti delle migliaia.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  // «1.235» (punto delle migliaia, senza decimali) resta 1235.
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Un numero di fattura: un pezzo solo, con almeno una cifra. */
function numeroDa(v) {
  const r = String(v ?? "").trim().match(/^[^\s,;]+/);
  const t = r ? r[0].replace(/[.:]+$/, "") : "";
  return /\d/.test(t) && t.length <= 40 ? t : null;
}

/** Un nome di fornitore: una riga, senza punteggiatura in coda, non troppo lungo. */
function nomeDa(v) {
  const t = String(v ?? "").replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  // Un indirizzo email non è un fornitore («Mittente: noreply@…»).
  if (t.includes("@")) return null;
  return t.length >= 2 && t.length <= 120 ? t : null;
}

// Le etichette dell'avviso. Dopo l'etichetta: due punti, una tabulazione o un
// a capo (la tabella dell'HTML, ridotta a testo). Lo spazio semplice non
// basta per il fornitore e per «numero»/«data» da soli: «Mittente della
// mail» non è un fornitore, «numero verde» non è un numero di fattura.
const SEP = String.raw`[ \t]*(?::|\t|\r?\n)[ \t]*(?:\r?\n[ \t]*)?`;
const SEP_LARGO = String.raw`[ \t]*(?::|\t|\r?\n|[ \t])[ \t]*(?:\r?\n[ \t]*)?`;
const ETICHETTE = {
  fornitore: [
    String.raw`(?:fornitore|cedente(?:\s*/\s*prestatore)?|emittente|mittente|ragione sociale|denominazione)` + SEP,
  ],
  numero: [String.raw`(?:numero|n\.?|nr\.?|n°)\s*(?:della\s+)?(?:fattura|documento)` + SEP_LARGO, "numero" + SEP],
  data: [String.raw`data\s+(?:della\s+|di\s+)?(?:fattura|documento|emissione)` + SEP_LARGO, "data" + SEP],
  importo: [String.raw`(?:importo|totale)(?:\s+(?:totale|documento|fattura))?` + SEP_LARGO],
};

/** Il valore dopo la prima etichetta che lo porta valido. */
function campo(testo, etichette, valida) {
  for (const e of etichette) {
    const re = new RegExp(String.raw`(?:^|[\s>|])` + e + String.raw`([^\r\n]*)`, "gi");
    for (const m of testo.matchAll(re)) {
      const v = valida(m[1]);
      if (v != null) return v;
    }
  }
  return null;
}

/**
 * I dati della fattura scritti nell'avviso di Aruba: fornitore, numero, data
 * e importo, ognuno null se non c'è. Si leggono le righe «Etichetta: valore»
 * e, se mancano, la frase («fattura n. 1992/2026 del 12/11/2026»).
 *
 * ⚠️ Non si indovina: un campo che non si trova resta null, e la cosa da fare
 *    lo dice senza («la fattura di Fabio Lorito», senza numero).
 *
 * @param {string|null} testo il testo della mail
 * @returns {{fornitore: string|null, numero: string|null, data: string|null, importo: number|null}}
 */
export function datiAvvisoAruba(testo) {
  const t = String(testo ?? "").slice(0, 20000);
  const fornitore =
    campo(t, ETICHETTE.fornitore, nomeDa) ??
    nomeDa(t.match(/(?:emessa da|inviata da|da parte di|dal fornitore|dal cedente)[ \t]*:?[ \t]*([^\n.,;]{2,120})/i)?.[1]);
  const numero =
    campo(t, ETICHETTE.numero, numeroDa) ??
    numeroDa(t.match(/fattura(?:\s+elettronica)?\s+(?:n\.?|nr\.?|n°|numero)\s*([^\s,;]+)/i)?.[1]);
  const data =
    campo(t, ETICHETTE.data, dataIso) ??
    dataIso(t.match(/fattura[^\n]{0,80}?\bdel\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1]);
  // Il valore deve COMINCIARE con l'importo (o con «€»/«EUR»): «Totale
  // imponibile: 200,00» non è il totale della fattura.
  const importo = campo(t, ETICHETTE.importo, (v) =>
    /^\s*(?:€|eur(?:o)?\b)?\s*\d/i.test(v) ? importoDa(v) : null,
  );
  return { fornitore, numero, data, importo };
}

/** «2026-11-12» → «12/11/2026». */
const giornoItaliano = (iso) => (iso ? iso.split("-").reverse().join("/") : null);
const euro = (n) =>
  n == null ? null : `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * La cosa da fare per un avviso di Aruba senza la fattura allegata: scaricare
 * l'XML da Aruba e caricarlo nelle Fatture Fornitori. È un «da fare a mano»
 * («Segnatelo»): la mail resta fra le «Da decidere» finché Alessio non
 * conferma o rifiuta.
 *
 * @param {{fornitore?: unknown, numero?: unknown, data?: unknown, importo?: unknown}} [dati]
 * @returns {{tipo: string, titolo: string, descrizione: string, perche: string, parametri: Record<string, unknown>}}
 */
export function propostaFatturaDaScaricare(dati = {}) {
  const fornitore = nomeDa(dati?.fornitore);
  const numero = numeroDa(dati?.numero);
  const data = dataIso(dati?.data);
  const importo = importoDa(dati?.importo);
  const quale = `la fattura${numero ? ` n. ${numero}` : ""}${fornitore ? ` di ${fornitore}` : ""}`;
  const dettagli = [data ? `del ${giornoItaliano(data)}` : null, euro(importo)].filter(Boolean);
  const titolo = `Scarica da Aruba ${quale}`.slice(0, 200);
  const scheda = `${quale.charAt(0).toUpperCase()}${quale.slice(1)}${dettagli.length ? ` (${dettagli.join(", ")})` : ""}`;
  return {
    tipo: "da_fare_a_mano",
    titolo,
    descrizione:
      `${scheda}: è arrivato solo l'avviso di Aruba, senza il file. Il gestionale NON la registra da solo: ` +
      `scarica l'XML da Aruba → Fatture ricevute e caricalo in Fatture Fornitori → «Carica una fattura elettronica».`,
    perche:
      "Aruba avvisa che la fattura è arrivata ma non manda il file: finché l'XML non è caricato, la fattura non è registrata da nessuna parte. I dati sono quelli scritti nell'avviso.",
    parametri: {
      titolo,
      data: null,
      passi: [
        `Apri Aruba → Fatturazione elettronica → Fatture ricevute e scarica l'XML di ${quale}`,
        "Caricalo in Fatture Fornitori → «Carica una fattura elettronica»",
      ],
      avviso_aruba: true,
      fornitore,
      numero,
      data_fattura: data,
      importo,
    },
  };
}

// Una frase che promette una registrazione che nessuno farà: «il gestionale
// la registrerà da solo», «verrà registrata automaticamente», «la
// registrazione la propone il gestionale». Si cerca dentro una frase sola.
const PROMESSA = [
  /\b(?:registr|import)\w*\b[^.;!?\n]{0,80}\b(?:da\s+sol[oaie]|automaticamente|in\s+automatico|da\s+s[ée])(?![\p{L}])/iu,
  /\b(?:da\s+sol[oaie]|automaticamente|in\s+automatico)\b[^.;!?\n]{0,80}\b(?:registr|import)\w*/i,
  /\bregistrazione\b[^.;!?\n]{0,60}\bpropone\s+il\s+gestionale\b/i,
  /\bgestionale\b[^.;!?\n]{0,40}\b(?:la|le|lo|li)\s+registrer/i,
];
// «Non si registra da sola» è vero, e resta. Il «non» deve stare ATTACCATO
// al verbo: «Non c'è il file: verrà registrata automaticamente» promette lo
// stesso (revisione ECC).
const NEGATA = /\bnon\s+(?:(?:si|la|le|lo|li|viene|verrà|sarà|è)\s+){0,2}(?:registr|import)\w*/i;

/** La frase promette una registrazione automatica? */
export function promettePerSe(frase) {
  const f = String(frase ?? "");
  return PROMESSA.some((r) => r.test(f)) && !NEGATA.test(f);
}

/** Il testo senza le frasi che promettono una registrazione automatica. */
export function senzaPromesse(testo) {
  // Un punto chiude la frase solo se dopo c'è uno spazio o la fine, e non
  // dopo «n.»/«nr.»: «n. 1992/2026» e «235.00» restano nella loro frase.
  const frasi =
    String(testo ?? "").match(/(?:\b(?:n|nr)\.\s*|\.(?=\S)|[^.;!?\n])+[.;!?]*\s*|[.;!?]+\s*|\n+/gi) ?? [];
  return frasi
    .filter((f) => !promettePerSe(f))
    .join("")
    .trim();
}

/**
 * Corregge le proposte DEL MODELLO quando nella mail non c'è una fattura
 * leggibile (nessun XML/p7m che si apra come fattura elettronica).
 *
 * 1. Avviso di Aruba di una fattura ricevuta → le proposte del modello si
 *    buttano (tranne l'archiviazione di un allegato vero) e resta la cosa da
 *    fare costruita qui (`propostaFatturaDaScaricare`), con i dati
 *    dell'avviso; quelli che non ci sono si prendono dal modello
 *    (`suggeriti`), se li ha letti.
 * 2. Qualunque altra mail CHE PARLA DI FATTURE → le frasi che promettono una registrazione
 *    automatica si tolgono; un «nessuna» che la prometteva diventa un «da
 *    fare a mano» che dice di controllare, così la mail non finisce fra le
 *    «Niente da fare» con una bugia sopra.
 *
 * Con una fattura letta (`fattureLette` > 0) non si tocca niente: la
 * proposta la costruisce già il codice dal file, e una frase del modello
 * sulla registrazione è vera.
 *
 * @param {{
 *   mittente?: string|null, oggetto?: string|null, testo?: string|null,
 *   azioni?: Array<Record<string, any>>, sintesi?: unknown,
 *   fattureLette?: number,
 *   suggeriti?: {fornitore?: unknown, numero?: unknown, data?: unknown, importo?: unknown},
 * }} entrata
 * @returns {{azioni: Array<Record<string, any>>, sintesi: string|null, avvisoAruba: Record<string, any>|null}}
 */
export function correggiSenzaFattura({
  mittente = null,
  oggetto = null,
  testo = null,
  azioni = [],
  sintesi = null,
  fattureLette = 0,
  suggeriti = {},
} = {}) {
  const sint = typeof sintesi === "string" ? sintesi : null;
  if (fattureLette > 0) return { azioni, sintesi: sint, avvisoAruba: null };

  if (eAvvisoArubaFattura({ mittente, oggetto })) {
    const letti = datiAvvisoAruba(testo);
    const s = suggeriti ?? {};
    const proposta = propostaFatturaDaScaricare({
      fornitore: letti.fornitore ?? nomeDa(s.fornitore),
      numero: letti.numero ?? numeroDa(s.numero),
      data: letti.data ?? dataIso(s.data),
      importo: letti.importo ?? importoDa(s.importo),
    });
    const p = proposta.parametri;
    const quale = `Fattura${p.numero ? ` n. ${p.numero}` : ""}${p.fornitore ? ` di ${p.fornitore}` : ""}`;
    // Un allegato vero accanto all'avviso (un PDF di cortesia) si archivia lo
    // stesso; tutto il resto del modello si butta (revisione ECC).
    const daTenere = (azioni ?? []).filter((a) => a?.tipo === "archivia_documento" && a?.parametri?.allegato_id);
    return {
      azioni: [proposta, ...daTenere],
      sintesi: `${quale}: avviso di Aruba senza il file, da scaricare e caricare a mano.`.slice(0, 300),
      avvisoAruba: proposta,
    };
  }

  // ⚠️ Solo se si parla di FATTURE: «il movimento verrà registrato
  //    automaticamente in prima nota» su un avviso della banca è vero, e la
  //    mail deve restare com'è (revisione ECC del 13/11).
  const testi = [oggetto, sint, ...(azioni ?? []).flatMap((a) => [a?.titolo, a?.descrizione, a?.perche])];
  if (!testi.some((t) => /fattur/i.test(String(t ?? "")))) return { azioni, sintesi: sint, avvisoAruba: null };

  const corrette = [];
  for (const a of azioni ?? []) {
    const promette = [a?.titolo, a?.descrizione, a?.perche].some(promettePerSe);
    if (!promette) {
      corrette.push(a);
      continue;
    }
    if (a?.tipo === "nessuna") {
      const titolo = "Controlla se c'è una fattura da caricare";
      corrette.push({
        ...a,
        tipo: "da_fare_a_mano",
        titolo,
        descrizione:
          "In questa mail non c'è il file di una fattura elettronica, quindi il gestionale non registra niente da solo. " +
          "Se c'è una fattura, scarica l'XML e caricalo in Fatture Fornitori → «Carica una fattura elettronica».",
        perche: senzaPromesse(a?.perche) || null,
        parametri: {
          ...(a?.parametri ?? {}),
          titolo,
          passi: ["Se è una fattura, scarica l'XML e caricalo in Fatture Fornitori"],
        },
      });
      continue;
    }
    corrette.push({
      ...a,
      titolo: senzaPromesse(a?.titolo) || "Da controllare",
      descrizione: senzaPromesse(a?.descrizione) || senzaPromesse(a?.titolo) || null,
      perche: senzaPromesse(a?.perche) || null,
    });
  }
  return {
    azioni: corrette,
    sintesi: sint == null ? null : senzaPromesse(sint) || "Nessun file di fattura allegato.",
    avvisoAruba: null,
  };
}
