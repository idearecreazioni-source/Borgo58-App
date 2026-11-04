import { useEffect, useRef, useState } from "react";
import { avvisiStampa, mandaAllaStampante } from "../../lib/api/stampanti";
import { ogniTantoSeVisibile } from "../../lib/ogniTanto";

// LE COMANDE CHE NON SONO USCITE, IN CIMA ALLA SALA — 04/11/2026, chiesto da
// Alessio dopo una comanda persa con la stampante della cucina spenta:
// nessuno l'aveva saputo.
//
// 🔴 Le frasi le scrive il database (`avvisi_stampa`), fisse e senza
//    indirizzi. «Riprovo da solo» vuol dire che la stampante non ha
//    ricevuto niente e il ponte la riprende: non serve fare niente.
//    «Ristampa» c'è solo quando è fallita o incerta, e per l'incerta si
//    guarda prima la carta: forse è già uscita.

const OGNI_MS = 5000;

export default function AvvisiStampaSala() {
  const [avvisi, setAvvisi] = useState([]);
  const [errore, setErrore] = useState("");
  const [mandando, setMandando] = useState(() => new Set());
  const ultima = useRef(0);

  const leggi = () => {
    const questa = ++ultima.current;
    return avvisiStampa()
      .then((a) => {
        if (questa !== ultima.current) return;
        setAvvisi(a ?? []);
      })
      .catch((e) => {
        if (questa === ultima.current) setErrore(`Non riesco a sapere se le comande sono uscite: ${e.message}`);
      });
  };

  useEffect(() => {
    leggi();
    return ogniTantoSeVisibile(leggi, OGNI_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ristampa = async (a) => {
    if (mandando.has(a.id)) return;
    setMandando((m) => new Set(m).add(a.id));
    setErrore("");
    try {
      await mandaAllaStampante({ righe: a.tipo === "chiamata" ? null : a.righe, chiamata: a.chiamata_id ?? null });
      await leggi();
    } catch (e) {
      setErrore(`Non l'ho rimandata alla stampante: ${e.message}`);
    } finally {
      setMandando((m) => {
        const n = new Set(m);
        n.delete(a.id);
        return n;
      });
    }
  };

  if (avvisi.length === 0 && !errore) return null;
  return (
    <div data-avvisi-stampa className="mb-3 space-y-1.5 print:hidden">
      {errore && (
        <p role="alert" className="testo-sala rounded-lg px-3 py-2 text-b58-terracotta-dark-testo bg-b58-terracotta/10">
          {errore}
        </p>
      )}
      {avvisi.map((a) => (
        <div
          key={a.id}
          data-avviso-stampa={a.stato}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${
            a.riprova ? "bg-b58-cream-dark/60 text-b58-charcoal" : "bg-b58-terracotta/10 text-b58-terracotta-dark-testo"
          }`}
        >
          <p role={a.riprova ? "status" : "alert"} className={`testo-sala min-w-0 ${a.riprova ? "" : "font-semibold"}`}>
            {a.frase}
          </p>
          {!a.riprova && (
            <button
              type="button"
              disabled={mandando.has(a.id)}
              onClick={() => ristampa(a)}
              className="tocco-azione rounded-lg bg-b58-azione hover:bg-b58-azione-dark px-4 text-b58-sul-colore testo-sala font-semibold disabled:opacity-50"
            >
              Ristampa
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
