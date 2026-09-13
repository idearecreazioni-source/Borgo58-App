import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// GLI APPUNTI SI APPROVANO ANCHE DALLA DASHBOARD — 11/09/2026
// =====================================================================
// 🔴 Mandato «MEMO affidabile»: dalla Dashboard si approva, si corregge a
//    mano o si butta OGNI proposta, e le altre restano come erano.
// ⚠️ Si monta il solo riquadro: la Dashboard intera fa sette letture che
//    qui non c'entrano. Il collegamento al gestionale è finto.

const finte = { appunti: vi.fn(), approva: vi.fn(), scarta: vi.fn(), scegli: vi.fn() };

vi.mock("../../src/lib/api/voce", () => ({
  appuntiDaApprovare: (...a) => finte.appunti(...a),
  approvaAppunto: (...a) => finte.approva(...a),
  scartaAppunto: (...a) => finte.scarta(...a),
  scegliPerAzione: (...a) => finte.scegli(...a),
}));

const { default: AppuntiInDashboard } = await import("../../src/components/AppuntiInDashboard");

const impegno = (id, titolo, data) => ({
  id: `el-${id}`,
  frase: `Promemoria: ${titolo}`,
  dati: { titolo, data },
  sicuro: true,
  motivo: null,
  alternative: [],
  stato: "in_attesa",
  domanda: null,
  scelte: [],
  percorso: "/agenda/nuovo",
});
const appunto = (id, titolo, data) => ({
  id,
  destinazione: "promemoria",
  titolo: "Annota in Agenda",
  eseguibile: true,
  quanti: 1,
  incerto: false,
  aperto_da_ore: 0,
  aperto_da_giorni: 0,
  elementi: [impegno(id, titolo, data)],
});

const A1 = appunto("A1", "Dentista", "2026-09-14");
const A2 = appunto("A2", "Riunione col commercialista", "2026-09-15");
const A3 = appunto("A3", "Ritirare le tovaglie", "2026-09-16");

