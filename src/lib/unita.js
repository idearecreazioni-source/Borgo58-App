import { useEffect, useState } from "react";
import { listUnita } from "./api/ingredients";

// LE UNITÀ DI MISURA, CHIESTE AL DATABASE DA UN POSTO SOLO.
//
// 🔴 Fino al 29/08/2026 vivevano in un elenco scritto nel codice (`UNITS` in
// `constants.js`), copiato in **sette** schermate. Diventate dati — per poter
// dare ai materiali di consumo le loro parole — quell'elenco è diventato una
// **seconda verità**: offriva cinque unità mentre il database ne ammetteva
// nove, cioè quattro valori legittimi che nessuna schermata poteva scegliere.
//
// ⚠️ NON L'HO TROVATO RILEGGENDO: l'ha trovato la rete dei vocabolari
// (`tests/app/vocabolari.test.js`), diventata rossa da sola col messaggio
// «il database ammette conf, m, paio, rotolo e la schermata non li offre — un
// valore legittimo che nessuno può scegliere, e in silenzio». È esattamente
// il caso per cui quella rete esiste.
//
// ⚠️ E LE UNITÀ NON SI AGGIUNGONO AL VOLO come le categorie, ed è dichiarato:
// `ingredients.unit` è ancora un vocabolario chiuso del database, quindi
// un'unità creata mentre si compila verrebbe rifiutata al salvataggio. Il
// perché è nella migrazione `20260829000024`.

/**
 * @param ambito «alimenti» (il caso normale) oppure «materiali».
 *
 * ⚠️ Se la lettura fallisce l'elenco resta VUOTO e non si inventa niente:
 *    un menu con dentro cinque unità scritte a mano sarebbe la seconda
 *    verità che questo file esiste per togliere. Un elenco vuoto si vede;
 *    un elenco plausibile e sbagliato no.
 */
export function useUnita(ambito = "alimenti") {
  const [unita, setUnita] = useState([]);

  useEffect(() => {
    let annullato = false;
    (async () => {
      try {
        const u = await listUnita(ambito);
        if (!annullato) setUnita(u);
      } catch {
        // L'errore vero lo dice la schermata che sta caricando i suoi dati.
      }
    })();
    return () => {
      annullato = true;
    };
  }, [ambito]);

  return unita;
}
