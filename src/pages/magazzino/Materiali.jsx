import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listIngredients } from "../../lib/api/ingredients";
import { formatEUR } from "../../lib/constants";

// I MATERIALI DI CONSUMO — 29/08/2026, punto 2a del mandato.
//
// Decisione di Alessio, scelta esplicitamente fra due: **una sezione
// separata**, e non un filtro dentro gli Ingredienti. Misurato prima di
// costruirla: sono **4 su 133**, e stavano in mezzo al baccalà portandosi
// dietro allergeni, stagionalità e temperatura di consegna — su un rotolo
// di carta forno non vogliono dire niente.
//
// ⚠️ **NON È UN SECONDO MAGAZZINO**, ed è la riga che tiene insieme tutto
// il resto: carta forno, detersivi e guanti hanno comunque prezzo,
// fornitore, giacenza, entrano nella lista della spesa e sono costi che
// finiscono nella proiezione fiscale. Quello che gli si toglie è il
// **vestito da ingrediente**, non il posto in magazzino. Per questo la
// scheda è la stessa — più corta — e non una scheda nuova: due schede per
// la stessa merce divergerebbero al primo campo aggiunto.
//
// ⚠️ E stanno in MAGAZZINO e non nel Ricettario, perché la domanda a cui
// rispondono è «cosa ho in casa». Nel Ricettario non ci finiscono più:
// dal 29/08 un non alimentare non può nemmeno entrare in una ricetta, e
// il divieto è nel database.
export default function Materiali() {
  const [righe, setRighe] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [conMessiDaParte, setConMessiDaParte] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCaricamento(true);
    listIngredients({
      search: search || undefined,
      includiNonAttivi: conMessiDaParte,
      alimentare: false,
    })
      .then(setRighe)
      .catch((e) => setError(e.message))
      .finally(() => setCaricamento(false));
  }, [search, conMessiDaParte]);

  const ordinate = useMemo(
    () => [...righe].sort((a, b) => a.name.localeCompare(b.name)),
    [righe]
  );

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link
            to="/magazzino"
            className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
          >
            ← Magazzino
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">
            Materiali di consumo
          </h1>
          <p className="testo-sala text-b58-charcoal-soft mt-1">
            Carta, detersivi, imballaggi: si comprano e si contano come tutto il
            resto, ma non entrano in nessuna ricetta.
          </p>
        </div>
        <Link
          to="/ricettario/ingredienti/nuovo?materiale=1"
          className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 testo-sala-grande"
        >
          + Nuovo materiale
        </Link>
      </div>

      {/* ⚠️ `min-w-0` e `max-w-full` sui campi: senza, la casella prende la
          larghezza del suo testo e a 375 punti la riga sborda. */}
      <div className="flex flex-wrap gap-3 mb-4 [&>*]:min-w-0 [&>*]:max-w-full">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome…"
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta flex-1 min-w-[200px]"
        />
        <label className="tocco-bottone inline-flex items-center gap-2 testo-sala-grande text-b58-charcoal-soft">
          <input
            type="checkbox"
            checked={conMessiDaParte}
            onChange={(e) => setConMessiDaParte(e.target.checked)}
            className="w-4 h-4 accent-b58-terracotta"
          />
          Mostra anche quelli messi da parte
        </label>
      </div>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {caricamento ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : ordinate.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search
              ? "Nessun materiale corrisponde alla ricerca."
              : "Nessun materiale di consumo. Aggiungi il primo."}
          </p>
        </div>
      ) : (
        // ⚠️ BLOCCHETTI, non una tabella: le colonne che servono qui sono
        // tre, e su un telefono tre colonne di numeri vanno a capo comunque.
        // È la forma del 18/08, applicata dove nasce invece che dopo.
        <ul className="space-y-3">
          {ordinate.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => navigate(`/ricettario/ingredienti/${m.id}`)}
                className="w-full text-left rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-b58-charcoal font-medium testo-sala-grande">
                    {m.name}
                  </span>
                  {m.active === false && (
                    <span className="testo-sala font-normal text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-2.5 py-1 shrink-0">
                      messo da parte
                    </span>
                  )}
                </div>
                <p className="testo-sala-grande">
                  <span className="text-b58-charcoal-soft">Prezzo: </span>
                  {m.current_price > 0 ? (
                    <span className="text-b58-charcoal font-medium">
                      {formatEUR(m.current_price)} / {m.unit}
                    </span>
                  ) : (
                    // ⚠️ Vuoto non è zero: zero vorrebbe dire «gratis».
                    <span className="text-b58-charcoal-soft/70 italic">non ancora comprato</span>
                  )}
                </p>
                <p className="testo-sala-grande">
                  <span className="text-b58-charcoal-soft">Scorta minima: </span>
                  {m.stock_minimum_threshold ? (
                    <span className="text-b58-charcoal">
                      {m.stock_minimum_threshold} {m.unit}
                    </span>
                  ) : (
                    <span className="text-b58-charcoal-soft/70 italic">
                      nessuna — non entra in lista da solo
                    </span>
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
