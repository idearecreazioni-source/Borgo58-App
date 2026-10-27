import { useEffect, useRef } from "react";

// LE FINESTRE SI CHIUDONO CON ESC — 27/10/2026 (audit WCAG del 25/10)
//
// Chi usa la tastiera, o una tastiera collegata al tablet, deve poter uscire
// da una finestra aperta sopra la schermata senza cercare la «×» (WCAG
// 2.1.2). Il gesto fa esattamente quello che fa il pulsante di chiusura
// della finestra: nessuna scorciatoia nuova, nessun salvataggio.

/** Finché `aperta` è vero, Esc chiama `chiudi`. */
export function useChiudiConEsc(aperta, chiudi) {
  const ultima = useRef(chiudi);
  ultima.current = chiudi;
  useEffect(() => {
    if (!aperta) return undefined;
    const tasto = (e) => {
      if (e.key === "Escape") ultima.current?.();
    };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [aperta]);
}
