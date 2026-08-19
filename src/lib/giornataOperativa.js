// A QUALE GIORNATA APPARTIENE QUESTO ISTANTE — la metà che si vede.
//
// ⚠️ IL DIFETTO CHE QUESTO FILE CHIUDE, e non è teorico: dal 19/08/2026 il
// gestionale REGISTRA sulla giornata giusta — `serata_di_servizio()` nel
// database — ma la schermata PROPONEVA ancora `oggiLocale()`. Alle 00:30,
// col locale aperto, quella funzione dice **domani**. È la peggiore delle
// due situazioni possibili: giusto sotto e sbagliato sopra, e il numero
// sbagliato è proprio quello che Alessio conferma con le mani.
//
// ⚠️ NON RICOPIA LA REGOLA. La risposta è la stessa del database, non una
// seconda: `serataDiServizio()` in `calcoli/serata.js` è la funzione pura
// scritta il 18/08 apposta — riceve l'ora invece di contenerla — e
// `service_settings.ora_fine_serata` è **l'unico** posto dove quell'ora
// vive. La prova `tests/app/giornata-operativa.test.js` tiene incollate le
// due strade sugli stessi nove istanti: se divergessero diventa rossa.
//
// ⚠️ IL PERIMETRO È QUELLO DI ALESSIO (19/08), e questo file non lo
// allarga: seguono la **serata** i gesti della cassa e dei conti — il
// conteggio del cassetto, un movimento di prima nota, uno sconto o un
// omaggio, il documento fiscale di un conto. Seguono il **calendario**
// prenotazioni, turni, scadenze, fatture, spese e HACCP, e lì resta
// `oggiLocale()`, che è giusta: cura il fuso, non la serata.
//
// ⚠️ E SI VEDE SEMPRE. Una data che il gestionale sceglie da sé e non
// mostra è la stessa cosa di un valore predefinito silenzioso: dove si
// propone la serata si scrive anche quale, e la si può correggere. È la
// forma decisa da Alessio per il conteggio del cassetto — *si fa da sé, ma
// si vede*.
import { useEffect, useState } from "react";
import { getServiceSettings } from "./api/orders";
import { serataDiServizio } from "./calcoli/serata";
import { oggiLocale } from "./constants";

/**
 * Quale serata è adesso, chiedendo l'ora vera ad Alessio (impostazioni).
 *
 * Se le impostazioni non si leggono resta il giorno di calendario, che è
 * la proposta di prima: si perde la comodità, non il gesto.
 */
export async function serataCorrente() {
  try {
    const s = await getServiceSettings();
    if (s?.ora_fine_serata) return serataDiServizio(new Date(), s.ora_fine_serata);
  } catch {
    // Volutamente muto: vedi sopra.
  }
  return oggiLocale();
}

/**
 * La stessa cosa dentro una schermata: la serata da proporre e l'ora del
 * confine, che serve a scrivere la frase sotto il campo.
 *
 * ⚠️ Finché la lettura non è arrivata `serata` è `null`, e chi la usa tiene
 * la propria proposta di partenza. Non si mette `oggiLocale()` al suo
 * posto: sarebbe indistinguibile da una risposta, e per un istante la
 * schermata direbbe «questa è la serata» proponendo il calendario.
 */
export function useGiornataOperativa() {
  const [serata, setSerata] = useState(null);
  const [oraFineSerata, setOraFineSerata] = useState(null);

  useEffect(() => {
    let vivo = true;
    getServiceSettings()
      .then((s) => {
        if (!vivo || !s?.ora_fine_serata) return;
        setOraFineSerata(s.ora_fine_serata);
        setSerata(serataDiServizio(new Date(), s.ora_fine_serata));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return { serata, oraFineSerata };
}
