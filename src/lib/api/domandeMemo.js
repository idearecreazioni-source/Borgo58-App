// =====================================================================
// LE LETTURE CHE RISPONDONO A UNA DOMANDA DI MEMO — fase 1 (07/09/2026)
// =====================================================================
// 🔴 QUI NON SI SCRIVE NIENTE, E NON È UNA CONVENZIONE: in questo file non
//    compare `eseguiOperazione`, non compare nessun `insert`, `update` o
//    `delete`, e non si chiama nessuna funzione del database che scriva.
//    Una prova di forma lo sorveglia, perché una riga che scrive aggiunta
//    qui fra sei mesi non darebbe nessun errore — funzionerebbe.
//
// 🔴 E SI LEGGE COL PERMESSO DI CHI STA GUARDANDO. Le letture passano dal
//    collegamento dell'app, quindi dalla RLS: se un impegno non è visibile
//    alla sala, alla sala non arriva — non perché lo nasconda MEMO, ma
//    perché il database non glielo dà. Farle dalla funzione online, che
//    gira con la chiave di servizio, avrebbe consegnato dati scavalcando il
//    permesso.
//
// ⚠️ NESSUNA LETTURA DI SOLDI. Nessuna di queste tocca `v_recipe_costs`,
//    `stock_lots` o qualunque cosa porti un prezzo: alle nove domande della
//    fase 1 il denaro non serve, e non chiederlo è più forte che
//    chiederlo e non mostrarlo.
//
// ⚠️ OGNI LETTURA PASSA DA `leggi()`: una che fallisce torna marcata
//    «non letta», e la regola pura la trasforma in «non lo so» invece che
//    in uno zero. È la ragione per cui questo file non ha nessun `catch`.

import { leggi, nonLetto } from "../calcoli/letture";
import { componiRisposta, fraICandidati } from "../calcoli/domande";
import { getRecipeAllergens, listRecipes } from "./recipes";
import { listStockLevels } from "./stock";
import { listPartiteInScadenza } from "./scadenze";
import { agendaCorsie } from "./tasks";

/**
 * Solo le letture che servono a QUELLA domanda.
 *
 * ⚠️ Non si legge tutto «così è pronto»: ogni lettura è un giro di rete in
 * cella, e tre giri per rispondere a «cosa devo fare oggi» sono tre volte
 * il tempo in cui lui sta fermo a guardare il telefono.
 */
export async function letturePerDomanda(domanda) {
  const chiede = domanda?.chiede ?? null;
  const soggetto = domanda?.soggetto?.trim() || null;

  switch (chiede) {
    case "ricetta_esiste":
      return { ricette: soggetto ? await leggi(listRecipes({ search: soggetto })) : [] };

    case "allergeni": {
      if (!soggetto) return { ricette: [] };
      const ricette = await leggi(listRecipes({ search: soggetto }));
      if (nonLetto(ricette)) return { ricette };
      // ⚠️ Gli allergeni si chiedono SOLO quando la ricetta è una sola:
      //    con due candidati la risposta è «di quale?», e leggerli
      //    entrambi sarebbe lavoro fatto per una domanda non ancora posta.
      //    La stessa regola che decide «uno o più d'uno» sta in un posto
      //    solo, altrimenti si leggerebbero gli allergeni di una ricetta e
      //    se ne mostrerebbero di un'altra.
      const ristrette = fraICandidati(ricette, domanda?.scelto ?? null, "id");
      if (ristrette.length !== 1) return { ricette };
      return { ricette, allergeni: await leggi(getRecipeAllergens(ristrette[0].id)) };
    }

    case "piatti_in_carta":
      return { ricette: await leggi(listRecipes({ statusFilter: "in_carta" })) };

    case "quanto_ho":
    case "cosa_manca":
      return { giacenze: await leggi(listStockLevels()) };

    case "cosa_scade":
      return { partite: await leggi(listPartiteInScadenza()) };

    case "agenda_oggi":
    case "agenda_in_ritardo":
    case "quando_scade":
      return { impegni: await leggi(agendaCorsie()) };

    default:
      return {};
  }
}

/**
 * La risposta scritta a una domanda: si legge, e si compone.
 *
 * Restituisce anche i dati letti, perché scegliere fra due candidati non
 * debba rileggere quello che è già stato letto.
 */
export async function rispondiA(domanda) {
  const letture = await letturePerDomanda(domanda);
  return { domanda, letture, risposta: componiRisposta(domanda, letture) };
}
