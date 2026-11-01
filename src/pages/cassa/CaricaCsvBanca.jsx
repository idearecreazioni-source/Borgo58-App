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
// ⚠️ I movimenti già caricati si rileggono AL MOMENTO di caricare, non si
//    usano quelli letti all'apertura: nel frattempo il CBI di quei giorni
//    può essere entrato da un'altra finestra.

const campo =
  "tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

const NOMI = { csv: "dal CSV", cbi: "dal file CBI" };

export default function CaricaCsvBanca({ file, conti, leggiEsistenti, onCarica, onAnnulla }) {
  const attivi = (conti ?? []).filter((c) => c.attivo);
  const [scelto, setScelto] = useState("");
  // Il principale finché non se ne sceglie un altro, anche se i conti
  // arrivano dopo il file.
  const contoId = scelto || ((attivi.find((c) => c.predefinito) ?? attivi[0])?.id ?? "");
  const conto = attivi.find((c) => String(c.id) === String(contoId));
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

  const controlla = async () => {
    const e = [];
    if (conti === null) e.push("Sto ancora leggendo i conti correnti: riprova fra un momento.");
    else if (!conto) e.push("Scegli il conto su cui caricare i movimenti.");
    else if (!conto.iban) {
      e.push(`Il conto «${conto.nome}» non ha l'IBAN: aggiungilo da Cassa → Conti correnti, poi riprova.`);
    }
    const ci = euroScritti(iniziale);
    const cf = euroScritti(finale);
    const illeggibile = (iniziale.trim() && ci === null) || (finale.trim() && cf === null);
    if (iniziale.trim() && ci === null) e.push(`Il saldo iniziale «${iniziale}» non si legge.`);
    if (finale.trim() && cf === null) e.push(`Il saldo finale «${finale}» non si legge.`);
    if (!illeggibile) e.push(...controllaSaldi(movimenti, ci, cf));
    if (e.length || !conto) return e;

    // ⚠️ Senza i movimenti già caricati non si sa se è un doppione: ci si ferma.
    let esistenti;
    try {
      esistenti = await leggiEsistenti();
    } catch (err) {
      return [`Non riesco a leggere i movimenti già caricati (${err.message}), quindi non posso controllare i doppioni. Riprova.`];
    }
    const s = sovrapposizioni(movimenti, "csv", conto.id, esistenti);
    if (s) {
      e.push(
        `Sul conto «${conto.nome}» fra il ${formatDate(s.dal)} e il ${formatDate(s.al)} ci sono già`
        + ` ${s.quanti} ${s.quanti === 1 ? "movimento caricato" : "movimenti caricati"} ${NOMI[s.altroFormato]}:`
        + " gli stessi movimenti entrerebbero due volte. Per quei giorni usa un file solo.",
      );
    }
    return e;
  };

  const carica = async () => {
    if (inCorso.current) return;
    inCorso.current = true;
    setOccupato(true);
    try {
      const e = await controlla();
      setErrori(e);
      if (!e.length) await onCarica(conto.iban, movimentiCsvDaCaricare(movimenti));
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
      {file.daContabilizzare > 0 && (
        <p className="testo-sala text-b58-charcoal-soft">
          {file.daContabilizzare === 1
            ? "1 movimento è ancora «da contabilizzare» in banca: lo lascio fuori, arriverà col prossimo file."
            : `${file.daContabilizzare} movimenti sono ancora «da contabilizzare» in banca: li lascio fuori, arriveranno col prossimo file.`}
        </p>
      )}
      <p className="testo-sala text-b58-charcoal-soft">
        Il CSV non dice il conto né i saldi: scrivili tu, dall&apos;estratto conto, così controllo che il file sia intero.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 testo-sala text-b58-charcoal">
          Conto
          <select value={contoId} onChange={(e) => setScelto(e.target.value)} disabled={occupato} className={campo}>
            {conti === null && <option value="">Leggo i conti…</option>}
            {conti !== null && attivi.length === 0 && <option value="">Nessun conto corrente</option>}
            {attivi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.iban ? "" : " (senza IBAN)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 testo-sala text-b58-charcoal">
          Saldo iniziale (€)
          <input
            value={iniziale}
            onChange={(e) => setIniziale(e.target.value)}
            disabled={occupato}
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
            disabled={occupato}
            inputMode="decimal"
            placeholder="es. 3.879,00"
            className={`${campo} w-40`}
          />
        </label>
      </div>
      {conto?.iban && (
        <p className="testo-sala text-b58-charcoal-soft">
          Li carico sul conto «{conto.nome}», IBAN {conto.iban}: controlla che i saldi siano di questo conto.
        </p>
      )}
      {errori.length > 0 && (
        <div role="alert" className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2">
          <p className="font-medium">Non ho caricato niente:</p>
          <ul className="list-disc pl-5">
            {errori.map((e, i) => (
              <li key={i}>{e}</li>
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
