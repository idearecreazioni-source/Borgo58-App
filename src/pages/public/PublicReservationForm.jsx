import { useEffect, useState } from "react";
import {
  getGiorniChiusi,
  getReservationOptions,
  submitPublicReservation,
} from "../../lib/api/publicReservations";
import { formatDate, oggiLocale } from "../../lib/constants";
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

  // LE DATE IN CUI SIAMO CHIUSI, chieste una volta sola all'apertura.
  //
  // ⚠️ Servono a due cose, e la prima e' quella che conta: il campo data
  // non parte da oggi, parte dal **primo giorno in cui si mangia qui**.
  // Un campo data del browser non sa spegnere i singoli giorni — sa solo
  // avere un minimo — quindi questo e' l'unico posto in cui una data
  // chiusa si puo' davvero rendere non selezionabile. Per tutte le altre
  // c'e' il rifiuto immediato qui sotto, li' dove si e' toccato.
  const [giorniChiusi, setGiorniChiusi] = useState([]);

  useEffect(() => {
    let annullato = false;
    getGiorniChiusi()
      .then((g) => {
        if (!annullato) setGiorniChiusi(g);
      })
      // ⚠️ SILENZIO MOTIVATO: senza questo elenco il campo parte da oggi,
      // che e' come si comportava fino al 29/08. Nessuna rassicurazione
      // falsa — chi sceglie un giorno chiuso viene fermato lo stesso, dal
      // database, che e' il posto dove quel rifiuto vive davvero.
      .catch(() => {});
    return () => {
      annullato = true;
    };
  }, []);

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
        // ⚠️ SILENZIO MOTIVATO, e la ragione è che qui il vuoto NON è
        // ambiguo: senza le opzioni il modulo torna all'orario libero, che
        // è lo stato dichiarato di questa pagina quando le prenotazioni
        // online sono spente. Chi legge non riceve nessuna rassicurazione
        // falsa — non gli viene detto che c'è posto — e la richiesta la
        // conferma comunque il titolare, a mano, come sempre.
        // ⚠️ E il destinatario è un OSPITE, non Alessio: una riga tecnica
        // su una pagina pubblica non gli servirebbe a decidere niente.
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

  // 🔴 LA CHIUSURA VALE ANCHE A INTERRUTTORE SPENTO — 29/08/2026.
  //
  // Fino a oggi tutto cio' che riguardava la chiusura viveva dentro il ramo
  // `opzioni.attivo`: a interruttore spento il modulo tornava all'orario
  // libero e **accettava una richiesta per un giorno chiuso** — misurato
  // sul progetto di prova, dove l'interruttore e' spento. Nessun errore,
  // nessun avviso: la richiesta entrava.
  //
  // ⚠️ E `!cercaOrari` non e' prudenza: mentre si cerca, `opzioni` e'
  // ancora la risposta della data PRECEDENTE. Senza quel guardiano, il
  // modulo direbbe «siamo chiusi» del giorno prima per un attimo, cioe'
  // una frase vera su un'altra data.
  const giornoChiuso = !cercaOrari && Boolean(opzioni?.chiuso);
  const sceltaOrari = Boolean(opzioni?.attivo) && !giornoChiuso;
  const orariLiberi = opzioni?.orari ?? [];

  // Il primo giorno in cui si mangia qui: da li' parte il campo data.
  const primoGiornoUtile = (() => {
    const chiusi = new Set(giorniChiusi);
    const d = new Date(`${today}T12:00:00`);
    // Trenta tentativi: oltre, o l'elenco e' sbagliato o il locale e'
    // chiuso per un mese, e in tutt'e due i casi il campo torna a oggi
    // invece di inventarsi una data.
    for (let i = 0; i < 30; i += 1) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!chiusi.has(iso)) return iso;
      d.setDate(d.getDate() + 1);
    }
    return today;
  })();

  // Se la data scelta e' chiusa, qual e' la prima aperta DOPO di lei. Una
  // porta chiusa senza indicazione di dove sia quella aperta e' un vicolo
  // cieco, e i vicoli ciechi sono un difetto a se'.
  const primaApertaDopo = (() => {
    if (!giornoChiuso || !form.date) return "";
    const chiusi = new Set(giorniChiusi);
    const d = new Date(`${form.date}T12:00:00`);
    for (let i = 0; i < 30; i += 1) {
      d.setDate(d.getDate() + 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!chiusi.has(iso)) return iso;
    }
    return "";
  })();

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
    "w-full min-w-0 appearance-none rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-b58-cream px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <div className="bg-b58-parchment rounded-2xl shadow-sm ring-1 ring-b58-charcoal/10 p-8">
            <h1 className="font-display text-xl text-b58-charcoal mb-2">Richiesta inviata</h1>
            <p className="testo-sala-grande text-b58-charcoal-soft">
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
            <h1 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Richiedi un tavolo</h1>
            <p className="testo-sala-grande text-b58-charcoal-soft">
              Compila il form: la tua richiesta verrà confermata entro {RESPONSE_HOURS} ore.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 min-w-0">
              <label className={labelClass}>Data</label>
              <input
                required
                type="date"
                min={primoGiornoUtile}
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

          {giornoChiuso ? (
            <div>
              <label className={labelClass}>Orario</label>
              <p className="testo-sala-grande text-b58-charcoal-soft bg-b58-cream-dark/60 rounded-lg px-3 py-2">
                {opzioni?.motivo || "Quel giorno siamo chiusi."}
                {primaApertaDopo && (
                  <>
                    {" "}
                    Il primo giorno utile dopo quello è il {formatDate(primaApertaDopo)}.
                  </>
                )}
              </p>
            </div>
          ) : sceltaOrari ? (
            <div>
              <label className={labelClass}>Orario</label>
              {cercaOrari ? (
                // 🔴 DICEVA «Cerco i posti liberi…» (corretta il 22/08). Il
                // calcolo dei posti liberi **non esiste piu' dal 14/08**:
                // `posti_liberi()` e `dining_tables.seats` sono stati
                // rimossi con la pianta viva, e quanta gente entra lo decide
                // Alessio guardando la sala. Qui si cercano gli **orari
                // prenotabili**, che e' un'altra cosa.
                //
                // ⚠️ E' l'unica frase diventata falsa che leggono i CLIENTI:
                // prometteva un conteggio di posti che nessuno fa piu', e
                // chi la leggeva poteva aspettarsi che il sito sapesse dire
                // quanto spazio c'e'.
                <p className="testo-sala-grande text-b58-charcoal-soft">Cerco gli orari disponibili…</p>
              ) : (
                // Un menu a tendina, non un muro di pulsanti: con l'orario
                // ogni quarto d'ora sono tredici bottoni per una cena, e su
                // un telefono occupano mezza schermata prima ancora che
                // l'ospite abbia scritto il proprio nome.
                <select
                  required
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Scegli l'ora…</option>
                  {orariLiberi.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
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
          <p className="testo-sala text-b58-charcoal-soft/70 -mt-2">
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

          <label className="flex items-start gap-2 testo-sala text-b58-charcoal-soft">
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

          {error && <p className="testo-sala-grande text-b58-terracotta-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting || giornoChiuso || cercaOrari || (sceltaOrari && !form.time)}
            className="w-full rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium py-3"
          >
            {submitting ? "Invio…" : "Invia richiesta"}
          </button>
        </form>
      </div>
    </div>
  );
}
