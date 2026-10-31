// L'APP DI CASA — `npm run casa:impacchetta`
//
// Costruisce il gestionale per Casa e lo mette in C:\Casa\sito, da dove lo
// serve `casa:sito`. Si lancia dalla cartella di sviluppo (serve Vite) ogni
// volta che si vuole portare su Casa una versione nuova del gestionale.
//
// Cosa ha di diverso dalla costruzione del locale:
//  · l'indirizzo e' quello di Casa sul PC, via Tailscale
//    (https://<pc>.ts.net:8443): app e database dallo STESSO indirizzo,
//    il server di Casa inoltra a Supabase /rest, /auth, /storage, /realtime;
//  · la chiave e' quella pubblica di Casa (firmata con la chiave propria);
//  · VITE_AMBIENTE=casa: il gestionale si riconosce come Casa (fascia oliva,
//    pallino oliva) — e la dichiarazione non vince mai su un indirizzo del
//    cloud (src/lib/ambiente.js);
//  · nome, titolo, colore e icone propri: sull'iPhone Casa e' un'app
//    distinta da Borgo 58, con la fascia oliva anche nell'icona.
//
// ⚠️ Le variabili passate qui vincono su quelle di .env (regola di Vite):
// un .env che punta alla produzione non entra nella costruzione di Casa. E
// alla fine si CONTROLLA: se nel risultato compare l'indirizzo di un
// progetto del cloud, o la chiave di servizio, la costruzione si ferma.
//
// ⚠️ Si costruisce in C:\Casa\sito.nuova e si scambia solo alla fine,
// quando tutto e' controllato: una costruzione fallita lascia Casa con la
// versione di prima, e il server non trova mai la cartella a meta'.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fermati, titolo } from "./comune.mjs";
import { leggiPng, scriviPng } from "./icone-app.mjs";
import { CARTELLA, CLOUD, indirizzoDiCasa, leggiChiavi, pretendiCasa } from "./casa-comune.mjs";

const SITO = path.join(CARTELLA, "sito");
const NUOVA = `${SITO}.nuova`;
const VECCHIA = `${SITO}.vecchia`;
const OLIVA = [0x56, 0x60, 0x3c, 0xff]; // --color-b58-olive
const NOME = "Casa · gestionale personale";
const NOME_BREVE = "Casa";

/** Butta la costruzione nuova e si ferma: Casa resta com'era. */
function scarta(...righe) {
  rmSync(NUOVA, { recursive: true, force: true });
  fermati(...righe, "", "Casa resta con la versione di prima.");
}

titolo("Preparo l'app di Casa");
pretendiCasa();
const { anon, servizio } = leggiChiavi();
const indirizzo = indirizzoDiCasa();
console.log(`   indirizzo: ${indirizzo}`);

// ---------------------------------------------------------------------
// 1. La costruzione, con l'indirizzo e la chiave di Casa.
// ---------------------------------------------------------------------
titolo("Costruisco il gestionale (un paio di minuti)");
const r = spawnSync("npx", ["vite", "build", "--outDir", NUOVA, "--emptyOutDir"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  env: { ...process.env, VITE_SUPABASE_URL: indirizzo, VITE_SUPABASE_ANON_KEY: anon, VITE_AMBIENTE: "casa" },
});
if (r.status !== 0) scarta("La costruzione non e' riuscita:", (r.stderr || r.stdout || "").trim().split("\n").slice(-12).join("\n  "));

// ---------------------------------------------------------------------
// 2. Il controllo: dentro c'e' Casa, nessun indirizzo del cloud e nessuna
//    chiave di servizio — in TUTTI i file di testo, non solo nel codice.
// ---------------------------------------------------------------------
const DI_TESTO = /\.(js|mjs|css|html|json|webmanifest|txt|svg)$/i;
const tutti = (cartella) =>
  readdirSync(cartella, { withFileTypes: true }).flatMap((v) =>
    v.isDirectory() ? tutti(path.join(cartella, v.name)) : DI_TESTO.test(v.name) ? [path.join(cartella, v.name)] : []
  );
const testo = tutti(NUOVA)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const cloudDentro = CLOUD.filter((ref) => testo.includes(`${ref}.supabase.co`));
// 🔴 La chiave di servizio non deve MAI finire nell'app: chi la legge
// comanda il database. Si cerca il valore vero, e una chiave segreta nuova
// di Supabase scritta per intero. ⚠️ Non le sole parole «service_role» o
// «sb_secret_»: le librerie di Supabase le nominano da se' nei loro
// messaggi (misurato il 31/10).
const segreti = [testo.includes(servizio), /sb_secret_[A-Za-z0-9_-]{20,}/.test(testo)].filter(Boolean);
if (cloudDentro.length > 0) scarta("FERMO: dentro l'app c'e' l'indirizzo del cloud:", cloudDentro.join(", "));
if (segreti.length > 0) scarta("FERMO: dentro l'app c'e' la chiave di servizio, o qualcosa che le somiglia.");
if (!testo.includes(indirizzo) || !testo.includes(anon)) scarta("FERMO: nell'app mancano l'indirizzo o la chiave di Casa.");
console.log("   dentro c'e' Casa; niente cloud, niente chiave di servizio");

