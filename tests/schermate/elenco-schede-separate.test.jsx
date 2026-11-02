import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ElencoAdattivo from "../../src/components/ElencoAdattivo";

const righe = [
  { id: "a", nome: "Primo" },
  { id: "b", nome: "Secondo" },
];
const props = {
  righe,
  chiave: (r) => r.id,
  titolo: (r) => r.nome,
  campi: () => [{ chiave: "x", etichetta: "Campo", valore: "v" }],
  aperta: (r) => <span>sotto {r.nome}</span>,
};

describe("schedeSeparate", () => {
  it("ogni riga sta nella sua scheda, con quello che si apre sotto", () => {
    const { container } = render(<ElencoAdattivo {...props} schedeSeparate />);
    const schede = container.querySelectorAll("[data-scheda-riga]");
    expect(schede).toHaveLength(2);
    expect(schede[0].textContent).toContain("sotto Primo");
    expect(schede[0].textContent).not.toContain("Secondo");
    expect(container.querySelectorAll("tr[data-riga]")).toHaveLength(2);
  });
  it("senza la proprietà resta la tabella unica di sempre", () => {
    const { container } = render(<ElencoAdattivo {...props} />);
    expect(container.querySelectorAll("[data-scheda-riga]")).toHaveLength(0);
    expect(container.querySelectorAll("tbody tr[data-riga]")).toHaveLength(2);
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });
});
