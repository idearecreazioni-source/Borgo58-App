import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// LA VOCE SI CHIUDE COL DATO — la rete sulle schermate, 27/10/2026
// =====================================================================
// 🔴 Il difetto che i due lotti (20261026000002, 20261027000001) tolgono:
//    una cosa detta a MEMO e finita a mano si chiudeva con una SECONDA
//    chiamata dopo il salvataggio (`venuto.chiudi()`), e un errore fra le
//    due lasciava il dato scritto e la cosa «da fare». Qui si controlla
//    che le schermate convertite non tornino indietro, e che ogni gemella
//    «_da_voce» chiamata dall'app sia ammessa dal corridoio e creata da
//    una migrazione.
//
// ⚠️ È una rete sul testo: dice che la chiamata è scritta, non che il
//    database chiuda davvero. Quello lo provano le verifiche dentro le
//    migrazioni e `tests/app/voce-chiusa-col-dato*.test.js`.

const CONVERTITE = [
  "src/pages/cassa/PrimaNota.jsx",
  "src/pages/magazzino/SpesaSpicciola.jsx",
  "src/pages/magazzino/MagazzinoHome.jsx",
  "src/pages/magazzino/Allineamento.jsx",
  "src/pages/magazzino/RegistraCarico.jsx",
  "src/pages/magazzino/ListaSpesa.jsx",
  "src/pages/haccp/TemperatureLog.jsx",
  "src/pages/haccp/PuliziaESanificazione.jsx",
];

const corridoio = readFileSync("supabase/functions/operazioni-atomiche/index.ts", "utf8");
const migrazioni = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

describe("le schermate convertite chiudono la cosa detta insieme al dato", () => {
  for (const file of CONVERTITE) {
    it(`${file}: l'id viaggia con la scrittura, e la seconda chiamata non c'è più`, () => {
      const testo = readFileSync(file, "utf8");
      expect(testo).toMatch(/azioneDettataId: chiudendo/);
      expect(testo).toMatch(/venuto\.segnaChiusa\(\)/);
      expect(testo).not.toMatch(/venuto\.chiudi\(\)/);
    });
  }
});

describe("ogni operazione «da voce» chiamata dall'app esiste davvero", () => {
  const usate = new Set();
  for (const f of readdirSync("src/lib/api").filter((x) => x.endsWith(".js"))) {
    const testo = readFileSync(`src/lib/api/${f}`, "utf8");
    for (const m of testo.matchAll(/eseguiOperazione\("([a-z_]+_da_voce|registra_movimento_cassa|aggiungi_spesa_spicciola)"/g)) {
      usate.add(m[1]);
    }
  }

  it("sono almeno le otto dei due lotti", () => {
    expect(usate.size).toBeGreaterThanOrEqual(8);
  });

  for (const nome of ["registra_movimento_cassa", "aggiungi_spesa_spicciola", "record_stock_consumption_da_voce",
    "allinea_giacenza_da_voce", "register_stock_delivery_da_voce", "registra_temperatura_da_voce",
    "registra_pulizia_da_voce", "add_shopping_list_item_da_voce"]) {
    it(`${nome}: l'app la chiama, il corridoio la ammette, una migrazione la crea`, () => {
      expect(usate.has(nome), `l'app non chiama ${nome}`).toBe(true);
      expect(corridoio, `${nome} manca dall'elenco del corridoio`).toContain(`"${nome}"`);
      expect(migrazioni).toMatch(new RegExp(`create or replace function ${nome}\\s*\\(`));
    });
  }
});
