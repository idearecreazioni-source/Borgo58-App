import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buchiDellaBozza,
  nuovoGesto,
  quantitaDalCampo,
  statoLeggibile,
} from "../../src/lib/calcoli/bozzeRicetta";
import { VERSIONI_DA_REGISTRARE } from "../../scripts/contratto-preflight-rilascio.mjs";

// LE BOZZE DI RICETTA — le prove che non toccano niente (Fase 1A, 06/10/2026).
//
// ⚠️ La migrazione 20261006000001 NON è applicata da nessuna parte: quello che
//    accade nel database lo prova il suo blocco di verifica (quando verrà
//    applicata) e tests/app/bozze-ricetta.test.js (che fino ad allora si
//    spegne da solo e lo dice). Qui si prova ciò che si può provare senza
//    database: la regola dei buchi, che le due definizioni dicano le stesse
//    frasi, e che il browser passi SOLO dal corridoio.

const VERSIONE = "20261006000001";
const FILE = readdirSync("supabase/migrations").filter((f) => f.startsWith(`${VERSIONE}_`));
const SQL = FILE.length === 1 ? readFileSync(`supabase/migrations/${FILE[0]}`, "utf8") : "";
// Il corpo della funzione di promozione, e solo quello.
const CORPO = SQL.slice(
  SQL.indexOf("create or replace function promuovi_bozza_ricetta("),
  SQL.indexOf("$funzione$;", SQL.indexOf("create or replace function promuovi_bozza_ricetta("))
);
// Il codice del file, senza i commenti: un campo NOMINATO in una spiegazione non
// e' un campo mandato.
const API = readFileSync("src/lib/api/bozzeRicetta.js", "utf8").replace(/^\s*\/\/.*$/gm, "");
const CORRIDOIO = readFileSync("supabase/functions/operazioni-atomiche/index.ts", "utf8");

const BOZZA_COMPLETA = { categoria: "primo", porzioni: 4, buchi_dichiarati: [] };
const RIGA_BUONA = { nome: "guanciale", ingredient_id: "i1", quantita: 200, unita: "g" };
const PASSO_BUONO = { fase: "cottura", descrizione: "rosolare" };

