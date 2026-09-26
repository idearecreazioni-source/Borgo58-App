// =====================================================================
// CHROME SENZA SCHERMO, PILOTATO DAL SUO PROTOCOLLO — 11/09/2026
// =====================================================================
// Il pezzo comune delle prove che guardano una schermata vera: avvia Chrome
// senza finestra, apre una scheda, le fa eseguire del codice e la fotografa.
// Lo usano `prova-visiva.mjs` (l'Agenda, con letture finte) e
// `misura-telefono.mjs` (il censimento sul progetto di prova).
//
// ⚠️ Sta in un file solo perché prima viveva dentro la prova visiva, e la
//    seconda prova l'avrebbe ricopiato: due copie dello stesso pilota
//    divergono alla prima correzione.
//
// ⚠️ NESSUNA DIPENDENZA NUOVA: il protocollo DevTools e il WebSocket di
//    Node. Niente Playwright, niente browser scaricati.
// =====================================================================

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));

// =====================================================================
// NESSUNA RICHIESTA ESCE DAL COMPUTER — 27/09/2026
// =====================================================================
// 🔴 PERCHÉ. Le prove visive montano schermate vere con dati finti. Se un
//    alias smette di sostituire il collegamento al database, la schermata
//    torna a usare quello VERO — ed è successo il 26/09, costruendo la
//    prova delle schermate: letture da anonimo, respinte, ma partite.
//
// ⚠️ SI FERMA TUTTO CIÒ CHE NON VA AL SERVER LOCALE DELLA PROVA, non solo
//    Supabase: in CI non c'è `.env`, e il collegamento vero punterebbe
//    all'indirizzo di ripiego (`…invalid`), che una regola su `supabase.co`
//    non riconoscerebbe. Il criterio giusto è l'inverso: è ammesso solo il
//    server Vite su questa macchina.
//
// ⚠️ Si carica PRIMA che la pagina parta (`Page.addScriptToEvaluateOnNewDocument`),
//    quindi ogni copia di `fetch` presa dai moduli è già quella controllata.
//    Il tentativo non parte e si CONTA: una prova che ne trova è rossa.
export const NIENTE_RETE = `(() => {
  window.__tentativiDiRete = 0;
  window.__richiesteFermate = [];
  const ammesso = (u) => {
    try {
      const x = new URL(String(u), location.href);
      if (x.protocol === "data:" || x.protocol === "blob:") return true;
      return x.origin === location.origin || /^(127\\.0\\.0\\.1|localhost|\\[::1\\])$/.test(x.hostname);
    } catch { return false; }
  };
  const ferma = (u) => {
    window.__tentativiDiRete += 1;
    try { window.__richiesteFermate.push(new URL(String(u), location.href).host); } catch { window.__richiesteFermate.push("?"); }
  };
  const fetchVero = window.fetch.bind(window);
  window.fetch = (risorsa, opzioni) => {
    const u = typeof risorsa === "string" || risorsa instanceof URL ? risorsa : risorsa?.url;
    if (!ammesso(u)) { ferma(u); return Promise.reject(new TypeError("rete vietata nella prova visiva")); }
    return fetchVero(risorsa, opzioni);
  };
  const WSVero = window.WebSocket;
  window.WebSocket = function (u, p) {
    if (!ammesso(u)) { ferma(u); throw new Error("rete vietata nella prova visiva"); }
    return new WSVero(u, p);
  };
  window.WebSocket.prototype = WSVero.prototype;
  const apriVero = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (metodo, u, ...resto) {
    if (!ammesso(u)) { ferma(u); throw new Error("rete vietata nella prova visiva"); }
    return apriVero.call(this, metodo, u, ...resto);
  };
  if (navigator.sendBeacon) {
    const beaconVero = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (u, d) => { if (!ammesso(u)) { ferma(u); return false; } return beaconVero(u, d); };
  }
})();`;

