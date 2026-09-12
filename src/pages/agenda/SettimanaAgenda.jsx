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
              <li
                key={giorno}
                data-giorno={giorno}
                {...(oggi ? { "data-oggi": "" } : {})}
                className={`py-1.5 @5xl:rounded-lg @5xl:px-2 ${
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
                        //    come un testo solo. Una linea leggera FRA l'uno e
                        //    l'altro: sopra ognuno tranne il primo, quindi mai
                        //    prima del primo né dopo l'ultimo.
                        //    ⚠️ Più chiara di quella fra i giorni (/10), così
                        //    le due non si confondono: il giorno resta la
                        //    divisione forte, l'impegno quella leggera.
                        //    ⚠️ Niente riquadro per impegno: l'elenco resta
                        //    compatto, la linea non aggiunge altezza.
                        <li
                          key={t.id}
                          {...(i > 0 ? { "data-separato": "" } : {})}
                          className={i > 0 ? "border-t border-b58-charcoal/[0.08]" : undefined}
                        >
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
                            <span className="flex min-w-0 flex-1 items-baseline gap-2 @5xl:flex-col @5xl:items-start @5xl:gap-0">
                              {/* ⚠️ Sul telefono la colonna dell'ora c'è
                                  anche vuota: i titoli dello stesso giorno
                                  partono dallo stesso punto, con o senza
                                  ora. In colonna l'ora va sopra il titolo,
                                  così il titolo ha tutta la larghezza. */}
                              <span
                                data-ora
                                className="w-[3.2em] shrink-0 tabular-nums testo-sala text-b58-charcoal-soft @5xl:w-auto"
                              >
                                {ora ?? ""}
                              </span>
                              <span
                                data-titolo
                                title={fatto ? "Fatto" : undefined}
                                className={`min-w-0 flex-1 break-words testo-sala-grande font-medium ${
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
