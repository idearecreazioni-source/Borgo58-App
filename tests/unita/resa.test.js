import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  comeSiLegge,
  lordoDaComprare,
  lordoDaSalvare,
  ragioneNonSalvabile,
  resaPercento,
  scartoPercento,
  unitaCoerenti,
} from "../../src/lib/calcoli/resa";

// =====================================================================
// LA RESA SULLA RIGA DI RICETTA — R12, 22/09/2026
// =====================================================================
// 🔴 COSA SI PROVA QUI E COSA NO. Qui si provano **le regole**: le due
//    percentuali, il lordo da comprare, cosa si può salvare. I **divieti**
//    vivono nel database (migrazione `20260922000001`: un vincolo `check` e
//    un trigger che riflette lo scarto) e sono provati dentro la sua
//    verifica; che la **schermata** chiami queste regole lo prova
//    `tests/schermate/resa-ricetta.test.jsx`.
//
// ⚠️ La migrazione NON è stata applicata da nessuna parte, quindi i suoi
//    controlli non sono mai girati contro un database. Quello che segue è
//    tutto ciò che si può affermare senza applicarla.

describe("1 · lo stesso ingrediente, due rese diverse in due ricette", () => {
  // È la ragione per cui R12 esiste: sulla scheda del prodotto un numero
  // solo non descrive nessuno dei due casi.
  const impepata = { quantita_lorda: 1.1, quantity: 1.0, unit: "kg" };
  const sugo = { quantita_lorda: 1.5, quantity: 0.4, unit: "kg" };

  it("la resa è della coppia, non dell'ingrediente", () => {
    expect(resaPercento(impepata.quantita_lorda, impepata.quantity)).toBe(90.9);
    expect(resaPercento(sugo.quantita_lorda, sugo.quantity)).toBe(26.7);
  });

  it("🔴 e le DUE percentuali non si confondono", () => {
    // È la confusione che ha prodotto la frase falsa del 24/08: la resa è
    // netto/lordo, lo scarto è (lordo/netto − 1). Su 1,5 → 0,4 fanno 26,7 e
    // 275: due numeri che non si somigliano nemmeno.
    expect(resaPercento(1.5, 0.4)).toBe(26.7);
    expect(scartoPercento(1.5, 0.4)).toBe(275);
    expect(resaPercento(1.5, 0.4)).not.toBe(scartoPercento(1.5, 0.4));
  });

  it("⚠️ lo scarto è nella forma che il costo usa: lordo = netto × (1 + scarto/100)", () => {
    // Misurato sui corpi vivi: tutte e cinque le cose che calcolano usano
    // questa forma, e nessuna la divisione per (1 − scarto/100).
    for (const [lordo, netto] of [[1.35, 1], [1.1, 1], [2, 1], [0.27, 0.2]]) {
      const w = scartoPercento(lordo, netto);
      expect(netto * (1 + w / 100)).toBeCloseTo(lordo, 10);
    }
  });
});

describe("2 · lordo e netto uguali: resa 100%, scarto zero", () => {
  it("il caso senza scarto", () => {
    expect(resaPercento(0.2, 0.2)).toBe(100);
    expect(scartoPercento(0.2, 0.2)).toBe(0);
    expect(ragioneNonSalvabile(0.2, 0.2)).toBeNull();
  });
});

describe("3-4 · quello che non si può salvare, e la frase che lo dice", () => {
  it("🔴 il netto non può superare il lordo, e il rifiuto si legge", () => {
    const frase = ragioneNonSalvabile(0.5, 1);
    expect(frase).toMatch(/non può restarne di più/);
    // ⚠️ E dice anche cosa fare nel caso che somiglia: il riso che assorbe
    //    l'acqua non è una resa.
    expect(frase).toMatch(/riso/);
  });

  it("zero e negativi sono rifiutati, ognuno con la sua frase", () => {
    expect(ragioneNonSalvabile(1, 0)).toMatch(/maggiore di zero/);
    expect(ragioneNonSalvabile(1, -1)).toMatch(/maggiore di zero/);
    expect(ragioneNonSalvabile(-1, 1)).toMatch(/Quanto ne prendi/);
    expect(ragioneNonSalvabile(0, 1)).toMatch(/Quanto ne prendi/);
  });

  it("⚠️ il lordo VUOTO non è un errore: vuol dire «non c'è scarto»", () => {
    // Il vuoto non è zero: è la risposta vera di chi non ha dichiarato uno
    // scarto, e il lordo diventa il netto.
    expect(ragioneNonSalvabile("", 0.3)).toBeNull();
    expect(ragioneNonSalvabile(null, 0.3)).toBeNull();
    expect(lordoDaSalvare("", 0.3)).toBe(0.3);
    expect(lordoDaSalvare(null, 0.3)).toBe(0.3);
    expect(lordoDaSalvare(1.5, 0.4)).toBe(1.5);
  });

  it("🔴 e quello che non si può dire NON diventa zero", () => {
    // *Assenza di informazione e informazione di assenza sono due cose
    // diverse* (19/08): uno zero qui si leggerebbe «non ne resta niente».
    expect(resaPercento(null, 1)).toBeNull();
    expect(resaPercento(1, null)).toBeNull();
    expect(resaPercento(0, 1)).toBeNull();
    expect(scartoPercento(1, 0)).toBeNull();
  });
});

