import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ambienteCorrente } from "../lib/ambiente";
import { getPxCm } from "../lib/touch";
import { improntaDiQuestaPagina } from "../lib/versione";

// Il quaderno si apre e si chiude da qui; il momento si fotografa ALL'APERTURA
// (vedi la nota in cima a Segnala.jsx). In un file a sé perché un file di
// componenti che esporta anche un hook spegne il ricaricamento rapido.
function momentoDiAdesso(location) {
  const main = document.querySelector("main");
  const ambiente = ambienteCorrente();
  return {
    indirizzo: `${location.pathname}${location.search}`,
    titolo: main?.querySelector("h1")?.innerText ?? document.title,
    testo: main?.innerText ?? "",
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
