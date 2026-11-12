import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppuntoDaApprovare from "../../src/components/AppuntoDaApprovare";

// 🔴 «CORREGGI» — 12/11/2026. Si prova cosa vede e cosa manda chi corregge
//    un pezzo di un appunto: il gruppo sbagliato di una voce nuova del piano
//    (il caso di Alessio). Correggere NON approva.
// ⚠️ SI MONTA IL SOLO COMPONENTE, come nelle altre prove degli appunti.

const APPUNTO = {
  id: "app-1",
  destinazione: "piano_voce_nuova",
  titolo: "Piano dell'investimento",
  eseguibile: true,
  quanti: 1,
  incerto: false,
  aperto_da_ore: 0,
  aperto_da_giorni: 0,
  elementi: [
    {
      id: "el-1",
      frase: "Aggiungi la voce Forno nel gruppo B",
      dati: { gruppo: "B", descrizione: "Forno", importo: 1200, aliquota_iva: 22, stato: "stimato" },
      sicuro: true,
      motivo: null,
      alternative: [],
      stato: "in_attesa",
      domanda: null,
      scelte: [],
      percorso: null,
    },
  ],
};

const mostra = (props = {}) => {
  const onCorreggi = props.onCorreggi ?? vi.fn().mockResolvedValue(true);
  const onApprova = vi.fn();
  render(
    <MemoryRouter>
      <AppuntoDaApprovare
        appunto={APPUNTO}
        occupato={false}
        esito={props.esito}
        onApprova={onApprova}
        onScarta={vi.fn()}
        onScegli={vi.fn()}
        onCorreggi={onCorreggi}
      />
    </MemoryRouter>,
  );
  return { onCorreggi, onApprova };
};

describe("Correggi su un appunto", () => {
  it("cambia il gruppo e manda i dati interi, senza approvare", async () => {
    const { onCorreggi, onApprova } = mostra();
    fireEvent.click(screen.getByRole("button", { name: /Correggi/ }));

    const gruppo = screen.getByLabelText("gruppo");
    // Il fuoco va sul primo campo, così da tastiera si comincia subito.
    expect(document.activeElement).toBe(gruppo);
    fireEvent.change(gruppo, { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la correzione" }));

    await waitFor(() => expect(onCorreggi).toHaveBeenCalledTimes(1));
    expect(onCorreggi).toHaveBeenCalledWith("el-1", {
      gruppo: "A", descrizione: "Forno", importo: 1200, aliquota_iva: 22, stato: "stimato",
    });
    expect(onApprova).not.toHaveBeenCalled();
    // A correzione riuscita il modulo si chiude e il fuoco torna su «Correggi».
    await waitFor(() => expect(screen.queryByRole("form", { name: /^Correggi i dati/ })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Correggi/ })));
  });

  it("un importo scritto male si dice subito, e non parte niente", () => {
    const { onCorreggi } = mostra();
    fireEvent.click(screen.getByRole("button", { name: /Correggi/ }));
    fireEvent.change(screen.getByLabelText("importo"), { target: { value: "milleduecento" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la correzione" }));
    expect(screen.getByRole("alert").textContent).toMatch(/deve essere un numero/);
    expect(onCorreggi).not.toHaveBeenCalled();
  });

  it("se la correzione non riesce, il modulo resta aperto con quello che si era scritto", async () => {
    const { onCorreggi } = mostra({ onCorreggi: vi.fn().mockResolvedValue(false) });
    fireEvent.click(screen.getByRole("button", { name: /Correggi/ }));
    fireEvent.change(screen.getByLabelText("descrizione"), { target: { value: "Forno grande" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la correzione" }));
    await waitFor(() => expect(onCorreggi).toHaveBeenCalled());
    expect(screen.getByLabelText("descrizione").value).toBe("Forno grande");
  });

  it("«Annulla» chiude senza mandare niente", () => {
    const { onCorreggi } = mostra();
    fireEvent.click(screen.getByRole("button", { name: /Correggi/ }));
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("form", { name: /^Correggi i dati/ })).toBeNull();
    expect(onCorreggi).not.toHaveBeenCalled();
  });

  it("su un appunto già approvato «Correggi» non c'è", () => {
    mostra({ esito: { stato: "fatta" } });
    expect(screen.queryByRole("button", { name: /Correggi/ })).toBeNull();
  });
});
