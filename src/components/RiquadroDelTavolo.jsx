// IL RIQUADRO ACCANTO AL TAVOLO — 23/08/2026, correzione chiesta da Alessio.
//
// 🔴 IL VINCOLO E' UNA MISURA, non un gusto: quel riquadro vive dentro la
// pianta, nello spazio del bancone, e la sua taglia la decide la stanza.
// Sul mini tablet da 8 pollici e' **205 × 95 punti**, cioe' 32 × 15 mm
// veri. Non si puo' allargare senza disegnare un bancone che non esiste.
//
// La regola di Alessio: *«fai stare il contenuto senza scorrimento:
// pagante, orario e coperti visibili subito, il resto si apre al tocco»*.
//
// ---------------------------------------------------------------------
// 🔴 IL 24/08 IL RILIEVO E' TORNATO, ed era giusto: «resta piccolo e
// illeggibile». Rimisurato ALLA CALIBRAZIONE DEL TABLET (--pxcm 64,
// pianta 409 punti) invece che a quella del monitor:
//
//   · il contenuto chiedeva **111 punti su 84**: SCORREVA GIA', col nome
//     ancora alla taglia normale. La correzione del 23/08 aveva tolto lo
//     scorrimento a 37,8 punti per centimetro — la stima da monitor — e
//     sul tablet vero il difetto era rimasto intero. E' la trappola del
//     21/08: i due effetti vanno nella stessa direzione, quindi non si
//     vedono;
//   · **il bordo interno costava 24 punti sugli 84**, quasi un terzo
//     dello spazio speso in aria. Sul monitor erano 12 su 179.
//
// ⚠️ E INGRANDIRE IL NOME NON SI PUO', misurato e non dedotto: un nome di
// 16 lettere chiede **213 punti a 4 mm** e **331 a 6,2 mm**, e la riga ne
// ha 205. Portandolo a 6,2 il nome si troncava a «Ales…», che e' peggio
// di piccolo — un nome troncato non serve a niente. La taglia che fa
// stare **nove nomi su dieci** (il novantesimo percentile dei nomi veri e'
// 15 lettere, misurato sul database) e' quella normale, 4 mm.
//
// 🔴 E CI STA UN NOME SOLO. Col pagante scritto, due nomi leggibili
// chiedono 112 punti su 95: scorrono a qualunque taglia, anche mandando
// il nome a capo. Quindi se ne mostra uno — **quello che serve adesso**:
//   · finche' c'e' solo la prenotazione, e' il suo nome: il cliente
//     arriva e dice «ho prenotato a nome tale»;
//   · appena si registra chi paga, e' quello: il pagante si scrive verso
//     la chiusura, ed e' la cosa che Alessio ha nominato per prima nella
//     sua regola.
// ⚠️ E il nome che esce non si perde: sta nel pannello del tavolo, dove
// si legge grande.
//
// ⚠️ IL TOCCO INTERO E' IL BERSAGLIO: al tavolo si tiene il tablet con due
// mani, e un bersaglio piccolo dentro un riquadro piccolo non si prende.
//
// ⚠️ E PIU' DI UNA PRENOTAZIONE NON SFONDA IL RIQUADRO: un tavolo con due
// turni ne ha due, e stamparle tutte tornerebbe a far scorrere. Se ne
// mostra una e si dice quante altre ce ne sono — il resto e' nel pannello.
export default function RiquadroDelTavolo({ prenotazioni = [], order, onApri }) {
  const cliente = order?.cliente ?? null;
  const prima = prenotazioni[0] ?? null;
  const altre = Math.max(0, prenotazioni.length - 1);

  if (!prima && !order) return null;

  // Il nome che si vede, e da dove viene. ⚠️ Uno solo: la misura dice che
  // due non ci stanno leggibili, e il secondo è nel pannello.
  const nomePagante = cliente ? cliente.name || cliente.phone || "senza nome" : null;
  const nome = nomePagante ?? prima?.nome ?? null;
  const etichetta = nomePagante ? "paga" : null;

  return (
    <button
      type="button"
      onClick={onApri}
      disabled={!order}
      // ⚠️ IL BORDO INTERNO E' 0,5 INVECE DI 1,5: alla calibrazione del
      // tablet quel margine costava 24 punti sugli 84 che il riquadro ha
      // in tutto. Sul monitor erano 12 su 179 e non si notavano.
      className="h-full w-full overflow-hidden p-0.5 text-left disabled:cursor-default"
    >
      {/* Orario, coperti e quante altre prenotazioni ci sono: piccoli e
          sopra. Servono dopo il nome, e ingrandirli riporterebbe lo
          scorrimento. */}
      {prima && (
        // ⚠️ TRONCA, non va a capo: con «prenotato da …» dentro, questa
        //    riga si spezzava in tre e il riquadro tornava a scorrere —
        //    164 punti sui 95 che ha. Misurato.
        <p className="testo-sala truncate text-b58-charcoal-soft leading-none">
          {prima.ora?.slice(0, 5)}
          {prima.persone ? ` · ${prima.persone}` : ""}
          {altre > 0 ? ` · +${altre}` : ""}
          {etichetta ? ` · prenotato da ${prima.nome}` : ""}
        </p>
      )}

      {/* Il nome, sulla riga intera: 205 punti invece dei 159 che
          restavano mettendogli l'orario accanto. Sono 46 punti, cioè tre
          lettere in più — e con nomi da 12-16 lettere sono la differenza
          fra leggerlo e no. */}
      {nome && (
        <p className="testo-sala-grande truncate font-semibold text-b58-charcoal leading-tight">
          {nome}
        </p>
      )}

      {etichetta && (
        <p className="testo-sala text-b58-charcoal-soft leading-none">{etichetta}</p>
      )}

      {/* ⚠️ Non è un riquadro vuoto: è un invito. «Chi paga?» dice insieme
          che il dato manca e che si prende toccando qui. */}
      {order && !cliente && (
        <p className="testo-sala-grande font-semibold text-b58-terracotta-dark leading-tight">
          Chi paga? →
        </p>
      )}
    </button>
  );
}
