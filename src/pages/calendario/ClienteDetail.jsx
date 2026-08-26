import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import {
  deleteCustomer,
  getCustomer,
  listCustomerDiscounts,
  listCustomerReservations,
  listCustomers,
  mergeCustomers,
  registraConsenso,
  revocaConsenso,
  storiaCliente,
  updateCustomer,
} from "../../lib/api/customers";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { campiCambiatiDalGesto, ilConsenso } from "../../lib/calcoli/ricarica";
import {
  DISCOUNT_GIFT_TYPES,
  RESERVATION_STATUSES,
  formatDate,
  formatEUR,
  labelFor,
} from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [reservations, setReservations] = useState([]);
  // Storico economico: caricato solo per il titolare. Non è la barriera —
  // quella è la RLS su discounts_gifts (§3.4/§3.18), che allo staff
  // restituirebbe comunque una lista vuota — serve solo a non fare una
  // richiesta che sappiamo già inutile.
  const [discounts, setDiscounts] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeOptions, setMergeOptions] = useState([]);
  const [merging, setMerging] = useState(false);
  const [storia, setStoria] = useState([]);
  const [comeConsenso, setComeConsenso] = useState("");
  const [salvandoConsenso, setSalvandoConsenso] = useState(false);

  const load = () =>
    Promise.all([
      getCustomer(id),
      listCustomerReservations(id),
      isTitolare ? listCustomerDiscounts(id) : Promise.resolve([]),
      // ⚠️ La storia è del titolare, e se non arriva NON si finge un elenco
      // vuoto: si dichiara (regola del blocco A).
      isTitolare ? leggi(storiaCliente(id)) : Promise.resolve([]),
    ]).then(([c, res, dg, st]) => {
      setCustomer(c);
      setReservations(res);
      setDiscounts(dg);
      setStoria(st);
    });


  // ⚠️ DOPO UN GESTO SI RIPRENDE DAL SERVER SOLO CIÒ CHE IL GESTO HA
  // CAMBIATO. Registrare il consenso cambia le sue date e la storia: NON il
  // nome, non il telefono, non l'email — che possono essere in mezzo a una
  // modifica non ancora salvata. Prima si rileggeva tutta la scheda, e
  // l'email appena scritta spariva senza nessun errore (trovato dalle mani
  // di Alessio, 21/08). La regola sta in `src/lib/calcoli/ricarica.js`.
  const ricaricaIlConsenso = () =>
    Promise.all([
      getCustomer(id),
      isTitolare ? leggi(storiaCliente(id)) : Promise.resolve([]),
    ]).then(([fresco, st]) => {
      setCustomer((c) => ({ ...c, ...campiCambiatiDalGesto(fresco, ilConsenso) }));
      setStoria(st);
    });

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    // isTitolare tra le dipendenze: il ruolo arriva in modo asincrono
    // (AuthContext), quindi al primo render può essere ancora falso — senza
    // ricaricare, lo storico economico resterebbe vuoto anche per il titolare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isTitolare]);

  useEffect(() => {
    if (!showMerge) return;
    listCustomers({ search: mergeSearch || undefined })
      .then((rows) => setMergeOptions(rows.filter((c) => c.id !== id)))
      .catch((e) => setError(e.message));
  }, [showMerge, mergeSearch, id]);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleChange = (field, value) => setCustomer((c) => ({ ...c, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateCustomer(id, {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notes: customer.notes,
      });
      setCustomer((c) => ({ ...c, ...updated }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer(id);
      navigate("/calendario-eventi/clienti");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMerge = async (mergeIntoThisId) => {
    setMerging(true);
    setError("");
    try {
      await mergeCustomers(id, mergeIntoThisId);
      setShowMerge(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMerging(false);
    }
  };

  // Aggregazioni: nessuna AI, sole somme (§3.8/§3.14). Per un omaggio il
  // mancato incasso è l'intero valore a listino; per uno sconto è la parte
  // non incassata.
  const gifts = discounts.filter((d) => d.type === "omaggio");
  const sconti = discounts.filter((d) => d.type === "sconto");
  const giftsTotal = gifts.reduce((s, d) => s + Number(d.full_amount), 0);
  const scontiForgone = sconti.reduce(
    (s, d) => s + (Number(d.full_amount) - Number(d.collected_amount)),
    0
  );

  if (notFound) return <Navigate to="/calendario-eventi/clienti" replace />;
  if (loading || !customer) {
    return <p className="testo-sala-grande text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/calendario-eventi/clienti" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Clienti
      </Link>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <input
            value={customer.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nome cliente"
            className="font-display text-2xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none flex-1 min-w-[200px]"
          />
          <div className="text-right">
            <div className="text-xl text-b58-charcoal font-medium">
              {customer.stats?.reservation_count ?? 0}
            </div>
            <div className="testo-sala text-b58-charcoal-soft">prenotazioni</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Telefono</label>
            <input
              value={customer.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              value={customer.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Note (preferenze, allergie, occasioni speciali)</label>
          <textarea
            value={customer.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        {/* 🔴 IL CONSENSO — e sono DUE COSE DIVERSE, tenute separate apposta:
            confermargli il tavolo non ha bisogno di niente, mandargli il menu
            del mese sì. Qui si registra solo la seconda. */}
        {isTitolare && (
          <div className="mb-4 rounded-lg bg-b58-cream-dark/40 px-3 py-2.5">
            {/* 🔴 SI LEGGE LA RISPOSTA, non si rifà il conto sulle due date:
                `puo_ricevere_commerciali` è calcolata dal database, e
                ricalcolarla qui sarebbe un secondo posto dove vive la stessa
                regola — cioè due posti che possono contraddirsi. */}
            {customer.puo_ricevere_commerciali ? (
              <>
                <p className="testo-sala-grande text-b58-charcoal">
                  Gli si può scrivere anche fuori dalle sue prenotazioni — te l&apos;ha detto{" "}
                  {customer.consenso_come} il {formatDate(customer.consenso_commerciale_il)}.
                </p>
                <button
                  type="button"
                  disabled={salvandoConsenso}
                  onClick={async () => {
                    setSalvandoConsenso(true);
                    setError("");
                    try {
                      const r = await revocaConsenso(id);
                      await ricaricaIlConsenso();
                      setError("");
                      window.alert(r.frase);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setSalvandoConsenso(false);
                    }
                  }}
                  className="testo-sala text-b58-charcoal-soft underline mt-1"
                >
                  Ha chiesto di non ricevere più niente
                </button>
              </>
            ) : (
              <>
                <p className="testo-sala-grande text-b58-charcoal mb-2">
                  {customer.consenso_revocato_il
                    ? `Si è cancellato il ${formatDate(customer.consenso_revocato_il)}: non riceve comunicazioni.`
                    : "Non gli è mai stato chiesto se gli si può scrivere fuori dalle sue prenotazioni."}
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <input
                    value={comeConsenso}
                    onChange={(e) => setComeConsenso(e.target.value)}
                    placeholder="Come te l'ha detto (al telefono, di persona…)"
                    className={`${inputClass} max-w-xs`}
                  />
                  <button
                    type="button"
                    disabled={salvandoConsenso || !comeConsenso.trim()}
                    onClick={async () => {
                      setSalvandoConsenso(true);
                      setError("");
                      try {
                        await registraConsenso(id, comeConsenso);
                        setComeConsenso("");
                        await ricaricaIlConsenso();
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setSalvandoConsenso(false);
                      }
                    }}
                    className="rounded-lg bg-b58-olive text-b58-parchment testo-sala-grande px-3 py-2 disabled:opacity-60"
                  >
                    Ha detto di sì
                  </button>
                </div>
                {/* ⚠️ Il «come» si pretende: fra un anno «c'è la spunta» non
                    risponde a nessuna contestazione. */}
              </>
            )}
          </div>
        )}

        {isTitolare && nonLetto(storia) && (
          <DatoNonLetto cosa="cosa gli è stato mandato e cosa ha scritto" className="mb-4" />
        )}
        {isTitolare && !nonLetto(storia) && storia.length > 0 && (
          <details className="mb-4">
            <summary className="testo-sala-grande text-b58-charcoal-soft cursor-pointer">
              Cosa ci siamo detti ({storia.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {storia.map((r, i) => (
                <li key={i} className="testo-sala text-b58-charcoal">
                  <span className="text-b58-charcoal-soft">
                    {formatDate(r.quando)} ·{" "}
                    {r.verso === "uscita" ? "→" : r.verso === "entrata" ? "←" : "·"}{" "}
                  </span>
                  {r.dettaglio}
                </li>
              ))}
            </ul>
          </details>
        )}

        {customer.stats?.first_reservation_date && (
          <p className="testo-sala text-b58-charcoal-soft mb-4">
            Cliente dal {formatDate(customer.stats.first_reservation_date)} · ultima visita{" "}
            {formatDate(customer.stats.last_reservation_date)}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-3">
            {isTitolare && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMerge((v) => !v)}
                  className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                >
                  {showMerge ? "Annulla unione" : "Unisci con un'altra scheda"}
                </button>
                <ConfermaDistruttiva
                  etichetta="Elimina scheda"
                  cosaSparisce={`la scheda di ${customer.name || "questo cliente"}, con i suoi recapiti e le sue note`}
                  onConferma={handleDelete}
                />
              </>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment testo-sala-grande font-medium px-4 py-2"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>

        {showMerge && (
          <div className="mt-4 pt-4 border-t border-b58-charcoal/10">
            <p className="testo-sala text-b58-charcoal-soft/70 mb-2">
              Le prenotazioni della scheda scelta passano qui, e quella scheda viene eliminata. Operazione non reversibile.
            </p>
            <input
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              placeholder="Cerca la scheda da unire…"
              className={`${inputClass} mb-2`}
            />
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {mergeOptions.map((opt) => (
                <li key={opt.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                  <span className="testo-sala-grande text-b58-charcoal">
                    {opt.name || "—"} <span className="text-b58-charcoal-soft">· {opt.phone}</span>
                  </span>
                  <button
                    type="button"
                    disabled={merging}
                    onClick={() => handleMerge(opt.id)}
                    className="tocco-testo testo-sala text-b58-terracotta hover:text-b58-terracotta-dark disabled:opacity-60"
                  >
                    Unisci qui
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Storico prenotazioni</h2>
        {reservations.length === 0 ? (
          <p className="testo-sala-grande text-b58-charcoal-soft/60">Nessuna prenotazione ancora.</p>
        ) : (
          <ul className="space-y-1.5">
            {reservations.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/calendario-eventi/${r.id}`}
                  className="testo-sala-grande text-b58-charcoal hover:text-b58-terracotta flex items-center justify-between"
                >
                  <span>
                    {formatDate(r.reservation_date)} · {r.reservation_time?.slice(0, 5)} · {r.party_size} coperti
                  </span>
                  <span className="testo-sala text-b58-charcoal-soft">{labelFor(RESERVATION_STATUSES, r.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Livello riservato della scheda (§3.14/§3.18): la barriera vera è la
          RLS titolare-only su discounts_gifts (§3.4) — allo staff la lista
          arriverebbe vuota anche senza questo blocco condizionale. */}
      {isTitolare && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal">Sconti e omaggi ricevuti</h2>
            <span className="testo-sala uppercase tracking-wide text-b58-charcoal-soft bg-b58-charcoal/5 rounded-full px-2 py-0.5">
              Riservato
            </span>
          </div>
          <p className="testo-sala text-b58-charcoal-soft/70 mb-4">
            Sezione visibile solo a te: lo staff vede questa scheda senza i dati economici.
          </p>

          {discounts.length === 0 ? (
            <p className="testo-sala-grande text-b58-charcoal-soft/60">
              Nessuno sconto o omaggio collegato a questo cliente.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                  <div className="testo-sala-titolo text-b58-charcoal">{formatEUR(giftsTotal)}</div>
                  <div className="testo-sala text-b58-charcoal-soft">
                    {gifts.length} {gifts.length === 1 ? "omaggio" : "omaggi"} · valore a listino
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                  <div className="testo-sala-titolo text-b58-charcoal">{formatEUR(scontiForgone)}</div>
                  <div className="testo-sala text-b58-charcoal-soft">
                    {sconti.length} {sconti.length === 1 ? "sconto" : "sconti"} · mancato incasso
                  </div>
                </div>
              </div>

              <ul className="space-y-1.5">
                {discounts.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 testo-sala-grande bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-b58-charcoal font-medium">
                        {labelFor(DISCOUNT_GIFT_TYPES, d.type)}
                      </span>
                      <span className="text-b58-charcoal-soft"> · {formatDate(d.movement_date)}</span>
                      {d.causale?.label && (
                        <span className="text-b58-charcoal-soft"> · {d.causale.label}</span>
                      )}
                      {d.note && <div className="testo-sala text-b58-charcoal-soft">{d.note}</div>}
                    </div>
                    <span className="text-b58-charcoal shrink-0">
                      {formatEUR(d.full_amount)}
                      {d.type === "sconto" && (
                        <span className="text-b58-charcoal-soft">
                          {" "}
                          (incassato {formatEUR(d.collected_amount)})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* 🔴 QUESTA FRASE ERA DIVENTATA FALSA, e in due punti (24/08/2026,
              trovata dal censimento delle didascalie). Diceva che la spesa
              media non si può calcolare perché «servono le comande, previste
              dopo l'acquisto dell'hardware in autunno 2026»: le comande
              esistono dall'8-9 agosto, e quell'autunno è passato.

              ⚠️ E LA RAGIONE VERA È UN'ALTRA, misurata invece che dedotta:
              la colonna che lega il conto al cliente c'è. Quello che manca è
              che venga riempita — sul progetto di prova un conto su 349 sa
              chi era il cliente. Non è un pezzo che manca al gestionale: è un
              gesto che in sala non si fa, e finché non si fa il numero
              sarebbe una media su un caso.

              ⚠️ Resta VISIBILE perché è un limite di ciò che si sta
              guardando, non una spiegazione: chi legge questa scheda deve
              sapere che «quanto spende» non c'è, o lo cercherà altrove. */}
          <p className="testo-sala text-b58-charcoal-soft mt-4 pt-4 border-t border-b58-charcoal/10">
            ⚠️ Quanto spende in media non c&apos;è: il conto in sala quasi mai registra chi
            era il cliente, e su un caso solo non si fa una media.
          </p>
        </div>
      )}
    </div>
  );
}
