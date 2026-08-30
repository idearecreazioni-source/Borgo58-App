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

  // 🔴 I DUE GESTI SI SONO SEPARATI (30/08, decisione di Alessio).
  //
  // Fino a stanotte toccare una preparazione APRIVA IL MODULO: dosi, peso
  // uscito, scadenza e nota comparivano sotto, e il tocco faceva due cose
  // in una — «questa mi interessa» e «sto per registrarla». Alessio ha
  // separato i due gesti:
  //   · TOCCARE una preparazione la mette fra le cose da fare, e basta;
  //   · IL MODULO si apre SOLO da «Registrala», già sulla preparazione
  //     giusta.
  //
  // ⚠️ E IL PREZZO SI PAGA QUI, quindi va scritto: per registrare una cosa
  // appena finita servono DUE gesti invece di uno — la si tocca e poi si
  // preme «Registrala» nella sezione qui sopra. È la strada che ha chiesto
  // lui, e la domanda se il doppio passaggio gli pesa è nel riepilogo di
  // stanotte.

  // TOCCARE UNA PREPARAZIONE: entra nelle cose da fare.
  // ⚠️ Non si duplica e non si rompe: se c'è già lo DICE — la barriera vera
  //    è un indice unico nel database, non questa riga.
  const segnaDaFare = (p) =>
    esegui(async () => {
      const r = await aggiungiDaFare(p.recipe_id, null);
      return r?.messaggio ?? `«${p.nome}» è fra le cose da fare.`;
    });

  // «REGISTRALA»: apre il modulo sulla preparazione scelta e propone il
  // peso che di solito ne esce. Il numero si PROPONE, non si scrive da solo.
  const apriModulo = async (recipeId) => {
    const p = (preparazioni ?? []).find((x) => x.recipe_id === recipeId);
    if (!p) return;
    setScelta(recipeId);
    setNota("");
    const perDose = p.resa_media ?? p.resa_in_ricetta ?? null;
    setQuantita(perDose ? String(Number(perDose) * (Number(dosi) || 1)) : "");
    try {
      setMancanti(await ingredientiCheMancano(recipeId, Number(dosi) || 1));
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

  const chiudiModulo = () => {
    setScelta("");
    setMancanti([]);
    setNota("");
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
          DA FARE — sezione sua, in cima (2c)
          🔴 PRIMA ERA INCOLLATA SOPRA IL MODULO e i due si confondevano:
          uno dice «hai questa cosa da fare», l'altro «registra una
          produzione». Adesso è una sezione col suo titoletto e i suoi
          quadrotti, e il modulo non c'è finché non lo si apre.
          ⚠️ Compare SOLO quando c'è qualcosa: un riquadro che dice «non
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
          <section className="mb-8">
            <h2 className="font-display testo-sala-grande text-b58-charcoal mb-2">
              Da fare <span className="text-b58-charcoal-soft">({daFare.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {daFare.map((c) => (
                <div
                  key={c.recipe_id}
                  className="rounded-xl bg-b58-gold/15 ring-1 ring-b58-gold/40 p-3 flex flex-col gap-2"
                >
                  <span className="testo-sala-grande font-medium text-b58-charcoal break-words">
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
                  <div className="flex flex-wrap items-center gap-2 mt-auto">
                    {/* 🔴 «REGISTRALA» ADESSO FA QUELLO CHE DICE (2b): apre
                        il modulo. Prima prometteva di registrare mentre
                        portava a un modulo già aperto più sotto — cioè non
                        succedeva niente di visibile, e chi premeva non
                        capiva se avesse funzionato. */}
                    <button
                      type="button"
                      onClick={() => apriModulo(c.recipe_id)}
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
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      )}

      {/* ================================================================
          IL MODULO — si apre SOLO da «Registrala» (2a)
          🔴 PRIMA ERA SEMPRE APERTO: toccare una preparazione apriva
          dosi, peso, scadenza e nota, e i due gesti si confondevano.
          Adesso toccare una preparazione la mette fra le cose da fare, e
          il modulo compare qui con la preparazione già scelta.
          ⚠️ EFFETTO VOLUTO: quando si sta solo guardando cosa c'è da fare
          la schermata è molto più corta, e sul tablet in cucina si sente.
          ================================================================ */}
      {scelta && prep && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="font-display testo-sala-grande text-b58-charcoal">
              Registra: {prep.nome}
            </h2>
            {/* ⚠️ La via d'uscita c'è: un modulo che si apre e non si può
                chiudere è un vicolo cieco. */}
            <button
              type="button"
              onClick={chiudiModulo}
              className="tocco-bottone testo-sala text-b58-charcoal-soft underline"
            >
              Lascia stare
            </button>
          </div>

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

      {/* ================================================================
          LE PREPARAZIONI — quadrotti, sul telefono E sul computer (2d)
          🔴 IL COMPUTER NON FA ECCEZIONE, ed è una decisione esplicita di
          Alessio con la sua ragione: *quell'elenco non ha colonne da
          confrontare, ha un nome e tre informazioni in fila.* Una tabella
          serve a incolonnare numeri che si guardano uno sotto l'altro.
          ⚠️ TOCCARE UN QUADROTTO LA METTE FRA LE COSE DA FARE e non apre
          niente. Il prezzo di questa scelta è dichiarato: per registrare
          una cosa appena finita servono due gesti — la si tocca e poi si
          preme «Registrala» qui sopra. È la strada che ha chiesto lui, e
          la domanda è nel riepilogo di stanotte.
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
        <section className="mb-8">
          <h2 className="font-display testo-sala-grande text-b58-charcoal mb-2">
            Le preparazioni
          </h2>
          <label className="sr-only" htmlFor="cerca-preparazione">
            Cerca fra le preparazioni
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {elenco.map((p) => (
                <div
                  key={p.recipe_id}
                  className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => segnaDaFare(p)}
                    disabled={p.in_lista}
                    className="text-left p-3 rounded-t-xl disabled:cursor-default hover:bg-b58-cream-dark/50 disabled:hover:bg-transparent transition-colors"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="testo-sala-grande text-b58-charcoal font-medium break-words flex-1 min-w-[6rem]">
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
                    <span className="block testo-sala text-b58-charcoal-soft mt-1">
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
                    {/* 🔴 E IL COSTO DICE SE È INTERO (30/08). Alessio ha
                        visto «costata 0,00 €» su «Busiate trafilate»:
                        misurato, il costo vero era 0,0034 € e 405 grammi di
                        farina erano usciti da un lotto SENZA prezzo
                        d'acquisto, quindi contati zero.
                        ⚠️ Le risposte sono TRE e si dicono in tre modi
                        diversi: intero (non si dice niente), parziale, e —
                        per le produzioni di prima del 30/08 — non lo so. */}
                    {p.costo_stato === "parziale" && (
                      <span className="block testo-sala text-b58-terracotta-dark mt-1">
                        una parte della merce non aveva un prezzo: quel costo è più basso del vero
                      </span>
                    )}
                    {p.costo_ultimo != null && p.costo_stato == null && (
                      <span className="block testo-sala text-b58-charcoal-soft/70 mt-1">
                        registrata prima che il gestionale contasse i lotti senza prezzo: non so se
                        quel costo è intero
                      </span>
                    )}
                  </button>

                  {/* 3f — LE RICORRENTI.
                      ⚠️ Seguono i giorni in cui SI LAVORA IN CUCINA, non
                      quelli di apertura al pubblico: il giorno di chiusura
                      è spesso proprio quello delle preparazioni lunghe
                      (decisione di Alessio, 29/08). I due interruttori
                      sono in Sala e orari.
                      ⚠️ È l'unico gesto oltre al tocco che vive su questo
                      quadrotto, ed è un collegamento piccolo apposta: il
                      tocco grande è quello che si usa ogni giorno. */}
                  <div className="flex flex-wrap items-center gap-2 px-3 pb-3 mt-auto">
                    {ricorrenzaAperta === p.recipe_id ? (
                      <>
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
                      </>
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
                        className="tocco-bottone testo-sala text-b58-charcoal-soft underline"
                      >
                        Rendila ricorrente
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
