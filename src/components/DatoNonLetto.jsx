// LA RIGA CHE DICE «NON LO SO» — 20/08/2026.
//
// Una forma sola per tutte le schermate, perché *un segno che cambia faccia
// da una schermata all'altra si impara peggio di uno solo* (è la ragione con
// cui Alessio, il 16/08, fece rifare due volte la striscia del progetto di
// prova).
//
// ⚠️ NON È UN ERRORE ROSSO SU TUTTA LA PAGINA: sta **al posto del dato che
// manca**, e lascia vivere il resto della schermata. Un errore che copre
// tutto per una lettura accessoria fa perdere anche le nove che erano
// arrivate — è il difetto misurato il 18/08 sulla pianta della sala.
//
// ⚠️ DUE FORME, e la differenza è chi è il lettore:
//   · con `onRiprova` → il riquadro tratteggiato, per un dato che **è** la
//     schermata. È la stessa forma già in servizio in Comande e nel
//     Calendario dal 18/08: non se ne inventa una terza;
//   · senza → una riga sottile, per un menu o un accessorio. Un riquadro
//     con pulsante ripetuto quindici volte diventa arredamento, e
//     l'arredamento non lo legge nessuno.
export default function DatoNonLetto({ cosa, nonVuolDire, onRiprova, className = "" }) {
  if (onRiprova) {
    return (
      <div
        className={`rounded-xl border border-dashed border-b58-terracotta/40 p-6 text-center ${className}`}
      >
        <p className="text-b58-charcoal font-medium mb-1">Non riesco a leggere {cosa}.</p>
        <p className="text-xs text-b58-charcoal-soft mb-3">
          {nonVuolDire ?? "Non vuol dire che non c'è niente: vuol dire che non lo so."}
        </p>
        <button
          type="button"
          onClick={onRiprova}
          className="tocco-azione rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment text-base font-semibold px-6"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <p className={`text-xs text-b58-terracotta-dark ${className}`}>
      Non riesco a leggere {cosa}: non vuol dire che non ce n&apos;è, vuol dire che non lo so.
    </p>
  );
}
