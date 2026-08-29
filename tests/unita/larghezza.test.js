import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOTE_LARGHE, PER_LA_CARTA, tabelleSenzaRiparo } from "../../src/lib/calcoli/larghezza";

// LA RETE DELLA LARGHEZZA, PROVATA AL CONTRARIO.
//
// ⚠️ Una rete che non si e' mai vista scattare e' una rete di cui non si sa
// se scatta. Il primo blocco produce le due divergenze a mano e pretende che
// vengano nominate; il secondo guarda i file veri.

function tuttiIFile(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((v) => {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) return tuttiIFile(p);
    return v.name.endsWith(".jsx") ? [p.split(path.sep).join("/")] : [];
  });
}

describe("la rete riconosce una tabella senza riparo", () => {
  it("una tabella nuda viene nominata", () => {
    const codice = `<div className="rounded-xl">\n  <table className="w-full">\n</div>`;
    expect(tabelleSenzaRiparo(codice)).toHaveLength(1);
  });

  // ⚠️ PRIMA ROTTURA: il riquadro nasconde sul telefono -> deve tacere.
  it("una tabella dentro un riquadro nascosto sul telefono NON viene nominata", () => {
    const codice = `<div className="hidden md:block overflow-x-auto">\n  <table className="w-full">\n</div>`;
    expect(tabelleSenzaRiparo(codice)).toHaveLength(0);
  });

  // ⚠️ SECONDA ROTTURA, su un controllo DIVERSO: il riparo e' sulla tabella
  // stessa (`hidden md:table`), che e' l'altra forma in uso nel progetto.
  it("il riparo scritto sulla tabella stessa vale quanto quello sul riquadro", () => {
    const codice = `<table className="hidden md:table w-full">`;
    expect(tabelleSenzaRiparo(codice)).toHaveLength(0);
  });

  // ⚠️ TERZA: il riparo lontano non conta. Un file puo' avere due tabelle,
  // una curata e una no: guardare tutto il file assolverebbe la seconda.
  it("un riparo venti righe piu' su non copre una tabella nuda", () => {
    const codice =
      `<div className="hidden md:block">ok</div>\n` + "\n".repeat(20) + `<table className="w-full">`;
    expect(tabelleSenzaRiparo(codice)).toHaveLength(1);
  });
});

describe("nessuna tabella larga NUOVA nelle schermate", () => {
  it("le tabelle senza riparo sono solo quelle gia' dichiarate", () => {
    const inattese = [];
    // 🔴 ANCHE I COMPONENTI, dal 29/08 (sera). Fino a stanotte la rete
    // guardava solo `src/pages`, e la ragione c'era: le tabelle stavano
    // tutte nelle schermate. Ma dal 29/08 una tabella vive dentro un
    // COMPONENTE — quella di `ElencoAdattivo` — e un componente e' il
    // posto peggiore dove lasciarne scappare una: non compare in nessuna
    // schermata e finisce in TUTTE.
    // ⚠️ E' la stessa forma del difetto del 22/08 — *un difetto che sta
    // dappertutto non compare in un censimento fatto per posti*: li' era il
    // pulsante del menu, che stava fuori da tutte e 67 le schermate
    // misurate perche' non era in nessuna ed era in tutte.
    for (const file of [...tuttiIFile("src/pages"), ...tuttiIFile("src/components")]) {
      if (PER_LA_CARTA.includes(file)) continue;
      const righe = tabelleSenzaRiparo(fs.readFileSync(file, "utf8"));
      if (righe.length && !NOTE_LARGHE[file]) inattese.push(`${file}:${righe.join(",")}`);
    }
    // Se questa fallisce: o si usa <ElencoAdattivo>, o si mette la tabella
    // dentro `hidden md:block`. Aggiungere una riga a NOTE_LARGHE e' l'ultima
    // strada, e vuole una ragione scritta accanto.
    expect(inattese).toEqual([]);
  });

  it("l'elenco dei debiti non contiene schermate gia' curate", () => {
    const risolte = Object.keys(NOTE_LARGHE).filter(
      (f) => fs.existsSync(f) && tabelleSenzaRiparo(fs.readFileSync(f, "utf8")).length === 0
    );
    // Un debito che non esiste piu' va tolto dall'elenco, o l'elenco smette
    // di dire quanto manca.
    expect(risolte).toEqual([]);
  });
});
