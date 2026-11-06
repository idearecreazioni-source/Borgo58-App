import { useEffect, useRef, useState } from "react";
import { chiediScontrino, statoScontrino } from "../../lib/api/stampanti";
import { useChiudiConEsc } from "../../lib/chiudiConEsc";
import { ogniTantoSeVisibile } from "../../lib/ogniTanto";

// LO SCONTRINO FISCALE DOPO LA CHIUSURA DEL CONTO — 04/11/2026, deciso da
// Alessio durante il collaudo del registratore.
//
// 🔴 COMPARE SOLO SE C'È UN REGISTRATORE ACCESO nel gestionale (lo decide
//    `CloseOrderModal`): senza, la chiusura resta quella di prima.
// 🔴 UN TOCCO = UNA RICHIESTA. Il pulsante si spegne al primo tocco, e il
//    database ne accetta comunque una sola per conto: un doppio clic o una
//    rete che cade non fanno due scontrini.
// ⚠️ «Incerto» NON si rifà da qui: forse è uscito, quindi si guarda il
//    registratore, e lo annulla il titolare dalla pagina Stampanti.

const ATTESA_MS = 2000;
const FINITI = ["stampato", "fallito", "incerto", "annullato"];

export default function ScontrinoDelConto({ order, onFatto }) {
  const [stato, setStato] = useState(null);
  const [errore, setErrore] = useState("");
  const [chiesto, setChiesto] = useState(false);
  const montato = useRef(true);
  // Il sigillo vero del tocco: lo stato di React arriva al render dopo, un
  // ref no (revisione del codice, 04/11).
  const inVolo = useRef(false);
  const domanda = useRef(0);
  useChiudiConEsc(true, onFatto);

  // ⚠️ Solo l'ultima lettura partita può scrivere: una risposta vecchia
  //    arrivata tardi non rimette a schermo uno stato superato.
  const leggi = () => {
    const mia = ++domanda.current;
    return statoScontrino(order.id)
      .then((s) => {
        if (!montato.current || mia !== domanda.current) return s;
        setStato(s);
        setErrore("");
        return s;
      })
      .catch((e) => {
        if (montato.current && mia === domanda.current) setErrore(e.message);
        return null;
      });
  };

  useEffect(() => {
    montato.current = true;
    leggi();
    return () => {
      montato.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const lavoro = stato?.lavoro ?? null;
  const aperto = lavoro && !FINITI.includes(lavoro.stato);

  // Finché il ponte lavora si rilegge; quando ha finito ci si ferma.
  useEffect(() => {
    if (!aperto) return undefined;
    return ogniTantoSeVisibile(leggi, ATTESA_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, order.id]);

  const chiedi = async () => {
    if (inVolo.current) return;
    inVolo.current = true;
    setChiesto(true);
    setErrore("");
    let no = null;
    try {
      await chiediScontrino(order.id);
    } catch (e) {
      no = e.message;
    }
    const s = await leggi();
    if (no && montato.current) {
      setErrore(no);
      // ⚠️ Se la richiesta non ha lasciato nessun lavoro (rete caduta prima
      //    di arrivare, o un rifiuto), si può riprovare: il database ne
      //    accetta comunque uno solo per conto.
      if (s && !s.lavoro) {
        inVolo.current = false;
        setChiesto(false);
      }
    }
  };

  // Si può chiedere solo se non c'è un lavoro vivo (o è stato annullato).
  const puoChiedere = !chiesto && stato && (!lavoro || lavoro.stato === "annullato");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Scontrino — ${order.table_label}`}
      className="fixed inset-0 bg-b58-velo/50 flex items-center justify-center p-4 z-50"
    >
      <div className="bg-b58-campo rounded-xl max-w-3xl w-full overflow-hidden">
        <div className="bg-b58-inverso text-b58-sul-colore px-4 py-3 flex items-center justify-between">
          <span className="font-display testo-sala-grande">Conto chiuso — {order.table_label}</span>
          <button type="button" onClick={onFatto} aria-label="Chiudi" className="tocco-bottone text-b58-sul-colore/80 hover:text-b58-sul-colore testo-sala-grande leading-none">
            ×
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div role="status" aria-live="polite" className="space-y-2">
            {errore && (
              <p className="testo-sala text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2">{errore}</p>
            )}
            {lavoro && lavoro.stato !== "annullato" && (
              <p
                className={`testo-sala rounded-lg px-3 py-2 ${
                  lavoro.stato === "stampato"
                    ? "bg-b58-olive/10 text-b58-charcoal"
                    : lavoro.stato === "incerto" || lavoro.stato === "fallito"
                      ? "bg-b58-terracotta/10 text-b58-terracotta-dark-testo"
                      : "bg-b58-cream-dark/40 text-b58-charcoal"
                }`}
              >
                {lavoro.frase}
                {lavoro.stato === "stampato" && lavoro.numero && (
                  <>
                    {" "}
                    N. {lavoro.numero}
                    {lavoro.data ? ` del ${lavoro.data}` : ""}
                    {lavoro.ora ? ` alle ${lavoro.ora}` : ""}
                    {lavoro.chiusura ? `, chiusura n. ${lavoro.chiusura}` : ""}.
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {(puoChiedere || (chiesto && !lavoro)) && (
              <button
                type="button"
                disabled={!puoChiedere}
                onClick={chiedi}
                className="tocco-bottone flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-sul-colore testo-sala font-medium px-3"
              >
                Scontrino fiscale
              </button>
            )}
            <button
              type="button"
              onClick={onFatto}
              className="tocco-bottone flex-1 rounded-lg border border-b58-charcoal/20 hover:bg-b58-cream-dark/40 transition-colors text-b58-charcoal testo-sala font-medium px-3"
            >
              {lavoro && lavoro.stato !== "annullato" ? "Fatto" : "Senza scontrino"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
