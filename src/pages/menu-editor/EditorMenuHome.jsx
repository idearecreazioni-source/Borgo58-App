import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listMenus, listMenuItemsFull } from "../../lib/api/menus";
import { listAllergensForRecipes } from "../../lib/api/dailyMenu";
import { ALLERGENS, formatEUR, labelFor } from "../../lib/constants";
import PrintButton from "../../components/PrintButton";
import Didascalia from "../../components/Didascalia";

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

  // Quanti piatti sono stati tolti da QUESTA stampa: si conta dagli stessi
  // piatti che si vedono nell'elenco, non da un secondo posto.
  const quantiEsclusi = useMemo(() => items.filter((i) => excluded[i.id]).length, [items, excluded]);

  // Quanti piatti portano l'asterisco: si contano dagli stessi piatti che
  // finiscono sul foglio, e la nota in fondo compare solo se ce n'è almeno
  // uno. Quando tutti gli ingredienti saranno confermati sparisce da sola.
  const conAsterisco = useMemo(
    () =>
      items.filter((i) => !excluded[i.id] && allergensByRecipe[i.recipe_id]?.daVerificare).length,
    [items, excluded, allergensByRecipe]
  );

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Pannello di controllo — non stampato */}
      <div className="print:hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
              Editor Menu Cartaceo
              <Didascalia>
                Genera il foglio da stampare prendendo i piatti che sono in carta nel
                menu attivo. Qui si sceglie cosa lasciare fuori da questa stampa, non
                cosa togliere dalla carta.
              </Didascalia>
            </h1>
          </div>
          <div className="flex gap-2">
            <Link to="/editor-menu/bevande" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Bevande e vini
            </Link>
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
              <input type="checkbox" checked={showAllergens} onChange={(e) => setShowAllergens(e.target.checked)} />{" "}
              Mostra allergeni{" "}
              {/* ⚠️ SCRITTO ACCANTO, non sottinteso (decisione di Alessio,
                  17/08): sul menu definitivo NON vanno elenchi sotto i
                  piatti. Questa casella serve a stampare una copia per la
                  sala. Senza dirlo, fra sei mesi qualcuno la accende
                  credendo che sia il modo previsto di stampare la carta. */}
              <span className="text-b58-charcoal-soft/60">— copia per uso interno, non la carta</span>
            </label>
          </div>
        </div>

        {/* L'avviso sta sullo schermo e NON nella stampa: un menu in mano
            a un cliente non è il posto dove scrivere che i nostri dati
            interni non sono verificati. Sul foglio, quei piatti
            semplicemente non riportano l'elenco allergeni. */}
        {!loading &&
          showAllergens &&
          (() => {
            const nonVerificati = [
              ...new Set(
                Object.values(allergensByRecipe)
                  .filter((s) => s?.daVerificare)
                  .flatMap((s) => s.ingredienti ?? [])
              ),
            ];
            if (nonVerificati.length === 0) return null;
            return (
              <div className="print:hidden rounded-xl bg-red-50 ring-1 ring-red-300 p-4 mb-6">
                <p className="text-sm font-medium text-red-800">
                  Attenzione: allergeni non confermati
                </p>
                <p className="text-sm text-red-800 mt-1">
                  Questi ingredienti hanno allergeni solo stimati, o mai guardati da nessuno:{" "}
                  <strong>{nonVerificati.join(", ")}</strong>. I piatti che li contengono{" "}
                  <strong>non stampano l&apos;elenco allergeni</strong> finché non li confermi in{" "}
                  <Link to="/ricettario/schede" className="underline">
                    Ricettario → Schede dei prodotti
                  </Link>
                  .
                </p>
              </div>
            );
          })()}

        {!loading && items.length > 0 && (
          <>{/* ⚠️ QUESTO BLOCCO È STATO RIDISEGNATO, non ritoccato (piccolezza
             del collaudo, 17/08, e la ragione è di Alessio).
             Prima erano CASELLE SPUNTATE: dieci piatti, dieci spunte tutte
             accese, e togliendone una si escludeva quel piatto da *questa*
             stampa. Ma una casella spuntata è il segno universale di una
             scelta SALVATA — le togli, esci, rientri, e sono tornate tutte.
             La riga che lo spiegava c'era, sopra e in piccolo, e quello che
             si vede è il comportamento, non la nota.
             ⚠️ La cura non è ingrandire la nota: è che il segno somigli a
             ciò che fa. Adesso non c'è niente di spuntato — si toglie un
             piatto, e il piatto si vede tolto (barrato, sbiadito, con
             «rimetti» accanto). Lo stato di partenza è «tutto dentro», che è
             la verità, e l'elenco dice in ogni momento quanti ne mancano e
             che valgono solo per questa stampa. Stessa forma della striscia
             del database: due stati dello stesso segno, non due segni. */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
            {/* ⚠️ IL BLOCCO SI CHIAMA COL GESTO A CUI APPARTIENE, e le parole
                sono verbi di STAMPA, mai «togli» (rilievo del validatore,
                17/08): nel menu esiste già «Rimuovi», che toglie il piatto
                dalla carta per davvero. Se le due si somigliassero, qualcuno
                userebbe la prima credendo di fare la seconda — che è il
                difetto di oggi visto dall'altro lato. */}
            <p className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">
              Cosa lascio fuori da questa stampa
            </p>
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
              <p className="text-xs text-b58-charcoal-soft">
                {quantiEsclusi === 0 ? (
                  <>Si stampano tutti e {items.length} i piatti.</>
                ) : (
                  <>
                    Si stampano <strong>{items.length - quantiEsclusi} piatti su {items.length}</strong>:{" "}
                    {quantiEsclusi === 1 ? "uno è tolto" : `${quantiEsclusi} sono tolti`} da questa
                    stampa. <strong>Il menu non cambia</strong>, e riaprendo la pagina tornano tutti:
                    per togliere un piatto dalla carta per davvero si usa «Rimuovi», nel menu.
                  </>
                )}
              </p>
              {quantiEsclusi > 0 && (
                <button
                  type="button"
                  onClick={() => setExcluded({})}
                  className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
                >
                  Rimettili tutti
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      excluded[i.id]
                        ? "line-through text-b58-charcoal-soft/40"
                        : "text-b58-charcoal-soft"
                    }
                  >
                    {i.recipe?.name}{" "}
                    <span className="text-xs text-b58-charcoal-soft/60">
                      ({labelFor(CATEGORY_ORDER, i.category)})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExcluded((x) => ({ ...x, [i.id]: !x[i.id] }))}
                    className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark shrink-0"
                  >
                    {excluded[i.id] ? "rimetti nella stampa" : "non stampare"}
                  </button>
                </div>
              ))}
            </div>
          </div></>
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
                    const scheda = allergensByRecipe[d.recipe_id];
                    // Un piatto i cui ingredienti non sono stati
                    // verificati NON stampa l'elenco allergeni: un
                    // elenco che sembra controllato e non lo è è
                    // peggio di nessun elenco.
                    const allergens = scheda?.daVerificare ? [] : (scheda?.allergens ?? []);
                    return (
                      <li key={d.id} className="text-center break-inside-avoid">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="font-display text-lg text-b58-charcoal">
                            {d.recipe?.name}
                            {/* ⚠️ UN SEGNO, NON UNA FRASE (rilievo del 17/08).
                                «per gli allergeni chiedi al personale» ripetuto
                                sotto sette piatti su otto è rumore, e contraddice
                                la decisione già presa: sul menu resta solo la
                                dicitura in fondo. Ma toglierlo e basta farebbe
                                tornare il difetto di partenza — un piatto non
                                confermato diventerebbe identico a uno che non
                                contiene allergeni, e l'assenza si legge come una
                                rassicurazione. Quindi un asterisco accanto al
                                nome, e UNA nota in fondo che lo spiega.
                                ⚠️ Quando tutti gli ingredienti saranno confermati
                                l'asterisco sparisce da solo: non è un
                                interruttore da ricordarsi di spegnere. */}
                            {showAllergens && scheda?.daVerificare && (
                              <span className="text-b58-charcoal-soft"> *</span>
                            )}
                          </span>
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
                        {/* ⚠️ IL DIFETTO n. 14, e non era l'intento: era il
                            risultato. Un piatto con allergeni non confermati
                            non stampava la riga, mentre tutti gli altri la
                            stampavano — e per il cliente che legge
                            un'assenza in mezzo a delle presenze dice
                            «questo non contiene allergeni». L'opposto.
                            La nota generica in fondo alla pagina non basta,
                            perché non distingue QUESTO piatto dagli altri.
                            Il segno va accanto al piatto, ed è la cura
                            minima: l'alternativa era non stamparlo affatto. */}

                        {/* Le tracce si stampano solo se qualcuno le ha
                            davvero lette da un'etichetta: sono una riga a
                            sé perché «può contenere» non è «contiene». */}
                        {showAllergens && !scheda?.daVerificare && (scheda?.tracce ?? []).length > 0 && (
                          <p className="text-[11px] text-b58-charcoal-soft/50 mt-0.5 italic">
                            può contenere tracce di{" "}
                            {scheda.tracce.map((a) => labelFor(ALLERGENS, a)).join(" · ")}
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
              In caso di allergie o intolleranze, chiedi al personale: teniamo l&apos;elenco completo
              degli allergeni per ogni piatto.
              {conAsterisco > 0 && (
                <> I piatti con <span className="text-b58-charcoal-soft">*</span> non hanno ancora
                l&apos;elenco completo: per quelli chiedi sempre al personale.</>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
