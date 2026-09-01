import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// ⚠️ Dopo ogni prova si smonta quello che si e' montato: due schermate
//    rimaste appese nello stesso documento si trovano a vicenda, e la prova
//    dopo cerca un pulsante e ne trova due.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 🔴 NESSUNA PROVA DI QUESTO STRATO PARLA COL DATABASE, ed e' una
//    condizione e non una comodita': le prove contro il database vero
//    esistono gia' (`npm run test:app`, 459) e scrivono su un progetto vero.
//    Qui si guardano le schermate, quindi il collegamento va **finto**, e
//    ogni prova dichiara cosa gli fa rispondere. Un collegamento vero
//    renderebbe queste prove lente, ballerine e dipendenti dalla rete.
