import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { chiudiPartita, listPartiteInScadenza } from "../../lib/api/scadenze";
import { formatDate, formatQta } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";

// Lo scadenziario, la stessa cosa che alle 10:00 arriva su Telegram.
//
// Mostra anche le partite che NON vengono segnalate, con scritto perché:
// «come mai non me l'ha detto?» deve avere una risposta qui, non
// richiedere che qualcuno vada a guardare nel database.
//
// 🔴 UNA RIGA PER INGREDIENTE, NON PER PARTITA (29/08/2026).
// Misurato coi dati veri del progetto di prova: 201 righe per 111
// ingredienti — «Sarde» tredici volte, «Carota» dodici, «Caciocavallo
// ragusano» nove, tutte identiche a un'occhiata. Alessio è davanti al
// frigo con una mano sul telefono: deve trovare la riga del prodotto, non
// scorrere tredici righe uguali per capire quale sia.
//
// ⚠️ I LOTTI RESTANO SEPARATI NEL DATABASE, ed è il punto: qui si
// raggruppa solo cio' che si guarda. La rintracciabilità di un richiamo
// vive sul lotto, e i gesti («finita», «buttata») restano per partita —
// si butta una cassa, non «il caciocavallo».
function quandoScade(giorni, scadenza) {
  if (giorni < 0) return `SCADUTO il ${formatDate(scadenza)}`;
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `scade fra ${giorni} giorni (${formatDate(scadenza)})`;
}

// 🔴 IL PASSATO SI SCRIVE AL PASSATO (29/08/2026). Prima diceva «scade il
// 10 giu 2026» il 29 di agosto: una data passata con un verbo al presente
// si legge come una scadenza futura, e chi scorre in fretta non se ne
// accorge. In rosso, perché è l'unica cosa di questa schermata su cui non
// si può aspettare.
const scaduta = (p) => p.giorni_mancanti < 0;

// Le tre posizioni. ⚠️ «Tutti» è la partenza per decisione di Alessio: il
// filtro serve a restringere quando serve, non a nascondere di suo.
const POSIZIONI = [
  { chiave: "tutti", testo: "Tutti" },
  { chiave: "comprati", testo: "Comprati" },
  { chiave: "preparati", testo: "Preparati da me" },
];

