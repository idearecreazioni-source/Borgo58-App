import { existsSync, readFileSync, rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { build } from "vite";
import { impronta, confronta, ceUnAggiornamento } from "../../src/lib/calcoli/versione.js";

// 🔴 CHE L'APP SI ACCORGA DI UNA VERSIONE PUBBLICATA — 06/09/2026.
//
// ⚠️ LA META' LENTA DI QUESTO FILE COSTRUISCE DAVVERO, e non e' pignoleria:
// l'impronta di questo disegno **e' l'elenco dei file che Vite rifa' a ogni
// costruzione**. Provarla su una stringa scritta a mano direbbe solo che so
// scrivere una stringa; quello che c'e' da dimostrare e' che quei nomi
// cambiano quando cambia il codice e **non cambiano quando non cambia
// niente** — e quelle due cose le sa solo una costruzione vera.
//
// 🔴 LA (a) E' QUELLA CHE PROTEGGE DAL FALSO ALLARME, ed e' stata scritta
// due volte perche' la prima misura mi aveva mentito: due costruzioni
// identiche davano impronte **diverse**, e sembrava non-determinismo di
// Vite. Non lo era. Tailwind legge i file del progetto per decidere quali
// stili servono, e **rispetta `.gitignore`**: la cartella della prima
// costruzione, se ha un nome che nessuno ignora, viene letta dalla seconda —
// che ci trova dentro il pacchetto di prima e ne raccoglie i nomi delle
// classi. Ecco perche' `dist/` non ha mai dato questo problema (e' ignorato
// dalla riga 11) e perche' qui le cartelle si chiamano `dist-prova-…`, che
// e' la forma gia' ignorata dalla riga 105.
//
// ⚠️ QUINDI IL NOME DI QUESTE CARTELLE NON E' UN DETTAGLIO: chiamarle in un
// altro modo non rompe niente in modo visibile — fa **fallire la (a)**, cioe'
// fa sembrare instabile una cosa che e' stabile. *Il difetto non stava in
// nessuno dei due pacchetti: stava in cosa c'era intorno mentre nascevano.*

const CARTELLE = ["dist-prova-versione-a", "dist-prova-versione-b", "dist-prova-versione-c"];

afterAll(() => {
  for (const c of CARTELLE) rmSync(c, { recursive: true, force: true });
});

async function costruisciIn(cartella, variabili = {}) {
  const prima = new Map();
  for (const [nome, valore] of Object.entries(variabili)) {
    prima.set(nome, process.env[nome]);
    process.env[nome] = valore;
  }
  // ⚠️ Prima si toglie: vedi il cappello. Una cartella rimasta in giro
  //    cambia il risultato della costruzione successiva.
  rmSync(cartella, { recursive: true, force: true });
  try {
    await build({ build: { outDir: cartella }, logLevel: "silent" });
  } finally {
    for (const [nome, valore] of prima) {
      if (valore === undefined) delete process.env[nome];
      else process.env[nome] = valore;
    }
  }
  return impronta(readFileSync(`${cartella}/index.html`, "utf8"));
}

describe("l'impronta di una versione", () => {
  it("si legge dal pacchetto vero, e nomina i file con l'impronta nel nome", () => {
    // ⚠️ Non un HTML inventato: il `dist/` che c'e'. Se manca, questa prova
    //    lo dice invece di passare in silenzio su niente.
    expect(existsSync("dist/index.html"), "manca dist/index.html: lancia prima `npm run build`").toBe(true);
    const i = impronta(readFileSync("dist/index.html", "utf8"));
    expect(i).toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    expect(i).toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.css/);
  });

  it("non cambia se cambia l'ordine dei tag, ne' se un file e' nominato due volte", () => {
    const uno = `<script src="/assets/a.js"></script><link href="/assets/b.css">`;
    const altro = `<link href="/assets/b.css"><script src="/assets/a.js"></script><script src="/assets/a.js"></script>`;
    expect(impronta(uno)).toBe(impronta(altro));
  });

  it("mentre si sviluppa non c'e' nessuna impronta, e va bene cosi'", () => {
    // In sviluppo la pagina nomina `/src/main.jsx`, non un file con
    // l'impronta: non si sa che versione sia, quindi non si dice niente.
    expect(impronta(`<script type="module" src="/src/main.jsx"></script>`)).toBeNull();
  });
});

