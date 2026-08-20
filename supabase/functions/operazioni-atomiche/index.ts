// Edge Function: operazioni-atomiche — il corridoio unico per le
// operazioni "tutto o niente" del gestionale.
//
// Giustificazione (Contratto Architetturale v2, §2): B4 — orchestrazione
// di scritture multi-tabella. Confermato da Alessio il 09/08/2026: il
// client non chiama mai direttamente la RPC di un'operazione
// multi-tabella — passa da qui. Dentro, ogni operazione resta UNA
// funzione Postgres (una chiamata RPC = una transazione): questo file
// non contiene logica di dominio e non deve mai contenerne.
//
// Regole del Contratto §6 rispettate da questo unico punto:
//  - verifica del JWT in un solo posto (non reimplementata per endpoint);
//  - formato di errore uniforme: { errore: { codice, messaggio } };
//  - nessuna autorizzazione duplicata: decidono la RLS e la funzione
//    Postgres, che riceve il JWT dell'utente REALE — mai service_role;
//  - nessun segreto nel codice (SUPABASE_URL/ANON_KEY sono iniettate
//    dall'ambiente, e la anon key non è un segreto).
//
// 🔴 QUESTO FILE STA NELLA ZONA D'OMBRA DEL SEGNALE DELLE LETTURE TAGLIATE
// (misurata il 19/08/2026, scritta il 20/08). Il gestionale ha un punto unico
// da cui passano le sue letture, e lì una risposta più corta del vero si
// denuncia da sola: le Edge Function **non passano di lì** — leggono con una
// chiave loro. Dal 20/08 qui dentro nasce anche lavoro nuovo
// (`duplica_ricetta`), quindi non è più solo un'eredità.
//
// ⚠️ La cosa utile non è «non può succedere», è **da cosa dipende**: oggi non
// morde perché le letture di queste operazioni sono piccole per costruzione —
// le righe di UNA ricetta, gli allegati di UNA mail. Cambia il giorno in cui
// un'operazione legge una tabella che **cresce nel tempo** (l'archivio
// intero, uno storico prezzi, un registro): quel giorno tornerebbe più corta
// senza che niente lo dica.
//
// ⚠️ Quindi, scrivendo un'operazione nuova, la domanda è: **questa lettura
// può tornare più corta senza dirlo?** Se sì, o si chiede `count=exact` e si
// confronta qui dentro, o si dichiara il taglio a chi legge il risultato.
//
// Per aggiungere un'operazione nuova: una riga nell'elenco OPERAZIONI.
// Può precedere la migrazione che crea la funzione Postgres: un nome in
// elenco senza funzione nel database è inerte (la chiamata fallisce con
// "funzione inesistente" e nessun client la invoca finché non viene
// attivata) — così il corridoio si ridistribuisce una volta per blocco di
// lavoro, non a ogni singola funzione.

import { createClient } from "npm:@supabase/supabase-js@2";

