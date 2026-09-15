import { beforeEach, describe, expect, it, vi } from "vitest";

// CHIUDERE UN IMPEGNO, IN UN POSTO SOLO — 12/09/2026, mandato «ricorrenze
// chiuse dalla Dashboard». Agenda e Dashboard chiudono un impegno dalla
// stessa strada (`completa_task` nel database, via `completaTask`), e il
// secondo tocco mentre il primo è ancora in volo non parte.

const finte = { completaTask: vi.fn() };
vi.mock("../../src/lib/api/tasks", () => ({
  completaTask: (...a) => finte.completaTask(...a),
}));

const { chiudiImpegno } = await import("../../src/lib/chiudiImpegno");

const righe = () => [
  { id: "a", title: "Uno" },
  { id: "b", title: "Due" },
];

// Uno «stato» finto come quello di React: accetta un valore o una funzione.
function statoFinto(iniziale) {
  let v = iniziale;
  return {
    get: () => v,
    set: (x) => {
      v = typeof x === "function" ? x(v) : x;
    },
  };
}

beforeEach(() => {
  finte.completaTask.mockReset();
});

describe("chiudiImpegno", () => {
  it("passa da completaTask col solo identificativo, toglie la riga e dice se è nato il successivo", async () => {
    finte.completaTask.mockResolvedValue("a-successivo");
    const s = statoFinto(righe());
    const avvisa = vi.fn();
    const r = await chiudiImpegno({ righe: s.get(), id: "a", mostra: s.set, avvisa });
    expect(finte.completaTask.mock.calls).toEqual([["a"]]);
    expect(r).toEqual({ ok: true, esito: "a-successivo" });
    expect(s.get().map((x) => x.id)).toEqual(["b"]);
  });

  it("un impegno che non si ripete: stessa strada, esito vuoto", async () => {
    finte.completaTask.mockResolvedValue(null);
    const s = statoFinto(righe());
    const r = await chiudiImpegno({ righe: s.get(), id: "b", mostra: s.set, avvisa: vi.fn() });
    expect(r).toEqual({ ok: true, esito: null });
  });

  it("⚠️ il secondo tocco sullo stesso impegno, mentre il primo è in volo, non parte", async () => {
    let risolvi = () => {};
    finte.completaTask.mockImplementation(() => new Promise((r) => (risolvi = r)));
    const s = statoFinto(righe());
    const primo = chiudiImpegno({ righe: s.get(), id: "a", mostra: s.set, avvisa: vi.fn() });
    const secondo = await chiudiImpegno({ righe: righe(), id: "a", mostra: s.set, avvisa: vi.fn() });
    expect(secondo.ok).toBe(false);
    expect(finte.completaTask).toHaveBeenCalledTimes(1);
    risolvi("a-successivo");
    expect(await primo).toEqual({ ok: true, esito: "a-successivo" });
    // Finito il primo, lo stesso impegno si potrebbe richiudere (e sarebbe
    // il database a rifiutarlo: «risulta già fatto»).
    finte.completaTask.mockResolvedValue(null);
    await chiudiImpegno({ righe: righe(), id: "a", mostra: s.set, avvisa: vi.fn() });
    expect(finte.completaTask).toHaveBeenCalledTimes(2);
  });

  it("due impegni diversi insieme partono tutti e due", async () => {
    finte.completaTask.mockResolvedValue(null);
    const s = statoFinto(righe());
    await Promise.all([
      chiudiImpegno({ righe: s.get(), id: "a", mostra: s.set, avvisa: vi.fn() }),
      chiudiImpegno({ righe: s.get(), id: "b", mostra: s.set, avvisa: vi.fn() }),
    ]);
    expect(finte.completaTask).toHaveBeenCalledTimes(2);
  });

  it("se il database rifiuta, la riga torna al suo posto e lo si dice", async () => {
    finte.completaTask.mockRejectedValue(new Error("Questo impegno risulta già fatto"));
    const s = statoFinto(righe());
    const avvisa = vi.fn();
    const r = await chiudiImpegno({ righe: s.get(), id: "a", mostra: s.set, avvisa });
    expect(r.ok).toBe(false);
    expect(s.get().map((x) => x.id)).toEqual(["a", "b"]);
    expect(avvisa).toHaveBeenLastCalledWith(expect.stringMatching(/risulta già fatto/));
  });
});
