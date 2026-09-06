import { describe, expect, it } from "vitest";
import {
  fraseFunzioniIndietro,
  funzioniDelRepository,
  funzioniIndietro,
} from "../../scripts/funzioni-indietro.mjs";

// 🔴 IL GUASTO CHE QUESTO CONTROLLO ESISTE PER PRENDERE, 06/09/2026: il sito
//    era online col pulsante «Approva» degli appunti vocali, e la funzione
//    online che lo esegue era rimasta a due versioni prima. Chi ha premuto ha
//    visto «Lo sto scrivendo…» e poi niente.
//
// ⚠️ Le date qui sono FINTE apposta: `ultimaModifica` chiede alla storia del
//    progetto, e una prova che dipendesse dai commit veri direbbe cose diverse
//    domani. Si passa una funzione al posto suo — è anche il motivo per cui
//    quel pezzo è un parametro e non una chiamata dentro.

const ORA = new Date("2026-09-06T20:00:00Z");
const IERI = new Date("2026-09-05T20:00:00Z");

// Supabase restituisce `updated_at` in millisecondi.
const installata = (slug, quando) => ({ slug, updated_at: String(quando.getTime()) });

const finteCartelle = () => ["ascolta-voce", "operazioni-atomiche"];
const modificate = { "ascolta-voce": ORA, "operazioni-atomiche": ORA };
const quando = (nome) => modificate[nome] ?? null;


describe("le funzioni online al passo col sito", () => {
  it("🔴 una installata PRIMA dell'ultima modifica è indietro", () => {
    const indietro = funzioniIndietro(
      [installata("ascolta-voce", IERI), installata("operazioni-atomiche", ORA)],
      quando,
    ).filter((f) => finteCartelle().includes(f.nome));

    expect(indietro.map((f) => f.nome)).toContain("ascolta-voce");
    expect(indietro.map((f) => f.nome)).not.toContain("operazioni-atomiche");
  });

  it("🔴 una MAI installata è indietro, e lo dice diversamente", () => {
    const indietro = funzioniIndietro([installata("ascolta-voce", ORA)], quando)
      .filter((f) => finteCartelle().includes(f.nome));
    const corridoio = indietro.find((f) => f.nome === "operazioni-atomiche");
    expect(corridoio).toBeTruthy();
    expect(corridoio.perche).toMatch(/mai stata installata/);
  });

  it("quando sono tutte al passo non ferma niente", () => {
    // ⚠️ La metà che discrimina: un controllo che segnalasse sempre
    //    bloccherebbe ogni pubblicazione, e passerebbe le prove qui sopra.
    const indietro = funzioniIndietro(
      [installata("ascolta-voce", ORA), installata("operazioni-atomiche", ORA)],
      quando,
    ).filter((f) => finteCartelle().includes(f.nome));
    expect(indietro).toEqual([]);
  });

  it("una funzione mai committata non si confronta con niente", () => {
    // Senza una data nella storia non c'è un «prima» e un «dopo»: dire
    // «indietro» sarebbe inventare.
    const indietro = funzioniIndietro([], () => null);
    expect(indietro).toEqual([]);
  });
});

describe("la frase che ferma la pubblicazione", () => {
  it("nomina le funzioni e dice il comando per installarle", () => {
    const frase = fraseFunzioniIndietro([{ nome: "operazioni-atomiche", perche: "e' indietro" }]);
    expect(frase).toMatch(/FERMO/);
    expect(frase).toMatch(/operazioni-atomiche/);
    // ⚠️ Un rifiuto senza gesto d'uscita è un vicolo cieco.
    expect(frase).toMatch(/npm run funzione operazioni-atomiche -- --conferma/);
  });

  it("quando non c'è niente da dire, non dice niente", () => {
    expect(fraseFunzioniIndietro([])).toBeNull();
    expect(fraseFunzioniIndietro(null)).toBeNull();
  });
});

describe("le funzioni del repository si leggono davvero", () => {
  it("ci sono, e ci sono quelle due", () => {
    // ⚠️ Senza questa riga un elenco vuoto farebbe passare tutto: è la
    //    trappola del caso vuoto, già costata quattro volte a questo progetto.
    const elenco = funzioniDelRepository();
    expect(elenco.length).toBeGreaterThan(5);
    expect(elenco).toContain("ascolta-voce");
    expect(elenco).toContain("operazioni-atomiche");
  });
});
