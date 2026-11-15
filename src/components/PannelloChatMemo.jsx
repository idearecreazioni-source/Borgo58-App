import { useEffect, useRef, useState } from "react";
import { mandaMessaggioAMemo } from "../lib/api/chatMemo";
import { dataDellaConversazione, partiDellaRisposta, titoloDellaConversazione } from "../lib/calcoli/chatMemo";
import { leggiConversazioniMemo, leggiMessaggiDellaConversazione } from "../lib/api/conversazioniMemo";
import { componiDettato, creaRiconoscitore, fraseDelMicrofono, riconoscitoreDisponibile } from "../lib/calcoli/voce";

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

function messaggioDalloStorico(messaggio) {
  if (messaggio.ruolo === "alessio") return { tipo: "domanda", testo: messaggio.testo };
  return {
    tipo: messaggio.stato === "errore" || messaggio.stato === "interrotto" ? messaggio.stato : "fatto",
    risposta: messaggio.testo,
    riferimenti: Array.isArray(messaggio.risultati) ? messaggio.risultati : [],
  };
}

export default function PannelloChatMemo({ contesto, testoIniziale = "", alChiudere, aperto = true }) {
  const [testo, setTesto] = useState("");
  const [conversazioneId, setConversazioneId] = useState(null);
  const [messaggi, setMessaggi] = useState([]);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState("");
  const [conversazioni, setConversazioni] = useState([]);
  const [conversazioniInCorso, setConversazioniInCorso] = useState(true);
  const [erroreConversazioni, setErroreConversazioni] = useState("");
  const [ascolto, setAscolto] = useState(false);
  const [parziale, setParziale] = useState("");
  const inputRef = useRef(null);
  const pannelloRef = useRef(null);
  const riconoscitoreRef = useRef(null);
  const frasiRef = useRef([]);
  // Dopo «Ferma» il browser puo' ancora consegnare l'ultima frase: si tiene il conto di quelle gia' copiate.
  const copiateRef = useRef(0);
  const parzialeAlloStopRef = useRef("");
  // Blocco sincrono contro il doppio invio: lo stato React arriva dopo il secondo clic.
  const invioInCorso = useRef(false);

  // Il pannello resta montato anche da chiuso: cosi' una risposta gia' pagata e la
  // conversazione non si perdono se Alessio lo chiude mentre MEMO sta rispondendo.
  useEffect(() => {
    if (aperto && !inCorso) inputRef.current?.focus();
  }, [aperto, inCorso]);

  useEffect(() => {
    setTesto(String(testoIniziale ?? "").trim());
  }, [testoIniziale]);

  useEffect(() => {
    let annullata = false;
    leggiConversazioniMemo()
      .then((righe) => {
        if (!annullata) setConversazioni(righe);
      })
      .catch((e) => {
        if (!annullata) setErroreConversazioni(e.message);
      })
      .finally(() => {
        if (!annullata) setConversazioniInCorso(false);
      });
    return () => {
      annullata = true;
    };
  }, []);

  useEffect(() => () => {
    try {
      riconoscitoreRef.current?.stop();
    } catch {
      // Il browser puo' averlo gia' fermato.
    }
    riconoscitoreRef.current = null;
  }, []);

  const chiudi = () => alChiudere?.();
  // Un pannello nascosto non deve lasciare il microfono acceso.
  useEffect(() => {
    if (!aperto && riconoscitoreRef.current) fermaDettatura();
    // eslint-disable-next-line
  }, [aperto]);
  const fermaDettatura = () => {
    // Si copiano solo le frasi finite; quella in corso arriva da onend (o dal parziale, se il browser non la chiude).
    const trascritto = componiDettato(frasiRef.current, "");
    copiateRef.current = frasiRef.current.length;
    parzialeAlloStopRef.current = parziale;
    const riconoscitore = riconoscitoreRef.current;
    riconoscitoreRef.current = null;
    try {
      riconoscitore?.stop();
    } catch {
      // Il riconoscimento era gia' chiuso.
    }
    setAscolto(false);
    setParziale("");
    if (trascritto) {
      setTesto((prima) => [prima.trim(), trascritto].filter(Boolean).join(" "));
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  const avviaDettatura = () => {
    setErrore("");
    if (!riconoscitoreDisponibile()) {
      setErrore("Il riconoscimento vocale non e' disponibile qui. Scrivi la domanda a mano.");
      return;
    }
    const riconoscitore = creaRiconoscitore();
    if (!riconoscitore) return;
    frasiRef.current = [];
    setParziale("");
    riconoscitore.onresult = (evento) => {
      let corrente = "";
      for (let indice = evento.resultIndex; indice < evento.results.length; indice += 1) {
        const frase = evento.results[indice][0].transcript;
        if (evento.results[indice].isFinal) frasiRef.current = [...frasiRef.current, frase.trim()];
        else corrente += frase;
      }
      setParziale(corrente);
    };
    riconoscitore.onerror = (evento) => {
      const esito = fraseDelMicrofono(evento.error);
      if (esito.ferma) {
        const salvato = componiDettato(frasiRef.current, parziale);
        const riconoscitoreFermo = riconoscitoreRef.current;
        riconoscitoreRef.current = null;
        try { riconoscitoreFermo?.abort?.(); } catch { /* gia' chiuso */ }
        setAscolto(false);
        setParziale("");
        // Quello che era stato detto non si butta: resta nel campo.
        if (salvato) setTesto((prima) => [prima.trim(), salvato].filter(Boolean).join(" "));
      }
      setErrore(esito.frase);
    };
    riconoscitore.onend = () => {
      if (riconoscitoreRef.current !== riconoscitore) {
        // Fermato da noi: la frase consegnata dopo «Ferma» (o il parziale) va nel campo.
        const nuove = frasiRef.current.slice(copiateRef.current);
        const aggiunta = nuove.length ? componiDettato(nuove, "") : parzialeAlloStopRef.current.trim();
        copiateRef.current = frasiRef.current.length;
        parzialeAlloStopRef.current = "";
        if (aggiunta) setTesto((prima) => [prima.trim(), aggiunta].filter(Boolean).join(" "));
        return;
      }
      try {
        riconoscitore.start();
      } catch {
        riconoscitoreRef.current = null;
        setAscolto(false);
      }
    };
    riconoscitoreRef.current = riconoscitore;
    setAscolto(true);
    try {
      riconoscitore.start();
    } catch (e) {
      riconoscitoreRef.current = null;
      setAscolto(false);
      setErrore(`Il microfono non si e' aperto: ${e.message}`);
    }
  };
  const apriNuovaChat = () => {
    if (inCorso || invioInCorso.current) return;
    setConversazioneId(null);
    setMessaggi([]);
    setErrore("");
    setTesto("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  const apriConversazione = async (conversazione) => {
    if (inCorso || invioInCorso.current) return;
    setErrore("");
    setInCorso(true);
    try {
      const righe = await leggiMessaggiDellaConversazione(conversazione.id);
      setConversazioneId(conversazione.id);
      setMessaggi(righe.map(messaggioDalloStorico));
      setTesto("");
    } catch (e) {
      setErrore(e.message || "Non riesco a riaprire questa conversazione.");
    } finally {
      setInCorso(false);
      inputRef.current?.focus();
    }
  };
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
      if (!conversazioneId) {
        setConversazioni((prima) => [{
          id: esito.conversazione_id,
          titolo: domanda,
          creata_il: new Date().toISOString(),
          aperta_da_modulo: contesto.aperta_da_modulo,
          memo_messaggi: [],
        }, ...prima.filter((conversazione) => conversazione.id !== esito.conversazione_id)]);
      }
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
          <div className="flex gap-1">
            <button type="button" onClick={apriNuovaChat} disabled={inCorso} className="tocco-bottone rounded-lg px-2 testo-sala text-b58-charcoal hover:bg-b58-cream-dark">Nuova</button>
            <button type="button" onClick={chiudi} className="tocco-bottone rounded-lg px-3 testo-sala text-b58-charcoal hover:bg-b58-cream-dark">Chiudi</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          <section aria-label="Conversazioni passate" className="mb-4 rounded-xl bg-b58-cream-dark p-3">
            <h3 className="testo-sala font-medium text-b58-charcoal">Conversazioni passate</h3>
            {conversazioniInCorso && <p className="mt-1 testo-sala text-b58-charcoal-soft">Sto cercando le conversazioni…</p>}
            {erroreConversazioni && <p role="alert" className="mt-1 testo-sala text-b58-terracotta-dark-testo">{erroreConversazioni}</p>}
            {!conversazioniInCorso && !erroreConversazioni && conversazioni.length === 0 && (
              <p className="mt-1 testo-sala text-b58-charcoal-soft">Non ci sono ancora conversazioni da riprendere.</p>
            )}
            {conversazioni.length > 0 && (
              <ul className="mt-2 space-y-1">
                {conversazioni.map((conversazione) => (
                  <li key={conversazione.id}>
                    <button
                      type="button"
                      onClick={() => apriConversazione(conversazione)}
                      disabled={inCorso}
                      className="w-full rounded-lg px-2 py-1 text-left hover:bg-b58-parchment disabled:opacity-60"
                    >
                      <span className="block truncate testo-sala font-medium text-b58-charcoal">{titoloDellaConversazione(conversazione)}</span>
                      <span className="block testo-sala text-b58-charcoal-soft">{dataDellaConversazione(conversazione.creata_il)}{conversazione.aperta_da_modulo ? ` · ${conversazione.aperta_da_modulo}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
            readOnly={inCorso || ascolto}
            aria-busy={inCorso}
            className="w-full resize-none rounded-lg border border-b58-charcoal/20 bg-b58-cream px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-azione disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="testo-sala text-b58-charcoal-soft">{ascolto ? "Ti sto ascoltando: premi Ferma per mettere il testo qui." : "Puoi scrivere o parlare."}</p>
            <div className="flex gap-2">
              <button type="button" onClick={ascolto ? fermaDettatura : avviaDettatura} disabled={inCorso} className="tocco-bottone rounded-lg border border-b58-charcoal/20 px-3 testo-sala text-b58-charcoal disabled:opacity-50">
                {ascolto ? "Ferma" : "Parla"}
              </button>
              <button type="submit" disabled={inCorso || ascolto || !testo.trim()} className="tocco-bottone rounded-lg bg-b58-azione px-4 testo-sala font-medium text-b58-sul-colore disabled:opacity-50">
                Invia
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
