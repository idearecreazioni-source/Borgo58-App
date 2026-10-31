// LA STAMPA NELLA CODA, PER CUCINA E BAR — 31/10/2026.
//
// Prima stava solo dentro Cucina.jsx. Il controllo finale del 30/10 (A3)
// ha trovato che il Bar non sapeva mai se il suo foglio era uscito: adesso
// le due pagine usano gli stessi avvisi e lo stesso riquadro sotto ogni
// foglio, così dicono le stesse cose con le stesse parole.
//
// 🔴 «INCERTO» DICE UNA COSA SOLA (A2). Prima sotto «Non si sa se è
//    uscito» compariva anche «la stampante non l'ha stampato», e chi legge
//    la seconda ristampa: la comanda esce due volte. Adesso la frase è una,
//    e dice di guardare la carta PRIMA di qualunque tasto. Niente si
//    ristampa da solo: decide chi ha guardato la stampante.

const AVVISO = "shrink-0 testo-sala text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3 print:hidden";
const BOTTONE_PIENO =
  "tocco-azione flex-1 rounded-lg bg-b58-azione hover:bg-b58-azione-dark text-b58-sul-colore testo-sala-grande font-semibold disabled:opacity-50";
const BOTTONE_VUOTO =
  "tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal testo-sala font-medium disabled:opacity-50";

/**
 * Gli avvisi in testa alla pagina quando c'è una stampante per il reparto.
 * `senzaPonte` è cosa fare quando il ponte è spento: in Cucina si stampa da
 * qui, al Bar si legge dallo schermo.
 */
export function AvvisiDellaStampante({ stampante, pontePronto, codaNonLetta, erroreTasto, senzaPonte }) {
  const ferma = ["carta_finita", "coperchio_aperto", "non_risponde", "errore"].includes(stampante?.stato);
  return (
    <>
      {stampante && codaNonLetta && (
        <p className={AVVISO}>
          Non riesco a leggere la coda della stampante: quello che vedi sotto ogni foglio potrebbe essere vecchio.
        </p>
      )}
      {erroreTasto && (
        <p role="alert" className={AVVISO}>
          Non l'ho rimandato alla stampante: {erroreTasto}
        </p>
      )}
      {/* 🔴 IL PONTE SPENTO SI VEDE (piano del 29/10): dopo 90 secondi senza
          il suo «ci sono» i fogli restano in coda e non escono. */}
      {stampante && !pontePronto && (
        <p
          role="alert"
          className="shrink-0 testo-sala-grande font-semibold text-b58-sul-colore bg-b58-terracotta-dark rounded-lg px-3 py-2.5 mb-3 print:hidden"
        >
          Il ponte è spento o senza rete: i fogli restano in coda e non escono. {senzaPonte}
        </p>
      )}
      {stampante && pontePronto && ferma && (
        <p role="alert" className={`${AVVISO} font-semibold`}>
          «{stampante.nome}»: {stampante.testo ?? "non risponde"}
        </p>
      )}
    </>
  );
}

/**
 * Sotto un foglio, quando c'è la stampante: come sta nella coda e cosa si
 * può fare. `onUscito` e `onStampaQui` ci sono solo in Cucina (al Bar il
 * foglio si legge dallo schermo, e «evaso» è un'altra cosa).
 */
export function InCoda({ come, pontePronto, occupato, onManda, onUscito, onStampaQui }) {
  const seNonCe = onStampaQui ? "«Ristampa» o «Stampa da qui»" : "«Ristampa»";
  const frase = {
    in_coda: pontePronto ? "In coda: esce fra poco dalla stampante." : "In coda: aspetta il ponte, che è spento.",
    in_corso: "Sta uscendo dalla stampante…",
    stampato: "Uscito dalla stampante.",
    fallito: `Non è uscito${come.errore ? `: ${come.errore}` : "."}`,
    incerto: "Forse è uscito, forse no.",
    fuori: "Non è nella coda della stampante.",
  }[come.stato];
  const allarme = ["fallito", "incerto", "fuori"].includes(come.stato);
  return (
    <div className="mt-1.5 space-y-1.5 print:hidden">
      {/* L'annuncio forte solo quando il foglio non è uscito o non si sa:
          «non è in coda» è anche il caso dei fogli di prima. */}
      <p
        role={["fallito", "incerto"].includes(come.stato) ? "alert" : "status"}
        className={`testo-sala rounded-lg px-3 py-1.5 ${
          allarme
            ? "font-semibold text-b58-terracotta-dark-testo bg-b58-terracotta/10"
            : "text-b58-charcoal-soft bg-b58-cream-dark/60"
        }`}
      >
        {frase}
        {come.stato === "incerto" && (
          <span className="block font-normal">
            Prima di premere un tasto guarda la carta della stampante
            {onUscito ? ": se il foglio c'è, «È uscito»; " : ": se il foglio c'è, non serve altro; "}
            se non c'è, {seNonCe}.
          </span>
        )}
      </p>
      <div className="flex gap-2">
        {come.stato === "incerto" && (
          <>
            {onUscito && (
              <button type="button" onClick={onUscito} className={BOTTONE_PIENO}>
                È uscito
              </button>
            )}
            <button type="button" disabled={occupato} onClick={onManda} className={BOTTONE_VUOTO}>
              Ristampa
            </button>
          </>
        )}
        {(come.stato === "fallito" || come.stato === "fuori") && (
          <button type="button" disabled={occupato} onClick={onManda} className={BOTTONE_PIENO}>
            {come.stato === "fallito" ? "Riprova sulla stampante" : "Mandalo alla stampante"}
          </button>
        )}
        {/* ⚠️ Mentre la stampante lo sta stampando, «Stampa da qui» lo farebbe
            uscire due volte: si aspetta (al massimo 45 secondi, poi è incerto). */}
        {onStampaQui && (
          <button type="button" onClick={onStampaQui} disabled={come.stato === "in_corso"} className={BOTTONE_VUOTO}>
            <span aria-hidden="true">🖨</span> Stampa da qui
          </button>
        )}
      </div>
    </div>
  );
}
