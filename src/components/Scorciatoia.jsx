import { Link, useLocation } from "react-router-dom";

// =====================================================================
// LE SCORCIATOIE — 21/09/2026, mandato «interfaccia operativa desktop/mobile»
// =====================================================================
// 🔴 COS'E' UNA SCORCIATOIA, qui: uno dei pulsantini in fila che portano da
// una schermata a una sua vicina — «Bar · Cucina · Scontrini» nelle Comande,
// le nove sezioni della Cassa. Non sono i gesti che fanno qualcosa (quelli
// hanno il loro stampo, `tocco-azione`): sono le porte.
//
// 🔴 PERCHE' UN COMPONENTE E NON UNA CLASSE COPIATA. Erano copiate, ed erano
// gia' divergenti — misurato il 21/09 sui quattro file che ne hanno:
//
//   Cassa (9 voci)        tocco-bottone inline-flex items-center … px-4
//   Comande · Bar (2)     tocco-bottone inline-flex items-center … px-4
//   Comande · Cucina (2)  tocco-bottone inline-flex items-center … px-4
//   Comande · Sala (3)    tocco-campo … px-3 py-2      ← diversa
//
// ⚠️ La riga diversa e' proprio quella della schermata del SERVIZIO, ed e'
// diversa in tre modi insieme: `tocco-campo` invece di `tocco-bottone`
// (quella classe e' per i campi in cui si scrive, e non porta la larghezza
// minima del dito), margini piu' stretti, e nessun allineamento — quindi le
// tre porte delle Comande erano piu' piccole delle sei porte identiche
// altrove. Nessuno l'avrebbe visto rileggendo: ogni riga, da sola, e'
// plausibile.
//
// ⚠️ E LA STESSA FAMIGLIA HA GIA' MORSO QUI: il 22/08 il pulsante del menu e
// le voci della barra laterale erano sotto soglia da sempre, e non erano
// comparsi in nessun censimento perche' *non stavano in nessuna schermata ed
// erano in tutte*. Una fila di porte copiata in quattro file e' lo stesso
// difetto un passo piu' in la': sta in quattro schermate, e in nessun elenco.
//
// 🔴 COSA AGGIUNGE, oltre a unificare: **dice dove sei**. Una porta che punta
// alla schermata aperta porta `aria-current="page"`, quindi chi legge con la
// voce sente «pagina corrente» invece di sentire nove voci indistinguibili;
// e un interruttore porta `aria-pressed`, che prima non aveva nessuno.
//
// ⚠️ NON CAMBIA NE' L'AZIONE NE' IL PERMESSO: `to`, `onClick` e le condizioni
// di chi lo mostra restano dei chiamanti. Qui dentro c'e' solo la forma.

/** Lo stampo comune: il bersaglio del dito, l'allineamento, i margini. */
const STAMPO =
  "tocco-bottone inline-flex items-center justify-center rounded-lg transition-colors testo-sala font-medium px-4";

const NORMALE = "border border-b58-charcoal/15 text-b58-charcoal hover:bg-b58-cream-dark";
const PRINCIPALE = "bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment";
const ACCESO = "bg-b58-terracotta text-b58-parchment border border-b58-terracotta";

function classeScorciatoia({ principale = false, acceso = false } = {}) {
  if (acceso) return `${STAMPO} ${ACCESO}`;
  return `${STAMPO} ${principale ? PRINCIPALE : NORMALE}`;
}

export default function Scorciatoia({
  to,
  onClick,
  // Il gesto pieno di una fila (la «Prima nota» in Cassa).
  principale = false,
  // Un interruttore: `true`/`false` lo rende premibile e lo dichiara.
  premuto,
  // `tonda` e' la forma degli interruttori dentro un pannello, non delle
  // porte: cambia solo il raggio, non il bersaglio.
  tonda = false,
  disabled = false,
  children,
  ...resto
}) {
  const { pathname, search } = useLocation();
  const acceso = premuto === true;
  const classe = `${classeScorciatoia({ principale, acceso })}${tonda ? " !rounded-full" : ""}`;

  if (to) {
    // ⚠️ Si confronta anche la parte dopo il «?»: «La mia tasca» e «Prima
    //    nota» portano alla stessa pagina con soggetti diversi, e senza la
    //    coda risulterebbero corrente tutte e due.
    const qui = `${pathname}${search}` === to;
    return (
      <Link to={to} className={classe} aria-current={qui ? "page" : undefined} {...resto}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classe}
      aria-pressed={typeof premuto === "boolean" ? premuto : undefined}
      {...resto}
    >
      {children}
    </button>
  );
}
