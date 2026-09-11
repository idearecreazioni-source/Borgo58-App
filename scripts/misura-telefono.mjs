// =====================================================================
// IL CENSIMENTO DEL TELEFONO — `npm run misura:telefono` (11/09/2026)
// =====================================================================
// 🔴 PERCHÉ ESISTE. Il mandato «telefono ordinato» chiede di classificare
//    ogni schermata con campi data/ora o campi stretti affiancati come
//    «corretta» o «da correggere» — e di non dichiararla difettosa senza
//    averla misurata. Rileggere il codice non basta: che una casella esca
//    dipende dalla larghezza vera, dalla densità del telefono e dal testo
//    che ci finisce dentro.
//
// COSA FA. Apre il VERO gestionale, collegato SOLO a Borgo58-Prova, entrato
// come titolare di collaudo (credenziali lette da `.env`, mai stampate), e
// visita ogni rotta dell'elenco qui sotto a iPhone 390, iPhone a 64 punti
// per centimetro e computer. Per ognuna misura:
//   · se la pagina scorre di lato;
//   · se un campo o un pulsante esce dal suo riquadro o dallo schermo;
//   · se una casella di data/ora o un menu è più stretto del suo contenuto
//     (su Safari quel contenuto esce);
//   · se due campi dello stesso riquadro si sovrappongono;
//   · se un'etichetta resta staccata dal suo campo o non gli sta sopra.
// e fotografa. Le fotografie vanno in `%TEMP%/b58-misura-telefono/`.
//
// ⚠️ NON SCRIVE NIENTE, e sceglie le rotte per non far scrivere il
//    gestionale: le schermate che scrivono nel database solo aprendole non
//    sono nell'elenco. Le «preparazioni» toccano solo la schermata (aprono
//    un modulo, impostano un filtro), mai «Salva».
//
// ⚠️ IL LIMITE: è Chrome. Safari dell'iPhone disegna data e ora a modo suo;
//    la misura di quanto spazio chiede il contenuto è l'approssimazione più
//    vicina che si può fare da qui, non l'occhio su un iPhone.
//
// Uso: `npm run misura:telefono`  oppure con alcune rotte:
//      `node scripts/misura-telefono.mjs /fatture-fornitori /cassa/prima-nota`
// =====================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { fermati, leggiConfigurazione, obbligatorio, REF_PRODUZIONE, REF_PROVA } from "./comune.mjs";
import { apriPagina, aspetta, avviaChrome, fotografa, nomeFile, valuta } from "./chrome-senza-schermo.mjs";
import { ROTTE } from "./misura-telefono-rotte.mjs";

const RADICE = process.cwd();
const TOLLERANZA_PX = 1;
const ETICHETTA_STACCATA_CM = 0.6;

const FORME = [
  { nome: "iPhone 390", larghezza: 390, altezza: 844, scala: 3, mobile: true },
  { nome: "iPhone a 64 punti per cm", larghezza: 390, altezza: 844, scala: 3, mobile: true, pxcm: 64 },
  { nome: "computer", larghezza: 1280, altezza: 900, scala: 1, mobile: false },
];

// --- Solo il progetto di prova --------------------------------------------
const cfg = leggiConfigurazione();
const url = obbligatorio(cfg, "PROVA_SUPABASE_URL", "È l'indirizzo del progetto Borgo58-Prova.");
const chiave = obbligatorio(cfg, "PROVA_SUPABASE_ANON_KEY", "È la chiave anon del progetto di prova.");
const riferimento = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\./i)?.[1];
if (url.includes(REF_PRODUZIONE) || riferimento !== REF_PROVA) {
  fermati("FERMO: questo strumento misura solo sul progetto di PROVA (Borgo58-Prova).");
}
const email = obbligatorio(cfg, "TEST_TITOLARE_EMAIL", "L'utente titolare di collaudo del progetto di prova.");
const password = obbligatorio(cfg, "TEST_TITOLARE_PASSWORD", "La sua password, solo in .env.");

const accesso = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: chiave, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!accesso.ok) fermati(`FERMO: l'accesso di collaudo è stato rifiutato (${accesso.status}).`);
const sessione = await accesso.json();
// La sessione si mette dove la cerca il collegamento dell'app, PRIMA che la
// pagina parta: così ogni schermata si apre già entrata, senza PIN.
const SESSIONE = `localStorage.setItem(${JSON.stringify(`sb-${riferimento}-auth-token`)}, ${JSON.stringify(
  JSON.stringify(sessione)
)});`;

