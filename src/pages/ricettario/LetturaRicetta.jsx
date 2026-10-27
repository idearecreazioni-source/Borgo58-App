import { Link } from "react-router-dom";
import { ALLERGENS, RECIPE_CATEGORIES, STEP_PHASES, labelFor, formatEUR } from "../../lib/constants";
import { AllergeniArchivio, TagEStagioni } from "../../components/ArchivioRicetta";
import Didascalia from "../../components/Didascalia";

// LA RICETTA DA LEGGERE — 25/10/2026.
//
// Alessio, guardando la Crema Catalana: *«vorrei vedere la ricetta pulita e
// leggibile quando la apro, e solo se voglio apportare delle modifiche i
// campi modificabili»*. Prima la scheda si apriva già piena di campi,
// pulsanti di stato e spiegazioni; ora si apre QUI, nello stesso stile della
// scheda di una bozza, e «Modifica» porta ai campi di sempre.
//
// ⚠️ Gli avvisi restano, ma in una riga: «Parziale · 7 da collegare». Le
//    spiegazioni lunghe stanno dietro il «?» (criterio del 24/08).
// ⚠️ Qui non si scrive niente, tranne la conferma degli allergeni proposti
//    da MEMO: è un gesto solo, e farlo passare da «Modifica» lo nasconderebbe.

const COLORE_FASE = {
  mise_en_place: "bg-b58-olive/15 text-b58-olive-dark-testo",
  cottura: "bg-b58-terracotta/15 text-b58-terracotta-dark-testo",
  finitura: "bg-b58-ambra/15 text-b58-ambra-dark-testo",
  impiattamento: "bg-b58-gold/20 text-b58-gold-dark-testo",
};

const numero = (n) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: 3 });
const quanto = (q, u) => (q == null ? null : [numero(q), u].filter(Boolean).join(" "));

const chip = "rounded-full px-3 py-0.5 testo-sala";
const Scheda = ({ titolo, children }) => (
  <section className="mb-4 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
    <h2 className="mb-2 font-display font-semibold text-b58-charcoal">{titolo}</h2>
    {children}
  </section>
);

