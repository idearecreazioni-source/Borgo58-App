// LA CODA DI CASA NEL TELEFONO — IndexedDB, senza librerie.
//
// Le decisioni (cosa mandare, quando, cosa vuol dire arrivata) stanno in
// src/lib/calcoli/codaCasa.js; qui si conserva e si legge soltanto.
//
// ⚠️ DUE CASSETTI: «voci» (leggere: chiave, stato, errore) e «foto» (i byte).
// La spia nella fascia e il giro d'invio leggono solo le voci; i byte si
// leggono uno alla volta, quando servono (revisione ecc:code-reviewer: con
// tante foto in coda leggere tutto a ogni minuto pesava sulla memoria).
//
// ⚠️ La foto si conserva come ArrayBuffer e non come Blob: Safari su iPhone
// ha avuto per anni Blob che sparivano da IndexedDB, mentre i byte restano.
//
// ⚠️ La prima volta che una foto entra in coda si chiede al telefono di non
// cancellare questi dati quando la memoria scarseggia
// (navigator.storage.persist): un'app sulla schermata Home di solito lo
// ottiene.

const NOME_DB = "casa-coda";
const VERSIONE_DB = 2;
const VOCI = "voci";
const FOTO = "foto";
export const EVENTO = "casa-coda-cambiata";

let aperto = null;
function apri() {
  if (aperto) return aperto;
  aperto = new Promise((risolvi, rifiuta) => {
    const r = indexedDB.open(NOME_DB, VERSIONE_DB);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(VOCI)) db.createObjectStore(VOCI, { keyPath: "chiave" });
      if (!db.objectStoreNames.contains(FOTO)) db.createObjectStore(FOTO);
    };
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => {
      aperto = null;
      rifiuta(r.error);
    };
  });
  return aperto;
}

function transazione(cassetti, modo, lavoro) {
  return apri().then(
    (db) =>
      new Promise((risolvi, rifiuta) => {
        const t = db.transaction(cassetti, modo);
        const esito = lavoro((nome) => t.objectStore(nome));
        t.oncomplete = () => risolvi(esito?.result ?? esito);
        t.onerror = () => rifiuta(t.error);
        t.onabort = () => rifiuta(t.error);
      })
  );
}

/** Avvisa chi mostra la coda (la spia, la pagina) che qualcosa e' cambiato. */
const avvisa = () => window.dispatchEvent(new Event(EVENTO));

/** Le voci, senza i byte delle foto. */
export async function tutteLeVoci() {
  return (await transazione([VOCI], "readonly", (s) => s(VOCI).getAll())) ?? [];
}

/** I byte di una foto ({ byte, tipo }), o null se non c'e' piu'. */
export async function fotoDi(chiave) {
  return (await transazione([FOTO], "readonly", (s) => s(FOTO).get(chiave))) ?? null;
}

/**
 * Salva una voce. Se porta la foto, la foto va nel suo cassetto; se la
 * foto e' `null` (arrivata), dal cassetto si toglie.
 */
export async function salvaVoce(voce) {
  const { foto, ...leggera } = voce;
  await transazione([VOCI, FOTO], "readwrite", (s) => {
    s(VOCI).put(leggera);
    if (foto) s(FOTO).put(foto, voce.chiave);
    else if (foto === null) s(FOTO).delete(voce.chiave);
  });
  avvisa();
}

export async function togliVoci(chiavi) {
  if (!chiavi.length) return;
  await transazione([VOCI, FOTO], "readwrite", (s) =>
    chiavi.forEach((k) => {
      s(VOCI).delete(k);
      s(FOTO).delete(k);
    })
  );
  avvisa();
}

let persistenzaChiesta = false;
export async function chiediDiTenereIDati() {
  if (persistenzaChiesta || !navigator.storage?.persist) return;
  persistenzaChiesta = true;
  try {
    await navigator.storage.persist();
  } catch {
    // Se il telefono dice no, la coda funziona lo stesso.
  }
}
