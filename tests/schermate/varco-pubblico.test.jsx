import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IL VARCO PUBBLICO, GUARDATO — 01/09/2026, prima prova di questo strato.
//
// 🔴 PERCHE' PROPRIO QUESTA SCHERMATA. `/prenota` e' l'unica pagina del
//    gestionale che vede un cliente vero, ed e' quella su cui il progetto
//    ha gia' pagato un difetto **invisibile a chi lo provava**: il
//    09/08/2026 il modulo rispondeva «Non e' stato possibile inviare la
//    richiesta» a chiunque avesse il gestionale aperto nello stesso
//    browser — cioe' ad Alessio, cioe' all'unica persona che lo provava.
//    La cura fu un secondo collegamento, `supabasePubblico`, che non
//    allega la sessione di chi e' dentro.
//
// ⚠️ QUELLA CURA NON ERA SORVEGLIATA DA NIENTE DI VISIVO: c'e' una prova
//    contro il database (`tests/app/prenotazione-pubblica.test.js`) che
//    esercita la funzione, ma **nessuna prova montava la pagina**. Un
//    domani basta un `import { supabase }` scritto per abitudine in un
//    componente di quella schermata perche' il difetto torni, e a
//    trovarlo sarebbe un cliente che non riesce a prenotare.

const finto = () => ({
  rpc: vi.fn(async () => ({ data: null, error: null })),
  from: vi.fn(() => {
    throw new Error("nessuna prova di questo strato deve leggere una tabella");
  }),
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  },
});

const clienti = vi.hoisted(() => ({ normale: null, pubblico: null }));

vi.mock("../../src/lib/supabase", () => ({
  get supabase() {
    return clienti.normale;
  },
  get supabasePubblico() {
    return clienti.pubblico;
  },
}));

beforeEach(() => {
  clienti.normale = finto();
  clienti.pubblico = finto();
});

async function apri(percorso) {
  window.history.pushState({}, "", percorso);
  const { default: App } = await import("../../src/App.jsx");
  return render(<App />);
}

describe("la pagina che vede un cliente", () => {
  it("si apre senza nessuna sessione e mostra il modulo", async () => {
    await apri("/prenota");
    expect(await screen.findByText(/richiedi un tavolo/i)).toBeTruthy();
    expect(screen.getByLabelText(/nome e cognome/i)).toBeTruthy();
    expect(screen.getByLabelText(/telefono/i)).toBeTruthy();
  });

  // 🔴 IL DIFETTO DEL 09/08, messo sotto sorveglianza.
  it("parla SOLO dal collegamento anonimo, mai da quello del gestionale", async () => {
    await apri("/prenota");
    await screen.findByText(/richiedi un tavolo/i);
    await waitFor(() => expect(clienti.pubblico.rpc).toHaveBeenCalled());
    expect(clienti.normale.rpc).not.toHaveBeenCalled();
  });

  // ⚠️ L'informativa va offerta NEL MOMENTO in cui si acconsente, non in
  //    fondo alla pagina: e' la decisione del 10/08/2026.
  it("offre l'informativa dov'e' la casella del consenso", async () => {
    const { container } = await apri("/prenota");
    await screen.findByText(/richiedi un tavolo/i);
    const casella = container.querySelector('input[type="checkbox"]');
    expect(casella).toBeTruthy();
    const dentroLaStessaEtichetta = casella.closest("label").querySelector('a[href="/privacy"]');
    expect(dentroLaStessaEtichetta).toBeTruthy();
  });
});
