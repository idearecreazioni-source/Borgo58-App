import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  ECCEZIONI_STORICHE,
  argomentiRicostruzione,
  classificaFermate,
  esitoComplessivo,
  esitoRegistro,
  modoRicostruzione,
} from "../../scripts/ricostruzione-regole.mjs";

// La prova di ricarica (npm run ricostruzione:verifica) il 30/09/2026 diceva
// «il registro risulta completo» sotto «342 registrati su 411». Queste prove
// fissano le regole che la rendono affidabile, senza database.

describe("come si applica una migrazione nella ricostruzione", () => {
  it("una migrazione qualunque segue la regola dei comandi veri", () => {
    expect(modoRicostruzione("20260919000001", true)).toMatchObject({ atomica: true, fusoRoma: false, eccezione: null });
    expect(modoRicostruzione("20260919000001", false)).toMatchObject({ atomica: false, fusoRoma: false });
  });

  it("la 20260827000018 si applica a meta', come e' successo davvero", () => {
    const m = modoRicostruzione("20260827000018", true);
    expect(m.atomica).toBe(false);
    expect(m.eccezione.sanataDa).toBe("20260828000007");
  });

  it("la 20260820000010 resta atomica ma gira col fuso di Roma", () => {
    const m = modoRicostruzione("20260820000010", true);
    expect(m).toMatchObject({ atomica: true, fusoRoma: true });
    const arg = argomentiRicostruzione("URL", "f.sql", { ...m, chiedeIlCatalogo: false });
    expect(arg).toContain("--single-transaction");
    const i = arg.indexOf("set timezone = 'Europe/Rome'");
    expect(i).toBeGreaterThan(-1);
    expect(arg[i - 1]).toBe("-c");
    // il fuso va impostato PRIMA del file
    expect(i).toBeLessThan(arg.indexOf("-f"));
  });

  it("nessun'altra migrazione riceve il fuso di Roma", () => {
    const conFuso = ECCEZIONI_STORICHE.filter((e) => e.come === "fuso").map((e) => e.versione);
    expect(conFuso).toEqual(["20260820000010"]);
    const arg = argomentiRicostruzione("URL", "f.sql", { ...modoRicostruzione("20260919000001", true), chiedeIlCatalogo: true });
    expect(arg.join(" ")).not.toMatch(/timezone/);
    expect(arg).toContain("set enable_seqscan = off");
  });

  it("una migrazione a meta' NON ha --single-transaction", () => {
    const arg = argomentiRicostruzione("URL", "f.sql", { ...modoRicostruzione("20260822000003", true), chiedeIlCatalogo: false });
    expect(arg).not.toContain("--single-transaction");
  });

  it("i comandi veri non sono toccati: argomentiMigrazione resta atomica salvo enum", () => {
    const comune = readFileSync("scripts/comune.mjs", "utf8");
    expect(comune).toMatch(/if \(!perIstruzioni\) argomenti\.push\("--single-transaction"\)/);
    expect(comune).not.toMatch(/ricostruzione-regole/);
  });

  it("ogni eccezione esiste come file, ed e' dichiarata con un motivo", () => {
    const cartella = "supabase/migrations";
    const nomi = new Set(readdirSync(cartella).map((f) => f.slice(0, 14)));
    for (const e of ECCEZIONI_STORICHE) {
      expect(nomi.has(e.versione), e.versione).toBe(true);
      expect(e.motivo.length).toBeGreaterThan(20);
      if (e.sanataDa) expect(nomi.has(e.sanataDa), e.sanataDa).toBe(true);
      if (e.come === "a_meta") expect(e.attesa).toBeTruthy();
    }
  });

  it("il messaggio atteso di ogni eccezione sta davvero nel suo file", () => {
    const cartella = "supabase/migrations";
    const elenco = readdirSync(cartella);
    for (const e of ECCEZIONI_STORICHE.filter((x) => x.attesa && x.attesa !== "item_has_source")) {
      const nome = elenco.find((f) => f.startsWith(e.versione));
      const testo = readFileSync(`${cartella}/${nome}`, "utf8").replace(/''/g, "'");
      expect(testo.includes(e.attesa), e.versione).toBe(true);
    }
  });
});

