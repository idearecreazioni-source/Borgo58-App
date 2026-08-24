import { orderTotals } from "../../lib/api/orders";
import { ALLERGENS, formatEUR, labelFor } from "../../lib/constants";
import { allergeniTolti, nomeRiga, totaleRiga } from "../../lib/calcoli/righeComanda";

// 🔴 IL NOME DELLA RIGA SUL PRECONTO — dal 24/08 arriva da `righeComanda.js`,
// dove sta anche quello della Sala, della Cucina e della chiusura conto:
// erano quattro copie, e una sola sapeva riconoscere un bis.
//
// ⚠️ E QUI IL NOME PORTA ANCHE IL «SENZA», perché il preconto è il foglio
// che finisce in mano a chi paga: un supplemento per una sostituzione non
// deve comparire senza dire da dove viene.
const nomeSulConto = (item) => {
  const tolti = allergeniTolti(item);
  if (tolti.length === 0) return nomeRiga(item);
  return `${nomeRiga(item)} (senza ${tolti
    .map((a) => labelFor(ALLERGENS, a).toLowerCase())
    .join(", ")})`;
};

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
  const { items, itemsTotal, nonInviate, coperti, copertoUnitPrice, copertoTotal, total } =
    orderTotals(order, copertoPrice);

  // Righe raggruppate per piatto: piu' leggibile quando il tavolo ha fatto
  // piu' giri di comanda, ed e' come lo legge il cliente.
  // ⚠️ LA CHIAVE COMPRENDE IL «SENZA», ed è la parte che conta: due righe
  // dello stesso piatto, una normale e una senza lattosio, NON si sommano —
  // costano diverso e sono due piatti diversi per chi li mangia. Con la
  // chiave sul solo nome, il supplemento sarebbe comparso nel totale senza
  // nessuna riga che lo spiega.
  const grouped = Object.values(
    items.reduce((acc, it) => {
      const key = nomeSulConto(it);
      if (!acc[key]) acc[key] = { name: key, quantity: 0, total: 0 };
      acc[key].quantity += it.quantity;
      acc[key].total += totaleRiga(it);
      return acc;
    }, {})
  );

  return (
    <div className="fixed inset-0 bg-b58-charcoal/50 flex items-center justify-center p-4 z-50">
      {/* ⚠️ Allargata come la chiusura conto (22/08): con le scritte a 3,20 mm
          dentro 384 punti le righe del conto andavano a capo. Il preconto è il
          foglio che finisce in mano al cliente — una riga spezzata lì è una
          domanda a voce mentre si ha altro da fare. */}
      <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-b58-charcoal text-b58-parchment px-4 py-3 flex items-center justify-between shrink-0 print:hidden">
          <span className="font-display testo-sala-grande">Preconto — {order.table_label}</span>
          <button type="button" onClick={onClose} className="tocco-bottone text-b58-parchment/80 hover:text-b58-parchment testo-sala-grande leading-none">
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* Questo blocco e' l'unica cosa che finisce sulla carta: vedi
              .stampa-ticket in index.css. */}
          {/* 🔴 LA VIA DI MEZZO — 3,44 mm invece di 3,70 (22/08).
              ⚠️ E IL NUMERO CHE CONTA NON È «QUANTE RIGHE VANNO A CAPO»,
              che dipende da come si chiamano i piatti di quel giorno:
              è **quanti caratteri stanno su una riga**, che è una
              proprietà del foglio. Misurato sui 57,1 mm che restano al
              nome dopo il prezzo:

                3,17 mm → 29 caratteri   (il «2× » compreso)
                3,44 mm → 27      ← questa
                3,70 mm → 25

              Sui nomi della carta vera, che arrivano a 29 caratteri
              («Tonno in crosta di pistacchio»), i 27 lasciano intera la
              gran parte delle righe; i 25 ne spezzano il doppio.

              ⚠️ MISURANDOLO MI ERO SBAGLIATO UNA VOLTA, e vale la pena
              dirlo: sul progetto di prova i piatti si chiamano
              «BASE-Tonno in crosta di pistacchio» — **cinque caratteri di
              prefisso che nella realtà non esistono** — e lì a 3,44 mm
              vanno a capo cinque righe su sei invece di due. *Un conto di
              collaudo può essere più severo del vero, e la misura giusta
              è quella che non dipende dai dati.*

              ⚠️ Il minimo del foglio resta comunque 3,44 mm contro i 2,65
              di partenza: la ragione per cui Alessio aveva chiesto di
              ingrandire — *è il foglio che legge chi sta pagando* — è
              soddisfatta lo stesso. */}
          <div className="print:text-[13px] stampa-ticket font-mono testo-sala bg-b58-cream-dark/30 border border-dashed border-b58-charcoal/25 rounded-lg p-3">
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

            <div className="print:text-base flex justify-between border-t border-dashed border-b58-charcoal/40 mt-1.5 pt-1.5 font-bold testo-sala">
              <span>TOTALE</span>
              <span>{formatEUR(total)}</span>
            </div>

            {/* Divisione informativa (§3.2.2): sul preconto si vede subito
                quanto viene a testa. L'arrotondamento si fa alla chiusura. */}
            {coperti >= 2 && total > 0 && (
              <div className="print:text-[13px] flex justify-between testo-sala pt-0.5">
                <span>A testa ({coperti})</span>
                <span>{formatEUR(total / coperti)}</span>
              </div>
            )}

            <div className="print:text-[12px] text-center testo-sala mt-2 leading-snug">
              Documento non fiscale, privo di valore ai fini IVA.<br />
              Il conto resta aperto.
            </div>
          </div>

          {/* ⚠️ `print:hidden`: l'avviso è per chi porta il preconto, non
              per il cliente — sul foglio ci va il conto, non i nostri
              lavori in corso. Stessa scelta degli allergeni da verificare,
              che stanno sullo schermo e non sul menu. */}
          {nonInviate.length > 0 && (
            <p className="print:hidden testo-sala text-b58-charcoal bg-b58-gold/15 ring-1 ring-b58-gold-dark/30 rounded-lg px-3 py-2">
              {nonInviate.length === 1
                ? "1 riga non è mai stata mandata in cucina e non è su questo preconto."
                : `${nonInviate.length} righe non sono mai state mandate in cucina e non sono su questo preconto.`}
            </p>
          )}

          <p className="print:hidden testo-sala text-b58-charcoal-soft/80 leading-relaxed bg-b58-cream-dark/40 rounded-lg px-3 py-2">
            Solo un'anteprima per il cliente: nessun pagamento registrato, nessuno
            scontrino emesso, il tavolo resta aperto. Piatti {formatEUR(itemsTotal)}
            {coperti > 0 && <> + coperti {formatEUR(copertoTotal)}</>}.
          </p>
        </div>

        <div className="p-4 pt-0 flex gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="tocco-azione flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment testo-sala font-medium px-3"
          >
            Stampa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3"
          >
            Chiudi anteprima
          </button>
        </div>
      </div>
    </div>
  );
}
