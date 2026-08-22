import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listChiamateTurno,
  listRepartoTickets,
  segnaChiamataStampata,
  setItemsPrepared,
} from "../../lib/api/orders";
import { bigliettiCucina, etichettaTurno } from "../../lib/calcoli/turni";

// CUCINA — postazione di stampa, non schermata di lavoro (§3.2.1).
//
// La cucina lavora SOLO di carta, per scelta deliberata: niente tablet,
// niente "segna pronto" digitale. Questa pagina è il ponte deciso da
// Alessio l'08/08: finché non ci sono mini-PC e stampante termica, ogni
// invio dalla Sala arriva qui come ticket già impaginato a 72 mm (la
// larghezza utile di una termica da 80 mm) e si stampa dal browser con un
// tocco. Quando arriverà l'hardware, questa pagina verrà sostituita dalla
// coda di stampa sul mini-PC (ARCHITETTURA §4.2) senza cambiare il ticket.
//
// Stato "stampato": si riusa prepared_at delle righe — qui NON significa
// "piatto pronto" (quello resta sulla carta, in cucina) ma "il ticket è
// uscito dalla stampante". È condiviso fra i dispositivi e sopravvive al
// ricarico; con la coda vera diventerà lo stato della coda.
//
// 🔴 DAL 21/08 I FOGLI SI RAGGRUPPANO PER TURNO, NON PER INVIO. Prima la
// chiave era `order_id + sent_at`: una comanda segnata tutta e mandata una
// volta usciva come **un foglio solo**, coi tre turni mescolati dentro.
// Adesso la regola vive in `src/lib/calcoli/turni.js` — pura, provabile
// senza browser e senza chiavi — e questa pagina la chiama invece di
// riscriverla.
//
// ⚠️ E I BIGLIETTI «AVANTI COL PROSSIMO TURNO» PASSANO DALLA STESSA CODA:
// sono un foglio come gli altri, con la stessa vita (da stampare → stampato
// → ristampabile). Il giorno del mini-PC la coda li prende senza doverli
// distinguere, perché non c'è niente da distinguere.
const POLL_MS = 10000;

