import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createBarItem,
  listBarItems,
  listMargineCarta,
  setBarItemActive,
  updateBarItem,
} from "../../lib/api/barItems";
import { listIngredients } from "../../lib/api/ingredients";
import { formatEUR, formatQta } from "../../lib/constants";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import Didascalia from "../../components/Didascalia";
import { leggi, nonLetto } from "../../lib/calcoli/letture";

// Carta di vini e bevande (§3.2.1). Vive nell'Editor Menu insieme al resto
// dell'offerta, ma su una tabella propria: menu_items pretende una ricetta
// collegata e una bevanda non lo e'.
//
// Le categorie sono suggerimenti, non una gabbia: il campo resta libero,
// cosi' aggiungere "Vermouth" o "Birre della casa" non richiede di
// toccare il programma.
const CATEGORIE_SUGGERITE = {
  vini: ["Bollicine", "Bianchi", "Rossi", "Rosati", "Da meditazione"],
  bevande: ["Birre", "Analcolici", "Caffetteria", "Amari e distillati"],
};

const FORMATI_SUGGERITI = ["Calice", "Bottiglia", "33 cl", "75 cl", "Tazzina"];

const emptyForm = {
  section: "vini",
  category: "Bollicine",
  name: "",
  producer: "",
  serving: "Calice",
  selling_price: "",
};

