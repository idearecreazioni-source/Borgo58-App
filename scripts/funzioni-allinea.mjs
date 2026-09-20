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

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { REF_PROVA, fermati, titolo } from "./comune.mjs";

// 🔴 PERCHE' NON SI USA `esegui` DI `comune.mjs` (20/09/2026, difetto pagato).
//    Quella funzione **non passa la cartella di lavoro**, e lo scarico di una
//    funzione online scrive in `<cartella corrente>/supabase/functions/<nome>`:
//    il primo giro di questo comando ha quindi scaricato DENTRO IL REPOSITORY,
//    sovrascrivendo cinque file con le versioni vecchie che girano online.
// ⚠️ Non si e' allargato `esegui` — lo usano una ventina di comandi e una sua
//    modifica si paga altrove: qui serve una cosa sola, e sta in sei righe.
function eseguiIn(programma, argomenti, cwd) {
  const r = spawnSync(programma, argomenti, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return { ok: r.status === 0, uscita: (r.stdout || "") + (r.stderr || "") };
}

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

/**
 * Lo scarico com'è andato: scaricata, non installata, oppure un guasto.
 *
 * 🔴 «NON INSTALLATA» NON E' LA RISPOSTA A TUTTO CIO' CHE NON RIESCE
 *    (20/09/2026, difetto misurato). Il primo giro di questo comando ha
 *    risposto «non installata» per **dodici** funzioni su dodici, e dieci
 *    erano installate: lo scarico falliva per un'altra ragione e la risposta
 *    lo nascondeva. E' la famiglia del 19/08 — *una risposta più corta che ha
 *    l'aria di essere intera* — e qui costava un'installazione in blocco
 *    decisa su un confronto falso.
 * ⚠️ Quindi: si riconosce «non c'e'» SOLO dalle parole con cui il server lo
 *    dice; tutto il resto è un guasto, e si grida.
 */
export function esitoDelloScarico(ok, uscita) {
  if (ok) return "scaricata";
  const t = String(uscita ?? "").toLowerCase();
  if (t.includes("not found") || t.includes("does not exist") || t.includes("404")) {
    return "non installata";
  }
  return "guasto";
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

  const tmp = mkdtempSync(path.join(tmpdir(), "borgo58-funzioni-"));
  const esiti = [];
  try {
    for (const nome of scelte.nomi) {
      const scarico = eseguiIn(
        "npx",
        ["supabase", "functions", "download", nome, "--project-ref", REF_PROVA, "--use-api"],
        tmp
      );
      const esito = esitoDelloScarico(scarico.ok, scarico.uscita);
      if (esito === "guasto") {
        // ⚠️ Si grida invece di dire «non installata»: su una risposta falsa
        //    qualcuno installerebbe in blocco roba che non va toccata.
        fermati(
          `Non riesco a leggere «${nome}» dal progetto di prova, e non e' perche' non c'e'.`,
          "Nessuna funzione e' stata toccata. Ecco cosa ha risposto:",
          ...String(scarico.uscita).trim().split(/\r?\n/).slice(-6).map((r) => `  ${r}`)
        );
      }
      const remoto = esito === "scaricata" ? fileDellaCartella(path.join(tmp, CARTELLA, nome)) : {};
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

  // 🔴 «DIVERSA» E «MAI INSTALLATA» NON SI PROPONGONO INSIEME (20/09/2026).
  //    Aggiornare una funzione che gia' gira e' un allineamento; installarne
  //    una che non e' mai stata installata e' una DECISIONE — e in questo
  //    progetto ce ne sono due che aspettano apposta (`telegram-prova-test`,
  //    `posta-in-arrivo`). Un comando suggerito che le mette in fila con le
  //    altre le fa installare per inerzia.
  const diverse = daFare.filter((e) => e.stato === "diversa");
  const mai = daFare.filter((e) => e.stato === "non installata");

  if (!letti.conferma) {
    if (diverse.length > 0) {
      console.log(`  ${diverse.length} da allineare. Nessuna modifica fatta: questa e' la sola lettura.`);
      console.log(`  Per installarle davvero: npm run funzioni:allinea -- ${diverse.map((e) => e.nome).join(" ")} --conferma`);
    } else {
      console.log("  Nessuna di quelle installate e' rimasta indietro.");
    }
    if (mai.length > 0) {
      console.log("");
      console.log(`  Mai installate su Prova: ${mai.map((e) => e.nome).join(", ")}.`);
      console.log("  Non sono un ritardo: sono una decisione. Si installano nominandole una per una.");
    }
    console.log("");
    return;
  }

  for (const e of daFare) {
    console.log(`→ installo ${e.nome}`);
    // ⚠️ L'installazione parte dalla cartella del repository: è lì che stanno
    //    i file da mandare. Lo scarico, al contrario, va fuori.
    const r = eseguiIn(
      "npx",
      ["supabase", "functions", "deploy", e.nome, "--project-ref", REF_PROVA],
      process.cwd()
    );
    if (r.uscita) {
      console.log(
        r.uscita.trim().split(/\r?\n/).slice(-2).map((x) => `      ${x}`).join("\n")
      );
    }
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
