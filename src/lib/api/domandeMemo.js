// =====================================================================
// LE LETTURE CHE RISPONDONO A UNA DOMANDA DI MEMO
// (fase 1: 07/09 · fase 3: 08/09/2026)
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
// 🔴 I SOLDI ENTRANO DALLA FASE 3, E DA UNA PORTA SOLA — è un
//    rovesciamento dichiarato. Fino al 07/09 qui non si leggeva niente che
//    portasse un prezzo, e la ragione era buona: alle nove domande di
//    allora il denaro non serviva, e non chiederlo è più forte che
//    chiederlo e non mostrarlo. Dall'08/09 quattro domande parlano di
//    quello che deve uscire — fatture, scadenze, ordini, note di credito —
//    quindi il divieto generale diventerebbe una regola che nessuno può
//    rispettare.
//    ⚠️ Al suo posto vale un confine più stretto, e sorvegliato: si leggono
//    i **debiti verso i fornitori**, che il database difende col portiere
//    del titolare, e **non** si legge nessun costo di ricetta, di lotto o
//    di magazzino — quelli non servono a nessuna domanda, e chi non arriva
//    al browser non può finire a schermo per sbaglio.
//    ⚠️ E il conto di quanto si deve NON si rifà qui: `da_pagare` è una
//    colonna calcolata dal database, e si chiede con la STESSA stringa che
//    chiede la schermata delle fatture (`SELECT_FATTURA`). Una copia qui
//    renderebbe muta la prova che sorveglia quella stringa.
//
// ⚠️ OGNI LETTURA PASSA DA `leggi()`: una che fallisce torna marcata
//    «non letta», e la regola pura la trasforma in «non lo so» invece che
//    in uno zero. È la ragione per cui questo file non ha nessun `catch`.

import { NON_LETTO, leggi, nonLetto } from "../calcoli/letture";
import {
  candidatiRicetta,
  componiRisposta,
  fraICandidati,
  nominaLAgenda,
} from "../calcoli/domande";
import { getRecipeAllergens, listRecipes } from "./recipes";
import { listStockLevels } from "./stock";
import { listPartiteInGiacenza, listPartiteInScadenza } from "./scadenze";
import { agendaCorsie } from "./tasks";
import { getEntities } from "./entities";
import { listSupplierInvoices, creditiFornitore } from "./supplierInvoices";
import { listScadenzePreviste } from "./cash";
import { listaOrdini } from "./ordini";
import { oggiLocale } from "../constants";

/**
 * IL SOGGETTO DEI SOLDI, LETTO E NON DATO PER SCONTATO.
 *
 * ⚠️ Dal 30/08 i soggetti sono tre, e «la tasca» non è una società: le
 * domande su quello che deve uscire guardano **la S.r.l.s.**, cioè
 * l'osteria. E anche questa lettura passa da `leggi()`: se cade, non si sa
 * di chi sarebbero quei soldi — quindi non si legge niente e si dice «non
 * lo so», invece di sceglierne uno.
 */
async function soggettoDeiSoldi() {
  const soggetti = await leggi(getEntities());
  if (nonLetto(soggetti) || !soggetti?.srls?.id) return null;
  return soggetti.srls.id;
}

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
      // ⚠️ GLI STESSI CANDIDATI DELLA REGOLA CHE COMPONE LA FRASE, e non
      //    una seconda scelta scritta qui: se i due criteri divergessero,
      //    questa lettura direbbe «sono due, gli allergeni non li leggo» e
      //    la regola ne sceglierebbe una — MEMO risponderebbe «non lo so»
      //    su un piatto che ha appena riconosciuto.
      const { scelte } = candidatiRicetta(ricette, soggetto);
      const ristrette = fraICandidati(scelte, domanda?.scelto ?? null, "id");
      if (ristrette.length !== 1) return { ricette };
      return { ricette, allergeni: await leggi(getRecipeAllergens(ristrette[0].id)) };
    }

    case "piatti_in_carta":
      return { ricette: await leggi(listRecipes({ statusFilter: "in_carta" })) };

    // ⚠️ LA GIORNATA ARRIVA DA FUORI, come in «quando scade …»: serve a
    //    dire se la prima partita è già scaduta invece di raccontarla al
    //    futuro. Calcolarla dentro la regola vorrebbe dire un altro
    //    orologio, e questo progetto ne ha già contati undici.
    case "quanto_ho":
      return { giacenze: await leggi(listStockLevels()), oggi: oggiLocale() };

    case "cosa_manca":
      return { giacenze: await leggi(listStockLevels()) };

    case "cosa_scade":
      return { partite: await leggi(listPartiteInScadenza()) };

    case "agenda_oggi":
    case "agenda_in_ritardo":
      return { impegni: await leggi(agendaCorsie()) };

    // ===============================================================
    // FASE 3 — QUELLO CHE DEVE USCIRE (08/09/2026)
    // ===============================================================
    // ⚠️ LA GIORNATA ARRIVA DA FUORI, come per «quanto ne ho»: serve a
    //    dire «scaduta da 4 giorni» invece di raccontare al futuro una
    //    scadenza passata. Calcolarla dentro la regola vorrebbe dire un
    //    altro orologio, e questo progetto ne ha già contati undici.
    case "fatture_da_pagare":
      // ⚠️ Il filtro è nel DATABASE («status»), non qui: su un anno di
      //    lavoro le fatture pagate sono la maggior parte, e leggerle
      //    tutte per scartarle nel browser vuol dire una lettura che
      //    prima o poi torna tagliata senza dirlo.
      return {
        oggi: oggiLocale(),
        fatture: await leggi(listSupplierInvoices({ status: "da_pagare" })),
      };

    case "scadenze_previste": {
      const soggetto = await soggettoDeiSoldi();
      if (!soggetto) return { scadenze: NON_LETTO, oggi: oggiLocale() };
      return { oggi: oggiLocale(), scadenze: await leggi(listScadenzePreviste(soggetto)) };
    }

    case "ordini_in_corso":
      return { oggi: oggiLocale(), ordini: await leggi(listaOrdini()) };

    case "crediti_fornitore": {
      const soggetto = await soggettoDeiSoldi();
      if (!soggetto) return { crediti: NON_LETTO };
      return { crediti: await leggi(creditiFornitore(soggetto)) };
    }

    // 🔴 «QUANDO SCADE X» GUARDA IN DUE POSTI, e non e' un allargamento:
    //    «scadere» vuol dire due cose — una partita in cella e un
    //    adempimento — e sono tutte e due vere. Chiedere a un posto solo
    //    faceva rispondere «non lo trovo» su un astice che c'e' (misurato
    //    il 07/09).
    // ⚠️ Le partite si filtrano nel DATABASE col nome: sul progetto di
    //    prova ce ne sono duecento, e una lettura senza filtro tornerebbe
    //    tagliata a mille righe senza dirlo.
    case "quando_scade": {
      if (!soggetto) return {};
      const [partite, impegni] = await Promise.all([
        leggi(listPartiteInGiacenza(soggetto)),
        leggi(agendaCorsie()),
      ]);
      return {
        partite,
        impegni,
        oggi: oggiLocale(),
        // ⚠️ La precedenza si decide dalla FRASE DETTA, non da come il
        //    modello ha classificato: cosi' non dipende da lui.
        agendaEsplicita: nominaLAgenda(domanda?.testo ?? ""),
      };
    }

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
