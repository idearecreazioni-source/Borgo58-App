import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  aggiornaBozza,
  aggiornaIngredienteBozza,
  aggiornaPassaggioBozza,
  aggiungiIngredienteBozza,
  aggiungiPassaggioBozza,
  cambiaStatoBozza,
  eliminaBozza,
  getBozzaRicetta,
  promuoviBozza,
  togliIngredienteBozza,
  togliPassaggioBozza,
} from "../../lib/api/bozzeRicetta";
import { listIngredients } from "../../lib/api/ingredients";
import {
  ORIGINI_BOZZA,
  buchiDellaBozza,
  nuovoGesto,
  quantitaDalCampo,
  statoLeggibile,
} from "../../lib/calcoli/bozzeRicetta";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import { RECIPE_CATEGORIES, STEP_PHASES, labelFor } from "../../lib/constants";
import { useUnita } from "../../lib/unita";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import DatoNonLetto from "../../components/DatoNonLetto";

// UNA BOZZA DI RICETTA — rivederla e confermarla (Ricettario Fase 1A).
//
// 🔴 I BUCHI SI VEDONO PRIMA DELLA CONFERMA, sempre, in un riquadro solo: cosa
//    manca perché questa bozza diventi una ricetta. La conferma «crea ricetta»
//    resta spenta finché il riquadro non è vuoto, e il database la rifiuterebbe
//    comunque nominando gli stessi buchi.
//
// ⚠️ Dopo una correzione si aggiorna SOLO la riga toccata, mai la bozza intera:
//    ricaricare tutto butterebbe via quello che si sta ancora scrivendo in un
//    altro campo (§8, 12/08).
//
// ⚠️ IL DOPPIO TOCCO: aprendo la conferma nasce UN gesto, con un suo
//    identificativo. Premere due volte — o riprovare dopo un errore di rete —
//    manda lo stesso gesto, e il database risponde con la stessa ricetta
//    invece di crearne una seconda. In più la guardia sincrona non fa nemmeno
//    partire il secondo tocco mentre il primo è in viaggio (§8, 27/08).

const CATEGORIE_BOZZA = RECIPE_CATEGORIES.filter((c) => c.value !== "finger_food");
const campo = "tocco-riga w-full rounded border border-stone-300 px-3";

