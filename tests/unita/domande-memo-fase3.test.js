import { describe, expect, it } from "vitest";
import {
  DOMANDE_CHE_SO,
  RIGHE_MOSTRATE,
  componiRisposta,
} from "../../src/lib/calcoli/domande";
import { NON_LETTO } from "../../src/lib/calcoli/letture";

// =====================================================================
// QUELLO CHE DEVE USCIRE — le domande della fase 3
// =====================================================================
// 🔴 QUELLO CHE SI PROVA QUI NON È CHE LA RISPOSTA ESCE: è **quale delle
//    cinque** esce, e soprattutto che nessuno di questi numeri venga
//    calcolato da MEMO. Quanto si deve su una fattura lo dice
//    `da_pagare`, che il database calcola: se la regola lo rifacesse, il
//    giorno che le due sottrazioni divergono MEMO e la schermata delle
//    fatture direbbero due debiti diversi sulla stessa fattura.
//
// ⚠️ NESSUNA DI QUESTE PROVE TOCCA LA RETE: la regola riceve i dati già
//    letti, quindi i casi che contano — la lettura caduta, il rifiuto del
//    portiere, l'elenco vuoto — si costruiscono qui.

const OGGI = "2026-09-08";

const fattura = (i, extra = {}) => ({
  id: `f${i}`,
  supplier: { id: `s${i}`, name: `Fornitore ${i}` },
  amount: 100,
  da_pagare: 100,
  note_scalate: 0,
  due_date: "2026-09-20",
  status: "da_pagare",
  ...extra,
});

// =====================================================================
describe("quali fatture devo pagare", () => {
  it("elenca il netto e dice il totale", () => {
    const r = componiRisposta(
      { chiede: "fatture_da_pagare" },
      { fatture: [fattura(1), fattura(2, { da_pagare: 50 })], oggi: OGGI },
    );
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("2 fatture");
    expect(r.frase).toContain("150,00");
    expect(r.righe[0].testo).toContain("Fornitore 1");
    expect(r.a).toBe("/fatture-fornitori");
  });

  it("🔴 il numero della riga è `da_pagare`, NON l'importo lordo", () => {
    // 🔴 Regola del 17/08: «fattura 250 · nota −40 · da pagare 210».
    //    Mostrare il lordo fa pagare più del dovuto, ed è la stessa forma
    //    del campo che cade in silenzio.
    const r = componiRisposta(
      { chiede: "fatture_da_pagare" },
      { fatture: [fattura(1, { amount: 250, da_pagare: 210, note_scalate: 40 })], oggi: OGGI },
    );
    expect(r.righe[0].testo).toContain("210,00");
    expect(r.righe[0].testo).not.toContain("250,00");
    expect(r.frase).toContain("210,00");
    // ⚠️ E la nota già scalata si dichiara: senza, «210» su una fattura da
    //    250 sembra un importo sbagliato.
    expect(r.limite).toMatch(/nota di credito già scalata/i);
    expect(r.limite).toMatch(/NETTO/);
  });

  it("🔴 il totale è di TUTTE, anche quando le righe mostrate sono sei", () => {
    // 🔴 Regola del 17/08: i totali non si filtrano. Un «da pagare» che si
    //    rimpicciolisce perché l'elenco è tagliato somiglia in tutto a un
    //    debito più piccolo.
    const molte = Array.from({ length: 20 }, (_, i) => fattura(i, { da_pagare: 10 }));
    const r = componiRisposta({ chiede: "fatture_da_pagare" }, { fatture: molte, oggi: OGGI });
    expect(r.righe).toHaveLength(RIGHE_MOSTRATE);
    expect(r.troppe).toBe(20 - RIGHE_MOSTRATE);
    expect(r.frase).toContain("200,00");
    expect(r.frase).toContain("20 fatture");
  });

  it("🔴 una scaduta si dice scaduta, non «entro il»", () => {
    // ⚠️ È l'unica cosa dell'elenco che cambia quello che si fa oggi:
    //    sepolta in mezzo alle altre si legge come la prossima.
    const r = componiRisposta(
      { chiede: "fatture_da_pagare" },
      { fatture: [fattura(1, { due_date: "2026-09-04" })], oggi: OGGI },
    );
    expect(r.righe[0].testo).toMatch(/scaduta da 4 giorni/);
    expect(r.righe[0].testo).not.toMatch(/entro il/);
    expect(r.limite).toMatch(/già scaduta/);
  });

  it("...e una che scade oggi NON è scaduta", () => {
    // ⚠️ La metà che discrimina: un confronto sbagliato di un giorno
    //    marcherebbe come in ritardo tutto quello che scade adesso.
    const r = componiRisposta(
      { chiede: "fatture_da_pagare" },
      { fatture: [fattura(1, { due_date: OGGI })], oggi: OGGI },
    );
    expect(r.righe[0].testo).toMatch(/entro il/);
    expect(r.limite ?? "").not.toMatch(/già scaduta/);
  });

  it("una fattura senza scadenza lo dice, invece di inventarne una", () => {
    const r = componiRisposta(
      { chiede: "fatture_da_pagare" },
      { fatture: [fattura(1, { due_date: null })], oggi: OGGI },
    );
    expect(r.righe[0].testo).toMatch(/senza scadenza/);
  });

  it("🔴 «non c'è niente da pagare» NON è «non ho letto»", () => {
    expect(componiRisposta({ chiede: "fatture_da_pagare" }, { fatture: [], oggi: OGGI }).stato).toBe(
      "risposta",
    );
    const muta = componiRisposta({ chiede: "fatture_da_pagare" }, { fatture: NON_LETTO });
    expect(muta.stato).toBe("non_lo_so");
    expect(muta.frase).not.toMatch(/\d/);
    expect(muta.a).toBe("/fatture-fornitori");
  });

  it("e dichiara che vede solo quello che è stato registrato", () => {
    // ⚠️ Una fattura arrivata e non ancora inserita non esiste per il
    //    gestionale: senza dirlo, «devi pagare 150 €» si legge come il
    //    debito totale del locale.
    const r = componiRisposta({ chiede: "fatture_da_pagare" }, { fatture: [fattura(1)], oggi: OGGI });
    expect(r.limite).toMatch(/registrate nel gestionale/i);
  });
});

