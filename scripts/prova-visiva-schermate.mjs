// =====================================================================
// LE SCHERMATE VERE, MISURATE IN CHROME — 26/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Il secondo giro del censimento visivo ha trovato, a 360
//    punti, difetti che nessuna prova poteva vedere: le prove di schermata
//    girano senza impaginazione (jsdom), dove ogni elemento misura zero.
//    Qui si montano le schermate VERE (`tests/visive/schermate/`), col
//    collegamento al database finto, e le si misura in un Chrome senza
//    schermo, in punti e in centimetri veri, a sei larghezze:
//
//      telefono 360, 390 e 430 (a 60 punti per cm, un telefono vero),
//      tablet 768 (a 64), computer 1280 e 1920.
//
// COSA SI CONFRONTA, e perché ognuna diventerebbe rossa
//   · ogni schermata: la pagina non scorre di lato;
//   · Dashboard: «Agenda completa →» sta dentro lo schermo; il titolo di un
//     impegno prende almeno metà della riga sul telefono, e la priorità gli
//     sta accanto da 640 punti in su; la categoria si legge a parole, non
//     col codice; «Non adesso» sta sotto il testo sul telefono e accanto
//     dal tablet in su (il giro del 25/09, qui misurato davvero);
//   · Agenda: la spunta «fatto» è larga almeno quanto un pulsante e dice
//     quale impegno chiude;
//   · Prima nota: la nota è un campo in cui si scrive — alta quanto gli
//     altri e larga almeno 3 cm — e «Registra» resta dentro lo schermo;
//   · Causali e Sala e orari: le «✕» sono quadrati da dito e hanno un nome
//     che dice cosa fanno;
//   · Spesa spicciola: il collegamento alla lista della spesa è alto almeno
//     5,3 mm (la misura provata col dito il 18/08);
//   · scheda di un ingrediente: le due provenienze dicono quale è scelta;
//   · Archivio: i documenti in scadenza si toccano come i pulsanti.
//
// ⚠️ NESSUNA DIPENDENZA NUOVA: lo stesso pilota di Chrome della prova
//    visiva dell'Agenda (`chrome-senza-schermo.mjs`).
//
// Uso: `npm run test:visive` (gira dopo la prova dell'Agenda).
// =====================================================================

import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import {
  apriPagina as apriPaginaChrome,
  aspetta,
  avviaChrome,
  fotografa as fotografaChrome,
  cartellaSenzaAmbiente,
  NIENTE_RETE,
  nomeFile,
  pretendiInter,
  valuta,
} from "./chrome-senza-schermo.mjs";

const RADICE = process.cwd();

/** Le misure del progetto, in centimetri veri (index.css). */
export const TOCCO_CM = 0.85; // `tocco-bottone`, `tocco-campo`
export const DITO_PROVATO_CM = 0.53; // provato con le mani il 18/08
export const NOTA_LARGA_CM = 3;

export const FORME = [
  { nome: "telefono 360", larghezza: 360, altezza: 780, scala: 3, mobile: true, pxcm: 60 },
  { nome: "telefono 390", larghezza: 390, altezza: 844, scala: 3, mobile: true, pxcm: 60 },
  { nome: "telefono 430", larghezza: 430, altezza: 932, scala: 3, mobile: true, pxcm: 60 },
  { nome: "tablet 768", larghezza: 768, altezza: 1024, scala: 2, mobile: true, pxcm: 64 },
  { nome: "computer 1280", larghezza: 1280, altezza: 800, scala: 1, mobile: false },
  { nome: "computer 1920", larghezza: 1920, altezza: 1080, scala: 1, mobile: false },
];

/** Da quale larghezza la riga non è più «telefono» (`sm:` di Tailwind). */
export const SOGLIA_SM = 640;

