// =====================================================================
// LA PROVA VISIVA DELL'AGENDA — 10/09/2026, allargata l'11/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Le domande sulla FORMA — «il titolo parte dalla stessa
//    colonna?», «le caselle della data escono dal riquadro?» — nessuna
//    prova di questo progetto le poteva fare: le prove sulle schermate
//    girano in un ambiente senza impaginazione (jsdom), dove ogni elemento
//    misura zero. Lì passerebbero identiche con la schermata storta.
//
// ⚠️ QUINDI SI USA UN BROWSER VERO. Si montano le vere schermate (finte
//    sono solo le letture, vedi `tests/visive/finti/`), le si apre in Chrome
//    senza schermo alla larghezza di un telefono e di un computer, e si
//    MISURA, in punti.
//
// ⚠️ E ANCHE ALLA DENSITÀ VERA DI UN TELEFONO. I testi e le caselle sono in
//    centimetri veri (`--pxcm`): a 37,8 punti per centimetro — la stima da
//    monitor — tutto è più piccolo di quanto sia in mano. Si ripete il
//    telefono a 64, il valore più alto misurato in questo progetto (il mini
//    tablet da 7,9", 21/08): è lì che una casella che ci sta a stento esce.
//
// ⚠️ NESSUNA DIPENDENZA NUOVA: Chrome si pilota col suo protocollo
//    (DevTools) e il WebSocket di Node. Niente Playwright, niente browser
//    scaricati.
//
// COSA SI CONFRONTA
//   AGENDA (l'elenco degli impegni), telefono e computer
//   · spunta, prima riga del titolo e stella hanno lo stesso centro in
//     verticale, e la spunta non tocca il titolo (11/09);
//   · titolo, scadenza e «rimanda» partono dalla stessa colonna (10/09);
//   · la stella sta contro il bordo destro, nello stesso punto in tutti
//     gli impegni, e il titolo non le passa sotto (11/09);
//   · nell'elenco non compaiono «Riservato» né la provenienza: sono stati
//     tolti apposta nel collaudo dell'11/09, e se tornano la prova è rossa;
//   · sul telefono la scheda è compatta: fra titolo, scadenza e «rimanda»
//     nessun vuoto più alto di 3,5 mm, la scadenza larga quanto le sue
//     parole, e lo stesso margine sopra e sotto in ogni scheda (11/09);
//   · sul computer «Scadenza» comincia nello stesso punto in tutte le
//     sezioni (11/09);
//   · sul telefono la casella di «rimanda», aperta, resta dentro la scheda
//     e parte dalla colonna del titolo.
//   SCHEDA (un impegno aperto)
//   · le quattro caselle di data e ora non escono dal modulo, non si
//     sovrappongono, il contenuto ci sta intero, non sono a tutta larghezza
//     e non sono più alte di 0,8 cm (11/09, secondo giro);
//   · «Si ripete — ogni [n] [unità]»: tutto dentro il modulo, niente che si
//     sovrappone, i menu larghi quanto la loro parola, il numero stretto;
//   · la provenienza sta sotto il modulo, più piccola del titolo (11/09);
//   · la pagina non scorre di lato.
//
// ⚠️ IL LIMITE, dichiarato: è Chrome. Safari dell'iPhone disegna le caselle
//    di data e ora a modo suo (niente icona, testo centrato, larghezza sua).
//    La prova misura quanto spazio chiede il contenuto, ma una prova verde
//    qui non sostituisce l'occhio su un iPhone vero.
//
// Uso: `npm run test:visive`  (esce con 1 se qualcosa non torna)
// =====================================================================

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { QUANTE_SCHEDE } from "../tests/visive/finti/tasks.js";

