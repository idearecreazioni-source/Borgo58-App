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

  // Il testo di una migrazione, con gli apici raddoppiati di SQL riportati a uno.
  const cartella = "supabase/migrations";
  const leggi = (versione) => {
    const nome = readdirSync(cartella).find((f) => f.startsWith(versione));
    return readFileSync(`${cartella}/${nome}`, "utf8").replace(/''/g, "'");
  };
  const senzaCommenti = (t) => t.replace(/--[^\n]*/g, "");

  it("il messaggio atteso di OGNI eccezione ha una provenienza dimostrata, senza esclusioni", () => {
    const conAttesa = ECCEZIONI_STORICHE.filter((x) => x.attesa);
    expect(conAttesa.length).toBe(10);
    for (const e of conAttesa) {
      // Dove deve stare: nel suo file, oppure nella migrazione dichiarata.
      // ⚠️ Nel CODICE, non in un commento: una migrazione che si limita a
      //    nominare quel messaggio non lo produce.
      const dove = e.origineAttesa ?? e.versione;
      expect(senzaCommenti(leggi(dove)).includes(e.attesa), `${e.versione} → ${dove}`).toBe(true);
    }
  });

  it("origineAttesa si dichiara solo quando serve, e punta a una migrazione precedente", () => {
    const nomi = new Set(readdirSync(cartella).map((f) => f.slice(0, 14)));
    for (const e of ECCEZIONI_STORICHE.filter((x) => x.origineAttesa)) {
      expect(nomi.has(e.origineAttesa), e.origineAttesa).toBe(true);
      expect(e.origineAttesa < e.versione, e.versione).toBe(true);
      // Se il messaggio stesse (fuori dai commenti) nel suo file, il campo
      // sarebbe una dichiarazione di troppo.
      expect(senzaCommenti(leggi(e.versione)).includes(e.attesa), e.versione).toBe(false);
    }
    // Ed e' il solo caso: chi non lo dichiara ha il messaggio nel proprio file.
    expect(ECCEZIONI_STORICHE.filter((x) => x.origineAttesa).map((x) => x.versione)).toEqual(["20260822000003"]);
  });

  it("la 20260822000003 fa scattare item_has_source: la catena, anello per anello", () => {
    // 1. Il vincolo nasce nella 20260804000005, su order_items, e pretende
    //    una ricetta OPPURE un nome libero.
    const origine = senzaCommenti(leggi("20260804000005"));
    const tabella = origine.slice(origine.search(/create table[^(]*\border_items\b/i));
    const corpo = tabella.slice(0, tabella.indexOf(");"));
    expect(corpo).toMatch(
      /constraint\s+item_has_source\s+check\s*\(\s*recipe_id is not null or free_text_name is not null\s*\)/i
    );

    // 2. Nessun'altra migrazione lo ridefinisce o lo toglie prima della 0822-003.
    const prima = readdirSync(cartella).filter((f) => f.slice(0, 14) < "20260822000003" && !f.startsWith("20260804000005"));
    for (const f of prima) {
      expect(senzaCommenti(readFileSync(`${cartella}/${f}`, "utf8")).includes("item_has_source"), f).toBe(false);
    }

    // 3. La verifica della 0822-003 prende la ricetta da «una qualsiasi» —
    //    null su un database vuoto — e inserisce in order_items senza nome libero.
    const lei = senzaCommenti(leggi("20260822000003"));
    expect(lei).toMatch(/select id into v_ricetta from recipes limit 1/i);
    const inserimenti = [...lei.matchAll(/insert into order_items\s*\(([^)]*)\)\s*values\s*\(([^)]*)\)/gi)];
    expect(inserimenti.length).toBeGreaterThan(0);
    const primo = inserimenti[0];
    expect(primo[1]).toMatch(/\brecipe_id\b/);
    expect(primo[1]).not.toMatch(/free_text_name/);
    expect(primo[2]).toMatch(/\bv_ricetta\b/);

    // 4. E quel primo inserimento viene PRIMA di ogni altro controllo che
    //    potrebbe fermarla con un messaggio suo.
    const verifica = lei.slice(lei.search(/select id into v_ricetta from recipes limit 1/i));
    expect(verifica.slice(0, verifica.search(/insert into order_items/i))).not.toMatch(/raise exception/i);
  });
});

