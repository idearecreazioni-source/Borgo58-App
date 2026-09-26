import { describe, expect, it } from "vitest";
import {
  DOMANDE_CHE_SO,
  RIGHE_MOSTRATE,
  componiRisposta,
} from "../../src/lib/calcoli/domande";
import { NON_LETTO } from "../../src/lib/calcoli/letture";

// =====================================================================
// LE DOMANDE DELLA FASE 2 — e i casi storti, che sono quelli che contano
// =====================================================================
// 🔴 QUELLO CHE SI PROVA QUI NON È CHE LA RISPOSTA ESCE: è **quale delle
//    cinque** esce. Una lettura fallita non può diventare uno zero, un
//    elenco filtrato deve dichiarare quello che ha lasciato fuori, e due
//    liste diverse non si mescolano mai.
//
// ⚠️ NESSUNA DI QUESTE PROVE TOCCA LA RETE: la regola riceve i dati già
//    letti, quindi i casi che contano — la lettura caduta, il rifiuto del
//    portiere, l'elenco vuoto — si costruiscono qui invece di doverli far
//    accadere su un database.

const senzaScrivere = (r) => {
  // ⚠️ La forma più diretta di «una domanda non modifica niente»: la
  //    risposta non porta nessun gesto che scriva. I candidati sono
  //    l'eccezione, e RIFANNO la domanda — non la eseguono.
  expect(Object.keys(r)).not.toContain("azione");
  expect(Object.keys(r)).not.toContain("approva");
  return r;
};

// =====================================================================
describe("quanti soldi ci sono", () => {
  const saldo = {
    contante_atteso: 1352.49,
    di_cui_non_tuo: 199.45,
    saldo_banca: 10895.32,
    ultimo_conteggio_il: "2026-07-28",
    avvertenza:
      "Il contante atteso comprende la parte in contanti di 3 conti chiusi. ATTENZIONE: di questo contante 199,45 euro sono mance del personale, non tuoi.",
  };

  it("dice i due saldi, e NON li somma", () => {
    // ⚠️ Regola del 13/08: il contante è nel cassetto, la banca è in banca.
    //    Un totale unico farebbe credere di poter pagare in contanti
    //    quello che sta sul conto.
    const r = senzaScrivere(componiRisposta({ chiede: "saldo_cassa" }, { saldo }));
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("1.352,49");
    expect(r.frase).toContain("10.895,32");
    expect(r.frase).not.toContain("12.247");
  });

  it("🔴 l'avvertenza è QUELLA DEL DATABASE, non una riscritta qui", () => {
    // 🔴 Regola del 15/08: il numero e il suo limite viaggiano insieme.
    //    Se MEMO se la riscrivesse, il giorno che la Cassa cambia
    //    avvertenza il gestionale ne racconterebbe due versioni.
    const r = componiRisposta({ chiede: "saldo_cassa" }, { saldo });
    expect(r.limite).toBe(saldo.avvertenza);
    expect(r.limite).toContain("mance del personale");
  });

  it("🔴 una lettura caduta NON diventa uno zero", () => {
    // ⚠️ È anche il caso del portiere: `saldo_tesoreria` RIFIUTA a chi non
    //    è titolare, quindi chi non lo è arriva qui — e deve leggere «non
    //    lo so», mai «zero euro».
    for (const caduta of [NON_LETTO, null]) {
      const r = componiRisposta({ chiede: "saldo_cassa" }, { saldo: caduta });
      expect(r.stato).toBe("non_lo_so");
      expect(r.frase).not.toMatch(/\d/);
      // ⚠️ E la via d'uscita c'è comunque: un rifiuto senza gesto d'uscita
      //    è un vicolo cieco.
      expect(r.a).toBe("/cassa");
    }
  });
});

