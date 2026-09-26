import { describe, expect, it } from "vitest";
import { DOMANDE_CHE_SO, RIGHE_MOSTRATE, componiRisposta } from "../../src/lib/calcoli/domande";
import { NON_LETTO } from "../../src/lib/calcoli/letture";

// =====================================================================
// LA SALA DI STASERA — le domande della fase 4
// =====================================================================
// 🔴 QUESTA È L'AREA DOVE UNA RISPOSTA SBAGLIATA SI PAGA IN SALA, non in
//    contabilità: se MEMO dice che restano dieci posti e non è vero, quel
//    tavolo viene promesso a qualcuno. Per questo nessuno di questi numeri
//    lo calcola la regola — li conta il database, con la stessa funzione
//    che disegna la pianta.
//
// ⚠️ E NESSUNA DI QUESTE PROVE TOCCA LA RETE: i casi che contano — la
//    lettura caduta, il giorno di riposo, la sala piena — si costruiscono
//    qui invece di aspettare che accadano.

const OGGI = "2026-09-08";

// =====================================================================
describe("chi ha prenotato", () => {
  const p = (i, extra = {}) => ({
    id: `p${i}`,
    customer_name: `Cliente ${i}`,
    reservation_time: "21:15:00",
    party_size: 4,
    status: "confermata",
    ...extra,
  });
  const t = (id, etichette) => ({ reservation_id: id, etichette });

  it("dice nome, ora, quanti sono e il tavolo", () => {
    const r = componiRisposta(
      { chiede: "chi_ha_prenotato" },
      { prenotazioni: [p(1)], turni: [t("p1", ["T3"])], oggi: OGGI },
    );
    expect(r.stato).toBe("risposta");
    expect(r.righe[0].testo).toContain("21:15");
    expect(r.righe[0].testo).toContain("Cliente 1");
    expect(r.righe[0].testo).toContain("4 persone");
    expect(r.righe[0].testo).toContain("(T3)");
    expect(r.a).toBe("/calendario-eventi");
  });

  it("e nella frase c'è il totale delle persone, non solo delle prenotazioni", () => {
    // ⚠️ «Due prenotazioni» non dice quanti coperti apparecchiare: è il
    //    numero delle persone quello che serve in cucina.
    const r = componiRisposta(
      { chiede: "chi_ha_prenotato" },
      { prenotazioni: [p(1), p(2, { party_size: 6 })], turni: [], oggi: OGGI },
    );
    expect(r.frase).toContain("2 prenotazioni");
    expect(r.frase).toContain("10 persone");
  });

  it("🔴 una prenotazione SENZA tavolo si vede e si conta a parte", () => {
    // 🔴 Richiesta di Alessio, 18/08: «si rischia che rimangano senza».
    //    Non compaiono da nessuna parte sulla pianta, quindi l'elenco è
    //    l'unico posto dove qualcuno può accorgersene.
    const r = componiRisposta(
      { chiede: "chi_ha_prenotato" },
      { prenotazioni: [p(1), p(2)], turni: [t("p1", ["T3"])], oggi: OGGI },
    );
    expect(r.righe[1].testo).toContain("senza tavolo");
    expect(r.limite).toMatch(/non ha ancora un tavolo/);
  });

  it("🔴 le richieste ancora in attesa NON contano fra chi viene", () => {
    // 🔴 Una richiesta non è gente che verrà: dal 14/08 non tiene nemmeno
    //    il posto. Contarla qui farebbe apparecchiare per persone che
    //    nessuno ha ancora accettato.
    const r = componiRisposta(
      { chiede: "chi_ha_prenotato" },
      {
        prenotazioni: [p(1), p(2, { status: "richiesta_in_attesa" })],
        turni: [],
        oggi: OGGI,
      },
    );
    expect(r.righe).toHaveLength(1);
    expect(r.frase).toContain("una prenotazione");
    expect(r.limite).toMatch(/da confermare/);
  });

  it("una serata vuota si dice, e non è «non ho letto»", () => {
    expect(
      componiRisposta({ chiede: "chi_ha_prenotato" }, { prenotazioni: [], turni: [] }).frase,
    ).toMatch(/non ha prenotato nessuno/i);
    expect(
      componiRisposta({ chiede: "chi_ha_prenotato" }, { prenotazioni: NON_LETTO }).stato,
    ).toBe("non_lo_so");
  });

  it("se cadono solo i TAVOLI, i nomi si dicono lo stesso", () => {
    // ⚠️ La metà che discrimina: due letture, e la seconda che cade non
    //    deve portarsi via la prima. «Chi ha prenotato» resta una risposta
    //    utile anche senza sapere a quale tavolo.
    const r = componiRisposta(
      { chiede: "chi_ha_prenotato" },
      { prenotazioni: [p(1)], turni: NON_LETTO, oggi: OGGI },
    );
    expect(r.stato).toBe("risposta");
    expect(r.righe[0].testo).toContain("Cliente 1");
  });

  it("un elenco lungo si taglia e lo dichiara", () => {
    const molte = Array.from({ length: 15 }, (_, i) => p(i));
    const r = componiRisposta({ chiede: "chi_ha_prenotato" }, { prenotazioni: molte, turni: [] });
    expect(r.righe).toHaveLength(RIGHE_MOSTRATE);
    expect(r.troppe).toBe(15 - RIGHE_MOSTRATE);
    expect(r.frase).toContain("15 prenotazioni");
  });
});

