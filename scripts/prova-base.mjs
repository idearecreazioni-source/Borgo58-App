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
// ⚠️ MARCATO E BUTTABILE. Tutto quello che crea si chiama `BASE-…`,
// accanto ai `TEST-AUTO …` delle prove automatiche: si riconosce a colpo
// d'occhio, si cancella senza pensarci (`-- --rifai`), e
// `npm run prova:ricostruisci` lo rimette da sé. Niente qui dentro è
// sacro.
//
// Non tocca MAI il database vero: il controllo è la prima cosa che fa.

import { existsSync, readFileSync } from "node:fs";
import { createServer } from "vite";
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
const rifai = process.argv.includes("--rifai");
// Lo scenario del collaudo: molto piu' dello stato di partenza, stessa marca.
const scenario = process.argv.includes("--scenario");

// ---------------------------------------------------------------------
// 1. L'ambiente: si legge da .env.test, che è già il file che dice qual è
//    il progetto di prova (lo usa anche `npm run test:app`).
// ---------------------------------------------------------------------
if (!existsSync(".env.test")) {
  fermati("Manca .env.test.", "Copia .env.test.example in .env.test (vedi docs/AMBIENTE_PROVA.md).");
}
const conf = {};
for (const riga of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
  const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) conf[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
for (const nome of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "TEST_TITOLARE_EMAIL", "TEST_TITOLARE_PASSWORD"]) {
  if (!conf[nome]) fermati(`Manca ${nome} in .env.test.`, "Vedi tests/app/LEGGIMI.md.");
}
if (conf.VITE_SUPABASE_URL.includes(REF_PRODUZIONE)) {
  fermati(
    "FERMO: .env.test punta al database VERO del locale.",
    "Questo comando SCRIVE: deve poter parlare solo col progetto di prova."
  );
}
// ---------------------------------------------------------------------
// 2. I moduli VERI dell'app, caricati come li carica l'app.
//
// ⚠️ Passano da Vite e non da un `import` di Node, e non è un capriccio:
// i moduli di `src/` si scrivono fra loro senza estensione (`from
// "../supabase"`) e leggono la configurazione da `import.meta.env`. Node
// da solo non sa fare né l'una né l'altra cosa. Facendoli girare dentro
// Vite, in modalità `test`, si ottengono due cose insieme: la
// configurazione arriva da `.env.test` (cioè dal progetto di prova) e il
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
const { createIngredient, updateIngredientPrice } = await carica("/src/lib/api/ingredients.js");
const { registerStockDelivery } = await carica("/src/lib/api/stock.js");
const { createRecipe, updateRecipe } = await carica("/src/lib/api/recipes.js");
const { addRecipeIngredient } = await carica("/src/lib/api/recipeIngredients.js");
const { createMenu, addMenuItem, setActiveMenu } = await carica("/src/lib/api/menus.js");
const orders = await carica("/src/lib/api/orders.js");
const { createCashMovement, createPosDevice, listAllCausali } = await carica("/src/lib/api/cash.js");
const { createSupplierInvoice, markInvoicePaid } = await carica("/src/lib/api/supplierInvoices.js");
const { assegnaPrenotazione, createReservation } = await carica("/src/lib/api/reservations.js");
const { upsertFiscalSettings } = await carica("/src/lib/api/fiscal.js");
const { addBelowThresholdItems } = await carica("/src/lib/api/shoppingList.js");
const { addGoodsReceiving } = await carica("/src/lib/api/haccp.js");
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
  fermati("FERMO: i moduli dell'app si sono collegati al database VERO.", "Controlla .env.test.");
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

  delete from menu_items where menu_id in (select id from menus where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from menus where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  delete from recipe_status_history where recipe_id in (select id from recipes where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipe_ingredients where recipe_id in (select id from recipes where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from recipes where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  delete from stock_consumptions where ingredient_id in (select id from ingredients where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from stock_lots where ingredient_id in (select id from ingredients where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from price_history where ingredient_id in (select id from ingredients where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from articoli_fornitore where ingredient_id in (select id from ingredients where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from shopping_list_items where ingredient_id in (select id from ingredients where name like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from ingredients where name like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;

  delete from cash_movements
   where supplier_invoice_id in (select id from supplier_invoices where note like '${MARCA}%');
  get diagnostics n = row_count; tolte := tolte + n;
  delete from tasks
   where id in (select task_id from supplier_invoices where note like '${MARCA}%' and task_id is not null);
  get diagnostics n = row_count; tolte := tolte + n;
  delete from supplier_invoices where note like '${MARCA}%';
  get diagnostics n = row_count; tolte := tolte + n;
  delete from suppliers where name like '${MARCA}%';
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
  raise notice 'avanzi tolti: %', tolte;
end $avanzi$;
reset session_replication_role;
`;

function pulisci(url, sql, etichetta, chiave) {
  const uscita = interroga(url, sql);
  const quante = uscita.match(new RegExp(`${chiave}: (\\d+)`))?.[1] ?? "?";
  console.log(`   ${etichetta}: ${quante}`);
}

function togliBase() {
  const config = leggiConfigurazione();
  const url = soloProva(
    obbligatorio(config, "DB_URL_PROVA", "E' la stringa 'Session pooler' del progetto Borgo58-Prova.")
  );
  pulisci(url, SQL_PULIZIA, "righe dello scenario tolte", "righe tolte");
  pulisci(url, SQL_AVANZI_PROVE, "avanzi delle prove automatiche tolti", "avanzi tolti");
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
  name: `${MARCA}Pomodoro di prova`,
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
  name: `${MARCA}Piatto di prova`,
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
await upsertFiscalSettings(ente, {
  annualRevenueEstimate: 250000,
  iresRate: 0.24,
  irapRate: 0.039,
  accontoPercento: 1,
  accontoPrimaRataPercento: 0.4,
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
  segna("fornitori con recapiti e canale d'ordine", 2);

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
  const DISPENSA = [
    ["Pomodoro ciliegino", "verdura", "kg", 4.8, 18, 8, "Ortofrutta PROVA S.r.l."],
    ["Melanzana lunga", "verdura", "kg", 1.95, 10, 4, "Ortofrutta PROVA S.r.l."],
    ["Basilico", "spezie_aromi", "mazzo", 1.15, 6, 10, "Ortofrutta PROVA S.r.l."],
    ["Gambero rosso", "crostacei_molluschi", "kg", 24.0, 4, 6, "Ittica di Collaudo S.n.c."],
    ["Alici fresche", "pesce", "kg", 4.2, 6, 3, "Ittica di Collaudo S.n.c."],
    ["Ricotta di pecora", "latticini", "kg", 7.4, 5, 2, null],
    ["Farina di grano duro", "farine_cereali", "kg", 1.35, 25, 10, null],
    ["Olio extravergine", "olio_condimenti", "l", 9.8, 12, 5, null],
  ];
  const dispensa = {};
  for (const [nome, categoria, unita, prezzo, giacenza, soglia, fornitore] of DISPENSA) {
    const creato = await createIngredient({
      entity_id: ente,
      name: `${MARCA}${nome}`,
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
    ["Alici marinate al limone", "antipasto", 9, [["Alici fresche", 0.12], ["Olio extravergine", 0.02]]],
    ["Caponata di melanzane", "antipasto", 8, [["Melanzana lunga", 0.22], ["Olio extravergine", 0.03]]],
    ["Busiate al pomodoro e basilico", "primo", 12, [["Farina di grano duro", 0.11], ["Pomodoro ciliegino", 0.18], ["Basilico", 0.15]]],
    ["Ravioli di ricotta", "primo", 14, [["Farina di grano duro", 0.09], ["Ricotta di pecora", 0.13]]],
    ["Crudo di gambero rosso", "antipasto", 18, [["Gambero rosso", 0.09], ["Olio extravergine", 0.015]]],
    ["Alici fritte", "secondo", 15, [["Alici fresche", 0.24], ["Farina di grano duro", 0.04]]],
    ["Melanzane alla parmigiana", "secondo", 13, [["Melanzana lunga", 0.35], ["Pomodoro ciliegino", 0.12]]],
    ["Cassatina di ricotta", "dolce", 7, [["Ricotta di pecora", 0.09]]],
  ];
  const menuCollaudo = await createMenu({ name: `${MARCA}Carta di collaudo`, structure: "4-4-4-2" });
  for (const [nome, categoria, prezzo, componenti] of CARTA) {
    const r = await createRecipe({
      name: `${MARCA}${nome}`,
      category: categoria,
      recipe_type: "piatto_finito",
      portions_yield: 4,
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
        .eq("name", `${MARCA}${CARTA[indice][0]}`)
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
  await createSupplierInvoice({
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

  await addBelowThresholdItems();
  const { count: inLista } = await supabase
    .from("shopping_list_items")
    .select("id", { count: "exact", head: true });
  segna("righe in lista della spesa, nate dalle soglie", inLista ?? 0);

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
}

// ---------------------------------------------------------------------
// 7. Riepilogo — e ogni riga dice quante ne ha scritte.
// ---------------------------------------------------------------------
titolo("Fatto");
for (const r of creato) console.log(`   ${r}`);
console.log("");
console.log("   Tutto e' marcato «BASE-» e si rifa' con:  npm run prova:base -- --rifai");
console.log("   Cosa manca ancora al progetto di prova:   npm run prova:stato");
console.log("");

await supabase.auth.signOut({ scope: "local" });
await vite.close();
