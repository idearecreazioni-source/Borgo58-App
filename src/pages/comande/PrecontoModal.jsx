import { orderTotals } from "../../lib/api/orders";
import { formatEUR } from "../../lib/constants";

const lineLabel = (item) => item.recipe?.name || item.free_text_name;

// Preconto (§3.2, §3.2.1): l'anteprima che si porta al cliente prima di
// battere lo scontrino.
//
// Tre vincoli che non sono estetici ma di legge o di sostanza:
//  - la dicitura "DOCUMENTO NON FISCALE" e' obbligatoria (DPR 696/1996,
//    art. 12 L. 413/1991, art. 22 DPR 633/1972);
//  - non chiude il conto e non registra alcun pagamento;
//  - non passa MAI dal registratore telematico, nemmeno dalla sua stampa
//    non fiscale interna: si stampa sulla termica non fiscale del bar.
//    Finche' quella stampante non c'e', si stampa dal browser.
export default function PrecontoModal({ order, copertoPrice, onClose }) {
  const { items, itemsTotal, coperti, copertoUnitPrice, copertoTotal, total } = orderTotals(
    order,
    copertoPrice
  );

  // Righe raggruppate per piatto: piu' leggibile quando il tavolo ha fatto
  // piu' giri di comanda, ed e' come lo legge il cliente.
  const grouped = Object.values(
    items.reduce((acc, it) => {
      const key = lineLabel(it);
      if (!acc[key]) acc[key] = { name: key, quantity: 0, total: 0 };
      acc[key].quantity += it.quantity;
      acc[key].total += it.quantity * Number(it.unit_price);
      return acc;
    }, {})
  );

  return (
    <div className="fixed inset-0 bg-b58-charcoal/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-sm w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-b58-charcoal text-b58-parchment px-4 py-3 flex items-center justify-between shrink-0 print:hidden">
          <span className="font-display text-base">Preconto — {order.table_label}</span>
          <button type="button" onClick={onClose} className="text-b58-parchment/80 hover:text-b58-parchment text-lg leading-none">
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* Questo blocco e' l'unica cosa che finisce sulla carta: vedi
              .stampa-ticket in index.css. */}
          <div className="stampa-ticket font-mono text-xs bg-b58-cream-dark/30 border border-dashed border-b58-charcoal/25 rounded-lg p-3">
            <div className="text-center font-bold tracking-wide border border-b58-gold-dark/40 bg-b58-gold/15 rounded py-1 mb-2">
              DOCUMENTO NON FISCALE
            </div>
            <div className="text-center font-bold">BORGO 58</div>
            <div className="text-center mb-2">
              Preconto {order.table_label} · {coperti} {coperti === 1 ? "coperto" : "coperti"}
            </div>

            {grouped.length === 0 ? (
              <p className="text-b58-charcoal-soft">Nessuna riga sul conto.</p>
            ) : (
              grouped.map((g) => (
                <div key={g.name} className="flex justify-between gap-2 py-0.5">
                  <span className="min-w-0">{g.quantity}× {g.name}</span>
                  <span className="shrink-0">{formatEUR(g.total)}</span>
                </div>
              ))
            )}

            {coperti > 0 && (
              <div className="flex justify-between gap-2 py-0.5 border-t border-dashed border-b58-charcoal/20 mt-1 pt-1">
                <span>{coperti}× Coperto ({formatEUR(copertoUnitPrice)})</span>
                <span className="shrink-0">{formatEUR(copertoTotal)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-dashed border-b58-charcoal/40 mt-1.5 pt-1.5 font-bold text-sm">
              <span>TOTALE</span>
              <span>{formatEUR(total)}</span>
            </div>

            {/* Divisione informativa (§3.2.2): sul preconto si vede subito
                quanto viene a testa. L'arrotondamento si fa alla chiusura. */}
            {coperti >= 2 && total > 0 && (
              <div className="flex justify-between text-[10.5px] pt-0.5">
                <span>A testa ({coperti})</span>
                <span>{formatEUR(total / coperti)}</span>
              </div>
            )}

            <div className="text-center text-[10px] mt-2 leading-snug">
              Documento non fiscale, privo di valore ai fini IVA.<br />
              Il conto resta aperto.
            </div>
          </div>

          <p className="print:hidden text-[11px] text-b58-charcoal-soft/80 leading-relaxed bg-b58-cream-dark/40 rounded-lg px-3 py-2">
            Solo un'anteprima per il cliente: nessun pagamento registrato, nessuno
            scontrino emesso, il tavolo resta aperto. Piatti {formatEUR(itemsTotal)}
            {coperti > 0 && <> + coperti {formatEUR(copertoTotal)}</>}.
          </p>
        </div>

        <div className="p-4 pt-0 flex gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="tocco-azione flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment text-sm font-medium px-3"
          >
            Stampa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-3"
          >
            Chiudi anteprima
          </button>
        </div>
      </div>
    </div>
  );
}
