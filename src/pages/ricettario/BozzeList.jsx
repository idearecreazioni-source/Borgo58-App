import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { creaBozzaManuale, importaRicettaDaLink, listBozzeRicetta } from "../../lib/api/bozzeRicetta";
import { ORIGINI_BOZZA, nuovoGesto, statoLeggibile } from "../../lib/calcoli/bozzeRicetta";
import { labelFor } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";

// LE BOZZE DI RICETTA — l'elenco (Ricettario Fase 1A, 06/10/2026).
//
// Due modi di aprire una bozza da qui:
//   · da un LINK (10/10/2026): la ricetta si legge dalla pagina e la bozza
//     nasce gia' riempita, coi buchi dichiarati — vedi `importaRicettaDaLink`;
//   · a mano, vuota, scrivendo solo il titolo.
// ⚠️ Il gesto dell'importazione si tiene finche' il link non cambia: un
//    secondo tocco sullo stesso link riceve la stessa bozza, non una copia.
export default function BozzeList() {
  const navigate = useNavigate();
  const [bozze, setBozze] = useState(null);
  const [errore, setErrore] = useState("");
  const [titolo, setTitolo] = useState("");
  const [creando, setCreando] = useState(false);
  const [link, setLink] = useState("");
  const [gestoLink, setGestoLink] = useState(() => nuovoGesto());
  const [importando, setImportando] = useState(false);
  const [erroreLink, setErroreLink] = useState("");

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

  const importa = async (e) => {
    e.preventDefault();
    if (!link.trim() || importando) return;
    setImportando(true);
    setErroreLink("");
    try {
      const id = await importaRicettaDaLink(link.trim(), gestoLink);
      navigate(`/ricettario/bozze/${id}`);
    } catch (err) {
      setErroreLink(err.message);
      setImportando(false);
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

      <form onSubmit={importa} className="mb-2 flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="text-stone-600">Importa da un link (Clove)</span>
          <input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setGestoLink(nuovoGesto());
              setErroreLink("");
            }}
            inputMode="url"
            placeholder="https://clove.kitchen/recipes/…"
            className="tocco-riga rounded border border-stone-300 px-3"
          />
        </label>
        <button
          type="submit"
          disabled={!link.trim() || importando}
          className="tocco-bottone rounded bg-b58-terracotta px-5 text-b58-parchment disabled:opacity-50"
        >
          {importando ? "Sto leggendo la ricetta…" : "Importa"}
        </button>
      </form>
      {erroreLink && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">{erroreLink}</p>}

      <form onSubmit={crea} className="mb-6 mt-4 flex flex-wrap items-end gap-2">
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
