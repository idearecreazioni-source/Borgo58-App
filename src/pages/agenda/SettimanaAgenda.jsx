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
// 🔴 LE SETTE COLONNE SONO STATE TOLTE — 16/09/2026, difetto visto da Alessio
//    sul monitor vero (1920×1080, barra laterale aperta) e poi MISURATO.
//    Non è una preferenza: a nessuna larghezza raggiungibile ci stavano.
//
//    Il titolo lungo del campione chiede **501 punti** su una riga sola.
//    Misurato, alle sei larghezze della prova visiva:
//      · computer 1280, a righe ....... 1 riga, 809 punti disponibili
//      · iPhone 390/440, a righe ...... 2 righe, 279/329 punti
//      · iPhone a 64 punti per cm ..... 4 righe, 252 punti
//      · computer 1600 e 1920, colonne  **6 righe, 129 punti**
//
//    ⚠️ E 1600 e 1920 danno lo STESSO numero, che è il punto: la pagina ha
//       un tetto di larghezza (`max-w-4xl`, che oltre i 1280 punti diventa
//       72rem = 1152), quindi allargare il monitor NON allarga il riquadro.
//       Perché un titolo stesse in due righe servirebbero colonne da ~250
//       punti, cioè un riquadro da ~1800: irraggiungibile. La soglia vecchia
//       (1024 punti di riquadro) diceva «ci stanno sette colonne» quando ci
//       stavano solo per modo di dire.
//
//    ⚠️ E LA RETE NON SE NE ACCORGEVA, ed è la lezione più utile: chiedeva
//       «una PAROLA sta nella sua colonna?» — e da stamattina la risposta era
//       sì. La domanda che conta per chi guarda è «quante righe serve per
//       leggere un titolo?». Ora `prova-visiva.mjs` la fa (massimo 4 righe,
//       tarato sui numeri qui sopra).
//
//    La settimana è quindi a righe DAPPERTUTTO: i sette giorni uno sotto
//    l'altro, come già facevano il telefono e il computer a 1280 — che è la
//    disposizione dove quel titolo sta in una riga sola.
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
      className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3 md:p-4"
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
            Non riesco a leggere i task di questa settimana: {errore}
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
        <ol className="divide-y divide-b58-charcoal/10">
          {giorni.map(({ giorno, impegni: delGiorno }) => {
            const n = nomeDelGiorno(giorno);
            const oggi = giorno === oggiISO;
            const vuoto = delGiorno.length === 0;
            return (
              <li
                key={giorno}
                data-giorno={giorno}
                {...(oggi ? { "data-oggi": "" } : {})}
                className={`py-1.5 ${oggi ? "bg-b58-olive/10 rounded-lg px-2 -mx-2" : ""}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p data-intestazione className="testo-sala font-medium text-b58-charcoal-soft">
                    {/* Il nome corto: è quello che si vedeva già sul telefono e
                        sul computer a 1280, e resta identico ora che la
                        settimana è a righe dappertutto. */}
                    {n.corto} {n.numero}
                    {oggi && <span className="text-b58-olive-dark"> · oggi</span>}
                  </p>
                  {/* ⚠️ Discreto e sulla stessa riga del giorno: un giorno
                      libero si dice, ma non si prende lo spazio di uno pieno. */}
                  {vuoto && (
                    <p data-vuoto className="testo-sala text-b58-charcoal-soft/60">
                      niente
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
                            <div
                              aria-hidden="true"
                              data-separatore-impegno=""
                              className="flex h-px gap-2 px-1 -mx-1"
                            >
                              <span className="w-[3.2em] shrink-0 testo-sala" />
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
                            className="tocco-bottone flex w-full items-center rounded-lg px-1 -mx-1 text-left hover:bg-b58-cream-dark"
                          >
                            {/* ⚠️ UNA RIGA SOLA: l'ora accanto al titolo, mai
                                sopra. Il galleggiamento che serviva in colonna
                                (16/09) è sparito con le colonne: a righe il
                                titolo ha 809 punti e ci sta per intero, quindi
                                non serve fargli girare il testo attorno
                                all'ora. */}
                            <span className="flex min-w-0 flex-1 items-baseline gap-2">
                              {/* ⚠️ La colonna dell'ora c'è ANCHE VUOTA: i
                                  titoli dello stesso giorno partono tutti dallo
                                  stesso punto, con o senza ora — lo misura
                                  `prova-visiva.mjs`, ed è anche il punto in cui
                                  comincia la linea fra un impegno e l'altro.
                                  ⚠️ `[data-ora]` contiene l'ora e basta: una
                                     prova del 12/09 legge proprio quel testo. */}
                              <span
                                data-cella-ora
                                className="flex w-[3.2em] shrink-0 items-baseline testo-sala text-b58-charcoal-soft"
                              >
                                <span data-ora className="tabular-nums">
                                  {ora ?? ""}
                                </span>
                              </span>
                              {/* ⚠️ `hyphens-auto` con la pagina in italiano:
                                  in una colonna stretta una parola lunga va a
                                  capo dove si divide una parola italiana,
                                  invece che a metà sillaba. `break-words`
                                  resta come ultima rete, per le parole che non
                                  ci starebbero comunque. */}
                              <span
                                data-titolo
                                lang="it"
                                title={fatto ? "Fatto" : undefined}
                                className={`min-w-0 flex-1 hyphens-auto break-words testo-sala-grande font-medium ${
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
