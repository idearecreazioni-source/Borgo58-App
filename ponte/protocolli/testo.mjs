// IL TESTO CHE ARRIVA DAL GESTIONALE DIVENTA SOLO TESTO — 28/10/2026.
//
// `lavori_stampa.contenuto` porta righe di testo, mai comandi. Ma una riga
// con dentro un byte di controllo (ESC, GS) su una stampante ESC/POS
// diventa un comando — taglio, cassetto, cambio di carattere — e una riga
// con `<` dentro un documento XML ne cambia la forma. Quindi ogni riga
// passa da qui prima di entrare in un protocollo, qualunque cosa ci sia
// scritto.

/** Toglie i caratteri di controllo e taglia la riga alla larghezza data. */
export function rigaPulita(testo, larghezza = 42) {
  return String(testo ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .slice(0, larghezza);
}

// ⚠️ Le stampanti termiche, così come escono dalla scatola, non sanno le
//    lettere accentate (pagina di codici 437): un «è» diventerebbe un segno
//    a caso. Per il foglio di prova basta l'apostrofo, che si legge.
const ACCENTI = { à: "a'", è: "e'", é: "e'", ì: "i'", ò: "o'", ù: "u'", À: "A'", È: "E'", É: "E'", Ì: "I'", Ò: "O'", Ù: "U'" };

/** Solo caratteri che una stampante di base sa stampare. */
export function soloAscii(testo) {
  return String(testo ?? "")
    .replace(/[àèéìòùÀÈÉÌÒÙ]/g, (c) => ACCENTI[c])
    .replace(/[«»“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?");
}

/** Per i protocolli XML: niente che cambi la forma del documento. */
export function perXml(testo) {
  return String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Le righe di un lavoro, pulite: il titolo e poi le righe. */
export function righeDelLavoro(contenuto, larghezza = 42) {
  const righe = Array.isArray(contenuto?.righe) ? contenuto.righe.slice(0, 30) : [];
  return [contenuto?.titolo, ...righe]
    .filter((r) => r != null && r !== "")
    .map((r) => rigaPulita(r, larghezza));
}
