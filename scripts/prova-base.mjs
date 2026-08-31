// LO STATO DI PARTENZA DEL PROGETTO DI PROVA — `npm run prova:base`
//
// Poche righe vere, non un gestionale finto: un fornitore, un ingrediente
// con la sua giacenza e il suo storico prezzi, una ricetta, un menu
// attivo, un conto aperto → mandato in cucina → chiuso e pagato, un
// movimento di prima nota, una fattura fornitore, una prenotazione.
//
// ⚠️ COSTRUITO CHIAMANDO LE FUNZIONI VERE DELL'APP, non con `insert`
// scritti qui dentro. È la parte che conta, e non è una questione di
// eleganza: uno stato di partenza scritto a mano è una **copia** del
// comportamento dell'app, e le copie invecchiano in silenzio. Il giorno
// in cui `apri_conto` cambia parametri, o una scrittura passa dal
// corridoio, o nasce un vincolo nuovo, questo comando o si aggiorna da
// solo o **smette di funzionare e lo si vede subito** — invece di
// continuare a produrre righe che l'app vera non produrrebbe più.
//
// Corollario dichiarato: questo comando è anche una prova. Se domani
// fallisce, la prima ipotesi non è che sia rotto lui.
//
// ⚠️ MARCATO E BUTTABILE — 🔴 MA NON PIU' NEI NOMI CHE SI MISURANO
// (22/08). Il prefisso `BASE-` mangiava **5 dei 16 caratteri** che stanno
// su una riga nella colonna del nome, e faceva andare a capo 13 nomi su 15
// invece di 8: il 21/08 un disegno e' stato scartato per un vincolo
// gonfiato cosi'. **Ingredienti, ricette e menu adesso hanno il loro nome
// vero**, e la pulizia li riconosce dagli elenchi di
// `scripts/scenario/carta.mjs` — un posto solo, che costruisce e ripulisce.
//
// ⚠️ **Dove il prefisso resta, ed e' dichiarato**: conti, movimenti,
// prenotazioni, clienti, dipendenti, attrezzature. Li' nessuna misura di
// questo mandato e' stata falsata, e il marchio serve a pulire. Toglierlo
// anche di la' e' una coda, non una dimenticanza.
//
// Il testo di prima, che vale ancora per quelle tabelle:
// accanto ai `TEST-AUTO …` delle prove automatiche: si riconosce a colpo
// d'occhio, si cancella senza pensarci (`-- --rifai`), e
// `npm run prova:ricostruisci` lo rimette da sé. Niente qui dentro è
// sacro.
//
// Non tocca MAI il database vero: il controllo è la prima cosa che fa.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createServer } from "vite";
import { NOMI_INGREDIENTI, NOMI_RICETTE_TUTTE } from "./scenario/carta.mjs";
import { FORNITORI } from "./scenario/servizio.mjs";
import {
  REF_PRODUZIONE,
  fermati,
  interroga,
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  titolo,
} from "./comune.mjs";

const MARCA = "BASE-";

// 🔴 GLI ELENCHI AL POSTO DEL PREFISSO (22/08).
//
// Ingredienti, ricette e menu non portano piu' un marchio nel nome —
// falsava le misure sulle colonne — quindi la pulizia non puo' piu'
// cercarli con `like 'BASE-%'`: li **nomina**, leggendo le stesse liste da
// cui sono stati costruiti.
//
// ⚠️ Costruzione e pulizia guardano lo stesso file, quindi non possono
// divergere. Se divergessero, la pulizia lascerebbe righe dietro di se'
// **senza dirlo** — la famiglia della risposta piu' corta che ha l'aria di
// essere intera.
//
// ⚠️ E i nomi delle 8 ricette dello stato di partenza NON stanno nel
// catalogo: sono di questo file. Si aggiungono qui, non li'.
// 🔴 E QUESTE TRE PORTANO ANCORA IL PREFISSO, perche' nascono fuori dal
// blocco dello scenario (sono lo stato di partenza minimo, quello che
// esiste anche senza `--scenario`). Vanno nominate lo stesso: da quando la
// pulizia guarda gli elenchi invece del prefisso, cio' che non e' nominato
// **resta**, e si accumulerebbe a ogni `--rifai` senza che nessuno lo dica.
// 🔴 IL PREFISSO NON SI VEDE PIU' NEI NOMI (23/08/2026, reperto di
// Alessio: «"BASE-Pomodoro di prova" e' ancora col prefisso»). Era un nome
// tecnico in mezzo ai prodotti veri, e in una schermata di collaudo un nome
// tecnico si legge come un errore del gestionale.
//
// ⚠️ Ma la pulizia deve continuare a riconoscerli, e li riconosce **per
// nome esatto** — quindi qui ci sono TUTTE E DUE le forme: quella nuova e
// quella vecchia, che resta viva finche' esiste anche un solo database dove
// il prefisso e' stato scritto. E' la stessa regola scritta piu' sotto:
// *quando si cambia il modo di riconoscere una cosa, il modo vecchio va
// tenuto in vita dalla parte che PULISCE, non da quella che scrive.*
const RESIDUI_COL_PREFISSO = [
  "Piatto di prova",
  "Pomodoro di prova",
  MARCA + "Piatto di prova",
  MARCA + "Pomodoro di prova",
];

const RICETTE_STATO_BASE = [
  "Alici marinate della casa", "Caponata di melanzane",
  "Busiate al pomodoro e basilico", "Ravioli di ricotta",
  "Crudo di gambero", "Alici fritte",
  "Melanzane alla parmigiana", "Cassatina di ricotta",
];
const MENU_DELLO_SCENARIO = ["Carta di collaudo", "Carta dei due mesi"];

// 🔴 E IL VECCHIO PREFISSO SI CONTINUA A TOGLIERE, anche se non si scrive
// piu'. Misurato: dopo il primo giro col nuovo catalogo erano rimasti in
// dispensa **122 prodotti invece di 109**, tredici dei quali col vecchio
// `BASE-` — orfani per sempre, perche' nessun elenco li nomina.
//
// ⚠️ La forma generale, che vale oltre questo caso: *quando si cambia il
// modo di riconoscere una cosa, il modo vecchio va tenuto in vita dalla
// parte che PULISCE, non da quella che scrive.* Altrimenti il passaggio
// lascia dietro di se' esattamente le righe che doveva togliere — e non lo
// dice.

