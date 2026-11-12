// IL PIANO DELL'INVESTIMENTO — 07/11/2026.
//
// 🔴 A CHE DOMANDA RISPONDE: *sto sforando il budget?* Il previsto sta
//    nelle tabelle `piano_*` (migrazione 20261107000001); lo speso resta
//    quello del «Costo del progetto» (`investimento.js`), collegato a mano
//    voce per voce. Qui stanno solo le regole: il ✓, il netto, in che mese
//    cade una rata, l'esito di una voce e i totali. Niente rete.
//
// ⚠️ TUTTO IN CENTESIMI dentro i calcoli: 0,1 + 0,2 in virgola mobile non
//    fa 0,3, e un ✓ che dice ✗ per un centesimo inventato è peggio di
//    nessun ✓.

export const GRUPPI = [
  { codice: "A", nome: "Attrezzature cucina" },
  { codice: "B", nome: "Impianti" },
  { codice: "C", nome: "Lavori edili e adeguamenti" },
  { codice: "D", nome: "Arredi e allestimento" },
  { codice: "E", nome: "Avvio attività e spese tecniche" },
];

export const STATI = ["stimato", "preventivato", "confermato"];
export const DILAZIONI = ["nessuna", "stimata", "confermata"];
export const ALIQUOTE = [0, 4, 5, 10, 22];

// L'ultimo mese del piano (mese 0 = acconto): lo stesso limite del vincolo
// `piano_rata_mese_nel_piano`.
export const ULTIMO_MESE = 12;

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
  "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const centesimi = (n) => Math.round(Number(n || 0) * 100);
const euro = (c) => c / 100;

/**
 * Un importo scritto da Alessio, all'italiana: «16.000», «1.500,50»,
 * «1500,5», «1500.50», «€ 2.000». Restituisce il numero arrotondato ai
 * centesimi, oppure null se non si capisce — MAI zero al posto di un
 * importo sbagliato: «16.000» letto come 16 € sarebbe l'errore peggiore,
 * quello che non si vede.
 * ⚠️ Il punto con tre cifre dopo è delle migliaia («16.000» = sedicimila);
 *    con una o due cifre dopo è la virgola («1500.50»).
 */
export function leggiImporto(testo) {
  const t = String(testo ?? "").replace(/€/g, "").replace(/\s+/g, "");
  if (t === "") return null;
  let n;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (/^\d+([.,]\d{1,2})?$/.test(t)) n = Number(t.replace(",", "."));
  else return null;
  return Math.round(n * 100) / 100;
}

/**
 * Una rata scritta da Alessio: un importo («2.000», «1.500,50») oppure una
 * percentuale del previsto («50%», «12,5 %») — richiesta del 07/11, quando
 * le ha scritte così sull'anteprima e il modulo le rifiutava.
 * @returns {{importo: number, percentuale: number|null}|null}
 *   null se non si capisce, oppure se è una percentuale e il previsto non
 *   c'è ancora (senza il totale una percentuale non vale niente).
 * ⚠️ La percentuale si trasforma in euro: nel database va l'importo. Se poi
 *    il previsto cambia, la rata resta in euro e il ✗ lo fa vedere.
 */
export function leggiRata(testo, previsto) {
  const t = String(testo ?? "").replace(/\s+/g, "");
  const p = /^(\d{1,3}([.,]\d{1,2})?)%$/.exec(t);
  if (p) {
    const percentuale = Number(p[1].replace(",", "."));
    const base = previsto === null || previsto === undefined || previsto === "" ? NaN : Number(previsto);
    // Senza un previsto vero (vuoto o zero) la percentuale non vale niente:
    // null, non una rata da 0 € che passerebbe in silenzio.
    if (percentuale > 100 || !Number.isFinite(base) || base <= 0) return null;
    // Tutto in interi: centesimi × centesimi di punto, un arrotondamento solo.
    const centPunti = Math.round(percentuale * 100);
    return { importo: Math.round((centesimi(base) * centPunti) / 10000) / 100, percentuale };
  }
  const importo = leggiImporto(t);
  return importo === null ? null : { importo, percentuale: null };
}

/** Un importo da mostrare in un campo, con la virgola: 1500.5 → «1500,50». */
export function importoNelCampo(n) {
  if (n === null || n === undefined || n === "") return "";
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}

