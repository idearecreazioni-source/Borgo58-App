import { beforeEach, describe, expect, it, vi } from "vitest";

// Annullare un lotto di import (C1, 22/11/2026): prima si chiede se si può, poi i file dal deposito, poi le righe;
// un lotto non annullabile o un errore sui file fermano tutto PRIMA di toccare il deposito.
const chiamate = [];
let risposte;
let removeRisposta;

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    rpc: (nome, args) => { chiamate.push(["rpc", nome, args]); return Promise.resolve(risposte[nome]); },
    storage: { from: () => ({ remove: (paths) => { chiamate.push(["remove", paths]); return Promise.resolve(removeRisposta); } }) },
  },
}));
vi.mock("../../src/lib/operazioni", () => ({
  eseguiOperazione: (nome, parametri) => { chiamate.push(["operazione", nome, parametri]); return Promise.resolve(2); },
}));

import { annullaLottoImport, lottoImportPuoAnnullare } from "../../src/lib/api/documents";

const ordine = () => chiamate.map((c) => (c[0] === "rpc" ? c[1] : c[0]));

describe("annullaLottoImport", () => {
  beforeEach(() => {
    chiamate.length = 0;
    removeRisposta = { error: null };
    risposte = {
      import_lotto_puo_annullare: { data: [{ puo: true, motivo: null }], error: null },
      import_lotto_percorsi: { data: [{ documento_id: "d1", storage_path: "zz/uno.pdf" }, { documento_id: "d2", storage_path: "zz/due.pdf" }], error: null },
    };
  });

  it("chiede se si può, poi toglie i file e poi chiama l'operazione, nell'ordine", async () => {
    const tolti = await annullaLottoImport("lotto-1");
    expect(tolti).toBe(2);
    expect(ordine()).toEqual(["import_lotto_puo_annullare", "import_lotto_percorsi", "remove", "operazione"]);
    expect(chiamate[2][1]).toEqual(["zz/uno.pdf", "zz/due.pdf"]);
    expect(chiamate[3]).toEqual(["operazione", "import_lotto_annulla", { p_lotto: "lotto-1" }]);
  });

  it("un lotto che non si può annullare si ferma PRIMA di toccare i file, e dice perché", async () => {
    risposte.import_lotto_puo_annullare = { data: [{ puo: false, motivo: "1 documenti di questo lotto sono gia' stati usati altrove" }], error: null };
    await expect(annullaLottoImport("lotto-1")).rejects.toThrow(/usati altrove/);
    expect(ordine()).toEqual(["import_lotto_puo_annullare"]);
  });

  it("senza risposta dal database non si presume che si possa", async () => {
    risposte.import_lotto_puo_annullare = { data: [], error: null };
    await expect(annullaLottoImport("lotto-1")).rejects.toThrow(/non si può annullare/);
    expect(ordine()).toEqual(["import_lotto_puo_annullare"]);
  });

  it("se i file non si tolgono non annulla il lotto e lo dice", async () => {
    removeRisposta = { error: { message: "rete" } };
    await expect(annullaLottoImport("lotto-1")).rejects.toThrow(/resta tutto com'era/);
    expect(chiamate.some((c) => c[0] === "operazione")).toBe(false);
  });

  it("un lotto senza file annulla comunque le righe", async () => {
    risposte.import_lotto_percorsi = { data: [], error: null };
    await annullaLottoImport("lotto-2");
    expect(ordine()).toEqual(["import_lotto_puo_annullare", "import_lotto_percorsi", "operazione"]);
  });

  it("lottoImportPuoAnnullare legge la riga della risposta", async () => {
    expect(await lottoImportPuoAnnullare("lotto-3")).toEqual({ puo: true, motivo: null });
  });
});
