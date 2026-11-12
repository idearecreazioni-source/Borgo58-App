import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ElencoAdattivo from "../../src/components/ElencoAdattivo";
import { campiImpegno } from "../../src/lib/calcoli/agenda";

// LE COLONNE DELLA TABELLA SONO QUELLE DI TUTTE LE RIGHE — 28/10/2026, dalla
// revisione del codice: un campo presente solo su alcune righe («Quando
// arrivo», «In lista da») spostava le celle sotto l'intestazione sbagliata.
// ⚠️ Dal 12/11/2026 «Quando arrivo» non c'è più (tolto con i promemoria per
//    luogo): la prova resta, e il campo che c'è solo su alcune righe è
//    «In lista da».

const righe = [
  { id: "a", title: "Recente", due_date: null, giorni_in_lista: 1 },
  { id: "b", title: "Vecchio", due_date: null, giorni_in_lista: 40 },
  { id: "c", title: "Con scadenza", due_date: "2026-11-20", giorni_in_lista: 40 },
];

describe("la tabella dell'elenco", () => {
  it("🔴 ogni riga ha tante celle quante intestazioni, e l'anzianità sta sotto «In lista da»", () => {
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
    const colonnaEta = intestazioni.indexOf("In lista da");
    expect(colonnaEta).toBeGreaterThan(0);
    expect(righeTabella[1].querySelectorAll("td")[colonnaEta].textContent).not.toBe("");
    expect(righeTabella[0].querySelectorAll("td")[colonnaEta].textContent).toBe("");
    expect(righeTabella[2].querySelectorAll("td")[colonnaEta].textContent).toBe("");
  });
});
