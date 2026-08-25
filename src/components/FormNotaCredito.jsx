import { useState } from "react";
import { formatEUR, oggiLocale } from "../lib/constants";

// Il modulo per registrare una nota di credito su una fattura.
//
// ⚠️ Dice PRIMA cosa succederà, e sono due cose diverse a seconda di
// quando la nota arriva (decisione di Alessio, 17/08/2026): su una fattura
// da pagare si scala e si paga la differenza; su una già pagata resta come
// credito da usare sulla prossima di quel fornitore. Se la schermata non
// lo dicesse, il secondo caso sembrerebbe una nota che non ha fatto niente.
export default function FormNotaCredito({ fattura, onSalva, onAnnulla }) {
  const [numero, setNumero] = useState("");
  // ⚠️ CALENDARIO: la data di un documento del fornitore. Vedi il
  // perimetro della serata in lib/giornataOperativa.js.
  const [data, setData] = useState(oggiLocale());
  const [importo, setImporto] = useState("");
  const [note, setNote] = useState("");
  const [salvando, setSalvando] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala text-b58-charcoal-soft mb-1";

  const pagata = fattura.status === "pagata";
  const daPagare = Number(fattura.da_pagare ?? fattura.amount);
  const valore = Number(importo);
  // ⚠️ Il numero mostrato qui è aritmetica di anteprima su UN solo importo
  // appena digitato, non la ricostruzione di un totale del gestionale:
  // quanto verrà scalato davvero lo decide il database, e appena la nota è
  // registrata la riga mostra il suo numero.
  const avanzo = !pagata && valore > daPagare ? valore - daPagare : 0;

  const salva = async () => {
    if (!(valore > 0) || !data) return;
    setSalvando(true);
    try {
      await onSalva({ numero, data, importo: valore, note });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-b58-charcoal/10">
      <p className="testo-sala text-b58-charcoal-soft mb-2">
        Nota di credito su questa fattura
        {fattura.invoice_number ? ` (#${fattura.invoice_number})` : ""}.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-36">
          <label className={labelClass}>N. della nota</label>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="es. NC-2027/14"
            className={inputClass}
          />
        </div>
        <div className="w-40">
          <label className={labelClass}>Data della nota</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
        </div>
        <div className="w-32">
          <label className={labelClass}>Importo €</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className={labelClass}>Nota (opz.)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="es. resa merce non conforme"
            className={inputClass}
          />
        </div>
        <button
          type="button"
          disabled={salvando || !(valore > 0) || !data}
          onClick={salva}
          className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
        >
          {salvando ? "Registro…" : "Registra la nota"}
        </button>
        <button
          type="button"
          onClick={onAnnulla}
          className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-charcoal pb-2"
        >
          Annulla
        </button>
      </div>

      {/* Cosa succederà: detto prima, non scoperto dopo. */}
      {valore > 0 && (
        <p className="testo-sala text-b58-charcoal-soft mt-2">
          {pagata ? (
            <>
              Questa fattura è già pagata, quindi la nota <strong>non cambia quel pagamento</strong>: resta
              come <strong>credito di {formatEUR(valore)}</strong> con {fattura.supplier?.name}, e te lo
              proporrò quando pagherai la prossima sua fattura.
            </>
          ) : (
            <>
              Si scala su questa fattura: invece di {formatEUR(daPagare)} pagherai{" "}
              <strong>{formatEUR(Math.max(daPagare - valore, 0))}</strong>.
              {avanzo > 0 && (
                <>
                  {" "}
                  La nota è più grande della fattura: {formatEUR(avanzo)} restano come credito col
                  fornitore, non si perdono.
                </>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}
