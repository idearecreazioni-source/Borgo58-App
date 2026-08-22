import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chiediAllArchivio, listDomandeArchivio } from "../../lib/api/assistente";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { formatDate } from "../../lib/constants";

// «Chiedi all'archivio» — una domanda in italiano, la risposta letta dai
// documenti veri (12/08/2026).
//
// La schermata dice sempre DUE cose insieme: la risposta, e **su quanto
// l'ha costruita**. Un assistente che risponde "non risulta" senza dire
// dove ha guardato è indistinguibile da uno che ha guardato nel posto
// sbagliato — e la seconda volta ci si fida lo stesso.

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";

// Esempi di domanda: servono a far capire in tre secondi che non è una
// ricerca per titolo. Sono cliccabili perché la prima domanda è quella
// che costa di più da inventare.
// Il modello scrive **così** quando vuole il grassetto. Senza questa
// conversione in pagina compaiono gli asterischi, e una risposta piena di
// asterischi sembra scritta male anche quando è giusta.
function ConGrassetto({ testo }) {
  return (testo ?? "").split(/\*\*(.+?)\*\*/gs).map((pezzo, i) =>
    i % 2 ? <strong key={i}>{pezzo}</strong> : <span key={i}>{pezzo}</span>
  );
}

const ESEMPI = [
  "Quanto ho speso dal notaio?",
  "Quando scade il contratto di locazione?",
  "Che preventivi ho ricevuto e da chi?",
  "Ci sono scadenze nei prossimi tre mesi?",
];

export default function ChiediArchivio() {
  const [domanda, setDomanda] = useState("");
  const [esito, setEsito] = useState(null);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState("");
  const [storico, setStorico] = useState([]);
  const [mostraStorico, setMostraStorico] = useState(false);

  const ricaricaStorico = () => leggi(listDomandeArchivio(20)).then(setStorico);

  useEffect(() => {
    ricaricaStorico();
  }, []);

  const chiedi = async (testo) => {
    const d = (testo ?? domanda).trim();
    if (!d || attesa) return;
    setDomanda(d);
    setAttesa(true);
    setErrore("");
    setEsito(null);
    try {
      setEsito(await chiediAllArchivio(d));
      await ricaricaStorico();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setAttesa(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="mb-6">
        <Link to="/documenti" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-charcoal">
          ← Archivio Documenti
        </Link>
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal mt-2">Chiedi all'archivio</h1>
        <p className="text-b58-charcoal-soft mt-1">
          Una domanda in italiano. La risposta viene letta dentro i documenti, non dai titoli.
        </p>
      </div>

      <div className={sezione}>
        <textarea
          value={domanda}
          onChange={(e) => setDomanda(e.target.value)}
          onKeyDown={(e) => {
            // Invio manda, a capo con Maiusc+Invio: si scrive una riga,
            // non un tema.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              chiedi();
            }
          }}
          rows={2}
          maxLength={800}
          placeholder="Per esempio: quanto ho speso dal notaio?"
          className="w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta resize-none"
        />
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {ESEMPI.map((e) => (
              <button
                key={e}
                onClick={() => chiedi(e)}
                disabled={attesa}
                className="rounded-full border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal-soft text-[11px] px-2.5 py-1"
              >
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={() => chiedi()}
            disabled={attesa || !domanda.trim()}
            className="tocco-bottone rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-40 transition-colors text-b58-parchment text-sm font-medium px-5"
          >
            {attesa ? "Sto leggendo…" : "Chiedi"}
          </button>
        </div>
      </div>

      {errore && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{errore}</p>
      )}

      {attesa && (
        <p className="text-sm text-b58-charcoal-soft mb-4">
          Sto rileggendo i documenti dell'Archivio. Con documenti lunghi può volerci mezzo minuto.
        </p>
      )}

      {esito && (
        <div className={sezione}>
          <p className="whitespace-pre-wrap text-b58-charcoal leading-relaxed">
            <ConGrassetto testo={esito.risposta} />
          </p>

          {esito.troncato && (
            <p className="text-xs text-b58-terracotta-dark mt-3">
              La risposta si è interrotta perché troppo lunga: prova a chiedere una cosa per volta.
            </p>
          )}

          {/* Su cosa è costruita la risposta. Non è un dettaglio tecnico:
              è la differenza fra "non risulta" e "non ho guardato lì". */}
          <div className="mt-4 pt-4 border-t border-b58-charcoal/10 text-xs text-b58-charcoal-soft space-y-1">
            <p>
              Documenti in archivio: <strong>{esito.documenti_guardati}</strong>
              {" · "}letti per intero: <strong>{esito.documenti_letti?.length ?? 0}</strong>
            </p>
            {esito.documenti_letti?.length > 0 && (
              <p>
                Ho letto:{" "}
                {esito.documenti_letti.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    <Link to={`/documenti/${d.id}`} className="underline hover:text-b58-charcoal">
                      {d.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            {esito.ripiego && (
              <p>
                Nessun documento conteneva le parole della domanda: ho guardato i più recenti di cui
                esiste il contenuto.
              </p>
            )}
            {esito.senza_contenuto > 0 && (
              <p>
                {esito.senza_contenuto} document{esito.senza_contenuto === 1 ? "o" : "i"} in archivio
                non {esito.senza_contenuto === 1 ? "ha" : "hanno"} il contenuto conservato: di
                quell{esito.senza_contenuto === 1 ? "o" : "i"} conosco solo la scheda.{" "}
                {/* Non basta dirlo: chi legge deve sapere cosa farci. */}
                <Link to="/documenti" className="underline hover:text-b58-charcoal">
                  Aprili e premi «Leggi il contenuto»
                </Link>
                .
              </p>
            )}
            {esito.token && (
              <p>
                Costo di questa domanda: {esito.token.domanda} + {esito.token.risposta} token.
              </p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setMostraStorico((v) => !v)}
        className="text-sm text-b58-charcoal-soft hover:text-b58-charcoal underline"
      >
        {mostraStorico
          ? "Nascondi le domande già fatte"
          : nonLetto(storico)
            ? "Domande già fatte"
            : `Domande già fatte (${storico.length})`}
      </button>

      {mostraStorico && (
        <div className="mt-3 space-y-2">
          {nonLetto(storico) && <DatoNonLetto cosa="le domande già fatte" />}
          {!nonLetto(storico) && storico.length === 0 && (
            <p className="text-sm text-b58-charcoal-soft">Nessuna domanda ancora.</p>
          )}
          {storico.map((d) => (
            <details key={d.id} className="rounded-lg bg-white border border-b58-charcoal/10 p-3">
              <summary className="text-sm text-b58-charcoal cursor-pointer">
                {d.domanda}
                <span className="text-[11px] text-b58-charcoal-soft ml-2">{formatDate(d.creato_il)}</span>
              </summary>
              <p className="whitespace-pre-wrap text-sm text-b58-charcoal-soft mt-2 leading-relaxed">
                {d.risposta}
              </p>
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">
                letti {d.documenti_letti} di {d.documenti_guardati} · {d.token_domanda} +{" "}
                {d.token_risposta} token
              </p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