export default function Scadenze() {
  const [partite, setPartite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);
  const [posizione, setPosizione] = useState("tutti");
  const [ordine, setOrdine] = useState("scadenza");
  const [aperto, setAperto] = useState(null);

  const carica = async () => {
    try {
      setPartite(await listPartiteInScadenza());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carica();
  }, []);

  // Nessuna conferma, nemmeno su «buttata»: chiesto da Alessio il
  // 13/08/2026 dopo avermi sentito consigliare il contrario. Il gesto
  // resta irreversibile e scrive nel registro HACCP — sta scritto sotto
  // il pulsante, che è dove si legge davvero.
  const chiudi = async (partita, come) => {
    setInCorso(partita.lotto_id);
    try {
      await chiudiPartita({ lottoId: partita.lotto_id, come });
      await carica();
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(null);
    }
  };

  // Un gruppo per ingrediente: quanto ce n'è in tutto, la prima scadenza,
  // da quanto è fermo. ⚠️ Il totale si somma solo fra partite della stessa
  // unità — sommare 3 kg e 400 pz darebbe un numero che non vuol dire
  // niente, e sarebbe un numero *credibile*.
  const gruppi = useMemo(() => {
    const per = new Map();
    for (const p of partite) {
      if (posizione === "comprati" && p.e_preparazione) continue;
      if (posizione === "preparati" && !p.e_preparazione) continue;
      const g = per.get(p.ingrediente_id) ?? {
        id: p.ingrediente_id,
        nome: p.ingrediente,
        unita: p.unita,
        preparazione: p.e_preparazione,
        lotti: [],
      };
      g.lotti.push(p);
      per.set(p.ingrediente_id, g);
    }
    const fatti = [...per.values()].map((g) => {
      const unitaSole = new Set(g.lotti.map((l) => l.unita)).size === 1;
      return {
        ...g,
        totale: unitaSole ? g.lotti.reduce((s, l) => s + Number(l.quantita), 0) : null,
        prima: Math.min(...g.lotti.map((l) => l.giorni_mancanti)),
        primaData: g.lotti.reduce((a, l) => (l.giorni_mancanti < a.giorni_mancanti ? l : a)).scadenza,
        fermaDa: Math.max(...g.lotti.map((l) => l.ferma_da ?? 0)),
        daSegnalare: g.lotti.some((l) => l.da_segnalare),
      };
    });
    // 🔴 LO SCADUTO VA IN CIMA, sempre, qualunque sia l'ordinamento scelto:
    // è la sola cosa qui dentro che non può aspettare, e un ordinamento che
    // la sparpaglia in mezzo la fa perdere.
    return fatti.sort((a, b) => {
      const sa = a.prima < 0 ? 0 : 1;
      const sb = b.prima < 0 ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (ordine === "fermo") return b.fermaDa - a.fermaDa;
      return a.prima - b.prima;
    });
  }, [partite, posizione, ordine]);

  const daGuardare = gruppi.filter((g) => g.daSegnalare);
  const mute = gruppi.filter((g) => !g.daSegnalare);

  const partitaRiga = (p) => (
    <li key={p.lotto_id} className="border-t border-stone-200 py-3 first:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className={`testo-sala-grande ${scaduta(p) ? "font-semibold text-red-700" : "text-stone-700"}`}>
            {formatQta(p.quantita)} {p.unita} · {quandoScade(p.giorni_mancanti, p.scadenza)}
          </div>
          <div className="testo-sala text-stone-500">
            {p.lotto_fornitore ? `lotto ${p.lotto_fornitore} · ` : ""}
            ferma da {p.ferma_da} {p.ferma_da === 1 ? "giorno" : "giorni"}
          </div>
          {p.perche_muta && <div className="testo-sala italic text-stone-500">{p.perche_muta}</div>}
        </div>
        {/* 🔴 LE DUE PAROLE ERANO INDISTINGUIBILI CON LA CODA DELL'OCCHIO
            (22/08). «finita» e «buttata» sono corte, si somigliano, e fanno
            cose opposte: una toglie dalla giacenza e basta, l'altra **scrive
            nel registro HACCP** che un'ispezione guarda.

            ⚠️ ALLONTANARLE NON BASTAVA: adesso ognuna **dice la sua
            conseguenza** sotto il verbo, che è dove sta il dubbio. E la
            distanza è 5 mm **veri**: in pixel si accorcerebbe da sola sul
            tablet.

            ⚠️ Il gesto resta senza conferma, per decisione di Alessio del
            13/08 — proprio per questo le parole devono bastare da sole.

            🔴 E DAL 23/08 SI VEDONO PREMIBILI, chiesto da lui: *«io stesso
            avevo creduto che non funzionassero»*. Il difetto non era nel
            comportamento ma nell'aspetto. */}
        <div className="flex" style={{ gap: "calc(var(--pxcm) * 0.5)" }}>
          <button
            type="button"
            className="tocco-bottone rounded-lg border border-stone-400 bg-white px-4 leading-tight shadow-sm active:translate-y-px active:shadow-none disabled:opacity-50"
            disabled={inCorso === p.lotto_id}
            onClick={() => chiudi(p, "finita")}
          >
            <span className="block testo-sala font-semibold">Finita</span>
            <span className="block testo-sala text-stone-500">usata, esce e basta</span>
          </button>
          <button
            type="button"
            className="tocco-bottone rounded-lg border border-red-700 bg-red-600 px-4 leading-tight text-white shadow-sm active:translate-y-px active:shadow-none disabled:opacity-50"
            disabled={inCorso === p.lotto_id}
            onClick={() => chiudi(p, "buttata")}
          >
            <span className="block testo-sala font-semibold">Buttata</span>
            <span className="block testo-sala text-red-100">va nel registro HACCP</span>
          </button>
        </div>
      </div>
    </li>
  );

  const gruppo = (g) => {
    const apertoQui = aperto === g.id;
    return (
      <li key={g.id} className="border-b border-stone-200 last:border-0">
        {/* Il gruppo si tocca per intero: dentro ci sono le partite, coi
            loro gesti. Un solo bersaglio per riga invece di due file. */}
        <button
          type="button"
          onClick={() => setAperto(apertoQui ? null : g.id)}
          className="tocco-riga flex w-full flex-wrap items-baseline justify-between gap-x-3 py-3 text-left"
        >
          <span className="testo-sala-titolo font-medium text-stone-800">{g.nome}</span>
          <span
            className={`testo-sala-grande ${g.prima < 0 ? "font-semibold text-red-700" : "text-stone-600"}`}
          >
            {g.totale === null ? `${g.lotti.length} partite` : `${formatQta(g.totale)} ${g.unita}`}
            {" · "}
            {quandoScade(g.prima, g.primaData)}
          </span>
          <span className="block w-full testo-sala text-stone-500">
            {g.lotti.length === 1 ? "una partita" : `${g.lotti.length} partite`}
            {" · ferma da "}
            {g.fermaDa} {g.fermaDa === 1 ? "giorno" : "giorni"}
            {g.preparazione ? " · preparata da te" : ""}
            {apertoQui ? "" : " — tocca per vedere le partite"}
          </span>
        </button>
        {apertoQui && <ul className="mb-2 ml-3 border-l-2 border-stone-200 pl-3">{g.lotti.map(partitaRiga)}</ul>}
      </li>
    );
  };

  return (
    <div className="testo-sala mx-auto max-w-3xl p-4">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-stone-600">
        ← Magazzino
      </Link>
      {/* ⚠️ La regola di quali partite compaiono è una spiegazione, e
          si apre dal segno. **Il messaggio delle 10:00 no**: quello è un
          effetto — qualcosa che succede senza che nessuno lo chieda — e
          gli effetti restano visibili. */}
      <h1 className="mb-1 mt-2 text-2xl font-semibold">
        Scadenze
        <Didascalia>
          Compaiono le partite che stanno per scadere e che non sono state rimpiazzate da una più
          recente: se ne è arrivata un&apos;altra dello stesso prodotto, quella vecchia non si
          segnala.
        </Didascalia>
      </h1>
      <p className="mb-4 testo-sala text-stone-600">
        Ogni mattina alle 10:00 le stesse cose arrivano su Telegram.
      </p>

      {/* Le tre posizioni e l'ordinamento. ⚠️ L'ordinamento «più fermo
          prima» è quello che prima stava in una schermata a sé («Da quanto
          è ferma») sugli stessi identici lotti: due voci di menu per lo
          stesso elenco insegnano che una è inutile, e prima o poi si smette
          di aprire anche quella che serve. */}
      <div className="mb-4 flex flex-wrap items-center" style={{ gap: "calc(var(--pxcm) * 0.25)" }}>
        {POSIZIONI.map((p) => (
          <button
            key={p.chiave}
            type="button"
            onClick={() => setPosizione(p.chiave)}
            className={`tocco-bottone rounded-lg px-3 testo-sala-grande ${
              posizione === p.chiave
                ? "bg-stone-800 text-white"
                : "border border-stone-300 text-stone-600"
            }`}
          >
            {p.testo}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOrdine(ordine === "scadenza" ? "fermo" : "scadenza")}
          className="tocco-bottone rounded-lg border border-stone-300 px-3 testo-sala-grande text-stone-600"
        >
          {ordine === "scadenza" ? "Ordina: per scadenza" : "Ordina: più fermo prima"}
        </button>
      </div>

      {/* ⚠️ Qui c'era la spiegazione di cosa fanno i due pulsanti: adesso
          la dicono loro, sotto il verbo. Resta la parte che è un AVVISO e
          non una spiegazione — che il gesto non chiede conferma e non si
          disfa: quella non sta scritta da nessun'altra parte. */}
      <p className="mb-2 testo-sala text-stone-500">
        Non si chiede conferma e non si torna indietro.
      </p>
      {/* 🔴 LA PORTA CHE MANCAVA (23/08, blocco 7). Qui le risposte sono
          due, e resta VOLUTO: sei pulsanti su ogni riga di un elenco sono
          un elenco che non si legge più, e qui le righe sono decine.
          ⚠️ Ma chi arriva con in mano una partita che non è né finita né
          buttata — l'ha abbattuta, la rende al fornitore — da questa
          schermata non aveva NESSUNA strada. Una porta che esiste in un
          verso solo è una porta mancante.
          ⚠️ E dal 29/08 questa è l'UNICA strada per arrivarci: quella
          schermata è uscita dal menu del Magazzino, perché mostrava gli
          stessi identici lotti di questa. Toglierla anche da qui la
          renderebbe irraggiungibile. */}
      <Link
        to="/magazzino/fermi?tutte=1"
        className="tocco-bottone mb-6 inline-flex items-center rounded border border-stone-300 px-4 testo-sala"
      >
        Altre risposte: abbattuto, reso al fornitore…
      </Link>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p>Carico…</p>}

      {!loading && (
        <>
          <h2 className="mb-2 font-semibold">Da guardare ({daGuardare.length})</h2>
          {daGuardare.length === 0 ? (
            <p className="mb-8 text-stone-600">
              {posizione === "tutti"
                ? "Niente in scadenza. Il magazzino gira."
                : "Niente in scadenza fra questi. Prova «Tutti»."}
            </p>
          ) : (
            <ul className="mb-8">{daGuardare.map(gruppo)}</ul>
          )}

          <h2 className="mb-2 font-semibold">Le altre ({mute.length})</h2>
          {mute.length === 0 ? (
            <p className="text-stone-600">Nessun&apos;altra partita con una data di scadenza.</p>
          ) : (
            <>
              <p className="mb-2 testo-sala text-stone-500">
                Ci sono, ma non vengono segnalate — sotto ognuna c&apos;è scritto perché.
              </p>
              <ul>{mute.map(gruppo)}</ul>
            </>
          )}

          {/* ⚠️ RESTA, perché è un limite dell'elenco e non una spiegazione:
              chi non lo legge crede che questa pagina sappia di TUTTO quello
              che c'è in cella. Accorciato al fatto. */}
          <p className="mt-8 testo-sala text-stone-500">
            ⚠️ Chi è entrato senza una data di scadenza — i vegetali sfusi, per esempio —
            qui non compare.
          </p>
        </>
      )}
    </div>
  );
}
