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
// ⚠️ E NON SPARISCE DA SOLO: si toglie solo premendo. Un avviso che se ne
// va allo scadere di un tempo lascia sullo schermo dei numeri che nessuno
// sa più essere parziali.
//
// 🔴 LE PAROLE DICONO SOLO CIÒ CHE È VERO IN OGNI SCHERMATA — 25/09/2026,
// dal censimento visivo. Diceva «i totali calcolati qui sopra» e ordinava
// «restringi il periodo o i filtri»: vero in Prima nota, falso in Posta,
// Magazzino, Carico, Ricettario → Ingredienti e Schede prodotto, dove
// l'avviso compare (sul progetto di prova: 1000 prodotti su ~1370) e non
// c'è né un periodo né un totale sopra. Un consiglio che non si può
// seguire è un vicolo cieco. L'avviso vive nel telaio comune e non sa quale
// schermata ha dei filtri, quindi dice il fatto e il numero, non il gesto.
export default function AvvisoLettureTagliate() {
  const [tagliate, setTagliate] = useState(elencoLettureTagliate);

  useEffect(() => ascoltaLettureTagliate(setTagliate), []);

  if (tagliate.length === 0) return null;

  return (
    <div
      data-avviso-letture-tagliate
      className="bg-b58-terracotta/15 ring-1 ring-b58-terracotta/50 rounded-lg px-3 py-2 mb-4 print:hidden"
    >
      <p className="testo-sala text-b58-charcoal">
        <strong>Quello che vedi è incompleto.</strong> Il gestionale ha ricevuto solo una parte
        delle righe: questa schermata mostra un elenco parziale, e quello che manca non compare.
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
        Ho visto, togli l&apos;avviso
      </button>
    </div>
  );
}
