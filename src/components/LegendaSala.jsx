import { CAMPIONE_SBARRATO, CAMPIONI } from "../lib/coloriSala";
import { vociLegenda } from "../lib/calcoli/ritardo";

// LA LEGENDA DELLA SALA — una sola, per le due schermate.
//
// ⚠️ NON ELENCA I COLORI: DICHIARA LA PRECEDENZA. È il rilievo del mandato
// (giro D): fino a oggi le due legende mettevano in fila quattro quadratini,
// e nessuna diceva che uno di quei segni ne copre un altro. *Un colore che
// ne sovrascrive altri, senza che la legenda lo dica, si legge come un colore
// che non esiste da nessuna parte* — chi guarda cerca il verde su un tavolo
// che è diventato dorato e conclude che il gestionale ha sbagliato.
//
// ⚠️ E L'ORDINE NON È SCRITTO QUI. Arriva da `PRECEDENZA` in
// lib/calcoli/ritardo.js, che è lo stesso dato con cui `segnoDelTavolo()`
// decide che colore dare alla sagoma. Due elenchi — uno per disegnare e uno
// per spiegare — sarebbero due posti che possono divergere, e a divergere
// sarebbe quello che nessuno riesegue: la spiegazione.
//
// ⚠️ I COLORI arrivano dal disegno per la stessa ragione (`CAMPIONI`): se
// domani il dorato diventasse un altro dorato, il quadratino lo seguirebbe.
//
// @param chiavi  quali segni questa schermata può mostrare
// @param testi   { chiave: frase } — la stessa precedenza, due mestieri:
//                in Calendario si scelgono tavoli, in Comande si serve un conto
// @param conRitardo  la sbarratura si spiega solo dove può comparire
export default function LegendaSala({ chiavi, testi, conRitardo = true }) {
  const voci = vociLegenda(chiavi, testi);
  return (
    <div className="mt-2 text-[11px] text-b58-charcoal-soft leading-relaxed">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {voci.map((v) => (
          <span key={v.chiave}>
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1 ring-1 ring-b58-charcoal/15"
              style={{ background: CAMPIONI[v.chiave] }}
            />
            {v.testo}
          </span>
        ))}
        {conRitardo && (
          <span>
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1 ring-1 ring-b58-charcoal/15"
              style={{ background: CAMPIONE_SBARRATO }}
            />
            sbarrato: nessuno ha ancora aperto il conto
          </span>
        )}
      </div>
      {/* LA RIGA CHE VALE PIÙ DEI QUADRATINI. Senza, i segni sembrano
          alternative fra pari e il primo tavolo che ne porta due sembra un
          errore del programma. */}
      <p className="mt-1 text-b58-charcoal-soft/80">
        Quando su un tavolo cadono più cose, si vede{" "}
        <strong>la prima di questo elenco</strong>
        {voci.length > 1 && (
          <>
            {" "}
            — {voci[0].testo.toLowerCase()} copre {voci[voci.length - 1].testo.toLowerCase()}
          </>
        )}
        .
        {conRitardo && (
          <>
            {" "}
            <strong>La sbarratura no: si aggiunge sopra qualunque colore</strong>, perché è
            l&apos;unica cosa su cui devi decidere adesso — se ridare via il tavolo o no.
          </>
        )}
      </p>
    </div>
  );
}
