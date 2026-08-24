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
// 🔴 IL 24/08 IL RILIEVO E' TORNATO UNA TERZA VOLTA, e stavolta la misura
// ha detto che il vincolo scritto qui sopra ERA DIVENTATO FALSO.
//
// La riga qui sotto diceva: *«un nome di 16 lettere chiede 331 punti a 6,2
// mm e la riga ne ha 205, quindi si troncherebbe a "Ales…"»*. Quei 205
// erano veri quando la pianta era larga 409 punti. Rimisurato nel browser
// vero, sul tablet in verticale (768 punti di schermo, calibrazione 64):
// **la pianta e' larga 689 punti e la riga del riquadro 344**.
//
// ⚠️ Quindi il vincolo che teneva il nome a 4 mm non esiste piu' — ed era
// rimasto scritto, con la sua misura, molto dopo la sua scadenza. E' la
// famiglia delle frasi diventate false, con l'aggravante che questa
// **impediva la correzione** invece di limitarsi a raccontarla male.
//
// LE MISURE DI ADESSO, prese nel browser e non stimate, su un nome di 16
// lettere (il novantesimo percentile dei 263 nomi veri del database):
//   4,0 mm → 214 punti      5,5 mm → 294 punti
//   5,0 mm → 267 punti      6,0 mm → **320 punti**      6,2 mm → 331
// La riga ne ha 344: a 6 mm restano 24 punti di margine, a 6,2 ne restano
// 13 — che su un nome di 17 lettere non bastano. Si prende **6 mm**.
//
// ⚠️ E LA REGOLA GENERALE, che Alessio ha scritto insieme al rilievo:
// *3,20 mm e' il MINIMO ACCETTABILE, non l'obiettivo.* Un testo importante
// appena sopra la soglia resta illeggibile a colpo d'occhio, e questo
// riquadro lo si legge **in piedi, da lontano, durante il servizio**.
//
// ⚠️ E IL RIQUADRO ADESSO E' PIU' ALTO: cresce nello spazio vuoto della
// pianta fin dove puo' (`pannelloAllargato` in lib/calcoli/sala.js).
// Misurato: 160 punti diventano 238 quando sotto non c'e' nessun tavolo.
// Non e' un numero fisso — se Alessio sposta un tavolo li' sotto, il
// riquadro si ritira invece di coprirlo.
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
      {/* Orario, coperti e quante altre prenotazioni ci sono: sopra il
          nome, perche' servono dopo di lui.
          ⚠️ DA 3,2 A 4 mm il 24/08: la riga stava al MINIMO ACCETTABILE, e
          il minimo non e' l'obiettivo. Ci sta perche' il riquadro adesso
          cresce nello spazio vuoto della pianta — con i 160 punti di prima
          questa riga non si poteva toccare. */}
      {prima && (
        // 🔴 L'ORA E I COPERTI SU UNA RIGA LORO (24/08). Prima ci stava
        //    infilato anche «prenotato da …», e misurando col nome del
        //    pagante scritto quella riga **si troncava**: si leggeva
        //    «20:41 · 2 · prenotato d…», cioè si perdeva proprio il nome
        //    per cui la frase esisteva.
        //    ⚠️ La ragione per cui prima stavano insieme era lo spazio — 95
        //    punti d'altezza in tutto. Adesso il riquadro cresce nel vuoto
        //    della pianta e ne ha 241: la riga si può separare invece di
        //    tagliarla. *Il vincolo è caduto, non la regola.*
        <p className="testo-sala-grande truncate text-b58-charcoal-soft leading-none">
          {prima.ora?.slice(0, 5)}
          {prima.persone ? ` · ${prima.persone}` : ""}
          {altre > 0 ? ` · +${altre}` : ""}
        </p>
      )}

      {/* Il nome, sulla riga intera: 205 punti invece dei 159 che
          restavano mettendogli l'orario accanto. Sono 46 punti, cioè tre
          lettere in più — e con nomi da 12-16 lettere sono la differenza
          fra leggerlo e no. */}
      {nome && (
        <p className="testo-sala-lontano truncate font-semibold text-b58-charcoal">
          {nome}
        </p>
      )}

      {etichetta && (
        <p className="testo-sala-grande text-b58-charcoal-soft leading-none">{etichetta}</p>
      )}

      {/* CHI AVEVA PRENOTATO, quando è una persona diversa da chi paga.
          ⚠️ Su una riga sua e sotto, perché è la meno urgente delle tre: chi
          paga si legge grande sopra, questa serve solo a ricollegare il
          tavolo alla prenotazione. Tronca se il nome è lunghissimo — ma
          tronca UN nome secondario, non quello per cui si guarda. */}
      {etichetta && prima?.nome && prima.nome !== nome && (
        <p className="testo-sala-grande truncate text-b58-charcoal-soft/80 leading-none">
          prenotato da {prima.nome}
        </p>
      )}

      {/* ⚠️ Non è un riquadro vuoto: è un invito. «Chi paga?» dice insieme
          che il dato manca e che si prende toccando qui. */}
      {order && !cliente && (
        <p className="testo-sala-lontano font-semibold text-b58-terracotta-dark">
          Chi paga? →
        </p>
      )}
    </button>
  );
}
