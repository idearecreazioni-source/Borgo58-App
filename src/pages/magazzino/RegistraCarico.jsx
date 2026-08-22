import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listStockLevels, registerStockDelivery } from "../../lib/api/stock";
import { righeListaAperte } from "../../lib/api/shoppingList";
import { formatDate, formatQta } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";
import { NON_LETTO, nonLetto } from "../../lib/calcoli/letture";
import { listSuppliers, listSuppliersDisplay } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  ingredient_id: "",
  quantity: "",
  supplier_id: "",
  expiry_date: "",
  unit_cost: "",
  note: "",
};

export default function RegistraCarico() {
  const navigate = useNavigate();
  const { isTitolare } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // Le righe della lista della spesa che aspettano questo prodotto, e
  // quale di loro riceverà l'arrivo.
  const [righeLista, setRigheLista] = useState([]);
  const [rigaScelta, setRigaScelta] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listStockLevels(),
      isTitolare ? getEntities().then((e) => listSuppliers(e.srls.id)) : listSuppliersDisplay(),
    ])
      .then(([levels, sup]) => {
        if (cancelled) return;
        setIngredients(levels);
        setSuppliers(sup);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isTitolare]);

  // ⚠️ SI GUARDA PRIMA DI CONFERMARE, non dopo (Alessio, 19/08): «dopo
  // non è più una correzione, è una riparazione». Quando l'ingrediente
  // cambia, cambia anche la riga che riceverà l'arrivo.
  useEffect(() => {
    let annullato = false;
    setRigaScelta("");
    if (!form.ingredient_id) {
      setRigheLista([]);
      return undefined;
    }
    righeListaAperte(form.ingredient_id)
      .then((r) => !annullato && setRigheLista(r))
      // 🔴 Vuoto qui si legge «non c'era niente in lista per questo
      // prodotto», e il carico si registra senza chiudere la riga della
      // spesa — che è il blocco degli arrivi del 19/08 disinnescato in
      // silenzio.
      .catch(() => !annullato && setRigheLista(NON_LETTO));
    return () => {
      annullato = true;
    };
  }, [form.ingredient_id]);

  const righe = nonLetto(righeLista) ? [] : righeLista;
  const rigaPredefinita = righe.find((r) => r.predefinita) ?? null;
  const rigaChePrende = righe.find((r) => r.id === rigaScelta) ?? rigaPredefinita;

  const selectedIngredient = ingredients.find((i) => i.ingredient_id === form.ingredient_id);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ingredient_id || !form.quantity) return;
    setSaving(true);
    setError("");
    try {
      await registerStockDelivery({
        ingredientId: form.ingredient_id,
        quantity: Number(form.quantity),
        supplierId: form.supplier_id || null,
        expiryDate: form.expiry_date || null,
        note: form.note || null,
        unitCost: isTitolare && form.unit_cost ? Number(form.unit_cost) : null,
        rigaLista: rigaScelta || null,
      });
      navigate("/magazzino");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="testo-sala text-b58-charcoal-soft max-w-xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="testo-sala max-w-xl mx-auto">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Registra carico</h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Ingrediente</label>
          <select
            required
            value={form.ingredient_id}
            onChange={(e) => setForm((f) => ({ ...f, ingredient_id: e.target.value }))}
            className={inputClass}
          >
            <option value="" disabled>Seleziona…</option>
            {ingredients.map((i) => (
              <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Quantità{selectedIngredient ? ` (${selectedIngredient.unit})` : ""}</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Scadenza (opzionale)</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Fornitore (opzionale)</label>
          <select
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            className={inputClass}
          >
            <option value="">Nessuno</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {isTitolare && (
          <div>
            <label className={labelClass}>Costo unitario, IVA esclusa (opzionale)</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.unit_cost}
              onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
              placeholder="€"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Nota (opzionale)</label>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={inputClass}
          />
        </div>

        {/* ⚠️ IL PREDEFINITO SI VEDE, E LÌ SI CAMBIA — la forma decisa da
            Alessio il 19/08, la stessa già scelta il 17/08 per il mezzo di
            pagamento: *si fa da sé, ma si vede, e lì si cambia*. Andare
            sulla riga più vecchia in silenzio è un predefinito che può
            sbagliare senza che nessuno se ne accorga; chiedere ogni volta
            aggiunge un gesto a un'operazione che ne ha già tre. */}
        {nonLetto(righeLista) && (
          <DatoNonLetto cosa="le righe della lista della spesa per questo prodotto" />
        )}

        {rigaChePrende && (
          <div className="rounded-lg bg-white border border-b58-charcoal/10 px-3 py-2 testo-sala text-b58-charcoal">
            Questo carico va sulla riga della lista della spesa
            {rigaChePrende.quantita_richiesta != null && (
              <>
                {" "}da {formatQta(rigaChePrende.quantita_richiesta)} {rigaChePrende.unita}
              </>
            )}{" "}
            del {formatDate(rigaChePrende.in_lista_dal)}
            {Number(rigaChePrende.quantita_arrivata ?? 0) > 0 && (
              <> · finora arrivati {formatQta(rigaChePrende.quantita_arrivata)}</>
            )}
            .
            {/* La scelta compare SOLO quando c'è davvero qualcosa da
                scegliere: con una riga sola non c'è niente da correggere, e
                un menu che ha una voce sola è ingombro. */}
            {righe.length > 1 && (
              <select
                value={rigaScelta || rigaPredefinita?.id || ""}
                onChange={(e) => setRigaScelta(e.target.value)}
                className="mt-2 w-full rounded border border-b58-charcoal/15 bg-white px-2 py-1.5 testo-sala"
              >
                {righe.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.quantita_richiesta != null
                      ? `${formatQta(r.quantita_richiesta)} ${r.unita} — in lista dal ${formatDate(r.in_lista_dal)}`
                      : `in lista dal ${formatDate(r.in_lista_dal)}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !form.ingredient_id || !form.quantity}
          className="tocco-bottone rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5  testo-sala"
        >
          {saving ? "Registro…" : "Registra carico"}
        </button>
      </form>
    </div>
  );
}
