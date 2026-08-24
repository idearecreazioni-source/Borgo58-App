import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listDashboardTasks, updateTask } from "../lib/api/tasks";
import { listReservations, listRichiesteDaConfermare } from "../lib/api/reservations";
import { contaPostaInAttesa } from "../lib/api/posta";
import { listAvvisi, rimandaAvviso, riprendiAvviso } from "../lib/api/avvisi";
import { TASK_PRIORITIES, formatDate, labelFor, oggiLocale } from "../lib/constants";
import { useAuth } from "../context/AuthContext";

const PRIORITY_BADGE = {
  alta: "bg-b58-terracotta",
  media: "bg-b58-gold",
  bassa: "bg-b58-charcoal-soft/50",
};

// Dashboard home (§3.12): non più una griglia di moduli (già nella sidebar,
// era una navigazione duplicata) — la vista della mattina.
//
// 🔴 L'ORDINE DEI RIQUADRI NON È CASUALE, ed è la sola scelta di disegno
// che questa schermata fa: è *«la prima schermata che aprirò ogni
// mattina»* (Alessio, 24/08). Quindi in cima sta chi **sta aspettando una
// risposta da fuori** — un cliente che ha scritto e non sa ancora niente —
// poi le cose che non vanno, poi il quadro della giornata, e in fondo gli
// impegni, che sono l'unica cosa che c'era prima.
//
// ⚠️ E I PRIMI DUE RIQUADRI COMPAIONO SOLO SE C'È QUALCOSA: era una
// richiesta esplicita per le richieste dei clienti, e vale per gli avvisi
// per la stessa ragione. Un riquadro che dice «niente» tutte le mattine
// diventa arredamento, e allora smette di farsi notare il giorno che parla.
export default function Dashboard() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState(null);
  const [richieste, setRichieste] = useState([]);
  const [posta, setPosta] = useState(0);
  const [avvisi, setAvvisi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const oggi = oggiLocale();

  // ⚠️ LE LETTURE SONO INDIPENDENTI, e non in un `Promise.all` unico: se
  // una fallisce, le altre devono comunque arrivare. È la lezione del
  // 18/08 — nove letture in blocco, una fallisce, e la sala si disegnava
  // vuota con la striscia rossa sopra. Qui il caso peggiore sarebbe una
  // mattina che dice «nessuna prenotazione oggi» perché una lettura non è
  // riuscita: una frase tranquilla e falsa.
  const caricaPrenotazioni = () =>
    listReservations({ date: oggi })
      .then((r) => setPrenotazioni(r ?? []))
      .catch((e) => {
        setPrenotazioni(null); // ⚠️ null = «non lo so», mai lista vuota
        setError(e.message);
      });

  const caricaAvvisi = () => {
    if (isStaff) return Promise.resolve();
    return listAvvisi()
      .then(setAvvisi)
      .catch((e) => setError(e.message));
  };

  const load = () =>
    Promise.all([
      listDashboardTasks()
        .then(setTasks)
        .catch((e) => setError(e.message)),
      caricaPrenotazioni(),
      isStaff
        ? Promise.resolve()
        : listRichiesteDaConfermare()
            .then(setRichieste)
            .catch((e) => setError(e.message)),
      isStaff
        ? Promise.resolve()
        : contaPostaInAttesa()
            .then(setPosta)
            .catch((e) => setError(e.message)),
      caricaAvvisi(),
    ]).finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleComplete = async (task) => {
    try {
      await updateTask(task.id, { status: "completato" });
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const today = tasks.filter((t) => t.due_date);
  const undated = tasks.filter((t) => !t.due_date);
  const todayLabel = formatDate(oggi);
  const daGuardare = richieste.length + posta;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
            {isStaff ? "Benvenuto." : "Bentornato, Alessio."}
          </h1>
          <p className="testo-sala text-b58-charcoal-soft mt-1">Oggi, {todayLabel}</p>
        </div>
        {/* ⚠️ MISURATO, non stimato: come link nudo questo faceva 5,3 mm di
            altezza — sotto la soglia degli 8,5. Il testo resta uguale, il
            bersaglio cresce col padding: si tocca la riga, non le lettere. */}
        <Link
          to="/agenda"
          className="tocco-riga inline-flex items-center shrink-0 rounded-lg px-3 -mx-1 testo-sala text-b58-terracotta hover:text-b58-terracotta-dark hover:bg-b58-cream-dark/40 font-medium transition-colors"
        >
          Agenda completa →
        </Link>
      </div>

      {error && <p className="testo-sala text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <div className="space-y-6">
          {!isStaff && daGuardare > 0 && (
            <RichiesteDeiClienti richieste={richieste} posta={posta} />
          )}

          {!isStaff && avvisi.length > 0 && (
            <Avvisi
              avvisi={avvisi}
              onVai={(dove) => navigate(dove)}
              onRimanda={async (chiave) => {
                try {
                  await rimandaAvviso(chiave, 1);
                  await caricaAvvisi();
                } catch (e) {
                  setError(e.message);
                }
              }}
              onRiprendi={async (chiave) => {
                try {
                  await riprendiAvviso(chiave);
                  await caricaAvvisi();
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          )}

          <PrenotazioniDiOggi
            prenotazioni={prenotazioni}
            onRiprova={caricaPrenotazioni}
            onApri={(id) => navigate(`/calendario-eventi/${id}`)}
          />

          <section>
            <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
              Task di oggi
            </h2>
            {today.length === 0 ? (
              <p className="testo-sala text-b58-charcoal-soft/60">Nessun task con scadenza oggi.</p>
            ) : (
              <TaskGroup tasks={today} onComplete={toggleComplete} />
            )}
          </section>

          <section>
            <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
              Senza data — da incastrare
            </h2>
            {undated.length === 0 ? (
              <p className="testo-sala text-b58-charcoal-soft/60">Nessuno.</p>
            ) : (
              <TaskGroup tasks={undated} onComplete={toggleComplete} />
            )}
          </section>

          <Link
            to="/agenda/nuovo"
            className="tocco-riga inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 testo-sala"
          >
            + Nuovo task
          </Link>
        </div>
      )}
    </div>
  );
}

// --- (c) LE RICHIESTE DEI CLIENTI ------------------------------------
//
// ⚠️ UN RICHIAMO, NON UNA COPIA — è la riga del mandato. Qui non si
// conferma niente e non si legge nessuna mail: si dice che c'è qualcuno
// in attesa e si porta dove si risponde. Una seconda schermata che facesse
// lo stesso lavoro divergerebbe dalla prima al primo cambiamento.
function RichiesteDeiClienti({ richieste, posta }) {
  return (
    <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="inline-flex items-center rounded-full bg-b58-gold text-b58-parchment testo-sala font-medium px-2.5 py-1">
          {richieste.length + posta}
        </span>
        <h2 className="font-display testo-sala-grande text-b58-charcoal">
          Richieste dei clienti da guardare
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {richieste.length > 0 && (
          <Link
            to="/calendario-eventi"
            className="tocco-riga flex items-center rounded-lg bg-b58-cream-dark/50 hover:bg-b58-cream-dark px-4 testo-sala text-b58-charcoal transition-colors"
          >
            {richieste.length}{" "}
            {richieste.length === 1
              ? "prenotazione da confermare"
              : "prenotazioni da confermare"}{" "}
            →
          </Link>
        )}
        {posta > 0 && (
          <Link
            to="/documenti/posta"
            className="tocco-riga flex items-center rounded-lg bg-b58-cream-dark/50 hover:bg-b58-cream-dark px-4 testo-sala text-b58-charcoal transition-colors"
          >
            {posta} {posta === 1 ? "messaggio in arrivo" : "messaggi in arrivo"} →
          </Link>
        )}
      </div>
    </section>
  );
}

// --- (b) GLI AVVISI DEL GESTIONALE -----------------------------------
//
// ⚠️ UNA RIGA PER FAMIGLIA, non per fatto: sul progetto di prova le fonti
// producono 65 scadenze e 3 conti da fiscalizzare, e stamparle tutte
// farebbe della prima schermata della mattina una lista di sessantotto
// righe. Il numero e la strada; il dettaglio sta dove si risolve.
//
// ⚠️ E NESSUN «SEGNA COME LETTO»: un avviso se ne va quando la cosa è
// risolta. L'unico gesto è «rimanda», che è dichiaratamente un rinvio e
// non uno spegnimento — e si disfa.
function Avvisi({ avvisi, onVai, onRimanda, onRiprendi }) {
  const attivi = avvisi.filter((a) => !a.rimandato_a);
  const rimandati = avvisi.filter((a) => a.rimandato_a);

  return (
    <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
      <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Da sistemare</h2>

      {attivi.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft">
          Niente di aperto: quello che c&rsquo;era è rimandato, qui sotto.
        </p>
      ) : (
        <ul className="divide-y divide-b58-charcoal/5">
          {attivi.map((a) => (
            <li key={a.chiave} className="py-2 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onVai(a.dove)}
                  className="tocco-riga flex-1 min-w-0 text-left rounded-lg px-2 -mx-2 hover:bg-b58-cream-dark/40 transition-colors"
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center rounded-full ${
                        a.gravita === "alta" ? "bg-b58-terracotta" : "bg-b58-gold"
                      } text-b58-parchment testo-sala font-medium px-2 py-0.5`}
                    >
                      {a.quanti}
                    </span>
                    <span className="testo-sala text-b58-charcoal font-medium">{a.titolo}</span>
                  </span>
                  {a.dettaglio && (
                    <span className="block testo-sala text-b58-charcoal-soft mt-0.5 truncate">
                      {a.dettaglio}
                    </span>
                  )}
                </button>
                {/* ⚠️ «Rimanda» non è un gesto pericoloso — non cancella
                    niente e si disfa — quindi non serve la distanza dei
                    cinque millimetri, che qui ruberebbe spazio al bersaglio
                    grande che è la riga stessa. */}
                <button
                  type="button"
                  onClick={() => onRimanda(a.chiave)}
                  className="tocco-bottone shrink-0 rounded-lg px-3 testo-sala text-b58-charcoal-soft hover:text-b58-charcoal hover:bg-b58-cream-dark/40 transition-colors"
                  title="Non adesso: torna domani"
                >
                  Non adesso
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rimandati.length > 0 && (
        <div className="mt-3 pt-3 border-t border-b58-charcoal/5">
          {rimandati.map((a) => (
            <div key={a.chiave} className="flex items-center justify-between gap-3 py-1">
              <span className="testo-sala text-b58-charcoal-soft truncate">
                {a.titolo} ({a.quanti}) — torna il {formatDate(a.rimandato_a)}
              </span>
              <button
                type="button"
                onClick={() => onRiprendi(a.chiave)}
                className="tocco-bottone shrink-0 rounded-lg px-3 testo-sala text-b58-terracotta hover:bg-b58-cream-dark/40 transition-colors"
              >
                Rimettilo
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- (a) LE PRENOTAZIONI DEL GIORNO ----------------------------------
//
// ⚠️ LA DATA È QUELLA DEL CALENDARIO, non la serata di servizio: una
// prenotazione si prende PER un giorno, e chi prenota per il 25 intende il
// 25. È la distinzione scritta accanto a `oggiLocale()` — cassa e conti
// vanno sulla serata, prenotazioni e turni sul calendario, e uniformarle
// sarebbe un difetto e non una pulizia.
//
// ⚠️ E «NON LO SO» NON È «NON C'È NIENTE» (19/08): se la lettura fallisce
// si dichiara, con la via d'uscita per riprovare. Una mattina che dice con
// calma «nessuna prenotazione oggi» quando invece ce ne sono otto è il
// difetto peggiore di questa schermata, perché è **plausibile**.
function PrenotazioniDiOggi({ prenotazioni, onRiprova, onApri }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">
          Prenotazioni di oggi
        </h2>
        <Link
          to="/calendario-eventi/pianta"
          className="tocco-riga inline-flex items-center shrink-0 rounded-lg px-3 -mx-1 testo-sala text-b58-terracotta hover:text-b58-terracotta-dark hover:bg-b58-cream-dark/40 transition-colors"
        >
          La sala →
        </Link>
      </div>

      {prenotazioni === null ? (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-terracotta/30 p-4">
          <p className="testo-sala text-b58-charcoal">
            Non sono riuscito a leggere le prenotazioni di oggi. Non vuol dire che non ce ne
            siano: vuol dire che non lo so.
          </p>
          <button
            type="button"
            onClick={onRiprova}
            className="tocco-bottone mt-2 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment testo-sala font-medium px-4 transition-colors"
          >
            Riprova
          </button>
        </div>
      ) : prenotazioni.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60">Nessuna prenotazione per oggi.</p>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
          {[...prenotazioni]
            .sort((a, b) => (a.reservation_time ?? "").localeCompare(b.reservation_time ?? ""))
            .map((r) => {
              // ⚠️ L'etichetta è quella FOTOGRAFATA sulla prenotazione: se la
              // sala viene rinumerata, una prenotazione di oggi continua a
              // mostrare il tavolo che le era stato dato.
              const tavoli = (r.tavoli ?? [])
                .map((t) => t.etichetta_al_momento)
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onApri(r.id)}
                  className="tocco-riga w-full text-left px-4 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-b58-cream-dark/40 transition-colors"
                >
                  <span className="testo-sala-grande text-b58-charcoal font-medium tabular-nums">
                    {r.reservation_time?.slice(0, 5) ?? "—"}
                  </span>
                  <span className="testo-sala text-b58-charcoal flex-1 min-w-0 truncate">
                    {r.customer_name}
                  </span>
                  <span className="testo-sala text-b58-charcoal-soft tabular-nums">
                    {r.party_size} cop.
                  </span>
                  {/* ⚠️ «Da assegnare» si DICE, non si lascia vuoto: una
                      prenotazione senza tavolo non compare da nessuna parte
                      sulla pianta, quindi questo è uno dei pochi posti dove
                      può essere vista. */}
                  <span
                    className={`testo-sala ${
                      tavoli ? "text-b58-charcoal" : "text-b58-terracotta"
                    }`}
                  >
                    {tavoli || "da assegnare"}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </section>
  );
}

function TaskGroup({ tasks, onComplete }) {
  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
      {/* ⚠️ MISURATO IL 24/08, e il difetto era qui da prima: la riga di un
          impegno faceva **5,3 mm** e la sua casella **3,4** — sotto gli 8,5
          della soglia. Non era stato notato perché questa schermata si
          guardava da un monitor, dove 5,3 mm sembrano una riga normale.
          ⚠️ E la casella e il titolo fanno due cose OPPOSTE — una chiude
          l'impegno, l'altro lo apre — quindi la distanza fra loro è quella
          dei gesti che non si possono scambiare. */}
      {tasks.map((t) => (
        <div key={t.id} className="tocco-riga flex items-center gap-4 px-4 py-2">
          <input
            type="checkbox"
            checked={false}
            onChange={() => onComplete(t)}
            className="tocco-bottone shrink-0"
            aria-label={`Segna fatto: ${t.title}`}
          />
          <Link
            to={`/agenda/${t.id}`}
            className="tocco-riga flex items-center flex-1 min-w-0 testo-sala text-b58-charcoal"
          >
            <span className="min-w-0">
              {t.title}
              {t.category && <span className="text-b58-charcoal-soft ml-2">· {t.category}</span>}
            </span>
          </Link>
          <span
            className={`shrink-0 inline-flex items-center rounded-full ${PRIORITY_BADGE[t.priority]} text-b58-parchment testo-sala font-medium px-2 py-0.5`}
          >
            {labelFor(TASK_PRIORITIES, t.priority)}
          </span>
        </div>
      ))}
    </div>
  );
}
