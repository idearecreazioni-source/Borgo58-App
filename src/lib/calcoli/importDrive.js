// L'IMPORT DAL DRIVE — la logica pura (22/11/2026, pezzo C2).
//
// 🔴 IL CSV È LA MAPPA. Alessio ha deciso nel Drive, riga per riga, che cosa entra nel gestionale («sì») e che cosa
//    resta solo in elenco («no (solo elenco)»). La pagina non decide niente da sola: un file scelto passa solo se il
//    suo nome combacia con una riga «sì»; un file che la mappa non conosce, o che la mappa dice «solo elenco», si
//    RIFIUTA a voce alta. Mai un file importato in silenzio, mai un file scartato in silenzio.
//
// ⚠️ NIENTE QUI DENTRO TOCCA IL DATABASE O UN MODELLO: sono funzioni pure, provate con righe inventate (il repo è
//    pubblico, i nomi veri dei file non ci stanno).

// ---------------------------------------------------------------------
// 1. Il CSV
// ---------------------------------------------------------------------
// Separatore virgola, virgolette doppie, «""» dentro le virgolette = una virgoletta, righe che vanno a capo dentro
// le virgolette, BOM all'inizio (Excel e il Drive lo mettono). Restituisce un array di righe di celle.
// ⚠️ Una virgoletta aperta e mai chiusa NON si perdona: tutto il resto del file finirebbe dentro una sola cella e la
//    mappa sembrerebbe «più corta» senza dire niente. `leggiCsvConErrore` lo dice; `leggiCsv` resta per chi vuole solo le righe.
export function leggiCsv(testo) {
  return leggiCsvConErrore(testo).righe;
}

export function leggiCsvConErrore(testo) {
  const t = String(testo ?? "").replace(/^﻿/, "");
  const righe = [];
  let riga = [];
  let cella = "";
  let tra = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tra) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cella += '"';
          i++;
        } else tra = false;
      } else cella += c;
    } else if (c === '"') tra = true;
    else if (c === ",") {
      riga.push(cella);
      cella = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      riga.push(cella);
      cella = "";
      righe.push(riga);
      riga = [];
    } else cella += c;
  }
  if (cella !== "" || riga.length > 0) {
    riga.push(cella);
    righe.push(riga);
  }
  return { righe: righe.filter((r) => r.some((x) => x.trim() !== "")), virgoletteAperte: tra };
}

