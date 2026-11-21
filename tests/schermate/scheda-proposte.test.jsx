import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LE PROPOSTE DI MEMO NELLA SCHEDA — 21/11/2026 (pezzo B1)
// =====================================================================
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento e' finto. Queste prove
//    dicono cosa la pagina MOSTRA e cosa CONSEGNA al collegamento: Sì, Non
//    farlo e Correggi, la casella sulla fonte che scende, il rifiuto del
//    database mostrato com'e', la lettura fallita detta, il focus, un gesto
//    alla volta. Che il database applichi davvero le regole lo prova la
//    verifica della migrazione.

const finto = vi.hoisted(() => ({
  voci: [],
  proposte: [],
  generazione: { nuove: 0, scadute: 0, saltate_privacy: 0, in_attesa: 0 },
  generazioneFallita: false,
  letturaFallita: false,
  letturaProposteFallitaVolte: 0,
  rifiuto: null,
  risposta: { esito: "accettata", voce_id: "nuova", numero: 50 },
  delicate: [],
  delicateNull: false,
  vociFallisconoDopo: null,
  trattieniDecisione: null,
}));
const spie = vi.hoisted(() => ({ decise: [], voci: 0, generate: 0, letteProposte: 0 }));

vi.mock("../../src/lib/api/scheda", () => ({
  leggiVoci: vi.fn(async () => {
    spie.voci += 1;
    if (finto.vociFallisconoDopo !== null && spie.voci > finto.vociFallisconoDopo) throw new Error("non risponde");
    return finto.voci;
  }),
  leggiContatori: vi.fn(async () => ({ voci: 1, caratteri: 100 })),
  leggiStorico: vi.fn(async () => []),
  paroleDelicate: vi.fn(async () => (finto.delicateNull ? null : finto.delicate)),
  salvaVoce: vi.fn(),
  accendiVoce: vi.fn(),
  generaProposte: vi.fn(async () => {
    spie.generate += 1;
    return finto.generazioneFallita ? null : finto.generazione;
  }),
  leggiProposte: vi.fn(async () => {
    spie.letteProposte += 1;
    if (finto.letturaFallita) throw new Error("non risponde");
    if (finto.letturaProposteFallitaVolte > 0) {
      finto.letturaProposteFallitaVolte -= 1;
      throw new Error("non risponde");
    }
    return finto.proposte;
  }),
  decidiProposta: vi.fn(async (id, esito, testo, confermaFonte) => {
    spie.decise.push({ id, esito, testo, confermaFonte });
    if (finto.trattieniDecisione) await finto.trattieniDecisione;
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
const V1 = { id: "a", numero: 1, sezione: "fornitori", chiave: "fornitori:ortofrutta-0000", testo: "ZZ Ortofrutta consegna il martedì.", fonte: "confermato", valida_dal: null, verificata_il: null, rivedere_entro: null, attiva: true, ordine: 10 };

beforeEach(() => {
  finto.voci = [];
  finto.proposte = [];
  finto.generazione = { nuove: 0, scadute: 0, saltate_privacy: 0, in_attesa: 0 };
  finto.generazioneFallita = false;
  finto.letturaFallita = false;
  finto.letturaProposteFallitaVolte = 0;
  finto.rifiuto = null;
  finto.risposta = { esito: "accettata", voce_id: "nuova", numero: 50 };
  finto.delicate = [];
  finto.delicateNull = false;
  finto.vociFallisconoDopo = null;
  finto.trattieniDecisione = null;
  spie.decise = [];
  spie.voci = 0;
  spie.generate = 0;
  spie.letteProposte = 0;
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
// L'area dei messaggi d'esito: sta sempre nella pagina, anche vuota (è l'unico `status` con tabindex).
const areaMessaggi = () => document.querySelector('[role="status"][tabindex="-1"]');

describe("Le proposte di MEMO · cosa si vede", () => {
  it("senza proposte lo dice e dice dove ha guardato", async () => {
    await apri();
    expect(await screen.findByText(/MEMO non ha proposte oggi/)).toBeTruthy();
    expect(screen.getByText(/fornitori nuovi, i contratti nuovi e le voci da riconfermare/)).toBeTruthy();
  });

  it("se qualcosa è stato tenuto da parte per privacy, lo dice", async () => {
    finto.generazione = { nuove: 0, scadute: 0, saltate_privacy: 2, in_attesa: 0 };
    await apri();
    expect(await screen.findByText(/2 possibili proposte sono state tenute da parte perché contenevano dati personali, contatti o parole delicate/)).toBeTruthy();
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

  it("l'area dei messaggi sta nella pagina da subito, vuota", async () => {
    await apri();
    const area = areaMessaggi();
    expect(area).not.toBeNull();
    expect(area.textContent).toBe("");
    expect(area.getAttribute("aria-live")).toBe("polite");
  });
});

describe("Le proposte di MEMO · quando qualcosa non si legge", () => {
  it("se la lettura fallisce lo dice, e non scrive «nessuna proposta»", async () => {
    finto.letturaFallita = true;
    await apri();
    expect(await screen.findByText(/le proposte di MEMO/i)).toBeTruthy();
    expect(screen.queryByText(/MEMO non ha proposte oggi/)).toBeNull();
  });

  it("«Riprova» rilegge e, se stavolta riesce, mostra le proposte", async () => {
    finto.proposte = [P_NUOVA];
    finto.letturaProposteFallitaVolte = 1;
    await apri();
    const riprova = await screen.findByRole("button", { name: "Riprova" });
    expect(screen.queryByRole("list", { name: "Proposte di MEMO" })).toBeNull();
    fireEvent.click(riprova);
    await waitFor(() => expect(schede()).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Riprova" })).toBeNull();
    expect(spie.generate).toBe(2);
  });

  it("se non riesce a cercarne di nuove, la pagina funziona lo stesso con quelle già pronte", async () => {
    finto.generazioneFallita = true;
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    expect(screen.getByText(/Non sono riuscito a cercare proposte nuove adesso/)).toBeTruthy();
  });

  it("se la generazione E la lettura falliscono, dice che non le ha lette (non «nessuna proposta»)", async () => {
    finto.generazioneFallita = true;
    finto.letturaFallita = true;
    await apri();
    expect(await screen.findByRole("button", { name: "Riprova" })).toBeTruthy();
    expect(screen.queryByText(/MEMO non ha proposte oggi/)).toBeNull();
    // La Scheda sotto funziona lo stesso.
    expect(screen.getByRole("button", { name: "Aggiungi una voce" })).toBeTruthy();
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

  it("se il controllo delle parole delicate non riesce, lo dice (non finge che non ce ne siano)", async () => {
    finto.proposte = [P_NUOVA];
    finto.delicateNull = true;
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Correggi" }));
    const campo = await screen.findByLabelText("Correggi il testo");
    fireEvent.change(campo, { target: { value: "Un testo qualunque." } });
    expect(await screen.findByText("Non sono riuscito a controllare le parole delicate.", {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText(/Qui compaiono parole delicate/)).toBeNull();
    // Non è un blocco: si può salvare lo stesso.
    expect(screen.getByRole("button", { name: "Salva il testo corretto" }).disabled).toBe(false);
  });

  it("se la fonte scende, il Sì aspetta la casella «So che la fonte scende»", async () => {
    finto.proposte = [P_SCENDE];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const scheda = schede()[0];
    expect(within(scheda).getByText(/abbassa la fonte da «Confermato da te» a «Riferito»/)).toBeTruthy();
    const si = within(scheda).getByRole("button", { name: "Sì" });
    expect(si.disabled).toBe(true);
    expect(within(scheda).getByRole("button", { name: "Correggi" }).disabled).toBe(true);
    // Il pulsante spento dice perché: la spiegazione è collegata con aria-describedby.
    const idSpiegazione = si.getAttribute("aria-describedby");
    expect(idSpiegazione).toBeTruthy();
    expect(document.getElementById(idSpiegazione).textContent).toMatch(/Spunta «So che la fonte scende»/);
    // La casella è un bersaglio da dito (tocco-*).
    expect(within(scheda).getByLabelText("So che la fonte scende").closest("label").className).toMatch(/tocco-/);
    fireEvent.click(within(scheda).getByLabelText("So che la fonte scende"));
    expect(within(scheda).getByRole("button", { name: "Sì" }).disabled).toBe(false);
    fireEvent.click(within(scheda).getByRole("button", { name: "Sì" }));
    await waitFor(() => expect(spie.decise).toHaveLength(1));
    expect(spie.decise[0]).toMatchObject({ id: "p2", esito: "si", confermaFonte: true });
  });

  it("Non farlo resta attivo anche se la fonte scende", async () => {
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

  it("un rifiuto durante Correggi lascia aperto il testo scritto e mostra il rifiuto", async () => {
    finto.proposte = [P_NUOVA];
    finto.rifiuto = "La Scheda non accetta IBAN, codici fiscali di persona o numeri di carta.";
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Correggi" }));
    const campo = await screen.findByLabelText("Correggi il testo");
    fireEvent.change(campo, { target: { value: "Il mio testo corretto." } });
    fireEvent.click(screen.getByRole("button", { name: "Salva il testo corretto" }));
    expect(await within(schede()[0]).findByRole("alert")).toBeTruthy();
    expect(within(schede()[0]).getByRole("alert").textContent).toMatch(/non accetta IBAN/);
    // Il testo scritto non si è perso e il modulo è ancora lì, riattivato.
    expect(screen.getByLabelText("Correggi il testo").value).toBe("Il mio testo corretto.");
    expect(screen.getByRole("button", { name: "Salva il testo corretto" }).disabled).toBe(false);
    expect(schede()).toHaveLength(1);
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

  it("«già decisa» e «scaduta» tolgono la proposta e lo dicono a schermo", async () => {
    finto.proposte = [P_NUOVA, P_RICONFERMA];
    finto.risposta = { esito: "gia_decisa", stato: "accettata" };
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(2));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    expect(await screen.findByText(/Questa proposta era già stata decisa/)).toBeTruthy();
    await waitFor(() => expect(schede()).toHaveLength(1));
    finto.risposta = { esito: "scaduta" };
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    expect(await screen.findByText(/Questa proposta è scaduta/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("list", { name: "Proposte di MEMO" })).toBeNull());
  });

  it("una risposta sconosciuta NON toglie la proposta: la pagina rilegge e lo dice", async () => {
    finto.proposte = [P_NUOVA];
    finto.risposta = { esito: "boh" };
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    const lette = spie.letteProposte;
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    expect(await screen.findByText(/Non so com'è andata/)).toBeTruthy();
    await waitFor(() => expect(spie.letteProposte).toBeGreaterThan(lette));
    expect(schede()).toHaveLength(1);
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

  it("durante una decisione i pulsanti di TUTTE le schede sono spenti", async () => {
    finto.proposte = [P_NUOVA, P_RICONFERMA];
    let sblocca;
    finto.trattieniDecisione = new Promise((risolvi) => {
      sblocca = risolvi;
    });
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(2));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    await waitFor(() => expect(spie.decise).toHaveLength(1));
    // La scheda in corso mostra «Salvo…»; l'altra ha tutto spento, compreso «Non farlo».
    await waitFor(() => expect(within(schede()[0]).getByRole("button", { name: "Salvo…" }).disabled).toBe(true));
    const altra = schede()[1];
    expect(within(altra).getByRole("button", { name: "Sì" }).disabled).toBe(true);
    expect(within(altra).getByRole("button", { name: "Non farlo" }).disabled).toBe(true);
    fireEvent.click(within(altra).getByRole("button", { name: "Sì" }));
    expect(spie.decise).toHaveLength(1);
    sblocca();
    await waitFor(() => expect(schede()).toHaveLength(1));
    expect(within(schede()[0]).getByRole("button", { name: "Sì" }).disabled).toBe(false);
  });
});

describe("Le proposte di MEMO · una voce in modifica (occupato)", () => {
  it("spegne Sì e Correggi di tutte le schede, dice perché, e lascia attivo Non farlo", async () => {
    finto.voci = [V1];
    finto.proposte = [P_NUOVA, P_RICONFERMA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(2));
    fireEvent.click(await screen.findByRole("button", { name: "Modifica" }));
    for (const scheda of schede()) {
      const si = within(scheda).getByRole("button", { name: "Sì" });
      expect(si.disabled).toBe(true);
      expect(document.getElementById(si.getAttribute("aria-describedby")).textContent).toMatch(/Finisci prima la voce che stai scrivendo/);
      expect(within(scheda).getByRole("button", { name: "Non farlo" }).disabled).toBe(false);
    }
    expect(within(schede()[0]).getByRole("button", { name: "Correggi" }).disabled).toBe(true);
    // Chiusa la modifica, tutto si riaccende.
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(within(schede()[0]).getByRole("button", { name: "Sì" }).disabled).toBe(false));
  });
});

describe("Le proposte di MEMO · il focus", () => {
  it("dopo un Sì il focus va sul messaggio d'esito, che resta nella pagina", async () => {
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    await waitFor(() => expect(areaMessaggi().textContent).toMatch(/Fatto: la Scheda è aggiornata/));
    await waitFor(() => expect(document.activeElement).toBe(areaMessaggi()));
  });

  it("dopo un Non farlo il focus va sul messaggio d'esito", async () => {
    finto.proposte = [P_NUOVA];
    finto.risposta = { esito: "rifiutata" };
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Non farlo" }));
    await waitFor(() => expect(document.activeElement).toBe(areaMessaggi()));
    expect(areaMessaggi().textContent).toMatch(/non la riproporrò/);
  });

  it("Correggi porta il cursore nel testo, e Annulla lo riporta sul pulsante Correggi", async () => {
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Correggi" }));
    const campo = await screen.findByLabelText("Correggi il testo");
    await waitFor(() => expect(document.activeElement).toBe(campo));
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    const correggi = await within(schede()[0]).findByRole("button", { name: "Correggi" });
    await waitFor(() => expect(document.activeElement).toBe(correggi));
    expect(screen.queryByLabelText("Correggi il testo")).toBeNull();
  });
});

describe("Le proposte di MEMO · la rilettura della Scheda dopo un Sì è accessoria", () => {
  it("se la rilettura delle voci fallisce, il «Fatto» resta, si aggiunge una frase e la pagina non si smonta", async () => {
    finto.voci = [V1];
    finto.proposte = [P_NUOVA];
    await apri();
    await waitFor(() => expect(schede()).toHaveLength(1));
    // Dalla prossima lettura in poi le voci non arrivano più.
    finto.vociFallisconoDopo = spie.voci;
    fireEvent.click(within(schede()[0]).getByRole("button", { name: "Sì" }));
    await waitFor(() => expect(areaMessaggi().textContent).toMatch(/Fatto: la Scheda è aggiornata/));
    await waitFor(() => expect(areaMessaggi().textContent).toMatch(/Non sono riuscito a rileggere l'elenco delle voci/));
    // La pagina è ancora lì, con le voci che c'erano: nessun errore che smonta tutto.
    expect(screen.queryByText(/Non riesco a leggere la Scheda/)).toBeNull();
    expect(screen.getByRole("heading", { name: /La Scheda di Borgo 58/ })).toBeTruthy();
    expect(screen.getByText(/ZZ Ortofrutta consegna il martedì/)).toBeTruthy();
  });
});
