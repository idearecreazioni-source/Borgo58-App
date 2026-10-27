import { useEffect, useRef } from "react";

// LE FINESTRE SI CHIUDONO CON ESC — 27/10/2026 (audit WCAG del 25/10)
//
// Chi usa la tastiera, o una tastiera collegata al tablet, deve poter uscire
// da una finestra aperta sopra la schermata senza cercare la «×» (WCAG
// 2.1.2). Il gesto fa esattamente quello che fa il pulsante di chiusura
// della finestra: nessuna scorciatoia nuova, nessun salvataggio.
//
// ⚠️ UNA FINESTRA PER VOLTA, l'ultima aperta: con due finestre una sopra
//    l'altra, Esc chiude quella in cima e basta (revisione ecc:a11y-architect
//    del 27/10).
// ⚠️ E NON MENTRE SI SCRIVE: Esc dentro un campo di testo lo lascia al campo.
//    Chiudere la finestra lì butterebbe via quello che si stava scrivendo
//    (per esempio il nome di chi paga).

const aperte = [];

function suEsc(e) {
  if (e.key !== "Escape" || e.defaultPrevented || aperte.length === 0) return;
  const dove = e.target;
  if (dove instanceof Element && dove.closest("input, textarea, select, [contenteditable='true']")) return;
  aperte[aperte.length - 1].current?.();
}

/** Finché `aperta` è vero, Esc chiama `chiudi` (se è la finestra in cima). */
export function useChiudiConEsc(aperta, chiudi) {
  const ultima = useRef(chiudi);
  ultima.current = chiudi;
  useEffect(() => {
    if (!aperta) return undefined;
    if (aperte.length === 0) document.addEventListener("keydown", suEsc);
    aperte.push(ultima);
    return () => {
      const i = aperte.lastIndexOf(ultima);
      if (i >= 0) aperte.splice(i, 1);
      if (aperte.length === 0) document.removeEventListener("keydown", suEsc);
    };
  }, [aperta]);
}
