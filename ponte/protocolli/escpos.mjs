// LE STAMPANTI DELLE COMANDE IN ESC/POS (Epson TM in rete, porta 9100) — 28/10/2026.
//
// ESC/POS è la lingua di quasi tutte le stampanti termiche: byte mandati
// così come sono sulla porta 9100, senza risposta. Per sapere come sta la
// stampante c'è un comando a parte (DLE EOT), che risponde un byte per
// domanda anche mentre la stampante è ferma.
//
// ⚠️ I SIGNIFICATI DEI BIT VENGONO DAL MANUALE ESC/POS GENERALE DI EPSON
//    (comando DLE EOT, «transmit real-time status»), non da una TM-T20III
//    vera: si confermano il giorno del collaudo, aprendo il coperchio e
//    togliendo la carta davanti alla stampante.

import { righeDelLavoro, righeImpaginate, soloAscii, STILI } from "./testo.mjs";

const ESC = 0x1b;
const GS = 0x1d;
const DLE = 0x10;
const EOT = 0x04;

export const LARGHEZZA = 42; // caratteri per riga su carta da 80 mm, carattere A

/** Il foglio di prova: centrato, titolo in grassetto, avanzamento e taglio. */
export function foglioDiProva(contenuto) {
  const [titolo, ...righe] = righeDelLavoro(contenuto, LARGHEZZA).map(soloAscii);
  const pezzi = [
    Buffer.from([ESC, 0x40]), // ricomincia da capo
    Buffer.from([ESC, 0x61, 1]), // centrato
    Buffer.from([ESC, 0x45, 1]), // grassetto
    Buffer.from(`${titolo ?? ""}\n`, "ascii"),
    Buffer.from([ESC, 0x45, 0]),
    Buffer.from(righe.map((r) => `${r}\n`).join(""), "ascii"),
    Buffer.from([ESC, 0x64, 4]), // avanti di quattro righe
    Buffer.from([GS, 0x56, 66, 0]), // taglio, dopo aver avanzato fino alla lama
  ];
  return Buffer.concat(pezzi);
}

/**
 * Il foglio di una comanda (29/10/2026): a sinistra, i piatti in doppia
 * altezza perché si leggono da lontano, SENZA in grassetto. Gli stili
 * vengono da `righeImpaginate`: qui solo i byte che li dicono.
 */
export function foglioComanda(contenuto) {
  const pezzi = [Buffer.from([ESC, 0x40])];
  let prima = null;
  for (const { stile, testo } of righeImpaginate(contenuto, LARGHEZZA)) {
    const s = STILI[stile] ?? STILI.normale;
    // Una riga di stacco prima di ogni turno, come a schermo.
    if (stile === "turno" && prima !== "turno") pezzi.push(Buffer.from([ESC, 0x21, 0, ESC, 0x61, 0]), Buffer.from(`${"-".repeat(LARGHEZZA)}\n`, "ascii"));
    // ESC ! n: 0x08 grassetto, 0x10 doppia altezza, 0x20 doppia larghezza.
    const modo = (s.grassetto ? 0x08 : 0) | (s.doppiaAltezza ? 0x10 : 0) | (s.doppiaLarghezza ? 0x20 : 0);
    pezzi.push(Buffer.from([ESC, 0x61, s.centrato ? 1 : 0, ESC, 0x21, modo]), Buffer.from(`${testo}\n`, "ascii"));
    prima = stile;
  }
  pezzi.push(Buffer.from([ESC, 0x21, 0, ESC, 0x61, 0]), Buffer.from([ESC, 0x64, 4]), Buffer.from([GS, 0x56, 66, 0]));
  return Buffer.concat(pezzi);
}

/** Le due domande di stato: «sei ferma, e perché?» (n=2) e «la carta?» (n=4). */
export const DOMANDA_STATO = Buffer.from([DLE, EOT, 2, DLE, EOT, 4]);
export const BYTE_RISPOSTA_STATO = 2;

// Ogni byte di stato ha due bit sempre accesi (1 e 4) e due sempre spenti
// (0 e 7): è il modo di riconoscere una risposta vera da un rumore.
const eUnByteDiStato = (b) => (b & 0x93) === 0x12;

/**
 * Legge i due byte della risposta di stato.
 * @returns {{stato: string, testo: string|null, byte: number[]}}
 */
export function leggiStato(risposta) {
  const byte = [...(risposta ?? [])].slice(0, 2);
  if (byte.length < 2 || !byte.every(eUnByteDiStato)) {
    return { stato: "errore", testo: "La stampante ha risposto qualcosa che non sembra uno stato ESC/POS.", byte };
  }
  const [ferma, carta] = byte;
  if (ferma & 0x04) return { stato: "coperchio_aperto", testo: "Il coperchio della stampante è aperto: chiudilo e riprova.", byte };
  if (carta & 0x60 || ferma & 0x20) return { stato: "carta_finita", testo: "La stampante dice che la carta è finita: cambia il rotolo e riprova.", byte };
  if (ferma & 0x40) return { stato: "errore", testo: "La stampante segnala un errore: spegnila e riaccendila.", byte };
  if (carta & 0x0c) return { stato: "pronto", testo: "La carta sta per finire.", byte };
  return { stato: "pronto", testo: null, byte };
}
