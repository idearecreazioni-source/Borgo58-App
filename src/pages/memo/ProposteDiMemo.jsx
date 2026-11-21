import { useCallback, useEffect, useId, useRef, useState } from "react";
import DatoNonLetto from "../../components/DatoNonLetto";
import { decidiProposta, generaProposte, leggiProposte, paroleDelicate } from "../../lib/api/scheda";
import { TESTO_MASSIMO, avvisoParoleDelicate, contatoreTesto, messaggioDelDatabase } from "../../lib/calcoli/scheda";
import {
  avvisoFonte,
  dettaglioProposta,
  esitoChiudeLaProposta,
  etichettaTipoProposta,
  fraseNessunaProposta,
  frasePerLaFonte,
  messaggioDellaDecisione,
  ordinaProposte,
  puoCorreggere,
  scadenzaProposta,
  testoCorrettoValido,
} from "../../lib/calcoli/scheda-proposte";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { unaVoltaSola } from "../../lib/calcoli/voce";

// =====================================================================
// LE PROPOSTE DI MEMO PER LA SCHEDA (21/11/2026, pezzo B1)
// =====================================================================
// MEMO propone, Alessio decide: Sì / Non farlo / Correggi. Le proposte le
// calcola il database con regole fisse (costo zero) quando si apre la pagina.
//
// ⚠️ NIENTE SI SCRIVE SENZA IL SÌ. «Sì» e «Correggi» passano dagli stessi
//    controlli della pagina (privacy, 60 voci, 10.000 caratteri): se il
//    database rifiuta, qui si mostra il suo rifiuto e la proposta resta.
// ⚠️ SE LA FONTE SCENDE, IL SÌ ASPETTA UNA SPUNTA. «Non farlo» resta sempre
//    possibile (a meno che una decisione sia già in corso).
// ⚠️ UNA DECISIONE ALLA VOLTA, PER TUTTE LE SCHEDE: durante la chiamata i
//    pulsanti di ogni proposta sono spenti, e un doppio clic non manda due
//    decisioni (né su una proposta né su due).
// ⚠️ UNA LETTURA FALLITA SI DICE: «nessuna proposta» e «non le ho lette» sono due cose diverse.
// ⚠️ LA RILETTURA DELLA SCHEDA DOPO UN SÌ È ACCESSORIA: se fallisce, il «Fatto» resta
//    a schermo e si aggiunge una frase; la pagina non si smonta.
// ⚠️ IL FOCUS NON SI PERDE: dopo una decisione va sul messaggio di esito (che sta sempre
//    nella pagina, anche vuoto), dopo «Annulla» torna su «Correggi».

const inputClass =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50";
const bottonePrimario =
  "tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-white hover:opacity-90 disabled:opacity-50";

