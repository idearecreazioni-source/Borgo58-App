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

import { leggiXml, xmlDaFile } from "./fatturaPA.js";

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

// --- la busta: mittente e oggetto -------------------------------------------

/**
 * Il testo è quello della busta di una PEC? Aruba lo apre con una riga
 * fissa, in italiano e poi in inglese.
 */
export function eBustaPec(testo) {
  return /--\s*(Messaggio di posta certificata|Certified mail message)\s*--/i.test(String(testo ?? ""));
}

/** Chi firma le buste e le ricevute di Aruba: solo da lì una busta si crede. */
const GESTORE_PEC = /^\s*posta-certificata@/i;

/** È il mittente tecnico che incarta le PEC (vuoto = non lo si sa, si guarda solo il testo). */
function daGestorePec(mittenteBusta) {
  return mittenteBusta == null || GESTORE_PEC.test(String(mittenteBusta));
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
  if (!GESTORE_PEC.test(String(mittenteBusta ?? ""))) return false;
  return /^\s*(ACCETTAZIONE|AVVENUTA CONSEGNA|CONSEGNA|PRESA IN CARICO)\s*:/i.test(String(oggetto ?? ""));
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
