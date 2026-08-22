import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listPreparazioni,
  listProduzioni,
  registraProduzione,
  resePreparazione,
} from "../../lib/api/produzioni";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatEUR } from "../../lib/constants";

// Blocco 2: registrare i semilavorati fatti in cucina.
//
// I DUE numeri sono il cuore della schermata: quante dosi e quanto ne è
// uscito. Con uno solo non si distingue il calo dalla mezza dose — e
// distinguere è tutto il valore di questo modulo.
export default function Produzioni() {
  const { isTitolare } = useAuth();
  const [preparazioni, setPreparazioni] = useState([]);
  const [fatte, setFatte] = useState([]);
  const [scelta, setScelta] = useState("");
  const [rese, setRese] = useState(null);
  const [dosi, setDosi] = useState("1");
  const [quantita, setQuantita] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [note, setNote] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");

  const carica = async () => {
    const [prep, prod] = await Promise.all([
      listPreparazioni(),
      listProduzioni({ titolare: isTitolare }),
    ]);
    setPreparazioni(prep);
    setFatte(prod);
  };

  useEffect(() => {
    carica().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTitolare]);

  // Cambiando preparazione si va a vedere quanto è uscito le altre volte:
  // il numero si PROPONE, non si scrive da solo.
  const scegli = async (recipeId) => {
    setScelta(recipeId);
    setQuantita("");
    setRese(null);
    setNota("");
    if (!recipeId) return;
    try {
      const r = await resePreparazione(recipeId);
      setRese(r);
      const prep = preparazioni.find((p) => p.id === recipeId);
      const perDose = r?.resa_media ?? prep?.yield_quantity ?? null;
      if (perDose) setQuantita(String(Number(perDose) * (Number(dosi) || 1)));
    } catch {
      setRese(null);
    }
  };

  const salva = async () => {
    if (!scelta || !dosi || !quantita) return;
    setSalvando(true);
    setError("");
    setNota("");
    try {
      const r = await registraProduzione({
        recipeId: scelta,
        dosi: Number(dosi),
        quantitaOttenuta: Number(quantita),
        scadenza: scadenza || null,
        note: note || null,
      });
      const mancanti = r?.righe_non_scaricate ?? 0;
      setNota(
        mancanti > 0
          ? `Registrata. Attenzione: per ${mancanti} ${mancanti === 1 ? "ingrediente" : "ingredienti"} non ce n'era abbastanza in cella — è scritto in Magazzino, sotto «cosa non è sceso».`
          : "Registrata: la giacenza è scesa e il semilavorato è in cella."
      );
      setQuantita("");
      setNote("");
      setScadenza("");
      await carica();
      if (scelta) await scegli(scelta);
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const input =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const label = "block testo-sala font-medium text-b58-charcoal-soft mb-1";
  const prep = preparazioni.find((p) => p.id === scelta);

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>
      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal mt-2">Produzioni</h1>
      <p className="text-b58-charcoal-soft mt-1 mb-6">
        Quello che si fa in cucina: soffritti, ragù, basi. Esce dagli ingredienti ed entra in
        cella con un suo costo.
      </p>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {nota && (
        <p className="testo-sala text-b58-charcoal bg-b58-cream-dark rounded-lg px-3 py-2 mb-4">
          {nota}
        </p>
      )}

      {preparazioni.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 mb-6">
          Nessuna preparazione nel Ricettario. Una preparazione è una ricetta che non si serve al
          tavolo ma finisce dentro altri piatti.
        </p>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-8">
          <div className="mb-4">
            <label className={label}>Cosa hai fatto</label>
            <select value={scelta} onChange={(e) => scegli(e.target.value)} className={input}>
              <option value="">—</option>
              {preparazioni.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {scelta && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* I DUE NUMERI. Nessuno dei due si può omettere: il
                    database li pretende entrambi. */}
                <div>
                  <label className={label}>Quante dosi di ricetta</label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={dosi}
                    onChange={(e) => setDosi(e.target.value)}
                    className={input}
                  />
                  <p className="testo-sala text-b58-charcoal-soft mt-1">
                    Una volta = 1, doppia = 2, metà = 0,5.
                  </p>
                </div>
                <div>
                  <label className={label}>
                    Quanto ne è uscito ({prep?.yield_unit ?? "kg"})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantita}
                    onChange={(e) => setQuantita(e.target.value)}
                    className={input}
                  />
                  <p className="testo-sala text-b58-charcoal-soft mt-1">
                    Il peso vero, sulla bilancia. È da qui che si scopre la resa.
                  </p>
                </div>
              </div>

              {/* Il numero proposto e da dove viene: mai scritto da solo
                  senza dire su cosa si basa. */}
              {rese?.produzioni_fatte > 0 && (
                <p className="testo-sala text-b58-charcoal-soft mt-3">
                  Le altre {rese.produzioni_fatte === 1 ? "volta" : `${rese.produzioni_fatte} volte`}{" "}
                  da una dose sono usciti in media{" "}
                  <span className="font-medium">
                    {Number(rese.resa_media)} {prep?.yield_unit ?? "kg"}
                  </span>
                  {rese.resa_in_ricetta != null && (
                    <>
                      , contro i {Number(rese.resa_in_ricetta)} della ricetta
                      {rese.scostamento != null && <> ({Number(rese.scostamento)}%)</>}
                    </>
                  )}
                  .
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={label}>Scade il (facoltativo)</label>
                  <input
                    type="date"
                    value={scadenza}
                    onChange={(e) => setScadenza(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Nota (facoltativa)</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className={input} />
                </div>
              </div>

              <button
                type="button"
                disabled={salvando || !dosi || !quantita}
                onClick={salva}
                className="tocco-bottone mt-4 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment testo-sala font-medium px-4"
              >
                {salvando ? "Registro…" : "Registra la produzione"}
              </button>
            </>
          )}
        </div>
      )}

      <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Fatte di recente</h2>
      {fatte.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60">Nessuna produzione ancora.</p>
      ) : (
        <ul className="space-y-2">
          {fatte.map((p) => (
            <li key={p.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
              <span className="testo-sala font-medium text-b58-charcoal">{p.preparazione}</span>
              <span className="testo-sala text-b58-charcoal-soft ml-2">
                {Number(p.quantita_ottenuta)} {p.unita} da {Number(p.dosi)}{" "}
                {Number(p.dosi) === 1 ? "dose" : "dosi"}
              </span>
              {p.resa_attesa != null && Number(p.resa_attesa) !== Number(p.quantita_ottenuta) && (
                <span className="testo-sala text-b58-charcoal-soft ml-2">
                  (in ricetta {Number(p.resa_attesa)})
                </span>
              )}
              {isTitolare && p.costo != null && (
                <span className="testo-sala text-b58-charcoal-soft ml-2">
                  · costata {formatEUR(Number(p.costo))}
                </span>
              )}
              <span className="testo-sala text-b58-charcoal-soft/70 ml-2">
                {formatDate(p.creato_il)}
              </span>
              {p.note && <div className="testo-sala text-b58-charcoal-soft mt-0.5">{p.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
