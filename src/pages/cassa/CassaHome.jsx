import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCashBalance,
  getQuadraturaFiscale,
  getUsciteFuture,
  getSaldoTesoreria,
  listCashMovements,
  listDiscountsGifts,
  listQuadraturaPagamenti,
  registraConteggioCassa,
  versaInBanca,
} from "../../lib/api/cash";
import { CAUSALE_ALTRO, omaggiAListino, percentualeOmaggi } from "../../lib/calcoli/omaggi";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale, primoDelMeseLocale } from "../../lib/constants";
import { useGiornataOperativa } from "../../lib/giornataOperativa";
import CampoGiornata from "../../components/CampoGiornata";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import { leggi, nonLetto } from "../../lib/calcoli/letture";

// Primo del mese in ora locale: la versione precedente passava per
// toISOString() e restituiva l'ULTIMO giorno del mese prima (mezzanotte
// italiana e' ancora il giorno prima in UTC), quindi il riepilogo di cassa
// includeva sempre una giornata di troppo.
const currentMonthStart = primoDelMeseLocale;

export default function CassaHome() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [balance, setBalance] = useState(null);
  // Le uscite scritte e non ancora avvenute: servono a spiegare il saldo.
  const [future, setFuture] = useState(null);
  const [tesoreria, setTesoreria] = useState(null);
  const [quadratura, setQuadratura] = useState([]);
  const [monthMovements, setMonthMovements] = useState([]);
  // Gli sconti e gli omaggi del mese, riga per riga: servono con la loro
  // CAUSALE, che l'aggregato mensile non porta.
  const [dgMese, setDgMese] = useState(null);
  // Quanto è entrato davvero questo mese, dai conti chiusi: è il
  // denominatore della percentuale degli omaggi, e si chiede alla stessa
  // funzione che risponde in «Incassato e scontrinato» — un solo calcolo.
  const [fiscale, setFiscale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    const monthStart = currentMonthStart();
    Promise.all([
      getCashBalance(entityId),
      leggi(getUsciteFuture(entityId)),
      getSaldoTesoreria(entityId),
      listCashMovements({ entityId, from: monthStart }),
      leggi(listDiscountsGifts({ entityId, from: monthStart })),
      leggi(getQuadraturaFiscale(entityId, monthStart, oggiLocale())),
      listQuadraturaPagamenti(),
    ])
      // ⚠️ L'ordine qui dentro deve seguire l'ordine delle promesse sopra,
      // e aggiungendone una ho sbagliato proprio questo: senza aggiornare
      // l'elenco, `tesoreria` avrebbe ricevuto le uscite future e ogni
      // numero della schermata si sarebbe spostato di uno. Nessun errore,
      // solo cifre sbagliate — la stessa forma del campo dimenticato del
      // 16/08. Se si aggiunge una riga sopra, si aggiunge anche qui.
      .then(([bal, fut, tes, monthMov, dg, fisc, quad]) => {
        setBalance(bal);
        setFuture(fut);
        setTesoreria(tes);
        setMonthMovements(monthMov);
        setDgMese(dg);
        setFiscale(fisc);
        setQuadratura(quad);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entityId]);

  const monthIn = useMemo(
    () => monthMovements.filter((m) => m.direction === "entrata").reduce((s, m) => s + Number(m.amount), 0),
    [monthMovements]
  );
  const monthOut = useMemo(
    () => monthMovements.filter((m) => m.direction === "uscita").reduce((s, m) => s + Number(m.amount), 0),
    [monthMovements]
  );

  // 🔴 IN EVIDENZA CI VANNO SOLO GLI OMAGGI «ALTRO» (decisione di Alessio,
  // 23/08). Gli sconti non spariscono da nessuna parte — restano distinti
  // in tutto il gestionale e nella loro schermata: cambia soltanto cosa si
  // guarda a colpo d'occhio da qui.
  const omaggiAltro = useMemo(
    () => (nonLetto(dgMese) ? null : omaggiAListino(dgMese, CAUSALE_ALTRO)),
    [dgMese]
  );
  const omaggiTotali = useMemo(
    () => (nonLetto(dgMese) ? null : omaggiAListino(dgMese)),
    [dgMese]
  );
  // ⚠️ La percentuale si calcola solo se si è letto TUTTO ciò che le
  // serve. Con una lettura fallita, «0%» direbbe «non abbiamo regalato
  // niente» — e sarebbe una risposta più corta con l'aria di essere
  // intera (§8).
  const percentuale =
    nonLetto(dgMese) || nonLetto(fiscale)
      ? null
      : percentualeOmaggi({
          omaggiAltro,
          omaggiTotali,
          incassato: fiscale?.incassato ?? 0,
        });

  // Il saldo che conta e' quello della tesoreria: comprende il contante
  // incassato in sala, che la prima nota non registra per scelta.
  const negativeBalance = tesoreria && Number(tesoreria.contante_atteso) < 0;

  // Dopo un conteggio o un versamento si ricarica ciò che è cambiato sul
  // server — i saldi e i movimenti — e non ciò che l'utente sta scrivendo
  // nell'altro riquadro (trappola del 12/08).
  const ricaricaSaldi = () =>
    Promise.all([
      getCashBalance(entityId),
      leggi(getUsciteFuture(entityId)),
      getSaldoTesoreria(entityId),
      listCashMovements({ entityId, from: currentMonthStart() }),
    ]).then(([bal, fut, tes, monthMov]) => {
      setBalance(bal);
      setFuture(fut);
      setTesoreria(tes);
      setMonthMovements(monthMov);
    });

  return (
    <div className="testo-sala max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
            Cassa, Banca e Prima Nota
            <Didascalia>
              Gli incassi in contante dei conti chiusi entrano da soli; il resto si registra a mano.
              La riconciliazione del POS arriverà con la scelta del sistema di cassa.
            </Didascalia>
          </h1>
          {/* 🔴 DICEVA «PRIMA NOTA MANUALE», ed era diventato falso il
              15/08 (corretto il 22/08). Da quella data gli incassi in
              contante dei conti chiusi entrano nel saldo **da soli** —
              letti, non copiati (`20260815000004`): la prima nota non è
              più tutta a mano.
              ⚠️ E QUESTA RIGA DICEVA «la scomposizione qui sotto lo mostra
              già con "+ … di sala (N conti)"» — vera fino al 23/08, falsa
              nel momento in cui la scomposizione è stata tolta. È
              esattamente la famiglia delle frasi diventate false: giuste
              quando scritte, mai rilette quando la schermata è cambiata
              sotto. Chi toglie un pezzo di schermata cerca chi lo nomina.
              ⚠️ La seconda metà della frase invece era vera e resta: il
              POS non c'è. *Una frase può diventare falsa a metà, ed è il
              caso peggiore da rileggere — la parte vera la fa sembrare
              ancora giusta tutta.*
              ⚠️ Tolto anche «(§3.2)»: è il rimando a un documento che chi
              guarda questa schermata non ha davanti. */}
          {/* ⚠️ QUESTA ERA UNA DIDASCALIA e si apre dal segno accanto al
              titolo (24/08): spiega come funziona il modulo, non cosa
              succede se premi qualcosa.
              🔴 RESTANO VISIBILI, e non è una svista, le righe che sono
              AVVERTIMENTI: «di cui … sono mance del personale, non tuoi»,
              «N uscite già registrate non sono ancora nel saldo»,
              «contare il cassetto non corregge di nascosto», «non è
              un'uscita: il cassetto cala e la banca sale». Quelle dicono
              cosa sta succedendo ai soldi, e nasconderle sarebbe l'errore
              che il mandato chiede di non fare. */}
        </div>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* ---------------------------------------------------------------
              QUATTRO RIQUADRI, non tre (decisione di Alessio, 23/08/2026).
              Le quattro cose che vuole vedere aprendo la schermata:
              quanto contante dovrebbe esserci, quanto c'è in banca, come
              va il mese, e quanto si è regalato.

              ⚠️ SU DUE COLONNE FINO AL COMPUTER: quattro riquadri in fila
              su un mini tablet da 8 pollici in verticale darebbero colonne
              da meno di due centimetri, e un numero che va a capo in mezzo
              non è più un numero a colpo d'occhio.

              🔴 IL PARAGRAFO LUNGO SOTTO IL SALDO È STATO TOLTO — voluto da
              lui, ed è un rovesciamento con un prezzo che va detto. Diceva
              cosa comprende il contante atteso, quanto è mancia e quando è
              stato contato il cassetto l'ultima volta. Non era sbagliato:
              era rivolto a chi non sapeva, e quelle regole le ha scritte
              lui. Restano le due righe che NON sono spiegazioni ma
              avvisi — «di cui non sono tuoi» e le uscite non ancora nel
              saldo — perché tolte quelle il numero grande avrebbe l'aria
              di essere completo senza esserlo, che è il difetto che questo
              progetto insegue.
              --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className={`rounded-xl p-4 ring-1 ${negativeBalance ? "bg-b58-terracotta/10 ring-b58-terracotta/40" : "bg-b58-parchment ring-b58-charcoal/10"}`}>
              <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">In cassa</div>
              <div className={`text-2xl font-medium ${negativeBalance ? "text-b58-terracotta-dark" : "text-b58-charcoal"}`}>
                {tesoreria ? formatEUR(tesoreria.contante_atteso) : "—"}
              </div>
              {/* La parte che non è sua: è un avviso, non una spiegazione —
                  quei soldi stanno nel cassetto e sono di altri. */}
              {tesoreria && Number(tesoreria.di_cui_non_tuo) > 0 && (
                <div className="testo-sala text-b58-gold-dark mt-1 font-medium">
                  di cui {formatEUR(tesoreria.di_cui_non_tuo)} sono mance del personale, non tuoi
                </div>
              )}
              {negativeBalance && (
                <div className="testo-sala text-b58-terracotta-dark mt-1 font-medium">
                  Saldo negativo: un&apos;uscita senza provenienza.
                </div>
              )}
              {/* 🔴 «Non lo so» invece del silenzio: senza queste uscite il
                  saldo SEMBRA PULITO, ed è la forma peggiore — un numero che
                  ha l'aria di essere completo senza esserlo. */}
              {nonLetto(future) && (
                <DatoNonLetto cosa="le uscite già registrate e non ancora nel saldo" className="mt-2" />
              )}
              {!nonLetto(future) && future?.quante > 0 && (
                <div className="testo-sala text-b58-charcoal-soft mt-2">
                  {future.quante === 1 ? "Un'uscita già registrata" : `${future.quante} uscite già registrate`}{" "}
                  per {formatEUR(future.totale)} <strong>non è ancora nel saldo</strong>: la prima
                  esce il {formatDate(future.prima_scadenza)}.
                </div>
              )}
            </div>

            {/* Il conto corrente sta accanto e NON si somma al contante:
                sono due posti diversi, e il totale non serve a niente
                finché nessuno ha detto a cosa dovrebbe rispondere. */}
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
              <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">In banca</div>
              <div className="text-2xl font-medium text-b58-charcoal">
                {balance ? formatEUR(balance.saldo_banca) : "—"}
              </div>
              {balance && (
                <div className="testo-sala text-b58-charcoal-soft mt-1">
                  entrate {formatEUR(balance.entrate_banca)} · uscite {formatEUR(balance.uscite_banca)}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
              <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Questo mese</div>
              {/* ⚠️ I due numeri erano NUDI (piccolezza del collaudo, 17/08):
                  «+0,00» e «−152,94» uno sotto l'altro, senza dire di cosa.
                  In prima nota il verso è proprio quello che si vuole sapere
                  a colpo d'occhio. */}
              <div className="testo-sala-grande text-b58-olive-dark font-medium">
                +{formatEUR(monthIn)}{" "}
                <span className="testo-sala text-b58-charcoal-soft font-normal">entrati</span>
              </div>
              <div className="testo-sala-grande text-b58-terracotta-dark font-medium">
                −{formatEUR(monthOut)}{" "}
                <span className="testo-sala text-b58-charcoal-soft font-normal">usciti</span>
              </div>
            </div>

            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
              <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
                Omaggi «{CAUSALE_ALTRO}»
              </div>
              {nonLetto(dgMese) ? (
                <DatoNonLetto cosa="gli omaggi di questo mese" />
              ) : (
                <>
                  <div className="text-2xl font-medium text-b58-charcoal">{formatEUR(omaggiAltro)}</div>
                  {/* ⚠️ La percentuale dice QUANTA della roba servita è stata
                      regalata: omaggi «Altro» sul venduto a listino (incassato
                      + tutti gli omaggi). Senza niente di servito non è zero
                      per cento — è «non lo so», e si tace. */}
                  {percentuale === null ? (
                    <div className="testo-sala text-b58-charcoal-soft mt-1">
                      Questo mese non è ancora stato servito niente.
                    </div>
                  ) : (
                    <div className="testo-sala text-b58-charcoal-soft mt-1">
                      <span className="font-medium text-b58-charcoal">
                        {percentuale.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%
                      </span>{" "}
                      di quello che è uscito dalla cucina
                    </div>
                  )}
                </>
              )}
              {/* ⚠️ Niente collegamento qui dentro: «Sconti e omaggi» c'è
                  già fra i pulsanti sotto, e due porte per lo stesso posto
                  sulla stessa schermata sono ingombro — *se un comando si
                  ripete, quasi sempre ne basta uno*. */}
            </div>
          </div>

          <IlCassetto
            entityId={entityId}
            tesoreria={tesoreria}
            onFatto={ricaricaSaldi}
            onErrore={setError}
          />

          {/* Quadratura: si vede solo quando c'è qualcosa che non torna.
              Un riquadro che dice «tutto a posto» ogni giorno si impara a
              non guardare — stessa ragione per cui il messaggio delle
              scadenze non parte quando non c'è niente da dire. */}
          {quadratura.length > 0 && (
            <div className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/40 p-5 mb-6">
              <h2 className="font-display testo-sala-grande text-b58-terracotta-dark mb-1">
                Non torna ({quadratura.length})
              </h2>
              <p className="testo-sala text-b58-charcoal-soft mb-3">
                ⚠️ Non sono errori certi: sono le differenze fra fatture e prima nota che
                meritano un&apos;occhiata.
              </p>
              <ul className="space-y-2">
                {quadratura.map((r, i) => (
                  <li key={`${r.genere}-${i}`} className="testo-sala">
                    <span className="text-b58-charcoal font-medium">{formatEUR(r.importo)}</span>
                    {r.quando && <span className="text-b58-charcoal-soft"> · {formatDate(r.quando)}</span>}
                    <span className="text-b58-charcoal"> — {r.descrizione}</span>
                    <div className="testo-sala text-b58-charcoal-soft">{r.perche}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigazione sezioni */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link to="/comande" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Comande
            </Link>
            <Link to="/cassa/prima-nota" className="tocco-bottone inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala font-medium px-4">
              Prima nota
            </Link>
            <Link to="/cassa/previsione" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Ce la faccio?
            </Link>
            <Link to="/cassa/scontrinato" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Incassato e scontrinato
            </Link>
            {/* ⚠️ QUESTA NON E' LA TASCA, e i due si somigliano abbastanza da
                scambiarsi: qui si registra una spesa fatta **per conto della
                società**, che la società poi ti pareggia — misurato il
                31/08, scrive in `anticipazioni_socio` sul soggetto Borgo 58.
                La tasca è l'altra cosa: soldi tuoi che non torneranno
                indietro, e non c'è niente da pareggiare. */}
            <Link to="/cassa/personale" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Anticipo io, poi mi rimborso
            </Link>
            {/* 🔴 LA PORTA DELLA TASCA — 31/08/2026. Il soggetto esisteva in
                produzione dall'01:06 e **da Cassa non ci si arrivava**: il
                menu della Prima nota lo offre, ma bisognava sapere di
                cercarlo lì. È la stessa famiglia dei Preventivi rimasti
                irraggiungibili per giorni (20/08) — *la rotta c'era e nessun
                collegamento ci portava*.
                ⚠️ L'indirizzo porta il soggetto: si arriva alla Prima nota
                **già sulla tasca**, invece di arrivarci su Borgo 58 e dover
                cambiare — che è il gesto in cui si sbaglia. */}
            <Link to="/cassa/prima-nota?soggetto=tasca" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              La mia tasca
            </Link>
            {/* ⚠️ LA PORTA, e non è un dettaglio: il 20/08 la sezione
                Preventivi è rimasta irraggiungibile per giorni perché la
                rotta c'era e nessun collegamento ci portava. */}
            <Link to="/cassa/prestiti" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Prestiti da privati
            </Link>
            <Link to="/cassa/sconti-omaggi" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Sconti e omaggi
            </Link>
            <Link to="/cassa/causali" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Causali
            </Link>
            {/* ⚠️ LA PORTA DEL RIFIUTO (25/08/2026): da oggi un movimento di
                banca senza conto viene respinto, e il messaggio manda qui.
                Senza questo collegamento sarebbe un vicolo cieco — e il
                precedente è del 20/08, quando i Preventivi restarono
                irraggiungibili per giorni con la rotta già scritta. */}
            <Link to="/cassa/conti-correnti" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
              Conti correnti
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Il cassetto: contarlo, e portarne una parte in banca.
//
// ⚠️ Due gesti diversi che si somigliano e vanno tenuti separati. Contare
// il cassetto RILEVA una differenza fra quello che il gestionale crede e
// quello che c'è davvero — e la differenza si dichiara, non si aggiusta
// di nascosto. Versare in banca non è un'uscita: è lo stesso denaro che
// cambia posto, e infatti muove due saldi insieme.
// ---------------------------------------------------------------------
function IlCassetto({ entityId, tesoreria, onFatto, onErrore }) {
  const [contato, setContato] = useState("");
  const [versamento, setVersamento] = useState("");
  // 🔴 LA SERATA, NON «OGGI» (regola di Alessio, 19/08). Il conteggio del
  // cassetto è uno dei due soli gesti che seguono la serata: contando alle
  // 00:30 si sta chiudendo la sera prima, e datarlo a domani farebbe
  // confrontare i soldi contati stanotte con gli incassi di un'altra
  // giornata — un ammanco che non esiste.
  //
  // ⚠️ Si PROPONE e si vede, non si scrive in silenzio: il caso che lo
  // rende necessario esiste davvero — il cassetto contato prima di
  // mezzanotte a locale chiuso presto, o la mattina dopo prima di aprire.
  // È la stessa forma del mezzo di pagamento, della riga della lista e
  // della causale: *si fa da sé, ma si vede.*
  //
  // ⚠️ DAL 19/08 (seconda metà) LA LETTURA NON STA PIÙ QUI: era scritta a
  // mano in questa schermata, ed era l'unica corretta di tutta la Cassa.
  // Adesso è `useGiornataOperativa()`, la stessa che usano prima nota,
  // sconti e scontrinato — *una regola vive in un posto solo*, e finché
  // viveva qui le altre schermate non potevano che averne una diversa.
  const [data, setData] = useState(oggiLocale());
  const { serata, oraFineSerata } = useGiornataOperativa();

  // La proposta arriva quando le impostazioni sono state lette, e non
  // sovrascrive niente: se nel frattempo si è già corretta la data a mano,
  // quella vince. Ricaricare sopra a ciò che l'utente sta scrivendo è il
  // difetto del 12/08.
  useEffect(() => {
    if (serata) setData((d) => (d === oggiLocale() ? serata : d));
  }, [serata]);
  const [inCorso, setInCorso] = useState("");
  const [esito, setEsito] = useState(null);
  const [daFiscalizzare, setDaFiscalizzare] = useState("");

  const teorico = tesoreria ? Number(tesoreria.contante_atteso) : null;
  const differenza =
    contato !== "" && teorico != null ? Number(contato) - teorico : null;

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  // 🔴 CHIUDERE LA GIORNATA NON SI COMPLETA IN SILENZIO se restano conti
  // incassati senza documento fiscale: il database rifiuta, e qui si mostra
  // il perché **accanto al pulsante che è stato premuto**, non in cima alla
  // pagina (lezione del 17/08: un rifiuto lontano dal gesto è un rifiuto che
  // non c'è). ⚠️ E la via d'uscita c'è: si può chiudere lo stesso prendendone
  // atto, e quel permesso resta scritto sul conteggio.
  const conta = async (presoAtto = false) => {
    if (contato === "" || Number(contato) < 0) return;
    setInCorso("conteggio");
    setEsito(null);
    setDaFiscalizzare("");
    onErrore("");
    try {
      await registraConteggioCassa({
        entityId,
        contato: Number(contato),
        data,
        nota: null,
        presoAtto,
      });
      const scarto = differenza;
      setContato("");
      await onFatto();
      setEsito(
        scarto === 0
          ? "Il cassetto torna: nessuna differenza."
          : `Differenza di ${formatEUR(Math.abs(scarto))} ${scarto < 0 ? "in meno" : "in più"}, registrata in prima nota.`
      );
    } catch (e) {
      // Il messaggio del database è scritto per Alessio e dice cosa fare:
      // si mostra intatto, sotto il pulsante, con la via d'uscita accanto.
      if (/senza documento fiscale/.test(e.message)) setDaFiscalizzare(e.message);
      else onErrore(e.message);
    } finally {
      setInCorso("");
    }
  };

  const versa = async () => {
    if (versamento === "" || Number(versamento) <= 0) return;
    setInCorso("versamento");
    setEsito(null);
    onErrore("");
    try {
      await versaInBanca({ entityId, importo: Number(versamento), data, nota: null });
      const quanto = Number(versamento);
      setVersamento("");
      await onFatto();
      setEsito(`${formatEUR(quanto)} spostati dal cassetto alla banca.`);
    } catch (e) {
      onErrore(e.message);
    } finally {
      setInCorso("");
    }
  };

  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
      <h2 className="font-display testo-sala-grande text-b58-charcoal mb-1">Il cassetto</h2>
      <p className="testo-sala text-b58-charcoal-soft/80 mb-4">
        Contare il cassetto non corregge di nascosto: se quello che trovi è diverso da quello che
        risulta, <strong>la differenza resta scritta</strong>. Le differenze che tornano tutti i mesi
        sono un&apos;informazione, non un fastidio.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CampoGiornata
          label="Serata che stai chiudendo"
          value={data}
          onChange={setData}
          oraFineSerata={oraFineSerata}
          frase="Stai chiudendo la serata di"
          labelClass={labelClass}
          inputClass={inputClass}
        />

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
          <label className={labelClass}>Ho contato €</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder={teorico != null ? formatEUR(teorico).replace("€", "").trim() : ""}
              className={inputClass}
            />
            <button
              type="button"
              disabled={inCorso !== "" || contato === ""}
              onClick={() => conta(false)}
              className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-3  disabled:opacity-60 shrink-0"
            >
              {inCorso === "conteggio" ? "…" : "Conta"}
            </button>
          </div>
          {/* 🔴 L ELENCO CHE SI FA NOTARE. Compare solo quando c e davvero
              qualcosa da sistemare: un avviso che compare sempre e un avviso
              che si impara a ignorare. */}
          {daFiscalizzare && (
            <div className="mt-2 rounded-lg bg-b58-terracotta/10 border border-b58-terracotta/30 px-3 py-2">
              <p className="text-[12px] text-b58-terracotta-dark">{daFiscalizzare}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link
                  to="/cassa/scontrinato"
                  className="tocco-bottone inline-flex items-center text-[12px] underline text-b58-charcoal hover:text-b58-terracotta"
                >
                  Vai a sistemarli
                </Link>
                <button
                  type="button"
                  disabled={inCorso !== ""}
                  onClick={() => conta(true)}
                  className="tocco-bottone text-[12px] underline text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-60"
                >
                  Chiudi lo stesso, ne prendo atto
                </button>
              </div>
            </div>
          )}
          {differenza != null && differenza !== 0 && (
            <p className="testo-sala text-b58-gold-dark mt-1.5">
              {differenza < 0 ? "Mancano" : "Ci sono"} {formatEUR(Math.abs(differenza))}{" "}
              {differenza < 0 ? "rispetto al teorico" : "in più del teorico"}.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
          <label className={labelClass}>Verso in banca €</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={versamento}
              onChange={(e) => setVersamento(e.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              disabled={inCorso !== "" || versamento === ""}
              onClick={versa}
              className="tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-3  disabled:opacity-60 shrink-0"
            >
              {inCorso === "versamento" ? "…" : "Versa"}
            </button>
          </div>
          <p className="testo-sala text-b58-charcoal-soft/70 mt-1.5">
            Non è un&apos;uscita: il cassetto cala e la banca sale dello stesso importo.
          </p>
        </div>
      </div>

      {esito && <p className="testo-sala text-b58-olive-dark mt-3">{esito}</p>}

      {tesoreria?.ultimo_conteggio_il && (
        <p className="testo-sala text-b58-charcoal-soft/70 mt-3 border-t border-b58-charcoal/10 pt-2">
          Ultimo conteggio: {formatDate(tesoreria.ultimo_conteggio_il)}
          {Number(tesoreria.ultima_differenza) !== 0 && (
            <>
              {" "}— differenza di {formatEUR(Math.abs(Number(tesoreria.ultima_differenza)))}{" "}
              {Number(tesoreria.ultima_differenza) < 0 ? "in meno" : "in più"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
