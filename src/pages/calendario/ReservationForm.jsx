import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  fabbisognoEvento,
  annullaPrenotazione,
  createReservation,
  getReservation,
  getReservationDeposit,
  listTavoliPrenotazione,
  setReservationDeposit,
  updateReservation,
} from "../../lib/api/reservations";
import { listMenus } from "../../lib/api/menus";
import { trattativeDelGiorno } from "../../lib/api/preventivi";
import DatoNonLetto from "../../components/DatoNonLetto";
import { NON_LETTO, nonLetto } from "../../lib/calcoli/letture";
import { RESERVATION_STATUSES, RESERVATION_TYPES, formatEUR, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  type: "prenotazione",
  reservation_date: "",
  reservation_time: "",
  party_size: 2,
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  notes: "",
  event_type: "",
  event_menu_id: "",
};

const STATUS_ACTIONS = {
  richiesta_in_attesa: [
    { to: "confermata", label: "Conferma", cls: "bg-b58-olive" },
    { to: "rifiutata", label: "Rifiuta", cls: "bg-b58-terracotta" },
  ],
  confermata: [{ to: "annullata", label: "Annulla", cls: "bg-b58-charcoal-soft" }],
  rifiutata: [{ to: "confermata", label: "Conferma comunque", cls: "bg-b58-olive" }],
  // ⚠️ Era una casella vuota: una prenotazione annullata per sbaglio non
  // si poteva più riprendere da nessuna parte, e l'unico rimedio era
  // riscriverla da capo perdendo quando era stata presa (Blocco 5.2 del
  // mandato di correzione). Riconfermandola i tavoli vanno riassegnati
  // dalla pianta: annullando erano stati liberati davvero, e qualcun
  // altro può averli presi nel frattempo.
  annullata: [{ to: "confermata", label: "Riprendi la prenotazione", cls: "bg-b58-olive" }],
};

