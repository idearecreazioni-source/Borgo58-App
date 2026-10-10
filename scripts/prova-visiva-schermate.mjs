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
  pretendiCaratteri,
  valuta,
} from "./chrome-senza-schermo.mjs";
import { accentoConApostrofo } from "./testi-a-schermo.mjs";

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
    // I titoli in Fraunces, stampati a ogni giro (27/09/2026): e' il modo di
    // confrontare Windows e Linux sul carattere dei titoli, che le misure
    // qui sopra usano solo di sbieco (il saluto della Dashboard).
    // --- 27/09/2026, «niente tagliato, niente nascosto» ---
    // Ciò che scorre di lato DENTRO la pagina (la pagina ferma, il riquadro no).
    scorrono: [...main.querySelectorAll("*")].filter((el) => { const s = getComputedStyle(el); return /auto|scroll/.test(s.overflowX) && el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1; }).map((el) => ({ testo: (el.innerText || "").trim().slice(0, 40), w: el.clientWidth, serve: el.scrollWidth })),
    // Un testo tagliato: il contenitore lo nasconde e ne ha più di quanto mostra.
    tagliati: [...main.querySelectorAll("*")].filter((el) => { const s = getComputedStyle(el); return (s.overflowX === "hidden" || s.textOverflow === "ellipsis") && el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1 && el.innerText.trim(); }).map((el) => ({ testo: el.innerText.trim().slice(0, 60), w: el.clientWidth, serve: el.scrollWidth })),
    // Gli importi scritti come li scrive la Prima nota, e se qualcosa li copre.
    importi: tutti("main *").filter((el) => el.children.length === 0 && /^[+−][\\d.]+,\\d{2}\\s€$/.test(el.textContent.trim()) && el.getBoundingClientRect().width > 0).map((el) => {
      const b = el.getBoundingClientRect();
      let coperto = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX === "visible") continue;
        const c = a.getBoundingClientRect();
        if (b.right > c.right + 1 || b.left < c.left - 1) coperto = true;
      }
      return { testo: el.textContent.trim(), destra: b.right, coperto, totale: Boolean(el.closest("[data-totali-periodo]")) };
    }),
    // I titoli dell'Agenda: quanto spazio hanno, e la parola più lunga ci sta?
    titoliAgenda: tutti("[data-testo-titolo]").filter((t) => t.getBoundingClientRect().width > 0).map((t) => {
      let casa = t.parentElement;
      while (casa && !casa.querySelector("[data-spunta-impegno]")) casa = casa.parentElement;
      const s = getComputedStyle(t);
      const prova = document.createElement("span");
      prova.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:" + s.font + ";letter-spacing:" + s.letterSpacing;
      document.body.appendChild(prova);
      let parola = "", larga = 0;
      for (const p of t.textContent.split(/\\s+/)) { prova.textContent = p; const w = prova.getBoundingClientRect().width; if (w > larga) { larga = w; parola = p; } }
      prova.remove();
      const b = t.getBoundingClientRect();
      return { testo: t.textContent.slice(0, 30), w: b.width, destra: b.right, casa: casa ? casa.getBoundingClientRect().width : 0, parola, larga };
    }),
    // Le scritte dentro i campi (e l'opzione scelta di un menu): ci stanno?
    scritteNeiCampi: tutti("main input[placeholder], main textarea[placeholder], main select").filter((c) => c.getBoundingClientRect().width > 0).map((c) => {
      const s = getComputedStyle(c);
      const testo = c.tagName === "SELECT" ? (c.selectedOptions[0]?.textContent ?? "") : c.placeholder;
      const tela = document.createElement("canvas").getContext("2d");
      tela.font = s.font;
      // Il menu a tendina ha la sua freccia dentro lo spazio del campo:
      // si tiene da parte quanto una riga di testo.
      const freccia = c.tagName === "SELECT" ? parseFloat(s.fontSize) : 0;
      const posto = c.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - freccia;
      return { testo, serve: tela.measureText(testo).width, posto };
    }),
    // Prima nota, secondo batch (27/09/2026): i totali col loro nome, e la
    // fascia sotto ogni movimento (casella o «?», e «Rimuovi»).
    totali: tutti("[data-totale]").map((d) => ({ chiave: d.dataset.totale, etichetta: d.querySelector("dt")?.textContent.trim() ?? "", valore: d.querySelector("dd")?.textContent.trim() ?? "" })),
    fasce: tutti("[data-fascia-movimento]").filter((f) => f.getBoundingClientRect().width > 0).map((f) => {
      const casella = f.querySelector('[data-prova="investimento-riga"]');
      const perche = f.querySelector('[data-prova="investimento-no"]');
      const segno = perche?.querySelector("button[aria-label]");
      const rimuovi = [...f.querySelectorAll("button")].find((b) => b.textContent.trim() === "Rimuovi");
      return { fascia: r(f), sinistra: r(casella ?? perche), segno: segno ? { ...r(segno), nome: segno.getAttribute("aria-label") } : null, rimuovi: r(rimuovi) };
    }),
    resaRighe: (() => { const e = tutti("main span").find((x) => /ne restano$/.test(x.textContent.trim())); if (!e) return null; const s = getComputedStyle(e); return Math.round(e.getBoundingClientRect().height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.25)); })(),
    testo: main.innerText,
    titoli: tutti("main h1, main h2").filter((t) => /Fraunces/.test(getComputedStyle(t).fontFamily.split(",")[0])).map((t) => { const b = t.getBoundingClientRect(); const s = getComputedStyle(t); const riga = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3; const rng = document.createRange(); rng.selectNodeContents(t); return { testo: t.textContent.trim().slice(0, 18), larga: +rng.getBoundingClientRect().width.toFixed(2), righe: Math.round(b.height / riga) }; }),
  };
})()`;

// --- I confronti -------------------------------------------------------

/** I 5 mm fra un gesto che cancella e uno qualunque (`.gesti-pericolosi`). */
export const DISTANZA_PERICOLOSA_CM = 0.5;

/** «−1.280,85 €» → −1280.85 (il segno meno tipografico compreso). */
export const euro = (testo) => {
  const n = Number(testo.replace(/[^\d,+−-]/g, "").replace(",", ".").replace("−", "-"));
  return Number.isFinite(n) ? n : NaN;
};

const cm = (px, pxcm) => px / pxcm;
const mm = (px, pxcm) => (cm(px, pxcm) * 10).toFixed(1);

export function controlla(forma, m, difetti) {
  const dove = `${m.pagina} · ${forma.nome}`;
  const no = (frase) => difetti.push(`${dove}: ${frase}`);
  const telefono = forma.larghezza < SOGLIA_SM;

  if (m.rete === -1) no("il blocco della rete non è caricato nella pagina: la prova non può garantire che niente esca");
  else if (m.rete !== 0) no(`la pagina ha provato a uscire dal computer (${m.rete} tentativi verso ${m.reteDove || "?"}) — un alias non passa dal collegamento finto`);
  if (m.sbordo > 1) no(`la pagina scorre di lato di ${m.sbordo} punti`);

  // Niente tagliato, niente nascosto (27/09/2026) — su OGNI schermata.
  for (const s of m.scorrono ?? []) no(`un riquadro scorre di lato: chiede ${s.serve} punti e ne ha ${s.w} («${s.testo}»)`);
  for (const t of m.tagliati ?? []) no(`un testo è tagliato: ${t.w} punti su ${t.serve} («${t.testo}»)`);
  const accento = accentoConApostrofo(m.testo ?? "");
  if (accento) no(`a schermo c'è «${accento}»: l'apostrofo sta al posto dell'accento`);

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
    // I sei movimenti dei dati finti, più la riga dei totali.
    const importi = m.importi ?? [];
    const deiMovimenti = importi.filter((i) => !i.totale);
    if (deiMovimenti.length < 6) no(`si leggono ${deiMovimenti.length} importi: i movimenti finti sono sei`);

    // Il campo della finalità: la sua frase ci sta intera (27/09/2026).
    const finalita = (m.scritteNeiCampi ?? []).find((c) => /^Finalità/.test(c.testo));
    if (!finalita) no("il campo della finalità non c'è");
    else if (finalita.serve > finalita.posto + 0.5) no(`«${finalita.testo}» chiede ${Math.round(finalita.serve)} punti e il campo ne ha ${Math.round(finalita.posto)}`);

    // Entrate, Uscite, Saldo del periodo: col loro nome, e coerenti con i
    // movimenti a schermo. Il saldo è la differenza dei due totali.
    const totale = (chiave) => (m.totali ?? []).find((t) => t.chiave === chiave);
    const NOMI = { entrate: "Entrate", uscite: "Uscite", saldo: "Saldo del periodo" };
    for (const [chiave, nome] of Object.entries(NOMI)) {
      const t = totale(chiave);
      if (!t) no(`il totale «${nome}» non c'è`);
      else if (t.etichetta !== nome) no(`il totale «${nome}» si chiama «${t.etichetta}»`);
    }
    if (totale("entrate") && totale("uscite") && totale("saldo")) {
      const piu = deiMovimenti.filter((i) => i.testo.startsWith("+")).reduce((s, i) => s + euro(i.testo), 0);
      const meno = deiMovimenti.filter((i) => i.testo.startsWith("−")).reduce((s, i) => s + euro(i.testo), 0);
      const [e, u, sa] = ["entrate", "uscite", "saldo"].map((k) => euro(totale(k).valore));
      if (Math.abs(e - piu) > 0.005) no(`«Entrate» dice ${e} e i movimenti in entrata fanno ${piu.toFixed(2)}`);
      if (Math.abs(u - meno) > 0.005) no(`«Uscite» dice ${u} e i movimenti in uscita fanno ${meno.toFixed(2)}`);
      if (Math.abs(sa - (e + u)) > 0.005) no(`«Saldo del periodo» dice ${sa}, ma entrate meno uscite fa ${(e + u).toFixed(2)}`);
    }

    // La fascia sotto ogni movimento: casella (o frase e «?») e «Rimuovi»
    // insieme, senza toccarsi, coi 5 mm dei gesti pericolosi fra loro.
    const fasce = m.fasce ?? [];
    if (fasce.length < 6) no(`le fasce sotto i movimenti sono ${fasce.length}, non sei`);
    for (const f of fasce) {
      if (!f.sinistra) { no("una fascia non ha né la casella né la frase col «?»"); continue; }
      if (!f.rimuovi) { no("una fascia non ha «Rimuovi»"); continue; }
      for (const [chi, b] of [["la casella o la frase", f.sinistra], ["«Rimuovi»", f.rimuovi]]) {
        if (b.destra > m.larghezza + 1 || b.x < -1) no(`${chi} esce dallo schermo`);
      }
      if (cm(Math.min(f.rimuovi.w, f.rimuovi.h), m.pxcm) < TOCCO_CM - 0.01) no(`«Rimuovi» ha un lato di ${mm(Math.min(f.rimuovi.w, f.rimuovi.h), m.pxcm)} mm`);
      const staccoX = f.rimuovi.x - f.sinistra.destra;
      const staccoY = f.rimuovi.y - f.sinistra.basso;
      if (Math.max(staccoX, staccoY) < 0) no("la casella o la frase si sovrappone a «Rimuovi»");
      else if (cm(Math.max(staccoX, staccoY), m.pxcm) < DISTANZA_PERICOLOSA_CM - 0.01) no(`fra la casella e «Rimuovi» ci sono ${mm(Math.max(staccoX, staccoY), m.pxcm)} mm, meno dei 5 dei gesti pericolosi`);
      if (f.segno) {
        if (!/non è un investimento/i.test(f.segno.nome)) no(`il «?» si chiama «${f.segno.nome}»: non dice cosa spiega`);
        if (cm(Math.min(f.segno.w, f.segno.h), m.pxcm) < TOCCO_CM - 0.01) no(`il «?» ha un lato di ${mm(Math.min(f.segno.w, f.segno.h), m.pxcm)} mm`);
      }
    }
    if (!fasce.some((f) => f.segno)) no("nessun movimento ha il «?» della spiegazione");
    if (!m.perche) no("il «?» non è stato toccato");
    else if (!m.perche.aperta) no("toccato il «?», la spiegazione non si apre");
    else {
      if (!/investimento|gestionale/i.test(m.perche.testo)) no(`la spiegazione aperta dice «${m.perche.testo.slice(0, 40)}»`);
      if (m.perche.destra > m.larghezza + 1 || m.perche.x < -1) no("la spiegazione aperta esce dallo schermo");
    }
    for (const i of importi) {
      if (i.destra > m.larghezza + 1) no(`l'importo ${i.testo} esce dallo schermo`);
      if (i.coperto) no(`l'importo ${i.testo} è fuori dal suo riquadro: si vede solo scorrendo`);
    }
  }

  if (m.pagina === "agenda") {
    if (!m.titoliAgenda?.length) no("nessun titolo di impegno misurato");
    for (const t of m.titoliAgenda ?? []) {
      if (t.w < t.casa * 0.5) no(`il titolo «${t.testo}» ha ${Math.round(t.w)} punti su ${Math.round(t.casa)}: meno di metà della scheda`);
      // Se la parola più lunga ci sta, il titolo va a capo fra le parole o
      // col trattino della sillabazione: mai dove capita.
      if (t.larga > t.w + 0.5) no(`«${t.parola}» chiede ${Math.round(t.larga)} punti e il titolo ne ha ${Math.round(t.w)}: si spezza a metà`);
      if (t.destra > m.larghezza + 1) no(`il titolo «${t.testo}» esce dallo schermo`);
    }
  }

  if (m.pagina === "salaorari") {
    const iso = (m.testo ?? "").match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (iso) no(`una data si legge come ${iso[0]}`);
    if (!/24 dic 2026/.test(m.testo ?? "")) no("la chiusura delle feste non si legge come «24 dic 2026»");
  }

  if (m.pagina === "ingrediente") {
    for (const c of m.scritteNeiCampi ?? []) {
      if (c.serve > c.posto + 0.5) no(`«${c.testo}» chiede ${Math.round(c.serve)} punti e il campo ne ha ${Math.round(c.posto)}`);
    }
    if (m.resaRighe == null) no("la riga «ne restano» della resa non c'è");
    else if (m.resaRighe > 2) no(`«ne restano» va su ${m.resaRighe} righe`);
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

// --- Il «?» della Prima nota, toccato davvero (27/09/2026) --------------
// Sul telefono e sul tablet un tocco vero (`Input.dispatchTouchEvent`, che
// produce la sequenza di eventi di un dito); sul computer il passaggio del
// mouse, che è il modo in cui lì si apre. Poi si guarda se la spiegazione
// c'è, cosa dice e se sta dentro lo schermo.
async function toccaIlPerche(manda, forma) {
  const dove = await valuta(
    manda,
    // ⚠️ Il primo visibile, non il primo della pagina: le schede e la
    //    tabella stanno tutte e due nel documento, e una delle due è nascosta.
    `(() => { const q = [...document.querySelectorAll('[data-prova="investimento-no"] button[aria-label]')].find((b) => b.getBoundingClientRect().width > 0); if (!q) return null; q.scrollIntoView({ block: "center" }); const b = q.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`,
  ).catch(() => null);
  if (!dove) return null;
  await aspetta(150);
  if (forma.mobile) {
    await manda("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: dove.x, y: dove.y }] });
    await manda("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await manda("Input.dispatchMouseEvent", { type: "mouseMoved", x: dove.x, y: dove.y });
  }
  await aspetta(300);
  return valuta(
    manda,
    `(() => { const t = document.querySelector('[role="tooltip"]'); if (!t) return { aperta: false }; const b = t.getBoundingClientRect(); return { aperta: b.width > 0, testo: t.textContent.trim(), x: b.left, destra: b.right }; })()`,
  ).catch(() => null);
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
        await pretendiCaratteri(manda, `${pagina} · ${forma.nome}`);
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
          if (pagina === "primanota") m.perche = await toccaIlPerche(manda, forma);
          controlla(forma, m, difetti);
          if (m.titoli?.length) console.log(`   ${pagina} · ${forma.nome}: titoli ${m.titoli.map((t) => `«${t.testo}» ${t.larga}×${t.righe}`).join(", ")}`);
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