// =====================================================================
describe("quanto posto c'è", () => {
  const posto = (extra = {}) => ({
    capienza: 34,
    prenotati: 6,
    in_attesa: 0,
    restanti: 28,
    soglia: 25,
    oltre_soglia: false,
    avvertenza:
      "Il conteggio guarda i soli tavoli: divani e Chef Table restano fuori, sono un'altra formula.",
    ...extra,
  });

  it("dice quanti ne restano e su quanti", () => {
    const r = componiRisposta({ chiede: "quanto_posto_ce" }, { posto: posto() });
    expect(r.frase).toContain("28");
    expect(r.frase).toContain("6");
    expect(r.frase).toContain("34");
    expect(r.a).toBe("/calendario-eventi/pianta");
  });

  it("🔴 l'avvertenza è QUELLA DEL DATABASE, non una riscritta qui", () => {
    // 🔴 Regola del 15/08: il numero e il suo limite viaggiano insieme.
    //    Divani e Chef Table restano fuori dal conteggio, e chi legge «28
    //    posti» senza saperlo apparecchia per una sala che non c'è.
    const r = componiRisposta({ chiede: "quanto_posto_ce" }, { posto: posto() });
    expect(r.limite).toContain("divani e Chef Table");
  });

  it("🔴 le richieste in attesa si dicono, ma NON tolgono posto", () => {
    // 🔴 Dal 14/08 una richiesta non occupa niente: il tavolo lo dà
    //    Alessio dalla pianta. Toglierle dai restanti farebbe rifiutare
    //    gente per un posto che c'è ancora.
    const r = componiRisposta({ chiede: "quanto_posto_ce" }, { posto: posto({ in_attesa: 2 }) });
    expect(r.frase).toContain("28");
    expect(r.limite).toMatch(/non tolgono posto/);
  });

  it("sala piena: lo dice, e non con un numero negativo", () => {
    const r = componiRisposta(
      { chiede: "quanto_posto_ce" },
      { posto: posto({ prenotati: 34, restanti: 0 }) },
    );
    expect(r.frase).toMatch(/Non resta posto/);
    expect(r.frase).not.toContain("-");
  });

  it("una lettura caduta non diventa «sala vuota»", () => {
    for (const caduta of [NON_LETTO, null, { capienza: 34 }]) {
      const r = componiRisposta({ chiede: "quanto_posto_ce" }, { posto: caduta });
      expect(r.stato).toBe("non_lo_so");
      expect(r.frase).not.toMatch(/\d/);
    }
  });
});

// =====================================================================
describe("le richieste da confermare", () => {
  const r = (i, extra = {}) => ({
    id: `r${i}`,
    customer_name: `Cliente ${i}`,
    reservation_date: "2026-09-12",
    reservation_time: "20:30:00",
    party_size: 2,
    ...extra,
  });

  it("le elenca con data, ora e quante persone", () => {
    const x = componiRisposta({ chiede: "richieste_da_confermare" }, { richieste: [r(1)], oggi: OGGI });
    expect(x.frase).toMatch(/una richiesta da confermare/);
    expect(x.righe[0].testo).toContain("20:30");
    expect(x.righe[0].testo).toContain("2 persone");
    expect(x.a).toBe("/calendario-eventi");
  });

  it("🔴 e quelle per OGGI si dicono a parte", () => {
    // ⚠️ Una richiesta per stasera è un'altra urgenza rispetto a una per
    //    il mese prossimo: sepolta in mezzo alle altre non si vede.
    const x = componiRisposta(
      { chiede: "richieste_da_confermare" },
      { richieste: [r(1), r(2, { reservation_date: OGGI })], oggi: OGGI },
    );
    expect(x.limite).toMatch(/Una è per oggi/);
  });

  it("dichiara sempre che guarda solo da oggi in avanti", () => {
    for (const richieste of [[], [r(1)]]) {
      const x = componiRisposta({ chiede: "richieste_da_confermare" }, { richieste, oggi: OGGI });
      expect(x.limite).toMatch(/da oggi in avanti/);
    }
  });

  it("nessuna richiesta e nessuna lettura non si dicono uguale", () => {
    expect(componiRisposta({ chiede: "richieste_da_confermare" }, { richieste: [] }).stato).toBe(
      "risposta",
    );
    expect(
      componiRisposta({ chiede: "richieste_da_confermare" }, { richieste: NON_LETTO }).stato,
    ).toBe("non_lo_so");
  });
});

