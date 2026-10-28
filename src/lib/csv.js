// Export manuale CSV (§4 modulo 7 — "export manuale per ASL"): niente invio
// automatico, un pulsante che genera il file per il download locale.
// 🔴 UNA NOTA NON DIVENTA UNA FORMULA (notte del 28/10/2026, dalla
//    revisione): un testo che comincia con «=», «+», «-» o «@» Excel lo
//    esegue come formula. Gli si mette davanti un apostrofo, che Excel non
//    mostra. ⚠️ I NUMERI no: «-12.50» e' un importo negativo e deve restare
//    un numero. E il ritorno carrello va tra virgolette come l'a capo.
const SEMBRA_FORMULA = /^[=+\-@]/;
const NUMERO = /^-?\d+(\.\d+)?$/;
export const escapeCell = (value) => {
  let s = value == null ? "" : String(value);
  if (SEMBRA_FORMULA.test(s) && !NUMERO.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(","))
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
