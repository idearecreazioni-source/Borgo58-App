import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { costoDelProgetto, righeCostoDelProgetto } from "../../lib/api/cash";
import { formatDate, formatEUR } from "../../lib/constants";
import ElencoAdattivo from "../../components/ElencoAdattivo";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import {
  daDove,
  dettaglioCompleto,
  dettaglioDelProgetto,
  etichettaFonte,
  inCosa,
  sommaRighe,
  totaliDelProgetto,
} from "../../lib/calcoli/investimento";

// =====================================================================
// QUANTO E' COSTATO IL PROGETTO — C11, 21/09/2026
// =====================================================================
// 🔴 LA DOMANDA: *quanto e' costato mettere in piedi il locale, e chi l'ha
//    pagato.* I numeri sono **tre e non uno** (decisione di Alessio,
//    31/08): quanto ha messo Borgo 58, quanto la sua tasca, e il totale —
//    perche' *un numero solo direbbe quanto e' costato aprire nascondendo
//    chi l'ha pagato*.
//
// 🔴 NON E' UN ARCHIVIO NUOVO: legge la Prima nota e basta. Le righe sono
//    quelle, con la loro data, la loro causale, il loro mezzo e la loro
//    descrizione — nessuna copia, nessun secondo posto dove la stessa spesa
//    possa raccontare una cosa diversa.
//
// ⚠️ PARTE DALL'INTERA STORIA, non dal mese in corso, e in questa schermata
//    e' il contrario della regola della Prima nota (19/08, dove il periodo
//    parte dal mese per non chiedere tutto). La ragione e' la domanda: qui
//    «quanto e' costato il progetto» vuol dire *da sempre*, e un totale del
//    solo mese in corso risponderebbe a un'altra domanda con l'aria di
//    rispondere a questa. ⚠️ **E si puo' farlo senza rischio** solo perche'
//    i totali arrivano da un'aggregazione del database, che non si puo'
//    tagliare a mille righe.
//
// ⚠️ SERVE FINO A MARZO 2027 E POI DECADE: niente qui dentro e' permanente
//    — nessun lavoro pianificato, nessuna scadenza, nessuna tabella. Dopo
//    l'apertura basta smettere di usare l'etichetta.

