import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  confermaAzione,
  getAllegatoUrl,
  listPostaInAttesa,
  rifiutaAzione,
  scartaPosta,
} from "../../lib/api/posta";
import { formatDate } from "../../lib/constants";

// La posta arrivata al locale, in attesa di una decisione.
//
// Forma decisa da Alessio il 12/08/2026, dopo aver visto la prima
// versione: non una scheda da compilare — «i campi predefiniti non
// possono adeguarsi a qualunque cosa arrivi» — ma **un elenco di cose da
// fare**, ognuna con il suo Conferma o Rifiuta.
//
// I campi restano modificabili prima di confermare: quello che si
// conferma è la lettura fatta da qualcun altro, e ci si aspetta di doverla
// correggere ogni tanto. Quello che parte è ciò che Alessio vede, non ciò
// che l'assistente aveva scritto.

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";
const campo =
  "w-full min-w-0 rounded-lg border border-b58-charcoal/15 bg-white px-2.5 py-1.5 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const etichetta = "block text-[11px] uppercase tracking-wide text-b58-charcoal-soft mb-1";

const NOME_TIPO = {
  archivia_documento: "Archivia l'allegato",
  archivia_testo: "Conserva il testo della mail",
  promemoria: "Metti in Agenda",
  nessuna: "Niente da fare",
};

// Quali campi ha senso mostrare per ciascun tipo di azione. È il punto
// della critica di Alessio: su un promemoria non si chiedono importi.
const CAMPI = {
  archivia_documento: ["titolo", "tipo", "controparte", "data", "importo", "scadenza"],
  archivia_testo: ["titolo", "tipo", "controparte", "data", "importo", "scadenza"],
  promemoria: ["titolo", "data", "note"],
  nessuna: [],
};

const ETICHETTE = {
  titolo: "Titolo",
  tipo: "Tipo",
  controparte: "Controparte",
  data: "Data",
  importo: "Importo",
  scadenza: "Scadenza",
  note: "Note",
};

const TIPO_CAMPO = { data: "date", scadenza: "date", importo: "number" };

export default function PostaInArrivo() {
  const [posta, setPosta] = useState([]);
  const [valori, setValori] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);

  const ricarica = () =>
    listPostaInAttesa().then((righe) => {
      setPosta(righe);
      setValori(
        Object.fromEntries(
          righe.flatMap((m) =>
            (m.azioni ?? []).map((a) => [a.id, { ...(a.parametri ?? {}) }])
          )
        )
      );
    });

  useEffect(() => {
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cambia = (azioneId, chiave, valore) =>
    setValori((v) => ({ ...v, [azioneId]: { ...v[azioneId], [chiave]: valore } }));

  const agisci = async (azioneId, fn) => {
    setError("");
    setInCorso(azioneId);
    try {
      await fn();
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
        Quello che arriva alle caselle del locale. Il gestionale legge e{" "}
        <strong>propone cosa fare</strong>: decidi tu, una cosa alla volta.
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
          const daDecidere = (m.azioni ?? []).filter((a) => a.stato === "proposta");
          return (
            <div key={m.id} className={sezione}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-b58-charcoal font-medium">
                  {m.oggetto || "(senza oggetto)"}
                </span>
                <span className="text-sm text-b58-charcoal-soft">da {m.mittente || "?"}</span>
                <span className="text-sm text-b58-charcoal-soft">{formatDate(m.ricevuta_il)}</span>
              </div>

              {m.proposta_sintesi && (
                <p className="text-sm text-b58-charcoal mt-1 mb-3">{m.proposta_sintesi}</p>
              )}

              {m.stato === "da_leggere" && (
                <p className="text-sm text-b58-charcoal-soft mb-3">
                  Non ancora letta — la lettura parte da sola entro un quarto d&apos;ora.
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

              {daDecidere.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-white/60 ring-1 ring-b58-charcoal/10 p-3 mt-3"
                >
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className="inline-flex items-center rounded-full bg-b58-olive text-b58-parchment text-[11px] font-medium px-2.5 py-1">
                      {NOME_TIPO[a.tipo] ?? a.tipo}
                    </span>
                    <span className="text-b58-charcoal font-medium">{a.titolo}</span>
                  </div>
                  {a.perche && (
                    <p className="text-sm text-b58-charcoal-soft mb-2">{a.perche}</p>
                  )}

                  {CAMPI[a.tipo]?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {CAMPI[a.tipo].map((c) => (
                        <div key={c} className="min-w-0">
                          <label className={etichetta}>{ETICHETTE[c]}</label>
                          <input
                            type={TIPO_CAMPO[c] ?? "text"}
                            step={c === "importo" ? "0.01" : undefined}
                            value={valori[a.id]?.[c] ?? ""}
                            onChange={(e) => cambia(a.id, c, e.target.value)}
                            className={campo}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={inCorso === a.id}
                      onClick={() => agisci(a.id, () => confermaAzione(a.id, valori[a.id]))}
                      className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment font-medium px-3 py-1.5 text-sm"
                    >
                      {inCorso === a.id ? "…" : "Conferma"}
                    </button>
                    <button
                      type="button"
                      disabled={inCorso === a.id}
                      onClick={() => agisci(a.id, () => rifiutaAzione(a.id))}
                      className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-50 transition-colors text-b58-charcoal text-sm px-3 py-1.5"
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}

              {daDecidere.length === 0 && m.stato === "proposta" && (
                <p className="text-sm text-b58-charcoal-soft mt-2">
                  Nessuna azione proposta per questa mail.
                </p>
              )}

              <button
                type="button"
                disabled={inCorso === m.id}
                onClick={() => agisci(m.id, () => scartaPosta(m.id))}
                className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta mt-3"
              >
                Non serve niente di tutto questo — togli la mail
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
