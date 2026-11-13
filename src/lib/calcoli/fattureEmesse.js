// Le fatture ai clienti (13/11/2026) — i conti fatti in pagina.
//
// ⚠️ I TOTALI VERI LI CONGELA IL DATABASE, in `emetti_fattura()`
// (migrazione 20261113000002): questo file serve all'anteprima della bozza,
// e deve dire ESATTAMENTE lo stesso numero. Per questo segue le stesse due
// regole di arrotondamento, nello stesso ordine:
//   1. ogni riga si arrotonda al centesimo (quantità × prezzo);
//   2. l'IVA si calcola sul totale di ogni aliquota, non riga per riga —
//      è come la riepiloga la fattura elettronica («DatiRiepilogo»).
// Se le due regole divergono, l'anteprima mostrerebbe un totale e la
// fattura ne porterebbe un altro: la prova `fatture-emesse.test.js` le tiene
// allineate sui casi del database.

import { orderTotals } from "./conto";
import { nomeRiga, supplementoRiga } from "./righeComanda";

// ⚠️ I CONTI SI FANNO IN INTERI, non in virgola mobile (revisione del
//    13/11). Il database conta in decimale esatto; 1,5 × 1,15 in virgola
//    mobile fa 1,7249999…, e il centesimo andrebbe giù dove il database lo
//    manda su. Quantità in millesimi, prezzi in centesimi, aliquote in punti
//    interi: ogni prodotto è un intero esatto, e si arrotonda una volta sola.

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
    const natura = aliquota === 0 ? (r.natura ?? null) : null;
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
        // aliquota in punti: per 22, 10, 5, 4 è un intero, e cent × punti / 100 è esatto.
        centImposta: divisoArrotondato(g.cent * centesimiDiPunto, 10000),
      };
    })
    .sort((a, b) => b.aliquota - a.aliquota);
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

/** Il numero come si stampa: «1/2027». Una bozza non ha numero. */
export function numeroFattura(fattura) {
  if (!fattura?.numero) return null;
  return `${fattura.numero}/${fattura.anno}`;
}

/** I dati della società che mancano per poter emettere (stessa lista di emetti_fattura). */
export function datiSocietaMancanti(entity) {
  const manca = [];
  const vuoto = (v) => v == null || String(v).trim() === "";
  if (vuoto(entity?.legal_name)) manca.push("ragione sociale");
  if (vuoto(entity?.vat_number)) manca.push("partita IVA");
  if (vuoto(entity?.sede_indirizzo)) manca.push("indirizzo della sede");
  if (vuoto(entity?.sede_cap)) manca.push("CAP");
  if (vuoto(entity?.sede_comune)) manca.push("comune");
  if (vuoto(entity?.sede_provincia)) manca.push("provincia");
  return manca;
}

/** Il nome del cliente come si legge: la ragione sociale, o nome e cognome. */
export function nomeCliente(c) {
  if (!c) return "";
  return c.denominazione || [c.nome, c.cognome].filter(Boolean).join(" ");
}

/** Le righe della fattura dal conto di un tavolo: piatti (col supplemento) e coperto, IVA inclusa. */
export function righeDalConto(order, copertoPrice) {
  const t = orderTotals(order, copertoPrice);
  const righe = t.items.map((i) => ({
    descrizione: nomeRiga(i) || "Piatto",
    quantita: Number(i.quantity),
    prezzo_unitario: alCentesimo(Number(i.unit_price) + supplementoRiga(i)),
    aliquota_iva: 10,
    natura: "",
  }));
  if (t.coperti > 0 && t.copertoUnitPrice > 0) {
    righe.push({
      descrizione: "Coperto",
      quantita: t.coperti,
      prezzo_unitario: t.copertoUnitPrice,
      aliquota_iva: 10,
      natura: "",
    });
  }
  return { righe, totale: t.total };
}

