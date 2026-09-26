import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ESCLUSI_DI_SEMPRE,
  argomentiDiEsclusione,
  funzioniCheCostano,
  proveCheCostano,
} from "../../scripts/prove-che-costano.mjs";

// =====================================================================
// LE PROVE CHE COSTANO SOLDI NON GIRANO DA SOLE — 09/09/2026
// =====================================================================
// 🔴 I controlli su GitHub partono a ogni proposta. Se fra le prove ce n'è
//    una che chiama davvero il modello, quella spesa parte da sola a ogni
//    giro — e non è una scelta di nessuno. Qui si prova la regola che la
//    tiene fuori, e soprattutto che **la ricava** invece di contenerla:
//    l'elenco scritto a mano è la forma che in questo progetto è già
//    scaduta quattro volte.

/** Un finto progetto su disco, per provare la regola senza il vero. */
const casette = [];
function progettoFinto({ funzioni = {}, prove = {} }) {
  const radice = fs.mkdtempSync(path.join(os.tmpdir(), "b58-costi-"));
  casette.push(radice);
  for (const [nome, testo] of Object.entries(funzioni)) {
    const d = path.join(radice, "supabase", "functions", nome);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "index.ts"), testo, "utf8");
  }
  const d = path.join(radice, "tests", "app");
  fs.mkdirSync(d, { recursive: true });
  for (const [nome, testo] of Object.entries(prove)) {
    fs.writeFileSync(path.join(d, nome), testo, "utf8");
  }
  return radice;
}

afterEach(() => {
  while (casette.length) fs.rmSync(casette.pop(), { recursive: true, force: true });
});

describe("quali funzioni online si pagano", () => {
  it("si riconoscono dal loro sorgente, non da un elenco", () => {
    const r = progettoFinto({
      funzioni: {
        "ascolta-voce": 'import Anthropic from "npm:@anthropic-ai/sdk";',
        "operazioni-atomiche": "const x = 1;",
      },
    });
    expect([...funzioniCheCostano(r)].sort()).toEqual(["ascolta-voce"]);
  });

  it("🔴 e si guarda TUTTA la cartella, non il solo file d'ingresso", () => {
    // Il giorno che la chiamata si sposta in un file accanto, guardare solo
    // `index.ts` direbbe che quella funzione non costa più niente.
    const r = progettoFinto({ funzioni: { "leggi-foto": "export const a = 1;" } });
    fs.writeFileSync(
      path.join(r, "supabase", "functions", "leggi-foto", "modello.ts"),
      'import Anthropic from "npm:@anthropic-ai/sdk";',
      "utf8"
    );
    expect([...funzioniCheCostano(r)]).toEqual(["leggi-foto"]);
  });
});

describe("quali prove restano fuori", () => {
  it("quella che invoca una funzione a pagamento", () => {
    const r = progettoFinto({
      funzioni: { "ascolta-voce": "new Anthropic();", "operazioni-atomiche": "const x = 1;" },
      prove: {
        "cara.test.js": 'await c.functions.invoke("ascolta-voce", { body: {} });',
        "gratis.test.js": 'await c.functions.invoke("operazioni-atomiche", { body: {} });',
      },
    });
    expect(proveCheCostano(r)).toEqual([
      { file: "tests/app/cara.test.js", funzioni: ["ascolta-voce"] },
    ]);
  });

  it("🔴 NOMINARE una funzione non è CHIAMARLA", () => {
    // `tests/app/permessi.test.js` elenca le funzioni online per contarle,
    // e non ne chiama nessuna: trattarla come cara spegnerebbe una prova
    // che non costa un centesimo.
    const r = progettoFinto({
      funzioni: { "ascolta-voce": "new Anthropic();" },
      prove: { "conta.test.js": 'const attese = ["ascolta-voce", "leggi-foto"];' },
    });
    expect(proveCheCostano(r)).toEqual([]);
  });

  it("un progetto senza funzioni a pagamento non lascia fuori niente", () => {
    const r = progettoFinto({
      funzioni: { "operazioni-atomiche": "const x = 1;" },
      prove: { "gratis.test.js": 'await c.functions.invoke("operazioni-atomiche", {});' },
    });
    expect(proveCheCostano(r)).toEqual([]);
    expect(argomentiDiEsclusione(r).argomenti).toEqual([]);
  });
});

describe("gli argomenti che si passano a vitest", () => {
  it("🔴 rimettono gli esclusi di sempre accanto ai nostri", () => {
    // `--exclude` sulla riga di comando SOSTITUISCE quelli della
    // configurazione invece di aggiungersi: senza rimetterli, si tornerebbe
    // a frugare dentro node_modules.
    const r = progettoFinto({
      funzioni: { "ascolta-voce": "new Anthropic();" },
      prove: { "cara.test.js": 'await c.functions.invoke("ascolta-voce", {});' },
    });
    const { argomenti } = argomentiDiEsclusione(r);
    for (const g of ESCLUSI_DI_SEMPRE) expect(argomenti).toContain(g);
    expect(argomenti).toContain("**/cara.test.js");
    expect(argomenti.filter((a) => a === "--exclude")).toHaveLength(
      ESCLUSI_DI_SEMPRE.length + 1
    );
  });
});

describe("🔴 sul progetto VERO, e questa è quella che conta", () => {
  it("l'unica prova che chiama il modello è fuori dal giro automatico", () => {
    // ⚠️ Se un giorno ne nascesse un'altra, questa prova NON diventa rossa:
    //    la regola la lascerebbe fuori da sola, che è il punto. Quello che
    //    si pretende qui è che la regola VEDA quella che c'è — una regola
    //    che non trova niente sarebbe indistinguibile da una spenta.
    const fuori = proveCheCostano(".");
    expect(fuori.length).toBeGreaterThan(0);
    expect(fuori.map((f) => f.file)).toContain("tests/app/domande-memo.test.js");
  });
});
