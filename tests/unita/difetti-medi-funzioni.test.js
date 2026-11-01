import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { firmaCorretta, uguali } from "../../supabase/functions/_shared/uguali";

// =====================================================================
// TRE DIFETTI MEDI DELLE FUNZIONI E DELL'ANTEPRIMA
// =====================================================================
// M5  la firma delle notifiche si confronta a tempo costante
// M12 il salvataggio della frase / degli allegati non tace se fallisce
// M13 l'anteprima compila con gli indirizzi di accesso
//
// ⚠️ Le funzioni girano su Deno e non si possono eseguire qui: le prove sul
//    codice sono sul TESTO (come per le migrazioni), con i commenti tolti
//    perché un setaccio trova anche chi nomina la forma per spiegarla.

const leggi = (percorso) => readFileSync(percorso, "utf8").replace(/\r\n/g, "\n");
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("M5 · confronto della firma a tempo costante", () => {
  it("uguali(): vero solo per stringhe identiche", () => {
    expect(uguali("abc", "abc")).toBe(true);
    expect(uguali("abc", "abd")).toBe(false);
    expect(uguali("abc", "abcd")).toBe(false);
    expect(uguali("", "")).toBe(true);
  });

  it("firmaCorretta(): giusta passa; sbagliata, assente o senza segreto no", () => {
    expect(firmaCorretta("segreto", "segreto")).toBe(true);
    expect(firmaCorretta("sbagliata", "segreto")).toBe(false);
    expect(firmaCorretta(null, "segreto")).toBe(false);
    expect(firmaCorretta("", "segreto")).toBe(false);
    expect(firmaCorretta("segreto", undefined)).toBe(false);
    expect(firmaCorretta(null, undefined)).toBe(false);
  });

  it.each([
    "supabase/functions/email-cliente/index.ts",
    "supabase/functions/notify-telegram-reservation/index.ts",
    "supabase/functions/posta-leggi/index.ts",
  ])("%s non confronta la firma con !==, usa firmaCorretta", (file) => {
    const codice = senzaCommenti(leggi(file));
    expect(codice).not.toMatch(/!==\s*NOTIFICHE_FIRMA/);
    expect(codice).not.toMatch(/NOTIFICHE_FIRMA\s*!==/);
    expect(codice).toContain('from "../_shared/uguali.ts"');
    expect(codice).toMatch(/firmaCorretta\(\s*req\.headers\.get\("x-borgo58-firma"\)/);
  });

  it("posta-in-arrivo usa il confronto condiviso, senza una copia sua", () => {
    const codice = senzaCommenti(leggi("supabase/functions/posta-in-arrivo/index.ts"));
    expect(codice).toContain('from "../_shared/uguali.ts"');
    expect(codice).not.toMatch(/function uguali\(/);
  });
});

describe("M12 · errori che non tacciono", () => {
  const voce = senzaCommenti(leggi("supabase/functions/ascolta-voce/index.ts"));

  it("ascolta-voce non inoltra mai error.message grezzo a chi chiama", () => {
    // Nessuna risposta costruita col messaggio del database.
    expect(voce).not.toMatch(/return errore\([^)]*\.message\)/);
  });

  it("ascolta-voce risponde 500 con frase fissa se il salvataggio fallisce", () => {
    expect(voce).toMatch(/function scritturaFallita\(/);
    expect(voce).toMatch(/console\.error\(`registra_dettatura/);
    expect(voce).toMatch(/errore\(500, "scrittura", FRASE_SCRITTURA\)/);
  });

  it("ogni registra() di ascolta-voce ha il suo errore controllato", () => {
    const chiamate = voce.match(/await registra\(/g) ?? [];
    const controllate = voce.match(/const \{[^}]*error: \w+[^}]*\} = await registra\(/g) ?? [];
    expect(chiamate.length).toBeGreaterThanOrEqual(7);
    expect(controllate.length).toBe(chiamate.length);
  });

  it("posta-in-arrivo controlla la scrittura degli allegati e fa fallire la richiesta", () => {
    const posta = senzaCommenti(leggi("supabase/functions/posta-in-arrivo/index.ts"));
    // Nessuna scrittura in posta_allegati lasciata senza controllo.
    expect(posta).not.toMatch(/^\s*await db\("posta_allegati"/m);
    expect(posta).toMatch(/righeNonScritte\+\+/);
    expect(posta).toMatch(/if \(righeNonScritte > 0\)[\s\S]{0,200}, 500\)/);
  });

  it("posta-in-arrivo, alla riconsegna, riprende gli allegati mancanti", () => {
    const posta = senzaCommenti(leggi("supabase/functions/posta-in-arrivo/index.ts"));
    expect(posta).toMatch(/nomiAllegati\.every\(\(n\) => presenti\.has\(n\)\)/);
  });
});

describe("M13 · l'anteprima compila con gli indirizzi di accesso", () => {
  const yml = leggi(".github/workflows/anteprima.yml");

  it("il passo di compilazione riceve le due variabili", () => {
    const passo = yml.slice(yml.indexOf("- name: Compila"), yml.indexOf("run: npm run build"));
    expect(passo).toContain("VITE_EMAIL_TITOLARE: ${{ vars.EMAIL_TITOLARE }}");
    expect(passo).toContain("VITE_EMAIL_STAFF: ${{ vars.EMAIL_STAFF }}");
  });

  it("il controllo del pacchetto le riceve uguali", () => {
    const da = yml.indexOf("- name: Il pacchetto parla col progetto di prova?");
    const passo = yml.slice(da, yml.indexOf("--controlla-pacchetto", da));
    expect(passo).toContain("VITE_EMAIL_TITOLARE: ${{ vars.EMAIL_TITOLARE }}");
    expect(passo).toContain("VITE_EMAIL_STAFF: ${{ vars.EMAIL_STAFF }}");
  });
});

describe("M12 · ripresa degli allegati in posta-in-arrivo", () => {
  const posta = senzaCommenti(leggi("supabase/functions/posta-in-arrivo/index.ts"));

  it("il caricamento nel deposito ha x-upsert (la riconsegna non risponde 409)", () => {
    expect(posta).toMatch(/"x-upsert":\s*"true"/);
  });

  it("la ripresa non cancella righe: legge i nomi già scritti e salta quelli presenti", () => {
    expect(posta).not.toMatch(/method:\s*"DELETE"/);
    expect(posta).toMatch(/select=file_name/);
    expect(posta).toMatch(/if \(presenti\.has\(nome\)\) continue/);
  });

  it("una riga già scritta con errore conta come presente: il commento lo dice", () => {
    const grezzo = leggi("supabase/functions/posta-in-arrivo/index.ts");
    expect(grezzo).toMatch(/Una riga già scritta con `errore`\s*\n\s*\/\/\s*conta come presente e NON si ritenta/);
    // E il controllo guarda solo il nome, mai la colonna errore.
    expect(posta).not.toMatch(/presenti[^;]*errore/);
  });

  it("due allegati con lo stesso nome dopo la pulizia prendono l'indice", () => {
    expect(posta).toMatch(/nomiAllegati\.includes\(pulito\)/);
    expect(posta).toMatch(/_\$\{i\}/);
  });
});

describe("M12 · RIFIUTI_CHIAVE coincide con i messaggi della funzione SQL", () => {
  const ultima = (testo) =>
    readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => ({ f, t: readFileSync(`supabase/migrations/${f}`, "utf8").replace(/\r\n/g, "\n") }))
      .filter(({ t }) => t.includes(testo))
      .pop();

  // L'elenco, letto dal sorgente della funzione.
  const voce = leggi("supabase/functions/ascolta-voce/index.ts");
  const elenco = voce.match(/const RIFIUTI_CHIAVE = \[([\s\S]*?)\];/)[1];
  const prefissi = [...elenco.matchAll(/^\s*"([^"]+)",/gm)].map((m) => m[1]);

  it("ci sono dei prefissi da controllare", () => {
    expect(prefissi.length).toBeGreaterThanOrEqual(4);
  });

  it("ogni prefisso compare fra i messaggi di voce_apri_sessione (o del suo freno)", () => {
    const apri = ultima("create or replace function voce_apri_sessione");
    const freno = ultima("create or replace function voce_limite_dettature");
    expect(apri).toBeTruthy();
    expect(freno).toBeTruthy();
    // Dal corpo della funzione fino alla prossima `create or replace`.
    const da = apri.t.indexOf("create or replace function voce_apri_sessione");
    const resto = apri.t.slice(da + 10);
    const fine = resto.indexOf("create or replace function");
    const corpo = fine === -1 ? resto : resto.slice(0, fine);
    // In SQL l'apostrofo si raddoppia.
    const sql = (corpo + "\n" + freno.t).replace(/''/g, "'");
    for (const p of prefissi) expect(sql, `«${p}» non è nella funzione SQL`).toContain(p);
  });
});