/** Il nome del gruppo dalla lettera; una lettera sconosciuta si dice, non si nasconde. */
export function nomeGruppo(codice) {
  return GRUPPI.find((g) => g.codice === codice)?.nome ?? `Gruppo ${codice}`;
}

/** Il netto come lo calcola il database (`piano_voci.netto`). */
// ⚠️ Sui centesimi interi: 4,81 al 4% fa 4,625 esatti, e il database
//    arrotonda a 4,63; in virgola mobile 4,81/1,04 dà 4,6249… e 4,62.
//    Le aliquote ammesse sono intere, quindi la divisione è esatta.
export function nettoDi(importoIvato, aliquota) {
  return Math.round((centesimi(importoIvato) * 100) / (100 + Number(aliquota || 0))) / 100;
}

/**
 * Il ✓ di una voce: acconto più rate fanno l'importo previsto?
 * @returns {{quadra: boolean, distribuito: number, mancano: number}}
 *   `mancano` > 0 se manca qualcosa, < 0 se le rate superano l'importo.
 */
export function quadra(voce, rate) {
  const previsto = centesimi(voce?.importo_ivato);
  const distribuito = (rate ?? []).reduce((s, r) => s + centesimi(r.importo), 0);
  return { quadra: distribuito === previsto, distribuito: euro(distribuito), mancano: euro(previsto - distribuito) };
}

/**
 * Il mese vero di una rata. Mese 0 = acconto, cioè prima dell'apertura;
 * mese 1 = il mese dell'apertura.
 * @param {string} meseApertura "AAAA-MM-01"
 * @returns {{anno: number, mese: number, etichetta: string, acconto: boolean}}
 */
