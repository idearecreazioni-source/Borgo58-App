// I nomi dei mesi in italiano, in un posto solo.
//
// ⚠️ Sta in un file suo e non dentro un componente: un file che esporta
// insieme un componente e una costante rompe il ricaricamento a caldo di
// React, e il lint di questo progetto deve restare a zero avvisi.
export const NOMI_MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
