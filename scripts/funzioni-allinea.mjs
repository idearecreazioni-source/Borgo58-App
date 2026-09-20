// =====================================================================
// LE FUNZIONI ONLINE DI PROVA SONO QUELLE DEL RAMO?
// =====================================================================
// 🔴 NATO DA UNA MISURA, il 19/09/2026. Su Borgo58-Prova tre funzioni online
//    erano ferme a settimane prima: `posta-leggi`, `leggi-foto` e
//    `schede-prodotto`. Non per una dimenticanza singola — **niente le
//    installa**: il rilascio da `slave` pubblica il sito e basta, e lo
//    dichiara a ogni giro («non ho potuto controllare che le funzioni online
//    siano al passo col sito», vedi `scripts/funzioni-indietro.mjs`).
//
// ⚠️ E IL COSTO NON E' TEORICO: quelle tre erano rimaste indietro rispetto a
//    migrazioni gia' applicate su Prova. `schede-prodotto` chiedeva ancora al
//    modello un campo che non esiste piu'. Cioe' le prove su Prova
//    esercitavano un codice che nel repository non c'e' piu'.
//
// 🔴 COSA FA, E COSA NON FA DA SE'. Senza `--conferma` non installa niente:
//    scarica cio' che e' online, lo confronta con la cartella, e dice quali
//    differiscono. E' la stessa forma di `npm run migra` e `npm run funzione`
//    — *«non decide niente da se'»* — e per la stessa ragione: qui si
//    sovrascrive codice che gira.
//
// ⚠️ SOLO BORGO58-PROVA. La produzione ha un suo comando (`npm run funzione
//    <nome> -- --conferma`) con le sue reti: il push su GitHub, i riepiloghi
//    delle migrazioni, la verifica della chiave. Un comando che installa
//    **tutto in blocco** non puo' avere quelle reti una per una, quindi in
//    produzione non ci va.
//
// Uso:
//   npm run funzioni:allinea                 → il confronto, e basta
//   npm run funzioni:allinea -- --conferma   → installa quelle diverse
//   npm run funzioni:allinea -- posta-leggi leggi-foto --conferma
//                                            → solo quelle nominate

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { REF_PROVA, esegui, fermati, titolo } from "./comune.mjs";

export const CARTELLA = path.join("supabase", "functions");

/**
 * Come si leggono gli argomenti.
 *
 * ⚠️ `--produzione` non e' «non implementato»: e' RIFIUTATO, e con la ragione.
 *    Un flag che non esiste da' un errore che sembra un refuso; un rifiuto
 *    scritto dice dove andare invece.
 */
export function leggiArgomenti(argv) {
  const nomi = [];
  let conferma = false;
  let produzione = false;
  for (const a of argv) {
    if (a === "--conferma") conferma = true;
    else if (a === "--prova") continue; // il progetto e' gia' quello: si accetta e si ignora
    else if (a === "--produzione") produzione = true;
    else if (a.startsWith("--")) return { errore: `Non conosco l'opzione «${a}».` };
    else nomi.push(a);
  }
  if (produzione) {
    return {
      errore:
        "Questo comando lavora solo su Borgo58-Prova.\n" +
        "In produzione si installa una funzione per volta, con le sue reti:\n" +
        "  npm run funzione <nome> -- --conferma",
    };
  }
  return { nomi, conferma, ref: REF_PROVA };
}

/** Tutti i file di una cartella di funzione, come mappa percorso → testo. */
export function fileDellaCartella(dir) {
  const out = {};
  const cammina = (d, base) => {
    for (const e of readdirSync(d)) {
      const f = path.join(d, e);
      const rel = base ? `${base}/${e}` : e;
      if (statSync(f).isDirectory()) cammina(f, rel);
      else out[rel] = readFileSync(f, "utf8");
    }
  };
  if (existsSync(dir)) cammina(dir, "");
  return out;
}

/**
 * Che differenza c'e' fra la cartella e cio' che gira online?
 *
 * ⚠️ I FINE RIGA NON SONO UNA DIFFERENZA: su Windows la copia locale puo'
 *    essere CRLF e quella scaricata LF. Confrontarli come sono direbbe
 *    «diversa» su tutto, cioe' il guardiano griderebbe sempre.
 */
