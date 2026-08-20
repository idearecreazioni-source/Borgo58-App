import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { destinatariCommerciali, numeriPerBroadcast } from "../../lib/api/customers";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";

// SCRIVERE A PIÙ CLIENTI — 20/08/2026, blocchi 1 e 4 del mandato della posta.
//
// 🔴 QUESTA SCHERMATA NON MANDA NIENTE DA SOLA, ed è la decisione che regge
// il mandato: scrivere a chi ha prenotato per confermargli il tavolo non ha
// bisogno di niente e succede da sé; **mandare il menu del mese a duecento
// persone pretende il consenso**, e il rifiuto sta nel database — non qui.
//
// ⚠️ E l'elenco dice **anche chi resta fuori, con la ragione**: un elenco di
// destinatari senza gli esclusi si legge «sono tutti», e chi manda non
// saprebbe di aver lasciato fuori metà rubrica.
export default function Comunicazioni() {
  const [righe, setRighe] = useState([]);
  const [numeri, setNumeri] = useState(null);
  const [copiato, setCopiato] = useState("");

  useEffect(() => {
    leggi(destinatariCommerciali()).then(setRighe);
    leggi(numeriPerBroadcast()).then(setNumeri);
  }, []);

  const elenco = nonLetto(righe) ? [] : righe;
  const possono = elenco.filter((r) => r.puo_ricevere);
  const no = elenco.filter((r) => !r.puo_ricevere);

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/calendario-eventi/clienti"
        className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Clienti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Scrivere a più clienti</h1>

      {nonLetto(righe) ? (
        <DatoNonLetto
          cosa="a chi si può scrivere"
          nonVuolDire="Non vuol dire che non c'è nessuno: vuol dire che non lo so."
          onRiprova={() => leggi(destinatariCommerciali()).then(setRighe)}
        />
      ) : (
        <>
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-1">
              Puoi scrivere a {possono.length}
            </h2>
            {possono.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft">
                Nessuno ti ha ancora detto che gli si può scrivere. Si segna sulla sua scheda, quando
                te lo dice.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {possono.map((r) => (
                  <li key={r.customer_id} className="text-sm text-b58-charcoal">
                    <Link
                      to={`/calendario-eventi/clienti/${r.customer_id}`}
                      className="hover:text-b58-terracotta"
                    >
                      {r.nome}
                    </Link>{" "}
                    <span className="text-b58-charcoal-soft">{r.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 🔴 CHI RESTA FUORI, E PERCHÉ. Senza questo riquadro l'elenco di
              sopra si legge «sono tutti i miei clienti», e non lo è quasi mai. */}
          {no.length > 0 && (
            <div className="rounded-xl bg-b58-cream-dark/40 p-5 mb-6">
              <h2 className="text-sm font-semibold text-b58-charcoal mb-2">
                Restano fuori in {no.length}
              </h2>
              <ul className="space-y-1">
                {no.map((r) => (
                  <li key={r.customer_id} className="text-xs text-b58-charcoal">
                    <Link
                      to={`/calendario-eventi/clienti/${r.customer_id}`}
                      className="hover:text-b58-terracotta"
                    >
                      {r.nome}
                    </Link>
                    <span className="text-b58-charcoal-soft"> — {r.perche_no}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* L'ELENCO DEI NUMERI PER WHATSAPP */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">
          I numeri per una lista WhatsApp
        </h2>
        {/* 🔴 IL GESTIONALE NON MANDA LISTE, e lo dice qui invece di lasciarlo
            credere: WhatsApp normale non consente invii automatici a una
            lista. Quello che può fare è preparare i numeri — la parte noiosa. */}
        <p className="text-xs text-b58-charcoal-soft mb-3">
          La lista la crei tu dal telefono: qui ci sono i numeri già pronti da copiare.
        </p>

        {nonLetto(numeri) ? (
          <DatoNonLetto cosa="i numeri dei clienti" />
        ) : (
          numeri && (
            <>
              {/* 🔴 L'AVVERTENZA STA QUI, ACCANTO ALL'ELENCO, e non in un
                  documento: un broadcast NON arriva a chi non ha il numero di
                  Alessio salvato in rubrica, e WhatsApp non lo segnala —
                  risulta «mandato» e non è mai arrivato. Il gestionale non
                  può saperlo (non vede la rubrica), quindi lo dice. */}
              <p className="text-sm text-b58-charcoal bg-b58-gold/10 rounded-lg px-3 py-2 mb-3">
                {numeri.avvertenza}
              </p>
              {numeri.quanti > 0 && (
                <>
                  <textarea
                    readOnly
                    value={numeri.numeri}
                    rows={Math.min(8, numeri.quanti)}
                    className="w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(numeri.numeri);
                        setCopiato("Numeri copiati.");
                      } catch {
                        // ⚠️ SILENZIO MOTIVATO: la copia può essere negata dal
                        // browser e non è un guasto — i numeri sono già a
                        // schermo, selezionabili a mano. Non c'è nessuna
                        // informazione che si perde tacendo.
                        setCopiato("Non sono riuscito a copiarli: selezionali qui sopra.");
                      }
                    }}
                    className="rounded-lg border border-b58-charcoal/20 text-sm px-4 py-2 mt-2 text-b58-charcoal"
                  >
                    Copia i numeri
                  </button>
                  {copiato && <span className="text-xs text-b58-charcoal-soft ml-3">{copiato}</span>}
                </>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
