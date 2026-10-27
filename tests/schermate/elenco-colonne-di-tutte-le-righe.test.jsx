import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ElencoAdattivo from "../../src/components/ElencoAdattivo";
import { campiImpegno } from "../../src/lib/calcoli/agenda";

// LE COLONNE DELLA TABELLA SONO QUELLE DI TUTTE LE RIGHE — 28/10/2026, dalla
// revisione del codice: un campo presente solo su alcune righe («Quando
// arrivo», «In lista da») spostava le celle sotto l'intestazione sbagliata.

const righe = [
  { id: "a", title: "Senza luogo", due_date: null, giorni_in_lista: 1 },
  { id: "b", title: "Pesare la mamma", due_date: null, giorni_in_lista: 1, luogo: "casa" },
  { id: "c", title: "Vecchio", due_date: null, giorni_in_lista: 40 },
];

describe("la tabella dell'elenco", () => {
  it("🔴 ogni riga ha tante celle quante intestazioni, e il luogo sta sotto «Quando arrivo»", () => {
    const { container } = render(
      <ElencoAdattivo
        righe={righe}
        chiave={(t) => t.id}
        intestazioneTitolo="Task"
        titolo={(t) => t.title}
        campi={campiImpegno}
        azione={() => ({ etichetta: "rimanda", onClick: () => {} })}
      />,
    );
    const intestazioni = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    const righeTabella = [...container.querySelectorAll("tbody tr[data-riga]")];
    expect(righeTabella).toHaveLength(3);
    for (const tr of righeTabella) {
      expect(tr.querySelectorAll("td")).toHaveLength(intestazioni.length);
    }
    const colonnaLuogo = intestazioni.indexOf("Quando arrivo");
    expect(colonnaLuogo).toBeGreaterThan(0);
    expect(righeTabella[1].querySelectorAll("td")[colonnaLuogo].textContent).toBe("Casa");
    expect(righeTabella[0].querySelectorAll("td")[colonnaLuogo].textContent).toBe("");
  });
});
