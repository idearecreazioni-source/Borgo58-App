import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createBarItem,
  listBarItems,
  setBarItemActive,
  updateBarItem,
} from "../../lib/api/barItems";
import { formatEUR } from "../../lib/constants";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import Didascalia from "../../components/Didascalia";

// Carta di vini e bevande (§3.2.1). Vive nell'Editor Menu insieme al resto
// dell'offerta, ma su una tabella propria: menu_items pretende una ricetta
// collegata e una bevanda non lo e'.
//
// Le categorie sono suggerimenti, non una gabbia: il campo resta libero,
// cosi' aggiungere "Vermouth" o "Birre della casa" non richiede di
// toccare il programma.
const CATEGORIE_SUGGERITE = {
  vini: ["Bollicine", "Bianchi", "Rossi", "Rosati", "Da meditazione"],
  bevande: ["Birre", "Analcolici", "Caffetteria", "Amari e distillati"],
};

const FORMATI_SUGGERITI = ["Calice", "Bottiglia", "33 cl", "75 cl", "Tazzina"];

const emptyForm = {
  section: "vini",
  category: "Bollicine",
  name: "",
  producer: "",
  serving: "Calice",
  selling_price: "",
};

export default function BevandeVini() {
  const [items, setItems] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () =>
    listBarItems({ includeInactive: true })
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.selling_price === "") return;
    setSaving(true);
    setError("");
    try {
      await createBarItem(form);
      setForm((f) => ({ ...emptyForm, section: f.section, category: f.category, serving: f.serving }));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const visibili = items.filter((i) => showInactive || i.active);

  // ⚠️ «Rossi» e «rossi» sono la stessa categoria, e prima diventavano due
  // sezioni della carta con lo stesso titolo. Il campo resta libero per
  // scelta (§ sopra: aggiungere «Vermouth» non deve richiedere di toccare
  // il programma), quindi non si chiude il vocabolario — si raggruppa
  // ignorando maiuscole e accenti, tenendo la prima scrittura incontrata.
  const chiaveCategoria = (c) =>
    String(c ?? "").trim().toLocaleLowerCase("it").normalize("NFD").replace(/\p{Diacritic}/gu, "");

  // Raggruppamento per sezione e categoria, nell'ordine in cui si legge
  // una carta: prima i vini, poi il resto.
  const sezioni = ["vini", "bevande"].map((section) => {
    const diSezione = visibili.filter((i) => i.section === section);
    const perChiave = new Map();
    for (const i of diSezione) {
      const k = chiaveCategoria(i.category);
      if (!perChiave.has(k)) perChiave.set(k, { nome: i.category, voci: [] });
      perChiave.get(k).voci.push(i);
    }
    return {
      section,
      label: section === "vini" ? "Carta dei vini" : "Bevande",
      categorie: [...perChiave.values()],
      totale: diSezione.length,
    };
  });

  // I suggerimenti comprendono le categorie già in uso: così la seconda
  // bottiglia si aggancia a quella di prima invece di reinventarne la
  // scrittura. È il freno che vale più del raggruppamento — quello ripara
  // dopo, questo evita.
  const categorieUsate = [
    ...new Map(
      items
        .filter((i) => i.section === form.section)
        .map((i) => [chiaveCategoria(i.category), i.category])
    ).values(),
  ];
  const suggerimentiCategoria = [
    ...new Set([...categorieUsate, ...CATEGORIE_SUGGERITE[form.section]]),
  ];

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-display text-2xl text-b58-charcoal">
          Bevande e vini
          <Didascalia>
            Una voce tolta dalla carta non viene cancellata: sparisce dal tablet ma resta
            leggibile nei conti già chiusi che la contengono, e in primavera si rimette
            con un tocco.
          </Didascalia>
        </h1>
        <Link
          to="/editor-menu"
          className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
        >
          ← Editor Menu
        </Link>
      </div>
      <p className="testo-sala-grande text-b58-charcoal-soft/80 mb-5 leading-relaxed">
        Quello che scrivi qui è ciò che la sala vede sul tablet: i <b>vini</b> nella
        schermata "Carta dei vini", le <b>bevande</b> nell'elenco accanto ai piatti.
        I prezzi sono quelli che paga il cliente, IVA inclusa.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* AGGIUNTA ------------------------------------------------------ */}
      <form onSubmit={handleAdd} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <select
            value={form.section}
            onChange={(e) => {
              const section = e.target.value;
              setForm((f) => ({ ...f, section, category: CATEGORIE_SUGGERITE[section][0] }));
            }}
            className={inputClass}
          >
            <option value="vini">Vino</option>
            <option value="bevande">Bevanda</option>
          </select>

          <input
            list="categorie-carta"
            required
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Categoria"
            className={inputClass}
          />
          <datalist id="categorie-carta">
            {suggerimentiCategoria.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome"
            className={`${inputClass} sm:col-span-2`}
          />

          <input
            list="formati-carta"
            value={form.serving}
            onChange={(e) => setForm((f) => ({ ...f, serving: e.target.value }))}
            placeholder="Formato"
            className={inputClass}
          />
          <datalist id="formati-carta">
            {FORMATI_SUGGERITI.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <input
            required
            type="number"
            step="0.50"
            min="0"
            value={form.selling_price}
            onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
            placeholder="€"
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input
            value={form.producer}
            onChange={(e) => setForm((f) => ({ ...f, producer: e.target.value }))}
            placeholder="Produttore o cantina (facoltativo)"
            className={`${inputClass} sm:max-w-xs`}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala-grande font-medium px-5 py-2 whitespace-nowrap"
          >
            {saving ? "Aggiungo…" : "+ Metti in carta"}
          </button>
        </div>
      </form>

      <label className="flex items-center gap-2 testo-sala-grande text-b58-charcoal-soft mb-4">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Mostra anche quelle fuori carta
      </label>

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Carico…</p>
      ) : (
        sezioni.map((s) => (
          <div key={s.section} className="mb-8">
            <h2 className="font-display text-xl text-b58-charcoal mb-2">
              {s.label} <span className="testo-sala-grande text-b58-charcoal-soft/70">({s.totale})</span>
            </h2>

            {s.totale === 0 ? (
              <p className="testo-sala-grande text-b58-charcoal-soft/60 bg-b58-cream-dark/30 rounded-lg px-3 py-3">
                {s.section === "vini"
                  ? "Nessun vino in carta. Finché è vuota, la schermata Carta dei vini in sala non compare."
                  : "Nessuna bevanda in carta."}
              </p>
            ) : (
              s.categorie.map((cat) => (
                <div key={cat.nome} className="mb-4">
                  <h3 className="testo-sala-grande font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-1">
                    {cat.nome}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full testo-sala-grande">
                      <tbody>
                        {cat.voci.map((v) => (
                          <tr key={v.id} className={`border-b border-b58-charcoal/5 ${v.active ? "" : "opacity-50"}`}>
                            <td className="py-2 pr-2">
                              <CampoAutosalvato
                                value={v.name}
                                onSave={(nome) =>
                                  updateBarItem(v.id, { name: nome }).then(load).catch((e) => setError(e.message))
                                }
                                className="w-full rounded border border-transparent hover:border-b58-charcoal/15 px-2 py-1 testo-sala-grande bg-transparent"
                              />
                              {v.producer && (
                                <span className="testo-sala text-b58-charcoal-soft/70 px-2">{v.producer}</span>
                              )}
                            </td>
                            <td className="py-2 w-28 text-b58-charcoal-soft testo-sala">{v.serving}</td>
                            <td className="py-2 w-28">
                              <CampoAutosalvato
                                type="number"
                                step="0.50"
                                value={v.selling_price}
                                onSave={(p) =>
                                  updateBarItem(v.id, { selling_price: Number(p) })
                                    .then(load)
                                    .catch((e) => setError(e.message))
                                }
                                className="w-20 rounded border border-b58-charcoal/15 px-2 py-1 testo-sala-grande text-right"
                              />
                            </td>
                            <td className="py-2 w-20 text-right text-b58-charcoal-soft testo-sala">
                              {formatEUR(v.selling_price)}
                            </td>
                            <td className="py-2 w-24 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setBarItemActive(v.id, !v.active).then(load).catch((e) => setError(e.message))
                                }
                                className="testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                              >
                                {v.active ? "togli dalla carta" : "rimetti in carta"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ))
      )}

      {/* ⚠️ Era un riquadro in fondo alla pagina: si legge una volta e poi
          è arredamento. La stessa frase sta ora accanto al titolo, dove la
          si cerca la prima volta che si toglie qualcosa dalla carta. */}
    </div>
  );
}
