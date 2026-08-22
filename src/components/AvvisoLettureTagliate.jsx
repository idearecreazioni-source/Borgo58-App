import { useEffect, useState } from "react";
import {
  ascoltaLettureTagliate,
  dimenticaLettureTagliate,
  elencoLettureTagliate,
} from "../lib/lettureTagliate";

// L'AVVISO CHE UNA RISPOSTA ERA INCOMPLETA.
//
// 🔴 Dal 19/08/2026: quando il database consegna meno righe di quelle che
// ci sono, chi sta guardando la schermata **deve saperlo**. Un avviso nel
// registro tecnico non basta — non lo legge nessuno, e il difetto resta
// quello che era: dei numeri credibili calcolati su un elenco a metà.
//
// ⚠️ Sta nel telaio comune e non nelle singole schermate, per la stessa
// ragione per cui il riconoscimento sta nel punto unico delle letture: una
// schermata nuova è coperta senza che nessuno si ricordi di aggiungerlo.
//
// ⚠️ E NON SPARISCE DA SOLO: si toglie solo premendo, dopo aver ristretto
// il periodo. Un avviso che se ne va allo scadere di un tempo lascia sullo
// schermo dei numeri che nessuno sa più essere parziali.
export default function AvvisoLettureTagliate() {
  const [tagliate, setTagliate] = useState(elencoLettureTagliate);

  useEffect(() => ascoltaLettureTagliate(setTagliate), []);

  if (tagliate.length === 0) return null;

  return (
    <div className="bg-b58-terracotta/15 ring-1 ring-b58-terracotta/50 rounded-lg px-3 py-2 mb-4 print:hidden">
      <p className="testo-sala text-b58-charcoal">
        <strong>Quello che vedi è incompleto.</strong> Il gestionale ha ricevuto solo una parte
        delle righe, quindi anche i totali calcolati qui sopra sono parziali. Restringi il periodo
        o i filtri e riprova.
      </p>
      <ul className="testo-sala text-b58-charcoal-soft mt-1 space-y-0.5">
        {tagliate.map((t) => (
          <li key={t.dove}>
            {t.dove}: <strong>{t.ricevute}</strong> righe ricevute su <strong>{t.totali}</strong>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={dimenticaLettureTagliate}
        className="tocco-bottone mt-1 testo-sala underline text-b58-terracotta-dark hover:text-b58-charcoal"
      >
        Ho ristretto la ricerca, togli l&apos;avviso
      </button>
    </div>
  );
}
