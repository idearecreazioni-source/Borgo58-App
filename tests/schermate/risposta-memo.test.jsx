import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RispostaMemo from "../../src/components/RispostaMemo";
import { componiRisposta } from "../../src/lib/calcoli/domande";
import { NON_LETTO } from "../../src/lib/calcoli/letture";

// =====================================================================
// COSA VEDE CHI HA FATTO UNA DOMANDA A MEMO
// =====================================================================
// ⚠️ La regola pura è provata altrove (`tests/unita/domande-memo.test.js`):
//    qui si guarda **quello che finisce a schermo**, che è una domanda
//    diversa. Le due cose che si possono affermare senza un occhio: che il
//    riquadro dice di non aver scritto niente, e che non c'è nessun gesto
//    che scriva.
//
// ⚠️ SI MONTA IL SOLO RIQUADRO, non la schermata MEMO: montare la pagina
//    intera fa scadere il tempo alle prove degli altri file di questa
//    cartella — misurato il 06/09.

const mostra = (risposta, props = {}) =>
  render(
    <MemoryRouter>
      <RispostaMemo titolo="Quanto olio ho?" testoDetto="quanto olio ho" risposta={risposta} {...props} />
    </MemoryRouter>,
  );

describe("il riquadro di una risposta", () => {
  it("🔴 dice sempre che non ha scritto niente", () => {
    // ⚠️ Chi parla a MEMO è abituato a vedersi comparire un appunto da
    //    approvare: il silenzio si legge «forse ha segnato qualcosa».
    mostra(componiRisposta({ chiede: "cosa_manca" }, { giacenze: [] }));
    expect(screen.getByText(/non ho scritto niente/i)).toBeTruthy();
  });

  it("mostra la risposta e il collegamento per andarla a controllare", () => {
    mostra(
      componiRisposta(
        { chiede: "quanto_ho", soggetto: "olio" },
        {
          giacenze: [
            {
              ingredient_id: "i1",
              ingredient_name: "Olio extravergine",
              unit: "l",
              current_quantity: 12.5,
              stock_minimum_threshold: null,
              below_threshold: false,
              nearest_expiry: null,
              tenuto_in_magazzino: true,
            },
          ],
        },
      ),
    );
    expect(screen.getByText(/12,5 l/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Apri il Magazzino/ }).getAttribute("href")).toBe(
      "/magazzino",
    );
  });

  it("🔴 una lettura fallita si vede che è un «non lo so», e ha comunque la via d'uscita", () => {
    mostra(componiRisposta({ chiede: "quanto_ho", soggetto: "olio" }, { giacenze: NON_LETTO }));
    expect(screen.getByText(/non lo so/i)).toBeTruthy();
    // ⚠️ Nessun numero a schermo: è tutto il punto.
    expect(screen.queryByText(/\d+,\d+ l/)).toBeNull();
    expect(screen.getByRole("link", { name: /Apri il Magazzino/ })).toBeTruthy();
  });

  it("🔴 NON C'È NESSUN PULSANTE CHE SCRIVA", () => {
    // ⚠️ La forma più diretta di «una domanda non modifica dati»: sul
    //    riquadro di una risposta i pulsanti sono zero. Il giorno che ne
    //    comparisse uno, questa prova lo dice.
    mostra(componiRisposta({ chiede: "agenda_oggi" }, { impegni: [] }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("con più candidati i pulsanti ci sono, e non scrivono: RICHIEDONO", () => {
    const scelto = vi.fn();
    mostra(
      componiRisposta(
        { chiede: "quanto_ho", soggetto: "olio" },
        {
          giacenze: [
            { ingredient_id: "i1", ingredient_name: "Olio extravergine", unit: "l", current_quantity: 12 },
            { ingredient_id: "i2", ingredient_name: "Olio di semi", unit: "l", current_quantity: 2 },
          ],
        },
      ),
      { onScegli: scelto },
    );
    const bottoni = screen.getAllByRole("button");
    expect(bottoni).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Olio di semi" }));
    // ⚠️ Passa il CANDIDATO intero, identificativo compreso: col solo nome
    //    due prodotti chiamati uguale resterebbero indistinguibili.
    expect(scelto).toHaveBeenCalledWith(
      expect.objectContaining({ chiave: "i2", soggetto: "Olio di semi" }),
    );
  });

  it("il limite si legge insieme alla risposta, non staccato", () => {
    mostra(
      componiRisposta(
        { chiede: "cosa_manca" },
        {
          giacenze: [
            { ingredient_id: "i1", ingredient_name: "Sale", unit: "kg", current_quantity: 3 },
          ],
        },
      ),
    );
    expect(screen.getByText(/Non manca niente/)).toBeTruthy();
    expect(screen.getByText(/non ha una scorta minima/)).toBeTruthy();
  });

  it("una domanda che non sa fare elenca quelle che sa, senza inventare", () => {
    mostra(componiRisposta({ chiede: "quanto_costa", soggetto: "carbonara" }, {}));
    expect(screen.getByText(/non la so ancora fare/i)).toBeTruthy();
    expect(screen.getByText("Quanto olio ho?")).toBeTruthy();
  });
});

describe("un elenco lungo, a schermo", () => {
  it("🔴 si vede che è tagliato, e dove sono tutte", () => {
    // 🔴 Misurato col modello vero: «cosa scade?» rispondeva con 68 righe.
    //    Il taglio è dichiarato — un elenco accorciato in silenzio è la
    //    famiglia di difetti che questo progetto insegue dal 19/08.
    const partite = Array.from({ length: 20 }, (_, i) => ({
      lotto_id: `l${i}`,
      ingrediente: `Roba ${i}`,
      quantita: 1,
      unita: "kg",
      scadenza: "2026-09-10",
      giorni_mancanti: 2,
      da_segnalare: true,
    }));
    mostra(componiRisposta({ chiede: "cosa_scade" }, { partite }));
    expect(screen.getByText(/20 partite sono in scadenza/)).toBeTruthy();
    expect(screen.getByText(/e altre 14/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});
