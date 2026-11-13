import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useChiudiConEsc } from "../../lib/chiudiConEsc";

// LA FATTURA SUBITO, DALLA CHIUSURA DEL CONTO — 13/11/2026, chiesto da
// Alessio («la fattura perché deve essere promessa? non può essere emessa
// sempre al momento?», e poi «sì passalo alla chat operativa»).
//
// Il conto è appena stato chiuso con «Il cliente vuole fattura»: lo scontrino
// NON è uscito e il conto è «fattura promessa». Da qui si apre subito la
// fattura già compilata coi piatti (Fatture ai clienti, `?ordine=`), così i
// dati fiscali si prendono mentre il cliente è ancora al tavolo.
//
// ⚠️ SOLO IL TITOLARE: la pagina delle fatture è riservata a lui. Allo staff
//    si dice chiaramente chi la fa e dove resta in attesa, invece di un
//    pulsante che porterebbe a una pagina chiusa.
// ⚠️ «Più tardi» non perde niente: il conto resta «fattura promessa» in
//    Cassa → Incassato e scontrinato, con «Prepara la fattura».

export default function FatturaDelConto({ order, onFatto }) {
  const auth = useAuth();
  const titolare = Boolean(auth?.isTitolare);
  useChiudiConEsc(true, onFatto);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fattura-del-conto-titolo"
      className="fixed inset-0 bg-b58-velo/50 flex items-center justify-center p-4 z-50"
    >
      <div className="bg-b58-campo rounded-xl max-w-xl w-full overflow-hidden">
        <div className="bg-b58-inverso text-b58-sul-colore px-4 py-3">
          <h2 id="fattura-del-conto-titolo" className="testo-sala-grande">
            Conto {order.table_label ? `del tavolo ${order.table_label} ` : ""}chiuso: il cliente vuole fattura
          </h2>
        </div>
        <div className="p-4 space-y-3">
          {titolare ? (
            <>
              <p className="testo-sala text-b58-charcoal">
                Lo scontrino non è uscito. Prepara la fattura adesso: i piatti ci sono già, ti servono solo i dati del
                cliente.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/fatture-clienti?ordine=${order.id}`}
                  onClick={onFatto}
                  className="tocco-bottone inline-flex items-center rounded-lg bg-b58-azione text-b58-sul-colore testo-sala px-4"
                  data-prova="prepara-fattura-ora"
                >
                  Prepara la fattura ora
                </Link>
                <button
                  type="button"
                  onClick={onFatto}
                  className="tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-4"
                >
                  Più tardi
                </button>
              </div>
              <p className="testo-sala text-b58-charcoal-soft">
                Più tardi la trovi in Cassa → Incassato e scontrinato, con «Prepara la fattura».
              </p>
            </>
          ) : (
            <>
              <p className="testo-sala text-b58-charcoal" role="status">
                Lo scontrino non è uscito. La fattura la prepara il titolare: chiedi al cliente i suoi dati (ragione
                sociale o nome, partita IVA o codice fiscale, indirizzo) e lasciali al titolare. Il conto resta in attesa
                in Cassa.
              </p>
              <button
                type="button"
                onClick={onFatto}
                className="tocco-bottone rounded-lg bg-b58-azione text-b58-sul-colore testo-sala px-4"
              >
                Fatto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
