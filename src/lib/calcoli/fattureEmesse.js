// Le fatture ai clienti (13/11/2026) — quello che serve alla pagina.
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

// I conti veri (totaliFattura, alCentesimo, imponibileRiga) e il file XML
// stanno in supabase/functions/_shared/fatturaEmessa.js: li usa anche la
// funzione che spedisce allo SdI, e devono dire lo stesso numero.
import { alCentesimo } from "../../../supabase/functions/_shared/fatturaEmessa.js";

export {
  alCentesimo,
  imponibileRiga,
  importoXML,
  testoLatino,
  totaliFattura,
  xmlFattura,
} from "../../../supabase/functions/_shared/fatturaEmessa.js";

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

