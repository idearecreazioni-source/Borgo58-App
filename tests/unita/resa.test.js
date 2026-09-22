import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  comeSiLegge,
  comeSiLeggeLoStandard,
  lordoDaComprare,
  lordoDaSalvare,
  lordoPrecompilato,
  ragioneNonSalvabile,
  resaDaScarto,
  resaPercento,
  scartoDaResa,
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

  it("🔴 e la frase falsa del 24/08 viene corretta, col vincolo che ne dipendeva", () => {
    // Diceva «il lordo si ricava dividendo per (1 − scarto/100)», e nessuna
    // funzione lo fa: è nata falsa, come quella sulle lapidi del 26/08.
    // 🔴 E il limite «sotto 100» era la sua CONSEGUENZA: se ne va, perché
    //    rifiutava un caso vero — un sugo di cozze scarta il 275%.
    expect(codice).toMatch(/drop constraint if exists ingredients_scarto_sotto_cento/);
    expect(codice).toMatch(/add constraint ingredients_scarto_standard_sensato/);
    expect(codice).toMatch(
      /comment on constraint ingredients_scarto_standard_sensato on ingredients is/,
    );
    expect(codice).toMatch(/MOLTIPLICANDO il netto per \(1 \+ scarto\/100\)/);
    // ⚠️ E il vincolo nuovo guarda solo il segno: sopra 100 si passa.
    const nuovo = codice.match(
      /add constraint ingredients_scarto_standard_sensato\s+check \(([\s\S]*?)\);/,
    )?.[1];
    expect(nuovo, "manca il vincolo nuovo").toBeTruthy();
    expect(nuovo).toContain(">= 0");
    expect(nuovo).not.toContain("< 100");
  });

  it("🔴 IL NUMERO DEL PRODOTTO NON RAGGIUNGE PIÙ NESSUN CALCOLO", () => {
    // 🔴 È la decisione di Alessio del 22/09: il valore standard resta e
    //    PRECOMPILA, ma non eredita. La garanzia è il `not null` — finché
    //    `waste_percentage` poteva essere vuota, il secondo argomento di
    //    ogni `coalesce(riga, prodotto, 0)` era raggiungibile.
    expect(codice).toMatch(
      /alter table recipe_ingredients alter column waste_percentage set not null/,
    );

    // ⚠️ E i cinque punti che lo nominavano sono riscritti: un `coalesce`
    //    morto che sembra vivo è la cosa che qualcuno riaccende.
    for (const chi of [
      "fabbisogno_conto",
      "fabbisogno_preparazione",
      "simula_prezzo_ingrediente",
      "v_recipe_row_costs",
      "recipe_ingredients_display",
    ]) {
      expect(codice.toLowerCase(), chi + " non viene riscritta").toMatch(
        new RegExp("create or replace (function|view) (public\\.)?" + chi),
      );
    }

    // 🔴 E NESSUNO DEI CINQUE NOMINA PIÙ IL DEFAULT DEL PRODOTTO — guardato
    //    oggetto per oggetto, non su tutto il file: la sanatoria lo nomina
    //    e DEVE nominarlo (è lei che lo materializza una volta per tutte), e
    //    lo nomina il vincolo, che è suo.
    // ⚠️ Il corpo di ognuno si prende per intero, dalla sua intestazione
    //    alla successiva: un controllo sul solo nome direbbe che c'è senza
    //    guardare cosa fa.
    const pezzi = codice.split(/(?=create or replace (?:function|view))/i);
    for (const chi of [
      "fabbisogno_conto",
      "fabbisogno_preparazione",
      "simula_prezzo_ingrediente",
      "v_recipe_row_costs",
      "recipe_ingredients_display",
    ]) {
      const pezzo = pezzi.find((p) =>
        new RegExp("^create or replace (function|view) (public\\.)?" + chi, "i").test(p.trim()),
      );
      expect(pezzo, "manca il corpo riscritto di " + chi).toBeTruthy();
      // ⚠️ E il pezzo si TAGLIA dove l'istruzione finisce: l'ultimo dei
      //    cinque arriverebbe fino in fondo al file e si porterebbe dentro
      //    la verifica, che il default lo nomina e deve nominarlo. Un
      //    perimetro più largo del vero è un falso allarme che si impara a
      //    spegnere.
      const fine = pezzo.includes("$function$;")
        ? pezzo.indexOf("$function$;")
        : pezzo.search(/;\s*\r?\n/);
      const corpo = pezzo.slice(0, fine > 0 ? fine : pezzo.length);
      expect(corpo, chi + " eredita ancora dal prodotto").not.toContain(
        "waste_percentage_default",
      );
    }
  });

  it("⚠️ e la variabile che portava il default se ne va INSIEME al coalesce", () => {
    // In `simula_prezzo_ingrediente` il numero del prodotto arrivava per
    // un'altra strada: letto in una variabile e usato come secondo
    // argomento. Lasciarla dichiarata e mai usata sarebbe la stessa cosa
    // che lasciare il coalesce.
    const sim = codice.match(
      /CREATE OR REPLACE FUNCTION public\.simula_prezzo_ingrediente[\s\S]*?\$function\$;/,
    )?.[0];
    expect(sim, "manca il simulatore riscritto").toBeTruthy();
    expect(sim).not.toContain("v_scarto");
  });

  it("🔴 e la verifica PROVA che il numero del prodotto non muove una riga scritta", () => {
    // ⚠️ È il controllo per cui questa migrazione esiste nella forma che ha:
    //    senza, «non eredita più» resterebbe una frase.
    expect(codice).toMatch(/update ingredients set waste_percentage_default = 900/);
    expect(codice).toMatch(/doveva restare 275/);
    expect(codice).toMatch(/doveva restare 15,00/);
    // E lo stesso da un'altra strada: il fabbisogno di magazzino. Due
    // letture che si comportassero diversamente sarebbero la forma
    // peggiore, perché ognuna delle due sembra plausibile.
    expect(codice).toMatch(/fabbisogno_preparazione\(v_r2, 1\)/);
    expect(codice).toMatch(/doveva restare 1,5/);
  });

  it("🔴 e sopra 100 si accetta, sotto zero no — provato nei due versi", () => {
    expect(codice).toMatch(/update ingredients set waste_percentage_default = 275/);
    expect(codice).toMatch(/update ingredients set waste_percentage_default = -1/);
    expect(codice).toMatch(/scarto standard negativo doveva essere respinto/);
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

// =====================================================================
// 16 · IL VALORE STANDARD DEL PRODOTTO — precompila una volta, poi tace
// =====================================================================
// 🔴 DECISIONE DI ALESSIO, 22/09/2026, che conferma quella del 25/08 e le dà
//    la forma che le mancava: il campo sulla scheda del prodotto RESTA,
//    facoltativo, e serve **solo a precompilare** lordo e netto quando nasce
//    una riga. Dopo, la riga è autonoma e comanda lei.
describe("16 · il valore standard precompila una volta, e non eredita", () => {
  it("🔴 sotto è uno scarto, sopra si legge una resa — ed è lo stesso numero", () => {
    // Uno scarto del 233,3% è una resa del 30%: da un chilo ne restano 300 g.
    expect(resaDaScarto(233.3)).toBe(30);
    expect(scartoDaResa(30)).toBe(233.33);
    // E senza scarto la resa è piena.
    expect(resaDaScarto(0)).toBe(100);
    expect(scartoDaResa(100)).toBe(0);
  });

  it("⚠️ vuoto resta vuoto nei due versi: «non lo so» non è «non si butta niente»", () => {
    expect(resaDaScarto(null)).toBeNull();
    expect(resaDaScarto("")).toBeNull();
    expect(scartoDaResa(null)).toBeNull();
    expect(scartoDaResa("")).toBeNull();
    // 🔴 E NON diventano zero: uno zero qui vorrebbe dire «resa piena»,
    //    cioè una risposta al posto di un'assenza di risposta.
    expect(resaDaScarto(null)).not.toBe(0);
    expect(scartoDaResa("")).not.toBe(0);
  });

  it("🔴 una resa sopra il 100% si rifiuta: da un chilo non ne escono due", () => {
    expect(scartoDaResa(101)).toBeNull();
    expect(scartoDaResa(0)).toBeNull();
    expect(scartoDaResa(-5)).toBeNull();
    // ⚠️ Ma 100 esatto si accetta: è il prodotto che non si pulisce.
    expect(scartoDaResa(100)).toBe(0);
  });

  it("🔴 uno scarto SOPRA 100 è normale e non si rifiuta", () => {
    // È il caso che il vecchio vincolo respingeva: un sugo di cozze.
    expect(resaDaScarto(275)).toBe(26.7);
    expect(resaDaScarto(900)).toBe(10);
  });

  it("il lordo proposto è il netto più lo scarto standard", () => {
    // 0,4 kg netti con uno scarto standard del 275% → 1,5 kg da prendere.
    expect(lordoPrecompilato(0.4, 275)).toBe(1.5);
    expect(lordoPrecompilato(1, 35)).toBe(1.35);
  });

  it("⚠️ e non si propone niente quando non c'è niente da proporre", () => {
    // 🔴 `null` non è «lordo uguale al netto»: quella sarebbe la proposta
    //    «non si butta niente», cioè una risposta. Qui la risposta non c'è.
    expect(lordoPrecompilato(0.4, null)).toBeNull();
    expect(lordoPrecompilato(0.4, 0)).toBeNull();
    expect(lordoPrecompilato(null, 275)).toBeNull();
    expect(lordoPrecompilato(0, 275)).toBeNull();
  });

  it("🔴 il giro d'andata e ritorno torna: quello che si scrive si rilegge", () => {
    // ⚠️ È il controllo che tiene incollate le due conversioni. Senza, una
    //    potrebbe cambiare e l'altra no, e il numero salvato sarebbe diverso
    //    da quello mostrato — senza nessun errore.
    for (const resa of [10, 26.7, 30, 50, 74.1, 100]) {
      expect(resaDaScarto(scartoDaResa(resa))).toBe(resa);
    }
  });

  it("e lo standard si legge in italiano, non in percentuale di scarto", () => {
    expect(comeSiLeggeLoStandard(233.33, "kg")).toMatch(/da 1 kg ne restano 0\.3 kg/);
    expect(comeSiLeggeLoStandard(233.33, "kg")).toMatch(/resa 30%/);
    expect(comeSiLeggeLoStandard(null, "kg")).toBeNull();
  });
});
