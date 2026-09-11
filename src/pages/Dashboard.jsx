import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listDashboardTasks, updateTask } from "../lib/api/tasks";
import { listReservations, listRichiesteDaConfermare } from "../lib/api/reservations";
import { contaPostaInAttesa } from "../lib/api/posta";
import { quanteAspettano } from "../lib/api/voce";
import { listSpesaSpicciola } from "../lib/api/spesaSpicciola";
import { daComprare } from "../lib/calcoli/spesaSpicciola";
import { daQuantoAspetta } from "../lib/calcoli/voce";
import { leggi, nonLetto } from "../lib/calcoli/letture";
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
  const [dettate, setDettate] = useState(null);
  const [spicciola, setSpicciola] = useState(null);
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
      // ⚠️ Lettura indipendente come le altre: se fallisce, il resto
      //    della mattina arriva lo stesso. E il guasto NON si ingoia:
      //     marca il risultato come «non letto», e sotto la
      //    schermata lo dice invece di far sparire il riquadro — che si
      //    leggerebbe «non hai niente in sospeso», cioè una frase
      //    tranquilla e falsa.
      isStaff ? Promise.resolve() : leggi(quanteAspettano()).then(setDettate),
      // 🔴 QUANTE COSE RESTANO DA COMPRARE DI PERSONA — 10/09/2026,
      //    Blocco 5 del mandato. La spesa spicciola è l'unica lista che si
      //    guarda **uscendo di casa**, ed era raggiungibile solo passando
      //    dal Magazzino: chi la dettava la sera non la ritrovava la
      //    mattina, quando serve.
      // ⚠️ Lettura indipendente e col segno «non letto», per la stessa
      //    ragione di quella sopra: un riquadro sparito si leggerebbe «non
      //    c'è niente da comprare».
      isStaff ? Promise.resolve() : leggi(listSpesaSpicciola()).then(setSpicciola),
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
    /* 🔴 IL TELAIO DELLA MATTINA SU UNO SCHERMO DA SCRIVANIA (05/09/2026).

       MISURATO su questa schermata, a monitor spento e finestra vera:
       a 1920×1080 il contenuto restava largo **1024 punti dentro 1600**
       disponibili, con **288 punti vuoti per lato**; a 2560 erano 608.
       Il tetto di 64rem lo mette `contenuto-ampio` (index.css) e per la
       maggior parte delle schermate va bene — qui no.

       ⚠️ E ALLARGARE LA COLONNA SAREBBE STATO PEGGIO, ed è la misura che
          ha deciso la forma: dentro una riga di impegno l'inchiostro è
          **95 punti su 1024**, col resto occupato da un buco di **590**
          fra il titolo e l'etichetta della priorità. Questo contenuto non
          è stretto: è **rado**. Stirarlo allarga i buchi, non li riempie.
          Quindi la larghezza si usa mettendo i blocchi **accanto**, non
          allungando le righe.

       ⚠️ LA SOGLIA È UNA SOLA — 1536 punti (`2xl:`) — e vale sia per il
          tetto sia per le due colonne, apposta: così la larghezza in più
          finisce SEMPRE in una seconda colonna e mai in righe più lunghe.
          Sotto quella soglia non cambia niente: telefono, tablet, e anche
          i portatili da 1280 e 1440 restano identici a prima (a 1440 il
          vuoto misurato è 48 punti per lato, che non è il difetto).

       ⚠️ 88rem NON È UN NUMERO NUOVO: è l'ultimo gradino della scala che
          `contenuto-ampio` usa già (`max-w-6xl` → 88rem). Oltre i ~1600
          punti utili i margini tornano, ed è dichiarato: più larghe di
          così le righe smettono di leggersi.

       ⚠️ `contenuto-affiancato` È UNA CLASSE DI `index.css`, NON UNA
          UTILITY: provato e misurato, un `2xl:max-w-[88rem]` scritto qui
          NON vince — il tetto di `contenuto-ampio` sta fuori da ogni
          layer e batte le utility di Tailwind a prescindere dalla
          specificità. La misura restava 1024 punti e sembrava che non
          avessi fatto niente. La regola è documentata accanto a quella
          che scavalca. */
    <div className="max-w-3xl contenuto-affiancato mx-auto">
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
        /* 🔴 DUE COLONNE SOLO DA 1536 PUNTI IN SU, e la ragione è nella
           misura sopra: il contenuto della mattina è **rado**, quindi la
           larghezza in più si spende affiancando i blocchi.

           ⚠️ L'ORDINE DICHIARATO NON È ROVESCIATO, ed è la cosa da
              guardare per prima: nell'albero della pagina i blocchi
              restano nella sequenza di sempre — chi aspetta una risposta
              da fuori, le cose che non vanno, il quadro della giornata,
              e per ultimi gli impegni. Sotto 1536 si impilano ESATTAMENTE
              come prima; sopra, i primi tre stanno nella colonna
              principale e gli impegni in quella di fianco, che è più
              stretta. La precedenza resta quella: cambia dove finisce
              l'ultimo posto, non quale blocco lo occupa.
           ⚠️ E vale anche per chi legge con la voce sintetica: l'ordine
              dell'albero è l'ordine di lettura, e non lo tocca nessuna
              griglia.
           ⚠️ `mt-6` sulla seconda colonna, tolto da 1536 in su: sotto la
              soglia riproduce esattamente lo `space-y-6` che c'era prima
              fra l'ultimo blocco della prima colonna e il primo della
              seconda. Senza, impilandosi si toccherebbero. */
        <div className="2xl:grid 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 2xl:gap-8 2xl:items-start">
        <div className="space-y-6">
          {!isStaff && daGuardare > 0 && (
            <RichiesteDeiClienti richieste={richieste} posta={posta} />
          )}

          {/* 🔴 QUELLO CHE HA DETTATO E NON HA ANCORA GUARDATO.
              Niente scade da solo: una cosa detta in cella resta lì finché
              non la guarda, e questo riquadro è il «glielo si ricorda il
              giorno dopo» del mandato — fatto mostrando, non cancellando.
              ⚠️ Compare solo se c'è qualcosa, come i due riquadri accanto:
              uno che dice «niente» tutte le mattine diventa arredamento. */}
          {!isStaff && nonLetto(dettate) && (
            <p className="testo-sala text-b58-terracotta-dark">
              Non sono riuscito a leggere le cose che hai dettato.{" "}
              <button type="button" onClick={load} className="tocco-inline underline">
                Riprova
              </button>
            </p>
          )}

          {!isStaff && !nonLetto(dettate) && dettate?.quante > 0 && (
            <Link
              to="/detta"
              className="tocco-riga flex items-center justify-between gap-3 rounded-xl border border-b58-gold bg-b58-gold/10 px-4 py-3"
            >
              {/* 🔴 SI CONTANO GLI APPUNTI, NON LE RIGHE — SPEC-0013. Tre
                  articoli detti per la stessa lista sono un gesto solo, e
                  scrivere «3» manderebbe a cercare tre cose da guardare dove
                  ce n'è una. Il conteggio lo fa il database (`voce_da_guardare`)
                  perché sia lo stesso numero che si trova aprendo l'elenco. */}
              <span className="testo-sala text-b58-charcoal">
                <span className="font-medium">
                  {dettate.quante === 1 ? "Un appunto" : `${dettate.quante} appunti`}
                </span>{" "}
                {dettate.quante === 1
                  ? "aspetta che tu lo approvi"
                  : "aspettano che tu li approvi"}
                {dettate.laPiuVecchia > 0 &&
                  ` — il più vecchio ${daQuantoAspetta(dettate.laPiuVecchia)}`}
              </span>
              <span aria-hidden="true" className="testo-sala text-b58-terracotta shrink-0">
                →
              </span>
            </Link>
          )}

          {/* ------------------------------------------------------------
              LA SPESA SPICCIOLA — 10/09/2026, Blocco 5 del mandato
             ------------------------------------------------------------
              🔴 NON È LA LISTA DEI FORNITORI, e le due non vanno confuse:
              quella nasce dalle soglie del magazzino e finisce in un
              ordine, questa è la roba che Alessio compra di persona al
              supermercato. Il riquadro lo dice con le parole, non solo col
              titolo: «di persona» è la sola cosa che le distingue a colpo
              d'occhio. */}
          {!isStaff && nonLetto(spicciola) && (
            <p className="testo-sala text-b58-terracotta-dark">
              Non sono riuscito a leggere la spesa spicciola.{" "}
              <button type="button" onClick={load} className="tocco-inline underline">
                Riprova
              </button>
            </p>
          )}

          {/* 🔴 SI CONTA SOLO QUELLO CHE RESTA DA COMPRARE — 10/09/2026, dal
              collaudo. Prima il riquadro contava anche le cose già nel
              carrello, mentre la pagina della spesa spicciola no: due numeri
              per la stessa domanda, uguali solo col carrello vuoto. Adesso
              tutti e due chiedono la stessa regola (`daComprare`).
              ⚠️ E col carrello pieno e niente da prendere il riquadro NON
              compare: «0 cose da comprare» tutte le mattine è arredamento. */}
          {!isStaff && !nonLetto(spicciola) && daComprare(spicciola).length > 0 && (
            <Link
              to="/magazzino/spesa-spicciola"
              className="tocco-riga flex items-center justify-between gap-3 rounded-xl border border-b58-olive bg-b58-olive/10 px-4 py-3"
            >
              <span className="testo-sala text-b58-charcoal">
                <span className="font-medium">
                  {daComprare(spicciola).length === 1
                    ? "Una cosa da comprare"
                    : `${daComprare(spicciola).length} cose da comprare`}
                </span>{" "}
                di persona — spesa spicciola
              </span>
              <span aria-hidden="true" className="testo-sala text-b58-olive-dark shrink-0">
                →
              </span>
            </Link>
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
        </div>

        <div className="space-y-6 mt-6 2xl:mt-0">
          <section>
            <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
              Impegni di oggi
            </h2>
            {today.length === 0 ? (
              <p className="testo-sala text-b58-charcoal-soft/60">Nessun impegno con scadenza oggi.</p>
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
            + Nuovo impegno
          </Link>
        </div>
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
