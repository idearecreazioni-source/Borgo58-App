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
const { createSupplierInvoice } = await carica("/src/lib/api/supplierInvoices.js");
const { createReservation } = await carica("/src/lib/api/reservations.js");
const { upsertFiscalSettings } = await carica("/src/lib/api/fiscal.js");
const { addBelowThresholdItems } = await carica("/src/lib/api/shoppingList.js");
const { addGoodsReceiving } = await carica("/src/lib/api/haccp.js");

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

const oggi = new Date().toISOString().slice(0, 10);
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

function togliBase() {
  const config = leggiConfigurazione();
  const url = soloProva(
    obbligatorio(config, "DB_URL_PROVA", "E' la stringa 'Session pooler' del progetto Borgo58-Prova.")
  );
  const uscita = interroga(url, SQL_PULIZIA);
  const quante = uscita.match(/righe tolte: (\d+)/)?.[1] ?? "?";
  console.log(`   righe tolte: ${quante}`);
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
const scadenza = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
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
const fraDieciGiorni = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
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
// 6. Riepilogo — e ogni riga dice quante ne ha scritte.
// ---------------------------------------------------------------------
titolo("Fatto");
for (const r of creato) console.log(`   ${r}`);
console.log("");
console.log("   Tutto e' marcato «BASE-» e si rifa' con:  npm run prova:base -- --rifai");
console.log("   Cosa manca ancora al progetto di prova:   npm run prova:stato");
console.log("");

await supabase.auth.signOut({ scope: "local" });
await vite.close();
