import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LE PROPOSTE DI MEMO NELLA SCHEDA — 21/11/2026 (pezzo B1)
// =====================================================================
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento e' finto. Queste prove
//    dicono cosa la pagina MOSTRA e cosa CONSEGNA al collegamento: Sì, Non
//    farlo e Correggi, la casella sulla fonte che scende, il rifiuto del
//    database mostrato com'e', la lettura fallita detta. Che il database
//    applichi davvero le regole lo prova la verifica della migrazione.

const finto = vi.hoisted(() => ({
  voci: [],
  proposte: [],
  generazione: { nuove: 0, scadute: 0, saltate_privacy: 0, in_attesa: 0 },
  generazioneFallita: false,
  letturaFallita: false,
  rifiuto: null,
  risposta: { esito: "accettata", voce_id: "nuova", numero: 50 },
  delicate: [],
}));
const spie = vi.hoisted(() => ({ decise: [], voci: 0 }));

vi.mock("../../src/lib/api/scheda", () => ({
  leggiVoci: vi.fn(async () => {
    spie.voci += 1;
    return finto.voci;
  }),
  leggiContatori: vi.fn(async () => ({ voci: 1, caratteri: 100 })),
  leggiStorico: vi.fn(async () => []),
  paroleDelicate: vi.fn(async () => finto.delicate),
  salvaVoce: vi.fn(),
  accendiVoce: vi.fn(),
  generaProposte: vi.fn(async () => (finto.generazioneFallita ? null : finto.generazione)),
  leggiProposte: vi.fn(async () => {
    if (finto.letturaFallita) throw new Error("non risponde");
    return finto.proposte;
  }),
  decidiProposta: vi.fn(async (id, esito, testo, confermaFonte) => {
    spie.decise.push({ id, esito, testo, confermaFonte });
    if (finto.rifiuto) throw new Error(finto.rifiuto);
    return finto.risposta;
  }),
}));

const P_NUOVA = {
  id: "p1", tipo: "aggiungi", origine: "fornitore", chiave: "fornitori:forn-00000001", voce_id: null, sezione: "fornitori",
  testo_prima: null, testo_dopo: "ZZ Ortofrutta Bianchi (ortofrutta). Consegne: lunedì e giovedì.", fonte_prima: null, fonte_dopo: "riferito",
  abbassa_fonte: false, motivo: "Nuovo fornitore in anagrafica dal 21/11/2026.", stato: "in_attesa", creata_il: "2026-11-21T09:00:00Z", scade_il: "2026-12-21",
};
const P_SCENDE = {
  id: "p2", tipo: "modifica", origine: "riconferma", chiave: "locale:orari-0000", voce_id: "b", sezione: "locale",
  testo_prima: "Chiuso il lunedì.", testo_dopo: "Chiuso il lunedì e il martedì a pranzo.", fonte_prima: "confermato", fonte_dopo: "riferito",
  abbassa_fonte: true, motivo: "Prova: la fonte scende.", stato: "in_attesa", creata_il: "2026-11-21T08:00:00Z", scade_il: "2026-12-21",
};
const P_RICONFERMA = {
  id: "p3", tipo: "riconferma", origine: "riconferma", chiave: "fornitori:ortofrutta-0000", voce_id: "a", sezione: "fornitori",
  testo_prima: "ZZ Ortofrutta consegna il martedì.", testo_dopo: "ZZ Ortofrutta consegna il martedì.", fonte_prima: "riferito", fonte_dopo: "confermato",
  abbassa_fonte: false, motivo: "Non la riconfermi dal 01/01/2026: è ancora vera?", stato: "in_attesa", creata_il: "2026-11-21T07:00:00Z", scade_il: "2026-12-21",
};

beforeEach(() => {
  finto.voci = [];
  finto.proposte = [];
  finto.generazione = { nuove: 0, scadute: 0, saltate_privacy: 0, in_attesa: 0 };
  finto.generazioneFallita = false;
  finto.letturaFallita = false;
  finto.rifiuto = null;
  finto.risposta = { esito: "accettata", voce_id: "nuova", numero: 50 };
  finto.delicate = [];
  spie.decise = [];
  spie.voci = 0;
});

