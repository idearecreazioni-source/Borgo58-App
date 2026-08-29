import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listRecipes, listAllRecipeCosts, listAllRecipeAllergens } from "../../lib/api/recipes";
import {
  ALLERGENS,
  RECIPE_CATEGORIES,
  RECIPE_STATI,
  SEASONS,
  recipeStatusLabel,
} from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import { campiRicetta } from "../../lib/calcoli/ricette";

// LE TRE PORTE (24/08/2026, blocco 2(b) del mandato del collaudo).
//
// Alessio: *«oggi stanno nello stesso elenco distinte solo da un'etichetta:
// il gestionale sa già chi è cosa, mancano due porte diverse»*.
//
// ⚠️ SONO TRE E NON DUE, ed è l'unico punto in cui questa schermata si
// allontana dalla lettera della richiesta: i tipi che il database
// distingue sono **tre** (piatto, preparazione, finger), e mettendone due
// insieme si rifarebbe in piccolo il problema che si sta togliendo — un
// elenco misto dove serve un'etichetta per capire cosa si sta guardando.
// Se le porte giuste sono due, si toglie una riga di questo elenco.
//
// ⚠️ E DAL 30/08 OGNI PORTA PORTA CON SÉ IL TIPO DI CIÒ CHE SI CREA
// (`crea`): il modulo di creazione non chiede più «che cos'è» — lo sa dal
// posto da cui si entra. Vedi `RicettaForm.jsx`.
const PORTE = [
  { value: "piatto_finito", label: "Piatti", vuoto: "Nessun piatto.", crea: "piatto_finito", nuovo: "+ Nuovo piatto" },
  { value: "preparazione", label: "Preparazioni", vuoto: "Nessuna preparazione.", crea: "preparazione", nuovo: "+ Nuova preparazione" },
  { value: "finger", label: "Finger", vuoto: "Nessun finger.", crea: "finger", nuovo: "+ Nuovo finger" },
];

// 🔴 DENTRO «FINGER», DUE COSE DIVERSE — 30/08/2026, struttura decisa da
// Alessio: *«un selettore a due posizioni: singoli finger e piatti composti
// da finger»*.
//
// ⚠️ NON SONO UNA QUARTA PORTA, ed è la ragione per cui stanno qui dentro:
// un bocconcino e il tagliere che lo contiene si guardano insieme — si
// compone l'uno guardando gli altri. Metterli fra le tre porte li
// allontanerebbe di un tocco proprio nel gesto in cui servono vicini.
//
// ⚠️ E LA SELEZIONE NON È UN «PIATTO» PER L'ELENCO «PIATTI»: la porta dei
// piatti la esclude (`selezioni: false`). Una riga che compare in due
// elenchi fa credere di averla corretta anche dove non si è guardato.
const MODI_FINGER = [
  { value: "singoli", label: "Singoli finger", vuoto: "Nessun finger.", crea: "finger", nuovo: "+ Nuovo finger" },
  {
    value: "selezioni",
    label: "Piatti composti da finger",
    vuoto: "Nessuna selezione di finger.",
    crea: "selezione",
    nuovo: "+ Nuova selezione",
  },
];

