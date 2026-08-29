import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  abbattiPartita,
  chiudiPartita,
  listPartiteInGiacenza,
  rimandaPartita,
} from "../../lib/api/scadenze";
import { formatDate, formatQta, oggiLocale } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";

// IL PRODOTTO FERMO (23/08/2026, blocco 3 del mandato). Disegno di Alessio.
//
// Domanda diversa dallo scadenziario, e servono tutte e due: quello guarda
// la SCADENZA, questo guarda **da quanto una partita non viene toccata**.
// Un barattolo aperto un mese fa, con scadenza fra un anno, lo vede solo
// questo.
//
// ⚠️ PAGINA SUA E NON UNA SEZIONE DELLO SCADENZIARIO: lì le risposte sono
// due e stanno in una riga; qui sono sei, e tre chiedono qualcosa (quanta
// ne è stata trasformata, in cosa, fino a quando). Sei pulsanti su ogni
// riga di un elenco sono un elenco che non si legge più.
//
// ⚠️ E il riquadro ASSORBE il tocco invece di affiancarsi, come la pianta
// della sala dal 18/08: una riga toccata si apre, le altre restano righe.

const GIORNI_RINVIO = [3, 7, 14, 30];

export default function Fermi() {
  // 🔴 CHI ARRIVA DALLE SCADENZE CON UNA PARTITA IN MANO (24/08/2026).
  // Dalla schermata delle scadenze un pulsante dice «Altre risposte:
  // abbattuto, trasformato, reso al fornitore…» e portava qui — dove le
  // sei risposte stanno sulla RIGA di una partita ferma. Misurato: 203
  // lotti in casa, 65 in scadenza, **zero fermi**. Chi aveva in mano il
  // calamaro scaduto premeva quel pulsante e leggeva «Niente fermo».
  // *Un collegamento che porta in un vicolo cieco è peggio di un
  // collegamento che manca: promette una strada.*
  //
  // ⚠️ Nessun terzo pulsante in Scadenze (decisione di Alessio, 24/08):
  // là le risposte restano due. Cambia questa schermata, che quando la si
  // apre da lì mostra **tutte** le partite ancora in casa.
  //
  // 🔴 E LA RADICE È STATA TOLTA, NON CURATA (28/08/2026, decisione di
  // Alessio). Questa schermata mostrava «i fermi da troppo», e per dire
  // «troppo» serviva una durata dichiarata sul prodotto comprato. Quella
  // durata non esiste più: lui la giudica ingestibile e non la vuole né
  // scritta a mano né dedotta da MEMO.
  //
  // ⚠️ QUINDI SPARISCE IL GIUDIZIO, NON L'ELENCO. «Ferma da N giorni» si
  // conta dall'ultima mossa e resta vero; «ferma da TROPPO» non lo può
  // dire più nessuno. Un elenco che restasse a rispondere «niente fermo»
  // si leggerebbe «va tutto bene» ed è invece «non lo so più» — uno zero
  // non è una risposta.
  //
  // ⚠️ E i due modi diventano uno: non c'è più una selezione da fare, e
  // `?tutte=1` non serve più a niente. Chi arriva dalle scadenze con una
  // partita in mano trova la stessa schermata di sempre.
  const [cerca, setCerca] = useState("");
  const [partite, setPartite] = useState(null);
  const [aperta, setAperta] = useState(null);
  const [error, setError] = useState("");
  const [fatto, setFatto] = useState("");
  const [inCorso, setInCorso] = useState(false);

  // ⚠️ Restava un campo per ognuna delle risposte che chiedevano qualcosa.
  // Tolta «l'ho trasformato», ne serve uno solo: gli altri quattro erano
  // codice che nessuno chiamava piu'.
  const [nuovaScadenza, setNuovaScadenza] = useState("");

  const carica = async () => {
    try {
      // ⚠️ L'elenco delle preparazioni non si legge piu': serviva al menu
      // «in cosa e' finito» della risposta «l'ho trasformato», che dal
      // 29/08 non c'e' piu'. Una lettura in meno a ogni apertura.
      setPartite(await listPartiteInGiacenza(cerca || null));
      setError("");
    } catch (e) {
      // ⚠️ «Non lo so» non è «non c'è niente» (regola del 19/08): se la
      // lettura fallisce NON si disegna un elenco vuoto, che si
      // leggerebbe «va tutto bene».
      setPartite(null);
      setError(e.message);
    }
  };

  useEffect(() => {
    carica();
    // ⚠️ La ricerca si chiede al DATABASE a ogni cambiamento, non si
    // filtra nel browser: 203 partite oggi, e quel numero cresce. Una
    // lettura senza limite torna al massimo di mille righe senza dirlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerca]);

  const apri = (p) => {
    setAperta(aperta === p.lotto_id ? null : p.lotto_id);
    setNuovaScadenza("");
    setError("");
    setFatto("");
  };

  const esegui = async (azione, messaggio) => {
    setInCorso(true);
    setError("");
    try {
      await azione();
      setFatto(messaggio);
      setAperta(null);
      await carica();
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(false);
    }
  };

  const bottone = "tocco-bottone rounded border border-stone-300 px-4 leading-tight text-left";
  const campo = "tocco-bottone w-full rounded border border-stone-300 px-3 testo-sala";
  const etichetta = "block testo-sala text-stone-600 mb-1";

  const pannello = (p) => (
    <div className="mt-3 rounded border border-stone-300 bg-stone-50 p-3">
      {/* Le tre risposte che chiudono il ciclo, e sono quelle che si
          premono e basta. */}
      <div className="mb-4 flex flex-wrap" style={{ gap: "calc(var(--pxcm) * 0.5)" }}>
        <button
          type="button"
          className={bottone}
          disabled={inCorso}
          onClick={() =>
            esegui(
              () => chiudiPartita({ lottoId: p.lotto_id, come: "finita" }),
              `${p.prodotto}: segnata come consumata.`
            )
          }
        >
          <span className="block testo-sala font-semibold">Consumato</span>
          <span className="block testo-sala text-stone-500">esce e basta</span>
        </button>

        <button
          type="button"
          className="tocco-bottone rounded border-2 border-red-400 bg-red-50 px-4 leading-tight text-left text-red-800"
          disabled={inCorso}
          onClick={() =>
            esegui(
              () => chiudiPartita({ lottoId: p.lotto_id, come: "buttata" }),
              `${p.prodotto}: buttata, e scritta nel registro HACCP.`
            )
          }
        >
          <span className="block testo-sala font-semibold">Buttato</span>
          <span className="block testo-sala">va nel registro HACCP</span>
        </button>

        <button
          type="button"
          className={bottone}
          disabled={inCorso}
          onClick={() =>
            esegui(
              () => chiudiPartita({ lottoId: p.lotto_id, come: "reso_fornitore" }),
              `${p.prodotto}: reso al fornitore. Non è contato fra gli sprechi.`
            )
          }
        >
          <span className="block testo-sala font-semibold">Reso al fornitore</span>
          <span className="block testo-sala text-stone-500">non è uno spreco</span>
        </button>
      </div>

      {/* «Ancora qui» — la risposta senza la quale l'unica via d'uscita
          sarebbe mentire. */}
      <div className="mb-4">
        <span className={etichetta}>È ancora qui, ricordamelo fra…</span>
        <div className="flex flex-wrap" style={{ gap: "calc(var(--pxcm) * 0.5)" }}>
          {GIORNI_RINVIO.map((g) => (
            <button
              key={g}
              type="button"
              className="tocco-bottone rounded border border-stone-300 px-4"
              disabled={inCorso}
              onClick={() =>
                esegui(
                  () => rimandaPartita({ lottoId: p.lotto_id, giorni: g }),
                  `${p.prodotto}: torna in elenco fra ${g} giorni.`
                )
              }
            >
              {g} giorni
            </button>
          ))}
        </div>
      </div>

      {/* «Abbattuto» — l'orologio riparte, e la data la mette lui. */}
      <div className="mb-4">
        <label className={etichetta} htmlFor={`abb-${p.lotto_id}`}>
          L&apos;ho abbattuto: da quando scade?
        </label>
        <div className="flex flex-wrap items-end" style={{ gap: "calc(var(--pxcm) * 0.5)" }}>
          <input
            id={`abb-${p.lotto_id}`}
            type="date"
            className={`${campo} max-w-52`}
            min={oggiLocale()}
            value={nuovaScadenza}
            onChange={(e) => setNuovaScadenza(e.target.value)}
          />
          <button
            type="button"
            className={bottone}
            disabled={inCorso || !nuovaScadenza}
            onClick={() =>
              esegui(
                () => abbattiPartita({ lottoId: p.lotto_id, nuovaScadenza }),
                `${p.prodotto}: abbattuto, scade il ${formatDate(nuovaScadenza)}.`
              )
            }
          >
            <span className="block testo-sala font-semibold">Abbattuto</span>
            <span className="block testo-sala text-stone-500">l&apos;orologio riparte</span>
          </button>
        </div>
        {/* ⚠️ Dentro il gesto, non sopra la schermata (regola del 18/08):
            la data si chiede a mano perché la tabella delle durate dopo
            abbattimento non ce l'ha ancora nessuno. */}
        {/* ⚠️ Qui c'era «quando arrivera' la tabella della biologa, il
            gestionale la proporra' da se'»: una promessa diventata FALSA il
            27/08, quando Alessio ha deciso che le durate le stabilisce lui e
            quella tabella non la chiede piu'. Una promessa che nessuno
            manterra' fa aspettare invece di far decidere. */}
        <p className="mt-1 testo-sala text-stone-500">
          La durata dopo l&apos;abbattimento la decidi tu.
        </p>
      </div>

      {/* «Trasformato» — la risposta che NON scala. */}
      {/* 🔴 «L'HO TRASFORMATO» E' STATA TOLTA (29/08/2026, decisione di
          Alessio). Il suo stesso pulsante ammetteva di non fare niente —
          «la giacenza non cambia: scende quando registri la preparazione» —
          e un gesto che dichiara di non avere effetto fa credere di aver
          fatto qualcosa quando non si e' fatto nulla.
          ⚠️ Al suo posto un COLLEGAMENTO, non un'azione: chi ha trasformato
          quella merce deve andare a registrare la produzione, che e' il
          gesto che scala davvero la giacenza. */}
      <div>
        <span className={etichetta}>L&apos;ho trasformato</span>
        <p className="testo-sala text-stone-600">
          La giacenza scende quando registri la preparazione, non da qui.
        </p>
        <Link
          to="/magazzino/produzioni"
          className="tocco-bottone mt-1 inline-flex items-center rounded-lg border border-stone-300 px-4 testo-sala-grande text-stone-700"
        >
          Vai a registrare la preparazione
        </Link>
      </div>
    </div>
  );

  return (
    <div className="testo-sala mx-auto max-w-3xl p-4">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-stone-600">
        ← Magazzino
      </Link>
      {/* ⚠️ La differenza fra questa schermata e le Scadenze è una
          spiegazione — utile la prima volta, ingombro dalla seconda — e
          si apre dal segno. */}
      <h1 className="mb-3 mt-2 text-2xl font-semibold">
        Da quanto è ferma
        <Didascalia>
          Ogni partita ancora in giacenza, con le sei risposte per ognuna. In
          cima quelle che nessuno tocca da più tempo. È un&apos;altra domanda
          rispetto alle scadenze: lì si guarda la data stampata, qui i
          movimenti.
        </Didascalia>
      </h1>
      {/* ⚠️ Il rimando è un BERSAGLIO, non una parola sottolineata dentro
          la frase: misurato col valore del tablet (64) un link inline è
          alto 3,91 mm, contro gli 8,50 che serve al dito. Era l'unico
          elemento della schermata sotto soglia. */}
      <Link
        to="/magazzino/scadenze"
        className="tocco-bottone mb-6 inline-flex items-center rounded border border-stone-300 px-4 testo-sala"
      >
        Vai alle scadenze
      </Link>

      {/* ⚠️ SENZA RICERCA L'ELENCO NON SI USA: duecento righe da scorrere
          per trovare il calamaro sono un collegamento che «funziona» e
          resta inutilizzabile. ⚠️ Dal 28/08 c'è sempre — prima mancava
          nell'elenco dei fermi, dove le righe erano poche perché il
          giudizio ne teneva fuori quasi tutte. */}
      <div className="mb-4">
        <input
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca un prodotto…"
          className="tocco-bottone w-full rounded border border-stone-300 px-3 testo-sala"
        />
      </div>

      {fatto && <p className="mb-4 rounded bg-stone-100 p-3">{fatto}</p>}
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}

      {/* ⚠️ La via d'uscita per riprovare: un rifiuto senza gesto d'uscita
          è un vicolo cieco (regola del 16/08). */}
      {partite === null && error && (
        <button type="button" className={bottone} onClick={carica}>
          Riprova
        </button>
      )}

      {partite === null && !error && <p>Carico…</p>}

      {partite !== null && partite.length === 0 && (
        <p className="text-stone-600">
          {cerca
            ? `Nessun prodotto in casa con «${cerca}» nel nome.`
            : "Non c'è niente in giacenza."}
        </p>
      )}

      {partite !== null && partite.length > 0 && (
        <ul>
          {partite.map((p) => (
            <li key={p.lotto_id} className="border-b border-stone-200 py-3 last:border-0">
              <button
                type="button"
                className="tocco-riga w-full text-left"
                onClick={() => apri(p)}
              >
                <span className="block font-medium">{p.prodotto}</span>
                {/* 🔴 TUTTI E TRE I NUMERI, mai solo l'ultimo — è la regola
                    della nota di credito del 17/08 («fattura 250 · nota −40 ·
                    da pagare 210»).

                    ⚠️ Trovata guardando la schermata: mostrando per primo
                    «1,5 kg» si legge come la giacenza, e la giacenza è 2,5 —
                    perché il trasformato NON scala. Un numero che sembra la
                    giacenza senza esserlo è la stessa forma dello scarto a
                    zero. */}
                <span className="block testo-sala text-stone-600">
                  {formatQta(p.giacenza)} {p.unita} in cella
                  {Number(p.trasformata) > 0
                    ? ` · ${formatQta(p.trasformata)} già trasformati · ${formatQta(
                        p.da_guardare
                      )} da decidere`
                    : ""}
                </span>
                <span className="block testo-sala text-stone-600">
                  {/* 🔴 IL FATTO, NON IL GIUDIZIO (28/08/2026). Qui c'era
                      anche «dura N giorni», e la riga diceva se il fermo
                      fosse troppo. Senza la durata dei prodotti comprati
                      quel confronto non si può fare, e scriverne uno finto
                      sarebbe peggio: a giudicare è chi guarda. */}
                  ferma da {p.ferma_da} giorni
                  {/* 🔴 IL PASSATO AL PASSATO (29/08/2026). Diceva «scade il
                      10 giu 2026» il 29 di agosto: una data passata con un
                      verbo al presente si legge come una scadenza futura, e
                      chi scorre in fretta non se ne accorge. */}
                  {p.scadenza &&
                    (new Date(p.scadenza) < new Date(new Date().toDateString()) ? (
                      <span className="font-semibold text-red-700">
                        {" · SCADUTO il "}
                        {formatDate(p.scadenza)}
                      </span>
                    ) : (
                      ` · scade il ${formatDate(p.scadenza)}`
                    ))}
                </span>
              </button>
              {aperta === p.lotto_id && pannello(p)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
