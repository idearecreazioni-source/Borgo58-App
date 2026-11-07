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

/**
 * I totali del piano, per gruppo e in tutto.
 * 🔴 Due numeri, non uno: la differenza netta (speso − previsto) e gli
 *    sforamenti delle sole voci sopra budget. Un risparmio su una voce non
 *    deve nascondere lo sforamento di un'altra.
 * @param voci [{id, gruppo, importo_ivato, archiviata_il, speso?, impegnato?}]
 */
export function totaliDelPiano(voci) {
  const vive = (voci ?? []).filter((v) => !v.archiviata_il);
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
