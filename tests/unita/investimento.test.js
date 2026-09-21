import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOMI_PREDEFINITI,
  PER_PAGINA,
  SOGGETTI_DEL_COSTO,
  dettaglioCompleto,
  dettaglioDelProgetto,
  idoneoAInvestimento,
  leggiAPagine,
  nelCostoDelProgetto,
  ragioneNonIdoneo,
  sommaRighe,
  totaliDelProgetto,
} from "../../src/lib/calcoli/investimento";

// =====================================================================
// L'ETICHETTA «INVESTIMENTO» E IL COSTO DEL PROGETTO — C11, 21/09/2026
// =====================================================================
// 🔴 COSA SI PROVA QUI E COSA NO, detto subito perche' non si scambi per
//    altro. Qui si provano **le regole**: chi entra nei tre numeri, a quale
//    riga si puo' offrire l'etichetta, quando un dettaglio non e' intero.
//    I **divieti** vivono nel database (migrazione `20260921000003`, vincolo
//    `check` piu' trigger) e sono provati dentro la sua verifica, nei due
//    versi e dentro una sotto-transazione annullata; che la **schermata**
//    chiami queste regole lo prova `tests/schermate/investimento.test.jsx`.
//
// ⚠️ SONO TRE COSE DIVERSE, e il progetto ha gia' pagato la differenza: il
//    16/08 il menu del mezzo delle mance si vedeva, si sceglieva, e il campo
//    non arrivava al database — nessuna prova sul database poteva
//    accorgersene.

const causaleNormale = { id: "c1", label: "Attrezzature", di_sistema: false };
const causaleDiSistema = { id: "c9", label: "Rimborso al titolare", di_sistema: true };

const uscita = (extra = {}) => ({ direction: "uscita", causale: causaleNormale, ...extra });

describe("1 · un'entrata non puo' essere un investimento", () => {
  it("l'etichetta non si offre su un'entrata", () => {
    expect(idoneoAInvestimento({ direction: "entrata", causale: causaleNormale })).toBe(false);
    // Nemmeno se l'entrata non ha nessuna causale.
    expect(idoneoAInvestimento({ direction: "entrata" })).toBe(false);
    // E nemmeno sul versamento del titolare, che e' un'entrata come le altre.
    expect(idoneoAInvestimento({ direction: "entrata", is_owner_injection: true })).toBe(false);
  });

  it("e la ragione si legge, invece di lasciare un vuoto", () => {
    expect(ragioneNonIdoneo({ direction: "entrata" })).toMatch(/entrata/i);
    // Su una riga idonea non c'e' niente da spiegare: la frase non compare.
    expect(ragioneNonIdoneo(uscita())).toBeNull();
  });
});

describe("8 · rimborsi, pareggi e prestiti non contano due volte", () => {
  // 🔴 LA CARATTERISTICA E' STRUTTURALE, non una parola letta dentro una
  //    descrizione: `cash_causali.di_sistema`, la stessa colonna con cui
  //    `rettifiche_fiscali()` e `costi_da_classificare()` escludono dai costi
  //    cio' che non e' un costo.
  it("una riga scritta dal gestionale non si puo' marcare", () => {
    expect(idoneoAInvestimento(uscita({ causale: causaleDiSistema }))).toBe(false);
  });

  it("e il rifiuto dice perche', nominando il caso", () => {
    const frase = ragioneNonIdoneo(uscita({ causale: causaleDiSistema }));
    expect(frase).toMatch(/gestionale/i);
    expect(frase).toMatch(/due volte/i);
  });

  it("🔴 il riconoscimento NON guarda le parole della descrizione", () => {
    // Un'uscita vera che *parla* di un rimborso resta marcabile: il testo non
    // decide niente. Leggere le parole e' il modo in cui un riconoscimento
    // sbaglia in silenzio.
    const parlaDiRimborsi = uscita({
      business_purpose: "Rimborso al titolare della cauzione? no: acconto al fabbro",
      note: "versamento in banca, anticipazione, prestito",
    });
    expect(idoneoAInvestimento(parlaDiRimborsi)).toBe(true);
  });

  it("un'uscita senza causale resta marcabile: e' il pagamento di una fattura", () => {
    // `pay_supplier_invoice` scrive il movimento SENZA causale (misurato sul
    // corpo vivo): li' l'uscita di cassa e' l'unico posto in cui la spesa
    // compare in prima nota, e contarla una volta e' giusto.
    expect(idoneoAInvestimento({ direction: "uscita", causale: null })).toBe(true);
    expect(idoneoAInvestimento({ direction: "uscita" })).toBe(true);
  });
});

