import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChiudiConEsc } from "../../src/lib/chiudiConEsc";

// Le finestre sopra le schermate si chiudono con Esc (27/10/2026, WCAG 2.1.2).

describe("useChiudiConEsc", () => {
  it("con la finestra aperta, Esc la chiude", () => {
    const chiudi = vi.fn();
    renderHook(() => useChiudiConEsc(true, chiudi));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(chiudi).toHaveBeenCalledTimes(1);
  });

  it("con la finestra chiusa, e con gli altri tasti, non succede niente", () => {
    const chiudi = vi.fn();
    const { rerender } = renderHook(({ aperta }) => useChiudiConEsc(aperta, chiudi), { initialProps: { aperta: false } });
    fireEvent.keyDown(document, { key: "Escape" });
    rerender({ aperta: true });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(chiudi).not.toHaveBeenCalled();
  });

  it("chiusa la finestra, Esc smette di ascoltare", () => {
    const chiudi = vi.fn();
    const { rerender } = renderHook(({ aperta }) => useChiudiConEsc(aperta, chiudi), { initialProps: { aperta: true } });
    rerender({ aperta: false });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(chiudi).not.toHaveBeenCalled();
  });
});
