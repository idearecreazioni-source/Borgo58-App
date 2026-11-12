import { useEffect, useId, useRef, useState } from "react";
import { dividiSpesa } from "../lib/api/pianoInvestimento";
import { formatEUR } from "../lib/constants";
import { nomeGruppo } from "../lib/calcoli/pianoInvestimento";
import { barraDivisione, esitoDivisione, righeIniziali, rigaVuota } from "../lib/calcoli/dividiSpesa";
import { useVociDelPiano } from "./useVociDelPiano";

// «DIVIDI SU PIÙ VOCI» (12/11/2026, modello approvato da Alessio l'11/11).
//
// 🔴 UNA SPESA, PIÙ VOCI: la fattura San Cataldo di 7.200 € = 4.500 sul
//    Forno + 2.700 su Sedie e tavoli. Si sceglie «Dove va» e «Quanto», riga
//    per riga; «Salva la divisione» si accende solo quando restano 0,00 €.
// 🔴 SOSTITUISCE TUTTO: la divisione nuova prende il posto di tutti i
//    collegamenti di quella spesa. Per questo il modulo si apre con le
//    parti che ha già.
// ⚠️ Le voci sono quelle della spunta (vociSceglibili): niente madri, la
//    sottovoce si legge «Madre › Sottovoce».
// ⚠️ La rata di una parte che c'era resta finché resta la voce; cambiando
//    voce si perde (non è di quella voce). Qui non si sceglie: si sceglie
//    collegando da dentro la voce.

const campo =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const etichetta = "block testo-sala text-b58-charcoal-soft mb-1";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50";
const bottonePrimario =
  "tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-white hover:opacity-90 disabled:opacity-50";
const COLORI_BARRA = ["bg-b58-azione", "bg-b58-ambra", "bg-b58-olive", "bg-b58-terracotta"];

/**
 * @param spesa     {fonte, id, nome, importo}
 * @param esistenti i collegamenti che la spesa ha già
 * @param blocco    il blocco condiviso della pagina (un gesto alla volta)
 * @param onFatto   (frase) => Promise — dopo il salvataggio: rilegge
 * @param onAnnulla () => void
 */
