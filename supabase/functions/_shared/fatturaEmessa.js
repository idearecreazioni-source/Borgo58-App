/**
 * Le fatture AI CLIENTI (13/11/2026): i conti e il file XML per lo SdI.
 *
 * Sta in `_shared` perché lo usano DUE posti, e devono dire la stessa cosa:
 *   - la pagina «Fatture ai clienti» (anteprima, totale in diretta, «Scarica
 *     il file di prova»), tramite `src/lib/calcoli/fattureEmesse.js`;
 *   - la funzione che spedisce dalla PEC allo SdI (pezzo 3), che il file lo
 *     rifà dai dati congelati nel database.
 * Nessuna dipendenza: gira uguale nel browser, in Node (le prove) e in Deno.
 *
 * Il formato è FatturaPA «FPR12» (fattura fra privati), schema ufficiale
 * 1.2.3 (fatturapa.gov.it, specifiche tecniche 1.9). La prova
 * `tests/unita/fattura-xml-schema.test.js` passa ogni file prodotto qui
 * dallo schema ufficiale, scaricato in `tests/dati/fatturapa/`.
 *
 * ⚠️ «SI FERMA O CONTINUA ZITTO?» — si ferma. Se manca un dato o un testo
 * ha un carattere che lo SdI rifiuta, `xmlFattura()` NON produce il file e
 * dice in italiano cosa sistemare: una fattura scartata costa un giro di
 * PEC e un giorno, uno sbagliato in pagina costa un minuto.
 */

// =====================================================================
// 1. I CONTI
// =====================================================================
//
// ⚠️ I TOTALI VERI LI CONGELA IL DATABASE, in `emetti_fattura()` con
// `totali_fattura()` (migrazioni 20261113000002-03): qui si deve dire
// ESATTAMENTE lo stesso numero. Stesse due regole, nello stesso ordine:
//   1. ogni riga si arrotonda al centesimo (quantità × prezzo);
//   2. l'IVA si calcola sul totale di ogni aliquota, non riga per riga —
//      è come la riepiloga la fattura elettronica («DatiRiepilogo»).
//
// ⚠️ I CONTI SI FANNO IN INTERI, non in virgola mobile (revisione del
//    13/11). Il database conta in decimale esatto; 1,5 × 1,15 in virgola
//    mobile fa 1,7249999…, e il centesimo andrebbe giù dove il database lo
//    manda su. Quantità in millesimi, prezzi in centesimi, aliquote in
//    centesimi di punto: ogni prodotto è un intero esatto, e si arrotonda
//    una volta sola.

/** Un numero decimale come intero scalato di `cifre` (2,675 con 2 → 268). */
function scalato(x, cifre) {
  const n = Number(x) || 0;
  return (n < 0 ? -1 : 1) * Math.round(Number(`${Math.abs(n)}e${cifre}`));
}

/** a / b arrotondato come `round()` di Postgres: la metà va lontano da zero. */
function divisoArrotondato(a, b) {
  const segno = a < 0 !== b < 0 ? -1 : 1;
  const A = Math.abs(a);
  const B = Math.abs(b);
  return segno * Math.floor((2 * A + B) / (2 * B));
}

/** Lo stesso con BigInt, per i prezzi a 8 decimali (gli interi lì superano 2^53). */
function divisoArrotondatoGrande(a, b) {
  const neg = a < 0n !== b < 0n;
  const A = a < 0n ? -a : a;
  const B = b < 0n ? -b : b;
  const q = (2n * A + B) / (2n * B);
  return neg ? -q : q;
}

/** Arrotonda al centesimo come `round(x, 2)` di Postgres (metà lontano da zero). */
export function alCentesimo(x) {
  return scalato(x, 2) / 100;
}

/** L'imponibile di una riga in centesimi: round(quantità × prezzo, 2). */
function centesimiRiga(riga) {
  const millesimi = scalato(riga?.quantita ?? 1, 3);
  const centesimi = scalato(riga?.prezzo_unitario ?? 0, 2);
  return divisoArrotondato(millesimi * centesimi, 1000);
}

/** L'imponibile di una riga: quantità × prezzo, al centesimo. */
export function imponibileRiga(riga) {
  return centesimiRiga(riga) / 100;
}

