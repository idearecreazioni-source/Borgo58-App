import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  duplicaRicetta,
  getRecipe,
  getRecipeAllergens,
  getRecipeCost,
  listPreparationUsage,
  listPreparations,
  listRecipeAllergensFor,
  listRecipeCostsFor,
  listRecipeStatusHistory,
  prezzoBis,
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
import { percorsoEntrando, ritornoIndietro } from "../../lib/calcoli/percorso";
import { useAuth } from "../../context/AuthContext";
import { addMenuItem, listMenus, menuDellaRicetta, removeMenuItem } from "../../lib/api/menus";
import { addRecipeVideo, listRecipeVideos, removeRecipeVideo } from "../../lib/api/recipeVideos";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import PrintButton from "../../components/PrintButton";
import AllergeniDelPiatto from "../../components/AllergeniDelPiatto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import {
  ALLERGENS,
  COOKING_TECHNIQUES,
  RECIPE_CATEGORIES,
  RECIPE_STATI,
  RECIPE_TYPES,
  eComponente,
  eFingerFood,
  statoRicetta,
  SEASONS,
  STEP_PHASES,
  UNITS,
  VIDEO_PLATFORMS,
  formatDate,
  formatEUR,
  formatPercento,
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
  const { isTitolare } = useAuth();

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
  const [menuDentro, setMenuDentro] = useState([]);
  const [salvandoMenu, setSalvandoMenu] = useState(null);
  const [erroreMenu, setErroreMenu] = useState("");
  const [bis, setBis] = useState(null);
  const statoNavigazione = useLocation().state;
  const avviso = statoNavigazione?.avviso ?? "";

  // IL PERCORSO INVERSO (24/08/2026). ⚠️ La regola sta in un posto solo
  // (`src/lib/calcoli/percorso.js`) perché i punti da cui si scende in
  // un'altra ricetta sono tre — i componenti, le ricette che la usano e il
  // menu — e tre copie della stessa catena divergono alla prima modifica.
  const percorso = statoNavigazione?.percorso ?? [];
  const indietro = ritornoIndietro(percorso, {
    elenco: "/ricettario/ricette",
    etichettaElenco: "Ricette",
  });
  // Il passo da lasciare a chi da qui scende di un livello.
  const passoDaQui = (nome) => ({ percorso: percorsoEntrando(percorso, { id, nome }) });
  const [preparationUsage, setPreparationUsage] = useState([]);
  const [rowCosts, setRowCosts] = useState({});

  const [savingHeader, setSavingHeader] = useState(false);
  const [ingredientMode, setIngredientMode] = useState("ingredient");
  // ⚠️ SU UNA SELEZIONE IL MODO È DECISO, non scelto: dentro ci vanno solo
  // finger, quindi il pannello lavora sempre in modalità «componente» e la
  // ricerca guarda solo loro. Il valore scelto a mano resta per gli altri
  // piatti — non si tocca uno stato che su questa scheda non si vede.
  const modoRighe = eFingerFood(recipe?.category) ? "preparation" : ingredientMode;
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
  // ⚠️ E i costi dei finger si rileggono INSIEME (20/08/2026): il
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

    // 🔴 IN FONDO, E CON LA SUA RETE — difetto trovato aprendo la schermata
    // il 24/08, non rileggendo il codice (lint e build erano puliti).
    // Scritta qui sopra, prima di `setRecipe`, e con una colonna sbagliata
    // dentro, questa lettura mandava la richiesta in errore e si portava
    // via **tutta la scheda della ricetta**: nessun ingrediente, nessun
    // passo, nessun costo, «Caricamento…» per sempre.
    //
    // ⚠️ È la lezione del 18/08 in un posto nuovo: se una lettura che serve
    // a un pannello può far sparire la schermata intera, il difetto è nel
    // modo in cui è legata, non nella lettura. Qui il caso peggiore è un
    // pannello dei menu vuoto, che è quello che deve essere.
    //
    // ⚠️ Solo per il titolare: `menu_items` porta i prezzi di vendita, e il
    // pannello non compare allo staff. Chiederli comunque produrrebbe un
    // rifiuto a ogni apertura della scheda di una ricetta.
    if (isTitolare) {
      try {
        setMenuDentro(await menuDellaRicetta(id));
      } catch (e) {
        // ⚠️ E non si tace: «non lo so» non è «non c'è nessun menu» (19/08).
        setErroreMenu(`Non sono riuscito a leggere i menu: ${e.message}`);
      }
      // Il prezzo del bis, solo per un finger. ⚠️ Stessa rete e per la
      // stessa ragione: se non arriva, resta senza proposta — non deve
      // portarsi via la scheda.
      if (rec.recipe_type === "finger") {
        try {
          setBis(await prezzoBis(id));
        } catch {
          setBis(null);
        }
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // ⚠️ L'elenco dei componenti si legge PRIMA e si passa avanti: da lì si
    // ricavano quali sono i finger, e senza, la prima lettura dei costi
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
  // I filtri del pannello con cui si compone una selezione (blocco 3(a)).
  const [cercaFinger, setCercaFinger] = useState("");
  const [categoriaFinger, setCategoriaFinger] = useState("");
  const [senzaAllergeneFinger, setSenzaAllergeneFinger] = useState("");

  // I finger che compongono QUESTA selezione, in ordine di nome: l'elenco
  // su cui si legge dove sta ogni allergene (blocco 3(g)).
  const fingerDelPiatto = useMemo(
    () =>
      [...fingerDentro.values()]
        .map((ri) => ri.component)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [fingerDentro]
  );

  // 🔴 GLI ALLERGENI DI TUTTI I FINGER, in una lettura sola. Servono a due
  // cose che devono dire lo stesso: il filtro «senza …» del pannello con cui
  // si compone la selezione, e l'elenco «dove stanno, finger per finger».
  // Due letture separate divergerebbero appena qualcuno cambia un
  // ingrediente, e a restare indietro sarebbe quella che nessuno guarda.
  const [allergeniFinger, setAllergeniFinger] = useState(null);
  useEffect(() => {
    const ids = fingers.map((f) => f.id);
    if (ids.length === 0) {
      setAllergeniFinger(null);
      return;
    }
    let annullato = false;
    // ⚠️ `leggi()` E NON UN `.catch(() => ({}))`: una mappa vuota si
    // leggerebbe «nessun finger ha allergeni», che è la frase più
    // pericolosa che questa schermata possa scrivere. Con NON_LETTO il
    // filtro «senza …» si spegne e l'elenco dice che non li ha letti,
    // invece di nascondere righe per un guasto di rete (regola del 20/08).
    leggi(listRecipeAllergensFor(ids)).then((m) => !annullato && setAllergeniFinger(m));
    return () => {
      annullato = true;
    };
  }, [fingers]);

  // I finger che passano i filtri.
  const fingerFiltrati = useMemo(() => {
    let elenco = fingers;
    if (cercaFinger.trim()) {
      const q = cercaFinger.trim().toLowerCase();
      elenco = elenco.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (categoriaFinger) elenco = elenco.filter((f) => f.category === categoriaFinger);
    if (senzaAllergeneFinger && allergeniFinger && !nonLetto(allergeniFinger)) {
      elenco = elenco.filter((f) => {
        const a = allergeniFinger[f.id];
        // 🔴 CHI NON SI SA NON È «SENZA» — stessa regola dell'elenco delle
        // ricette (19/08). Un finger i cui allergeni nessuno ha confermato
        // non può comparire fra i «senza glutine»: sarebbe dire a un celiaco
        // che è sicuro quando nessuno l'ha guardato.
        if (!a || a.daVerificare) return false;
        return !(a.allergens ?? []).includes(senzaAllergeneFinger);
      });
    }
    return elenco;
  }, [fingers, cercaFinger, categoriaFinger, senzaAllergeneFinger, allergeniFinger]);

  // Quanti restano fuori PERCHÉ NON SI SA, invece che perché ce l'hanno: è
  // la ragione per andare a compilare quelle schede, e senza il numero
  // nessuno la trova.
  const fingerSenzaAllergeniNoti = useMemo(() => {
    if (!senzaAllergeneFinger || !allergeniFinger || nonLetto(allergeniFinger)) return 0;
    return fingers.filter((f) => !allergeniFinger[f.id] || allergeniFinger[f.id].daVerificare)
      .length;
  }, [fingers, senzaAllergeneFinger, allergeniFinger]);

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

  // 🔴 SU UNA SELEZIONE SI CERCA SOLO FRA I FINGER (24/08, richiesta di
  // Alessio): *«in un piatto di finger food ci vanno SOLO finger, quindi
  // deve cercare solo quelli»*. Prima la tendina proponeva tutte le
  // preparazioni del ricettario — quarantuno, su una schermata dove ne
  // servono venti di un tipo solo.
  const filteredPreparations = useMemo(() => {
    const base = eFingerFood(recipe?.category)
      ? preparations.filter((p) => p.recipe_type === "finger")
      : preparations;
    if (!ingredientSearch) return base;
    const q = ingredientSearch.toLowerCase();
    return base.filter((p) => p.name.toLowerCase().includes(q));
  }, [preparations, ingredientSearch, recipe?.category]);

  if (notFound) return <Navigate to="/ricettario/ricette" replace />;
  if (loading || !recipe) {
    return <p className="testo-sala-grande text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  // Preparazioni e finger: stessa forma (una resa, non delle porzioni).
  const isPreparazione = eComponente(recipe.recipe_type);
  // Il prezzo a pezzo invece è solo dei finger: su un piatto sarebbe un
  // secondo prezzo accanto a quello della carta, e il database lo rifiuta.
  const isFinger = recipe.recipe_type === "finger";

  // 🔴 UN PIATTO DI FINGER FOOD NON È UNA RICETTA NORMALE (24/08/2026,
  // blocco 3 del mandato del collaudo): *«la sua scheda deve smettere di
  // comportarsi come tale»*. Non ha ingredienti ma FINGER, non ha fasi (le
  // fasi stanno dentro i singoli bocconcini), non ha una stagionalità sua e
  // i minuti che compariva sotto erano la somma dei tempi delle fasi — cioè
  // zero, presentato come un dato.
  //
  // ⚠️ La domanda è sulla CATEGORIA e non su «contiene finger»: un piatto
  // di finger food è tale perché Alessio l'ha messo lì, non perché dentro
  // ci sia finito un bocconcino.
  const isFingerFood = eFingerFood(recipe.category);

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

  // ⚠️ «In carta» non si preme: dal 16/08/2026 è un RIFLESSO del menu
  // (decisione di Alessio). Vale vero quando il piatto sta nel menu
  // attivo, lo scrive un trigger del database, e qui si legge soltanto.
  // Due posti che dicono la stessa cosa e possono contraddirsi sono un
  // difetto, non una comodità.
  //
  // E per la stessa ragione qui non si spegne «in carta» quando si toglie
  // «pronta per la carta»: quella coerenza la teneva la schermata, e ora la
  // tiene il database — che RIFIUTA, dicendo in quale menu sta il piatto.
  // Spegnerla di nascosto sarebbe stato toglierlo dalla carta senza
  // toglierlo dal menu.
  //
  // ⚠️ IL CAMBIO DI STATO NON PASSA PIÙ DAL «Salva modifiche» (24/08): la
  // striscia scrive subito. Prima si spuntava «pronta» e poi bisognava
  // ricordarsi di salvare — e chi usciva dalla schermata perdeva il gesto
  // senza nessun avviso, che è la stessa famiglia del campo che salva solo
  // `onBlur`.

  // I QUATTRO STATI, un gesto per ciascuno (24/08/2026).
  //
  // ⚠️ TRE DEI QUATTRO SI SCRIVONO QUI e uno no: «in carta» è un riflesso
  // del menu (16/08), quindi toccarlo non lo accende — porta dove si
  // accende. Fargli fare finta di essere un interruttore vorrebbe dire che
  // premendolo non succede niente, oppure che la schermata scrive una
  // colonna che solo un trigger deve scrivere.
  const vaiAllostato = async (stato) => {
    setError("");
    try {
      if (stato === "in_sviluppo") {
        await salvaStato({ pronta_per_carta: false, ritirata_il: null });
      } else if (stato === "pronta") {
        await salvaStato({ pronta_per_carta: true, ritirata_il: null });
      } else if (stato === "ritirata") {
        await salvaStato({ ritirata_il: new Date().toISOString() });
      } else if (stato === "in_carta") {
        // Non si scrive: si porta dove si decide. Il pannello dei menu è
        // qui sotto, e mettere il piatto in quello in servizio accende il
        // riflesso da sé.
        document.getElementById("nei-menu")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (e) {
      // ⚠️ Il messaggio arriva dal DATABASE e si mostra com'è: è lì che
      // vive la regola («toglila prima dal menu X»), e riscriverlo qui
      // vorrebbe dire tenerne allineate due versioni.
      setError(e.message);
    }
  };

  const salvaStato = async (campi) => {
    const aggiornata = await updateRecipe(id, campi);
    setRecipe((r) => ({ ...r, ...aggiornata }));
    setStatusHistory(await listRecipeStatusHistory(id));
  };

  // Perché uno stato non si può raggiungere da qui — la ragione, non il
  // divieto. ⚠️ Ogni frase dice anche COSA FARE PRIMA: un rifiuto senza
  // via d'uscita è un vicolo cieco (difetto n. 8 del mandato di correzione).
  const motivoStato = (stato, r, menuInServizio) => {
    if (stato === "in_carta") {
      if (r.ritirata_il)
        return { stato, impedito: "È ritirata: rimettila in giro, poi potrà tornare in carta." };
      if (!r.pronta_per_carta)
        return {
          stato,
          impedito: "Per andare in carta dev'essere prima segnata «pronta per la carta».",
        };
      if (!menuInServizio)
        return {
          stato,
          impedito: "Non c'è nessun menu in servizio: per andare in carta serve prima un menu acceso.",
        };
      return { stato, aiuto: "Mettila nel menu in servizio, qui sotto." };
    }
    if (stato === "ritirata" && r.in_carta) {
      return { stato, impedito: "È in carta: toglila prima dal menu in servizio, poi si ritira." };
    }
    if ((stato === "in_sviluppo" || stato === "pronta") && r.in_carta) {
      return { stato, impedito: "È in carta: toglila prima dal menu in servizio." };
    }
    return { stato };
  };

  const cambiaMenu = async (m) => {
    setErroreMenu("");
    setSalvandoMenu(m.id);
    try {
      if (m.voce) {
        await removeMenuItem(m.voce.id);
      } else {
        // ⚠️ Il prezzo nasce VUOTO e non a zero: 0,00 non è «gratis», è
        // «non prezzato» — è la lezione delle piccolezze del 16/08. Ma
        // `selling_price` è obbligatorio nel database, quindi si parte dal
        // food cost, che è il numero da cui si parte davvero per decidere
        // un prezzo, e si corregge dall'Editor Menu.
        await addMenuItem(m.id, {
          recipe_id: id,
          category: recipe.category,
          selling_price: cost?.food_cost_portion ?? 0,
        });
      }
      setMenuDentro(await menuDellaRicetta(id));
      // ⚠️ Il riflesso «in carta» lo ricalcola un trigger: la ricetta si
      // rilegge dal database invece di indovinare come è cambiata.
      setRecipe(await getRecipe(id));
    } catch (e) {
      setErroreMenu(e.message);
    } finally {
      setSalvandoMenu(null);
    }
  };

  const handleAddIngredient = async () => {
    const componentMode = modoRighe === "preparation";
    // ⚠️ SU UNA SELEZIONE LA QUANTITÀ È UNA E NON SI CHIEDE: è sempre un
    // pezzo per tipo, e il valore lo mette la stessa regola che lo mette
    // spuntando il finger nel pannello sopra — non due regole diverse per
    // due strade che aggiungono la stessa cosa.
    const suSelezione = eFingerFood(recipe?.category);
    const quanti = suSelezione ? 1 : Number(ingredientForm.quantity);
    const unita = suSelezione
      ? (preparations.find((p) => p.id === ingredientForm.component_recipe_id)?.yield_unit ?? "pz")
      : ingredientForm.unit;
    if (componentMode && !ingredientForm.component_recipe_id) return;
    if (!componentMode && !ingredientForm.ingredient_id) return;
    if (!suSelezione && !ingredientForm.quantity) return;
    setAddingIngredient(true);
    setError("");
    try {
      await addRecipeIngredient(id, {
        ingredient_id: componentMode ? null : ingredientForm.ingredient_id,
        component_recipe_id: componentMode ? ingredientForm.component_recipe_id : null,
        quantity: quanti,
        unit: unita,
        waste_percentage: ingredientForm.waste_percentage
          ? Number(ingredientForm.waste_percentage)
          : null,
        prep_note: ingredientForm.prep_note || null,
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
  // ⚠️ La quantità non si chiede: un finger per tipo. Se una volta ne
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
        {/* ⚠️ IL RITORNO NOMINA IL PASSO PRECEDENTE, e non è un vezzo: a tre
            livelli di annidamento una freccia muta è una scommessa su dove
            si finisce. Senza percorso resta «← Ricette», cioè il
            comportamento di prima — un indirizzo copiato e incollato arriva
            senza percorso, e lì l'elenco è la risposta giusta. */}
        <Link
          to={indietro.a}
          state={{ percorso: indietro.percorso }}
          className="tocco-riga inline-flex items-center px-2 -mx-2 rounded-lg testo-sala text-b58-charcoal-soft hover:text-b58-terracotta hover:bg-b58-cream-dark/40 transition-colors"
        >
          ← {indietro.etichetta}
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopia}
            disabled={copiando}
            className="tocco-testo testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-60"
          >
            {copiando ? "Copio…" : "Fai una copia"}
          </button>
          <PrintButton />
        </div>
      </div>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      {avviso && (
        <p className="print:hidden testo-sala-grande text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2 my-4">
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
              <span className="testo-sala-grande text-b58-charcoal-soft"> / porzione</span>
            </div>
            <div className="testo-sala text-b58-charcoal-soft">
              {cost ? formatEUR(cost.food_cost_base) : "—"} totale ricetta base
            </div>
            {/* 🔴 IL REGISTRO «COM'È CAMBIATO» È TOLTO — decisione di
                Alessio del 27/08: non gli serve.
                ⚠️ E le righe si leggevano AL CONTRARIO: «Aggiunto Caponata
                   — 6,12 €» dove 6,12 era il totale del PIATTO dopo
                   l'aggiunta, non il costo della caponata. La decisione è
                   toglierlo, non riscriverlo: un dato che non serve non
                   migliora diventando corretto.
                ⚠️ Lo storico resta NEL DATABASE e continua a riempirsi: a
                   sparire è solo la schermata che lo mostrava. */}
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
              mandato). Serve per i clienti che si scelgono i finger uno
              per uno per un evento: la selezione ha il suo prezzo in carta,
              il singolo finger ha il suo.
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
              {/* 🔴 IL PREZZO SI PROPONE (24/08, richiesta di Alessio:
                  *«hai già i food cost di ognuno, quindi proponimi il prezzo
                  giusto invece di farmi perdere margine sui finger cari»*).
                  ⚠️ Il numero NON è arrotondato: il taglio con cui si
                  scrivono i prezzi in un menu è una decisione commerciale
                  sua, e arrotondare al posto suo farebbe comparire un
                  numero che nessuno ha deciso. Si dice da dove viene.
                  ⚠️ E accanto c'è la domanda vera dietro la sua frase — non
                  «quanto chiedo» ma «su questo sto perdendo margine?»: il
                  food cost che il prezzo già scritto produce davvero. */}
              {bis && (
                <p className="testo-sala text-b58-charcoal-soft/80 mt-1">
                  {bis.proposto != null && (
                    <>
                      Con un food cost del {formatPercento(bis.obiettivo_percento, 0)} verrebbe{" "}
                      <button
                        type="button"
                        onClick={() => handleHeaderChange("prezzo_al_pezzo", String(bis.proposto))}
                        className="underline text-b58-terracotta hover:text-b58-terracotta-dark"
                      >
                        {formatEUR(bis.proposto)}
                      </button>{" "}
                      (costa {formatEUR(bis.food_cost)}).{" "}
                    </>
                  )}
                  {bis.food_cost_scritto != null && (
                    <>A {formatEUR(bis.scritto)} il food cost è il {formatPercento(bis.food_cost_scritto)}.</>
                  )}
                  {bis.avvertenza && (
                    <span className="text-b58-terracotta-dark"> {bis.avvertenza}</span>
                  )}
                </p>
              )}
              <p className="testo-sala text-b58-charcoal-soft/80 mt-1">
                Quanto costa questo finger venduto da solo — è il prezzo del bis, quando un
                cliente ne chiede uno in più. Lascialo vuoto finché non l&apos;hai deciso: vuoto
                non vuol dire gratis.
              </p>
            </div>
          )}
        </div>

        <div className="mb-4">
          <span className="testo-sala bg-b58-cream-dark text-b58-charcoal-soft rounded-full px-2.5 py-1">
            {labelFor(RECIPE_TYPES, recipe.recipe_type)}
          </span>
        </div>

        {/* LA STRISCIA DEGLI STATI — riscritta il 24/08/2026 su richiesta di
            Alessio: *«oggi è confusa e ci sono due file che dicono cose
            simili. Voglio UNA striscia sola con quattro stati»*.
            🔴 Le due file erano: una pastiglia premibile «Pronta per
            carta», una pastiglia non premibile «In carta / Non in carta»,
            e accanto un'etichetta di testo che ripeteva la stessa cosa in
            terza forma. Tre modi di dire lo stesso fatto, di cui uno solo
            era un gesto.
            ⚠️ ORA IL PERCORSO SI VEDE: quattro passi in fila nell'ordine in
            cui un piatto li attraversa. Il passo su cui sta il piatto è
            acceso; gli altri sono premibili quando ci si può andare, e
            spenti CON LA RAGIONE quando no — un pulsante premibile solo per
            essere rifiutato insegna a diffidare dei pulsanti (17/08).
            ⚠️ E «In carta» NON è un interruttore: è il riflesso del menu
            (16/08). Toccarlo non lo accende — porta dove si accende, cioè
            fra i menu qui sotto. Se facesse finta di essere un interruttore
            mentirebbe sulla natura del dato. */}
        <div className="mb-4">
          {/* 🔴 L'ETICHETTA DICE IL VALORE — 27/08/2026, e nasce da una cosa
              vista da Alessio col telefono: su «Agnello con carciofi» ha
              letto «Pronta per la carta» mentre il piatto era in carta.
              ⚠️ IL GESTIONALE NON SI CONTRADDICEVA. Misurato: il database
                 era coerente (in_carta=true, in un menu attivo, ZERO
                 disaccordi su tutte le ricette) e la striscia mostrava
                 «✓ In carta» acceso. Ma a 375 punti i quattro stati vanno
                 su DUE righe, e «Pronta per la carta» finisce sulla PRIMA,
                 sopra quello vero. Chi guarda in fretta legge la prima.
              ⚠️ La cura non è toccare la striscia — quattro stati in fila
                 sono una decisione di Alessio del 24/08, e l'ordine è il
                 percorso di un piatto. È dire con le PAROLE quello che
                 oggi dice solo un colore: la stessa lezione della chiave
                 della Scorciatoia, imparata lo stesso giorno.
              ⚠️ E risolve anche il pulsante che «non risponde»: premendo lo
                 stato in cui SI È GIÀ non succede niente ed è giusto, ma
                 finché l'etichetta non lo dice sembra un guasto. */}
          <label className={labelClass}>
            Stato:{" "}
            <span className="font-semibold normal-case tracking-normal text-b58-charcoal">
              {recipeStatusLabel(recipe.pronta_per_carta, recipe.in_carta, recipe.ritirata_il)
                ?.label ?? "—"}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {RECIPE_STATI.map((s) => {
              const attuale = statoRicetta(
                recipe.pronta_per_carta,
                recipe.in_carta,
                recipe.ritirata_il
              );
              const acceso = s.value === attuale;
              const info = motivoStato(s.value, recipe, menuAttivo);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => vaiAllostato(s.value)}
                  disabled={acceso || !!info.impedito}
                  title={info.impedito || info.aiuto}
                  className={`tocco-riga rounded-full testo-sala px-3 border transition-colors ${
                    acceso
                      ? `${s.colorClass} text-b58-parchment border-transparent font-medium`
                      : "border-b58-charcoal/15 text-b58-charcoal-soft hover:border-b58-charcoal/40"
                  } ${info.impedito && !acceso ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {acceso ? "✓ " : ""}
                  {s.label}
                </button>
              );
            })}
            {statusHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="tocco-riga testo-sala text-b58-charcoal-soft underline hover:text-b58-terracotta ml-auto px-2"
              >
                {showHistory ? "Nascondi storico" : "Mostra storico"}
              </button>
            )}
          </div>

          {/* ⚠️ La ragione dello stato spento si legge SENZA passarci sopra
              col dito: su un tablet non esiste il puntatore fermo, quindi
              un `title` da solo è un'informazione che nessuno vedrà mai.

              🔴 E DAL 24/08 SI VEDE CHE È UNA PROTEZIONE, non un guasto —
              rilievo di Alessio dopo averla incontrata: *«la PROTEZIONE È
              GIUSTA e non va toccata. Il difetto è che non l'ho capita al
              primo sguardo: ho pensato che i pulsanti fossero rotti»*.
              Quattro pastiglie spente e una riga grigia sotto si leggono
              «non funziona»; un lucchetto con dentro il gesto che sblocca
              si legge «è chiuso a chiave, ed ecco la chiave».

              ⚠️ E LA CHIAVE È LÌ DENTRO, non altrove: il piatto si toglie
              dal menu in servizio da questo stesso riquadro, col nome del
              menu scritto sopra. Prima la frase diceva «toglila dal menu in
              servizio» e lasciava cercare quale — il pannello dei menu è
              trecento punti più in basso e non nomina il blocco. */}
          {(() => {
            const attuale = statoRicetta(
              recipe.pronta_per_carta,
              recipe.in_carta,
              recipe.ritirata_il
            );
            const bloccati = RECIPE_STATI.map((s) => motivoStato(s.value, recipe, menuAttivo))
              .filter((i) => i.impedito && i.stato !== attuale)
              .map((i) => i.impedito);
            if (bloccati.length === 0) return null;

            // Il menu in servizio che contiene questo piatto: è quello da
            // cui va tolto. ⚠️ Può non esserci (il blocco è un altro, es.
            // «prima segnala pronta»), e allora si mostra solo la ragione.
            const menuChePubblica = menuDentro.find((m) => m.is_active && m.voce);

            return (
              <div className="mt-2 rounded-lg bg-b58-gold/15 ring-1 ring-b58-gold-dark/30 px-3 py-2">
                <p className="testo-sala text-b58-charcoal">
                  <strong>🔒 Bloccato apposta.</strong> {bloccati[0]}
                </p>
                {menuChePubblica && isTitolare && (
                  <button
                    type="button"
                    disabled={salvandoMenu === menuChePubblica.id}
                    onClick={() => cambiaMenu(menuChePubblica)}
                    className="tocco-riga mt-1.5 rounded-lg bg-b58-charcoal text-b58-parchment testo-sala px-3 disabled:opacity-60"
                  >
                    {salvandoMenu === menuChePubblica.id
                      ? "Tolgo…"
                      : `Togli da «${menuChePubblica.name}» e sblocca`}
                  </button>
                )}
              </div>
            );
          })()}

          {recipe.ritirata_il && (
            <p className="testo-sala text-b58-charcoal-soft mt-1.5">
              Ritirata il {formatDate(recipe.ritirata_il)}. Resta qui con la sua storia: non è
              stata cancellata.
            </p>
          )}

          {showHistory && (
            <ul className="mt-2 space-y-1 testo-sala text-b58-charcoal-soft">
              {statusHistory.map((h) => (
                <li key={h.id}>
                  {formatDate(h.changed_at)} —{" "}
                  {recipeStatusLabel(h.pronta_per_carta, h.in_carta, null).label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* IN QUALI MENU VA QUESTA RICETTA (24/08, richiesta di Alessio).
            ⚠️ Prima c'era una strada sola — «mettila nel menu attivo» — e
            per ogni altro menu bisognava passare dall'Editor Menu e cercare
            lì il piatto. Qui si vede dove sta e si mette dove serve.
            ⚠️ Non è un secondo registro: legge e scrive `menu_items`, la
            stessa tabella dell'Editor Menu. */}
        {isTitolare && recipe.recipe_type === "piatto_finito" && (
          <div className="mb-4" id="nei-menu">
            <label className={labelClass}>Nei menu</label>
            {/* ⚠️ «NON LO SO» NON È «NON C'È NIENTE» (19/08): se la lettura
                è fallita, un elenco vuoto direbbe con calma che non esiste
                nessun menu — una frase tranquilla e falsa. Il caso si
                distingue prima di disegnare. */}
            {erroreMenu ? null : menuDentro.length === 0 ? (
              <p className="testo-sala text-b58-charcoal-soft/70">
                Non c&rsquo;è ancora nessun menu.{" "}
                <Link to="/ricettario/menu/nuovo" className="tocco-inline underline text-b58-terracotta">
                  Creane uno
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {menuDentro.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => cambiaMenu(m)}
                    disabled={salvandoMenu === m.id}
                    className={`tocco-riga rounded-lg testo-sala px-3 border transition-colors ${
                      m.voce
                        ? "bg-b58-cream-dark border-b58-charcoal/20 text-b58-charcoal"
                        : "border-b58-charcoal/15 text-b58-charcoal-soft hover:border-b58-charcoal/40"
                    }`}
                  >
                    {m.voce ? "✓ " : "+ "}
                    {m.name}
                    {/* ⚠️ Il menu in servizio si distingue: metterci dentro
                        un piatto lo porta davanti ai clienti, gli altri no. */}
                    {m.is_active && (
                      <span className="text-b58-olive"> · in servizio</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {erroreMenu && (
              <p className="testo-sala text-b58-terracotta-dark mt-1.5">{erroreMenu}</p>
            )}
          </div>
        )}

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

        {/* ⚠️ NIENTE STAGIONALITÀ SU UN PIATTO DI FINGER FOOD (24/08,
            richiesta di Alessio): la stagione è dei bocconcini, e la
            selezione cambia quando cambiano loro. Un campo che si compila
            in due posti finisce per dire due cose. */}
        {!isFingerFood && (
          <div className="mb-4">
            <label className={labelClass}>Stagionalità</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSeasonality(s.value)}
                  className={`rounded-full testo-sala px-3 py-1.5 border transition-colors ${
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
        )}

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {/* ⚠️ E NIENTE MINUTI: sono la somma dei tempi delle fasi, e una
                selezione di finger le fasi non le ha — il numero sarebbe
                sempre zero, presentato come un dato. */}
            {!isFingerFood && steps.length > 0 && (
              <span className="testo-sala text-b58-charcoal-soft">
                ⏱ {totalPrepMin} min totali · {totalActiveMin} min attivi
              </span>
            )}
          </div>
          <button
            onClick={saveHeader}
            disabled={savingHeader}
            className="print:hidden rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala-grande font-medium px-4 py-2"
          >
            {savingHeader ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>

      {/* Ingredienti — o FINGER, su una selezione.
          ⚠️ La parola cambia perché la cosa è diversa (24/08, richiesta di
          Alessio): *«la parola "INGREDIENTI" in questa scheda è sbagliata:
          si chiamano FINGER»*. Dentro una selezione non c'è farina, ci sono
          bocconcini finiti. */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          {isFingerFood ? "Finger" : "Ingredienti"}
        </h2>

        {/* I BOCCONCINI — un tocco mette, un tocco toglie.
            ⚠️ Si apre da sé se questa ricetta è già una selezione, e resta
            chiuso sugli altri piatti: una spiegazione o un pannello che c'è
            sempre diventa arredamento, e questa schermata si usa a lungo. */}
        {!isFinger && fingers.length > 0 && (
          <div className="print:hidden mb-4">
            <button
              onClick={() => setComponiAperto(!(componiAperto ?? fingerDentro.size > 0))}
              className="w-full flex items-center justify-between rounded-lg bg-white border border-b58-charcoal/10 px-3 py-2 testo-sala-grande"
            >
              <span className="text-b58-charcoal">
                Finger
                {fingerDentro.size > 0 && (
                  <span className="text-b58-charcoal-soft"> · {fingerDentro.size} dentro</span>
                )}
              </span>
              <span className="text-b58-charcoal-soft testo-sala">
                {(componiAperto ?? fingerDentro.size > 0) ? "chiudi" : "apri"}
              </span>
            </button>

            {(componiAperto ?? fingerDentro.size > 0) && (
              <div className="mt-2 rounded-lg bg-white border border-b58-charcoal/10 divide-y divide-b58-charcoal/5">
                {/* 🔴 I FILTRI (24/08, richiesta di Alessio): *«se un piatto
                    prevede solo finger di carne, vedere anche quelli di
                    pesce confonde e basta»*.
                    ⚠️ «Carne» e «pesce» NON sono un dato di questo
                    gestionale — una ricetta non porta da nessuna parte di
                    che cosa è fatta. Quello che c'è e che separa davvero
                    l'elenco è la CATEGORIA (i finger salati stanno in
                    «antipasto», i dolci in «dolce») e l'allergene. Chi
                    cerca «di carne» digita la parola: il campo di ricerca
                    guarda il nome.
                    ⚠️ E il filtro «senza …» si SPEGNE se gli allergeni non
                    si sono potuti leggere: nasconderebbe righe per un
                    guasto di rete, e chi guarda leggerebbe «questi non ce
                    l'hanno» — che è la bugia che questo modulo non deve
                    dire. */}
                <div className="p-2 flex flex-wrap gap-2 bg-b58-cream/40">
                  <input
                    value={cercaFinger}
                    onChange={(e) => setCercaFinger(e.target.value)}
                    placeholder="Cerca un finger…"
                    className="flex-1 min-w-[10rem] rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande"
                  />
                  <select
                    value={categoriaFinger}
                    onChange={(e) => setCategoriaFinger(e.target.value)}
                    className="tocco-campo rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande"
                  >
                    <option value="">Tutte le categorie</option>
                    {RECIPE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <select
                    value={senzaAllergeneFinger}
                    onChange={(e) => setSenzaAllergeneFinger(e.target.value)}
                    disabled={!allergeniFinger || nonLetto(allergeniFinger)}
                    className="tocco-campo rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande disabled:opacity-50"
                  >
                    <option value="">Qualunque allergene</option>
                    {ALLERGENS.map((a) => (
                      <option key={a.value} value={a.value}>
                        senza {a.label.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ⚠️ QUANTI NE NASCONDE SI DICHIARA: un filtro che ne toglie
                    quindici senza dirlo fa credere che ce ne siano tre — ed
                    è il numero che dice se conviene togliere il filtro. */}
                {fingerFiltrati.length < fingers.length && (
                  <p className="px-3 py-1.5 testo-sala text-b58-charcoal-soft bg-b58-cream/40">
                    {fingers.length - fingerFiltrati.length} finger non compaiono per via dei
                    filtri.
                    {senzaAllergeneFinger && fingerSenzaAllergeniNoti > 0 && (
                      <>
                        {" "}
                        Di questi, {fingerSenzaAllergeniNoti} sono esclusi perché i loro
                        allergeni non sono ancora confermati: non si sa se ce l&apos;hanno.
                      </>
                    )}
                  </p>
                )}

                {fingerFiltrati.length === 0 && (
                  <p className="px-3 py-2 testo-sala-grande text-b58-charcoal-soft/70">
                    Nessun finger corrisponde ai filtri.
                  </p>
                )}

                {fingerFiltrati.map((f) => {
                  const dentro = fingerDentro.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFinger(f)}
                      disabled={spuntando !== null}
                      className="tocco-riga w-full flex items-center gap-3 px-3 text-left disabled:opacity-60"
                    >
                      <span
                        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center testo-sala ${
                          dentro
                            ? "bg-b58-olive border-b58-olive text-b58-parchment"
                            : "border-b58-charcoal/25 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="flex-1 testo-sala-grande text-b58-charcoal">{f.name}</span>
                      <span className="testo-sala-grande text-b58-charcoal-soft">
                        {formatEUR(costiFinger[f.id])}
                      </span>
                    </button>
                  );
                })}
                <div className="px-3 py-2 flex items-center justify-between testo-sala-grande">
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
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande mb-4">
              <thead>
                {/* ⚠️ SU UNA SELEZIONE NIENTE QUANTITÀ E NIENTE SCARTO (24/08,
                    richiesta di Alessio): *«è sempre un pezzo per tipo, quel
                    doppio elenco non serve a niente»*. Una casella con dentro
                    sempre «1» non è un dato: è una cosa che si può sbagliare
                    senza guadagnarci niente. E lo scarto di un bocconcino
                    finito non esiste — sta dentro la sua ricetta. */}
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-2 font-medium">{isFingerFood ? "Finger" : "Ingrediente"}</th>
                  {!isFingerFood && <th className="py-2 font-medium">Quantità</th>}
                  {!isFingerFood && <th className="py-2 font-medium">% scarto</th>}
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
                          state={isComponent ? passoDaQui(recipe?.name) : undefined}
                          className="tocco-testo hover:text-b58-terracotta"
                        >
                          {isComponent ? ri.component.name : ri.ingredient.name}
                        </Link>
                        {/* ⚠️ Il componente si chiama col SUO nome: dal 19/08
                            può essere un finger, e un'etichetta fissa
                            «preparazione» direbbe una cosa falsa.
                            ⚠️ E su una SELEZIONE sparisce (24/08): la colonna
                            si chiama gia' «Finger», e ripeterlo su ogni riga
                            e' una parola che non distingue niente. */}
                        {isComponent && !isFingerFood && (
                          <span className="testo-sala text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5 ml-1.5">
                            {ri.component.recipe_type === "finger" ? "finger" : "preparazione"}
                          </span>
                        )}
                        {ri.prep_note && (
                          <div className="testo-sala text-b58-charcoal-soft">{ri.prep_note}</div>
                        )}
                      </td>
                      {!isFingerFood && (
                        <td className="py-2">
                          <CampoAutosalvato
                            type="number"
                            step="0.01"
                            value={ri.quantity}
                            onSave={(v) => handleQuantityChange(ri, v)}
                            className="w-20 tocco-campo rounded border border-b58-charcoal/15 px-2 py-1 testo-sala-grande"
                          />
                          <span className="text-b58-charcoal-soft ml-1">{ri.unit}</span>
                        </td>
                      )}
                      {!isFingerFood && (
                        <td className="py-2 text-b58-charcoal-soft">
                          {isComponent ? "—" : `${waste}%`}
                        </td>
                      )}
                      <td className="py-2 text-right text-b58-charcoal">
                        {formatEUR(rowCost)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRemoveIngredient(ri.id)}
                          className="tocco-bottone text-b58-charcoal-soft hover:text-b58-terracotta-dark testo-sala"
                        >
                          Rimuovi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="print:hidden bg-white rounded-lg border border-b58-charcoal/10 p-3">
          {/* ⚠️ SU UNA SELEZIONE NON SI SCEGLIE FRA INGREDIENTI E PREPARAZIONI
              (24/08): dentro ci vanno solo finger, quindi la scelta non c'è
              — e la ricerca qui sotto guarda solo loro. */}
          {!isFingerFood && preparations.length > 0 && (
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setIngredientMode("ingredient");
                  setIngredientForm((f) => ({ ...f, component_recipe_id: "" }));
                }}
                className={`rounded-full testo-sala px-3 py-1.5 border transition-colors ${
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
                className={`rounded-full testo-sala px-3 py-1.5 border transition-colors ${
                  ingredientMode === "preparation"
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {/* ⚠️ Il cartellino dice quello che la tendina contiene
                    davvero: da qui si scelgono anche i finger, e la
                    parola «Preparazione» da sola sarebbe piu' stretta del
                    vero. Si allarga solo quando i finger esistono. */}
                {fingers.length > 0 ? "Preparazione o finger" : "Preparazione"}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className="col-span-2 sm:col-span-1">
              <input
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                placeholder={
                  isFingerFood
                    ? "Cerca un finger…"
                    : modoRighe === "preparation"
                      ? "Cerca preparazione…"
                      : "Cerca ingrediente…"
                }
                className={inputClass}
              />
              {modoRighe === "preparation" ? (
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
                      {isFingerFood || p.recipe_type !== "finger" ? p.name : `${p.name} · finger`}
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
            {/* ⚠️ SU UNA SELEZIONE QUANTITÀ E UNITÀ NON SI CHIEDONO: è
                sempre un pezzo per tipo (24/08). Due caselle da riempire
                sempre allo stesso modo sono due modi di sbagliare senza
                guadagnarci niente — e il valore lo mette la stessa regola
                che lo mette spuntando il finger qui sopra. */}
            {!isFingerFood && (
              <input
                type="number"
                step="0.01"
                min="0"
                value={ingredientForm.quantity}
                onChange={(e) => setIngredientForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="Quantità"
                className={inputClass}
              />
            )}
            {!isFingerFood && (
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
            )}
            {modoRighe === "preparation" ? (
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
          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={
                addingIngredient ||
                (!isFingerFood && !ingredientForm.quantity) ||
                (modoRighe === "preparation"
                  ? !ingredientForm.component_recipe_id
                  : !ingredientForm.ingredient_id)
              }
              onClick={handleAddIngredient}
              className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
            >
              {addingIngredient ? "Aggiungo…" : "+ Aggiungi"}
            </button>
          </div>
        </div>
      </div>

      {/* Dove è usata questa preparazione */}
      {isPreparazione && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Dove è usata questa preparazione</h2>
          {preparationUsage.length === 0 ? (
            <p className="testo-sala-grande text-b58-charcoal-soft/60">
              Non ancora usata come componente in altre ricette.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {preparationUsage.map((u) => (
                <li key={u.used_in_recipe_id} className="testo-sala-grande text-b58-charcoal-soft">
                  <Link
                    to={`/ricettario/ricette/${u.used_in_recipe_id}`}
                    state={passoDaQui(recipe?.name)}
                    className="tocco-bottone inline-flex items-center text-b58-charcoal hover:text-b58-terracotta"
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

      {/* ⚠️ NIENTE FASI E NIENTE VIDEO SU UN PIATTO DI FINGER FOOD
          (24/08, richiesta di Alessio): *«le fasi stanno dentro i singoli
          finger, qui non hanno senso»*. Un riquadro che su questa scheda
          resta sempre vuoto non è neutro: fa scorrere due schermate per
          arrivare a quello che serve, e prima o poi qualcuno ci scrive
          dentro una fase che nessuno andrà a cercare lì. */}
      {!isFingerFood && (
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Fasi di preparazione</h2>

        {/* 🔴 LO SPAZIO FRA LE FASI, e questa l'ha trovata la MISURA, non
            la rilettura (22/08). Allargato il gap dentro la riga, il
            «Rimuovi» più vicino alla freccia «↓» non era più il suo: era
            quello della fase **sopra**, a **4,59 mm** — perché `space-y-2`
            fra due schede vale 1,08 mm veri, meno del gap che avevo appena
            sistemato dentro la scheda.
            ⚠️ E il danno di quel tocco è peggiore di quello che sembrava:
            chi manca la freccia mentre sposta la fase 2 non cancella la
            fase 2, **ne cancella un'altra** — quindi guarda l'elenco, vede
            un numero di righe diverso da quello che si aspetta, e non ha
            nessun modo di capire cosa è appena successo.
            ⚠️ *Allontanare due pulsanti dentro una riga non basta: il
            vicino di un pulsante può stare nella riga accanto.* */}
        {steps.length > 0 && (
          <ol
            className="flex flex-col mb-4"
            style={{ gap: "calc(var(--pxcm) * 0.25)" }}
          >
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
                      <span className="testo-sala font-medium text-b58-charcoal-soft">
                        {idx + 1}. {labelFor(STEP_PHASES, s.phase)}
                      </span>
                      {s.technique && (
                        <span className="testo-sala text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5">
                          {labelFor(COOKING_TECHNIQUES, s.technique)}
                        </span>
                      )}
                      {s.is_haccp_ccp && (
                        <span className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 font-medium">
                          CCP HACCP
                        </span>
                      )}
                    </div>
                    <p className="testo-sala-grande text-b58-charcoal">{s.description}</p>
                    <p className="testo-sala text-b58-charcoal-soft mt-1">
                      {s.duration_min ? `${s.duration_min} min` : ""}
                      {s.temperature_c ? ` · ${s.temperature_c}` : ""}
                      {s.equipment ? ` · ${s.equipment}` : ""}
                      {!s.is_active_time ? " · cottura passiva/riposo" : ""}
                    </p>
                    {s.is_haccp_ccp && (s.haccp_limit || s.haccp_action) && (
                      <p className="testo-sala text-b58-terracotta-dark mt-1">
                        {s.haccp_limit && <>Limite: {s.haccp_limit}. </>}
                        {s.haccp_action && <>Azione correttiva: {s.haccp_action}.</>}
                      </p>
                    )}
                  </div>
                  {/* 🔴 «↓» e «Rimuovi» stavano a `gap-1` = **0,54 mm**
                      (22/08): si sposta una fase premendo la freccia in
                      basso, e mezzo millimetro più sotto c'è il pulsante
                      che **la cancella**. È il caso peggiore della
                      famiglia, perché il gesto giusto («↓», premuto più
                      volte per spostare una fase di tre posti) porta il
                      dito proprio addosso a quello sbagliato.
                      ⚠️ Le due frecce fra loro restano vicine, ed è
                      giusto: sono lo stesso gesto in due versi, e il danno
                      di premere «↑» al posto di «↓» si disfa premendo
                      l'altra. */}
                  <div
                    className="flex flex-col items-end testo-sala"
                    style={{ gap: "calc(var(--pxcm) * 0.5)" }}
                  >
                    <div className="flex flex-wrap gap-1">
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
            <label className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft">
              <input
                type="checkbox"
                checked={stepForm.is_active_time}
                onChange={(e) => setStepForm((f) => ({ ...f, is_active_time: e.target.checked }))}
              />
              Richiede presidio (tempo attivo)
            </label>
          </div>

          <label className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft">
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
              className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
            >
              {addingStep ? "Aggiungo…" : "+ Aggiungi fase"}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Video ricetta */}
      {!isFingerFood && (
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Video ricetta</h2>
        <p className="testo-sala text-b58-charcoal-soft mb-4">
          ⚠️ Solo il collegamento: il video non viene caricato qui, e ingredienti e passaggi
          non si ricavano da soli.
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
                    className="tocco-testo testo-sala-grande text-b58-terracotta hover:text-b58-terracotta-dark break-all"
                  >
                    {v.url}
                  </a>
                  <div className="testo-sala text-b58-charcoal-soft">
                    {labelFor(VIDEO_PLATFORMS, v.platform)}
                    {v.note ? ` · ${v.note}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveVideo(v.id)}
                  className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark shrink-0"
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
            className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
          >
            {addingVideo ? "Aggiungo…" : "+ Aggiungi video"}
          </button>
        </div>
      </div>
      )}

      {/* ALLERGENI — e cosa si può togliere.
          🔴 IL BLOCCO È RIFATTO IL 24/08 (blocchi 1 e 3(g) del mandato).
          Prima era un elenco piatto di pastiglie, cioè un dato che si
          guardava e basta. Adesso è il posto dove si DECIDE, allergene per
          allergene, se si può togliere, con cosa e a che prezzo — ed è
          quello che in sala diventa un pulsante premibile o spento.
          ⚠️ Su un piatto di finger food «Punti Critici di Controllo» è
          sparito insieme alle fasi: i CCP stanno dentro i singoli
          bocconcini, e un riquadro che dice sempre «nessun CCP definito» è
          arredamento. Sugli altri piatti resta dov'era. */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          {isFingerFood ? "Allergeni" : "HACCP e Allergeni"}
        </h2>

        <div className={isFingerFood ? "" : "mb-4"}>
          {allergens.daVerificare && (
            <p className="mb-3 rounded bg-red-50 px-3 py-2 testo-sala-grande text-red-800">
              {/* 🔴 QUESTA FRASE DICEVA UNA COSA FALSA fino al 27/08: parlava di
                  allergeni «solo stimati», e dal 25/08 un dedotto vale come
                  confermato — la rimozione di quella regola fu fatta nella
                  vista del database e non nelle parole. Adesso il caso è uno
                  solo, e va detto per quello che è. */}
              <strong>Non l&apos;ha guardato nessuno.</strong> Su questi prodotti gli allergeni
              {/* ⚠️ Trovato dal censimento, oltre l'elenco del mandato: dice
                  CHI non ha guardato, non risponde a un gesto — e il nome
                  serve, perché «né una persona né MEMO» è la coppia che
                  spiega perché quell'elenco non si stampa. */}
              non li ha ancora visti né una persona né MEMO:{" "}
              {allergens.ingredienti.join(", ")}. Finché è così, questo piatto non stampa
              l&apos;elenco allergeni sul menu.
            </p>
          )}

          <AllergeniDelPiatto
            recipeId={id}
            eFinger={isFingerFood}
            finger={fingerDelPiatto}
            ingredienti={allIngredients}
            allergeniFinger={allergeniFinger}
          />

          {allergens.tracce.length > 0 && (
            <p className="mt-3 testo-sala-grande text-b58-charcoal-soft">
              <strong>Può contenere tracce di:</strong>{" "}
              {allergens.tracce.map((a) => labelFor(ALLERGENS, a)).join(", ")}
            </p>
          )}
        </div>

        {!isFingerFood && (
          <div>
            <p className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
              Punti Critici di Controllo
            </p>
            {ccpSteps.length === 0 ? (
              <p className="testo-sala-grande text-b58-charcoal-soft/60">
                Nessun CCP definito nelle fasi.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {ccpSteps.map((s) => (
                  <li key={s.id} className="testo-sala-grande text-b58-charcoal-soft">
                    <span className="text-b58-charcoal">{s.description}</span>
                    {s.haccp_limit && <> — limite: {s.haccp_limit}</>}
                    {s.haccp_action && <>, azione: {s.haccp_action}</>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