describe("le due storie aggiunte il 30/09 (mandato M20-E)", () => {
  const cartella = "supabase/migrations";
  const leggi = (versione) => {
    const nome = readdirSync(cartella).find((f) => f.startsWith(versione));
    return readFileSync(`${cartella}/${nome}`, "utf8").replace(/--[^\n]*/g, "");
  };
  // Le versioni che una migrazione scrive nel registro, fuori dai commenti.
  const registra = (versione) => {
    const testo = leggi(versione);
    const trovate = [];
    for (const m of testo.matchAll(/insert into applied_migrations\s*\(version, name\)\s*values([^;]*);/gi)) {
      for (const v of m[1].matchAll(/\(\s*'(\d{14})'/g)) trovate.push(v[1]);
    }
    return trovate;
  };

  it("la 20260827000006 si applica a meta', sanata dalla 20260827000017", () => {
    const m = modoRicostruzione("20260827000006", true);
    expect(m.atomica).toBe(false);
    expect(m.fusoRoma).toBe(false);
    expect(m.eccezione.sanataDa).toBe("20260827000017");
  });

  it("la 20260829000006 resta atomica con fermata nota, sanata dalla 20260829000022", () => {
    const m = modoRicostruzione("20260829000006", true);
    expect(m.atomica).toBe(true);
    expect(m.eccezione.come).toBe("nota");
    expect(m.eccezione.sanataDa).toBe("20260829000022");
  });

  it("la 20260827000017 registra sia la 20260827000006 sia se stessa", () => {
    expect(registra("20260827000017")).toEqual(["20260827000006", "20260827000017"]);
  });

  it("la 20260829000022 registra la 20260829000006, e poi se stessa", () => {
    expect(registra("20260829000022")).toEqual(["20260829000006", "20260829000022"]);
  });

  it("OGNI sanatrice dichiarata registra davvero la versione che sana", () => {
    for (const e of ECCEZIONI_STORICHE.filter((x) => x.sanataDa)) {
      expect(registra(e.sanataDa), `${e.sanataDa} → ${e.versione}`).toContain(e.versione);
      expect(e.sanataDa > e.versione, e.versione).toBe(true);
    }
  });

  it("col messaggio atteso sono note; con un messaggio diverso restano inattese", () => {
    const applicate = ["20260827000006", "20260829000006"];
    const giuste = classificaFermate(
      [
        { versione: "20260827000006", motivo: "ERROR:  La lista della spesa si e' fermata su un prodotto noto: «Non ho capito che cosa aggiungere alla lista.»" },
        { versione: "20260829000006", motivo: "ERROR:  Verifica impossibile: nessuna partita con scadenza in giacenza." },
      ],
      applicate
    );
    expect(giuste.note.map((f) => f.versione)).toEqual(applicate);
    expect(giuste.inattese).toHaveLength(0);

    const altre = classificaFermate(
      [
        { versione: "20260827000006", motivo: "ERROR:  Il ramo della lista della spesa non ha la forma attesa" },
        { versione: "20260829000006", motivo: "ERROR:  Verifica impossibile: nessun titolare." },
      ],
      applicate
    );
    expect(altre.note).toHaveLength(0);
    expect(altre.inattese.map((f) => f.versione)).toEqual(applicate);
  });

  it("la 20260827000017 NON e' un'eccezione: se si ferma e' un errore inatteso", () => {
    expect(ECCEZIONI_STORICHE.some((e) => e.versione === "20260827000017")).toBe(false);
    const { inattese } = classificaFermate(
      [{ versione: "20260827000017", motivo: "ERROR:  Un identificativo passato a mano e' arrivato in tabella." }],
      ["20260827000017"]
    );
    expect(inattese).toHaveLength(1);
  });

  it("l'elenco e' chiuso: undici eccezioni, queste e non altre", () => {
    expect(ECCEZIONI_STORICHE.map((e) => e.versione)).toEqual([
      "20260820000010", "20260822000003", "20260823000024", "20260824000033",
      "20260826000013", "20260827000006", "20260827000018", "20260829000006",
      "20260917000001", "20260920000001", "20260921000001",
    ]);
  });
});

describe("la 20260826000013 a meta' (mandato M20-G)", () => {
  const cartella = "supabase/migrations";
  const elenco = readdirSync(cartella).filter((f) => f.endsWith(".sql")).sort();
  const nome = elenco.find((f) => f.startsWith("20260826000013"));
  const testo = readFileSync(`${cartella}/${nome}`, "utf8").replace(/--[^\n]*/g, "");

  it("solo nella ricostruzione e' non atomica, e senza fuso", () => {
    const m = modoRicostruzione("20260826000013", true);
    expect(m).toMatchObject({ atomica: false, fusoRoma: false });
    expect(m.eccezione.sanataDa).toBeNull();
    const arg = argomentiRicostruzione("URL", "f.sql", { ...m, chiedeIlCatalogo: false });
    expect(arg).not.toContain("--single-transaction");
    // I comandi veri non leggono le eccezioni: la regola di produzione resta.
    expect(readFileSync("scripts/comune.mjs", "utf8")).not.toMatch(/ricostruzione-regole/);
  });

  it("crea la funzione PRIMA della verifica che si ferma, e si registra solo DOPO", () => {
    const crea = testo.search(/create or replace function chi_ha_messo_il_tetto\s*\(/i);
    const verifica = testo.search(/do \$verifica\$/i);
    const fermata = testo.indexOf("Il tetto senza autore dice");
    const registra = testo.search(/insert into applied_migrations/i);
    expect(crea).toBeGreaterThan(-1);
    expect(crea).toBeLessThan(verifica);
    expect(verifica).toBeLessThan(fermata);
    expect(fermata).toBeLessThan(registra);
    // e la verifica si ferma sul controllo (A) solo se il tetto e' vuoto:
    // la frase che produce la funzione in quel caso e' «Nessun tetto…».
    expect(testo).toMatch(/when v_r\.tetto_mensile_euro is null then\s*'Nessun tetto: le letture non si fermano mai da sole\.'/);
  });

  it("nessuna migrazione successiva ricrea la funzione o registra la versione", () => {
    const dopo = elenco.filter((f) => f.slice(0, 14) > "20260826000013");
    expect(dopo.length).toBeGreaterThan(0);
    for (const f of dopo) {
      const t = readFileSync(`${cartella}/${f}`, "utf8").replace(/--[^\n]*/g, "");
      expect(/function (public\.)?chi_ha_messo_il_tetto\s*\(/i.test(t), f).toBe(false);
      expect(t.includes("20260826000013"), f).toBe(false);
    }
    // e nessuna eccezione la dichiara sanata o ne fa l'origine di un messaggio
    expect(ECCEZIONI_STORICHE.some((e) => e.sanataDa === "20260826000013" || e.origineAttesa === "20260826000013")).toBe(false);
  });

  it("col messaggio atteso e' nota; con un messaggio diverso resta inattesa", () => {
    const nota = classificaFermate(
      [{ versione: "20260826000013", motivo: "ERROR:  Il tetto senza autore dice «Nessun tetto: le letture non si fermano mai da sole.», e doveva dire che non l'ha messo nessuno." }],
      ["20260826000013"]
    );
    expect(nota.note).toHaveLength(1);
    expect(nota.inattese).toHaveLength(0);
    const altra = classificaFermate(
      [{ versione: "20260826000013", motivo: "ERROR:  Non c'e' nessuna riga di impostazioni_ai: questa verifica non puo' girare." }],
      ["20260826000013"]
    );
    expect(altra.note).toHaveLength(0);
    expect(altra.inattese).toHaveLength(1);
  });

  it("senza sanatrice, resta fra le mancanti del registro anche se la fermata e' nota", () => {
    const file = ["20260826000013", "20260826000014"];
    const r = esitoRegistro(file, ["20260826000014"]);
    expect(r.completo).toBe(false);
    expect(r.mancanti).toEqual(["20260826000013"]);
    expect(esitoComplessivo({ inattese: [], registro: r, differenze: 0 }).verde).toBe(false);
  });
});

describe("le fermate si dividono in note e inattese", () => {
  const applicate = ["20260822000003", "20260827000018", "20260827000017", "20260917000001"];

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
      [{ versione: "20260827000017", motivo: "ERROR:  Un identificativo passato a mano e' arrivato in tabella." }],
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
