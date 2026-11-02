import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ambienteCorrente } from "../lib/ambiente";
import { getPxCm } from "../lib/touch";
import { improntaDiQuestaPagina } from "../lib/versione";

// Il quaderno si apre e si chiude da qui; il momento si fotografa ALL'APERTURA
// (vedi la nota in cima a Segnala.jsx). In un file a sé perché un file di
// componenti che esporta anche un hook spegne il ricaricamento rapido.
// ⚠️ Il titolo si legge SENZA i pulsanti che ha dentro: il «?» della
//    didascalia finiva nel titolo («Cassa, Banca e Prima Nota ?»), visto
//    il 25/10 aprendo la schermata sulla prova.
// ⚠️ E senza i contatori marcati `data-contatore` (28/10/2026): il
//    numerino verde accanto ad «Agenda» si attaccava al titolo, «Agenda17».
//    Solo quelli marcati: un titolo come «Bilancio 2026» il suo numero lo
//    tiene.
function titoloDi(h1) {
  if (!h1) return null;
  const copia = h1.cloneNode(true);
  copia.querySelectorAll("button, [data-contatore]").forEach((b) => b.remove());
  return copia.textContent.replace(/\s+/g, " ").trim() || null;
}

// ⚠️ E dal testo si toglie ciò che è marcato `data-fuori-dalla-foto`: sul
//    computer il pulsante «Segnala» sta dentro <main>, e la fotografia
//    cominciava con la sua stessa parola.
function testoDi(main) {
  if (!main) return "";
  let testo = main.innerText ?? "";
  main.querySelectorAll("[data-fuori-dalla-foto]").forEach((el) => {
    const via = el.innerText;
    if (via) testo = testo.replace(via, "");
  });
  const campi = campiDi(main);
  return campi.length ? `${testo}\n— Nei campi —\n${campi.join("\n")}` : testo;
}

// 🔴 COSA C'È SCRITTO NEI CAMPI (28/10/2026). Il testo della pagina non lo
//    comprende: nella prima segnalazione il titolo «comprare il pane»
//    compariva solo perché lo ripeteva la domanda di conferma, e il campo
//    TITOLO risultava vuoto. ⚠️ Mai le password né i campi riservati (dalla
//    revisione di sicurezza: un PIN, un IBAN, una chiave resterebbero
//    scritti per sempre in una segnalazione), e i campi vuoti no.
const RISERVATO = /pin|iban|token|chiave|segret|secret|password|cvv|codice.?fiscale/i;

function riservato(el, tipo) {
  if (["password", "hidden", "file", "submit", "button"].includes(tipo)) return true;
  if (el.closest("[data-riservato]")) return true;
  const auto = (el.getAttribute("autocomplete") ?? "").toLowerCase();
  if (/^cc-|one-time-code|password/.test(auto)) return true;
  const nomi = [el.getAttribute("name"), el.id, el.getAttribute("aria-label"), el.labels?.[0]?.innerText]
    .filter(Boolean)
    .join(" ");
  return RISERVATO.test(nomi);
}

function nomeDelCampo(el) {
  const etichetta = (el.labels?.[0]?.innerText ?? "").split("\n")[0].trim();
  const nome =
    etichetta || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "campo";
  return String(nome).replace(/\s+/g, " ").trim().slice(0, 80);
}

function campiDi(main) {
  const righe = [];
  main.querySelectorAll("input, textarea, select").forEach((el) => {
    if (el.closest("[data-fuori-dalla-foto]")) return;
    const tipo = (el.getAttribute("type") ?? "").toLowerCase();
    if (riservato(el, tipo)) return;
    let valore;
    if (tipo === "checkbox" || tipo === "radio") {
      if (!el.checked) return;
      valore = "sì";
    } else if (el.tagName === "SELECT") {
      valore = el.selectedOptions?.[0]?.textContent ?? el.value;
    } else {
      valore = el.value;
    }
    valore = String(valore ?? "").replace(/\s+/g, " ").trim();
    if (!valore) return;
    righe.push(`${nomeDelCampo(el)}: ${valore.slice(0, 300)}`);
  });
  return righe;
}

function momentoDiAdesso(location) {
  const main = document.querySelector("main");
  const ambiente = ambienteCorrente();
  return {
    indirizzo: `${location.pathname}${location.search}`,
    titolo: titoloDi(main?.querySelector("h1")) ?? document.title,
    testo: testoDi(main),
    larghezza: window.innerWidth,
    altezza: window.innerHeight,
    pxcm: Math.round(getPxCm() * 100) / 100,
    database: ambiente.nome,
    versione: improntaDiQuestaPagina(),
  };
}

/**
 * `scatto` è l'immagine della pagina (28/10/2026):
 *   null                         · il riquadro è chiuso
 *   { stato: "in_corso" }        · si sta facendo
 *   { stato: "pronto", blob, url, tagliata }
 *   { stato: "fallito", errore } · la segnalazione parte senza, e lo dice
 *   { stato: "tolta" }           · tolta da chi segnala
 *
 * ⚠️ Si comincia nello stesso tocco che apre il riquadro, così l'immagine è
 *    la pagina di quel momento. Il riquadro si apre mentre l'immagine si fa,
 *    ma ne resta fuori (`data-fuori-dalla-foto`).
 * ⚠️ `giro` scarta l'immagine di un riquadro già chiuso: senza, chiudere e
 *    riaprire in fretta allegava la pagina di prima.
 */
export function useSegnala() {
  const location = useLocation();
  const [momento, setMomento] = useState(null);
  const [scatto, setScatto] = useState(null);
  const giro = useRef(0);
  const urlAttuale = useRef(null);

  const lasciaUrl = useCallback(() => {
    if (urlAttuale.current) URL.revokeObjectURL(urlAttuale.current);
    urlAttuale.current = null;
  }, []);

  // Smontato (l'uscita) mentre l'immagine si fa: il giro si chiude, così
  // l'immagine che arriva dopo non crea un indirizzo che nessuno libera.
  useEffect(
    () => () => {
      giro.current += 1;
      lasciaUrl();
    },
    [lasciaUrl],
  );

  const chiudi = useCallback(() => {
    giro.current += 1;
    lasciaUrl();
    setScatto(null);
    setMomento(null);
  }, [lasciaUrl]);

  const apri = () => {
    if (momento) {
      chiudi();
      return;
    }
    setMomento(momentoDiAdesso(location));
    const questo = (giro.current += 1);
    setScatto({ stato: "in_corso" });
    import("../lib/scattoPagina")
      .then((m) => m.scattaPagina())
      .then(({ blob, tagliata }) => {
        if (questo !== giro.current) return;
        lasciaUrl();
        urlAttuale.current = URL.createObjectURL(blob);
        setScatto({ stato: "pronto", blob, url: urlAttuale.current, tagliata });
      })
      .catch((e) => {
        if (questo !== giro.current) return;
        setScatto({
          stato: "fallito",
          errore: e?.message || "Non sono riuscito a fare l'immagine della pagina.",
        });
      });
  };

  // ⚠️ Se un invio è già fallito dopo aver caricato il file, togliendo
  //    l'immagine quel file resta nel deposito senza riga: non dà fastidio,
  //    e lo trova `npm run deposito:orfani`.
  const togliImmagine = () => {
    lasciaUrl();
    setScatto({ stato: "tolta" });
  };

  return { aperto: momento !== null, momento, scatto, apri, chiudi, togliImmagine };
}
