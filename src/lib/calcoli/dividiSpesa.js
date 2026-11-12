import { formatEUR } from "../constants";
import { leggiImporto } from "./pianoInvestimento";

// DIVIDERE UNA SPESA SU PIÙ VOCI DEL PIANO — i conti del modulo (12/11/2026,
// modello approvato da Alessio l'11/11).
//
// 🔴 SI DIVIDE TUTTA: «Salva la divisione» si accende solo quando le parti
//    fanno l'importo della spesa al centesimo. Lo pretende anche il
//    database (dividi_spesa), che è il controllo vero: questo serve a dirlo
//    PRIMA di premere, mentre si scrive.
// ⚠️ LE CIFRE SI SCRIVONO ALL'ITALIANA («4.500», «1.500,50») e le legge
//    `leggiImporto`, la stessa del resto della pagina: una cifra che non si
//    capisce si dice, non diventa zero.
// ⚠️ TUTTO IN CENTESIMI INTERI: 0,1 + 0,2 in virgola mobile non fa 0,3, e
//    «restano 0,00 €» deve voler dire zero davvero.

const cent = (n) => Math.round(Number(n || 0) * 100);
const euro = (c) => c / 100;

/** La chiave dell'origine di un collegamento: «prima_nota:…», «anticipazione:…», «fattura:…». */
export function chiaveOrigine(c) {
  if (c?.cash_movement_id) return `prima_nota:${c.cash_movement_id}`;
  if (c?.anticipazione_id) return `anticipazione:${c.anticipazione_id}`;
  if (c?.supplier_invoice_id) return `fattura:${c.supplier_invoice_id}`;
  return null;
}

/**
 * Il nome di una fattura collegata: «Fattura n. 14 · San Cataldo · da pagare».
 * @param f {invoice_number, invoice_date, status, supplier: {name}} — può mancare
 */
export function nomeDellaFattura(f) {
  if (!f) return "Fattura";
  const [a, m, g] = String(f.invoice_date ?? "").split("-");
  const pezzi = [
    f.invoice_number ? `Fattura n. ${f.invoice_number}` : "Fattura senza numero",
    g ? `${g}/${m}/${a}` : null,
    f.supplier?.name ?? null,
    f.status === "da_pagare" ? "da pagare" : null,
  ];
  return pezzi.filter(Boolean).join(" · ");
}

/** I collegamenti raggruppati per origine: Map chiave → [collegamenti]. */
export function partiPerOrigine(collegamenti) {
  const m = new Map();
  for (const c of collegamenti ?? []) {
    const k = chiaveOrigine(c);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), c]);
  }
  return m;
}

/** Una riga vuota del modulo. */
export const rigaVuota = () => ({ voceId: "", rataId: "", testo: "" });

/**
 * Le righe con cui si apre il modulo: le parti che la spesa ha già (una
 * divisione nuova SOSTITUISCE tutte quelle di prima, quindi si parte da
 * lì), più una riga vuota se resta qualcosa o se ce n'è una sola.
 * @param totale     l'importo della spesa
 * @param esistenti  i collegamenti di quella spesa [{voce_id, rata_id, importo_attribuito}]
 */
export function righeIniziali(totale, esistenti = []) {
  const righe = (esistenti ?? []).map((c) => ({
    voceId: c.voce_id,
    rataId: c.rata_id ?? "",
    testo: scriviCifra(c.importo_attribuito),
  }));
  const gia = righe.reduce((t, r) => t + cent(leggiImporto(r.testo)), 0);
  const resto = cent(totale) - gia;
  // Nuova: due righe vuote, come nel modello. Niente cifra indovinata.
  if (righe.length === 0) return [rigaVuota(), rigaVuota()];
  if (resto > 0 || righe.length === 1) righe.push({ ...rigaVuota(), testo: resto > 0 ? scriviCifra(euro(resto)) : "" });
  return righe;
}

/** Una cifra da mettere in un campo, all'italiana: 4500 → «4500», 1125.5 → «1125,50». */
export function scriviCifra(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}

/**
 * Lo stato della divisione mentre si scrive.
 * @param totale  l'importo della spesa
 * @param righe   [{voceId, rataId, testo}]
 * @param fonte   "prima_nota" | "anticipazione" | "fattura" (per dire «della fattura»)
 * @param sceglibili Set degli id delle voci che si possono scegliere, o null se non si sa ancora
 * @returns {{
 *   parti: [{voceId, rataId, importo}],   le righe piene e lette
 *   diviso: number, resto: number,         in euro; resto < 0 = diviso troppo
 *   esito: "tutta" | "manca" | "oltre",
 *   frase: string,                          quello che si legge sotto la barra
 *   errori: string[],                       righe che non si capiscono
 *   pronta: boolean                         «Salva la divisione» si accende
 * }}
 * ⚠️ Una riga tutta vuota (niente voce, niente cifra) non conta e non è un
 *    errore: è quella aggiunta con «+ Aggiungi un'altra voce» e non usata.
 */