export default function ReservationForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [customerId, setCustomerId] = useState(null);
  const [deposit, setDeposit] = useState(""); // caparra, solo titolare (tabella separata)
  const [status, setStatus] = useState("confermata");
  const [tavoli, setTavoli] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [needs, setNeeds] = useState(null);
  const [loadingNeeds, setLoadingNeeds] = useState(false);
  const [trattative, setTrattative] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // I menu sono riservati al titolare; lo staff non li carica (RLS).
        if (isTitolare) setMenus(await listMenus());
        if (isEdit) {
          const r = await getReservation(id);
          if (cancelled) return;
          setForm({
            type: r.type,
            reservation_date: r.reservation_date,
            reservation_time: r.reservation_time?.slice(0, 5) ?? "",
            party_size: r.party_size,
            customer_name: r.customer_name,
            customer_phone: r.customer_phone ?? "",
            customer_email: r.customer_email ?? "",
            notes: r.notes ?? "",
            event_type: r.event_type ?? "",
            event_menu_id: r.event_menu_id ?? "",
          });
          setStatus(r.status);
          setCustomerId(r.customer_id);
          const t = await listTavoliPrenotazione(id);
          if (!cancelled) setTavoli(t);
          if (isTitolare) {
            const dep = await getReservationDeposit(id);
            if (!cancelled) setDeposit(dep ?? "");
          }
        }
      } catch (e) {
        if (e.code === "PGRST116") setNotFound(true);
        else if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, isTitolare]);

  // Le trattative aperte di quella sera. ⚠️ Se la lettura fallisce NON si
  // tace: «non ci sono trattative» è una rassicurazione, e chi sta per
  // promettere un tavolo la prenderebbe per buona. La prenotazione si
  // registra comunque — l'avviso non è un blocco — ma si dice.
  useEffect(() => {
    if (!form.reservation_date) {
      setTrattative([]);
      return;
    }
    let cancelled = false;
    trattativeDelGiorno(form.reservation_date)
      .then((r) => {
        if (!cancelled) setTrattative(r);
      })
      .catch(() => {
        if (!cancelled) setTrattative(NON_LETTO);
      });
    return () => {
      cancelled = true;
    };
  }, [form.reservation_date]);

  const isEvent = form.type === "evento";

  const loadNeeds = async () => {
    if (!form.event_menu_id || !form.party_size) return;
    setLoadingNeeds(true);
    setError("");
    try {
      setNeeds(await fabbisognoEvento(form.event_menu_id, Number(form.party_size)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingNeeds(false);
    }
  };

  const totalEstimatedCost = useMemo(
    () => needs?.reduce((sum, n) => sum + Number(n.costo), 0) ?? 0,
    [needs]
  );

  if (notFound) return <Navigate to="/calendario-eventi" replace />;
  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        type: form.type,
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        party_size: Number(form.party_size),
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        notes: form.notes || null,
        event_type: isEvent ? form.event_type || null : null,
        // Il menu evento è un dato commerciale: solo il titolare lo imposta.
        event_menu_id: isEvent && isTitolare ? form.event_menu_id || null : undefined,
      };
      // undefined ⇒ non toccare il campo (utile quando lo staff salva un evento).
      if (payload.event_menu_id === undefined) delete payload.event_menu_id;

      const targetId = isEdit ? id : (await createReservation({ ...payload, source: "interno" })).id;
      if (isEdit) await updateReservation(id, payload);
      // La caparra vive in una tabella separata (solo titolare).
      if (isTitolare && isEvent) await setReservationDeposit(targetId, deposit);
      navigate(`/calendario-eventi/${targetId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setError("");
    try {
      // ⚠️ Annullare e rifiutare non sono un cambio di etichetta: una
      // prenotazione che non ci sarà non deve tenere i suoi tavoli. Da qui
      // non venivano liberati MAI — e il tavolo risultava occupato da
      // qualcuno che non verrà, senza che nessuna schermata lo dicesse.
      if (newStatus === "annullata" || newStatus === "rifiutata") {
        await annullaPrenotazione(id, newStatus);
      } else {
        await updateReservation(id, { status: newStatus });
      }
      setStatus(newStatus);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/calendario-eventi" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario Eventi
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        {isEdit ? "Prenotazione" : "Nuova prenotazione"}
      </h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {isEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4">
          <span className="text-sm text-b58-charcoal">
            Stato: <span className="font-medium">{labelFor(RESERVATION_STATUSES, status)}</span>
            {" · "}
            {/* Dove li fai sedere: si decide sulla pianta, non da qui — un
                secondo posto per assegnare un tavolo sarebbe un secondo
                posto in cui sbagliare. */}
            {tavoli.length > 0 ? (
              <>
                tavolo <span className="font-medium">{tavoli.map((t) => t.etichetta_al_momento).join(" · ")}</span>
              </>
            ) : (
              <span className="text-b58-terracotta-dark">senza tavolo</span>
            )}
            {" · "}
            {/* ⚠️ Non è più un collegamento secco (difetti n. 1 e n. 10 del
                collaudo). Prima portava alla pianta del giorno corrente,
                che non sapeva niente di QUESTA prenotazione: da lì si
                poteva solo crearne una nuova sul tavolo toccato. Ora si
                porta dietro la data e la prenotazione, e la pianta si apre
                già in attesa di sapere dove far sedere questa gente.
                L'app nominava esattamente ciò che mancava — «senza
                tavolo» — e non offriva la strada per rimediare. */}
            <Link
              to={`/calendario-eventi/pianta?data=${form.reservation_date}&assegna=${id}`}
              className="underline text-b58-terracotta"
            >
              {tavoli.length > 0 ? "apri la pianta" : "dai un tavolo dalla pianta"}
            </Link>
          </span>
          <div className="flex gap-2">
            {STATUS_ACTIONS[status].map((a) => (
              <button
                key={a.to}
                onClick={() => handleStatusChange(a.to)}
                className={`${a.cls} text-b58-parchment text-xs font-medium rounded-full px-3 py-1.5`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Tipo</label>
          <div className="flex gap-2">
            {RESERVATION_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.type === t.value
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Data</label>
            <input
              required
              type="date"
              value={form.reservation_date}
              onChange={(e) => setForm((f) => ({ ...f, reservation_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ora</label>
            <input
              required
              type="time"
              value={form.reservation_time}
              onChange={(e) => setForm((f) => ({ ...f, reservation_time: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Coperti</label>
            <input
              required
              type="number"
              min="1"
              value={form.party_size}
              onChange={(e) => setForm((f) => ({ ...f, party_size: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* 🔴 UN PREVENTIVO NON ANCORA ACCETTATO NON BLOCCA NIENTE, ma chi sta
            prendendo una prenotazione per quella sera deve saperlo: il
            gestionale avvisa e lascia decidere. ⚠️ Sta **sotto la data**, dove
            nasce il dubbio, e non in cima alla schermata: un avviso lontano dal
            gesto è un avviso che non c'è (lezione del 17/08). */}
        {nonLetto(trattative) && (
          <DatoNonLetto
            cosa="se per quella sera c'è una trattativa in corso"
            className="mb-1"
          />
        )}

        {!nonLetto(trattative) && trattative.length > 0 && (
          <p className="text-sm text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2">
            Per quella sera {trattative.length === 1 ? "c'è" : "ci sono"}{" "}
            {trattative.length === 1
              ? `una trattativa in corso per ${trattative[0].persone} persone`
              : `${trattative.length} trattative in corso per ${trattative.reduce((s, t) => s + t.persone, 0)} persone in tutto`}
            {trattative[0].cliente ? ` (${trattative.map((t) => t.cliente).join(", ")})` : ""}. Decidi tu.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Nome cliente</label>
            <input
              required
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Telefono
              {customerId && (
                <Link
                  to={`/calendario-eventi/clienti/${customerId}`}
                  className="normal-case font-normal text-b58-terracotta hover:text-b58-terracotta-dark ml-2"
                >
                  vedi scheda cliente
                </Link>
              )}
            </label>
            <input
              value={form.customer_phone}
              onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Note (allergie, occasione speciale…)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </div>

        {isEvent && (
          <div className="border-t border-b58-charcoal/10 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Tipo evento</label>
                <input
                  value={form.event_type}
                  onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                  placeholder='Es. "compleanno"'
                  className={inputClass}
                />
              </div>
              {/* Menu evento e caparra sono dati commerciali: solo titolare (§3.5) */}
              {isTitolare && (
                <>
                  <div>
                    <label className={labelClass}>Menu evento</label>
                    <select
                      value={form.event_menu_id}
                      onChange={(e) => setForm((f) => ({ ...f, event_menu_id: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Nessuno</option>
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Caparra €</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 text-sm"
        >
          {saving ? "Salvo…" : isEdit ? "Salva modifiche" : "Crea prenotazione"}
        </button>
      </form>

      {isTitolare && isEdit && isEvent && form.event_menu_id && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-b58-charcoal">Fabbisogno ingredienti stimato</h2>
            <button
              onClick={loadNeeds}
              disabled={loadingNeeds}
              className="rounded-lg bg-b58-charcoal text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {loadingNeeds ? "Calcolo…" : "Calcola per " + form.party_size + " ospiti"}
            </button>
          </div>
          <p className="text-xs text-b58-charcoal-soft mb-4">
            Quantità scalate sul numero di ospiti, assumendo che ognuno consumi ogni piatto
            del menu scelto. È il fabbisogno teorico, non una verifica di disponibilità reale
            a magazzino (quel controllo arriverà con il modulo Magazzino).
          </p>
          {needs && (
            needs.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft">
                Il menu selezionato non ha ancora ricette con ingredienti.
              </p>
            ) : (
              <>
                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                      <th className="py-2 font-medium">Ingrediente</th>
                      <th className="py-2 font-medium text-right">Quantità necessaria</th>
                      <th className="py-2 font-medium text-right">Costo stimato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needs.map((n) => (
                      <tr key={n.ingredient_id} className="border-b border-b58-charcoal/5 last:border-0">
                        <td className="py-2 text-b58-charcoal">{n.nome}</td>
                        <td className="py-2 text-right text-b58-charcoal-soft">
                          {Number(n.quantita).toFixed(2)} {n.unita}
                        </td>
                        <td className="py-2 text-right text-b58-charcoal">{formatEUR(n.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-right text-sm text-b58-charcoal font-medium">
                  Totale stimato: {formatEUR(totalEstimatedCost)}
                </p>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
