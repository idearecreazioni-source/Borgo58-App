import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  aggiungiSpesaSpicciola,
  categorieSpesaSpicciola,
  listSpesaSpicciola,
  metti,
  togliSpesaSpicciola,
} from "../../lib/api/spesaSpicciola";
import { leggi, NON_LETTO, nonLetto } from "../../lib/calcoli/letture";

// LA SPESA SPICCIOLA (23/08/2026, blocco 8 del mandato). Richiesta di
// Alessio: la roba che compra di persona al supermercato.
//
// ⚠️ SEPARATA DALLA LISTA DELLA SPESA, e la separazione è il senso del
// blocco: quella nasce dalle soglie del magazzino e finisce in un ordine
// a un fornitore. Questa non tocca niente — non le giacenze, non gli
// ordini, non i costi. È un foglietto in tasca.
//
// ⚠️ IL GESTO È UNO SOLO: si tocca l'articolo e sparisce dall'elenco di
// cosa manca. Non si cancella — passa fra le cose prese, e da lì si torna
// indietro con un tocco. Davanti allo scaffale si tocca per sbaglio.
const SENZA = "Senza categoria";

export default function SpesaSpicciola() {
  const [righe, setRighe] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [articolo, setArticolo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const carica = async () => {
    try {
      const [r, c] = await Promise.all([listSpesaSpicciola(), leggi(categorieSpesaSpicciola())]);
      setRighe(r);
      setCategorie(nonLetto(c) ? NON_LETTO : c);
      setError("");
    } catch (e) {
      // ⚠️ «Non lo so» non è «non manca niente» (regola del 19/08): se la
      // lettura fallisce NON si disegna un elenco vuoto, che qui si
      // leggerebbe «non c'è niente da comprare» — ed è la risposta più
      // corta con l'aria di essere intera.
      setRighe(null);
      setError(e.message);
    }
  };

  useEffect(() => {
    carica();
  }, []);

  const daPrendere = useMemo(() => (righe ?? []).filter((r) => !r.nel_carrello), [righe]);
  const presi = useMemo(() => (righe ?? []).filter((r) => r.nel_carrello), [righe]);

  // Raggruppate per categoria, come chiesto. Le righe senza categoria
  // stanno in fondo: sono le ultime scritte di fretta, non una categoria.
  const perCategoria = useMemo(() => {
    const mappa = new Map();
    for (const r of daPrendere) {
      const k = r.categoria?.trim() || SENZA;
      if (!mappa.has(k)) mappa.set(k, []);
      mappa.get(k).push(r);
    }
    return [...mappa.entries()].sort(([a], [b]) =>
      a === SENZA ? 1 : b === SENZA ? -1 : a.localeCompare(b, "it")
    );
  }, [daPrendere]);

  const fai = async (azione) => {
    setInCorso(true);
    try {
      await azione();
      await carica();
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(false);
    }
  };

  const aggiungi = () => {
    if (!articolo.trim()) return;
    return fai(async () => {
      await aggiungiSpesaSpicciola({ articolo, categoria });
      setArticolo("");
      // ⚠️ La categoria RESTA scritta: chi aggiunge tre cose di pulizia le
      // aggiunge una dopo l'altra, e rimetterla ogni volta è il genere di
      // attrito che fa smettere di usare un elenco.
    });
  };

  const campo = "tocco-bottone w-full rounded border border-stone-300 px-3 testo-sala";

  return (
    <div className="testo-sala mx-auto max-w-3xl p-4">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-stone-600">
        ← Magazzino
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Spesa spicciola</h1>
      {/* ⚠️ Una riga sola, e dice la cosa che serve sapere: che questa non
          è l'altra lista. Senza, il primo dubbio di chiunque sarà «e
          allora la lista della spesa cos'è?». */}
      <p className="mb-4 testo-sala text-stone-600">
        Quello che compri di persona al supermercato. Non c&apos;entra col magazzino: non tocca le
        giacenze e non diventa un ordine.
      </p>

      <div className="mb-6 rounded border border-stone-300 bg-stone-50 p-3">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <input
            className={campo}
            placeholder="Cosa serve"
            value={articolo}
            onChange={(e) => setArticolo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && aggiungi()}
          />
          {/* 🔴 LE CATEGORIE SONO SUE, NON MIE: testo libero con quelle già
              usate proposte accanto. Un elenco chiuso scritto da me
              («pulizia», «cancelleria») sarebbe una regola scritta sulle
              sue cose, e il giorno che ne servisse una nuova vorrebbe una
              migrazione. È la stessa forma delle causali di cassa.
              ⚠️ La proposta serve a non farne nascere tre scritte in tre
              modi — che è l'unico difetto vero del testo libero. */}
          <input
            className={campo}
            placeholder="Categoria (facoltativa)"
            list="categorie-spesa"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && aggiungi()}
          />
          {!nonLetto(categorie) && (
            <datalist id="categorie-spesa">
              {categorie.map((c) => (
                <option key={c.categoria} value={c.categoria} />
              ))}
            </datalist>
          )}
          <button
            type="button"
            className="tocco-bottone rounded border border-stone-300 bg-white px-4 font-semibold"
            disabled={inCorso || !articolo.trim()}
            onClick={aggiungi}
          >
            Aggiungi
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}

      {/* La via d'uscita per riprovare: un rifiuto senza gesto d'uscita è
          un vicolo cieco (regola del 16/08). */}
      {righe === null && error && (
        <button
          type="button"
          className="tocco-bottone rounded border border-stone-300 px-4"
          onClick={carica}
        >
          Riprova
        </button>
      )}

      {righe !== null && (
        <>
          {daPrendere.length === 0 ? (
            <p className="mb-8 text-stone-600">Non manca niente.</p>
          ) : (
            perCategoria.map(([nome, elenco]) => (
              <div key={nome} className="mb-6">
                <h2 className="mb-2 font-semibold">
                  {nome} <span className="testo-sala font-normal text-stone-500">({elenco.length})</span>
                </h2>
                <ul>
                  {elenco.map((r) => (
                    <li key={r.id} className="border-b border-stone-200 last:border-0">
                      {/* ⚠️ LA RIGA INTERA È IL BERSAGLIO, come in sala dal
                          08/08: al supermercato si tiene il telefono in una
                          mano e il carrello nell'altra, e centrare una
                          casella piccola con un dito solo non funziona. */}
                      <button
                        type="button"
                        className="tocco-riga flex w-full items-center justify-between gap-3 px-1 text-left"
                        disabled={inCorso}
                        onClick={() => fai(() => metti(r.id, true))}
                      >
                        <span>
                          {r.articolo}
                          {r.nota && <span className="testo-sala text-stone-500"> · {r.nota}</span>}
                        </span>
                        <span className="testo-sala shrink-0 text-stone-400">preso →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          {presi.length > 0 && (
            <div className="mt-8 border-t border-stone-300 pt-4">
              <h2 className="mb-2 font-semibold text-stone-600">Nel carrello ({presi.length})</h2>
              {/* ⚠️ Non spariscono per sempre: da qui si rimettono in lista
                  con un tocco. Toccare per sbaglio davanti allo scaffale è
                  la cosa più probabile che possa succedere qui dentro. */}
              <ul>
                {/* 🔴 DUE GESTI OPPOSTI A 2,1 mm L'UNO DALL'ALTRO — misurato
                    il 24/08, non stimato: toccando il nome l'articolo torna
                    in lista, toccando l'altro sparisce per sempre, e fra i
                    due c'erano due millimetri. La soglia è **5 mm**, e qui
                    conta più che altrove: questa schermata si guarda in
                    piedi davanti a uno scaffale, con una mano occupata dal
                    carrello. `.gesti-pericolosi` è la classe che tiene quel
                    numero in un posto solo.
                    🔴 E «Togli» ERA AMBIGUO, che è la metà peggiore: in un
                    elenco di cose già prese si legge «togli dal carrello» —
                    cioè esattamente il contrario di quello che fa. Il verbo
                    ora dice cosa succede. */}
                {presi.map((r) => (
                  <li key={r.id} className="gesti-pericolosi justify-between border-b border-stone-200 last:border-0">
                    <button
                      type="button"
                      className="tocco-riga flex-1 px-1 text-left text-stone-500 line-through"
                      disabled={inCorso}
                      onClick={() => fai(() => metti(r.id, false))}
                    >
                      {r.articolo}
                    </button>
                    <button
                      type="button"
                      className="tocco-bottone shrink-0 rounded border border-stone-300 px-3 testo-sala text-stone-600"
                      disabled={inCorso}
                      onClick={() => fai(() => togliSpesaSpicciola(r.id))}
                    >
                      Cancella
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
