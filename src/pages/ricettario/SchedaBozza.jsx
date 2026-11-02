import { RECIPE_CATEGORIES, STEP_PHASES, labelFor } from "../../lib/constants";
import { ORIGINI_BOZZA, TIPI_BOZZA, quantitaDalCampo, statoLeggibile } from "../../lib/calcoli/bozzeRicetta";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import { AllergeniArchivio, TagEStagioni } from "../../components/ArchivioRicetta";

// LA SCHEDA DI UNA BOZZA — una schermata sola, per leggerla e per correggerla.
//
// 10/10/2026, Alessio guardando la bozza della panna cotta: *«troppo
// dispersiva e monocromatica, non si capisce niente»* → nasce la scheda da
// leggere: titolo e dati essenziali in testa, ingredienti con la quantità in
// colonna, procedimento numerato con la fase a colori.
//
// 11/10/2026, Alessio dopo la seconda importazione: *«non possiamo rendere la
// schermata nuova anche modificabile, in modo da avere una sola schermata e
// non usare l'altra che è piuttosto confusionaria?»*. Quindi «Modifica» non
// apre più un modulo a parte: trasforma IN POSTO ogni dato nel suo campo,
// stessa disposizione, stesse colonne. Si corregge guardando la ricetta.
//
// ⚠️ Ogni campo si salva da solo (`CampoAutosalvato`), come prima: la scheda
//    non ha un pulsante «Salva», e «Fine modifiche» torna solo alla lettura.
// ⚠️ Quello che manca si DICE («—», «categoria da scegliere»), non si nasconde.
// ⚠️ Il collegamento al magazzino compare solo «in cucina» (`cucina`): nel
//    ricettario virtuale non è un campo da compilare.

const CATEGORIE_BOZZA = RECIPE_CATEGORIES.filter((c) => c.value !== "finger_food");

// 25/10/2026, Alessio: *«tra le categorie disponibili non c'è preparazioni o
// finger»*. Non sono categorie (antipasto, primo…) ma il TIPO di ricetta, ed è
// per questo che stanno in un menu a sé: una crema pasticcera è un dolce E una
// preparazione. Un piatto si conta a porzioni, una preparazione o un finger a
// RESA — quanto ne viene da una dose — perché è da lì che nasce il costo
// quando li si usa dentro un'altra ricetta.
const aResa = (bozza) => (bozza.tipo ?? "piatto_finito") !== "piatto_finito";

// 25/10/2026: una quantità che la ricetta originale non diceva NON si inventa
// (né qui né dall'assistente, che non tocca i numeri). Si dice da dove viene
// il vuoto, così non sembra una dimenticanza di chi ha copiato.
const SENZA_QUANTITA = "quantità non indicata nella ricetta originale";
const vienDaFuori = (bozza) => bozza.origine_tipo && bozza.origine_tipo !== "manuale";

const COLORE_FASE = {
  mise_en_place: "bg-b58-olive/15 text-b58-olive-dark-testo",
  cottura: "bg-b58-terracotta/15 text-b58-terracotta-dark-testo",
  finitura: "bg-b58-ambra/15 text-b58-ambra-dark-testo",
  impiattamento: "bg-b58-gold/20 text-b58-gold-dark-testo",
};
const FASE_VUOTA = "bg-b58-charcoal/5 text-b58-charcoal-soft/70";

const VIDEO = /Video originale:\s*(https?:\/\/\S+)/i;

const numero = (n) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: 3 });
// Nel campo, la virgola come in lettura ma senza il punto delle migliaia
// («1500», non «1.500», che si rileggerebbe come uno e mezzo).
const numeroNelCampo = (n) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: 3, useGrouping: false });


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

// I campi in posto: bordo leggero, sfondo chiaro, si vede che si scrive lì.
const campo = "tocco-riga w-full rounded-lg border border-b58-charcoal/20 bg-b58-campo px-3 text-b58-charcoal";
const piccolo = "tocco-riga rounded-lg border border-b58-charcoal/20 bg-b58-campo px-2 text-b58-charcoal";
const togli =
  "tocco-bottone shrink-0 rounded-lg px-3 text-b58-charcoal-soft/70 hover:bg-b58-charcoal/5 hover:text-red-700";
