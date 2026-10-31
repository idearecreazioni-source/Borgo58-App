// IL SERVER DI CASA — `npm run casa:sito` (lo accende anche casa:accendi)
//
// Un solo indirizzo per app e database: Tailscale porta
// https://<pc>.ts.net:8443 qui, e qui
//  · /rest/v1, /auth/v1, /storage/v1, /functions/v1, /graphql/v1 e
//    /realtime/v1 (anche il canale WebSocket) passano a Supabase di Casa;
//  · tutto il resto e' l'app costruita da casa:impacchetta (C:\Casa\sito),
//    con index.html per le rotte del gestionale.
//
// ⚠️ Ascolta SOLO su 127.0.0.1: dalla rete di casa non si raggiunge (e la
// porta sta comunque nel blocco chiuso dal firewall). Da fuori si arriva
// solo da Tailscale. E risponde SOLO a chi lo chiama col nome di Casa: un
// altro nome — anche 127.0.0.1 o localhost, cioe' un altro sito aperto nel
// browser del PC — e' un rifiuto (difesa dal «DNS rebinding»).
//
// ⚠️ Non deve fermarsi da solo: lo riaccende solo il prossimo accesso al
// PC. Un errore su una richiesta chiude quella richiesta, non il server.
//
// Solo moduli di Node: gira dalla copia stabile C:\Casa\gestionale, che non
// ha node_modules.

import { createReadStream, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { connect } from "node:net";
import path from "node:path";
import { PORTA_API_CASA } from "./comune.mjs";
import { CARTELLA, PORTA_HTTPS_CASA, PORTA_SITO_CASA, nomeTailscaleSeCe } from "./casa-comune.mjs";

const SITO = path.resolve(CARTELLA, "sito");
const API = { host: "127.0.0.1", port: Number(PORTA_API_CASA) };
const VERSO_SUPABASE = /^\/(rest|auth|storage|functions|graphql|realtime)\/v1(\/|\?|$)/;
// Un percorso verso Supabase non puo' risalire: Kong potrebbe normalizzarlo
// verso strade che il controllo qui sopra non ha visto.
const RISALE = /\.\.|%2e|%2f|%5c|\\/i;

// ⚠️ Il nome si legge alla prima richiesta, non all'avvio: all'accesso al
// PC Tailscale puo' partire dopo questo server.
let nomiAmmessi = null;
function servitoDaCasa(req) {
  if (!nomiAmmessi) {
    const nome = nomeTailscaleSeCe();
    if (!nome) return false;
    nomiAmmessi = new Set([`${nome}:${PORTA_HTTPS_CASA}`, nome]);
  }
  return nomiAmmessi.has(String(req.headers.host || "").toLowerCase());
}

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const SICUREZZA = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
};

/** Passa la richiesta a Supabase di Casa, intestazioni e corpo compresi. */
function aSupabase(req, res) {
  const verso = request(
    { ...API, method: req.method, path: req.url, headers: { ...req.headers, "x-forwarded-proto": "https" } },
    (risposta) => {
      res.writeHead(risposta.statusCode || 502, risposta.headers);
      risposta.pipe(res);
    }
  );
  verso.on("error", () => {
    // A risposta gia' cominciata non si aggiunge testo: si chiude e basta.
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Supabase di Casa non risponde: e' acceso? (npm run casa:accendi)");
  });
  // Se il telefono chiude prima, si chiude anche la richiesta verso Supabase.
  res.on("close", () => verso.destroy());
  req.pipe(verso);
}

const fileDi = (percorso) => {
  try {
    return statSync(percorso).isFile();
  } catch {
    return false;
  }
};

/** Un file dell'app, o index.html per le rotte del gestionale. */
function dallApp(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, SICUREZZA).end();
    return;
  }
  let percorso;
  try {
    percorso = decodeURIComponent(new URL(req.url, "http://casa").pathname);
  } catch {
    res.writeHead(400, SICUREZZA).end();
    return;
  }
  // ⚠️ Mai fuori da C:\Casa\sito, nemmeno con «..» o percorsi strani.
  let file = path.resolve(SITO, "." + percorso);
  if (file !== SITO && !file.startsWith(SITO + path.sep)) {
    res.writeHead(403, SICUREZZA).end();
    return;
  }
  if (!fileDi(file)) {
    // ⚠️ Un FILE che manca (un /assets/vecchio.js dopo un aggiornamento) e'
    // un 404 vero: rispondere con index.html farebbe fallire il modulo con
    // un errore di tipo che non dice niente. Solo le ROTTE, senza
    // estensione, ricevono la pagina del gestionale.
    if (path.extname(percorso)) {
      res.writeHead(404, SICUREZZA).end();
      return;
    }
    file = path.join(SITO, "index.html");
  }
  if (!fileDi(file)) {
    res.writeHead(503, { ...SICUREZZA, "Content-Type": "text/plain; charset=utf-8" });
    res.end("L'app di Casa non c'e' ancora: npm run casa:impacchetta");
    return;
  }
  const tipo = TIPI[path.extname(file).toLowerCase()] || "application/octet-stream";
  // I file in /assets hanno l'impronta nel nome: si tengono un anno. Il
  // resto (index.html, manifest, icone) si richiede ogni volta, cosi' una
  // versione nuova di Casa arriva subito.
  const cache = file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { ...SICUREZZA, "Content-Type": tipo, "Cache-Control": cache });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  // Un file che sparisce a meta' lettura (un aggiornamento in corso) chiude
  // questa risposta, non il server.
  createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res);
}

const server = createServer((req, res) => {
  if (!servitoDaCasa(req)) {
    res.writeHead(421, SICUREZZA).end();
    return;
  }
  if (VERSO_SUPABASE.test(req.url || "")) {
    if (RISALE.test(req.url)) {
      res.writeHead(400, SICUREZZA).end();
      return;
    }
    aSupabase(req, res);
  } else {
    dallApp(req, res);
  }
});
// Una richiesta che non finisce mai di arrivare non tiene occupato il server.
server.requestTimeout = 120_000;

// Il canale in tempo reale (WebSocket) di /realtime/v1: si apre un tubo
// verso Supabase e si ripete la richiesta d'apertura cosi' com'e'.
server.on("upgrade", (req, socket, testa) => {
  if (!servitoDaCasa(req) || !/^\/realtime\/v1\//.test(req.url || "") || RISALE.test(req.url)) {
    socket.destroy();
    return;
  }
  const tubo = connect(API.port, API.host, () => {
    const righe = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) righe.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    tubo.write(righe.join("\r\n") + "\r\n\r\n");
    if (testa?.length) tubo.write(testa);
    tubo.pipe(socket);
    socket.pipe(tubo);
  });
  const chiudi = () => {
    tubo.destroy();
    socket.destroy();
  };
  tubo.on("error", chiudi);
  socket.on("error", chiudi);
});

server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? `La porta ${PORTA_SITO_CASA} e' gia' occupata: il server di Casa e' gia' acceso?`
      : `Il server di Casa si e' fermato: ${e.message}`
  );
  process.exit(1);
});

// L'ultima rete: un errore che sfugge si scrive nel registro e il server
// resta acceso.
process.on("uncaughtException", (e) => {
  console.error(`${new Date().toISOString()}  errore non previsto: ${e?.stack || e}`);
});

server.listen(PORTA_SITO_CASA, "127.0.0.1", () => {
  console.log(`${new Date().toISOString()}  Casa: server acceso su 127.0.0.1:${PORTA_SITO_CASA} (app da ${SITO}).`);
});