// --- La misura, dentro la pagina ---------------------------------------
// ⚠️ Restituisce rettangoli e testi, e decide niente: i confronti stanno
//    qui sotto, in funzioni pure che si possono provare da sole.
const MISURA = `(() => {
  const main = document.querySelector("main[data-pagina]");
  if (!main || !main.firstElementChild) return null;
  if (/Caricamento/.test(main.innerText) && main.innerText.length < 200) return null;
  const pxcm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pxcm"));
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, destra: b.right, basso: b.bottom }; };
  const tutti = (sel) => [...document.querySelectorAll(sel)];
  return {
    pagina: main.dataset.pagina,
    rete: window.__tentativiDiRete ?? -1,
    reteDove: [...new Set(window.__richiesteFermate ?? [])].join(", "),
    pxcm,
    larghezza: document.documentElement.clientWidth,
    sbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    intestazione: r(tutti("[data-intestazione-dashboard] a").find((a) => /Agenda completa/.test(a.textContent))),
    saluto: (() => { const h = document.querySelector("[data-intestazione-dashboard] h1"); if (!h) return null; const s = getComputedStyle(h); return { h: h.getBoundingClientRect().height, riga: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3 }; })(),
    impegni: tutti("[data-riga-impegno]").map((riga) => ({
      riga: r(riga),
      titolo: r(riga.querySelector("[data-titolo-impegno]")),
      priorita: r(riga.querySelector("[data-priorita-impegno]")),
      testo: riga.querySelector("[data-titolo-impegno]")?.textContent ?? "",
    })),
    avvisi: tutti("[data-avviso-riga]").map((riga) => ({
      testo: r(riga.querySelector("button")),
      rimanda: r([...riga.querySelectorAll("button")].find((b) => /Non adesso/.test(b.textContent))),
    })),
    spunte: tutti("[data-spunta-impegno]").filter((l) => l.getBoundingClientRect().width > 0).map((l) => ({ ...r(l), nome: l.querySelector("input")?.getAttribute("aria-label") ?? "" })),
    nota: r(document.querySelector("[data-campo-nota]")),
    registra: r(tutti("button").find((b) => /Registra movimento|Registro/.test(b.textContent))),
    croci: tutti("[data-disattiva-causale],[data-togli-chiusura]").map((b) => ({ ...r(b), nome: b.getAttribute("aria-label") ?? "" })),
    collegamentoLista: r(document.querySelector("[data-collegamento-lista]")),
    provenienze: tutti("button[aria-pressed]").map((b) => ({ testo: b.textContent.trim(), premuto: b.getAttribute("aria-pressed") })),
    inScadenza: tutti("[data-documento-in-scadenza]").map(r),
  };
})()`;

// --- I confronti -------------------------------------------------------
const cm = (px, pxcm) => px / pxcm;
const mm = (px, pxcm) => (cm(px, pxcm) * 10).toFixed(1);

