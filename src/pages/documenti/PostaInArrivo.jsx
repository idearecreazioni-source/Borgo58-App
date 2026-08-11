import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  archiviaPosta,
  getAllegatoUrl,
  listPostaInAttesa,
  scartaPosta,
} from "../../lib/api/posta";
import { formatDate } from "../../lib/constants";

// La posta arrivata al locale, in attesa di una decisione.
//
// La schermata è costruita attorno a una sola frase: *il sistema propone,
// Alessio conferma*. Quindi i campi della proposta sono già compilati ma
// **modificabili**, e il pulsante si chiama Conferma, non Salva: quello
// che si conferma è la lettura fatta da qualcun altro, e ci si aspetta di
// doverla correggere ogni tanto.

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";
const campo =
  "w-full min-w-0 rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const etichetta = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1";

function datiIniziali(m) {
  return {
    title: m.proposta_titolo || m.oggetto || "",
    docType: m.proposta_tipo || "",
    documentDate: m.proposta_data || "",
    counterparties: m.proposta_controparte || "",
    amount: m.proposta_importo ?? "",
    expiryDate: m.proposta_scadenza || "",
    note: "",
  };
}

export default function PostaInArrivo() {
  const [posta, setPosta] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);

  const ricarica = () =>
    listPostaInAttesa().then((righe) => {
      setPosta(righe);
      setForm(Object.fromEntries(righe.map((m) => [m.id, datiIniziali(m)])));
    });

  useEffect(() => {
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cambia = (id, chiave, valore) =>
    setForm((f) => ({ ...f, [id]: { ...f[id], [chiave]: valore } }));

  const conferma = async (m) => {
    const dati = form[m.id];
    if (!dati?.title?.trim()) {
      setError("Serve almeno un titolo per archiviare.");
      return;
    }
    setError("");
    setInCorso(m.id);
    try {
      await archiviaPosta({ postaId: m.id, ...dati });
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(null);
    }
  };

  const scarta = async (m) => {
    setInCorso(m.id);
    try {
      await scartaPosta(m.id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(null);
    }
  };

  const apri = async (allegato) => {
    try {
      window.open(await getAllegatoUrl(allegato.storage_path), "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/documenti" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Archivio Documenti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">Posta in arrivo</h1>
      <p className="text-sm text-b58-charcoal-soft mb-6">
        Quello che arriva alle caselle del locale. Il gestionale legge e propone,{" "}
        <strong>archivi tu</strong>: niente entra nell&apos;Archivio senza il tuo sì.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {posta.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna posta in attesa.</p>
        </div>
      ) : (
        posta.map((m) => {
          const dati = form[m.id] ?? datiIniziali(m);
          const daLeggere = m.stato === "da_leggere";
          return (
            <div key={m.id} className={sezione}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                <span className="text-b58-charcoal font-medium">{m.oggetto || "(senza oggetto)"}</span>
                <span className="text-sm text-b58-charcoal-soft">da {m.mittente || "?"}</span>
                <span className="text-sm text-b58-charcoal-soft">{formatDate(m.ricevuta_il)}</span>
              </div>

              {daLeggere ? (
                <p className="text-sm text-b58-charcoal-soft mb-3">
                  Non ancora letta — la lettura parte da sola entro un quarto d&apos;ora.
                </p>
              ) : (
                <p className="text-sm mb-3">
                  <span
                    className={`inline-flex items-center rounded-full text-b58-parchment text-[11px] font-medium px-2.5 py-1 mr-2 ${
                      m.proposta_conservare ? "bg-b58-olive" : "bg-b58-charcoal-soft/60"
                    }`}
                  >
                    {m.proposta_conservare ? "da conservare" : "probabilmente no"}
                  </span>
                  <span className="text-b58-charcoal-soft">{m.proposta_motivo}</span>
                </p>
              )}

              {m.lettura_note && (
                <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
                  Ho letto questa mail solo in parte: {m.lettura_note}. Apri l&apos;allegato e
                  controlla i dati a mano.
                </p>
              )}

              {m.allegati?.length > 0 && (
                <p className="text-sm text-b58-charcoal-soft mb-3">
                  Allegati:{" "}
                  {m.allegati.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ", "}
                      {a.storage_path ? (
                        <button
                          type="button"
                          onClick={() => apri(a)}
                          className="text-b58-terracotta hover:underline"
                        >
                          {a.file_name}
                        </button>
                      ) : (
                        <span
                          className="text-b58-terracotta-dark"
                          title={a.errore || "Non è stato possibile salvarlo"}
                        >
                          {a.file_name} — non salvato
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 min-w-0">
                  <label className={etichetta}>Titolo</label>
                  <input
                    value={dati.title}
                    onChange={(e) => cambia(m.id, "title", e.target.value)}
                    className={campo}
                  />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Tipo</label>
                  <input
                    value={dati.docType}
                    onChange={(e) => cambia(m.id, "docType", e.target.value)}
                    className={campo}
                  />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Controparte</label>
                  <input
                    value={dati.counterparties}
                    onChange={(e) => cambia(m.id, "counterparties", e.target.value)}
                    className={campo}
                  />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Data</label>
                  <input
                    type="date"
                    value={dati.documentDate}
                    onChange={(e) => cambia(m.id, "documentDate", e.target.value)}
                    className={campo}
                  />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Importo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dati.amount}
                    onChange={(e) => cambia(m.id, "amount", e.target.value)}
                    className={campo}
                  />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Scadenza</label>
                  <input
                    type="date"
                    value={dati.expiryDate}
                    onChange={(e) => cambia(m.id, "expiryDate", e.target.value)}
                    className={campo}
                  />
                </div>
                <div className="min-w-0 flex items-end text-xs text-b58-charcoal-soft">
                  Con una scadenza nasce anche il promemoria in Agenda.
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  disabled={inCorso === m.id}
                  onClick={() => conferma(m)}
                  className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
                >
                  {inCorso === m.id ? "…" : "Conferma e archivia"}
                </button>
                <button
                  type="button"
                  disabled={inCorso === m.id}
                  onClick={() => scarta(m)}
                  className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-50 transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
                >
                  Non serve
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
