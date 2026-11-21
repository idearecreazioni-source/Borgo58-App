import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA SCHEDA DI BORGO 58, LA PAGINA — 21/11/2026 (pezzo S3)
// =====================================================================
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento e' finto. Queste prove
//    dicono cosa la pagina MOSTRA e cosa CONSEGNA al collegamento: l'elenco
//    per sezione, i limiti, il rifiuto del database in parole semplici,
//    l'avviso sulle parole delicate (che non blocca), lo spegnimento al
//    posto della cancellazione. Che il database rifiuti davvero lo prova
//    `tests/unita/scheda-borgo58.test.js` e la migrazione.

const finto = vi.hoisted(() => ({
  voci: [],
  contatori: { voci: 2, caratteri: 120 },
  delicate: [],
  rifiuto: null,
  letturaFallita: false,
  storico: [],
}));
const spie = vi.hoisted(() => ({ salvate: [], accese: [] }));

vi.mock("../../src/lib/api/scheda", () => ({
  leggiVoci: vi.fn(async () => {
    if (finto.letturaFallita) throw new Error("non risponde");
    return finto.voci;
  }),
  leggiContatori: vi.fn(async () => finto.contatori),
  leggiStorico: vi.fn(async () => finto.storico),
  paroleDelicate: vi.fn(async () => finto.delicate),
  salvaVoce: vi.fn(async (v) => {
    spie.salvate.push(v);
    if (finto.rifiuto) throw new Error(finto.rifiuto);
    return { ...v, id: v.id ?? "nuova", numero: v.numero ?? 99, attiva: true, ordine: v.ordine ?? 0 };
  }),
  accendiVoce: vi.fn(async (id, attiva) => {
    spie.accese.push({ id, attiva });
    if (finto.rifiuto) throw new Error(finto.rifiuto);
    return { ...finto.voci.find((x) => x.id === id), attiva };
  }),
}));

const V1 = { id: "a", numero: 1, sezione: "fornitori", chiave: "fornitori:ortofrutta-0000", testo: "ZZ Ortofrutta consegna il martedì.", fonte: "confermato", valida_dal: null, verificata_il: null, rivedere_entro: "2020-01-01", attiva: true, ordine: 10 };
const V2 = { id: "b", numero: 2, sezione: "locale", chiave: "locale:orari-0000", testo: "Chiuso il lunedì.", fonte: "riferito", valida_dal: "2026-11-03", verificata_il: null, rivedere_entro: null, attiva: true, ordine: 10 };
const V3 = { id: "c", numero: 3, sezione: "decisioni", chiave: "decisioni:vecchia-0000", testo: "Voce spenta di prova.", fonte: "da_verificare", valida_dal: null, verificata_il: null, rivedere_entro: null, attiva: false, ordine: 10 };

beforeEach(() => {
  finto.voci = [V1, V2, V3];
  finto.contatori = { voci: 2, caratteri: 120 };
  finto.delicate = [];
  finto.rifiuto = null;
  finto.letturaFallita = false;
  finto.storico = [];
  spie.salvate = [];
  spie.accese = [];
});

async function apri() {
  const { default: Scheda } = await import("../../src/pages/memo/SchedaDiBorgo58.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/memo/scheda"]}>
      <Scheda />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: /La Scheda di Borgo 58/ })).toBeTruthy());
  return vista;
}

