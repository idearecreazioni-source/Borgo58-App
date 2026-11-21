import { beforeEach, describe, expect, it, vi } from "vitest";

// Annullare un lotto di import (C1, 22/11/2026): prima i file dal deposito, poi le righe; un errore sui file ferma tutto.
const chiamate = [];
let rpcRisposta;
let removeRisposta;

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    rpc: (nome, args) => { chiamate.push(["rpc", nome, args]); return Promise.resolve(rpcRisposta); },
    storage: { from: () => ({ remove: (paths) => { chiamate.push(["remove", paths]); return Promise.resolve(removeRisposta); } }) },
  },
}));
vi.mock("../../src/lib/operazioni", () => ({
  eseguiOperazione: (nome, parametri) => { chiamate.push(["operazione", nome, parametri]); return Promise.resolve(2); },
}));

import { annullaLottoImport } from "../../src/lib/api/documents";

describe("annullaLottoImport", () => {
  beforeEach(() => {
    chiamate.length = 0;
    removeRisposta = { error: null };
    rpcRisposta = { data: [{ documento_id: "d1", storage_path: "zz/uno.pdf" }, { documento_id: "d2", storage_path: "zz/due.pdf" }], error: null };
  });

  it("toglie prima i file e poi chiama l'operazione, nell'ordine", async () => {
    const tolti = await annullaLottoImport("lotto-1");
    expect(tolti).toBe(2);
    expect(chiamate.map((c) => c[0])).toEqual(["rpc", "remove", "operazione"]);
    expect(chiamate[1][1]).toEqual(["zz/uno.pdf", "zz/due.pdf"]);
    expect(chiamate[2]).toEqual(["operazione", "import_lotto_annulla", { p_lotto: "lotto-1" }]);
  });

  it("se i file non si tolgono non annulla il lotto e lo dice", async () => {
    removeRisposta = { error: { message: "rete" } };
    await expect(annullaLottoImport("lotto-1")).rejects.toThrow(/resta tutto com'era/);
    expect(chiamate.some((c) => c[0] === "operazione")).toBe(false);
  });

  it("un lotto senza file annulla comunque le righe", async () => {
    rpcRisposta = { data: [], error: null };
    await annullaLottoImport("lotto-2");
    expect(chiamate.map((c) => c[0])).toEqual(["rpc", "operazione"]);
  });
});
