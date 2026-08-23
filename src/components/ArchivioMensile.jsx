import { useEffect, useState } from "react";
import DatoNonLetto from "./DatoNonLetto";
import PrintButton from "./PrintButton";
import { leggi, nonLetto } from "../lib/calcoli/letture";
import { downloadCsv } from "../lib/csv";
import { NOMI_MESI } from "../lib/nomiMesi";

// L'archivio di un registro, un mese alla volta.
//
// 🔴 PERCHE' ESISTE, e perché è UN componente e non tre (24/08/2026).
// Le tre schermate HACCP — temperature, non conformità, pulizie —
// avevano tutte la stessa forma sbagliata: un elenco cronologico che non
// finisce mai, illeggibile dopo poche settimane. La cura è la stessa per
// tutte e tre, e scriverla tre volte vorrebbe dire che fra sei mesi si
// comporteranno in tre modi diversi — magari solo su un dettaglio, magari
// proprio su quello che serve davanti a un controllo.
//
// ⚠️ SI CHIEDE UN MESE ALLA VOLTA, e non è una comodità di lettura: questi
// registri crescono ogni giorno e non si fermano mai. Una lettura senza
// limite torna al massimo di mille righe **senza dirlo** — su un
// documento esibibile è la cosa peggiore che possa succedere, perché
// sembra completo. Il perimetro mensile toglie il caso invece di
// sorvegliarlo.
//
// ⚠️ E SE UNA LETTURA FALLISCE NON SI DISEGNA UN ARCHIVIO VUOTO: «in
// questo mese non c'è niente» è un'informazione, e sarebbe falsa.
export default function ArchivioMensile({
  mesi,
  carica,
  colonneCsv,
  nomeFile,
  children,
  vuoto = "Ancora niente da archiviare.",
  etichettaMese,
}) {
  const [scelto, setScelto] = useState(null);
  const [righe, setRighe] = useState(null);

  useEffect(() => {
    if (!scelto) {
      setRighe(null);
      return;
    }
    let vivo = true;
    leggi(carica(scelto.anno, scelto.mese)).then((r) => {
      if (vivo) setRighe(r);
    });
    return () => {
      vivo = false;
    };
  }, [scelto, carica]);

  const scarica = () => {
    if (nonLetto(righe) || !righe?.length) return;
    downloadCsv(`${nomeFile}_${scelto.anno}_${String(scelto.mese).padStart(2, "0")}.csv`, righe, colonneCsv);
  };

  if (!mesi || mesi.length === 0) {
    return <p className="testo-sala text-b58-charcoal-soft/60">{vuoto}</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        {mesi.map((m) => {
          const attivo = scelto?.anno === m.anno && scelto?.mese === m.mese;
          return (
            <button
              key={`${m.anno}-${m.mese}`}
              type="button"
              onClick={() => setScelto(attivo ? null : { anno: m.anno, mese: m.mese })}
              className={`tocco-bottone rounded-lg testo-sala px-3 ${
                attivo
                  ? "bg-b58-terracotta text-b58-parchment"
                  : "border border-b58-charcoal/15 text-b58-charcoal hover:bg-b58-cream-dark"
              }`}
            >
              {NOMI_MESI[m.mese - 1]} {m.anno}
              <span className={attivo ? "opacity-80" : "text-b58-charcoal-soft"}>
                {" "}
                · {etichettaMese ? etichettaMese(m) : m.quante}
              </span>
            </button>
          );
        })}
      </div>

      {scelto && nonLetto(righe) && (
        <DatoNonLetto
          cosa={`le registrazioni di ${NOMI_MESI[scelto.mese - 1]} ${scelto.anno}`}
          nonVuolDire="Non vuol dire che quel mese è vuoto: vuol dire che non l'ho letto."
        />
      )}

      {scelto && !nonLetto(righe) && righe && (
        <>
          {righe.length > 0 && (
            <div className="flex gap-2 mb-3 print:hidden">
              <button
                type="button"
                onClick={scarica}
                className="tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-4"
              >
                Scarica CSV
              </button>
              <PrintButton label="Stampa" />
            </div>
          )}
          {righe.length === 0 ? (
            <p className="testo-sala text-b58-charcoal-soft/60">
              Niente registrato in {NOMI_MESI[scelto.mese - 1]} {scelto.anno}.
            </p>
          ) : (
            children(righe, scelto)
          )}
        </>
      )}
    </>
  );
}