// Elenco CHIUSO delle operazioni invocabili. Tutto ciò che non è qui
// dentro riceve un rifiuto: il corridoio non è un passacarte generico
// verso qualunque RPC del database.
const OPERAZIONI = new Set([
  // Comande / cassa (attiva dall'09/08/2026)
  "close_order_as_discount_gift",
  // Il magazzino scende da solo (13/08/2026): chiudere un conto pagato
  // non è più un update su una riga — tocca conto, lotti, movimenti e le
  // righe che non si è potuto scaricare. Quattro tabelle, una decisione.
  "close_order_paid",
  // Blocco 1 — cessioni intercompany e mance
  "create_intercompany_cession",
  "create_tip_distribution",
  // Blocco 2 — record + promemoria collegato
  "create_document",
  "create_fiscal_tool",
  "create_employee_document",
  "create_supplier_invoice",
  "pay_supplier_invoice",
  // Blocco 3 — cancellazioni con chiusura del promemoria
  "delete_document",
  "delete_fiscal_tool",
  "delete_employee_document",
  "delete_employee",
  "delete_supplier_invoice",
  // Blocco 4 — rifiniture
  "create_ingredient",
  "set_active_menu",
  "swap_recipe_steps",
  // Posta in arrivo (12/08/2026): confermare una mail crea il documento,
  // può creare il promemoria della scadenza e chiude la mail. Tre
  // scritture, una sola decisione di Alessio.
  "archivia_posta",
  // Posta in arrivo, seconda forma (12/08/2026): l'assistente propone
  // azioni e Alessio ne conferma una alla volta.
  "esegui_azione_posta",
  // Scadenziario (13/08/2026): chiudere una partita tocca la giacenza, i
  // movimenti e — se buttata — il registro HACCP. Tre scritture, una
  // sola decisione di Alessio.
  "chiudi_partita",
  // HACCP (13/08/2026): una lettura fuori range o una merce non conforme
  // aprono da sé la non conformità. Due tabelle, una decisione.
  "registra_temperatura",
  "registra_ricevimento_merci",
  // Ordini ai fornitori (14/08/2026): registrare un ordine tocca
  // l'ordine, le sue righe e la lista della spesa; annullarlo rimette le
  // righe da comprare. Il gestionale non manda niente — apre WhatsApp.
  "registra_ordine",
  "annulla_ordine",
  // Produzioni (14/08/2026): registrare un semilavorato scarica gli
  // ingredienti dai lotti, scrive i movimenti e crea il lotto nuovo col
  // suo costo. Quattro tabelle, un gesto in cucina.
  "registra_produzione",
  // La pianta viva (14/08/2026). Promuovere una disposizione a base tocca
  // la pianta e gli scostamenti; assegnare una prenotazione tocca la
  // prenotazione e le righe dei tavoli; aprire o spostare un conto tocca
  // il conto e i suoi tavoli. Tre tavoli accostati sono una comanda sola.
  "promuovi_disposizione",
  "assegna_prenotazione",
  // La prenotazione si prende guardando la sala (14/08/2026): al telefono
  // si toccano i tavoli e si scrive il nome. Prenotazione + righe dei
  // tavoli, una decisione sola.
  "crea_prenotazione_su_tavoli",
  "apri_conto",
  "sposta_conto",
  // La rotta economica (14/08/2026): creare una previsione scrive sei
  // tabelle (testata, personale, extra, costi fissi, linee accessorie,
  // dodici mesi) — a metà sarebbe una previsione che sembra buona.
  // Congelarla ne scrive due: i dodici mesi calcolati e poi il sigillo,
  // in quest'ordine, perché il sigillo rifiuta anche se stesso.
  "crea_scenario_proiezione",
  "congela_scenario",
  // E correggerla: le righe figlie si rifanno da capo, quindi tocca le
  // stesse sei tabelle. Su una previsione chiusa la respingono i trigger.
  "aggiorna_scenario_proiezione",
  // La tesoreria (15/08/2026). Contare il cassetto scrive il conteggio E
  // il movimento che porta a galla la differenza: se la seconda scrittura
  // mancasse, il saldo continuerebbe a dire un numero che il cassetto ha
  // gia' smentito, e alla settimana dopo la differenza si sommerebbe a se
  // stessa.
  "registra_conteggio_cassa",
  // Un versamento e' un TRASFERIMENTO: due movimenti, cassa giu' e banca
  // su. A meta' sarebbe denaro sparito da una parte e mai arrivato
  // dall'altra — l'incoerenza piu' facile da non notare, perche' ognuno
  // dei due saldi resta un numero plausibile.
  "versa_in_banca",
  // La sezione personale del titolare (15/08/2026). Il pareggio chiude la
  // nota E fa uscire il rimborso dalla cassa: a meta' resterebbe o un
  // debito gia' pagato che risulta ancora aperto, o soldi usciti dal
  // cassetto senza niente che dica perche'.
  "pareggia_anticipazione",
  // Blocco 1 del mandato di correzione (16/08/2026): un documento che ha
  // generato un effetto altrove o è respinto, o storna anche l'effetto
  // nella stessa transazione. `delete_anticipazione` tocca una tabella
  // sola e passa comunque di qui: il mandato chiede che il controllo
  // stia nella funzione e la funzione si chiami dal corridoio, perché è
  // la forma che rende l'elenco delle cancellazioni controllabile.
  "delete_anticipazione",
  "annulla_pareggio_anticipazione",
  "annulla_pagamento_fattura",
  "delete_intercompany_cession",
  // Blocco 3 del mandato di correzione (16/08/2026). `annulla_prenotazione`
  // è nuova: annullare e liberare i tavoli erano due scritture separate dal
  // browser, e a metà restava una prenotazione annullata che teneva tavoli
  // veri senza che nessuna schermata lo dicesse. Le altre quattro esistono
  // da tempo e sono già atomiche dentro: cambia la strada da cui il
  // browser le chiama, ed è la forma che rende l'elenco controllabile.
  "annulla_prenotazione",
  "merge_customers",
  // ⚠️ `close_shopping_list_item` NON C'È PIÙ (19/08/2026): l'ha
  // sostituita `chiudi_riga_lista`, che è la stessa cosa più i tre esiti e
  // l'uscita in prima nota. La vecchia è stata **cancellata dal database**,
  // non lasciata accanto: due modi di chiudere una riga, uno dei quali col
  // vocabolario vecchio e senza uscita, sarebbe il difetto che il mandato
  // chiude, ancora raggiungibile.
  "chiudi_riga_lista",
  "record_stock_consumption",
  "update_ingredient_price",
  // ⚠️ ECCEZIONE DICHIARATA (16/08/2026, decisione di Alessio su rilievo
  // del validatore): queste due scrivono UNA tabella sola — `tasks` — e
  // il Contratto non le obbligherebbe a passare di qui. Ci passano perché
  // sono tutto-o-niente per senso: chiudere un impegno ricorrente genera
  // il successivo, riaprirlo toglie quello già nato. Il Contratto §B4 NON
  // è stato allargato: «più di una tabella» è misurabile dal database e
  // la prova se ne costruisce l'elenco da sola, «tutto-o-niente» sarebbe
  // un giudizio da riscrivere a mano in un file.
  "completa_task",
  "riapri_task",
  // Le note di credito (17/08/2026, n. 8 del collaudo). `registra_nota_credito`
  // tocca due tabelle: la nota nasce e, se la fattura che corregge e'
  // ancora da pagare, si scala subito su di lei — a meta' resterebbe una
  // nota registrata che non abbassa niente, cioe' un «da pagare» che
  // mente. `elimina_nota_credito` ne tocca una sola e passa comunque di
  // qui, come `delete_anticipazione`: il controllo sta nella funzione, e
  // la forma e' quella che rende l'elenco delle cancellazioni
  // controllabile.
  "registra_nota_credito",
  "elimina_nota_credito",
  // Blocco 2 del mandato dei finger food (20/08/2026). Copiare una ricetta
  // tocca TRE tabelle — la scheda, le sue righe, i suoi passi — ed e'
  // tutto-o-niente per senso: a meta' resterebbe **una ricetta col nome
  // giusto e dentro niente**, cioe' nessun errore e un food cost di zero
  // euro che ha l'aria di essere un numero.
  "duplica_ricetta",
  // Blocco 1 del mandato del registratore (20/08/2026). Segnalare che uno
  // scontrino non e' uscito tocca due tabelle: il conto torna senza
  // documento E resta scritto chi l'ha detto. A meta' sarebbe o un conto
  // rimesso in elenco senza che si sappia perche', o una segnalazione che
  // non ha rimesso niente in elenco.
  "segnala_scontrino_non_uscito",
  // Blocco 1 del mandato dei preventivi (20/08/2026). Un preventivo e'
  // testata piu' righe: a meta' resterebbe il nome di un cliente senza
  // dentro niente, e un costo di zero euro che sembra un numero. La
  // versione nuova ne scrive due, e il collegamento fra le due e' la sola
  // cosa che conserva cosa era stato promesso e quando.
  "salva_preventivo",
  "nuova_versione_preventivo",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// I rifiuti PREVISTI: il database che fa il suo mestiere, non un guasto.
// Non devono generare avvisi — se ne generassero, il rumore diventerebbe
// normale e il primo guasto vero passerebbe inosservato.
//   P0001 — messaggio scritto da noi ("Questo conto è già stato chiuso")
//   42501 — la RLS ha detto no ("solo il titolare")
//   23505 — un vincolo del locale (un solo conto aperto per tavolo)
//   23514 — un controllo di validità (quantità negativa, data impossibile)
const RIFIUTI_PREVISTI = new Set(["P0001", "42501", "23505", "23514"]);

function errore(status: number, codice: string, messaggio: string) {
  return new Response(JSON.stringify({ errore: { codice, messaggio } }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return errore(405, "metodo", "Metodo non ammesso");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return errore(500, "config", "Configurazione dell'ambiente mancante");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errore(401, "auth", "Autenticazione mancante");

  // Client costruito con il token dell'UTENTE: da qui in poi RLS e
  // auth.uid() valgono dentro la funzione Postgres esattamente come se
  // la chiamata partisse dal tablet.
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: utente, error: authError } = await supabase.auth.getUser();
  if (authError || !utente?.user) {
    return errore(401, "auth", "Sessione non valida: rifare l'accesso");
  }

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return errore(400, "corpo", "Richiesta senza corpo JSON valido");
  }

  const operazione = corpo?.operazione;
  const parametri = corpo?.parametri ?? {};
  if (typeof operazione !== "string" || !OPERAZIONI.has(operazione)) {
    return errore(404, "operazione", "Operazione non ammessa");
  }

  const { data, error } = await supabase.rpc(operazione, parametri);
  if (error) {
    // Il messaggio della funzione Postgres è scritto per chi lavora in
    // sala (es. "Questo conto è già stato chiuso"): va restituito intatto.
    const previsto = RIFIUTI_PREVISTI.has(error.code ?? "");

    if (!previsto) {
      // Guasto vero: il titolare lo deve sapere adesso, non domani dal
      // sintomo. Un avviso che fallisce non deve però far fallire anche
      // la risposta: chi è in sala deve comunque vedere cos'è successo.
      try {
        await supabase.rpc("segnala_allarme", {
          p_tipo: `corridoio_${operazione}`,
          p_messaggio:
            `L'operazione "${operazione}" si è fermata per un errore non previsto: ${error.message}`,
          p_dettagli: { operazione, codice: error.code ?? null },
        });
      } catch {
        // silenzio: l'allarme è un di più, l'operazione viene prima
      }
    }

    return errore(previsto ? 409 : 500, error.code ?? "db", error.message);
  }

  return new Response(JSON.stringify({ risultato: data ?? null }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