export function esitoDivisione(totale, righe, fonte = "prima_nota", sceglibili = null) {
  const errori = [];
  const parti = [];
  const viste = new Set();
  (righe ?? []).forEach((r, i) => {
    const n = i + 1;
    const testo = String(r?.testo ?? "").trim();
    const voceId = r?.voceId ?? "";
    if (!voceId && testo === "") return;
    const importo = testo === "" ? null : leggiImporto(testo);
    if (!voceId) {
      errori.push(`Riga ${n}: scegli dove va.`);
      return;
    }
    if (sceglibili && !sceglibili.has(voceId)) {
      errori.push(`Riga ${n}: questa voce non si sceglie più (archiviata, o divisa in sottovoci). Scegline un'altra.`);
      return;
    }
    if (importo === null) {
      errori.push(
        testo === ""
          ? `Riga ${n}: scrivi quanto va su questa voce.`
          : `Riga ${n}: non capisco «${testo}». Scrivi per esempio 4.500 oppure 1.500,50.`
      );
      return;
    }
    if (importo <= 0) {
      errori.push(`Riga ${n}: la cifra deve essere più di zero, oppure togli la riga.`);
      return;
    }
    if (viste.has(voceId)) {
      errori.push(`Riga ${n}: questa voce c'è già in un'altra riga. Metti le due cifre in una riga sola.`);
      return;
    }
    viste.add(voceId);
    parti.push({ voceId, rataId: r.rataId || "", importo });
  });

  const diviso = parti.reduce((t, p) => t + cent(p.importo), 0);
  const resto = cent(totale) - diviso;
  const esito = resto === 0 ? "tutta" : resto > 0 ? "manca" : "oltre";
  const dellaSpesa = fonte === "fattura" ? "della fattura" : "della spesa";
  const frase =
    esito === "tutta"
      ? `✓ Divisa tutta: restano ${formatEUR(0)}`
      : esito === "manca"
        ? `Restano da dividere ${formatEUR(euro(resto))}`
        : `Hai diviso ${formatEUR(euro(-resto))} in più ${dellaSpesa}`;
  return {
    parti,
    diviso: euro(diviso),
    resto: euro(resto),
    esito,
    frase,
    errori,
    pronta: errori.length === 0 && parti.length > 0 && esito === "tutta",
  };
}

/**
 * Le larghezze della barra, una per parte, in percento del totale (mai
 * oltre il 100% in tutto: quello che avanza lo dice la frase).
 */
export function barraDivisione(totale, parti) {
  const t = cent(totale);
  if (t <= 0) return (parti ?? []).map(() => 0);
  let usato = 0;
  return (parti ?? []).map((p) => {
    const quota = Math.max(0, Math.min(10000 - usato, Math.round((cent(p.importo) * 10000) / t)));
    usato += quota;
    return quota / 100;
  });
}

/**
 * Quello che si scrive accanto a un documento collegato a una voce:
 * «4.500,00 € di 7.200,00 €», e se la spesa sta anche su altre voci
 * «· divisa: il resto è su Sedie e tavoli».
 * @param c          il collegamento di questa voce
 * @param parti      tutti i collegamenti della stessa origine
 * @param totale     l'importo della spesa (null se non si sa)
 * @param nomeVoce   (voceId) => nome da mostrare
 * @returns {{cifra: string, divisa: string|null}}
 */
export function descriviParte(c, parti, totale, nomeVoce) {
  const mia = Number(c?.importo_attribuito || 0);
  const cifra =
    totale !== null && totale !== undefined && cent(totale) !== cent(mia)
      ? `${formatEUR(mia)} di ${formatEUR(totale)}`
      : formatEUR(mia);
  const altre = (parti ?? []).filter((p) => p.voce_id !== c?.voce_id);
  if (altre.length === 0) return { cifra, divisa: null };
  const nomi = [...new Set(altre.map((p) => nomeVoce?.(p.voce_id) ?? "un'altra voce"))];
  const elenco = nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(", ")} e ${nomi.at(-1)}`;
  return { cifra, divisa: `divisa: il resto è su ${elenco}` };
}

/**
 * I pagamenti «da dividere»: ereditati da una fattura divisa, che Alessio
 * divide a mano (scelta dell'11/11). Una riga per pagamento.
 * @returns [{chiave, fonte, id, parti}]
 */
export function pagamentiDaDividere(collegamenti) {
  const fuori = [];
  for (const [chiave, parti] of partiPerOrigine(collegamenti)) {
    if (!parti.some((p) => p.da_dividere)) continue;
    const [fonte, id] = chiave.split(":");
    fuori.push({ chiave, fonte, id, parti });
  }
  return fuori;
}
