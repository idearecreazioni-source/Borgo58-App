import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addBelowThresholdItems,
  addShoppingListItem,
  closeShoppingListItem,
  listaSpesa,
  listShoppingList,
  listShoppingListDisplay,
  removeShoppingListItem,
  updateShoppingListItem,
} from "../../lib/api/shoppingList";
import { listStockLevels } from "../../lib/api/stock";
import { listSuppliers, listSuppliersDisplay } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { useAuth } from "../../context/AuthContext";
import { PAYMENT_METHODS_SPESA, UNITS, formatDate, formatEUR, labelFor, formatQta} from "../../lib/constants";

const emptyAddForm = {
  mode: "ingredient",
  ingredient_id: "",
  custom_name: "",
  supplier_id: "",
  quantity_needed: "",
  unit: "",
  note: "",
};

const emptyCloseForm = {
  purchased_amount: "",
  payment_method: "contante",
  quantity_received: "",
  document_reference: "",
  expiry_date: "",
};

export default function ListaSpesa() {
  const { isTitolare } = useAuth();
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);
  const [addingThreshold, setAddingThreshold] = useState(false);

  const [closingItemId, setClosingItemId] = useState(null);
  const [closeForm, setCloseForm] = useState(emptyCloseForm);
  const [closing, setClosing] = useState(false);

  const load = () => (isTitolare ? listShoppingList() : listShoppingListDisplay());

  const loadAll = async () => {
    // Prima di guardare la lista, si guarda il magazzino: chi è sceso
    // sotto soglia entra da solo. Prima era un pulsante da ricordarsi di
    // premere — cioè una lista che diceva la verità solo a chi sapeva
    // che andava aggiornata.
    if (isTitolare) await addBelowThresholdItems().catch(() => {});
    const [listData, numeri, levels, sup] = await Promise.all([
      load(),
      isTitolare ? listaSpesa() : Promise.resolve([]),
      listStockLevels(),
      isTitolare ? getEntities().then((e) => listSuppliers(e.srls.id)) : listSuppliersDisplay(),
    ]);
    // I numeri veri (giacenza, soglia, quanto manca, se è rientrata) li
    // calcola il database sullo stesso conteggio che usa il Magazzino:
    // qui si attaccano soltanto alla riga giusta.
    const perId = new Map(numeri.map((r) => [r.id, r]));
    setItems(listData.map((i) => ({ ...i, numeri: perId.get(i.id) ?? null })));
    setIngredients(levels);
    setSuppliers(sup);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAll()
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTitolare]);

  const daComprare = useMemo(() => items.filter((i) => i.status === "da_comprare"), [items]);
  const acquistati = useMemo(() => items.filter((i) => i.status === "acquistato"), [items]);

  const groupedDaComprare = useMemo(() => {
    const groups = {};
    daComprare.forEach((item) => {
      const key = item.supplier?.name ?? "Senza fornitore";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [daComprare]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddThreshold = async () => {
    setAddingThreshold(true);
    setError("");
    try {
      const count = await addBelowThresholdItems();
      await loadAll();
      if (count === 0) setError("Nessun ingrediente sotto soglia da aggiungere.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingThreshold(false);
    }
  };

  // Si ricarica solo la riga toccata, non tutta la schermata: ricaricare
  // tutto butterebbe via le quantità che sta ancora correggendo sulle
  // altre righe (successo il 12/08 sulla posta, ed era invisibile).
  const handleQuantita = async (item, valore) => {
    const nuova = valore === "" ? null : Number(valore);
    if (nuova === (item.quantity_needed == null ? null : Number(item.quantity_needed))) return;
    if (nuova != null && (Number.isNaN(nuova) || nuova < 0)) return;
    setError("");
    try {
      await updateShoppingListItem(item.id, { quantity_needed: nuova });
      setItems((righe) =>
        righe.map((r) => (r.id === item.id ? { ...r, quantity_needed: nuova } : r))
      );
    } catch (e) {
      setError(e.message);
    }
  };

  // Cambiare il fornitore rimescola i gruppi, quindi qui la lista si
  // ricarica per intero: è l'unica azione di questa schermata che cambia
  // dove sta la riga, non solo cosa dice.
  const handleFornitore = async (itemId, supplierId) => {
    setError("");
    try {
      await updateShoppingListItem(itemId, { supplier_id: supplierId || null });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAdd = async () => {
    const isCustom = addForm.mode === "custom";
    if (isCustom && !addForm.custom_name.trim()) return;
    if (!isCustom && !addForm.ingredient_id) return;
    setAdding(true);
    setError("");
    try {
      await addShoppingListItem({
        ingredientId: isCustom ? null : addForm.ingredient_id,
        customName: isCustom ? addForm.custom_name.trim() : null,
        supplierId: addForm.supplier_id || null,
        quantityNeeded: addForm.quantity_needed ? Number(addForm.quantity_needed) : null,
        unit: addForm.unit || null,
        note: addForm.note || null,
      });
      setAddForm(emptyAddForm);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (itemId) => {
    try {
      await removeShoppingListItem(itemId);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const openClose = (itemId, quantityNeeded) => {
    setClosingItemId(itemId);
    setCloseForm({ ...emptyCloseForm, quantity_received: quantityNeeded ?? "" });
  };

  const handleClose = async (itemId) => {
    if (!closeForm.purchased_amount) return;
    setClosing(true);
    setError("");
    try {
      await closeShoppingListItem({
        itemId,
        purchasedAmount: Number(closeForm.purchased_amount),
        paymentMethod: closeForm.payment_method,
        quantityReceived: closeForm.quantity_received ? Number(closeForm.quantity_received) : null,
        documentReference: closeForm.document_reference || null,
        expiryDate: closeForm.expiry_date || null,
      });
      setClosingItemId(null);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/magazzino" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Lista della spesa</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddThreshold}
            disabled={addingThreshold}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2 disabled:opacity-60"
          >
            {addingThreshold ? "Aggiungo…" : "Ricontrolla le scorte"}
          </button>
          {isTitolare && (
            <Link
              to="/magazzino/ordini"
              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
            >
              Ordina ai fornitori
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Da comprare, raggruppati per fornitore */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Da comprare</h2>

        {daComprare.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60 mb-4">Nessun articolo in lista.</p>
        ) : (
          Object.entries(groupedDaComprare).map(([supplierName, groupItems]) => (
            <div key={supplierName} className="mb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
                {supplierName}
              </p>
              <ul className="space-y-2">
                {groupItems.map((item) => (
                  <li key={item.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="text-sm text-b58-charcoal font-medium">
                          {item.ingredient?.name ?? item.custom_name}
                        </span>
                        {/* La quantità si corregge qui: quella proposta è
                            quanto manca per tornare alla scorta minima, non
                            quanto conviene comprare (un fornitore vende a
                            casse, non a etti). */}
                        {isTitolare ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={item.quantity_needed ?? ""}
                            onBlur={(e) => handleQuantita(item, e.target.value)}
                            className="w-20 ml-1.5 rounded border border-b58-charcoal/15 px-1.5 py-0.5 text-sm text-b58-charcoal"
                          />
                        ) : (
                          item.quantity_needed != null && (
                            <span className="text-sm text-b58-charcoal-soft ml-1.5">
                              {formatQta(item.quantity_needed)} {item.unit}
                            </span>
                          )
                        )}
                        {isTitolare && (
                          <span className="text-sm text-b58-charcoal-soft ml-1">{item.unit}</span>
                        )}
                        {item.source === "soglia_minima" && (
                          <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 ml-1.5">
                            sotto soglia
                          </span>
                        )}
                        {/* Comprata altrove nel frattempo: la riga non
                            sparisce da sola — la lista è sua — ma smette
                            di far comprare due volte la stessa cosa. */}
                        {item.numeri?.rientrata && (
                          <span className="text-[11px] text-emerald-800 bg-emerald-100 rounded-full px-2 py-0.5 ml-1.5">
                            ora ce n'è abbastanza
                          </span>
                        )}
                        {/* I numeri veri, letti adesso dal magazzino. */}
                        {item.numeri?.soglia != null && (
                          <div className="text-xs text-b58-charcoal-soft mt-0.5">
                            in cella {Number(item.numeri.giacenza ?? 0)} {item.unit} · scorta minima{" "}
                            {Number(item.numeri.soglia)} {item.unit}
                            {Number(item.numeri.mancante) > 0 && (
                              <> · ne mancano {Number(item.numeri.mancante)}</>
                            )}
                            {" · in lista dal "}
                            {formatDate(item.numeri.in_lista_dal)}
                          </div>
                        )}
                        {item.note && (
                          <div className="text-xs text-b58-charcoal-soft mt-0.5">{item.note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Il fornitore si cambia QUI. Una riga lo eredita
                            dalla scheda del prodotto quando nasce, ma
                            senza poterlo correggere sulla riga si
                            sposterebbe soltanto il punto in cui ci si
                            blocca — ed è dove Alessio si è bloccato. */}
                        {isTitolare && (
                          <select
                            value={item.supplier?.id ?? ""}
                            onChange={(e) => handleFornitore(item.id, e.target.value)}
                            className="rounded border border-b58-charcoal/15 bg-white px-1.5 py-1 text-xs text-b58-charcoal"
                          >
                            <option value="">chi lo vende?</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {isTitolare && (
                          <button
                            type="button"
                            onClick={() => openClose(item.id, item.quantity_needed)}
                            className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
                          >
                            Segna acquistato
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>

                    {closingItemId === item.id && (
                      <div className="mt-3 pt-3 border-t border-b58-charcoal/10 flex flex-wrap gap-2 items-end">
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={closeForm.purchased_amount}
                            onChange={(e) =>
                              setCloseForm((f) => ({ ...f, purchased_amount: e.target.value }))
                            }
                            placeholder="Importo €"
                            className={inputClass}
                          />
                        </div>
                        <div className="w-36">
                          <select
                            value={closeForm.payment_method}
                            onChange={(e) =>
                              setCloseForm((f) => ({ ...f, payment_method: e.target.value }))
                            }
                            className={inputClass}
                          >
                            {PAYMENT_METHODS_SPESA.map((p) => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        {item.ingredient?.id && (
                          <>
                            <div className="w-24">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={closeForm.quantity_received}
                                onChange={(e) =>
                                  setCloseForm((f) => ({ ...f, quantity_received: e.target.value }))
                                }
                                placeholder="Qtà ricevuta"
                                className={inputClass}
                              />
                            </div>
                            <div className="w-36">
                              <input
                                type="date"
                                value={closeForm.expiry_date}
                                onChange={(e) =>
                                  setCloseForm((f) => ({ ...f, expiry_date: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </div>
                          </>
                        )}
                        <div className="flex-1 min-w-[140px]">
                          <input
                            value={closeForm.document_reference}
                            onChange={(e) =>
                              setCloseForm((f) => ({ ...f, document_reference: e.target.value }))
                            }
                            placeholder="Rif. documento (opz.)"
                            className={inputClass}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={closing || !closeForm.purchased_amount}
                          onClick={() => handleClose(item.id)}
                          className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                        >
                          {closing ? "Chiudo…" : "Conferma"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setClosingItemId(null)}
                          className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                        >
                          Annulla
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        {/* Aggiungi articolo */}
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mt-2">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setAddForm({ ...emptyAddForm, mode: "ingredient" })}
              className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                addForm.mode === "ingredient"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Ingrediente
            </button>
            <button
              type="button"
              onClick={() => setAddForm({ ...emptyAddForm, mode: "custom" })}
              className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                addForm.mode === "custom"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Articolo generico
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {addForm.mode === "ingredient" ? (
              <select
                value={addForm.ingredient_id}
                onChange={(e) => {
                  const chosen = ingredients.find((i) => i.ingredient_id === e.target.value);
                  setAddForm((f) => ({ ...f, ingredient_id: e.target.value, unit: chosen?.unit ?? f.unit }));
                }}
                className={`${inputClass} col-span-2 sm:col-span-1`}
              >
                <option value="">Seleziona ingrediente…</option>
                {ingredients.map((i) => (
                  <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name}</option>
                ))}
              </select>
            ) : (
              <input
                value={addForm.custom_name}
                onChange={(e) => setAddForm((f) => ({ ...f, custom_name: e.target.value }))}
                placeholder='Es. "Detersivo piatti"'
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
            )}
            <input
              type="number"
              step="0.01"
              min="0"
              value={addForm.quantity_needed}
              onChange={(e) => setAddForm((f) => ({ ...f, quantity_needed: e.target.value }))}
              placeholder="Quantità"
              className={inputClass}
            />
            <select
              value={addForm.unit}
              onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              <option value="">Unità</option>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <select
              value={addForm.supplier_id}
              onChange={(e) => setAddForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Nessun fornitore</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={addForm.note}
              onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={
                adding || (addForm.mode === "custom" ? !addForm.custom_name.trim() : !addForm.ingredient_id)
              }
              onClick={handleAdd}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
            >
              {adding ? "Aggiungo…" : "+ Aggiungi"}
            </button>
          </div>
        </div>
      </div>

      {/* Storico acquisti */}
      {acquistati.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Acquistati di recente</h2>
          <ul className="space-y-1.5">
            {acquistati.map((item) => (
              <li key={item.id} className="text-sm text-b58-charcoal-soft flex items-center justify-between gap-2">
                <span>
                  <span className="text-b58-charcoal">{item.ingredient?.name ?? item.custom_name}</span>
                  {item.purchased_at && ` — ${formatDate(item.purchased_at)}`}
                </span>
                {isTitolare && item.purchased_amount != null && (
                  <span className="text-b58-charcoal">
                    {formatEUR(item.purchased_amount)}
                    {item.payment_method && ` · ${labelFor(PAYMENT_METHODS_SPESA, item.payment_method)}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
