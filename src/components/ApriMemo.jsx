import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { INDIRIZZO_MEMO, eMemo, statoVersoMemo } from "../lib/calcoli/ritornoMemo";

// =====================================================================
// IL PULSANTE CHE APRE MEMO VOCE DA QUALUNQUE MODULO — 11/09/2026
// =====================================================================
// 🔴 APRE, NON REGISTRA. Il gesto «Premi e parla» resta uno solo, quello
//    della schermata di MEMO: questo pulsante ci porta, e basta. Due
//    microfoni in due posti vorrebbero dire due modi di sapere se sta
//    ascoltando, e il segno bene visibile deciso da Alessio il 24/08 vive
//    in un posto solo.
//    ⚠️ E non potrebbe fare altrimenti senza mentire: il browser apre il
//    microfono solo DENTRO un tocco sulla pagina che lo usa (vedi il
//    commento in `Detta.jsx`, «l'audio si prepara dentro il tocco»). Un
//    pulsante qui che promettesse di accenderlo arriverebbe in MEMO a
//    microfono spento.
//
// ⚠️ STA NELLA TESTATA, non galleggia sopra la schermata. Un pulsante
//    fisso in un angolo copre qualcosa su ogni schermata — e le schermate
//    che hanno già la loro barra in basso (`BarraDelPollice`) lo avrebbero
//    addosso proprio sul gesto principale. La testata sta fuori dal
//    contenuto: non copre niente per costruzione.
//
// ⚠️ SOLO PER IL TITOLARE, come la rotta: MEMO voce è `RequireTitolare`, e
//    un pulsante che lo staff vede e che poi lo respinge è un vicolo cieco.
//
// ⚠️ NON C'È IN MEMO STESSO: lì il pulsante che conta è «Premi e parla», e
//    un secondo «MEMO» accanto sarebbe un gesto che non porta da nessuna
//    parte.
export default function ApriMemo({ className = "" }) {
  const { isTitolare } = useAuth();
  const location = useLocation();
  if (!isTitolare || eMemo(location.pathname)) return null;

  return (
    <Link
      to={INDIRIZZO_MEMO}
      // 🔴 LA PARTENZA VIAGGIA NELLO STATO DELLA CRONOLOGIA, non
      //    nell'indirizzo: così `/detta` resta `/detta`, e un indirizzo
      //    copiato o aperto dalla Scorciatoia non si porta dietro un
      //    «torna a» che non c'entra.
      state={statoVersoMemo(location)}
      aria-label="Apri MEMO voce"
      className={`tocco-bottone inline-flex items-center gap-1 rounded-lg px-2 text-b58-charcoal hover:bg-b58-cream-dark ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      <span className="testo-sala font-medium">MEMO</span>
    </Link>
  );
}
