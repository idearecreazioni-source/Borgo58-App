// Fra i punti che si scrivono e la frazione che si salva.
//
// 🔴 PERCHE' ESISTE IN UN POSTO SOLO (24/08/2026). In questo database
// «percento» vuol dire due cose — in `scenari_proiezione` e' una frazione
// (0,25 = 25%), in `fiscal_settings` sono punti (24 = 24%) — ed e' il
// debito dichiarato nel §8 di CLAUDE.md. La conversione viveva dentro
// `PrevisioneForm.jsx`, quindi era usabile da una schermata sola: la
// seconda che ne avesse avuto bisogno se ne sarebbe scritta una sua.
//
// ⚠️ E IL CASO PEGGIORE ERA GIA' IN CASA: `commissione_pos_percento`
// esiste in **due tabelle** — in frazione nella Proiezione, in punti
// nella tesoreria. Stesso nome, stesso fatto del mondo (quanto trattiene
// la banca), due significati.
//
// ⚠️ CHI SCRIVE VEDE SEMPRE PUNTI. In ogni schermata si digita «1,5» e si
// legge «1,5%»: la frazione e' una faccenda del database e non deve
// affacciarsi. Il difetto non e' mai stato nella schermata — era che due
// colonne dello stesso fatto conservavano numeri diversi.
//
// ⚠️ I NOMI DICONO L'UNITA', NON LA DIREZIONE: `daPercento`/`aPercento`
// obbligavano a ricordarsi da dove si partiva. `inFrazione` e `inPunti`
// dicono cosa si ottiene, che e' la sola cosa che serve sapere leggendo.

/**
 * Da punti a frazione: 1,5 diventa 0,015.
 * ⚠️ Un campo vuoto resta vuoto e non diventa zero: «non l'ho ancora
 * deciso» e «non pago commissione» sono due cose diverse, ed e' la
 * distinzione che il progetto tiene ferma dal 15/08 sulle deducibilita'.
 */
export function inFrazione(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : null;
}

/**
 * Da frazione a punti: 0,015 diventa «1.5».
 * ⚠️ Si arrotonda alla seconda cifra dei punti — la quarta della frazione
 * — perche' e' la precisione con cui una banca dichiara una commissione
 * (1,25%). Senza, 0,0125 tornerebbe «1.2500000000000002».
 */
export function inPunti(v) {
  if (v == null) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10000) / 100);
}