// =====================================================================
describe("gli ultimi movimenti di cassa", () => {
  const mov = (i, extra = {}) => ({
    id: `m${i}`,
    movement_date: "2026-09-05",
    amount: 30,
    direction: "uscita",
    business_purpose: null,
    causale: { id: "c1", label: "Spesa alimentare" },
    ...extra,
  });

  it("li elenca dal più recente, col verso in parole", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "ultimi_movimenti" },
        { movimenti: [mov(1), mov(2, { direction: "entrata", amount: 120 })], giorni: 30 },
      ),
    );
    expect(r.stato).toBe("risposta");
    expect(r.righe[0].testo).toContain("usciti");
    expect(r.righe[1].testo).toContain("entrati");
    expect(r.righe[0].testo).toContain("Spesa alimentare");
    expect(r.a).toBe("/cassa/prima-nota");
  });

  it("🔴 «non c'è niente negli ultimi 30 giorni» NON è «la Prima nota è vuota»", () => {
    // 🔴 La prima frase parla della finestra, la seconda del gestionale.
    //    Dirle uguali sarebbe far passare il limite di una lettura per un
    //    fatto del locale.
    const r = componiRisposta({ chiede: "ultimi_movimenti" }, { movimenti: [], giorni: 30 });
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("30 giorni");
    expect(r.limite).toContain("30 giorni");
  });

  it("🔴 la finestra si dichiara SEMPRE, anche quando la risposta è piena", () => {
    // ⚠️ Un elenco di sei movimenti senza dire fin dove si è guardato si
    //    legge «questi sono tutti».
    const r = componiRisposta({ chiede: "ultimi_movimenti" }, { movimenti: [mov(1)], giorni: 30 });
    expect(r.limite).toContain("30 giorni");
  });

  it("🔴 e dichiara che sono i soldi di Borgo 58, non quelli della tasca", () => {
    // 🔴 Dal 30/08 la tasca è un soggetto a sé: mescolarli direbbe che il
    //    locale ha speso quello che ha speso Alessio.
    const r = componiRisposta({ chiede: "ultimi_movimenti" }, { movimenti: [mov(1)], giorni: 30 });
    expect(r.limite).toMatch(/tasca/i);
  });

  it("un elenco lungo si taglia e lo dichiara", () => {
    const tanti = Array.from({ length: 20 }, (_, i) => mov(i));
    const r = componiRisposta({ chiede: "ultimi_movimenti" }, { movimenti: tanti, giorni: 30 });
    expect(r.righe).toHaveLength(RIGHE_MOSTRATE);
    expect(r.troppe).toBe(20 - RIGHE_MOSTRATE);
    expect(r.frase).toContain("20");
  });

  it("una lettura caduta non diventa «nessun movimento»", () => {
    const r = componiRisposta({ chiede: "ultimi_movimenti" }, { movimenti: NON_LETTO, giorni: 30 });
    expect(r.stato).toBe("non_lo_so");
  });

  it("🔴 e senza la finestra non si dà nessun elenco", () => {
    // 🔴 Regola del 15/08 applicata alla lettera: il numero e il suo
    //    limite viaggiano insieme. Se non si sa fin dove si è guardato,
    //    sei movimenti si leggono «questi sono tutti».
    for (const giorni of [undefined, null, 0]) {
      const r = componiRisposta(
        { chiede: "ultimi_movimenti" },
        { movimenti: [mov(1)], giorni },
      );
      expect(r.stato, String(giorni)).toBe("non_lo_so");
    }
  });
});

