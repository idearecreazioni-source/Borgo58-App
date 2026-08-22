import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addNonConformity, listNonConformities, riapriNonConformita, resolveNonConformity } from "../../lib/api/haccp";
import { NC_CATEGORIES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

const emptyForm = { category: "temperatura", description: "", note: "" };

export default function NonConformita() {
  const { isTitolare } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  const [resolvingId, setResolvingId] = useState(null);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = () => listNonConformities().then(setItems);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const open = useMemo(() => items.filter((i) => !i.resolved), [items]);
  const resolved = useMemo(() => items.filter((i) => i.resolved), [items]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!form.description.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addNonConformity({ category: form.category, description: form.description.trim(), note: form.note });
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleResolve = async (id) => {
    setResolving(true);
    setError("");
    try {
      await resolveNonConformity(id, { correctiveAction });
      setResolvingId(null);
      setCorrectiveAction("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setResolving(false);
    }
  };

  const handleRiapri = async (id) => {
    setError("");
    try {
      await riapriNonConformita(id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <p className="testo-sala text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link to="/haccp" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← HACCP
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Non conformità</h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Aperte</h2>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              {NC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrizione"
              className={`${inputClass} sm:col-span-2`}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={adding || !form.description.trim()}
              onClick={handleAdd}
              className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60 shrink-0"
            >
              {adding ? "Segnalo…" : "+ Segnala"}
            </button>
          </div>
        </div>

        {open.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft/60">Nessuna non conformità aperta.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((item) => (
              <li key={item.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 mr-1.5">
                      {labelFor(NC_CATEGORIES, item.category)}
                    </span>
                    <span className="testo-sala text-b58-charcoal">{item.description}</span>
                    <div className="testo-sala text-b58-charcoal-soft mt-0.5">{formatDate(item.detected_at)}</div>
                  </div>
                  {isTitolare && (
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId((id) => (id === item.id ? null : item.id));
                        setCorrectiveAction("");
                      }}
                      className="tocco-bottone testo-sala text-b58-terracotta hover:text-b58-terracotta-dark shrink-0"
                    >
                      {resolvingId === item.id ? "Annulla" : "Risolvi"}
                    </button>
                  )}
                </div>
                {resolvingId === item.id && (
                  <div className="mt-3 pt-3 border-t border-b58-charcoal/10 flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        value={correctiveAction}
                        onChange={(e) => setCorrectiveAction(e.target.value)}
                        placeholder="Cosa hai fatto per rimediare"
                        className={inputClass}
                      />
                      {/* ⚠️ La promessa era scritta solo nei messaggi: il
                          registro temperature dice «resta aperta finché non
                          scrivi cosa hai fatto», e si chiudeva col campo
                          vuoto. Nel manuale esibibile quella riga compariva
                          come risolta senza rimedio — davanti a un ispettore
                          è peggio di una ancora aperta. Dal 16/08 il divieto
                          è anche nel database: qui si dà solo l'errore
                          prima. */}
                      <p className="testo-sala text-b58-charcoal-soft/80 mt-1">
                        Obbligatorio: finisce nel manuale che si mostra a un controllo.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={resolving || !correctiveAction.trim()}
                      onClick={() => handleResolve(item.id)}
                      className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
                    >
                      {resolving ? "Confermo…" : "Conferma risoluzione"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Risolte</h2>
          <ul className="space-y-1.5">
            {resolved.map((item) => (
              <li
                key={item.id}
                className="testo-sala text-b58-charcoal-soft flex items-start justify-between gap-3"
              >
                <span>
                  <span className="text-b58-charcoal">{item.description}</span>
                  {item.corrective_action && ` — ${item.corrective_action}`}
                  {" · "}
                  {formatDate(item.resolved_at)}
                </span>
                {/* La via di ritorno di «Risolvi»: chiusa per sbaglio,
                    restava chiusa per sempre. Con la conferma, perché
                    riaprire una riga di un registro che si esibisce non è
                    un gesto da fare per sbaglio due volte. */}
                {/* Solo il titolare, come «Risolvi»: la scrittura su
                    questa tabella è sua, e allo staff il pulsante darebbe
                    un rifiuto invece di un gesto. */}
                {isTitolare && (
                <ConfermaDistruttiva
                  etichetta="Riapri"
                  domanda={`Rimetto «${item.description}» fra le non conformità aperte? Quello che avevi scritto come rimedio resta, e lo puoi correggere richiudendola.`}
                  etichettaConferma="Sì, riapri"
                  onConferma={() => handleRiapri(item.id)}
                />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
