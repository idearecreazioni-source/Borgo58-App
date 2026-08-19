import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  duplicaRicetta,
  getRecipe,
  getRecipeAllergens,
  getRecipeCost,
  listPreparationUsage,
  listPreparations,
  listRecipeCostsFor,
  listRecipeStatusHistory,
  updateRecipe,
} from "../../lib/api/recipes";
import {
  addRecipeIngredient,
  getRecipeRowCosts,
  listRecipeIngredients,
  removeRecipeIngredient,
  updateRecipeIngredient,
} from "../../lib/api/recipeIngredients";
import {
  addRecipeStep,
  listRecipeSteps,
  removeRecipeStep,
  swapStepOrder,
} from "../../lib/api/recipeSteps";
import { listIngredients } from "../../lib/api/ingredients";
import { listMenus } from "../../lib/api/menus";
import { addRecipeVideo, listRecipeVideos, removeRecipeVideo } from "../../lib/api/recipeVideos";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import PrintButton from "../../components/PrintButton";
import {
  ALLERGENS,
  COOKING_TECHNIQUES,
  RECIPE_CATEGORIES,
  RECIPE_TYPES,
  eComponente,
  SEASONS,
  STEP_PHASES,
  UNITS,
  VIDEO_PLATFORMS,
  formatDate,
  formatEUR,
  labelFor,
  recipeStatusLabel,
} from "../../lib/constants";

const emptyIngredientForm = {
  ingredient_id: "",
  component_recipe_id: "",
  quantity: "",
  unit: "",
  waste_percentage: "",
  prep_note: "",
  is_optional: false,
};

const emptyStepForm = {
  phase: "mise_en_place",
  description: "",
  technique: "",
  duration_min: "",
  is_active_time: true,
  temperature_c: "",
  is_haccp_ccp: false,
  haccp_limit: "",
  haccp_action: "",
  equipment: "",
};