// =====================================================================
describe("cosa devo comprare", () => {
  const riga = (i, extra = {}) => ({
    id: `r${i}`,
    nome: `Roba ${i}`,
    unita: "kg",
    quantita_da_comprare: 2,
    stato: "da_comprare",
    fornitore: "Mililli",
    rientrata: false,
    ...extra,
  });

  it("elenca solo le righe ancora DA comprare", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "cosa_comprare" },
        { lista: [riga(1), riga(2, { stato: "ordinata" }), riga(3, { stato: "acquistato" })] },
      ),
    );
    expect(r.righe).toHaveLength(1);
    expect(r.frase).toContain("una cosa");
  });

  it("🔴 e dichiara quante ha lasciato fuori", () => {
    // ⚠️ Senza, «c'è una cosa da comprare» su una lista di trenta righe
    //    sembrerebbe la fotografia della lista intera.
    const r = componiRisposta(
      { chiede: "cosa_comprare" },
      { lista: [riga(1), riga(2, { stato: "ordinata" }), riga(3, { stato: "ordinata" })] },
    );
    expect(r.limite).toContain("2 righe");
    expect(r.limite).toMatch(/ordinate o comprate/);
  });

  it("...e al singolare la frase concorda", () => {
    // ⚠️ Una riga sola diceva «Altre 1 righe sono già ordinata o
    //    comprata»: due accordi sbagliati in cinque parole. Si legge in
    //    servizio, e una frase storta fa dubitare del numero accanto.
    const r = componiRisposta(
      { chiede: "cosa_comprare" },
      { lista: [riga(1), riga(2, { stato: "ordinata" })] },
    );
    expect(r.limite).toContain("Un'altra riga è già ordinata o comprata");
  });

  it("🔴 una riga RIENTRATA si dice: la merce è arrivata da un'altra parte", () => {
    // ⚠️ Tacerlo manderebbe a comprare due volte la stessa cosa.
    const r = componiRisposta(
      { chiede: "cosa_comprare" },
      { lista: [riga(1, { rientrata: true }), riga(2)] },
    );
    expect(r.limite).toMatch(/di nuovo abbastanza/i);
  });

  it("lista vuota e lista non letta non si dicono uguale", () => {
    expect(componiRisposta({ chiede: "cosa_comprare" }, { lista: [] }).stato).toBe("risposta");
    expect(componiRisposta({ chiede: "cosa_comprare" }, { lista: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("🔴 le due liste della spesa restano DUE", () => {
  const spesa = [{ id: "s1", nome: "Pomodori", unita: "kg", quantita_da_comprare: 5, stato: "da_comprare" }];
  const spicciola = [{ id: "p1", articolo: "Detersivo", categoria: "pulizia", nel_carrello: false }];

  it("chi chiede la lista della spesa non si vede la spicciola", () => {
    // 🔴 È la decisione della #36 (SPEC-0012) letta dal lato delle
    //    domande: una risposta che sommasse le due direbbe un numero che
    //    non compare in nessuna delle due schermate.
    const r = componiRisposta({ chiede: "cosa_comprare" }, { lista: spesa, spicciola });
    expect(r.righe.map((x) => x.testo).join(" ")).toContain("Pomodori");
    expect(r.righe.map((x) => x.testo).join(" ")).not.toContain("Detersivo");
    expect(r.a).toBe("/magazzino/lista-spesa");
  });

  it("e viceversa, con la sua destinazione", () => {
    const r = componiRisposta({ chiede: "cosa_spicciola" }, { lista: spesa, spicciola });
    expect(r.righe.map((x) => x.testo).join(" ")).toContain("Detersivo");
    expect(r.righe.map((x) => x.testo).join(" ")).not.toContain("Pomodori");
    expect(r.a).toBe("/magazzino/spesa-spicciola");
  });

  it("quello che è già nel carrello non si elenca, e si conta", () => {
    const r = componiRisposta(
      { chiede: "cosa_spicciola" },
      { spicciola: [spicciola[0], { id: "p2", articolo: "Sapone", nel_carrello: true }] },
    );
    expect(r.righe).toHaveLength(1);
    expect(r.limite).toContain("già nel carrello");
  });
});

// =====================================================================
describe("cosa c'è questa settimana", () => {
  const t = (id, corsia, giorni, extra = {}) => ({
    id,
    title: `Impegno ${id}`,
    corsia,
    giorni_alla_scadenza: giorni,
    due_date: "2026-09-11",
    ...extra,
  });

  it("prende la corsia dell'Agenda, non una finestra scritta qui", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "agenda_prossime" },
        { impegni: [t("a", "questa_settimana", 3), t("b", "piu_avanti", 40), t("c", "quando_capita", null)] },
      ),
    );
    expect(r.righe).toHaveLength(1);
    expect(r.righe[0].chiave).toBe("a");
  });

  it("🔴 quelli di OGGI restano fuori, ma si dicono", () => {
    // ⚠️ Ripeterli qui farebbe sembrare che ci sia più roba di quanta ce
    //    n'è; tacerli farebbe leggere «questa settimana hai una cosa»
    //    mentre oggi ce ne sono tre.
    const r = componiRisposta(
      { chiede: "agenda_prossime" },
      { impegni: [t("a", "questa_settimana", 3), t("b", "questa_settimana", 0)] },
    );
    expect(r.righe).toHaveLength(1);
    expect(r.limite).toContain("oggi");
  });

  it("🔴 un impegno SENZA data non conta come «oggi»", () => {
    // 🔴 È il difetto misurato il 07/09: `Number(null)` vale zero, e
    //    quindici impegni senza scadenza risultavano di oggi.
    const r = componiRisposta(
      { chiede: "agenda_prossime" },
      { impegni: [t("a", "questa_settimana", 3), t("z", "quando_capita", null, { due_date: null })] },
    );
    expect(r.limite ?? "").not.toContain("oggi");
  });

  it("il ritardo si dichiara anche quando non c'è niente questa settimana", () => {
    const r = componiRisposta(
      { chiede: "agenda_prossime" },
      { impegni: [t("x", "in_ritardo", -4)] },
    );
    expect(r.frase).toMatch(/non hai altro/i);
    expect(r.limite).toContain("ritardo");
  });

  it("una lettura caduta non diventa un'agenda vuota", () => {
    expect(componiRisposta({ chiede: "agenda_prossime" }, { impegni: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("cosa serve per un piatto", () => {
  const ric = (id, name) => ({ id, name, pronta_per_carta: true, in_carta: false });
  const ing = (nome, extra = {}) => ({
    recipe_ingredient_id: `ri-${nome}`,
    ingredient_name: nome,
    quantity: 0.24,
    unit: "kg",
    ...extra,
  });

  it("senza soggetto chiede di quale piatto, non risponde a caso", () => {
    const r = componiRisposta({ chiede: "ingredienti_ricetta" }, { ricette: [ric("r1", "Carbonara")] });
    expect(r.stato).toBe("chiarimento");
    expect(r.frase).toBe(DOMANDE_CHE_SO.ingredienti_ricetta.chiarimento);
  });

  it("con più candidati CHIEDE quale, non ne sceglie una", () => {
    const r = componiRisposta(
      { chiede: "ingredienti_ricetta", soggetto: "pasta" },
      { ricette: [ric("r1", "Pasta alla norma"), ric("r2", "Pasta con le sarde")] },
    );
    expect(r.stato).toBe("scegli");
    expect(r.candidati).toHaveLength(2);
    expect(r.righe).toHaveLength(0);
  });

  it("con la ricetta sola elenca gli ingredienti, e segna le preparazioni", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "ingredienti_ricetta", soggetto: "carbonara" },
        {
          ricette: [ric("r1", "Carbonara")],
          ingredienti: [ing("Guanciale"), ing("Soffritto", { is_preparation: true })],
        },
      ),
    );
    expect(r.frase).toContain("2 cose");
    // ⚠️ La quantità si scrive come la scrive il resto del gestionale —
    //    240 g, non 0,24 kg — perché è `qtaConUnita` a deciderlo, e non
    //    una seconda formattazione nata qui.
    expect(r.righe[0].testo).toContain("240 g");
    expect(r.righe[1].testo).toContain("(preparazione)");
    expect(r.a).toBe("/ricettario/ricette/r1");
  });

  it("🔴 e non esce NESSUN prezzo", () => {
    // 🔴 La domanda è «cosa ci va dentro», non «quanto costa». La lettura
    //    passa dalla vista `_display`, che i costi non ce li ha: qui si
    //    controlla che nemmeno la frase se li inventi.
    const r = componiRisposta(
      { chiede: "ingredienti_ricetta", soggetto: "carbonara" },
      { ricette: [ric("r1", "Carbonara")], ingredienti: [ing("Guanciale", { unit_cost: 18.4 })] },
    );
    const tutto = [r.frase, ...r.righe.map((x) => x.testo), r.limite ?? ""].join(" ");
    expect(tutto).not.toContain("18,4");
    expect(tutto).not.toContain("€");
  });

  it("🔴 «non ha ingredienti» NON è «non ho letto»", () => {
    const vuota = componiRisposta(
      { chiede: "ingredienti_ricetta", soggetto: "carbonara" },
      { ricette: [ric("r1", "Carbonara")], ingredienti: [] },
    );
    expect(vuota.stato).toBe("risposta");
    expect(vuota.frase).toMatch(/non ha ancora nessun ingrediente/i);

    const muta = componiRisposta(
      { chiede: "ingredienti_ricetta", soggetto: "carbonara" },
      { ricette: [ric("r1", "Carbonara")], ingredienti: NON_LETTO },
    );
    expect(muta.stato).toBe("non_lo_so");
  });
});

// =====================================================================
describe("cosa devo preparare", () => {
  it("dice da quanto una cosa aspetta", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "preparazioni_da_fare" },
        {
          preparazioni: [
            { recipe_id: "p1", nome: "Busiate", giorni_in_attesa: 9 },
            { recipe_id: "p2", nome: "Ragù", giorni_in_attesa: 1 },
            { recipe_id: "p3", nome: "Brodo", giorni_in_attesa: 0 },
          ],
        },
      ),
    );
    expect(r.righe[0].testo).toContain("9 giorni fa");
    expect(r.righe[1].testo).toContain("ieri");
    expect(r.righe[2].testo).toContain("oggi");
    expect(r.a).toBe("/magazzino/produzioni");
  });

  it("🔴 e un'attesa non scritta non diventa «oggi»", () => {
    // 🔴 `Number(null)` vale zero: è lo stesso difetto degli impegni senza
    //    scadenza contati come impegni di oggi.
    const r = componiRisposta(
      { chiede: "preparazioni_da_fare" },
      { preparazioni: [{ recipe_id: "p1", nome: "Busiate", giorni_in_attesa: null }] },
    );
    expect(r.righe[0].testo).not.toContain("oggi");
    expect(r.righe[0].testo).toMatch(/non si sa/);
  });

  it("niente da preparare e non letto non si dicono uguale", () => {
    expect(componiRisposta({ chiede: "preparazioni_da_fare" }, { preparazioni: [] }).stato).toBe(
      "risposta",
    );
    expect(
      componiRisposta({ chiede: "preparazioni_da_fare" }, { preparazioni: NON_LETTO }).stato,
    ).toBe("non_lo_so");
  });
});

