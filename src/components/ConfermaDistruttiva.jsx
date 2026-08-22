import { useState } from "react";

/**
 * La conferma per le azioni che non si disfano.
 *
 * ⚠️ NON va messa su tutto, ed è il punto del Blocco 5.1 del mandato di
 * correzione: *una conferma su ogni gesto insegna a premere «sì» senza
 * leggere, e allora non protegge più niente.* Il criterio, in quest'ordine:
 *
 *   1. **Chiede conferma** ciò che è irreversibile e tocca soldi, obblighi
 *      di legge o dati di persone: fatture, mance, buste paga, documenti
 *      dei dipendenti, cessioni, movimenti di prima nota, omaggi, schede
 *      cliente, note «di tasca mia», rimborsi, spese deducibili.
 *   2. **Non chiede conferma** ciò che si rifà in tre secondi o ha una via
 *      di ritorno visibile: righe di ricetta, fasi, video, voci di menu,
 *      colture, impegni.
 *
 * ⚠️ E la conferma **dice cosa sparisce**, non «sei sicuro?». Un «sei
 * sicuro?» generico è una porta che si apre premendo due volte invece di
 * una: non aggiunge nessuna informazione a chi sta per sbagliare.
 *
 * La forma è quella che «Elimina dipendente» usa dal 09/08: il bottone si
 * trasforma in una riga di conferma sul posto, senza finestre che coprono
 * quello che si stava guardando. Su un tablet vale anche un'altra cosa —
 * il secondo tocco cade lontano dal primo, quindi non si conferma per
 * inerzia.
 */
export default function ConfermaDistruttiva({
  etichetta = "Elimina",
  cosaSparisce,
  domanda,
  etichettaConferma = "Sì, elimina",
  onConferma,
  disabilitato = false,
  className = "",
}) {
  const [chiesto, setChiesto] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const conferma = async () => {
    setInCorso(true);
    try {
      await onConferma();
      setChiesto(false);
    } finally {
      // Anche se l'azione fallisce si esce dallo stato «in corso»: il
      // messaggio d'errore lo mostra la schermata che ci sta intorno, e
      // un bottone che resta girato su «Elimino…» per sempre sembra un
      // gestionale bloccato.
      setInCorso(false);
    }
  };

  if (!chiesto) {
    return (
      <button
        type="button"
        disabled={disabilitato}
        onClick={() => setChiesto(true)}
        className={`tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark disabled:opacity-50 ${className}`}
      >
        {etichetta}
      </button>
    );
  }

  return (
    // 🔴 I DUE PULSANTI SI ALLONTANANO (22/08, dal collaudo in scala
    // reale). Stavano a 8 punti l'uno dall'altro — **1,1 mm veri** — e
    // sono «Sì, elimina» e «Annulla»: il gesto piu' irreversibile della
    // schermata accanto al suo contrario, a un decimo della larghezza di
    // un dito. Adesso ce ne sono **5 mm**, misurati in centimetri veri
    // come i bersagli.
    //
    // ⚠️ Non e' prudenza generica: il secondo tocco deve cadere lontano
    // dal primo, che e' gia' la ragione per cui questa conferma nasce sul
    // posto invece che in una finestra.
    <span className="inline-flex items-center testo-sala" style={{ gap: "calc(var(--pxcm) * 0.5)" }}>
      <span className="text-b58-terracotta-dark">
        {domanda ?? `Elimino ${cosaSparisce}?`}
      </span>
      <button
        type="button"
        onClick={conferma}
        disabled={inCorso}
        className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment px-3 py-1.5 disabled:opacity-60"
      >
        {inCorso ? "Elimino…" : etichettaConferma}
      </button>
      <button
        type="button"
        onClick={() => setChiesto(false)}
        disabled={inCorso}
        className="tocco-bottone text-b58-charcoal-soft hover:text-b58-charcoal px-2 py-1.5"
      >
        Annulla
      </button>
    </span>
  );
}
