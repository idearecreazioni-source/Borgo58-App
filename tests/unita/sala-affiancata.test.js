import { describe, expect, it } from "vitest";
import {
  ELENCO_PRENOTAZIONI_PX,
  SOGLIA_IN_PIEDI_CM_REALI,
  VUOTO_FRA_LE_COLONNE_PX,
  salaAffiancata,
} from "../../src/lib/calcoli/sala";

// =====================================================================
// LE DUE COLONNE DELLA SALA — 21/09/2026
// =====================================================================
// 🔴 COSA SI PROVA, e non e' «a che larghezza si affianca»: che la regola
//    delle due colonne sia AGGANCIATA alla soglia che decide il verso della
//    sala. Un breakpoint scritto a mano passerebbe queste prove oggi e
//    mentirebbe il giorno che la soglia cambia — ed e' esattamente come il
//    22/08 la pianta e' sbordata dallo schermo di Alessio: due numeri legati
//    da un rapporto, tenuti in due posti che non si nominavano.

const PXCM = 37.79528;
// I punti che servono al contenuto perche' la colonna di sinistra tenga la
// sala sdraiata: soglia + elenco + vuoto.
const NECESSARI = SOGLIA_IN_PIEDI_CM_REALI * PXCM + ELENCO_PRENOTAZIONI_PX + VUOTO_FRA_LE_COLONNE_PX;

describe("🔴 la sala si affianca all'elenco solo se resta sdraiata", () => {
  it("un punto sopra il necessario si affianca, un punto sotto no", () => {
    expect(salaAffiancata(Math.ceil(NECESSARI), PXCM)).toBe(true);
    expect(salaAffiancata(Math.floor(NECESSARI) - 1, PXCM)).toBe(false);
  });

  it("⚠️ la soglia e' quella del VERSO della sala, non un numero suo", () => {
    // Rompendo il legame — per esempio mettendo una soglia piu' bassa nelle
    // due colonne — questa prova resta l'unica che se ne accorge: alla
    // larghezza in cui la sala si mette in piedi, le colonne devono spegnersi.
    const alSuoLimite = SOGLIA_IN_PIEDI_CM_REALI * PXCM + ELENCO_PRENOTAZIONI_PX + VUOTO_FRA_LE_COLONNE_PX;
    expect(salaAffiancata(alSuoLimite, PXCM)).toBe(true);
    // Un solo punto in meno vuol dire pianta sotto soglia: si torna in colonna.
    expect(salaAffiancata(alSuoLimite - 1, PXCM)).toBe(false);
  });

  it("🔴 su un telefono non si affianca mai, a nessuna calibrazione", () => {
    // 390 punti meno i margini della pagina: il caso di Alessio.
    for (const pxcm of [PXCM, 59.5, 64, 74]) {
      expect(salaAffiancata(358, pxcm)).toBe(false);
      expect(salaAffiancata(390, pxcm)).toBe(false);
    }
  });

  it("🔴 una calibrazione piu' fitta spegne le colonne: i centimetri veri comandano", () => {
    // 1280 punti di contenuto e' il tetto della pagina (80rem), cioe' quello
    // che si ha da un monitor da 1664 in su: alla pianta restano 936 punti.
    expect(1280 - ELENCO_PRENOTAZIONI_PX - VUOTO_FRA_LE_COLONNE_PX).toBe(936);
    expect(salaAffiancata(1280, PXCM)).toBe(true);
    // ⚠️ Sullo STESSO contenuto, su un dispositivo dove un centimetro vale 64
    //    punti la soglia sale a 1546 e i 936 non bastano piu': le colonne si
    //    spengono invece di far girare la sala.
    expect(salaAffiancata(1280, 64)).toBe(false);
  });

  it("⚠️ i computer di mezzo restano in colonna, ed e' la misura a dirlo", () => {
    // Col telaio del computer (barra laterale 320, margini 64) il contenuto
    // vale la finestra meno 384: a 1280 sono 896, a 1536 sono 1152 — sotto i
    // 1257 che servono. Le colonne partono da 1664.
    expect(salaAffiancata(1280 - 384, PXCM)).toBe(false);
    expect(salaAffiancata(1536 - 384, PXCM)).toBe(false);
    expect(salaAffiancata(Math.min(1280, 1664 - 384), PXCM)).toBe(true);
  });

  it("⚠️ senza una misura non si affianca: zero e vuoto non sono «ci sta»", () => {
    expect(salaAffiancata(0, PXCM)).toBe(false);
    expect(salaAffiancata(null, PXCM)).toBe(false);
    expect(salaAffiancata(2000, 0)).toBe(false);
  });

  it("le misure delle due colonne sono dichiarate, non nascoste nella schermata", () => {
    expect(ELENCO_PRENOTAZIONI_PX).toBe(320);
    expect(VUOTO_FRA_LE_COLONNE_PX).toBe(24);
  });
});