export function controlla(forma, m, difetti) {
  const dove = `${m.pagina} · ${forma.nome}`;
  const no = (frase) => difetti.push(`${dove}: ${frase}`);
  const telefono = forma.larghezza < SOGLIA_SM;

  if (m.rete === -1) no("il blocco della rete non è caricato nella pagina: la prova non può garantire che niente esca");
  else if (m.rete !== 0) no(`la pagina ha provato a uscire dal computer (${m.rete} tentativi verso ${m.reteDove || "?"}) — un alias non passa dal collegamento finto`);
  if (m.sbordo > 1) no(`la pagina scorre di lato di ${m.sbordo} punti`);

  if (m.pagina === "dashboard") {
    if (!m.intestazione) no("«Agenda completa →» non c'è");
    else if (m.intestazione.destra > m.larghezza + 1) no(`«Agenda completa →» esce di ${Math.round(m.intestazione.destra - m.larghezza)} punti`);
    // ⚠️ Il collegamento che esce è un caso AL LIMITE (misurato: nel
    //    gestionale vero sporgeva di 7 punti, qui ci stava per 6 — decide la
    //    resa del testo). Il sintomo stabile è un altro: per fargli posto il
    //    saluto veniva schiacciato su due righe. Con la riga che va a capo,
    //    il saluto resta su una.
    if (m.saluto && m.saluto.h > m.saluto.riga * 1.5) no("il saluto è schiacciato su più righe dal collegamento accanto");
    if (m.impegni.length === 0) no("nessun impegno disegnato");
    for (const i of m.impegni) {
      if (/_/.test(i.testo)) no(`la categoria si legge col codice: «${i.testo}»`);
      if (telefono && i.titolo.w < i.riga.w * 0.5) no(`il titolo di un impegno ha ${Math.round(i.titolo.w)} punti su ${Math.round(i.riga.w)}`);
      const accanto = Math.abs(i.priorita.y + i.priorita.h / 2 - (i.titolo.y + i.titolo.h / 2)) < i.titolo.h / 2 && i.priorita.x > i.titolo.x;
      if (!telefono && !accanto) no("la priorità non sta più accanto al titolo");
      if (telefono && accanto && i.titolo.w < i.riga.w * 0.5) no("sul telefono la priorità schiaccia il titolo");
    }
    if (m.avvisi.length === 0) no("nessun avviso disegnato");
    for (const a of m.avvisi) {
      const sotto = a.rimanda.y >= a.testo.basso - 1;
      if (telefono && !sotto) no("sul telefono «Non adesso» sta accanto al testo");
      if (!telefono && sotto) no("dal tablet in su «Non adesso» è sceso sotto il testo");
    }
  }

  if (m.pagina === "agenda") {
    if (m.spunte.length === 0) no("nessuna spunta disegnata");
    for (const s of m.spunte) {
      if (cm(s.w, m.pxcm) < TOCCO_CM - 0.01) no(`la spunta è larga ${mm(s.w, m.pxcm)} mm, meno di un pulsante`);
      if (!/^Segna fatto: \S/.test(s.nome)) no(`la spunta non dice quale impegno chiude («${s.nome}»)`);
    }
  }

  if (m.pagina === "primanota") {
    if (!m.nota) no("il campo della nota non c'è");
    else {
      if (cm(m.nota.h, m.pxcm) < TOCCO_CM - 0.01) no(`la nota è alta ${mm(m.nota.h, m.pxcm)} mm`);
      if (cm(m.nota.w, m.pxcm) < NOTA_LARGA_CM) no(`la nota è larga ${mm(m.nota.w, m.pxcm)} mm: non ci si scrive`);
      if (m.nota.destra > m.larghezza + 1) no("la nota esce dallo schermo");
    }
    if (!m.registra) no("«Registra movimento» non c'è");
    else if (m.registra.destra > m.larghezza + 1) no("«Registra movimento» esce dallo schermo");
  }

  if (m.pagina === "causali" || m.pagina === "salaorari") {
    if (m.croci.length === 0) no("nessuna «✕» disegnata");
    for (const c of m.croci) {
      const lato = Math.min(c.w, c.h);
      if (cm(lato, m.pxcm) < TOCCO_CM - 0.01) no(`una «✕» ha un lato di ${mm(lato, m.pxcm)} mm`);
      if (!c.nome || /^✕$/.test(c.nome.trim())) no("una «✕» non dice cosa fa");
    }
  }

  if (m.pagina === "spesa") {
    if (!m.collegamentoLista) no("il collegamento alla lista della spesa non c'è");
    else if (cm(m.collegamentoLista.h, m.pxcm) < DITO_PROVATO_CM) no(`il collegamento alla lista è alto ${mm(m.collegamentoLista.h, m.pxcm)} mm`);
  }

  if (m.pagina === "archivio") {
    if (m.inScadenza.length === 0) no("nessun documento in scadenza disegnato");
    for (const d of m.inScadenza) {
      if (cm(d.h, m.pxcm) < TOCCO_CM - 0.01) no(`un documento in scadenza è alto ${mm(d.h, m.pxcm)} mm`);
    }
  }

  if (m.pagina === "ingrediente") {
    if (m.provenienze.length !== 2) no(`le provenienze con uno stato sono ${m.provenienze.length}, non 2`);
    else if (m.provenienze.filter((p) => p.premuto === "true").length !== 1) no("le provenienze non dicono quale delle due è scelta");
  }
}

// --- Nessuna richiesta esce dal computer --------------------------------
// Il blocco vive in `chrome-senza-schermo.mjs` (`NIENTE_RETE`), comune alle
// due prove visive: ferma tutto ciò che non va al server locale, e la prova
// che trova un tentativo è ROSSA.

