// Che cosa si chiede al database quando si legge una fattura fornitore.
//
// ⚠️ PERCHÉ VIVE IN UN FILE SUO, senza nessun import: così la prova
// automatica può usare **questa** stringa invece di una copia, e provarla
// contro PostgREST davvero (`tests/app/note-di-credito.test.js`). Una copia
// nel file della prova renderebbe la prova verde anche il giorno in cui
// nella schermata la colonna sparisce.
//
// ⚠️ E il pezzo che non si può dimenticare è `da_pagare`: non è una colonna
// della tabella, è calcolata dal database (importo meno le note di credito
// scalate). Se cadesse da questa stringa, la schermata mostrerebbe il
// lordo — cioè un «da pagare» che mente, senza nessun errore da nessuna
// parte. È la stessa forma del campo dimenticato delle mance (16/08): un
// difetto che sbaglia in silenzio invece di dare errore.
export const SELECT_FATTURA =
  "*, da_pagare, note_scalate," +
  " supplier:supplier_id(id, name), entity:entity_id(id, name)," +
  " utilizzi:note_credito_utilizzi!fattura_id(id, importo, nota:nota_id(id, numero, data, importo))," +
  " documenti:documents!supplier_invoice_id(id, title, doc_type, document_date)";