const RADICE = process.cwd();
const TOLLERANZA_PX = 1;
// Spunta, stella e prima riga del titolo: quanto possono scostarsi i centri
// in verticale. Due punti sono meno di un decimo di riga.
const TOLLERANZA_RIGA_PX = 2;
// Nella scheda di un impegno: giorno e ora della scadenza, giorno e ora del
// promemoria. Se la scheda cambia forma, la prova lo dice invece di misurare
// meno caselle in silenzio.
const CAMPI_DATA_ORA = 4;
// «Si ripete»: il menu sì/no, il numero e il menu dell'unità.
const PEZZI_RIPETE = 3;
// Le soglie sono in CENTIMETRI VERI e si moltiplicano per la densità della
// forma: in punti, a 64 punti per centimetro diventerebbero la metà.
const VUOTO_MASSIMO_CM = 0.35; // fra titolo, scadenza e «rimanda»
const STELLA_DAL_BORDO_CM = 0.15; // oltre il margine della scheda
const CASELLA_ALTA_CM = 0.8;
const CASELLA_LARGA_QUOTA = 0.7; // della larghezza utile del modulo
const NUMERO_LARGO_CM = 2;

const FORME = [
  { nome: "telefono", larghezza: 390, altezza: 844, scala: 3, mobile: true },
  { nome: "telefono a 64 punti per cm", larghezza: 390, altezza: 844, scala: 3, mobile: true, pxcm: 64 },
  { nome: "computer", larghezza: 1280, altezza: 900, scala: 1, mobile: false },
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

const valuta = async (manda, espressione) =>
  (await manda("Runtime.evaluate", { expression: espressione, returnByValue: true })).result.value;

// --- Le misure, eseguite DENTRO la pagina -------------------------------
// ⚠️ Si misura il TESTO disegnato, non il bordo dell'elemento: un elemento
//    può partire dalla colonna giusta e avere il testo spostato da un
//    margine interno, e l'occhio vede il testo. Le righe di un testo si
//    ricostruiscono dai rettangoli dei suoi pezzi, riga per riga.
const AIUTI = `
  const visibile = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const densita = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pxcm"));
  const righeDiTesto = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const righe = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        if (q.width <= 0) continue;
        const c = (q.top + q.bottom) / 2;
        const g = righe.find((x) => Math.abs((x.top + x.bottom) / 2 - c) < q.height / 2);
        if (g) {
          g.left = Math.min(g.left, q.left); g.right = Math.max(g.right, q.right);
          g.top = Math.min(g.top, q.top); g.bottom = Math.max(g.bottom, q.bottom);
        } else righe.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
      }
    }
    return righe.sort((a, b) => a.top - b.top);
  };
`;

const MISURA_AGENDA = (selettoreQuadri) => `(() => {
  ${AIUTI}
  const scatola = (r) => ({ sinistra: r.left, destra: r.right, alto: r.top, basso: r.bottom, centro: (r.top + r.bottom) / 2 });
  const quadri = [...document.querySelectorAll(${JSON.stringify(selettoreQuadri)})].filter(visibile);
  // Il gruppo di una scheda è il contenitore che la tiene insieme alle altre
  // dello stesso elenco (una sezione, o un giorno dentro una sezione).
  const genitori = [...new Set(quadri.map((q) => q.parentElement))];
  return {
    pxcm: densita(),
    righe: quadri.map((q) => {
      const titolo = q.querySelector("[data-testo-titolo]");
      const spunta = q.querySelector("input[type=checkbox]");
      const stella = q.querySelector("[data-stella]");
      // Il bordo da cui si misura la stella: la scheda sul telefono, la
      // cella del titolo sul computer (dopo ci sono le altre colonne).
      const contenitore = (stella && stella.closest("td")) || q;
      const rc = contenitore.getBoundingClientRect();
      const campi = [...q.querySelectorAll("[data-campo]")].filter(visibile).map((e) => {
        const t = righeDiTesto(e);
        return {
          cosa: "«" + e.textContent.trim().slice(0, 24) + "»",
          sinistra: t.length ? t[0].left : e.getBoundingClientRect().left,
          alto: t.length ? t[0].top : null,
          basso: t.length ? t[t.length - 1].bottom : null,
          larga: e.getBoundingClientRect().width,
          righe: t.length,
          larghezzaTesto: t.length ? Math.max(...t.map((r) => r.right)) - Math.min(...t.map((r) => r.left)) : 0,
        };
      });
      const gesto = [...q.querySelectorAll("[data-gesto]")].filter(visibile)[0];
      const tg = gesto ? righeDiTesto(gesto)[0] : null;
      const tabella = q.closest("table");
      const intestazioni = tabella ? [...tabella.querySelectorAll("thead th")] : [];
      const rq = q.getBoundingClientRect();
      return {
        titolo: titolo ? titolo.textContent.trim().slice(0, 40) : "(senza titolo)",
        testo: q.textContent,
        righeTitolo: titolo ? righeDiTesto(titolo) : [],
        spunta: spunta && visibile(spunta) ? scatola(spunta.getBoundingClientRect()) : null,
        stella: stella && visibile(stella) ? scatola(stella.getBoundingClientRect()) : null,
        stellaDalBordo:
          stella && visibile(stella)
            ? rc.right - parseFloat(getComputedStyle(contenitore).paddingRight) - stella.getBoundingClientRect().right
            : null,
        campi,
        gesto: tg
          ? { cosa: "«" + gesto.textContent.trim() + "»", sinistra: tg.left, alto: tg.top, basso: tg.bottom, bordoBasso: gesto.getBoundingClientRect().bottom }
          : null,
        quadroAlto: rq.top,
        quadroBasso: rq.bottom,
        gruppo: genitori.indexOf(q.parentElement),
        haScadenza: [...q.querySelectorAll("[data-campo]")].some((e) => e.textContent.trim().startsWith("Scadenza")),
        secondaColonna: intestazioni[1] ? intestazioni[1].getBoundingClientRect().left : null,
      };
    }),
  };
})()`;

// Sul telefono: si apre «rimanda» del primo riquadro e si guarda dove sta
// la casella della data che compare.
const APRI_RIMANDA = `(() => { const b = document.querySelector("[data-quadrotto] [data-gesto]"); if (b) b.click(); return Boolean(b); })()`;
const MISURA_RIMANDA = `(() => {
  ${AIUTI}
  const q = document.querySelector("[data-quadrotto]");
  const c = q && q.querySelector("input[type=date]");
  if (!c) return null;
  const t = q.querySelector("[data-testo-titolo]");
  const prima = t ? righeDiTesto(t)[0] : null;
  const rq = q.getBoundingClientRect(), rc = c.getBoundingClientRect();
  return {
    casellaSinistra: rc.left,
    casellaDestra: rc.right,
    quadroDestra: rq.right - parseFloat(getComputedStyle(q).paddingRight),
    colonna: prima ? prima.left : null,
  };
})()`;

const MISURA_SCHEDA = `(() => {
  ${AIUTI}
  const f = document.querySelector("form");
  if (!f) return null;
  const rf = f.getBoundingClientRect();
  const sf = getComputedStyle(f);
  const dentroSinistra = rf.left + parseFloat(sf.paddingLeft);
  const dentroDestra = rf.right - parseFloat(sf.paddingRight);
  // ⚠️ QUANTO VORREBBE ESSERE LARGA. Chrome stringe una casella fin dove
  //    gli si dice; Safari dell'iPhone no, la tiene larga quanto il suo
  //    contenuto e la fa uscire. Per vedere da qui il caso di Safari si misura
  //    una copia della casella lasciata libera di allargarsi (stesse classi,
  //    stesso valore, stesso posto): se chiede più di quanto ha, il
  //    contenuto non ci sta.
  const libera = (e) => {
    const c = e.cloneNode(true);
    c.value = e.value;
    c.style.cssText += ";position:absolute;visibility:hidden;width:auto;min-width:0;max-width:none";
    e.parentNode.appendChild(c);
    const w = c.getBoundingClientRect().width;
    c.remove();
    return w;
  };
  const misura = (e) => {
    const r = e.getBoundingClientRect();
    return {
      tipo: e.tagName === "SELECT" ? "menu" : e.type,
      sinistra: r.left, destra: r.right, alto: r.top, basso: r.bottom,
      larga: r.width, alta: r.height,
      vorrebbe: libera(e),
      carattere: parseFloat(getComputedStyle(e).fontSize),
    };
  };
  const caselle = [...f.querySelectorAll("input[type=date], input[type=time]")].map(misura);
  const ripete = f.querySelector("[data-ripete]");
  const pezziRipete = ripete ? [...ripete.querySelectorAll("select, input")].map(misura) : [];
  const titolo = f.querySelector("input:not([type])");
  const p = document.querySelector("[data-provenienza]");
  return {
    pxcm: densita(),
    dentroDestra,
    dentroLarga: dentroDestra - dentroSinistra,
    fondoModulo: rf.bottom,
    paginaLarga: document.documentElement.scrollWidth,
    finestra: innerWidth,
    caselle,
    pezziRipete,
    carattereTitolo: titolo ? parseFloat(getComputedStyle(titolo).fontSize) : null,
    provenienza: p
      ? { testo: p.textContent.trim(), alto: p.getBoundingClientRect().top, carattere: parseFloat(getComputedStyle(p).fontSize) }
      : null,
  };
})()`;

// --- I controlli ---------------------------------------------------------
const mm = (punti, pxcm) => ((punti / pxcm) * 10).toFixed(1);

// Due elenchi di rettangoli sulla stessa riga non devono toccarsi.
function nonSiToccano(lista, cosa, forma, difetti) {
  lista.forEach((c, i) => {
    for (const d of lista.slice(i + 1)) {
      const stessaRiga = c.basso > d.alto + TOLLERANZA_PX && d.basso > c.alto + TOLLERANZA_PX;
      const [sx, dx] = c.sinistra <= d.sinistra ? [c, d] : [d, c];
      if (stessaRiga && sx.destra > dx.sinistra + TOLLERANZA_PX) {
        difetti.push(`${forma}: ${cosa}, ${sx.tipo} e ${dx.tipo} si sovrappongono di ${(sx.destra - dx.sinistra).toFixed(1)} punti.`);
      }
    }
  });
}

function sparpaglio(valori) {
  const v = valori.filter((x) => x != null);
  return v.length > 1 ? { min: Math.min(...v), max: Math.max(...v) } : null;
}

function controllaAgenda(forma, { pxcm, righe }, telefono, difetti) {
  const cm = (v) => v * pxcm;
  if (righe.length !== QUANTE_SCHEDE) {
    difetti.push(`${forma}: disegnate ${righe.length} schede su ${QUANTE_SCHEDE} — quelle che mancano non sono state misurate.`);
  }
  for (const r of righe) {
    const nome = `${forma} · «${r.titolo}»`;
    const prima = r.righeTitolo[0];
    if (!prima) {
      difetti.push(`${nome}: il titolo non si trova.`);
      continue;
    }
    const ultima = r.righeTitolo[r.righeTitolo.length - 1];
    const colonna = prima.left;
    const rigaCentro = (prima.top + prima.bottom) / 2;

    if (/riservato/i.test(r.testo)) {
      difetti.push(`${nome}: nell'elenco compare «Riservato», che è stato tolto apposta.`);
    }
    // ⚠️ Le frasi esatte, e senza confine di parola: nel testo della scheda
    //    la provenienza arriva attaccata alla data («2026nato dalla posta»),
    //    e la prima stesura, che cercava «\bnato d», sul telefono non la
    //    vedeva. Trovato facendo girare questa prova sul codice di prima.
    if (/nato (dalla posta|da una cosa detta a voce|dall'Archivio documenti|dalle Fatture fornitori)/i.test(r.testo)) {
      difetti.push(`${nome}: nell'elenco compare la provenienza, che sta nella scheda dell'impegno.`);
    }

    if (!r.spunta) {
      difetti.push(`${nome}: la spunta non si trova.`);
    } else {
      if (r.spunta.destra > colonna + TOLLERANZA_PX) {
        difetti.push(`${nome}: la spunta finisce a ${r.spunta.destra.toFixed(1)} e il titolo comincia a ${colonna.toFixed(1)} — si sovrappongono.`);
      }
      const s = r.spunta.centro - rigaCentro;
      if (Math.abs(s) > TOLLERANZA_RIGA_PX) {
        difetti.push(`${nome}: la spunta sta ${Math.abs(s).toFixed(1)} punti ${s > 0 ? "sotto" : "sopra"} la prima riga del titolo.`);
      }
    }

    if (!r.stella) {
      difetti.push(`${nome}: la stella non si trova.`);
    } else {
      const s = r.stella.centro - rigaCentro;
      if (Math.abs(s) > TOLLERANZA_RIGA_PX) {
        difetti.push(`${nome}: la stella sta ${Math.abs(s).toFixed(1)} punti ${s > 0 ? "sotto" : "sopra"} la prima riga del titolo.`);
      }
      for (const l of r.righeTitolo) {
        const stessaAltezza = l.bottom > r.stella.alto + TOLLERANZA_PX && r.stella.basso > l.top + TOLLERANZA_PX;
        if (stessaAltezza && l.right > r.stella.sinistra + TOLLERANZA_PX) {
          difetti.push(`${nome}: il titolo passa sotto la stella di ${(l.right - r.stella.sinistra).toFixed(1)} punti.`);
        }
      }
      if (r.stellaDalBordo > cm(STELLA_DAL_BORDO_CM) + TOLLERANZA_PX) {
        difetti.push(`${nome}: fra la stella e il bordo destro restano ${r.stellaDalBordo.toFixed(1)} punti (${mm(r.stellaDalBordo, pxcm)} mm) oltre il margine.`);
      }
    }

    for (const a of [...r.campi, ...(r.gesto ? [r.gesto] : [])]) {
      const scarto = a.sinistra - colonna;
      if (Math.abs(scarto) > TOLLERANZA_PX) {
        difetti.push(`${nome}: ${a.cosa} comincia ${scarto > 0 ? "a destra" : "a sinistra"} del titolo di ${Math.abs(scarto).toFixed(1)} punti.`);
      }
    }

    if (telefono) {
      // ⚠️ Solo per un testo su UNA riga: se va a capo, il riquadro è largo
      //    quanto la colonna per forza, e non è un blocco messo lì apposta.
      for (const c of r.campi) {
        if (c.righe === 1 && c.larga > c.larghezzaTesto + 2) {
          difetti.push(`${nome}: ${c.cosa} è un blocco largo ${c.larga.toFixed(0)} punti per ${c.larghezzaTesto.toFixed(0)} punti di testo.`);
        }
      }
      // I vuoti fra le cose della colonna, da testo a testo.
      const pezzi = [
        { cosa: "il titolo", alto: prima.top, basso: ultima.bottom },
        ...r.campi,
        ...(r.gesto ? [r.gesto] : []),
      ];
      for (let i = 1; i < pezzi.length; i++) {
        const vuoto = pezzi[i].alto - pezzi[i - 1].basso;
        if (vuoto > cm(VUOTO_MASSIMO_CM)) {
          difetti.push(`${nome}: fra ${pezzi[i - 1].cosa} e ${pezzi[i].cosa} c'è un vuoto di ${vuoto.toFixed(0)} punti (${mm(vuoto, pxcm)} mm; il massimo è ${VUOTO_MASSIMO_CM * 10}).`);
        }
        if (vuoto < -TOLLERANZA_PX) {
          difetti.push(`${nome}: ${pezzi[i].cosa} si sovrappone a ${pezzi[i - 1].cosa} di ${(-vuoto).toFixed(1)} punti.`);
        }
      }
    }
  }

  const dalBordo = sparpaglio(righe.map((r) => r.stellaDalBordo));
  if (dalBordo && dalBordo.max - dalBordo.min > TOLLERANZA_PX) {
    difetti.push(`${forma}: la stella non sta allo stesso posto — dal bordo destro va da ${dalBordo.min.toFixed(1)} a ${dalBordo.max.toFixed(1)} punti.`);
  }
  if (telefono) {
    const sopra = sparpaglio(righe.map((r) => (r.righeTitolo[0] ? r.righeTitolo[0].top - r.quadroAlto : null)));
    if (sopra && sopra.max - sopra.min > TOLLERANZA_PX) {
      difetti.push(`${forma}: sopra il titolo lo spazio cambia da scheda a scheda — da ${sopra.min.toFixed(1)} a ${sopra.max.toFixed(1)} punti.`);
    }
    const sotto = sparpaglio(righe.map((r) => (r.gesto ? r.quadroBasso - r.gesto.bordoBasso : null)));
    if (sotto && sotto.max - sotto.min > TOLLERANZA_PX) {
      difetti.push(`${forma}: sotto «rimanda» lo spazio cambia da scheda a scheda — da ${sotto.min.toFixed(1)} a ${sotto.max.toFixed(1)} punti.`);
    }
    // Nello stesso gruppo o tutte le schede dicono la scadenza, o nessuna:
    // una senza data accanto a una datata dice «quando capita» (trovato
    // dalla revisione dell'11/09, non da questa prova).
    const gruppi = new Map();
    for (const r of righe) gruppi.set(r.gruppo, [...(gruppi.get(r.gruppo) ?? []), r]);
    for (const g of gruppi.values()) {
      const senza = g.filter((r) => !r.haScadenza);
      if (senza.length && senza.length < g.length) {
        difetti.push(`${forma}: nello stesso gruppo ${senza.map((r) => `«${r.titolo}»`).join(", ")} non dice la scadenza e le altre schede sì.`);
      }
    }
  }
  const seconde = sparpaglio(righe.map((r) => r.secondaColonna));
  if (seconde && seconde.max - seconde.min > TOLLERANZA_PX) {
    difetti.push(`${forma}: la colonna «Scadenza» non comincia nello stesso punto nelle sezioni — da ${seconde.min.toFixed(1)} a ${seconde.max.toFixed(1)} punti.`);
  }
}

function controllaRimanda(forma, m, difetti) {
  if (!m) {
    difetti.push(`${forma}: aperto «rimanda», la casella della data non è comparsa.`);
    return;
  }
  if (m.casellaDestra > m.quadroDestra + TOLLERANZA_PX) {
    difetti.push(`${forma}: la casella di «rimanda» esce dal riquadro di ${(m.casellaDestra - m.quadroDestra).toFixed(1)} punti.`);
  }
  if (m.colonna != null && Math.abs(m.casellaSinistra - m.colonna) > TOLLERANZA_PX) {
    difetti.push(`${forma}: la casella di «rimanda» non parte dalla colonna del titolo (scarto ${(m.casellaSinistra - m.colonna).toFixed(1)} punti).`);
  }
}

function controllaScheda(forma, m, difetti) {
  if (!m) {
    difetti.push(`${forma}: la scheda dell'impegno non si è disegnata.`);
    return;
  }
  const cm = (v) => v * m.pxcm;
  const dentro = (c, cosa) => {
    if (c.destra > m.dentroDestra + TOLLERANZA_PX) {
      difetti.push(`${forma}: ${cosa} esce dal modulo di ${(c.destra - m.dentroDestra).toFixed(1)} punti.`);
    }
  };
  if (m.paginaLarga > m.finestra + TOLLERANZA_PX) {
    difetti.push(`${forma}: la pagina scorre di lato di ${m.paginaLarga - m.finestra} punti.`);
  }

  if (m.caselle.length !== CAMPI_DATA_ORA) {
    difetti.push(`${forma}: trovate ${m.caselle.length} caselle di data e ora su ${CAMPI_DATA_ORA}.`);
  }
  m.caselle.forEach((c, i) => {
    const cosa = `la casella n. ${i + 1} (${c.tipo})`;
    if (c.vorrebbe > c.larga + TOLLERANZA_PX) {
      difetti.push(`${forma}: ${cosa} ha ${c.larga.toFixed(0)} punti e il suo contenuto ne chiede ${c.vorrebbe.toFixed(0)} — si taglia.`);
    }
    dentro(c, cosa);
    if (c.alta > cm(CASELLA_ALTA_CM) + TOLLERANZA_PX) {
      difetti.push(`${forma}: ${cosa} è alta ${c.alta.toFixed(0)} punti (${mm(c.alta, m.pxcm)} mm; il massimo è ${CASELLA_ALTA_CM * 10}).`);
    }
    if (c.larga > m.dentroLarga * CASELLA_LARGA_QUOTA) {
      difetti.push(`${forma}: ${cosa} è larga ${c.larga.toFixed(0)} punti su ${m.dentroLarga.toFixed(0)} — è a tutta larghezza.`);
    }
  });
  nonSiToccano(m.caselle, "data e ora", forma, difetti);

  if (m.pezziRipete.length !== PEZZI_RIPETE) {
    difetti.push(`${forma}: in «Si ripete» trovati ${m.pezziRipete.length} controlli su ${PEZZI_RIPETE} — la riga «ogni …» non è stata misurata.`);
  }
  m.pezziRipete.forEach((c) => {
    dentro(c, `in «Si ripete» il ${c.tipo}`);
    if (c.tipo === "menu" && c.vorrebbe > c.larga + TOLLERANZA_PX) {
      difetti.push(`${forma}: in «Si ripete» un menu ha ${c.larga.toFixed(0)} punti e la sua parola ne chiede ${c.vorrebbe.toFixed(0)} — si taglia.`);
    }
    if (c.tipo === "number" && c.larga > cm(NUMERO_LARGO_CM)) {
      difetti.push(`${forma}: in «Si ripete» la casella del numero è larga ${c.larga.toFixed(0)} punti (${mm(c.larga, m.pxcm)} mm) — invade la riga.`);
    }
  });
  nonSiToccano(m.pezziRipete, "in «Si ripete»", forma, difetti);

  if (!m.provenienza) {
    difetti.push(`${forma}: la provenienza non compare nella scheda dell'impegno.`);
  } else {
    if (!/posta/i.test(m.provenienza.testo)) {
      difetti.push(`${forma}: la provenienza non dice da dove viene l'impegno («${m.provenienza.testo}»).`);
    }
    if (m.provenienza.alto < m.fondoModulo - TOLLERANZA_PX) {
      difetti.push(`${forma}: la provenienza sta sopra la fine del modulo — deve stare in fondo.`);
    }
    if (m.carattereTitolo && m.provenienza.carattere >= m.carattereTitolo) {
      difetti.push(`${forma}: la provenienza è scritta grande quanto il titolo (${m.provenienza.carattere} punti) — deve essere discreta.`);
    }
  }
}

// --- Il giro ------------------------------------------------------------
const server = await createServer({
  root: RADICE,
  configFile: path.join(RADICE, "vite.config.js"),
  logLevel: "error",
  server: { port: 5288, strictPort: false, host: "127.0.0.1" },
  resolve: {
    alias: [
      { find: /^.*\/lib\/api\/tasks$/, replacement: path.join(RADICE, "tests/visive/finti/tasks.js") },
      { find: /^.*\/api\/voce$/, replacement: path.join(RADICE, "tests/visive/finti/voce.js") },
      { find: /^.*\/context\/AuthContext$/, replacement: path.join(RADICE, "tests/visive/finti/AuthContext.jsx") },
    ],
  },
});
await server.listen();
const base = server.resolvedUrls.local[0];

const { chrome, porta, profilo } = await avviaChrome();
const cartellaFoto = path.join(os.tmpdir(), "b58-prova-visiva");
mkdirSync(cartellaFoto, { recursive: true });

const difetti = [];
let misurati = 0;

async function apriPagina(forma, pagina) {
  const { ws, manda } = await apriScheda(porta);
  await manda("Page.enable");
  await manda("Runtime.enable");
  await manda("Emulation.setDeviceMetricsOverride", {
    width: forma.larghezza,
    height: forma.altezza,
    deviceScaleFactor: forma.scala,
    mobile: forma.mobile,
  });
  // La calibrazione dei centimetri sta nella memoria del browser: si scrive
  // PRIMA che la pagina parta, come la troverebbe su un telefono calibrato.
  // ⚠️ E SI TOGLIE quando la forma non ne ha una: la memoria è condivisa fra
  //    le schede dello stesso Chrome, e la prima stesura di questa prova ha
  //    fatto girare il «computer» a 64 punti per cm senza dirlo.
  await manda("Page.addScriptToEvaluateOnNewDocument", {
    source: forma.pxcm
      ? `localStorage.setItem("b58_pxcm", "${forma.pxcm}");`
      : `localStorage.removeItem("b58_pxcm");`,
  });
  await manda("Page.navigate", { url: `${base}${pagina}` });
  return { ws, manda };
}

async function fotografa(manda, nome) {
  // La fotografia è un di più: se non arriva, la misura resta valida.
  try {
    const foto = await Promise.race([
      manda("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }),
      aspetta(15000).then(() => null),
    ]);
    if (foto?.data) {
      const dove = path.join(cartellaFoto, `${nome}.png`);
      writeFileSync(dove, Buffer.from(foto.data, "base64"));
      console.log(`   fotografia: ${dove}`);
    }
  } catch {
    /* niente fotografia: la misura resta quella */
  }
}

const nomeFile = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

try {
  for (const forma of FORME) {
    // --- l'Agenda ---
    {
      const { ws, manda } = await apriPagina(forma, "tests/visive/agenda/index.html");
      const selettore = forma.mobile ? "[data-quadrotto]" : "[data-riga]";
      // Si aspetta che le schede ci siano davvero, non un tempo fisso.
      // ⚠️ E devono esserci TUTTE: una scheda che non si disegna non ha
      //    nessuna misura sbagliata.
      let misura = { pxcm: 0, righe: [] };
      for (let i = 0; i < 80; i++) {
        misura = (await valuta(manda, MISURA_AGENDA(selettore))) ?? misura;
        if (misura.righe.length >= QUANTE_SCHEDE) break;
        await aspetta(250);
      }
      misurati += misura.righe.length;
      controllaAgenda(`agenda · ${forma.nome}`, misura, forma.mobile, difetti);
      await fotografa(manda, `agenda-${nomeFile(forma.nome)}`);
      if (forma.mobile && (await valuta(manda, APRI_RIMANDA))) {
        let m = null;
        for (let i = 0; i < 20 && !m; i++) {
          await aspetta(100);
          m = await valuta(manda, MISURA_RIMANDA);
        }
        controllaRimanda(`agenda · ${forma.nome}`, m, difetti);
      }
      console.log(`agenda · ${forma.nome}: ${misura.righe.length} schede misurate (${misura.pxcm} punti per cm)`);
      ws.close();
    }
    // --- la scheda di un impegno ---
    {
      const { ws, manda } = await apriPagina(forma, "tests/visive/scheda/index.html");
      let m = null;
      for (let i = 0; i < 80; i++) {
        m = await valuta(manda, MISURA_SCHEDA);
        if (m && m.caselle.length >= CAMPI_DATA_ORA && m.pezziRipete.length >= PEZZI_RIPETE) break;
        await aspetta(250);
      }
      controllaScheda(`scheda · ${forma.nome}`, m, difetti);
      await fotografa(manda, `scheda-${nomeFile(forma.nome)}`);
      if (m) {
        const elenco = (l) => l.map((c) => `${c.tipo} ${c.larga.toFixed(0)}×${c.alta.toFixed(0)} (${c.carattere} pt)`).join(", ");
        console.log(`scheda · ${forma.nome}: data e ora ${elenco(m.caselle)} · si ripete ${elenco(m.pezziRipete)} · utile ${m.dentroLarga.toFixed(0)}`);
      } else {
        console.log(`scheda · ${forma.nome}: non disegnata`);
      }
      ws.close();
    }
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
  console.error(`\nPROVA VISIVA ROSSA — ${difetti.length} problemi (${misurati} schede dell'Agenda misurate):`);
  for (const d of difetti) console.error(`  · ${d}`);
  process.exit(1);
}
console.log(`\nPROVA VISIVA VERDE — ${misurati} schede dell'Agenda e la scheda di un impegno, in ${FORME.length} forme.`);
