import { nomeDellaPartenza } from "./ritornoMemo";

// Il contesto serve alla chat, non alla voce: la voce continua a interpretare
// una frase nello stesso modo da qualunque schermata.
export function contestoDellaChat(location, moduli = []) {
  const percorso = String(location?.pathname ?? "/");
  const nome = nomeDellaPartenza(percorso, moduli);
  return {
    aperta_da_percorso: percorso,
    aperta_da_modulo: nome ?? "Schermata attuale",
  };
}

// I riferimenti sono l'unica forma che il pannello mostra: la funzione puo'
// restituire anche il nome tecnico della tabella per il proprio storico, ma
// quello non e' un'informazione utile a chi legge.
export function riferimentiBrevi(riferimenti) {
  return (riferimenti ?? [])
    .map((r) => String(r?.rif ?? "").replaceAll("[", "").replaceAll("]", "").trim())
    .filter((rif) => /^[PCFAMBRHIDE]\d+$/.test(rif));
}

export function partiDellaRisposta(testo, riferimenti = []) {
  let corpo = String(testo ?? "").trim();
  let dove = "";
  let controllalo = "";

  const fonte = /\n*Dove l'ho letto:\s*([^\n]+)\.?\s*$/i.exec(corpo);
  if (fonte) {
    dove = fonte[1].trim().replace(/\.$/, "");
    corpo = corpo.slice(0, fonte.index).trim();
  }

  const avviso = /\n*Controllalo:\s*([^\n]+)\s*$/i.exec(corpo);
  if (avviso) {
    controllalo = avviso[1].trim();
    corpo = corpo.slice(0, avviso.index).trim();
  }

  const brevi = riferimentiBrevi(riferimenti);
  if (brevi.length) dove = brevi.map((rif) => `[${rif}]`).join(", ");
  return { testo: corpo, dove, controllalo };
}

export function titoloDellaConversazione(conversazione) {
  const titolo = String(conversazione?.titolo ?? "").replace(/\s+/g, " ").trim();
  const primaDomanda = [...(conversazione?.memo_messaggi ?? [])]
    .filter((messaggio) => messaggio?.ruolo === "alessio")
    .sort((a, b) => String(a.creato_il ?? "").localeCompare(String(b.creato_il ?? "")))[0]?.testo;
  const sorgente = titolo || String(primaDomanda ?? "").replace(/\s+/g, " ").trim();
  if (!sorgente) return "Conversazione senza domanda";
  return sorgente.length > 72 ? `${sorgente.slice(0, 71).trimEnd()}…` : sorgente;
}

export function dataDellaConversazione(data) {
  const quando = new Date(data);
  if (Number.isNaN(quando.getTime())) return "data non disponibile";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(quando);
}
