import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createRecipe } from "../../lib/api/recipes";
import { RECIPE_CATEGORIES } from "../../lib/constants";

import { useDaVoce } from "../../lib/daVoce";
import { conCampi } from "../../lib/calcoli/aMano";
import { StriscaDallaVoce } from "../../components/StriscaDallaVoce";
import { useUnita } from "../../lib/unita";

// Quello che il gestionale ha già capito da una ricetta dettata.
// ⚠️ IL TESTO DETTATO NON HA UN CAMPO QUI, ed è dichiarato invece che
//    nascosto: questo modulo crea lo scheletro (nome, categoria, porzioni)
//    e le note stanno sulla scheda, non qui. Il dettato resta leggibile
//    nella striscia in cima, che è dove serve mentre si riempie.
const DA_VOCE = {
  nome: "name",
  categoria: "category",
  porzioni: "portions_yield",
};

// 🔴 IL TIPO NON SI SCEGLIE PIÙ: LO DICE IL POSTO DA CUI ENTRI —
// 30/08/2026, struttura decisa da Alessio.
//
// Fino a ieri «Nuova ricetta» apriva una schermata con tre pulsanti, e non
// era soltanto brutta (misurato sulla sua schermata: «Finger (un pezzo di
// un piatto di finger food)» andava a capo sei volte e sfondava il
// riquadro): era **una domanda a cui chi la leggeva aveva già risposto**.
// Chi preme «+ Nuova» stando nell'elenco delle Preparazioni sta creando
// una preparazione, e richiederglielo è un passo che serve solo a poterlo
// sbagliare.
//
// ⚠️ IL TIPO STA NELL'INDIRIZZO e non in uno stato interno, per la stessa
// ragione per cui ci sta la porta dell'elenco: un indirizzo copiato,
// ricaricato o messo fra i preferiti deve riaprire la stessa cosa.
//
// ⚠️ E LA SELEZIONE È UNA QUARTA PORTA, non una categoria da scegliere: un
// piatto composto da finger è un `piatto_finito` di categoria
// `finger_food`, e farlo mettere lì a mano rimetterebbe in piedi
// esattamente il modo in cui è nato il finger-che-cerca-sé-stesso.
const PORTE = {
  piatto_finito: {
    titolo: "Nuovo piatto",
    indietro: { a: "/ricettario/ricette?tipo=piatto_finito", etichetta: "Piatti" },
    esempio: 'Es. "Risotto zucca e provola affumicata"',
    conPorzioni: true,
    crea: "Crea piatto",
  },
  preparazione: {
    titolo: "Nuova preparazione",
    indietro: { a: "/ricettario/ricette?tipo=preparazione", etichetta: "Preparazioni" },
    esempio: 'Es. "Crema pasticcera"',
    conResa: true,
    nota: "Un semilavorato riutilizzabile in altre ricette. La resa è quanto ne viene da una dose: è la base per calcolare il costo quando la userai dentro un'altra ricetta.",
    crea: "Crea preparazione",
  },
  finger: {
    titolo: "Nuovo finger",
    indietro: { a: "/ricettario/ricette?tipo=finger", etichetta: "Finger" },
    esempio: 'Es. "Bocconcino di tonno"',
    conResa: true,
    nota: "Un pezzo finito che entra in una selezione di finger. La resa è quanti pezzi vengono da una dose.",
    crea: "Crea finger",
  },
  selezione: {
    titolo: "Nuova selezione di finger",
    indietro: { a: "/ricettario/ricette?tipo=finger&modo=selezioni", etichetta: "Selezioni" },
    esempio: 'Es. "Tagliere di quattro"',
    // ⚠️ NIENTE CATEGORIA E NIENTE PORZIONI: la categoria è decisa (è una
    // selezione di finger food, ed è ciò che la rende tale) e le porzioni
    // sono una — un tagliere è un tagliere. Due caselle da riempire sempre
    // allo stesso modo sono due modi di sbagliare senza guadagnarci niente.
    nota: "Dentro ci vanno solo finger: li scegli nella scheda, subito dopo. Non ha ingredienti, né fasi, né scarto — quelli stanno dentro i singoli finger.",
    crea: "Crea selezione",
  },
};