export default function LetturaRicetta({
  recipe,
  righe,
  daCollegare,
  steps,
  videos,
  allergens,
  cost,
  ccpSteps = [],
  tipo,
  stato,
  isTitolare,
  isSelezione,
  isComponente,
  passoDaQui,
  onModifica,
  onAllergeniArchivio,
}) {
  const parziale = daCollegare.length > 0;
  const perPorzione = isComponente ? null : cost?.food_cost_portion;

  return (
    <>
      <header className="mb-4 mt-3 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display testo-sala-titolo text-b58-charcoal">{recipe.name}</h1>
          {isTitolare && (
            <button
              type="button"
              className="print:hidden tocco-bottone rounded-lg border border-b58-charcoal/20 px-4 text-b58-charcoal"
              onClick={onModifica}
            >
              Modifica
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`${chip} bg-b58-cream-dark text-b58-charcoal`}>{labelFor(RECIPE_CATEGORIES, recipe.category)}</span>
          <span className={`${chip} bg-b58-cream-dark text-b58-charcoal`}>{tipo}</span>
          {isComponente ? (
            recipe.yield_quantity ? (
              <span className={`${chip} bg-b58-cream-dark text-b58-charcoal`}>
                resa {numero(recipe.yield_quantity)} {recipe.yield_unit}
              </span>
            ) : (
              <span className={`${chip} bg-b58-charcoal/5 text-b58-charcoal-soft/70`}>resa da dire</span>
            )
          ) : (
            !isSelezione && (
              <span className={`${chip} bg-b58-cream-dark text-b58-charcoal`}>{recipe.portions_yield} porzioni</span>
            )
          )}
          {stato && <span className={`${chip} bg-b58-charcoal/5 text-b58-charcoal-soft`}>{stato}</span>}
        </div>

        <TagEStagioni tags={recipe.tags} stagioni={isSelezione ? [] : recipe.seasonality} modifica={false} />

        {isTitolare && (
          <p className="mt-3 testo-sala text-b58-charcoal-soft">
            Food cost {cost ? formatEUR(isComponente ? cost.food_cost_base : perPorzione) : "—"}
            {isComponente ? " la dose" : isSelezione ? " in tutto" : " a porzione"}
            {parziale && (
              <span className="text-b58-terracotta-dark-testo">
                {" "}
                · Parziale · {daCollegare.length} da collegare
                <Didascalia>
                  Gli ingredienti non ancora collegati a un prodotto del magazzino non hanno un prezzo: il costo
                  li ignora, quindi è più basso del vero.
                </Didascalia>
              </span>
            )}
          </p>
        )}

        {recipe.menu_description && <p className="mt-3 text-b58-charcoal-soft">{recipe.menu_description}</p>}
      </header>

      <Scheda titolo={isSelezione ? "Finger" : "Ingredienti"}>
        {righe.length === 0 && daCollegare.length === 0 && (
          <p className="text-b58-charcoal-soft/70">Nessun ingrediente.</p>
        )}
        <ul className="divide-y divide-b58-charcoal/10">
          {righe.map((ri) => {
            const q = isSelezione ? null : quanto(ri.quantity, ri.unit);
            return (
              <li key={ri.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2">
                <span className="text-right tabular-nums font-medium text-b58-charcoal">{q ?? ""}</span>
                <span>
                  {ri.component ? (
                    <Link
                      to={`/ricettario/ricette/${ri.component.id}`}
                      state={passoDaQui}
                      className="tocco-testo max-w-full text-b58-charcoal underline decoration-b58-charcoal/20 hover:text-b58-terracotta-testo"
                    >
                      {ri.component.name}
                    </Link>
                  ) : (
                    <span className="text-b58-charcoal">{ri.ingredient?.name}</span>
                  )}
                  {ri.prep_note && <span className="block testo-sala text-b58-charcoal-soft/80">{ri.prep_note}</span>}
                </span>
              </li>
            );
          })}
          {daCollegare.map((r) => {
            const q = quanto(r.quantita, r.unita);
            return (
              <li key={r.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2">
                <span className={`text-right tabular-nums ${q ? "font-medium text-b58-charcoal" : "text-b58-charcoal-soft/50"}`}>
                  {q ?? "—"}
                </span>
                <span>
                  <span className="text-b58-charcoal">{r.nome}</span>
                  {r.nota && <span className="block testo-sala text-b58-charcoal-soft/80">{r.nota}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Scheda>

      {!isSelezione && steps.length > 0 && (
        <Scheda titolo="Procedimento">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[2rem_1fr] gap-2">
                <span className="font-display text-b58-charcoal-soft">{i + 1}.</span>
                <div>
                  {(s.phase || s.duration_min || s.equipment) && (
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {s.phase && (
                        <span className={`${chip} ${COLORE_FASE[s.phase] ?? "bg-b58-charcoal/5"}`}>
                          {labelFor(STEP_PHASES, s.phase)}
                        </span>
                      )}
                      {(s.duration_min || s.equipment) && (
                        <span className="testo-sala text-b58-charcoal-soft">
                          {[s.duration_min ? `${s.duration_min} min` : null, s.equipment].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {s.is_haccp_ccp && <span className={`${chip} bg-red-50 text-red-800`}>CCP</span>}
                    </div>
                  )}
                  <p className="text-b58-charcoal">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Scheda>
      )}

      <Scheda titolo="Allergeni">
        {parziale ? (
          // 🔴 Con ingredienti da collegare, i prodotti non bastano a dire gli
          //    allergeni: vale l'elenco della ricetta intera (detto da te o
          //    proposto da MEMO), unito a quelli dei prodotti già collegati.
          <AllergeniArchivio
            allergeni={recipe.allergeni_archivio ?? null}
            origine={recipe.allergeni_archivio_origine}
            extra={allergens.allergens}
            modifica={false}
            onAllergeni={isTitolare ? onAllergeniArchivio : undefined}
          />
        ) : allergens.daVerificare ? (
          <p className="testo-sala text-red-800">
            Da verificare: {allergens.ingredienti.join(", ")}
            <Didascalia>
              Su questi prodotti gli allergeni non li ha ancora visti né una persona né MEMO. Finché è così, il piatto
              non stampa l&apos;elenco allergeni sul menu.
            </Didascalia>
          </p>
        ) : allergens.allergens.length === 0 ? (
          <span className={`${chip} bg-b58-cream-dark text-b58-charcoal`}>nessun allergene</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allergens.allergens.map((a) => (
              <span key={a} className={`${chip} bg-b58-cream-dark text-b58-charcoal`}>{labelFor(ALLERGENS, a)}</span>
            ))}
          </div>
        )}
        {allergens.tracce.length > 0 && (
          <p className="mt-2 testo-sala text-b58-charcoal-soft">
            Può contenere tracce di: {allergens.tracce.map((a) => labelFor(ALLERGENS, a)).join(", ")}
          </p>
        )}
        {ccpSteps.length > 0 && (
          <p className="mt-2 testo-sala text-b58-charcoal-soft">
            Punti critici: {ccpSteps.map((s) => s.description).join(" · ")}
          </p>
        )}
      </Scheda>

      {!isSelezione && videos.length > 0 && (
        <Scheda titolo="Video">
          <ul className="space-y-1">
            {videos.map((v) => (
              <li key={v.id}>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tocco-testo break-all text-b58-terracotta-testo underline"
                >
                  {v.note || "Guarda il video"} ↗
                </a>
              </li>
            ))}
          </ul>
        </Scheda>
      )}
    </>
  );
}