/** Un elenco di nomi come lista SQL, con gli apici raddoppiati. */
const listaSql = (nomi) =>
  nomi.map((n) => "'" + String(n).replace(/'/g, "''") + "'").join(", ");

const INGREDIENTI_SQL = listaSql([...NOMI_INGREDIENTI, ...RESIDUI_COL_PREFISSO]);
// ⚠️ `NOMI_RICETTE_TUTTE` e non `NOMI_RICETTE`: la seconda non comprende
// le SELEZIONI, e quattro ricette sarebbero rimaste dietro a ogni pulizia.
const RICETTE_SQL = listaSql([...NOMI_RICETTE_TUTTE, ...RICETTE_STATO_BASE, ...RESIDUI_COL_PREFISSO]);
const MENU_SQL = listaSql(MENU_DELLO_SCENARIO);
const rifai = process.argv.includes("--rifai");
// Lo scenario del collaudo: molto piu' dello stato di partenza, stessa marca.
const scenario = process.argv.includes("--scenario");

// ---------------------------------------------------------------------
// 1. L'ambiente: si legge da `.env`, il file unico di configurazione
//    locale (lo usa anche `npm run test:app`).
//
// 🔴 IL PROGETTO DI PROVA HA NOMI SUOI (`PROVA_*`), e non e' una
//    preferenza di stile: `VITE_SUPABASE_URL` in quel file vuol dire il
//    LOCALE VERO, perche' e' la riga che finisce nel sito pubblicato.
//    Riusare quel nome qui significherebbe che lo stesso nome vale due
//    cose diverse — che e' esattamente il motivo per cui prima i file
//    erano tre.
// ---------------------------------------------------------------------
if (!existsSync(".env")) {
  fermati("Manca .env.", "Copia .env.example in .env (vedi docs/AMBIENTE_PROVA.md).");
}
const conf = {};
for (const riga of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) conf[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
for (const nome of ["PROVA_SUPABASE_URL", "PROVA_ANON_KEY", "TEST_TITOLARE_EMAIL", "TEST_TITOLARE_PASSWORD"]) {
  if (!conf[nome]) fermati(`Manca ${nome} in .env.`, "Vedi tests/app/LEGGIMI.md.");
}
if (conf.PROVA_SUPABASE_URL.includes(REF_PRODUZIONE)) {
  fermati(
    "FERMO: PROVA_SUPABASE_URL punta al database VERO del locale.",
    "Questo comando SCRIVE: deve poter parlare solo col progetto di prova."
  );
}

// 🔴 E I VALORI SI PASSANO DAL PROCESSO, PRIMA che Vite parta. In
//    modalita' `test` Vite carica `.env` da solo, e li' dentro
//    `VITE_SUPABASE_URL` e' il LOCALE VERO: senza queste due righe i
//    moduli dell'app si collegherebbero al gestionale del locale.
// ✅ Che il processo vinca sul file non e' dedotto, e' misurato
//    (31/08/2026): stesso `ssrLoadModule`, file che dice una cosa e
//    processo che ne dice un'altra — vince il processo.
// ⚠️ Il controllo del punto 2 resta comunque, e guarda cosa i moduli
//    hanno DAVVERO caricato: e' l'unica rete che se ne accorgerebbe se
//    questa precedenza cambiasse in una versione futura di Vite.
process.env.VITE_SUPABASE_URL = conf.PROVA_SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = conf.PROVA_ANON_KEY;
// ---------------------------------------------------------------------
// 2. I moduli VERI dell'app, caricati come li carica l'app.
//
// ⚠️ Passano da Vite e non da un `import` di Node, e non è un capriccio:
// i moduli di `src/` si scrivono fra loro senza estensione (`from
// "../supabase"`) e leggono la configurazione da `import.meta.env`. Node
// da solo non sa fare né l'una né l'altra cosa. Facendoli girare dentro
// Vite, in modalità `test`, si ottengono due cose insieme: la
// configurazione arriva dal progetto di prova (passata qui sopra) e il
// codice caricato è **esattamente quello che gira nel browser** — non una
// copia da tenere allineata a mano.
//
// Vite è già una dipendenza del progetto: nessuno strumento nuovo.
// ---------------------------------------------------------------------
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  mode: "test",
  logLevel: "warn",
});
const carica = (percorso) => vite.ssrLoadModule(percorso);

const { supabase } = await carica("/src/lib/supabase.js");
const { ambienteCorrente } = await carica("/src/lib/ambiente.js");
const { getEntities } = await carica("/src/lib/api/entities.js");
const { createSupplier } = await carica("/src/lib/api/suppliers.js");
const { createIngredient, updateIngredientFields, updateIngredientPrice } =
  await carica("/src/lib/api/ingredients.js");
const { registerStockDelivery } = await carica("/src/lib/api/stock.js");
const { createRecipe, updateRecipe } = await carica("/src/lib/api/recipes.js");
const { addRecipeIngredient } = await carica("/src/lib/api/recipeIngredients.js");
const { createMenu, addMenuItem, setActiveMenu } = await carica("/src/lib/api/menus.js");
const orders = await carica("/src/lib/api/orders.js");
const { createCashMovement, createPosDevice, listAllCausali } = await carica("/src/lib/api/cash.js");
const { collegaDocumentoAFattura, createSupplierInvoice, markInvoicePaid, registraNotaCredito } =
  await carica("/src/lib/api/supplierInvoices.js");
const { assegnaPrenotazione, createReservation } = await carica("/src/lib/api/reservations.js");
const { upsertFiscalSettings } = await carica("/src/lib/api/fiscal.js");
const { createEmployee, createEmployeeLeave, createTipCollected } = await carica("/src/lib/api/personale.js");
const { createDocument } = await carica("/src/lib/api/documents.js");
const { chiudiMese, creaScenarioDaFoglio } = await carica("/src/lib/api/proiezione.js");
const { addBelowThresholdItems } = await carica("/src/lib/api/shoppingList.js");
const { createBarItem } = await carica("/src/lib/api/barItems.js");
const { createPayslip, createTipDistribution } = await carica("/src/lib/api/personale.js");
const { createTask } = await carica("/src/lib/api/tasks.js");
const { registraProduzione } = await carica("/src/lib/api/produzioni.js");
const { bozzaOrdine, registraOrdine, annullaOrdine, segnaOrdineRicevuto } = await carica("/src/lib/api/ordini.js");
const { createDiscountGift, registraPrestito, registraRestituzione, createScadenzaPrevista } =
  await carica("/src/lib/api/cash.js");
const { createCrop, createCession } = await carica("/src/lib/api/agricolo.js");
const { createForagedItem } = await carica("/src/lib/api/haccp.js");
const { createTagAnticipazione, createAnticipazione, pareggiaAnticipazione } =
  await carica("/src/lib/api/anticipazioni.js");
const { createDeductibleExpense, createFiscalTool } = await carica("/src/lib/api/fiscal.js");
const { createClosure } = await carica("/src/lib/api/sala.js");
const { createDailyMenu, addDailyMenuItem } = await carica("/src/lib/api/dailyMenu.js");
const { setReservationDeposit } = await carica("/src/lib/api/reservations.js");
const { addRecipeStep } = await carica("/src/lib/api/recipeSteps.js");
const { addCleaningLog, addGoodsReceiving, addPestControlLog, addTemperatureLog, createCleaningTask, createEquipment } =
  await carica("/src/lib/api/haccp.js");
// ⚠️ Le date si prendono dalle funzioni dell'app, non da `toISOString()`.
// Vedi il commento su `oggi` piu' sotto: e' un difetto vero, trovato dal
// collaudo, e la cura e' usare gli stessi attrezzi delle schermate.
const { oggiLocale, traGiorniLocale } = await carica("/src/lib/constants.js");

// ⚠️ Il controllo si rifà QUI, sull'ambiente che i moduli hanno davvero
// caricato — non su quello che ho letto io dal file. Fra le due cose c'è
// la risoluzione delle variabili di Vite, ed è proprio lì che un errore
// non si vedrebbe.
const ambiente = ambienteCorrente();
if (ambiente.produzione) {
  fermati("FERMO: i moduli dell'app si sono collegati al database VERO.", "Controlla PROVA_SUPABASE_URL in .env.");
}
titolo("Stato di partenza del progetto di prova");
console.log(`   database: ${ambiente.riferimento} — ${ambiente.nome}`);

// ---------------------------------------------------------------------
// 3. Si entra come si entra dai tablet: con l'utente di prova del
//    titolare, mai con una chiave di servizio. Se una scrittura passa
//    solo con permessi che l'app non ha, va saputo adesso.
// ---------------------------------------------------------------------
const accesso = await supabase.auth.signInWithPassword({
  email: conf.TEST_TITOLARE_EMAIL,
  password: conf.TEST_TITOLARE_PASSWORD,
});
if (accesso.error) fermati("Non riesco a entrare come titolare di prova:", accesso.error.message);

// 🔴 QUI C'ERA UN DIFETTO MIO, trovato al primo giro di collaudo: le 6
// prenotazioni «per stasera» sono nate datate al GIORNO PRIMA, perche' lo
// scenario e' stato costruito dopo mezzanotte e `toISOString()` da' la
// data UTC — che fra mezzanotte e le due di notte e' ancora ieri.
//
// ⚠️ E' la trappola scritta in CLAUDE.md §8, trovata in 14 punti
// nell'audit dell'8 agosto e risolta allora con `oggiLocale()`: l'ho
// riaperta in uno script nuovo, che non usava gli attrezzi dell'app
// perche' «e' solo un comando». Non e' solo un comando: e' l'unica cosa
// che apparecchia la sala del collaudo, e una data sbagliata li' fa
// sembrare vuota una serata piena.
const oggi = oggiLocale();
const creato = [];
const segna = (cosa, quante = 1) => creato.push(`${String(quante).padStart(3)}  ${cosa}`);

// ---------------------------------------------------------------------
// 4. Pulizia: le righe marcate si tolgono e si rifanno.
//
// ⚠️ QUESTA PARTE NON PASSA DALL'APP, ed è una scelta, non una scorciatoia.
// L'app si RIFIUTA di cancellare un conto chiuso, ed è giusto così: è la
// regola del Blocco 4 del mandato di correzione — «il totale su cui hai
// incassato non deve cambiare dopo». Chiedere all'app di disfare lo stato
// di partenza vorrebbe dire aprire una porta in quella regola per comodità
// di collaudo, cioè indebolire un vincolo che protegge soldi veri.
//
// Quindi: **si costruisce dai gesti dell'app, si demolisce dal database**.
// La demolizione è manutenzione di un database usa-e-getta, non un gesto
// che qualcuno debba poter fare dal gestionale.
//
// `session_replication_role = replica` spegne i trigger per la sola durata
// della pulizia (stesso attrezzo del ripristino): senza, ogni riga tolta
// lascerebbe una **lapide** nel registro delle cancellazioni — righe di
// prova indistinguibili da cancellazioni vere, che è esattamente ciò che
// il registro non deve contenere.
//
// E dichiara quante righe ha tolto, zero compreso.
// ---------------------------------------------------------------------
const SQL_PULIZIA = `
set session_replication_role = replica;
do $pulizia$
declare
  tolte int := 0;
  n     int;
begin
  delete from order_payments where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from stock_consumptions where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from anomalie_scarico where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from order_items where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from order_tables where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from orders where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  delete from menu_items where menu_id in (select id from menus where (name in (${MENU_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from menus where (name in (${MENU_SQL}) or name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;

  delete from recipe_status_history where recipe_id in (select id from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipe_ingredients where recipe_id in (select id from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;

  delete from stock_consumptions where ingredient_id in (select id from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from stock_lots where ingredient_id in (select id from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from price_history where ingredient_id in (select id from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from articoli_fornitore where ingredient_id in (select id from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from shopping_list_items where ingredient_id in (select id from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;

  delete from cash_movements
   where supplier_invoice_id in (select id from supplier_invoices where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  -- ATTENZIONE: le note di credito PRIMA delle fatture. Gli utilizzi
  -- puntano alle fatture con "on delete restrict", ed e' voluto: una
  -- fattura con una nota addosso non si cancella e basta. Qui i trigger
  -- sono spenti, ma l'ordine resta quello giusto - se un giorno si
  -- demolisse coi trigger accesi, questo pezzo non cambierebbe.
  delete from note_credito_utilizzi
   where nota_id in (select id from note_credito where note like '${MARCA}%')
      or fattura_id in (select id from supplier_invoices where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from note_credito where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from tasks
   where id in (select task_id from supplier_invoices where note like '${MARCA}%' and task_id is not null);
  get diagnostics n = row_count; tolte := tolte + n;
  delete from supplier_invoices where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from suppliers where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  delete from tip_distribution_lines where employee_id in (select id from employees where last_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from tip_distributions where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from tips_collected where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from employee_leaves where employee_id in (select id from employees where last_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from employee_documents where employee_id in (select id from employees where last_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from payslips where employee_id in (select id from employees where last_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from employees where last_name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_temperature_logs where equipment_id in (select id from haccp_equipment where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_equipment where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_cleaning_logs where task_id in (select id from haccp_cleaning_tasks where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_cleaning_tasks where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_pest_control_logs where performed_by like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from documents where title like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from consuntivi_mensili where entity_id in (select id from entities);
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenario_risultati where scenario_id in (select id from scenari_proiezione where nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenario_mesi where scenario_id in (select id from scenari_proiezione where nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenario_personale where scenario_id in (select id from scenari_proiezione where nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenario_extra where scenario_id in (select id from scenari_proiezione where nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenario_costi_fissi where scenario_id in (select id from scenari_proiezione where nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenario_linee_accessorie where scenario_id in (select id from scenari_proiezione where nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scenari_proiezione where nome like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_goods_receiving where product_description like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from haccp_non_conformities where description like '%${MARCA}%' or note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from pos_devices where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from cash_movements where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  delete from prenotazione_tavoli
   where reservation_id in (select id from reservations where customer_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from reservations where customer_name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from customers where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- -------------------------------------------------------------------
  -- 🔴 LE TABELLE CHE LA PULIZIA NON NOMINAVA (23/08/2026)
  --
  -- Misurato prima di scrivere: dopo cinque giri di «--rifai» il progetto
  -- di prova aveva **15 preventivi invece di 3** — cinque copie identiche
  -- dello stesso battesimo, dello stesso preventivo aziendale, dello
  -- stesso rifiuto. Il comando diceva «rifallo» e invece **accumulava**,
  -- che e' peggio di una pulizia che non c'e': quella si vede.
  --
  -- ⚠️ E' la seconda volta: il 22/08 era successo coi **conti** (220
  -- invece di 55), e la cura era stata mettere la marca sui conti. Qui la
  -- cura e' diversa e piu' larga — la pulizia si e' presa **due guardiani
  -- generici** (piu' sotto, in togliBase()), perche' un elenco
  -- scritto a mano dimentica sempre la riga aggiunta ieri.
  -- -------------------------------------------------------------------

  -- I preventivi, con le loro righe e i fogli stampati. PRIMA delle
  -- prenotazioni: un preventivo accettato ne tiene una per mano.
  delete from preventivo_fogli
   where preventivo_id in (select id from preventivi where cliente_nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from preventivo_righe
   where preventivo_id in (select id from preventivi where cliente_nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from giornate_sold_out
   where preventivo_id in (select id from preventivi where cliente_nome like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from preventivi where cliente_nome like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- Quello che pende dai conti dello scenario.
  delete from chiamate_turno where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from segnalazioni_fiscali where order_id in (select id from orders where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from discounts_gifts
   where note like '${MARCA}%' or causale_note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- Quello che pende dalle ricette e dagli ingredienti dello scenario.
  delete from storico_costi_ricetta
   where recipe_id in (select id from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipe_steps
   where recipe_id in (select id from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipe_videos
   where recipe_id in (select id from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from produzioni
   where recipe_id in (select id from recipes where (name in (${RICETTE_SQL}) or name like '${MARCA}%'))
      or note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from rettifiche_giacenza
   where note like '${MARCA}%'
      or ingredient_id in (select id from ingredients where (name in (${INGREDIENTI_SQL}) or name like '${MARCA}%'));
  get diagnostics n = row_count; tolte := tolte + n;
  delete from intercompany_cessions where notes like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from foraged_items where note like '${MARCA}%' or species like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from crops where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- Gli ordini ai fornitori.
  delete from ordini_fornitore_righe
   where ordine_id in (select id from ordini_fornitore where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from ordini_fornitore where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- I soldi che nessun elenco nominava.
  delete from restituzioni_prestito
   where prestito_id in (select id from prestiti_privati where nota like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from prestiti_privati where nota like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from anticipazioni_socio where nota like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from tag_anticipazioni where etichetta like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from deductible_expenses where note like '${MARCA}%' or description like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from fiscal_tools where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from scadenze_previste where nota like '${MARCA}%' or descrizione like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from periodi_anomali where nota like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- ⚠️ QUESTE SI TOLGONO TUTTE, e va detto perche': non hanno **nessuna
  -- colonna** dove scrivere una marca. Sono appunti di una giornata
  -- (dov'erano i tavoli, quanti coperti aveva quel gruppo, quanto c'era
  -- nel cassetto), e rimettere lo scenario vuol dire «il progetto di prova
  -- torni presentabile». Se Alessio conta il cassetto durante il collaudo
  -- e poi rilancia il comando, quel conteggio se ne va: e' il patto di
  -- «--rifai», non una dimenticanza.
  delete from conteggi_cassa;
  get diagnostics n = row_count; tolte := tolte + n;
  delete from correzioni_coperti;
  get diagnostics n = row_count; tolte := tolte + n;
  delete from disposizioni_giornaliere;
  get diagnostics n = row_count; tolte := tolte + n;
  delete from domande_archivio;
  get diagnostics n = row_count; tolte := tolte + n;

  -- La posta e i suoi allegati, il menu del giorno, la carta delle
  -- bevande, le chiusure per data: tutte marcate dove si puo'.
  delete from posta_azioni
   where posta_id in (select id from posta_ricevuta where oggetto like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from posta_allegati
   where posta_id in (select id from posta_ricevuta where oggetto like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from posta_ricevuta where oggetto like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from daily_menu_items
   where daily_menu_id in (select id from daily_menus where note like '${MARCA}%' or title like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from daily_menus where note like '${MARCA}%' or title like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from bar_items where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from service_closures where motivo like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from reservation_deposits
   where reservation_id in (select id from reservations where customer_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from email_inviate
   where reservation_id in (select id from reservations where customer_name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;

  -- I tre buchi trovati dal guardiano nuovo, la prima volta che ha parlato
  -- (23/08/2026, secondo giro di prova): tre tabelle crescevano a ogni
  -- «--rifai», e nessuna era nell'elenco.
  --
  -- 1. GLI IMPEGNI NATI DA SOLI. Un documento con una scadenza si porta
  --    dietro un promemoria in Agenda: i documenti si cancellavano, i
  --    promemoria no. Contati: **36 righe «Scadenza documento: BASE-…»**,
  --    cioe' la stessa scadenza ripetuta diciotto volte in un'Agenda che
  --    ne ha venti vere. Il titolo porta la marca, quindi il criterio c'e'.
  delete from tasks where title like '%${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- 2. I MOVIMENTI NATI DA UN CONTEGGIO DEL CASSETTO. La differenza fra il
  --    contato e il teorico genera un movimento vero (e' la decisione del
  --    15/08: se restasse dichiarata e basta, il saldo continuerebbe a dire
  --    un numero che il cassetto ha gia' smentito). Quel movimento non ha
  --    marca, ma ha un padre: e i conteggi qui sopra se ne vanno tutti.
  delete from cash_movements where note like 'Differenza rilevata contando il cassetto%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- 3. GLI ALLARMI. Sono la traccia di quello che e' andato storto mentre
  --    lo scenario si costruiva — e lo scenario li rifa' ogni volta. Si
  --    tolgono TUTTI, come i conteggi: non c'e' nessuna colonna dove
  --    scrivere una marca, e un elenco di guasti vecchi di cinque giri
  --    rende illeggibile quello di stasera.
  delete from allarmi;
  get diagnostics n = row_count; tolte := tolte + n;

  -- Le lapidi lasciate dalle versioni precedenti di questo comando, quando
  -- la pulizia passava ancora dall'app e i trigger erano accesi.
  delete from deleted_records where record::text like '%${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  raise notice 'righe tolte: %', tolte;
end $pulizia$;
reset session_replication_role;
`;

// ⚠️ E anche gli avanzi delle PROVE AUTOMATICHE, non solo i miei.
//
// Trovato al primo giro di collaudo: il Magazzino era illeggibile perché
// 47 ingredienti `TEST-AUTO` con giacenza zero soffocavano le otto righe
// vere. Le prove ne creano e non tutte ripuliscono, e ognuna presa da sola
// ha ragione — nessuna sa quante ne hanno lasciate le altre.
//
// Il posto giusto per raccoglierli è qui: rimettere lo scenario è già il
// gesto che dice «il progetto di prova torni presentabile». Si contano a
// parte dai miei, perché sono roba di qualcun altro e il numero va visto.
const SQL_AVANZI_PROVE = `
set session_replication_role = replica;
do $avanzi$
declare
  tolte int := 0;
  n     int;
begin
  delete from stock_consumptions where ingredient_id in (select id from ingredients where name like 'TEST-AUTO%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from stock_lots where ingredient_id in (select id from ingredients where name like 'TEST-AUTO%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from price_history where ingredient_id in (select id from ingredients where name like 'TEST-AUTO%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from articoli_fornitore where ingredient_id in (select id from ingredients where name like 'TEST-AUTO%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from shopping_list_items where ingredient_id in (select id from ingredients where name like 'TEST-AUTO%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipe_ingredients where ingredient_id in (select id from ingredients where name like 'TEST-AUTO%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from ingredients where name like 'TEST-AUTO%';
  get diagnostics n = row_count; tolte := tolte + n;

  -- 🔴 E IL REGISTRO DELLE CANCELLAZIONI, che era il piu' sporco di tutti
  -- (23/08/2026). Contate: **2.924 lapidi**, di cui 1.225 riconoscibili
  -- come «TEST-AUTO», 94 come «__PROVA__» e **1.605 che non si possono
  -- attribuire a nessuno** — righe di comanda e movimenti di cassa
  -- cancellati dalle prove automatiche, la cui copia non contiene nessun
  -- nome.
  --
  -- ⚠️ Quel registro e' una SCHERMATA: il titolare lo apre per vedere cosa
  -- e' stato cancellato. Con duemilanovecento righe finte dentro, non
  -- risponde piu' a nessuna domanda — e durante il collaudo, se Alessio
  -- cancella qualcosa e va a controllare che sia rimasto scritto, non lo
  -- trova.
  --
  -- ⚠️ Si tolgono TUTTE, e il prezzo e' dichiarato: una cancellazione che
  -- Alessio fa durante il collaudo sparisce al «--rifai» successivo. E' lo
  -- stesso patto dei conteggi del cassetto — rimettere lo scenario vuol
  -- dire «il progetto di prova torni presentabile». Sul database vero
  -- quel registro resta di sola lettura per tutti, e nessuno lo tocca.
  delete from deleted_records;
  get diagnostics n = row_count; tolte := tolte + n;

  raise notice 'avanzi tolti: %', tolte;
end $avanzi$;
reset session_replication_role;
`;

function pulisci(url, sql, etichetta, chiave) {
  const uscita = interroga(url, sql);
  const quante = uscita.match(new RegExp(`${chiave}: (\\d+)`))?.[1] ?? "?";
  console.log(`   ${etichetta}: ${quante}`);
}

// ---------------------------------------------------------------------
// 🔴 I DUE GUARDIANI DELLA PULIZIA (23/08/2026)
//
// Un elenco scritto a mano dimentica sempre la riga aggiunta ieri: e'
// successo ai conti il 22/08 (220 invece di 55) e ai preventivi il 23/08
// (15 invece di 3). Allungare l'elenco non chiude il buco — lo sposta alla
// prossima tabella. Quindi la pulizia si e' presa due controlli che **non
// contengono nessun elenco** e non possono invecchiare:
//
//   A. NESSUN ORFANO. Le chiavi esterne di questo database dicono che una
//      riga non puo' puntare a una cosa che non c'e'. La pulizia pero'
//      gira con `session_replication_role = replica`, che spegne i trigger
//      **e con loro le chiavi esterne**: cancellando una ricetta, le sue
//      righe di storico restavano li' a puntare al vuoto, e nessuno lo
//      diceva. Misurato prima di scrivere questo: **2.233 righe orfane**,
//      di cui 2.010 di `storico_costi_ricetta` e 144 di
//      `rettifiche_giacenza` — quest'ultima con un vincolo `restrict`, che
//      esiste apposta per gridare quando qualcuno se ne dimentica.
//      ⚠️ Il verso e' quello che conta: la regola che avrebbe segnalato la
//      dimenticanza e' proprio quella che la pulizia doveva spegnere per
//      poter lavorare. Allora la si rimette **dopo**, come controllo.
//
//   B. NIENTE CRESCE FRA UN GIRO E L'ALTRO. Dopo la pulizia il database
//      deve tornare com'era dopo la pulizia precedente. Se una tabella ha
//      piu' righe di allora, qualcosa si sta accumulando — e lo dice senza
//      sapere quale tabella sia, cioe' funziona anche per quelle che
//      nasceranno domani.
// ---------------------------------------------------------------------

// A. Gli orfani: prima si spazzano, poi si controlla che non ce ne siano.
// Il giro si ripete finche' non ne toglie piu' nessuno (cancellare un
// figlio orfano puo' lasciare orfano un nipote).
const SQL_ORFANI = `
set session_replication_role = replica;
do $orfani$
declare
  r      record;
  n      bigint;
  tolte  bigint := 0;
  giro   int := 0;
  ancora boolean := true;
begin
  while ancora and giro < 6 loop
    ancora := false;
    giro := giro + 1;
    for r in
      select src.relname as tabella, att.attname as colonna,
             tgt.relname as verso,   tatt.attname as chiave
        from pg_constraint con
        join pg_class src on src.oid = con.conrelid
        join pg_class tgt on tgt.oid = con.confrelid
        join pg_namespace ns  on ns.oid  = src.relnamespace
        join pg_namespace tns on tns.oid = tgt.relnamespace
        join pg_attribute att  on att.attrelid  = con.conrelid  and att.attnum  = con.conkey[1]
        join pg_attribute tatt on tatt.attrelid = con.confrelid and tatt.attnum = con.confkey[1]
       where con.contype = 'f'
         and ns.nspname = 'public' and tns.nspname = 'public'
         and array_length(con.conkey, 1) = 1
    loop
      execute format(
        'delete from public.%I s where s.%I is not null and not exists (select 1 from public.%I t where t.%I = s.%I)',
        r.tabella, r.colonna, r.verso, r.chiave, r.colonna);
      get diagnostics n = row_count;
      if n > 0 then tolte := tolte + n; ancora := true; end if;
    end loop;
  end loop;
  raise notice 'orfani tolti: %', tolte;
end $orfani$;
reset session_replication_role;
`;

const SQL_CONTROLLO_ORFANI = `
do $controllo$
declare
  r      record;
  n      bigint;
  rimasti bigint := 0;
  dove   text := '';
begin
  for r in
    select src.relname as tabella, att.attname as colonna,
           tgt.relname as verso,   tatt.attname as chiave
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class tgt on tgt.oid = con.confrelid
      join pg_namespace ns  on ns.oid  = src.relnamespace
      join pg_namespace tns on tns.oid = tgt.relnamespace
      join pg_attribute att  on att.attrelid  = con.conrelid  and att.attnum  = con.conkey[1]
      join pg_attribute tatt on tatt.attrelid = con.confrelid and tatt.attnum = con.confkey[1]
     where con.contype = 'f'
       and ns.nspname = 'public' and tns.nspname = 'public'
       and array_length(con.conkey, 1) = 1
  loop
    execute format(
      'select count(*) from public.%I s where s.%I is not null and not exists (select 1 from public.%I t where t.%I = s.%I)',
      r.tabella, r.colonna, r.verso, r.chiave, r.colonna) into n;
    if n > 0 then
      rimasti := rimasti + n;
      dove := dove || format(E'\\n   - %s righe in %s.%s → %s', n, r.tabella, r.colonna, r.verso);
    end if;
  end loop;
  if rimasti > 0 then
    raise exception 'La pulizia ha lasciato % righe che puntano al vuoto:%', rimasti, dove;
  end if;
  raise notice 'orfani rimasti: 0';
end $controllo$;
`;

// B. Il censimento, per accorgersi da soli di accumulare.
// ⚠️ Il file e' git-ignored (`*.local`) apposta: e' la fotografia del
// computer su cui gira, non un dato del progetto. Un conteggio committato
// diventerebbe un fossile — la trappola del 18/08.
const CENSIMENTO = "conteggi-scenario.local";

const SQL_CENSIMENTO = `
select c.relname || ' ' || (
         xpath('/row/c/text()',
               query_to_xml(format('select count(*) as c from public.%I', c.relname),
                            false, true, ''))
       )[1]::text::bigint
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by 1;
`;

function censimento(url) {
  const uscita = interroga(url, SQL_CENSIMENTO);
  const conta = {};
  for (const riga of uscita.split(/\r?\n/)) {
    const m = riga.trim().match(/^([a-z0-9_]+) (\d+)$/);
    if (m) conta[m[1]] = Number(m[2]);
  }
  return conta;
}

function confrontaColGiroPrecedente(url) {
  const adesso = censimento(url);
  if (!Object.keys(adesso).length) {
    console.log("   ⚠ censimento vuoto: non riesco a contare le tabelle.");
    return;
  }
  let prima = null;
  if (existsSync(CENSIMENTO)) {
    try {
      prima = JSON.parse(readFileSync(CENSIMENTO, "utf8"));
    } catch {
      prima = null;
    }
  }
  writeFileSync(CENSIMENTO, JSON.stringify(adesso, null, 1));
  if (!prima) {
    console.log("   niente da confrontare: e' il primo giro su questo computer.");
    return;
  }
  const cresciute = Object.keys(adesso)
    .filter((t) => (adesso[t] ?? 0) > (prima[t] ?? 0))
    .map((t) => `${t}: ${prima[t] ?? 0} → ${adesso[t]}`);
  if (!cresciute.length) {
    console.log("   nessuna tabella e' cresciuta dal giro precedente.");
    return;
  }
  // ⚠️ Non si ferma il comando: si grida. Una tabella puo' crescere per una
  // ragione buona (una migrazione nuova, una riga scritta da Alessio fra i
  // due giri), e un comando che si rifiuta di partire per questo verrebbe
  // aggirato. Ma il numero si vede, e la volta che e' un accumulo si vede
  // subito quale tabella lo sta facendo.
  console.log("   🔴 DOPO LA PULIZIA QUESTE TABELLE HANNO PIU' RIGHE DI PRIMA:");
  for (const r of cresciute) console.log(`      ${r}`);
  console.log("      (se non le ha scritte Alessio fra i due giri, la pulizia le sta dimenticando)");
}

// La stringa di collegamento al progetto di prova, letta una volta sola.
// `soloProva()` ferma tutto se per errore puntasse al database vero.
let urlProvaMemorizzato = null;
function urlDelProgettoDiProva() {
  if (!urlProvaMemorizzato) {
    urlProvaMemorizzato = soloProva(
      obbligatorio(
        leggiConfigurazione(),
        "DB_URL_PROVA",
        "E' la stringa 'Session pooler' del progetto Borgo58-Prova."
      )
    );
  }
  return urlProvaMemorizzato;
}

function togliBase() {
  const url = urlDelProgettoDiProva();
  pulisci(url, SQL_PULIZIA, "righe dello scenario tolte", "righe tolte");
  pulisci(url, SQL_AVANZI_PROVE, "avanzi delle prove automatiche tolti", "avanzi tolti");
  pulisci(url, SQL_ORFANI, "righe rimaste a puntare al vuoto, tolte", "orfani tolti");
  // ⚠️ E poi si CONTROLLA, che e' un'altra cosa dal ripulire: un divieto
  // che non si puo' ricontrollare dopo non e' un divieto.
  interroga(url, SQL_CONTROLLO_ORFANI);
  console.log("   controllo: nessuna riga punta piu' al vuoto");
  confrontaColGiroPrecedente(url);
}

// «C'è già?» si chiede con gli occhi dell'app, non del proprietario del
// database: se un giorno la RLS nascondesse queste righe al titolare,
// vale la pena accorgersene qui.
async function quanteMarcate(tabella, colonna = "name") {
  const { data, error } = await supabase.from(tabella).select("id").like(colonna, `${MARCA}%`);
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return (data ?? []).length;
}

const giaCiSono =
  (await quanteMarcate("ingredients")) +
  (await quanteMarcate("suppliers")) +
  (await quanteMarcate("recipes"));
if (giaCiSono > 0 && !rifai) {
  fermati(
    `Lo stato di partenza c'e' gia' (${giaCiSono} righe marcate ${MARCA}).`,
    "Per rifarlo da capo:  npm run prova:base -- --rifai"
  );
}
// ---------------------------------------------------------------------
// 🔴 UNO ALLA VOLTA — il lucchetto (23/08/2026)
//
// Successo stanotte: due costruzioni dello scenario lanciate insieme sullo
// stesso database. La seconda si e' fermata con «Questi tavoli hanno gia'
// un conto aperto: T1» — un messaggio giusto, che pero' fa cercare un
// difetto nel gestionale invece che nel modo in cui e' stato lanciato il
// comando. E la pulizia della seconda ha portato via meta' del lavoro
// della prima, lasciando il database in uno stato che non e' ne' quello di
// prima ne' quello di dopo.
//
// ⚠️ E' la stessa regola che le prove automatiche hanno gia'
// (`--no-file-parallelism`): il database e' uno solo. Li' era scritta in
// `package.json`; qui non c'era, e la disciplina non basta — infatti non e'
// bastata.
const LUCCHETTO = "scenario-in-corso.local";
const MINUTI_DI_PAZIENZA = 30;
if (existsSync(LUCCHETTO)) {
  const eta = (Date.now() - Number(readFileSync(LUCCHETTO, "utf8").split("\n")[0] || 0)) / 60000;
  if (eta < MINUTI_DI_PAZIENZA) {
    fermati(
      `C'e' gia' una costruzione dello scenario in corso (da ${Math.round(eta)} minuti).`,
      "Il database di prova e' uno solo: due comandi insieme si pestano i piedi.",
      `Se sei sicuro che non giri piu' niente, cancella il file ${LUCCHETTO}.`
    );
  }
  console.log(`   (trovato un lucchetto vecchio di ${Math.round(eta)} minuti: lo ignoro)`);
}
writeFileSync(LUCCHETTO, `${Date.now()}\n${new Date().toISOString()}\n`);
process.on("exit", () => {
  try {
    unlinkSync(LUCCHETTO);
  } catch {
    // Se il lucchetto resta, la prossima esecuzione lo trova vecchio e va avanti.
  }
});

if (rifai) {
  titolo("Tolgo lo stato di partenza precedente");
  togliBase();
  console.log("   fatto");
}

// ---------------------------------------------------------------------
// 5. Lo stato di partenza, costruito coi gesti dell'app.
// ---------------------------------------------------------------------
titolo("Costruisco");

const enti = await getEntities();
const ente = enti.srls.id;

// --- Il fornitore ---
const fornitore = await createSupplier({
  entityId: ente,
  name: `${MARCA}Fornitore di prova`,
  contactPhone: "+390000000000",
  contactEmail: "fornitore@example.invalid",
  canaleOrdine: "whatsapp",
});
segna("fornitore");

// --- L'ingrediente, con scorta minima (senza, non entra mai in lista) ---
// ⚠️ `create_ingredient` restituisce la RIGA intera, non l'identificativo
// — visto sbagliando, non leggendo. È il genere di cosa per cui questo
// comando chiama le funzioni vere invece di scriversi gli `insert`: una
// copia scritta a mano non avrebbe mai incontrato la differenza.
const ingredienteNuovo = await createIngredient({
  entity_id: ente,
  name: "Pomodoro di prova",
  category: "verdura",
  unit: "kg",
  current_price: 2.5,
  supplier_id: fornitore.id,
  // Sopra la giacenza che si carica qui sotto, apposta: cosi' la riga in
  // lista della spesa nasce da sola e quella schermata non e' vuota.
  stock_minimum_threshold: 20,
  waste_percentage_default: 10,
});
const ingredienteId = ingredienteNuovo?.id ?? ingredienteNuovo;
segna("ingrediente");

// --- Lo storico prezzi: due prezzi, altrimenti non è uno storico ---
await updateIngredientPrice(ingredienteId, 2.8, {
  source: "manuale",
  note: `${MARCA}rincaro di prova`,
  supplierId: fornitore.id,
});
segna("variazione di prezzo");

// --- La giacenza ---
const scadenza = traGiorniLocale(20);
await registerStockDelivery({
  ingredientId: ingredienteId,
  quantity: 12,
  supplierId: fornitore.id,
  expiryDate: scadenza,
  unitCost: 2.8,
  note: `${MARCA}carico di prova`,
});
segna("lotto in magazzino");

// --- La ricetta, con la sua riga ---
const ricetta = await createRecipe({
  name: "Piatto di prova",
  category: "primo",
  recipe_type: "piatto_finito",
  portions_yield: 4,
});
await addRecipeIngredient(ricetta.id, { ingredient_id: ingredienteId, quantity: 0.2, unit: "kg" });
// «Pronta per carta» serve per poterla mettere in un menu attivo: dal
// 16/08 il database lo pretende, ed è giusto che lo stato di partenza
// passi dalla stessa porta di tutti.
await updateRecipe(ricetta.id, { pronta_per_carta: true });
segna("ricetta con una riga");

// --- Il menu attivo (accende da sé «in carta» sulla ricetta) ---
const menu = await createMenu({ name: `${MARCA}Menu di prova`, structure: "4-4-4-2" });
await addMenuItem(menu.id, { recipe_id: ricetta.id, category: "primo", selling_price: 12 });
await setActiveMenu(menu.id);
segna("menu attivo con un piatto");

// --- Il conto: aperto, riga, invio in cucina, chiusura col pagamento ---
const { data: tavoli, error: erroreTavoli } = await supabase
  .from("dining_tables")
  .select("id, label")
  // Solo un `tavolo`: divani e Chef Table sono arredi fissi, e la sagoma
  // non è la stessa cosa (vincolo `dining_tables_sagoma_check`).
  .eq("tipo", "tavolo")
  .eq("active", true)
  .order("label")
  .limit(1);
if (erroreTavoli) fermati("Non riesco a leggere la pianta della sala:", erroreTavoli.message);
if (!tavoli.length) {
  fermati(
    "Nella sala del progetto di prova non c'e' nessun tavolo.",
    "Le sagome sono dati di Alessio, non di una migrazione: vanno create prima."
  );
}

const contoId = await orders.apriConto([tavoli[0].id], { note: `${MARCA}conto di prova` });
await orders.setOrderCoperti(contoId, 2);
const riga = await orders.addDraftItem(contoId, {
  recipeId: ricetta.id,
  destination: "cucina",
  quantity: 2,
  unitPrice: 12,
});
await orders.sendDraftItems(contoId, [riga.id]);
const impostazioni = await orders.getServiceSettings();
await orders.closeOrderPaid(contoId, "contante", impostazioni?.coperto_price ?? null);
segna("conto chiuso e pagato (con lo scarico di magazzino che ne consegue)");

// --- Un movimento di prima nota ---
const causali = await listAllCausali();
const uscita = causali.find((c) => c.kind === "uscita" && c.active);
await createCashMovement({
  entity_id: ente,
  direction: "uscita",
  amount: 24.5,
  movement_date: oggi,
  causale_id: uscita?.id ?? null,
  mezzo: "cassa",
  tipo_documento: "scontrino",
  note: `${MARCA}movimento di prova`,
});
segna("movimento di prima nota");

// --- Una fattura fornitore da pagare (e il suo promemoria in Agenda) ---
const fraDieciGiorni = traGiorniLocale(10);
await createSupplierInvoice({
  entityId: ente,
  supplierId: fornitore.id,
  invoiceNumber: "BASE-001",
  invoiceDate: oggi,
  dueDate: fraDieciGiorni,
  amount: 33.6,
  note: `${MARCA}fattura di prova`,
});
segna("fattura fornitore da pagare");

// --- Un tablet, i parametri fiscali, la lista della spesa, una consegna
//     non conforme. Poche righe che rendono non vuote quattro tabelle in
//     cui una verifica, oggi, girerebbe a vuoto. ---
await createPosDevice({ name: `${MARCA}tablet di prova`, isOwnerDevice: false });
segna("dispositivo di sala");

// ⚠️ Aliquote di comodo, non «i valori giusti»: quelli li dirà Laura, e un
// numero plausibile in un database di prova è comunque un numero che
// nessuno ha deciso. Servono solo perché il motore fiscale abbia da
// masticare qualcosa.
//
// 🔴 E SI SCRIVONO IN PUNTI PERCENTUALI, NON IN FRAZIONE (24/08/2026).
// Fino a oggi qui c'era `iresRate: 0.24, irapRate: 0.039,
// accontoPercento: 1, accontoPrimaRataPercento: 0.4` — quattro campi
// nell'unità sbagliata. `calcola_imposte()` divide per 100, quindi
// l'aliquota effettiva era lo 0,28% invece del 27,9%: **tutte le imposte
// del gestionale di prova erano cento volte più basse del vero**, su ogni
// schermata che le mostra, e non lo diceva nessun errore.
// ⚠️ In `fiscal_settings` TUTTE le percentuali stanno in punti (lo
// dichiarano i valori predefiniti delle colonne: 24.0, 3.9, 100, 40, 20,
// 1.5); altrove nello stesso database stanno in frazione
// (`food_cost_percento` vale 0.2500). È da lì che nasce la confusione, ed
// è per questo che adesso il database respinge un'aliquota in frazione.
await upsertFiscalSettings(ente, {
  annualRevenueEstimate: 250000,
  iresRate: 24,
  irapRate: 3.9,
  accontoPercento: 100,
  accontoPrimaRataPercento: 40,
  accontoSogliaMinima: 51.65,
  primaScadenzaMese: 6,
  primaScadenzaGiorno: 30,
  secondaScadenzaMese: 11,
  secondaScadenzaGiorno: 30,
});
segna("parametri fiscali (di comodo, non confermati)");

// La riga in lista nasce da sola: l'ingrediente ha scorta minima 3 kg e
// il conto chiuso ne ha appena scaricati. Se non nascesse, vorrebbe dire
// che la catena magazzino → soglia → lista si è rotta.
await addBelowThresholdItems();
const { count: righeInLista } = await supabase
  .from("shopping_list_items")
  .select("id", { count: "exact", head: true });
segna(`riga/e in lista della spesa`, righeInLista ?? 0);

// Una consegna non conforme, col rimedio scritto: apre e chiude da sé una
// non conformità. È anche il primo esercizio del campo «azione» collegato
// oggi.
await addGoodsReceiving({
  supplierId: fornitore.id,
  productDescription: `${MARCA}cassetta ammaccata`,
  temperatureC: 6,
  packagingOk: false,
  conformity: true,
  note: `${MARCA}ricevimento di prova`,
  azione: "respinta e sostituita in giornata",
});
segna("ricevimento non conforme, con la sua non conformità");

// --- Una prenotazione confermata ---
await createReservation({
  customer_name: `${MARCA}Cliente di prova`,
  customer_phone: "+390000000001",
  party_size: 2,
  reservation_date: oggi,
  reservation_time: "20:00",
  status: "confermata",
  type: "prenotazione",
  source: "interno",
});
segna("prenotazione confermata");

// ---------------------------------------------------------------------
// 6. LO SCENARIO DEL COLLAUDO (`--scenario`)
//
// Lo stato di partenza qui sopra serve a non far girare a vuoto le
// verifiche: bastano poche righe. Lo SCENARIO è un'altra cosa e ha un
// altro scopo — dare a una persona abbastanza roba da **recitarci sopra
// due giornate**: una sera di servizio e un ciclo acquisti.
//
// ⚠️ Cosa NON c'è, di proposito: nessun conto aperto, nessuna comanda in
// corso, nessuna riga da stornare già pronta. Le situazioni storte — il
// tavolo che riordina a metà servizio, la riga da stornare, il conto
// diviso, l'omaggio — **le fa venire fuori chi usa l'app**, e un elenco
// di casi deciso a tavolino troverebbe solo i difetti che chi l'ha
// scritto aveva già in mente. Qui si apparecchia la sala, non si recita
// la parte.
//
// Stessa marca `BASE-` e stessa pulizia: una seconda marca vorrebbe dire
// una seconda pulizia, e due pulizie divergono.
// ---------------------------------------------------------------------
if (scenario) {
  titolo("Aggiungo lo scenario del collaudo");

  // I due fornitori hanno gli stessi nomi che compaiono sui documenti
  // finti (`npm run collaudo:documenti`): quando la fattura arriva dalla
  // posta, il nome che si legge sul PDF esiste già in anagrafica.
  const fornitori = {};
  for (const [nome, canale, telefono] of [
    ["Ortofrutta PROVA S.r.l.", "whatsapp", "+390000000010"],
    ["Ittica di Collaudo S.n.c.", "email", "+390000000011"],
  ]) {
    const f = await createSupplier({
      entityId: ente,
      name: `${MARCA}${nome}`,
      contactPhone: telefono,
      contactEmail: `ordini@${nome.split(" ")[0].toLowerCase()}.invalid`,
      canaleOrdine: canale,
    });
    fornitori[nome] = f.id;
  }
  // 🔴 E GLI ALTRI OTTO (23/08/2026). I due qui sopra restano perche' i
  // loro nomi sono quelli stampati sui documenti finti (`npm run
  // collaudo:documenti`): quando la fattura arriva dalla posta, il nome che
  // si legge sul PDF deve esistere gia' in anagrafica.
  //
  // ⚠️ Ma due fornitori non sono un'osteria: il pesce e la verdura
  // arrivavano dallo stesso camion, e l'anagrafica non aveva niente da
  // mostrare — ne' un confronto di prezzi fra chi vende la stessa cosa, ne'
  // ordini raggruppati, ne' fatture di ciascuno. Adesso sono **dieci**, e
  // ognuno porta le sue categorie di merce.
  for (const [nome, canale, telefono] of FORNITORI) {
    const f = await createSupplier({
      entityId: ente,
      name: `${MARCA}${nome}`,
      contactPhone: telefono,
      contactEmail: `ordini@${nome.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.invalid`,
      canaleOrdine: canale,
    });
    fornitori[nome] = f.id;
  }
  segna("fornitori con recapiti e canale d'ordine", 2 + FORNITORI.length);

  // ⚠️ Alcune soglie sono sopra la giacenza e altre sotto: serve che la
  // lista della spesa abbia qualcosa dentro e qualcosa fuori. Una lista
  // dove tutto è sotto soglia non fa vedere la differenza fra ciò che
  // serve e ciò che no.
  //
  // ⚠️ QUANTI siano sotto soglia NON è scritto qui: lo conta il comando e
  // lo dichiara in fondo. Al primo giro il riepilogo diceva «due» e ne
  // erano tre — perché il conto lo avevo fatto io a mente sulla tabella
  // qui sotto, dimenticando l'ingrediente dello stato di partenza e i
  // consumi dei conti chiusi. Un numero che descrive il database va
  // chiesto al database.
  //
  // ⚠️ I NOMI SONO QUELLI DEL CATALOGO, e non e' una coincidenza da tenere
  // a mano: se qui ci fosse «Gambero rosso» e nel catalogo «Gambero rosso
  // di Mazara», il collaudo avrebbe **due prodotti dove ce n'e' uno**, con
  // due giacenze e due prezzi che non si sommano mai.
  const DISPENSA = [
    ["Pomodoro ciliegino", "verdura", "kg", 4.8, 18, 8, "Ortofrutta PROVA S.r.l."],
    ["Melanzana lunga", "verdura", "kg", 1.95, 10, 4, "Ortofrutta PROVA S.r.l."],
    ["Basilico", "spezie_aromi", "mazzo", 1.15, 6, 10, "Ortofrutta PROVA S.r.l."],
    ["Gambero rosso di Mazara", "crostacei_molluschi", "kg", 24.0, 4, 6, "Ittica di Collaudo S.n.c."],
    ["Alici fresche", "pesce", "kg", 4.2, 6, 3, "Ittica di Collaudo S.n.c."],
    ["Ricotta di pecora", "latticini", "kg", 7.4, 5, 2, null],
    ["Farina di grano duro", "farine_cereali", "kg", 1.35, 25, 10, null],
    ["Olio extravergine", "olio_condimenti", "l", 9.8, 12, 5, null],
  ];
  const dispensa = {};
  for (const [nome, categoria, unita, prezzo, giacenza, soglia, fornitore] of DISPENSA) {
    const creato = await createIngredient({
      entity_id: ente,
      name: nome,
      category: categoria,
      unit: unita,
      current_price: prezzo,
      supplier_id: fornitore ? fornitori[fornitore] : null,
      stock_minimum_threshold: soglia,
      waste_percentage_default: categoria === "pesce" || categoria === "crostacei_molluschi" ? 35 : 8,
    });
    dispensa[nome] = creato?.id ?? creato;
    await registerStockDelivery({
      ingredientId: dispensa[nome],
      quantity: giacenza,
      supplierId: fornitore ? fornitori[fornitore] : null,
      expiryDate: traGiorniLocale(categoria === "pesce" ? 3 : 25),
      unitCost: prezzo,
      note: `${MARCA}carico iniziale`,
    });
  }
  segna("ingredienti con giacenza, prezzo e scorta minima", DISPENSA.length);

  // Il menu: otto piatti, quattro categorie. Le quantità non sono tonde
  // apposta — un food cost che viene 30,00% esatto non fa vedere niente.
  const CARTA = [
    // ⚠️ «della casa» perche' nel catalogo esiste gia' «Alici marinate al
    // limone»: due ricette con lo stesso nome sarebbero una sola dopo la
    // pulizia, e nessuno saprebbe quale delle due e' sparita.
    ["Alici marinate della casa", "antipasto", 9, [["Alici fresche", 0.12], ["Olio extravergine", 0.02]]],
    ["Caponata di melanzane", "antipasto", 8, [["Melanzana lunga", 0.22], ["Olio extravergine", 0.03]]],
    ["Busiate al pomodoro e basilico", "primo", 12, [["Farina di grano duro", 0.11], ["Pomodoro ciliegino", 0.18], ["Basilico", 0.15]]],
    ["Ravioli di ricotta", "primo", 14, [["Farina di grano duro", 0.09], ["Ricotta di pecora", 0.13]]],
    ["Crudo di gambero", "antipasto", 18, [["Gambero rosso di Mazara", 0.09], ["Olio extravergine", 0.015]]],
    ["Alici fritte", "secondo", 15, [["Alici fresche", 0.24], ["Farina di grano duro", 0.04]]],
    ["Melanzane alla parmigiana", "secondo", 13, [["Melanzana lunga", 0.35], ["Pomodoro ciliegino", 0.12]]],
    ["Cassatina di ricotta", "dolce", 7, [["Ricotta di pecora", 0.09]]],
  ];
  const menuCollaudo = await createMenu({ name: "Carta di collaudo", structure: "4-4-4-2" });
  for (const [nome, categoria, prezzo, componenti] of CARTA) {
    const r = await createRecipe({
      name: nome,
      category: categoria,
      recipe_type: "piatto_finito",
      // ⚠️ UNA porzione, non quattro: le quantita' qui sotto sono gia' per
      // porzione, e con 4 ogni food cost usciva diviso per quattro — l'1-2%
      // su piatti da 9-18 €, cioe' un numero che non puo' mostrare nessun
      // problema. Era gia' corretto nei due mesi, e non qui.
      portions_yield: 1,
    });
    for (const [ingrediente, quantita] of componenti) {
      await addRecipeIngredient(r.id, {
        ingredient_id: dispensa[ingrediente],
        quantity: quantita,
        unit: DISPENSA.find(([n]) => n === ingrediente)[2],
      });
    }
    await updateRecipe(r.id, { pronta_per_carta: true });
    await addMenuItem(menuCollaudo.id, { recipe_id: r.id, category: categoria, selling_price: prezzo });
  }
  // ⚠️ Il menu si accende DOPO aver messo dentro i piatti: su un menu già
  // attivo il database rifiuta i piatti non ancora «pronti per la carta»,
  // e qui si diventa pronti riga per riga. È l'ordine che userebbe anche
  // una persona — si compone la carta, poi la si mette in servizio.
  await setActiveMenu(menuCollaudo.id);
  segna("piatti in carta, su un menu attivo", CARTA.length);

  // La sala di stasera: metà prima del primo giro, metà dopo — così sulla
  // pianta si vedono i due colori e i tavoli che si possono girare.
  const { data: sagome } = await supabase
    .from("dining_tables")
    .select("id, label")
    .eq("tipo", "tavolo")
    .eq("active", true)
    .order("label");
  const SERATA = [
    ["Famiglia Grasso", "19:30", 4],
    ["Nicosia", "19:45", 2],
    ["Tavolo Amato", "20:00", 6],
    ["Di Blasi", "21:00", 2],
    ["Compleanno Lo Giudice", "21:15", 8],
    ["Interlandi", "21:30", 3],
  ];
  let quante = 0;
  for (const [i, [nome, ora, persone]] of SERATA.entries()) {
    const p = await createReservation({
      customer_name: `${MARCA}${nome}`,
      customer_phone: `+3900000001${String(i).padStart(2, "0")}`,
      party_size: persone,
      reservation_date: oggi,
      reservation_time: ora,
      status: "confermata",
      type: "prenotazione",
      source: "interno",
      notes: i === 4 ? "Compleanno: portare la torta a fine cena. Un ospite allergico ai crostacei." : null,
    });
    // Solo alcune hanno il tavolo: le altre le assegna lui dalla pianta,
    // che è uno dei gesti da collaudare.
    if (sagome?.[i] && i < 3) {
      await assegnaPrenotazione(p.id, [sagome[i].id]).catch(() => {});
    }
    quante += 1;
  }
  segna("prenotazioni per stasera (tre già a tavolo, tre da assegnare)", quante);

  // Un po' di storia, perché una schermata vuota non si collauda: due
  // conti già chiusi e pagati, e due fatture — una pagata, una da pagare.
  let conti = 0;
  for (const [tavoloIndice, piatti, mezzo] of [
    [0, [0, 2], "contante"],
    [1, [3, 5, 7], "carta"],
  ]) {
    const t = sagome?.[tavoloIndice];
    if (!t) break;
    const c = await orders.apriConto([t.id], { note: `${MARCA}serata precedente` });
    await orders.setOrderCoperti(c, 2 + tavoloIndice);
    const righe = [];
    for (const indice of piatti) {
      const { data: ric } = await supabase
        .from("recipes")
        .select("id")
        .eq("name", CARTA[indice][0])
        .single();
      const r = await orders.addDraftItem(c, {
        recipeId: ric.id,
        destination: "cucina",
        quantity: 1,
        unitPrice: CARTA[indice][2],
      });
      righe.push(r.id);
    }
    await orders.sendDraftItems(c, righe);
    await orders.closeOrderPaid(c, mezzo, impostazioni?.coperto_price ?? null);
    conti += 1;
  }
  segna("conti già chiusi, per non guardare schermate vuote", conti);

  const invPagata = await createSupplierInvoice({
    entityId: ente,
    supplierId: fornitori["Ortofrutta PROVA S.r.l."],
    invoiceNumber: "BASE-098",
    invoiceDate: traGiorniLocale(-40),
    dueDate: traGiorniLocale(-10),
    amount: 128.44,
    note: `${MARCA}fattura del mese scorso`,
  });
  await markInvoicePaid(invPagata, { paymentMethod: "bonifico" });
  const invScadenza = await createSupplierInvoice({
    entityId: ente,
    supplierId: fornitori["Ittica di Collaudo S.n.c."],
    invoiceNumber: "BASE-058",
    invoiceDate: oggi,
    dueDate: traGiorniLocale(25),
    amount: 195.69,
    note: `${MARCA}fattura in scadenza`,
  });
  // ⚠️ E UNA SCADUTA, che al primo giro mancava: il caso che deve saltare
  // all'occhio non era mai stato visto da nessuno. Scaduta da sei giorni,
  // ancora da pagare — è la riga che in quella schermata deve urlare.
  await createSupplierInvoice({
    entityId: ente,
    supplierId: fornitori["Ortofrutta PROVA S.r.l."],
    invoiceNumber: "BASE-101",
    invoiceDate: traGiorniLocale(-36),
    dueDate: traGiorniLocale(-6),
    amount: 74.9,
    note: `${MARCA}fattura SCADUTA`,
  });
  segna("fatture fornitore: una pagata, una in scadenza, una SCADUTA", 3);

  // --- Le note di credito, nei DUE casi che sono cose diverse (n. 8) ---
  //
  // ⚠️ Stanno qui e non in una prova automatica per una ragione precisa:
  // `note_credito` è sorvegliata dal registro delle cancellazioni, e una
  // prova che crea-e-cancella lì dentro lascia lapidi che non può togliere
  // (tests/app/LEGGIMI.md). Lo stato di partenza invece si demolisce da
  // SQL coi trigger spenti, quindi può tenere righe vere senza sporcare
  // niente — ed è anche l'unico modo di avere una riga su cui provare che
  // lo staff non vede le note di credito (§5 punto 2: mai dichiarare
  // verificata una RLS restrittiva su una tabella vuota).
  //
  // Caso 1 — la nota è arrivata PRIMA: si scala e si pagherà 170,00 su
  // 195,69. La schermata deve dire tutti e tre i numeri.
  await registraNotaCredito({
    entityId: ente,
    supplierId: fornitori["Ittica di Collaudo S.n.c."],
    data: oggi,
    importo: 25.69,
    fatturaId: invScadenza,
    numero: "NC-2027/14",
    note: `${MARCA}nota arrivata prima del pagamento`,
  });
  // Caso 2 — la nota è arrivata DOPO che la fattura era già pagata:
  // diventa un credito da usare sulla prossima di quel fornitore. È il
  // caso che si dimentica, e per questo il credito si mostra accanto al
  // «da pagare».
  await registraNotaCredito({
    entityId: ente,
    supplierId: fornitori["Ortofrutta PROVA S.r.l."],
    data: traGiorniLocale(-4),
    importo: 30,
    fatturaId: invPagata,
    numero: "NC-2027/21",
    note: `${MARCA}nota arrivata dopo il pagamento`,
  });
  segna("note di credito: una scalata, una che resta credito", 2);

  // --- Un DDT collegato alla fattura: la meccanica, senza conti dentro ---
  const ddt = await createDocument({
    entity_id: ente,
    title: `${MARCA}DDT 341 — Ortofrutta PROVA`,
    doc_type: "DDT",
    document_date: traGiorniLocale(-2),
    counterparties: "Ortofrutta PROVA S.r.l.",
    note: `${MARCA}documento collegato alla fattura scaduta`,
  });
  const { data: fatturaScaduta } = await supabase
    .from("supplier_invoices")
    .select("id")
    .eq("invoice_number", "BASE-101")
    .maybeSingle();
  if (fatturaScaduta) {
    await collegaDocumentoAFattura(ddt?.id ?? ddt, fatturaScaduta.id);
    segna("documento collegato a una fattura");
  }

  // 🔴 QUI NON SI RIEMPIE PIU' LA LISTA, e l'ordine e' il difetto che si
  // sta correggendo: girava **prima** che lo scenario dei due mesi creasse
  // i cento ingredienti, quindi trovava solo gli otto dello stato di
  // partenza. Misurato: **20 sotto scorta minima e 3 righe in lista** —
  // una lista corta che sembrava completa.
  //
  // Si riempie in fondo, quando la dispensa c'e' tutta e i conti chiusi
  // hanno gia' scaricato.

  // Il numero vero degli ingredienti sotto scorta minima, chiesto al
  // database dopo che i conti chiusi hanno scaricato: è quello che si
  // vedrà in Magazzino, non quello che avevo contato a mente.
  // `below_threshold` la calcola la vista: si legge la sua risposta invece
  // di rifare il confronto qui — due posti che decidono «è sotto soglia?»
  // finirebbero per dire due numeri diversi.
  const { data: livelli } = await supabase.from("v_stock_levels").select("below_threshold");
  segna(
    "ingredienti sotto scorta minima, contati adesso",
    (livelli ?? []).filter((r) => r.below_threshold).length
  );

  // -------------------------------------------------------------------
  // IL RETRO DEL LOCALE (secondo blocco del collaudo, 17/08)
  //
  // ⚠️ Al primo giro la sala era apparecchiata e il retro vuoto: cinque
  // moduli **non erano provabili**, non «erano vuoti». La differenza
  // conta, perché una schermata vuota non dice se funziona — e il modulo
  // più delicato dell'app (la Proiezione) era fra quelli.
  // -------------------------------------------------------------------

  // 🔴 PERSONALE, HACCP E ARCHIVIO SONO USCITI DA QUI (23/08/2026).
  //
  // Stavano in questo file in **campioni**: tre dipendenti senza una busta
  // paga, quattro letture di temperatura per due mesi, due attivita' di
  // pulizia, due documenti. Bastavano a non far girare a vuoto le
  // verifiche, e non bastavano a giudicare una schermata: un registro
  // HACCP di quattro righe si guarda tutto insieme, quindi non fa vedere
  // ne' il filtro per periodo, ne' la stampa del manuale, ne' una non
  // conformita' vecchia che sprofonda sotto le altre.
  //
  // Adesso li costruisce `scripts/scenario/retro.mjs`, a due mesi pieni.
  // Qui restano solo gli allergeni, che vivono sugli ingredienti.

  // --- Allergeni confermati su due ingredienti ---
  //
  // ⚠️ Senza almeno due confermati, TUTTI i piatti portano il rimando al
  // personale e la distinzione del Blocco 7 — piatto con allergeni
  // confermati contro piatto da verificare — non si vede sul foglio
  // stampato. Due bastano: serve il confronto, non la completezza.
  for (const [nome, allergeni] of [
    ["Farina di grano duro", ["glutine"]],
    ["Ricotta di pecora", ["latte"]],
  ]) {
    await updateIngredientFields(dispensa[nome], {
      allergens: allergeni,
      origine_allergeni: "confermati",
    });
  }
  segna("ingredienti con allergeni CONFERMATI (gli altri restano da verificare)", 2);

  // --- I DUE MESI DI VITA (22/08/2026) ---
  //
  // 🔴 VA PRIMA DELLA PREVISIONE, e l'ordine non è estetico: qui sotto si
  // chiudono due mesi col consuntivo, e il consuntivo FOTOGRAFA quello che
  // trova. Costruire i conti dopo la chiusura vorrebbe dire fotografare
  // zero, e la Proiezione direbbe la stessa cosa sia che funzioni sia che
  // no — cioè non si potrebbe collaudare.
  const { costruisciDueMesi } = await import("./prova-due-mesi.mjs");
  const { salvaPreventivo } = await carica("/src/lib/api/preventivi.js");
  const { recordStockConsumption, allineaGiacenza } = await carica("/src/lib/api/stock.js");
  const { registraConteggioCassa, versaInBanca } = await carica("/src/lib/api/cash.js");
  await costruisciDueMesi({
    MARCA, ente, segna, supabase, orders, oggi,
    dispensa,
    createRecipe, addRecipeIngredient, updateRecipe,
    createMenu, addMenuItem, setActiveMenu,
    createIngredient, updateIngredientPrice,
    registerStockDelivery, createReservation,
    createCashMovement, listAllCausali,
    registraConteggioCassa, versaInBanca,
    recordStockConsumption, allineaGiacenza,
    createSupplierInvoice, markInvoicePaid,
    salvaPreventivo, createBarItem, assegnaPrenotazione, registraNotaCredito,
    // Chi vende cosa: le consegne e le fatture lo chiedono per nome.
    fornitoriPerNome: new Map(Object.entries(fornitori)),
    // ⚠️ Una porta di sola lettura sul database di prova, per le domande
    // che il client non può fare: `fabbisogno_preparazione` è concessa
    // solo a `postgres`, e serve per sapere quanta merce consumeranno due
    // mesi di servizio. Si passa da psql, come le migrazioni.
    interrogaProva: (sql) => interroga(urlDelProgettoDiProva(), sql),
    fornitori: Object.values(fornitori),
    copertoPrezzo: impostazioni?.coperto_price ?? null,
  });

  // -------------------------------------------------------------------
  // IL RETRO DEL LOCALE, a due mesi pieni (23/08/2026)
  //
  // HACCP, personale, agenda, archivio e posta. Stavano qui dentro in
  // campioni — quattro letture di temperatura, tre dipendenti senza una
  // busta paga, due documenti — e adesso hanno la stessa taglia del
  // servizio: due mesi interi, giorno per giorno.
  //
  // ⚠️ Il generatore casuale è SUO, con un seme diverso da quello del
  // servizio: se condividessero lo stesso, aggiungere una lettura di
  // temperatura cambierebbe i piatti venduti tre settimane prima — e uno
  // scenario che si riproduce identico è metà del suo valore.
  // -------------------------------------------------------------------
  const retro = await import("./scenario/retro.mjs");
  const { seminato } = await import("./prova-due-mesi.mjs");
  const meseDi = (quanti) => {
    const [aa, mm] = oggi.split("-").map(Number);
    const d = new Date(aa, mm - 1 - quanti, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const mesiDelloScenario = [meseDi(2), meseDi(1)];
  // Tutti i giorni dei due mesi, in fila: il registro HACCP si scrive
  // giorno per giorno, comprese le domeniche e i lunedì di riposo (il
  // frigo va controllato anche quando il locale è chiuso — ed è
  // esattamente il genere di cosa che un ispettore guarda).
  const giorniDelPeriodo = [];
  for (const mese of mesiDelloScenario) {
    const [aa, mm] = mese.split("-").map(Number);
    const quanti = new Date(aa, mm, 0).getDate();
    for (let g = 1; g <= quanti; g++) {
      giorniDelPeriodo.push(`${mese}-${String(g).padStart(2, "0")}`);
    }
  }
  const ctxRetro = {
    MARCA, ente, segna, supabase, oggi,
    rnd: seminato(20260824),
    mesi: mesiDelloScenario,
    giorniDelPeriodo,
    createEquipment, addTemperatureLog, createCleaningTask, addCleaningLog, addPestControlLog,
    createEmployee, createEmployeeLeave, createPayslip, createTipCollected, createTipDistribution,
    createTask, createDocument,
  };
  await retro.costruisciHaccp(ctxRetro);
  await retro.costruisciPersonale(ctxRetro);
  await retro.costruisciAgenda(ctxRetro);
  await retro.costruisciArchivioEPosta(ctxRetro);

  // -------------------------------------------------------------------
  // GLI ANGOLI CHE RESTAVANO VUOTI (23/08/2026)
  //
  // Quaranta tabelle su centotré erano vuote, e fra loro c'erano moduli
  // interi: le Produzioni, gli ordini ai fornitori, gli sconti e gli
  // omaggi, l'Agricolo, i prestiti, le deduzioni, il menu del giorno, le
  // chiusure della sala, le caparre. Una tabella vuota non è un modulo
  // con pochi dati: è un modulo che non si può giudicare.
  // -------------------------------------------------------------------
  const angoli = await import("./scenario/angoli.mjs");
  const fasi = await import("./scenario/fasi.mjs");
  const ctxAngoli = {
    ...ctxRetro,
    ente,
    registraProduzione, bozzaOrdine, registraOrdine, annullaOrdine, segnaOrdineRicevuto,
    createDiscountGift, listAllCausali,
    createCrop, createForagedItem,
    registraPrestito, registraRestituzione, createScadenzaPrevista,
    createTagAnticipazione, createAnticipazione, pareggiaAnticipazione,
    createDeductibleExpense, createFiscalTool,
    createClosure, createDailyMenu, addDailyMenuItem, setReservationDeposit,
    addGoodsReceiving, createCession,
    addRecipeStep,
    nomiDelloScenario: [...NOMI_RICETTE_TUTTE, ...RICETTE_STATO_BASE],
  };
  await fasi.costruisciFasi(ctxAngoli);
  await angoli.costruisciProduzioni(ctxAngoli);
  await angoli.costruisciScontiEOmaggi(ctxAngoli);
  await angoli.costruisciAgricolo(ctxAngoli);
  await angoli.costruisciSoldiDelTitolare(ctxAngoli);
  await angoli.costruisciFiscale(ctxAngoli);
  await angoli.costruisciSalaECarta(ctxAngoli);
  await angoli.costruisciRicevimenti(ctxAngoli);
  await angoli.costruisciCessione(ctxAngoli);
  // --- La lista della spesa, ADESSO che la dispensa c'e' tutta ---
  //
  // ⚠️ Dopo i due mesi e non prima: le soglie hanno senso solo su una
  // dispensa completa, e i conti chiusi hanno gia' scaricato quello che
  // hanno consumato.
  await addBelowThresholdItems();
  const { count: inLista } = await supabase
    .from("shopping_list_items")
    .select("id", { count: "exact", head: true });
  segna("righe in lista della spesa, nate dalle soglie", inLista ?? 0);

  // ⚠️ Gli ordini vengono DOPO la lista della spesa, e non è un dettaglio
  // di sequenza: una bozza d'ordine si costruisce dalle righe in lista.
  // Prima della lista, `bozzaOrdine` non avrebbe niente da mettere dentro
  // e il modulo resterebbe vuoto senza che nessuno capisca perché.
  await angoli.costruisciOrdini(ctxAngoli);

  // --- La Proiezione: una previsione aperta, dell'anno in corso ---
  //
  // ⚠️ L'anno è quello CORRENTE e non il 2027 dell'apertura vera, ed è una
  // scelta del collaudo: gli scostamenti e il calendario delle imposte si
  // vedono solo se qualche mese è già passato. Su un piano del 2027 tutto
  // sarebbe «non ancora misurato», cioè la schermata direbbe la stessa
  // cosa sia che funzioni sia che no.
  const anno = Number(oggi.slice(0, 4));
  const mesi = Array.from({ length: 12 }, (_, i) => ({
    mese: i + 1,
    serviziSettimana: 6,
    giorniLavorativi: 26,
    // 🔴 I NUMERI DEL PIANO SONO STATI RIPORTATI VICINO AL VERO
    // (23/08/2026), e la ragione e' la stessa dei dati assurdi: prima il
    // piano prevedeva 55 coperti nei giorni pieni e i due mesi ne facevano
    // 19 — uno scostamento del meno sessanta per cento, cioe' un numero
    // che non si legge. Adesso il piano dice ~560 coperti al mese e i due
    // mesi ne fanno **513 e 744**: uno sotto e uno sopra, che e' l'unico
    // modo perche' quella schermata mostri qualcosa da capire.
    //
    // ⚠️ Non e' il piano ad essere stato piegato ai dati: e' che **il
    // piano dello scenario lo scrive questo comando**, non Alessio. Il suo
    // vero foglio non e' qui dentro (resta sul suo computer, §CONTRATTO).
    giorniPeak: i >= 5 && i <= 8 ? 10 : 8,
    copertiPeak: i >= 5 && i <= 8 ? 34 : 30,
    copertiFeriali: i >= 5 && i <= 8 ? 20 : 17,
    eventiPremium: i === 7 ? 2 : 0,
  }));
  const previsione = await creaScenarioDaFoglio({
    entity_id: ente,
    nome: `${MARCA}Previsione di collaudo ${anno}`,
    tipo: "partenza",
    anno,
    origine: "scenario di collaudo",
    parametri: {
      // Misurati sui due mesi costruiti: 48-53 euro a coperto, di cui il
      // 65% cibo, il 17% bevande e il 9% coperto. Il piano sta appena
      // sotto, cosi' lo scostamento e' leggibile invece di essere enorme.
      scontrinoFood: 38,
      scontrinoBeverage: 10,
      // Il food cost vero dei conti che hanno scaricato: 22,6% e 23,6%.
      foodCostPercento: 0.25,
      beverageCostPercento: 0.24,
      lavanderiaCoperto: 0.35,
      pagamentiElettroniciPercento: 0.7,
      commissionePosPercento: 0.012,
      oreGiorno: 8,
      pressionePersonale: 0.32,
      ammortamentiAnnui: 14000,
      finanziamentoImporto: 60000,
      finanziamentoTasso: 0.062,
      finanziamentoAnni: 7,
    },
    personale: [
      { ruolo: "cuoco", nettoOrario: 9.5, nettoGiorno: 76 },
      { ruolo: "sala", nettoOrario: 8.2, nettoGiorno: 65.6 },
    ],
    extra: [{ tipo: "extra sala fine settimana", giornateAnno: 90, tariffaGiorno: 70, pressione: 0.3, daEventi: false }],
    costiFissi: [
      { voce: "Affitto", euroMese: 2000 },
      { voce: "Utenze", euroMese: 780 },
      { voce: "Commercialista", euroMese: 250 },
      { voce: "Assicurazioni", euroMese: 78 },
    ],
    // ⚠️ «Quantità» qui è AL GIORNO, non all'anno: la formula la
    // moltiplica per le giornate di apertura del mese. Fino al 24/08 qui
    // c'era 1200 — milleduecento aperitivi al giorno in un locale da 34
    // coperti: 2,6 milioni di euro l'anno, l'88% dei ricavi della
    // previsione di collaudo, e un EBITDA al 73% dei ricavi che in un
    // ristorante non esiste. Un dato finto dev'essere PLAUSIBILE, o il
    // collaudo giudica le schermate su numeri che non somigliano al vero.
    accessorie: [{ linea: "Aperitivi", quantita: 12, prezzoMedio: 7, costoPercento: 0.22, base: "per_giorno" }],
    mesi,
    controlli: [],
  });
  segna("previsione APERTA per l'anno in corso, con dodici mesi");

  // Due mesi chiusi, così scostamenti e consuntivi hanno qualcosa da dire.
  // ⚠️ Si chiudono mesi GIA' PASSATI: chiudere il mese in corso
  // fotograferebbe un mese a metà e il confronto direbbe una bugia.
  const meseCorrente = Number(oggi.slice(5, 7));
  let chiusi = 0;
  for (const m of [meseCorrente - 2, meseCorrente - 1].filter((m) => m >= 1)) {
    const esito = await chiudiMese(ente, anno, m).catch((e) => ({ errore: e.message }));
    if (!esito?.errore) chiusi += 1;
  }
  segna("mesi chiusi (consuntivo fotografato)", chiusi);
  if (chiusi === 0) {
    console.log("      ⚠ nessun mese chiuso: siamo a gennaio, oppure la chiusura ha rifiutato.");
  }
  void previsione;
}

// ---------------------------------------------------------------------
// 7. Riepilogo — e ogni riga dice quante ne ha scritte.
// ---------------------------------------------------------------------
titolo("Fatto");
for (const r of creato) console.log(`   ${r}`);
console.log("");
console.log("   Conti, movimenti e clienti sono marcati «BASE-».");
console.log("   Ingredienti, ricette e menu hanno il loro nome vero: la pulizia");
console.log("   li riconosce dagli elenchi di scripts/scenario/carta.mjs.");
console.log("");
// 🔴 LA COPIA SI PORTA VIA SUBITO (23/08/2026), e solo se siamo arrivati
// fin qui: una costruzione caduta a meta' non deve lasciare una copia di
// uno stato che non e' mai esistito.
//
// ⚠️ Costa una trentina di secondi in fondo a un comando che ne dura molti
// di piu', e li ripaga al primo rilancio: da qui in avanti rimettere lo
// scenario e' `npm run prova:rimetti`, che e' un ripristino e non una
// ricostruzione. Senza questa riga la copia invecchierebbe rispetto allo
// scenario, e una copia vecchia rimessa e' peggio di nessuna copia.
if (scenario) {
  const { copiaLoScenario } = await import("./prova-copia.mjs");
  copiaLoScenario();
  console.log("");
  console.log("   Per rimettere questo stesso gestionale, in un minuto:");
  console.log("   npm run prova:rimetti");
  console.log("");
}

console.log("   Si rifa' tutto con:                        npm run prova:scenario");
console.log("   Cosa manca ancora al progetto di prova:   npm run prova:stato");
console.log("");

await supabase.auth.signOut({ scope: "local" });
await vite.close();