// --- Il giro -----------------------------------------------------------
export const PAGINE = ["dashboard", "agenda", "primanota", "causali", "salaorari", "spesa", "ingrediente", "archivio"];

async function principale() {
  // Si possono chiedere solo alcune schermate: `node scripts/prova-visiva-schermate.mjs agenda causali`.
  const chieste = process.argv.slice(2);
  const scelte = chieste.length ? PAGINE.filter((p) => chieste.includes(p)) : PAGINE;
  const server = await createServer({
    root: RADICE,
    configFile: path.join(RADICE, "vite.config.js"),
    logLevel: "error",
    // Nessun `.env`: la schermata non conosce nessun indirizzo né chiave vera.
    envDir: cartellaSenzaAmbiente(),
    server: { port: 5289, strictPort: false, host: "127.0.0.1" },
    resolve: {
      alias: [
        // 🔴 LE TRE FORME DELL'IMPORT: `../lib/supabase` dalle pagine,
        //    `../supabase` dai moduli delle letture, `./supabase` da `lib/`.
        //    La prima stesura riconosceva solo la prima, e il primo giro ha
        //    mandato letture vere, da anonimo, al progetto di `.env` —
        //    respinte, ma partite. Da qui la regola qui sotto e la rete
        //    `NIENTE_RETE` nella pagina.
        { find: /^\.{1,2}\/(.*\/)?supabase$/, replacement: path.join(RADICE, "tests/visive/finti/supabase.js") },
        { find: /^\.{1,2}\/(.*\/)?operazioni$/, replacement: path.join(RADICE, "tests/visive/finti/operazioni.js") },
        { find: /^\.{1,2}\/(.*\/)?chiamaFunzione$/, replacement: path.join(RADICE, "tests/visive/finti/chiamaFunzione.js") },
        { find: /^.*\/context\/AuthContext$/, replacement: path.join(RADICE, "tests/visive/finti/AuthContext.jsx") },
      ],
    },
  });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const { porta, chiudi } = await avviaChrome({ senzaRete: true });
  const cartellaFoto = path.join(os.tmpdir(), "b58-prova-visiva-schermate");
  mkdirSync(cartellaFoto, { recursive: true });

  const difetti = [];
  let misurate = 0;
  try {
    for (const forma of FORME) {
      for (const pagina of scelte) {
        const { ws, manda } = await apriPaginaChrome(
          porta,
          forma,
          `${base}tests/visive/schermate/index.html?pagina=${pagina}`,
          NIENTE_RETE,
        );
        // Il carattere vero, o la prova si ferma (27/09/2026).
        await pretendiInter(manda, `${pagina} · ${forma.nome}`);
        let m = null;
        for (let i = 0; i < 80 && !m; i++) {
          await aspetta(250);
          m = await valuta(manda, MISURA).catch(() => null);
        }
        // Un giro in più: una lettura finta risponde subito, ma una seconda
        // ondata di dati può arrivare dopo la prima impaginazione.
        await aspetta(400);
        m = (await valuta(manda, MISURA).catch(() => null)) ?? m;
        if (!m) {
          difetti.push(`${pagina} · ${forma.nome}: la schermata non si è disegnata`);
        } else {
          controlla(forma, m, difetti);
          misurate += 1;
        }
        await fotografaChrome(manda, path.join(cartellaFoto, `${pagina}-${nomeFile(forma.nome)}.png`));
        ws.close();
      }
      console.log(`${forma.nome}: ${scelte.length} schermate misurate`);
    }
  } finally {
    await chiudi();
    await server.close();
  }

  console.log(`\nfotografie in ${cartellaFoto}`);
  if (difetti.length) {
    console.error(`\n${difetti.length} cose non tornano:`);
    for (const d of difetti) console.error(`  ✗ ${d}`);
    process.exit(1);
  }
  console.log(`\nTutto a posto: ${misurate} misure su ${FORME.length * scelte.length}.`);
}

if (process.argv[1] && process.argv[1].endsWith("prova-visiva-schermate.mjs")) {
  await principale();
}
