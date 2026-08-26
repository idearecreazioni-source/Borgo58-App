import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listReservations, listRichiesteDaConfermare } from "../../lib/api/reservations";
import { useAuth } from "../../context/AuthContext";
import { RESERVATION_STATUSES, RESERVATION_TYPES, formatDate, labelFor, oggiLocale } from "../../lib/constants";
import { campiPrenotazione } from "../../lib/calcoli/prenotazioni";

const STATUS_BADGE = {
  richiesta_in_attesa: "bg-b58-gold",
  confermata: "bg-b58-olive",
  rifiutata: "bg-b58-terracotta",
  annullata: "bg-b58-charcoal-soft/50",
};

const todayISO = oggiLocale;

export default function ReservationsList() {
  const [reservations, setReservations] = useState([]);
  // Le richieste da confermare stanno FUORI dai filtri: sono la cosa che
  // non deve poter passare inosservata, e i filtri sono fatti apposta per
  // nascondere delle righe.
  const [daConfermare, setDaConfermare] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  // Default: prenotazioni di oggi — la vista utile per preparare la sala.
  const [date, setDate] = useState(todayISO());
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  useEffect(() => {
    setLoading(true);
    listReservations({
      search: search || undefined,
      status: status || undefined,
      type: type || undefined,
      date: date || undefined,
    })
      .then(setReservations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    listRichiesteDaConfermare()
      .then(setDaConfermare)
      .catch((e) => setError(e.message));
  }, [search, status, type, date]);

  // Totale coperti del giorno filtrato (escluse rifiutate/annullate) — utile
  // per dimensionare la sala.
  const totalCovers = useMemo(
    () =>
      reservations
        .filter((r) => r.status === "confermata" || r.status === "richiesta_in_attesa")
        .reduce((sum, r) => sum + (r.party_size || 0), 0),
    [reservations]
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-display text-2xl text-b58-charcoal">Calendario Eventi</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/calendario-eventi/pianta"
            className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
          >
            La sala
          </Link>
          {isTitolare && (
            <Link
              to="/calendario-eventi/sala-e-orari"
              className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
            >
              Sala e orari
            </Link>
          )}
          {/* 🔴 SENZA QUESTO PULSANTE LA SEZIONE NON ESISTEVA, e non è una
              sfumatura: la rotta c'era, la schermata funzionava, e gli unici
              collegamenti stavano DENTRO la scheda di un preventivo — utili
              solo a chi ci era già dentro. Quattro blocchi di lavoro per una
              schermata che nessuna mano poteva raggiungere.
              ⚠️ Trovato da Alessio al primo gesto del collaudo, e NESSUNA
              PROVA L'AVREBBE PRESO: in questo progetto le prove non guardano
              le schermate. */}
          {isTitolare && (
            <Link
              to="/calendario-eventi/preventivi"
              className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
            >
              Preventivi
            </Link>
          )}
          <Link
            to="/calendario-eventi/clienti"
            className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
          >
            Clienti
          </Link>
          <Link
            to="/calendario-eventi/nuova"
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 testo-sala-grande"
          >
            + Nuova prenotazione
          </Link>
        </div>
      </div>

      {daConfermare.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="inline-flex items-center rounded-full bg-b58-gold text-b58-parchment testo-sala font-medium px-2.5 py-1">
              {daConfermare.length}
            </span>
            <h2 className="font-display testo-sala-titolo text-b58-charcoal">
              {daConfermare.length === 1 ? "richiesta da confermare" : "richieste da confermare"}
            </h2>
          </div>
          <p className="testo-sala-grande text-b58-charcoal-soft mb-3">
            Una richiesta non tiene nessun tavolo: il cliente resta in attesa finché non
            gliene dai uno tu dalla{" "}
            <Link to="/calendario-eventi/pianta" className="tocco-inline underline text-b58-terracotta">
              pianta della sala
            </Link>
            .
          </p>
          <ul>
            {daConfermare.map((r) => (
              <li key={r.id} className="border-b border-b58-charcoal/5 last:border-0">
                <button
                  type="button"
                  onClick={() => navigate(`/calendario-eventi/${r.id}`)}
                  className="w-full text-left py-3 px-2 -mx-2 rounded-lg flex flex-wrap items-baseline gap-x-3 gap-y-1 testo-sala-grande hover:bg-b58-cream-dark/40 transition-colors"
                >
                  <span className="text-b58-charcoal font-medium">
                    {formatDate(r.reservation_date)}
                  </span>
                  <span className="text-b58-charcoal-soft">{r.reservation_time?.slice(0, 5)}</span>
                  <span className="text-b58-charcoal">{r.customer_name}</span>
                  <span className="text-b58-charcoal-soft">
                    {r.party_size} coperti
                    {r.customer_phone ? ` · ${r.customer_phone}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        />
        <button
          type="button"
          onClick={() => setDate(todayISO())}
          className="tocco-campo rounded-lg border border-b58-charcoal/15 px-3 py-2 testo-sala-grande text-b58-charcoal-soft hover:bg-b58-cream-dark transition-colors"
        >
          Oggi
        </button>
        <button
          type="button"
          onClick={() => setDate("")}
          className={`tocco-campo rounded-lg border px-3 py-2 testo-sala-grande transition-colors ${
            date
              ? "border-b58-charcoal/15 text-b58-charcoal-soft hover:bg-b58-cream-dark"
              : "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
          }`}
        >
          Tutte le date
        </button>
        {date && (
          <span className="testo-sala-grande text-b58-charcoal-soft">
            {reservations.length} prenotazion{reservations.length === 1 ? "e" : "i"} ·{" "}
            <span className="text-b58-charcoal font-medium">{totalCovers} coperti</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca cliente (nome, telefono, email)…"
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta flex-1 min-w-[220px]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="">Tutti i tipi</option>
          {RESERVATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="">Tutti gli stati</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="testo-sala-grande text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {date
              ? `Nessuna prenotazione per il ${formatDate(date)}.`
              : search || status || type
                ? "Nessuna prenotazione corrisponde ai filtri."
                : "Nessuna prenotazione ancora."}
          </p>
        </div>
      ) : (
        <>
          {/* SUL TELEFONO: un blocchetto per prenotazione, coi dati a capo.
              ⚠️ La riga di prima scorreva di lato, e il dato che si cercava
              stava sempre nella parte fuori schermo. Qui non si scorre: si
              legge. La soglia `md:` è quella che il progetto usa già per
              distinguere telefono e computer (il menu principale). */}
          <div className="md:hidden space-y-2">
            {reservations.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/calendario-eventi/${r.id}`)}
                className="w-full text-left rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-b58-charcoal font-medium">
                    {formatDate(r.reservation_date)} · {r.reservation_time?.slice(0, 5)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full ${STATUS_BADGE[r.status]} text-b58-parchment testo-sala font-medium px-2.5 py-1 shrink-0`}
                  >
                    {labelFor(RESERVATION_STATUSES, r.status)}
                  </span>
                </div>
                {campiPrenotazione(r)
                  .filter((c) => c.chiave !== "data" && c.chiave !== "ora")
                  .map((c) => (
                    <p key={c.chiave} className="testo-sala-grande">
                      <span className="text-b58-charcoal-soft">{c.etichetta}: </span>
                      {c.valore ? (
                        <span className={c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal"}>
                          {c.valore}
                        </span>
                      ) : (
                        <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? "—"}</span>
                      )}
                    </p>
                  ))}
              </button>
            ))}
          </div>

          {/* SUL COMPUTER: la tabella resta — lì funziona, e si cura dove fa
              male (stessa distinzione delle due colonne rimandate). */}
          <div className="hidden md:block rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  {campiPrenotazione(reservations[0]).map((c) => (
                    <th key={c.chiave} className="px-4 py-3 font-medium">
                      {c.etichetta}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/calendario-eventi/${r.id}`)}
                    className="border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                  >
                    {campiPrenotazione(r).map((c) => (
                      <td
                        key={c.chiave}
                        className={`px-4 py-3 ${c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal-soft"}`}
                      >
                        {c.valore || (
                          <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? "—"}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full ${STATUS_BADGE[r.status]} text-b58-parchment testo-sala font-medium px-2.5 py-1`}
                      >
                        {labelFor(RESERVATION_STATUSES, r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