describe("5 · la virgola si scrive come la scrive Alessio", () => {
  it("«1,5» è un numero", () => {
    expect(resaPercento("1,5", "0,4")).toBe(26.7);
    expect(lordoDaSalvare("1,5", "0,4")).toBe(1.5);
  });
});

describe("6 · le unità", () => {
  it("🔴 lordo e netto stanno nella STESSA unità, e non è una semplificazione", () => {
    // Sono due pesi della stessa cosa nello stesso momento: convertirli fra
    // loro non avrebbe senso, e confrontarli in unità diverse sarebbe il
    // difetto che questa regola esiste per impedire.
    expect(unitaCoerenti("kg", "kg")).toBe(true);
    expect(unitaCoerenti("kg", "g")).toBe(false);
    expect(unitaCoerenti("kg", "l")).toBe(false);
    // Nessuna unità dichiarata = quella della riga.
    expect(unitaCoerenti("kg", null)).toBe(true);
  });

  it("⚠️ e la conversione vera resta nel database", () => {
    // `unita_conversione` esiste dal 21/08 e converte fra l'unità della riga
    // e quella con cui l'ingrediente si compra. Due tabelle di conversione —
    // una in SQL e una qui — un giorno direbbero due numeri diversi.
    const regola = readFileSync("src/lib/calcoli/resa.js", "utf8");
    // ⚠️ IL PRIMO SETACCIO CHE AVEVO SCRITTO CERCAVA «1000», e prendeva il
    //    fattore di un ARROTONDAMENTO invece di una conversione: la trappola
    //    del 27/08, un setaccio sul testo che trova anche chi nomina la
    //    forma per un'altra ragione. Quello che non deve esserci è una
    //    TABELLA di conversione — un'unità accanto a un numero.
    expect(regola).not.toMatch(/["']?\b(kg|g|l|ml|pz)\b["']?\s*:\s*[\d.]/);
    expect(regola).toMatch(/unita_conversione/);
  });
});

describe("10 · la lista della spesa risale dal netto al lordo", () => {
  it("per avere 2 kg netti di cozze da una riga 1,5 → 0,4 se ne comprano 7,5", () => {
    expect(lordoDaComprare(2, 1.5, 0.4)).toBeCloseTo(7.5, 10);
  });

  it("senza scarto, il lordo è il netto", () => {
    expect(lordoDaComprare(3, 1, 1)).toBeCloseTo(3, 10);
  });

  it("⚠️ e se la riga non dice abbastanza non si risponde un numero inventato", () => {
    expect(lordoDaComprare(2, null, 0.4)).toBeNull();
    expect(lordoDaComprare(2, 1.5, 0)).toBeNull();
    expect(lordoDaComprare(null, 1.5, 0.4)).toBeNull();
  });
});

describe("11 · la riga si legge, e non si arrotonda di nascosto", () => {
  it("«1,5 kg → 0,4 kg netti (26,7%)»", () => {
    expect(comeSiLegge({ quantita_lorda: 1.5, quantity: 0.4, unit: "kg" })).toBe(
      "1.5 kg → 0.4 kg netti (26.7%)"
    );
  });

  it("senza scarto si scrive la sola quantità", () => {
    expect(comeSiLegge({ quantita_lorda: 0.2, quantity: 0.2, unit: "kg" })).toBe("0.2 kg");
    expect(comeSiLegge({ quantity: 0.2, unit: "kg" })).toBe("0.2 kg");
  });

  it("🔴 i numeri non vengono arrotondati: si rilegge quello che si è scritto", () => {
    // ⚠️ La percentuale è arrotondata a un decimale perché si MOSTRA; le
    //    quantità no, perché si rileggono e si modificano.
    expect(comeSiLegge({ quantita_lorda: 1.5375, quantity: 0.4125, unit: "kg" })).toMatch(
      /1\.5375 kg → 0\.4125 kg/
    );
    expect(lordoDaSalvare("1.5375", "0.4125")).toBe(1.5375);
  });
});

// =====================================================================
// 12 · NIENTE DI QUESTO TOCCA IVA, FATTURE, CASSA O INVESTIMENTO
// =====================================================================
// 🔴 UNA PROVA DI FORMA, come quella di C11: la separazione deve nascere dal
//    fatto che **nessuno di quei moduli nomina la resa**, non da un filtro
//    che qualcuno deve ricordarsi di scrivere.
describe("12 · la resa non entra in nessun conto che non sia il costo", () => {
  const ESTRANEI = [
    "src/lib/api/cash.js",
    "src/lib/api/fiscal.js",
    "src/lib/api/deducibilita.js",
    "src/lib/api/supplierInvoices.js",
    "src/lib/calcoli/investimento.js",
  ];

  for (const f of ESTRANEI) {
    it(`${f} non nomina la resa`, () => {
      const t = readFileSync(f, "utf8");
      expect(t).not.toMatch(/quantita_lorda|resaPercento|scarto_della_riga/);
    });
  }
});

// =====================================================================
// 15 · LA MIGRAZIONE: L'ORDINE, LE RETI, E L'ANNULLAMENTO
// =====================================================================
describe("15 · la migrazione si verifica da sé e non lascia residui", () => {
  const FILE = "supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql";
  const SQL = readFileSync(FILE, "utf8");
  const codice = SQL.replace(/--[^\n]*/g, "");

  it("la colonna nuova nasce vuota e poi diventa obbligatoria", () => {
    expect(codice).toMatch(/add column if not exists quantita_lorda numeric\(12,4\)/);
    expect(codice).toMatch(/alter column quantita_lorda set not null/);
  });

  it("🔴 il trigger arriva DOPO la sanatoria, e l'ordine è il punto", () => {
    // Col trigger prima, l'`update` della sanatoria lo farebbe scattare e il
    // riflesso riscriverebbe lo scarto col valore ricavato dal lordo
    // ARROTONDATO: su una quantità come 0,0333 il giro non torna, e il food
    // cost di quel piatto si sposterebbe di un millesimo in silenzio.
    const dovSanatoria = codice.indexOf("do $sanatoria$");
    const dovTrigger = codice.indexOf("create trigger trg_riflette_lo_scarto");
    expect(dovSanatoria).toBeGreaterThan(0);
    expect(dovTrigger).toBeGreaterThan(dovSanatoria);
  });

  it("🔴 e la fotografia del food cost è presa PRIMA di tutto", () => {
    const dovFoto = codice.indexOf("create temp table zz_food_cost_prima");
    const dovSanatoria = codice.indexOf("do $sanatoria$");
    expect(dovFoto).toBeGreaterThan(0);
    expect(dovFoto).toBeLessThan(dovSanatoria);
    // 🔴 E NON BASTA CHE LA TABELLA ESISTA: dev'essere RIEMPITA dal calcolo
    //    vero. Rompendo apposta la migrazione — lasciando la fotografia
    //    vuota — questa prova restava VERDE, e il confronto sarebbe passato
    //    senza aver guardato niente: la trappola del caso vuoto, stavolta
    //    sul guardiano invece che sui dati.
    expect(codice).toMatch(
      /create temp table zz_food_cost_prima as\s+select [^;]*from v_recipe_costs;/
    );
    // E il confronto c'è, riga per ricetta e non su un totale.
    expect(codice).toMatch(/from zz_food_cost_prima p\s+join v_recipe_costs d/);
    expect(codice).toMatch(/il food cost di % ricette si e'' mosso/);
  });

  it("⚠️ e il confronto dichiara SU QUANTE ricette ha guardato", () => {
    // Con la fotografia vuota il confronto passerebbe senza aver guardato
    // niente: è la trappola del caso vuoto (17/08).
    expect(codice).toMatch(/Food cost confrontato su % ricette/);
  });

  it("🔴 la sanatoria si ferma se il giro lordo → scarto non torna esatto", () => {
    // Non si aggiusta la soglia: ci si ferma, e si dice quali righe.
    expect(codice).toMatch(/FERMO: su % righe il lordo a quattro decimali/);
    expect(codice).toMatch(/string_agg/);
  });

  it("la sanatoria si applica una volta sola, guardata dal registro", () => {
    expect(codice).toMatch(
      /if exists \(select 1 from applied_migrations where version = '20260922000001'\)/
    );
  });

  it("🔴 il trigger guarda ogni update, non solo quello che nomina il lordo", () => {
    // `update of colonna` guarda ciò che è stato NOMINATO, non ciò che è
    // cambiato (trappola del 27/08): cambiando il solo netto, lo scarto
    // resterebbe quello di prima.
    const istruzione = codice.match(/create trigger trg_riflette_lo_scarto[\s\S]*?;/)?.[0];
    expect(istruzione, "manca il trigger").toBeTruthy();
    expect(istruzione).toMatch(/before insert or update on recipe_ingredients/);
    expect(istruzione).not.toMatch(/\bupdate of\b/);
  });

  it("il vincolo nuovo parla italiano", () => {
    expect(codice).toMatch(/add constraint riga_lordo_e_netto_coerenti/);
    expect(codice).toMatch(/comment on constraint riga_lordo_e_netto_coerenti on recipe_ingredients is/);
  });

  it("🔴 e la frase falsa del 24/08 viene corretta", () => {
    // Diceva «il lordo si ricava dividendo per (1 − scarto/100)», e nessuna
    // funzione lo fa: è nata falsa, come quella sulle lapidi del 26/08.
    expect(codice).toMatch(/comment on constraint ingredients_scarto_sotto_cento on ingredients is/);
    expect(codice).toMatch(/MOLTIPLICANDO il netto per \(1 \+ scarto\/100\)/);
  });

  it("la verifica vive in una sotto-transazione annullata, col registro acceso", () => {
    expect(codice).toContain("ZZ_ANNULLA");
    expect(codice).toMatch(/if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;/);
    expect(codice).toMatch(/\bfoto_righe\(\)/);
    expect(codice).toMatch(/\bperform pretendi_nessun_residuo\(/);
    // 🔴 Non si spegne il registro delle cancellazioni per poter ripulire.
    expect(codice).not.toContain("disable trigger trg_log_delete");
  });

  it("🔴 e la copia di una ricetta porta il lordo, non lo scarto", () => {
    // Senza, `duplica_ricetta` scriverebbe lo scarto — che il riflesso
    // rifiuta — e duplicare smetterebbe di funzionare al primo tentativo.
    const dup = codice.match(/create or replace function duplica_ricetta[\s\S]*?\$function\$;/)?.[0];
    expect(dup, "manca duplica_ricetta").toBeTruthy();
    expect(dup).toMatch(/quantity, quantita_lorda, unit/);
    expect(dup).not.toMatch(/waste_percentage/);
  });

  it("⚠️ e la vista aggiunge le colonne IN FONDO", () => {
    // `create or replace view` rifiuta una colonna infilata in mezzo
    // (errore 42P16).
    const vista = codice.match(/create or replace view recipe_ingredients_display[\s\S]*?;/)?.[0];
    expect(vista).toBeTruthy();
    const dovWaste = vista.indexOf("waste_percentage");
    const dovLorda = vista.indexOf("ri.quantita_lorda");
    expect(dovLorda).toBeGreaterThan(dovWaste);
    expect(vista).toMatch(/resa_percento/);
    expect(vista).toMatch(/origine_resa/);
  });
});

// =====================================================================
// 9 · LA RESA MISURATA CONTINUA A VINCERE DOVE ESISTE
// =====================================================================
describe("9 · la resa misurata di una produzione non è toccata", () => {
  it("`rese_preparazione` resta quella che è", () => {
    // ⚠️ È una misura della PREPARAZIONE — quanto esce davvero da una dose —
    //    non dell'ingrediente dentro la ricetta. La decisione del 14/08
    //    resta intera: dove c'è una produzione registrata la resa misurata
    //    vince, la dichiarata resta per la lista della spesa.
    const SQL = readFileSync(
      "supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql",
      "utf8"
    ).replace(/--[^\n]*/g, "");
    expect(SQL).not.toMatch(/create or replace function rese_preparazione/);
    expect(SQL).not.toMatch(/drop .*rese_preparazione/);
  });

  it("e il dettaglio dichiara da dove viene la resa che mostra", () => {
    // Oggi è sempre «dichiarata»: il posto per dirlo esiste, così il giorno
    // che una misura per riga esistesse non servirebbe inventarlo.
    const SQL = readFileSync(
      "supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql",
      "utf8"
    );
    expect(SQL).toMatch(/'dichiarata'::text as origine_resa/);
  });
});
