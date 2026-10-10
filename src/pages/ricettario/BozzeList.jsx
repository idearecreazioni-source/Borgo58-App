import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { creaBozzaManuale, listBozzeRicetta } from "../../lib/api/bozzeRicetta";
import { ORIGINI_BOZZA, statoLeggibile } from "../../lib/calcoli/bozzeRicetta";
import { labelFor } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";

// LE BOZZE DI RICETTA — l'elenco (Ricettario Fase 1A, 06/10/2026).
//
// ⚠️ NON È NEL MENU, apposta: la migrazione delle bozze (20261006000001) non
//    è applicata da nessuna parte e la conferma passa da un corridoio non
//    ancora reinstallato. Mostrarla a chi usa il gestionale vorrebbe dire
//    offrire una schermata rotta. Si raggiunge solo dall'indirizzo
//    /ricettario/bozze, ed entra nel menu quando sarà installata davvero.
//
// L'unico modo di aprire una bozza da qui è scriverla a mano, vuota: le
// «bocche» che leggono link, foto, testo e voce sono un lavoro a sé.
export default function BozzeList() {
  const navigate = useNavigate();
  const [bozze, setBozze] = useState(null);
  const [errore, setErrore] = useState("");
  const [titolo, setTitolo] = useState("");
  const [creando, setCreando] = useState(false);

  const carica = useCallback(async () => {
    setErrore("");
    try {
      setBozze(await listBozzeRicetta());
    } catch (e) {
      setBozze(null);
      setErrore(e.message);
    }
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const crea = async (e) => {
    e.preventDefault();
    if (!titolo.trim() || creando) return;
    setCreando(true);
    setErrore("");
    try {
      const id = await creaBozzaManuale(titolo.trim());
      navigate(`/ricettario/bozze/${id}`);
    } catch (err) {
      setErrore(err.message);
      setCreando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
      <Link to="/ricettario" className="tocco-bottone inline-flex items-center testo-sala-grande text-stone-600">
        ← Ricettario
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Bozze di ricetta</h1>
      <p className="mb-6 text-stone-600">
        Una bozza non è ancora nel Ricettario: ci entra solo quando la confermi.
      </p>

      <form onSubmit={crea} className="mb-6 flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="text-stone-600">Nuova bozza vuota</span>
          <input
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Titolo, anche provvisorio"
            className="tocco-riga rounded border border-stone-300 px-3"
          />
        </label>
        <button
          type="submit"
          disabled={!titolo.trim() || creando}
          className="tocco-bottone rounded bg-b58-terracotta px-5 text-b58-parchment disabled:opacity-50"
        >
          {creando ? "Sto creando…" : "Crea la bozza"}
        </button>
      </form>

      {errore && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{errore}</p>}

      {bozze === null && !errore && <p>Caricamento…</p>}
      {bozze === null && errore && (
        <DatoNonLetto cosa="le bozze" nonVuolDire="che non ce ne siano" onRiprova={carica} />
      )}

      {bozze !== null &&
        (bozze.length === 0 ? (
          <p className="text-stone-600">Nessuna bozza.</p>
        ) : (
          <ul>
            {bozze.map((b) => (
              <li key={b.id} className="border-b border-stone-200 last:border-0">
                <Link
                  to={`/ricettario/bozze/${b.id}`}
                  className="tocco-riga flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2"
                >
                  <span className="font-medium">{b.titolo}</span>
                  <span className="text-stone-600">
                    — {statoLeggibile(b)} · {labelFor(ORIGINI_BOZZA, b.origine_tipo)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
