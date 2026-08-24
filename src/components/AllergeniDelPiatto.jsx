import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  allergeniDelPiatto,
  dimenticaScelta,

  salvaScelta,
  salvaSostituzione,
  togliSostituzione,
} from "../lib/api/recipes";
import { ALLERGENS, formatEUR, labelFor } from "../lib/constants";
import { nonLetto } from "../lib/calcoli/letture";

// GLI ALLERGENI DI UN PIATTO — la scheda dove si decide (24/08/2026,
// blocco 1 del mandato del collaudo).
//
// Alessio: *«per ogni allergene presente nel piatto devo poter dichiarare se
// è ELIMINABILE, CON COSA si sostituisce l'ingrediente e QUANTO COSTA IN
// PIÙ»*. Quello che si scrive qui è ciò che in sala diventa un pulsante
// premibile o un pulsante spento.
//
// ---------------------------------------------------------------------
// TRE STATI, NON DUE
// ---------------------------------------------------------------------
// «Si può togliere», «non si può togliere» e **«non l'ha ancora guardato
// nessuno»**. Il terzo non è un valore predefinito comodo: è l'assenza di
// una dichiarazione, e su una materia di salute la differenza fra «l'ho
// esaminato e non si può» e «non l'ho mai guardato» è tutta la differenza.
// In sala i due «no» si comportano uguale — pulsante spento, si avvisa il
// cliente — e va bene così: fra i due il gestionale sbaglia sempre dalla
// parte di non promettere. Il posto dove la differenza serve è questo.
//
// ---------------------------------------------------------------------
// NON SI PUÒ PROMETTERE UNA COSA A METÀ
// ---------------------------------------------------------------------
// Il lattosio di un piatto può arrivare dal burro **e** dalla panna:
// dichiarando la sola sostituzione del burro e promettendo «senza lattosio»
// si servirebbe a un intollerante un piatto che il lattosio ce l'ha ancora.
// A rifiutare è un trigger del database, non un controllo qui dentro — e il
// rifiuto nomina TUTTI gli ingredienti ancora scoperti. Questa schermata li
// mostra prima, così il rifiuto non è una sorpresa.
// ⚠️ `allergeniFinger` ARRIVA DA FUORI e non si legge qui: la stessa
// mappa serve al pannello che compone la selezione (per filtrare «senza
// glutine») e a questo elenco. Leggerla due volte vorrebbe dire due mappe
// che possono divergere dopo che qualcuno ha cambiato un ingrediente — e a
// restare indietro sarebbe la seconda, in silenzio.
export default function AllergeniDelPiatto({
  recipeId,
  eFinger,
  finger = [],
  ingredienti = [],
  allergeniFinger = null,
}) {
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState("");
  const [aperto, setAperto] = useState(null); // quale allergene è espanso
  const [busy, setBusy] = useState(false);

  const ricarica = async () => {
    try {
      setRighe(await allergeniDelPiatto(recipeId));
      setErrore("");
    } catch (e) {
      // ⚠️ «Non lo so» non è «non ce ne sono»: un elenco vuoto qui si
      // leggerebbe «questo piatto non ha allergeni», che è la frase più
      // pericolosa che questo gestionale possa scrivere.
      setErrore(e.message);
      setRighe([]);
    }
  };

  useEffect(() => {
    ricarica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  // ⚠️ NIENTE SECONDA LETTURA: i portatori arrivano gia' dentro il quadro
  // (20260824000037). Prima si chiedevano a `ingredienti_con_allergene`,
  // che era `security definer` SENZA portiere e aperta a tutto lo staff —
  // trovata dalla rete dei permessi il 24/08. La cura non e' stata mettere
  // un guardiano a quella funzione (la chiama anche un trigger, e dentro
  // una migrazione non c'e' nessun utente): e' stata togliere la chiamata.
  const apri = (allergene) => setAperto(aperto === allergene ? null : allergene);

  const conBusy = async (fn) => {
    setBusy(true);
    setErrore("");
    try {
      await fn();
      await ricarica();
    } catch (e) {
      // ⚠️ Il messaggio del database arriva intero: è lui che nomina gli
      // ingredienti ancora scoperti e dice cosa fare prima.
      setErrore(e.message);
    } finally {
      setBusy(false);
    }
  };

  const etichetta = (a) => labelFor(ALLERGENS, a);

  const coloreStato = {
    eliminabile: "bg-b58-olive/15 text-b58-olive-dark ring-b58-olive/30",
    non_eliminabile: "bg-b58-terracotta/10 text-b58-terracotta-dark ring-b58-terracotta/25",
    non_deciso: "bg-b58-gold/20 text-b58-gold-dark ring-b58-gold-dark/30",
  };
  const paroleStato = {
    eliminabile: "si può togliere",
    non_eliminabile: "non si può togliere",
    non_deciso: "da guardare",
  };

  return (
    <div>
      {/* ⚠️ IL RIFIUTO SI MOSTRA DOVE STA IL DITO (regola del 17/08): se un
          allergene e' aperto, il messaggio va DENTRO il suo pannello. Qui
          resta solo quello che non appartiene a nessun pannello — per
          esempio una lettura fallita. Misurato: in cima al blocco il
          messaggio cadeva a 93 punti (14,5 mm) dal pulsante che l'aveva
          causato, e con la pagina scorsa non si vedeva affatto. */}
      {errore && !aperto && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {errore}
        </p>
      )}

      {righe === null ? (
        <p className="text-sm text-b58-charcoal-soft/60">Leggo gli allergeni…</p>
      ) : righe.length === 0 ? (
        <p className="text-sm text-b58-charcoal-soft/60">
          Nessun allergene risulta dagli ingredienti di questo piatto.
        </p>
      ) : (
        <div className="space-y-2">
          {righe.map((r) => (
            <div
              key={r.allergene}
              className="rounded-lg bg-white ring-1 ring-b58-charcoal/10 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => apri(r.allergene)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-b58-cream-dark/40"
              >
                <span className="flex-1 text-sm text-b58-charcoal font-medium">
                  {etichetta(r.allergene)}
                </span>
                {Number(r.costo_aggiuntivo) > 0 && (
                  <span className="text-xs text-b58-charcoal-soft">
                    +{formatEUR(r.costo_aggiuntivo)}
                  </span>
                )}
                <span
                  className={`text-xs rounded-full px-2.5 py-1 ring-1 ${coloreStato[r.stato]}`}
                >
                  {paroleStato[r.stato]}
                </span>
                <span className="text-b58-charcoal-soft text-xs">
                  {aperto === r.allergene ? "chiudi" : "apri"}
                </span>
              </button>

              {/* ⚠️ GLI INGREDIENTI SCOPERTI SI VEDONO SEMPRE, anche a
                  pannello chiuso: è il motivo per cui il database rifiuterà
                  la dichiarazione, e vederlo dopo è una sorpresa. */}
              {r.scoperti.length > 0 && r.stato !== "non_eliminabile" && (
                <p className="px-3 pb-2 text-xs text-b58-terracotta-dark">
                  Per poterlo togliere manca ancora la sostituzione di:{" "}
                  {r.scoperti.join(", ")}.
                </p>
              )}

              {aperto === r.allergene && (
                <div className="border-t border-b58-charcoal/10 px-3 py-3 bg-b58-cream/40">
                  <PannelloAllergene
                    recipeId={recipeId}
                    riga={r}
                    errore={errore}
                    ingredienti={ingredienti}
                    busy={busy}
                    onSalvaScelta={(eliminabile, nota) =>
                      conBusy(() => salvaScelta(recipeId, r.allergene, { eliminabile, nota }))
                    }
                    onDimentica={() => conBusy(() => dimenticaScelta(recipeId, r.allergene))}
                    onSalvaSostituzione={(dati) =>
                      conBusy(() => salvaSostituzione(recipeId, r.allergene, dati))
                    }
                    onTogliSostituzione={(id) => conBusy(() => togliSostituzione(id))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* L'ELENCO DEI FINGER, ognuno coi suoi allergeni. */}
      {eFinger && finger.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Dove stanno, finger per finger
          </p>
          {allergeniFinger === null ? (
            <p className="text-sm text-b58-charcoal-soft/60">Leggo i finger…</p>
          ) : nonLetto(allergeniFinger) ? (
            // ⚠️ «Non lo so» non è «non ne hanno»: se la lettura è fallita
            // si dichiara, con la via per riprovare. Un elenco di
            // bocconcini tutti senza allergeni è una schermata tranquilla e
            // falsa, e qui la falsità riguarda la salute di qualcuno.
            <p className="text-sm text-b58-terracotta-dark">
              Non sono riuscito a leggere gli allergeni dei finger.{" "}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="underline"
              >
                Riprova
              </button>{" "}
              — finché non si leggono, non promettere niente al cliente.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {finger.map((f) => {
                const a = allergeniFinger[f.id];
                return (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
                  >
                    <Link
                      to={`/ricettario/ricette/${f.id}`}
                      className="text-b58-charcoal hover:text-b58-terracotta"
                    >
                      {f.name}
                    </Link>
                    {/* ⚠️ TRE RISPOSTE ANCHE QUI: «nessuno», «non lo so» e
                        l'elenco. Un trattino muto dove la lettura è fallita
                        si legge «non ne ha». */}
                    {!a || a.allergens.length === 0 ? (
                      <span className="text-b58-charcoal-soft/60">nessuno</span>
                    ) : (
                      a.allergens.map((x) => (
                        <span
                          key={x}
                          className="text-xs bg-b58-terracotta/10 text-b58-terracotta-dark rounded-full px-2 py-0.5"
                        >
                          {etichetta(x)}
                        </span>
                      ))
                    )}
                    {a?.daVerificare && (
                      <span className="text-xs text-b58-terracotta-dark">da verificare</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Il pannello di un singolo allergene: la dichiarazione e le sostituzioni.
function PannelloAllergene({
  riga,
  errore,
  ingredienti,
  busy,
  onSalvaScelta,
  onDimentica,
  onSalvaSostituzione,
  onTogliSostituzione,
}) {
  const [nota, setNota] = useState(riga.nota ?? "");
  const [modifica, setModifica] = useState(null); // ingrediente in modifica
  const portatori = riga.portatori ?? [];
  const [sostituto, setSostituto] = useState("");
  const [costo, setCosto] = useState("");

  const inputClass =
    "rounded border border-b58-charcoal/15 bg-white px-2 py-1 text-sm text-b58-charcoal";

  const apriModifica = (p) => {
    setModifica(p);
    const gia = (riga.sostituzioni ?? []).find((s) => s.ingrediente_id === p.id);
    // ⚠️ Il pannello riparte da quello che c'e' gia' scritto: aprirlo vuoto
    //    farebbe credere che non ci sia niente, e salvando si perderebbe il
    //    sostituto scelto la volta prima.
    setSostituto(gia?.sostituto_id ?? "");
    setCosto(gia ? String(gia.costo) : "");
  };

  return (
    <div className="space-y-3">
      {/* ⚠️ Il rifiuto del database, accanto al gesto che l'ha causato: e'
          lui che nomina gli ingredienti ancora scoperti e dice cosa fare
          prima. */}
      {errore && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{errore}</p>
      )}

      {/* LA DICHIARAZIONE */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSalvaScelta(true, nota)}
          className={`rounded-full text-xs px-3 py-1.5 border transition-colors disabled:opacity-50 ${
            riga.stato === "eliminabile"
              ? "bg-b58-olive text-b58-parchment border-b58-olive"
              : "border-b58-charcoal/15 text-b58-charcoal-soft"
          }`}
        >
          Si può togliere
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSalvaScelta(false, nota)}
          className={`rounded-full text-xs px-3 py-1.5 border transition-colors disabled:opacity-50 ${
            riga.stato === "non_eliminabile"
              ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
              : "border-b58-charcoal/15 text-b58-charcoal-soft"
          }`}
        >
          Non si può togliere
        </button>
        {riga.stato !== "non_deciso" && (
          // ⚠️ LA VIA D'USCITA ESISTE, e riporta al terzo stato: senza, una
          // volta dichiarato non si potrebbe più tornare a «non lo so», e
          // l'unico modo di correggersi sarebbe dire una cosa falsa.
          <button
            type="button"
            disabled={busy}
            onClick={onDimentica}
            className="text-xs text-b58-charcoal-soft underline disabled:opacity-50"
          >
            torna a «da guardare»
          </button>
        )}
      </div>

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onBlur={() => {
          if (riga.stato !== "non_deciso" && (riga.nota ?? "") !== nota) {
            onSalvaScelta(riga.stato === "eliminabile", nota);
          }
        }}
        placeholder="nota (facoltativa) — es. «la panatura non si può togliere»"
        className={`${inputClass} w-full`}
      />

      {/* GLI INGREDIENTI CHE PORTANO QUESTO ALLERGENE */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5">
          Da dove arriva
        </p>
        {portatori.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">
            Nessun ingrediente di questo piatto porta questo allergene.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {portatori.map((p) => {
              // ⚠️ La sostituzione si aggancia per IDENTIFICATIVO e non per
              //    nome: due ingredienti si possono chiamare uguale, e un
              //    abbinamento per nome li scambierebbe senza nessun errore.
              const s = (riga.sostituzioni ?? []).find((x) => x.ingrediente_id === p.id);
              return (
                <li key={p.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-b58-charcoal">{p.nome}</span>
                    {p.coperto ? (
                      <span className="text-b58-olive-dark">
                        →{" "}
                        {s?.sostituto ?? p.sostituto ?? "si toglie e basta"}
                        {s && Number(s.costo) > 0 && ` · +${formatEUR(s.costo)}`}
                      </span>
                    ) : (
                      <span className="text-b58-terracotta-dark">nessuna sostituzione</span>
                    )}
                    <button
                      type="button"
                      onClick={() => apriModifica(p)}
                      className="text-xs text-b58-terracotta underline"
                    >
                      {p.coperto ? "cambia" : "sostituisci"}
                    </button>
                    {p.coperto && s && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onTogliSostituzione(s.id)}
                        className="text-xs text-b58-charcoal-soft underline disabled:opacity-50"
                      >
                        togli
                      </button>
                    )}
                  </div>

                  {modifica?.id === p.id && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded bg-white ring-1 ring-b58-charcoal/10 p-2">
                      {/* ⚠️ IL SOSTITUTO SI SCRIVE COL SUO NOME e deve
                          esistere in magazzino come prodotto suo: il burro
                          senza lattosio è un prodotto diverso dal burro, con
                          un prezzo diverso — è il magazzino che deve scalare
                          quello giusto. */}
                      <SceltaSostituto valore={sostituto} onCambia={setSostituto} ingredienti={ingredienti} />
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        value={costo}
                        onChange={(e) => setCosto(e.target.value)}
                        placeholder="+€ (0 = niente)"
                        className={`${inputClass} w-28`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          onSalvaSostituzione({
                            ingredienteId: p.id,
                            sostitutoId: sostituto || null,
                            costoAggiuntivo: Number(costo) || 0,
                          });
                          setModifica(null);
                        }}
                        className="rounded bg-b58-terracotta text-b58-parchment text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={() => setModifica(null)}
                        className="text-xs text-b58-charcoal-soft underline"
                      >
                        annulla
                      </button>
                      <p className="w-full text-xs text-b58-charcoal-soft">
                        Lascia vuoto il prodotto se l&apos;ingrediente si toglie e basta (es. «senza
                        noci»).
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// La tendina degli ingredienti fra cui scegliere il sostituto.
// ⚠️ L'anagrafica ARRIVA DA FUORI: la scheda della ricetta l'ha già letta
// per il suo elenco di ingredienti, e leggerla una seconda volta qui
// vorrebbe dire due liste che possono divergere dopo che qualcuno ne crea
// uno nuovo — la trappola del menu che resta vuoto (12/08).
function SceltaSostituto({ valore, onCambia, ingredienti }) {

  return (
    <select
      value={valore}
      onChange={(e) => onCambia(e.target.value)}
      className="rounded border border-b58-charcoal/15 bg-white px-2 py-1 text-sm text-b58-charcoal max-w-[16rem]"
    >
      <option value="">(si toglie e basta)</option>
      {(ingredienti ?? []).map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
    </select>
  );
}
