import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getRecipe, getRecipeAllergens } from "../../lib/api/recipes";
import { listRecipeSteps } from "../../lib/api/recipeSteps";
import { listRecipeIngredientsDisplay } from "../../lib/api/recipeIngredients";
import { listRecipeVideos } from "../../lib/api/recipeVideos";
import PrintButton from "../../components/PrintButton";
import {
  ALLERGENS,
  COOKING_TECHNIQUES,
  RECIPE_CATEGORIES,
  SEASONS,
  STEP_PHASES,
  VIDEO_PLATFORMS,
  labelFor,
} from "../../lib/constants";

// Scheda ricetta in SOLA LETTURA per lo staff (§3.5): ingredienti, quantità,
// fasi, HACCP, allergeni — nessun prezzo né food cost. Gli ingredienti arrivano
// dalla vista display (senza colonne economiche), non dalla tabella base.
export default function StaffRicettaDetail() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [allergens, setAllergens] = useState({ allergens: [], daVerificare: false, ingredienti: [], tracce: [] });
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getRecipe(id),
      listRecipeIngredientsDisplay(id),
      listRecipeSteps(id),
      getRecipeAllergens(id),
      listRecipeVideos(id),
    ])
      .then(([rec, ing, st, al, vids]) => {
        if (cancelled) return;
        setRecipe(rec);
        setIngredients(ing);
        setSteps(st);
        setAllergens(al);
        setVideos(vids);
      })
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const totalPrepMin = useMemo(
    () => steps.reduce((sum, s) => sum + (s.duration_min || 0), 0),
    [steps]
  );
  const ccpSteps = steps.filter((s) => s.is_haccp_ccp);

  if (notFound) return <Navigate to="/ricettario/ricette" replace />;
  if (loading || !recipe) {
    return <p className="text-sm text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to="/ricettario/ricette" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Ricette
        </Link>
        <PrintButton />
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">{recipe.name}</h1>
        <p className="text-sm text-b58-charcoal-soft mt-1">
          {labelFor(RECIPE_CATEGORIES, recipe.category)}
          {recipe.subcategory ? ` · ${recipe.subcategory}` : ""} · {recipe.portions_yield} porzioni
        </p>
        {recipe.seasonality?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.seasonality.map((s) => (
              <span key={s} className="text-xs bg-b58-olive/10 text-b58-olive-dark rounded-full px-2.5 py-1">
                {labelFor(SEASONS, s)}
              </span>
            ))}
          </div>
        )}
        {steps.length > 0 && (
          <p className="text-xs text-b58-charcoal-soft mt-3">⏱ {totalPrepMin} min totali</p>
        )}
      </div>

      {/* Ingredienti (senza prezzi) */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Ingredienti</h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft">Nessun ingrediente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Ingrediente</th>
                <th className="py-2 font-medium">Quantità</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ri) => (
                <tr key={ri.recipe_ingredient_id} className="border-b border-b58-charcoal/5 last:border-0">
                  <td className="py-2 text-b58-charcoal">
                    {ri.ingredient_name}
                    {ri.is_preparation && (
                      <span className="text-[11px] text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5 ml-1.5">
                        preparazione
                      </span>
                    )}
                    {ri.is_optional && (
                      <span className="text-xs text-b58-charcoal-soft ml-1.5">(opzionale)</span>
                    )}
                    {ri.prep_note && (
                      <div className="text-xs text-b58-charcoal-soft">{ri.prep_note}</div>
                    )}
                  </td>
                  <td className="py-2 text-b58-charcoal-soft">
                    {ri.quantity} {ri.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Fasi */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Fasi di preparazione</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft">Nessuna fase.</p>
        ) : (
          <ol className="space-y-2">
            {steps.map((s, idx) => (
              <li
                key={s.id}
                className={`rounded-lg border p-3 ${
                  s.is_haccp_ccp ? "border-b58-terracotta bg-b58-terracotta/5" : "border-b58-charcoal/10 bg-white"
                }`}
              >
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
                </p>
                {s.is_haccp_ccp && (s.haccp_limit || s.haccp_action) && (
                  <p className="text-xs text-b58-terracotta-dark mt-1">
                    {s.haccp_limit && <>Limite: {s.haccp_limit}. </>}
                    {s.haccp_action && <>Azione: {s.haccp_action}.</>}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Video ricetta */}
      {videos.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Video ricetta</h2>
          <ul className="space-y-2">
            {videos.map((v) => (
              <li key={v.id} className="bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
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
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* HACCP e Allergeni */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">HACCP e Allergeni</h2>
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">Allergeni</p>
          {allergens.daVerificare && (
            <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>Elenco non verificato.</strong> Questi ingredienti non sono ancora stati
              controllati: {allergens.ingredienti.join(", ")}. Se un cliente chiede di un&apos;allergia,
              guarda l&apos;etichetta del prodotto — non fidarti di questo elenco.
            </p>
          )}
          {allergens.allergens.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">
              {allergens.daVerificare ? "Nessuno risulta, ma nessuno l'ha guardato." : "Nessuno."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergens.allergens.map((a) => (
                <span key={a} className="text-xs bg-b58-terracotta/10 text-b58-terracotta-dark rounded-full px-2.5 py-1">
                  {labelFor(ALLERGENS, a)}
                </span>
              ))}
            </div>
          )}
          {allergens.tracce.length > 0 && (
            <p className="mt-2 text-sm text-b58-charcoal-soft">
              <strong>Può contenere tracce di:</strong>{" "}
              {allergens.tracce.map((a) => labelFor(ALLERGENS, a)).join(", ")} — non è un
              ingrediente, è il rischio che lo stabilimento del produttore lavori anche quello.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Punti Critici di Controllo
          </p>
          {ccpSteps.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessun CCP definito.</p>
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
