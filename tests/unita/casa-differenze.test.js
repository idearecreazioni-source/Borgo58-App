import { describe, expect, it } from "vitest";
import { differenzePerCasa, funzioniChiamate, righeAggiunte, titoliDellePr } from "../../scripts/casa-differenze.mjs";

// COSA PORTA UN AGGIORNAMENTO A CASA (01/11/2026): `npm run casa:aggiorna`
// lo dice prima di toccare niente. Il caso che l'ha fatto nascere: «Colloca»
// arrivato su Casa senza la funzione che gli serviva.

const base = { file: [], aggiunte: {}, migrazioniNuove: [], funzioniDiCasa: ["operazioni-atomiche"] };

describe("le funzioni chiamate dal codice", () => {
  it("chiamaFunzione, functions.invoke e l'indirizzo /functions/v1", () => {
    expect(
      funzioniChiamate([
        'const d = await chiamaFunzione("leggi-fattura", { id });',
        "supabase.functions.invoke('ascolta-voce', {})",
        "fetch(`${url}/functions/v1/posta-leggi`)",
      ]),
    ).toEqual(["ascolta-voce", "leggi-fattura", "posta-leggi"]);
  });

  it("🔴 col nome sulla riga dopo, come in src/lib/api", () => {
    expect(funzioniChiamate(["  const data = await chiamaFunzione(", '    "documento-leggi",', "    { id },"])).toEqual([
      "documento-leggi",
    ]);
  });
});

describe("le righe aggiunte di un diff", () => {
  it("per file, senza le intestazioni", () => {
    const diff = [
      "diff --git a/src/a.js b/src/a.js",
      "--- a/src/a.js",
      "+++ b/src/a.js",
      "@@ -1 +1,2 @@",
      "-vecchia",
      "+nuova",
      "+++ non e' un'intestazione se non comincia con b/",
    ].join("\n");
    expect(righeAggiunte(diff)).toEqual({ "src/a.js": ["nuova", "++ non e' un'intestazione se non comincia con b/"] });
  });
});

describe("cosa cambia per Casa", () => {
  it("niente di speciale: nessun avviso", () => {
    const d = differenzePerCasa({ ...base, file: ["src/pages/x.jsx"], aggiunte: { "src/pages/x.jsx": ["<p>ciao</p>"] } });
    expect(d).toEqual({ migrazioni: [], funzioniDaRiavviare: [], npmCi: false, avvisi: [] });
  });

  it("🔴 il caso di «Colloca»: una pagina usa una funzione spenta su Casa", () => {
    const d = differenzePerCasa({
      ...base,
      file: ["src/pages/cassa/Nuova.jsx"],
      aggiunte: { "src/pages/cassa/Nuova.jsx": ['await chiamaFunzione("leggi-fattura", {})'] },
    });
    expect(d.avvisi).toHaveLength(1);
    expect(d.avvisi[0]).toMatch(/src\/pages\/cassa\/Nuova\.jsx: usa la funzione «leggi-fattura», che su Casa è spenta/);
  });

  it("la funzione accesa su Casa non dà avviso", () => {
    const d = differenzePerCasa({
      ...base,
      file: ["src/lib/x.js"],
      aggiunte: { "src/lib/x.js": ['chiamaFunzione("operazioni-atomiche", {})'] },
    });
    expect(d.avvisi).toEqual([]);
  });

  it("solo il codice dell'app conta: una prova che nomina una funzione no", () => {
    const d = differenzePerCasa({
      ...base,
      file: ["tests/unita/x.test.js"],
      aggiunte: { "tests/unita/x.test.js": ['chiamaFunzione("leggi-fattura")'] },
    });
    expect(d.avvisi).toEqual([]);
  });

  it("🔴 una migrazione che programma un lavoro o chiama la rete: lo dice", () => {
    const d = differenzePerCasa({
      ...base,
      migrazioniNuove: [
        { nome: "20261102000001_lavoro.sql", testo: "select cron.schedule('x', '* * * * *', $$select 1$$);" },
        { nome: "20261102000002_rete.sql", testo: "perform net.http_post(url := u);" },
        { nome: "20261102000003_commento.sql", testo: "-- cron.schedule( qui e' solo un commento\nselect 1;" },
      ],
    });
    expect(d.migrazioni).toEqual(["20261102000001_lavoro.sql", "20261102000002_rete.sql", "20261102000003_commento.sql"]);
    expect(d.avvisi).toHaveLength(2);
    expect(d.avvisi[0]).toMatch(/^20261102000001_lavoro\.sql: programma un lavoro automatico/);
    expect(d.avvisi[1]).toMatch(/^20261102000002_rete\.sql: fa chiamate di rete/);
  });

  it("le funzioni di Casa cambiate vanno riavviate, anche se cambia solo _shared", () => {
    expect(differenzePerCasa({ ...base, file: ["supabase/functions/operazioni-atomiche/index.ts"] }).funzioniDaRiavviare)
      .toEqual(["operazioni-atomiche"]);
    expect(differenzePerCasa({ ...base, file: ["supabase/functions/_shared/uguali.ts"] }).funzioniDaRiavviare)
      .toEqual(["operazioni-atomiche"]);
    expect(differenzePerCasa({ ...base, file: ["supabase/functions/posta-leggi/index.ts"] }).funzioniDaRiavviare).toEqual([]);
  });

  it("le librerie cambiate chiedono npm ci", () => {
    expect(differenzePerCasa({ ...base, file: ["package-lock.json"] }).npmCi).toBe(true);
  });
});

describe("i titoli delle PR unite", () => {
  it("dal messaggio del merge di GitHub", () => {
    const log =
      "Merge pull request #306 from x/claude/casa-funzione-atomica\x1fCasa: accesa solo la funzione\n\x1e"
      + "Merge pull request #305 from x/claude/casa-senza-rete\x1f\x1e";
    expect(titoliDellePr(log)).toEqual([
      "#306 Casa: accesa solo la funzione",
      "#305 claude/casa-senza-rete",
    ]);
  });
});

describe("le difese aggiunte dalla revisione (01/11/2026)", () => {
  it("🔴 una funzione nuova nasce spenta su Casa, e lo dice", () => {
    const d = differenzePerCasa({
      ...base,
      file: ["supabase/functions/nuova-cosa/index.ts"],
      fileNuovi: ["supabase/functions/nuova-cosa/index.ts"],
    });
    expect(d.avvisi).toEqual(["supabase/functions/nuova-cosa: funzione nuova, su Casa resta spenta."]);
  });

  it("la configurazione cambiata va guardata a mano", () => {
    expect(differenzePerCasa({ ...base, file: ["supabase/config.toml"] }).avvisi[0]).toMatch(/config\.toml/);
  });

  it("🔴 anche gli altri nomi: net.http_request, cron.schedule_in_database, chiamaFunzioneConRiprova", () => {
    const d = differenzePerCasa({
      ...base,
      file: ["src/a.js"],
      aggiunte: { "src/a.js": ['chiamaFunzioneConRiprova("leggi-fattura")'] },
      migrazioniNuove: [
        { nome: "20261102000001_a.sql", testo: "select net.http_request('GET', u);" },
        { nome: "20261102000002_b.sql", testo: "select cron.schedule_in_database('x', '* * * * *', 'select 1', 'postgres');" },
      ],
    });
    expect(d.avvisi).toHaveLength(3);
  });
});