// --- Le misure, dentro la pagina --------------------------------------------
const STATO = `(() => ({
  testo: document.body.innerText.length,
  caricando: /Caricamento/.test(document.body.innerText),
  dentro: Boolean(document.querySelector("main")),
  // Cosa si vede al posto della schermata, quando non si è entrati.
  inizio: document.body.innerText.trim().replace(/\\s+/g, " ").slice(0, 90),
  indirizzo: location.pathname,
}))()`;

const MISURA = `(() => {
  const pxcm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pxcm"));
  const radice = document.querySelector("main") || document.body;
  const visibile = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  };
  const trasparente = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
  // Il riquadro di un campo: il primo antenato disegnato (bordo o sfondo)
  // con un margine interno, oppure che taglia quello che sborda.
  const riquadro = (el) => {
    for (let p = el.parentElement; p && p !== radice; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX !== "visible") return p;
      const disegnato = parseFloat(s.borderRightWidth) > 0 || !trasparente(s.backgroundColor);
      if (disegnato && parseFloat(s.paddingRight) > 0) return p;
    }
    return radice;
  };
  const destraUtile = (c) => {
    const r = c.getBoundingClientRect();
    const s = getComputedStyle(c);
    return r.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth);
  };
  // Quanto vorrebbe essere largo: una copia lasciata libera di allargarsi.
  const libera = (e) => {
    const c = e.cloneNode(true);
    if ("value" in e) c.value = e.value;
    c.style.cssText += ";position:absolute;visibility:hidden;width:auto;min-width:0;max-width:none";
    e.parentNode.appendChild(c);
    const w = c.getBoundingClientRect().width;
    c.remove();
    return w;
  };
  const nomeDi = (e) => {
    const perId = e.id && document.querySelector('label[for="' + e.id + '"]');
    const l = perId || e.closest("label") || (e.parentElement && e.parentElement.querySelector(":scope > label"));
    const t = l ? l.textContent : e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.textContent || e.type || "";
    return t.trim().replace(/\\s+/g, " ").slice(0, 40);
  };
  const riquadri = [];
  const SEL = 'input[type=date],input[type=time],input[type=datetime-local],input[type=month],select,input[type=number],input[type=text],input[type=search],input[type=email],input[type=tel],input:not([type]),textarea,button';
  // ⚠️ Un pulsante scritto come testo (senza bordo né sfondo) si vede per
  //    il suo TESTO: \`tocco-testo\` allarga l'area del dito con un margine
  //    negativo, e misurando la scatola risultava «fuori» di 8 punti.
  const scatolaVista = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    const nudo = e.tagName === "BUTTON" && parseFloat(s.borderRightWidth) === 0 && trasparente(s.backgroundColor);
    if (!nudo) return r;
    const pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight);
    return { left: r.left + pl, right: r.right - pr, top: r.top, bottom: r.bottom, width: r.width - pl - pr, height: r.height };
  };
  const campi = [...radice.querySelectorAll(SEL)].filter(visibile).map((e) => {
    const r = scatolaVista(e);
    const c = riquadro(e);
    if (!riquadri.includes(c)) riquadri.push(c);
    const tipo = e.tagName === "SELECT" ? "menu" : e.tagName === "TEXTAREA" ? "testo lungo" : e.tagName === "BUTTON" ? "pulsante" : e.type || "testo";
    // ⚠️ Solo data e ora: di un menu si vede la voce scelta, e misurare la
    //    voce più lunga dell'elenco segnalava un «taglio» che nessuno vede.
    const dataOra = /^(date|time|datetime-local|month)$/.test(e.type);
    return {
      tipo, nome: nomeDi(e), dataOra,
      sinistra: r.left, destra: r.right, alto: r.top, basso: r.bottom, larga: r.width, alta: r.height,
      riquadro: riquadri.indexOf(c), destraUtile: destraUtile(c),
      // Dentro un riquadro che scorre di lato (una tabella larga): quello che
      // sta oltre il bordo si raggiunge scorrendo. È un'altra famiglia, e si
      // conta a parte invece di mescolarla ai campi che escono.
      scorre: /^(auto|scroll)$/.test(getComputedStyle(c).overflowX),
      vorrebbe: dataOra ? libera(e) : null,
      tagliato: e.tagName === "BUTTON" ? e.scrollWidth > e.clientWidth + 1 : false,
    };
  });
  const etichette = [...radice.querySelectorAll("label")].filter(visibile).flatMap((l) => {
    if (l.querySelector("input,select,textarea")) return [];
    // Il campo di un'etichetta: quello a cui punta, oppure quello che la
    // SEGUE. ⚠️ Non «il primo del contenitore»: un'etichetta usata come
    // titoletto di una sezione (Promemoria Telegram) veniva abbinata alla
    // prima casella sotto la sottoetichetta, e risultava «staccata».
    const dopo = l.nextElementSibling;
    const f = l.htmlFor
      ? document.getElementById(l.htmlFor)
      : dopo && (dopo.matches("input,select,textarea") ? dopo : !dopo.querySelector("label") && dopo.querySelector("input,select,textarea"));
    if (!f || !visibile(f)) return [];
    const a = l.getBoundingClientRect();
    const b = f.getBoundingClientRect();
    return [{ testo: l.textContent.trim().replace(/\\s+/g, " ").slice(0, 40), eSinistra: a.left, eBasso: a.bottom, cSinistra: b.left, cAlto: b.top }];
  });
  // Le righe di campi della regola comune (\`riga-campi\`, SPEC-0010): per
  // ogni cella, dove sta e dove sta il suo campo.
  const righeCampi = [...radice.querySelectorAll(".riga-campi")].filter(visibile).map((c) => {
    const rc = c.getBoundingClientRect();
    const s = getComputedStyle(c);
    return {
      sinistraUtile: rc.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth),
      celle: [...c.children].filter(visibile).map((x) => {
        const r = x.getBoundingClientRect();
        const campo = x.matches("input,select,textarea,button") ? x : x.querySelector("input,select,textarea,button");
        const f = campo ? campo.getBoundingClientRect() : r;
        return {
          nome: (campo && nomeDi(campo)) || x.textContent.trim().slice(0, 30),
          gesti: x.classList.contains("riga-campi-gesti"),
          sinistra: r.left, alto: r.top, basso: r.bottom, campoAlto: f.top,
        };
      }),
    };
  });
  return { pxcm, finestra: document.documentElement.clientWidth, paginaLarga: document.documentElement.scrollWidth, campi, etichette, righeCampi };
})()`;

