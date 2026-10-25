import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DatoNonLetto from "../../components/DatoNonLetto";
import { caparreTrattenute } from "../../lib/api/reservations";
import { formatDate, formatEUR } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";

// LE CAPARRE TENUTE — 13/10/2026.
//
// 🔴 IL DATO C'ERA DAL 27/08 E NON LO MOSTRAVA NESSUNO. La migrazione
//    `20260827000003` distingue la caparra tenuta perché il cliente non si è
//    presentato, e `caparre_trattenute()` la restituisce separata dagli
//    incassi del servizio — ma nessuna schermata la chiamava (trovato dal
//    ripasso della coda, 13/10). Un dato che nessuno può vedere è, per chi
//    usa il gestionale, un dato che non c'è.
//
// ⚠️ SENZA NOMI, ed è voluto: la funzione non li restituisce perché queste
//    righe sopravvivono alla pulizia della privacy. Restano la serata e la
//    cifra, che sono ciò che serve a ritrovare quei soldi.
// ⚠️ «NON LO SO» NON È «NESSUNA»: se la lettura fallisce si dice, con la
//    via per riprovare (regola del 19/08).
export default function CaparreTenute() {
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState("");

  const leggi = useCallback(() => {
    setErrore("");
    setRighe(null);
    caparreTrattenute()
      .then(setRighe)
      .catch((e) => setErrore(e.message));
  }, []);

  useEffect(() => {
    leggi();
  }, [leggi]);

  const totale = (righe ?? []).reduce((s, r) => s + Number(r.importo || 0), 0);

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/cassa"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        Caparre tenute
        <Didascalia>
          Le caparre tenute perché il cliente non si è presentato. Non sono un incasso del servizio:
          stanno qui, separate.
        </Didascalia>
      </h1>

      {errore ? (
        <DatoNonLetto
          cosa="le caparre tenute"
          nonVuolDire="Non vuol dire che non ce ne sono: vuol dire che non lo so."
          onRiprova={leggi}
        />
      ) : righe === null ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : righe.length === 0 ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Nessuna caparra tenuta.</p>
      ) : (
        <>
          <p className="testo-sala-grande text-b58-charcoal mb-3">
            {righe.length === 1 ? "1 caparra" : `${righe.length} caparre`} · {formatEUR(totale)}
          </p>
          <ul className="space-y-2">
            {righe.map((r) => (
              <li
                key={r.movimento_id}
                className="rounded-lg border border-b58-charcoal/15 px-3 py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span className="testo-sala-grande text-b58-charcoal">
                  {r.serata ? `Serata del ${formatDate(r.serata)}` : "Serata non indicata"}
                </span>
                <span className="testo-sala-grande font-medium text-b58-charcoal">
                  {formatEUR(r.importo)}
                </span>
                <span className="testo-sala text-b58-charcoal-soft w-full">
                  Tenuta il {formatDate(r.tenuta_il)} · {r.mezzo === "banca" ? "in banca" : "in cassa"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
