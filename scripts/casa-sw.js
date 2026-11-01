// IL SERVICE WORKER DI CASA — modello. `casa:impacchetta` lo copia in
// C:\Casa\sito\sw-casa.js mettendo al posto dei due segnaposto la versione e
// l'elenco dei file dell'app. Non esiste nel sito del locale.
//
// Cosa fa: tiene l'app dentro il telefono, cosi' Casa si apre anche senza
// rete (la coda delle foto, fase 4).
//  · i file dell'app (/assets, icone, manifest): dalla memoria, sempre;
//  · le pagine: prima la rete (cosi' una versione nuova arriva), e se la rete
//    non risponde entro 4 secondi, la pagina tenuta in memoria;
//  · il database (/rest, /auth, /storage, /functions, /realtime): MAI dalla
//    memoria. Un dato vecchio scambiato per vero sarebbe peggio di un errore.
/* global self, caches, fetch, URL, Response */

const VERSIONE = "__VERSIONE__";
const ELENCO = JSON.parse("__ELENCO__");
const MEMORIA = `casa-${VERSIONE}`;
const DATABASE = /^\/(rest|auth|storage|functions|graphql|realtime)\/v1(\/|$)/;

// ⚠️ Niente skipWaiting (revisione ecc:code-reviewer, 31/10): una versione
// nuova prende il posto della vecchia solo quando l'app e' stata chiusa. Se
// subentrasse con l'app aperta, butterebbe la memoria della vecchia mentre la
// pagina ancora ne chiede i pezzi. Il gestionale gia' dice quando c'e' una
// versione nuova (src/lib/versione.js).
// I file si chiedono «freschi» (cache: reload): non dalla memoria del browser.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(MEMORIA).then((m) => m.addAll(ELENCO.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n.startsWith("casa-") && n !== MEMORIA).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function conTempo(promessa, ms) {
  return new Promise((risolvi, rifiuta) => {
    const t = setTimeout(() => rifiuta(new Error("tempo scaduto")), ms);
    promessa.then(
      (r) => {
        clearTimeout(t);
        risolvi(r);
      },
      (e) => {
        clearTimeout(t);
        rifiuta(e);
      }
    );
  });
}

self.addEventListener("fetch", (e) => {
  const richiesta = e.request;
  if (richiesta.method !== "GET") return;
  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin || DATABASE.test(url.pathname)) return;

  if (richiesta.mode === "navigate") {
    const dallaMemoria = () =>
      caches.match("/index.html").then((r) => r || new Response("Casa non risponde, e l'app non e' ancora nel telefono.", { status: 503 }));
    // Anche un 502/503 (Tailscale c'e', il PC no) vale come «Casa non risponde».
    e.respondWith(
      conTempo(fetch(richiesta), 4000)
        .then((r) => (r.status >= 500 ? dallaMemoria() : r))
        .catch(dallaMemoria)
    );
    return;
  }

  e.respondWith(
    caches.match(richiesta).then(
      (inMemoria) =>
        inMemoria ||
        fetch(richiesta).then((risposta) => {
          // ⚠️ Mai una pagina HTML sotto /assets: avvelenerebbe la memoria.
          const html = (risposta.headers.get("content-type") || "").includes("text/html");
          if (risposta.ok && !html && url.pathname.startsWith("/assets/")) {
            const copia = risposta.clone();
            caches.open(MEMORIA).then((m) => m.put(richiesta, copia));
          }
          return risposta;
        })
    )
  );
});