describe("i buchi di una bozza", () => {
  it("una bozza completa non ne ha", () => {
    expect(buchiDellaBozza(BOZZA_COMPLETA, [RIGA_BUONA], [PASSO_BUONO], ["g", "kg"])).toEqual([]);
  });

  it("🔴 una quantità assente resta un buco, e uno zero dal campo NON diventa una quantità", () => {
    const riga = { ...RIGA_BUONA, quantita: null };
    expect(buchiDellaBozza(BOZZA_COMPLETA, [riga], [PASSO_BUONO], ["g"])).toEqual([
      "«guanciale»: quantita' mancante",
    ]);
    expect(quantitaDalCampo("")).toBeNull();
    expect(quantitaDalCampo("0")).toBeNull();
    expect(quantitaDalCampo("   ")).toBeNull();
    expect(quantitaDalCampo("1,5")).toBe(1.5);
  });

  it("un ingrediente non collegato e un'unità non compresa si dicono, non si indovinano", () => {
    const riga = { nome: "pecorino", ingredient_id: null, quantita: null, unita: "cucchiaio" };
    expect(buchiDellaBozza(BOZZA_COMPLETA, [riga], [PASSO_BUONO], ["g"])).toEqual([
      "«pecorino»: non collegato a un ingrediente dell'anagrafica",
      "«pecorino»: quantita' mancante",
      "«pecorino»: unita' non compresa («cucchiaio»)",
    ]);
  });

  it("li nomina TUTTI insieme, anche quelli della bozza e dei passaggi", () => {
    const buchi = buchiDellaBozza(
      { categoria: null, porzioni: null, buchi_dichiarati: ["unità non capita al passo 2"] },
      [],
      [{ fase: null, descrizione: "  " }],
      ["g"]
    );
    expect(buchi).toEqual([
      "manca la categoria",
      "mancano le porzioni",
      "segnalazioni ancora aperte: unità non capita al passo 2",
      "nessun ingrediente",
      "passaggio 1: manca la fase",
      "passaggio 1: manca la descrizione",
    ]);
  });

  it("un finger non nasce da una bozza", () => {
    expect(
      buchiDellaBozza({ ...BOZZA_COMPLETA, categoria: "finger_food" }, [RIGA_BUONA], [], ["g"])
    ).toEqual(["i finger si creano dal Ricettario: questa bozza non puo' diventarne uno"]);
  });

  it("il gesto nasce anche dove randomUUID non c'è (un indirizzo http:// del locale)", () => {
    const soloCasuale = { getRandomValues: (a) => a.fill(171) };
    expect(nuovoGesto(soloCasuale)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(nuovoGesto()).not.toBe(nuovoGesto());
  });

  it("«diventata ricetta» lo dice la promozione, non lo stato", () => {
    expect(statoLeggibile({ stato: "in_revisione", promossa_il: "2026-10-06T10:00:00Z" })).toBe(
      "Diventata ricetta"
    );
    expect(statoLeggibile({ stato: "scartata", promossa_il: null })).toBe("Scartata");
  });
});

describe("🔴 le due definizioni dei buchi dicono le stesse frasi", () => {
  // Le parti fisse di ogni frase di src/lib/calcoli/bozzeRicetta.js devono
  // comparire nel corpo della funzione del database, che le fa rispettare.
  const FISSE = [
    "manca la categoria",
    "i finger si creano dal Ricettario: questa bozza non puo' diventarne uno",
    "mancano le porzioni",
    "segnalazioni ancora aperte: ",
    "nessun ingrediente",
    "»: non collegato a un ingrediente dell'anagrafica",
    "»: quantita' mancante",
    "»: unita' mancante",
    "»: unita' non compresa («",
    ": manca la fase",
    ": manca la descrizione",
  ];
  const corpo = CORPO.replace(/''/g, "'");

  it("il corpo della funzione si trova", () => {
    expect(FILE).toHaveLength(1);
    expect(CORPO.length).toBeGreaterThan(1000);
  });

  for (const f of FISSE) {
    it(`«${f}» c'è anche nel database`, () => {
      expect(corpo).toContain(f);
    });
  }

  it("e le stesse parti fisse sono quelle del modulo (nessuna frase solo da una parte)", () => {
    const modulo = readFileSync("src/lib/calcoli/bozzeRicetta.js", "utf8");
    for (const f of FISSE) expect(modulo).toContain(f);
  });
});

describe("la conferma passa solo dal corridoio", () => {
  it("🔴 l'operazione nuova è nell'elenco chiuso del corridoio", () => {
    const dentro = CORRIDOIO.slice(
      CORRIDOIO.indexOf("const OPERAZIONI = new Set(["),
      CORRIDOIO.indexOf("]);", CORRIDOIO.indexOf("const OPERAZIONI = new Set(["))
    );
    expect(dentro).toMatch(/^\s*"promuovi_bozza_ricetta",$/m);
  });

  it("il browser la chiede col nome giusto, attraverso eseguiOperazione", () => {
    expect(API).toMatch(/eseguiOperazione\(\s*"promuovi_bozza_ricetta"/);
  });

  it("🔴 dal browser nessuna scrittura sul Ricettario vero, e nessuna RPC diretta", () => {
    expect(API).not.toMatch(/from\(\s*"(recipes|recipe_ingredients|recipe_steps)"/);
    expect(API).not.toMatch(/\.rpc\(/);
    for (const f of ["BozzeList.jsx", "BozzaDetail.jsx"]) {
      const pagina = readFileSync(`src/pages/ricettario/${f}`, "utf8");
      expect(pagina, f).not.toMatch(/lib\/supabase/);
      expect(pagina, f).not.toMatch(/\.rpc\(|\.from\(/);
    }
  });

  it("i campi della promozione non partono mai dal browser", () => {
    // Si leggono (l'elenco mostra se una bozza è diventata ricetta), ma non
    // compaiono mai come campi di una scrittura.
    expect(API).not.toMatch(/(promossa_il|gesto_promozione|ricetta_id)s*:/);
    expect(API).not.toContain("gesto_promozione");
    const campi = API.slice(API.indexOf("const CAMPI_BOZZA"), API.indexOf("];", API.indexOf("const CAMPI_BOZZA")));
    expect(campi).not.toMatch(/promossa_il|ricetta_id|stato/);
  });
});

describe("la migrazione delle bozze", () => {
  it("viene dopo tutte, e NON fa parte delle 17 dell'allineamento", () => {
    expect(VERSIONE > "20260929000001").toBe(true);
    expect(VERSIONI_DA_REGISTRARE).not.toContain(VERSIONE);
    expect(Math.max(...VERSIONI_DA_REGISTRARE.map(Number))).toBeLessThan(Number(VERSIONE));
  });

  it("le ricette nascono in un posto solo: dentro la funzione di promozione", () => {
    const fuori = SQL.replace(CORPO, "");
    expect((SQL.match(/insert into recipes\b/g) ?? []).length).toBe(1);
    expect(fuori).not.toMatch(/insert into (recipes|recipe_ingredients|recipe_steps)\b/);
  });

  it("nessun ingrediente viene creato fuori dalla verifica", () => {
    const primaDellaVerifica = SQL.slice(0, SQL.indexOf("do $verifica$"));
    expect(primaDellaVerifica).not.toMatch(/insert into ingredients\b/);
    expect(CORPO).not.toMatch(/insert into ingredients\b/);
  });

  it("la promozione ha il portiere, e l'unica concessione è quella del corridoio", () => {
    expect(CORPO).toMatch(/if not is_titolare\(\) then/);
    expect(SQL).toMatch(
      /revoke all on function promuovi_bozza_ricetta\(uuid, text, uuid\) from public, anon, authenticated;/
    );
    const concessioni = SQL.match(/grant execute on function promuovi_bozza_ricetta[^;]*;/g) ?? [];
    expect(concessioni).toEqual([
      "grant execute on function promuovi_bozza_ricetta(uuid, text, uuid) to authenticated;",
    ]);
    expect(SQL).not.toMatch(/to anon\b/);
  });

  it("le tre tabelle sono titolare-only", () => {
    for (const t of ["bozze_ricetta", "bozze_ricetta_ingredienti", "bozze_ricetta_passaggi"]) {
      expect(SQL).toContain(`alter table ${t} enable row level security;`);
      expect(SQL).toMatch(
        new RegExp(`create policy ${t}_titolare_all on ${t}\\s+for all to authenticated\\s+using \\(\\(select is_titolare\\(\\)\\)\\) with check \\(\\(select is_titolare\\(\\)\\)\\);`)
      );
    }
  });

  it("dal browser non si dichiara una promozione: le colonne non sono concesse", () => {
    const grant = SQL.match(/grant (insert|update) \(([^)]*)\)\s+on bozze_ricetta to authenticated;/g) ?? [];
    expect(grant).toHaveLength(2);
    for (const g of grant) expect(g).not.toMatch(/promossa_il|ricetta_id|gesto_promozione/);
  });

  it("il doppio tocco: lo stesso gesto ripetuto riceve la stessa ricetta, prima di qualunque scrittura", () => {
    const ripetuto = CORPO.indexOf("if v_bozza.gesto_promozione = p_gesto then");
    expect(ripetuto).toBeGreaterThan(-1);
    expect(CORPO.indexOf("for update")).toBeLessThan(ripetuto);
    expect(ripetuto).toBeLessThan(CORPO.indexOf("insert into recipes"));
  });

  it("si registra col proprio numero e porta il blocco di verifica annullato", () => {
    expect(SQL).toMatch(new RegExp(`values \\('${VERSIONE}', 'le_bozze_di_ricetta'\\)`));
    expect(SQL).toContain("raise exception 'ZZ_ANNULLA';");
    expect(SQL).toContain("perform pretendi_nessun_residuo(v_foto, ");
  });
});

describe("la schermata non è esposta finché non è installata", () => {
  it("nessun collegamento alle bozze nel menu o nella pagina del Ricettario", () => {
    for (const f of ["src/components/Sidebar.jsx", "src/pages/ricettario/RicettarioHome.jsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toContain("/ricettario/bozze");
    }
  });
});