export default function BevandeVini() {
  const [items, setItems] = useState([]);
  // 🔴 I PRODOTTI DEL MAGAZZINO e IL MARGINE (30/08). Il margine lo calcola
  //    il database, non questa schermata: e' l'unico posto dove il prezzo
  //    d'acquisto e la resa si incontrano, e due calcoli della stessa cosa
  //    finiscono per dire due numeri diversi.
  const [prodotti, setProdotti] = useState([]);
  const [margini, setMargini] = useState(new Map());
  // ⚠️ «NON L'HO LETTO» NON È «NON C'È NIENTE», e vale per tutti e due.
  //    Un elenco di prodotti vuoto perché la lettura è fallita si legge
  //    «non hai nessun prodotto in magazzino», e una carta senza margini
  //    si legge «nessuna voce rende niente». Si usa il marcatore del
  //    progetto invece di un booleano mio: la regola vive in un posto
  //    solo, e una prova automatica la sorveglia.
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () =>
    listBarItems({ includeInactive: true })
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  const caricaMargini = () =>
    leggi(listMargineCarta()).then((righe) =>
      setMargini(nonLetto(righe) ? righe : new Map(righe.map((r) => [r.bar_item_id, r])))
    );

  useEffect(() => {
    load();
    caricaMargini();
    // ⚠️ Le bevande comprate stanno fra gli alimentari come tutto il resto:
    //    una bottiglia e' un prodotto, non una categoria a parte.
    leggi(listIngredients()).then(setProdotti);
  }, []);

  // Dopo ogni modifica che tocca il collegamento o la resa il margine cambia:
  // si ricarica quello che e' cambiato SUL SERVER, mai quello che si sta
  // scrivendo (trappola del 12/08).
  const dopoModifica = () => load().then(caricaMargini);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.selling_price === "") return;
    setSaving(true);
    setError("");
    try {
      await createBarItem(form);
      setForm((f) => ({ ...emptyForm, section: f.section, category: f.category, serving: f.serving }));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const visibili = items.filter((i) => showInactive || i.active);

  // ⚠️ «Rossi» e «rossi» sono la stessa categoria, e prima diventavano due
  // sezioni della carta con lo stesso titolo. Il campo resta libero per
  // scelta (§ sopra: aggiungere «Vermouth» non deve richiedere di toccare
  // il programma), quindi non si chiude il vocabolario — si raggruppa
  // ignorando maiuscole e accenti, tenendo la prima scrittura incontrata.
  const chiaveCategoria = (c) =>
    String(c ?? "").trim().toLocaleLowerCase("it").normalize("NFD").replace(/\p{Diacritic}/gu, "");

  // Raggruppamento per sezione e categoria, nell'ordine in cui si legge
  // una carta: prima i vini, poi il resto.
  // 🔴 QUANTO PAGHI UNA CONFEZIONE E QUANTO LA INCASSI. E le risposte sono
  //    TRE, non due: collegata e prezzata · collegata e senza prezzo · non
  //    collegata. Le ultime due non rendono niente e NON si dicono uguale —
  //    la prima si cura comprando, la seconda collegando. Un motivo solo
  //    manderebbe a cercare nel posto sbagliato.
  const RigaMagazzino = ({ v }) => {
    const m = nonLetto(margini) ? null : margini.get(v.id);
    return (
      <div className="px-2 pt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-1 testo-sala text-b58-charcoal-soft">
          <span>Prodotto</span>
          <select
            value={v.ingredient_id || ""}
            disabled={nonLetto(prodotti)}
            onChange={(e) =>
              updateBarItem(v.id, { ingredient_id: e.target.value || null })
                .then(dopoModifica)
                .catch((err) => setError(err.message))
            }
            className="tocco-campo rounded border border-b58-charcoal/15 px-2 py-1 testo-sala bg-transparent max-w-[14rem]"
          >
            <option value="">
              {nonLetto(prodotti) ? "— non ho letto i prodotti —" : "— non collegata —"}
            </option>
            {(nonLetto(prodotti) ? [] : prodotti).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 testo-sala text-b58-charcoal-soft">
          <span>Porzioni da una confezione</span>
          <CampoAutosalvato
            type="number"
            step="1"
            value={v.porzioni_per_unita ?? ""}
            onSave={(n) =>
              updateBarItem(v.id, { porzioni_per_unita: n === "" ? null : Number(n) })
                .then(dopoModifica)
                .catch((err) => setError(err.message))
            }
            className="w-16 tocco-campo rounded border border-b58-charcoal/15 px-2 py-1 testo-sala text-right"
          />
          <Didascalia>vuoto = si vende intera</Didascalia>
        </label>

        {nonLetto(margini) ? (
          <span className="testo-sala text-b58-terracotta-dark">
            il margine non è stato letto —{" "}
            <button type="button" onClick={caricaMargini} className="underline tocco-testo">
              riprova
            </button>
          </span>
        ) : m?.motivo === "non_collegata" ? (
          <span className="testo-sala text-b58-charcoal-soft/70">
            non collegata: non scarica la cantina e non ha margine
          </span>
        ) : m?.motivo === "prezzo_mancante" ? (
          <span className="testo-sala text-b58-charcoal-soft/70">
            di questo prodotto non si sa ancora quanto è costato
          </span>
        ) : m ? (
          <span className="testo-sala text-b58-charcoal-soft">
            paghi {formatEUR(m.costo_confezione)} · incassi {formatEUR(m.incasso_confezione)} ·{" "}
            <strong className="text-b58-charcoal">rende {formatEUR(m.margine_confezione)}</strong>
            {m.porzioni_per_unita ? ` (${m.porzioni_per_unita} porzioni)` : ""}
            {/* 🔴 IL NUMERO SI SCRIVE IN ITALIANO — visto a schermo il
                30/08: diceva «ne restano 1.3721», col punto inglese e
                quattro decimali, in mezzo a una frase italiana. È la
                famiglia del «26.6%» del 24/08.
                ⚠️ E si dice «da vendere» e non «porzioni»: su una voce
                venduta intera una porzione È una bottiglia, e chiamarla
                porzione sarebbe vero e illeggibile. */}
            {m.porzioni_disponibili != null
              ? ` · ne restano ${formatQta(m.porzioni_disponibili)} da vendere`
              : ""}
          </span>
        ) : null}
      </div>
    );
  };

  const sezioni = ["vini", "bevande"].map((section) => {
    const diSezione = visibili.filter((i) => i.section === section);
    const perChiave = new Map();
    for (const i of diSezione) {
      const k = chiaveCategoria(i.category);
      if (!perChiave.has(k)) perChiave.set(k, { nome: i.category, voci: [] });
      perChiave.get(k).voci.push(i);
    }
    return {
      section,
      label: section === "vini" ? "Carta dei vini" : "Bevande",
      categorie: [...perChiave.values()],
      totale: diSezione.length,
    };
  });

  // I suggerimenti comprendono le categorie già in uso: così la seconda
  // bottiglia si aggancia a quella di prima invece di reinventarne la
  // scrittura. È il freno che vale più del raggruppamento — quello ripara
  // dopo, questo evita.
  const categorieUsate = [
    ...new Map(
      items
        .filter((i) => i.section === form.section)
        .map((i) => [chiaveCategoria(i.category), i.category])
    ).values(),
  ];
  const suggerimentiCategoria = [
    ...new Set([...categorieUsate, ...CATEGORIE_SUGGERITE[form.section]]),
  ];

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-display text-2xl text-b58-charcoal">
          Bevande e vini
          <Didascalia>
            Una voce tolta dalla carta non viene cancellata: sparisce dal tablet ma resta
            leggibile nei conti già chiusi che la contengono, e in primavera si rimette
            con un tocco.
          </Didascalia>
        </h1>
        <Link
          to="/editor-menu"
          className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
        >
          ← Editor Menu
        </Link>
      </div>
      <p className="testo-sala-grande text-b58-charcoal-soft/80 mb-5 leading-relaxed">
        Quello che scrivi qui è ciò che la sala vede sul tablet: i <b>vini</b> nella
        schermata "Carta dei vini", le <b>bevande</b> nell'elenco accanto ai piatti.
        I prezzi sono quelli che paga il cliente, IVA inclusa.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* AGGIUNTA ------------------------------------------------------ */}
      <form onSubmit={handleAdd} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <select
            value={form.section}
            onChange={(e) => {
              const section = e.target.value;
              setForm((f) => ({ ...f, section, category: CATEGORIE_SUGGERITE[section][0] }));
            }}
            className={inputClass}
          >
            <option value="vini">Vino</option>
            <option value="bevande">Bevanda</option>
          </select>

          <input
            list="categorie-carta"
            required
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Categoria"
            className={inputClass}
          />
          <datalist id="categorie-carta">
            {suggerimentiCategoria.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome"
            className={`${inputClass} sm:col-span-2`}
          />

          <input
            list="formati-carta"
            value={form.serving}
            onChange={(e) => setForm((f) => ({ ...f, serving: e.target.value }))}
            placeholder="Formato"
            className={inputClass}
          />
          <datalist id="formati-carta">
            {FORMATI_SUGGERITI.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <input
            required
            type="number"
            step="0.50"
            min="0"
            value={form.selling_price}
            onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
            placeholder="€"
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input
            value={form.producer}
            onChange={(e) => setForm((f) => ({ ...f, producer: e.target.value }))}
            placeholder="Produttore o cantina (facoltativo)"
            className={`${inputClass} sm:max-w-xs`}
          />
          <button
            type="submit"
            disabled={saving}
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala-grande font-medium px-5 py-2 whitespace-nowrap"
          >
            {saving ? "Aggiungo…" : "+ Metti in carta"}
          </button>
        </div>
      </form>

      <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal-soft mb-4">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Mostra anche quelle fuori carta
      </label>

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Carico…</p>
      ) : (
        sezioni.map((s) => (
          <div key={s.section} className="mb-8">
            <h2 className="font-display text-xl text-b58-charcoal mb-2">
              {s.label} <span className="testo-sala-grande text-b58-charcoal-soft/70">({s.totale})</span>
            </h2>

            {s.totale === 0 ? (
              <p className="testo-sala-grande text-b58-charcoal-soft/60 bg-b58-cream-dark/30 rounded-lg px-3 py-3">
                {s.section === "vini"
                  ? "Nessun vino in carta. Finché è vuota, la schermata Carta dei vini in sala non compare."
                  : "Nessuna bevanda in carta."}
              </p>
            ) : (
              s.categorie.map((cat) => (
                <div key={cat.nome} className="mb-4">
                  <h3 className="testo-sala-grande font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-1">
                    {cat.nome}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full testo-sala-grande">
                      <tbody>
                        {cat.voci.map((v) => (
                          // 🔴 DUE RIGHE E NON UNA (30/08, misurato). Il
                          // collegamento al magazzino stava DENTRO la cella
                          // del nome, e il menu dei prodotti allargava la
                          // colonna: misurato a 375 punti, la tabella
                          // passava da 351 a 509 in un riquadro da 343 —
                          // cioè 158 punti di scorrimento in più, tutti
                          // miei. Su una riga sua a tutta larghezza cresce
                          // in ALTEZZA e non tocca nessuna colonna.
                          <Fragment key={v.id}>
                          <tr className={`${v.active ? "" : "opacity-50"}`}>
                            <td className="py-2 pr-2">
                              <CampoAutosalvato
                                value={v.name}
                                onSave={(nome) =>
                                  updateBarItem(v.id, { name: nome }).then(load).catch((e) => setError(e.message))
                                }
                                className="w-full tocco-campo rounded border border-transparent hover:border-b58-charcoal/15 px-2 py-1 testo-sala-grande bg-transparent"
                              />
                              {v.producer && (
                                <span className="testo-sala text-b58-charcoal-soft/70 px-2">{v.producer}</span>
                              )}
                            </td>
                            <td className="py-2 w-28 text-b58-charcoal-soft testo-sala">{v.serving}</td>
                            <td className="py-2 w-28">
                              <CampoAutosalvato
                                type="number"
                                step="0.50"
                                value={v.selling_price}
                                onSave={(p) =>
                                  updateBarItem(v.id, { selling_price: Number(p) })
                                    .then(load)
                                    .catch((e) => setError(e.message))
                                }
                                className="w-20 tocco-campo rounded border border-b58-charcoal/15 px-2 py-1 testo-sala-grande text-right"
                              />
                            </td>
                            <td className="py-2 w-20 text-right text-b58-charcoal-soft testo-sala">
                              {formatEUR(v.selling_price)}
                            </td>
                            <td className="py-2 w-24 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setBarItemActive(v.id, !v.active).then(load).catch((e) => setError(e.message))
                                }
                                className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                              >
                                {v.active ? "togli dalla carta" : "rimetti in carta"}
                              </button>
                            </td>
                          </tr>
                          <tr className={`border-b border-b58-charcoal/5 ${v.active ? "" : "opacity-50"}`}>
                            <td colSpan={5} className="pb-2">
                              <RigaMagazzino v={v} />
                            </td>
                          </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ))
      )}

      {/* ⚠️ Era un riquadro in fondo alla pagina: si legge una volta e poi
          è arredamento. La stessa frase sta ora accanto al titolo, dove la
          si cerca la prima volta che si toglie qualcosa dalla carta. */}
    </div>
  );
}