describe("le fermate si dividono in note e inattese", () => {
  const applicate = ["20260822000003", "20260827000018", "20260826000013", "20260917000001"];

  it("un'eccezione col messaggio atteso e' nota", () => {
    const { note, inattese } = classificaFermate(
      [{ versione: "20260827000018", motivo: "ERROR:  Il pareggio di istante sceglie a caso: 12.0000 invece di 21,00" }],
      applicate
    );
    expect(note).toHaveLength(1);
    expect(inattese).toHaveLength(0);
  });

  it("un'eccezione che si ferma con un ALTRO messaggio e' inattesa", () => {
    const { note, inattese } = classificaFermate(
      [{ versione: "20260827000018", motivo: "ERROR:  relation \"x\" does not exist" }],
      applicate
    );
    expect(note).toHaveLength(0);
    expect(inattese).toHaveLength(1);
  });

  it("una migrazione senza eccezione che si ferma e' inattesa", () => {
    const { inattese } = classificaFermate(
      [{ versione: "20260826000013", motivo: "ERROR:  Il tetto senza autore dice …" }],
      applicate
    );
    expect(inattese).toHaveLength(1);
  });

  it("la 20260820000010 (fuso) non deve fermarsi: se si ferma e' inattesa", () => {
    const { inattese } = classificaFermate(
      [{ versione: "20260820000010", motivo: "ERROR:  Lo scostamento è passato da 0 a 0" }],
      ["20260820000010"]
    );
    expect(inattese).toHaveLength(1);
  });

  it("un'eccezione che doveva fermarsi e non l'ha fatto viene segnalata", () => {
    const { nonScattate } = classificaFermate([], applicate);
    expect(nonScattate.map((e) => e.versione)).toEqual(
      expect.arrayContaining(["20260822000003", "20260827000018", "20260917000001"])
    );
  });
});

describe("il registro e' completo solo se lo e' davvero", () => {
  it("stesse versioni → completo", () => {
    expect(esitoRegistro(["a", "b"], ["a", "b"]).completo).toBe(true);
  });

  it("342 righe su 411 file → incompleto, con le mancanti nominate", () => {
    const file = Array.from({ length: 411 }, (_, i) => String(i));
    const reg = file.slice(0, 342);
    const r = esitoRegistro(file, reg);
    expect(r.completo).toBe(false);
    expect(r.mancanti).toHaveLength(69);
  });

  it("stessi CONTEGGI ma versioni diverse → incompleto (una in piu' e una in meno)", () => {
    const r = esitoRegistro(["a", "b"], ["a", "z"]);
    expect(r.completo).toBe(false);
    expect(r.mancanti).toEqual(["b"]);
    expect(r.estranee).toEqual(["z"]);
  });
});

describe("l'esito complessivo non si colora di verde da solo", () => {
  const completo = { completo: true, mancanti: [], estranee: [] };
  it("tutto a posto → verde", () => {
    expect(esitoComplessivo({ inattese: [], registro: completo, differenze: 0 }).verde).toBe(true);
  });
  it("registro incompleto → rosso anche senza errori inattesi", () => {
    const e = esitoComplessivo({ inattese: [], registro: { completo: false, mancanti: ["x"], estranee: [] }, differenze: 0 });
    expect(e.verde).toBe(false);
    expect(e.motivi.join()).toMatch(/registro incompleto/);
  });
  it("differenze di schema → rosso", () => {
    expect(esitoComplessivo({ inattese: [], registro: completo, differenze: 3 }).verde).toBe(false);
  });
  it("un errore inatteso → rosso", () => {
    expect(esitoComplessivo({ inattese: [{}], registro: completo, differenze: 0 }).verde).toBe(false);
  });
});

describe("lo strumento non contiene piu' le frasi false", () => {
  const testo = readFileSync("scripts/ricostruzione-verifica.mjs", "utf8");
  it("non dice «risulta completo» dentro un console.log fisso", () => {
    expect(testo).not.toMatch(/console\.log\([^)]*risulta completo/);
    expect(testo).not.toMatch(/console\.log\([^)]*gia' passate/);
    expect(testo).not.toMatch(/Tutte e 245/);
  });
  it("non taglia le differenze di schema", () => {
    expect(testo).not.toMatch(/e altre \$\{/);
  });
  it("la parola «completo» nel referto dipende da esitoRegistro", () => {
    expect(testo).toMatch(/if \(registro\.completo\)/);
  });
});