describe("5-6-7 · i tre numeri", () => {
  const aggregato = [
    { entity_id: "e1", tipo: "srls", soggetto: "Borgo 58", quante: 4, totale: "6000.00" },
    { entity_id: "e3", tipo: "tasca", soggetto: "La tasca di Alessio", quante: 2, totale: "250.50" },
  ];

  it("5 · Borgo 58 e la tasca restano separati", () => {
    const t = totaliDelProgetto(aggregato);
    expect(t.dentro.map((r) => r.tipo)).toEqual(["srls", "tasca"]);
    expect(t.dentro[0].totale).toBe(6000);
    expect(t.dentro[1].totale).toBe(250.5);
  });

  it("6 · il totale e' la somma dei due, non un terzo conteggio", () => {
    const t = totaliDelProgetto(aggregato);
    expect(t.totale).toBe(6250.5);
    expect(t.totale).toBe(t.dentro.reduce((s, r) => s + r.totale, 0));
  });

  it("7 · l'orto non entra nel totale, ma NON sparisce", () => {
    const conOrto = [
      ...aggregato,
      { entity_id: "e2", tipo: "azienda_agricola", soggetto: "Orto Borgo 58", quante: 1, totale: "900.00" },
    ];
    const t = totaliDelProgetto(conOrto);
    // Il totale e' rimasto quello di prima: l'orto non l'ha gonfiato.
    expect(t.totale).toBe(6250.5);
    // Ma e' dichiarato, col suo importo: un'uscita marcata che svanisce in
    // silenzio sarebbe un'etichetta che non fa niente.
    expect(t.fuori).toHaveLength(1);
    expect(t.fuori[0].soggetto).toBe("Orto Borgo 58");
    expect(t.fuori[0].totale).toBe(900);
  });

  it("🔴 si decide sul TIPO stabile, mai sul nome visualizzato", () => {
    // Il nome e' testo che Alessio puo' riscrivere da una schermata: il
    // giorno che lo facesse, un confronto sul nome smetterebbe di
    // funzionare senza nessun errore.
    const rinominati = [
      { tipo: "srls", soggetto: "Osteria Borgo 58 S.r.l.s.", quante: 1, totale: "10.00" },
      { tipo: "azienda_agricola", soggetto: "Borgo 58", quante: 1, totale: "90.00" },
    ];
    const t = totaliDelProgetto(rinominati);
    expect(t.totale).toBe(10);
    expect(t.fuori.map((r) => r.soggetto)).toEqual(["Borgo 58"]);
    expect(nelCostoDelProgetto("srls")).toBe(true);
    expect(nelCostoDelProgetto("tasca")).toBe(true);
    expect(nelCostoDelProgetto("azienda_agricola")).toBe(false);
    // Un soggetto che non esiste ancora non entra da solo.
    expect(nelCostoDelProgetto("societa_futura")).toBe(false);
    expect(SOGGETTI_DEL_COSTO).toEqual(["srls", "tasca"]);
  });

  it("12 · senza nessun dato i due numeri ci sono lo stesso, a zero", () => {
    // ⚠️ Una voce che sparisce quando e' vuota fa credere che quel soggetto
    //    non esista. Qui lo zero e' una risposta vera — «da li' non e' uscito
    //    niente» — ed e' diverso dal non saperlo, che la schermata dice in
    //    un altro modo (`DatoNonLetto`).
    for (const vuoto of [[], null, undefined]) {
      const t = totaliDelProgetto(vuoto);
      expect(t.dentro.map((r) => r.soggetto)).toEqual([
        NOMI_PREDEFINITI.srls,
        NOMI_PREDEFINITI.tasca,
      ]);
      expect(t.dentro.every((r) => r.totale === 0)).toBe(true);
      expect(t.totale).toBe(0);
      expect(t.fuori).toEqual([]);
    }
  });
});

describe("10 · il dettaglio compone i totali", () => {
  const righe = [
    { id: "m1", tipo: "srls", importo: "6000.00" },
    { id: "m2", tipo: "tasca", importo: "250.50" },
    { id: "m3", tipo: "azienda_agricola", importo: "900.00" },
  ];

  it("la somma delle righe che entrano combacia col totale", () => {
    const t = totaliDelProgetto([
      { tipo: "srls", quante: 1, totale: "6000.00" },
      { tipo: "tasca", quante: 1, totale: "250.50" },
      { tipo: "azienda_agricola", quante: 1, totale: "900.00" },
    ]);
    const s = dettaglioDelProgetto(righe);
    expect(sommaRighe(s.dentro)).toBe(t.totale);
    expect(sommaRighe(s.fuori)).toBe(900);
  });

  it("il dettaglio divide con lo stesso criterio dei totali", () => {
    const s = dettaglioDelProgetto(righe);
    expect(s.dentro.map((r) => r.id)).toEqual(["m1", "m2"]);
    expect(s.fuori.map((r) => r.id)).toEqual(["m3"]);
  });
});

