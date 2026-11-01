import { formatDate } from "../lib/constants";
import Didascalia from "./Didascalia";

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
  // Il riquadro del campo. In una `riga-campi` si passa `w-min` (11/09/2026):
  // la cella resta larga quanto la sua data, e la frase qui sotto va a capo
  // dentro — senza, la frase allargava la cella a tutta riga.
  className = "",
}) {
  return (
    <div className={className}>
      {/* 🔴 LA FRASE SOTTO IL CAMPO E' PASSATA DIETRO IL «?» — 25/10/2026,
          chiesto da Alessio guardando la Cassa: «eliminare tutte le
          didascalie che creano confusione». Rovesciamento n. 105.
          ⚠️ NON E' STATA TOLTA: la ragione scritta qui sopra vale ancora
          (distingue «ha scelto per me» da «ha sbagliato»), quindi resta
          a un tocco, accanto all'etichetta. Il prezzo: chi non tocca il
          segno non vede piu' quale serata sta datando. */}
      <label className={labelClass}>
        {label}
        {/* ⚠️ Senza l'ora vera la frase non si scrive: inventarne una qui
            sarebbe il secondo orologio, e direbbe «fino alle 05:00» anche
            il giorno che Alessio cambia quel numero. */}
        {/* ⚠️ Il bersaglio del «?» è alto più della riga dell'etichetta:
            senza i margini negativi alzava l'etichetta e la casella finiva
            più in basso delle altre della stessa riga. */}
        {oraFineSerata && (
          <span className="inline-block align-middle -my-4">
            <Didascalia etichetta="Quale serata">
              {frase} <strong>{formatDate(value)}</strong>. Fino alle{" "}
              {String(oraFineSerata).slice(0, 5)} è ancora la sera prima.
            </Didascalia>
          </span>
        )}
      </label>
      {/* 🔴 LA LARGHEZZA STA QUI DENTRO, NON NEI CHIAMANTI — 21/09/2026.
          Dei tre posti che usano questo campo, due passavano `campo-data`
          nella classe e uno (la home della Cassa) no: la stessa casella era
          larga quanto la sua data in due schermate e stirata a tutta colonna
          nella terza. ⚠️ Non era una svista da correggere una volta — era
          una misura affidata alla memoria di chi scrive il chiamante, e una
          dimenticanza li' non produce nessun errore. Ora la porta il
          componente, e chi lo usa non la puo' dimenticare. */}
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass ?? ""} campo-data`}
      />
    </div>
  );
}
