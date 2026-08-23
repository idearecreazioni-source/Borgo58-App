// IL RIQUADRO ACCANTO AL TAVOLO — 23/08/2026, correzione chiesta da Alessio.
//
// 🔴 IL VINCOLO E' UNA MISURA, non un gusto: quel riquadro vive dentro la
// pianta, nello spazio del bancone, e la sua taglia la decide la stanza —
// **53,8 × 25,1 mm** sul mini tablet da 8 pollici. Mettendoci dentro anche
// i campi per registrare un cliente, il contenuto chiedeva 222 punti su 161
// disponibili: **scorreva**.
//
// La regola di Alessio: *«fai stare il contenuto senza scorrimento: pagante,
// orario e coperti visibili subito, il resto si apre al tocco»*. Quindi qui
// dentro sta solo cio' che si legge a colpo d'occhio mentre si serve, e
// tutto cio' che si SCRIVE sta altrove.
//
// ⚠️ E «altrove» e' un pannello che copre la schermata, non un'espansione
// qui dentro: espandere in un riquadro da 25 mm rimetterebbe lo scorrimento
// dal quale si sta scappando. E' la stessa forma della finestra di chiusura
// conto — quando serve scrivere, si prende spazio.
//
// ⚠️ IL TOCCO INTERO E' IL BERSAGLIO: al tavolo si tiene il tablet con due
// mani, e un bersaglio piccolo dentro un riquadro piccolo non si prende.
//
// ⚠️ E PIU' DI UNA PRENOTAZIONE NON SFONDA IL RIQUADRO: un tavolo con due
// turni ne ha due, e stamparle tutte tornerebbe a far scorrere. Se ne mostra
// una e si dice quante altre ce ne sono — il resto e' nel pannello.
export default function RiquadroDelTavolo({ prenotazioni = [], order, onApri }) {
  const cliente = order?.cliente ?? null;
  const prima = prenotazioni[0] ?? null;
  const altre = Math.max(0, prenotazioni.length - 1);

  if (!prima && !order) return null;

  return (
    <button
      type="button"
      onClick={onApri}
      disabled={!order}
      className="h-full w-full overflow-hidden p-1.5 text-left disabled:cursor-default"
    >
      {prima && (
        <>
          <p className="testo-sala text-b58-charcoal-soft leading-none">
            {prima.ora?.slice(0, 5)}
            {prima.persone ? ` · ${prima.persone}` : ""}
            {altre > 0 ? ` · +${altre}` : ""}
          </p>
          <p className="testo-sala-grande truncate font-semibold text-b58-charcoal leading-tight">
            {prima.nome}
          </p>
        </>
      )}

      {order && (
        <div className={prima ? "mt-1 border-t border-b58-charcoal/10 pt-1" : ""}>
          {cliente ? (
            <>
              <p className="testo-sala text-b58-charcoal-soft leading-none">Paga</p>
              <p className="testo-sala-grande truncate font-semibold text-b58-charcoal leading-tight">
                {cliente.name || cliente.phone || "senza nome"}
              </p>
            </>
          ) : (
            // ⚠️ Non e' un riquadro vuoto: e' un invito. «Chi paga?» dice
            // insieme che il dato manca e che si prende toccando qui.
            <p className="testo-sala-grande font-semibold text-b58-terracotta-dark leading-tight">
              Chi paga? →
            </p>
          )}
        </div>
      )}
    </button>
  );
}