// =====================================================================
describe("le scadenze da pagare", () => {
  const s = (i, extra = {}) => ({
    id: `x${i}`,
    descrizione: `Scadenza ${i}`,
    importo: 500,
    scade_il: "2026-09-16",
    ogni_mesi: 0,
    ...extra,
  });

  it("le elenca col totale, e dice quando", () => {
    const r = componiRisposta(
      { chiede: "scadenze_previste" },
      { scadenze: [s(1), s(2, { importo: 750 })], oggi: OGGI },
    );
    expect(r.frase).toContain("2 scadenze");
    expect(r.frase).toContain("1.250,00");
    expect(r.a).toBe("/cassa/previsione");
  });

  it("una che torna ogni mese lo dice", () => {
    const r = componiRisposta(
      { chiede: "scadenze_previste" },
      { scadenze: [s(1, { ogni_mesi: 1 })], oggi: OGGI },
    );
    expect(r.righe[0].testo).toMatch(/ogni mese/);
  });

  it("🔴 e dichiara SEMPRE che gli stipendi non ci sono", () => {
    // 🔴 È l'avvertenza che «Ce la faccio?» porta dal 15/08: il costo del
    //    personale arriva dal prospetto di Gianna e non passa da nessun
    //    modulo. Senza, un elenco corto si legge come una promessa.
    for (const scadenze of [[], [s(1)]]) {
      const r = componiRisposta({ chiede: "scadenze_previste" }, { scadenze, oggi: OGGI });
      expect(r.limite).toMatch(/stipendi/i);
      // ⚠️ E che le fatture si contano a parte: due elenchi diversi
      //    sommati darebbero un numero che non compare in nessuna delle
      //    due schermate.
      expect(r.limite).toMatch(/fatture/i);
    }
  });

  it("una lettura caduta non diventa «non hai scadenze»", () => {
    expect(componiRisposta({ chiede: "scadenze_previste" }, { scadenze: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("cosa ho ordinato", () => {
  const o = (i, extra = {}) => ({
    id: `o${i}`,
    fornitore: `Fornitore ${i}`,
    stato: "inviato",
    righe: 3,
    inviato_il: "2026-09-05T10:00:00+00:00",
    ...extra,
  });

  it("elenca solo quelli che aspettano", () => {
    const r = componiRisposta(
      { chiede: "ordini_in_corso" },
      { ordini: [o(1), o(2, { stato: "ricevuto" }), o(3, { stato: "annullato" })], oggi: OGGI },
    );
    expect(r.righe).toHaveLength(1);
    expect(r.limite).toMatch(/2 ordini sono/);
    expect(r.a).toBe("/magazzino/ordini");
  });

  it("dice da quanti giorni aspetta", () => {
    const r = componiRisposta({ chiede: "ordini_in_corso" }, { ordini: [o(1)], oggi: OGGI });
    expect(r.righe[0].testo).toMatch(/da 3 giorni/);
  });

  it("🔴 e dichiara che cosa vuol dire «inviato»", () => {
    // 🔴 Dal 14/08: «inviato» vuol dire «ho aperto WhatsApp con questo
    //    testo». Il gestionale non può sapere se il messaggio è partito, e
    //    MEMO non può dirlo con più sicurezza di quanta ne abbia.
    const r = componiRisposta({ chiede: "ordini_in_corso" }, { ordini: [o(1)], oggi: OGGI });
    expect(r.limite).toMatch(/WhatsApp/);
    expect(r.limite).toMatch(/non lo sa/);
  });

  it("nessun ordine in attesa e nessuna lettura non si dicono uguale", () => {
    expect(componiRisposta({ chiede: "ordini_in_corso" }, { ordini: [], oggi: OGGI }).stato).toBe(
      "risposta",
    );
    expect(componiRisposta({ chiede: "ordini_in_corso" }, { ordini: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("le note di credito da usare", () => {
  const c = (i, extra = {}) => ({
    supplier_id: `s${i}`,
    fornitore: `Fornitore ${i}`,
    residuo: 30,
    quante: 1,
    ...extra,
  });

  it("dice quanto c'è e con chi", () => {
    const r = componiRisposta(
      { chiede: "crediti_fornitore" },
      { crediti: [c(1), c(2, { residuo: 70, quante: 2 })] },
    );
    expect(r.frase).toContain("100,00");
    expect(r.righe[1].testo).toContain("2 note");
    expect(r.a).toBe("/fatture-fornitori");
  });

  it("🔴 e dichiara che quel credito NON è denaro disponibile", () => {
    // 🔴 Un credito vale solo con quel fornitore: si scala dalla sua
    //    prossima fattura, non si incassa. Senza dirlo, quel totale si
    //    legge come soldi che si possono spendere altrove.
    const r = componiRisposta({ chiede: "crediti_fornitore" }, { crediti: [c(1)] });
    expect(r.limite).toMatch(/solo con quel fornitore/i);
    expect(r.limite).toMatch(/non si incassa/i);
  });

  it("nessun credito e nessuna lettura non si dicono uguale", () => {
    expect(componiRisposta({ chiede: "crediti_fornitore" }, { crediti: [] }).stato).toBe("risposta");
    expect(componiRisposta({ chiede: "crediti_fornitore" }, { crediti: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("🔴 la rete che tiene insieme tutte le domande", () => {
  it("ognuna ha una destinazione vera", () => {
    for (const [chiede, d] of Object.entries(DOMANDE_CHE_SO)) {
      const r = componiRisposta({ chiede, soggetto: null }, {});
      expect(typeof r.a, chiede).toBe("string");
      expect(r.a.startsWith("/"), chiede).toBe(true);
      expect(r.apri, chiede).toBeTruthy();
      expect(d.dove, chiede).toBeTruthy();
    }
  });

  it("🔴 e NESSUNA, senza dati letti, tira fuori una cifra", () => {
    // 🔴 È la proprietà che rende innocuo il caso peggiore: l'assistente
    //    capisce la domanda e il gestionale non riesce a leggere niente.
    //    Qualunque cifra comparisse lì sarebbe inventata — e plausibile,
    //    che in questo progetto è la forma di errore più cara.
    // ⚠️ NON si pretende che siano tutte «non lo so»: «non c'è nessuna
    //    fattura da pagare» è una risposta vera e va data. Quello che non
    //    deve esistere è il NUMERO.
    for (const chiede of Object.keys(DOMANDE_CHE_SO)) {
      const r = componiRisposta({ chiede, soggetto: "x" }, {});
      const tutto = [r.frase, r.limite ?? "", ...r.righe.map((x) => x.testo)].join(" ");
      expect(tutto, chiede).not.toMatch(/\d/);
    }
  });

  it("🔴 e le quattro nuove non offrono nessun gesto che scriva", () => {
    // ⚠️ La forma più diretta di «una domanda non modifica niente»: qui i
    //    dati sono soldi, e un pulsante «paga» sarebbe la cosa più facile
    //    da aggiungere per comodità.
    for (const chiede of [
      "fatture_da_pagare",
      "scadenze_previste",
      "ordini_in_corso",
      "crediti_fornitore",
    ]) {
      const r = componiRisposta({ chiede }, { fatture: [], scadenze: [], ordini: [], crediti: [] });
      expect(r.candidati, chiede).toEqual([]);
      expect(Object.keys(r), chiede).not.toContain("azione");
    }
  });
});
