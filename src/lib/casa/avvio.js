// Quello che parte all'avvio, solo su Casa (lo carica main.jsx a parte).
import { accendiLInvioAutomatico } from "./invio";
import { registraIlServiceWorkerDiCasa } from "./serviceWorker";

export function avviaCasa() {
  accendiLInvioAutomatico();
  registraIlServiceWorkerDiCasa();
}
