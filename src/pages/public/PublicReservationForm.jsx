import { useEffect, useState } from "react";
import { getReservationOptions, submitPublicReservation } from "../../lib/api/publicReservations";
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

  // Gli orari in cui siamo in servizio, chiesti al database ogni volta che
  // cambia la data. Finché il titolare non accende l'interruttore
  // (opzioni.attivo = false) resta l'orario libero di prima: il form
  // funziona comunque, non dipende da questa chiamata.
  //
  // ⚠️ Dal 14/08/2026 questa risposta NON contiene nessun numero sulla
  // capienza, e non perché la schermata eviti di mostrarlo: dentro la
  // funzione del database non c'è più nessun conteggio di posti. Il solo
  // freno è la giornata segnata al completo, che qui arriva come
  // `sold_out` e altrove non esiste.
  const [opzioni, setOpzioni] = useState(null);
  const [cercaOrari, setCercaOrari] = useState(false);

  useEffect(() => {
    const persone = Number(form.partySize);
    if (!form.date || !persone || persone < 1) {
      setOpzioni(null);
      return;
    }
    let annullato = false;
    setCercaOrari(true);
    getReservationOptions({ date: form.date, partySize: persone })
      .then((o) => {
        if (annullato) return;
        setOpzioni(o);
        // Se l'orario già scelto nel frattempo non è più libero, si toglie:
        // meglio un campo vuoto che un invio rifiutato dopo aver compilato
        // tutto il resto.
        if (o?.attivo && !(o.orari ?? []).includes(form.time)) {
          setForm((f) => ({ ...f, time: "" }));
        }
      })
      .catch(() => {
        // Se la disponibilità non arriva, non si blocca la prenotazione:
        // si torna all'orario libero e decide comunque il titolare.
        if (!annullato) setOpzioni(null);
      })
      .finally(() => {
        if (!annullato) setCercaOrari(false);
      });
    return () => {
      annullato = true;
    };
    // form.time volutamente fuori: serve solo a ripulire, non a ricaricare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, form.partySize]);

  const sceltaOrari = Boolean(opzioni?.attivo);
  const orariLiberi = opzioni?.orari ?? [];

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
    } catch (e) {
      // I messaggi scritti dalla funzione del database sono pensati per
      // essere letti da un ospite ("Abbiamo già ricevuto le tue richieste…",
      // "Data non valida"): vanno mostrati, non sostituiti da un generico
      // che nasconde anche a noi cosa è successo. Si riconoscono dal codice
      // P0001, che Postgres assegna alle eccezioni scritte a mano nelle
      // nostre funzioni; qualunque altro errore resta generico, per non
      // esporre dettagli tecnici su una pagina pubblica.
      setError(
        e?.code === "P0001" && e?.message
          ? e.message
          : "Non è stato possibile inviare la richiesta. Riprova o contattaci telefonicamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // `min-w-0` non è decorativo: un <input type="date"> ha una larghezza
  // minima propria, decisa dal browser, e dentro una griglia si rifiuta
  // di stringersi sotto quella. Il campo esce dalla sua colonna e finisce
  // sopra a quello accanto — sui telefoni stretti, sempre. Con `min-w-0`
  // la colonna torna a comandare. `appearance-none` toglie l'aspetto
  // nativo di Safari, che aggiunge margini suoi e riporta il disallineamento.
  const inputClass =
    "w-full min-w-0 appearance-none rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
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
            <div className="col-span-2 min-w-0">
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
            <div className="min-w-0">
              <label className={labelClass}>Persone</label>
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
          </div>

          {sceltaOrari ? (
            <div>
              <label className={labelClass}>Orario</label>
              {cercaOrari ? (
                <p className="text-sm text-b58-charcoal-soft">Cerco i posti liberi…</p>
              ) : opzioni.chiuso ? (
                <p className="text-sm text-b58-charcoal-soft bg-b58-cream-dark/60 rounded-lg px-3 py-2">
                  {opzioni.motivo}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {orariLiberi.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, time: o }))}
                      className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                        form.time === o
                          ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                          : "bg-white text-b58-charcoal border-b58-charcoal/15 hover:bg-b58-cream-dark"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
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
          )}

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
            <div className="min-w-0">
              <label className={labelClass}>Telefono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="min-w-0">
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
              prenotazione, in conformità al GDPR.{" "}
              {/* Il collegamento deve stare QUI, accanto alla casella: una
                  informativa raggiungibile solo da un piè di pagina è una
                  informativa che nessuno apre nel momento in cui acconsente. */}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline text-b58-terracotta hover:text-b58-terracotta-dark"
              >
                Leggi l'informativa
              </a>
              .
            </span>
          </label>

          {error && <p className="text-sm text-b58-terracotta-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting || (sceltaOrari && !form.time)}
            className="w-full rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium py-3"
          >
            {submitting ? "Invio…" : "Invia richiesta"}
          </button>
        </form>
      </div>
    </div>
  );
}
