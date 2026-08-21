// UNA CARTA DI PROVA PER GIUDICARE LE COMANDE — 21/08/2026
//
// 🔴 PERCHÉ ESISTE. Il gestionale vero ha **zero ricette e zero menu**, e
// senza piatti Alessio non può giudicare né il menu, né le categorie che
// filtrano, né i pulsanti dentro la pianta: la colonna di sinistra è vuota.
// Decisione sua (strada A): mettere una carta di prova in produzione.
//
// ⚠️ I NOMI SONO PLAUSIBILI, NON STRINGHE DI PROVA, ed è il punto. Il
// vincolo dei «245 punti» che il 21/08 mi aveva fatto concludere che il menu
// non ci stesse in colonna era nato da nomi finti col prefisso `BASE-`.
// Una carta con nomi veri misura quello che si vuole misurare.
//
// 🔴 E VA TOLTA PRIMA DEI DATI VERI, come le prenotazioni di collaudo. Cosa
// inserisce è scritto qui sotto e nel riepilogo, così è togliibile senza
// cercarlo:
//   · 1 menu, «Carta di prova»
//   · 14 ricette (4 antipasti, 4 primi, 4 secondi, 2 dolci)
//   · 14 righe di menu, una per ricetta
// Nessun ingrediente, nessun lotto, nessun costo: le ricette nascono **senza
// componenti**, quindi non toccano il magazzino e non hanno food cost.
//
// ⚠️ CONSEGUENZA DA NON DIMENTICARE: la pulizia dei dati di collaudo
// (`20260820000012`) **si ferma se trova ricette** — è un guardiano scritto
// apposta. Con questa carta dentro, la prossima pulizia va rimisurata.
//
// Si lancia con:  node scripts/menu-di-prova.mjs            (sola lettura)
//                 node scripts/menu-di-prova.mjs --conferma (scrive)

import { createServer } from "vite";

const conferma = process.argv.includes("--conferma");

const CARTA = [
  ["Sarde a beccafico", "antipasto", 12],
  ["Caponata di melanzane", "antipasto", 10],
  ["Crudo di gambero rosso", "antipasto", 18],
  ["Sformato di broccoli e ricotta", "antipasto", 11],
  ["Busiate al pesto trapanese", "primo", 14],
  ["Anelletti al forno", "primo", 15],
  ["Spaghetti con le vongole", "primo", 16],
  ["Risotto agli agrumi", "primo", 15],
  ["Tonno in crosta di pistacchio", "secondo", 22],
  ["Involtini di pesce spada", "secondo", 20],
  ["Maialino nero dei Nebrodi", "secondo", 21],
  ["Parmigiana di melanzane", "secondo", 14],
  ["Cassata siciliana", "dolce", 8],
  ["Cannolo scomposto", "dolce", 7],
];

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const carica = (p) => vite.ssrLoadModule(p);
const { ambienteCorrente } = await carica("/src/lib/ambiente.js");
const { createRecipe, updateRecipe } = await carica("/src/lib/api/recipes.js");
const { createMenu, addMenuItem, setActiveMenu } = await carica("/src/lib/api/menus.js");
const { supabase } = await carica("/src/lib/supabase.js");

const amb = ambienteCorrente();
console.log("");
console.log(`── Carta di prova — database: ${amb.genere} (${amb.riferimento})`);
console.log(`   ${CARTA.length} piatti in 4 categorie, 1 menu.`);
console.log("");

if (!conferma) {
  for (const [nome, cat, prezzo] of CARTA) {
    console.log(`   ${cat.padEnd(10)} ${nome.padEnd(34)} ${prezzo},00 €`);
  }
  console.log("");
  console.log("  Nessuna modifica fatta: questa e' la modalita' di sola lettura.");
  console.log("  Per inserirla davvero: node scripts/menu-di-prova.mjs -- --conferma");
  console.log("");
  process.exit(0);
}

// ⚠️ Si entra come il titolare vero: `createRecipe` e `createMenu` passano
// dalla RLS, e senza sessione rispondono «permission denied». Le credenziali
// vengono dall'ambiente, mai da qui.
const email = process.env.MENU_EMAIL;
const pin = process.env.MENU_PIN;
if (!email || !pin) {
  console.error("Servono MENU_EMAIL e MENU_PIN nell'ambiente.");
  process.exit(1);
}
const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password: pin });
if (errLogin) {
  console.error("Accesso rifiutato: " + errLogin.message);
  process.exit(1);
}

const menu = await createMenu({ name: "Carta di prova", structure: "4-4-4-2" });
console.log(`   menu creato: ${menu.name}`);
let n = 0;
for (const [nome, categoria, prezzo] of CARTA) {
  const r = await createRecipe({
    name: nome,
    category: categoria,
    recipe_type: "piatto_finito",
    portions_yield: 4,
  });
  // ⚠️ «Pronta per carta» PRIMA di metterla nel menu: dal 16/08 un piatto non
  // pronto non entra in un menu attivo, e il rifiuto arriva dal database.
  await updateRecipe(r.id, { pronta_per_carta: true });
  await addMenuItem(menu.id, { recipe_id: r.id, category: categoria, selling_price: prezzo });
  n++;
}
// Il menu si accende DOPO: su uno attivo il database rifiuta i piatti non
// ancora pronti, e questo è l'ordine che non lascia un buco in mezzo.
await setActiveMenu(menu.id);
console.log(`   ${n} piatti inseriti e menu attivato.`);
console.log("");
console.log("  DA TOGLIERE prima dei dati veri: 1 menu «Carta di prova», 14 ricette.");
console.log("  ⚠️ E la pulizia dei dati di collaudo si ferma se trova ricette:");
console.log("     va rimisurata prima di applicarla.");
console.log("");
await vite.close();
process.exit(0);