function naturaDiRiga(r) {
  return Number(r.aliquota_iva ?? 10) === 0 ? (r.natura || null) : null;
}

/**
 * Il riepilogo per aliquota e i totali di una fattura.
 * @param {{quantita?: number, prezzo_unitario: number, aliquota_iva?: number, natura?: string|null}[]} righe
 * @param {{prezziIvati?: boolean}} [opzioni] prezzi IVA inclusa (il ristorante): l'IVA si scorpora
 * @returns {{riepilogo: {aliquota: number, natura: string|null, imponibile: number, imposta: number}[],
 *            imponibile: number, imposta: number, totale: number}}
 */
export function totaliFattura(righe = [], { prezziIvati = false } = {}) {
  const gruppi = new Map();
  for (const r of righe) {
    const aliquota = Number(r.aliquota_iva ?? 10);
    const natura = naturaDiRiga(r);
    const chiave = `${aliquota}|${natura ?? ""}`;
    const g = gruppi.get(chiave) ?? { aliquota, natura, cent: 0 };
    g.cent += centesimiRiga(r);
    gruppi.set(chiave, g);
  }
  const riepilogo = [...gruppi.values()]
    .map((g) => {
      const centesimiDiPunto = scalato(g.aliquota, 2); // 10 → 1000
      if (prezziIvati) {
        // IVA INCLUSA (migrazione 20261113000003): la somma delle righe è il
        // lordo; imponibile = round(lordo × 100 / (100 + aliquota), 2), e
        // l'imposta è quello che resta — così i due tornano al lordo.
        const imponibile = divisoArrotondato(g.cent * 10000, 10000 + centesimiDiPunto);
        return { aliquota: g.aliquota, natura: g.natura, cent: imponibile, centImposta: g.cent - imponibile };
      }
      return {
        aliquota: g.aliquota,
        natura: g.natura,
        cent: g.cent,
        centImposta: divisoArrotondato(g.cent * centesimiDiPunto, 10000),
      };
    })
    .sort((a, b) => b.aliquota - a.aliquota || String(a.natura).localeCompare(String(b.natura)));
  const centImponibile = riepilogo.reduce((s, g) => s + g.cent, 0);
  const centImposta = riepilogo.reduce((s, g) => s + g.centImposta, 0);
  return {
    riepilogo: riepilogo.map((g) => ({
      aliquota: g.aliquota,
      natura: g.natura,
      imponibile: g.cent / 100,
      imposta: g.centImposta / 100,
    })),
    imponibile: centImponibile / 100,
    imposta: centImposta / 100,
    totale: (centImponibile + centImposta) / 100,
  };
}

// =====================================================================
// 2. LE CIFRE COME LE VUOLE LO SCHEMA
// =====================================================================

/** Un intero scalato di `scala` cifre come testo con almeno 2 decimali: 12345,4 → «123.45». */
function cifreScalate(intero, scala, { minimo = 2 } = {}) {
  const big = BigInt(intero);
  const neg = big < 0n;
  const abs = neg ? -big : big;
  const base = 10n ** BigInt(scala);
  let decimali = (abs % base).toString().padStart(scala, "0");
  while (decimali.length > minimo && decimali.endsWith("0")) decimali = decimali.slice(0, -1);
  return `${neg ? "-" : ""}${abs / base}.${decimali}`;
}

/** Un importo in euro con due decimali e il punto: 1234.5 → «1234.50». */
export function importoXML(euro) {
  return cifreScalate(scalato(euro, 2), 2);
}

// =====================================================================
// 3. I TESTI: SOLO LETTERE «LATINE»
// =====================================================================
//
// Lo schema ammette nei testi solo i caratteri di base e quelli accentati
// dell'Europa occidentale (Latin-1). Le virgolette «curve» che il telefono
// mette da solo, il trattino lungo, il simbolo dell'euro NON ci sono: lo
// SdI scarterebbe la fattura. Quelli comuni si sostituiscono con l'uguale
// semplice; un carattere che non ha un uguale ferma il file e si dice quale.

