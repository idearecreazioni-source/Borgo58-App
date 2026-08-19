import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCashBalance,
  getUsciteFuture,
  getSaldoTesoreria,
  listCashMovements,
  listDiscountsGiftsMonthly,
  listQuadraturaPagamenti,
  registraConteggioCassa,
  versaInBanca,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, labelFor, oggiLocale, primoDelMeseLocale } from "../../lib/constants";
import { useGiornataOperativa } from "../../lib/giornataOperativa";
import CampoGiornata from "../../components/CampoGiornata";
import { CASH_DIRECTIONS } from "../../lib/constants";

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
  const [recent, setRecent] = useState([]);
  const [monthlyDG, setMonthlyDG] = useState([]);
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
      getUsciteFuture(entityId).catch(() => null),
      getSaldoTesoreria(entityId),
      listCashMovements({ entityId, from: monthStart }),
      listCashMovements({ entityId }),
      listDiscountsGiftsMonthly(entityId),
      listQuadraturaPagamenti(),
    ])
      // ⚠️ L'ordine qui dentro deve seguire l'ordine delle promesse sopra,
      // e aggiungendone una ho sbagliato proprio questo: senza aggiornare
      // l'elenco, `tesoreria` avrebbe ricevuto le uscite future e ogni
      // numero della schermata si sarebbe spostato di uno. Nessun errore,
      // solo cifre sbagliate — la stessa forma del campo dimenticato del
      // 16/08. Se si aggiunge una riga sopra, si aggiunge anche qui.
      .then(([bal, fut, tes, monthMov, allMov, dg, quad]) => {
        setBalance(bal);
        setFuture(fut);
        setTesoreria(tes);
        setMonthMovements(monthMov);
        setRecent(allMov.slice(0, 8));
        setMonthlyDG(dg);
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

  // Omaggi del mese corrente = base TD27 (§6).
  const currentMonthKey = currentMonthStart();
  const giftsThisMonth = monthlyDG.find((r) => r.month === currentMonthKey && r.type === "omaggio");
  const discountsThisMonth = monthlyDG.find((r) => r.month === currentMonthKey && r.type === "sconto");

  // Il saldo che conta e' quello della tesoreria: comprende il contante
  // incassato in sala, che la prima nota non registra per scelta.
  const negativeBalance = tesoreria && Number(tesoreria.contante_atteso) < 0;

  // Dopo un conteggio o un versamento si ricarica ciò che è cambiato sul
  // server — i saldi e i movimenti — e non ciò che l'utente sta scrivendo
  // nell'altro riquadro (trappola del 12/08).
  const ricaricaSaldi = () =>
    Promise.all([
      getCashBalance(entityId),
      getUsciteFuture(entityId).catch(() => null),
      getSaldoTesoreria(entityId),
      listCashMovements({ entityId }),
      listCashMovements({ entityId, from: currentMonthStart() }),
    ]).then(([bal, fut, tes, allMov, monthMov]) => {
      setBalance(bal);
      setFuture(fut);
      setTesoreria(tes);
      setRecent(allMov.slice(0, 8));
      setMonthMovements(monthMov);
    });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Cassa, Banca e Prima Nota</h1>
          <p className="text-b58-charcoal-soft mt-1">
            Prima nota manuale — la riconciliazione POS automatica arriverà con la scelta del sistema di cassa (§3.2).
          </p>
        </div>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className={`rounded-xl p-5 ring-1 ${negativeBalance ? "bg-b58-terracotta/10 ring-b58-terracotta/40" : "bg-b58-parchment ring-b58-charcoal/10"}`}>
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Contante in cassa</div>
              <div className={`text-2xl font-medium ${negativeBalance ? "text-b58-terracotta-dark" : "text-b58-charcoal"}`}>
                {tesoreria ? formatEUR(tesoreria.contante_atteso) : "—"}
              </div>
              {balance && tesoreria && (
                <div className="text-[11px] text-b58-charcoal-soft mt-1">
                  fondo {formatEUR(balance.owner_float)} + incassi {formatEUR(balance.declared_takings)} − uscite{" "}
                  {formatEUR(balance.total_out)}
                  {Number(tesoreria.conti_contanti) > 0 && (
                    <> + {formatEUR(tesoreria.incassi_contanti_sala)} di sala ({tesoreria.conti_contanti} conti)</>
                  )}
                  {/* ⚠️ Questa voce mancava, e senza di essa la
                      scomposizione smetteva di sommare al numero grande
                      dalla prima mancia in contanti (validazione del
                      16/08). L'avvertenza dal database lo diceva a parole,
                      ma un numero e la sua spiegazione che non tornano
                      sono la famiglia di difetti che questo progetto
                      combatte apposta. */}
                  {Number(tesoreria.mance_in_cassa) > 0 && (
                    <> + {formatEUR(tesoreria.mance_in_cassa)} di mance</>
                  )}
                </div>
              )}
              {/* La parte che non è sua, come DATO e non solo come frase:
                  è il numero per cui `di_cui_non_tuo` è stato creato. */}
              {tesoreria && Number(tesoreria.di_cui_non_tuo) > 0 && (
                <div className="text-[11px] text-b58-gold-dark mt-1 font-medium">
                  di cui {formatEUR(tesoreria.di_cui_non_tuo)} non sono tuoi: sono mance del personale
                </div>
              )}
              {/* Il conto corrente sta accanto e NON si somma: sono due
                  posti diversi, e il totale non serve a niente finché
                  nessuno ha detto a cosa dovrebbe rispondere. */}
              {balance && (
                <div className="text-[11px] text-b58-charcoal-soft mt-2 border-t border-b58-charcoal/10 pt-2">
                  Banca: <span className="font-medium text-b58-charcoal">{formatEUR(balance.saldo_banca)}</span>
                  {" — "}entrate {formatEUR(balance.entrate_banca)} · uscite {formatEUR(balance.uscite_banca)}
                </div>
              )}
              {negativeBalance && (
                <div className="text-[11px] text-b58-terracotta-dark mt-1 font-medium">
                  Saldo negativo: un'uscita senza provenienza. Verifica versamenti/incassi mancanti.
                </div>
              )}
              {/* ⚠️ IL SALDO CAMBIA DA SOLO ALLA MEZZANOTTE, e va spiegato
                  nei due versi (condizione posta da Alessio il 17/08). Dal
                  17/08 i saldi contano solo ciò che è già avvenuto: un
                  assegno a 30 giorni sta in prima nota e non abbassa il
                  saldo finché non arriva il giorno. Senza queste due righe,
                  la prima volta che il saldo scende senza che nessuno abbia
                  fatto niente sembra un errore del gestionale. */}
              {future?.quante > 0 && (
                <div className="text-[11px] text-b58-charcoal-soft mt-2">
                  {future.quante === 1 ? "Un'uscita già registrata" : `${future.quante} uscite già registrate`}{" "}
                  per {formatEUR(future.totale)} <strong>non è ancora nel saldo</strong>: la prima
                  esce il {formatDate(future.prima_scadenza)}. In «Ce la faccio?» compare se
                  l&apos;orizzonte arriva fin lì.
                  {/* ⚠️ Prima questa riga diceva «La trovi in "Ce la faccio?"», e non era
                      vero: la previsione guarda 30 giorni di partenza, e un assegno al 31°
                      non c'era. Misurato il 17/08 — era l'orizzonte, non le uscite non
                      lette. Una schermata non deve promettere quello che un'altra farà. */}
                </div>
              )}
              {future?.entrate_oggi > 0 && (
                <div className="text-[11px] text-b58-charcoal-soft mt-1">
                  Oggi {future.entrate_oggi === 1 ? "è entrata nel saldo un'uscita" : `sono entrate nel saldo ${future.entrate_oggi} uscite`}{" "}
                  per {formatEUR(future.totale_oggi)}: erano state registrate prima, e oggi è il
                  giorno in cui i soldi escono.
                </div>
              )}
              {/* ⚠️ QUESTA RIGA DICEVA IL CONTRARIO FINO AL 15/08, ed è la
                  parte che vale la pena raccontare. Dal 04/08 chiudere un
                  conto non scrive in prima nota — scelta giusta e ancora
                  valida — ma la conseguenza era che il saldo escludeva in
                  silenzio ogni incasso di sala, e serviva un avviso sotto
                  per dirlo. Un numero che si deve spiegare con una nota
                  sotto non è una risposta.
                  Ora gli incassi in contante dei conti chiusi si LEGGONO
                  dalla sala (nessuna riga finta in prima nota, quindi
                  niente da togliere quando arriverà il registratore
                  telematico), e l'avvertenza è diventata quella vera: qui
                  manca la CARTA, che non è ancora in banca. */}
              <div className="text-[11px] text-b58-charcoal-soft/80 mt-2 leading-relaxed">
                {tesoreria?.avvertenza}
              </div>
            </div>

            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Questo mese</div>
              {/* ⚠️ I due numeri erano NUDI (piccolezza del collaudo, 17/08):
                  «+0,00» e «−152,94» uno sotto l'altro, senza dire di cosa.
                  Un numero senza la sua parola si legge due volte e si
                  capisce alla seconda — e in prima nota il verso è proprio
                  quello che si vuole sapere a colpo d'occhio. */}
              <div className="text-lg text-b58-olive-dark font-medium">
                +{formatEUR(monthIn)}{" "}
                <span className="text-xs text-b58-charcoal-soft font-normal">entrati</span>
              </div>
              <div className="text-lg text-b58-terracotta-dark font-medium">
                −{formatEUR(monthOut)}{" "}
                <span className="text-xs text-b58-charcoal-soft font-normal">usciti</span>
              </div>
            </div>

            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Sconti/omaggi del mese</div>
              <div className="text-sm text-b58-charcoal">
                Sconti: {discountsThisMonth ? formatEUR(discountsThisMonth.total_forgone) : formatEUR(0)}
              </div>
              <div className="text-sm text-b58-charcoal">
                {/* ⚠️ «base TD27» era gergo: TD27 è il codice della fattura
                    per autoconsumo, e in una schermata che si guarda ogni
                    giorno non dice niente. Il fatto che conta è che il valore
                    degli omaggi serve a Laura, e quello si può dire. */}
                Omaggi: {giftsThisMonth ? formatEUR(giftsThisMonth.total_full) : formatEUR(0)}
              </div>
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
              <h2 className="font-display text-lg text-b58-terracotta-dark mb-1">
                Non torna ({quadratura.length})
              </h2>
              <p className="text-xs text-b58-charcoal-soft mb-3">
                Differenze fra le fatture fornitore e la prima nota. Non sono errori certi: sono
                le cose che meritano un&apos;occhiata.
              </p>
              <ul className="space-y-2">
                {quadratura.map((r, i) => (
                  <li key={`${r.genere}-${i}`} className="text-sm">
                    <span className="text-b58-charcoal font-medium">{formatEUR(r.importo)}</span>
                    {r.quando && <span className="text-b58-charcoal-soft"> · {formatDate(r.quando)}</span>}
                    <span className="text-b58-charcoal"> — {r.descrizione}</span>
                    <div className="text-[11px] text-b58-charcoal-soft">{r.perche}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigazione sezioni */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link to="/comande" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Comande
            </Link>
            <Link to="/cassa/prima-nota" className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
              Prima nota
            </Link>
            <Link to="/cassa/previsione" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Ce la faccio?
            </Link>
            <Link to="/cassa/scontrinato" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Incassato e scontrinato
            </Link>
            <Link to="/cassa/personale" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Ho messo di tasca mia
            </Link>
            <Link to="/cassa/sconti-omaggi" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Sconti e omaggi
            </Link>
            <Link to="/cassa/causali" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Causali
            </Link>
          </div>

          {/* Movimenti recenti */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-b58-charcoal">Movimenti recenti</h2>
              <Link to="/cassa/prima-nota" className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta">
                Vedi tutti →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Nessun movimento ancora.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-b58-charcoal-soft">
                      {formatDate(m.movement_date)} · {m.causale?.label ?? labelFor(CASH_DIRECTIONS, m.direction)}
                    </span>
                    <span className={m.direction === "entrata" ? "text-b58-olive-dark" : "text-b58-terracotta-dark"}>
                      {m.direction === "entrata" ? "+" : "−"}{formatEUR(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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

  const teorico = tesoreria ? Number(tesoreria.contante_atteso) : null;
  const differenza =
    contato !== "" && teorico != null ? Number(contato) - teorico : null;

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const conta = async () => {
    if (contato === "" || Number(contato) < 0) return;
    setInCorso("conteggio");
    setEsito(null);
    onErrore("");
    try {
      await registraConteggioCassa({ entityId, contato: Number(contato), data, nota: null });
      const scarto = differenza;
      setContato("");
      await onFatto();
      setEsito(
        scarto === 0
          ? "Il cassetto torna: nessuna differenza."
          : `Differenza di ${formatEUR(Math.abs(scarto))} ${scarto < 0 ? "in meno" : "in più"}, registrata in prima nota.`
      );
    } catch (e) {
      onErrore(e.message);
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
      <h2 className="font-display text-lg text-b58-charcoal mb-1">Il cassetto</h2>
      <p className="text-[11px] text-b58-charcoal-soft/80 mb-4">
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
          <div className="flex gap-2">
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
              onClick={conta}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-3 py-2 disabled:opacity-60 shrink-0"
            >
              {inCorso === "conteggio" ? "…" : "Conta"}
            </button>
          </div>
          {differenza != null && differenza !== 0 && (
            <p className="text-[11px] text-b58-gold-dark mt-1.5">
              {differenza < 0 ? "Mancano" : "Ci sono"} {formatEUR(Math.abs(differenza))}{" "}
              {differenza < 0 ? "rispetto al teorico" : "in più del teorico"}.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
          <label className={labelClass}>Verso in banca €</label>
          <div className="flex gap-2">
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
              className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm px-3 py-2 disabled:opacity-60 shrink-0"
            >
              {inCorso === "versamento" ? "…" : "Versa"}
            </button>
          </div>
          <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5">
            Non è un&apos;uscita: il cassetto cala e la banca sale dello stesso importo.
          </p>
        </div>
      </div>

      {esito && <p className="text-xs text-b58-olive-dark mt-3">{esito}</p>}

      {tesoreria?.ultimo_conteggio_il && (
        <p className="text-[11px] text-b58-charcoal-soft/70 mt-3 border-t border-b58-charcoal/10 pt-2">
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
