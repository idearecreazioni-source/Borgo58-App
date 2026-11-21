import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import { accendiVoce, leggiContatori, leggiStorico, leggiVoci, paroleDelicate, salvaVoce } from "../../lib/api/scheda";
import {
  FONTI,
  SEZIONI,
  TESTO_MASSIMO,
  avvisoParoleDelicate,
  chiaveNuova,
  contatoreTesto,
  dataItaliana,
  daRivedere,
  etichettaFonte,
  frasiDelloStorico,
  messaggioDelDatabase,
  ordineInFondo,
  raggruppaVoci,
  riferimentoVoce,
  riquadroLimiti,
} from "../../lib/calcoli/scheda";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { unaVoltaSola } from "../../lib/calcoli/voce";

// =====================================================================
// LA SCHEDA DI BORGO 58 — la pagina (21/11/2026, pezzo S3)
// =====================================================================
// Gli appunti brevi di Alessio sul locale che MEMO legge a ogni domanda.
// Qui si rileggono e si correggono; MEMO li cita col numero [S12].
//
// ⚠️ NIENTE SI CANCELLA: una voce si spegne e si può riaccendere.
// ⚠️ I LIMITI LI DECIDE IL DATABASE (60 voci, 10.000 caratteri): la pagina
//    mostra il suo rifiuto con parole semplici, sotto il pulsante premuto.
// ⚠️ LE PAROLE DELICATE AVVISANO, NON BLOCCANO.
// ⚠️ UNA VOCE ALLA VOLTA in modifica: aprirne un'altra butterebbe via, senza
//    avviso, quello che si stava scrivendo.

const inputClass =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50";
const bottonePrimario =
  "tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-white hover:opacity-90 disabled:opacity-50";

const oggiIso = () => new Date().toISOString().slice(0, 10);
const quando = (v) =>
  v ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "";

function Limiti({ contatori }) {
  const r = riquadroLimiti(contatori);
  if (!r) return null;
  return (
    <div className="rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10 space-y-1" aria-label="Quanto spazio resta nella Scheda">
      <p className="testo-sala text-b58-charcoal">
        <strong>{r.voci}</strong> voci attive su {r.vociMassime} ·{" "}
        <strong>{r.caratteri.toLocaleString("it-IT")}</strong> caratteri su {r.caratteriMassimi.toLocaleString("it-IT")}
      </p>
      {r.frase && <p className="testo-sala text-b58-turno-dark-testo">{r.frase}</p>}
    </div>
  );
}