export default function DividiSpesa({ spesa, esistenti = [], blocco, onFatto, onAnnulla }) {
  const id = useId();
  const { piano, errore: erroreVoci } = useVociDelPiano();
  // Ogni riga ha la sua chiave: togliendone una in mezzo, le altre non si
  // scambiano i campi.
  const prossima = useRef(0);
  const conChiave = (r) => ({ ...r, k: prossima.current++ });
  const [righe, setRighe] = useState(() => righeIniziali(spesa.importo, esistenti).map(conChiave));
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const proprio = useRef(false);
  const occupato = blocco ?? proprio;
  const contenitore = useRef(null);
  const daFuocare = useRef(0);
  const avviso = useRef(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // Le voci che si possono scegliere: una parte rimasta su una voce
  // archiviata o divisa in sottovoci si dice qui, non al salvataggio
  // (revisione ecc:react-reviewer del 12/11).
  const sceglibili = piano ? new Set(piano.voci.map((v) => v.id)) : null;
  const conto = esitoDivisione(spesa.importo, righe, spesa.fonte, sceglibili);
  const larghezze = barraDivisione(spesa.importo, conto.parti);

  // Il cursore va alla riga da scrivere: la prima all'apertura, quella nuova
  // dopo «+ Aggiungi un'altra voce». Le voci arrivano dopo: si aspetta.
  useEffect(() => {
    if (!piano || daFuocare.current === null) return;
    document.getElementById(`${id}-voce-${daFuocare.current}`)?.focus();
    daFuocare.current = null;
  }, [piano, righe.length, id]);

  const cambia = (i, cosa) => {
    setErrore("");
    setRighe((rr) => rr.map((r, j) => (j === i ? { ...r, ...cosa } : r)));
  };
  const aggiungi = () => {
    // L'indice si prende dentro il setter: due tocchi veloci non sbagliano riga.
    setRighe((rr) => {
      daFuocare.current = rr.length;
      return [...rr, conChiave(rigaVuota())];
    });
  };
  const togli = (i) => {
    setErrore("");
    setRighe((rr) => rr.filter((_, j) => j !== i));
    daFuocare.current = Math.max(0, i - 1);
  };

  async function salva(e) {
    e.preventDefault();
    if (!conto.pronta || occupato.current) return;
    occupato.current = true;
    setLavoro(true);
    setErrore("");
    try {
      await dividiSpesa({ fonte: spesa.fonte, id: spesa.id, parti: conto.parti });
    } catch (err) {
      setErrore(err.message);
      setLavoro(false);
      occupato.current = false;
      // Il pulsante spento ha perso il cursore: va sul rifiuto, da leggere.
      requestAnimationFrame(() => avviso.current?.focus());
      return;
    }
    occupato.current = false;
    // ⚠️ «lavoro» resta acceso mentre si rilegge: il modulo di solito si
    //    chiude, e nel frattempo non deve tornare premibile. Se resta aperto
    //    (la rilettura non lo ha tolto), torna usabile.
    try {
      await onFatto(
        conto.parti.length === 1
          ? `«${spesa.nome}» messa tutta su una voce.`
          : `«${spesa.nome}» divisa su ${conto.parti.length} voci.`
      );
    } finally {
      if (vivo.current) setLavoro(false);
    }
  }

  const voci = piano?.voci ?? [];
  const gruppi = [...new Set(voci.map((v) => v.gruppo))];

  return (
    <form
      ref={contenitore}
      onSubmit={salva}
      noValidate
      data-prova="dividi-spesa"
      aria-labelledby={`${id}-titolo`}
      onKeyDown={(e) => {
        // Esc che chiude il menu di una scelta non chiude anche il modulo.
        if (e.key === "Escape" && !lavoro && !e.defaultPrevented && e.target.tagName !== "SELECT") onAnnulla();
      }}
      className="mt-2 rounded-lg bg-b58-campo/60 ring-1 ring-b58-charcoal/10 p-3 space-y-3"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 id={`${id}-titolo`} className="font-display text-b58-charcoal min-w-0">
          Dividi su più voci: {spesa.nome}
        </h3>
        <span className="testo-sala text-b58-charcoal">
          <b className="tabular-nums">{formatEUR(spesa.importo)}</b> IVA inclusa
        </span>
      </div>

      {erroreVoci ? (
        <p role="alert" className="testo-sala text-b58-terracotta-dark-testo">
          Non ho letto le voci del piano ({erroreVoci}): non vuol dire che non ce ne sono. Riprova più tardi.
        </p>
      ) : !piano ? (
        <p role="status" className="testo-sala text-b58-charcoal-soft">Leggo le voci del piano…</p>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Le parti della spesa">
            {righe.map((r, i) => (
              <li key={r.k} data-prova="riga-divisione" className="grid gap-2 grid-cols-[1fr_8rem_auto] items-end">
                <div className="min-w-0">
                  <label className={etichetta} htmlFor={`${id}-voce-${i}`}>
                    Dove va<span className="sr-only"> (riga {i + 1})</span>
                  </label>
                  <select
                    id={`${id}-voce-${i}`}
                    className={campo}
                    disabled={lavoro}
                    value={r.voceId}
                    onChange={(e) => cambia(i, { voceId: e.target.value, rataId: "" })}
                  >
                    <option value="">Scegli…</option>
                    {/* Una parte che c'era su una voce che non si sceglie più
                        (archiviata, o divisa in sottovoci): si vede, e si cambia. */}
                    {r.voceId && !voci.some((v) => v.id === r.voceId) && (
                      <option value={r.voceId}>Una voce che non si sceglie più: scegline un'altra</option>
                    )}
                    {gruppi.map((g) => (
                      <optgroup key={g} label={`${g}. ${nomeGruppo(g)}`}>
                        {voci.filter((v) => v.gruppo === g).map((v) => (
                          <option key={v.id} value={v.id}>{v.descrizione}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etichetta} htmlFor={`${id}-euro-${i}`}>
                    Quanto (€)<span className="sr-only"> (riga {i + 1})</span>
                  </label>
                  <input
                    id={`${id}-euro-${i}`}
                    inputMode="decimal"
                    className={campo}
                    disabled={lavoro}
                    value={r.testo}
                    onChange={(e) => cambia(i, { testo: e.target.value })}
                  />
                </div>
                {righe.length > 1 ? (
                  <button type="button" className={bottone} disabled={lavoro} onClick={() => togli(i)}>
                    Togli<span className="sr-only"> la riga {i + 1}</span>
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
          <p>
            <button type="button" className={bottone} disabled={lavoro} onClick={aggiungi}>
              + Aggiungi un'altra voce
            </button>
          </p>

          <div aria-hidden="true" className="flex h-2.5 w-full overflow-hidden rounded-full bg-b58-charcoal/10">
            {larghezze.map((w, i) => (
              <i key={i} className={`block h-full ${COLORI_BARRA[i % COLORI_BARRA.length]}`} style={{ width: `${w}%` }} />
            ))}
          </div>
          <p
            role="status"
            aria-live="polite"
            data-prova="esito-divisione"
            data-esito={conto.esito}
            className={`testo-sala font-medium ${conto.esito === "tutta" ? "text-b58-olive-dark-testo" : "text-b58-terracotta-dark-testo"}`}
          >
            {conto.frase}
          </p>
          {conto.errori.length > 0 && (
            <ul data-prova="errori-divisione" className="testo-sala text-b58-terracotta-dark-testo list-disc pl-5">
              {conto.errori.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
        </>
      )}

      {errore && (
        <p ref={avviso} tabIndex={-1} role="alert" className="testo-sala text-b58-terracotta-dark-testo focus:outline-none">
          Non ho diviso la spesa: {errore}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={bottonePrimario} disabled={lavoro || !conto.pronta}>
          {lavoro ? "Salvo…" : "Salva la divisione"}
        </button>
        <button type="button" className={bottone} disabled={lavoro} onClick={onAnnulla}>
          Annulla
        </button>
      </div>
    </form>
  );
}
