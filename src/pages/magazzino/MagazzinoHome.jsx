import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listProdottiTroppoPiccoli,
  listScarichiNonRiusciti,
  listStockLevels,
  recordStockConsumption,
} from "../../lib/api/stock";
import { CONSUMPTION_REASONS, formatDate, formatQta} from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, statoLettura } from "../../lib/calcoli/letture";

const emptyConsumptionForm = { quantity: "", reason: "consumo", note: "" };

// Evidenzia le scadenze vicine: entro 3 giorni rosso, entro 7 giallo.
const expiryUrgency = (dateStr) => {
  if (!dateStr) return "neutral";
  const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (days < 3) return "danger";
  if (days < 7) return "warning";
  return "neutral";
};

export default function MagazzinoHome() {
  const { isTitolare } = useAuth();
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openRow, setOpenRow] = useState(null);
  const [consumptionForm, setConsumptionForm] = useState(emptyConsumptionForm);
  const [saving, setSaving] = useState(false);
  const [nonScaricate, setNonScaricate] = useState([]);
  const [troppoPiccoli, setTroppoPiccoli] = useState([]);

  // I due numeri del riepilogo, contati dalle righe che si vedono sotto.
  // `below_threshold` la calcola la vista: si legge la sua risposta invece di
  // rifare il confronto qui — due posti che decidono «è sotto soglia?»
  // finirebbero per dire due numeri diversi.
  const sottoSoglia = useMemo(() => levels.filter((l) => l.below_threshold).length, [levels]);
  const inScadenza = useMemo(
    () => levels.filter((l) => expiryUrgency(l.nearest_expiry) === "danger").length,
    [levels]
  );

  const load = () => listStockLevels().then(setLevels);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Cio' che i conti chiusi non hanno potuto scaricare. Solo titolare: il
  // database rifiuta gli altri, e chiederlo lo stesso produrrebbe un
  // errore rosso in faccia allo staff per una cosa che non lo riguarda.
  // 🔴 Il catch NON ingoia più: il guard qui sopra copre già il caso
  // legittimo (lo staff non deve chiedere), quindi sotto restavano solo i
  // guasti VERI — e il riquadro compare solo se la lista non è vuota, cioè
  // spariva esattamente come quando è sceso tutto.
  const caricaNonScaricate = () => leggi(listScarichiNonRiusciti()).then(setNonScaricate);
  const caricaTroppoPiccoli = () => leggi(listProdottiTroppoPiccoli()).then(setTroppoPiccoli);
  useEffect(() => {
    if (!isTitolare) return;
    caricaNonScaricate();
    caricaTroppoPiccoli();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTitolare]);

  const toggleRow = (ingredientId) => {
    setOpenRow((r) => (r === ingredientId ? null : ingredientId));
    setConsumptionForm(emptyConsumptionForm);
    setError("");
  };

  const handleConsumption = async (ingredientId) => {
    if (!consumptionForm.quantity) return;
    setSaving(true);
    setError("");
    try {
      await recordStockConsumption({
        ingredientId,
        quantity: Number(consumptionForm.quantity),
        reason: consumptionForm.reason,
        note: consumptionForm.note || null,
      });
      setOpenRow(null);
      setConsumptionForm(emptyConsumptionForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="testo-sala max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Magazzino</h1>
          {/* ⚠️ IL RIEPILOGO IN CIMA (piccolezza del collaudo, 17/08). Prima
              c'era solo «Giacenze, soglie minime, scadenze», che descrive la
              schermata e non dice niente: per sapere se c'era qualcosa da
              fare bisognava scorrere l'elenco riga per riga.
              ⚠️ I due numeri si contano da `levels`, cioè dalle STESSE righe
              che si vedono sotto — non da una seconda interrogazione. Un
              totale che non si può ricontrollare riga per riga è un totale
              *diverso*, non uno *più vero* (regola del 16/08 sui due totali
              del «da pagare»).
              ⚠️ E quando non c'è niente da fare lo dice, invece di sparire:
              un riquadro che compare solo nei guai fa dubitare, quando manca,
              di non averlo visto. */}
          <p className="text-b58-charcoal-soft mt-1">
            {levels.length === 0 ? (
              "Giacenze, soglie minime, scadenze."
            ) : (
              <>
                {sottoSoglia > 0 ? (
                  <strong className="text-b58-terracotta-dark">
                    {sottoSoglia} sotto scorta minima
                  </strong>
                ) : (
                  "nessuno sotto scorta minima"
                )}
                {" · "}
                {inScadenza > 0 ? (
                  <strong className="text-b58-gold-dark">
                    {inScadenza === 1 ? "1 scade" : `${inScadenza} scadono`} entro tre giorni
                  </strong>
                ) : (
                  "niente in scadenza nei prossimi tre giorni"
                )}
                {" — su "}
                {levels.length} {levels.length === 1 ? "ingrediente" : "ingredienti"}.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Anagrafica Fornitori (§3.11): dati economici, titolare-only. */}
          {isTitolare && (
            <Link
              to="/magazzino/fornitori"
              className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
            >
              Fornitori
            </Link>
          )}
          <Link
            to="/magazzino/tracciabilita"
            className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
          >
            Tracciabilità
          </Link>
          <Link
            to="/magazzino/scadenze"
            className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
          >
            Scadenze
          </Link>
          <Link
            to="/magazzino/produzioni"
            className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
          >
            Produzioni
          </Link>
          <Link
            to="/magazzino/allineamento"
            className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
          >
            Allineamento
          </Link>
          <Link
            to="/magazzino/lista-spesa"
            className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
          >
            Lista della spesa
          </Link>
          <Link
            to="/magazzino/carico"
            className="tocco-bottone inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala font-medium px-4"
          >
            + Registra carico
          </Link>
        </div>
      </div>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Compare SOLO quando c'è qualcosa: un riquadro che dice «tutto a
          posto» ogni giorno si impara a non guardare. */}
      {statoLettura(nonScaricate) === "non_letto" && (
        /* 🔴 «Non lo so» al posto del silenzio: senza questa riga, una
           lettura fallita e «è sceso tutto» si leggono uguali — e sotto c'è
           una giacenza che sarebbe più alta del vero senza dirlo. */
        <DatoNonLetto
          cosa="cosa non è sceso dal magazzino"
          nonVuolDire="Non vuol dire che è sceso tutto: vuol dire che non lo so. La giacenza qui sotto potrebbe essere più alta del vero."
          onRiprova={caricaNonScaricate}
          className="mb-6"
        />
      )}

      {statoLettura(nonScaricate) === "pieno" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-6">
          <h2 className="testo-sala font-semibold text-b58-charcoal">
            Cosa non è sceso dal magazzino ({nonScaricate.length})
          </h2>
          <p className="testo-sala text-b58-charcoal-soft mt-1">
            Righe di conti chiusi e di produzioni che la giacenza non ha potuto
            seguire. Non sono state indovinate: la giacenza qui sotto è più alta
            del vero di questo tanto.
          </p>
          {/* 🔴 IL TAGLIO SI DICHIARA (23/08/2026). Le bevande sono uscite da
              questo elenco — erano 1.840 righe tutte uguali che seppellivano
              le tre che contano — ma un elenco che tace su ciò che esclude è
              la stessa famiglia della risposta più corta che ha l'aria di
              essere intera. La frase sta qui, dove sta il dubbio. */}
          <p className="testo-sala text-b58-charcoal-soft mt-1">
            Le bevande non compaiono: il magazzino non le segue.
          </p>
          <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
            {nonScaricate.map((r) => (
              <li key={r.id} className="testo-sala text-b58-charcoal">
                {/* 🔴 UNA RIGA PUÒ VENIRE DA DUE POSTI (23/08/2026): un
                    conto chiuso o una produzione. Fino a stamattina la
                    schermata le chiamava tutte «conto» e le produzioni
                    comparivano col tavolo vuoto — invisibili, perché
                    sepolte sotto 1.840 bevande. */}
                <span className="text-b58-charcoal-soft">
                  {formatDate(r.serata ?? r.quando)} ·{" "}
                  {r.produzione ? `produzione ${r.produzione}` : r.tavolo || "conto senza tavolo"} ·{" "}
                </span>
                {r.tipo === "voce_libera" && "voce libera, nessuna ricetta: "}
                {r.tipo === "ricetta_incompleta" && "ricetta incompleta: "}
                {r.tipo === "giacenza_insufficiente" && "non ce n'era abbastanza: "}
                {r.tipo === "errore" && "guasto durante lo scarico: "}
                <span className="font-medium">{r.descrizione}</span>
                {r.quantita_mancante != null && (
                  <> — mancano {Number(r.quantita_mancante)} {r.unita}</>
                )}
                {/* 🔴 «SCESO A METÀ» NON DEVE ESSERE SILENZIOSO (23/08/2026).
                    Dal 23/08 un ingrediente che non riesce non porta più via
                    lo scarico di tutto il conto: scende il resto. È la cura
                    di un difetto che fermava 148 conti su 346 — ma un
                    magazzino che scende in parte senza dirlo è lo stesso
                    difetto, solo più difficile da vedere. Il numero arriva
                    dal database (`altri_scesi`), non da un conto rifatto
                    qui. */}
                {r.altri_scesi != null && (
                  <span className="text-b58-charcoal-soft">
                    {" "}
                    —{" "}
                    {r.altri_scesi > 0
                      ? `il resto è sceso (${r.altri_scesi} ingredienti)`
                      : "non è sceso nient'altro"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔴 QUELLO CHE IL MAGAZZINO NON RIESCE A SEGUIRE (23/08/2026).
          Compare solo quando c'è qualcosa. Serve perché dal 23/08 un pizzico
          non fa più fallire lo scarico — ed è la cura giusta — ma «non
          fallisce» e «funziona» sono due cose diverse: senza questa riga, un
          prodotto uscito dal conteggio sarebbe silenzioso. */}
      {statoLettura(troppoPiccoli) === "pieno" && (
        <div className="rounded-xl border border-b58-charcoal/15 bg-b58-parchment px-4 py-3 mb-6">
          <h2 className="testo-sala font-semibold text-b58-charcoal">
            Il magazzino non riesce a seguirli ({troppoPiccoli.length})
          </h2>
          <p className="testo-sala text-b58-charcoal-soft mt-1">
            In qualche piatto ne serve così poco che la giacenza non lo sa
            contare: non scende, e non scenderà. Puoi toglierli dal magazzino
            dalla loro scheda nel Ricettario.
          </p>
          <ul className="mt-2 space-y-1">
            {troppoPiccoli.map((p) => (
              <li key={p.ingredient_id} className="testo-sala text-b58-charcoal">
                <span className="font-medium">{p.nome}</span>
                <span className="text-b58-charcoal-soft">
                  {" "}
                  — {p.impieghi_ciechi} di {p.in_piatti}{" "}
                  {p.in_piatti === 1 ? "piatto" : "piatti"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : levels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            Nessun ingrediente ancora. Aggiungili dal Ricettario, poi registra qui i carichi.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full testo-sala">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Ingrediente</th>
                {/* 🔴 NON «Giacenza», e non è una sfumatura: quel numero
                    è quanto ci SAREBBE se ogni ricetta fosse rispettata al
                    grammo. Chiamandolo giacenza si smette di controllarlo —
                    è una stima presentata come dato, la stessa famiglia
                    della sala disegnata vuota. */}
                <th className="px-4 py-3 font-medium">Dovrebbe esserci</th>
                <th className="px-4 py-3 font-medium">Soglia minima</th>
                <th className="px-4 py-3 font-medium">Scade prima</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => {
                const urgency = expiryUrgency(l.nearest_expiry);
                return (
                  <Fragment key={l.ingredient_id}>
                    <tr className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="px-4 py-3 text-b58-charcoal font-medium">
                        {l.ingredient_name}
                        {/* Un prodotto fuori magazzino non è mai «sotto
                            soglia»: la sua giacenza non scende, quindi il
                            confronto non vuol dire niente. */}
                        {l.below_threshold && l.tenuto_in_magazzino !== false && (
                          <span className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 ml-1.5">
                            sotto soglia
                          </span>
                        )}
                      </td>
                      {/* 🔴 UN NUMERO FERMO NON SI MOSTRA COME GIACENZA
                          (23/08/2026). Per i prodotti che il magazzino non
                          segue — le spezie a pizzico — quel numero è quello
                          dell'ultimo carico e non scenderà mai: mostrarlo
                          sarebbe informazione di assenza spacciata per
                          misura. Si dice invece che non lo si sta
                          seguendo. */}
                      <td className="px-4 py-3 text-b58-charcoal-soft">
                        {l.tenuto_in_magazzino === false
                          ? "fuori magazzino"
                          : `${formatQta(l.current_quantity)} ${l.unit}`}
                      </td>
                      {/* Su un prodotto fuori magazzino la soglia non fa
                          niente — non entra in lista della spesa — e
                          mostrarla sarebbe una promessa che nessuno
                          mantiene. */}
                      <td className="px-4 py-3 text-b58-charcoal-soft">
                        {l.tenuto_in_magazzino === false || l.stock_minimum_threshold == null
                          ? "—"
                          : `${formatQta(l.stock_minimum_threshold)} ${l.unit}`}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          urgency === "danger"
                            ? "text-b58-terracotta-dark font-medium"
                            : urgency === "warning"
                            ? "text-b58-gold-dark font-medium"
                            : "text-b58-charcoal-soft"
                        }`}
                      >
                        {formatDate(l.nearest_expiry)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleRow(l.ingredient_id)}
                          disabled={l.current_quantity <= 0}
                          className="tocco-bottone text-b58-charcoal-soft hover:text-b58-terracotta-dark testo-sala disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {openRow === l.ingredient_id ? "Annulla" : "Scarico"}
                        </button>
                      </td>
                    </tr>
                    {openRow === l.ingredient_id && (
                      <tr className="bg-white">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="w-28">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={l.current_quantity}
                                value={consumptionForm.quantity}
                                onChange={(e) =>
                                  setConsumptionForm((f) => ({ ...f, quantity: e.target.value }))
                                }
                                placeholder={`Qtà (${l.unit})`}
                                className={inputClass}
                              />
                            </div>
                            <div className="w-48">
                              <select
                                value={consumptionForm.reason}
                                onChange={(e) =>
                                  setConsumptionForm((f) => ({ ...f, reason: e.target.value }))
                                }
                                className={inputClass}
                              >
                                {CONSUMPTION_REASONS.map((r) => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <input
                                value={consumptionForm.note}
                                onChange={(e) =>
                                  setConsumptionForm((f) => ({ ...f, note: e.target.value }))
                                }
                                placeholder="Nota (opzionale)"
                                className={inputClass}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={saving || !consumptionForm.quantity}
                              onClick={() => handleConsumption(l.ingredient_id)}
                              className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
                            >
                              {saving ? "Salvo…" : "Conferma"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isTitolare && (
        <p className="testo-sala text-b58-charcoal-soft/70 mt-4">
          Giacenze e scadenze, senza valore economico.
        </p>
      )}
    </div>
  );
}
