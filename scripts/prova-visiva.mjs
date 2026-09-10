// =====================================================================
// LA PROVA VISIVA DELLA SCHEDA DELL'AGENDA — 10/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Alessio: «il titolo del task deve partire dalla stessa
//    colonna degli altri contenuti della scheda, su telefono e desktop».
//    È una domanda sulla FORMA, e nessuna prova di questo progetto la
//    poteva fare: le prove sulle schermate girano in un ambiente senza
//    impaginazione (jsdom), dove ogni elemento misura zero. Lì «il titolo
//    è allineato» passerebbe identico con la scheda storta.
//
// ⚠️ QUINDI SI USA UN BROWSER VERO. Si monta la vera schermata dell'Agenda
//    (finte sono solo le letture, vedi `tests/visive/finti/`), la si apre in
//    Chrome senza schermo alla larghezza di un telefono e di un computer, e
//    si MISURA dove cominciano, in punti, il testo del titolo e gli altri
//    contenuti della stessa scheda.
//
// ⚠️ NESSUNA DIPENDENZA NUOVA: Chrome si pilota col suo protocollo
//    (DevTools) e il WebSocket di Node. Niente Playwright, niente browser
//    scaricati.
//
// ⚠️ COSA SI CONFRONTA, e perché è diverso nelle due forme:
//    · TELEFONO — il quadrotto: titolo, campi («Scadenza: …»), nota della
//      provenienza e «rimanda» devono partire tutti dalla stessa colonna.
//    · COMPUTER — la riga della tabella: i campi stanno in colonne loro,
//      quindi nella cella del titolo resta la nota, che deve partire dove
//      parte il titolo.
//    E in tutte e due la spunta deve stare A SINISTRA del titolo, senza
//    sovrapporsi.
//
// Uso: `npm run test:visive`  (esce con 1 se qualcosa non è allineato)
// =====================================================================

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { QUANTE_SCHEDE } from "../tests/visive/finti/tasks.js";

const RADICE = process.cwd();
const TOLLERANZA_PX = 1;
const FORME = [
  { nome: "telefono", larghezza: 390, altezza: 844, scala: 3, mobile: true, quadri: "[data-quadrotto]" },
  { nome: "computer", larghezza: 1280, altezza: 900, scala: 1, mobile: false, quadri: "[data-riga]" },
];

// --- Chrome ------------------------------------------------------------
function doveChrome() {
  const candidati = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const trovato = candidati.find((c) => existsSync(c));
  if (!trovato) {
    console.error("Non trovo Chrome su questo computer: la prova visiva ne ha bisogno (variabile CHROME).");
    process.exit(2);
  }
  return trovato;
}

const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));

