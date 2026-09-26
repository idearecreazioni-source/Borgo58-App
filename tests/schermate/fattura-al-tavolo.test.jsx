import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// «IL CLIENTE VUOLE FATTURA» — C4, la garanzia messa sotto sorveglianza
// =====================================================================
// 🔴 PERCHE' ESISTE QUESTA PROVA. Il gesto in sala e' stato costruito il
//    31/08/2026 e **nessuna prova lo guardava**: misurato il 22/09 cercando
//    `vuoleFattura`, `setDocumentoFiscale` e `fiscalizzaConto` in tutta la
//    cartella delle prove. `tests/app/scontrino-automatico.test.js` copre il
//    giorno buono, la pagina bianca, la rettifica e l'omaggio — **non** il
//    cliente che chiede la fattura.
//
// 🔴 E LA GARANZIA CHE RESTAVA SCOPERTA E' QUELLA CHE COSTA PIU' CARA:
//    *se il cliente vuole fattura lo scontrino NON esce.* Togliendo quel
//    ramo, lo stesso incasso verrebbe documentato **due volte** — una con lo
//    scontrino e una con la fattura — e **nessun errore lo direbbe**: il
//    conto risulterebbe a posto, e la differenza si vedrebbe solo nella
//    quadratura fiscale, mesi dopo, senza piu' modo di sapere quali conti.
//
// ⚠️ E IL VERSO OPPOSTO CONTA QUANTO IL PRIMO: senza la spunta lo scontrino
//    deve uscire come sempre. Una prova che guardasse solo il caso nuovo
//    resterebbe verde con la fiscalizzazione rotta per tutti.

vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  supabasePubblico: {},
}));

const spie = vi.hoisted(() => ({ fiscalizza: [], documento: [], chiusure: [] }));

// ⚠️ `orderTotals` NON si finge: e' il calcolo vero del conto, ed e' lo
//    stesso che alimenta preconto e chiusura. Una copia inventata qui
//    proverebbe la schermata contro numeri che non sono quelli del
//    gestionale — e il giorno che quel calcolo cambiasse, questa prova
//    resterebbe verde.
vi.mock("../../src/lib/api/orders", async (vero) => ({
  ...(await vero()),
  cancelOrder: vi.fn(),
  closeOrderAsDiscountGift: vi.fn(),
  caparraDelConto: vi.fn(async () => null),
  closeOrderPaid: vi.fn(async (...a) => {
    spie.chiusure.push(a);
    return {};
  }),
  setDocumentoFiscale: vi.fn(async (...a) => {
    spie.documento.push(a);
    return {};
  }),
}));

vi.mock("../../src/lib/fiscalizzazione", () => ({
  fiscalizzaConto: vi.fn(async (...a) => {
    spie.fiscalizza.push(a);
    return {};
  }),
}));

vi.mock("../../src/lib/api/cash", () => ({ listCausali: vi.fn(async () => []) }));
vi.mock("../../src/lib/giornataOperativa", () => ({
  serataCorrente: vi.fn(async () => "2026-09-22"),
}));

const { default: CloseOrderModal } = await import("../../src/pages/comande/CloseOrderModal");

const conto = {
  id: "o1",
  table_label: "T3",
  covers: 2,
  items: [{ id: "i1", quantity: 1, unit_price: 40, recipe: { name: "Sugo di cozze" } }],
};

function apri() {
  return render(
    <CloseOrderModal order={conto} copertoPrice={0} onClose={() => {}} onDone={() => {}} />,
  );
}

const spunta = () =>
  [...document.querySelectorAll('input[type="checkbox"]')].find((c) =>
    c.closest("label")?.textContent.includes("vuole fattura"),
  );

const pulsante = (testo) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === testo);

beforeEach(() => {
  spie.fiscalizza = [];
  spie.documento = [];
  spie.chiusure = [];
  vi.clearAllMocks();
});

describe("🔴 lo stesso incasso non si documenta due volte", () => {
  it("con la spunta: lo scontrino NON esce, e il conto resta «fattura promessa»", async () => {
    apri();
    await waitFor(() => expect(spunta()).toBeTruthy());
    fireEvent.click(spunta());
    fireEvent.click(pulsante("Paga contante"));

    await waitFor(() => expect(spie.documento.length).toBe(1));
    // 🔴 La cosa che vale: nessuno scontrino.
    expect(spie.fiscalizza.length).toBe(0);
    expect(spie.documento[0][0]).toBe("o1");
    expect(spie.documento[0][1].tipo).toBe("fattura_da_emettere");
    // ⚠️ Senza numero: la fattura non e' stata ancora fatta, e un numero
    //    inventato adesso la farebbe sparire dall'elenco di Cassa.
    expect(spie.documento[0][1].numero).toBe(null);
  });

  it("senza la spunta: lo scontrino esce come sempre, e nessuna fattura viene promessa", async () => {
    apri();
    await waitFor(() => expect(spunta()).toBeTruthy());
    fireEvent.click(pulsante("Paga contante"));

    await waitFor(() => expect(spie.fiscalizza.length).toBe(1));
    expect(spie.documento.length).toBe(0);
  });

  it("il conto si chiude comunque, e con lo stesso gesto di sempre", async () => {
    apri();
    await waitFor(() => expect(spunta()).toBeTruthy());
    fireEvent.click(spunta());
    fireEvent.click(pulsante("Paga contante"));

    // ⚠️ La spunta non cambia COME si incassa: cambia solo quale documento
    //    si promette. Se un giorno toccasse anche la chiusura, questa
    //    diventerebbe rossa.
    await waitFor(() => expect(spie.chiusure.length).toBe(1));
    expect(spie.chiusure[0][0]).toBe("o1");
    expect(spie.chiusure[0][1]).toBe("contante");
  });
});

describe("la spunta si vede PRIMA di incassare, e dice cosa cambia", () => {
  it("sta sopra i pulsanti di pagamento", async () => {
    apri();
    await waitFor(() => expect(spunta()).toBeTruthy());
    // 🔴 Dopo aver incassato, chi chiude se n'e' gia' andato dalla
    //    schermata: una spunta sotto i pulsanti sarebbe una spunta che non
    //    si preme mai. Il confronto e' sulla posizione nel documento.
    const dove = spunta().compareDocumentPosition(pulsante("Paga contante"));
    expect(dove & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("⚠️ dice cosa succede spuntandola, invece di lasciarlo indovinare", async () => {
    apri();
    await waitFor(() => expect(spunta()).toBeTruthy());
    const riga = () => spunta().closest("label").textContent;
    expect(riga()).toMatch(/Lo scontrino esce come sempre/);
    fireEvent.click(spunta());
    await waitFor(() => expect(riga()).toMatch(/Lo scontrino non esce/));
  });
});
