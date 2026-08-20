import { describe, it, expect } from "vitest";
import { campiCambiatiDalGesto, ilConsenso } from "../../src/lib/calcoli/ricarica.js";

// ⚠️ Queste prove misurano una DIFFERENZA che si producono da sole: la scheda
// sullo schermo e quella sul server dicono cose diverse, e si controlla quale
// delle due sopravvive campo per campo. Su due schede identiche non
// proverebbero niente (lezione del caso vuoto, 17/08).

describe("dopo un gesto si riprende dal server solo cio' che il gesto ha cambiato", () => {
  const sulloSchermo = {
    id: "abc",
    name: "Mario Rossi",
    email: "mario@nuova.it", // ⚠️ appena scritta, NON ancora salvata
    phone: "333",
    consenso_commerciale_il: null,
    consenso_come: null,
    puo_ricevere_commerciali: false,
  };
  const dalServer = {
    id: "abc",
    name: "Mario Rossi",
    email: "mario@vecchia.it", // il server ha ancora quella di prima
    phone: "333",
    consenso_commerciale_il: "2026-08-21",
    consenso_come: "a voce",
    puo_ricevere_commerciali: true,
  };

  it("l'email che si sta scrivendo NON viene sovrascritta", () => {
    const unito = { ...sulloSchermo, ...campiCambiatiDalGesto(dalServer, ilConsenso) };
    expect(unito.email).toBe("mario@nuova.it");
  });

  it("...e il consenso appena registrato ARRIVA", () => {
    const unito = { ...sulloSchermo, ...campiCambiatiDalGesto(dalServer, ilConsenso) };
    expect(unito.consenso_commerciale_il).toBe("2026-08-21");
    expect(unito.consenso_come).toBe("a voce");
    expect(unito.puo_ricevere_commerciali).toBe(true);
  });

  it("un campo del consenso che nascesse domani verrebbe ripreso da se'", () => {
    const conCampoNuovo = { ...dalServer, consenso_revocato_il: "2026-09-01" };
    const presi = campiCambiatiDalGesto(conCampoNuovo, ilConsenso);
    expect(presi.consenso_revocato_il).toBe("2026-09-01");
  });

  it("un campo che NON riguarda il consenso non viene mai ripreso", () => {
    const presi = campiCambiatiDalGesto(dalServer, ilConsenso);
    expect(presi).not.toHaveProperty("email");
    expect(presi).not.toHaveProperty("name");
    expect(presi).not.toHaveProperty("phone");
  });

  it("una lettura che non e' arrivata non cancella niente", () => {
    const unito = { ...sulloSchermo, ...campiCambiatiDalGesto(null, ilConsenso) };
    expect(unito).toEqual(sulloSchermo);
  });
});