describe("11 · piu' di mille righe non danno un totale parziale in silenzio", () => {
  // 🔴 I TOTALI NON SI POSSONO TAGLIARE, per costruzione: li **aggrega** il
  //    database e ne consegna una riga per soggetto. Quello che si puo'
  //    tagliare e' il DETTAGLIO — e allora si dice.
  it("un dettaglio piu' corto dei totali si dichiara", () => {
    const totali = totaliDelProgetto([
      { tipo: "srls", quante: 1200, totale: "50000.00" },
      { tipo: "tasca", quante: 30, totale: "900.00" },
    ]);
    const mille = Array.from({ length: 1000 }, (_, i) => ({ id: `m${i}`, tipo: "srls", importo: 1 }));
    const esito = dettaglioCompleto(totali, mille);
    expect(esito.attese).toBe(1230);
    expect(esito.mostrate).toBe(1000);
    expect(esito.completo).toBe(false);
    // ⚠️ E il totale resta quello vero: 50.900, non la somma delle mille
    //    righe arrivate. E' la differenza fra «incompleto e dichiarato» e
    //    «un numero credibile e falso».
    expect(totali.totale).toBe(50900);
    expect(totali.totale).not.toBe(sommaRighe(mille));
  });

  it("e quando c'e' tutto, non si dichiara niente", () => {
    const totali = totaliDelProgetto([{ tipo: "srls", quante: 2, totale: "30.00" }]);
    const esito = dettaglioCompleto(totali, [{ id: "a" }, { id: "b" }]);
    expect(esito).toEqual({ attese: 2, mostrate: 2, completo: true });
  });

  it("le righe fuori dal totale contano fra quelle attese", () => {
    // Senza, un dettaglio che comprende l'orto risulterebbe «piu' lungo del
    // dovuto» e la dichiarazione non scatterebbe mai.
    const totali = totaliDelProgetto([
      { tipo: "srls", quante: 1, totale: "10.00" },
      { tipo: "azienda_agricola", quante: 1, totale: "5.00" },
    ]);
    expect(dettaglioCompleto(totali, [{ id: "a" }]).completo).toBe(false);
    expect(dettaglioCompleto(totali, [{ id: "a" }, { id: "b" }]).completo).toBe(true);
  });

  it("🔴 la lettura chiede la pagina dopo finche' la pagina e' piena", async () => {
    const chieste = [];
    const finto = async (da, a) => {
      chieste.push([da, a]);
      // Due pagine piene e una corta: la terza chiude il giro.
      if (chieste.length <= 2) return Array.from({ length: 4 }, (_, i) => `r${da + i}`);
      return ["coda"];
    };
    const tutte = await leggiAPagine(finto, { perPagina: 4, pagineMax: 10 });
    expect(chieste).toEqual([[0, 3], [4, 7], [8, 11]]);
    expect(tutte).toHaveLength(9);
  });

  it("una pagina corta ferma il giro subito", async () => {
    let giri = 0;
    const tutte = await leggiAPagine(
      async () => {
        giri += 1;
        return ["una sola"];
      },
      { perPagina: 4 }
    );
    expect(giri).toBe(1);
    expect(tutte).toEqual(["una sola"]);
  });

  it("e un elenco che non cala mai non gira all'infinito", async () => {
    // ⚠️ Il tetto si dichiara invece di essere infinito. Se un giorno
    //    servisse davvero, a dirlo e' `dettaglioCompleto`, non un ciclo che
    //    non finisce.
    let giri = 0;
    await leggiAPagine(
      async () => {
        giri += 1;
        return Array.from({ length: 4 }, () => "x");
      },
      { perPagina: 4, pagineMax: 3 }
    );
    expect(giri).toBe(3);
  });

  it("la pagina predefinita e' quella del tetto del database", () => {
    // Chiedendone meno si farebbero letture inutili; di piu' non servirebbe,
    // perche' oltre le mille il database taglia comunque.
    expect(PER_PAGINA).toBe(1000);
  });
});

