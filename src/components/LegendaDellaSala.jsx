import { useState } from "react";
import { COLORI } from "../lib/coloriSala";
import { SEGNI_IN_ORDINE } from "../lib/calcoli/ritardo";

// LA LEGENDA DEI COLORI DELLA SALA — 29/08/2026, richiesta di Alessio.
//
// 🔴 È UN ROVESCIAMENTO, e va detto: le due legende erano state TOLTE il
// 18/08 (rovesciamento n. 7), per una ragione che era buona — Alessio quelle
// regole le aveva scritte lui, e *una spiegazione che il lettore ha già in
// testa è ingombro*. Nella nota di allora c'era anche il prezzo: «da oggi la
// precedenza dei colori è dichiarata solo nel codice… il giorno che entrerà
// personale nuovo va rimessa».
//
// ⚠️ QUEL GIORNO È ARRIVATO PRIMA DEL PREVISTO, e non per il personale: sue
// parole, *«serve a lui adesso e servirà a chi lavorerà in sala»*. In mezzo
// i segni sono passati da tre a otto — tre fasce, il tavolo selezionato, la
// comanda partita, i due pallini, la sbarratura del ritardo e da stanotte il
// rigato di «non lo so». Otto segni non stanno in testa a nessuno.
//
// ⚠️ MA LA RAGIONE DEL 18/08 NON È SBAGLIATA, e per questo la legenda **non
// sta sempre a schermo**: si apre da un gesto e si richiude. Una spiegazione
// che c'è sempre si legge il primo giorno e poi diventa arredamento — che è
// esattamente quello che era diventata.
//
// 🔴 E I COLORI NON SONO RISCRITTI QUI: si leggono dalla stessa mappa che la
// pianta usa per disegnare, e l'ORDINE si legge dalla funzione che decide la
// precedenza. Una legenda con la propria copia dei colori è una spiegazione
// che, il giorno che qualcuno cambia una tinta, comincia a raccontare una
// sala diversa da quella che si vede — ed è la forma di difetto che questo
// progetto chiama «due verità».

function Campione({ chiave, barrato, pallino }) {
  const c = COLORI[chiave] ?? COLORI.libero;
  return (
    <svg width="34" height="24" className="shrink-0" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="32"
        height="22"
        rx="3"
        fill={c.riempimento}
        stroke={c.bordo}
        strokeWidth="1.5"
      />
      {barrato && (
        <>
          <line x1="1" y1="1" x2="33" y2="23" stroke="var(--color-b58-turno-dark)" strokeWidth="2" />
          <line x1="1" y1="23" x2="33" y2="1" stroke="var(--color-b58-turno-dark)" strokeWidth="2" />
        </>
      )}
      {pallino && (
        <circle
          cx="27"
          cy="6"
          r="4"
          fill={pallino === "pieno" ? "var(--color-b58-charcoal)" : "none"}
          stroke="var(--color-b58-charcoal)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

export default function LegendaDellaSala() {
  const [aperta, setAperta] = useState(false);

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        aria-expanded={aperta}
        className="tocco-bottone testo-sala text-b58-charcoal-soft underline hover:text-b58-terracotta"
      >
        {aperta ? "Nascondi cosa vogliono dire i colori" : "Cosa vogliono dire i colori?"}
      </button>

      {aperta && (
        <div className="mt-2 rounded-lg bg-b58-cream-dark/40 ring-1 ring-b58-charcoal/10 px-3 py-2">
          {/* ⚠️ L'ordine è quello VERO della precedenza, letto da chi la
              decide: se un giorno cambia, questa lista cambia con lui. Una
              legenda che racconta un ordine diverso da quello che si vede è
              peggio di nessuna legenda. */}
          <p className="testo-sala text-b58-charcoal-soft mb-2">
            Quando su un tavolo c&apos;è più di una cosa, vince la prima di questo elenco.
          </p>
          <ul className="space-y-1.5">
            {SEGNI_IN_ORDINE.map((s) => (
              <li key={s.chiave} className="flex items-start gap-2">
                <Campione chiave={s.campione ?? s.chiave} barrato={s.barrato} pallino={s.pallino} />
                <span className="testo-sala text-b58-charcoal">
                  <strong>{s.nome}</strong> — {s.dice}
                </span>
              </li>
            ))}
          </ul>
          {/* 🔴 IL NUMERO NON E' UN COLORE, e per questo sta FUORI
              dall'elenco della precedenza — 30/08/2026. L'elenco qui sopra
              risponde a *«quando su un tavolo c'è più di una cosa, quale
              vince»*: il numero non gareggia con nessuno, si somma. Metterlo
              in fila con le tinte direbbe che a volte le sostituisce. */}
          <p className="testo-sala text-b58-charcoal mt-2">
            <strong>La pastiglia scura col numero</strong> — quante prenotazioni ci sono
            su quel tavolo, quando è più di una. Il colore dice in che fascia arrivano,
            e tre prenotazioni alla stessa ora hanno tutte la stessa fascia: il numero è
            l&apos;unica cosa che può dire quante sono.
          </p>
          <p className="testo-sala text-b58-charcoal-soft mt-2">
            I confini delle tre fasce non sono ore fisse: vengono dagli orari di quel
            servizio, e una domenica di pranzo non ha gli stessi di una cena.
          </p>
        </div>
      )}
    </div>
  );
}
