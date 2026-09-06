import { readFileSync } from "node:fs";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 🔴 L'AVVISO CHE ESISTE UNA VERSIONE NUOVA — 06/09/2026.
//
// ⚠️ NON E' UN FINTO DELLA SCHERMATA: da una parte del confronto c'e'
//    l'`index.html` VERO del pacchetto costruito, letto dal disco, e
//    dall'altra la testa della pagina che sta girando — riempita con quello
//    stesso file, che e' esattamente cio' che il browser avrebbe li' dentro
//    dopo aver aperto il gestionale. Il caso «pubblicata una versione
//    nuova» si produce cambiando i nomi dei file come li cambia Vite, non
//    inventando uno stato interno.
//
// ⚠️ LE DUE PROVE CHE CONTANO SONO QUELLE CHE NON DEVONO MOSTRARE NIENTE:
//    stessa versione, e rete che non risponde. Un avviso di aggiornamento
//    che compare quando non c'e' niente da aggiornare e' peggio di nessun
//    avviso — si impara a chiuderlo, e il giorno che serve nessuno lo legge.

// ⚠️ Percorso dalla radice del progetto e non da `import.meta.url`: qui
//    dentro l'ambiente finge di essere un browser, e li' `import.meta.url`
//    e' un indirizzo http, non un file da aprire.
const PACCHETTO = readFileSync("dist/index.html", "utf8");

// La stessa versione con i file rinominati: e' quello che fa una
// pubblicazione, perche' Vite mette l'impronta del contenuto nel nome.
const PUBBLICATA_DOPO = PACCHETTO.replace(/\/assets\/index-[A-Za-z0-9_-]+\./g, "/assets/index-NUOVA.");

const bozza = vi.hoisted(() => ({ fotografa: vi.fn() }));
vi.mock("../../src/lib/bozza", () => ({ fotografa: bozza.fotografa }));

let ricarica;

/** Apparecchia una pagina che sta gia' facendo girare il pacchetto vero. */
function pagina(rispostaDelSito, opzioni = {}) {
  document.head.innerHTML = PACCHETTO;
  global.fetch = vi.fn(async () => {
    if (rispostaDelSito === null) throw new Error("rete assente");
    // `url` e' da dove la risposta e' arrivata DAVVERO: il browser la
    // riempie con l'indirizzo finale, dopo eventuali dirottamenti.
    return {
      ok: opzioni.ok ?? true,
      url: opzioni.url ?? window.location.href,
      text: async () => rispostaDelSito,
    };
  });
}

beforeEach(() => {
  vi.resetModules(); // lo stato «trovato» vive nel modulo: si riparte puliti
  bozza.fotografa.mockClear();
  ricarica = vi.fn();
  // ⚠️ `window.location.reload` non si puo' ridefinire, quindi si
  //    sostituisce l'indirizzo intero: e' la sola strada che l'ambiente
  //    finto concede, e resta fedele a cio' che il codice chiama davvero.
  vi.stubGlobal("location", { ...window.location, reload: ricarica });
});

// ⚠️ TORNA LA DECISIONE, NON SOLO IL MODULO, e non e' una comodita':
//    le prove che devono NON far comparire niente, guardando solo lo schermo,
//    passerebbero anche se l'avviso comparisse un istante dopo. Rotta apposta
//    la regola del terzo stato, restavano tutte verdi. Si chiede a
//    `controllaAdesso` cosa ha deciso, e allo schermo cosa mostra: sono due
//    affermazioni diverse e servono tutt'e due.
async function montaEControlla() {
  const versione = await import("../../src/lib/versione.js");
  const { default: AvvisoAggiornamento } = await import("../../src/components/AvvisoAggiornamento.jsx");
  render(<AvvisoAggiornamento />);
  let deciso;
  await act(async () => {
    deciso = await versione.controllaAdesso();
  });
  return { versione, deciso };
}

