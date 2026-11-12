import { useEffect, useState } from "react";
import { listAvvisiBanca } from "../../lib/api/banca";
import { formatDate } from "../../lib/constants";

// GLI AVVISI DELLA BANCA RICEVUTI (12/11/2026, PR B1 del piano «avvisi
// banca e posta», approvato da Alessio). Le mail che Credem manda a banca@
// non passano più da MEMO: si raccolgono, e qui si vede che arrivano.
//
// ⚠️ Per una o due settimane NON diventano movimenti: il lettore si scrive
// sulle mail vere, così niente viene indovinato. Il riquadro lo dice, e
// ogni avviso si apre per leggerne il testo così com'è arrivato.
//
// ⚠️ Un errore di lettura non ferma la pagina della Banca: si dice in una
// riga, e il resto funziona.

export default function AvvisiDellaBanca() {
  const [stato, setStato] = useState(null); // { avvisi, totale } oppure { errore }

  useEffect(() => {
    let vivo = true;
    listAvvisiBanca()
      .then((r) => vivo && setStato(r))
      .catch((e) => vivo && setStato({ errore: e.message }));
    return () => {
      vivo = false;
    };
  }, []);

  if (stato === null) return null;

  if (stato.errore) {
    return (
      <p data-prova="avvisi-banca" className="mb-4 testo-sala text-b58-terracotta-dark-testo">
        Non riesco a leggere gli avvisi della banca: {stato.errore}
      </p>
    );
  }

  const { avvisi, totale } = stato;
  return (
    <section data-prova="avvisi-banca" className="mb-4 rounded-xl bg-b58-campo ring-1 ring-b58-charcoal/10 p-3">
      <details>
        <summary className="tocco-bottone cursor-pointer testo-sala text-b58-charcoal">
          Avvisi della banca ricevuti: {totale} — il lettore arriva quando conosciamo il formato
        </summary>
        {avvisi.length === 0 ? (
          <p className="mt-2 testo-sala text-b58-charcoal-soft">
            Nessuno ancora. Quando la banca manda un avviso alla sua casella, compare qui.
          </p>
        ) : (
          <>
            {totale > avvisi.length && (
              <p className="mt-2 testo-sala text-b58-charcoal-soft">Qui sotto gli ultimi {avvisi.length}.</p>
            )}
            <ul className="mt-2 space-y-1">
              {avvisi.map((a) => (
                <li key={a.id}>
                  <details className="rounded-lg bg-b58-parchment px-3 py-2">
                    <summary className="cursor-pointer testo-sala text-b58-charcoal break-words">
                      {formatDate(a.ricevuta_il)} · {a.oggetto || "(senza oggetto)"}
                    </summary>
                    <p className="mt-1 testo-sala text-b58-charcoal-soft break-words">Da: {a.mittente || "?"}</p>
                    <p className="mt-1 testo-sala text-b58-charcoal whitespace-pre-line break-words">
                      {a.testo || "(nessun testo)"}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}
