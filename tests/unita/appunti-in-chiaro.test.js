import { describe, expect, it } from "vitest";
import { datiInChiaro } from "../../src/lib/calcoli/appunti.js";

describe("i dettagli dell'appunto in parole", () => {
  it("scrive gli importi in euro e l'IVA come la legge il titolare", () => {
    expect(datiInChiaro({ importo: 1500, aliquota_iva: 22 })).toBe("importo: 1.500 € · IVA 22%");
  });

  it("un cambiamento dice da quanto a quanto, senza le chiavi di servizio", () => {
    const riga = datiInChiaro({
      voce_id: "voce-da-non-mostrare",
      voce_nome: "Forno",
      importo: 800,
      prima_previsto: 1500,
      aliquota_iva: 22,
    });
    expect(riga).toBe("voce del piano: Forno · previsto: da 1.500 € a 800 € · IVA 22%");
    expect(riga).not.toMatch(/voce-da-non-mostrare|prima previsto|\(euro\)/);
  });

  it("anche stato e nota cambiano in due estremi leggibili", () => {
    expect(
      datiInChiaro({ stato: "confermato", prima_stato: "stimato", nota: "nuova", prima_nota: "vecchia" }),
    ).toBe("stato: da stimato a confermato · nota: da vecchia a nuova");
  });
});