export default function RicetteList() {
  const [recipes, setRecipes] = useState([]);
  const [costs, setCosts] = useState({});
  const [allergeni, setAllergeni] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stagione, setStagione] = useState("");
  const [senzaAllergene, setSenzaAllergene] = useState("");
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  // ⚠️ LA PORTA STA NELL'INDIRIZZO, non solo nello stato della schermata:
  // così «le preparazioni» è un posto a cui si torna, si aggiunge ai
  // preferiti e si ritrova ricaricando la pagina. Uno stato interno
  // riporterebbe ai piatti a ogni giro.
  const [params, setParams] = useSearchParams();
  const porta = PORTE.find((p) => p.value === params.get("tipo")) ?? PORTE[0];
  const suiFinger = porta.value === "finger";
  const modo = MODI_FINGER.find((m) => m.value === params.get("modo")) ?? MODI_FINGER[0];
  const suSelezioni = suiFinger && modo.value === "selezioni";
  // Dove si sta guardando, e cosa si crea premendo il pulsante: una sola
  // risposta per tutt'e due, così non possono dire due cose diverse.
  const dove = suiFinger ? modo : porta;

  const cambiaPorta = (valore) => {
    const nuovi = new URLSearchParams(params);
    nuovi.set("tipo", valore);
    // ⚠️ Uscendo dai finger il sotto-modo si toglie dall'indirizzo: lasciato
    // lì tornerebbe addosso rientrando, e chi rientra dalle Preparazioni
    // non ha chiesto niente sulle selezioni.
    if (valore !== "finger") nuovi.delete("modo");
    setParams(nuovi, { replace: true });
  };
  const cambiaModo = (valore) => {
    const nuovi = new URLSearchParams(params);
    nuovi.set("modo", valore);
    setParams(nuovi, { replace: true });
  };

  useEffect(() => {
    setLoading(true);
    const filters = {
      search: search || undefined,
      category: category || undefined,
      statusFilter: statusFilter || undefined,
      // Una selezione è un `piatto_finito` nel database: si chiede quello,
      // e la si separa dagli altri piatti con la categoria.
      tipo: suSelezioni ? "piatto_finito" : porta.value,
      selezioni:
        porta.value === "piatto_finito" ? false : suSelezioni ? true : undefined,
    };
    // Il food cost è riservato al titolare — lo staff non lo carica nemmeno.
    const jobs = isTitolare
      ? Promise.all([listRecipes(filters), listAllRecipeCosts(), listAllRecipeAllergens()])
      : Promise.all([listRecipes(filters), Promise.resolve([]), listAllRecipeAllergens()]);
    jobs
      .then(([recipeData, costData, allergenData]) => {
        setRecipes(recipeData);
        setCosts(Object.fromEntries(costData.map((c) => [c.recipe_id, c])));
        setAllergeni(Object.fromEntries(allergenData.map((a) => [a.recipe_id, a])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, category, statusFilter, porta.value, suSelezioni, isTitolare]);

  // I FILTRI SULLE CARATTERISTICHE (blocco 2(d)).
  //
  // ⚠️ STAGIONALITÀ E ALLERGENI SI FILTRANO QUI e non nella richiesta al
  // database, per due ragioni diverse: la stagionalità è un array e il
  // «tutto l'anno» va incluso sempre (una regola, non un confronto); gli
  // allergeni stanno in un'altra vista e incrociarli nella query
  // costringerebbe a rifare il filtro in SQL — mentre le ricette sono
  // decine, non migliaia.
  const filtrate = useMemo(() => {
    let r = [...recipes].sort((a, b) => a.name.localeCompare(b.name));

    if (stagione) {
      r = r.filter((x) => {
        const s = x.seasonality ?? [];
        // ⚠️ «Tutto l'anno» c'è in ogni stagione: escluderlo farebbe
        // sparire da «estate» i piatti che si fanno sempre.
        return s.includes(stagione) || s.includes("tutto_anno");
      });
    }

    if (senzaAllergene) {
      r = r.filter((x) => {
        const a = allergeni[x.id];
        // 🔴 CHI NON SI SA NON È «SENZA», ed è il cuore di questo filtro.
        // Una ricetta i cui allergeni nessuno ha confermato non può
        // comparire fra le «senza glutine»: sarebbe una lista che dice a
        // un celiaco che dieci piatti sono sicuri quando di alcuni non si
        // sa niente. Assenza di informazione e informazione di assenza
        // sono due cose diverse (19/08), e qui la differenza è la salute
        // di qualcuno.
        if (!a || a.allergeni_da_verificare) return false;
        return !(a.allergens ?? []).includes(senzaAllergene);
      });
    }

    return r;
  }, [recipes, stagione, senzaAllergene, allergeni]);

  // ⚠️ Quante restano fuori perché non si sa: si DICHIARA, non si tace.
  // Un filtro che ne nasconde nove senza dirlo fa credere che ce ne sia
  // solo una — e il numero è la ragione per andare a compilare le schede.
  const esclusePerchePocoChiare = useMemo(() => {
    if (!senzaAllergene) return 0;
    const base = stagione
      ? recipes.filter((x) => {
          const s = x.seasonality ?? [];
          return s.includes(stagione) || s.includes("tutto_anno");
        })
      : recipes;
    return base.filter((x) => !allergeni[x.id] || allergeni[x.id].allergeni_da_verificare).length;
  }, [recipes, senzaAllergene, stagione, allergeni]);

  const filtroAttivo = search || category || statusFilter || stagione || senzaAllergene;
  const selectClass =
    "tocco-riga rounded-lg border border-b58-charcoal/15 bg-white px-3 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <Link
            to="/ricettario"
            className="tocco-riga inline-flex items-center px-2 -mx-2 rounded-lg testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
          >
            ← Ricettario
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">{dove.label}</h1>
        </div>
        {isTitolare && (
          <Link
            to={`/ricettario/ricette/nuova?tipo=${dove.crea}`}
            className="tocco-riga inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 testo-sala"
          >
            {dove.nuovo}
          </Link>
        )}
      </div>

      {/* LE TRE PORTE. ⚠️ Sono bottoni e non una tendina: si vede quali
          sono senza aprire niente, ed è la differenza fra sapere che le
          preparazioni hanno un posto proprio e doverlo scoprire. */}
      <div className="flex gap-2 mb-4 border-b border-b58-charcoal/10">
        {PORTE.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => cambiaPorta(p.value)}
            className={`tocco-riga px-4 -mb-px border-b-2 testo-sala transition-colors ${
              p.value === porta.value
                ? "border-b58-terracotta text-b58-charcoal font-medium"
                : "border-transparent text-b58-charcoal-soft hover:text-b58-charcoal"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* IL SELETTORE DENTRO «FINGER» — 30/08/2026.
          ⚠️ Compare SOLO sui finger: sulle altre due porte non c'è niente da
          separare, e una riga di comandi che c'è sempre diventa arredamento
          (18/08). */}
      {suiFinger && (
        <div className="flex flex-wrap gap-2 mb-4">
          {MODI_FINGER.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => cambiaModo(m.value)}
              className={`tocco-riga rounded-full px-4 border testo-sala transition-colors ${
                m.value === modo.value
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark font-medium"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft hover:border-b58-charcoal/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome…"
          className={`${selectClass} flex-1 min-w-[200px]`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">Tutte le categorie</option>
          {RECIPE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Tutti gli stati</option>
          {RECIPE_STATI.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={stagione} onChange={(e) => setStagione(e.target.value)} className={selectClass}>
          <option value="">Tutte le stagioni</option>
          {SEASONS.filter((s) => s.value !== "tutto_anno").map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={senzaAllergene}
          onChange={(e) => setSenzaAllergene(e.target.value)}
          className={selectClass}
        >
          <option value="">Qualunque allergene</option>
          {ALLERGENS.map((a) => (
            <option key={a.value} value={a.value}>senza {a.label.toLowerCase()}</option>
          ))}
        </select>
      </div>

      {esclusePerchePocoChiare > 0 && (
        <p className="testo-sala text-b58-terracotta-dark mb-4">
          {esclusePerchePocoChiare === 1
            ? "Una ricetta resta fuori"
            : `${esclusePerchePocoChiare} ricette restano fuori`}{" "}
          perché i loro allergeni non sono confermati: non si può dire che siano senza.{" "}
          <Link to="/ricettario/schede" className="tocco-inline underline text-b58-terracotta">
            Le schede dei prodotti
          </Link>
        </p>
      )}

      {error && <p className="testo-sala text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : filtrate.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {filtroAttivo ? "Nessuna ricetta corrisponde ai filtri." : dove.vuoto}
          </p>
        </div>
      ) : (
        <>
          {/* SUL TELEFONO: un blocchetto per ricetta, coi dati a capo.
              La tabella occupava 651 punti su 390 e sbordava di 277: il
              Ricettario si guarda in cucina, col telefono appoggiato. */}
          <div className="md:hidden space-y-3">
            {filtrate.map((r) => {
              const statusInfo = recipeStatusLabel(r.pronta_per_carta, r.in_carta, r.ritirata_il);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/ricettario/ricette/${r.id}`)}
                  className="w-full text-left rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4"
                >
                  {/* ⚠️ `flex-wrap`: un nome lungo più il cartellino dello
                      stato sforavano di 13 punti a 390 di larghezza. Il
                      cartellino va a capo invece di spingere fuori la riga. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
                    <span className="text-b58-charcoal font-medium testo-sala-grande">{r.name}</span>
                    <span
                      className={`inline-flex items-center rounded-full ${statusInfo.colorClass} text-b58-parchment testo-sala font-medium px-2.5 py-1 shrink-0`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  {campiRicetta(r, { porta: suSelezioni ? "piatto_finito" : porta.value, isTitolare, costo: costs[r.id] }).map((c) => (
                    <p key={c.chiave} className="testo-sala-grande">
                      <span className="text-b58-charcoal-soft">{c.etichetta}: </span>
                      {c.valore ? (
                        <span className={c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal"}>
                          {c.valore}
                        </span>
                      ) : (
                        <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? "—"}</span>
                      )}
                    </p>
                  ))}
                </button>
              );
            })}
          </div>

          {/* SUL COMPUTER: la tabella resta — li funziona. */}
          <div className="hidden md:block rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
            <table className="w-full testo-sala">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  {campiRicetta(filtrate[0], { porta: suSelezioni ? "piatto_finito" : porta.value, isTitolare }).map((c) => (
                    <th key={c.chiave} className="px-4 py-3 font-medium">
                      {c.etichetta}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {filtrate.map((r) => {
                  const statusInfo = recipeStatusLabel(r.pronta_per_carta, r.in_carta, r.ritirata_il);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/ricettario/ricette/${r.id}`)}
                      className="tocco-riga border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-b58-charcoal font-medium">{r.name}</td>
                      {campiRicetta(r, { porta: suSelezioni ? "piatto_finito" : porta.value, isTitolare, costo: costs[r.id] }).map((c) => (
                        <td
                          key={c.chiave}
                          className={`px-4 py-3 ${c.forte ? "text-b58-charcoal" : "text-b58-charcoal-soft"}`}
                        >
                          {c.valore || (
                            <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? "—"}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full ${statusInfo.colorClass} text-b58-parchment testo-sala font-medium px-2.5 py-1`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