function Correzione({ iniziale, lavoro, bloccato, onInvia, onAnnulla }) {
  const idTesto = useId();
  const [testo, setTesto] = useState(iniziale ?? "");
  const [delicate, setDelicate] = useState([]);
  const [nonControllate, setNonControllate] = useState(false);
  const campo = useRef(null);
  const conta = contatoreTesto(testo);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  // Come nella pagina: l'avviso si cerca poco dopo che si smette di scrivere e vale per il testo di adesso.
  // ⚠️ `null` = «non ho potuto controllare», che non è «nessuna parola delicata»: si dice.
  useEffect(() => {
    setDelicate([]);
    setNonControllate(false);
    if (!testo.trim()) return undefined;
    let vivo = true;
    const attesa = setTimeout(async () => {
      const trovate = await paroleDelicate(testo);
      if (!vivo) return;
      setNonControllate(trovate === null);
      setDelicate(trovate ?? []);
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(attesa);
    };
  }, [testo]);

  const avviso = avvisoParoleDelicate(delicate);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={idTesto} className="block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">
        Correggi il testo
      </label>
      <textarea
        id={idTesto}
        ref={campo}
        value={testo}
        // Mentre il testo viaggia verso il database non si cambia sotto i piedi di chi lo salva.
        readOnly={lavoro}
        onChange={(e) => setTesto(e.target.value)}
        rows={4}
        aria-describedby={`${idTesto}-conta`}
        className={inputClass}
        style={{ fontSize: "max(16px, 1em)" }}
      />
      <p id={`${idTesto}-conta`} className={`testo-sala ${conta.oltre ? "text-b58-turno-dark-testo" : "text-b58-charcoal-soft"}`}>
        {conta.oltre ? `${conta.oltre} caratteri di troppo: il massimo è ${TESTO_MASSIMO}.` : `${conta.scritti} di ${TESTO_MASSIMO} caratteri.`}
      </p>
      {avviso && (
        <p role="status" className="testo-sala text-b58-turno-dark-testo">
          {avviso}
        </p>
      )}
      {nonControllate && (
        <p role="status" className="testo-sala text-b58-charcoal-soft">
          Non sono riuscito a controllare le parole delicate.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={bloccato || !testoCorrettoValido(testo)} onClick={() => onInvia(testo)} className={bottonePrimario}>
          {lavoro ? "Salvo…" : "Salva il testo corretto"}
        </button>
        <button type="button" disabled={bloccato} onClick={onAnnulla} className={bottone}>
          Annulla
        </button>
      </div>
    </div>
  );
}

function SchedaProposta({ proposta, occupato, inDecisione, onDecidi }) {
  const [errore, setErrore] = useState(null);
  const [correggi, setCorreggi] = useState(false);
  const [tornaAlPulsante, setTornaAlPulsante] = useState(false);
  const [conferma, setConferma] = useState(false);
  const idConferma = useId();
  const idMotivo = useId();
  const pulsanteCorreggi = useRef(null);
  const { prima, dopo, etichettaDopo } = dettaglioProposta(proposta);
  const avviso = avvisoFonte(proposta);
  const fonte = frasePerLaFonte(proposta);
  const scadenza = scadenzaProposta(proposta);
  // `inDecisione` è l'id della proposta in corso (di qualunque scheda): finché ce n'è una, nessun pulsante è attivo.
  const lavoro = inDecisione === proposta.id;
  const bloccato = inDecisione !== null;
  const siBloccato = Boolean(proposta.abbassa_fonte) && !conferma;
  const spiegazione = occupato
    ? "Finisci prima la voce che stai scrivendo."
    : siBloccato
      ? "Spunta «So che la fonte scende» per poter accettare."
      : null;
  const siSpento = bloccato || occupato || siBloccato;

  // Dopo «Annulla» il focus torna su «Correggi»: la tastiera non riparte dall'inizio della pagina.
  useEffect(() => {
    if (!correggi && tornaAlPulsante) {
      pulsanteCorreggi.current?.focus();
      setTornaAlPulsante(false);
    }
  }, [correggi, tornaAlPulsante]);

  async function decidi(esito, testo = null) {
    setErrore(null);
    const r = await onDecidi(proposta, esito, testo, conferma);
    if (r?.errore) setErrore(r.errore);
  }

  return (
    <li className="rounded-xl bg-b58-campo p-4 ring-1 ring-b58-charcoal/10 flex flex-col gap-2">
      <p className="testo-sala font-medium text-b58-charcoal">{etichettaTipoProposta(proposta.tipo)}</p>
      <p className="testo-sala text-b58-charcoal-soft">{proposta.motivo}</p>
      {prima && (
        <p className="whitespace-pre-wrap text-b58-charcoal">
          <span className="block testo-sala text-b58-charcoal-soft">{proposta.tipo === "modifica" ? "Adesso dice" : "La voce dice"}</span>
          {prima}
        </p>
      )}
      {dopo && (
        <p className="whitespace-pre-wrap text-b58-charcoal">
          <span className="block testo-sala text-b58-charcoal-soft">{etichettaDopo}</span>
          {dopo}
        </p>
      )}
      {fonte && <p className="testo-sala text-b58-charcoal-soft">{fonte}</p>}
      {avviso && (
        <div className="flex flex-col gap-1">
          <p role="status" className="testo-sala font-medium text-b58-turno-dark-testo">{avviso}</p>
          <label htmlFor={idConferma} className="tocco-bottone flex items-center gap-2 testo-sala text-b58-charcoal">
            <input id={idConferma} type="checkbox" checked={conferma} disabled={bloccato} onChange={(e) => setConferma(e.target.checked)} />
            So che la fonte scende
          </label>
        </div>
      )}
      {scadenza && <p className="testo-sala text-b58-charcoal-soft">{scadenza}</p>}

      {correggi ? (
        <Correzione
          iniziale={proposta.testo_dopo ?? ""}
          lavoro={lavoro}
          bloccato={bloccato}
          onInvia={(testo) => decidi("correggi", testo.trim())}
          onAnnulla={() => {
            setErrore(null);
            setCorreggi(false);
            setTornaAlPulsante(true);
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={siSpento}
            aria-describedby={siSpento && spiegazione ? idMotivo : undefined}
            onClick={() => decidi("si")}
            className={bottonePrimario}
          >
            {lavoro ? "Salvo…" : "Sì"}
          </button>
          {/* «Non farlo» non scrive niente sulla Scheda: resta possibile anche se la fonte scende o se una voce è in modifica. */}
          <button type="button" disabled={bloccato} onClick={() => decidi("no")} className={bottone}>
            Non farlo
          </button>
          {puoCorreggere(proposta) && (
            <button
              type="button"
              ref={pulsanteCorreggi}
              disabled={siSpento}
              aria-describedby={siSpento && spiegazione ? idMotivo : undefined}
              onClick={() => setCorreggi(true)}
              className={bottone}
            >
              Correggi
            </button>
          )}
        </div>
      )}
      {spiegazione && (
        <p id={idMotivo} className="testo-sala text-b58-charcoal-soft">
          {spiegazione}
        </p>
      )}
      {errore && <p role="alert" className="testo-sala text-b58-turno-dark-testo">{errore}</p>}
    </li>
  );
}

export default function ProposteDiMemo({ occupato = false, onCambiata }) {
  const [proposte, setProposte] = useState(null);
  const [errore, setErrore] = useState(false);
  const [saltate, setSaltate] = useState(0);
  const [nonGenerate, setNonGenerate] = useState(false);
  const [esito, setEsito] = useState("");
  const [inDecisione, setInDecisione] = useState(null);
  const titolo = useId();
  const regione = useRef(null);
  const guardia = useRef(unaVoltaSola());
  // Ogni lettura ha il suo numero: una risposta arrivata in ritardo (una «Riprova» partita dopo, un Sì che rilegge)
  // non cancella quella più recente.
  const richiesta = useRef(0);
  // Il focus passa al messaggio d'esito solo quando ce n'è uno NUOVO.
  const [daFocalizzare, setDaFocalizzare] = useState(0);

  const carica = useCallback(async () => {
    const mia = ++richiesta.current;
    setErrore(false);
    // Prima si chiede al database di calcolare le nuove; se non ci riesce la pagina va avanti con quelle già nate.
    const g = await generaProposte();
    if (mia !== richiesta.current) return;
    setNonGenerate(g === null);
    setSaltate(Number(g?.saltate_privacy) || 0);
    const lette = await leggi(leggiProposte());
    if (mia !== richiesta.current) return;
    if (nonLetto(lette)) {
      setErrore(true);
      return;
    }
    setProposte(ordinaProposte(lette));
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  useEffect(() => {
    if (daFocalizzare > 0) regione.current?.focus();
  }, [daFocalizzare]);

  const dillo = useCallback((frase) => {
    setEsito(frase);
    setDaFocalizzare((n) => n + 1);
  }, []);

  // La decisione sta qui e non nelle schede: così un solo gesto alla volta vale per tutte.
  const decidi = useCallback(
    async (proposta, esitoScelto, testo, confermaFonte) => {
      if (!guardia.current.prendi("decidi")) return { ignorata: true };
      setInDecisione(proposta.id);
      let risposta;
      try {
        risposta = await decidiProposta(proposta.id, esitoScelto, testo, confermaFonte);
      } catch (err) {
        // Il database ha detto no: la proposta resta lì, col suo rifiuto a schermo.
        guardia.current.lascia("decidi");
        setInDecisione(null);
        return { errore: messaggioDelDatabase(err) };
      }
      guardia.current.lascia("decidi");
      setInDecisione(null);

      if (esitoChiudeLaProposta(risposta)) {
        setProposte((elenco) => (elenco ?? []).filter((p) => p.id !== proposta.id));
      } else {
        // Non so com'è andata: la proposta resta e si rilegge dal database, che è la fonte vera.
        carica();
      }
      dillo(
        messaggioDellaDecisione(risposta) ??
          (risposta?.esito === "rifiutata" ? "Va bene: non la riproporrò per un po'." : "Fatto: la Scheda è aggiornata.")
      );
      if (risposta?.esito === "accettata" || risposta?.esito === "obsoleta") {
        // La rilettura dell'elenco delle voci è accessoria: se non riesce, il «Fatto» resta e lo si aggiunge.
        const riletta = await onCambiata?.();
        if (riletta === false) {
          setEsito((frase) => `${frase} Non sono riuscito a rileggere l'elenco delle voci: ricarica la pagina per vederlo aggiornato.`);
        }
      }
      return { ok: true };
    },
    [carica, dillo, onCambiata]
  );

  return (
    <section aria-labelledby={titolo} className="space-y-3">
      <h2 id={titolo} className="font-display text-xl text-b58-charcoal">
        Proposte di MEMO
      </h2>
      {/* Sempre nella pagina, anche vuota: un'area che compare insieme al suo testo non viene letta da tutti i lettori di schermo. */}
      <div ref={regione} role="status" aria-live="polite" tabIndex={-1} className="testo-sala text-b58-charcoal focus:outline-none">
        {esito}
      </div>
      {errore ? (
        <DatoNonLetto cosa="le proposte di MEMO" onRiprova={carica} nonVuolDire="La Scheda funziona lo stesso." />
      ) : proposte === null ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {nonGenerate && (
            <p role="status" className="testo-sala text-b58-charcoal-soft">
              Non sono riuscito a cercare proposte nuove adesso: vedi quelle già pronte.
            </p>
          )}
          {proposte.length === 0 ? (
            <p className="rounded-xl bg-b58-parchment p-4 text-b58-charcoal-soft ring-1 ring-b58-charcoal/10">
              {fraseNessunaProposta(saltate)}
            </p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Proposte di MEMO">
              {proposte.map((p) => (
                <SchedaProposta key={p.id} proposta={p} occupato={occupato} inDecisione={inDecisione} onDecidi={decidi} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
