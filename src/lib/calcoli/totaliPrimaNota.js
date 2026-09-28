// I TOTALI DEL PERIODO DELLA PRIMA NOTA — 27/09/2026, secondo batch visivo.
//
// La somma delle entrate e delle uscite è quella che la schermata faceva
// già (spostata qui senza cambiarla, per poterla provare); il saldo non è
// un secondo calcolo: è la differenza di QUESTI due totali. Così i tre
// numeri a schermo non possono mai contraddirsi.
//
// ⚠️ È un conto dei movimenti mostrati, cioè di quelli del periodo e del
//    soggetto scelti: non è il saldo di cassa né quello di banca, che si
//    leggono altrove e non si sommano mai.

export function totaliDelPeriodo(movimenti) {
  const inc = movimenti.filter((m) => m.direction === "entrata").reduce((s, m) => s + Number(m.amount), 0);
  const out = movimenti.filter((m) => m.direction === "uscita").reduce((s, m) => s + Number(m.amount), 0);
  return { inc, out, saldo: inc - out };
}
