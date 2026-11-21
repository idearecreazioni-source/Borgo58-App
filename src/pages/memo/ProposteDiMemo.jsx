import { useCallback, useEffect, useId, useRef, useState } from "react";
import DatoNonLetto from "../../components/DatoNonLetto";
import { decidiProposta, generaProposte, leggiProposte, paroleDelicate } from "../../lib/api/scheda";
import { TESTO_MASSIMO, avvisoParoleDelicate, contatoreTesto, messaggioDelDatabase } from "../../lib/calcoli/scheda";
import {
  avvisoFonte,
  dettaglioProposta,
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
// ⚠️ SE LA FONTE SCENDE, IL SÌ ASPETTA UNA SPUNTA.
// ⚠️ UN GESTO ALLA VOLTA: durante la chiamata i pulsanti sono spenti, e un
//    doppio clic non manda due decisioni.
// ⚠️ UNA LETTURA FALLITA SI DICE: «nessuna proposta» e «non le ho lette» sono due cose diverse.

const inputClass =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50";
const bottonePrimario =
  "tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-white hover:opacity-90 disabled:opacity-50";

function Correzione({ iniziale, lavoro, onInvia, onAnnulla }) {
  const idTesto = useId();
  const [testo, setTesto] = useState(iniziale ?? "");
  const [delicate, setDelicate] = useState([]);
  const campo = useRef(null);
  const conta = contatoreTesto(testo);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  // Come nella pagina: l'avviso si cerca poco dopo che si smette di scrivere e vale per il testo di adesso.
  useEffect(() => {
    setDelicate([]);
    if (!testo.trim()) return undefined;
    let vivo = true;
    const attesa = setTimeout(async () => {
      const trovate = await paroleDelicate(testo);
      if (vivo) setDelicate(trovate ?? []);
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
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={lavoro || !testoCorrettoValido(testo)} onClick={() => onInvia(testo)} className={bottonePrimario}>
          {lavoro ? "Salvo…" : "Salva il testo corretto"}
        </button>
        <button type="button" disabled={lavoro} onClick={onAnnulla} className={bottone}>
          Annulla
        </button>
      </div>
    </div>
  );
}

function SchedaProposta({ proposta, occupato, onDecisa }) {
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState(null);
  const [correggi, setCorreggi] = useState(false);
  const [conferma, setConferma] = useState(false);
  const idConferma = useId();
  const guardia = useRef(unaVoltaSola());
  const { prima, dopo, etichettaDopo } = dettaglioProposta(proposta);
  const avviso = avvisoFonte(proposta);
  const fonte = frasePerLaFonte(proposta);
  const scadenza = scadenzaProposta(proposta);
  const siBloccato = Boolean(proposta.abbassa_fonte) && !conferma;

  async function decidi(esito, testo = null) {
    if (!guardia.current.prendi("decidi")) return;
    setLavoro(true);
    setErrore(null);
    try {
      onDecisa(proposta, await decidiProposta(proposta.id, esito, testo, conferma));
    } catch (err) {
      setErrore(messaggioDelDatabase(err));
    } finally {
      guardia.current.lascia("decidi");
      setLavoro(false);
    }
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
          <label htmlFor={idConferma} className="flex items-center gap-2 testo-sala text-b58-charcoal">
            <input id={idConferma} type="checkbox" checked={conferma} onChange={(e) => setConferma(e.target.checked)} />
            So che la fonte scende
          </label>
        </div>
      )}
      {scadenza && <p className="testo-sala text-b58-charcoal-soft">{scadenza}</p>}

      {correggi ? (
        <Correzione
          iniziale={proposta.testo_dopo ?? ""}
          lavoro={lavoro}
          onInvia={(testo) => decidi("correggi", testo.trim())}
          onAnnulla={() => setCorreggi(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={lavoro || occupato || siBloccato} onClick={() => decidi("si")} className={bottonePrimario}>
            Sì
          </button>
          <button type="button" disabled={lavoro} onClick={() => decidi("no")} className={bottone}>
            Non farlo
          </button>
          {puoCorreggere(proposta) && (
            <button type="button" disabled={lavoro || occupato || siBloccato} onClick={() => setCorreggi(true)} className={bottone}>
              Correggi
            </button>
          )}
        </div>
      )}
      {occupato && <p className="testo-sala text-b58-charcoal-soft">Finisci prima la voce che stai scrivendo.</p>}
      {errore && <p role="alert" className="testo-sala text-b58-turno-dark-testo">{errore}</p>}
    </li>
  );
}

export default function ProposteDiMemo({ occupato = false, onCambiata }) {
  const [proposte, setProposte] = useState(null);
  const [errore, setErrore] = useState(false);
  const [saltate, setSaltate] = useState(0);
  const [nonGenerate, setNonGenerate] = useState(false);
  const [esito, setEsito] = useState(null);
  const titolo = useId();

  const carica = useCallback(async () => {
    setErrore(false);
    // Prima si chiede al database di calcolare le nuove; se non ci riesce la pagina va avanti con quelle già nate.
    const g = await generaProposte();
    setNonGenerate(g === null);
    setSaltate(Number(g?.saltate_privacy) || 0);
    const lette = await leggi(leggiProposte());
    if (nonLetto(lette)) {
      setErrore(true);
      return;
    }
    setProposte(ordinaProposte(lette));
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const decisa = (proposta, risposta) => {
    setProposte((elenco) => (elenco ?? []).filter((p) => p.id !== proposta.id));
    const messaggio = messaggioDellaDecisione(risposta);
    setEsito(messaggio ?? (risposta?.esito === "rifiutata" ? "Va bene: non la riproporrò per un po'." : "Fatto: la Scheda è aggiornata."));
    if (risposta?.esito === "accettata" || risposta?.esito === "obsoleta") onCambiata?.();
  };

  return (
    <section aria-labelledby={titolo} className="space-y-3">
      <h2 id={titolo} className="font-display text-xl text-b58-charcoal">
        Proposte di MEMO
      </h2>
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
          {esito && (
            <p role="status" className="testo-sala text-b58-charcoal">
              {esito}
            </p>
          )}
          {proposte.length === 0 ? (
            <p className="rounded-xl bg-b58-parchment p-4 text-b58-charcoal-soft ring-1 ring-b58-charcoal/10">
              {fraseNessunaProposta(saltate)}
            </p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Proposte di MEMO">
              {proposte.map((p) => (
                <SchedaProposta key={p.id} proposta={p} occupato={occupato} onDecisa={decisa} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