// =====================================================================
// IL CARATTERE È QUELLO VERO, O NON SI MISURA — 27/09/2026
// =====================================================================
// 🔴 PERCHÉ. Le prove visive misuravano col carattere di ripiego del
//    sistema (Segoe UI su Windows, un altro su Linux) invece di Inter:
//    stesse schermate, misure diverse — 202 contro 218 punti una casella,
//    849 contro 943 un titolo. Ora le pagine di prova caricano Inter dal
//    server locale (`tests/visive/caratteri/inter.css`), e prima di
//    misurare si pretende che sia davvero lui.
//
// ⚠️ `document.fonts.check()` da solo NON basta: con una famiglia che non
//    ha facce dichiarate risponde `true` lo stesso. Si guarda la faccia:
//    deve essercene UNA sola «Inter» (la nostra), caricata, e il testo
//    della pagina deve chiedere Inter.
export const CARATTERE_PRONTO = `(async () => {
  if (!location.pathname.includes("/tests/visive/")) return { pronta: false };
  try { await Promise.all(["400", "500", "600", "700"].map((p) => document.fonts.load(p + " 16px Inter"))); } catch { /* lo dice lo stato qui sotto */ }
  await document.fonts.ready;
  const facce = [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Inter");
  const stati = facce.map((f) => f.status);
  const famiglia = getComputedStyle(document.body).fontFamily;
  const ok = facce.length === 1 && stati.every((s) => s === "loaded") && /^["']?Inter["']?(,|$)/.test(famiglia);
  return { pronta: true, ok, facce: facce.length, stati, famiglia };
})()`;

/**
 * Pretende Inter locale nella pagina aperta. Se non c'è, FERMA la prova con
 * un messaggio chiaro: misurare un carattere di ripiego darebbe numeri
 * diversi da quelli che vede chi usa il gestionale.
 */
export async function pretendiInter(manda, dove) {
  let r = null;
  for (let i = 0; i < 60; i++) {
    r = (await manda("Runtime.evaluate", { expression: CARATTERE_PRONTO, returnByValue: true, awaitPromise: true }))
      .result.value;
    if (r?.pronta) break;
    await aspetta(250);
  }
  if (!r?.pronta || !r.ok) {
    throw new Error(
      `${dove}: il carattere Inter locale non è caricato (facce Inter: ${r?.facce ?? "?"}, stati: ${
        r?.stati?.join(",") || "?"
      }, testo in: ${r?.famiglia ?? "?"}). La prova si ferma invece di misurare un carattere di ripiego.`,
    );
  }
}

/** Quante richieste la pagina ha provato a mandare fuori (-1: blocco assente). */
export const TENTATIVI_DI_RETE = `({ quanti: window.__tentativiDiRete ?? -1, dove: [...new Set(window.__richiesteFermate ?? [])] })`;

/**
 * Una cartella d'ambiente VUOTA per il server Vite delle prove: senza, in
 * locale Vite leggerebbe `.env` e la schermata conoscerebbe l'indirizzo e
 * la chiave del database vero; in CI no. Con questa, le due situazioni
 * sono identiche — nessun indirizzo, nessuna chiave.
 */
export function cartellaSenzaAmbiente() {
  return mkdtempSync(path.join(os.tmpdir(), "b58-visiva-senza-env-"));
}

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
    console.error("Non trovo Chrome su questo computer: questa prova ne ha bisogno (variabile CHROME).");
    process.exit(2);
  }
  return trovato;
}

/**
 * `senzaRete`: Chrome non risolve nessun nome tranne il server locale. Lo
 * accendono le prove visive (dati finti); NON `misura-telefono.mjs`, che
 * deve raggiungere il progetto di prova.
 */