const AIUTI_PREPARA = `
  const clicca = (testo) => {
    const e = [...document.querySelectorAll("button, a, [role=button]")].find(
      (x) => x.textContent.trim().replace(/\\s+/g, " ").startsWith(testo)
    );
    if (e) e.click();
    return Boolean(e);
  };
  const imposta = (el, valore) => {
    if (!el) return false;
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valore);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  const campoEsatto = (etichetta) => {
    const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === etichetta);
    return l && l.parentElement && l.parentElement.querySelector("input, select, textarea");
  };
  const campoDi = (etichetta) => {
    const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim().startsWith(etichetta));
    return l && l.parentElement && l.parentElement.querySelector("input, select, textarea");
  };
`;

function controlla(m) {
  const d = [];
  const cm = (v) => v * m.pxcm;
  if (m.paginaLarga > m.finestra + TOLLERANZA_PX) d.push(`la pagina scorre di lato di ${m.paginaLarga - m.finestra} punti`);
  for (const c of m.campi) {
    if (c.scorre) continue;
    if (c.destra > c.destraUtile + TOLLERANZA_PX) {
      d.push(`${c.tipo} «${c.nome}» esce dal suo riquadro di ${(c.destra - c.destraUtile).toFixed(0)} punti`);
    }
    if (c.vorrebbe != null && c.vorrebbe > c.larga + TOLLERANZA_PX) {
      d.push(`${c.tipo} «${c.nome}» ha ${c.larga.toFixed(0)} punti e il contenuto ne chiede ${c.vorrebbe.toFixed(0)} — si taglia`);
    }
    if (c.tagliato) d.push(`pulsante «${c.nome}»: la scritta non ci sta`);
  }
  for (let i = 0; i < m.campi.length; i++) {
    for (let j = i + 1; j < m.campi.length; j++) {
      const a = m.campi[i];
      const b = m.campi[j];
      if (a.riquadro !== b.riquadro) continue;
      const alto = Math.min(a.basso, b.basso) - Math.max(a.alto, b.alto);
      const largo = Math.min(a.destra, b.destra) - Math.max(a.sinistra, b.sinistra);
      if (alto > 2 && largo > 2) d.push(`«${a.nome}» e «${b.nome}» si sovrappongono (${largo.toFixed(0)}×${alto.toFixed(0)} punti)`);
    }
  }
  // La regola comune delle righe di campi: sulla stessa linea i campi
  // cominciano alla stessa altezza (le celle si allineano in alto, etichetta
  // sopra campo); sul telefono i gesti stanno su una linea loro, dal bordo
  // sinistro dei campi — non accanto all'ultimo campo che capita.
  // ⚠️ L'ALTO, non la base: data, ora e menu nativi hanno altezze proprie
  //    che differiscono di 2–3 punti, e la base li separava anche allineati.
  for (const riga of m.righeCampi ?? []) {
    const linee = [];
    for (const c of riga.celle) {
      const l = linee.find((x) => x.some((y) => Math.min(y.basso, c.basso) - Math.max(y.alto, c.alto) > 2));
      if (l) l.push(c);
      else linee.push([c]);
    }
    for (const l of linee) {
      const campi = l.filter((c) => !c.gesti);
      // ⚠️ Tre punti di tolleranza: un campo senza etichetta si appoggia in
      //    fondo (`self-end`), e menu e date nativi differiscono di 2–3 punti
      //    d'altezza — misurato su Agricolo al computer.
      const alti = campi.map((c) => c.campoAlto);
      if (alti.length > 1 && Math.max(...alti) - Math.min(...alti) > 3) {
        d.push(`riga di campi: ${campi.map((c) => `«${c.nome}»`).join(", ")} non cominciano alla stessa altezza (scarto ${(Math.max(...alti) - Math.min(...alti)).toFixed(0)} punti)`);
      }
      const gesti = l.filter((c) => c.gesti);
      if (m.finestra < 640 && gesti.length && campi.length) {
        d.push(`riga di campi: sul telefono i gesti stanno accanto a ${campi.map((c) => `«${c.nome}»`).join(", ")} invece che su una riga loro`);
      }
      for (const g of gesti) {
        if (m.finestra < 640 && Math.abs(g.sinistra - riga.sinistraUtile) > TOLLERANZA_PX) {
          d.push(`riga di campi: sul telefono «${g.nome}» non parte dal bordo sinistro dei campi (scarto ${(g.sinistra - riga.sinistraUtile).toFixed(0)} punti)`);
        }
      }
    }
  }
  for (const e of m.etichette) {
    const sotto = e.cAlto >= e.eBasso - TOLLERANZA_PX;
    if (!sotto) continue;
    if (Math.abs(e.cSinistra - e.eSinistra) > 2) {
      d.push(`l'etichetta «${e.testo}» non sta sopra il suo campo (scarto ${(e.cSinistra - e.eSinistra).toFixed(0)} punti)`);
    }
    if (e.cAlto - e.eBasso > cm(ETICHETTA_STACCATA_CM)) {
      d.push(`l'etichetta «${e.testo}» è staccata dal suo campo di ${(e.cAlto - e.eBasso).toFixed(0)} punti`);
    }
  }
  return d;
}

