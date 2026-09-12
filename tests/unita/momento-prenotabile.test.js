import { describe, expect, it } from "vitest";
import { momentoPrenotabile } from "../app/momentoPrenotabile.js";

// La scelta del giorno della prova del modulo pubblico, senza database.
// 🔴 Il caso che il 12/09 ha fatto diventare rosso il controllo su GitHub:
//    prenotazioni online spente e «domani» chiuso nel progetto di prova.

const OGGI = new Date(2026, 8, 12); // sabato 12/09/2026, ora locale

// Le risposte di `public_reservation_options`, per data.
const opzioni = (perData) => async ({ date }) => perData[date] ?? { attivo: false, sold_out: false, orari: [] };

describe("il giorno per la prova del modulo pubblico", () => {
  it("🔴 prenotazioni spente e domani chiuso: salta al giorno dopo", async () => {
    const leggi = opzioni({
      "2026-09-13": { attivo: false, chiuso: true, sold_out: false, motivo: "Evento privato", orari: [] },
    });
    await expect(momentoPrenotabile(leggi, { oggi: OGGI })).resolves.toEqual({ date: "2026-09-14", time: "20:00" });
  });

  it("salta anche un giorno al completo e uno di riposo", async () => {
    const leggi = opzioni({
      "2026-09-13": { attivo: false, chiuso: true, sold_out: true, orari: [] },
      "2026-09-14": { attivo: false, chiuso: true, sold_out: false, motivo: "Quel giorno siamo chiusi.", orari: [] },
    });
    await expect(momentoPrenotabile(leggi, { oggi: OGGI })).resolves.toEqual({ date: "2026-09-15", time: "20:00" });
  });

  it("prenotazioni accese: il primo orario proposto del primo giorno aperto", async () => {
    const leggi = opzioni({
      "2026-09-13": { attivo: true, chiuso: true, sold_out: false, orari: [] },
      "2026-09-14": { attivo: true, sold_out: false, orari: [] },
      "2026-09-15": { attivo: true, sold_out: false, orari: ["20:00", "20:15"] },
    });
    await expect(momentoPrenotabile(leggi, { oggi: OGGI })).resolves.toEqual({ date: "2026-09-15", time: "20:00" });
  });

  it("nessun giorno aperto nell'intervallo: si ferma e dice dove guardare", async () => {
    const leggi = async () => ({ attivo: false, chiuso: true, sold_out: false, orari: [] });
    await expect(momentoPrenotabile(leggi, { oggi: OGGI, giorni: 5 })).rejects.toThrow(/Nessun giorno prenotabile nei prossimi 5/);
  });
});
