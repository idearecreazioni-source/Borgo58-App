import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  aggiungiDaFare,
  coseDaFare,
  impostaRicorrenza,
  ingredientiCheMancano,
  listProduzioni,
  registraProduzione,
  riepilogoPreparazioni,
  togliDaFare,
} from "../../lib/api/produzioni";
import { addShoppingListItem } from "../../lib/api/shoppingList";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatEUR, formatQta } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";
import DatoNonLetto from "../../components/DatoNonLetto";

// LE PRODUZIONI — registrare i semilavorati fatti in cucina.
//
// I DUE numeri sono il cuore della schermata: quante dosi e quanto ne è
// uscito. Con uno solo non si distingue il calo dalla mezza dose — e
// distinguere è tutto il valore di questo modulo.
//
// 🔴 RIFATTA IL 29/08/2026 (Blocco 3 del mandato), e le decisioni sono di
// Alessio:
//   · 3a — il campo si chiamava «Cosa hai fatto» e la tendina elencava le
//     RICETTE, non le produzioni già fatte. Etichetta al passato su un
//     campo che serve a registrare adesso.
//   · 3b — via la tendina: un elenco di voci cliccabili con la RICERCA, in
//     ordine ALFABETICO. Gli era stato proposto «le più frequenti in cima»
//     e ha preferito l'alfabetico: un elenco che si riordina da solo non
//     si impara mai a memoria.
//   · 3c — lo storico DENTRO ogni voce, così mentre registra vede il
//     paragone.
//   · 3d — la schermata resta SEPARATA dal Magazzino: le altre rispondono
//     a «cosa ho in casa», questa a «ho appena finito di cucinare».
//   · 3e — la lista delle cose da fare.
//   · 3f — le ricorrenti, che seguono i giorni in cui SI LAVORA IN CUCINA
//     e non quelli di apertura al pubblico.
export default function Produzioni() {
  const { isTitolare } = useAuth();
  const [preparazioni, setPreparazioni] = useState(null);
  const [daFare, setDaFare] = useState(null);
  const [fatte, setFatte] = useState([]);
  const [cerca, setCerca] = useState("");
  const [scelta, setScelta] = useState("");
  const [dosi, setDosi] = useState("1");
  const [quantita, setQuantita] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [note, setNote] = useState("");
  const [mancanti, setMancanti] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [ricorrenzaAperta, setRicorrenzaAperta] = useState(null);
  const [ogniGiorni, setOgniGiorni] = useState("7");

  const carica = async () => {
    const [prep, cose, prod] = await Promise.all([
      riepilogoPreparazioni(),
      coseDaFare(),
      listProduzioni({ titolare: isTitolare }),
    ]);
    setPreparazioni(prep);
    setDaFare(cose);
    setFatte(prod);
  };

  useEffect(() => {
    carica().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTitolare]);

  const prep = (preparazioni ?? []).find((p) => p.recipe_id === scelta) ?? null;

  // ⚠️ La ricerca è sul nome e basta: con 41 preparazioni un filtro per
  // categoria sarebbe un secondo menu per un elenco che ci sta in una
  // schermata.
  const elenco = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return preparazioni ?? [];
    return (preparazioni ?? []).filter((p) => p.nome.toLowerCase().includes(q));
  }, [preparazioni, cerca]);

  // Scegliendo si va a vedere quanto è uscito le altre volte e cosa manca:
  // il numero si PROPONE, non si scrive da solo.
  const scegli = async (p) => {
    if (scelta === p.recipe_id) {
      setScelta("");
      setMancanti([]);
      return;
    }
    setScelta(p.recipe_id);
    setNota("");
    const perDose = p.resa_media ?? p.resa_in_ricetta ?? null;
    setQuantita(perDose ? String(Number(perDose) * (Number(dosi) || 1)) : "");
    try {
      setMancanti(await ingredientiCheMancano(p.recipe_id, Number(dosi) || 1));
    } catch {
      // ⚠️ SILENZIO MOTIVATO: senza questa risposta manca un'AVVERTENZA,
      // non un dato — e l'avvertenza non blocca niente per decisione di
      // Alessio. Chi non la riceve è nella stessa condizione in cui era
      // fino al 29/08: registra la produzione, e se un ingrediente manca
      // se ne accorge il magazzino, che scarica quello che c'è e dichiara
      // il resto. Non compare nessun «c'è tutto», che sarebbe il verso
      // pericoloso.
      setMancanti([]);
    }
  };

  const salva = async () => {
    setSalvando(true);
    setError("");
    setNota("");
    try {
      const r = await registraProduzione({
        recipeId: scelta,
        dosi: Number(dosi),
        quantitaOttenuta: Number(quantita),
        scadenza: scadenza || null,
        note: note || null,
      });
      setNota(
        r?.messaggio ??
          `Registrata: ${formatQta(quantita)} ${prep?.unita ?? ""} da ${formatQta(dosi)} ${
            Number(dosi) === 1 ? "dose" : "dosi"
          }.`
      );
      setScelta("");
      setQuantita("");
      setScadenza("");
      setNote("");
      setMancanti([]);
      await carica();
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const esegui = async (fn) => {
    setError("");
    setNota("");
    try {
      const messaggio = await fn();
      if (messaggio) setNota(messaggio);
      await carica();
    } catch (e) {
      setError(e.message);
    }
  };

  const input =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const label = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";
  const BOTTONE =
    "tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-3";

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link
        to="/magazzino"
        className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Magazzino
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-2 mb-6">
        Produzioni
        <Didascalia>
          Quello che si fa in cucina: soffritti, ragù, basi. Registrarne una scarica gli
          ingredienti dal magazzino e mette in cella una partita nuova col costo di oggi —
          i rincari di domani non toccano il ragù già fatto.
        </Didascalia>
      </h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {nota && (
        <p className="testo-sala text-b58-charcoal bg-b58-cream-dark rounded-lg px-3 py-2 mb-4">
          {nota}
        </p>
      )}

      {/* ================================================================
          LE COSE DA FARE — 3e
          ⚠️ STA IN CIMA perché è la domanda con cui si apre questa
          schermata entrando in cucina: *cosa devo fare oggi?* Registrare
          quello che si è appena finito viene dopo.
          ⚠️ E compare SOLO quando c'è qualcosa: un riquadro che dice «non
          c'è niente da fare» ogni giorno si impara a non guardare.
          ================================================================ */}
      {daFare === null ? (
        <DatoNonLetto
          cosa="le cose da fare"
          nonVuolDire="Non vuol dire che non c'è niente da fare: vuol dire che non lo so."
          onRiprova={() => carica().catch((e) => setError(e.message))}
        />
      ) : (
        daFare.length > 0 && (
          <div className="rounded-xl bg-b58-gold/15 ring-1 ring-b58-gold/40 p-4 mb-6">
            <h2 className="font-display testo-sala-grande text-b58-charcoal mb-2">
              Da fare {daFare.length > 1 && <span className="text-b58-charcoal-soft">({daFare.length})</span>}
            </h2>
            <ul className="space-y-2">
              {daFare.map((c) => (
                <li key={c.recipe_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-b58-charcoal font-medium flex-1 min-w-[8rem]">
                    {c.nome}
                  </span>
                  {/* ⚠️ L'ANZIANITÀ SI VEDE, ed è la richiesta di Alessio:
                      una lista in cui una voce può restare per settimane
                      senza che si veda diventa un cimitero. */}
                  <span className="testo-sala text-b58-charcoal-soft">
                    {c.giorni_in_attesa === 0
                      ? "da oggi"
                      : c.giorni_in_attesa === 1
                        ? "da ieri"
                        : `da ${c.giorni_in_attesa} giorni`}
                    {c.da_ricorrenza && c.ricorre_ogni
                      ? ` · ogni ${c.ricorre_ogni} giorni`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = (preparazioni ?? []).find((x) => x.recipe_id === c.recipe_id);
                      if (p) scegli(p);
                    }}
                    className={BOTTONE}
                  >
                    Registrala
                  </button>
                  {/* ⚠️ Si toglie a mano perché una cosa segnata può anche
                      non servire più. Registrando la produzione se ne va da
                      sola — quello lo fa il database, non questa riga. */}
                  <button
                    type="button"
                    onClick={() => esegui(async () => {
                      await togliDaFare(c.recipe_id);
                      return `«${c.nome}» tolta dalle cose da fare.`;
                    })}
                    className="tocco-bottone testo-sala text-b58-charcoal-soft underline"
                  >
                    Toglila
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {/* ================================================================
          QUALE PREPARAZIONE — 3a, 3b, 3c
          ================================================================ */}
      {preparazioni === null ? (
        <DatoNonLetto
          cosa="le preparazioni"
          nonVuolDire="Non vuol dire che non ce ne sono: vuol dire che non lo so."
          onRiprova={() => carica().catch((e) => setError(e.message))}
        />
      ) : preparazioni.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 mb-6">
          Nessuna preparazione nel Ricettario. Una preparazione è una ricetta che non si serve al
          tavolo ma finisce dentro altri piatti.
        </p>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-8">
          {/* 🔴 L'ETICHETTA ERA AL PASSATO su un campo che serve a
              registrare adesso: diceva «Cosa hai fatto» e sotto elencava le
              RICETTE, non le produzioni già fatte — quelle sono l'elenco in
              fondo alla pagina. */}
          <label className={label} htmlFor="cerca-preparazione">
            Quale preparazione
          </label>
          <input
            id="cerca-preparazione"
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca fra le preparazioni…"
            className={`${input} mb-3`}
          />

          {elenco.length === 0 ? (
            <p className="testo-sala text-b58-charcoal-soft">
              Nessuna preparazione con questo nome.
            </p>
          ) : (
            <ul className="divide-y divide-b58-charcoal/5 max-h-[24rem] overflow-y-auto">
              {elenco.map((p) => (
                <li key={p.recipe_id}>
                  <button
                    type="button"
                    onClick={() => scegli(p)}
                    className={`w-full text-left py-2 px-2 rounded-lg transition-colors ${
                      scelta === p.recipe_id ? "bg-b58-terracotta/10" : "hover:bg-b58-cream-dark/50"
                    }`}
                  >
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-b58-charcoal font-medium flex-1 min-w-[8rem]">
                        {p.nome}
                      </span>
                      {p.in_lista && (
                        <span className="testo-sala rounded-full bg-b58-gold text-b58-parchment px-2.5 py-1">
                          da fare
                        </span>
                      )}
                    </span>
                    {/* 🔴 LO STORICO DENTRO LA VOCE — 3c. Serve a vedere il
                        paragone MENTRE si registra: se stavolta costa il
                        doppio, ci si accorge qui e non a fine mese.
                        ⚠️ «Mai fatta» è un'informazione, non un vuoto: dice
                        che non c'è nessun paragone da fare. */}
                    <span className="block testo-sala text-b58-charcoal-soft">
                      {p.quante_volte === 0 ? (
                        "mai fatta"
                      ) : (
                        <>
                          {p.quante_volte === 1 ? "fatta 1 volta" : `fatta ${p.quante_volte} volte`}
                          {p.ultima_il && <> · l&apos;ultima il {formatDate(p.ultima_il)}</>}
                          {p.resa_media != null && (
                            <>
                              {" "}
                              · da una dose escono in media {formatQta(p.resa_media)} {p.unita}
                            </>
                          )}
                          {/* Il costo lo vede solo il titolare: la funzione
                              lo restituisce vuoto agli altri. */}
                          {p.costo_ultimo != null && (
                            <>
                              {" "}
                              · costata {formatEUR(p.costo_ultimo)}
                              {p.costo_precedente != null && (
                                <> (prima {formatEUR(p.costo_precedente)})</>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </button>

                  {/* I due gesti che non sono «registrala»: segnarla da fare
                      e renderla ricorrente. Compaiono sulla riga aperta. */}
                  {scelta === p.recipe_id && (
                    <div className="flex flex-wrap items-center gap-2 pb-2 px-2">
                      {!p.in_lista && (
                        <button
                          type="button"
                          onClick={() => esegui(async () => {
                            const r = await aggiungiDaFare(p.recipe_id, null);
                            return r?.messaggio;
                          })}
                          className={BOTTONE}
                        >
                          Segnala da fare
                        </button>
                      )}
                      {/* 3f — LE RICORRENTI.
                          ⚠️ Seguono i giorni in cui SI LAVORA IN CUCINA, non
                          quelli di apertura al pubblico: il giorno di
                          chiusura è spesso proprio quello delle preparazioni
                          lunghe (decisione di Alessio, 29/08). I due
                          interruttori sono in Sala e orari. */}
                      {ricorrenzaAperta === p.recipe_id ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="testo-sala text-b58-charcoal-soft">rifarla ogni</span>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={ogniGiorni}
                            onChange={(e) => setOgniGiorni(e.target.value)}
                            className="tocco-campo w-20 rounded-lg border border-b58-charcoal/15 bg-white px-2 py-2 testo-sala text-b58-charcoal"
                          />
                          <span className="testo-sala text-b58-charcoal-soft">giorni</span>
                          <button
                            type="button"
                            onClick={() => esegui(async () => {
                              await impostaRicorrenza(p.recipe_id, Number(ogniGiorni));
                              setRicorrenzaAperta(null);
                              return `«${p.nome}» tornerà nelle cose da fare ogni ${ogniGiorni} giorni, nei giorni in cui si lavora in cucina.`;
                            })}
                            className={BOTTONE}
                          >
                            Conferma
                          </button>
                        </span>
                      ) : p.ricorre_ogni ? (
                        <>
                          <span className="testo-sala text-b58-charcoal-soft">
                            si rifà ogni {p.ricorre_ogni} giorni
                          </span>
                          <button
                            type="button"
                            onClick={() => esegui(async () => {
                              await impostaRicorrenza(p.recipe_id, null);
                              return `«${p.nome}» non torna più da sola.`;
                            })}
                            className="tocco-bottone testo-sala text-b58-charcoal-soft underline"
                          >
                            Smetti
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRicorrenzaAperta(p.recipe_id);
                            setOgniGiorni("7");
                          }}
                          className={BOTTONE}
                        >
                          Rendila ricorrente
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {scelta && (
            <div className="border-t border-b58-charcoal/10 mt-4 pt-4">
              {/* 🔴 COSA MANCA — AVVISA, NON BLOCCA (decisione di Alessio).
                  Si può cominciare a cucinare e comprare quello che manca:
                  quello che serve è dirlo qui, con dove andarlo a prendere.
                  ⚠️ I fornitori sono un ELENCO: lo stesso ingrediente si
                  compra da più parti, e la riga lo dice — altrimenti si
                  ordina tre volte credendo di ordinare una. */}
              {mancanti.length > 0 && (
                <div className="rounded-lg bg-b58-gold/20 px-3 py-2 mb-4">
                  <p className="testo-sala text-b58-charcoal font-medium mb-1">
                    Manca qualcosa — si può fare lo stesso:
                  </p>
                  <ul className="space-y-1">
                    {mancanti.map((m) => (
                      <li key={m.ingredient_id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-b58-charcoal flex-1 min-w-[8rem]">
                          {m.nome}: ne servono {formatQta(m.serve)} {m.unita}, ce n&apos;è{" "}
                          {formatQta(m.ce_ne)}
                        </span>
                        <button
                          type="button"
                          onClick={() => esegui(async () => {
                            await addShoppingListItem({
                              ingredientId: m.ingredient_id,
                              quantityNeeded: Number(m.manca),
                              unit: m.unita,
                              supplierId: (m.fornitori ?? [])[0]?.id ?? null,
                              note: `Serve per ${prep?.nome ?? "una preparazione"}`,
                            });
                            return `${m.nome} è nella lista della spesa.`;
                          })}
                          className={BOTTONE}
                        >
                          Mettilo in lista
                        </button>
                        {(m.fornitori ?? []).length > 0 ? (
                          <span className="testo-sala text-b58-charcoal-soft">
                            da {(m.fornitori ?? []).map((f) => f.nome).join(", ")}
                            {(m.fornitori ?? []).length > 1 && (
                              <>
                                {" "}
                                — <Link to="/magazzino/ordini" className="underline">scegli tu</Link>
                              </>
                            )}
                          </span>
                        ) : (
                          // ⚠️ «Non so da chi si compra» è un'informazione, e
                          // va detta: senza fornitore quella riga non entra
                          // in nessun ordine finché lui non lo assegna.
                          <span className="testo-sala text-b58-charcoal-soft/70 italic">
                            non so da chi si compra
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* I DUE NUMERI. Nessuno dei due si può omettere: il
                    database li pretende entrambi. */}
                <div>
                  <label className={label}>Quante dosi di ricetta</label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={dosi}
                    onChange={(e) => setDosi(e.target.value)}
                    className={input}
                  />
                  <p className="testo-sala text-b58-charcoal-soft mt-1">
                    Una volta = 1, doppia = 2, metà = 0,5.
                  </p>
                </div>
                <div>
                  <label className={label}>Quanto ne è uscito ({prep?.unita ?? "kg"})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantita}
                    onChange={(e) => setQuantita(e.target.value)}
                    className={input}
                  />
                  <p className="testo-sala text-b58-charcoal-soft mt-1">
                    Il peso vero, sulla bilancia. È da qui che si scopre la resa.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={label}>Scade il (facoltativo)</label>
                  <input
                    type="date"
                    value={scadenza}
                    onChange={(e) => setScadenza(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Nota (facoltativa)</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className={input} />
                </div>
              </div>

              <button
                type="button"
                disabled={salvando || !dosi || !quantita}
                onClick={salva}
                className="tocco-bottone mt-4 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment testo-sala font-medium px-4"
              >
                {salvando ? "Registro…" : "Registra la produzione"}
              </button>
            </div>
          )}
        </div>
      )}

      <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Fatte di recente</h2>
      {fatte.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60">Nessuna produzione ancora.</p>
      ) : (
        <ul className="space-y-2">
          {fatte.map((p) => (
            <li key={p.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
              <span className="testo-sala font-medium text-b58-charcoal">{p.preparazione}</span>
              <span className="testo-sala text-b58-charcoal-soft ml-2">
                {formatQta(p.quantita_ottenuta)} {p.unita} da {formatQta(p.dosi)}{" "}
                {Number(p.dosi) === 1 ? "dose" : "dosi"}
              </span>
              {p.resa_attesa != null && Number(p.resa_attesa) !== Number(p.quantita_ottenuta) && (
                <span className="testo-sala text-b58-charcoal-soft ml-2">
                  (in ricetta {formatQta(p.resa_attesa)})
                </span>
              )}
              {isTitolare && p.costo != null && (
                <span className="testo-sala text-b58-charcoal-soft ml-2">
                  · costata {formatEUR(Number(p.costo))}
                </span>
              )}
              <span className="testo-sala text-b58-charcoal-soft/70 ml-2">
                {formatDate(p.creato_il)}
              </span>
              {p.note && <div className="testo-sala text-b58-charcoal-soft mt-0.5">{p.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
