import { useEffect, useState } from "react";
import {
  cancelOrder,
  closeOrderAsDiscountGift,
  caparraDelConto,
  closeOrderPaid,
  orderTotals,
} from "../../lib/api/orders";
import { listCausali } from "../../lib/api/cash";
import {
  ALLERGENS,
  DISCOUNT_GIFT_TYPES,
  ORDER_PAYMENT_METHODS,
  formatEUR,
  labelFor,
} from "../../lib/constants";
import { allergeniTolti, nomeRiga, totaleRiga } from "../../lib/calcoli/righeComanda";
import { fiscalizzaConto } from "../../lib/fiscalizzazione";
import { serataCorrente } from "../../lib/giornataOperativa";
import { NON_LETTO, leggi, nonLetto } from "../../lib/calcoli/letture";

// 🔴 IL NOME E IL TOTALE DI UNA RIGA ARRIVANO DA `righeComanda.js` (24/08):
// erano quattro copie sparse, e solo quella della Sala sapeva riconoscere un
// bis. Qui il nome porta anche il «senza», perché una sostituzione fa
// cambiare il prezzo e chi chiude il conto deve vedere da dove viene.
const nomeSulConto = (item) => {
  const tolti = allergeniTolti(item);
  if (tolti.length === 0) return nomeRiga(item);
  return `${nomeRiga(item)} (senza ${tolti
    .map((a) => labelFor(ALLERGENS, a).toLowerCase())
    .join(", ")})`;
};