// =====================================================================
// 9 · LA TASCA NON ENTRA NEI DATI FISCALI, E L'ETICHETTA NON E' FISCALE
// =====================================================================
// 🔴 UNA PROVA DI FORMA, e la ragione e' quella di sempre: la separazione
//    deve nascere dal fatto che **nessun calcolo fiscale nomina questa
//    colonna**, non da un filtro che qualcuno deve ricordarsi di scrivere.
//    *Una cosa tenuta fuori da un promemoria rientra alla prima schermata
//    che nessuno si ricorda di filtrare* (decisione del 30/08).
describe("9 · niente di fiscale sa cos'e' un investimento", () => {
  const FISCALI = [
    "src/lib/api/fiscal.js",
    "src/lib/api/deducibilita.js",
    "src/lib/api/proiezione.js",
  ];

  for (const f of FISCALI) {
    it(`${f} non nomina l'etichetta`, () => {
      expect(readFileSync(f, "utf8")).not.toContain("e_investimento");
    });
  }

  it("🔴 e nessuna migrazione fiscale la nomina: la colonna nasce in una sola", () => {
    // ⚠️ Il setaccio guarda TUTTE le migrazioni, non un elenco scritto a
    //    mano: un elenco invecchia al primo file nuovo. La colonna deve
    //    comparire in un file solo — quello che la crea.
    const { readdirSync } = require("node:fs");
    const cartella = "supabase/migrations";
    const colpevoli = readdirSync(cartella)
      .filter((n) => n.endsWith(".sql"))
      .filter((n) => readFileSync(`${cartella}/${n}`, "utf8").includes("e_investimento"));
    expect(colpevoli).toEqual(["20260921000003_l_etichetta_investimento.sql"]);
  });

  it("e la tasca resta dalla parte sua: entra nel costo, non nel fiscale", () => {
    // Le due affermazioni convivono e non si contraddicono: la tasca entra
    // in QUESTO totale, che e' gestionale, e resta fuori dal fiscale perche'
    // il fiscale lavora per soggetto e non la nomina.
    expect(nelCostoDelProgetto("tasca")).toBe(true);
    // ⚠️ E la regola e' PURA: non importa niente, quindi non puo' chiamare
    //    nessun calcolo fiscale nemmeno per sbaglio. E' la stessa forma con
    //    cui `src/lib/calcoli` tiene fuori il database da tutto il resto.
    const regola = readFileSync("src/lib/calcoli/investimento.js", "utf8");
    expect(regola).not.toMatch(/^\s*import\s/m);
  });
});

// =====================================================================
// 14 · LA MIGRAZIONE SI VERIFICA DA SE' E NON LASCIA NIENTE
// =====================================================================
describe("14 · la migrazione si annulla e non lascia dati di prova", () => {
  const SQL = readFileSync("supabase/migrations/20260921000003_l_etichetta_investimento.sql", "utf8");

  it("la verifica vive in una sotto-transazione annullata", () => {
    expect(SQL).toContain("ZZ_ANNULLA");
    // ⚠️ Il `raise` dentro il gestore non e' un dettaglio: senza, una
    //    verifica FALLITA verrebbe inghiottita dallo stesso meccanismo che
    //    serve ad annullare, e la migrazione passerebbe verde con la
    //    verifica rotta (trappola del 15/08).
    expect(SQL).toMatch(/if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;/);
  });

  it("e lo dimostra col registro delle cancellazioni acceso", () => {
    expect(SQL).toContain("foto_righe()");
    expect(SQL).toContain("pretendi_nessun_residuo(");
    // 🔴 Non si spegne il registro per poter ripulire (decisione del 30/08):
    //    per mezzo secondo, nel database vero, le cancellazioni non
    //    verrebbero registrate.
    expect(SQL).not.toContain("disable trigger trg_log_delete");
  });

  it("il vincolo nuovo parla italiano", () => {
    // Senza la frase, il rifiuto arriva in inglese — «violates check
    // constraint» — che in sala non e' un rifiuto, e' un guasto (rete 25/08).
    expect(SQL).toMatch(/comment on constraint investimento_solo_su_uscita on cash_movements is/);
  });

  it("2 · la colonna nasce spenta e non ammette un terzo stato", () => {
    expect(SQL).toMatch(/add column if not exists e_investimento boolean not null default false/);
  });

  it("🔴 il trigger guarda ogni update, non solo quello che nomina la colonna", () => {
    // ⚠️ `update of colonna` guarda cio' che e' stato NOMINATO, non cio' che
    //    e' cambiato (trappola del 27/08): cambiando la sola causale di una
    //    riga gia' marcata, un filtro sulla colonna non scatterebbe.
    // ⚠️ Si guarda l'ISTRUZIONE, non il file: il file **nomina** la forma
    //    sbagliata in un commento, per spiegare perche' non si usa. Un
    //    setaccio sul testo intero accuserebbe proprio la riga che spiega —
    //    e' la stessa famiglia dei falsi allarmi del 27/08, dove un comando
    //    che *cercava* una forma veniva contato fra quelli che la usavano.
    const istruzione = SQL.match(/create trigger trg_guardia_investimento[\s\S]*?;/)?.[0];
    expect(istruzione, "manca il trigger trg_guardia_investimento").toBeTruthy();
    expect(istruzione).toMatch(/before insert or update on cash_movements/);
    expect(istruzione).not.toMatch(/\bupdate of\b/);
  });
});
