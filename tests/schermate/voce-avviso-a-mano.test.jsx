import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// «FALLO A MANO» NON PERDE L'AVVISO TELEGRAM — 16/09/2026
// =====================================================================
// 🔴 IL DIFETTO, visto usando MEMO. Un appunto vocale capisce QUATTRO date
//    distinte: quando succede l'impegno (`scadenza`, `ora`) e quando
//    avvisare (`avviso_data`, `avviso_ora`). Approvando l'appunto arrivavano
//    tutte e quattro; scegliendo «Fallo a mano» il modulo si apriva con i
//    campi del Promemoria Telegram **vuoti** — e «Fallo a mano» chiude
//    comunque l'appunto.
//    ⚠️ Quindi la notifica spariva SENZA NESSUN ERRORE, e chi salvava
//       credeva di averla. È la famiglia dei difetti silenziosi: il valore
//       che non arriva e nessuno lo dice.
//
// ⚠️ QUI SI PROVA IL TRATTO FRA IL DATABASE E IL MODULO. I campi li decide
//    `azione_campi` (nel database, migrazione del 16/09): questa prova finge
//    la sua risposta e guarda che il modulo li metta nelle caselle giuste.
//    Che il database li produca lo prova la verifica dentro la migrazione.
//
// 🔴 E IL CASO OPPOSTO VALE QUANTO IL PRIMO: se l'avviso non era stato
//    chiesto, le caselle devono restare VUOTE. Un promemoria Telegram
//    comparso da sé è un avviso che nessuno ha chiesto — e la regola del
//    progetto è che senza richiesta esplicita non parte niente.

const finte = { aMano: vi.fn(), chiudi: vi.fn(), crea: vi.fn() };

vi.mock("../../src/lib/api/voce", () => ({
  azioneAMano: (...a) => finte.aMano(...a),
  chiudiAMano: (...a) => finte.chiudi(...a),
}));
vi.mock("../../src/lib/api/tasks", () => ({
  createTask: (...a) => finte.crea(...a),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const { default: TaskForm } = await import("../../src/pages/agenda/TaskForm");

/** L'appunto come lo restituisce il database a «Fallo a mano». */
const azioneCon = (campi) => ({
  id: "el-1",
  tipo: "promemoria",
  stato: "in_attesa",
  frase: "Appuntamento in banca",
  testo_detto: "segna appuntamento in banca sabato e ricordamelo il giorno prima alle 15",
  percorso: "/agenda/nuovo",
  campi,
  da_finire: true,
});

const apri = async () => {
  render(
    <MemoryRouter initialEntries={["/agenda/nuovo?daVoce=el-1"]}>
      <Routes>
        <Route path="/agenda/nuovo" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(finte.aMano).toHaveBeenCalledWith("el-1"));
};

/** Le caselle del Promemoria Telegram, prese dal loro riquadro.
 *
 * ⚠️ L'ORA NON E' PIU' UN CAMPO ORARIO DEL BROWSER — 20/09/2026: i minuti
 *    sono un menu di quattro voci (00, 15, 30, 45), perche' `step` diceva
 *    quali valori erano validi e non quali offrire. Qui si continua a
 *    leggere «che ora c'e' scritto», ricomponendola dai due menu. */
const caselleAvviso = () => {
  const riquadro = screen.getByText(/Promemoria Telegram/i).parentElement;
  const ore = riquadro.querySelector('[data-campo="avviso-ore"]');
  const minuti = riquadro.querySelector('[data-campo="avviso-minuti"]');
  return {
    giorno: riquadro.querySelector("input[type=date]"),
    ore,
    minuti,
    get ora() {
      return { value: ore && ore.value ? `${ore.value}:${minuti.value}` : "" };
    },
  };
};

/** L'ora dell'impegno, dai suoi due menu. */
const oraDellImpegno = () => {
  const ore = document.querySelector('[data-campo="scadenza-ore"]');
  const minuti = document.querySelector('[data-campo="scadenza-minuti"]');
  return ore && ore.value ? `${ore.value}:${minuti.value}` : "";
};

beforeEach(() => {
  finte.aMano.mockReset();
  finte.chiudi.mockReset().mockResolvedValue({});
  finte.crea.mockReset().mockResolvedValue({ id: "nuovo" });
});

afterEach(() => vi.clearAllMocks());

describe("🔴 «Fallo a mano» su un promemoria dettato", () => {
  it("🔴 l'avviso Telegram già capito arriva nelle sue caselle", async () => {
    finte.aMano.mockResolvedValue(
      azioneCon({
        titolo: "Appuntamento in banca",
        scadenza: "2026-09-19",
        ora: "11:00",
        avviso_data: "2026-09-18",
        avviso_ora: "15:00",
      }),
    );
    await apri();

    const avviso = caselleAvviso();
    await waitFor(() => expect(avviso.giorno.value).toBe("2026-09-18"));
    expect(avviso.ora.value).toBe("15:00");

    // ⚠️ E LE DUE COPPIE NON SI CONFONDONO: il giorno e l'ora dell'IMPEGNO
    //    restano dove stavano. Sono quattro campi distinti, e scambiarli
    //    manderebbe la notifica il giorno dell'appuntamento invece che il
    //    giorno prima.
    expect(screen.getByDisplayValue("2026-09-19")).toBeTruthy();
    expect(oraDellImpegno()).toBe("11:00");

    // Il pulsante che compare solo quando un promemoria c'è davvero.
    expect(screen.getByRole("button", { name: /Rimuovi promemoria/i })).toBeTruthy();
  });

  it("🔴 senza avviso chiesto le caselle restano VUOTE: nessun promemoria comparso da sé", async () => {
    finte.aMano.mockResolvedValue(
      azioneCon({ titolo: "Chiamare il tecnico della cella", scadenza: "2026-09-19" }),
    );
    await apri();

    // Il titolo è arrivato: il giro ha funzionato, e quindi il vuoto qui
    // sotto è un vuoto vero e non una schermata che non si è riempita.
    await waitFor(() => expect(screen.getByDisplayValue("Chiamare il tecnico della cella")).toBeTruthy());

    const avviso = caselleAvviso();
    expect(avviso.giorno.value).toBe("");
    expect(avviso.ora.value).toBe("");
    // Niente promemoria da rimuovere, perché non ce n'è nessuno.
    expect(screen.queryByRole("button", { name: /Rimuovi promemoria/i })).toBeNull();
    // ⚠️ E i menu dell'ora sono spenti finché non c'è un giorno: un'ora
    //    senza giorno non è un avviso.
    expect(avviso.ore.disabled).toBe(true);
    expect(avviso.minuti.disabled).toBe(true);
  });

  it("⚠️ mezzo avviso: arriva il pezzo detto, l'altro resta vuoto — nessuna ora inventata", async () => {
    finte.aMano.mockResolvedValue(
      azioneCon({ titolo: "Ritirare le analisi", avviso_data: "2026-09-18" }),
    );
    await apri();

    const avviso = caselleAvviso();
    await waitFor(() => expect(avviso.giorno.value).toBe("2026-09-18"));
    // 🔴 Un'ora plausibile messa al posto di una detta è indistinguibile da
    //    un'ora detta, e l'avviso arriverebbe a un'ora scelta da nessuno.
    expect(avviso.ora.value).toBe("");
  });
});
