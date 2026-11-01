import { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { riassunto } from "../lib/calcoli/codaCasa";
import { useCoda } from "../lib/casa/useCoda";
import { ambienteCorrente, paginaDeiClienti } from "../lib/ambiente";

// LA FASCIA DI CASA — variante C, scelta da Alessio il 31/10/2026.
//
// Casa e' la copia personale del gestionale sul suo PC: stesse schermate del
// locale, dati suoi. Il pallino di SegnaleDatabase basta a chi lo cerca; qui
// serve di piu', perche' le due app sull'iPhone si aprono una accanto
// all'altra e devono distinguersi PRIMA di leggere: una fascia oliva in cima
// a ogni pagina, sempre, con il nome.
//
// ⚠️ Compare SOLO su Casa (ambiente «casa», che vale solo se la costruzione
// lo dichiara e l'indirizzo non e' del cloud): sul locale e su Prova non
// esiste, e non toglie spazio a nessuno.
//
// ⚠️ La sua altezza sta in `--fascia-casa` (index.css), e il telaio di
// `#root` la toglie a chi chiede tutto lo schermo: la fascia e' fissa e
// non copre niente. L'attributo `data-casa` su <html> accende quella misura.
export default function FasciaCasa() {
  const casa = ambienteCorrente().genere === "casa";
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const visibile = casa && !paginaDeiClienti(pathname);

  useLayoutEffect(() => {
    const radice = document.documentElement;
    if (visibile) radice.setAttribute("data-casa", "");
    else radice.removeAttribute("data-casa");
    return () => radice.removeAttribute("data-casa");
  }, [visibile]);

  if (!visibile) return null;
  return (
    <div
      role="note"
      aria-label="Casa, il tuo gestionale personale"
      className="print:hidden fixed left-0 right-0 z-50 flex items-center justify-between px-3 bg-b58-olive text-b58-parchment uppercase font-semibold tracking-[0.06em] text-[10px] leading-none"
      style={{ top: "var(--sicuro-alto)", height: "var(--fascia-casa)" }}
    >
      <span>Casa · gestionale personale</span>
      {isAuthenticated && <SpiaDellaCoda />}
    </div>
  );
}

// 🔴 LA SPIA DELLA CODA, SEMPRE IN VISTA (variante C): quante foto aspettano
// di arrivare a Casa. Un tocco porta alla coda, dove si scatta.
function SpiaDellaCoda() {
  const { voci } = useCoda(true);
  const { inCoda, conErrore } = riassunto(voci);
  return (
    <Link
      to="/casa/coda"
      className="flex items-center h-full px-2 -mr-2 normal-case tracking-normal text-[11px] underline-offset-2 hover:underline"
      aria-label={inCoda ? `${inCoda} scontrini in coda` : "Fotografa uno scontrino"}
    >
      {inCoda ? `📷 ${inCoda} in coda${conErrore ? " ⚠" : ""}` : "📷 Scontrini"}
    </Link>
  );
}