export default function CostoProgetto() {
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [aggregato, setAggregato] = useState(null);
  const [righe, setRighe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setError("");
    Promise.all([costoDelProgetto(dal, al), righeCostoDelProgetto(dal, al)])
      .then(([agg, det]) => {
        if (!vivo) return;
        setAggregato(agg);
        setRighe(det);
      })
      .catch((e) => {
        if (!vivo) return;
        // 🔴 NON SI DISEGNA UNO ZERO SU UNA LETTURA FALLITA (regola del
        //    19/08): «Totale progetto 0,00 €» si legge «non e' costato
        //    niente», che e' una risposta — e falsa. Qui si dice che non si
        //    sa, con la via d'uscita per riprovare.
        setAggregato(null);
        setRighe(null);
        setError(e.message);
      })
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, [dal, al, giro]);

  const totali = useMemo(() => (aggregato ? totaliDelProgetto(aggregato) : null), [aggregato]);
  const spaccato = useMemo(() => (righe ? dettaglioDelProgetto(righe) : null), [righe]);
  const interezza = useMemo(
    () => (totali && righe ? dettaglioCompleto(totali, righe) : null),
    [totali, righe]
  );

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  return (
    <div className="testo-sala max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link
          to="/cassa"
          className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          ← Cassa
        </Link>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1 inline-flex items-start gap-2 flex-wrap">
        Quanto e' costato il progetto
        <Didascalia etichetta="Come si legge questa pagina">
          Qui ci sono solo le uscite che hai segnato <strong>«Investimento per il
          progetto»</strong> nella Prima nota. Non c'e' niente di automatico: una spesa
          compare qui solo se l'hai marcata tu.
          <br />
          <br />
          I numeri sono tre perche' chi paga conta: <strong>Borgo 58</strong> e
          <strong> la tua tasca</strong> restano distinti, e il totale e' la loro somma.
          Le spese dell'<strong>Orto Borgo 58</strong> non entrano nel totale — e'
          un'altra impresa — ma se ce ne fossero le vedi dichiarate qui sotto.
          <br />
          <br />
          Non e' un numero fiscale: non cambia deducibilita', IVA ne' imposte, e non
          crea nessun debito verso di te. Serve fino all'apertura; dopo, basta smettere
          di usare l'etichetta.
        </Didascalia>
      </h1>

      {/* 🔴 IL PERIODO NON E' IL PREDEFINITO: vuoto vuol dire «tutto», ed e'
          la risposta alla domanda per cui questa pagina esiste. I filtri
          servono a guardare un pezzo, non a decidere il totale di partenza. */}
      <div className="riga-campi mb-6">
        <div>
          <label className={labelClass}>Dal</label>
          <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className={`${inputClass} campo-data`} />
        </div>
        <div>
          <label className={labelClass}>Al</label>
          <input type="date" value={al} onChange={(e) => setAl(e.target.value)} className={`${inputClass} campo-data`} />
        </div>
        {(dal || al) && (
          <div className="riga-campi-gesti">
            <button
              type="button"
              onClick={() => {
                setDal("");
                setAl("");
              }}
              className="tocco-bottone rounded-lg border border-b58-charcoal/15 px-3 testo-sala text-b58-charcoal-soft hover:bg-b58-cream-dark"
            >
              Tutta la storia
            </button>
          </div>
        )}
      </div>

      {loading && <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>}

      {!loading && error && (
        <DatoNonLetto
          cosa="quanto e' costato il progetto"
          nonVuolDire="Non vuol dire che non e' costato niente: vuol dire che non lo so."
          onRiprova={() => setGiro((g) => g + 1)}
        />
      )}

      {!loading && !error && totali && (
        <>
          {/* 🔴 I TRE NUMERI, e il terzo si vede che e' la somma dei primi
              due: le due voci stanno sopra, il totale sotto con la riga che
              lo separa. Un totale calcolato altrove sarebbe un numero che un
              giorno non combacia e nessuno sa perche'. */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <div className="space-y-2">
              {totali.dentro.map((r) => (
                <div key={r.tipo} className="flex items-baseline justify-between gap-4">
                  <span className="text-b58-charcoal-soft">{r.soggetto}</span>
                  <span
                    data-prova={`totale-${r.tipo}`}
                    className="testo-sala-grande font-medium text-b58-charcoal"
                  >
                    {formatEUR(r.totale)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-b58-charcoal/15 flex items-baseline justify-between gap-4">
              <span className="font-display text-b58-charcoal">Totale progetto</span>
              <span
                data-prova="totale-progetto"
                className="font-display text-2xl text-b58-terracotta-dark"
              >
                {formatEUR(totali.totale)}
              </span>
            </div>

            {/* 🔴 CHI RESTA FUORI SI DICHIARA, non sparisce. Un'uscita che
                Alessio ha marcato e che poi non compare da nessuna parte
                sarebbe un'etichetta che non fa niente — e in questo progetto
                una cosa che sparisce in silenzio e' il difetto, non la
                pulizia. */}
            {totali.fuori.length > 0 && (
              <div data-prova="fuori-dal-totale" className="mt-4 pt-3 border-t border-dashed border-b58-charcoal/15">
                <p className="testo-sala text-b58-charcoal-soft/80 mb-1">
                  Fuori dal totale, perche' non sono il locale:
                </p>
                {totali.fuori.map((r) => (
                  <div key={r.tipo} className="flex items-baseline justify-between gap-4">
                    <span className="text-b58-charcoal-soft">{r.soggetto}</span>
                    <span className="text-b58-charcoal-soft">{formatEUR(r.totale)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ⚠️ IL DETTAGLIO DICE SE E' INTERO. I totali qui sopra non si
              possono tagliare (li aggrega il database), il dettaglio si': e
              un elenco piu' corto che compone numeri piu' grandi e' la forma
              piu' silenziosa dello stesso difetto. */}
          {interezza && !interezza.completo && (
            <p
              data-prova="dettaglio-parziale"
              className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4"
            >
              I totali qui sopra sono completi, il dettaglio no: sto mostrando{" "}
              {interezza.mostrate} righe delle {interezza.attese} che li compongono. Restringi
              il periodo per vederle tutte.
            </p>
          )}

          {righe && righe.length === 0 ? (
            // ⚠️ Un elenco vuoto qui e' una risposta vera — «non hai ancora
            //    marcato niente» — ma va detta, e va detta con la strada per
            //    farci qualcosa. Un riquadro vuoto e basta si legge come una
            //    schermata rotta.
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
              <p className="text-b58-charcoal-soft">
                Non hai ancora segnato nessuna spesa come investimento per il progetto.
              </p>
              <p className="testo-sala text-b58-charcoal-soft/80 mt-2">
                Si fa dalla{" "}
                <Link to="/cassa/prima-nota" className="text-b58-terracotta-dark underline">
                  Prima nota
                </Link>
                : su un'uscita — nuova o gia' scritta — spunta «Investimento per il progetto».
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
                <h2 className="font-display testo-sala-grande text-b58-charcoal">
                  Le spese che compongono i numeri
                </h2>
                {/* ⚠️ Il controllo incrociato si VEDE: la somma delle righe
                    mostrate accanto al totale aggregato. Se i due divergono,
                    chi guarda se ne accorge senza dover fare il conto. */}
                <span className="testo-sala text-b58-charcoal-soft/80">
                  {spaccato.dentro.length} nel totale · {formatEUR(sommaRighe(spaccato.dentro))}
                  {spaccato.fuori.length > 0 && ` · ${spaccato.fuori.length} fuori`}
                </span>
              </div>
              <ElencoAdattivo
                righe={righe}
                chiave={(r) => r.id}
                titolo={(r) => formatDate(r.data)}
                intestazioneTitolo="Data"
                attenuata={(r) => spaccato.fuori.some((f) => f.id === r.id)}
                // 🔴 UN ANTICIPO SI RICONOSCE A COLPO D'OCCHIO, e non è un
                //    vezzo: è denaro che la società TI DEVE, mentre le altre
                //    righe sono soldi già usciti. Confonderlo con la tasca —
                //    che invece non torna indietro — sarebbe il difetto
                //    peggiore di questa schermata.
                segno={(r) =>
                  etichettaFonte(r) ? (
                    <span
                      data-prova="segno-anticipo"
                      className="rounded-full bg-b58-olive/20 text-b58-olive-dark px-2 testo-sala"
                    >
                      anticipo
                    </span>
                  ) : null
                }
                campi={(r) => [
                  { chiave: "soggetto", etichetta: "Chi ha pagato", valore: r.soggetto },
                  {
                    chiave: "cosa",
                    etichetta: "In cosa",
                    // ⚠️ «In cosa» non ha un campo suo (decisione del 31/08):
                    //    lo dicono la causale (o il motivo, su un anticipo),
                    //    la descrizione e la nota, che esistono gia'. Un campo
                    //    nuovo sarebbe una seconda risposta alla stessa
                    //    domanda.
                    valore: inCosa(r),
                  },
                  {
                    chiave: "mezzo",
                    etichetta: "Da dove",
                    // Le parole del modulo, non i codici del database: su un
                    // anticipo dice «Anticipo rimborsabile · il titolare, in
                    // contanti suoi», e non `contanti`.
                    valore: daDove(r),
                  },
                  {
                    chiave: "stato",
                    etichetta: "Fattura e rimborso",
                    // ⚠️ Coi dati che esistono gia': il numero della fattura
                    //    collegata e se la nota e' stata rimborsata. La
                    //    fattura si MOSTRA invece di nascondere il caso — e'
                    //    li' che due conteggi potrebbero sovrapporsi, e il
                    //    database lo impedisce a monte.
                    valore: [r.fattura, r.rimborso].filter(Boolean).join(" · "),
                  },
                  { chiave: "importo", etichetta: "Importo", forte: true, valore: formatEUR(r.importo) },
                ]}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
