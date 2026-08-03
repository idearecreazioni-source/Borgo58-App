import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listMenus, listMenuItemsFull } from "../../lib/api/menus";
import { listAllergensForRecipes } from "../../lib/api/dailyMenu";
import { ALLERGENS, formatEUR, labelFor } from "../../lib/constants";
import PrintButton from "../../components/PrintButton";

// Intestazioni al plurale per il menu stampato.
const CATEGORY_ORDER = [
  { value: "antipasto", label: "Antipasti" },
  { value: "primo", label: "Primi" },
  { value: "secondo", label: "Secondi" },
  { value: "dolce", label: "Dolci" },
];

// Segno distintivo: un piccolo rametto d'ulivo, come la foglia del logo e
// l'orto dell'azienda agricola. Separa le sezioni del menu.
function Sprig() {
  return (
    <svg viewBox="0 0 150 22" width="120" height="18" className="mx-auto my-3 text-b58-olive" aria-hidden="true">
      <line x1="0" y1="12" x2="58" y2="12" stroke="currentColor" strokeWidth="0.7" />
      <line x1="92" y1="12" x2="150" y2="12" stroke="currentColor" strokeWidth="0.7" />
      <path d="M75 12 C 75 5 80 2 87 3.5 C 84.5 9.5 80 12 75 12 Z" fill="currentColor" opacity="0.85" />
      <path d="M75 12 C 75 5 70 2 63 3.5 C 65.5 9.5 70 12 75 12 Z" fill="currentColor" opacity="0.85" />
      <line x1="75" y1="12" x2="75" y2="19" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function Masthead({ header, subheader }) {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <div className="text-center mb-2">
      {logoOk ? (
        <img
          src="/logo-borgo58.png"
          alt={header}
          onError={() => setLogoOk(false)}
          className="mx-auto h-20 md:h-24 object-contain"
        />
      ) : (
        <>
          <h2 className="font-display text-4xl text-b58-charcoal">{header}</h2>
          {subheader && <p className="text-xs tracking-[0.3em] uppercase text-b58-charcoal-soft mt-1">{subheader}</p>}
        </>
      )}
    </div>
  );
}

export default function EditorMenuHome() {
  const [menus, setMenus] = useState([]);
  const [menuId, setMenuId] = useState("");
  const [items, setItems] = useState([]);
  const [allergensByRecipe, setAllergensByRecipe] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Opzioni di stampa
  const [header, setHeader] = useState("Borgo 58");
  const [subheader, setSubheader] = useState("Osteria Contemporanea");
  const [showPrices, setShowPrices] = useState(true);
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showAllergens, setShowAllergens] = useState(false);
  const [excluded, setExcluded] = useState({});

  useEffect(() => {
    listMenus()
      .then((m) => {
        setMenus(m);
        const active = m.find((x) => x.is_active) ?? m[0];
        if (active) setMenuId(active.id);
        else setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!menuId) return;
    setLoading(true);
    setExcluded({});
    listMenuItemsFull(menuId)
      .then(async (its) => {
        setItems(its);
        const ids = its.map((i) => i.recipe_id).filter(Boolean);
        setAllergensByRecipe(await listAllergensForRecipes(ids));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [menuId]);

  const grouped = useMemo(() => {
    const map = {};
    CATEGORY_ORDER.forEach((c) => (map[c.value] = []));
    items
      .filter((i) => !excluded[i.id])
      .forEach((i) => {
        (map[i.category] ??= []).push(i);
      });
    return map;
  }, [items, excluded]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Pannello di controllo — non stampato */}
      <div className="print:hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Editor Menu Cartaceo</h1>
            <p className="text-b58-charcoal-soft mt-1">Genera il menu stampabile dai piatti in carta.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/editor-menu/giorno" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Piatti del giorno
            </Link>
            <PrintButton label="Stampa / PDF" />
          </div>
        </div>

        {error && <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-b58-charcoal-soft mb-1">Menu</label>
              <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className={inputClass}>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.is_active ? " (attivo)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-b58-charcoal-soft mb-1">Titolo (se manca il logo)</label>
              <input value={header} onChange={(e) => setHeader(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-b58-charcoal-soft mb-1">Sottotitolo</label>
              <input value={subheader} onChange={(e) => setSubheader(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} /> Mostra prezzi
            </label>
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input type="checkbox" checked={showDescriptions} onChange={(e) => setShowDescriptions(e.target.checked)} /> Mostra descrizioni
            </label>
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input type="checkbox" checked={showAllergens} onChange={(e) => setShowAllergens(e.target.checked)} /> Mostra allergeni
            </label>
          </div>
        </div>

        {!loading && items.length > 0 && (
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
            <p className="text-xs text-b58-charcoal-soft mb-2">Togli la spunta ai piatti da escludere dalla stampa (non modifica il menu):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {items.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-sm text-b58-charcoal-soft">
                  <input
                    type="checkbox"
                    checked={!excluded[i.id]}
                    onChange={(e) => setExcluded((x) => ({ ...x, [i.id]: !e.target.checked }))}
                  />
                  {i.recipe?.name} <span className="text-xs text-b58-charcoal-soft/60">({labelFor(CATEGORY_ORDER, i.category)})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft print:hidden">Caricamento…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-b58-charcoal-soft/60 print:hidden">
          Questo menu non ha piatti. Aggiungili dal Ricettario → Menu.
        </p>
      ) : (
        /* Anteprima menu — è ciò che viene stampato */
        <div
          className="mx-auto max-w-2xl bg-b58-parchment ring-1 ring-b58-charcoal/10 px-10 py-12 md:px-14 md:py-16 print:ring-0 print:max-w-none"
          style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", fontFamily: "var(--font-menu)" }}
        >
          <Masthead header={header} subheader={subheader} />
          <Sprig />

          {CATEGORY_ORDER.map((cat) => {
            const dishes = grouped[cat.value] ?? [];
            if (dishes.length === 0) return null;
            return (
              <section key={cat.value} className="mt-8 first:mt-6 break-inside-avoid">
                <h3 className="text-center text-[1.6rem] leading-none text-b58-terracotta-dark tracking-[0.08em]" style={{ fontFamily: "var(--font-menu)", fontWeight: 500 }}>
                  {cat.label}
                </h3>
                <ul className="mt-5 space-y-5 max-w-lg mx-auto">
                  {dishes.map((d) => {
                    const allergens = allergensByRecipe[d.recipe_id] ?? [];
                    return (
                      <li key={d.id} className="text-center break-inside-avoid">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="font-display text-lg text-b58-charcoal">{d.recipe?.name}</span>
                          {showPrices && (
                            <span className="text-b58-gold-dark text-base whitespace-nowrap">· {formatEUR(d.selling_price)}</span>
                          )}
                        </div>
                        {showDescriptions && d.recipe?.menu_description && (
                          <p className="text-sm italic text-b58-charcoal-soft/85 mt-1 leading-snug" style={{ fontFamily: "var(--font-menu)" }}>
                            {d.recipe.menu_description}
                          </p>
                        )}
                        {showAllergens && allergens.length > 0 && (
                          <p className="text-[11px] text-b58-charcoal-soft/60 mt-1">
                            {allergens.map((a) => labelFor(ALLERGENS, a)).join(" · ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {showAllergens && (
            <p className="text-[10px] text-b58-charcoal-soft/60 text-center mt-10 max-w-md mx-auto">
              In caso di allergie o intolleranze, chiedi al personale: teniamo l'elenco completo degli allergeni per ogni piatto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