// =====================================================================
describe("stasera si lavora?", () => {
  const ora = (extra = {}) => ({
    id: "o1",
    weekday: 2,
    servizio: "cena",
    apertura: "20:00:00",
    ultimo_ingresso: "22:30:00",
    ora_ultimi_arrivi: "22:00:00",
    attivo: true,
    ...extra,
  });
  const base = { orari: [ora()], chiusure: [], pieno: false, oggi: OGGI, giorno: 2 };

  it("dice gli orari del giorno, con gli ultimi arrivi", () => {
    const r = componiRisposta({ chiede: "siamo_aperti" }, base);
    expect(r.frase).toMatch(/Oggi si lavora/);
    expect(r.righe[0].testo).toContain("20:00");
    expect(r.righe[0].testo).toContain("22:30");
    expect(r.righe[0].testo).toContain("22:00");
    expect(r.a).toBe("/calendario-eventi/sala-e-orari");
  });

  it("🔴 «chiusi» e «pieni» NON si dicono uguale", () => {
    // 🔴 Lezione del 10/08, pagata sul form pubblico: il lunedì il sito
    //    rispondeva «non abbiamo più posto» invece di «siamo chiusi», e
    //    un cliente che ci prova due volte conclude che siamo sempre
    //    pieni. Qui le tre risposte restano tre.
    const riposo = componiRisposta({ chiede: "siamo_aperti" }, { ...base, orari: [] });
    expect(riposo.frase).toMatch(/riposo/i);
    expect(riposo.frase).not.toMatch(/pieno/i);

    const pieno = componiRisposta({ chiede: "siamo_aperti" }, { ...base, pieno: true });
    expect(pieno.frase).toMatch(/si lavora/i);
    expect(pieno.limite).toMatch(/pieno/i);
  });

  it("🔴 una chiusura vince sugli orari, e porta il suo motivo", () => {
    // ⚠️ Se il locale è chiuso, gli orari di quel giorno della settimana
    //    non vogliono dire niente. E «siamo chiusi» senza dire perché fa
    //    riaprire il calendario per controllare.
    const r = componiRisposta(
      { chiede: "siamo_aperti" },
      {
        ...base,
        chiusure: [{ dal: "2026-09-01", al: "2026-09-30", motivo: "Ferie" }],
      },
    );
    expect(r.frase).toMatch(/chiusi/i);
    expect(r.frase).toContain("Ferie");
    expect(r.righe).toHaveLength(0);
  });

  it("...e una chiusura che NON comprende oggi non conta", () => {
    // ⚠️ La metà che discrimina: un confronto sbagliato sulle date
    //    chiuderebbe il locale in un giorno in cui si lavora.
    const r = componiRisposta(
      { chiede: "siamo_aperti" },
      { ...base, chiusure: [{ dal: "2026-10-01", al: "2026-10-10", motivo: "Ferie" }] },
    );
    expect(r.frase).toMatch(/si lavora/i);
  });

  it("due servizi nello stesso giorno si dicono tutt'e due", () => {
    const r = componiRisposta(
      { chiede: "siamo_aperti" },
      {
        ...base,
        orari: [ora(), ora({ id: "o2", servizio: "pranzo", apertura: "12:30:00", ultimo_ingresso: "14:00:00", ora_ultimi_arrivi: null })],
      },
    );
    expect(r.righe).toHaveLength(2);
    expect(r.frase).toMatch(/due servizi/i);
  });

  it("gli orari di un ALTRO giorno non finiscono nella risposta di oggi", () => {
    const r = componiRisposta(
      { chiede: "siamo_aperti" },
      { ...base, orari: [ora(), ora({ id: "o3", weekday: 5 })] },
    );
    expect(r.righe).toHaveLength(1);
  });

  it("una lettura caduta non diventa «giorno di riposo»", () => {
    const r = componiRisposta({ chiede: "siamo_aperti" }, { ...base, orari: NON_LETTO });
    expect(r.stato).toBe("non_lo_so");
    expect(r.frase).not.toMatch(/riposo/i);
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
    for (const chiede of Object.keys(DOMANDE_CHE_SO)) {
      const r = componiRisposta({ chiede, soggetto: "x" }, {});
      const tutto = [r.frase, r.limite ?? "", ...r.righe.map((x) => x.testo)].join(" ");
      expect(tutto, chiede).not.toMatch(/\d/);
    }
  });

  it("🔴 e le quattro della sala non offrono nessun gesto", () => {
    // ⚠️ Qui la tentazione sarebbe un pulsante «conferma»: una richiesta
    //    da confermare è a un tocco di distanza. Una domanda non esegue.
    for (const chiede of [
      "chi_ha_prenotato",
      "quanto_posto_ce",
      "richieste_da_confermare",
      "siamo_aperti",
    ]) {
      const r = componiRisposta(
        { chiede },
        { prenotazioni: [], turni: [], richieste: [], orari: [], chiusure: [], pieno: false },
      );
      expect(r.candidati, chiede).toEqual([]);
      expect(Object.keys(r), chiede).not.toContain("azione");
    }
  });
});