export function meseDellaRata(meseApertura, meseRel) {
  const [a, m] = String(meseApertura).split("-").map(Number);
  if (!a || !m || m < 1 || m > 12) throw new Error(`Data di apertura non valida: «${meseApertura}».`);
  if (!Number.isInteger(meseRel) || meseRel < 0 || meseRel > ULTIMO_MESE) {
    throw new Error(`Mese della rata fuori dal piano: «${meseRel}».`);
  }
  if (meseRel === 0) {
    const prima = new Date(Date.UTC(a, m - 2, 1));
    return {
      anno: prima.getUTCFullYear(),
      mese: prima.getUTCMonth() + 1,
      etichetta: `Acconto (entro ${MESI[prima.getUTCMonth()]} ${prima.getUTCFullYear()})`,
      acconto: true,
    };
  }
  const d = new Date(Date.UTC(a, m - 1 + meseRel - 1, 1));
  const nome = MESI[d.getUTCMonth()];
  return {
    anno: d.getUTCFullYear(),
    mese: d.getUTCMonth() + 1,
    etichetta: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${d.getUTCFullYear()}`,
    acconto: false,
  };
}

/**
 * L'esito di una voce, confrontando tutto IVA inclusa.
 *   · sforato:   lo speso supera il previsto;
 *   · a_rischio: speso più impegnato (fatture ancora da pagare) lo supera;
 *   · risparmio: voce confermata, tutto pagato, e speso sotto il previsto;
 *   · in_linea:  altrimenti.
 */
export function esitoVoce({ previsto, speso = 0, impegnato = 0, confermata = false, tuttoPagato = false }) {
  const p = centesimi(previsto);
  const s = centesimi(speso);
  const i = centesimi(impegnato);
  if (s > p) return { esito: "sforato", differenza: euro(s - p) };
  if (s + i > p) return { esito: "a_rischio", differenza: euro(s + i - p) };
  if (confermata && tuttoPagato && s < p) return { esito: "risparmio", differenza: euro(p - s) };
  return { esito: "in_linea", differenza: euro(p - s) };
}

// =====================================================================
// LA RIGA DELLA VOCE A RIQUADRI — 12/11/2026, modello approvato da
// Alessio l'11/11 (https://claude.ai/artifact/ARhaRmdURjj5SnnPm3KiVD)
// =====================================================================
// Le informazioni che erano una riga grigia («Stimato · dilazione … ·
// IVA … · netto …») diventano riquadri leggibili a colpo d'occhio, e in
// fondo c'è SEMPRE il totale con scritto «stimato» o «confermato».
// Il tono: «ok» verde (a posto), «attenzione» ambra (da tenere d'occhio),
// «male» rosso (sforato), «neutro» senza colore.

export const PAROLE_STATO = { stimato: "Stimato", preventivato: "Preventivato", confermato: "Confermato" };
export const PAROLE_DILAZIONE = { nessuna: "Nessuna", stimata: "Stimata", confermata: "Confermata" };
const TONO_STATO = { stimato: "neutro", preventivato: "attenzione", confermato: "ok" };

/**
 * I riquadri di una voce.
 * @param voce  {stato, dilazione, aliquota_iva, netto, importo_ivato}
 * @param conto {speso, impegnato} oppure null se lo speso non è letto:
 *              allora i riquadri dello speso NON ci sono (niente non è zero).
 * @returns [{chiave, etichetta, testo?, importo?, tono}]
 */
export function riquadriVoce(voce, conto) {
  const iva = Number(voce?.aliquota_iva ?? 0);
  const riquadri = [
    { chiave: "stato", etichetta: "Stato", testo: PAROLE_STATO[voce?.stato] ?? voce?.stato ?? "—", tono: TONO_STATO[voce?.stato] ?? "neutro" },
    { chiave: "dilazione", etichetta: "Dilazione", testo: PAROLE_DILAZIONE[voce?.dilazione] ?? voce?.dilazione ?? "—", tono: "neutro" },
    { chiave: "iva", etichetta: "IVA", testo: voce?.iva_mista ? "mista" : iva === 0 ? "senza IVA" : `${iva}%`, tono: "neutro" },
    { chiave: "netto", etichetta: "Netto", importo: euro(centesimi(voce?.netto)), tono: "neutro" },
  ];
  if (!conto) return riquadri;

  const speso = euro(centesimi(conto.speso));
  const impegnato = euro(centesimi(conto.impegnato));
  riquadri.push(
    speso > 0
      ? { chiave: "spesi", etichetta: "Spesi", importo: speso, tono: "neutro" }
      : { chiave: "spesi", etichetta: "Spesi", testo: "niente", tono: "neutro" },
  );
  if (impegnato > 0) riquadri.push({ chiave: "da_pagare", etichetta: "Da pagare", importo: impegnato, tono: "attenzione" });

  const e = esitoVoce({ previsto: voce?.importo_ivato, speso, impegnato });
  if (e.esito === "sforato") {
    riquadri.push({ chiave: "esito", etichetta: "Sforato di", importo: e.differenza, tono: "male", esito: e.esito });
  } else if (e.esito === "a_rischio") {
    riquadri.push({ chiave: "esito", etichetta: "Supera di", importo: e.differenza, tono: "male", esito: e.esito });
  } else {
    // «Restano» toglie anche le fatture da pagare: quei soldi sono già impegnati.
    const restano = euro(centesimi(voce?.importo_ivato) - centesimi(speso) - centesimi(impegnato));
    riquadri.push({ chiave: "esito", etichetta: "Restano", importo: restano, tono: "ok", esito: e.esito });
  }
  return riquadri;
}

/**
 * Il totale in fondo alla riga: sempre con la parola giusta.
 * «Confermato» solo se la voce è confermata; tutto il resto è una stima.
 */
export function totaleVoce(voce, figlie = []) {
  const parola = voce?.stato === "confermato" ? "confermato" : "stimato";
  const totale = { parola, importo: euro(centesimi(voce?.importo_ivato)) };
  // Con le sottovoci: «stimato · di cui confermato X» (modello dell'11/11).
  if (figlie.length > 0 && parola === "stimato") {
    const conf = figlie.filter((f) => f.stato === "confermato").reduce((s, f) => s + centesimi(f.importo_ivato), 0);
    if (conf > 0) totale.diCuiConfermato = euro(conf);
  }
  return totale;
}

// =====================================================================
// LE SOTTOVOCI — 12/11/2026 (migrazione 20261112000002)
// =====================================================================
// Una sottovoce è una voce con `madre_id`. La madre ha cifra e stato
// calcolati dal database; qui si mettono insieme le cose che il database
// non può tenere in una colonna: il netto (con aliquote diverse) e lo
// speso, che sta tutto sulle sottovoci.

/** Le sottovoci vive di ogni madre, in ordine. */
export function sottovociPerMadre(voci) {
  const m = new Map();
  for (const v of voci ?? []) {
    if (!v.madre_id || v.archiviata_il) continue;
    if (!m.has(v.madre_id)) m.set(v.madre_id, []);
    m.get(v.madre_id).push(v);
  }
  for (const figlie of m.values()) {
    figlie.sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  }
  return m;
}

/** La madre come la mostra la riga: netto sommato, IVA «mista» se le aliquote sono diverse. */
export function voceConSottovoci(madre, figlie) {
  if (!figlie?.length) return madre;
  const aliquote = new Set(figlie.map((f) => Number(f.aliquota_iva)));
  return {
    ...madre,
    netto: euro(figlie.reduce((s, f) => s + centesimi(f.netto), 0)),
    aliquota_iva: aliquote.size === 1 ? [...aliquote][0] : madre.aliquota_iva,
    iva_mista: aliquote.size > 1,
  };
}

/** Speso e impegnato della madre: la somma delle sottovoci. */
export function contoConSottovoci(figlie, perVoce) {
  return (figlie ?? []).reduce(
    (t, f) => {
      const c = perVoce?.get(f.id);
      return {
        speso: euro(centesimi(t.speso) + centesimi(c?.speso)),
        impegnato: euro(centesimi(t.impegnato) + centesimi(c?.impegnato)),
        scollegate: (t.scollegate ?? 0) + (c?.scollegate ?? 0),
      };
    },
    { speso: 0, impegnato: 0, scollegate: 0 },
  );
}

/**
 * I totali del piano, per gruppo e in tutto.
 * 🔴 Due numeri, non uno: la differenza netta (speso − previsto) e gli
 *    sforamenti delle sole voci sopra budget. Un risparmio su una voce non
 *    deve nascondere lo sforamento di un'altra.
 * @param voci [{id, gruppo, importo_ivato, archiviata_il, speso?, impegnato?}]
 */
export function totaliDelPiano(voci) {
  // 12/11: una madre è la somma delle sue sottovoci, che sono già qui:
  // contarla farebbe il doppio. Si contano le voci senza sottovoci.
  const madri = new Set((voci ?? []).filter((v) => v.madre_id && !v.archiviata_il).map((v) => v.madre_id));
  const vive = (voci ?? []).filter((v) => !v.archiviata_il && !madri.has(v.id));
  const vuoto = () => ({ previsto: 0, speso: 0, impegnato: 0, sforamenti: 0, voci: 0 });
  const perGruppo = Object.fromEntries(GRUPPI.map((g) => [g.codice, vuoto()]));
  const tutto = vuoto();
  for (const v of vive) {
    const g = (perGruppo[v.gruppo] ??= vuoto());
    const p = centesimi(v.importo_ivato);
    const s = centesimi(v.speso);
    const i = centesimi(v.impegnato);
    const sf = Math.max(0, s - p);
    for (const t of [g, tutto]) {
      t.previsto += p;
      t.speso += s;
      t.impegnato += i;
      t.sforamenti += sf;
      t.voci += 1;
    }
  }
  const inEuro = (t) => ({
    previsto: euro(t.previsto),
    speso: euro(t.speso),
    impegnato: euro(t.impegnato),
    sforamenti: euro(t.sforamenti),
    differenza: euro(t.speso - t.previsto),
    voci: t.voci,
  });
  return {
    perGruppo: Object.fromEntries(Object.entries(perGruppo).map(([k, t]) => [k, inEuro(t)])),
    totale: inEuro(tutto),
  };
}

/**
 * Quanto c'è da pagare in ogni mese del piano, dalle rate delle voci vive.
 * @returns [{mese_rel, etichetta, importo}] dal mese 0 all'ultimo con rate.
 */
export function fabbisognoPerMese(meseApertura, voci, rate) {
  const vive = new Set((voci ?? []).filter((v) => !v.archiviata_il).map((v) => v.id));
  const somme = new Map();
  for (const r of rate ?? []) {
    if (!vive.has(r.voce_id)) continue;
    somme.set(r.mese_rel, (somme.get(r.mese_rel) ?? 0) + centesimi(r.importo));
  }
  const ultimo = Math.max(0, ...somme.keys());
  const mesi = [];
  for (let m = 0; m <= ultimo; m += 1) {
    mesi.push({ mese_rel: m, etichetta: meseDellaRata(meseApertura, m).etichetta, importo: euro(somme.get(m) ?? 0) });
  }
  return mesi;
}

// =====================================================================
// PARTE 5 (07/11/2026): LO SPESO VOCE PER VOCE
// =====================================================================

/** Come si chiama una spesa nell'elenco: data, cosa, chi, importo. */
export function nomeDellaSpesa(s) {
  const [a, m, g] = String(s?.data ?? "").split("-");
  const quando = g ? `${g}/${m}/${a}` : "senza data";
  const cosa = [s?.descrizione, s?.causale, s?.nota].map((t) => String(t ?? "").trim()).find((t) => t) ?? "senza descrizione";
  const dove = s?.fonte === "anticipazione" ? "anticipo" : "prima nota";
  return `${quando} · ${cosa} · ${dove}${s?.soggetto ? ` · ${s.soggetto}` : ""}`;
}

/**
 * Lo speso del piano, con la riga «da assegnare» e il controllo.
 * @param speso  [{voce_id, speso, impegnato, collegate}] da piano_speso_per_voce()
 * @param spese  [{fonte, id, importo, assegnato, …}] da piano_spese_del_progetto()
 * @param costo  [{tipo, totale}] da costo_del_progetto()
 * @returns {{perVoce: Map, daAssegnare: {righe, totale}, controllo: {torna, costo, piano}}}
 *
 * 🔴 IL CONTROLLO: le spese del progetto (Borgo 58 e tasca) lette per
 *    righe devono fare il totale di costo_del_progetto(). Sono due strade
 *    verso lo stesso numero; se non tornano, la pagina lo dice invece di
 *    mostrare uno speso che potrebbe essere sbagliato.
 * ⚠️ Lo speso delle voci archiviate resta nel conto: la spesa c'è stata.
 */
export function spesoDelPiano({ speso, spese, costo }) {
  const perVoce = new Map(
    (speso ?? []).map((r) => [
      r.voce_id,
      {
        speso: Number(r.speso || 0),
        impegnato: Number(r.impegnato || 0),
        collegate: Number(r.collegate || 0),
        // Fatture collegate già pagate, col pagamento non collegato: non contano finché non lo colleghi.
        scollegate: Number(r.fatture_pagate_scollegate || 0),
      },
    ])
  );
  const righe = (spese ?? [])
    .map((s) => ({ ...s, resto: euro(centesimi(s.importo) - centesimi(s.assegnato)) }))
    .filter((s) => s.resto > 0);
  const totaleResto = righe.reduce((t, s) => t + centesimi(s.resto), 0);
  const deiSoggetti = (costo ?? []).filter((r) => r?.tipo === "srls" || r?.tipo === "tasca");
  const costoTotale = deiSoggetti.reduce((t, r) => t + centesimi(r.totale), 0);
  const righeTotale = (spese ?? []).reduce((t, s) => t + centesimi(s.importo), 0);
  const assegnatoTotale = (spese ?? []).reduce((t, s) => t + centesimi(s.assegnato), 0);
  const spesoPagato = [...perVoce.values()].reduce((t, v) => t + centesimi(v.speso), 0);
  // Una spesa assegnata oltre il suo importo non deve sparire in silenzio
  // dalle «da assegnare»: il database lo impedisce, ma se succedesse si dice.
  const oltre = (spese ?? []).some((s) => centesimi(s.assegnato) > centesimi(s.importo));
  return {
    perVoce,
    daAssegnare: { righe, totale: euro(totaleResto) },
    // Lo speso di TUTTE le voci, archiviate comprese: la spesa c'è stata.
    spesoTotale: euro(spesoPagato),
    controllo: {
      // Le righe fanno il costo, lo speso delle voci è quello assegnato, e
      // speso più da assegnare fa il costo del progetto.
      torna: righeTotale === costoTotale && spesoPagato === assegnatoTotale && spesoPagato + totaleResto === costoTotale && !oltre,
      costo: euro(costoTotale),
      piano: euro(spesoPagato + totaleResto),
    },
  };
}
