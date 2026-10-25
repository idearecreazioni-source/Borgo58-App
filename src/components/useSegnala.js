import { useState } from "react";
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
function titoloDi(h1) {
  if (!h1) return null;
  const copia = h1.cloneNode(true);
  copia.querySelectorAll("button").forEach((b) => b.remove());
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
  return testo;
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

export function useSegnala() {
  const location = useLocation();
  const [momento, setMomento] = useState(null);
  return {
    aperto: momento !== null,
    momento,
    apri: () => setMomento((m) => (m ? null : momentoDiAdesso(location))),
    chiudi: () => setMomento(null),
  };
}
