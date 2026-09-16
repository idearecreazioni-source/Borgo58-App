import {
  etichettaSettimana,
  giorniDellaSettimana,
  impegniDellaSettimana,
  lunediDi,
  nomeDelGiorno,
  oraBreve,
} from "../../lib/calcoli/settimana";

// =====================================================================
// LA SETTIMANA DELL'AGENDA — 11/09/2026, mandato notturno
// =====================================================================
// 🔴 UNA VISTA, NON UN MODULO: legge gli stessi impegni del mese e non ne
//    cambia nessuno. Qui non si spunta, non si rimanda, non si stella: si
//    guarda la settimana e si tocca un impegno per aprirne la scheda, che è
//    dove quelle cose si fanno già.
//
// ⚠️ SUL TELEFONO I GIORNI SONO RIGHE, UNA SOTTO L'ALTRA, e non sette
//    colonne: sette colonne in 390 punti sarebbero una griglia microscopica.
//    Il nome del giorno sta SOPRA i suoi impegni e non accanto: accanto,
//    a 64 punti per centimetro, al titolo restavano ~160 punti e una parola
//    come «commercialista» si spezzava a metà. Un giorno vuoto resta su una
//    riga sola — «Mar 8 niente» — e non prende lo spazio di uno pieno.
//
// ⚠️ LE SETTE COLONNE LE DECIDE LA LARGHEZZA DEL RIQUADRO, NON QUELLA DELLO
//    SCHERMO (`@container` + `@5xl:`, cioè 64rem = 1024 punti dentro il
//    riquadro): la stessa finestra da 1280 punti è larga o stretta a seconda
//    che la barra laterale ci sia. Sotto la soglia la settimana resta a
//    righe; sopra, ogni colonna ha almeno ~140 punti.
//
// ⚠️ IL TITOLO DI UN IMPEGNO HA LA STESSA MISURA DELL'ELENCO (decisione
//    dell'11/09 sul giorno del calendario: lo stesso impegno non cambia
//    faccia passando da una vista all'altra). Accanto, soltanto l'ora — e
//    niente priorità, tipo, provenienza o «Riservato»: la domanda di questa
//    vista è «cosa c'è in settimana», e il resto sta nella scheda.
//
// 🔴 SUL COMPUTER UN IMPEGNO RESTA UNA RIGA SOLA — 16/09/2026, richiesta di
//    Alessio. Nelle sette colonne l'ora stava SOPRA il titolo: due righe per
//    ogni impegno, cioè un cartellino verticale, e una settimana piena
//    diventava una parete di cartellini. Adesso è `09:30 · Titolo`, come si
//    legge un'agenda.
//    ⚠️ L'ORA RESTA IN UNA COLONNINA DI LARGHEZZA FISSA, vuota quando
//       l'impegno non ha un'ora, ed è la ragione per cui non si mette
//       semplicemente il testo in fila: i titoli di uno stesso giorno devono
//       partire tutti dallo stesso punto (lo misura `prova-visiva.mjs`), e
//       «Dentista» sotto «09:00 · Riunione» partirebbe più a sinistra.
//       Il puntino separatore sta DENTRO quella colonnina, così compare solo
//       dove c'è un'ora e non sposta di un punto i titoli degli altri.
//    ⚠️ E la colonnina del computer è più stretta di quella del telefono
//       (2,9em contro 3,2em): in una colonna da ~170 punti ogni punto tolto
//       all'ora è un punto in più per il titolo, che è quello che si legge.
export default function SettimanaAgenda({
  lunedi,
  oggiISO,
  impegni,
  caricando,
  errore,
  onRiprova,
  onPrima,
  onDopo,
  onQuesta,
  onApri,
}) {
  const giorni = impegniDellaSettimana(impegni, giorniDellaSettimana(lunedi));
  const eQuesta = lunedi === lunediDi(oggiISO);

  return (
    <div
      data-settimana
      {...(caricando ? { "data-caricando": "" } : {})}
      className="@container rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3 md:p-4"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          data-settimana-prima
          onClick={onPrima}
          aria-label="Settimana precedente"
          className="tocco-bottone shrink-0 rounded-lg px-2 text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          ←
        </button>
        <div className="min-w-0 text-center">
          <h3 data-titolo-settimana className="font-display testo-sala-grande text-b58-charcoal">
            {etichettaSettimana(lunedi)}
          </h3>
          {/* ⚠️ Il ritorno c'è solo quando serve: sulla settimana di oggi
              un «torna a questa settimana» è un pulsante che non fa niente. */}
          {!eQuesta && (
            <button
              type="button"
              data-settimana-questa
              onClick={onQuesta}
              className="tocco-testo testo-sala font-medium text-b58-terracotta hover:text-b58-terracotta-dark"
            >
              Torna a questa settimana
            </button>
          )}
        </div>
        <button
          type="button"
          data-settimana-dopo
          onClick={onDopo}
          aria-label="Settimana successiva"
          className="tocco-bottone shrink-0 rounded-lg px-2 text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          →
        </button>
      </div>

      {caricando ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : errore ? (
        // 🔴 NON VUOL DIRE CHE È VUOTA: VUOL DIRE CHE NON LO SO (§6). Se la
        //    lettura fallisce non si disegnano sette «niente»: si dice che
        //    non si è letto, con la via d'uscita per riprovare.
        <div data-errore-settimana className="py-2">
          <p className="testo-sala text-b58-terracotta-dark">
            Non riesco a leggere gli impegni di questa settimana: {errore}
          </p>
          <button
            type="button"
            onClick={onRiprova}
            className="tocco-testo testo-sala font-medium text-b58-terracotta hover:text-b58-terracotta-dark"
          >
            Riprova
          </button>
        </div>
      ) : (
        <ol className="divide-y divide-b58-charcoal/10 @5xl:divide-y-0 @5xl:grid @5xl:grid-cols-7 @5xl:gap-2 @5xl:items-start">
          {giorni.map(({ giorno, impegni: delGiorno }) => {
            const n = nomeDelGiorno(giorno);
            const oggi = giorno === oggiISO;
            const vuoto = delGiorno.length === 0;
            return (
              // ⚠️ `min-w-0` sulle celle: senza, una parola lunga allarga la
              //    sua colonna (le griglie danno `min-width: auto` ai figli) e
              //    le sette colonne smettono di essere equilibrate — una
              //    larga il doppio e le altre strette.
              <li
                key={giorno}
                data-giorno={giorno}
                {...(oggi ? { "data-oggi": "" } : {})}
                className={`py-1.5 @5xl:min-w-0 @5xl:rounded-lg @5xl:px-2 ${
                  oggi ? "bg-b58-olive/10 rounded-lg px-2 -mx-2 @5xl:mx-0" : "@5xl:bg-white/50"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p data-intestazione className="testo-sala font-medium text-b58-charcoal-soft">
                    {/* Sul telefono il nome corto, in colonna quello intero. */}
                    <span className="@5xl:hidden">{n.corto}</span>
                    <span className="hidden @5xl:inline">{n.nome}</span> {n.numero}
                    {oggi && <span className="text-b58-olive-dark"> · oggi</span>}
                  </p>
                  {/* ⚠️ Discreto e sulla stessa riga del giorno: un giorno
                      libero si dice, ma non si prende lo spazio di uno pieno.
                      ⚠️ DUE PAROLE PER LO STESSO FATTO, ed è voluto: sul
                         telefono «niente» sta sulla riga del giorno e la resa
                         non cambia di un punto (richiesta del 16/09: il
                         telefono resta com'è); in colonna c'è lo spazio per
                         dirlo per esteso, «Nessun impegno». */}
                  {vuoto && (
                    <p data-vuoto className="testo-sala text-b58-charcoal-soft/60">
                      <span className="@5xl:hidden">niente</span>
                      <span className="hidden @5xl:inline">Nessun impegno</span>
                    </p>
                  )}
                </div>
                {!vuoto && (
                  <ul className="mt-0.5">
                    {delGiorno.map((t, i) => {
                      const ora = oraBreve(t);
                      const fatto = t.status === "completato";
                      return (
                        // 🔴 OGNI IMPEGNO È UN'UNITÀ A SÉ — 12/09/2026, dal
                        //    collaudo sull'iPhone: con più impegni in un
                        //    giorno, i titoli che vanno a capo si leggevano
                        //    come un testo solo. Una linea FRA l'uno e
                        //    l'altro: sopra ognuno tranne il primo, quindi mai
                        //    prima del primo né dopo l'ultimo.
                        //    🔴 E NON SI CONFONDE CON QUELLA FRA I GIORNI
                        //    (secondo collaudo del 12/09): la linea fra i
                        //    giorni è LUNGA e discreta (tutto il riquadro,
                        //    /10); quella fra gli impegni è CORTA — parte
                        //    dove comincia il titolo, cioè dopo la colonna
                        //    dell'ora, e arriva al bordo del testo — e
                        //    chiaramente più scura (/30).
                        //    ⚠️ ERA /15 (secondo collaudo), e sull'iPhone non
                        //    si distingueva da /10: misurato, si staccava
                        //    dallo sfondo solo 1,5 volte la linea fra giorni.
                        //    La prova ora pretende almeno il doppio.
                        //    ⚠️ Stessa altezza di prima (un punto), stessi
                        //    spazi: niente riquadro per impegno. La misura
                        //    che distingue le due linee è in
                        //    `tests/visive/agenda/linee.js`.
                        <li key={t.id} {...(i > 0 ? { "data-separato": "" } : {})}>
                          {i > 0 && (
                            // Stesso rientro del pulsante qui sotto: la stessa
                            // colonna dell'ora (vuota) e lo stesso stacco.
                            // ⚠️ Dal 16/09 la colonna dell'ora c'è anche in
                            //    colonna, quindi il rientro la segue in tutte
                            //    e due le forme: `linee.js` pretende che la
                            //    linea cominci dove comincia il titolo.
                            // ⚠️ IN COLONNA IL RIENTRO SPARISCE, e segue una
                            //    misura e non un gusto: `linee.js` pretende che
                            //    la linea cominci dove comincia il titolo, e in
                            //    colonna il titolo è largo quanto la colonna
                            //    (l'ora gli galleggia sopra), quindi comincia
                            //    al bordo. Col rientro del telefono la linea
                            //    partiva a 457,1 e il titolo a 408.
                            <div
                              aria-hidden="true"
                              data-separatore-impegno=""
                              className="flex h-px gap-2 px-1 -mx-1 @5xl:gap-0"
                            >
                              <span className="w-[3.2em] shrink-0 testo-sala @5xl:w-0" />
                              <span className="flex-1 bg-b58-charcoal/30" />
                            </div>
                          )}
                          {/* ⚠️ IL TESTO STA AL CENTRO DEL BERSAGLIO, non in
                              alto: il pulsante è alto almeno 0,85 cm, e con
                              la riga in cima un impegno di una riga sola
                              lasciava il vuoto sotto di sé — nelle
                              fotografie della prova visiva gli spazi fra
                              gli impegni di uno stesso giorno erano
                              diversi. Ora e titolo si allineano fra loro
                              sulla riga di base, dentro. */}
                          <button
                            type="button"
                            data-impegno={t.id}
                            onClick={() => onApri(t)}
                            className="tocco-bottone flex w-full items-center rounded-lg px-1 -mx-1 text-left hover:bg-b58-cream-dark @5xl:py-0.5"
                          >
                            {/* 🔴 IN COLONNA L'ORA GALLEGGIA, NON OCCUPA UNA
                                COLONNA SUA — 16/09/2026, e l'ha trovato la
                                prova visiva a 1600: con l'ora in una cella
                                fissa accanto, al titolo restavano **80 punti**
                                e «commercialista» ne chiede **103**, quindi si
                                spezzava a metà parola. Non si può rimpicciolire
                                il titolo (sotto 4 mm scatta un altro rosso) né
                                stringere la cella quanto basta: si guadagnavano
                                15 punti su 23, e il primo titolo più lungo
                                avrebbe rotto di nuovo.
                                ⚠️ Con `float`, il titolo è largo quanto la
                                   colonna e il testo gira **attorno** all'ora:
                                   la prima riga comincia dopo di lei — quindi i
                                   titoli dello stesso giorno partono ancora
                                   tutti dallo stesso punto — e la parola lunga
                                   scende sotto, dove c'è tutta la larghezza.
                                ⚠️ Resta UNA riga sola, non un cartellino:
                                   l'ora è accanto al titolo, non sopra. */}
                            <span className="flex min-w-0 flex-1 items-baseline gap-2 @5xl:block">
                              {/* ⚠️ La colonna dell'ora c'è anche vuota, sul
                                  telefono e in colonna: i titoli dello stesso
                                  giorno partono dallo stesso punto, con o
                                  senza ora.
                                  🔴 E IL PUNTINO STA ACCANTO ALL'ORA, NON
                                     DENTRO (16/09): `[data-ora]` deve contenere
                                     l'ora e basta — una prova del 12/09 legge
                                     proprio quel testo, e il telefono non deve
                                     cambiare di un punto. Messo dentro, quella
                                     prova diventava rossa: ha ragione lei.
                                  ⚠️ La cella è larga abbastanza da tenerli
                                     tutti e due in colonna: alla misura di
                                     prima il puntino sarebbe finito sopra il
                                     titolo, che è il contrario di separarli. */}
                              {/* ⚠️ La cella c'è anche vuota, e in colonna
                                  galleggia: lo stacco dal titolo non può più
                                  venire dal `gap` (lì il contenitore non è più
                                  una riga flessibile), quindi se lo porta
                                  addosso — `@5xl:mr-2`. Senza, il titolo
                                  partirebbe attaccato all'ora. */}
                              <span
                                data-cella-ora
                                className="flex w-[3.2em] shrink-0 items-baseline testo-sala text-b58-charcoal-soft @5xl:float-left @5xl:mr-2 @5xl:w-[3.4em]"
                              >
                                <span data-ora className="tabular-nums">
                                  {ora ?? ""}
                                </span>
                                {ora ? (
                                  <span aria-hidden="true" className="hidden @5xl:inline">
                                    &nbsp;·
                                  </span>
                                ) : (
                                  // 🔴 UN GALLEGGIANTE ALTO ZERO NON SPOSTA
                                  //    NIENTE — 16/09/2026, misurato dalla
                                  //    prova visiva a 1600: senza ora la cella
                                  //    resta senza testo, quindi alta zero, e
                                  //    il titolo di quell'impegno cominciava al
                                  //    bordo della colonna mentre gli altri
                                  //    cominciavano dopo l'ora (408 contro
                                  //    457,1). Nello stesso giorno i titoli
                                  //    devono partire tutti dallo stesso punto:
                                  //    lo pretende `prova-visiva.mjs`, ed è
                                  //    anche dove comincia la linea fra un
                                  //    impegno e l'altro.
                                  // ⚠️ Lo spazio sta QUI e non dentro
                                  //    `[data-ora]`: quello deve restare vuoto
                                  //    davvero — una prova del 12/09 legge
                                  //    proprio quel testo per dire che la
                                  //    colonna dell'ora c'è anche senza ora.
                                  <span aria-hidden="true">&nbsp;</span>
                                )}
                              </span>
                              {/* ⚠️ `hyphens-auto` con la pagina in italiano:
                                  in una colonna stretta una parola lunga va a
                                  capo dove si divide una parola italiana,
                                  invece che a metà sillaba. `break-words`
                                  resta come ultima rete, per le parole che non
                                  ci starebbero comunque.
                                  ⚠️ E IN COLONNA È LARGO QUANTO LA COLONNA
                                     (`@5xl:w-full`), non quello che avanza
                                     accanto all'ora: è questo che dà alla
                                     parola lunga una riga intera sotto l'ora
                                     invece di spezzarla a metà. */}
                              <span
                                data-titolo
                                lang="it"
                                title={fatto ? "Fatto" : undefined}
                                className={`min-w-0 flex-1 hyphens-auto break-words testo-sala-grande font-medium @5xl:block @5xl:w-full ${
                                  fatto ? "line-through text-b58-charcoal-soft" : "text-b58-charcoal"
                                }`}
                              >
                                {t.title}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