export default function RicettaForm() {
  // Le unita' si chiedono al database, non a un elenco scritto qui: la
  // ragione per esteso sta in src/lib/unita.js.
  const UNITS = useUnita();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const chiave = PORTE[params.get("tipo")] ? params.get("tipo") : "piatto_finito";
  const porta = PORTE[chiave];
  const eSelezione = chiave === "selezione";

  const [form, setForm] = useState({
    name: "",
    category: eSelezione ? "finger_food" : "",
    subcategory: "",
    portions_yield: 4,
    yield_quantity: "",
    yield_unit: "kg",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const venuto = useDaVoce((c) => setForm((f) => conCampi(f, c, DA_VOCE)));

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const recipe = await createRecipe({
        name: form.name.trim(),
        category: eSelezione ? "finger_food" : form.category,
        subcategory: form.subcategory || null,
        // ⚠️ Una selezione è un `piatto_finito` nel database: la sua
        // diversità sta nella categoria, non in un quarto tipo. Aggiungere
        // un valore all'enum vorrebbe dire ricontrollare ogni posto che
        // oggi sa distinguere tre casi.
        recipe_type: eSelezione ? "piatto_finito" : chiave,
        // Le preparazioni e i finger si costano per unità di resa, non per
        // porzione — portions_yield resta 1, non è il campo rilevante.
        portions_yield: porta.conPorzioni ? Number(form.portions_yield) || 1 : 1,
        yield_quantity: porta.conResa ? Number(form.yield_quantity) || null : null,
        yield_unit: porta.conResa ? form.yield_unit : null,
        // Ogni ricetta nuova parte "in sviluppo" — la promozione a pronta/in
        // carta è sempre manuale, dalla scheda ricetta.
      });
      // 🔴 DOPO il salvataggio riuscito, mai prima.
      await venuto.chiudi();
      navigate(`/ricettario/ricette/${recipe.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-24">
      <Link
        to={porta.indietro.a}
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← {porta.indietro.etichetta}
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">{porta.titolo}</h1>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <StriscaDallaVoce venuto={venuto} />

      <form onSubmit={handleSubmit}>
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={porta.esempio}
              className={inputClass}
            />
          </div>

          {!eSelezione && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Categoria</label>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={inputClass}
                >
                  <option value="" disabled>Seleziona…</option>
                  {RECIPE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {porta.conResa ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Resa</label>
                    <input
                      required
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form.yield_quantity}
                      onChange={(e) => setForm((f) => ({ ...f, yield_quantity: e.target.value }))}
                      placeholder="Es. 1"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Unità</label>
                    <select
                      value={form.yield_unit}
                      onChange={(e) => setForm((f) => ({ ...f, yield_unit: e.target.value }))}
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
                  <label className={labelClass}>Porzioni (ricetta base)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.portions_yield}
                    onChange={(e) => setForm((f) => ({ ...f, portions_yield: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          )}

          {porta.nota && (
            <p className="testo-sala text-b58-charcoal-soft/80">{porta.nota}</p>
          )}

          {!eSelezione && (
            <div>
              <label className={labelClass}>Sottocategoria (opzionale)</label>
              <input
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                placeholder='Es. "pesce", "vegetariano"'
                className={inputClass}
              />
            </div>
          )}
        </div>

        {/* 🔴 L'AZIONE PRINCIPALE IN FONDO, LARGA QUANTO LO SCHERMO —
            decisione del 29/08 (i due pulsanti di MEMO), qui applicata al
            Ricettario. Il pulsante stava dentro il riquadro, in fondo a
            destra: con una mano sola, sul telefono, è il punto più scomodo
            che ci sia. */}
        <button
          type="submit"
          disabled={saving}
          className="w-full mt-4 tocco-azione rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 testo-sala-grande"
        >
          {saving ? "Creo…" : porta.crea}
        </button>
      </form>
    </div>
  );
}