export async function avviaChrome({ senzaRete = false } = {}) {
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
      // 🔴 LA SECONDA BARRIERA — 27/09/2026: nessun nome si risolve tranne
      //    il server locale. Se un giorno il blocco dentro la pagina
      //    (`NIENTE_RETE`) mancasse, una richiesta verso Supabase — o verso
      //    qualunque altro server — non troverebbe l'indirizzo e non
      //    partirebbe comunque. Le prove visive non hanno bisogno di rete.
      ...(senzaRete ? ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"] : []),
      `--remote-debugging-port=${porta}`,
      `--user-data-dir=${profilo}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (r.ok) {
        const chiudi = () => {
          // 🔴 SU WINDOWS `kill()` CHIUDE SOLO IL PROCESSO PRINCIPALE — 11/09,
          //    misurato: dopo una notte di prove erano rimasti 96 processi di
          //    Chrome per quasi 13 GB, e il sistema ha fermato il censimento
          //    per mancanza di memoria. I figli (le schede, la grafica) si
          //    chiudono solo chiudendo l'albero intero.
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
          }
          chrome.kill();
          try {
            rmSync(profilo, { recursive: true, force: true });
          } catch {
            /* Chrome può tenere il profilo per un istante */
          }
        };
        return { chrome, porta, profilo, chiudi };
      }
    } catch {
      /* non ancora pronto */
    }
    await aspetta(250);
  }
  chrome.kill();
  throw new Error("Chrome non ha aperto il canale di controllo entro 15 secondi.");
}

export async function apriScheda(porta) {
  const r = await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: "PUT" });
  const bersaglio = await r.json();
  const ws = new WebSocket(bersaglio.webSocketDebuggerUrl);
  await new Promise((ok, ko) => {
    ws.onopen = ok;
    ws.onerror = ko;
  });
  let id = 0;
  const attese = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && attese.has(d.id)) {
      const { ok, ko } = attese.get(d.id);
      attese.delete(d.id);
      if (d.error) ko(new Error(d.error.message));
      else ok(d.result);
    }
  };
  const manda = (method, params = {}) =>
    new Promise((ok, ko) => {
      const mio = ++id;
      attese.set(mio, { ok, ko });
      ws.send(JSON.stringify({ id: mio, method, params }));
    });
  return { ws, manda };
}

export const valuta = async (manda, espressione) =>
  (await manda("Runtime.evaluate", { expression: espressione, returnByValue: true, awaitPromise: true })).result
    .value;

/**
 * Una scheda alla forma data (larghezza, densità, telefono o no), con il
 * codice `primaDiPartire` eseguito prima di ogni pagina — è lì che si
 * scrive la memoria del browser (calibrazione dei centimetri, sessione).
 */
export async function apriPagina(porta, forma, url, primaDiPartire = "") {
  const { ws, manda } = await apriScheda(porta);
  await manda("Page.enable");
  await manda("Runtime.enable");
  await manda("Emulation.setDeviceMetricsOverride", {
    width: forma.larghezza,
    height: forma.altezza,
    deviceScaleFactor: forma.scala,
    mobile: forma.mobile,
  });
  // Col telefono il tocco è un tocco vero: senza, Chrome manda eventi del
  // mouse anche dove un dito non ne manderebbe.
  if (forma.mobile) await manda("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // La calibrazione dei centimetri sta nella memoria del browser: si scrive
  // PRIMA che la pagina parta, come la troverebbe su un telefono calibrato.
  // ⚠️ E SI TOGLIE quando la forma non ne ha una: la memoria è condivisa fra
  //    le schede dello stesso Chrome, e la prima stesura della prova visiva
  //    ha fatto girare il «computer» a 64 punti per cm senza dirlo.
  const calibrazione = forma.pxcm
    ? `localStorage.setItem("b58_pxcm", "${forma.pxcm}");`
    : `localStorage.removeItem("b58_pxcm");`;
  await manda("Page.addScriptToEvaluateOnNewDocument", { source: calibrazione + primaDiPartire });
  await manda("Page.navigate", { url });
  return { ws, manda };
}

export async function fotografa(manda, dove) {
  // La fotografia è un di più: se non arriva, la misura resta valida.
  try {
    const foto = await Promise.race([
      manda("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }),
      aspetta(15000).then(() => null),
    ]);
    if (foto?.data) {
      writeFileSync(dove, Buffer.from(foto.data, "base64"));
      return dove;
    }
  } catch {
    /* niente fotografia: la misura resta quella */
  }
  return null;
}

export const nomeFile = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
