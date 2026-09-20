import { QUARTI_DI_ORA, minutiDaOfferire, oreDaOfferire, oraComposta } from "../lib/calcoli/oraQuarti";

// =====================================================================
// L'ORA SI SCEGLIE A QUARTI D'ORA — 20/09/2026
// =====================================================================
// 🔴 PERCHE' NON BASTAVA `step={900}` SUL CAMPO ORARIO NATIVO, ed è la
//    correzione chiesta dopo averlo visto: `step` dice al browser quali
//    valori sono VALIDI, non quali OFFRIRE. Su Android e su iPhone la
//    rotella dei minuti continua a girare su tutti e sessanta, e chi
//    sceglie le 20:07 lo scopre solo quando il modulo rifiuta di partire —
//    cioè un divieto che si incontra dopo, invece di una scelta che si
//    vede prima.
//
// ⚠️ QUINDI I MINUTI SONO UN MENU, e le voci sono quattro: 00, 15, 30, 45.
//    Quello che non compare non si può scegliere.
//
// 🔴 MA UN ORARIO GIA' SCRITTO NON SI ARROTONDA E NON SI RISCRIVE. Un
//    promemoria salvato alle 20:07 — o alle 9:50, che fino a ieri era
//    regolare — deve restare leggibile e salvabile: il suo minuto compare
//    nel menu come voce in più, marcata «scritto prima». Appena però si
//    sceglie un altro minuto, si sceglie fra i quarti: la voce vecchia non
//    torna più.
//    ⚠️ Arrotondare da soli sarebbe peggio del divieto: cambierebbe
//    l'orario di un promemoria che qualcuno aveva messo, senza dirlo.

export default function CampoOraQuarti({
  value,
  onChange,
  disabled = false,
  className = "",
  style,
  etichettaOre = "Ora",
  etichettaMinuti = "Minuti",
  "data-campo": dataCampo,
}) {
  const [ora = "", minuti = ""] = (value || "").split(":");

  const scegliOra = (nuova) => {
    // ⚠️ Scegliendo un'ora senza minuti si parte dal quarto zero: è una
    //    proposta visibile, non una cadenza decisa di nascosto.
    if (!nuova) return onChange("");
    onChange(oraComposta(nuova, minuti || QUARTI_DI_ORA[0]));
  };

  const scegliMinuti = (nuovi) => {
    if (!ora) return;
    onChange(oraComposta(ora, nuovi));
  };

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={etichettaOre}
        data-campo={dataCampo ? `${dataCampo}-ore` : undefined}
        value={ora}
        disabled={disabled}
        onChange={(e) => scegliOra(e.target.value)}
        className={className}
        style={style}
      >
        <option value="">--</option>
        {oreDaOfferire().map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-b58-charcoal-soft">
        :
      </span>
      <select
        aria-label={etichettaMinuti}
        data-campo={dataCampo ? `${dataCampo}-minuti` : undefined}
        value={minuti}
        disabled={disabled || !ora}
        onChange={(e) => scegliMinuti(e.target.value)}
        className={className}
        style={style}
      >
        {!ora && <option value="">--</option>}
        {minutiDaOfferire(minuti).map((m) => (
          <option key={m.valore} value={m.valore}>
            {m.etichetta}
          </option>
        ))}
      </select>
    </div>
  );
}