const aggiungi = "tocco-bottone mt-3 rounded-lg border border-dashed border-b58-charcoal/30 px-4 text-b58-charcoal";

const Chip = ({ children, tenue }) => (
  <span
    className={`rounded-full px-3 py-0.5 testo-sala ${
      tenue ? "bg-b58-charcoal/5 text-b58-charcoal-soft/70" : "bg-b58-cream-dark text-b58-charcoal"
    }`}
  >
    {children}
  </span>
);

const Scheda = ({ titolo, children }) => (
  <section className="mb-4 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
    <h2 className="mb-2 font-display font-semibold text-b58-charcoal">{titolo}</h2>
    {children}
  </section>
);

export default function SchedaBozza({
  bozza,
  ingredienti,
  passaggi,
  modifica,
  puoModificare,
  onModifica,
  cucina = false,
  anagrafica = [],
  unita = [],
  tagSuggeriti = [],
  azioni = {},
}) {
  const video = bozza.sunto?.match(VIDEO)?.[1] ?? null;
  const sunto = bozza.sunto && !VIDEO.test(bozza.sunto) ? bozza.sunto : null;
  const link = /^https?:\/\//.test(bozza.origine_riferimento ?? "") ? bozza.origine_riferimento : null;
  const codiciUnita = unita.map((u) => u.value);

  return (
    <>
      <header className="mb-4 mt-2 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
        <div className={`flex items-start justify-between gap-2 ${modifica ? "flex-col-reverse" : "flex-wrap"}`}>
          {modifica ? (
            <div className="w-full">
              <CampoAutosalvato
                value={bozza.titolo}
                etichetta="Titolo"
                className={`${campo} font-display testo-sala-titolo`}
                onSave={(t) => t && azioni.bozza({ titolo: t })}
              />
            </div>
          ) : (
            <h1 className="font-display testo-sala-titolo text-b58-charcoal">{bozza.titolo}</h1>
          )}
          {puoModificare && (
            <button
              type="button"
              className={`tocco-bottone self-end rounded-lg px-4 ${
                modifica ? "bg-b58-inverso text-b58-sul-colore" : "border border-b58-charcoal/20 text-b58-charcoal"
              }`}
              onClick={onModifica}
            >
              {modifica ? "Fine modifiche" : "Modifica"}
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {modifica ? (
            <>
              <select
                value={bozza.categoria ?? ""}
                aria-label="Categoria"
                className={piccolo}
                onChange={(e) => azioni.bozza({ categoria: e.target.value || null })}
              >
                <option value="">categoria da scegliere</option>
                {CATEGORIE_BOZZA.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={bozza.tipo ?? "piatto_finito"}
                aria-label="Tipo"
                className={piccolo}
                onChange={(e) => azioni.bozza({ tipo: e.target.value })}
              >
                {TIPI_BOZZA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {aResa(bozza) ? (
                <span className="inline-flex items-center gap-2">
                  resa
                  <CampoAutosalvato
                    value={bozza.resa_quantita == null ? "" : numeroNelCampo(bozza.resa_quantita)}
                    etichetta="Resa"
                    placeholder="—"
                    className={`${piccolo} w-20 text-right tabular-nums`}
                    onSave={(t) => azioni.bozza({ resa_quantita: quantitaDalCampo(t) })}
                  />
                  <select
                    value={bozza.resa_unita ?? ""}
                    aria-label="Unità della resa"
                    className={`${piccolo} w-24`}
                    onChange={(e) => azioni.bozza({ resa_unita: e.target.value || null })}
                  >
                    <option value="">unità</option>
                    {unita.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <CampoAutosalvato
                    value={bozza.porzioni ?? ""}
                    etichetta="Porzioni"
                    placeholder="—"
                    className={`${piccolo} w-20 text-right`}
                    onSave={(t) => {
                      const n = quantitaDalCampo(t);
                      azioni.bozza({ porzioni: n === null ? null : Math.round(n) });
                    }}
                  />
                  porzioni
                </span>
              )}
            </>
          ) : (
            <>
              {bozza.categoria ? (
                <Chip>{labelFor(RECIPE_CATEGORIES, bozza.categoria)}</Chip>
              ) : (
                <Chip tenue>categoria da scegliere</Chip>
              )}
              {aResa(bozza) && <Chip>{labelFor(TIPI_BOZZA, bozza.tipo)}</Chip>}
              {aResa(bozza) ? (
                bozza.resa_quantita && bozza.resa_unita ? (
                  <Chip>
                    resa {numero(bozza.resa_quantita)} {bozza.resa_unita}
                  </Chip>
                ) : (
                  <Chip tenue>resa da dire</Chip>
                )
              ) : bozza.porzioni ? (
                <Chip>{bozza.porzioni} porzioni</Chip>
              ) : (
                <Chip tenue>porzioni da dire</Chip>
              )}
            </>
          )}
          <Chip tenue>
            {labelFor(ORIGINI_BOZZA, bozza.origine_tipo)} · {statoLeggibile(bozza)}
          </Chip>
        </div>

        {/* L'archivio (25/10/2026): stagioni e tag. */}
        <TagEStagioni
          tags={bozza.tags}
          stagioni={bozza.stagioni}
          modifica={modifica}
          suggeriti={tagSuggeriti}
          onTags={(tags) => azioni.bozza({ tags })}
          onStagioni={(stagioni) => azioni.bozza({ stagioni })}
        />

        {modifica ? (
          <div className="mt-3 grid gap-2">
            <CampoAutosalvato
              value={bozza.origine_riferimento ?? ""}
              etichetta="Link della ricetta originale"
              placeholder="link della ricetta originale"
              className={campo}
              onSave={(t) => azioni.bozza({ origine_riferimento: t || null })}
            />
            <CampoAutosalvato
              value={bozza.sunto ?? ""}
              etichetta="Sunto"
              placeholder="due righe per ricordarsi di cosa si tratta"
              righe={2}
              className={`${campo} resize-none py-2`}
              onSave={(t) => azioni.bozza({ sunto: t || null })}
            />
          </div>
        ) : (
          <>
            {(link || video) && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {link && (
                  <a className="tocco-riga inline-flex items-center text-b58-terracotta-testo underline" href={link} target="_blank" rel="noreferrer">
                    Ricetta originale ↗
                  </a>
                )}
                {video && (
                  <a className="tocco-riga inline-flex items-center text-b58-terracotta-testo underline" href={video} target="_blank" rel="noreferrer">
                    Guarda il video ↗
                  </a>
                )}
              </div>
            )}
            {sunto && <p className="mt-2 text-b58-charcoal-soft">{sunto}</p>}
          </>
        )}
      </header>

      <Scheda titolo="Ingredienti">
        {ingredienti.length === 0 && <p className="text-b58-charcoal-soft/70">Nessun ingrediente.</p>}
        <ul className="divide-y divide-b58-charcoal/10">
          {ingredienti.map((r) => {
            const nota = notaSenzaQb(r.nota);
            if (!modifica) {
              const q = quantitaLeggibile(r);
              const nonDetta = !q && vienDaFuori(bozza);
              return (
                <li key={r.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2">
                  <span className={`text-right tabular-nums ${q ? "font-medium text-b58-charcoal" : "text-b58-charcoal-soft/50"}`}>
                    {q ?? "—"}
                  </span>
                  <span>
                    <span className="text-b58-charcoal">{r.nome}</span>
                    {nonDetta && <span className="block testo-sala text-b58-ambra-dark-testo">{SENZA_QUANTITA}</span>}
                    {nota && <span className="block testo-sala text-b58-charcoal-soft/80">{nota}</span>}
                  </span>
                </li>
              );
            }
            const unitaSconosciuta = r.unita && !codiciUnita.includes(r.unita);
            return (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 py-2">
                <CampoAutosalvato
                  value={r.nome}
                  etichetta="Ingrediente"
                  className={campo}
                  onSave={(t) => t && azioni.ingrediente(r, { nome: t })}
                />
                <button
                  type="button"
                  aria-label={`Togli ${r.nome}`}
                  title="Togli dalla bozza"
                  className={togli}
                  onClick={() => azioni.togliIngrediente(r)}
                >
                  ✕
                </button>
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  <CampoAutosalvato
                    value={r.quantita == null ? "" : numeroNelCampo(r.quantita)}
                    etichetta={`Quantità di ${r.nome}`}
                    placeholder="quanto"
                    className={`${piccolo} w-24 text-right tabular-nums`}
                    onSave={(t) => azioni.ingrediente(r, { quantita: quantitaDalCampo(t) })}
                  />
                  <select
                    value={r.unita ?? ""}
                    aria-label={`Unità di ${r.nome}`}
                    className={`${piccolo} w-28`}
                    onChange={(e) => azioni.ingrediente(r, { unita: e.target.value || null })}
                  >
                    <option value="">unità</option>
                    {unitaSconosciuta && <option value={r.unita}>«{r.unita}» — non compresa</option>}
                    {unita.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  {nota && <span className="testo-sala text-b58-charcoal-soft/80">{nota}</span>}
                  {quantitaLeggibile(r) === null && vienDaFuori(bozza) && (
                    <span className="basis-full testo-sala text-b58-ambra-dark-testo">{SENZA_QUANTITA}</span>
                  )}
                </div>
                {cucina && (
                  <select
                    value={r.ingredient_id ?? ""}
                    aria-label={`Prodotto del magazzino per ${r.nome}`}
                    className={`${campo} col-span-2 ${r.ingredient_id ? "" : "border-b58-terracotta/50"}`}
                    onChange={(e) => azioni.ingrediente(r, { ingredient_id: e.target.value || null })}
                  >
                    <option value="">— non collegato al magazzino —</option>
                    {anagrafica.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
        {modifica && (
          <button type="button" className={aggiungi} onClick={azioni.aggiungiIngrediente}>
            + Ingrediente
          </button>
        )}
      </Scheda>

      {/* 🔴 Gli allergeni della ricetta intera: proposti da MEMO o detti da
          te. Toccarli o premere «Confermo» li fa «confermati» — e l'origine
          viaggia SEMPRE con l'elenco, perché il database la pretende. */}
      <Scheda titolo="Allergeni">
        <AllergeniArchivio
          allergeni={bozza.allergeni ?? null}
          origine={bozza.allergeni_origine}
          modifica={modifica}
          onAllergeni={
            modifica || puoModificare
              ? (allergeni) => azioni.bozza({ allergeni, allergeni_origine: "confermati" })
              : undefined
          }
        />
      </Scheda>

      <Scheda titolo="Procedimento">
        {passaggi.length === 0 && <p className="text-b58-charcoal-soft/70">Nessun passaggio.</p>}
        <ol className="space-y-3">
          {passaggi.map((p, i) => (
            <li key={p.id} className={`grid gap-3 ${modifica ? "grid-cols-[2rem_1fr_auto]" : "grid-cols-[2rem_1fr]"}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-b58-inverso text-b58-sul-colore testo-sala">
                {i + 1}
              </span>
              {modifica ? (
                <div className="grid min-w-0 gap-1">
                  <select
                    value={p.fase ?? ""}
                    aria-label={`Fase del passaggio ${i + 1}`}
                    className={`tocco-riga justify-self-start rounded-full border-0 px-3 testo-sala ${COLORE_FASE[p.fase] ?? FASE_VUOTA}`}
                    onChange={(e) => azioni.passaggio(p, { fase: e.target.value || null })}
                  >
                    <option value="">fase da scegliere</option>
                    {STEP_PHASES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <CampoAutosalvato
                    value={p.descrizione ?? ""}
                    etichetta={`Passaggio ${i + 1}`}
                    placeholder="cosa si fa"
                    righe={2}
                    className={`${campo} resize-none py-2`}
                    onSave={(t) => azioni.passaggio(p, { descrizione: t || null })}
                  />
                </div>
              ) : (
                <div>
                  <span className={`mb-1 inline-block rounded-full px-2.5 py-0.5 testo-sala ${COLORE_FASE[p.fase] ?? FASE_VUOTA}`}>
                    {p.fase ? labelFor(STEP_PHASES, p.fase) : "fase da scegliere"}
                  </span>
                  <p className="text-b58-charcoal">{p.descrizione}</p>
                </div>
              )}
              {modifica && (
                <button
                  type="button"
                  aria-label={`Togli il passaggio ${i + 1}`}
                  title="Togli il passaggio"
                  className={togli}
                  onClick={() => azioni.togliPassaggio(p)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
        {modifica && (
          <button type="button" className={aggiungi} onClick={azioni.aggiungiPassaggio}>
            + Passaggio
          </button>
        )}
      </Scheda>
    </>
  );
}