export default function RicettaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [cost, setCost] = useState(null);
  const [allergens, setAllergens] = useState({ allergens: [], daVerificare: false, ingredienti: [], tracce: [] });
  const [allIngredients, setAllIngredients] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  // Il menu in servizio: serve solo a offrire la strada per mettere in
  // carta un piatto pronto. Se non ce n'e' nessuno la schermata lo dice.
  const [menuAttivo, setMenuAttivo] = useState(null);
  const [videos, setVideos] = useState([]);
  const [preparations, setPreparations] = useState([]);
  const [costiFinger, setCostiFinger] = useState({});
  const [spuntando, setSpuntando] = useState(null);
  const [componiAperto, setComponiAperto] = useState(null);
  const [copiando, setCopiando] = useState(false);
  const avviso = useLocation().state?.avviso ?? "";
  const [preparationUsage, setPreparationUsage] = useState([]);
  const [rowCosts, setRowCosts] = useState({});

  const [savingHeader, setSavingHeader] = useState(false);
  const [ingredientMode, setIngredientMode] = useState("ingredient");
  const [ingredientForm, setIngredientForm] = useState(emptyIngredientForm);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [stepForm, setStepForm] = useState(emptyStepForm);
  const [addingStep, setAddingStep] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoNote, setVideoNote] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  // ⚠️ Le righe e i loro costi si ricaricano insieme: il costo di una riga
  // ora lo dice il database (`v_recipe_row_costs`), quindi cambiare una
  // quantità e ricaricare le sole righe mostrerebbe una quantità nuova col
  // costo di prima — che è peggio del vecchio ricalcolo nel browser,
  // perché sbaglia in silenzio invece di essere solo una copia.
  //
  // ⚠️ E i costi dei bocconcini si rileggono INSIEME (20/08/2026): il
  // pannello per comporre li mostra accanto a ogni spunta, e leggerli una
  // volta sola all'apertura della pagina farebbe convivere sullo stesso
  // schermo un totale di adesso e dei costi di prima. Sono numeri piccoli e
  // una lettura in più; un numero vecchio accanto a uno nuovo no.
  const ricaricaRighe = async (elencoComponenti = preparations) => {
    const idFinger = elencoComponenti.filter((p) => p.recipe_type === "finger").map((p) => p.id);
    const [ri, costi, c, cf] = await Promise.all([
      listRecipeIngredients(id),
      getRecipeRowCosts(id),
      getRecipeCost(id),
      listRecipeCostsFor(idFinger),
    ]);
    setRecipeIngredients(ri);
    setRowCosts(costi);
    setCost(c);
    setCostiFinger(cf);
  };

  const loadAll = async (elencoComponenti) => {
    const [rec, st, al, hist, vids, prepUsage, menus] = await Promise.all([
      getRecipe(id),
      listRecipeSteps(id),
      getRecipeAllergens(id),
      listRecipeStatusHistory(id),
      listRecipeVideos(id),
      listPreparationUsage(id),
      listMenus(),
    ]);
    setMenuAttivo(menus.find((m) => m.is_active) ?? null);
    setRecipe(rec);
    setSteps(st);
    setAllergens(al);
    setVideos(vids);
    setStatusHistory(hist);
    setPreparationUsage(prepUsage);
    await ricaricaRighe(elencoComponenti);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // ⚠️ L'elenco dei componenti si legge PRIMA e si passa avanti: da lì si
    // ricavano quali sono i bocconcini, e senza, la prima lettura dei costi
    // partirebbe con l'elenco ancora vuoto e il pannello si aprirebbe senza
    // nessun prezzo accanto alle spunte.
    listPreparations({ excludeId: id })
      .then((comp) => {
        setPreparations(comp);
        return Promise.all([loadAll(comp), listIngredients().then(setAllIngredients)]);
      })
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


  // I BOCCONCINI, e quali sono già dentro questa selezione.
  const fingers = useMemo(
    () => preparations.filter((p) => p.recipe_type === "finger"),
    [preparations]
  );
  const fingerDentro = useMemo(
    () =>
      new Map(
        recipeIngredients
          .filter((ri) => ri.component?.recipe_type === "finger")
          .map((ri) => [ri.component.id, ri])
      ),
    [recipeIngredients]
  );

  const totalPrepMin = useMemo(
    () => steps.reduce((sum, s) => sum + (s.duration_min || 0), 0),
    [steps]
  );
  const totalActiveMin = useMemo(
    () => steps.filter((s) => s.is_active_time).reduce((sum, s) => sum + (s.duration_min || 0), 0),
    [steps]
  );

  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch) return allIngredients;
    const q = ingredientSearch.toLowerCase();
    return allIngredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [allIngredients, ingredientSearch]);

  const filteredPreparations = useMemo(() => {
    if (!ingredientSearch) return preparations;
    const q = ingredientSearch.toLowerCase();
    return preparations.filter((p) => p.name.toLowerCase().includes(q));
  }, [preparations, ingredientSearch]);

  if (notFound) return <Navigate to="/ricettario/ricette" replace />;
  if (loading || !recipe) {
    return <p className="text-sm text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  // Preparazioni e finger: stessa forma (una resa, non delle porzioni).
  const isPreparazione = eComponente(recipe.recipe_type);
  // Il prezzo a pezzo invece è solo dei finger: su un piatto sarebbe un
  // secondo prezzo accanto a quello della carta, e il database lo rifiuta.
  const isFinger = recipe.recipe_type === "finger";

  const handleHeaderChange = (field, value) => setRecipe((r) => ({ ...r, [field]: value }));

  const toggleSeasonality = (value) => {
    setRecipe((r) => ({
      ...r,
      seasonality: r.seasonality.includes(value)
        ? r.seasonality.filter((v) => v !== value)
        : [...r.seasonality, value],
    }));
  };

  const saveHeader = async () => {
    // ⚠️ Due campi che svuotati diventavano zero, e lo zero qui non è una
    // risposta: si divide per quei numeri.
    // - le porzioni: `Number("")` fa 0, il database rifiutava con un
    //   messaggio suo («violates check constraint…»), che è un errore
    //   grezzo in faccia a chi ha solo cancellato un campo;
    // - la resa di una preparazione: senza, il costo della preparazione
    //   diventa un buco e SPARISCE da ogni ricetta che la usa — senza
    //   nessun errore, perché non è la ricetta che si sta modificando.
    const porzioni = Number(recipe.portions_yield);
    if (!isPreparazione && (!Number.isFinite(porzioni) || porzioni < 1)) {
      setError("Quante porzioni vengono da questa ricetta? Serve almeno 1: il costo per porzione si ottiene dividendo per questo numero.");
      return;
    }
    const resa = Number(recipe.yield_quantity);
    if (isPreparazione && (!Number.isFinite(resa) || resa <= 0)) {
      setError("Quanto ne viene da una dose? Senza la resa, il costo di questa preparazione sparisce da tutte le ricette che la usano.");
      return;
    }
    setSavingHeader(true);
    setError("");
    try {
      const saved = await updateRecipe(id, {
        name: recipe.name,
        category: recipe.category,
        subcategory: recipe.subcategory,
        seasonality: recipe.seasonality,
        portions_yield: isPreparazione ? 1 : porzioni,
        yield_quantity: isPreparazione ? resa : null,
        yield_unit: isPreparazione ? recipe.yield_unit : null,
        pronta_per_carta: recipe.pronta_per_carta,
        // `in_carta` NON si manda più: lo calcola il database dal menu.
        // Mandarlo sarebbe una scrittura che viene ignorata, cioè la cosa
        // che fa credere di aver deciso qualcosa.
        tags: recipe.tags,
        notes: recipe.notes,
        menu_description: recipe.menu_description,
        // ⚠️ Vuoto -> `null`, mai zero: zero vorrebbe dire «lo regalo».
        // E su una ricetta che non è un finger si manda `null` comunque,
        // altrimenti il database rifiuta con un messaggio suo.
        prezzo_al_pezzo:
          isFinger && String(recipe.prezzo_al_pezzo ?? "").trim() !== ""
            ? Number(recipe.prezzo_al_pezzo)
            : null,
      });
      setRecipe(saved);
      setCost(await getRecipeCost(id));
      setStatusHistory(await listRecipeStatusHistory(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingHeader(false);
    }
  };

  // ⚠️ «In carta» non si preme più: dal 16/08/2026 è un RIFLESSO del menu
  // (decisione di Alessio). Vale vero quando il piatto sta nel menu
  // attivo, lo scrive un trigger del database, e qui si legge soltanto.
  // Il pulsante c'era e adesso non c'è: due posti che dicono la stessa
  // cosa e possono contraddirsi sono un difetto, non una comodità.
  //
  // E per la stessa ragione qui non si spegne più «in carta» quando si
  // toglie «pronta per carta»: quella coerenza la teneva la schermata, e
  // ora la tiene il database — che RIFIUTA, dicendo in quale menu sta il
  // piatto. Spegnerla di nascosto sarebbe stato toglierlo dalla carta
  // senza toglierlo dal menu.
  const togglePronta = () => {
    setRecipe((r) => ({ ...r, pronta_per_carta: !r.pronta_per_carta }));
  };

  const handleAddIngredient = async () => {
    const componentMode = ingredientMode === "preparation";
    if (componentMode && (!ingredientForm.component_recipe_id || !ingredientForm.quantity)) return;
    if (!componentMode && (!ingredientForm.ingredient_id || !ingredientForm.quantity)) return;
    setAddingIngredient(true);
    setError("");
    try {
      await addRecipeIngredient(id, {
        ingredient_id: componentMode ? null : ingredientForm.ingredient_id,
        component_recipe_id: componentMode ? ingredientForm.component_recipe_id : null,
        quantity: Number(ingredientForm.quantity),
        unit: ingredientForm.unit,
        waste_percentage: ingredientForm.waste_percentage
          ? Number(ingredientForm.waste_percentage)
          : null,
        prep_note: ingredientForm.prep_note || null,
        is_optional: ingredientForm.is_optional,
      });
      setIngredientForm(emptyIngredientForm);
      setIngredientSearch("");
      await ricaricaRighe();
      setAllergens(await getRecipeAllergens(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingIngredient(false);
    }
  };

  const handleQuantityChange = async (ri, newQuantity) => {
    if (Number(newQuantity) === Number(ri.quantity)) return;
    try {
      await updateRecipeIngredient(ri.id, { quantity: Number(newQuantity) || 0 });
      await ricaricaRighe();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveIngredient = async (riId) => {
    try {
      await removeRecipeIngredient(riId);
      await ricaricaRighe();
      setAllergens(await getRecipeAllergens(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddStep = async () => {
    if (!stepForm.description.trim()) return;
    setAddingStep(true);
    setError("");
    try {
      await addRecipeStep(id, {
        step_number: steps.length + 1,
        phase: stepForm.phase,
        description: stepForm.description.trim(),
        technique: stepForm.technique || null,
        duration_min: stepForm.duration_min ? Number(stepForm.duration_min) : null,
        is_active_time: stepForm.is_active_time,
        temperature_c: stepForm.temperature_c || null,
        is_haccp_ccp: stepForm.is_haccp_ccp,
        haccp_limit: stepForm.is_haccp_ccp ? stepForm.haccp_limit || null : null,
        haccp_action: stepForm.is_haccp_ccp ? stepForm.haccp_action || null : null,
        equipment: stepForm.equipment || null,
      });
      setStepForm(emptyStepForm);
      setSteps(await listRecipeSteps(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingStep(false);
    }
  };

  const handleRemoveStep = async (stepId) => {
    try {
      await removeRecipeStep(stepId);
      setSteps(await listRecipeSteps(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMoveStep = async (index, direction) => {
    const other = steps[index + direction];
    if (!other) return;
    try {
      await swapStepOrder(steps[index], other);
      setSteps(await listRecipeSteps(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const ccpSteps = steps.filter((s) => s.is_haccp_ccp);

  const handleAddVideo = async () => {
    if (!videoUrl.trim()) return;
    setAddingVideo(true);
    setError("");
    try {
      await addRecipeVideo(id, { url: videoUrl.trim(), note: videoNote.trim() });
      setVideoUrl("");
      setVideoNote("");
      setVideos(await listRecipeVideos(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingVideo(false);
    }
  };

  // UN TOCCO METTE O TOGLIE UN BOCCONCINO, e il costo si rilegge subito.
  //
  // Scelta di Alessio (20/08/2026) fra le tre che gli sono state poste: la
  // spunta **salva davvero**, e il totale che compare sopra è quello del
  // gestionale — non un conto rifatto qui. ⚠️ Rifarlo nella schermata per
  // avere l'anteprima senza scrivere sarebbe **lo stesso numero calcolato in
  // due posti**, che è il difetto tolto da nove punti col mandato di
  // correzione: il giorno che uno dei due cambia, cominciano a dire due
  // cifre diverse e nessuno sa quale credere.
  //
  // ⚠️ La quantità non si chiede: un bocconcino per tipo. Se una volta ne
  // servissero due dello stesso, il numero si corregge nella riga qui sotto
  // — dove si correggono tutte le altre quantità, non in un secondo posto.
  const toggleFinger = async (finger) => {
    if (spuntando) return;
    setSpuntando(finger.id);
    setError("");
    try {
      const dentro = fingerDentro.get(finger.id);
      if (dentro) await removeRecipeIngredient(dentro.id);
      else
        await addRecipeIngredient(id, {
          component_recipe_id: finger.id,
          quantity: 1,
          unit: finger.yield_unit ?? "pz",
        });
      await ricaricaRighe();
    } catch (e) {
      setError(e.message);
    } finally {
      setSpuntando(null);
    }
  };

  // FAI UNA COPIA — richiesta di Alessio: «Selezione da 6» e «Selezione da
  // 8» si somigliano, e ricomporre da zero la seconda è lavoro ripetuto.
  //
  // ⚠️ Passa dal corridoio perché tocca tre tabelle: a metà resterebbe una
  // ricetta col nome giusto e dentro niente — nessun errore, e un costo di
  // zero euro con l'aria di essere un numero.
  const handleCopia = async () => {
    setCopiando(true);
    setError("");
    try {
      const esito = await duplicaRicetta(id, null);
      // ⚠️ Il messaggio VIAGGIA con lo spostamento, non resta qui: fra un
      // istante questa schermata non esiste più, e un avviso scritto qui
      // sparirebbe insieme a lei. Chi arriva sulla copia deve sapere cosa
      // c'è dentro senza contarlo — un «fatto» che non porta i numeri è la
      // stessa forma di una lettura tagliata che non si denuncia.
      navigate(`/ricettario/ricette/${esito.id}`, {
        state: {
          avviso: `Copia di «${recipe.name}»: dentro ci sono ${esito.righe} righe e ${esito.passi} passi. Il nome e «pronta per carta» non sono stati copiati.`,
        },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setCopiando(false);
    }
  };

  const handleRemoveVideo = async (videoId) => {
    try {
      await removeRecipeVideo(videoId);
      setVideos(await listRecipeVideos(id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to="/ricettario/ricette" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Ricette
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopia}
            disabled={copiando}
            className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-60"
          >
            {copiando ? "Copio…" : "Fai una copia"}
          </button>
          <PrintButton />
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      {avviso && (
        <p className="print:hidden text-sm text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2 my-4">
          {avviso}
        </p>
      )}

      {/* Intestazione */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <input
            value={recipe.name}
            onChange={(e) => handleHeaderChange("name", e.target.value)}
            className="font-display text-2xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none flex-1 min-w-[240px]"
          />
          <div className="text-right">
            <div className="text-2xl text-b58-charcoal font-medium">
              {cost ? formatEUR(cost.food_cost_portion) : "—"}
              <span className="text-sm text-b58-charcoal-soft"> / porzione</span>
            </div>
            <div className="text-xs text-b58-charcoal-soft">
              {cost ? formatEUR(cost.food_cost_base) : "—"} totale ricetta base
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              value={recipe.category}
              onChange={(e) => handleHeaderChange("category", e.target.value)}
              className={inputClass}
            >
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {isPreparazione ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Resa</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={recipe.yield_quantity ?? ""}
                  onChange={(e) => handleHeaderChange("yield_quantity", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Unità</label>
                <select
                  value={recipe.yield_unit ?? "kg"}
                  onChange={(e) => handleHeaderChange("yield_unit", e.target.value)}
                  className={inputClass}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass}>Porzioni base</label>
              <input
                type="number"
                min="1"
                value={recipe.portions_yield}
                onChange={(e) => handleHeaderChange("portions_yield", e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {/* 🔴 IL PREZZO A PEZZO — solo sui finger (19/08/2026, blocco 2 del
              mandato). Serve per i clienti che si scelgono i bocconcini uno
              per uno per un evento: la selezione ha il suo prezzo in carta,
              il singolo bocconcino ha il suo.
              ⚠️ Sta a schermo e non solo nel database perché un dato scritto
              che nessuno può vedere è indistinguibile da un dato non scritto
              (lezione del 18/08 sul legame conto-prenotazione).
              ⚠️ E vuoto vuol dire «non l'ho ancora deciso», non «gratis»: per
              questo si manda `null` e non zero. */}
          {isFinger && (
            <div>
              <label className={labelClass}>Prezzo a pezzo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={recipe.prezzo_al_pezzo ?? ""}
                onChange={(e) => handleHeaderChange("prezzo_al_pezzo", e.target.value)}
                className={inputClass}
              />
              <p className="text-[11px] text-b58-charcoal-soft/80 mt-1">
                Quanto costa questo bocconcino venduto da solo. Lascialo vuoto finché non l&apos;hai
                deciso: vuoto non vuol dire gratis.
              </p>
            </div>
          )}
        </div>

        <div className="mb-4">
          <span className="text-xs bg-b58-cream-dark text-b58-charcoal-soft rounded-full px-2.5 py-1">
            {labelFor(RECIPE_TYPES, recipe.recipe_type)}
          </span>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Stato</label>
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠️ SPENTO CON LA RAGIONE quando il piatto è in carta (difetto
                del collaudo, 17/08). Prima era premibile: si spegneva a
                schermo e il salvataggio veniva respinto dal database, che ha
                ragione — ma un pulsante che si può premere solo per essere
                rifiutato insegna a diffidare dei pulsanti. La stessa lezione
                del «Rimuovi» sulle fatture con una nota di credito. */}
            <button
              type="button"
              onClick={togglePronta}
              disabled={recipe.in_carta}
              title={
                recipe.in_carta
                  ? "È in carta nel menu attivo: prima togli il piatto dal menu, poi si può smettere di considerarlo pronto."
                  : undefined
              }
              className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                recipe.pronta_per_carta
                  ? "bg-b58-gold text-b58-parchment border-b58-gold"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              } ${recipe.in_carta ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {recipe.pronta_per_carta ? "✓ " : ""}Pronta per carta
            </button>
            {recipe.in_carta && (
              <span className="text-[11px] text-b58-charcoal-soft/80">
                non si toglie: è in carta nel menu attivo
              </span>
            )}
            {/* Non è un pulsante: è quello che il menu dice di questo
                piatto. Si accende mettendolo in un menu attivo, dall'Editor
                Menu. */}
            <span
              title="Si accende da sé quando il piatto è nel menu attivo. Si cambia dall'Editor Menu, non da qui."
              className={`rounded-full text-xs px-3 py-1.5 border ${
                recipe.in_carta
                  ? "bg-b58-olive text-b58-parchment border-b58-olive"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              {recipe.in_carta ? "✓ In carta" : "Non in carta"}
            </span>
            <span className="text-xs text-b58-charcoal-soft ml-1">
              {recipeStatusLabel(recipe.pronta_per_carta, recipe.in_carta).label}
            </span>
            {/* ⚠️ La strada per rimediare, che mancava (difetto n. 3 del
                collaudo, speculare al n. 1): l'app diceva «Pronta (non in
                carta)» — nominando esattamente ciò che manca — e non
                offriva il modo di farlo. «In carta» è un riflesso del menu
                dal 16/08, quindi il gesto non è qui: è mettere il piatto
                in un menu attivo. Quello che si può fare da questa
                schermata è portarci.
                ⚠️ E se il menu attivo non c'è, si dice quello invece di
                offrire un collegamento che non porta da nessuna parte —
                un vicolo cieco travestito da pulsante. */}
            {recipe.pronta_per_carta && !recipe.in_carta && (
              menuAttivo ? (
                <Link
                  to={`/ricettario/menu/${menuAttivo.id}?aggiungi=${recipe.id}`}
                  className="text-xs text-b58-terracotta underline hover:text-b58-terracotta-dark"
                >
                  mettila in «{menuAttivo.name}»
                </Link>
              ) : (
                <span className="text-xs text-b58-charcoal-soft/80">
                  nessun menu attivo: per metterla in carta serve prima un menu in servizio
                </span>
              )
            )}
            {statusHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs text-b58-charcoal-soft underline hover:text-b58-terracotta ml-auto"
              >
                {showHistory ? "Nascondi storico" : "Mostra storico"}
              </button>
            )}
          </div>
          {showHistory && (
            <ul className="mt-2 space-y-1 text-xs text-b58-charcoal-soft">
              {statusHistory.map((h) => (
                <li key={h.id}>
                  {formatDate(h.changed_at)} — {recipeStatusLabel(h.pronta_per_carta, h.in_carta).label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4">
          <label className={labelClass}>Descrizione per il menu</label>
          <textarea
            value={recipe.menu_description ?? ""}
            onChange={(e) => handleHeaderChange("menu_description", e.target.value)}
            rows={2}
            placeholder='Come appare sul menu cartaceo, es. "Fusilloni al ragù di polpo e polvere di prezzemolo"'
            className={inputClass}
          />
        </div>

        <div className="mb-4">
          <label className={labelClass}>Stagionalità</label>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSeasonality(s.value)}
                className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                  recipe.seasonality.includes(s.value)
                    ? "bg-b58-olive text-b58-parchment border-b58-olive"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {steps.length > 0 && (
              <span className="text-xs text-b58-charcoal-soft">
                ⏱ {totalPrepMin} min totali · {totalActiveMin} min attivi
              </span>
            )}
          </div>
          <button
            onClick={saveHeader}
            disabled={savingHeader}
            className="print:hidden rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            {savingHeader ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>

      {/* Ingredienti */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Ingredienti</h2>

        {/* I BOCCONCINI — un tocco mette, un tocco toglie.
            ⚠️ Si apre da sé se questa ricetta è già una selezione, e resta
            chiuso sugli altri piatti: una spiegazione o un pannello che c'è
            sempre diventa arredamento, e questa schermata si usa a lungo. */}
        {!isFinger && fingers.length > 0 && (
          <div className="print:hidden mb-4">
            <button
              onClick={() => setComponiAperto(!(componiAperto ?? fingerDentro.size > 0))}
              className="w-full flex items-center justify-between rounded-lg bg-white border border-b58-charcoal/10 px-3 py-2 text-sm"
            >
              <span className="text-b58-charcoal">
                Bocconcini
                {fingerDentro.size > 0 && (
                  <span className="text-b58-charcoal-soft"> · {fingerDentro.size} dentro</span>
                )}
              </span>
              <span className="text-b58-charcoal-soft text-xs">
                {(componiAperto ?? fingerDentro.size > 0) ? "chiudi" : "apri"}
              </span>
            </button>

            {(componiAperto ?? fingerDentro.size > 0) && (
              <div className="mt-2 rounded-lg bg-white border border-b58-charcoal/10 divide-y divide-b58-charcoal/5">
                {fingers.map((f) => {
                  const dentro = fingerDentro.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFinger(f)}
                      disabled={spuntando !== null}
                      className="tocco-riga w-full flex items-center gap-3 px-3 text-left disabled:opacity-60"
                    >
                      <span
                        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs ${
                          dentro
                            ? "bg-b58-olive border-b58-olive text-b58-parchment"
                            : "border-b58-charcoal/25 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="flex-1 text-sm text-b58-charcoal">{f.name}</span>
                      <span className="text-sm text-b58-charcoal-soft">
                        {formatEUR(costiFinger[f.id])}
                      </span>
                    </button>
                  );
                })}
                <div className="px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-b58-charcoal-soft">Costo della selezione</span>
                  <span className="text-b58-charcoal font-medium">
                    {cost ? formatEUR(cost.food_cost_base) : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {recipeIngredients.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Ingrediente</th>
                <th className="py-2 font-medium">Quantità</th>
                <th className="py-2 font-medium">% scarto</th>
                <th className="py-2 font-medium text-right">Costo</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recipeIngredients.map((ri) => {
                const isComponent = !!ri.component;
                const waste = isComponent
                  ? null
                  : ri.waste_percentage ?? ri.ingredient.waste_percentage_default ?? 0;
                // ⚠️ Il costo della riga arriva dal database, non si
                // ricalcola qui: era la stessa moltiplicazione che
                // `v_recipe_costs` faceva già, scritta una seconda volta.
                const rowCost = rowCosts[ri.id];
                return (
                  <tr key={ri.id} className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-2 text-b58-charcoal">
                      <Link
                        to={
                          isComponent
                            ? `/ricettario/ricette/${ri.component.id}`
                            : `/ricettario/ingredienti/${ri.ingredient.id}`
                        }
                        className="hover:text-b58-terracotta"
                      >
                        {isComponent ? ri.component.name : ri.ingredient.name}
                      </Link>
                      {/* ⚠️ Il componente si chiama col SUO nome: dal 19/08
                          può essere un bocconcino, e un'etichetta fissa
                          «preparazione» direbbe una cosa falsa. */}
                      {isComponent && (
                        <span className="text-[11px] text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5 ml-1.5">
                          {ri.component.recipe_type === "finger" ? "bocconcino" : "preparazione"}
                        </span>
                      )}
                      {ri.is_optional && (
                        <span className="text-xs text-b58-charcoal-soft ml-1.5">(opzionale)</span>
                      )}
                      {ri.prep_note && (
                        <div className="text-xs text-b58-charcoal-soft">{ri.prep_note}</div>
                      )}
                    </td>
                    <td className="py-2">
                      <CampoAutosalvato
                        type="number"
                        step="0.01"
                        value={ri.quantity}
                        onSave={(v) => handleQuantityChange(ri, v)}
                        className="w-20 rounded border border-b58-charcoal/15 px-2 py-1 text-sm"
                      />
                      <span className="text-b58-charcoal-soft ml-1">{ri.unit}</span>
                    </td>
                    <td className="py-2 text-b58-charcoal-soft">{isComponent ? "—" : `${waste}%`}</td>
                    <td className="py-2 text-right text-b58-charcoal">
                      {ri.is_optional ? (
                        <span className="text-b58-charcoal-soft/60">escluso</span>
                      ) : (
                        formatEUR(rowCost)
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRemoveIngredient(ri.id)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-xs"
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="print:hidden bg-white rounded-lg border border-b58-charcoal/10 p-3">
          {preparations.length > 0 && (
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setIngredientMode("ingredient");
                  setIngredientForm((f) => ({ ...f, component_recipe_id: "" }));
                }}
                className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                  ingredientMode === "ingredient"
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                Ingrediente
              </button>
              <button
                type="button"
                onClick={() => {
                  setIngredientMode("preparation");
                  setIngredientForm((f) => ({ ...f, ingredient_id: "" }));
                }}
                className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                  ingredientMode === "preparation"
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {/* ⚠️ Il cartellino dice quello che la tendina contiene
                    davvero: da qui si scelgono anche i bocconcini, e la
                    parola «Preparazione» da sola sarebbe piu' stretta del
                    vero. Si allarga solo quando i bocconcini esistono. */}
                {fingers.length > 0 ? "Preparazione o bocconcino" : "Preparazione"}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className="col-span-2 sm:col-span-1">
              <input
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                placeholder={ingredientMode === "preparation" ? "Cerca preparazione…" : "Cerca ingrediente…"}
                className={inputClass}
              />
              {ingredientMode === "preparation" ? (
                <select
                  value={ingredientForm.component_recipe_id}
                  onChange={(e) => {
                    const chosen = preparations.find((p) => p.id === e.target.value);
                    setIngredientForm((f) => ({
                      ...f,
                      component_recipe_id: e.target.value,
                      unit: chosen?.yield_unit ?? f.unit,
                    }));
                  }}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Seleziona…</option>
                  {filteredPreparations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.recipe_type === "finger" ? `${p.name} · bocconcino` : p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={ingredientForm.ingredient_id}
                  onChange={(e) => {
                    const chosen = allIngredients.find((i) => i.id === e.target.value);
                    setIngredientForm((f) => ({
                      ...f,
                      ingredient_id: e.target.value,
                      unit: chosen?.unit ?? f.unit,
                    }));
                  }}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Seleziona…</option>
                  {filteredIngredients.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ingredientForm.quantity}
              onChange={(e) => setIngredientForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="Quantità"
              className={inputClass}
            />
            <select
              value={ingredientForm.unit}
              onChange={(e) => setIngredientForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              <option value="">Unità</option>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            {ingredientMode === "preparation" ? (
              <div />
            ) : (
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={ingredientForm.waste_percentage}
                onChange={(e) => setIngredientForm((f) => ({ ...f, waste_percentage: e.target.value }))}
                placeholder="% scarto (default ingrediente)"
                className={inputClass}
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input
                type="checkbox"
                checked={ingredientForm.is_optional}
                onChange={(e) => setIngredientForm((f) => ({ ...f, is_optional: e.target.checked }))}
              />
              Guarnizione opzionale (esclusa dal food cost)
            </label>
            <button
              type="button"
              disabled={
                addingIngredient ||
                !ingredientForm.quantity ||
                (ingredientMode === "preparation"
                  ? !ingredientForm.component_recipe_id
                  : !ingredientForm.ingredient_id)
              }
              onClick={handleAddIngredient}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {addingIngredient ? "Aggiungo…" : "+ Aggiungi"}
            </button>
          </div>
        </div>
      </div>

      {/* Dove è usata questa preparazione */}
      {isPreparazione && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Dove è usata questa preparazione</h2>
          {preparationUsage.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">
              Non ancora usata come componente in altre ricette.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {preparationUsage.map((u) => (
                <li key={u.used_in_recipe_id} className="text-sm text-b58-charcoal-soft">
                  <Link
                    to={`/ricettario/ricette/${u.used_in_recipe_id}`}
                    className="text-b58-charcoal hover:text-b58-terracotta"
                  >
                    {u.used_in_recipe_name}
                  </Link>
                  {" — "}
                  {u.quantity} {u.unit}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Fasi di preparazione */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Fasi di preparazione</h2>

        {steps.length > 0 && (
          <ol className="space-y-2 mb-4">
            {steps.map((s, idx) => (
              <li
                key={s.id}
                className={`rounded-lg border p-3 ${
                  s.is_haccp_ccp ? "border-b58-terracotta bg-b58-terracotta/5" : "border-b58-charcoal/10 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium text-b58-charcoal-soft">
                        {idx + 1}. {labelFor(STEP_PHASES, s.phase)}
                      </span>
                      {s.technique && (
                        <span className="text-[11px] text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5">
                          {labelFor(COOKING_TECHNIQUES, s.technique)}
                        </span>
                      )}
                      {s.is_haccp_ccp && (
                        <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 font-medium">
                          CCP HACCP
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-b58-charcoal">{s.description}</p>
                    <p className="text-xs text-b58-charcoal-soft mt-1">
                      {s.duration_min ? `${s.duration_min} min` : ""}
                      {s.temperature_c ? ` · ${s.temperature_c}` : ""}
                      {s.equipment ? ` · ${s.equipment}` : ""}
                      {!s.is_active_time ? " · cottura passiva/riposo" : ""}
                    </p>
                    {s.is_haccp_ccp && (s.haccp_limit || s.haccp_action) && (
                      <p className="text-xs text-b58-terracotta-dark mt-1">
                        {s.haccp_limit && <>Limite: {s.haccp_limit}. </>}
                        {s.haccp_action && <>Azione correttiva: {s.haccp_action}.</>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <div className="flex gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, -1)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        disabled={idx === steps.length - 1}
                        onClick={() => handleMoveStep(idx, 1)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemoveStep(s.id)}
                      className="text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="print:hidden bg-white rounded-lg border border-b58-charcoal/10 p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={stepForm.phase}
              onChange={(e) => setStepForm((f) => ({ ...f, phase: e.target.value }))}
              className={inputClass}
            >
              {STEP_PHASES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={stepForm.technique}
              onChange={(e) => setStepForm((f) => ({ ...f, technique: e.target.value }))}
              className={inputClass}
            >
              <option value="">Tecnica (opzionale)</option>
              {COOKING_TECHNIQUES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={stepForm.duration_min}
              onChange={(e) => setStepForm((f) => ({ ...f, duration_min: e.target.value }))}
              placeholder="Durata (min)"
              className={inputClass}
            />
            <input
              value={stepForm.temperature_c}
              onChange={(e) => setStepForm((f) => ({ ...f, temperature_c: e.target.value }))}
              placeholder='Temperatura, es. "63°C"'
              className={inputClass}
            />
          </div>
          <textarea
            value={stepForm.description}
            onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descrizione della fase…"
            rows={2}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={stepForm.equipment}
              onChange={(e) => setStepForm((f) => ({ ...f, equipment: e.target.value }))}
              placeholder='Attrezzatura, es. "Roner"'
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input
                type="checkbox"
                checked={stepForm.is_active_time}
                onChange={(e) => setStepForm((f) => ({ ...f, is_active_time: e.target.checked }))}
              />
              Richiede presidio (tempo attivo)
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
            <input
              type="checkbox"
              checked={stepForm.is_haccp_ccp}
              onChange={(e) => setStepForm((f) => ({ ...f, is_haccp_ccp: e.target.checked }))}
            />
            Punto Critico di Controllo HACCP
          </label>

          {stepForm.is_haccp_ccp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={stepForm.haccp_limit}
                onChange={(e) => setStepForm((f) => ({ ...f, haccp_limit: e.target.value }))}
                placeholder='Limite critico, es. "T ≥ 75°C per 15 sec"'
                className={inputClass}
              />
              <input
                value={stepForm.haccp_action}
                onChange={(e) => setStepForm((f) => ({ ...f, haccp_action: e.target.value }))}
                placeholder="Azione correttiva"
                className={inputClass}
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={addingStep || !stepForm.description.trim()}
              onClick={handleAddStep}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {addingStep ? "Aggiungo…" : "+ Aggiungi fase"}
            </button>
          </div>
        </div>
      </div>

      {/* Video ricetta */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Video ricetta</h2>
        <p className="text-xs text-b58-charcoal-soft/70 mb-4">
          Link a video Instagram/TikTok — nessun upload, nessuna estrazione automatica di
          ingredienti/passaggi per ora.
        </p>

        {videos.length > 0 && (
          <ul className="space-y-2 mb-4">
            {videos.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-b58-terracotta hover:text-b58-terracotta-dark break-all"
                  >
                    {v.url}
                  </a>
                  <div className="text-xs text-b58-charcoal-soft">
                    {labelFor(VIDEO_PLATFORMS, v.platform)}
                    {v.note ? ` · ${v.note}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveVideo(v.id)}
                  className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark shrink-0"
                >
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="print:hidden flex flex-wrap gap-2 bg-white rounded-lg border border-b58-charcoal/10 p-3">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Link Instagram o TikTok…"
            className={`${inputClass} flex-1 min-w-[200px]`}
          />
          <input
            value={videoNote}
            onChange={(e) => setVideoNote(e.target.value)}
            placeholder="Nota (opzionale)"
            className={`${inputClass} flex-1 min-w-[160px]`}
          />
          <button
            type="button"
            disabled={addingVideo || !videoUrl.trim()}
            onClick={handleAddVideo}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
          >
            {addingVideo ? "Aggiungo…" : "+ Aggiungi video"}
          </button>
        </div>
      </div>

      {/* HACCP e Allergeni */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">HACCP e Allergeni</h2>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Allergeni (auto-calcolati dagli ingredienti)
          </p>
          {allergens.daVerificare && (
            <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>Non verificato.</strong> Allergeni solo stimati (o mai guardati) su:{" "}
              {allergens.ingredienti.join(", ")}. Finché è così, questo piatto non stampa
              l&apos;elenco allergeni sul menu.
            </p>
          )}
          {allergens.allergens.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">
              {allergens.daVerificare ? "Nessuno risulta, ma nessuno l'ha guardato." : "Nessuno."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergens.allergens.map((a) => (
                <span
                  key={a}
                  className="text-xs bg-b58-terracotta/10 text-b58-terracotta-dark rounded-full px-2.5 py-1"
                >
                  {labelFor(ALLERGENS, a)}
                </span>
              ))}
            </div>
          )}
          {allergens.tracce.length > 0 && (
            <p className="mt-2 text-sm text-b58-charcoal-soft">
              <strong>Può contenere tracce di:</strong>{" "}
              {allergens.tracce.map((a) => labelFor(ALLERGENS, a)).join(", ")}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Punti Critici di Controllo
          </p>
          {ccpSteps.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">
              Nessun CCP definito nelle fasi.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ccpSteps.map((s) => (
                <li key={s.id} className="text-sm text-b58-charcoal-soft">
                  <span className="text-b58-charcoal">{s.description}</span>
                  {s.haccp_limit && <> — limite: {s.haccp_limit}</>}
                  {s.haccp_action && <>, azione: {s.haccp_action}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