// Modale "chiudi conto" (§3.2), ripreso dal prototipo UX di Cowork: riepilogo
// raggruppato per piatto, poi pagato/sconto/omaggio/annullato.
export default function CloseOrderModal({ order, copertoPrice, onClose, onDone }) {
  const [mode, setMode] = useState(null); // null | "sconto" | "omaggio" | "annulla" | "romana" | "misto"
  const [quotaCarta, setQuotaCarta] = useState("");
  // Divisione alla romana con arrotondamento (§3.2.2, deciso da Alessio il
  // 09/08/2026): 25 € in 2 → si propone la cifra tonda (12), il conto si
  // chiude a 24 e il 1 € di differenza resta registrato come cortesia
  // (sconto) — sul meccanismo atomico che già esiste, nessun registro nuovo.
  const [persone, setPersone] = useState(2);
  const [aTesta, setATesta] = useState("");
  const [causali, setCausali] = useState([]);
  // La caparra da proporre, e la scelta di Alessio. `null` = non ha ancora
  // deciso, ed e' lo stato in cui i pulsanti di pagamento restano spenti.
  const [caparra, setCaparra] = useState(null);
  const [sceltaCaparra, setSceltaCaparra] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    collectedAmount: "",
    causaleId: "",
    note: "",
    cancelReason: "",
  });

  useEffect(() => {
    listCausali("sconto_omaggio").then(setCausali);
  }, []);

  // ⚠️ SI CHIEDE AL DATABASE, non si deduce dalla prenotazione: la regola su
  // «gia' usata» e sul confronto con il totale del conto vive li', e una
  // copia qui direbbe prima o poi una cosa diversa.
  // 🔴 SE NON SI RIESCE A LEGGERE, NON SI DICE «non c'e' caparra».
  // Un catch che ingoia farebbe chiudere il conto a prezzo pieno su un
  // cliente che ha gia' versato — e la schermata direbbe la cosa sbagliata
  // con calma, senza nessun errore rosso. Regola del 20/08: si marca
  // NON_LETTO e la schermata lo mostra, coi pulsanti spenti.
  useEffect(() => {
    let vivo = true;
    leggi(caparraDelConto(order.id)).then((c) => { if (vivo) setCaparra(c); });
    return () => { vivo = false; };
  }, [order.id]);

  const ricaricaCaparra = () => {
    setCaparra(NON_LETTO);
    leggi(caparraDelConto(order.id)).then(setCaparra);
  };

  // Stesso calcolo del preconto e del totale a schermo — coperto incluso
  // (§3.2.1): il cliente non deve vedere due numeri diversi.
  const { items, nonInviate, nonInviateTotal, coperti, copertoUnitPrice, copertoTotal, total } =
    orderTotals(order, copertoPrice);

  // Righe raggruppate per nome, come nello scontrino del prototipo — più
  // leggibile di una lista piatta quando ci sono più giri di comanda.
  const grouped = Object.values(
    items.reduce((acc, it) => {
      const key = nomeSulConto(it);
      if (!acc[key]) acc[key] = { name: key, quantity: 0, total: 0 };
      acc[key].quantity += it.quantity;
      acc[key].total += totaleRiga(it);
      return acc;
    }, {})
  );

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  // 🔴 LO SCONTRINO PARTE DA SOLO (22/08/2026, decisione di Alessio):
  // *«viene considerato emesso fino a prova contraria, non viceversa. Il
  // sistema deve essere automatico e la rettifica è solo una via d'uscita
  // per le rare volte che servirà.»*
  //
  // ⚠️ QUINDI QUI NON SI CHIEDE NIENTE A NESSUNO: nessuna conferma, nessuna
  // spunta, nessun «hai controllato?». Il flusso normale non prende attriti
  // in più — che è tutto il senso della decisione.
  //
  // ⚠️ E STA DENTRO `run`, che è il punto unico da cui passano TUTTE le
  // chiusure: contante, carta, misto, alla romana, sconto. Metterla nei
  // singoli gestori vorrebbe dire cinque copie, e la sesta chiusura che
  // qualcuno aggiungerà domani nascerebbe senza scontrino.
  //
  // ⚠️ `fiscalizza: false` per annullamento e OMAGGIO, e non è una
  // dimenticanza: un omaggio non incassa niente, quindi non c'è nessun
  // corrispettivo da emettere — è la stessa riga che `quadratura_fiscale`
  // dice a parole da agosto.
  const run = async (fn, { fiscalizza = true } = {}) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    // ⚠️ DA QUI IN POI IL CONTO È CHIUSO, e niente può più rimetterlo in
    // discussione: la stampa è una conseguenza, e la sala non si blocca
    // davanti al cliente. `fiscalizzaConto` non lancia mai; se lo scontrino
    // non esce, il conto resta nell'elenco «da fiscalizzare» che a fine
    // giornata si fa notare da solo.
    if (fiscalizza) {
      // SILENZIO MOTIVATO: se la serata non si legge, `setDocumentoFiscale`
      // ripiega su `oggiLocale()` — che nel caso normale (conto chiuso nella
      // sua serata) è lo stesso giorno. Non si dichiara a schermo perché
      // qui il cliente sta aspettando il resto: fermare la chiusura per la
      // data di un documento sarebbe la sala bloccata davanti a lui, che è
      // proprio ciò che questo blocco evita. Lo scarto, se nasce, si vede
      // in Cassa fra i conti fiscalizzati in ritardo.
      const serata = await serataCorrente().catch(() => null);
      await fiscalizzaConto(order, { serata });
    }
    onDone();
  };

  // ⚠️ FINCHE' NON HA SCELTO, NON SI PAGA. E' il modo in cui la proposta
  // diventa impossibile da saltare senza accorgersene: non un colore, ma i
  // pulsanti spenti. Se la caparra non c'e' o non si puo' scalare, questo
  // vale falso e la sala non si accorge di niente.
  const aspettaCaparra =
    nonLetto(caparra) || (Boolean(caparra?.si_puo_scalare) && sceltaCaparra === null);
  const scalando =
    !nonLetto(caparra) && Boolean(caparra?.si_puo_scalare) && sceltaCaparra === true;

  const handlePaid = (method) =>
    run(() => closeOrderPaid(order.id, method, copertoUnitPrice, null, scalando));

  // --- Pagano in due modi (Blocco 9, deciso da Alessio) ---------------
  //
  // ⚠️ La forma segue come si paga DAVVERO in sala, che gliel'ho chiesto
  // prima di disegnare: «una sola [passata sul POS] per la sua parte».
  // Quindi si registrano le QUOTE — quanto con la carta, quanto in
  // contanti — e non un giro di carta-per-tutto-e-resto-in-contanti, che
  // sarebbe un'uscita di cassa mai avvenuta.
  //
  // La proposta iniziale è la divisione equa fra due, sua indicazione: il
  // caso normale è due persone che si dividono il conto.
  const apriMisto = () => {
    const meta = Math.round((total / 2) * 100) / 100;
    setQuotaCarta(String(meta));
    setMode("misto");
  };

  const quotaContante = Math.round((total - (Number(quotaCarta) || 0)) * 100) / 100;
  const mistoValido = Number(quotaCarta) > 0 && quotaContante > 0;

  const handleMisto = () =>
    run(() =>
      closeOrderPaid(order.id, null, copertoUnitPrice, [
        { mezzo: "carta", importo: Number(quotaCarta) },
        { mezzo: "contante", importo: quotaContante },
      ])
    );

  // --- Alla romana ---
  const esattoATesta = persone > 0 ? total / persone : 0;
  const totaleRomana = Math.round((Number(aTesta) || 0) * persone * 100) / 100;
  const cortesia = Math.round((total - totaleRomana) * 100) / 100;

  const apriRomana = () => {
    const n = coperti > 0 ? coperti : 2;
    setPersone(n);
    // Proposta iniziale: la cifra tonda per difetto ("far pagare 12 a
    // testa facilmente"). L'esatto resta a un tocco.
    setATesta(String(Math.floor(total / n)));
    setMode("romana");
  };

  const cambiaPersone = (n) => {
    const p = Math.max(1, Number(n) || 1);
    setPersone(p);
    setATesta(String(Math.floor(total / p)));
  };

  const handleRomana = (method) => {
    if (totaleRomana <= 0 || totaleRomana > total) return;
    // Con una cortesia in ballo la causale e obbligatoria: e uno sconto.
    if (cortesia > 0 && !form.causaleId) return;
    if (cortesia === 0) {
      // Cifra esatta: è un pagamento normale.
      run(() => closeOrderPaid(order.id, method, copertoUnitPrice));
    } else {
      // Arrotondato per difetto: la differenza è una cortesia, registrata
      // come sconto — passa dal corridoio e dalla funzione atomica.
      run(() =>
        closeOrderAsDiscountGift(order.id, {
          isGift: false,
          fullAmount: total,
          collectedAmount: totaleRomana,
          causaleId: form.causaleId,
          causaleNote: `Alla romana: ${persone} × ${formatEUR(Number(aTesta) || 0)}`,
        })
      );
    }
  };

  const handleCancel = () => {
    if (!form.cancelReason.trim()) return;
    // Un conto annullato non incassa: niente scontrino.
    run(() => cancelOrder(order.id, form.cancelReason.trim()), { fiscalizza: false });
  };

  const handleDiscountGift = () => {
    const isGift = mode === "omaggio";
    if (!isGift && !form.collectedAmount) return;
    if (!form.causaleId) return;
    run(() =>
      closeOrderAsDiscountGift(order.id, {
        isGift,
        fullAmount: total,
        collectedAmount: form.collectedAmount,
        causaleId: form.causaleId || null,
        note: form.note || null,
      })
    );
  };

  return (
    <div className="fixed inset-0 bg-b58-charcoal/50 flex items-center justify-center p-4 z-50">
      {/* 🔴 LA FINESTRA PRENDE QUASI TUTTO LO SCHERMO (22/08, da un rilievo
          di Alessio in scala reale). Era `max-w-sm` — 384 punti, meno di
          metà di un tablet da 8 pollici — e con le scritte portate a 3,20 mm
          le etichette non ci stavano più: «Omaggio» tagliato, «Pagano in due
          modi» su quattro righe.
          ⚠️ Ingrandire le scritte dentro un contenitore che non cresce è la
          stessa forma del difetto della pianta di stamattina: **una misura
          fissa dentro qualcosa che deve adattarsi**.
          ⚠️ E la larghezza non è una questione di gusto: *è il momento in
          cui si incassa*. Non c'è niente di più importante da vedere in quel
          momento, e non c'è ragione perché stia in un quarto di schermo. */}
      <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden">
        <div className="bg-b58-charcoal text-b58-parchment px-4 py-3 flex items-center justify-between">
          <span className="font-display testo-sala-grande">Chiusura conto — {order.table_label}</span>
          <button type="button" onClick={onClose} className="tocco-bottone text-b58-parchment/80 hover:text-b58-parchment testo-sala-grande leading-none">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
          {error && (
            <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="font-mono testo-sala bg-b58-cream-dark/40 border border-dashed border-b58-charcoal/20 rounded-lg p-3">
            {grouped.length === 0 ? (
              <p className="text-b58-charcoal-soft">Nessuna riga sul conto.</p>
            ) : (
              grouped.map((g) => (
                <div key={g.name} className="flex justify-between py-0.5">
                  <span>{g.quantity}× {g.name}</span>
                  <span>{formatEUR(g.total)}</span>
                </div>
              ))
            )}
            {coperti > 0 && (
              <div className="flex justify-between py-0.5">
                <span>{coperti}× Coperto ({formatEUR(copertoUnitPrice)})</span>
                <span>{formatEUR(copertoTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-b58-charcoal/30 mt-1.5 pt-1.5 font-bold">
              <span>TOTALE</span>
              <span>{formatEUR(total)}</span>
            </div>
          </div>

          {/* ⚠️ Il buco si dichiara, non si lascia dedurre dal totale: una
              riga che sparisce dal conto senza una frase è indistinguibile
              da un piatto dimenticato. Non è un errore — è una scelta che
              deve passare sotto i suoi occhi prima di incassare. */}
          {nonInviate.length > 0 && (
            <div className="testo-sala bg-b58-gold/15 ring-1 ring-b58-gold-dark/30 rounded-lg px-3 py-2">
              <p className="text-b58-charcoal font-medium">
                {nonInviate.length === 1
                  ? "1 riga non è mai stata mandata in cucina"
                  : `${nonInviate.length} righe non sono mai state mandate in cucina`}
                {" "}({formatEUR(nonInviateTotal)})
              </p>
              <p className="text-b58-charcoal-soft mt-0.5">
                Non entrano nel conto e non scaricano il magazzino. Se sono state
                servite lo stesso, chiudi questa finestra e mandale prima.
              </p>
              <ul className="mt-1 text-b58-charcoal-soft">
                {nonInviate.map((i) => (
                  <li key={i.id}>· {i.quantity}× {nomeSulConto(i)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 🔴 LA CAPARRA NON SI SCALA DA SÉ, E NON SI PUÒ NEMMENO NON
              VEDERE. Decisione di Alessio del 26/08: si propone e conferma
              lui. Qui la proposta non è un avviso colorato che si salta
              premendo il pulsante accanto — finché non ha scelto, **i
              pulsanti di pagamento sono spenti**. Sono soldi che il cliente
              ha già dato: dimenticarli glieli fa pagare due volte, e
              scalarli senza dirlo toglie a lui la decisione. */}
          {nonLetto(caparra) && (
            <div className="testo-sala bg-b58-terracotta/15 ring-2 ring-b58-terracotta-dark/40 rounded-lg px-3 py-2">
              <p className="text-b58-charcoal font-medium testo-sala-grande">
                Non sono riuscito a controllare se questo cliente ha versato una caparra.
              </p>
              <p className="text-b58-charcoal-soft mt-0.5">
                Non vuol dire che non ce ne sia una. Riprova prima di incassare:
                chiudere adesso potrebbe fargli pagare due volte.
              </p>
              <button type="button" onClick={ricaricaCaparra} className="tocco-bottone mt-2 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala font-medium px-4">
                Riprova
              </button>
            </div>
          )}

          {caparra && !nonLetto(caparra) && (
            <div className="testo-sala bg-b58-terracotta/15 ring-2 ring-b58-terracotta-dark/40 rounded-lg px-3 py-2">
              <p className="text-b58-charcoal font-medium testo-sala-grande">{caparra.frase}</p>
              {caparra.si_puo_scalare && sceltaCaparra === null && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setSceltaCaparra(true)}
                    className="tocco-bottone flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment testo-sala font-medium px-3"
                  >
                    Scala la caparra
                  </button>
                  <button
                    type="button"
                    onClick={() => setSceltaCaparra(false)}
                    className="tocco-bottone flex-1 rounded-lg border border-b58-charcoal/25 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3"
                  >
                    Non scalarla
                  </button>
                </div>
              )}
              {caparra.si_puo_scalare && sceltaCaparra !== null && (
                <p className="text-b58-charcoal-soft mt-1">
                  {sceltaCaparra
                    ? `La caparra viene scalata: da incassare ${formatEUR(Number(caparra.incasso) - Number(caparra.importo))}.`
                    : "La caparra NON viene scalata: il cliente paga il conto intero."}{" "}
                  <button
                    type="button"
                    onClick={() => setSceltaCaparra(null)}
                    className="underline text-b58-terracotta-dark"
                  >
                    cambia
                  </button>
                </p>
              )}
            </div>
          )}

          {mode === null && (
            <>
              {scalando && (
                <p className="testo-sala text-b58-charcoal-soft">
                  Con la caparra scalata il conto si chiude con un mezzo di pagamento
                  solo. Per dividerlo, scegli prima «Non scalarla».
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {ORDER_PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    disabled={busy || aspettaCaparra}
                    onClick={() => handlePaid(pm.value)}
                    className="tocco-bottone flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala font-medium px-3"
                  >
                    Paga {pm.label.toLowerCase()}
                  </button>
                ))}
              </div>
              {/* ⚠️ DUE RIGHE DA DUE, non quattro stretti (22/08). Anche
                  con la finestra larga, «Pagano in due modi» a 3,20 mm non
                  sta in un quarto di riga. *Un'etichetta tagliata su un
                  pulsante che tocca i soldi è peggio di un pulsante in più
                  in verticale.* */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={aspettaCaparra || scalando} onClick={apriMisto} className="tocco-bottone flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal testo-sala font-medium px-3">
                  Pagano in due modi
                </button>
                <button type="button" disabled={aspettaCaparra || scalando} onClick={apriRomana} className="tocco-bottone flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal testo-sala font-medium px-3">
                  Alla romana
                </button>
                <button type="button" onClick={() => setMode("sconto")} className="tocco-bottone flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3">
                  Sconto
                </button>
                <button type="button" onClick={() => setMode("omaggio")} className="tocco-bottone flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-3">
                  Omaggio
                </button>
              </div>
              <button type="button" onClick={() => setMode("annulla")} className="tocco-bottone w-full testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark">
                Annulla tavolo
              </button>
              {/* 🔴 QUI C'ERA: «Nessun incasso viene registrato in cassa:
                  l'integrazione con il registratore telematico
                  arriverà con l'hardware.»

                  Non è stata tolta perché era una didascalia: **è stata
                  tolta perché non è più vera**. Dal 15/08 il saldo di cassa
                  legge gli incassi in contante DAI CONTI CHIUSI
                  (`saldo_tesoreria`: `contante_atteso` = prima nota + sala +
                  mance), e la schermata Cassa li mostra scomposti — «+ X di
                  sala (N conti)». Quei soldi nel cassetto teorico **ci
                  sono**.

                  ⚠️ Quello che resta vero è un'altra cosa e molto più
                  stretta: non nasce un MOVIMENTO di prima nota. Ma chi legge
                  «nessun incasso viene registrato in cassa» capisce che quei
                  soldi non compaiono da nessuna parte — ed è il contrario di
                  come stanno le cose. *Una frase che era giusta quando è
                  stata scritta e che nessuno ha riletto quando il gestionale
                  è cambiato sotto.*

                  ⚠️ E non è sostituita da una versione «scritta come
                  avviso»: al momento di incassare non c'è niente da
                  avvertire. Dove il limite esiste davvero — la composizione
                  del cassetto teorico — è già scritto, sotto il saldo in
                  Cassa. */}
            </>
          )}

          {mode === "misto" && (
            <div className="space-y-3">
              <h3 className="testo-sala font-medium text-b58-charcoal">
                Pagano in due modi — {formatEUR(total)} in tutto
              </h3>
              <p className="testo-sala text-b58-charcoal-soft">
                Scrivi quanto passi sul POS: il resto è contante. Batti sul POS{" "}
                <strong>solo quella cifra</strong>, non il totale.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block testo-sala text-b58-charcoal-soft mb-1">Con la carta</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quotaCarta}
                    onChange={(e) => setQuotaCarta(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <div className="testo-sala text-b58-charcoal-soft mb-1">In contanti</div>
                  <div className="testo-sala-grande font-medium text-b58-charcoal py-1.5">
                    {formatEUR(quotaContante)}
                  </div>
                </div>
              </div>
              {/* ⚠️ Il rifiuto vero è nel database: le quote devono fare
                  l'incassato al centesimo. Qui si evita solo di premere. */}
              {!mistoValido && (
                <p className="testo-sala text-b58-terracotta-dark">
                  Le due parti devono essere tutt'e due maggiori di zero. Se paga tutto in un
                  modo solo, torna indietro e usa «Paga contante» o «Paga carta».
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !mistoValido}
                  onClick={handleMisto}
                  className="tocco-bottone flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala font-medium px-3"
                >
                  {busy ? "Chiudo…" : "Chiudi il conto"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="tocco-bottone rounded-lg border border-b58-charcoal/15 text-b58-charcoal testo-sala px-4"
                >
                  Indietro
                </button>
              </div>
            </div>
          )}

          {mode === "romana" && (
            <div className="space-y-3">
              <h3 className="testo-sala font-medium text-b58-charcoal">
                Alla romana — {formatEUR(total)} da dividere
              </h3>

              <div className="flex items-center gap-2">
                <span className="testo-sala text-b58-charcoal-soft w-20">Persone</span>
                <button type="button" onClick={() => cambiaPersone(persone - 1)} className="tocco-bottone rounded-lg border border-b58-charcoal/15 text-b58-charcoal">−</button>
                <b className="tocco-bottone w-8 text-center">{persone}</b>
                <button type="button" onClick={() => cambiaPersone(persone + 1)} className="tocco-bottone rounded-lg border border-b58-charcoal/15 text-b58-charcoal">+</button>
              </div>

              <div className="flex items-center gap-2">
                <span className="testo-sala text-b58-charcoal-soft w-20">A testa</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={aTesta}
                  onChange={(e) => setATesta(e.target.value)}
                  className={`${inputClass} w-24 text-right`}
                />
                <button
                  type="button"
                  onClick={() => setATesta(String(Math.floor(esattoATesta)))}
                  className="tocco-bottone testo-sala rounded-full px-3  border border-b58-charcoal/15 text-b58-charcoal-soft"
                >
                  Tondo {Math.floor(esattoATesta)}
                </button>
                <button
                  type="button"
                  onClick={() => setATesta(String(Math.round(esattoATesta * 100) / 100))}
                  className="tocco-bottone testo-sala rounded-full px-3  border border-b58-charcoal/15 text-b58-charcoal-soft"
                >
                  Esatto {formatEUR(esattoATesta)}
                </button>
              </div>

              <div className="font-mono testo-sala bg-b58-cream-dark/40 border border-dashed border-b58-charcoal/20 rounded-lg p-3">
                <div className="flex justify-between py-0.5">
                  <span>{persone} × {formatEUR(Number(aTesta) || 0)}</span>
                  <span>{formatEUR(totaleRomana)}</span>
                </div>
                {cortesia > 0 && (
                  <div className="flex justify-between py-0.5 text-b58-olive-dark">
                    <span>Cortesia (registrata come sconto)</span>
                    <span>−{formatEUR(cortesia)}</span>
                  </div>
                )}
                {cortesia < 0 && (
                  <div className="py-0.5 text-b58-terracotta-dark">
                    Supera il conto di {formatEUR(-cortesia)}: gli spicci in più sono
                    mance, si registrano nella sezione Mance — non qui.
                  </div>
                )}
              </div>

              {/* ⚠️ LA CAUSALE SERVE ANCHE QUI, e prima non c'era.
                  L'arrotondamento per difetto si chiude come SCONTO, e dal
                  14/08 uno sconto senza causale il database lo rifiuta.
                  Senza questo campo il gesto più frequente dei tre si
                  sarebbe rotto al primo tentativo, in sala, con un cliente
                  che aspetta. Compare solo quando una cortesia c'è
                  davvero: se la cifra è esatta è un pagamento normale e
                  non si registra nessuno sconto. */}
              {cortesia > 0 && (
                <div>
                  <select
                    value={form.causaleId}
                    onChange={(e) => setForm((f) => ({ ...f, causaleId: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Perché la cortesia? —</option>
                    {causali.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  {!form.causaleId && (
                    <p className="testo-sala text-b58-charcoal-soft/80 mt-1">
                      Serve per chiudere: {formatEUR(cortesia)} regalati senza un perché, fra un
                      anno, sono un numero che nessuno sa spiegare.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {ORDER_PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    disabled={busy || totaleRomana <= 0 || totaleRomana > total || (cortesia > 0 && !form.causaleId)}
                    onClick={() => handleRomana(pm.value)}
                    className="tocco-bottone flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-50 transition-colors text-b58-parchment testo-sala font-medium px-3"
                  >
                    Chiudi a {formatEUR(totaleRomana)} — {pm.label.toLowerCase()}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setMode(null)} className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
                Indietro
              </button>
            </div>
          )}

          {(mode === "sconto" || mode === "omaggio") && (
            <div className="space-y-2">
              <h3 className="testo-sala font-medium text-b58-charcoal">
                {labelFor(DISCOUNT_GIFT_TYPES, mode)} — {formatEUR(total)} a listino
              </h3>
              {mode === "sconto" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={total}
                  value={form.collectedAmount}
                  onChange={(e) => setForm((f) => ({ ...f, collectedAmount: e.target.value }))}
                  placeholder="Importo effettivamente incassato €"
                  className={inputClass}
                />
              )}
              <select
                value={form.causaleId}
                onChange={(e) => setForm((f) => ({ ...f, causaleId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Perché? — obbligatorio</option>
                {causali.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {/* 🔴 «DEVICE» E «CLIENTE» SONO STATI TOLTI (Alessio, 23/08).
                  Erano due caselle facoltative in mezzo al gesto più
                  delicato della sala — chiudere un conto senza incassare —
                  e chiedevano al cameriere due cose che in quel momento non
                  sa e non deve decidere.
                  ⚠️ «Perché?» resta, e resta obbligatorio: un omaggio ha
                  sempre una ragione, ed è da lì che si legge il budget
                  degli omaggi.
                  ⚠️ Le due colonne del database NON sono state toccate:
                  `discounts_gifts.device_id` e `customer_id` esistono
                  ancora e restano compilabili dal registro in Cassa. Qui
                  arrivano vuote — che è quello che succedeva già ogni volta
                  che nessuno le sceglieva.
                  ⚠️ E il cliente da oggi ha un posto migliore: si attacca
                  al TAVOLO quando si apre il conto, non all'omaggio quando
                  lo si chiude. */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !form.causaleId || (mode === "sconto" && !form.collectedAmount)}
                  onClick={handleDiscountGift}
                  className="tocco-bottone rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala font-medium px-4"
                >
                  Conferma
                </button>
                <button type="button" onClick={() => setMode(null)} className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
                  Indietro
                </button>
              </div>
            </div>
          )}

          {mode === "annulla" && (
            <div className="space-y-2">
              <input
                value={form.cancelReason}
                onChange={(e) => setForm((f) => ({ ...f, cancelReason: e.target.value }))}
                placeholder="Motivo dell'annullamento (obbligatorio)"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !form.cancelReason.trim()}
                  onClick={handleCancel}
                  className="tocco-bottone rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala font-medium px-4"
                >
                  Conferma annullamento
                </button>
                <button type="button" onClick={() => setMode(null)} className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
                  Indietro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