export default function Cucina() {
  const [righe, setRighe] = useState([]);
  const [chiamate, setChiamate] = useState([]);
  const [error, setError] = useState("");
  const [letto, setLetto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stampaKey, setStampaKey] = useState(null);

  // ⚠️ Le due letture si chiedono INSIEME e o si applicano tutte e due o
  // nessuna: se le chiamate fallissero e le righe no, la cucina vedrebbe una
  // coda plausibile **senza i biglietti dei turni** — cioè un elenco che
  // sembra completo e non lo è (§8).
  const load = () =>
    Promise.all([listRepartoTickets("cucina"), listChiamateTurno()])
      .then(([r, c]) => {
        setRighe(r);
        setChiamate(c);
        setLetto(true);
        setError("");
      })
      // Un errore non va ingoiato: una pagina vuota per un problema di
      // rete è indistinguibile da una serata tranquilla.
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const fogli = bigliettiCucina(righe, chiamate);
  const daStampare = fogli.filter((g) => !g.stampato);
  const stampati = fogli.filter((g) => g.stampato);

  // Un foglio si marca allo stesso modo qualunque cosa contenga: è la
  // proprietà che permetterà alla coda del mini-PC di trattarli uguali.
  const segna = (g, stampato) =>
    g.tipo === "chiamata"
      ? segnaChiamataStampata(g.id, stampato)
      : setItemsPrepared(
          g.items.map((i) => i.id),
          stampato
        );

  // Stampa di un singolo foglio: la classe .stampa-ticket isola SOLO quel
  // foglio sulla carta (blocco @media print in index.css). Il timeout dà a
  // React il tempo di applicare la classe prima del dialogo di stampa, e
  // tiene la chiamata fuori dal ciclo di render (in sviluppo gli effetti
  // girano due volte: qui la stampa deve partire UNA volta).
  const stampa = (g, giaStampato) => {
    setStampaKey(g.chiave);
    setTimeout(async () => {
      window.print();
      setStampaKey(null);
      if (!giaStampato) {
        setBusy(true);
        try {
          await segna(g, true);
          await load();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }
    }, 100);
  };

  const nonStampato = async (g) => {
    setBusy(true);
    try {
      await segna(g, false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ora = (iso) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  // Il foglio, identico a video e sulla carta: quello che si vede è quello
  // che esce (e domani uscirà dalla termica con questa stessa impaginazione).
  const Foglio = ({ g, giaStampato }) => (
    <div
      className={`${stampaKey === g.chiave ? "stampa-ticket " : ""}bg-white border border-dashed border-b58-charcoal/25 rounded-lg p-3 font-mono border-t-4 ${
        g.tipo === "chiamata" ? "border-t-b58-gold-dark" : "border-t-b58-terracotta"
      } ${giaStampato ? "opacity-60" : ""}`}
    >
      {g.tipo === "chiamata" ? (
        // 🔴 IL BIGLIETTO DEL TURNO NON DICE QUALE TURNO (deciso da Alessio,
        // 21/08): è generico e senza limitazioni. La cucina ha già la comanda
        // completa e vede da sé cosa resta da cucinare — questo foglio dice
        // «adesso», e su quale tavolo.
        <>
          <div className="print:text-base text-center font-bold testo-sala-grande border-b border-dashed border-b58-charcoal/30 pb-1.5 mb-1.5">
            {g.tavolo}
            <div className="print:text-xs font-normal testo-sala">{ora(g.quando)}</div>
          </div>
          <div className="print:text-lg text-center testo-sala-grande font-bold leading-tight py-2">
            AVANTI COL PROSSIMO TURNO
          </div>
        </>
      ) : (
        <>
          {/* ⚠️ IL TURNO STA NELL'INTESTAZIONE, SEMPRE — anche quando è il
              primo. È la condizione posta da Alessio il 21/08 per accettare
              che un piatto aggiunto dopo faccia un secondo foglio dello
              stesso turno: **il foglio deve dire chiaramente a che turno
              appartiene**, altrimenti chi cucina non sa se ha in mano roba
              nuova o roba già cucinata. */}
          <div className="print:text-base text-center font-bold testo-sala-grande border-b border-dashed border-b58-charcoal/30 pb-1.5 mb-1.5">
            CUCINA — {g.tavolo}
            {/* 🔴 IL TURNO È LA RIGA PIÙ GRANDE DEL FOGLIO (22/08). Era
                della stessa taglia del nome del tavolo, cioè si leggeva
                solo cercandola — e **questo è il posto dove conta di
                più**: a schermo chi ha segnato i piatti sa già che turno
                sta guardando, sulla carta no.
                ⚠️ Niente banda nera piena come a schermo: una termica la
                stampa male e consuma. Le righe sopra e sotto fanno lo
                stesso lavoro con l'inchiostro che una stampante di
                reparto sa fare. */}
            {/* ⚠️ QUI LE TAGLIE SONO IN PIXEL E NON IN CENTIMETRI VERI, ed è
                voluto: questo foglio è disegnato per la CARTA da 72 mm, dove
                `--pxcm` non vuol dire niente. Misurato: 24px diventano ~6,3
                mm sulla stampa (più grandi del nome del tavolo, che è quello
                che serve) e 3,2 mm sullo schermo della cucina alla
                calibrazione 74 — sopra la soglia dei 3 mm. Con le classi
                scalate il biglietto stampato verrebbe fuori misura. */}
            <div className="text-2xl font-bold border-y-2 border-b58-charcoal py-1 my-1">
              {etichettaTurno(g.turno)}
              {g.aggiunta && " · AGGIUNTA"}
            </div>
            <div className="print:text-xs font-normal testo-sala">{ora(g.quando)}</div>
          </div>
          {g.items.map((i) => (
            <div key={i.id} className="py-0.5">
              <div className="print:text-base testo-sala-grande leading-tight">
                <b>{i.quantity}×</b> {i.recipe?.name || i.free_text_name}
              </div>
              {i.note && <div className="print:text-sm testo-sala italic pl-5">↳ {i.note}</div>}
            </div>
          ))}
          {g.notaTavolo && (
            <div className="print:text-sm testo-sala italic border-t border-dashed border-b58-charcoal/30 mt-1.5 pt-1.5">
              Nota tavolo: {g.notaTavolo}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <div className="flex items-center justify-between gap-3 mb-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Cucina — stampa</h1>
          <p className="testo-sala text-b58-charcoal-soft/70 mt-1">
            {daStampare.length === 0 ? "Niente da stampare" : `${daStampare.length} da stampare`}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link to="/comande" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4 py-2">
            Sala
          </Link>
          <Link to="/comande/bar" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4 py-2">
            Bar
          </Link>
        </div>
      </div>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3 print:hidden">
          Elenco non aggiornato: {error}. Quello che vedi potrebbe essere incompleto.
        </p>
      )}

      {/* 🔴 QUI C'ERA UNA DIDASCALIA (tolta il 22/08): «La cucina lavora di
          carta (§3.2.1)… Quando arriverà il mini-PC, la stampa partirà da
          sola.» È una **spiegazione**, non un avviso: dice come funziona una
          cosa che il pulsante «🖨 Stampa» dice già da sé, e promette una
          cosa futura.
          ⚠️ Il criterio è quello del 18/08: *una spiegazione a schermo la si
          legge una volta e poi diventa arredamento* — e questa sta su una
          schermata che si guarda in servizio, dove l'ingombro si paga in
          secondi. La regola resta scritta dove serve: nel commento in testa
          a questo file, che il mini-PC lo nomina per esteso. */}

      {/* ⚠️ «Non ho ancora letto» non è «non c'è niente»: finché la prima
          lettura non è tornata non si dichiara la serata vuota (§6). */}
      {!letto ? (
        <p className="testo-sala text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl print:hidden">
          Sto leggendo la coda…
        </p>
      ) : fogli.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl print:hidden">
          Nessuna comanda per la cucina.
        </p>
      ) : (
        <div className="space-y-3">
          {daStampare.map((g) => (
            <div key={g.chiave}>
              <Foglio g={g} giaStampato={false} />
              <button
                type="button"
                disabled={busy}
                onClick={() => stampa(g, false)}
                className="tocco-azione w-full mt-1.5 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment testo-sala-grande font-semibold disabled:opacity-50 print:hidden"
              >
                🖨 Stampa
              </button>
            </div>
          ))}

          {stampati.length > 0 && (
            <p className="testo-sala uppercase tracking-wide text-b58-charcoal-soft/50 pt-2 print:hidden">
              Già stampati
            </p>
          )}
          {stampati.map((g) => (
            <div key={g.chiave}>
              <Foglio g={g} giaStampato />
              <div className="flex gap-2 mt-1.5 print:hidden">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => stampa(g, true)}
                  className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal testo-sala font-medium disabled:opacity-50"
                >
                  Ristampa
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => nonStampato(g)}
                  className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal-soft testo-sala disabled:opacity-50"
                >
                  ↺ Segna non stampato
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
