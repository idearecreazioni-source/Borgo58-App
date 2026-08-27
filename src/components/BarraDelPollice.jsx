// =====================================================================
// IL GESTO STA DOVE ARRIVA IL POLLICE — 27/08/2026
// =====================================================================
//
// 🔴 DECISIONE DI ALESSIO: *il gesto principale di una schermata sta dove
//    arriva il pollice — in basso, sul lato della mano che tiene il
//    telefono*. Vale per «Fotografa», «Premi e parla», e ogni schermata
//    dove l'azione è **una sola** e si fa **in piedi**.
//
// ⚠️ SOLO DOVE L'AZIONE È UNA SOLA, e la distinzione non è formale: in una
//    schermata con dieci gesti, metterne uno in basso non lo avvicina al
//    pollice — dice che quello conta più degli altri. `ScattaFoto` compare
//    anche nella scheda di un prodotto, dove la foto è **uno dei tanti
//    campi**: lì il pulsante resta dov'è, ed è il motivo per cui questa
//    barra è un componente a sé invece di una modifica dentro `ScattaFoto`.
//
// ⚠️ LARGA TUTTA LA PAGINA, e non a destra o a sinistra. La decisione dice
//    «sul lato della mano che tiene il telefono», e quale sia quella mano il
//    gestionale non lo sa: una barra larga tutta arriva a tutte e due, e non
//    obbliga a indovinare. Se un giorno servisse stringerla su un lato, è
//    una riga qui — e una decisione di Alessio, non una scelta di chi
//    programma.
//
// 🔴 LO SPAZIATORE NON È UN DETTAGLIO: una barra `fixed` **copre** quello
//    che sta sotto, e su una pagina piena l'ultima riga sparirebbe senza che
//    nessuno lo dica. Lo spaziatore tiene nel flusso esattamente l'altezza
//    che la barra occupa, quindi non c'è modo che qualcosa finisca sotto.
//    ⚠️ Misurato prima di scriverlo: né `/fotografa` né `/detta` hanno un
//       respiro in fondo (`pb-…`), quindi senza spaziatore il difetto
//       sarebbe comparso al primo elenco lungo.
//
// ⚠️ SUL COMPUTER NON CAMBIA NIENTE: da `md:` in su la barra torna nel
//    flusso, dov'era. Il pollice è un problema di chi tiene un telefono in
//    una mano; con un mouse non esiste.

/**
 * @param altezza  quanto occupa la barra, in centimetri reali. Serve allo
 *                 spaziatore: deve combaciare, o resta un buco o si copre.
 */
export default function BarraDelPollice({ children, altezza = "2.05cm" }) {
  return (
    <>
      {/* Lo spaziatore: c'è solo dove la barra è fissa, cioè sul telefono. */}
      <div aria-hidden="true" className="md:hidden" style={{ height: altezza }} />

      <div
        data-barra-pollice=""
        className={
          // ⚠️ `left-0 right-0` e non `w-full`: dentro un contenitore con
          //    margini, `w-full` prende la larghezza del contenitore e la
          //    barra resterebbe stretta e disallineata.
          "fixed bottom-0 left-0 right-0 z-40 border-t border-b58-cream-dark " +
          "bg-b58-parchment/95 px-4 py-3 backdrop-blur print:hidden " +
          // Da tablet in su torna dov'era: nessun `fixed`, nessun bordo,
          // nessuno sfondo.
          "md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
        }
      >
        {children}
      </div>
    </>
  );
}