// =====================================================================
describe("cosa devo pulire oggi", () => {
  const p = (id, extra = {}) => ({
    task_id: id,
    nome: `Pulizia ${id}`,
    area: "cucina",
    ogni_giorni: 1,
    dovuta: false,
    mai_fatta: false,
    giorni_ritardo: 0,
    fatta_oggi: false,
    ...extra,
  });

  it("elenca solo quelle dovute, col ritardo", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "pulizie_oggi" },
        { pulizie: [p("a", { dovuta: true, giorni_ritardo: 37 }), p("b")] },
      ),
    );
    expect(r.righe).toHaveLength(1);
    expect(r.righe[0].testo).toContain("37 giorni");
    expect(r.a).toBe("/haccp/pulizia");
  });

  it("una mai fatta lo dice così, non «in ritardo di 0 giorni»", () => {
    const r = componiRisposta(
      { chiede: "pulizie_oggi" },
      { pulizie: [p("a", { dovuta: true, mai_fatta: true, giorni_ritardo: null })] },
    );
    expect(r.righe[0].testo).toMatch(/mai stata fatta/);
  });

  it("🔴 le pulizie SENZA cadenza si dichiarano: non sono in pari, sono mute", () => {
    // ⚠️ Con frequenza «altro» il database non le dà mai per dovute, perché
    //    nessuno ha detto ogni quanto vanno fatte. Tacerle farebbe leggere
    //    «è tutto in pari» come una fotografia del registro intero — è lo
    //    stesso patto dei prodotti senza scorta minima.
    const r = componiRisposta({ chiede: "pulizie_oggi" }, { pulizie: [p("a", { ogni_giorni: null })] });
    expect(r.frase).toMatch(/tutto in pari/i);
    expect(r.limite).toMatch(/cadenza/i);
  });

  it("quelle già fatte oggi si contano", () => {
    const r = componiRisposta({ chiede: "pulizie_oggi" }, { pulizie: [p("a", { fatta_oggi: true })] });
    expect(r.limite).toMatch(/già fatta oggi/i);
  });

  it("un registro non letto non diventa un registro in pari", () => {
    expect(componiRisposta({ chiede: "pulizie_oggi" }, { pulizie: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("le temperature di oggi", () => {
  const t = (id, extra = {}) => ({
    equipment_id: id,
    nome: `Frigo ${id}`,
    quante_oggi: 0,
    fuori_range: false,
    ultima_serata: "2026-07-31",
    ...extra,
  });

  it("dice quali mancano, e da quando", () => {
    const r = senzaScrivere(
      componiRisposta(
        { chiede: "temperature_oggi" },
        { temperature: [t("a"), t("b", { quante_oggi: 2 })] },
      ),
    );
    expect(r.frase).toMatch(/Manca una temperatura/);
    expect(r.righe[0].testo).toContain("Frigo a");
    expect(r.a).toBe("/haccp/temperature");
  });

  it("quando ci sono tutte lo dice, senza inventare un problema", () => {
    const r = componiRisposta(
      { chiede: "temperature_oggi" },
      { temperature: [t("a", { quante_oggi: 1 }), t("b", { quante_oggi: 3 })] },
    );
    expect(r.frase).toMatch(/sono segnate tutte e 2/);
    expect(r.limite).toBeNull();
  });

  it("🔴 un fuori range si dice SEMPRE, anche a letture complete", () => {
    // 🔴 È l'unica cosa di questo riquadro che chiede di alzarsi da tavola.
    //    Se comparisse solo insieme alle mancanti, la sera in cui si è
    //    segnato tutto sparirebbe proprio l'avviso che conta.
    const r = componiRisposta(
      { chiede: "temperature_oggi" },
      { temperature: [t("a", { quante_oggi: 1, fuori_range: true })] },
    );
    expect(r.frase).toMatch(/segnata/i);
    expect(r.limite).toMatch(/fuori range/i);
    expect(r.limite).toContain("Frigo a");
  });

  it("🔴 e non offre nessun gesto per sistemarlo", () => {
    // ⚠️ Un fuori range non si chiude a voce: è la regola del mandato
    //    vocale del 14/08, e qui si vede che il riquadro non la scavalca.
    const r = componiRisposta(
      { chiede: "temperature_oggi" },
      { temperature: [t("a", { quante_oggi: 1, fuori_range: true })] },
    );
    expect(r.candidati).toHaveLength(0);
    expect(r.limite).toMatch(/non si sistema da qui/i);
  });

  it("un registro non letto non diventa «tutto segnato»", () => {
    expect(componiRisposta({ chiede: "temperature_oggi" }, { temperature: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("🔴 la rete che tiene insieme tutte le domande", () => {
  it("ognuna ha una destinazione VERA, e nessuna manda alla stessa per sbaglio", () => {
    // ⚠️ Ogni risposta porta un collegamento — anche i «non lo so» — perché
    //    quello che MEMO dice si possa andare a controllare.
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
    //    Qualunque cifra comparisse a schermo lì sarebbe inventata — e
    //    plausibile, che in questo progetto è la forma di errore più cara.
    // ⚠️ NON si pretende che siano tutte «non lo so»: «non ho nessuna
    //    ricetta che si chiami x» è una risposta vera e va data. Quello che
    //    non deve esistere è il NUMERO.
    for (const chiede of Object.keys(DOMANDE_CHE_SO)) {
      const r = componiRisposta({ chiede, soggetto: "x" }, {});
      const tutto = [r.frase, r.limite ?? "", ...r.righe.map((x) => x.testo)].join(" ");
      expect(tutto, chiede).not.toMatch(/\d/);
    }
  });
});