describe("La Scheda · cosa si vede", () => {
  it("elenca le voci attive per sezione, ognuna col suo numero", async () => {
    await apri();
    expect(await screen.findByRole("heading", { name: "I fornitori" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Il locale" })).toBeTruthy();
    expect(screen.getByText("[S1]")).toBeTruthy();
    expect(screen.getByText("[S2]")).toBeTruthy();
    expect(screen.getByText(/ZZ Ortofrutta consegna/)).toBeTruthy();
    // Le sezioni senza voci non fanno rumore, e la voce spenta non sta nell'elenco.
    expect(screen.queryByRole("heading", { name: "Le decisioni già prese" })).toBeNull();
    expect(screen.queryByText(/Voce spenta di prova/)).toBeNull();
  });

  it("mostra i limiti letti dal database", async () => {
    await apri();
    const riquadro = await screen.findByLabelText("Quanto spazio resta nella Scheda");
    expect(riquadro.textContent).toMatch(/2.*voci attive su 60/);
    expect(riquadro.textContent).toMatch(/120.*caratteri su 10\.000/);
  });

  it("avvisa quando la Scheda è quasi piena", async () => {
    finto.contatori = { voci: 58, caratteri: 9500 };
    await apri();
    expect(await screen.findByText(/quasi piena/)).toBeTruthy();
  });

  it("segnala la voce con la data di revisione passata", async () => {
    await apri();
    expect(await screen.findByText(/Da rivedere: la data è passata/)).toBeTruthy();
  });

  it("una lettura fallita lo dice, non mostra una Scheda vuota", async () => {
    finto.letturaFallita = true;
    await apri();
    expect(await screen.findByText(/Non riesco a leggere la Scheda/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeTruthy();
    expect(screen.queryByText(/La Scheda è vuota/)).toBeNull();
  });
});

describe("La Scheda · quando è vuota", () => {
  it("lo dice e spiega che MEMO risponde come sempre", async () => {
    finto.voci = [];
    finto.contatori = { voci: 0, caratteri: 0 };
    await apri();
    expect(await screen.findByText(/La Scheda è vuota: MEMO risponde come sempre/)).toBeTruthy();
  });
});

describe("La Scheda · scrivere una voce", () => {
  it("consegna al collegamento la voce con la chiave scelta dalla pagina, e la mostra", async () => {
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi una voce" }));
    fireEvent.change(screen.getByLabelText("Cosa vuoi far sapere a MEMO"), { target: { value: "Il pane arriva alle 8." } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(spie.salvate).toHaveLength(1));
    expect(spie.salvate[0]).toMatchObject({ sezione: "fornitori", testo: "Il pane arriva alle 8.", fonte: "da_verificare" });
    expect(spie.salvate[0].chiave).toMatch(/^fornitori:il-pane-arriva-alle-8-[0-9a-z]{4}$/);
    expect(await screen.findByText("Il pane arriva alle 8.")).toBeTruthy();
  });

  it("il contatore dice quanti caratteri restano e blocca il Salva oltre 300", async () => {
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi una voce" }));
    const campo = screen.getByLabelText("Cosa vuoi far sapere a MEMO");
    fireEvent.change(campo, { target: { value: "abc" } });
    expect(screen.getByText("3 di 300 caratteri.")).toBeTruthy();
    fireEvent.change(campo, { target: { value: "x".repeat(305) } });
    expect(screen.getByText(/5 caratteri di troppo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salva" }).disabled).toBe(true);
  });

  it("le parole delicate avvisano ma il Salva resta possibile", async () => {
    finto.delicate = ["debito"];
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi una voce" }));
    const campo = screen.getByLabelText("Cosa vuoi far sapere a MEMO");
    fireEvent.change(campo, { target: { value: "C'è un debito col fornitore." } });
    fireEvent.blur(campo);
    expect(await screen.findByText(/parole delicate \(debito\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salva" }).disabled).toBe(false);
  });

  it("il rifiuto del database si legge sotto il pulsante, in italiano semplice, e la voce non entra", async () => {
    finto.rifiuto = "La Scheda ha già 60 voci attive: spegni una voce prima di aggiungerne o riattivarne un'altra.";
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi una voce" }));
    fireEvent.change(screen.getByLabelText("Cosa vuoi far sapere a MEMO"), { target: { value: "Una voce di troppo." } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/già 60 voci attive/);
    expect(screen.queryByText("Una voce di troppo.", { selector: "p.whitespace-pre-wrap" })).toBeNull();
  });

  it("un errore tecnico non mostra il gergo", async () => {
    finto.rifiuto = "ERROR: 42P01 relation does not exist";
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi una voce" }));
    fireEvent.change(screen.getByLabelText("Cosa vuoi far sapere a MEMO"), { target: { value: "Prova." } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Non è stato salvato. Riprova tra un momento.");
  });

  it("mentre si scrive una voce, le altre non si aprono (non si butta via quello che si scrive)", async () => {
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: "Aggiungi una voce" }));
    for (const b of screen.getAllByRole("button", { name: "Modifica" })) expect(b.disabled).toBe(true);
    for (const b of screen.getAllByRole("button", { name: "Spegni" })) expect(b.disabled).toBe(true);
  });
});

describe("La Scheda · spegnere, riaccendere, mai cancellare", () => {
  it("non c'è nessun pulsante per cancellare", async () => {
    await apri();
    await screen.findByText("[S1]");
    expect(screen.queryByRole("button", { name: /cancella|elimina|togli/i })).toBeNull();
  });

  it("Spegni consegna attiva=false", async () => {
    await apri();
    const voce = (await screen.findByText("[S2]")).closest("li");
    fireEvent.click(within(voce).getByRole("button", { name: "Spegni" }));
    await waitFor(() => expect(spie.accese).toEqual([{ id: "b", attiva: false }]));
  });

  it("le voci spente si aprono a richiesta e si riaccendono", async () => {
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: /Voci spente \(1\)/ }));
    const voce = (await screen.findByText(/Voce spenta di prova/)).closest("li");
    fireEvent.click(within(voce).getByRole("button", { name: "Riaccendi" }));
    await waitFor(() => expect(spie.accese).toEqual([{ id: "c", attiva: true }]));
  });

  it("riaccendere una voce con la Scheda piena mostra il rifiuto del database", async () => {
    finto.rifiuto = "La Scheda ha già 60 voci attive: spegni una voce prima di aggiungerne o riattivarne un'altra.";
    await apri();
    fireEvent.click(await screen.findByRole("button", { name: /Voci spente/ }));
    const voce = (await screen.findByText(/Voce spenta di prova/)).closest("li");
    fireEvent.click(within(voce).getByRole("button", { name: "Riaccendi" }));
    expect((await within(voce).findByRole("alert")).textContent).toMatch(/già 60 voci attive/);
  });
});

describe("La Scheda · lo storico di una voce", () => {
  it("racconta cosa è cambiato, con il testo di prima", async () => {
    finto.storico = [
      { id: "s2", testo_prima: "Vecchio testo.", testo_dopo: "ZZ Ortofrutta consegna il martedì.", fonte_prima: "riferito", fonte_dopo: "confermato", attiva_prima: true, attiva_dopo: true, sezione_prima: "fornitori", sezione_dopo: "fornitori", quando: "2026-11-10T10:00:00Z" },
      { id: "s1", testo_prima: null, testo_dopo: "Vecchio testo.", fonte_prima: null, fonte_dopo: "riferito", attiva_prima: null, attiva_dopo: true, sezione_prima: null, sezione_dopo: "fornitori", quando: "2026-11-01T10:00:00Z" },
    ];
    await apri();
    const voce = (await screen.findByText("[S1]")).closest("li");
    fireEvent.click(within(voce).getByRole("button", { name: "Storico" }));
    const lista = await within(voce).findByLabelText("Storico della voce");
    expect(lista.textContent).toMatch(/Testo cambiato/);
    expect(lista.textContent).toMatch(/Prima diceva: «Vecchio testo\.»/);
    expect(lista.textContent).toMatch(/Voce creata/);
  });
});
