import { useEffect, useState } from "react";
import { assegnaClienteConto } from "../lib/api/orders";
import { listCustomers } from "../lib/api/customers";

// CHI PAGA QUESTO TAVOLO — 23/08/2026, blocco 5 del mandato del collaudo.
//
// 🔴 LA REGOLA È DI ALESSIO: **il tavolo si associa al cliente PAGANTE,
// che sia quello della prenotazione o no**. Se prenota Tizio e paga Caio,
// il tavolo va a Caio e la prenotazione resta quello che era.
//
// ⚠️ QUINDI QUI NON SI TOCCA MAI LA PRENOTAZIONE: si scrive su
// `orders.customer_id`, che è un dato del conto. Il cliente della
// prenotazione è soltanto il valore di partenza, messo dal database
// quando il conto si apre.
//
// ⚠️ E IL VUOTO È NORMALE, non un errore: uno che entra senza prenotare
// non ha un nome finché qualcuno non glielo chiede. Il riquadro lo offre,
// non lo pretende — chiudere un conto non richiede un cliente.
//
// ⚠️ SI CERCA PRIMA DI CREARE, ed è il motivo per cui i suggerimenti
// stanno qui: due schede «Rossi» nate perché due camerieri hanno scritto
// lo stesso nome sono un difetto che si paga mesi dopo — è il motivo per
// cui esiste `merge_customers`. Il database fa la sua parte (un numero
// già in anagrafica riusa la scheda), questa schermata fa la propria
// facendo vedere chi c'è già prima che qualcuno scriva.
export default function ClientePagante({ order, onFatto, onErrore, compatto = false }) {
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [trovati, setTrovati] = useState([]);
  const [busy, setBusy] = useState(false);

  const cliente = order?.cliente ?? null;
  const cerca = (nome.trim().length >= 2 ? nome : telefono.trim().length >= 3 ? telefono : "").trim();

  // ⚠️ Si cerca solo da due lettere in su: con una sola tornerebbe mezza
  // anagrafica, cioè un elenco che non aiuta a scegliere.
  useEffect(() => {
    if (cliente || cerca === "") {
      setTrovati([]);
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      listCustomers({ search: cerca })
        .then((r) => vivo && setTrovati(r.slice(0, 3)))
        // SILENZIO MOTIVATO: i suggerimenti sono un aiuto, non il dato. Se
        // l'anagrafica non risponde, i due campi restano scrivibili e
        // «Registra» funziona lo stesso — e il database continua a
        // riconoscere da sé un numero già visto, che è la difesa vera
        // contro i doppioni. Una striscia rossa sopra la sala mentre un
        // cameriere sta scrivendo un nome costerebbe più di quello che
        // vale, e il gesto non si ferma.
        .catch(() => vivo && setTrovati([]));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [cerca, cliente]);

  const scrivi = async (dati) => {
    setBusy(true);
    try {
      await assegnaClienteConto(order.id, dati);
      setNome("");
      setTelefono("");
      setTrovati([]);
      await onFatto?.();
    } catch (e) {
      onErrore?.(e.message);
    } finally {
      setBusy(false);
    }
  };

  const campo =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-2 tocco-bottone testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  if (cliente) {
    return (
      <div className={compatto ? "" : "mb-3"}>
        <p className="testo-sala text-b58-charcoal-soft leading-none">Paga</p>
        <p className="testo-sala-grande font-semibold text-b58-charcoal leading-tight">
          {cliente.name || cliente.phone || "senza nome"}
        </p>
        {cliente.name && cliente.phone && (
          <p className="testo-sala text-b58-charcoal-soft leading-tight">{cliente.phone}</p>
        )}
        {/* ⚠️ LA VIA D'USCITA, e non è un di più: chi aggancia il cliente
            sbagliato deve poterlo togliere senza chiamare nessuno. Un
            gesto che si può solo fare e mai disfare è un vicolo cieco. */}
        <button
          type="button"
          disabled={busy}
          onClick={() => scrivi({})}
          className="tocco-bottone rounded border border-stone-300 px-3 testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark disabled:opacity-50 mt-2"
        >
          Non è lui
        </button>
      </div>
    );
  }

  return (
    <div className={compatto ? "" : "mb-3"}>
      <p className="testo-sala text-b58-charcoal-soft leading-none mb-1">Chi paga?</p>
      <div className="space-y-1">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome"
          className={campo}
        />
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Numero"
          inputMode="tel"
          className={campo}
        />
        {/* Chi c'è già in anagrafica, prima che si crei un doppione. */}
        {trovati.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={busy}
            onClick={() => scrivi({ clienteId: c.id })}
            className="tocco-bottone w-full rounded-lg bg-b58-parchment ring-1 ring-b58-charcoal/15 px-2 testo-sala text-left text-b58-charcoal disabled:opacity-50"
          >
            {c.name || c.phone}
            {c.name && c.phone ? ` · ${c.phone}` : ""}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || (!nome.trim() && !telefono.trim())}
          onClick={() => scrivi({ nome, telefono })}
          className="tocco-bottone w-full rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-50 transition-colors text-b58-parchment testo-sala font-medium"
        >
          Registra
        </button>
      </div>
    </div>
  );
}
