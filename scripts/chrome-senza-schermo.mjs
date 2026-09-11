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

export async function avviaChrome() {
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