describe("l'avviso di aggiornamento", () => {
  it("NON compare quando il sito serve la stessa versione che sta girando", async () => {
    pagina(PACCHETTO);
    const { deciso } = await montaEControlla();
    expect(deciso).toBe(false);
    expect(screen.queryByText(/Aggiornamento disponibile/i)).toBeNull();
  });

  it("NON compare quando la richiesta non arriva — non lo so non e' un aggiornamento", async () => {
    pagina(null);
    const { deciso } = await montaEControlla();
    expect(deciso).toBe(false);
    expect(screen.queryByText(/Aggiornamento disponibile/i)).toBeNull();
  });

  it("NON compare per un portale che risponde al posto nostro con propri file", async () => {
    // 🔴 IL CASO TROVATO DALLA REVISIONE DEL 06/09: risposta 200, pagina
    //    completa, e dentro dei file in `/assets/` suoi. Prima passava per
    //    una versione nuova, e l'avviso compariva per niente — restandoci,
    //    perche' una volta trovato non si torna indietro.
    pagina(
      `<html><head><link href="/assets/portale.css">` +
      `<script src="/assets/portale.js"></script></head>` +
      `<body>Accedi alla rete per continuare</body></html>`
    );
    const { deciso } = await montaEControlla();
    expect(deciso).toBe(false);
    expect(screen.queryByText(/Aggiornamento disponibile/i)).toBeNull();
  });

  it("NON compare per un portale che DIROTTA su un altro indirizzo", async () => {
    // ⚠️ L'altra meta' della difesa: qui la pagina che torna e' identica alla
    //    nostra ma nuova — quello che un portale ottiene rispondendo da casa
    //    sua. A scartarla e' da DOVE arriva, non cosa contiene.
    pagina(PUBBLICATA_DOPO, { url: "https://portale-wifi.example/accedi" });
    const { deciso } = await montaEControlla();
    expect(deciso).toBe(false);
    expect(screen.queryByText(/Aggiornamento disponibile/i)).toBeNull();
  });

  it("NON compare quando risponde qualcosa che non e' il gestionale (portale wifi)", async () => {
    pagina("<html><body>Accedi alla rete per continuare</body></html>");
    const { deciso } = await montaEControlla();
    expect(deciso).toBe(false);
    expect(screen.queryByText(/Aggiornamento disponibile/i)).toBeNull();
  });

  it("compare quando il sito serve una versione nuova", async () => {
    pagina(PUBBLICATA_DOPO);
    await montaEControlla();
    expect(await screen.findByText(/Aggiornamento disponibile/i)).toBeTruthy();
  });

  it("non ricarica MAI da solo: la pagina si ricarica solo se lo si tocca", async () => {
    // 🔴 E' la condizione del mandato, e qui e' una proprieta' del codice e
    //    non una promessa: trovato l'aggiornamento, nessuno ha ricaricato.
    pagina(PUBBLICATA_DOPO);
    await montaEControlla();
    await screen.findByText(/Aggiornamento disponibile/i);
    expect(ricarica).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Aggiorna adesso/i }));
    expect(ricarica).toHaveBeenCalledTimes(1);
  });

  it("toccando «Aggiorna adesso» si fotografa PRIMA quello che si stava scrivendo", async () => {
    // ⚠️ Cosi' «premere Aggiorna non porta via niente» e' una cosa che fa
    //    questo codice, invece di una fiducia in quello che il browser manda
    //    prima di lasciare la pagina. `fotografa` e' la stessa e unica
    //    funzione delle bozze: qui la si chiama, non la si riscrive.
    pagina(PUBBLICATA_DOPO);
    await montaEControlla();
    fireEvent.click(await screen.findByRole("button", { name: /Aggiorna adesso/i }));

    expect(bozza.fotografa).toHaveBeenCalledTimes(1);
    expect(bozza.fotografa.mock.invocationCallOrder[0])
      .toBeLessThan(ricarica.mock.invocationCallOrder[0]);
  });

  it("una volta trovato non si chiede piu' niente al sito", async () => {
    pagina(PUBBLICATA_DOPO);
    const { versione } = await montaEControlla();
    const quante = global.fetch.mock.calls.length;
    await versione.controllaAdesso();
    expect(global.fetch.mock.calls.length).toBe(quante);
  });
});