export function differenza(locale, remoto) {
  const pulisci = (t) => t.replace(/\r\n/g, "\n");
  const nomi = new Set([...Object.keys(locale), ...Object.keys(remoto)]);
  if (Object.keys(remoto).length === 0) return { stato: "non installata", file: [...nomi].sort() };
  const diversi = [...nomi]
    .filter((n) => pulisci(locale[n] ?? "") !== pulisci(remoto[n] ?? ""))
    .sort();
  return { stato: diversi.length === 0 ? "uguale" : "diversa", file: diversi };
}

/** L'elenco delle funzioni da guardare: quelle nominate, o tutte. */
export function daGuardare(nomiChiesti, presenti) {
  if (nomiChiesti.length === 0) return { nomi: presenti };
  const sconosciute = nomiChiesti.filter((n) => !presenti.includes(n));
  if (sconosciute.length > 0) {
    return { errore: `In ${CARTELLA} non c'e' nessuna funzione chiamata: ${sconosciute.join(", ")}.` };
  }
  return { nomi: nomiChiesti };
}

// ---------------------------------------------------------------------
// IL COMANDO
// ---------------------------------------------------------------------
function principale() {
  const letti = leggiArgomenti(process.argv.slice(2));
  if (letti.errore) fermati(letti.errore);

  const presenti = readdirSync(CARTELLA).filter((n) =>
    statSync(path.join(CARTELLA, n)).isDirectory()
  );
  const scelte = daGuardare(letti.nomi, presenti);
  if (scelte.errore) fermati(scelte.errore);

  titolo(`Funzioni online — PROGETTO DI PROVA (${REF_PROVA})`);

  const conShell = { shell: process.platform === "win32" };
  const tmp = mkdtempSync(path.join(tmpdir(), "borgo58-funzioni-"));
  const esiti = [];
  try {
    for (const nome of scelte.nomi) {
      const scarico = esegui(
        "npx",
        ["supabase", "functions", "download", nome, "--project-ref", REF_PROVA, "--use-api"],
        { ...conShell, cwd: tmp, silenzioso: true }
      );
      const remoto = scarico.ok ? fileDellaCartella(path.join(tmp, CARTELLA, nome)) : {};
      const d = differenza(fileDellaCartella(path.join(CARTELLA, nome)), remoto);
      esiti.push({ nome, ...d });
      const segno = d.stato === "uguale" ? "=" : d.stato === "diversa" ? "≠" : "·";
      console.log(`  ${segno} ${nome}${d.stato === "uguale" ? "" : ` — ${d.stato}`}`);
      if (d.stato === "diversa") console.log(`      file: ${d.file.join(", ")}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const daFare = esiti.filter((e) => e.stato !== "uguale");
  console.log("");
  if (daFare.length === 0) {
    console.log("  Tutto allineato: non c'e' niente da installare.");
    console.log("");
    return;
  }

  if (!letti.conferma) {
    console.log(`  ${daFare.length} da allineare. Nessuna modifica fatta: questa e' la sola lettura.`);
    console.log(`  Per installarle davvero: npm run funzioni:allinea -- ${daFare.map((e) => e.nome).join(" ")} --conferma`);
    console.log("");
    return;
  }

  for (const e of daFare) {
    console.log(`→ installo ${e.nome}`);
    const r = esegui(
      "npx",
      ["supabase", "functions", "deploy", e.nome, "--project-ref", REF_PROVA],
      conShell
    );
    if (!r.ok) fermati(`L'installazione di ${e.nome} non e' riuscita. Le altre non sono state toccate.`);
  }
  console.log("");
  console.log(`  Fatto: ${daFare.length} installate su Borgo58-Prova.`);
  console.log("  ⚠️  Rilancia il confronto per vedere che siano davvero allineate.");
  console.log("");
}

// ⚠️ Il file si puo' importare (le prove usano le funzioni pure) senza che il
//    comando parta: parte solo quando lo si lancia.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  principale();
}