function StoricoDellaVoce({ voceId }) {
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState(false);
  const carica = useCallback(async () => {
    setErrore(false);
    const r = await leggi(leggiStorico(voceId));
    if (nonLetto(r)) setErrore(true);
    else setRighe(r);
  }, [voceId]);
  useEffect(() => {
    carica();
  }, [carica]);
  if (errore) return <DatoNonLetto cosa="lo storico di questa voce" onRiprova={carica} className="mt-2" />;
  if (righe === null) return <p className="mt-2 testo-sala text-b58-charcoal-soft">Caricamento…</p>;
  if (righe.length === 0) return <p className="mt-2 testo-sala text-b58-charcoal-soft">Nessuna modifica registrata.</p>;
  return (
    <ul className="mt-2 flex flex-col gap-2" aria-label="Storico della voce">
      {righe.map((r) => (
        <li key={r.id} className="rounded-lg bg-b58-parchment p-3 testo-sala text-b58-charcoal">
          <span className="block text-b58-charcoal-soft">{quando(r.quando)}</span>
          {frasiDelloStorico(r).join(" ")}
          {r.testo_prima != null && r.testo_prima !== r.testo_dopo && (
            <span className="mt-1 block text-b58-charcoal-soft">Prima diceva: «{r.testo_prima}»</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ModuloVoce({ iniziale, onSalvata, onAnnulla, preparazione = null }) {
  const idTesto = useId();
  const [v, setV] = useState(iniziale);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState(null);
  const [delicate, setDelicate] = useState([]);
  const [nonControllate, setNonControllate] = useState(false);
  const guardia = useRef(unaVoltaSola());
  const conta = contatoreTesto(v.testo);
  const cambia = (campo) => (e) => setV((x) => ({ ...x, [campo]: e.target.value }));

  // L'avviso si cerca quando si finisce di scrivere, non a ogni lettera.
  async function controllaParole() {
    const trovate = await paroleDelicate(v.testo);
    setNonControllate(trovate === null);
    setDelicate(trovate ?? []);
  }

  async function salva(e) {
    e.preventDefault();
    if (!guardia.current.prendi("salva")) return;
    setLavoro(true);
    setErrore(null);
    try {
      onSalvata(await salvaVoce(preparazione ? preparazione(v) : v));
    } catch (err) {
      setErrore(messaggioDelDatabase(err));
    } finally {
      guardia.current.lascia("salva");
      setLavoro(false);
    }
  }

  const avviso = avvisoParoleDelicate(delicate);
  return (
    <form onSubmit={salva} className="rounded-xl bg-b58-campo p-4 ring-1 ring-b58-azione/40 flex flex-col gap-3">
      <p className="testo-sala font-medium text-b58-charcoal">{v.id ? `Modifica ${riferimentoVoce(v)}` : "Nuova voce"}</p>
      <div>
        <label htmlFor={`${idTesto}-sezione`} className={labelClass}>Sezione</label>
        <select id={`${idTesto}-sezione`} value={v.sezione} onChange={cambia("sezione")} className={inputClass}>
          {SEZIONI.map((s) => (
            <option key={s.valore} value={s.valore}>{s.etichetta}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={idTesto} className={labelClass}>Cosa vuoi far sapere a MEMO</label>
        <textarea
          id={idTesto}
          value={v.testo}
          onChange={cambia("testo")}
          onBlur={controllaParole}
          rows={4}
          aria-describedby={`${idTesto}-conta`}
          className={inputClass}
          style={{ fontSize: "max(16px, 1em)" }}
        />
        <p id={`${idTesto}-conta`} className={`mt-1 testo-sala ${conta.oltre ? "text-b58-turno-dark-testo" : "text-b58-charcoal-soft"}`}>
          {conta.oltre
            ? `${conta.oltre} caratteri di troppo: il massimo è ${TESTO_MASSIMO}.`
            : `${conta.scritti} di ${TESTO_MASSIMO} caratteri.`}
        </p>
        {avviso && <p className="mt-1 testo-sala text-b58-turno-dark-testo">{avviso}</p>}
        {nonControllate && (
          <p className="mt-1 testo-sala text-b58-charcoal-soft">Non sono riuscito a controllare le parole delicate.</p>
        )}
      </div>
      <div>
        <label htmlFor={`${idTesto}-fonte`} className={labelClass}>Quanto è sicuro</label>
        <select id={`${idTesto}-fonte`} value={v.fonte} onChange={cambia("fonte")} className={inputClass}>
          {FONTI.map((f) => (
            <option key={f.valore} value={f.valore}>{f.etichetta} — {f.aiuto}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor={`${idTesto}-dal`} className={labelClass}>Vale dal</label>
          <input id={`${idTesto}-dal`} type="date" value={v.valida_dal ?? ""} onChange={cambia("valida_dal")} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${idTesto}-verificata`} className={labelClass}>Verificata il</label>
          <input id={`${idTesto}-verificata`} type="date" value={v.verificata_il ?? ""} onChange={cambia("verificata_il")} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${idTesto}-rivedere`} className={labelClass}>Da rivedere entro</label>
          <input id={`${idTesto}-rivedere`} type="date" value={v.rivedere_entro ?? ""} onChange={cambia("rivedere_entro")} className={inputClass} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={lavoro || !v.testo.trim() || conta.oltre > 0} className={bottonePrimario}>
          {lavoro ? "Salvo…" : "Salva"}
        </button>
        <button type="button" onClick={onAnnulla} disabled={lavoro} className={bottone}>
          Annulla
        </button>
      </div>
      {errore && <p role="alert" className="testo-sala text-b58-turno-dark-testo">{errore}</p>}
    </form>
  );
}

function SchedaVoce({ voce, oggi, occupato, onModifica, onCambiata, spenta = false }) {
  const [storico, setStorico] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState(null);
  const guardia = useRef(unaVoltaSola());

  async function accendi(attiva) {
    if (!guardia.current.prendi("accendi")) return;
    setLavoro(true);
    setErrore(null);
    try {
      onCambiata(await accendiVoce(voce.id, attiva));
    } catch (err) {
      setErrore(messaggioDelDatabase(err));
    } finally {
      guardia.current.lascia("accendi");
      setLavoro(false);
    }
  }

  return (
    <li className={`rounded-xl p-4 ring-1 ring-b58-charcoal/10 flex flex-col gap-2 ${spenta ? "bg-b58-parchment" : "bg-b58-campo"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="testo-sala font-medium text-b58-charcoal-soft">{riferimentoVoce(voce)}</span>
        <span className="testo-sala text-b58-charcoal-soft">{etichettaFonte(voce.fonte)}</span>
      </div>
      <p className="whitespace-pre-wrap text-b58-charcoal">{voce.testo}</p>
      <p className="testo-sala text-b58-charcoal-soft">
        {voce.valida_dal && <>Vale dal {dataItaliana(voce.valida_dal)}. </>}
        {voce.verificata_il && <>Verificata il {dataItaliana(voce.verificata_il)}. </>}
        {voce.rivedere_entro && <>Da rivedere entro il {dataItaliana(voce.rivedere_entro)}.</>}
      </p>
      {daRivedere(voce, oggi) && (
        <p className="testo-sala font-medium text-b58-turno-dark-testo">Da rivedere: la data è passata.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={occupato || lavoro} onClick={() => onModifica(voce)} className={bottone}>
          Modifica
        </button>
        {spenta ? (
          <button type="button" disabled={occupato || lavoro} onClick={() => accendi(true)} className={bottone}>
            Riaccendi
          </button>
        ) : (
          <button type="button" disabled={occupato || lavoro} onClick={() => accendi(false)} className={bottone}>
            Spegni
          </button>
        )}
        <button type="button" onClick={() => setStorico((s) => !s)} aria-expanded={storico} className={bottone}>
          {storico ? "Nascondi lo storico" : "Storico"}
        </button>
      </div>
      {errore && <p role="alert" className="testo-sala text-b58-turno-dark-testo">{errore}</p>}
      {storico && <StoricoDellaVoce voceId={voce.id} />}
    </li>
  );
}

export default function SchedaDiBorgo58() {
  const [voci, setVoci] = useState(null);
  const [contatori, setContatori] = useState(null);
  const [errore, setErrore] = useState(false);
  const [inModifica, setInModifica] = useState(null);
  const [mostraSpente, setMostraSpente] = useState(false);
  const oggi = useMemo(oggiIso, []);

  const caricaContatori = useCallback(async () => {
    const c = await leggi(leggiContatori());
    setContatori(nonLetto(c) ? null : c);
  }, []);

  const carica = useCallback(async () => {
    setErrore(false);
    const r = await leggi(leggiVoci());
    if (nonLetto(r)) setErrore(true);
    else setVoci(r);
    await caricaContatori();
  }, [caricaContatori]);

  useEffect(() => {
    carica();
  }, [carica]);

  const { sezioni, spente } = useMemo(() => raggruppaVoci(voci), [voci]);

  const salvata = (riga) => {
    setVoci((v) => (v.some((x) => x.id === riga.id) ? v.map((x) => (x.id === riga.id ? riga : x)) : [...v, riga]));
    setInModifica(null);
    caricaContatori();
  };
  const apriNuova = () =>
    setInModifica({
      sezione: "fornitori",
      testo: "",
      fonte: "da_verificare",
      valida_dal: "",
      verificata_il: "",
      rivedere_entro: "",
    });
  // La chiave interna e la posizione in fondo alla sezione le sceglie la pagina, non Alessio.
  const preparaNuova = (v) => ({ ...v, chiave: chiaveNuova(v.sezione, v.testo), ordine: ordineInFondo(voci, v.sezione) });

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande space-y-4">
      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal flex items-center gap-2">
        La Scheda di Borgo 58
        <Didascalia>
          Gli appunti brevi che MEMO legge a ogni domanda: fornitori, abitudini, cose già decise. Ognuno ha un numero
          come [S12], che MEMO cita quando lo usa. Non scriverci password, IBAN, codici fiscali o dati di salute. Una
          voce non si cancella: si spegne, e puoi riaccenderla.
        </Didascalia>
      </h1>

      {errore ? (
        <DatoNonLetto cosa="la Scheda" onRiprova={carica} />
      ) : voci === null ? (
        <p className="text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          <Limiti contatori={contatori} />
          {contatori === null && (
            <DatoNonLetto cosa="quanto spazio resta nella Scheda" nonVuolDire="La Scheda funziona lo stesso." />
          )}

          {inModifica === null ? (
            <button type="button" onClick={apriNuova} className={bottonePrimario}>
              Aggiungi una voce
            </button>
          ) : (
            !inModifica.id && (
              <ModuloVoce
                key="nuova"
                iniziale={inModifica}
                onSalvata={salvata}
                onAnnulla={() => setInModifica(null)}
                preparazione={preparaNuova}
              />
            )
          )}

          {voci.length === 0 && inModifica === null && (
            <p className="rounded-xl bg-b58-parchment p-4 text-b58-charcoal-soft ring-1 ring-b58-charcoal/10">
              La Scheda è vuota: MEMO risponde come sempre, senza questi appunti. Aggiungi la prima voce quando vuoi.
            </p>
          )}

          {sezioni
            .filter((s) => s.voci.length > 0)
            .map((s) => (
              <section key={s.valore} aria-labelledby={`sezione-${s.valore}`}>
                <h2 id={`sezione-${s.valore}`} className="mb-2 font-display text-xl text-b58-charcoal">
                  {s.etichetta}
                </h2>
                <ul className="flex flex-col gap-3">
                  {s.voci.map((voce) =>
                    inModifica?.id === voce.id ? (
                      <li key={voce.id}>
                        <ModuloVoce iniziale={inModifica} onSalvata={salvata} onAnnulla={() => setInModifica(null)} />
                      </li>
                    ) : (
                      <SchedaVoce
                        key={voce.id}
                        voce={voce}
                        oggi={oggi}
                        occupato={inModifica !== null}
                        onModifica={(x) => setInModifica({ ...x })}
                        onCambiata={salvata}
                      />
                    )
                  )}
                </ul>
              </section>
            ))}

          {spente.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setMostraSpente((m) => !m)}
                aria-expanded={mostraSpente}
                className="tocco-bottone testo-sala text-b58-olive-dark-testo underline"
              >
                {mostraSpente ? "Nascondi le voci spente" : `Voci spente (${spente.length})`}
              </button>
              {mostraSpente && (
                <ul className="mt-2 flex flex-col gap-3">
                  {spente.map((voce) =>
                    inModifica?.id === voce.id ? (
                      <li key={voce.id}>
                        <ModuloVoce iniziale={inModifica} onSalvata={salvata} onAnnulla={() => setInModifica(null)} />
                      </li>
                    ) : (
                      <SchedaVoce
                        key={voce.id}
                        voce={voce}
                        oggi={oggi}
                        occupato={inModifica !== null}
                        spenta
                        onModifica={(x) => setInModifica({ ...x })}
                        onCambiata={salvata}
                      />
                    )
                  )}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
