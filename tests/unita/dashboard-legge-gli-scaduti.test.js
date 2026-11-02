import { describe, expect, it, vi } from "vitest";

// LA DASHBOARD CHIEDE ANCHE GLI SCADUTI — 27/10/2026, chiesto da Alessio.
// ⚠️ Si prova la domanda al database, non la schermata: con `due_date.eq`
//    uno scaduto non arrivava proprio, e nessuna schermata finta lo vede.

const chiamate = [];
const domanda = new Proxy(
  {},
  {
    get: (_, nome) =>
      nome === "then"
        ? (ok) => ok({ data: [], error: null })
        : (...a) => {
            chiamate.push([nome, ...a]);
            return domanda;
          },
  },
);
vi.mock("../../src/lib/supabase", () => ({ supabase: { from: () => domanda } }));
vi.mock("../../src/lib/operazioni", () => ({ eseguiOperazione: vi.fn() }));

const { listDashboardTasks } = await import("../../src/lib/api/tasks");
const { oggiLocale } = await import("../../src/lib/constants");

describe("gli impegni della Dashboard", () => {
  it("🔴 chiede quelli di oggi E quelli scaduti non spuntati, più quelli senza data", async () => {
    await listDashboardTasks();
    const oggi = oggiLocale();
    expect(chiamate).toContainEqual(["or", `due_date.lte.${oggi},due_date.is.null`]);
    expect(chiamate).toContainEqual(["neq", "status", "completato"]);
  });
});
