import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRepartoTickets, setItemsPrepared } from "../../lib/api/orders";

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
const POLL_MS = 10000;

export default function Cucina() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stampaKey, setStampaKey] = useState(null);

  const load = () =>
    listRepartoTickets("cucina")
      .then((t) => {
        setTickets(t);
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

  // Un "ticket" è un INVIO: tutte le righe partite insieme dalla Sala per
  // lo stesso tavolo. È l'unità che esce dalla stampante.
  const gruppi = Object.values(
    tickets.reduce((acc, item) => {
      const key = `${item.order_id}__${item.sent_at}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          table: item.order?.table_label ?? "—",
          notaTavolo: item.order?.note ?? null,
          sentAt: item.sent_at,
          items: [],
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {})
  ).sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

  const daStampare = gruppi.filter((g) => g.items.some((i) => !i.prepared_at));
  const stampati = gruppi.filter((g) => g.items.every((i) => i.prepared_at));

  // Stampa di un singolo ticket: la classe .stampa-ticket isola SOLO quel
  // ticket sulla carta (blocco @media print in index.css). Il timeout dà a
  // React il tempo di applicare la classe prima del dialogo di stampa, e
  // tiene la chiamata fuori dal ciclo di render (in sviluppo gli effetti
  // girano due volte: qui la stampa deve partire UNA volta).
  const stampa = (g, giaStampato) => {
    setStampaKey(g.key);
    setTimeout(async () => {
      window.print();
      setStampaKey(null);
      if (!giaStampato) {
        setBusy(true);
        try {
          await setItemsPrepared(g.items.map((i) => i.id), true);
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
      await setItemsPrepared(g.items.map((i) => i.id), false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ora = (iso) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  // Il ticket, identico a video e sulla carta: quello che si vede è quello
  // che esce (e domani uscirà dalla termica con questa stessa impaginazione).
  const Ticket = ({ g, giaStampato }) => (
    <div
      className={`${stampaKey === g.key ? "stampa-ticket " : ""}bg-white border border-dashed border-b58-charcoal/25 rounded-lg p-3 font-mono border-t-4 border-t-b58-terracotta ${
        giaStampato ? "opacity-60" : ""
      }`}
    >
      <div className="text-center font-bold text-base border-b border-dashed border-b58-charcoal/30 pb-1.5 mb-1.5">
        CUCINA — {g.table}
        <div className="font-normal text-xs">{ora(g.sentAt)}</div>
      </div>
      {g.items.map((i) => (
        <div key={i.id} className="py-0.5">
          <div className="text-base leading-tight">
            <b>{i.quantity}×</b> {i.recipe?.name || i.free_text_name}
          </div>
          {i.note && <div className="text-sm italic pl-5">↳ {i.note}</div>}
        </div>
      ))}
      {g.notaTavolo && (
        <div className="text-sm italic border-t border-dashed border-b58-charcoal/30 mt-1.5 pt-1.5">
          Nota tavolo: {g.notaTavolo}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <div className="flex items-center justify-between gap-3 mb-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Cucina — stampa</h1>
          <p className="text-xs text-b58-charcoal-soft/70 mt-1">
            {daStampare.length === 0
              ? "Niente da stampare"
              : `${daStampare.length} da stampare`}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link to="/comande" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
            Sala
          </Link>
          <Link to="/comande/bar" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
            Bar
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3 print:hidden">
          Elenco non aggiornato: {error}. Quello che vedi potrebbe essere incompleto.
        </p>
      )}

      <p className="text-[11px] text-b58-charcoal-soft/70 leading-relaxed bg-b58-cream-dark/40 rounded-lg px-3 py-2 mb-4 print:hidden">
        La cucina lavora di carta (§3.2.1): ogni invio dalla Sala compare qui e si
        stampa con un tocco, già impaginato come uscirà dalla stampante termica.
        Quando arriverà il mini-PC, la stampa partirà da sola.
      </p>

      {daStampare.length === 0 && stampati.length === 0 ? (
        <p className="text-sm text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl print:hidden">
          Nessuna comanda per la cucina.
        </p>
      ) : (
        <div className="space-y-3">
          {daStampare.map((g) => (
            <div key={g.key}>
              <Ticket g={g} giaStampato={false} />
              <button
                type="button"
                disabled={busy}
                onClick={() => stampa(g, false)}
                className="tocco-azione w-full mt-1.5 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment text-base font-semibold disabled:opacity-50 print:hidden"
              >
                🖨 Stampa
              </button>
            </div>
          ))}

          {stampati.length > 0 && (
            <p className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft/50 pt-2 print:hidden">
              Già stampati
            </p>
          )}
          {stampati.map((g) => (
            <div key={g.key}>
              <Ticket g={g} giaStampato />
              <div className="flex gap-2 mt-1.5 print:hidden">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => stampa(g, true)}
                  className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal text-sm font-medium disabled:opacity-50"
                >
                  Ristampa
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => nonStampato(g)}
                  className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal-soft text-sm disabled:opacity-50"
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