const SOSTITUZIONI = new Map([
  ["‘", "'"], ["’", "'"], ["‚", "'"], ["′", "'"],
  ["“", '"'], ["”", '"'], ["„", '"'], ["″", '"'],
  ["–", "-"], ["—", "-"], ["−", "-"], ["‐", "-"], ["‑", "-"],
  ["…", "..."], ["€", "EUR"], ["•", "-"], [" ", " "],
  [" ", " "], [" ", " "], ["\t", " "], ["\r", " "], ["\n", " "],
]);

/**
 * Un testo pronto per lo schema: caratteri sostituiti, spazi in fila ridotti
 * a uno, niente spazi in testa o in coda.
 * @returns {{testo: string, fuori: string[]}} `fuori`: i caratteri che non si possono scrivere
 */
export function testoLatino(valore) {
  const fuori = [];
  let testo = "";
  for (const c of String(valore ?? "").normalize("NFC")) {
    const s = SOSTITUZIONI.get(c);
    if (s !== undefined) testo += s;
    // stampabili di base (0x20-0x7E) e accentati (0xA0-0xFF); 0x7F-0x9F sono comandi, non lettere
    else if ((c.codePointAt(0) >= 0x20 && c.codePointAt(0) <= 0x7e) || (c.codePointAt(0) >= 0xa0 && c.codePointAt(0) <= 0xff)) testo += c;
    else if (!fuori.includes(c)) fuori.push(c);
  }
  return { testo: testo.replace(/ {2,}/g, " ").trim(), fuori };
}

