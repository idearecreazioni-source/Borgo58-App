import { bozzaDaTesto } from "./ricettaDaTesto";

// =====================================================================
// LA BOZZA DA UNA RICETTA LETTA DA UN LINK — 10/10/2026
// =====================================================================
// La funzione online `ricetta-da-link` restituisce la ricetta che la pagina
// dichiara: titolo, porzioni, righe degli ingredienti e passaggi, ancora
// come testo. Qui diventa una bozza candidata.
//
// 🔴 LE RIGHE SI SMONTANO COL LETTORE DELL'ANTEPRIMA DA TESTO, non con una
//    regola nuova: si ricompone il testo con le intestazioni che quel
//    lettore riconosce («Ingredienti», «Procedimento») e gli si passa. Cosi'
//    «6 g gelatina» e «sale q.b.» diventano la stessa quantita' e lo stesso
//    buco, che arrivino da un link o da un testo incollato. Due regole per
//    la stessa cosa, prima o poi, direbbero due cose diverse.
//
// ⚠️ PURA: niente rete, niente database. Si prova in
//    tests/unita/ricetta-da-link.test.js.
// =====================================================================

/** Le porzioni come le scrive la pagina («4 servings», «4») → il numero, se c'è uno solo. */
export function porzioniDaTesto(grezze) {
  if (grezze == null) return null;
  const numeri = String(grezze).match(/\d+/g) ?? [];
  if (numeri.length !== 1) return null;
  const n = Number(numeri[0]);
  return n > 0 ? n : null;
}

/** Il testo che il lettore dell'anteprima saprebbe leggere. */
export function testoDellaRicetta(ricetta) {
  const righe = [];
  if (ricetta.titolo) righe.push(ricetta.titolo);
  const porzioni = porzioniDaTesto(ricetta.porzioni);
  if (porzioni) righe.push(`Porzioni: ${porzioni}`);
  righe.push("", "Ingredienti");
  for (const i of ricetta.ingredienti ?? []) righe.push(`- ${i}`);
  righe.push("", "Procedimento");
  (ricetta.passaggi ?? []).forEach((p, n) => righe.push(`${n + 1}. ${p}`));
  return righe.join("\n");
}

/**
 * La bozza candidata: quello che il lettore ha capito, con origine «link»
 * e il link come riferimento. Se il lettore rifiuta, il suo motivo.
 */
export function bozzaDaRicettaLetta(ricetta, url) {
  const letta = bozzaDaTesto(testoDellaRicetta(ricetta));
  if (!letta.ok) return letta;
  const buchi = [...letta.bozza.buchi_dichiarati];
  // Il lettore dice «porzioni non scritte» solo se le cerca nel testo: qui la
  // pagina le ha date in una forma che non diventa un numero solo.
  if (ricetta.porzioni && letta.bozza.porzioni == null) {
    buchi.push(`porzioni scritte come «${ricetta.porzioni}»: vanno indicate a mano`);
  }
  return {
    ...letta,
    bozza: {
      ...letta.bozza,
      origine_tipo: "link",
      origine_riferimento: url,
      sunto: ricetta.video ? `Video originale: ${ricetta.video}` : null,
      buchi_dichiarati: buchi,
    },
  };
}