async function avviaChrome() {
  const porta = 9400 + Math.floor(Math.random() * 400);
  const profilo = mkdtempSync(path.join(os.tmpdir(), "b58-visiva-"));
  const chrome = spawn(
    doveChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      `--remote-debugging-port=${porta}`,
      `--user-data-dir=${profilo}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (r.ok) return { chrome, porta, profilo };
    } catch {
      /* non ancora pronto */
    }
    await aspetta(250);
  }
  chrome.kill();
  throw new Error("Chrome non ha aperto il canale di controllo entro 15 secondi.");
}

async function apriScheda(porta) {
  const r = await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: "PUT" });
  const bersaglio = await r.json();
  const ws = new WebSocket(bersaglio.webSocketDebuggerUrl);
  await new Promise((ok, ko) => {
    ws.onopen = ok;
    ws.onerror = ko;
  });
  let id = 0;
  const attese = new Map();
  const eventi = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && attese.has(d.id)) {
      const { ok, ko } = attese.get(d.id);
      attese.delete(d.id);
      if (d.error) ko(new Error(d.error.message));
      else ok(d.result);
    } else if (d.method) eventi.push(d);
  };
  const manda = (method, params = {}) =>
    new Promise((ok, ko) => {
      const mio = ++id;
      attese.set(mio, { ok, ko });
      ws.send(JSON.stringify({ id: mio, method, params }));
    });
  return { ws, manda, eventi };
}

// --- La misura, eseguita DENTRO la pagina -------------------------------
// ⚠️ Si misura dove comincia il TESTO disegnato, non il bordo dell'elemento:
//    un elemento può partire dalla colonna giusta e avere il testo spostato
//    da un margine interno, e l'occhio vede il testo.
const MISURA = (selettoreQuadri) => `(() => {
  const visibile = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inizioTesto = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const t = w.nextNode();
    if (!t) return el.getBoundingClientRect().left;
    const r = document.createRange();
    r.selectNodeContents(t);
    const q = r.getClientRects();
    return q.length ? q[0].left : el.getBoundingClientRect().left;
  };
  const quadri = [...document.querySelectorAll(${JSON.stringify(selettoreQuadri)})].filter(visibile);
  return quadri.map((q) => {
    const titolo = q.querySelector("[data-testo-titolo]") || q.querySelector("[data-titolo]");
    const colonna = titolo ? inizioTesto(titolo) : null;
    // ⚠️ Per un PULSANTE conta il bordo, non il testo: un pulsante col suo
    //    contorno allineato alla colonna è giusto, anche se la scritta
    //    dentro è rientrata dal margine interno. Per un testo nudo invece
    //    conta dove comincia la scritta, perché è quella che l'occhio vede.
    const altri = [
      ...[...q.querySelectorAll("[data-campo]")].map((e) => ["campo «" + e.textContent.trim().slice(0, 24) + "»", e, "testo"]),
      ...[...q.querySelectorAll("[data-nota]")].map((e) => ["nota «" + e.textContent.trim().slice(0, 24) + "»", e, "testo"]),
      ...[...q.querySelectorAll("[data-gesto]")].map((e) => ["pulsante «" + e.textContent.trim() + "»", e, "bordo"]),
    ].filter(([, e]) => visibile(e));
    const spunta = q.querySelector("input[type=checkbox]");
    return {
      titolo: titolo ? titolo.textContent.trim().slice(0, 40) : "(senza titolo)",
      colonna,
      spuntaDestra: spunta && visibile(spunta) ? spunta.getBoundingClientRect().right : null,
      altri: altri.map(([cosa, e, come]) => ({
        cosa,
        sinistra: come === "bordo" ? e.getBoundingClientRect().left : inizioTesto(e),
      })),
    };
  });
})()`;

// --- Il giro ------------------------------------------------------------
const server = await createServer({
  root: RADICE,
  configFile: path.join(RADICE, "vite.config.js"),
  logLevel: "error",
  server: { port: 5288, strictPort: false, host: "127.0.0.1" },
  resolve: {
    alias: [
      { find: /^.*\/lib\/api\/tasks$/, replacement: path.join(RADICE, "tests/visive/finti/tasks.js") },
      { find: /^.*\/context\/AuthContext$/, replacement: path.join(RADICE, "tests/visive/finti/AuthContext.jsx") },
    ],
  },
});
await server.listen();
const indirizzo = `${server.resolvedUrls.local[0]}tests/visive/agenda/index.html`;

const { chrome, porta, profilo } = await avviaChrome();
const cartellaFoto = path.join(os.tmpdir(), "b58-prova-visiva");
mkdirSync(cartellaFoto, { recursive: true });

const difetti = [];
let misurati = 0;

try {
  for (const forma of FORME) {
    const { ws, manda } = await apriScheda(porta);
    await manda("Page.enable");
    await manda("Runtime.enable");
    await manda("Emulation.setDeviceMetricsOverride", {
      width: forma.larghezza,
      height: forma.altezza,
      deviceScaleFactor: forma.scala,
      mobile: forma.mobile,
    });
    await manda("Page.navigate", { url: indirizzo });

    // Si aspetta che le schede ci siano davvero, non un tempo fisso.
    // ⚠️ E devono esserci TUTTE: una scheda che non si disegna non ha
    //    nessuna misura sbagliata, quindi senza questo conteggio la prova
    //    resterebbe verde proprio sulla scheda rotta.
    let righe = [];
    for (let i = 0; i < 80; i++) {
      const { result } = await manda("Runtime.evaluate", {
        expression: MISURA(forma.quadri),
        returnByValue: true,
      });
      righe = result.value ?? [];
      if (righe.length >= QUANTE_SCHEDE) break;
      await aspetta(250);
    }
    if (righe.length !== QUANTE_SCHEDE) {
      difetti.push(
        `${forma.nome}: disegnate ${righe.length} schede su ${QUANTE_SCHEDE} — quelle che mancano non sono state misurate.`
      );
    }

    for (const r of righe) {
      misurati++;
      if (r.colonna == null) {
        difetti.push(`${forma.nome} · «${r.titolo}»: il titolo non si trova.`);
        continue;
      }
      if (r.spuntaDestra != null && r.spuntaDestra > r.colonna + TOLLERANZA_PX) {
        difetti.push(
          `${forma.nome} · «${r.titolo}»: la spunta finisce a ${r.spuntaDestra.toFixed(1)} e il titolo comincia a ${r.colonna.toFixed(1)} — si sovrappongono.`
        );
      }
      for (const a of r.altri) {
        const scarto = a.sinistra - r.colonna;
        if (Math.abs(scarto) > TOLLERANZA_PX) {
          difetti.push(
            `${forma.nome} · «${r.titolo}»: ${a.cosa} comincia ${scarto > 0 ? "a destra" : "a sinistra"} del titolo di ${Math.abs(scarto).toFixed(1)} punti.`
          );
        }
      }
    }

    // La fotografia è un di più: se non arriva, la misura resta valida.
    try {
      const foto = await Promise.race([
        manda("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }),
        aspetta(15000).then(() => null),
      ]);
      if (foto?.data) {
        const dove = path.join(cartellaFoto, `agenda-${forma.nome}.png`);
        writeFileSync(dove, Buffer.from(foto.data, "base64"));
        console.log(`   fotografia: ${dove}`);
      }
    } catch {
      /* niente fotografia: la misura resta quella */
    }
    console.log(`${forma.nome}: ${righe.length} schede misurate`);
    ws.close();
  }
} finally {
  chrome.kill();
  await server.close();
  try {
    rmSync(profilo, { recursive: true, force: true });
  } catch {
    /* Chrome può tenere il profilo per un istante */
  }
}

if (difetti.length) {
  console.error(`\nPROVA VISIVA ROSSA — ${difetti.length} problemi su ${misurati} schede misurate:`);
  for (const d of difetti) console.error(`  · ${d}`);
  process.exit(1);
}
console.log(`\nPROVA VISIVA VERDE — titolo e contenuti partono dalla stessa colonna su ${misurati} schede.`);