// ⚠️ «Pronta» vuol dire DENTRO il gestionale e ferma, non solo ferma: una
//    pagina ancora bianca ha lunghezza zero, e zero per tre giri di fila
//    sembrava una pagina finita (misurato: tre viste su nove «vuote»).
async function aspettaPronta(manda, pubblica = false) {
  let prima = -1;
  let ferme = 0;
  let s = null;
  for (let i = 0; i < 70; i++) {
    await aspetta(300);
    s = await valuta(manda, STATO).catch(() => null);
    if (!s || s.testo === 0 || !(pubblica || s.dentro)) continue;
    if (!s.caricando && s.testo === prima) {
      if (++ferme >= 3) break;
    } else ferme = 0;
    prima = s.testo;
  }
  return s;
}

// --- Il giro ------------------------------------------------------------
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_ANON_KEY = chiave;
const server = await createServer({
  root: RADICE,
  configFile: path.join(RADICE, "vite.config.js"),
  logLevel: "error",
  server: { port: 5287, strictPort: false, host: "127.0.0.1" },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const { porta, chiudi } = await avviaChrome();
const cartella = path.join(os.tmpdir(), "b58-misura-telefono");
mkdirSync(cartella, { recursive: true });

// Un identificativo per le rotte `:id`, letto col token dell'utente di
// collaudo: una lettura sola, sul progetto di prova.
async function unId(tabella) {
  const r = await fetch(`${url}/rest/v1/${tabella}?select=id&limit=1`, {
    headers: { apikey: chiave, Authorization: `Bearer ${sessione.access_token}` },
  });
  if (!r.ok) return null;
  return (await r.json())[0]?.id ?? null;
}

// ⚠️ Git Bash trasforma «/fatture-fornitori» in «C:/Program Files/Git/
//    fatture-fornitori» prima di passarlo a Node: senza questa pulizia il
//    filtro non combacia e girano tutte le schermate. Si accetta anche la
//    rotta scritta senza barra.
const scelte = process.argv.slice(2).map((a) => {
  const pulita = a.replace(/^[A-Za-z]:\/.*?\/Git(?=\/)/, "");
  return pulita.startsWith("/") ? pulita : `/${pulita}`;
});
const rotte = scelte.length ? ROTTE.filter((r) => scelte.includes(r.rotta)) : ROTTE;
const esiti = [];

try {
  for (const r of rotte) {
    for (const forma of FORME) {
      const esito = { rotta: r.rotta, nome: r.nome, forma: forma.nome, difetti: [], nota: null };
      const id = r.id ? await unId(r.id) : null;
      if (r.id && !id) {
        esito.nota = `sul progetto di prova non c'è nessuna riga in ${r.id}`;
        esiti.push(esito);
        console.log(`? ${r.nome} · ${forma.nome} — ${esito.nota}`);
        continue;
      }
      const indirizzo = base + r.rotta.replace(/^\//, "").replace(":id", id ?? "");
      const { ws, manda } = await apriPagina(porta, forma, indirizzo, r.pubblica ? "" : SESSIONE);
      try {
        const s = await aspettaPronta(manda, r.pubblica);
        if (!r.pubblica && !s?.dentro) {
          esito.nota = `la schermata non si è aperta dentro il gestionale (su ${s?.indirizzo ?? "?"} si vede: «${s?.inizio ?? ""}»)`;
        } else {
          if (r.prepara) {
            const fatto = await valuta(manda, `(() => { ${AIUTI_PREPARA} ${r.prepara} })()`);
            if (fatto !== true) esito.nota = `preparazione non riuscita: ${fatto}`;
            await aspettaPronta(manda, r.pubblica);
          }
          const m = await valuta(manda, MISURA);
          esito.difetti = controlla(m);
          esito.inTabelleCheScorrono = m.campi.filter((c) => c.scorre && c.destra > c.destraUtile + TOLLERANZA_PX).length;
          esito.campi = m.campi.filter((c) => c.dataOra).map((c) => `${c.tipo} ${c.larga.toFixed(0)}×${c.alta.toFixed(0)}`);
          esito.foto = await fotografa(manda, path.join(cartella, `${nomeFile(r.nome)}--${nomeFile(forma.nome)}.png`));
        }
      } catch (e) {
        esito.nota = `errore della misura: ${e.message}`;
      }
      esiti.push(esito);
      const segno = esito.nota ? "?" : esito.difetti.length ? "✗" : "✓";
      console.log(`${segno} ${r.nome} · ${forma.nome}${esito.nota ? ` — ${esito.nota}` : ""}${esito.difetti.length ? ` — ${esito.difetti.length} problemi` : ""}`);
      for (const d of esito.difetti) console.log(`     · ${d}`);
      ws.close();
    }
  }
} finally {
  chiudi();
  await server.close();
}

writeFileSync(path.join(cartella, "esito.json"), JSON.stringify(esiti, null, 2));
const conProblemi = esiti.filter((e) => e.difetti.length || e.nota);
console.log(`\nMisurate ${esiti.length} viste (${rotte.length} schermate × ${FORME.length} forme); con problemi o non misurate: ${conProblemi.length}.`);
console.log(`Esito completo: ${path.join(cartella, "esito.json")}`);
process.exit(conProblemi.length ? 1 : 0);
