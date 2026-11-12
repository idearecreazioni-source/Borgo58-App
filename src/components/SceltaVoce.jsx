import { useEffect, useId, useRef, useState } from "react";
import { formatEUR } from "../lib/constants";
import { useVociDelPiano } from "./useVociDelPiano";
import { meseDellaRata, nomeGruppo } from "../lib/calcoli/pianoInvestimento";

// LA VOCE DEL PIANO, SCELTA QUANDO SI SPUNTA «INVESTIMENTO» (parte 6 del
// piano, 07/11/2026 — richiesta C di Alessio).
//
// 🔴 NESSUNA VOCE INDOVINATA: la lista parte vuota («Scegli…»), e senza
//    scelta la spunta non si salva. Lo pretende anche il database.
// ⚠️ Se le voci non si leggono, lo dice e non offre una lista vuota che si
//    leggerebbe «il piano non ha voci».

// La lettura delle voci (con la memoria di mezzo minuto) sta in
// useVociDelPiano.js: la usa anche «Dividi su più voci» (12/11/2026).

const campo =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

/**
 * La scelta della voce (e, se si vuole, della rata).
 * @param valore   {voceId, rataId}
 * @param onCambia (valore) => void
 */
export function ScegliVoce({ valore, onCambia, disabilitata = false }) {
  const id = useId();
  const { piano, errore } = useVociDelPiano();

  if (errore) {
    return (
      <p role="alert" className="testo-sala text-b58-terracotta-dark-testo">
        Non ho letto le voci del piano ({errore}): non vuol dire che non ce ne sono. Riprova più tardi.
      </p>
    );
  }
  if (!piano) return <p role="status" className="testo-sala text-b58-charcoal-soft">Leggo le voci del piano…</p>;
  if (piano.voci.length === 0) {
    return (
      <p className="testo-sala text-b58-terracotta-dark-testo">
        Il piano dell'investimento non ha ancora voci: aggiungine una in Cassa → Costo del progetto → Piano, poi segna la spesa.
      </p>
    );
  }
  const rate = piano.rate.filter((r) => r.voce_id === valore?.voceId);
  return (
    <div data-prova="scegli-voce" className="grid gap-2 sm:grid-cols-2">
      <div>
        <label className="block testo-sala text-b58-charcoal-soft mb-1" htmlFor={`${id}-voce`}>Voce del piano</label>
        <select
          id={`${id}-voce`}
          className={campo}
          disabled={disabilitata}
          value={valore?.voceId ?? ""}
          onChange={(e) => onCambia({ voceId: e.target.value, rataId: "" })}
        >
          <option value="">Scegli…</option>
          {[...new Set(piano.voci.map((v) => v.gruppo))].map((g) => (
            <optgroup key={g} label={`${g}. ${nomeGruppo(g)}`}>
              {piano.voci.filter((v) => v.gruppo === g).map((v) => (
                <option key={v.id} value={v.id}>{v.descrizione}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {rate.length > 0 && piano.meseApertura && (
        <div>
          <label className="block testo-sala text-b58-charcoal-soft mb-1" htmlFor={`${id}-rata`}>Quale rata paga</label>
          <select
            id={`${id}-rata`}
            className={campo}
            disabled={disabilitata}
            value={valore?.rataId ?? ""}
            onChange={(e) => onCambia({ ...valore, rataId: e.target.value })}
          >
            <option value="">Nessuna in particolare</option>
            {rate.map((r) => (
              <option key={r.id} value={r.id}>{meseDellaRata(piano.meseApertura, r.mese_rel).etichetta} · {formatEUR(r.importo)}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * La spunta «investimento» di una riga già salvata: spuntando chiede la
 * voce, e salva solo con «Segna»; togliendo, toglie anche i collegamenti.
 * @param onSegna (voce) => Promise
 * @param onTogli () => Promise
 */
export function SpuntaConVoce({ segnata, occupata = false, etichetta, children, onSegna, onTogli, mostraErrore = true }) {
  const [scegliendo, setScegliendo] = useState(false);
  const [voce, setVoce] = useState({ voceId: "", rataId: "" });
  const [errore, setErrore] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const casella = useRef(null);

  // Se la riga risulta segnata mentre si sceglie (riletta da un'altra parte),
  // la scelta si chiude: togliere la spunta deve poi togliere davvero.
  useEffect(() => {
    if (segnata) setScegliendo(false);
  }, [segnata]);

  const chiudi = () => {
    setScegliendo(false);
    setVoce({ voceId: "", rataId: "" });
    // Il fuoco torna sulla casella, non si perde sulla pagina.
    casella.current?.focus();
  };

  // ⚠️ Se il gesto fallisce, la scelta RESTA APERTA con la voce scelta:
  //    si legge il rifiuto e si cambia idea senza ripartire (revisione
  //    ecc:react-reviewer del 07/11).
  async function esegui(fn) {
    setLavoro(true);
    setErrore("");
    try {
      await fn();
      chiudi();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="flex-1 min-w-0">
      <label data-prova="spunta-con-voce" className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft">
        <input
          ref={casella}
          type="checkbox"
          aria-label={etichetta}
          checked={segnata || scegliendo}
          disabled={occupata || lavoro}
          onChange={(e) => {
            setErrore("");
            if (e.target.checked) setScegliendo(true);
            else if (scegliendo) setScegliendo(false);
            else esegui(onTogli);
          }}
        />
        {children}
        <span aria-live="polite">{lavoro ? " — salvo…" : ""}</span>
      </label>
      {scegliendo && (
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Esc chiude la scelta: i controlli dentro restano quelli veri
        <div
          data-prova="spunta-scelta"
          className="mt-2 space-y-2"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !lavoro) chiudi();
          }}
        >
          <ScegliVoce valore={voce} onCambia={setVoce} disabilitata={lavoro} />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-white hover:opacity-90 disabled:opacity-50"
              disabled={lavoro || !voce.voceId}
              onClick={() => esegui(() => onSegna(voce))}
            >
              Segna investimento
            </button>
            <button
              type="button"
              className="tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50"
              disabled={lavoro}
              onClick={chiudi}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
      {errore && mostraErrore && <p role="alert" className="testo-sala text-b58-terracotta-dark-testo mt-1">{errore}</p>}
    </div>
  );
}
