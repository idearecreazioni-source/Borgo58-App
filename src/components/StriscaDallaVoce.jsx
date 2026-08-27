import { Link } from "react-router-dom";

/**
 * La striscia che spiega perché i campi sono già pieni.
 *
 * ⚠️ NON È UNA CORTESIA. Un modulo che si apre pieno senza dire perché
 * sembra un modulo sporco di prima, e chi lo trova così o svuota tutto o
 * salva senza guardare. La striscia dice **cosa aveva detto**, con le sue
 * parole, che è l'unica cosa che permette di controllare i campi.
 *
 * ⚠️ E DOPO IL SALVATAGGIO CAMBIA, invece di sparire: sparendo, chi ha
 * appena salvato non saprebbe se la riga in sospeso si è chiusa — e nel
 * dubbio ci tornerebbe sopra.
 */
export function StriscaDallaVoce({ venuto }) {
  if (!venuto?.cePer) return null;

  if (venuto.errore) {
    return (
      <div className="mb-4 rounded-lg bg-b58-terracotta/10 px-3 py-2 testo-sala text-b58-terracotta-dark">
        Sei arrivato qui da una cosa che avevi detto a voce, ma non sono riuscito a
        rileggerla: {venuto.errore} — i campi qui sotto sono vuoti, e quello che avevi
        detto è ancora nell'elenco delle cose in sospeso.
      </div>
    );
  }

  if (venuto.chiusa) {
    return (
      <div className="mb-4 rounded-lg bg-b58-olive/10 px-3 py-2 testo-sala text-b58-charcoal">
        ✓ Fatto. La cosa che avevi detto non aspetta più.{" "}
        <Link to="/detta" className="text-b58-terracotta hover:underline">
          Torna a quello che aspetta →
        </Link>
      </div>
    );
  }

  if (!venuto.azione) return null;

  return (
    <div className="mb-4 rounded-lg bg-b58-gold/15 ring-1 ring-b58-gold-dark/30 px-3 py-2">
      <p className="testo-sala text-b58-charcoal">
        Stai finendo a mano una cosa che avevi detto: «{venuto.azione.testo_detto}»
      </p>
      <p className="testo-sala mt-0.5 text-b58-charcoal-soft">
        Quello che avevo capito è già scritto qui sotto. Aggiungi il resto e salva: da
        quel momento smette di aspettare.
      </p>
    </div>
  );
}