export default function BozzaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const unita = useUnita();
  const [dati, setDati] = useState(null);
  const [anagrafica, setAnagrafica] = useState([]);
  const [errore, setErrore] = useState("");
  const [erroreLettura, setErroreLettura] = useState("");
  const [conferma, setConferma] = useState(null); // { esito, gesto }
  const [lavorando, setLavorando] = useState(false);
  const [esito, setEsito] = useState(null);
  const guardia = useRef(unaVoltaSola());

  const carica = useCallback(async () => {
    setErroreLettura("");
    try {
      setDati(await getBozzaRicetta(id));
    } catch (e) {
      setDati(null);
      setErroreLettura(e.message);
    }
  }, [id]);

  useEffect(() => {
    carica();
  }, [carica]);

  useEffect(() => {
    listIngredients()
      .then((r) => setAnagrafica(r ?? []))
      .catch((e) => setErrore(`Non riesco a leggere l'anagrafica degli ingredienti: ${e.message}`));
  }, []);

  const codiciUnita = useMemo(() => unita.map((u) => u.value), [unita]);
  const buchi = useMemo(
    () => (dati ? buchiDellaBozza(dati.bozza, dati.ingredienti, dati.passaggi, codiciUnita) : []),
    [dati, codiciUnita]
  );

  if (erroreLettura) {
    return (
      <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
        <DatoNonLetto cosa="questa bozza" nonVuolDire="che sia vuota" onRiprova={carica} />
      </div>
    );
  }
  if (!dati) return <p className="p-4 testo-sala-grande">Caricamento…</p>;

  const { bozza, ingredienti, passaggi } = dati;
  const promossa = !!bozza.promossa_il;
  const ferma = promossa || bozza.stato === "scartata";

  const sicuro = async (fn) => {
    setErrore("");
    try {
      await fn();
    } catch (e) {
      setErrore(e.message);
    }
  };

  const salvaBozza = (campi) =>
    sicuro(async () => {
      await aggiornaBozza(bozza.id, campi);
      setDati((d) => ({ ...d, bozza: { ...d.bozza, ...campi } }));
    });

  const salvaIngrediente = (riga, campi) =>
    sicuro(async () => {
      const nuova = await aggiornaIngredienteBozza(riga.id, campi);
      setDati((d) => ({ ...d, ingredienti: d.ingredienti.map((r) => (r.id === riga.id ? nuova : r)) }));
    });

  const salvaPassaggio = (riga, campi) =>
    sicuro(async () => {
      await aggiornaPassaggioBozza(riga.id, campi);
      setDati((d) => ({
        ...d,
        passaggi: d.passaggi.map((r) => (r.id === riga.id ? { ...r, ...campi } : r)),
      }));
    });

  const prossima = (righe) => righe.reduce((m, r) => Math.max(m, r.posizione), 0) + 1;

  const apriConferma = (quale) => {
    setEsito(null);
    setConferma({ esito: quale, gesto: nuovoGesto() });
  };

  const confermaDavvero = async () => {
    if (!conferma || !guardia.current.prendi("conferma")) return;
    setLavorando(true);
    setErrore("");
    try {
      const r = await promuoviBozza(bozza.id, conferma.esito, conferma.gesto);
      setEsito(r);
      setConferma(null);
      await carica();
    } catch (e) {
      // ⚠️ Il gesto resta lo stesso: riprovare non crea una seconda ricetta.
      setErrore(e.message);
    } finally {
      guardia.current.lascia("conferma");
      setLavorando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
      <Link to="/ricettario/bozze" className="tocco-bottone inline-flex items-center testo-sala-grande text-stone-600">
        ← Bozze di ricetta
      </Link>

      <h1 className="mb-1 mt-2 text-2xl font-semibold">{bozza.titolo}</h1>
      <p className="mb-4 text-stone-600">
        {statoLeggibile(bozza)} · {labelFor(ORIGINI_BOZZA, bozza.origine_tipo)}
        {bozza.origine_riferimento ? ` · ${bozza.origine_riferimento}` : ""}
      </p>

      {promossa && (
        <p className="mb-4 rounded bg-emerald-50 p-3 text-emerald-800">
          È diventata ricetta il{" "}
          {new Date(bozza.promossa_il).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}.{" "}
          {bozza.ricetta_id ? (
            <Link className="underline" to={`/ricettario/ricette/${bozza.ricetta_id}`}>
              Apri la ricetta
            </Link>
          ) : (
            "La ricetta è stata poi tolta dal Ricettario; la bozza resta come traccia."
          )}
        </p>
      )}
      {esito && !promossa && esito.esito === "ispirazione" && (
        <p className="mb-4 rounded bg-emerald-50 p-3 text-emerald-800">
          Salvata come ispirazione: nel Ricettario non è cambiato niente.
        </p>
      )}
      {errore && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{errore}</p>}

      {/* ---- i dati della bozza ---- */}
      <section className="mb-6 grid gap-3">
        <label className="flex flex-col">
          <span className="text-stone-600">Titolo</span>
          <CampoAutosalvato
            value={bozza.titolo}
            disabled={ferma}
            className={campo}
            onSave={(t) => t && salvaBozza({ titolo: t })}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-stone-600">Sunto</span>
          <CampoAutosalvato
            value={bozza.sunto ?? ""}
            disabled={ferma}
            className={campo}
            onSave={(t) => salvaBozza({ sunto: t || null })}
          />
        </label>
        <label className="flex flex-col">
          <span className="text-stone-600">Link d'origine</span>
          <CampoAutosalvato
            value={bozza.origine_riferimento ?? ""}
            disabled={ferma}
            className={campo}
            onSave={(t) => salvaBozza({ origine_riferimento: t || null })}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col">
            <span className="text-stone-600">Categoria</span>
            <select
              value={bozza.categoria ?? ""}
              disabled={ferma}
              className="tocco-riga rounded border border-stone-300 px-3"
              onChange={(e) => salvaBozza({ categoria: e.target.value || null })}
            >
              <option value="">— non ancora detta —</option>
              {CATEGORIE_BOZZA.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-stone-600">Porzioni</span>
            <CampoAutosalvato
              value={bozza.porzioni ?? ""}
              disabled={ferma}
              placeholder="non ancora dette"
              className="tocco-riga w-40 rounded border border-stone-300 px-3"
              onSave={(t) => {
                const n = quantitaDalCampo(t);
                salvaBozza({ porzioni: n === null ? null : Math.round(n) });
              }}
            />
          </label>
        </div>
      </section>

      {bozza.buchi_dichiarati?.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Segnalazioni di chi ha proposto la bozza</h2>
          <ul>
            {bozza.buchi_dichiarati.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-1">
                <span>{b}</span>
                {!ferma && (
                  <button
                    type="button"
                    className="tocco-bottone rounded border border-stone-300 px-3"
                    onClick={() =>
                      salvaBozza({ buchi_dichiarati: bozza.buchi_dichiarati.filter((_, j) => j !== i) })
                    }
                  >
                    Risolta
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- gli ingredienti proposti ---- */}
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Ingredienti proposti</h2>
        {ingredienti.length === 0 && <p className="text-stone-600">Nessuno.</p>}
        <ul>
          {ingredienti.map((r) => {
            const unitaSconosciuta = r.unita && !codiciUnita.includes(r.unita);
            return (
              <li key={r.id} className="mb-3 grid gap-2 border-b border-stone-200 pb-3 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className="text-stone-600">Come l'ha scritto la bozza</span>
                  <CampoAutosalvato
                    value={r.nome}
                    disabled={ferma}
                    className={campo}
                    onSave={(t) => t && salvaIngrediente(r, { nome: t })}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-stone-600">Ingrediente dell'anagrafica</span>
                  <select
                    value={r.ingredient_id ?? ""}
                    disabled={ferma}
                    className={campo}
                    onChange={(e) => salvaIngrediente(r, { ingredient_id: e.target.value || null })}
                  >
                    <option value="">— non collegato —</option>
                    {anagrafica.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col">
                  <span className="text-stone-600">Quantità</span>
                  <CampoAutosalvato
                    value={r.quantita ?? ""}
                    disabled={ferma}
                    placeholder="non ancora detta"
                    className={campo}
                    onSave={(t) => salvaIngrediente(r, { quantita: quantitaDalCampo(t) })}
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-stone-600">Unità</span>
                  <select
                    value={r.unita ?? ""}
                    disabled={ferma}
                    className={campo}
                    onChange={(e) => salvaIngrediente(r, { unita: e.target.value || null })}
                  >
                    <option value="">— non ancora detta —</option>
                    {unitaSconosciuta && <option value={r.unita}>«{r.unita}» — non compresa</option>}
                    {unita.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </label>
                {!ferma && (
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      className="tocco-bottone rounded border border-stone-300 px-3"
                      onClick={() =>
                        sicuro(async () => {
                          await togliIngredienteBozza(r.id);
                          setDati((d) => ({ ...d, ingredienti: d.ingredienti.filter((x) => x.id !== r.id) }));
                        })
                      }
                    >
                      Togli dalla bozza
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!ferma && (
          <button
            type="button"
            className="tocco-bottone rounded border border-stone-300 px-4"
            onClick={() =>
              sicuro(async () => {
                const nuova = await aggiungiIngredienteBozza(bozza.id, prossima(ingredienti));
                setDati((d) => ({ ...d, ingredienti: [...d.ingredienti, nuova] }));
              })
            }
          >
            + Ingrediente
          </button>
        )}
      </section>

      {/* ---- i passaggi proposti ---- */}
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Passaggi proposti</h2>
        {passaggi.length === 0 && <p className="text-stone-600">Nessuno.</p>}
        <ol>
          {passaggi.map((p, i) => (
            <li key={p.id} className="mb-3 grid gap-2 border-b border-stone-200 pb-3">
              <span className="font-medium">Passaggio {i + 1}</span>
              <select
                value={p.fase ?? ""}
                disabled={ferma}
                className={campo}
                onChange={(e) => salvaPassaggio(p, { fase: e.target.value || null })}
              >
                <option value="">— fase non ancora detta —</option>
                {STEP_PHASES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <CampoAutosalvato
                value={p.descrizione ?? ""}
                disabled={ferma}
                placeholder="cosa si fa"
                className={campo}
                onSave={(t) => salvaPassaggio(p, { descrizione: t || null })}
              />
              {!ferma && (
                <button
                  type="button"
                  className="tocco-bottone justify-self-start rounded border border-stone-300 px-3"
                  onClick={() =>
                    sicuro(async () => {
                      await togliPassaggioBozza(p.id);
                      setDati((d) => ({ ...d, passaggi: d.passaggi.filter((x) => x.id !== p.id) }));
                    })
                  }
                >
                  Togli il passaggio
                </button>
              )}
            </li>
          ))}
        </ol>
        {!ferma && (
          <button
            type="button"
            className="tocco-bottone rounded border border-stone-300 px-4"
            onClick={() =>
              sicuro(async () => {
                const nuovo = await aggiungiPassaggioBozza(bozza.id, prossima(passaggi));
                setDati((d) => ({ ...d, passaggi: [...d.passaggi, nuovo] }));
              })
            }
          >
            + Passaggio
          </button>
        )}
      </section>

      {/* ---- cosa manca, e la conferma ---- */}
      {!promossa && (
        <section className="mb-6 rounded border border-stone-300 p-4" data-buchi={buchi.length}>
          <h2 className="mb-2 font-semibold">
            {buchi.length === 0
              ? "Non manca niente: può diventare una ricetta."
              : `Cosa manca per diventare una ricetta (${buchi.length})`}
          </h2>
          {buchi.length > 0 && (
            <ul className="mb-3 list-disc pl-6">
              {buchi.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          {bozza.stato === "scartata" ? (
            <button
              type="button"
              className="tocco-bottone rounded border border-stone-300 px-4"
              onClick={() => sicuro(async () => { await cambiaStatoBozza(bozza.id, "in_revisione"); await carica(); })}
            >
              Riapri la bozza
            </button>
          ) : conferma ? (
            <div className="rounded bg-stone-50 p-3">
              <p className="mb-2">
                {conferma.esito === "ricetta"
                  ? `Stai per creare nel Ricettario la ricetta «${bozza.titolo}», con ${ingredienti.length} ingredienti e ${passaggi.length} passaggi.`
                  : "Stai per salvarla come ispirazione: titolo, sunto e link restano qui, e nel Ricettario non cambia niente."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={lavorando || (conferma.esito === "ricetta" && buchi.length > 0)}
                  className="tocco-bottone rounded bg-b58-terracotta px-5 text-b58-parchment disabled:opacity-50"
                  onClick={confermaDavvero}
                >
                  {lavorando
                    ? "Sto confermando…"
                    : conferma.esito === "ricetta"
                      ? "Sì, crea la ricetta"
                      : "Sì, salvala come ispirazione"}
                </button>
                <button
                  type="button"
                  disabled={lavorando}
                  className="tocco-bottone rounded border border-stone-300 px-4"
                  onClick={() => setConferma(null)}
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={buchi.length > 0}
                className="tocco-bottone rounded bg-b58-terracotta px-5 text-b58-parchment disabled:opacity-50"
                onClick={() => apriConferma("ricetta")}
              >
                Crea la ricetta
              </button>
              {bozza.stato !== "ispirazione" && (
                <button
                  type="button"
                  className="tocco-bottone rounded border border-stone-300 px-4"
                  onClick={() => apriConferma("ispirazione")}
                >
                  Tienila come ispirazione
                </button>
              )}
              <button
                type="button"
                className="tocco-bottone rounded border border-stone-300 px-4"
                onClick={() => sicuro(async () => { await cambiaStatoBozza(bozza.id, "scartata"); await carica(); })}
              >
                Scarta
              </button>
            </div>
          )}
          {buchi.length > 0 && !conferma && bozza.stato !== "scartata" && (
            <p className="mt-2 text-stone-600">«Crea la ricetta» si accende quando l'elenco qui sopra è vuoto.</p>
          )}
        </section>
      )}

      {/* ⚠️ Una bozza diventata ricetta resta come traccia finché la ricetta
          c'è: il database rifiuterebbe la cancellazione. */}
      {(!promossa || !bozza.ricetta_id) && (
        <button
          type="button"
          className="tocco-bottone rounded border border-red-300 px-4 text-red-700"
          onClick={() => sicuro(async () => { await eliminaBozza(bozza.id); navigate("/ricettario/bozze"); })}
        >
          Elimina la bozza
        </button>
      )}
    </div>
  );
}