const schede = () =>
  screen.queryAllByRole("button", { name: /Butta l'appunto/i }).map((b) => b.closest("li"));
const schedaDi = (t) => schede().find((s) => within(s).queryAllByText(new RegExp(t)).length > 0);

const mostra = (cambiato = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppuntiInDashboard dettate={{ quante: 3, laPiuVecchia: 0 }} onCambiato={cambiato} />
    </MemoryRouter>,
  );
  return cambiato;
};

async function tocca(el) {
  await act(async () => {
    el.click();
  });
}

beforeEach(() => {
  for (const f of Object.values(finte)) f.mockReset();
  finte.approva.mockResolvedValue({ ok: true });
  finte.scarta.mockResolvedValue({ ok: true });
});
afterEach(() => vi.clearAllMocks());

describe("🔴 dalla Dashboard, una proposta per volta", () => {
  it("chiuso è la riga di sempre; aperto mostra le TRE schede", async () => {
    finte.appunti.mockResolvedValue([A1, A2, A3]);
    mostra();
    expect(screen.getByText(/3 appunti/)).toBeTruthy();
    expect(schede()).toHaveLength(0);
    // ⚠️ La lista si legge all'apertura, non prima.
    expect(finte.appunti).not.toHaveBeenCalled();

    await tocca(screen.getByRole("button", { name: /aspettano che tu li approvi/ }));
    await waitFor(() => expect(schede()).toHaveLength(3));
  });

  it("🔴 approvare il secondo e buttare il terzo lascia il primo intatto", async () => {
    finte.appunti.mockResolvedValue([A1, A2, A3]);
    const cambiato = mostra();
    await tocca(screen.getByRole("button", { name: /aspettano che tu li approvi/ }));
    await waitFor(() => expect(schede()).toHaveLength(3));

    finte.appunti.mockResolvedValue([A1, A3]);
    await tocca(within(schedaDi("commercialista")).getByRole("button", { name: /^Approva/ }));
    await waitFor(() => expect(schede()).toHaveLength(2));
    expect(finte.approva).toHaveBeenCalledTimes(1);
    expect(finte.approva).toHaveBeenCalledWith("A2");

    finte.appunti.mockResolvedValue([A1]);
    await tocca(within(schedaDi("tovaglie")).getByRole("button", { name: /Butta l'appunto/i }));
    await waitFor(() => expect(schede()).toHaveLength(1));
    expect(finte.scarta).toHaveBeenCalledTimes(1);
    expect(finte.scarta).toHaveBeenCalledWith("A3");

    const resta = schedaDi("Dentista");
    expect(within(resta).getByRole("button", { name: /^Approva$/ }).disabled).toBe(false);
    // ⚠️ E il conteggio della mattina si rinfresca dopo ogni gesto riuscito.
    expect(cambiato).toHaveBeenCalledTimes(2);
  });

  it("correggere: ogni scheda ha la SUA via a mano", async () => {
    finte.appunti.mockResolvedValue([A1, A2, A3]);
    mostra();
    await tocca(screen.getByRole("button", { name: /aspettano che tu li approvi/ }));
    await waitFor(() => expect(schede()).toHaveLength(3));
    const indirizzi = schede().map((s) =>
      within(s).getByRole("link", { name: /Fallo a mano/ }).getAttribute("href"),
    );
    expect(indirizzi).toEqual([
      "/agenda/nuovo?daVoce=el-A1",
      "/agenda/nuovo?daVoce=el-A2",
      "/agenda/nuovo?daVoce=el-A3",
    ]);
  });

  it("⚠️ un'approvazione rifiutata lo dice SULLA SCHEDA, e le altre non cambiano", async () => {
    finte.appunti.mockResolvedValue([A1, A2, A3]);
    finte.approva.mockRejectedValue(new Error("l'avviso è già passato"));
    const cambiato = mostra();
    await tocca(screen.getByRole("button", { name: /aspettano che tu li approvi/ }));
    await waitFor(() => expect(schede()).toHaveLength(3));

    await tocca(within(schedaDi("Dentista")).getByRole("button", { name: /^Approva/ }));
    await waitFor(() =>
      expect(within(schedaDi("Dentista")).getByText(/Non è stato scritto niente/)).toBeTruthy(),
    );
    expect(within(schedaDi("commercialista")).queryByText(/Non è stato scritto niente/)).toBeNull();
    expect(schede()).toHaveLength(3);
    expect(cambiato).not.toHaveBeenCalled();
  });

  it("⚠️ se la lista non si legge, lo dice e si può riprovare", async () => {
    finte.appunti.mockRejectedValueOnce(new Error("rete")).mockResolvedValue([A1]);
    mostra();
    await tocca(screen.getByRole("button", { name: /aspettano che tu li approvi/ }));
    await waitFor(() => expect(screen.getByText(/Non sono riuscito a leggere gli appunti/)).toBeTruthy());
    await tocca(screen.getByRole("button", { name: "Riprova" }));
    await waitFor(() => expect(schede()).toHaveLength(1));
  });

  it("🔴 una lettura vecchia che torna tardi non fa ricomparire schede già chiuse", async () => {
    // Trovato dalla revisione del diff: aprire, chiudere e riaprire mette in
    // volo due letture, e se la prima torna per ultima riporta la lista di
    // prima — con dentro schede che nel frattempo non ci sono più.
    let sblocca = () => {};
    finte.appunti
      .mockReturnValueOnce(
        new Promise((r) => {
          sblocca = () => r([A1, A2, A3]);
        }),
      )
      .mockResolvedValue([A1]);
    mostra();
    const riga = () => screen.getByRole("button", { name: /aspettano che tu li approvi/ });
    await tocca(riga()); // apre: lettura lenta
    await tocca(riga()); // chiude
    await tocca(riga()); // riapre: lettura veloce
    await waitFor(() => expect(schede()).toHaveLength(1));

    await act(async () => {
      sblocca();
    });
    expect(schede()).toHaveLength(1);
  });

  it("e porta a MEMO con la partenza, per tornare in Dashboard", async () => {
    finte.appunti.mockResolvedValue([A1]);
    mostra();
    await tocca(screen.getByRole("button", { name: /aspettano che tu li approvi/ }));
    expect(screen.getByRole("link", { name: /Apri MEMO voce/ }).getAttribute("href")).toBe("/detta");
  });
});
