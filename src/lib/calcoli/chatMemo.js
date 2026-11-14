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
    .filter((rif) => /^[PCFAM]\d+$/.test(rif));
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
