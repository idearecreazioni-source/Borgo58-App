// IL TESTO CHE ARRIVA DAL GESTIONALE DIVENTA SOLO TESTO — 28/10/2026.
//
// `lavori_stampa.contenuto` porta righe di testo, mai comandi. Ma una riga
// con dentro un byte di controllo (ESC, GS) su una stampante ESC/POS
// diventa un comando — taglio, cassetto, cambio di carattere — e una riga
// con `<` dentro un documento XML ne cambia la forma. Quindi ogni riga
// passa da qui prima di entrare in un protocollo, qualunque cosa ci sia
// scritto.

/**
 * Ogni carattere di controllo (C0, DEL e C1) diventa `sostituto`.
 * ⚠️ Per codice e non con un'espressione regolare: quelle con dentro i
 *    caratteri di controllo il controllo del codice le segnala, e il
 *    progetto non ammette avvisi.
 */
export function senzaControlli(testo, sostituto = " ") {
  let fuori = "";
  for (const c of String(testo ?? "")) {
    const n = c.codePointAt(0);
    fuori += n < 0x20 || (n >= 0x7f && n <= 0x9f) ? sostituto : c;
  }
  return fuori;
}

/** Toglie i caratteri di controllo e taglia la riga alla larghezza data. */
export function rigaPulita(testo, larghezza = 42) {
  return senzaControlli(testo).slice(0, larghezza);
}

// ⚠️ Le stampanti termiche, così come escono dalla scatola, non sanno le
//    lettere accentate (pagina di codici 437): un «è» diventerebbe un segno
//    a caso. Per il foglio di prova basta l'apostrofo, che si legge.
const ACCENTI = { à: "a'", è: "e'", é: "e'", ì: "i'", ò: "o'", ù: "u'", À: "A'", È: "E'", É: "E'", Ì: "I'", Ò: "O'", Ù: "U'" };

/** Solo caratteri che una stampante di base sa stampare. */
export function soloAscii(testo) {
  // NFC prima: una «è» scritta come «e» più accento diventa una lettera sola.
  return String(testo ?? "")
    .normalize("NFC")
    .replace(/[àèéìòùÀÈÉÌÒÙ]/g, (c) => ACCENTI[c])
    .replace(/[«»“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—·]/g, "-")
    // «1° turno» sulla carta: «1o turno», come si scrive a mano.
    .replace(/[°º]/g, "o")
    .replace(/×/g, "x")
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

// IL FOGLIO DI UNA COMANDA — 29/10/2026.
//
// 🔴 DICE LE STESSE COSE DELLA PAGINA CUCINA (src/pages/comande/Cucina.jsx):
//    il reparto e il tavolo, l'ora, per ogni turno la sua riga di stacco,
//    «2 x nome», poi SENZA e le frasi delle sostituzioni PRIMA della nota,
//    e la nota del tavolo in fondo. Il contenuto lo compone il database
//    (`componi_comanda`); qui si decide solo come sta sulla carta.
// ⚠️ Ogni riga ha uno STILE e non dei comandi: ogni lingua (ESC/POS,
//    ePOS) traduce lo stile a modo suo, e il testo resta testo.

export const STILI = {
  titolo: { centrato: true, grassetto: true, doppiaAltezza: true, doppiaLarghezza: true },
  ora: { centrato: true },
  turno: { centrato: true, grassetto: true, doppiaAltezza: true },
  piatto: { doppiaAltezza: true },
  senza: { grassetto: true, doppiaAltezza: true, rientro: 3 },
  frase: { rientro: 3 },
  nota: { rientro: 3 },
  chiamata: { centrato: true, grassetto: true, doppiaAltezza: true, doppiaLarghezza: true },
  normale: {},
};

const MAX_RIGHE_COMANDA = 400;

const etichettaTurno = (n) => `${Number(n) || 1}° turno`;

/** Le righe della comanda, ognuna con il suo stile, senza ancora andare a capo. */
export function righeDellaComanda(c = {}) {
  const fuori = [];
  const metti = (stile, testo) => {
    const t = senzaControlli(testo).trim();
    if (t) fuori.push({ stile, testo: t });
  };
  const reparto = c.reparto === "bar" ? "BAR" : "CUCINA";
  if (c.chiamata) {
    metti("titolo", c.tavolo ?? "-");
    metti("ora", c.ora);
    metti("chiamata", "AVANTI COL PROSSIMO TURNO");
    return fuori;
  }
  metti("titolo", `${reparto} — ${c.tavolo ?? "-"}`);
  metti("ora", c.ora);
  const turni = Array.isArray(c.turni) ? c.turni : [];
  for (const t of turni) {
    // Al bar i turni non si stampano: si prepara il giro, non il pasto.
    if (c.reparto !== "bar") metti("turno", `${etichettaTurno(t.turno)}${c.aggiunta ? " · AGGIUNTA" : ""}`);
    for (const r of Array.isArray(t.righe) ? t.righe : []) {
      metti("piatto", `${Number(r.quantita) || 1} x ${r.nome ?? ""}`);
      const senza = Array.isArray(r.senza) ? r.senza : [];
      if (senza.length > 0) {
        metti("senza", `SENZA ${senza.map((a) => String(a).toUpperCase()).join(", ")}`);
        for (const f of Array.isArray(r.frasi) ? r.frasi : []) metti("frase", f);
      }
      if (r.nota) metti("nota", `> ${r.nota}`);
    }
  }
  if (c.nota_tavolo) metti("normale", `Nota tavolo: ${c.nota_tavolo}`);
  // ⚠️ Un foglio troppo lungo si taglia, ma LO DICE (revisione, 29/10): in
  //    fondo ci sono gli ultimi turni e la nota del tavolo, e una riga
  //    SENZA persa senza avviso è il caso peggiore.
  if (fuori.length > MAX_RIGHE_COMANDA) {
    return [...fuori.slice(0, MAX_RIGHE_COMANDA - 1), { stile: "senza", testo: "FOGLIO TAGLIATO: GUARDA LA COMANDA A SCHERMO" }];
  }
  return fuori;
}

/** Va a capo fra le parole; una parola più lunga della riga si spezza. */
export function aCapo(testo, larghezza) {
  const righe = [];
  let riga = "";
  for (const parola of String(testo ?? "").split(/\s+/).filter(Boolean)) {
    let p = parola;
    while (p.length > larghezza) {
      if (riga) righe.push(riga);
      righe.push(p.slice(0, larghezza));
      p = p.slice(larghezza);
      riga = "";
    }
    if (!riga) riga = p;
    else if (riga.length + 1 + p.length <= larghezza) riga += ` ${p}`;
    else {
      righe.push(riga);
      riga = p;
    }
  }
  if (riga) righe.push(riga);
  return righe;
}

/** Le righe già andate a capo per una carta di `larghezza` caratteri. */
export function righeImpaginate(contenuto, larghezza = 42) {
  const fuori = [];
  for (const { stile, testo } of righeDellaComanda(contenuto)) {
    const s = STILI[stile] ?? STILI.normale;
    const rientro = s.rientro ?? 0;
    const spazio = Math.floor((larghezza - rientro) / (s.doppiaLarghezza ? 2 : 1));
    for (const r of aCapo(soloAscii(testo), spazio)) fuori.push({ stile, testo: " ".repeat(Math.floor(rientro / (s.doppiaLarghezza ? 2 : 1))) + r });
  }
  return fuori;
}
