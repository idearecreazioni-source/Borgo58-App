import { RECIPE_CATEGORIES, STEP_PHASES, labelFor } from "../../lib/constants";
import { ORIGINI_BOZZA, statoLeggibile } from "../../lib/calcoli/bozzeRicetta";

// UNA BOZZA DA LEGGERE — la scheda della ricetta virtuale (10/10/2026).
//
// Alessio, guardando la bozza della panna cotta: *«troppo dispersiva e
// monocromatica, non si capisce niente»*. Ogni dato stava dentro un campo
// con la sua etichetta, quindi la ricetta si leggeva come un modulo. Qui la
// bozza si legge come una scheda: in testa titolo e dati essenziali, poi gli
// ingredienti con la quantità in colonna, poi il procedimento numerato con la
// fase a colori. I campi da correggere stanno in «Modifica» (BozzaDetail).
//
// ⚠️ Niente di questa scheda scrive: è solo lettura. Quello che manca si DICE
//    («—», «categoria da scegliere»), non si nasconde.

const COLORE_FASE = {
  mise_en_place: "bg-b58-olive/15 text-b58-olive-dark",
  cottura: "bg-b58-terracotta/15 text-b58-terracotta-dark",
  finitura: "bg-b58-ambra/15 text-b58-ambra-dark",
  impiattamento: "bg-b58-gold/20 text-b58-gold-dark",
};

const VIDEO = /Video originale:\s*(https?:\/\/\S+)/i;

const numero = (n) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: 3 });

/** «6 g», «0,5 l», «q.b.», oppure null se la quantità non c'è. */
function quantitaLeggibile(r) {
  if (r.quantita != null) return [numero(r.quantita), r.unita].filter(Boolean).join(" ");
  if (/\bq\.b\./i.test(r.nota ?? "")) return "q.b.";
  return null;
}

/** La nota senza «q.b.», che è già scritto nella colonna della quantità. */
const notaSenzaQb = (nota) =>
  (nota ?? "")
    .split(" · ")
    .filter((p) => !/^q\.b\.$/i.test(p.trim()))
    .join(" · ") || null;

const Chip = ({ children, tenue }) => (
  <span
    className={`rounded-full px-3 py-0.5 testo-sala ${
      tenue ? "bg-b58-charcoal/5 text-b58-charcoal-soft/70" : "bg-b58-cream-dark text-b58-charcoal"
    }`}
  >
    {children}
  </span>
);

export default function LetturaBozza({ bozza, ingredienti, passaggi, modifica, puoModificare, onModifica }) {
  const video = bozza.sunto?.match(VIDEO)?.[1] ?? null;
  const sunto = bozza.sunto && !VIDEO.test(bozza.sunto) ? bozza.sunto : null;
  const link = /^https?:\/\//.test(bozza.origine_riferimento ?? "") ? bozza.origine_riferimento : null;

  return (
    <>
      <header className="mb-4 mt-2 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display testo-sala-titolo text-b58-charcoal">{bozza.titolo}</h1>
          {puoModificare && (
            <button
              type="button"
              className="tocco-bottone rounded-lg border border-b58-charcoal/20 px-4 text-b58-charcoal"
              onClick={onModifica}
            >
              {modifica ? "Fine modifiche" : "Modifica"}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {bozza.categoria ? (
            <Chip>{labelFor(RECIPE_CATEGORIES, bozza.categoria)}</Chip>
          ) : (
            <Chip tenue>categoria da scegliere</Chip>
          )}
          {bozza.porzioni ? <Chip>{bozza.porzioni} porzioni</Chip> : <Chip tenue>porzioni da dire</Chip>}
          <Chip tenue>
            {labelFor(ORIGINI_BOZZA, bozza.origine_tipo)} · {statoLeggibile(bozza)}
          </Chip>
        </div>
        {(link || video) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {link && (
              <a className="tocco-riga inline-flex items-center text-b58-terracotta underline" href={link} target="_blank" rel="noreferrer">
                Ricetta originale ↗
              </a>
            )}
            {video && (
              <a className="tocco-riga inline-flex items-center text-b58-terracotta underline" href={video} target="_blank" rel="noreferrer">
                Guarda il video ↗
              </a>
            )}
          </div>
        )}
        {sunto && <p className="mt-2 text-b58-charcoal-soft">{sunto}</p>}
      </header>

      {!modifica && (
        <>
          <section className="mb-4 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
            <h2 className="mb-2 font-display font-semibold text-b58-charcoal">Ingredienti</h2>
            {ingredienti.length === 0 ? (
              <p className="text-b58-charcoal-soft/70">Nessun ingrediente.</p>
            ) : (
              <ul className="divide-y divide-b58-charcoal/10">
                {ingredienti.map((r) => {
                  const q = quantitaLeggibile(r);
                  const nota = notaSenzaQb(r.nota);
                  return (
                    <li key={r.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2">
                      <span className={`text-right tabular-nums ${q ? "font-medium text-b58-charcoal" : "text-b58-charcoal-soft/50"}`}>
                        {q ?? "—"}
                      </span>
                      <span>
                        <span className="text-b58-charcoal">{r.nome}</span>
                        {nota && <span className="block testo-sala text-b58-charcoal-soft/80">{nota}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-4 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
            <h2 className="mb-2 font-display font-semibold text-b58-charcoal">Procedimento</h2>
            {passaggi.length === 0 ? (
              <p className="text-b58-charcoal-soft/70">Nessun passaggio.</p>
            ) : (
              <ol className="space-y-3">
                {passaggi.map((p, i) => (
                  <li key={p.id} className="grid grid-cols-[2rem_1fr] gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-b58-charcoal text-b58-parchment testo-sala">
                      {i + 1}
                    </span>
                    <div>
                      <span
                        className={`mb-1 inline-block rounded-full px-2.5 py-0.5 testo-sala ${
                          COLORE_FASE[p.fase] ?? "bg-b58-charcoal/5 text-b58-charcoal-soft/70"
                        }`}
                      >
                        {p.fase ? labelFor(STEP_PHASES, p.fase) : "fase da scegliere"}
                      </span>
                      <p className="text-b58-charcoal">{p.descrizione}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}
