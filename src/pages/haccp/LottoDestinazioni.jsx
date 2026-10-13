import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doveEFinitoIlLotto, getStockLot } from "../../lib/api/stock";
import { formatDate, qtaConUnita } from "../../lib/constants";
import { contoDelLotto, parolaUscita, righeInOrdine } from "../../lib/calcoli/lotti";
import PrintButton from "../../components/PrintButton";

// DOVE È FINITO UN LOTTO — 12/10/2026 (N6, Blocco 6 del mandato cumulativo)
//
// La metà che mancava alla tracciabilità: l'arrivo c'era, la destinazione
// no. È la pagina che serve davanti a un richiamo del produttore — «quel
// lotto di farina dove è andato?» — quindi si stampa.
//
// ⚠️ IL VUOTO È DICHIARATO, NON NASCOSTO: il gestionale annota le uscite dal
//    12/10/2026, e quello uscito prima compare come una riga a sé con la
//    sua quantità. Una lista che sembra completa e non lo è, in un
//    richiamo, è il caso peggiore.
// ⚠️ «NON LO SO» NON È «NON C'È»: se la lettura fallisce si dice, con la
//    via per riprovare, e non si disegna un lotto che non è andato da
//    nessuna parte (regola del 19/08).

export default function LottoDestinazioni() {
  const { id } = useParams();
  const [lotto, setLotto] = useState(null);
  const [righe, setRighe] = useState(null);
  const [error, setError] = useState("");
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    let vivo = true;
    setError("");
    setRighe(null);
    Promise.all([getStockLot(id), doveEFinitoIlLotto(id)])
      .then(([l, r]) => {
        if (!vivo) return;
        setLotto(l);
        setRighe(righeInOrdine(r));
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, giro]);

  const unita = lotto?.ingredient?.unit;
  const conto = contoDelLotto(righe);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 print:hidden">
        <Link
          to="/haccp/tracciabilita"
          className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          ← Tracciabilità lotti
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6">
        <h1 className="titolo-documento font-display text-2xl md:text-3xl text-b58-charcoal">
          Dove è finito: {lotto?.ingredient?.name ?? "…"}
        </h1>
        {lotto && (
          <p className="testo-sala text-b58-charcoal-soft mt-1">
            {[
              lotto.supplier?.name,
              lotto.supplier_batch_number && `lotto ${lotto.supplier_batch_number}`,
              `ricevuto il ${formatDate(lotto.received_at)}`,
              `${qtaConUnita(lotto.quantity_received, unita)} ricevuti`,
              `${qtaConUnita(lotto.quantity_remaining, unita)} ancora in magazzino`,
              lotto.expiry_date && `scade il ${formatDate(lotto.expiry_date)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {error ? (
        <div className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
          <p>Non sono riuscito a leggere dove è finito questo lotto: {error}</p>
          <button
            type="button"
            onClick={() => setGiro((g) => g + 1)}
            className="tocco-bottone mt-2 px-3 rounded-lg border border-b58-terracotta text-b58-terracotta-dark print:hidden"
          >
            Riprova
          </button>
        </div>
      ) : righe === null ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : righe.length === 0 ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">
          Da questo lotto non è ancora uscito niente.
        </p>
      ) : (
        <>
          {conto.nonAnnotato > 0 && (
            <p className="testo-sala text-b58-charcoal-soft mb-4">
              {qtaConUnita(conto.nonAnnotato, unita)} sono usciti prima del 12/10/2026, quando il
              gestionale non annotava ancora dove andava la merce: per quelli la destinazione non si
              può ricostruire.
            </p>
          )}
          <ul className="space-y-2">
            {righe.map((r, i) => (
              <li
                key={`${r.lotto_id}-${i}`}
                className={`rounded-lg border px-3 py-2 ${
                  r.tipo === "non_annotato"
                    ? "border-dashed border-b58-charcoal/30 text-b58-charcoal-soft"
                    : "border-b58-charcoal/15"
                }`}
                style={{ marginLeft: `${Math.min(r.livello, 4) * 1.5}rem` }}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="testo-sala-grande font-medium text-b58-charcoal">
                    {parolaUscita(r.tipo)}
                  </span>
                  <span className="testo-sala-grande">{qtaConUnita(r.quantita, r.unita)}</span>
                  {r.livello > 0 && <span className="testo-sala text-b58-charcoal-soft">di {r.prodotto}</span>}
                  {r.serata && (
                    <span className="testo-sala text-b58-charcoal-soft">
                      {r.tipo === "conto" ? "serata del " : ""}
                      {formatDate(r.serata)}
                    </span>
                  )}
                </div>
                <p className="testo-sala text-b58-charcoal-soft">{r.descrizione}</p>
                {r.tipo === "conto" && (
                  <p className="testo-sala text-b58-charcoal">
                    {r.piatti
                      ? `Nei piatti: ${r.piatti}`
                      : "Nessun piatto di questo conto contiene il prodotto nella ricetta di oggi: la ricetta può essere cambiata dopo."}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
