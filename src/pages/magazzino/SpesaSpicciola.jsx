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
import { toccaSubito } from "../../lib/calcoli/tocco";

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
  const [copiato, setCopiato] = useState(false);

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

  // 🔴 IL TOCCO CAMBIA LA RIGA SUBITO, E NON ASPETTA IL DATABASE
  // (25/08/2026, richiesta di Alessio dal collaudo: *«tocco l'articolo e
  // la riga ci mette un attimo a cambiare stato… davanti allo scaffale,
  // con una mano sola, quel ritardo mi fa toccare due volte e non capire
  // più cosa ho fatto»*).
  //
  // ⚠️ IL RITARDO ERANO **DUE** GIRI DI RETE, non uno: `fai()` aspettava
  // l'aggiornamento **e poi** rileggeva l'elenco intero — e nel frattempo
  // `inCorso` spegneva tutti i pulsanti della schermata. Su una rete di
  // telefono in un supermercato quel «attimo» è mezzo secondo buono.
  //
  // ⚠️ E SE IL SALVATAGGIO FALLISCE LA RIGA TORNA COM'ERA, dicendolo.
  // Un'interfaccia che mostra l'effetto prima di averlo ottenuto **deve**
  // saper tornare indietro: senza, mostrerebbe una cosa che non è
  // successa — che è peggio del ritardo che sta togliendo.
  //
  // ⚠️ NON SI RICARICA L'ELENCO dopo il tocco, ed è la seconda metà della
  // cura: rileggere tutto butterebbe via i tocchi che nel frattempo sono
  // ancora in volo (trappola del 12/08 — *si ricarica ciò che è cambiato
  // sul server, mai ciò che l'utente sta modificando*).
  // ⚠️ LA REGOLA STA IN `src/lib/calcoli/tocco.js`, NON QUI: il ritorno
  // indietro si prova solo potendo far fallire il salvataggio apposta, e
  // dentro un componente `metti()` è una chiamata al database che nessuna
  // prova può rompere. Da lì la riceve come parametro, e le prove pure la
  // rompono davvero (`tests/unita/tocco.test.js`).
  const tocca = (riga, nelCarrello) =>
    toccaSubito({
      righe,
      id: riga.id,
      cambio: { nel_carrello: nelCarrello },
      mostra: setRighe,
      avvisa: setError,
      salva: () => metti(riga.id, nelCarrello),
    });

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

  // --- LA LISTA SU WHATSAPP (25/08/2026, richiesta di Alessio) ---------
  //
  // ⚠️ STESSA FORMA DEGLI ORDINI AI FORNITORI, e per la stessa ragione: il
  // gestionale **prepara il testo e apre WhatsApp**, non manda niente da
  // solo. Un messaggio che parte da sé è un messaggio che nessuno ha
  // riletto.
  //
  // ⚠️ NESSUN DESTINATARIO, e qui è una differenza vera con gli ordini:
  // un ordine ha il numero del fornitore, questa lista no — la si manda a
  // chi passa dal supermercato, e cambia ogni volta. `whatsapp://send`
  // senza `phone` apre WhatsApp e fa scegliere il contatto: è la scelta
  // giusta, perché il gestionale non ha modo di sapere a chi.
  const testoLista = useMemo(() => {
    if (!perCategoria.length) return "";
    const righe = ["Spesa:"];
    for (const [nome, elenco] of perCategoria) {
      if (perCategoria.length > 1) righe.push("", nome === SENZA ? "Varie" : nome);
      for (const r of elenco) righe.push(`· ${r.articolo}${r.nota ? ` (${r.nota})` : ""}`);
    }
    return righe.join("\n");
  }, [perCategoria]);

  // ⚠️ SI COPIA SEMPRE PRIMA, POI SI PROVA AD APRIRE — lezione del 14/08
  // sugli ordini: se il programma non è installato, `whatsapp://` non fa
  // NIENTE. Nessun errore, nessuna finestra. La copia riesce sempre,
  // l'apertura è un di più, e così il testo non si perde mai.
  const mandaSuWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(testoLista);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 3000);
    } catch {
      // Se gli appunti non sono disponibili si va avanti lo stesso: la
      // copia era la rete di riserva, non il gesto.
    }
    window.location.href = `whatsapp://send?text=${encodeURIComponent(testoLista)}`;
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
          {/* ⚠️ Compare solo quando c'è qualcosa da mandare: un pulsante
              che manda una lista vuota è un pulsante che non fa niente. */}
          {daPrendere.length > 0 && (
            <div className="mb-6">
              <button
                type="button"
                className="tocco-azione w-full rounded border border-stone-300 bg-white px-4 testo-sala-grande font-semibold"
                onClick={mandaSuWhatsApp}
              >
                Manda la lista su WhatsApp
              </button>
              {copiato && (
                <p className="mt-2 testo-sala text-stone-600">
                  La lista è copiata negli appunti. Se WhatsApp non si apre da solo, aprilo e incolla.
                </p>
              )}
            </div>
          )}

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
                      {/* ⚠️ PIÙ GRANDE DELLA SOGLIA, NON APPENA SOPRA
                          (25/08): `.tocco-azione` è 1,2 cm contro gli
                          1,05 di `.tocco-riga`, e il nome sta a 4 mm
                          invece di 3,2. La regola di Alessio del 24/08 —
                          *3,20 mm è il minimo accettabile, non
                          l'obiettivo* — vale qui più che altrove: questa
                          schermata si legge in piedi, in movimento, con
                          una mano occupata dal carrello.
                          ⚠️ E NIENTE `disabled`: un pulsante che si
                          spegne mentre si cammina fra gli scaffali è
                          esattamente il ritardo che si sta togliendo. */}
                      <button
                        type="button"
                        className="tocco-azione flex w-full items-center justify-between gap-3 px-1 text-left"
                        onClick={() => tocca(r, true)}
                      >
                        <span className="testo-sala-grande">
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
                      className="tocco-azione flex-1 px-1 text-left testo-sala-grande text-stone-500 line-through"
                      onClick={() => tocca(r, false)}
                    >
                      {r.articolo}
                    </button>
                    {/* «Cancella» resta col suo ritardo, ed è voluto: è
                        l'unico gesto qui dentro che non si disfa, quindi
                        vedere l'effetto solo quando è davvero avvenuto è
                        una garanzia, non un difetto. */}
                    <button
                      type="button"
                      className="tocco-azione shrink-0 rounded border border-stone-300 px-3 testo-sala text-stone-600"
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