// ---------------------------------------------------------------------
// 3. Nome, titolo e colore di Casa.
// ---------------------------------------------------------------------
const manifesto = JSON.parse(readFileSync(path.join(NUOVA, "manifest.webmanifest"), "utf8"));
Object.assign(manifesto, {
  name: NOME,
  short_name: NOME_BREVE,
  description: "Casa: il gestionale personale di Alessio, sul suo PC.",
  theme_color: "#56603c",
});
writeFileSync(path.join(NUOVA, "manifest.webmanifest"), JSON.stringify(manifesto, null, 2), "utf8");

const pagina = path.join(NUOVA, "index.html");
let html = readFileSync(pagina, "utf8");
for (const [prima, dopo] of [
  [/<title>[^<]*<\/title>/, `<title>${NOME}</title>`],
  [/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${NOME_BREVE}$2`],
  [/(<meta name="theme-color" content=")[^"]*(")/, "$1#56603c$2"],
]) {
  if (!prima.test(html)) scarta(`In index.html non trovo ${prima}: la pagina e' cambiata, va guardata.`);
  html = html.replace(prima, dopo);
}
writeFileSync(pagina, html, "utf8");

// I file per Cloudflare Pages non servono a Casa.
for (const f of ["_headers", "_redirects"]) rmSync(path.join(NUOVA, f), { force: true });

// ---------------------------------------------------------------------
// 4. Le icone: il logo di sempre, con una fascia oliva in basso — la stessa
//    fascia che Casa ha in cima a ogni pagina. Il logo sta fra il 30% e il
//    70% dell'altezza (icone-app.mjs), la fascia dal 78% in giu'.
// ---------------------------------------------------------------------
for (const file of ["icona-192.png", "icona-512.png", "apple-touch-icon.png"]) {
  const dove = path.join(NUOVA, file);
  if (!existsSync(dove)) scarta(`Manca ${file} nella costruzione.`);
  const { larghezza, altezza, pixel } = leggiPng(readFileSync(dove));
  for (let y = Math.round(altezza * 0.78); y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) pixel.set(OLIVA, (y * larghezza + x) * 4);
  }
  scriviPng(larghezza, altezza, pixel, dove);
}

const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim();
const costruita = new Date().toISOString();
writeFileSync(path.join(NUOVA, "casa-versione.json"), JSON.stringify({ costruita, commit }, null, 2), "utf8");
console.log(`   nome «${NOME_BREVE}», fascia oliva, icone di Casa`);

// ---------------------------------------------------------------------
// 4bis. Il service worker (fase 4): l'app dentro il telefono, per aprirsi
//       anche senza rete. Il modello e' scripts/casa-sw.js; qui si mettono
//       la versione e l'elenco di TUTTI i file dell'app, compresi i pezzi
//       di codice che si caricano solo quando servono.
// ---------------------------------------------------------------------
const tuttiIFile = (cartella, base = "") =>
  readdirSync(cartella, { withFileTypes: true }).flatMap((v) =>
    v.isDirectory() ? tuttiIFile(path.join(cartella, v.name), `${base}/${v.name}`) : [`${base}/${v.name}`]
  );
const elenco = tuttiIFile(NUOVA)
  .filter((f) => !f.startsWith("/.vite/") && f !== "/casa-versione.json")
  .map((f) => encodeURI(f));
const modello = readFileSync(new URL("./casa-sw.js", import.meta.url), "utf8");
if (!modello.includes('"__VERSIONE__"') || !modello.includes('"__ELENCO__"')) scarta("Il modello del service worker e' cambiato: mancano i segnaposto.");
writeFileSync(
  path.join(NUOVA, "sw-casa.js"),
  modello
    .replace('"__VERSIONE__"', () => JSON.stringify(`${commit}-${costruita}`))
    // L'elenco entra come testo JSON dentro una stringa: JSON.parse lo rilegge.
    .replace('"__ELENCO__"', () => JSON.stringify(JSON.stringify(elenco))),
  "utf8"
);
console.log(`   app nel telefono: ${elenco.length} file per aprirsi anche senza rete`);

// ---------------------------------------------------------------------
// 5. Lo scambio: la versione nuova prende il posto di quella di prima.
// ---------------------------------------------------------------------
rmSync(VECCHIA, { recursive: true, force: true });
if (existsSync(SITO)) renameSync(SITO, VECCHIA);
renameSync(NUOVA, SITO);
rmSync(VECCHIA, { recursive: true, force: true });
console.log("");
console.log(`App di Casa pronta in ${SITO}. La serve  npm run casa:sito  (o casa:accendi).`);
