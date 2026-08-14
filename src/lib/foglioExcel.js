// Leggere un foglio Excel senza librerie e senza mandarlo da nessuna
// parte — MODULO PURO, nessun import.
//
// PERCHÉ ESISTE (14/08/2026, Blocco 3 «la rotta economica»). Il modello
// finanziario di Alessio **non entra nel repository**, che è pubblico:
// vincolo posto da lui accogliendo il rilievo del validatore. Il foglio
// resta sul suo computer, lo apre dalla schermata di importazione, e i
// numeri finiscono solo nel database. Nessun file caricato altrove,
// nessuna copia in `docs/`, nessun valore incollato in una migrazione.
//
// PERCHÉ NON UNA LIBRERIA. Aggiungere un lettore di fogli di calcolo
// (SheetJS e simili) al bundle per un gesto che si fa una volta l'anno
// costa più di quanto valga, e un .xlsx è un archivio ZIP con dentro due
// file XML: qui servono solo quelli. Il browser sa già decomprimere
// (`DecompressionStream`), quindi il codice da scrivere è la lettura
// dell'indice dell'archivio, non la decompressione.
//
// ⚠️ COSA NON FA, ed è voluto: non valuta le formule. Excel salva
// accanto a ogni formula **l'ultimo valore calcolato**, ed è quello che
// si legge. Conseguenza da conoscere: un foglio salvato con i calcoli
// disattivati porterebbe dentro valori vecchi. Chi importa vede sempre a
// schermo cosa è stato letto, prima di confermare.

const FIRMA_INDICE = 0x02014b50; // voce dell'indice centrale dello ZIP
const FIRMA_CODA = 0x06054b50; // coda dell'archivio (End Of Central Directory)

// Il browser di Alessio è Chrome aggiornato, ma un metodo che non c'è
// deve dire cosa manca invece di fallire con "undefined non è una
// funzione" — che manderebbe a cercare un difetto dove non c'è.
export function decompressioneDisponibile() {
  return typeof DecompressionStream === "function";
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Estrae dall'archivio i soli file richiesti, come testo.
async function estrai(arrayBuffer, nomiVoluti) {
  const buf = new Uint8Array(arrayBuffer);
  const vista = new DataView(arrayBuffer);
  const testo = new TextDecoder("utf-8");

  // La coda dell'archivio sta in fondo, dopo un commento di lunghezza
  // variabile: si cerca all'indietro, come vuole il formato.
  let coda = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (vista.getUint32(i, true) === FIRMA_CODA) {
      coda = i;
      break;
    }
  }
  if (coda < 0) throw new Error("Non sembra un file Excel: manca la struttura dell'archivio.");

  const quante = vista.getUint16(coda + 10, true);
  let p = vista.getUint32(coda + 16, true);
  const trovati = new Map();

  for (let i = 0; i < quante; i++) {
    if (vista.getUint32(p, true) !== FIRMA_INDICE) break;
    const metodo = vista.getUint16(p + 10, true);
    const compressa = vista.getUint32(p + 20, true);
    const lunNome = vista.getUint16(p + 28, true);
    const lunExtra = vista.getUint16(p + 30, true);
    const lunCommento = vista.getUint16(p + 32, true);
    const inizioLocale = vista.getUint32(p + 42, true);
    const nome = testo.decode(buf.subarray(p + 46, p + 46 + lunNome));

    if (nomiVoluti.includes(nome)) {
      // L'intestazione locale ripete nome ed extra con lunghezze proprie:
      // vanno rilette da lì, non dall'indice (possono differire).
      const lunNomeL = vista.getUint16(inizioLocale + 26, true);
      const lunExtraL = vista.getUint16(inizioLocale + 28, true);
      const dati = inizioLocale + 30 + lunNomeL + lunExtraL;
      const grezzi = buf.subarray(dati, dati + compressa);
      trovati.set(nome, metodo === 0 ? grezzi : await inflate(grezzi));
    }
    p += 46 + lunNome + lunExtra + lunCommento;
  }

  const fuori = {};
  for (const [nome, byte] of trovati) fuori[nome] = testo.decode(byte);
  return fuori;
}

const ENTITA = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" };
function decodifica(s) {
  // & per ultimo: invertendo, "&amp;lt;" diventerebbe "<" invece di "&lt;".
  return s
    .replace(/&(lt|gt|quot|apos);/g, (_, e) => ENTITA[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function testiCondivisi(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodifica(t[1])).join("")
  );
}

// Legge il PRIMO foglio del file e restituisce le celle per indirizzo
// ("D8" → 40). Le celle vuote non compaiono.
//
// ⚠️ Le celle vuote sono scritte auto-chiuse (`<c r="B8"/>`): un'espressione
// che pretende `</c>` le salta e assegna al loro indirizzo il contenuto
// della cella successiva — cioè legge i numeri giusti agli indirizzi
// sbagliati, senza errori. Trovato leggendo il foglio vero: la prima
// stesura di questo modulo dava «40» a una cella che ne conteneva un'altra.
// Si tolgono prima di ogni altra cosa.
export async function leggiFoglioExcel(arrayBuffer) {
  if (!decompressioneDisponibile()) {
    throw new Error(
      "Questo browser non sa aprire i file Excel da solo. Aprendo il gestionale con Chrome aggiornato funziona."
    );
  }

  const files = await estrai(arrayBuffer, [
    "xl/workbook.xml",
    "xl/sharedStrings.xml",
    "xl/worksheets/sheet1.xml",
  ]);
  const foglio = files["xl/worksheets/sheet1.xml"];
  if (!foglio) throw new Error("Non sembra un file Excel: non c'è nessun foglio dentro.");

  const nome = (files["xl/workbook.xml"] || "").match(/<sheet [^>]*name="([^"]*)"/);
  const testi = testiCondivisi(files["xl/sharedStrings.xml"]);
  const celle = new Map();

  for (const c of foglio.replace(/<c\b[^>]*\/>/g, "").matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attributi = c[2];
    const v = c[3].match(/<v>([\s\S]*?)<\/v>/);
    const inline = c[3].match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
    let valore = null;
    if (inline) valore = decodifica(inline[1]);
    else if (v && / t="s"/.test(attributi)) valore = testi[Number(v[1])] ?? null;
    else if (v && / t="(str|e)"/.test(attributi)) valore = decodifica(v[1]);
    else if (v) valore = Number(v[1]);
    if (valore !== null && valore !== "") celle.set(c[1], valore);
  }

  return { nomeFoglio: nome ? decodifica(nome[1]) : "", celle };
}

// Aiutanti per chi legge la mappa: un numero deve essere un numero, e una
// cella attesa e mancante deve dirlo invece di valere zero.
export function numeroCella(celle, indirizzo) {
  const v = celle.get(indirizzo);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function testoCella(celle, indirizzo) {
  const v = celle.get(indirizzo);
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
}
