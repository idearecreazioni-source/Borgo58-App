import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { creaSegnalazione } from "../lib/api/segnalazioni";
import { rigaSegnalazione, testoAbbastanza } from "../lib/calcoli/segnalazioni";
import { unaVoltaSola } from "../lib/calcoli/voce";

// =====================================================================
// «SEGNALA» — IL QUADERNO DEI DIFETTI DA QUALUNQUE SCHERMATA (25/10/2026)
// =====================================================================
// Alessio trova una cosa che non va mentre lavora: la scrive qui, e la sera
// Claude la legge e prepara la correzione. Tappa 1 del piano «MEMO che
// controlla».
//
// 🔴 IL MOMENTO SI FOTOGRAFA QUANDO SI APRE, non quando si invia: dopo, a
//    schermo c'è anche questo riquadro, e la segnalazione racconterebbe la
//    propria casella invece del difetto.
//
// ⚠️ SOLO PER IL TITOLARE (decisione di Alessio del 25/10: lo staff non
//    segnala). Come `ApriMemo`, un pulsante che lo staff vede e che poi lo
//    respinge sarebbe un vicolo cieco; la barriera vera è la RLS.
//
// ⚠️ IL RIQUADRO SCENDE SOTTO LA TESTATA e non copre la schermata: chi
//    segnala sta guardando il difetto, e coprirlo gli toglierebbe proprio
//    la cosa che vuole descrivere.

export function PulsanteSegnala({ aperto, onApri, className = "" }) {
  const { isTitolare } = useAuth();
  if (!isTitolare) return null;
  return (
    <button
      type="button"
      onClick={onApri}
      aria-expanded={aperto}
      aria-label="Segnala un difetto"
      className={`tocco-bottone inline-flex items-center gap-1 rounded-lg px-2 text-b58-charcoal hover:bg-b58-cream-dark ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </svg>
      <span className="testo-sala font-medium">Segnala</span>
    </button>
  );
}

export function RiquadroSegnala({ momento, onChiudi }) {
  const [testo, setTesto] = useState("");
  const [stato, setStato] = useState("scrivo"); // scrivo · invio · inviata
  const [errore, setErrore] = useState(null);
  const guardia = useRef(unaVoltaSola());

  async function invia() {
    if (!testoAbbastanza(testo)) return;
    // La guardia è sincrona: un secondo tocco prima del render non parte
    // nemmeno (CLAUDE.md §8, il pulsante spento che si spegne al render dopo).
    if (!guardia.current.prendi("invia")) return;
    setStato("invio");
    setErrore(null);
    try {
      await creaSegnalazione(rigaSegnalazione(testo, momento));
      setStato("inviata");
    } catch (e) {
      setErrore(e?.message ?? "La segnalazione non è stata salvata.");
      setStato("scrivo");
    } finally {
      guardia.current.lascia("invia");
    }
  }

  if (stato === "inviata") {
    return (
      <div className="rounded-xl border border-b58-olive/40 bg-white p-4 flex flex-col gap-3">
        <p className="text-b58-charcoal">Segnalata. Stasera la leggo e preparo la correzione.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onChiudi} className="tocco-bottone rounded-lg bg-b58-olive px-4 text-white font-medium">
            Chiudi
          </button>
          <Link to="/segnalazioni" onClick={onChiudi} className="tocco-bottone inline-flex items-center rounded-lg px-4 text-b58-olive-dark underline">
            Le tue segnalazioni
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-b58-charcoal/15 bg-white p-4 flex flex-col gap-3">
      <label htmlFor="segnala-testo" className="font-medium text-b58-charcoal">
        Cosa non va?
      </label>
      <textarea
        id="segnala-testo"
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={3}
        maxLength={4000}
        autoFocus
        className="w-full rounded-lg border border-b58-charcoal/20 px-3 py-2 text-b58-charcoal"
        style={{ fontSize: "max(16px, 1em)" }}
      />
      <p className="testo-sala text-b58-charcoal-soft">
        Salvo anche questa schermata: {momento?.titolo || momento?.indirizzo}.
      </p>
      {errore && <p className="testo-sala text-b58-turno-dark">{errore}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={invia}
          disabled={!testoAbbastanza(testo) || stato === "invio"}
          className="tocco-bottone rounded-lg bg-b58-olive px-4 text-white font-medium disabled:opacity-50"
        >
          {stato === "invio" ? "Salvo la segnalazione…" : "Segnala"}
        </button>
        <button type="button" onClick={onChiudi} className="tocco-bottone rounded-lg px-4 text-b58-charcoal hover:bg-b58-cream-dark">
          Annulla
        </button>
      </div>
    </div>
  );
}