// ---------------------------------------------------------------------
// 2. I nomi
// ---------------------------------------------------------------------
// Il confronto fra il nome del file scelto e quello della mappa: NFC (un «è» scritto in due pezzi dal Mac è lo
// stesso «è»), minuscole, apostrofi e trattini «tipografici» come quelli normali, spazi ripetuti ridotti a uno.
// Gli accenti NON si tolgono: «è» e «e» sono due nomi diversi.
export function normalizzaNome(nome) {
  return String(nome ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Il testo per confrontare una sezione o una cartella: in più senza accenti.
export function normalizzaTesto(t) {
  return normalizzaNome(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function titoloDaNome(nome) {
  return String(nome ?? "").normalize("NFC").replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------
// 3. Le date
// ---------------------------------------------------------------------
// «02/11/2026 (nome)»: la data sta nel nome del file, è sicura. «10/10/2026 (modifica)»: è l'ultima modifica del
// file, non la data del documento: va bene come punto di partenza ma si segnala «da verificare». Vuota o illeggibile:
// non c'è, e il documento non entra finché non la scrivi (il database pretende sezione e data insieme).
export function leggiDataCsv(testo) {
  const t = String(testo ?? "").trim();
  const m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return { iso: null, daVerificare: true, origine: null };
  const g = Number(m[1]);
  const me = Number(m[2]);
  const a = Number(m[3]);
  const prova = new Date(Date.UTC(a, me - 1, g));
  if (prova.getUTCFullYear() !== a || prova.getUTCMonth() !== me - 1 || prova.getUTCDate() !== g) {
    return { iso: null, daVerificare: true, origine: null };
  }
  const origine = /\(\s*nome\s*\)/i.test(t) ? "nome" : /\(\s*modifica\s*\)/i.test(t) ? "modifica" : null;
  return {
    iso: `${String(a).padStart(4, "0")}-${String(me).padStart(2, "0")}-${String(g).padStart(2, "0")}`,
    daVerificare: origine !== "nome",
    origine,
  };
}

// ---------------------------------------------------------------------
// 4. La mappa
// ---------------------------------------------------------------------
export const CSV_MAX_BYTE = 2 * 1024 * 1024;
const CELLA_MAX = 1000;
const COLONNE = ["caricare", "nome", "cartella", "formato", "mb", "data", "tipo", "sezione", "sensibile", "no_ai", "link"];

// «sì — IBAN» → «IBAN»; «sì» e basta, o «no», → nessuna nota. La nota è informativa e il database la vuole lunga al
// massimo 80 caratteri.
export function notaSensibile(testo) {
  let t = String(testo ?? "").trim();
  if (!t || /^no\b/i.test(t)) return null;
  // ⚠️ Niente `\b` dopo «ì»: per le espressioni regolari una lettera accentata non è una «parola», e il confine non c'è.
  t = t.replace(/^s[iì](?![\p{L}])\s*[—–-]?\s*/iu, "").trim();
  return (t || "riservato").slice(0, 80);
}

function numeroMb(testo) {
  const n = Number(String(testo ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Una riga della mappa. `entra`: «sì». Ogni altra cosa («no (solo elenco)», vuoto, un refuso) NON entra.
export function leggiMappa(testoCsv) {
  const { righe, virgoletteAperte } = leggiCsvConErrore(testoCsv);
  if (virgoletteAperte) {
    return { ok: false, errore: "Nel file della mappa c'è una virgoletta aperta e mai chiusa: controlla il file e riprova.", righe: [] };
  }
  if (righe.length === 0) return { ok: false, errore: "Il file della mappa è vuoto.", righe: [] };
  if (righe[0].length === 1 && /[;	]/.test(righe[0][0])) {
    return { ok: false, errore: "Il separatore del file della mappa deve essere la virgola (qui sembra un punto e virgola o una tabulazione).", righe: [] };
  }
  const lunga = righe.findIndex((r) => r.some((c) => c.length > CELLA_MAX));
  if (lunga >= 0) {
    return { ok: false, errore: `Nella riga ${lunga + 1} del file della mappa c'è una cella lunghissima (oltre ${CELLA_MAX} caratteri): non è la mappa giusta, o è rovinata.`, righe: [] };
  }
  const intestazione = righe[0].map((c) => normalizzaTesto(c).replace(/ /g, "_"));
  const col = Object.fromEntries(COLONNE.map((nome) => [nome, intestazione.indexOf(nome)]));
  const mancanti = ["caricare", "nome", "sezione", "link"].filter((nome) => col[nome] < 0);
  if (mancanti.length > 0) {
    return {
      ok: false,
      errore: `Questo non sembra il file della mappa: mancano le colonne ${mancanti.map((m) => `«${m}»`).join(", ")}.`,
      righe: [],
    };
  }
  const cella = (r, nome) => (col[nome] >= 0 ? (r[col[nome]] ?? "").trim() : "");
  const mappa = righe.slice(1).map((r, i) => {
    const caricare = cella(r, "caricare");
    const data = leggiDataCsv(cella(r, "data"));
    return {
      riga: i + 2,
      entra: /^s[iì]$/i.test(caricare),
      nome: cella(r, "nome"),
      cartella: cella(r, "cartella"),
      formato: cella(r, "formato") || null,
      mb: numeroMb(cella(r, "mb")),
      data,
      sezione: cella(r, "sezione"),
      sensibile: notaSensibile(cella(r, "sensibile")),
      link: cella(r, "link"),
    };
  }).filter((r) => r.nome !== "");
  return { ok: true, errore: null, righe: mappa };
}

// Il codice sezione dal testo della mappa: combacia con il CODICE («contratti») o con l'ETICHETTA («Progetto e
// planimetrie») di una sezione ATTIVA, senza badare a maiuscole e accenti. Altrimenti null: la pagina lo mostra come
// errore da scegliere a mano, non indovina.
export function codiceSezione(testo, sezioni) {
  const t = normalizzaTesto(testo);
  if (!t) return null;
  const trovata = (sezioni ?? []).find(
    (s) => s.attiva !== false && (normalizzaTesto(s.codice) === t || normalizzaTesto(s.etichetta) === t)
  );
  return trovata ? trovata.codice : null;
}

// ---------------------------------------------------------------------
// 5. Abbinare i file scelti alla mappa
// ---------------------------------------------------------------------
// Per ogni file: «ok» (una riga «sì»), «rifiutato» (la mappa non lo conosce o lo vuole solo in elenco) o «da scegliere»
// (più righe con lo stesso nome che la cartella non distingue: lo dice la pagina, e si sceglie a mano).
//
// ⚠️ La cartella del Drive («10 — Lavoro/…/01_SOCIETA_E_AMMINISTRAZIONE») non è quella sul computer («01_contratti»):
//    non si confrontano. Per distinguere due righe con lo stesso nome si guarda se un pezzo del percorso locale del
//    file compare nella cartella della mappa; se non basta, si chiede.
function pezziPercorso(file) {
  const p = String(file.webkitRelativePath || file.percorso || "");
  return p
    .split("/")
    .slice(0, -1)
    .map(normalizzaTesto)
    .filter(Boolean);
}

export function abbinaFile(file, righeMappa) {
  const nome = normalizzaNome(file.name);
  const candidate = righeMappa.filter((r) => normalizzaNome(r.nome) === nome);
  if (candidate.length === 0) {
    return { esito: "rifiutato", motivo: "La mappa non conosce questo file: non lo importo.", riga: null };
  }
  let scelte = candidate;
  if (candidate.length > 1) {
    const pezzi = pezziPercorso(file);
    const perCartella = candidate.filter((r) => {
      const cartella = normalizzaTesto(r.cartella);
      return pezzi.some((p) => p && cartella.includes(p));
    });
    if (perCartella.length >= 1 && perCartella.length < candidate.length) scelte = perCartella;
  }
  if (scelte.length > 1) {
    return {
      esito: "da_scegliere",
      motivo: "La mappa ha più righe con questo nome: scegli quale è.",
      candidate: scelte,
      riga: null,
    };
  }
  const riga = scelte[0];
  if (!riga.entra) {
    return {
      esito: "rifiutato",
      motivo: "La mappa lo tiene solo in elenco (non lo importo come documento).",
      riga,
    };
  }
  return { esito: "ok", motivo: null, riga };
}

// ---------------------------------------------------------------------
// 6. L'anteprima
// ---------------------------------------------------------------------
// Una riga dell'anteprima per ogni file «ok». I problemi sono parole, non codici, e una riga con un problema non è
// selezionata finché non si risolve.
export function rigaAnteprima({ file, riga, sezioni }) {
  const codice = codiceSezione(riga.sezione, sezioni);
  return {
    chiave: chiaveFile(file),
    file,
    nome: file.name,
    titolo: titoloDaNome(file.name),
    sezione: codice ?? "",
    sezioneMappa: riga.sezione,
    data: riga.data.iso ?? "",
    dataDaVerificare: riga.data.daVerificare,
    dataOrigine: riga.data.origine,
    sensibile: riga.sensibile,
    noAi: false,
    mb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
    impronta: null,
    improntaFallita: false,
    doppione: null,
    avviso: null,
    link: riga.link,
    selezionato: true,
  };
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// I problemi che impediscono l'import di una riga. Lista vuota = pronta.
export function problemiRiga(r, sezioni) {
  const problemi = [];
  if (!r.titolo.trim()) problemi.push("manca il titolo");
  if (!r.sezione || !(sezioni ?? []).some((s) => s.codice === r.sezione && s.attiva !== false)) {
    problemi.push(r.sezioneMappa ? `la sezione «${r.sezioneMappa}» non esiste: scegline una` : "scegli la sezione");
  }
  if (!DATA_ISO.test(r.data ?? "") || Number.isNaN(Date.parse(r.data))) problemi.push("manca la data del documento");
  if (!r.file || r.file.size === 0) problemi.push("il file è vuoto");
  return problemi;
}

// Doppioni: l'impronta è già in Archivio (`gia`: mappa impronta → titolo) o compare due volte fra i file scelti.
export function segnaDoppioni(righe, gia = new Map()) {
  const viste = new Map();
  return righe.map((r) => {
    let doppione = null;
    if (r.impronta) {
      if (gia.has(r.impronta)) doppione = `Già in Archivio come «${gia.get(r.impronta)}».`;
      else if (viste.has(r.impronta)) doppione = `Stesso file di «${viste.get(r.impronta)}», scelto due volte.`;
      else viste.set(r.impronta, r.nome);
    }
    return { ...r, doppione };
  });
}

// ---------------------------------------------------------------------
// 7. L'elenco del Drive (le righe «solo elenco»)
// ---------------------------------------------------------------------
// Le righe che non entrano come documenti. Il database vuole un link https lungo al massimo 500 caratteri e uno solo
// per file: i link già presenti si saltano, quelli non validi si contano a parte (e si dicono).
export function righeElenco(righeMappa, linkGiaPresenti = new Set()) {
  const nuove = [];
  const presenti = [];
  const senzaLink = [];
  const viste = new Set();
  for (const r of righeMappa.filter((x) => !x.entra)) {
    if (!/^https:\/\//.test(r.link) || r.link.length > 500) {
      senzaLink.push(r);
      continue;
    }
    if (linkGiaPresenti.has(r.link) || viste.has(r.link)) {
      presenti.push(r);
      continue;
    }
    viste.add(r.link);
    nuove.push(r);
  }
  return { nuove, presenti, senzaLink };
}

export function rigaPerElencoDrive(r) {
  return {
    nome: r.nome,
    cartella: r.cartella,
    sezione: r.sezione || null,
    data_documento: r.data.iso,
    link: r.link,
    formato: r.formato,
    mb: r.mb,
    sensibile: r.sensibile,
    no_ai: false,
  };
}

// ---------------------------------------------------------------------
// 8. L'impronta del file (SHA-256), nel browser
// ---------------------------------------------------------------------
function leggiByte(file) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const lettore = new FileReader();
    lettore.onload = () => resolve(lettore.result);
    lettore.onerror = () => reject(lettore.error);
    lettore.readAsArrayBuffer(file);
  });
}

// Il testo di un file (la mappa), come UTF-8. `text()` dove c'è, il lettore di file dove non c'è.
export async function leggiTestoFile(file) {
  if (typeof file.text === "function") return file.text();
  return new TextDecoder("utf-8").decode(await leggiByte(file));
}

export async function improntaFile(file) {
  const byte = await leggiByte(file);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", byte);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------
// 9. Prima di caricare: il file ci sta, ed è del tipo che ci si aspetta?
// ---------------------------------------------------------------------
// ⚠️ IL LIMITE REALE DEL DEPOSITO NON SI LEGGE DA QUI: il bucket «documents» non dichiara un tetto proprio (lo eredita
//    dal progetto) e il tetto del progetto di work non è leggibile dal database. 50 MB è il valore standard di
//    Supabase: se work ne avesse uno più basso, il rifiuto lo dà comunque il deposito e la pagina lo mostra com'è.
export const LIMITE_FILE_MB = 50;
const ESTENSIONI_STRANE = new Set(["html", "htm", "svg", "js", "mjs", "exe", "msi", "bat", "cmd", "com", "scr", "sh", "ps1", "jar", "apk", "dmg", "vbs", "lnk"]);

export function controllaFile(file) {
  const mb = file.size / (1024 * 1024);
  if (mb > LIMITE_FILE_MB) {
    return { rifiuto: `Pesa ${Math.round(mb * 10) / 10} MB: il deposito accetta al massimo ${LIMITE_FILE_MB} MB per file.`, avviso: null };
  }
  const estensione = String(file.name ?? "").toLowerCase().match(/.([a-z0-9]{1,6})$/)?.[1] ?? "";
  if (ESTENSIONI_STRANE.has(estensione)) {
    return { rifiuto: null, avviso: `Un file «.${estensione}» è insolito in un archivio di documenti (può contenere programmi o pagine web): importalo solo se sei sicuro.` };
  }
  return { rifiuto: null, avviso: null };
}

// La chiave di un file scelto: con il percorso, perché due cartelle diverse possono avere un file con lo stesso nome,
// la stessa dimensione e la stessa data.
export function chiaveFile(f) {
  return `${f.webkitRelativePath || ""}|${f.name}#${f.size}#${f.lastModified ?? 0}`;
}