describe("una pagina che NON e' il gestionale non si scambia per una versione", () => {
  // 🔴 IL CASO CHE LA REVISIONE DEL 06/09 HA TROVATO, e che la prima stesura
  //    di questo file NON copriva: la prova usava un portale **senza** file
  //    in `/assets/`, cioe' l'unica versione del problema che passa da sola.
  it("un portale di rete che nomina un proprio file non e' una versione nuova", () => {
    const portale = `<html><head><link href="/assets/portale.css">` +
      `<script src="/assets/portale.js"></script></head><body>Accedi</body></html>`;
    expect(impronta(portale)).toBeNull();
  });

  it("la parola /assets/ scritta nel testo non conta: si guardano i tag", () => {
    expect(impronta("<html><body>vedi /assets/index-abc.js</body></html>")).toBeNull();
  });

  it("senza il pezzo principale non e' il gestionale, anche col foglio di stile giusto", () => {
    // ⚠️ E' la condizione che discrimina: un foglio di stile da solo non
    //    basta, perche' qualunque pagina puo' averne uno.
    expect(impronta(`<link rel="stylesheet" href="/assets/index-abc.css">`)).toBeNull();
  });

  it("...e col pezzo principale l'impronta c'e'", () => {
    const nostra = `<link rel="stylesheet" href="/assets/index-abc.css">` +
      `<script type="module" crossorigin src="/assets/index-xyz.js"></script>`;
    expect(impronta(nostra)).toBe("/assets/index-abc.css /assets/index-xyz.js");
  });
});

describe("le risposte sono tre, e la terza e' quella che protegge", () => {
  it("uguale, diversa, e «non lo so»", () => {
    expect(confronta("x", "x")).toBe("uguale");
    expect(confronta("x", "y")).toBe("diversa");
    expect(confronta("x", null)).toBe("non lo so");
    expect(confronta(null, "y")).toBe("non lo so");
  });

  it("«non lo so» NON e' un aggiornamento — altrimenti la rete che cade ne annuncerebbe uno", () => {
    // 🔴 E' il caso vero del portale wifi e della richiesta caduta: la
    //    risposta non si e' letta. Un avviso qui comparirebbe ogni volta che
    //    la rete fa i capricci, e si imparerebbe a ignorarlo.
    expect(ceUnAggiornamento("x", null)).toBe(false);
    expect(ceUnAggiornamento(null, null)).toBe(false);
    expect(ceUnAggiornamento("x", "y")).toBe(true);
  });
});

describe("costruendo davvero", () => {
  it("(a) una ricostruzione che non cambia NIENTE non annuncia nessun aggiornamento", async () => {
    const prima = await costruisciIn("dist-prova-versione-a");
    const dopo = await costruisciIn("dist-prova-versione-b");
    expect(prima).not.toBeNull();
    expect(ceUnAggiornamento(prima, dopo)).toBe(false);
  }, 180_000);

  it("(b) una costruzione con codice diverso lo annuncia", async () => {
    // ⚠️ SENZA LA (b) LA (a) NON PROVEREBBE NIENTE: un'impronta sempre
    //    uguale a se stessa — per esempio una costante scritta a mano —
    //    passerebbe la (a) tutte le volte.
    const normale = await costruisciIn("dist-prova-versione-a");
    const cambiata = await costruisciIn("dist-prova-versione-c", {
      VITE_EMAIL_TITOLARE: "capo@prova.it",
    });
    expect(ceUnAggiornamento(normale, cambiata)).toBe(true);
  }, 180_000);
});
