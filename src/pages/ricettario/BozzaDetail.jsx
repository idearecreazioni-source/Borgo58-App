import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
import { buchiDellaBozza, nuovoGesto } from "../../lib/calcoli/bozzeRicetta";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import { useUnita } from "../../lib/unita";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import SchedaBozza from "./SchedaBozza";

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
// 🔴 IL RICETTARIO VIRTUALE (10/10/2026, decisione di Alessio): una bozza si
//    TIENE così com'è, senza compilare niente. Il collegamento al magazzino,
//    le segnalazioni e «cosa manca» servono solo a farla diventare una
//    ricetta del locale, e restano chiusi dietro «Mettila nel Ricettario»
//    finché non li chiede. Prima l'elenco di 33 voci stava sempre sotto gli
//    occhi, e sembrava un obbligo.
//
// 🔴 25/10/2026: il collegamento al magazzino NON serve più per diventare
//    ricetta (migrazione 20261025000020). Gli ingredienti non collegati
//    entrano fra quelli «da collegare», e il collegamento diventa
//    obbligatorio solo per la carta, un menu o una preparazione.
//
// ⚠️ Ciò che ha proposto l'assistente all'importazione si DICHIARA
//    (`proposte_assistente`), finché Alessio non preme «Visto».
//
// ⚠️ IL DOPPIO TOCCO: aprendo la conferma nasce UN gesto, con un suo
//    identificativo. Premere due volte — o riprovare dopo un errore di rete —
//    manda lo stesso gesto, e il database risponde con la stessa ricetta
//    invece di crearne una seconda. In più la guardia sincrona non fa nemmeno
//    partire il secondo tocco mentre il primo è in viaggio (§8, 27/08).


export default function BozzaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const avvisoAssistente = useLocation().state?.avvisoAssistente ?? null;
  const unita = useUnita();
  const [inCucina, setInCucina] = useState(false);
  const [modifica, setModifica] = useState(false);
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
  // Il collegamento al magazzino si vede quando lo si chiede, o quando c'è già.
  const mostraCucina = inCucina || promossa || ingredienti.some((r) => r.ingredient_id);
  const proposte = bozza.proposte_assistente ?? [];
  const daCollegare = ingredienti.filter((r) => !r.ingredient_id).length;
  // Una schermata sola (11/10/2026): la scheda si LEGGE, e «Modifica» — o
  // portarla in cucina — trasforma in posto ogni dato nel suo campo.
  const inModifica = !ferma && (modifica || mostraCucina);

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

  const azioni = {
    bozza: salvaBozza,
    ingrediente: salvaIngrediente,
    passaggio: salvaPassaggio,
    togliIngrediente: (r) =>
      sicuro(async () => {
        await togliIngredienteBozza(r.id);
        setDati((d) => ({ ...d, ingredienti: d.ingredienti.filter((x) => x.id !== r.id) }));
      }),
    togliPassaggio: (p) =>
      sicuro(async () => {
        await togliPassaggioBozza(p.id);
        setDati((d) => ({ ...d, passaggi: d.passaggi.filter((x) => x.id !== p.id) }));
      }),
    aggiungiIngrediente: () =>
      sicuro(async () => {
        const nuova = await aggiungiIngredienteBozza(bozza.id, prossima(ingredienti));
        setDati((d) => ({ ...d, ingredienti: [...d.ingredienti, nuova] }));
      }),
    aggiungiPassaggio: () =>
      sicuro(async () => {
        const nuovo = await aggiungiPassaggioBozza(bozza.id, prossima(passaggi));
        setDati((d) => ({ ...d, passaggi: [...d.passaggi, nuovo] }));
      }),
  };

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
        ← Bozze
      </Link>

      <SchedaBozza
        bozza={bozza}
        ingredienti={ingredienti}
        passaggi={passaggi}
        modifica={inModifica}
        puoModificare={!ferma && !mostraCucina}
        onModifica={() => setModifica((m) => !m)}
        cucina={mostraCucina}
        anagrafica={anagrafica}
        unita={unita}
        azioni={azioni}
      />

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
      {avvisoAssistente && <p className="mb-4 rounded bg-amber-50 p-3 text-amber-900">{avvisoAssistente}</p>}
      {proposte.length > 0 && !ferma && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-b58-olive/10 p-3 text-b58-olive-dark ring-1 ring-b58-olive/20">
          <span>
            Proposte dall'assistente: {proposte.join(", ")}. Controllale e correggi dove serve.
          </span>
          <button
            type="button"
            className="tocco-bottone rounded-lg border border-b58-olive/40 px-3"
            onClick={() => salvaBozza({ proposte_assistente: [] })}
          >
            Visto
          </button>
        </div>
      )}

      {mostraCucina && bozza.buchi_dichiarati?.length > 0 && (
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


      {/* ---- il ricettario virtuale: niente da compilare finché non va in cucina ---- */}
      {!mostraCucina && bozza.stato !== "scartata" && (
        <section className="mb-6 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
          <p className="mb-3 text-b58-charcoal-soft">
            È salvata fra le bozze così com'è.
            <Didascalia>
              Mettendola nel Ricettario gli ingredienti non collegati al magazzino entrano lo stesso:
              li colleghi dopo, quando servono per il costo, la carta o un menu.
            </Didascalia>
          </p>
          <button
            type="button"
            className="tocco-bottone rounded bg-b58-azione px-5 text-b58-parchment"
            onClick={() => setInCucina(true)}
          >
            Mettila nel Ricettario
          </button>
        </section>
      )}

      {/* ---- cosa manca, e la conferma ---- */}
      {!promossa && (mostraCucina || bozza.stato === "scartata") && (
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
                  ? `Stai per creare nel Ricettario la ricetta «${bozza.titolo}», con ${ingredienti.length} ingredienti${
                      daCollegare > 0 ? ` (${daCollegare} da collegare al magazzino)` : ""
                    } e ${passaggi.length} passaggi.`
                  : "Stai per salvarla come ispirazione: titolo, sunto e link restano qui, e nel Ricettario non cambia niente."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={lavorando || (conferma.esito === "ricetta" && buchi.length > 0)}
                  className="tocco-bottone rounded bg-b58-azione px-5 text-b58-parchment disabled:opacity-50"
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
                className="tocco-bottone rounded bg-b58-azione px-5 text-b58-parchment disabled:opacity-50"
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
