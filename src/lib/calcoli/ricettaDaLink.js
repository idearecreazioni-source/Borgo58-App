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
 * Applica le PROPOSTE dell'assistente (10/10/2026) sopra quello che il
 * lettore ha capito: la categoria, la fase di ogni passaggio, il nome pulito
 * e la nota di ogni ingrediente. Restituisce anche l'elenco di cosa ha
 * proposto, che la bozza dichiara («proposto dall'assistente»).
 *
 * 🔴 I NUMERI NON SI TOCCANO: quantità e unità restano quelle del lettore.
 * ⚠️ Le proposte arrivano gia' controllate dalla funzione online
 *    (`proposte.ts`); qui si applicano solo se le righe combaciano, e un
 *    nome vuoto lascia quello del lettore.
 */
export function applicaProposte(letta, proposte) {
  const fatte = [];
  if (!proposte) return { ...letta, proposte: fatte };
  const bozza = { ...letta.bozza };
  let ingredienti = letta.ingredienti;
  let passaggi = letta.passaggi;

  if (proposte.categoria) {
    bozza.categoria = proposte.categoria;
    fatte.push("la categoria");
  }
  if (Array.isArray(proposte.fasi) && proposte.fasi.length === passaggi.length && proposte.fasi.some(Boolean)) {
    passaggi = passaggi.map((p, i) => ({ ...p, fase: proposte.fasi[i] ?? null }));
    fatte.push("le fasi dei passaggi");
  }
  if (Array.isArray(proposte.ingredienti) && proposte.ingredienti.length === ingredienti.length) {
    let cambiati = false;
    ingredienti = ingredienti.map((r, i) => {
      const p = proposte.ingredienti[i] ?? {};
      const nome = p.nome ? p.nome : r.nome;
      // La nota del lettore («q.b.») non si perde: si affianca a quella proposta.
      const note = [r.nota, p.nota].filter(Boolean);
      const nota = note.length ? [...new Set(note)].join(" · ") : null;
      if (nome !== r.nome || nota !== r.nota) cambiati = true;
      return { ...r, nome, nota };
    });
    if (cambiati) fatte.push("i nomi degli ingredienti");
  }
  return { ...letta, bozza, ingredienti, passaggi, proposte: fatte };
}

/**
 * La bozza candidata: quello che il lettore ha capito, con origine «link»
 * e il link come riferimento, e sopra le proposte dell'assistente se ci
 * sono. Se il lettore rifiuta, il suo motivo.
 */
export function bozzaDaRicettaLetta(ricetta, url, proposte = null) {
  const grezza = bozzaDaTesto(testoDellaRicetta(ricetta));
  if (!grezza.ok) return grezza;
  const letta = applicaProposte(grezza, proposte);
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
      proposte_assistente: letta.proposte,
    },
  };
}
