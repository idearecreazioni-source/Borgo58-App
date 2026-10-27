import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { creaBozzaManuale, importaRicettaDaLink, listBozzeRicetta } from "../../lib/api/bozzeRicetta";
import { ORIGINI_BOZZA, STATI_BOZZA, TIPI_BOZZA, nuovoGesto, statoLeggibile } from "../../lib/calcoli/bozzeRicetta";
import { filtraBozze, tagUsati } from "../../lib/calcoli/archivioRicette";
import { RECIPE_CATEGORIES, labelFor } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";

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
  // I filtri dell'archivio (25/10/2026): si filtra qui, le bozze sono decine.
  const [filtri, setFiltri] = useState({ testo: "", categoria: "", tipo: "", stato: "", tag: "" });
  const filtra = (campo) => (e) => setFiltri((f) => ({ ...f, [campo]: e.target.value }));
  const tuttiITag = useMemo(() => tagUsati(bozze ?? []), [bozze]);
  const mostrate = useMemo(() => filtraBozze(bozze ?? [], filtri), [bozze, filtri]);
  const filtroAttivo = Object.values(filtri).some(Boolean);

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
      const { bozzaId, avviso } = await importaRicettaDaLink(link.trim(), gestoLink);
      navigate(`/ricettario/bozze/${bozzaId}`, { state: { avvisoAssistente: avviso } });
    } catch (err) {
      setErroreLink(err.message);
      setImportando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl testo-sala-grande">
      <Link to="/ricettario" className="tocco-bottone inline-flex items-center testo-sala-grande text-stone-600">
        ← Ricettario
      </Link>
      <h1 className="mb-6 mt-2 font-display text-2xl text-b58-charcoal">
        Bozze
        <Didascalia>
          Una bozza non è ancora nel Ricettario: ci entra solo quando la confermi.
        </Didascalia>
      </h1>

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
          className="tocco-bottone rounded bg-b58-azione px-5 text-b58-sul-colore disabled:opacity-50"
        >
          {importando ? "Sto leggendo la ricetta e la sistemo…" : "Importa"}
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
          className="tocco-bottone rounded bg-b58-azione px-5 text-b58-sul-colore disabled:opacity-50"
        >
          {creando ? "Sto creando…" : "Crea la bozza"}
        </button>
      </form>

      {errore && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{errore}</p>}

      {bozze === null && !errore && <p>Caricamento…</p>}
      {bozze === null && errore && (
        <DatoNonLetto cosa="le bozze" nonVuolDire="che non ce ne siano" onRiprova={carica} />
      )}

      {bozze !== null && bozze.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap [&>select]:w-full sm:[&>select]:w-auto">
          <input
            value={filtri.testo}
            onChange={filtra("testo")}
            placeholder="Cerca per titolo…"
            aria-label="Cerca per titolo"
            className="tocco-riga rounded border border-stone-300 px-3 sm:min-w-[200px] sm:flex-1"
          />
          <select value={filtri.categoria} onChange={filtra("categoria")} aria-label="Categoria" className="tocco-riga rounded border border-stone-300 px-3">
            <option value="">Tutte le categorie</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select value={filtri.tipo} onChange={filtra("tipo")} aria-label="Tipo" className="tocco-riga rounded border border-stone-300 px-3">
            <option value="">Tutti i tipi</option>
            {TIPI_BOZZA.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select value={filtri.stato} onChange={filtra("stato")} aria-label="Stato" className="tocco-riga rounded border border-stone-300 px-3">
            <option value="">Tutti gli stati</option>
            {STATI_BOZZA.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
            <option value="diventata">Diventata ricetta</option>
          </select>
          {(tuttiITag.length > 0 || filtri.tag) && (
            <select value={filtri.tag} onChange={filtra("tag")} aria-label="Tag" className="tocco-riga rounded border border-stone-300 px-3">
              <option value="">Tutti i tag</option>
              {tuttiITag.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {bozze !== null &&
        (mostrate.length === 0 ? (
          <p className="text-stone-600">{filtroAttivo && bozze.length > 0 ? "Nessuna bozza corrisponde ai filtri." : "Nessuna bozza."}</p>
        ) : (
          <ul>
            {mostrate.map((b) => (
              <li key={b.id} className="border-b border-stone-200 last:border-0">
                <Link
                  to={`/ricettario/bozze/${b.id}`}
                  className="tocco-riga flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2"
                >
                  <span className="font-medium">{b.titolo}</span>
                  <span className="text-stone-600">
                    — {statoLeggibile(b)} · {labelFor(ORIGINI_BOZZA, b.origine_tipo)}
                  </span>
                  {(b.tags ?? []).map((t) => (
                    <span key={t} className="testo-sala text-stone-500">#{t}</span>
                  ))}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
