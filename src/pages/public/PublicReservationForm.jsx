import { useState } from "react";
import { submitPublicReservation } from "../../lib/api/publicReservations";
import { oggiLocale } from "../../lib/constants";
import Logo from "../../components/Logo";

const RESPONSE_HOURS = 24; // testo del brief §3.3: "entro [X ore]" — modificabile facilmente qui

const emptyForm = {
  date: "",
  time: "",
  partySize: 2,
  name: "",
  phone: "",
  email: "",
  notes: "",
  consent: false,
};

export default function PublicReservationForm() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Data minima selezionabile. In UTC, dopo mezzanotte il form avrebbe
  // continuato ad accettare "ieri" — che la funzione lato database rifiuta,
  // dando all'ospite un errore incomprensibile.
  const today = oggiLocale();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.phone.trim() && !form.email.trim()) {
      setError("Inserisci almeno un contatto: telefono o email.");
      return;
    }
    if (!form.consent) {
      setError("Devi accettare l'informativa privacy per inviare la richiesta.");
      return;
    }

    setSubmitting(true);
    try {
      await submitPublicReservation({
        date: form.date,
        time: form.time,
        partySize: Number(form.partySize),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
      });
      setDone(true);
    } catch {
      setError("Non è stato possibile inviare la richiesta. Riprova o contattaci telefonicamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-b58-cream px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <div className="bg-b58-parchment rounded-2xl shadow-sm ring-1 ring-b58-charcoal/10 p-8">
            <h1 className="font-display text-xl text-b58-charcoal mb-2">Richiesta inviata</h1>
            <p className="text-sm text-b58-charcoal-soft">
              Grazie! Ti risponderemo entro {RESPONSE_HOURS} ore per confermare la
              disponibilità.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-b58-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-b58-parchment rounded-2xl shadow-sm ring-1 ring-b58-charcoal/10 p-8 space-y-4"
        >
          <div>
            <h1 className="font-display text-lg text-b58-charcoal mb-1">Richiedi un tavolo</h1>
            <p className="text-sm text-b58-charcoal-soft">
              Compila il form: la tua richiesta verrà confermata entro {RESPONSE_HOURS} ore.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Data</label>
              <input
                required
                type="date"
                min={today}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ora</label>
              <input
                required
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Numero di persone</label>
            <input
              required
              type="number"
              min="1"
              max="30"
              value={form.partySize}
              onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Nome e cognome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Telefono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[11px] text-b58-charcoal-soft/70 -mt-2">
            Almeno uno tra telefono ed email.
          </p>

          <div>
            <label className={labelClass}>Note (allergie, occasione speciale…)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-b58-charcoal-soft">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
              className="mt-0.5"
            />
            <span>
              Acconsento al trattamento dei miei dati personali (nome, contatti, eventuali
              note) da parte di Borgo 58 al solo scopo di gestire questa richiesta di
              prenotazione, in conformità al GDPR.
            </span>
          </label>

          {error && <p className="text-sm text-b58-terracotta-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium py-3"
          >
            {submitting ? "Invio…" : "Invia richiesta"}
          </button>
        </form>
      </div>
    </div>
  );
}
