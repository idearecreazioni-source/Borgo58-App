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
  useChiudiConEsc(true, onFatto);

  const leggi = () =>
    statoScontrino(order.id)
      .then((s) => montato.current && setStato(s))
      .catch((e) => montato.current && setErrore(e.message));

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
    setChiesto(true);
    setErrore("");
    try {
      await chiediScontrino(order.id);
    } catch (e) {
      setErrore(e.message);
    }
    await leggi();
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