async function apri() {
  const { default: Scheda } = await import("../../src/pages/memo/SchedaDiBorgo58.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/memo/scheda"]}>
      <Scheda />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: /Proposte di MEMO/ })).toBeTruthy());
  return vista;
}

const schede = () => within(screen.getByRole("list", { name: "Proposte di MEMO" })).getAllByRole("listitem");

describe("Le proposte di MEMO · cosa si vede", () => {
  it("senza proposte lo dice e dice dove ha guardato", async () => {
    await apri();
    expect(await screen.findByText(/MEMO non ha proposte oggi/)).toBeTruthy();
    expect(screen.getByText(/fornitori nuovi, i contratti nuovi e le voci da riconfermare/)).toBeTruthy();
  });

  it("se qualcosa è stato tenuto da parte per privacy, lo dice", async () => {
    finto.generazione = { nuove: 0, scadute: 0, saltate_privacy: 2, in_attesa: 0 };
    await apri();
    expect(await screen.findByText(/2 possibili proposte sono state tenute da parte/)).toBeTruthy();
  });

  it("mostra una scheda per proposta, ognuna con Sì, Non farlo e (dove serve) Correggi", async () => {
    finto.proposte = [P_NUOVA, P_SCENDE, P_RICONFERMA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(3));
    const nuova = schede()[0];
    expect(within(nuova).getByText("Aggiungere alla Scheda")).toBeTruthy();
    expect(within(nuova).getByText(/ZZ Ortofrutta Bianchi/)).toBeTruthy();
    expect(within(nuova).getByText("Nuova voce in «I fornitori»")).toBeTruthy();
    // Una voce nuova non ha ancora un numero: la pagina non ne inventa uno.
    expect(nuova.textContent).not.toMatch(/\[S\d+\]/);
    expect(within(nuova).getByRole("button", { name: "Sì" })).toBeTruthy();
    expect(within(nuova).getByRole("button", { name: "Non farlo" })).toBeTruthy();
    expect(within(nuova).getByRole("button", { name: "Correggi" })).toBeTruthy();
    // Riconfermare non ha un testo da correggere.
    const ric = schede()[2];
    expect(within(ric).queryByRole("button", { name: "Correggi" })).toBeNull();
    expect(within(ric).getByText("La fonte diventa «Confermato da te».")).toBeTruthy();
  });

  it("se la lettura fallisce lo dice, e non scrive «nessuna proposta»", async () => {
    finto.letturaFallita = true;
    await apri();
    expect(await screen.findByText(/le proposte di MEMO/i)).toBeTruthy();
    expect(screen.queryByText(/MEMO non ha proposte oggi/)).toBeNull();
  });

  it("se non riesce a cercarne di nuove, la pagina funziona lo stesso con quelle già pronte", async () => {
    finto.generazioneFallita = true;
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    expect(screen.getByText(/Non sono riuscito a cercare proposte nuove adesso/)).toBeTruthy();
  });
});

