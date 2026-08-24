import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chiudiPartita, listPartiteInScadenza } from "../../lib/api/scadenze";
import { formatDate, formatQta } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";

// Lo scadenziario, la stessa cosa che alle 10:00 arriva su Telegram.
//
// Mostra anche le partite che NON vengono segnalate, con scritto perché:
// «come mai non me l'ha detto?» deve avere una risposta qui, non
// richiedere che qualcuno vada a guardare nel database.
function quandoScade(giorni, scadenza) {
  if (giorni < 0) return `scaduto il ${formatDate(scadenza)}`;
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `scade fra ${giorni} giorni (${formatDate(scadenza)})`;
}

export default function Scadenze() {
  const [partite, setPartite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);

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

  const daGuardare = partite.filter((p) => p.da_segnalare);
  const mute = partite.filter((p) => !p.da_segnalare);

  const riga = (p) => (
    <li key={p.lotto_id} className="border-b border-stone-200 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{p.ingrediente}</div>
          <div className="testo-sala text-stone-600">
            {formatQta(p.quantita)} {p.unita} · {quandoScade(p.giorni_mancanti, p.scadenza)}
            {p.lotto_fornitore ? ` · lotto ${p.lotto_fornitore}` : ""}
          </div>
          {p.perche_muta && <div className="testo-sala text-stone-500 italic">{p.perche_muta}</div>}
        </div>
        {/* 🔴 LE DUE PAROLE ERANO INDISTINGUIBILI CON LA CODA DELL'OCCHIO
            (22/08). «finita» e «buttata» sono corte, si somigliano, e fanno
            cose opposte: una toglie dalla giacenza e basta, l'altra **scrive
            nel registro HACCP** che un'ispezione guarda. Stavano a 8 punti
            l'una dall'altra — 1,08 mm veri.

            ⚠️ ALLONTANARLE NON BASTAVA: adesso ognuna **dice la sua
            conseguenza** sotto il verbo, che è dove sta il dubbio (regola
            del 18/08: la spiegazione va dentro il gesto, non sopra la
            schermata). E la distanza è 5 mm **veri**, non 8 punti: in pixel
            si accorcerebbe da sola sul tablet.

            ⚠️ Il gesto resta senza conferma, per decisione di Alessio del
            13/08 — proprio per questo le parole devono bastare da sole.

            🔴 E DAL 23/08 SI VEDONO PREMIBILI, chiesto da lui: *«io stesso
            avevo creduto che non funzionassero, quindi il difetto c'è anche
            se rispondono»*. ⚠️ E rispondevano davvero — misurato: abilitati,
            38,3 e 43,1 mm di larghezza, tocco attivo. Il difetto non era nel
            comportamento ma nell'aspetto: due rettangoli col bordo grigio
            chiaro, in una schermata fatta di rettangoli col bordo grigio
            chiaro. *Un gesto che non sembra un gesto non viene fatto, e
            questo e' l'unico posto da cui una partita in scadenza si
            chiude.* Adesso «Finita» e' un pulsante bianco con bordo e
            ombra, «Buttata» e' rosso pieno — e tutti e due si abbassano
            sotto il dito. */}
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
      {/* ⚠️ Qui c'era la spiegazione di cosa fanno i due pulsanti: adesso
          la dicono loro, sotto il verbo. Resta la parte che è un AVVISO e
          non una spiegazione — che il gesto non chiede conferma e non si
          disfa: quella non sta scritta da nessun'altra parte. */}
      <p className="mb-2 testo-sala text-stone-500">
        Non si chiede conferma e non si torna indietro.
      </p>
      {/* 🔴 LA PORTA CHE MANCAVA (23/08, blocco 7). Qui le risposte sono
          due, e resta VOLUTO: la decisione di ieri sta scritta in cima a
          `Fermi.jsx` — «sei pulsanti su ogni riga di un elenco sono un
          elenco che non si legge più», e qui le righe da guardare sono
          decine.
          ⚠️ Ma chi arriva con in mano una partita che non è né finita né
          buttata — l'ha abbattuta, l'ha trasformata, la rende al
          fornitore — da questa schermata non aveva NESSUNA strada: «Fermi
          da troppo» rimandava qui, e qui non rimandava niente. Una porta
          che esiste in un verso solo è una porta mancante, ed è il
          difetto che il 20/08 ha tenuto i Preventivi irraggiungibili.
          ⚠️ È un BERSAGLIO e non una parola dentro la frase: misurato col
          valore del tablet, un collegamento in linea è alto 3,91 mm
          contro gli 8,50 che serve al dito. */}
      {/* 🔴 PORTA ALL'ELENCO COMPLETO, non ai soli fermi (24/08/2026).
          Misurato: 203 lotti in casa, zero fermi — questo pulsante
          portava a una pagina che rispondeva «Niente fermo», cioè
          prometteva sei risposte e non ne dava nessuna. */}
      <Link
        to="/magazzino/fermi?tutte=1"
        className="tocco-bottone mb-6 inline-flex items-center rounded border border-stone-300 px-4 testo-sala"
      >
        Altre risposte: abbattuto, trasformato, reso al fornitore…
      </Link>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p>Carico…</p>}

      {!loading && (
        <>
          <h2 className="mb-2 font-semibold">Da guardare ({daGuardare.length})</h2>
          {daGuardare.length === 0 ? (
            <p className="mb-8 text-stone-600">Niente in scadenza. Il magazzino gira.</p>
          ) : (
            <ul className="mb-8">{daGuardare.map(riga)}</ul>
          )}

          <h2 className="mb-2 font-semibold">Le altre ({mute.length})</h2>
          {mute.length === 0 ? (
            <p className="text-stone-600">Nessun'altra partita con una data di scadenza.</p>
          ) : (
            <>
              <p className="mb-2 testo-sala text-stone-500">
                Ci sono, ma non vengono segnalate — sotto ognuna c&apos;è scritto perché.
              </p>
              <ul>{mute.map(riga)}</ul>
            </>
          )}

          <p className="mt-8 testo-sala text-stone-500">
            I prodotti entrati senza data di scadenza (i vegetali sfusi, per esempio) non compaiono
            qui: senza una data non c&apos;è niente da sorvegliare.
          </p>
        </>
      )}
    </div>
  );
}
