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

// 🔴 L'IMMAGINE DELLA PAGINA (28/10/2026, chiesta da Alessio). La fa il
//    gestionale da solo (`useSegnala` → `scattoPagina.js`), e qui si vede
//    in piccolo, con la via per toglierla. ⚠️ Prima la frase diceva «Salvo
//    anche questa schermata», e Alessio ha capito — giustamente — che si
//    salvasse un'immagine che non c'era: adesso dice che cosa si salva.
function Immagine({ scatto, onTogli }) {
  if (!scatto || scatto.stato === "tolta") {
    return <p className="testo-sala text-b58-charcoal-soft">Senza immagine della pagina.</p>;
  }
  if (scatto.stato === "in_corso") {
    return <p className="testo-sala text-b58-charcoal-soft">Preparo l'immagine della pagina…</p>;
  }
  if (scatto.stato === "fallito") {
    return (
      <p className="testo-sala text-b58-turno-dark-testo">
        Non sono riuscito a fare l'immagine della pagina ({scatto.errore}): la segnalazione parte senza.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <a href={scatto.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={scatto.url}
          alt="Immagine della pagina che si allega"
          className="max-h-40 w-auto rounded-lg ring-1 ring-b58-charcoal/15 object-contain object-top bg-white"
        />
      </a>
      <div className="flex flex-col gap-1">
        <p className="testo-sala text-b58-charcoal-soft">
          Allego questa immagine della pagina{scatto.tagliata ? " (solo la parte in alto: la pagina è lunghissima)" : ""}.
        </p>
        <button type="button" onClick={onTogli} className="tocco-bottone self-start testo-sala text-b58-charcoal-soft underline">
          Togli immagine
        </button>
      </div>
    </div>
  );
}

export function RiquadroSegnala({ momento, scatto, onTogliImmagine, onChiudi }) {
  const [testo, setTesto] = useState("");
  const [stato, setStato] = useState("scrivo"); // scrivo · invio · inviata
  const [errore, setErrore] = useState(null);
  const [senzaImmagine, setSenzaImmagine] = useState(null);
  const guardia = useRef(unaVoltaSola());
  // Una chiave per riquadro: se l'invio si riprova, l'immagine ha lo stesso
  // nome e non se ne carica una seconda copia.
  const chiave = useRef(crypto.randomUUID());
  const inCorso = scatto?.stato === "in_corso";

  async function invia() {
    if (!testoAbbastanza(testo) || inCorso) return;
    // La guardia è sincrona: un secondo tocco prima del render non parte
    // nemmeno (CLAUDE.md §8, il pulsante spento che si spegne al render dopo).
    if (!guardia.current.prendi("invia")) return;
    setStato("invio");
    setErrore(null);
    try {
      const immagine = scatto?.stato === "pronto" ? scatto.blob : null;
      const esito = await creaSegnalazione(rigaSegnalazione(testo, momento), immagine, chiave.current);
      setSenzaImmagine(esito.immagineMancata);
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
      <div className="rounded-xl border border-b58-olive/40 bg-b58-campo p-4 flex flex-col gap-3">
        <p className="text-b58-charcoal">Segnalata. Stasera la leggo e preparo la correzione.</p>
        {senzaImmagine && <p className="testo-sala text-b58-turno-dark-testo">{senzaImmagine}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onChiudi} className="tocco-bottone rounded-lg bg-b58-olive px-4 text-white font-medium">
            Chiudi
          </button>
          <Link to="/segnalazioni" onClick={onChiudi} className="tocco-bottone inline-flex items-center rounded-lg px-4 text-b58-olive-dark-testo underline">
            Le tue segnalazioni
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-b58-charcoal/15 bg-b58-campo p-4 flex flex-col gap-3">
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
        Salvo anche dove sei e il testo di questa schermata: {momento?.titolo || momento?.indirizzo}.
      </p>
      <Immagine scatto={scatto} onTogli={onTogliImmagine} />
      {errore && <p className="testo-sala text-b58-turno-dark-testo">{errore}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={invia}
          disabled={!testoAbbastanza(testo) || stato === "invio" || inCorso}
          className="tocco-bottone rounded-lg bg-b58-olive px-4 text-white font-medium disabled:opacity-50"
        >
          {stato === "invio" ? "Salvo la segnalazione…" : inCorso ? "Preparo l'immagine…" : "Segnala"}
        </button>
        <button type="button" onClick={onChiudi} className="tocco-bottone rounded-lg px-4 text-b58-charcoal hover:bg-b58-cream-dark">
          Annulla
        </button>
      </div>
    </div>
  );
}
