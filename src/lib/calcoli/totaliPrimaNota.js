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

// 🔴 «QUESTO MESE ENTRATI / USCITI» CONTAVA ANCHE GLI SPOSTAMENTI (revisione
//    dell'11/11, punto 7): versare 800 € in banca faceva «+800 entrati» e
//    «−800 usciti», e il prestito di ottobre risultava 8.000 € entrati.
//    Le causali «di sistema» (versamenti, differenze di cassa, rimborso al
//    titolare, caparre, prestiti) sono soldi che si spostano, non che si
//    guadagnano o si spendono: il gestionale le scrive da solo, e qui non
//    si contano. Una riga senza causale si conta, come prima.
// ⚠️ SOLO per il riquadro della Cassa: la Prima nota resta il registro di
//    tutti i movimenti e somma con `totaliDelPeriodo`, spostamenti compresi.
export function entratiUscitiDelMese(movimenti) {
  return totaliDelPeriodo((movimenti ?? []).filter((m) => m.causale?.di_sistema !== true));
}