/** Il testo pronto per stare dentro un tag: & < > " ' come entità. */
function xmlSicuro(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Un testo lungo in pezzi da `max` caratteri, tagliati sugli spazi quando si può. */
function aPezzi(testo, max) {
  const pezzi = [];
  let resto = testo;
  while (resto.length > max) {
    let taglio = resto.lastIndexOf(" ", max);
    if (taglio < max / 2) taglio = max;
    pezzi.push(resto.slice(0, taglio).trim());
    resto = resto.slice(taglio).trim();
  }
  if (resto) pezzi.push(resto);
  return pezzi;
}

// =====================================================================
// 4. IL FILE
// =====================================================================

const REGIME_FISCALE = { ordinario: "RF01", forfettario: "RF19" };

/** La soglia oltre la quale una fattura senza IVA vuole la marca da bollo (2 €). */
const SOGLIA_BOLLO_CENT = 7747;

/** Il nome del file come lo vuole lo SdI: IT + partita IVA + «_» + progressivo + «.xml». */
export function nomeFileFattura(partitaIva, progressivo) {
  return `IT${partitaIva}_${progressivo}.xml`;
}

const vuoto = (v) => v == null || String(v).trim() === "";

/** Le nature ufficiali (specifiche 1.9): il file si rifà anche da righe del database. */
const NATURE = new Set([
  "N1", "N2.1", "N2.2", "N3.1", "N3.2", "N3.3", "N3.4", "N3.5", "N3.6", "N4", "N5",
  "N6.1", "N6.2", "N6.3", "N6.4", "N6.5", "N6.6", "N6.7", "N6.8", "N6.9", "N7",
]);

/**
 * La partita IVA italiana (e il codice fiscale di 11 cifre di una ditta) ha
 * l'ultima cifra di controllo: un numero scritto con una cifra sbagliata lo
 * SdI lo scarta, e qui si vede subito.
 */
export function partitaIvaValida(p) {
  const s = String(p ?? "");
  if (!/^[0-9]{11}$/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 11; i++) {
    let d = Number(s[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somma += d;
  }
  return somma % 10 === 0;
}

const DISPARI = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** Il codice fiscale di una persona (16 caratteri) con la lettera di controllo giusta. */
export function codiceFiscaleValido(cf) {
  const s = String(cf ?? "").toUpperCase();
  if (/^[0-9]{11}$/.test(s)) return partitaIvaValida(s);
  if (!/^[A-Z0-9]{15}[A-Z]$/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const c = s[i];
    somma += i % 2 === 0 ? DISPARI[c] : /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (somma % 26)) === s[15];
}

/** Una data vera (non il 31 febbraio). */
function dataVera(s) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= "1970-01-01";
}

/**
 * Il file XML della fattura, oppure l'elenco di cosa manca per farlo.
 *
 * @param {object} p
 * @param {object} p.societa   la riga di `entities` della S.r.l.s.
 * @param {object} p.cliente   la riga di `clienti_fattura`
 * @param {object} p.fattura   la riga di `fatture_emesse` (data, numero, anno,
 *                             causale, modalita_pagamento, prezzi_ivati, totale)
 * @param {object[]} p.righe   le righe, in ordine di posizione
 * @param {string} p.progressivo  il progressivo d'invio (1-5 lettere o cifre),
 *                             DIVERSO per ogni file spedito, anche per il
 *                             rinvio di una scartata: lo SdI scarta un nome
 *                             di file già visto.
 * @param {string} [p.numero]  il numero da scrivere; di solito «N/AAAA» dalla
 *                             fattura, «BOZZA» per il file di prova
 * @returns {{xml: string|null, nomeFile: string|null, errori: string[], totali: object}}
 */
export function xmlFattura({ societa, cliente, fattura, righe, progressivo, numero }) {
  const errori = [];
  const prezziIvati = fattura?.prezzi_ivati !== false;
  const elenco = [...(righe ?? [])].sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0));
  const totali = totaliFattura(elenco, { prezziIvati });

  // ---- i testi: ognuno passa di qui, così un carattere storto si dice una volta sola
  const testo = (valore, dove, max) => {
    const { testo: t, fuori } = testoLatino(valore);
    if (fuori.length) {
      errori.push(`${dove}: il carattere «${fuori.join(" ")}» non si può mettere in fattura. Toglilo o cambialo.`);
    }
    if (max && t.length > max) {
      errori.push(`${dove}: è troppo lungo (${t.length} caratteri, al massimo ${max}).`);
    }
    return t;
  };

  // ---- la società
  const piva = String(societa?.vat_number ?? "").trim();
  if (!/^[0-9]{11}$/.test(piva)) errori.push("Dati di Borgo 58: la partita IVA sono 11 cifre (manca o è scritta male).");
  else if (!partitaIvaValida(piva)) errori.push("Dati di Borgo 58: la partita IVA non torna (l'ultima cifra di controllo è sbagliata). Ricontrollala.");
  const regime = REGIME_FISCALE[societa?.vat_regime];
  if (!regime) errori.push("Dati di Borgo 58: il regime IVA della società non è indicato (ordinario o forfettario).");
  for (const [campo, nome] of [
    ["legal_name", "la ragione sociale"],
    ["sede_indirizzo", "l'indirizzo della sede"],
    ["sede_cap", "il CAP della sede"],
    ["sede_comune", "il comune della sede"],
    ["sede_provincia", "la provincia della sede"],
  ]) {
    if (vuoto(societa?.[campo])) errori.push(`Dati di Borgo 58: manca ${nome}.`);
  }
  const cfSocieta = String(societa?.tax_code ?? "").trim();
  if (cfSocieta && !codiceFiscaleValido(cfSocieta)) {
    errori.push("Dati di Borgo 58: il codice fiscale non torna (11 cifre o 16 caratteri, con l'ultimo di controllo giusto).");
  }
  // Le forme le garantisce già il database; qui si ricontrollano perché il
  // file si fa anche fuori dalla pagina (la funzione che spedisce).
  if (!vuoto(societa?.sede_cap) && !/^[0-9]{5}$/.test(societa.sede_cap)) errori.push("Dati di Borgo 58: il CAP sono 5 cifre.");
  if (!vuoto(societa?.sede_provincia) && !/^[A-Z]{2}$/.test(societa.sede_provincia)) {
    errori.push("Dati di Borgo 58: la provincia è la sigla di due lettere maiuscole.");
  }
  if (!/^[A-Z]{2}$/.test(societa?.sede_nazione || "IT")) errori.push("Dati di Borgo 58: la nazione è la sigla di due lettere.");
  if (!vuoto(societa?.rea_ufficio) && !/^[A-Z]{2}$/.test(societa.rea_ufficio)) {
    errori.push("Dati di Borgo 58: l'ufficio del REA è la sigla di due lettere maiuscole.");
  }
  if (!vuoto(societa?.socio_unico) && !["SU", "SM"].includes(societa.socio_unico)) {
    errori.push("Dati di Borgo 58: socio unico si indica con SU o SM.");
  }
  const conRea = !vuoto(societa?.rea_ufficio) || !vuoto(societa?.rea_numero);
  if (conRea && (vuoto(societa?.rea_ufficio) || vuoto(societa?.rea_numero))) {
    errori.push("Dati di Borgo 58: del REA servono tutti e due, l'ufficio (la sigla della provincia) e il numero.");
  }
  const modalita = fattura?.modalita_pagamento || "MP05";
  const iban = String(societa?.iban ?? "").replace(/\s+/g, "").toUpperCase();
  if (modalita === "MP05" && !iban) {
    errori.push("Per il pagamento con bonifico serve l'IBAN di Borgo 58 (nei dati della società).");
  } else if (modalita === "MP05" && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    errori.push("Dati di Borgo 58: l'IBAN non è scritto bene (tutto attaccato, comincia con IT e due cifre).");
  }

  // ---- il cliente
  if (!cliente) errori.push("Manca il cliente.");
  const nazioneCliente = String(cliente?.nazione || "IT").toUpperCase();
  const pivaCliente = String(cliente?.partita_iva ?? "").trim();
  const cfCliente = String(cliente?.codice_fiscale ?? "").trim().toUpperCase();
  if (cliente && !pivaCliente && !cfCliente) errori.push("Cliente: serve la partita IVA oppure il codice fiscale.");
  if (cliente && nazioneCliente !== "IT") {
    // Chi sta all'estero ha regole sue (codice XXXXXXX, niente CAP italiano,
    // a volte niente IVA): finché non serve davvero, non si improvvisa.
    errori.push("Cliente: per ora le fatture si fanno solo a clienti italiani. Per un cliente estero chiedi a Laura.");
  }
  if (cliente && pivaCliente && !partitaIvaValida(pivaCliente)) {
    errori.push("Cliente: la partita IVA non torna (11 cifre, l'ultima di controllo). Ricontrollala con il cliente.");
  }
  if (cliente && cfCliente && !codiceFiscaleValido(cfCliente)) {
    errori.push("Cliente: il codice fiscale non torna (l'ultimo carattere di controllo è sbagliato). Ricontrollalo con il cliente.");
  }
  if (cliente && !/^[0-9]{5}$/.test(String(cliente.cap ?? ""))) errori.push("Cliente: il CAP sono 5 cifre.");
  if (cliente && !vuoto(cliente.provincia) && !/^[A-Z]{2}$/.test(cliente.provincia)) {
    errori.push("Cliente: la provincia è la sigla di due lettere maiuscole.");
  }
  if (cliente) {
    for (const [campo, nome] of [["indirizzo", "l'indirizzo"], ["comune", "il comune"]]) {
      if (vuoto(cliente[campo])) errori.push(`Cliente: manca ${nome}.`);
    }
    if (vuoto(cliente.denominazione) && (vuoto(cliente.nome) || vuoto(cliente.cognome))) {
      errori.push("Cliente: serve la ragione sociale, oppure nome e cognome.");
    }
  }
  const codiceDestinatario = String(cliente?.codice_destinatario ?? "").trim().toUpperCase() || "0000000";
  if (!/^[A-Z0-9]{7}$/.test(codiceDestinatario)) errori.push("Cliente: il codice destinatario sono 7 lettere o cifre.");
  const pecCliente = String(cliente?.pec ?? "").trim();
  if (pecCliente && !/^[^@\s<>&"']+@[^@\s<>&"']+\.[A-Za-z]{2,}$/.test(pecCliente)) {
    errori.push("Cliente: la PEC non sembra un indirizzo email.");
  }

  // ---- la fattura
  const data = String(fattura?.data ?? "");
  if (!data) errori.push("Manca la data della fattura.");
  else if (!dataVera(data)) errori.push("La data della fattura non è una data vera.");
  const numeroScritto = numero ?? (fattura?.numero ? `${fattura.numero}/${fattura.anno}` : null);
  if (!numeroScritto) errori.push("La fattura non ha ancora un numero.");
  else if (!/^[\x20-\x7e]{1,20}$/.test(numeroScritto)) errori.push("Il numero della fattura non si può scrivere così.");
  if (!/^[A-Za-z0-9]{1,5}$/.test(String(progressivo ?? ""))) {
    errori.push("Il progressivo d'invio sono da 1 a 5 lettere o cifre.");
  }
  if (!elenco.length) errori.push("La fattura non ha righe.");
  if (elenco.length > 9999) errori.push("La fattura ha troppe righe (al massimo 9999).");
  if (!["MP01", "MP02", "MP05", "MP08"].includes(modalita)) errori.push("Il modo di pagamento non è fra quelli previsti.");

  // Fermarsi PRIMA di scrivere, se i dati di base non ci sono: i testi sotto
  // darebbero solo errori in più sullo stesso dato mancante.
  if (errori.length) return { xml: null, nomeFile: null, errori, totali };

  // Il totale che il database ha congelato all'emissione deve tornare con
  // le righe: se non torna, qualcosa ha cambiato una riga dopo l'uscita.
  if (fattura?.totale != null && scalato(fattura.totale, 2) !== scalato(totali.totale, 2)) {
    errori.push(
      `Il totale salvato (${importoXML(fattura.totale)}) non torna con le righe (${importoXML(totali.totale)}). Non si spedisce: chiama l'assistenza.`
    );
  }

  // La marca da bollo: righe senza IVA (escluse le esportazioni) oltre 77,47 €.
  const centSenzaIva = elenco
    .filter((r) => naturaDiRiga(r) && naturaDiRiga(r) !== "N3.1")
    .reduce((s, r) => s + centesimiRiga(r), 0);
  if (centSenzaIva > SOGLIA_BOLLO_CENT) {
    errori.push("Le righe senza IVA superano 77,47 €: la fattura vuole la marca da bollo da 2 €. Chiedi a Laura prima di farla.");
  }

  // ---- le righe
  const linee = [];
  const aliquotaDi = new Map(); // chiave riepilogo → somma dei PrezzoTotale a 8 decimali
  elenco.forEach((r, i) => {
    const aliquota = Number(r.aliquota_iva ?? 10);
    const natura = naturaDiRiga(r);
    const millesimi = scalato(r.quantita ?? 1, 3);
    const cent = scalato(r.prezzo_unitario ?? 0, 2);
    if (millesimi <= 0) errori.push(`Riga ${i + 1}: la quantità deve essere più di zero.`);
    if (cent < 0) errori.push(`Riga ${i + 1}: il prezzo non può essere negativo.`);
    if (aliquota === 0 && !natura) errori.push(`Riga ${i + 1}: con IVA a 0 serve il motivo (la natura).`);
    const descr = testo(r.descrizione, `Riga ${i + 1}`, 1000);
    if (!descr) errori.push(`Riga ${i + 1}: manca la descrizione.`);

    // Prezzo unitario SENZA IVA, a 8 decimali. Con l'IVA inclusa si scorpora
    // dal prezzo: 27,50 al 10% → 25.00000000; 24,40 al 22% → 20.00000000.
    // ⚠️ Si parte dal totale della riga GIÀ al centesimo, come il database
    //    (revisione del 13/11): 1,5 × 0,33 è 0,50 sul conto, e la riga del
    //    file deve dire 0,50 meno l'IVA — non 0,495 meno l'IVA. Così in
    //    «Arrotondamento» resta solo la frazione dello scorporo, mai un
    //    tappabuchi; il prezzo unitario si ricava dal totale.
    const cp = BigInt(scalato(aliquota, 2)); // centesimi di punto
    const centRiga = BigInt(centesimiRiga(r));
    const pt8 = prezziIvati
      ? divisoArrotondatoGrande(centRiga * 1000000n * 10000n, 10000n + cp)
      : centRiga * 1000000n;
    const pu8 = prezziIvati
      ? millesimi > 0
        ? divisoArrotondatoGrande(pt8 * 1000n, BigInt(millesimi))
        : 0n
      : BigInt(cent) * 1000000n;
    if (natura && !NATURE.has(natura)) errori.push(`Riga ${i + 1}: il motivo senza IVA «${natura}» non è fra quelli ufficiali.`);
    const chiave = `${aliquota}|${natura ?? ""}`;
    aliquotaDi.set(chiave, (aliquotaDi.get(chiave) ?? 0n) + pt8);

    linee.push(
      "<DettaglioLinee>" +
        `<NumeroLinea>${i + 1}</NumeroLinea>` +
        `<Descrizione>${xmlSicuro(descr)}</Descrizione>` +
        `<Quantita>${cifreScalate(millesimi, 3)}</Quantita>` +
        `<PrezzoUnitario>${cifreScalate(pu8, 8)}</PrezzoUnitario>` +
        `<PrezzoTotale>${cifreScalate(pt8, 8)}</PrezzoTotale>` +
        `<AliquotaIVA>${cifreScalate(scalato(aliquota, 2), 2)}</AliquotaIVA>` +
        (natura ? `<Natura>${natura}</Natura>` : "") +
        "</DettaglioLinee>"
    );
  });

  // ---- il riepilogo per aliquota: imponibile e imposta sono QUELLI del
  // database (totaliFattura); la differenza con la somma delle righe a 8
  // decimali — frazioni di centesimo dello scorporo — va in «Arrotondamento»,
  // come prevede lo schema, così i conti dello SdI tornano al centesimo.
  const riepiloghi = totali.riepilogo.map((g) => {
    const chiave = `${g.aliquota}|${g.natura ?? ""}`;
    const somma8 = aliquotaDi.get(chiave) ?? 0n;
    const imponibile8 = BigInt(scalato(g.imponibile, 2)) * 1000000n;
    const arrotondamento = imponibile8 - somma8;
    return (
      "<DatiRiepilogo>" +
      `<AliquotaIVA>${cifreScalate(scalato(g.aliquota, 2), 2)}</AliquotaIVA>` +
      (g.natura ? `<Natura>${g.natura}</Natura>` : "") +
      (arrotondamento !== 0n ? `<Arrotondamento>${cifreScalate(arrotondamento, 8)}</Arrotondamento>` : "") +
      `<ImponibileImporto>${importoXML(g.imponibile)}</ImponibileImporto>` +
      `<Imposta>${importoXML(g.imposta)}</Imposta>` +
      (g.natura ? "" : "<EsigibilitaIVA>I</EsigibilitaIVA>") +
      "</DatiRiepilogo>"
    );
  });

  // ---- i testi della società e del cliente
  const denominazione = testo(societa.legal_name, "Ragione sociale di Borgo 58", 80);
  const sede = {
    indirizzo: testo(societa.sede_indirizzo, "Indirizzo della sede", 60),
    comune: testo(societa.sede_comune, "Comune della sede", 60),
  };
  const nomeC = cliente.denominazione
    ? { denominazione: testo(cliente.denominazione, "Ragione sociale del cliente", 80) }
    : {
        nome: testo(cliente.nome, "Nome del cliente", 60),
        cognome: testo(cliente.cognome, "Cognome del cliente", 60),
      };
  const sedeC = {
    indirizzo: testo(cliente.indirizzo, "Indirizzo del cliente", 60),
    comune: testo(cliente.comune, "Comune del cliente", 60),
  };
  const causali = fattura.causale ? aPezzi(testo(fattura.causale, "Causale"), 200) : [];

  if (errori.length) return { xml: null, nomeFile: null, errori, totali };

  const rea = conRea
    ? "<IscrizioneREA>" +
      `<Ufficio>${societa.rea_ufficio}</Ufficio>` +
      `<NumeroREA>${xmlSicuro(String(societa.rea_numero).trim())}</NumeroREA>` +
      (societa.capitale_sociale != null ? `<CapitaleSociale>${importoXML(societa.capitale_sociale)}</CapitaleSociale>` : "") +
      (societa.socio_unico ? `<SocioUnico>${societa.socio_unico}</SocioUnico>` : "") +
      "<StatoLiquidazione>LN</StatoLiquidazione>" +
      "</IscrizioneREA>"
    : "";

  const anagraficaC = nomeC.denominazione
    ? `<Denominazione>${xmlSicuro(nomeC.denominazione)}</Denominazione>`
    : `<Nome>${xmlSicuro(nomeC.nome)}</Nome><Cognome>${xmlSicuro(nomeC.cognome)}</Cognome>`;

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<p:FatturaElettronica versione="FPR12"' +
    ' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"' +
    ' xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"' +
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<FatturaElettronicaHeader>" +
    "<DatiTrasmissione>" +
    `<IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${piva}</IdCodice></IdTrasmittente>` +
    `<ProgressivoInvio>${progressivo}</ProgressivoInvio>` +
    "<FormatoTrasmissione>FPR12</FormatoTrasmissione>" +
    `<CodiceDestinatario>${codiceDestinatario}</CodiceDestinatario>` +
    (codiceDestinatario === "0000000" && pecCliente
      ? `<PECDestinatario>${xmlSicuro(pecCliente)}</PECDestinatario>`
      : "") +
    "</DatiTrasmissione>" +
    "<CedentePrestatore>" +
    "<DatiAnagrafici>" +
    `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${piva}</IdCodice></IdFiscaleIVA>` +
    (cfSocieta ? `<CodiceFiscale>${cfSocieta}</CodiceFiscale>` : "") +
    `<Anagrafica><Denominazione>${xmlSicuro(denominazione)}</Denominazione></Anagrafica>` +
    `<RegimeFiscale>${regime}</RegimeFiscale>` +
    "</DatiAnagrafici>" +
    "<Sede>" +
    `<Indirizzo>${xmlSicuro(sede.indirizzo)}</Indirizzo>` +
    `<CAP>${societa.sede_cap}</CAP>` +
    `<Comune>${xmlSicuro(sede.comune)}</Comune>` +
    `<Provincia>${societa.sede_provincia}</Provincia>` +
    `<Nazione>${societa.sede_nazione || "IT"}</Nazione>` +
    "</Sede>" +
    rea +
    "</CedentePrestatore>" +
    "<CessionarioCommittente>" +
    "<DatiAnagrafici>" +
    (pivaCliente ? `<IdFiscaleIVA><IdPaese>${nazioneCliente}</IdPaese><IdCodice>${xmlSicuro(pivaCliente)}</IdCodice></IdFiscaleIVA>` : "") +
    (cfCliente ? `<CodiceFiscale>${cfCliente}</CodiceFiscale>` : "") +
    `<Anagrafica>${anagraficaC}</Anagrafica>` +
    "</DatiAnagrafici>" +
    "<Sede>" +
    `<Indirizzo>${xmlSicuro(sedeC.indirizzo)}</Indirizzo>` +
    `<CAP>${cliente.cap}</CAP>` +
    `<Comune>${xmlSicuro(sedeC.comune)}</Comune>` +
    (cliente.provincia ? `<Provincia>${cliente.provincia}</Provincia>` : "") +
    `<Nazione>${nazioneCliente}</Nazione>` +
    "</Sede>" +
    "</CessionarioCommittente>" +
    "</FatturaElettronicaHeader>" +
    "<FatturaElettronicaBody>" +
    "<DatiGenerali>" +
    "<DatiGeneraliDocumento>" +
    "<TipoDocumento>TD01</TipoDocumento>" +
    "<Divisa>EUR</Divisa>" +
    `<Data>${data}</Data>` +
    `<Numero>${xmlSicuro(numeroScritto)}</Numero>` +
    `<ImportoTotaleDocumento>${importoXML(totali.totale)}</ImportoTotaleDocumento>` +
    causali.map((c) => `<Causale>${xmlSicuro(c)}</Causale>`).join("") +
    "</DatiGeneraliDocumento>" +
    "</DatiGenerali>" +
    "<DatiBeniServizi>" +
    linee.join("") +
    riepiloghi.join("") +
    "</DatiBeniServizi>" +
    "<DatiPagamento>" +
    "<CondizioniPagamento>TP02</CondizioniPagamento>" +
    "<DettaglioPagamento>" +
    `<ModalitaPagamento>${modalita}</ModalitaPagamento>` +
    `<ImportoPagamento>${importoXML(totali.totale)}</ImportoPagamento>` +
    (modalita === "MP05" ? `<IBAN>${iban}</IBAN>` : "") +
    "</DettaglioPagamento>" +
    "</DatiPagamento>" +
    "</FatturaElettronicaBody>" +
    "</p:FatturaElettronica>\n";

  return { xml, nomeFile: nomeFileFattura(piva, progressivo), errori: [], totali };
}
