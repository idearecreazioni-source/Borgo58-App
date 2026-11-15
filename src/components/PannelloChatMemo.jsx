import { useEffect, useRef, useState } from "react";
import { mandaMessaggioAMemo } from "../lib/api/chatMemo";
import { partiDellaRisposta } from "../lib/calcoli/chatMemo";

const PASSI = [
  "Sto capendo la domanda…",
  "Sto cercando i dati giusti…",
  "Sto leggendo la cassa…",
  "Sto preparando la risposta…",
];

function PassiInCorso() {
  const [passo, setPasso] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setPasso((n) => (n + 1) % PASSI.length), 1700);
    return () => window.clearInterval(timer);
  }, []);
  return <p role="status" aria-live="polite" className="testo-sala text-b58-charcoal-soft">{PASSI[passo]}</p>;
}

function Risposta({ messaggio }) {
  const { testo, dove, controllalo } = partiDellaRisposta(messaggio.risposta, messaggio.riferimenti);
  return (
    <article className="rounded-xl bg-b58-cream-dark px-3 py-3 text-b58-charcoal">
      <p className="whitespace-pre-wrap testo-sala">{testo}</p>
      <p className="mt-3 testo-sala text-b58-charcoal-soft">
        <strong>Dove l'ho letto:</strong> {dove || "nessuna riga del gestionale."}
      </p>
      {controllalo && (
        <p role="note" className="mt-2 rounded-lg bg-b58-gold/15 px-2 py-2 testo-sala text-b58-charcoal">
          <strong>Controllalo:</strong> {controllalo}
        </p>
      )}
    </article>
  );
}

export default function PannelloChatMemo({ contesto, alChiudere, aperto = true }) {
  const [testo, setTesto] = useState("");
  const [conversazioneId, setConversazioneId] = useState(null);
  const [messaggi, setMessaggi] = useState([]);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState("");
  const inputRef = useRef(null);
  const pannelloRef = useRef(null);
  // Blocco sincrono contro il doppio invio: lo stato React arriva dopo il secondo clic.
  const invioInCorso = useRef(false);

  // Il pannello resta montato anche da chiuso: cosi' una risposta gia' pagata e la
  // conversazione non si perdono se Alessio lo chiude mentre MEMO sta rispondendo.
  useEffect(() => {
    if (aperto && !inCorso) inputRef.current?.focus();
  }, [aperto, inCorso]);

  const chiudi = () => alChiudere?.();
  const trattieniIlFuoco = (event) => {
    if (event.key !== "Tab") return;
    const bersagli = [...pannelloRef.current.querySelectorAll("button:not(:disabled), textarea:not(:disabled)")];
    const primo = bersagli[0];
    const ultimo = bersagli.at(-1);
    if (!primo || !ultimo) return;
    if (event.shiftKey && document.activeElement === primo) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primo.focus();
    }
  };
  const invia = async (event) => {
    event.preventDefault();
    const domanda = testo.trim();
    if (!domanda || inCorso || invioInCorso.current) return;
    invioInCorso.current = true;
    setTesto("");
    setErrore("");
    setInCorso(true);
    setMessaggi((prima) => [...prima, { tipo: "domanda", testo: domanda }]);
    try {
      const esito = await mandaMessaggioAMemo({ testo: domanda, conversazioneId, contesto });
      if (esito.esito === "tetto") {
        setConversazioneId(esito.conversazione_id ?? conversazioneId);
        setMessaggi((prima) => [...prima, { tipo: "tetto", testo: esito.messaggio || "Il tetto della chat e' stato raggiunto." }]);
        return;
      }
      setConversazioneId(esito.conversazione_id);
      setMessaggi((prima) => [...prima, { tipo: esito.esito, risposta: esito.risposta, riferimenti: esito.riferimenti }]);
    } catch (e) {
      // La domanda torna nel campo: si puo' riprovare senza riscriverla.
      setTesto(domanda);
      if (e.conversazioneId) setConversazioneId(e.conversazioneId);
      setErrore(e.message || "Non riesco a parlare con MEMO in questo momento. Riprova tra poco.");
    } finally {
      invioInCorso.current = false;
      setInCorso(false);
    }
  };

  return (
    <div hidden={!aperto} className="fixed inset-0 z-[60] flex justify-end bg-b58-velo/40 print:hidden" role="presentation">
      <section
        ref={pannelloRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-chat-memo"
        className="flex h-[100dvh] w-full max-w-lg flex-col bg-b58-parchment shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            chiudi();
          }
          trattieniIlFuoco(event);
        }}
      >
        <header className="flex items-center justify-between border-b border-b58-charcoal/10 px-4 py-3">
          <div className="min-w-0">
            <h2 id="titolo-chat-memo" className="text-lg font-semibold text-b58-charcoal">MEMO</h2>
            <p className="truncate testo-sala text-b58-charcoal-soft">Da {contesto.aperta_da_modulo}</p>
          </div>
          <button type="button" onClick={chiudi} className="tocco-bottone rounded-lg px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark">
            Chiudi
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          <p className="mb-4 testo-sala text-b58-charcoal-soft">Chiedimi quello che vuoi del gestionale.</p>
          <div className="space-y-3">
            {messaggi.map((messaggio, indice) => {
              if (messaggio.tipo === "domanda") {
                return <p key={indice} className="ml-8 rounded-xl bg-b58-azione px-3 py-2 testo-sala text-b58-sul-colore">{messaggio.testo}</p>;
              }
              if (messaggio.tipo === "tetto") {
                return <p key={indice} role="alert" className="rounded-xl bg-b58-gold/15 px-3 py-3 testo-sala text-b58-charcoal"><strong>MEMO si ferma qui.</strong> {messaggio.testo}</p>;
              }
              if (messaggio.tipo === "errore" || messaggio.tipo === "interrotto") {
                return <div key={indice} role="alert" className="rounded-xl bg-b58-terracotta/10 px-3 py-3"><strong>MEMO si e' fermato.</strong><Risposta messaggio={messaggio} /></div>;
              }
              return <Risposta key={indice} messaggio={messaggio} />;
            })}
            {inCorso && <PassiInCorso />}
          </div>
          {errore && <p role="alert" className="mt-3 rounded-lg bg-b58-terracotta/10 px-3 py-2 testo-sala text-b58-terracotta-dark-testo">{errore}</p>}
        </div>

        <form onSubmit={invia} className="border-t border-b58-charcoal/10 bg-b58-parchment px-4 py-3">
          <label htmlFor="domanda-a-memo" className="sr-only">Scrivi a MEMO</label>
          <textarea
            ref={inputRef}
            id="domanda-a-memo"
            value={testo}
            onChange={(event) => setTesto(event.target.value)}
            placeholder="Scrivi la domanda…"
            rows={2}
            maxLength={2000}
            readOnly={inCorso}
            aria-busy={inCorso}
            className="w-full resize-none rounded-lg border border-b58-charcoal/20 bg-b58-cream px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-azione disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="testo-sala text-b58-charcoal-soft">Solo testo per ora.</p>
            <button type="submit" disabled={inCorso || !testo.trim()} className="tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-b58-sul-colore disabled:opacity-50">
              Invia
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
