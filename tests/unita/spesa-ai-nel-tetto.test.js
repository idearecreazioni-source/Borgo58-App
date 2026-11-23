import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DEL 23/11/2026, punto 7: la spesa dell'AI non deve sfuggire al tetto.
//
// ⚠️ Le tre funzioni girano su Deno e non si eseguono da qui: si legge il codice e si controllano le cose che non devono
//    cambiare per sbaglio. Che una riga «strumento» con un costo entri nei consumi e non nel limite orario lo prova
//    una verifica su Prova (vedi il riepilogo di consegna).

const leggi = (percorso) => readFileSync(new URL(`../../supabase/functions/${percorso}`, import.meta.url), "utf8");
const memo = leggi("memo-chat/index.ts");
const archivio = leggi("assistente-archivio/index.ts");
const documento = leggi("documento-leggi/index.ts");

describe("memo-chat: la spesa si scrive a ogni giro del modello", () => {
  it("il salvataggio si ritenta prima di arrendersi", () => {
    expect(memo).toMatch(/async function conTentativi\(prova: \(\) => Promise<boolean>, tentativi = 3\)/);
  });

  it("dopo ogni chiamata al modello scrive una riga «strumento» col costo di quel giro", () => {
    const dopoLaChiamata = memo.slice(memo.indexOf("anthropic.messages.create"));
    const iGiro = dopoLaChiamata.indexOf('ruolo: "strumento"');
    expect(iGiro).toBeGreaterThan(0);
    // ...e la scrive PRIMA di fermarsi per il tetto del singolo messaggio e prima di eseguire gli strumenti.
    expect(iGiro).toBeLessThan(dopoLaChiamata.indexOf("COSTO_MASSIMO) { stato"));
    expect(iGiro).toBeLessThan(dopoLaChiamata.indexOf("const richieste = blocchi.filter"));
    expect(dopoLaChiamata).toMatch(/costo_euro: costoDelGiro, stato: "fatto"/);
  });

  it("se la spesa di un giro non si riesce a registrare, si ferma: non si spende senza contare", () => {
    expect(memo).toMatch(/if \(!giroScritto\) \{ stato = "errore"; rispostaFinale = "Mi fermo: non riesco a registrare la spesa[^"]*"; break; \}/);
  });

  it("la riga finale porta i token totali ma SOLO il resto del costo: il conto non raddoppia", () => {
    expect(memo).toMatch(/const costoResto = Math\.max\(0, Math\.round\(\(\(costo \?\? 0\) - costoScritto\) \* 100000\) \/ 100000\);/);
    expect(memo).toMatch(/costo_euro: costoResto/);
    expect(memo).toMatch(/token_ingresso: tokenIngresso, token_uscita: tokenUscita/);
  });

  it("la riga del giro non porta token (si contano una volta sola, sulla riga finale)", () => {
    const inizio = memo.indexOf('ruolo: "strumento"');
    const riga = memo.slice(inizio, memo.indexOf("});", inizio));
    expect(riga).not.toContain("token_");
  });

  it("anche il salvataggio della risposta finale si ritenta e si controlla", () => {
    expect(memo).toMatch(/const finaleScritta = await conTentativi\(/);
    expect(memo).toContain("if (!finaleScritta)");
    // E il cliente lo sa: la risposta dice se il registro è stato scritto.
    expect(memo).toContain("registro_scritto: finaleScritta");
  });
});

describe("assistente-archivio: il registro si ritenta e dice la verità", () => {
  it("scrive domande_archivio con i tentativi", () => {
    expect(archivio).toMatch(/async function conTentativi/);
    expect(archivio).toMatch(/const registroScritto = await conTentativi\(/);
  });

  it("`registro_scritto` riflette l'esito dopo i tentativi, non il primo errore", () => {
    expect(archivio).toContain("registro_scritto: registroScritto");
  });

  it("la risposta già pagata arriva comunque, e il fallimento si scrive nel log", () => {
    expect(archivio).toContain("if (!registroScritto) console.error");
    // La risposta si restituisce dopo il registro, senza `throw` sul suo fallimento.
    const dopo = archivio.slice(archivio.indexOf("const registroScritto"));
    expect(dopo.slice(0, dopo.indexOf("return new Response"))).not.toContain("throw");
  });
});

describe("documento-leggi: ogni chiamata al modello si registra con tentativi", () => {
  const inizio = documento.indexOf("registra: async (gesto, modello, token)");
  const corpo = documento.slice(inizio, documento.indexOf("  };", inizio));

  it("ritenta fino a 3 volte, anche se la scrittura lancia", () => {
    expect(inizio).toBeGreaterThan(0);
    expect(corpo).toMatch(/for \(let n = 0; n < 3 && !scritto; n \+= 1\)/);
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch (e)");
  });

  it("se non riesce lo dice nel log e la lettura arriva lo stesso", () => {
    expect(corpo).toContain("if (!scritto) console.error");
    expect(corpo).not.toMatch(/\bthrow\b/);
  });
});
