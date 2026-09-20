// =====================================================================
// COME SI SCEGLIE UN'ORA — 20/09/2026
// =====================================================================
// 🔴 PERCHE' NON UN CAMPO ORARIO DEL BROWSER, e nemmeno due menu a tendina.
//    Il campo nativo offriva tutti e sessanta i minuti e rifiutava al
//    salvataggio (`step`), cioè un divieto che si incontra dopo. I due menu
//    a tendina lo risolvevano, ma su un telefono restano due elenchi lunghi
//    da aprire con le dita durante il servizio.
//    Adesso sono due ruote: si scorrono col dito, con la rotella e con le
//    frecce, e girano — dopo le 23 torna 00, dopo 55 torna 00.
//
// ⚠️ PRIMA LA FASCIA, POI L'ORA: mattina (00-11) o pomeriggio (12-23). Una
//    ruota di ventiquattro voci si scorre due volte per arrivare in fondo;
//    con la fascia le voci sono dodici, come i minuti.
//
// ⚠️ DENTRO RESTA TUTTO A VENTIQUATTRO ORE: quello che si salva è sempre
//    «HH:MM», e la fascia è soltanto il modo di sceglierlo. Due formati nel
//    database sarebbero due modi di dire la stessa cosa.
//
// ⚠️ QUESTA E' LA PARTE CHE SI PUO' PROVARE SENZA DISEGNARE NIENTE, ed è il
//    motivo per cui sta in un file suo: quali voci compaiono, come gira una
//    ruota, cosa succede a un orario storico.

/** I dodici minuti offerti: scaglioni da cinque. */
export const MINUTI_OFFERTI = [
  "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
];

export const FASCE = [
  { id: "mattina", etichetta: "Mattina", da: 0, a: 11 },
  { id: "pomeriggio", etichetta: "Pomeriggio", da: 12, a: 23 },
];

const due = (n) => String(n).padStart(2, "0");

/** La fascia di un orario. Un orario vuoto non ha una fascia: si parte da mattina. */
export function fasciaDi(valore) {
  const ore = Number((valore || "").slice(0, 2));
  if (!valore || Number.isNaN(ore)) return "mattina";
  return ore >= 12 ? "pomeriggio" : "mattina";
}

/** Le dodici ore di una fascia. */
export function oreDellaFascia(fascia) {
  const f = FASCE.find((x) => x.id === fascia) || FASCE[0];
  return Array.from({ length: f.a - f.da + 1 }, (_, i) => due(f.da + i));
}

/**
 * Cambiare fascia sposta l'ora di dodici, e lascia stare i minuti.
 *
 * ⚠️ Non si azzera niente: chi passa da «09:30 mattina» a pomeriggio vuole
 *    le 21:30, non ricominciare da capo. E un orario vuoto resta vuoto —
 *    scegliere la fascia non è ancora scegliere un'ora.
 */
export function convertiFascia(valore, fascia) {
  if (!valore) return "";
  const ore = Number(valore.slice(0, 2));
  const minuti = valore.slice(3, 5);
  const dentro = fascia === "pomeriggio" ? ore >= 12 : ore < 12;
  if (dentro) return valore;
  return `${due(fascia === "pomeriggio" ? ore + 12 : ore - 12)}:${minuti}`;
}

/**
 * I minuti che la ruota offre, dato quello che c'è scritto adesso.
 *
 * 🔴 UN MINUTO FUORI GRIGLIA NON SPARISCE E NON SI ARROTONDA: un promemoria
 *    salvato alle 20:07 resta alle 20:07 finché non lo si cambia. Compare
 *    in coda, marcato per quello che è; appena si sceglie altro non torna.
 */
export function minutiDaOfferire(minutiAttuali) {
  const offerti = MINUTI_OFFERTI.map((m) => ({ valore: m, etichetta: m }));
  const m = (minutiAttuali || "").slice(0, 2);
  if (!m || MINUTI_OFFERTI.includes(m)) return offerti;
  return [...offerti, { valore: m, etichetta: `${m} (scritto prima)` }];
}

/**
 * La voce che viene dopo (o prima) su una ruota che GIRA.
 *
 * ⚠️ Gira davvero: dall'ultima si torna alla prima. Una ruota che si ferma
 *    ai bordi non è una ruota, è un elenco — e chi sale dalle 00 si aspetta
 *    di arrivare alle 23, non di restare fermo.
 * ⚠️ Se il valore di adesso non è nella lista (un orario storico), si parte
 *    dal primo: l'unica risposta onesta è «non so dove sei sulla ruota».
 */
export function scorriCircolare(lista, corrente, passo) {
  if (!lista.length) return corrente;
  const i = lista.indexOf(corrente);
  if (i === -1) return lista[0];
  return lista[(i + (passo % lista.length) + lista.length) % lista.length];
}

/** «20» e «15» diventano «20:15». */
export function oraComposta(ore, minuti) {
  if (!ore && ore !== 0) return "";
  return `${due(String(ore).slice(0, 2))}:${due((minuti || "00").slice(0, 2))}`;
}
