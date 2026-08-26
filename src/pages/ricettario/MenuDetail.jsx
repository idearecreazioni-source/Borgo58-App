import { useEffect, useMemo, useState } from "react";
import { puoAndareInCarta } from "../../lib/calcoli/carta";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  addMenuItem,
  getMenu,
  listIngredientiDelMenu,
  listMenuItemsFull,
  removeMenuItem,
  setActiveMenu,
  simulaPrezzoIngrediente,
  updateMenuItemPrice,
} from "../../lib/api/menus";
import { listRecipes, listAllRecipeCosts } from "../../lib/api/recipes";
import { foodCostLevel, formatEUR } from "../../lib/constants";
import CampoAutosalvato from "../../components/CampoAutosalvato";

const SECTIONS = [
  { category: "antipasto", label: "Antipasti", target: 4 },
  { category: "primo", label: "Primi", target: 4 },
  { category: "secondo", label: "Secondi", target: 4 },
  { category: "dolce", label: "Dolci", target: 2 },
];

const LEVEL_CLASS = {
  ok: "text-b58-olive-dark",
  warning: "text-yellow-700",
  danger: "text-b58-terracotta-dark",
  neutral: "text-b58-charcoal-soft",
};

export default function MenuDetail() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [items, setItems] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [allRecipeCosts, setAllRecipeCosts] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);

  const [addForms, setAddForms] = useState({}); // { [category]: { recipe_id, selling_price } }

  // Da dove si arriva: la scheda di una ricetta «pronta ma non in carta»
  // può mandare qui sé stessa (difetto n. 3 del collaudo, speculare al
  // n. 1). Si arriva col piatto già scelto nella sua categoria — resta da
  // scrivere il prezzo, che è la decisione, e da confermare.
  const [ricerca, setRicerca] = useSearchParams();
  const daAggiungere = ricerca.get("aggiungi");

  // ⚠️ Le righe di ricetta e l'anagrafica degli ingredienti non si
  // caricano più: servivano solo alla copia della formula del food cost
  // che stava qui dentro. Il simulatore ora chiede al database, che le
  // legge da sé — due giri in meno e una formula in meno.
  const load = async () => {
    const m = await getMenu(id);
    const its = await listMenuItemsFull(id);
    setMenu(m);
    setItems(its);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      load(),
      listRecipes().then(setAllRecipes),
      listAllRecipeCosts().then((c) =>
        setAllRecipeCosts(Object.fromEntries(c.map((x) => [x.recipe_id, x])))
      ),
    ])
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Il piatto arrivato dalla sua scheda si mette nel modulo della SUA
  // categoria, gia' scelto. Non si aggiunge da solo: il prezzo e' la
  // decisione, e quella resta di chi guarda.
  //
  // ⚠️ L'indirizzo si ripulisce subito, come per l'assegnazione dalla
  // pianta: senza, ricaricando la pagina il piatto tornerebbe a
  // riproporsi anche dopo essere stato messo in carta.
  useEffect(() => {
    if (!daAggiungere || loading) return;
    const r = allRecipes.find((x) => x.id === daAggiungere);
    if (r) {
      const gia = items.some((i) => i.recipe_id === r.id);
      if (gia) setError(`«${r.name}» è già in questo menu.`);
      else setAddForms((f) => ({ ...f, [r.category]: { recipe_id: r.id, selling_price: "" } }));
    } else {
      setError("Quel piatto non risulta fra le ricette.");
    }
    const senza = new URLSearchParams(ricerca);
    senza.delete("aggiungi");
    setRicerca(senza, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daAggiungere, loading, allRecipes, items]);

  const itemsByCategory = useMemo(() => {
    const map = { antipasto: [], primo: [], secondo: [], dolce: [] };
    items.forEach((i) => map[i.category]?.push(i));
    return map;
  }, [items]);

  const categoryAverages = useMemo(() => {
    const result = {};
    SECTIONS.forEach(({ category }) => {
      const withPrice = itemsByCategory[category].filter((i) => i.economics?.food_cost_pct != null);
      if (withPrice.length === 0) {
        result[category] = null;
        return;
      }
      const avgPct =
        withPrice.reduce((s, i) => s + Number(i.economics.food_cost_pct), 0) / withPrice.length;
      const avgMargin =
        withPrice.reduce((s, i) => s + Number(i.economics.gross_margin), 0) / withPrice.length;
      result[category] = { avgPct, avgMargin };
    });
    return result;
  }, [itemsByCategory]);

  const summary = useMemo(() => {
    const present = SECTIONS.map((s) => categoryAverages[s.category]).filter(Boolean);
    if (present.length === 0) return null;

    // ⚠️ MEDIA SU TUTTI I PIATTI, non media delle medie per categoria
    // (16/08/2026, coda del mandato di correzione, decisione di Alessio).
    // Prima ogni categoria pesava uguale: i dolci sono quasi sempre pochi
    // e cari, e con due dolci e dodici primi spostavano il numero come se
    // fossero metà del menu.
    //
    // ⚠️ E RESTA IL SECONDO DEI TRE NUMERI POSSIBILI. Il terzo — il food
    // cost pesato su QUANTO SI VENDE — è l'unico che serve davvero a
    // decidere i prezzi, e si potrà calcolare solo con gli scontrini
    // veri. Finché non c'è, la schermata lo dichiara accanto al numero:
    // senza quella riga, fra un anno questo verrebbe letto come se fosse
    // il terzo. È lavoro da chiedere, non da dedurre.
    const conPct = items.filter((i) => i.economics?.food_cost_pct != null);
    const conMargine = items.filter((i) => i.economics?.gross_margin != null);
    const weightedFoodCost = conPct.length
      ? conPct.reduce((s, i) => s + Number(i.economics.food_cost_pct), 0) / conPct.length
      : null;
    const weightedMargin = conMargine.length
      ? conMargine.reduce((s, i) => s + Number(i.economics.gross_margin), 0) / conMargine.length
      : null;

    const priced = items.filter((i) => i.economics?.gross_margin != null);
    const best = priced.length
      ? priced.reduce((a, b) => (Number(a.economics.gross_margin) > Number(b.economics.gross_margin) ? a : b))
      : null;
    const worst = priced.length
      ? priced.reduce((a, b) => (Number(a.economics.gross_margin) < Number(b.economics.gross_margin) ? a : b))
      : null;
    const overThreshold = items.filter((i) => foodCostLevel(i.economics?.food_cost_pct) === "danger");

    return { weightedFoodCost, weightedMargin, best, worst, overThreshold };
  }, [categoryAverages, items]);

  // --- Simulatore what-if ---
  const [simMode, setSimMode] = useState("prezzo_ingrediente");
  const [simIngredientId, setSimIngredientId] = useState("");
  const [simPct, setSimPct] = useState("10");
  const [simSwapItemId, setSimSwapItemId] = useState("");
  const [simSwapRecipeId, setSimSwapRecipeId] = useState("");
  const [simSwapPrice, setSimSwapPrice] = useState("");
  const [simTargetItemId, setSimTargetItemId] = useState("");
  const [simTargetPct, setSimTargetPct] = useState("22");
  const [applyingPrice, setApplyingPrice] = useState(false);

  // ⚠️ La simulazione LA CALCOLA IL DATABASE (16/08/2026, Blocco 2 del
  // mandato di correzione). Qui c'era una terza copia della formula del
  // food cost che non conosceva le preparazioni: su una riga-componente
  // `ri.ingredient` è vuoto, quindi la schermata si ROMPEVA su ogni piatto
  // che contiene un semilavorato — e quando non si rompeva guardava un
  // livello solo, cioè rispondeva «nessun piatto è toccato» a un rincaro
  // che tocca tutto il menu attraverso un soffritto.
  //
  // Anche l'elenco degli ingredienti simulabili viene da lì: costruirlo
  // qui sui soli ingredienti diretti rendeva non selezionabile proprio
  // ciò che il simulatore vecchio non sapeva vedere.
  const [simIngredients, setSimIngredients] = useState([]);
  const [priceSimResults, setPriceSimResults] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listIngredientiDelMenu(id)
      .then((r) => !cancelled && setSimIngredients(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (simMode !== "prezzo_ingrediente" || !simIngredientId || simPct === "") {
      setPriceSimResults(null);
      return;
    }
    let cancelled = false;
    simulaPrezzoIngrediente(id, simIngredientId, simPct)
      .then((r) => !cancelled && setPriceSimResults(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, simMode, simIngredientId, simPct]);

  const swapCandidate = useMemo(() => {
    if (simMode !== "sostituzione" || !simSwapRecipeId) return null;
    const cost = allRecipeCosts[simSwapRecipeId];
    const price = Number(simSwapPrice) || 0;
    if (!cost || !price) return { cost, pct: null };
    return { cost, pct: (cost.food_cost_portion / price) * 100 };
  }, [simMode, simSwapRecipeId, simSwapPrice, allRecipeCosts]);

  const targetPriceResult = useMemo(() => {
    if (simMode !== "prezzo_target" || !simTargetItemId) return null;
    const item = items.find((i) => i.id === simTargetItemId);
    if (!item?.economics) return null;
    const target = Number(simTargetPct);
    if (!target) return null;
    return {
      item,
      targetPrice: item.economics.food_cost_portion / (target / 100),
    };
  }, [simMode, simTargetItemId, simTargetPct, items]);

  if (notFound) return <Navigate to="/ricettario/menu" replace />;
  if (loading || !menu) {
    return <p className="testo-sala-grande text-b58-charcoal-soft max-w-5xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleActivate = async () => {
    setActivating(true);
    try {
      const updated = await setActiveMenu(id);
      setMenu(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setActivating(false);
    }
  };

  // ⚠️ Un prezzo lasciato vuoto NON è zero. Prima `Number("") || 0`
  // scriveva 0,00 in silenzio: un piatto a zero non è un piatto gratis, è
  // un piatto che nessuno ha ancora prezzato — e mandava il food cost al
  // 100%, il margine sotto zero e la media del menu a valanga, tutti
  // numeri credibili e falsi. È la stessa forma dello scarto a zero.
  const prezzoScritto = (v) => {
    const s = String(v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const handleAddItem = async (category) => {
    const form = addForms[category];
    if (!form?.recipe_id) return;
    const prezzo = prezzoScritto(form.selling_price);
    if (prezzo === null) {
      setError("Scrivi il prezzo del piatto: lasciandolo vuoto finirebbe in carta a 0,00 €.");
      return;
    }
    try {
      await addMenuItem(id, {
        recipe_id: form.recipe_id,
        category,
        selling_price: prezzo,
        position: itemsByCategory[category].length,
      });
      setAddForms((f) => ({ ...f, [category]: { recipe_id: "", selling_price: "" } }));
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePriceChange = async (itemId, price) => {
    const prezzo = prezzoScritto(price);
    if (prezzo === null) {
      // Non si scrive niente e si ricarica: il campo torna al prezzo vero,
      // così si vede che la cancellatura non ha attaccato.
      setError("Il prezzo non può restare vuoto: il piatto andrebbe in carta a 0,00 €.");
      await load();
      return;
    }
    setError("");
    try {
      await updateMenuItemPrice(itemId, prezzo);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removeMenuItem(itemId);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const applyTargetPrice = async () => {
    if (!targetPriceResult) return;
    setApplyingPrice(true);
    try {
      await updateMenuItemPrice(targetPriceResult.item.id, targetPriceResult.targetPrice);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyingPrice(false);
    }
  };

  // La stagionalità delle ricette è per stagione (§2.5), non per mese — qui
  // segnaliamo solo le ricette non marcate "tutto_anno", il controllo fine
  // (mese corrente vs stagione) resta a vista dello chef.
  const isOutOfSeason = (seasonality) =>
    seasonality?.length > 0 && !seasonality.includes("tutto_anno");

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/ricettario/menu" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Menu
      </Link>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap mt-3 mb-6">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal">{menu.name}</h1>
          <p className="testo-sala-grande text-b58-charcoal-soft">Struttura {menu.structure}</p>
        </div>
        {menu.is_active ? (
          <span className="testo-sala font-medium uppercase tracking-wide bg-b58-olive text-b58-parchment rounded-full px-3 py-1.5">
            Menu attivo
          </span>
        ) : (
          <button
            onClick={handleActivate}
            disabled={activating}
            className="rounded-lg bg-b58-charcoal hover:bg-b58-charcoal-soft disabled:opacity-60 transition-colors text-b58-parchment testo-sala-grande px-4 py-2"
          >
            {activating ? "Attivo…" : "Rendi attivo"}
          </button>
        )}
      </div>

      {/* Riepilogo */}
      {summary && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Riepilogo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="testo-sala text-b58-charcoal-soft uppercase tracking-wide">Food cost medio</p>
              <p className={`text-xl font-medium ${LEVEL_CLASS[foodCostLevel(summary.weightedFoodCost)]}`}>
                {summary.weightedFoodCost != null ? `${summary.weightedFoodCost.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="testo-sala text-b58-charcoal-soft uppercase tracking-wide">Margine medio/coperto</p>
              <p className="text-xl font-medium text-b58-charcoal">
                {summary.weightedMargin != null ? formatEUR(summary.weightedMargin) : "—"}
              </p>
            </div>
            <div>
              <p className="testo-sala text-b58-charcoal-soft uppercase tracking-wide">Miglior margine</p>
              <p className="testo-sala-grande text-b58-charcoal">
                {summary.best ? `${summary.best.recipe.name} (${formatEUR(summary.best.economics.gross_margin)})` : "—"}
              </p>
            </div>
            <div>
              <p className="testo-sala text-b58-charcoal-soft uppercase tracking-wide">Peggior margine</p>
              <p className="testo-sala-grande text-b58-charcoal">
                {summary.worst ? `${summary.worst.recipe.name} (${formatEUR(summary.worst.economics.gross_margin)})` : "—"}
              </p>
            </div>
          </div>
          {/* ⚠️ Il numero e il suo limite viaggiano insieme. Senza questa
              riga, fra un anno «food cost medio» verrebbe letto come se
              fosse pesato sulle vendite — che è l'unico dei tre numeri
              che serve a decidere i prezzi, e oggi non si può calcolare. */}
          <p className="testo-sala text-b58-charcoal-soft/80 bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 mb-4">
            Media su tutti i piatti del menu, <strong>non pesata su quanto si vende</strong>:
            un piatto che esce due volte a sera conta come uno che esce venti. Il food cost
            pesato sulle vendite si potrà calcolare quando ci saranno gli scontrini veri.
          </p>
          {summary.overThreshold.length > 0 && (
            <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
              ⚠ {summary.overThreshold.length} piatt{summary.overThreshold.length === 1 ? "o" : "i"} sopra il 25% di food cost:{" "}
              {summary.overThreshold.map((i) => i.recipe.name).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Sezioni 4-4-4-2 */}
      {SECTIONS.map(({ category, label, target }) => {
        const sectionItems = itemsByCategory[category];
        const catAvg = categoryAverages[category];
        // ⚠️ Solo i piatti pronti per la carta (20/08/2026, decisione di
        // Alessio). Il criterio sta in un posto solo, e chiede una
        // proprietà invece di elencare i tipi: un tipo nuovo domani non
        // ricompare qui da sé.
        const candidates = allRecipes.filter(
          (r) =>
            puoAndareInCarta(r) &&
            r.category === category &&
            !items.some((i) => i.recipe_id === r.id)
        );
        const form = addForms[category] ?? { recipe_id: "", selling_price: "" };

        return (
          <div key={category} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display testo-sala-titolo text-b58-charcoal">
                {label}{" "}
                <span className="testo-sala-grande text-b58-charcoal-soft font-sans">
                  ({sectionItems.length}/{target})
                </span>
              </h2>
              {catAvg && (
                <span className={`testo-sala-grande font-medium ${LEVEL_CLASS[foodCostLevel(catAvg.avgPct)]}`}>
                  media {catAvg.avgPct.toFixed(1)}%
                </span>
              )}
            </div>

            {sectionItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full testo-sala-grande mb-3">
                  <thead>
                    <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                      <th className="py-2 font-medium">Piatto</th>
                      <th className="py-2 font-medium text-right">Food cost</th>
                      <th className="py-2 font-medium text-right">Prezzo</th>
                      <th className="py-2 font-medium text-right">Food cost %</th>
                      <th className="py-2 font-medium text-right">Margine</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionItems.map((item) => (
                      <tr key={item.id} className="border-b border-b58-charcoal/5 last:border-0">
                        <td className="py-2 text-b58-charcoal">
                          {/* ⚠️ Il passo porta la PROPRIA destinazione: entrando
                              in un piatto da qui, il ritorno deve riportare al
                              menu, non all'elenco delle ricette. */}
                          <Link
                            to={`/ricettario/ricette/${item.recipe_id}`}
                            state={{
                              percorso: [
                                { id, nome: menu?.name ?? "", a: `/ricettario/menu/${id}` },
                              ],
                            }}
                            className="tocco-testo hover:text-b58-terracotta"
                          >
                            {item.recipe.name}
                          </Link>
                          {isOutOfSeason(item.recipe.seasonality) && (
                            <span className="testo-sala text-b58-charcoal-soft ml-1.5">
                              (stagione: {item.recipe.seasonality.join(", ")})
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-b58-charcoal-soft">
                          {formatEUR(item.economics?.food_cost_portion)}
                        </td>
                        <td className="py-2 text-right">
                          <CampoAutosalvato
                            type="number"
                            step="0.5"
                            value={item.selling_price}
                            onSave={(v) => handlePriceChange(item.id, v)}
                            className="w-20 tocco-campo rounded border border-b58-charcoal/15 px-2 py-1 testo-sala-grande text-right"
                          />
                        </td>
                        <td className={`py-2 text-right font-medium ${LEVEL_CLASS[foodCostLevel(item.economics?.food_cost_pct)]}`}>
                          {item.economics?.food_cost_pct != null ? `${Number(item.economics.food_cost_pct).toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2 text-right text-b58-charcoal">
                          {formatEUR(item.economics?.gross_margin)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-b58-charcoal-soft hover:text-b58-terracotta-dark testo-sala"
                          >
                            Rimuovi
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center bg-white rounded-lg border border-b58-charcoal/10 p-2">
                <select
                  value={form.recipe_id}
                  onChange={(e) =>
                    setAddForms((f) => ({ ...f, [category]: { ...form, recipe_id: e.target.value } }))
                  }
                  className={`${inputClass} flex-1 min-w-[160px]`}
                >
                  <option value="">Aggiungi ricetta…</option>
                  {/* ⚠️ In un menu ATTIVO entrano solo i piatti segnati
                      «pronti per la carta» — lo impone il database. Qui i
                      non pronti si mostrano lo stesso, spenti e col
                      perché: nasconderli farebbe cercare per dieci minuti
                      un piatto che c'è, e che manca solo di una spunta. */}
                  {candidates.map((r) => {
                    const bloccata = menu.is_active && !r.pronta_per_carta;
                    return (
                      <option key={r.id} value={r.id} disabled={bloccata}>
                        {r.name}{bloccata ? " — non ancora pronta per la carta" : ""}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Prezzo €"
                  value={form.selling_price}
                  onChange={(e) =>
                    setAddForms((f) => ({ ...f, [category]: { ...form, selling_price: e.target.value } }))
                  }
                  className={`${inputClass} w-28`}
                />
                <button
                  onClick={() => handleAddItem(category)}
                  disabled={!form.recipe_id}
                  className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
                >
                  + Aggiungi
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Simulatore what-if */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Simulatore what-if</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { value: "prezzo_ingrediente", label: "Aumento prezzo ingrediente" },
            { value: "sostituzione", label: "Sostituzione piatto" },
            { value: "prezzo_target", label: "Prezzo per food cost target" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setSimMode(m.value)}
              className={`testo-sala rounded-full px-3 py-1.5 border transition-colors ${
                simMode === m.value
                  ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {simMode === "prezzo_ingrediente" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={simIngredientId}
                onChange={(e) => setSimIngredientId(e.target.value)}
                className={`${inputClass} flex-1 min-w-[180px]`}
              >
                <option value="">Seleziona ingrediente usato nel menu…</option>
                {simIngredients.map((i) => (
                  <option key={i.ingredient_id} value={i.ingredient_id}>
                    {i.nome}
                    {i.solo_in_preparazioni ? " (solo dentro preparazioni)" : ""}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={simPct}
                  onChange={(e) => setSimPct(e.target.value)}
                  className={`${inputClass} w-20`}
                />
                <span className="testo-sala-grande text-b58-charcoal-soft">% variazione</span>
              </div>
            </div>

            {priceSimResults && (
              priceSimResults.length === 0 ? (
                <p className="testo-sala-grande text-b58-charcoal-soft">
                  Questo ingrediente non è usato in nessuna ricetta del menu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full testo-sala-grande">
                    <thead>
                      <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                        <th className="py-2 font-medium">Piatto</th>
                        <th className="py-2 font-medium text-right">Food cost attuale</th>
                        <th className="py-2 font-medium text-right">Food cost simulato</th>
                        <th className="py-2 font-medium text-right">Food cost % simulato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceSimResults.map((r) => (
                        <tr key={r.menu_item_id} className="border-b border-b58-charcoal/5 last:border-0">
                          <td className="py-2 text-b58-charcoal">
                            {r.piatto}
                            {/* Il caso che prima era invisibile: l'ingrediente
                                non è in questo piatto, è dentro qualcosa che
                                il piatto usa. */}
                            {r.via_preparazione && (
                              <span className="testo-sala text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5 ml-1.5">
                                attraverso una preparazione
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right text-b58-charcoal-soft">
                            {formatEUR(r.food_cost_attuale)}
                          </td>
                          <td className="py-2 text-right text-b58-charcoal">
                            {formatEUR(r.food_cost_simulato)}
                          </td>
                          <td className={`py-2 text-right font-medium ${LEVEL_CLASS[foodCostLevel(r.pct_simulata)]}`}>
                            {r.pct_simulata != null ? `${Number(r.pct_simulata).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {simMode === "sostituzione" && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <select
                value={simSwapItemId}
                onChange={(e) => {
                  setSimSwapItemId(e.target.value);
                  const item = items.find((i) => i.id === e.target.value);
                  setSimSwapPrice(item ? String(item.selling_price) : "");
                  setSimSwapRecipeId("");
                }}
                className={inputClass}
              >
                <option value="">Piatto da sostituire…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.recipe.name}</option>
                ))}
              </select>
              <select
                value={simSwapRecipeId}
                onChange={(e) => setSimSwapRecipeId(e.target.value)}
                disabled={!simSwapItemId}
                className={inputClass}
              >
                <option value="">Con quale ricetta…</option>
                {allRecipes
                  .filter((r) => {
                    const current = items.find((i) => i.id === simSwapItemId);
                    // Stesso criterio: si simula uno scambio con qualcosa
                    // che in carta ci potrebbe andare davvero.
                    return (
                      puoAndareInCarta(r) &&
                      current &&
                      r.category === current.category &&
                      r.id !== current.recipe_id
                    );
                  })
                  .map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
              </select>
              <input
                type="number"
                step="0.5"
                value={simSwapPrice}
                onChange={(e) => setSimSwapPrice(e.target.value)}
                placeholder="Prezzo di vendita ipotetico"
                className={inputClass}
              />
            </div>

            {simSwapItemId && simSwapRecipeId && swapCandidate?.cost && (
              <div className="testo-sala-grande bg-white rounded-lg border border-b58-charcoal/10 p-3">
                {(() => {
                  const current = items.find((i) => i.id === simSwapItemId);
                  return (
                    <>
                      <p className="text-b58-charcoal-soft">
                        Attuale — {current.recipe.name}: food cost{" "}
                        {formatEUR(current.economics?.food_cost_portion)} (
                        {current.economics?.food_cost_pct != null ? `${Number(current.economics.food_cost_pct).toFixed(1)}%` : "—"})
                      </p>
                      <p className="text-b58-charcoal mt-1">
                        Sostituto — food cost {formatEUR(swapCandidate.cost.food_cost_portion)}
                        {swapCandidate.pct != null && (
                          <span className={`ml-1 font-medium ${LEVEL_CLASS[foodCostLevel(swapCandidate.pct)]}`}>
                            ({swapCandidate.pct.toFixed(1)}%)
                          </span>
                        )}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {simMode === "prezzo_target" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={simTargetItemId}
                onChange={(e) => setSimTargetItemId(e.target.value)}
                className={`${inputClass} flex-1 min-w-[180px]`}
              >
                <option value="">Seleziona piatto…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.recipe.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={simTargetPct}
                  onChange={(e) => setSimTargetPct(e.target.value)}
                  className={`${inputClass} w-20`}
                />
                <span className="testo-sala-grande text-b58-charcoal-soft">% food cost target</span>
              </div>
            </div>

            {targetPriceResult && (
              <div className="testo-sala-grande bg-white rounded-lg border border-b58-charcoal/10 p-3 flex items-center justify-between flex-wrap gap-2">
                <p className="text-b58-charcoal">
                  Prezzo di vendita necessario:{" "}
                  <span className="font-medium testo-sala-titolo">{formatEUR(targetPriceResult.targetPrice)}</span>
                  <span className="text-b58-charcoal-soft">
                    {" "}(attuale {formatEUR(targetPriceResult.item.selling_price)})
                  </span>
                </p>
                <button
                  onClick={applyTargetPrice}
                  disabled={applyingPrice}
                  className="rounded-lg bg-b58-charcoal text-b58-parchment testo-sala-grande px-3 py-1.5 disabled:opacity-60"
                >
                  {applyingPrice ? "Applico…" : "Applica questo prezzo"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
