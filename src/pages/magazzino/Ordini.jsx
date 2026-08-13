import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  annullaOrdine,
  bozzaOrdine,
  confrontoFornitori,
  listaOrdini,
  registraOrdine,
  segnaOrdineRicevuto,
} from "../../lib/api/ordini";
import { listaSpesa } from "../../lib/api/shoppingList";
import { formatDate, formatEUR } from "../../lib/constants";

// Fase B della filiera della spesa: l'ordine parte nella lingua del
// fornitore, e parte dal telefono di Alessio.
//
// Il gestionale NON manda niente. Prepara il testo, lo fa correggere, e
// apre WhatsApp col messaggio già scritto: un ordine che parte da solo è
// un ordine di cui nessuno si è accorto, e la merce arriva lo stesso.
export default function Ordini() {
  const [gruppi, setGruppi] = useState([]);
  const [bozze, setBozze] = useState({});
  const [ordini, setOrdini] = useState([]);
  const [confronti, setConfronti] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);
  const [copiato, setCopiato] = useState(null);

  const caricaOrdini = () => listaOrdini().then(setOrdini);

  const carica = async () => {
    const [righe, fatti] = await Promise.all([listaSpesa(), listaOrdini()]);
    // Raggruppa per fornitore le sole righe ancora da comprare: una riga
    // già ordinata resta visibile in lista, ma non si riordina.
    const perFornitore = new Map();
    righe
      .filter((r) => r.stato === "da_comprare" && r.supplier_id)
      .forEach((r) => {
        if (!perFornitore.has(r.supplier_id)) {
          perFornitore.set(r.supplier_id, { supplier_id: r.supplier_id, nome: r.fornitore, righe: [] });
        }
        perFornitore.get(r.supplier_id).righe.push(r);
      });
    const senzaFornitore = righe.filter((r) => r.stato === "da_comprare" && !r.supplier_id);
    setGruppi([...perFornitore.values()]);
    setOrdini(fatti);
    return { gruppi: [...perFornitore.values()], senzaFornitore };
  };

  const [orfane, setOrfane] = useState([]);

  useEffect(() => {
    setLoading(true);
    carica()
      .then(({ senzaFornitore }) => setOrfane(senzaFornitore))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apriBozza = async (supplierId) => {
    if (bozze[supplierId]) {
      setBozze((b) => ({ ...b, [supplierId]: null }));
      return;
    }
    setError("");
    try {
      const b = await bozzaOrdine(supplierId);
      setBozze((prev) => ({ ...prev, [supplierId]: { ...b, testoModificato: b.testo ?? "" } }));
    } catch (e) {
      setError(e.message);
    }
  };

  // Si ricarica solo ciò che è cambiato sul server, mai il testo che sta
  // ancora scrivendo in un'altra bozza (trappola del 12/08).
  const cambiaTesto = (supplierId, testo) =>
    setBozze((b) => ({ ...b, [supplierId]: { ...b[supplierId], testoModificato: testo } }));

  // Due indirizzi per la stessa cosa, e la differenza si vede all'uso:
  //
  //  - `whatsapp://` parla direttamente col programma installato: l'app
  //    si apre e basta.
  //  - `wa.me` passa dal sito di WhatsApp, che mostra una pagina
  //    intermedia con «Apri l'app» — un clic in più ogni volta.
  //
  // Si usa il primo, ma il secondo resta scritto lì accanto: se il
  // programma non fosse installato, il collegamento diretto non fa
  // NIENTE — nessun errore, nessuna finestra — e senza una via
  // d'uscita visibile sembrerebbe che il gestionale si sia rotto.
  const linkApp = (bozza) =>
    bozza.telefono
      ? `whatsapp://send?phone=${bozza.telefono}&text=${encodeURIComponent(bozza.testoModificato)}`
      : null;

  const linkBrowser = (bozza) =>
    bozza.telefono
      ? `https://wa.me/${bozza.telefono}?text=${encodeURIComponent(bozza.testoModificato)}`
      : null;

  // La mail si apre nella SUA posta col messaggio pronto, non parte dal
  // gestionale (decisione di Alessio del 14/08): così una copia resta
  // nella posta inviata e la risposta del fornitore arriva in casella.
  const linkPosta = (bozza) =>
    bozza.email
      ? `mailto:${bozza.email}?subject=${encodeURIComponent(bozza.oggetto ?? "")}&body=${encodeURIComponent(bozza.testoModificato)}`
      : null;

  // Cosa si può fare con questo fornitore, e cosa ha detto lui di
  // preferire. Vuoto vuol dire «non l'ha detto»: si offrono le strade
  // che i recapiti permettono, senza sceglierne una.
  const strade = (bozza) => {
    const puo = [];
    if (bozza.telefono) puo.push("whatsapp");
    if (bozza.email) puo.push("email");
    if (bozza.canale && puo.includes(bozza.canale)) return [bozza.canale];
    return puo;
  };

  const copiaTesto = async (supplierId) => {
    const testo = bozze[supplierId]?.testoModificato ?? "";
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(supplierId);
      setTimeout(() => setCopiato(null), 2000);
    } catch {
      // Su alcuni browser gli appunti sono negati: il testo resta lì da
      // selezionare a mano, ma va detto invece di non far succedere niente.
      setError("Non riesco a copiare da solo: seleziona il testo e copialo a mano.");
    }
  };

  const registra = async (supplierId, via) => {
    const bozza = bozze[supplierId];
    if (!bozza || !bozza.righe?.length) return;
    setInCorso(supplierId);
    setError("");
    try {
      await registraOrdine({
        supplierId,
        testo: bozza.testoModificato,
        righe: bozza.righe,
        canale: via ?? "altro",
      });
      const link = via === "whatsapp" ? linkApp(bozza) : via === "email" ? linkPosta(bozza) : null;
      if (link) window.location.assign(link);
      setBozze((b) => ({ ...b, [supplierId]: null }));
      const { senzaFornitore } = await carica();
      setOrfane(senzaFornitore);
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(null);
    }
  };

  const handleAnnulla = async (ordineId) => {
    setError("");
    try {
      await annullaOrdine(ordineId);
      const { senzaFornitore } = await carica();
      setOrfane(senzaFornitore);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleArrivato = async (ordineId) => {
    setError("");
    try {
      await segnaOrdineRicevuto(ordineId);
      await caricaOrdini();
    } catch (e) {
      setError(e.message);
    }
  };

  const mostraConfronto = async (ingredientId) => {
    if (confronti[ingredientId]) {
      setConfronti((c) => ({ ...c, [ingredientId]: null }));
      return;
    }
    try {
      const righe = await confrontoFornitori(ingredientId);
      setConfronti((c) => ({ ...c, [ingredientId]: righe }));
    } catch (e) {
      setError(e.message);
    }
  };

  const box = "bg-white rounded-xl border border-b58-charcoal/10 p-4 mb-4";

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/magazzino/lista-spesa" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Lista della spesa
      </Link>
      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal mt-2">Ordini ai fornitori</h1>
      <p className="text-b58-charcoal-soft mt-1 mb-6">
        Il messaggio lo prepara il gestionale, lo mandi tu dal tuo telefono.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* Una riga senza fornitore non finisce in nessun ordine. Non è
              un errore da nascondere: è una scelta che deve fare lui. */}
          {orfane.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-b58-charcoal">
                {orfane.length} {orfane.length === 1 ? "riga" : "righe"} senza fornitore
              </p>
              <p className="text-xs text-b58-charcoal-soft mt-1">
                Non entrano in nessun ordine finché non dici a chi chiederle:{" "}
                {orfane.map((r) => r.nome).join(", ")}. Il fornitore si sceglie{" "}
                <Link to="/magazzino/lista-spesa" className="underline">
                  sulla riga, dalla lista della spesa
                </Link>
                .
              </p>
            </div>
          )}

          {gruppi.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60 mb-6">
              Niente da ordinare: nessuna riga della lista è assegnata a un fornitore.
            </p>
          ) : (
            gruppi.map((g) => {
              const bozza = bozze[g.supplier_id];
              return (
                <div key={g.supplier_id} className={box}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-sm font-semibold text-b58-charcoal">{g.nome}</h2>
                      <p className="text-xs text-b58-charcoal-soft">
                        {g.righe.length} {g.righe.length === 1 ? "articolo" : "articoli"} da chiedere
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => apriBozza(g.supplier_id)}
                      className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
                    >
                      {bozza ? "Chiudi" : "Prepara l'ordine"}
                    </button>
                  </div>

                  {bozza && (
                    <div className="mt-4 pt-4 border-t border-b58-charcoal/10">
                      <ul className="space-y-2 mb-4">
                        {(bozza.righe ?? []).map((r) => (
                          <li key={r.riga_lista_id} className="text-sm text-b58-charcoal">
                            <span className="font-medium">{r.descrizione}</span>
                            {r.quantita != null && (
                              <span className="text-b58-charcoal-soft">
                                {" "}
                                — {Number(r.quantita)} {r.unita_fattura ?? r.unita_base ?? ""}
                              </span>
                            )}
                            {/* Due numeri, sempre: se il formato della
                                confezione è sbagliato si vede adesso, non
                                alla consegna. */}
                            {r.quantita_base != null && r.unita_fattura && (
                              <span className="text-xs text-b58-charcoal-soft">
                                {" "}
                                (ti servono {Number(r.quantita_base)} {r.unita_base})
                              </span>
                            )}
                            {r.prezzo_atteso != null && (
                              <span className="text-xs text-b58-charcoal-soft">
                                {" "}
                                · l'ultima volta {formatEUR(Number(r.prezzo_atteso))}/{r.unita_base}
                              </span>
                            )}
                            {!r.dicitura_sua && (
                              <span className="text-[11px] text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 ml-1.5">
                                non so come lo chiama lui
                              </span>
                            )}
                            {r.ingredient_id && (
                              <button
                                type="button"
                                onClick={() => mostraConfronto(r.ingredient_id)}
                                className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark ml-2"
                              >
                                chi altro lo vende?
                              </button>
                            )}
                            {confronti[r.ingredient_id] && (
                              <ul className="mt-1 ml-4 space-y-0.5">
                                {confronti[r.ingredient_id].map((v) => (
                                  <li key={v.articolo_id} className="text-xs text-b58-charcoal-soft">
                                    {v.fornitore ?? "—"} · {v.descrizione} ·{" "}
                                    {v.prezzo != null ? `${formatEUR(Number(v.prezzo))}` : "mai comprato"}
                                    {v.ultima_volta && <> · {formatDate(v.ultima_volta)}</>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>

                      <label className="block text-xs font-medium text-b58-charcoal-soft mb-1">
                        Il messaggio — rileggilo e correggilo prima di mandarlo
                      </label>
                      <textarea
                        rows={8}
                        value={bozza.testoModificato}
                        onChange={(e) => cambiaTesto(g.supplier_id, e.target.value)}
                        className="w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
                      />

                      <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
                        <p className="text-xs text-b58-charcoal-soft">
                          {/* Dove sta per scrivere, scritto per intero prima
                              che prema: è la protezione che vale più di
                              qualunque normalizzazione del numero. */}
                          {strade(bozza).includes("whatsapp") && (
                            <>
                              WhatsApp al <span className="font-medium">+{bozza.telefono}</span>{" "}
                              (in rubrica: {bozza.telefono_scritto}).{" "}
                            </>
                          )}
                          {strade(bozza).includes("email") && (
                            <>
                              Mail a <span className="font-medium">{bozza.email}</span>.{" "}
                            </>
                          )}
                          {strade(bozza).length === 0 && (
                            <>
                              Questo fornitore non ha né numero né mail:{" "}
                              <Link to="/magazzino/fornitori" className="underline">
                                scrivili in anagrafica
                              </Link>
                              , e lì puoi anche dire come preferisce essere contattato.
                            </>
                          )}
                        </p>
                        <div className="flex gap-2">
                          {/* La schermata chiedeva di copiare il testo senza
                              dare un modo per farlo. */}
                          <button
                            type="button"
                            onClick={() => copiaTesto(g.supplier_id)}
                            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
                          >
                            {copiato === g.supplier_id ? "Copiato" : "Copia il testo"}
                          </button>
                          {strade(bozza).map((via) => (
                            <button
                              key={via}
                              type="button"
                              disabled={inCorso === g.supplier_id}
                              onClick={() => registra(g.supplier_id, via)}
                              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                            >
                              {via === "whatsapp" ? "Registra e apri WhatsApp" : "Registra e apri la posta"}
                            </button>
                          ))}
                          {strade(bozza).length === 0 && (
                            <button
                              type="button"
                              disabled={inCorso === g.supplier_id}
                              onClick={() => registra(g.supplier_id, "altro")}
                              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                            >
                              Registra l&apos;ordine
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-b58-charcoal-soft mt-2">
                        Il gestionale non manda niente da solo: apre WhatsApp col messaggio
                        pronto. Resta segnato come inviato — se poi non lo mandi, annullalo qui
                        sotto e le righe tornano in lista.
                        {strade(bozza).includes("whatsapp") && (
                          <>
                            {" "}
                            Se WhatsApp non si apre,{" "}
                            <a
                              href={linkBrowser(bozza)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              aprilo dal browser
                            </a>
                            .
                          </>
                        )}
                        {strade(bozza).includes("email") && (
                          <> Se la posta non si apre, copia il testo e incollalo nella tua casella.</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <h2 className="font-display text-lg text-b58-charcoal mt-8 mb-3">Ordini fatti</h2>
          {ordini.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessun ordine ancora.</p>
          ) : (
            <ul className="space-y-2">
              {ordini.map((o) => (
                <li key={o.id} className={box}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-sm font-medium text-b58-charcoal">{o.fornitore}</span>
                      <span className="text-xs text-b58-charcoal-soft ml-2">
                        {formatDate(o.inviato_il)} · {o.righe}{" "}
                        {o.righe === 1 ? "articolo" : "articoli"} ·{" "}
                        {o.stato === "inviato" && "in attesa"}
                        {o.stato === "ricevuto" && "arrivato"}
                        {o.stato === "annullato" && "annullato"}
                      </span>
                    </div>
                    {o.stato === "inviato" && (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleArrivato(o.id)}
                          className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
                        >
                          È arrivato
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnnulla(o.id)}
                          className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                        >
                          Annulla
                        </button>
                      </div>
                    )}
                  </div>
                  {o.testo && (
                    <pre className="text-xs text-b58-charcoal-soft mt-2 whitespace-pre-wrap font-sans">
                      {o.testo}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
