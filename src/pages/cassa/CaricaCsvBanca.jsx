import { useRef, useState } from "react";
import { formatDate, formatEUR } from "../../lib/constants";
import { controllaSaldi, euroScritti, movimentiCsvDaCaricare, sovrapposizioni } from "../../lib/calcoli/csvBanca";

// IL CSV DELLA BANCA, IL PASSO IN PIÙ (31/10/2026). Il CBI dice da solo il
// conto e i saldi; il CSV di Credem no. Quindi, letto il file, si chiede:
//   - su quale conto va (il principale è già scelto);
//   - il saldo iniziale e quello finale, presi dall'estratto conto, per
//     fare la stessa prova del nove del CBI.
// ⚠️ Niente parte finché i saldi non tornano, il conto non ha l'IBAN e
//    gli stessi giorni non sono già stati caricati dal CBI.

const campo =
  "tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

const NOMI = { csv: "dal CSV", cbi: "dal file CBI" };

export default function CaricaCsvBanca({ file, conti, esistenti, onCarica, onAnnulla }) {
  const attivi = (conti ?? []).filter((c) => c.attivo);
  const [contoId, setContoId] = useState(() => (attivi.find((c) => c.predefinito) ?? attivi[0])?.id ?? "");
  const [iniziale, setIniziale] = useState("");
  const [finale, setFinale] = useState("");
  const [errori, setErrori] = useState([]);
  const [occupato, setOccupato] = useState(false);
  // ⚠️ Guardia sincrona: il pulsante si spegne al render dopo, e chi non
  // vede succedere niente ripreme.
  const inCorso = useRef(false);

  const { movimenti } = file;
  const date = movimenti.map((m) => m.dataContabile).sort();
  const somma = movimenti.reduce((s, m) => s + m.centesimi, 0);

  const carica = async () => {
    if (inCorso.current) return;
    const conto = attivi.find((c) => c.id === contoId);
    const e = [];
    if (conti === null) e.push("Non riesco a leggere i conti correnti. Ricarica la pagina e riprova.");
    else if (!conto) e.push("Scegli il conto su cui caricare i movimenti.");
    else if (!conto.iban) {
      e.push(`Il conto «${conto.nome}» non ha l'IBAN: aggiungilo da Cassa → Conti correnti, poi riprova.`);
    }
    const ci = euroScritti(iniziale);
    const cf = euroScritti(finale);
    if (iniziale.trim() && ci === null) e.push(`Il saldo iniziale «${iniziale}» non si legge.`);
    if (finale.trim() && cf === null) e.push(`Il saldo finale «${finale}» non si legge.`);
    if (!(iniziale.trim() && ci === null) && !(finale.trim() && cf === null)) {
      e.push(...controllaSaldi(movimenti, ci, cf));
    }
    // ⚠️ Senza i movimenti già caricati non si sa se è un doppione: ci si ferma.
    if (esistenti === null) {
      e.push("Non riesco a leggere i movimenti già caricati, quindi non posso controllare i doppioni. Ricarica la pagina e riprova.");
    } else if (conto) {
      const s = sovrapposizioni(movimenti, "csv", conto.id, esistenti);
      if (s) {
        e.push(
          `Sul conto «${conto.nome}» fra il ${formatDate(s.dal)} e il ${formatDate(s.al)} ci sono già`
          + ` ${s.quanti} ${s.quanti === 1 ? "movimento caricato" : "movimenti caricati"} ${NOMI[s.altroFormato]}:`
          + " gli stessi movimenti entrerebbero due volte. Per quei giorni usa un file solo.",
        );
      }
    }
    setErrori(e);
    if (e.length) return;

    inCorso.current = true;
    setOccupato(true);
    try {
      await onCarica(conto.iban, movimentiCsvDaCaricare(movimenti));
    } catch (err) {
      setErrori([err.message]);
    } finally {
      inCorso.current = false;
      setOccupato(false);
    }
  };

  return (
    <div className="bg-b58-campo rounded-lg border border-b58-charcoal/10 p-3 mb-4 space-y-3">
      <p className="testo-sala-grande text-b58-charcoal">
        {file.nome}: {movimenti.length} {movimenti.length === 1 ? "movimento" : "movimenti"} dal{" "}
        {formatDate(date[0])} al {formatDate(date[date.length - 1])}, in tutto {formatEUR(somma / 100)}.
      </p>
      <p className="testo-sala text-b58-charcoal-soft">
        Il CSV non dice il conto né i saldi: scrivili tu, dall&apos;estratto conto, così controllo che il file sia intero.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 testo-sala text-b58-charcoal">
          Conto
          <select value={contoId} onChange={(e) => setContoId(e.target.value)} className={campo}>
            {attivi.length === 0 && <option value="">Nessun conto corrente</option>}
            {attivi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 testo-sala text-b58-charcoal">
          Saldo iniziale (€)
          <input
            value={iniziale}
            onChange={(e) => setIniziale(e.target.value)}
            inputMode="decimal"
            placeholder="es. 1.234,56"
            className={`${campo} w-40`}
          />
        </label>
        <label className="flex flex-col gap-1 testo-sala text-b58-charcoal">
          Saldo finale (€)
          <input
            value={finale}
            onChange={(e) => setFinale(e.target.value)}
            inputMode="decimal"
            placeholder="es. 3.879,00"
            className={`${campo} w-40`}
          />
        </label>
      </div>
      {errori.length > 0 && (
        <div role="alert" className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2">
          <p className="font-medium">Non ho caricato niente:</p>
          <ul className="list-disc pl-5">
            {errori.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={occupato}
          onClick={carica}
          className="tocco-bottone rounded-lg bg-b58-azione text-b58-sul-colore testo-sala px-3 py-1.5 disabled:opacity-60"
        >
          {occupato ? "Carico…" : "Carica i movimenti"}
        </button>
        <button
          type="button"
          disabled={occupato}
          onClick={onAnnulla}
          className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-b58-campo testo-sala px-3 py-1.5 text-b58-charcoal disabled:opacity-60"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
