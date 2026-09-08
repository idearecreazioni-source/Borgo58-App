// =====================================================================
// LE LETTURE CHE RISPONDONO A UNA DOMANDA DI MEMO
// (fase 1: 07/09 · fasi 2 e 3: 08/09/2026)
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
// 🔴 I SOLDI ENTRANO DALLE FASI 2 E 3, E DA UNA PORTA SOLA — è un
//    rovesciamento dichiarato. Fino al 07/09 qui non si leggeva niente che
//    portasse un prezzo, e la ragione era buona: alle nove domande di
//    allora il denaro non serviva, e non chiederlo è più forte che
//    chiederlo e non mostrarlo. Dall'08/09 sei domande parlano di soldi —
//    i saldi e i movimenti di Cassa, le fatture da pagare, le scadenze
//    previste e le note di credito — quindi il divieto generale
//    diventerebbe una regola che nessuno può rispettare.
//    ⚠️ Al suo posto vale un confine più stretto, e sorvegliato: si legge
//    la CASSA (`saldo_tesoreria`, `cash_movements`) e i DEBITI verso i
//    fornitori, che il database difende col portiere del titolare, e
//    **non** si legge nessun costo di ricetta, di lotto o di magazzino —
//    quelli non servono a nessuna domanda, e chi non arriva al browser non
//    può finire a schermo per sbaglio. Gli ingredienti di una ricetta si
//    chiedono alla vista `_display`, che i costi non ce li ha.
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
import { listRecipeIngredientsDisplay } from "./recipeIngredients";
import { listStockLevels } from "./stock";
import { listPartiteInGiacenza, listPartiteInScadenza } from "./scadenze";
import { agendaCorsie } from "./tasks";
import { getEntities } from "./entities";
import { listSupplierInvoices, creditiFornitore } from "./supplierInvoices";
import { getSaldoTesoreria, listCashMovements, listScadenzePreviste } from "./cash";
import { listaSpesa } from "./shoppingList";
import { listSpesaSpicciola } from "./spesaSpicciola";
import { listaOrdini } from "./ordini";
import { coseDaFare } from "./produzioni";
import { pulizieDiOggi, temperatureDiOggi } from "./haccp";
import { oggiLocale, traGiorniLocale } from "../constants";

/**
 * QUANTI GIORNI GUARDA «GLI ULTIMI MOVIMENTI».
 *
 * ⚠️ È UNA FINESTRA E NON UN LIMITE DI RIGHE, e la differenza è quella fra
 * una risposta e una risposta più corta che ha l'aria di essere intera:
 * `listCashMovements` non ammette `.limit()` (alimenta l'export della Prima
 * nota), quindi senza periodo si leggerebbe tutta la tabella per mostrarne
 * sei righe — e il giorno che passa mille righe tornerebbe tagliata senza
 * dirlo. Con la finestra il conto è limitato **e chi legge sa fin dove si
 * è guardato**, perché la risposta lo scrive.
 */
export const GIORNI_MOVIMENTI = 30;

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
    case "agenda_prossime":
      return { impegni: await leggi(agendaCorsie()) };

    // ===============================================================
    // FASE 2 — 08/09/2026
    // ===============================================================
    // 🔴 IL SOGGETTO DEI SOLDI SI CHIEDE, NON SI DÀ PER SCONTATO: dal
    //    30/08 i soggetti sono tre, e «la tasca» non è una società. Qui si
    //    guarda **la S.r.l.s.**, cioè la cassa dell'osteria, e la risposta
    //    lo dichiara — un saldo che mescolasse i due direbbe che il locale
    //    ha in cassa i soldi personali di Alessio.
    // ⚠️ E anche l'elenco dei soggetti passa da `leggi()`: se cade quello,
    //    non si sa di chi sarebbero i soldi, quindi non si legge nessun
    //    saldo e si dice «non lo so» invece di sceglierne uno.
    case "saldo_cassa": {
      const soggetti = await leggi(getEntities());
      if (nonLetto(soggetti) || !soggetti?.srls?.id) return { saldo: NON_LETTO };
      return { saldo: await leggi(getSaldoTesoreria(soggetti.srls.id)) };
    }

    case "ultimi_movimenti": {
      const soggetti = await leggi(getEntities());
      if (nonLetto(soggetti) || !soggetti?.srls?.id) {
        return { movimenti: NON_LETTO, giorni: GIORNI_MOVIMENTI };
      }
      return {
        giorni: GIORNI_MOVIMENTI,
        movimenti: await leggi(
          listCashMovements({
            entityId: soggetti.srls.id,
            from: traGiorniLocale(-GIORNI_MOVIMENTI),
          }),
        ),
      };
    }

    // ⚠️ DUE DOMANDE E DUE LETTURE, mai una sola filtrata in due modi: le
    //    liste sono due tabelle diverse (SPEC-0012), e leggerne una per
    //    rispondere all'altra è il travaso silenzioso che la #36 ha chiuso.
    case "cosa_comprare":
      return { lista: await leggi(listaSpesa()) };

    case "cosa_spicciola":
      return { spicciola: await leggi(listSpesaSpicciola()) };

    case "ingredienti_ricetta": {
      if (!soggetto) return { ricette: [] };
      const ricette = await leggi(listRecipes({ search: soggetto }));
      if (nonLetto(ricette)) return { ricette };
      // ⚠️ Gli stessi candidati della regola che compone la frase, come per
      //    gli allergeni: con due ricette in ballo la risposta è «di
      //    quale?», e leggere gli ingredienti di una delle due sarebbe
      //    lavoro fatto per una domanda non ancora posta.
      const { scelte } = candidatiRicetta(ricette, soggetto);
      const ristrette = fraICandidati(scelte, domanda?.scelto ?? null, "id");
      if (ristrette.length !== 1) return { ricette };
      return {
        ricette,
        ingredienti: await leggi(listRecipeIngredientsDisplay(ristrette[0].id)),
      };
    }

    case "preparazioni_da_fare":
      return { preparazioni: await leggi(coseDaFare()) };

    case "pulizie_oggi":
      return { pulizie: await leggi(pulizieDiOggi()) };

    case "temperature_oggi":
      return { temperature: await leggi(temperatureDiOggi()) };

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