describe("Le proposte di MEMO · i gesti", () => {
  it("Sì consegna la decisione, toglie la scheda dall'elenco e rilegge la Scheda", async () => {
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const lettureIniziali = spie.voci;
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    await waitFor(() => expect(spie.decise).toHaveLength(1));
    expect(spie.decise[0]).toMatchObject({ id: "p1", esito: "si", confermaFonte: false });
    expect(await screen.findByText(/Fatto: la Scheda è aggiornata/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Proposte di MEMO" })).toBeNull();
    await waitFor(() => expect(spie.voci).toBeGreaterThan(lettureIniziali));
  });

  it("Non farlo rifiuta e non tocca la Scheda", async () => {
    finto.proposte = [P_NUOVA];
    finto.risposta = { esito: "rifiutata" };
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const lettureIniziali = spie.voci;
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Non farlo" }));
    await waitFor(() => expect(spie.decise).toHaveLength(1));
    expect(spie.decise[0]).toMatchObject({ id: "p1", esito: "no" });
    expect(await screen.findByText(/non la riproporrò per un po'/)).toBeTruthy();
    expect(spie.voci).toBe(lettureIniziali);
  });

  it("Correggi manda il testo corretto, con il contatore dei 300 caratteri", async () => {
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Correggi" }));
    const campo = await screen.findByLabelText("Correggi il testo");
    expect(campo.value).toMatch(/ZZ Ortofrutta Bianchi/);
    fireEvent.change(campo, { target: { value: "x".repeat(305) } });
    expect(screen.getByText(/5 caratteri di troppo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salva il testo corretto" }).disabled).toBe(true);
    fireEvent.change(campo, { target: { value: "  ZZ Ortofrutta Bianchi, consegna il lunedì.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salva il testo corretto" }));
    await waitFor(() => expect(spie.decise).toHaveLength(1));
    expect(spie.decise[0]).toMatchObject({ id: "p1", esito: "correggi", testo: "ZZ Ortofrutta Bianchi, consegna il lunedì." });
  });

  it("le parole delicate nel testo corretto avvisano e non bloccano", async () => {
    finto.proposte = [P_NUOVA];
    finto.delicate = ["debito"];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Correggi" }));
    const campo = await screen.findByLabelText("Correggi il testo");
    fireEvent.change(campo, { target: { value: "Ha un debito con noi." } });
    expect(await screen.findByText(/parole delicate \(debito\)/, {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salva il testo corretto" }).disabled).toBe(false);
  });

  it("se la fonte scende, il Sì aspetta la casella «So che la fonte scende»", async () => {
    finto.proposte = [P_SCENDE];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const scheda = schede()[0];
    expect(within(scheda).getByText(/abbassa la fonte da «Confermato da te» a «Riferito»/)).toBeTruthy();
    expect(within(scheda).getByRole("button", { name: "Sì" }).disabled).toBe(true);
    expect(within(scheda).getByRole("button", { name: "Correggi" }).disabled).toBe(true);
    fireEvent.click(within(scheda).getByLabelText("So che la fonte scende"));
    expect(within(scheda).getByRole("button", { name: "Sì" }).disabled).toBe(false);
    fireEvent.click(within(scheda).getByRole("button", { name: "Sì" }));
    await waitFor(() => expect(spie.decise).toHaveLength(1));
    expect(spie.decise[0]).toMatchObject({ id: "p2", esito: "si", confermaFonte: true });
  });

  it("Non farlo non ha bisogno della casella anche se la fonte scende", async () => {
    finto.proposte = [P_SCENDE];
    finto.risposta = { esito: "rifiutata" };
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const no = within(schede()[0]).getByRole("button", { name: "Non farlo" });
    expect(no.disabled).toBe(false);
    fireEvent.click(no);
    await waitFor(() => expect(spie.decise).toHaveLength(1));
  });
});

describe("Le proposte di MEMO · quando il database dice no", () => {
  it("mostra il suo rifiuto com'è e la proposta resta lì", async () => {
    finto.proposte = [P_NUOVA];
    finto.rifiuto = "La Scheda ha già 60 voci attive: spegni una voce prima di aggiungerne o riattivarne un'altra.";
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    expect(await within(schede()[0]).findByRole("alert")).toBeTruthy();
    expect(within(schede()[0]).getByRole("alert").textContent).toMatch(/60 voci attive/);
    expect(schede()).toHaveLength(1);
    // Il pulsante si riaccende: si può riprovare dopo aver spento una voce.
    expect(within(schede()[0]).getByRole("button", { name: "Sì" }).disabled).toBe(false);
  });

  it("una voce cambiata nel frattempo: la proposta sparisce e la pagina lo dice", async () => {
    finto.proposte = [P_RICONFERMA];
    finto.risposta = { esito: "obsoleta" };
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    expect(await screen.findByText(/La voce è cambiata nel frattempo: la proposta non vale più/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Proposte di MEMO" })).toBeNull();
  });

  it("un doppio clic manda una sola decisione", async () => {
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const si = within(schede()[0]).getByRole("button", { name: "Sì" });
    fireEvent.click(si);
    fireEvent.click(si);
    await waitFor(() => expect(spie.decise.length).toBeGreaterThan(0));
    expect(spie.decise).toHaveLength(1);
  });
});
