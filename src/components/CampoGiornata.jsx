import { formatDate } from "../lib/constants";

// IL CAMPO DELLA GIORNATA — uno solo, per tutte le schermate che datano un
// gesto della cassa o di un conto.
//
// ⚠️ PERCHÉ UN COMPONENTE E NON QUATTRO CAMPI UGUALI. La frase sotto il
// campo non è decorazione: è la sola cosa che distingue «il gestionale ha
// scelto per me» da «il gestionale ha sbagliato». Scritta a mano in quattro
// schermate, alla quinta manca — ed è precisamente la schermata in cui
// qualcuno si accorgerà del numero tre giorni dopo.
//
// ⚠️ E LA DATA RESTA CORREGGIBILE. Il caso che lo rende necessario esiste
// davvero: il cassetto contato prima di mezzanotte a locale chiuso presto, o
// la mattina dopo prima di aprire. Il gestionale propone, Alessio conferma —
// come il mezzo di pagamento, la riga della lista e la causale.
export default function CampoGiornata({
  label = "Giornata",
  value,
  onChange,
  oraFineSerata,
  frase = "Stai lavorando sulla serata di",
  labelClass,
  inputClass,
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      {/* ⚠️ Senza l'ora vera la frase non si scrive: inventarne una qui
          sarebbe il secondo orologio, e direbbe «fino alle 05:00» anche il
          giorno che Alessio cambia quel numero. */}
      {oraFineSerata && (
        <p className="text-xs text-b58-charcoal-soft mt-1">
          {frase} <strong className="text-b58-charcoal">{formatDate(value)}</strong>. Fino alle{" "}
          {String(oraFineSerata).slice(0, 5)} è ancora la sera prima.
        </p>
      )}
    </div>
  );
}
