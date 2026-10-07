// UNA BOZZA DI RICETTA DA UN TESTO INCOLLATO — il nucleo offline (Fase 1B).
//
// Riceve SOLO testo già in memoria (quello che qualcuno ha incollato) e lo
// trasforma in una bozza CANDIDATA, nella forma delle tabelle della Fase 1A
// (migrazione 20261006000001: `bozze_ricetta`, `_ingredienti`, `_passaggi`).
// Non salva niente, non apre niente, non chiama niente: è una funzione pura,
// e stesso testo dà sempre la stessa bozza.
//
// 🔴 SI ESTRAE SOLO CIÒ CHE È SCRITTO. Niente quantità, unità, tempi,
//    temperature, ingredienti, passaggi, titolo o porzioni che il testo non
//    dica in modo esplicito. Quello che manca, o che si potrebbe leggere in
//    due modi, diventa un BUCO dichiarato — mai un valore plausibile:
//      · «2 uova»        → quantità 2, unità VUOTA (non «pz»: non è scritto);
//      · «sale q.b.»     → quantità vuota, e un buco che lo dice;
//      · «2-3 patate»    → quantità vuota: fra due numeri non si sceglie;
//      · «2 confezioni da 125 g» → quantità vuota: due numeri, due letture;
//      · «due uova»      → quantità vuota: un numero in lettere non si indovina;
//      · «200 ml»        → unità «ml» com'è scritta: convertirla in litri
//                          sarebbe un calcolo che nessuno ha chiesto.
//    Le uniche trasformazioni sono SINONIMI dello stesso codice («grammi» →
//    «g»), mai conversioni fra unità.
//
// 🔴 UN INDIRIZZO NON SI SEGUE. Un testo che è solo un link viene rifiutato:
//    leggerlo vorrebbe dire aprire una pagina, e questo nucleo non apre
//    niente. Un link dentro un testo vero si conserva come riferimento
//    d'origine, e non si visita.
//
// ⚠️ SENZA LE INTESTAZIONI NON SI INDOVINA COSA È INGREDIENTE E COSA PASSAGGIO.
//    Le sezioni si riconoscono solo da un'intestazione esplicita
//    («Ingredienti», «Procedimento», …). Le righe che non stanno sotto
//    nessuna restano «non classificate», tutte, e diventano un buco da
//    rivedere a mano.
//
// ⚠️ NIENTE `import`, apposta: un modulo che non importa niente non può
//    raggiungere rete, database o disco per una strada laterale. La prova lo
//    controlla leggendo questo file.

/** Oltre questa lunghezza il testo si rifiuta: non è una ricetta incollata. */
export const LUNGHEZZA_MASSIMA = 20000;

const INDIRIZZO = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const SOLO_INDIRIZZO = /^(?:(?:https?:\/\/|www\.)[^\s<>"]+\s*)+$/i;

const SEZIONE_INGREDIENTI = /^(?:ingredienti|ingredients)(?:\s+(?:per\b.*|occorrenti))?\s*:?$/i;
const SEZIONE_PASSAGGI =
  /^(?:procedimento|preparazione|passaggi|istruzioni|metodo|esecuzione|come si fa)\s*:?$/i;
// ⚠️ Solo una riga che dice SOLO le porzioni: «Per 10 minuti cuocere» non deve
//    diventare «10 porzioni».
const PORZIONI =
  /^(?:dosi per|dose per|per|porzioni|persone|serve|servono)\s*:?\s*([\d\s\-–—oa]+?)\s*(?:persone|porzioni|pax|coperti)?\.?$/i;

// Solo sinonimi dello stesso codice. Ciò che non è qui resta scritto com'è.
const SINONIMI_UNITA = {
  g: "g", gr: "g", grammo: "g", grammi: "g",
  kg: "kg", chilo: "kg", chili: "kg", chilogrammo: "kg", chilogrammi: "kg",
  l: "l", litro: "l", litri: "l", lt: "l",
  pz: "pz", pezzo: "pz", pezzi: "pz",
  mazzo: "mazzo", mazzi: "mazzo", mazzetto: "mazzo",
  conf: "conf", confezione: "conf", confezioni: "conf",
};

// Parole di misura che si riconoscono come UNITÀ (non come ingrediente) ma
// che il gestionale non conosce: restano scritte, e a valle sono un buco
// («unità non compresa»).
const MISURE_NON_CODIFICATE = new Set([
  "ml", "cl", "dl", "mg", "cucchiaio", "cucchiai", "cucchiaino", "cucchiaini",
  "bicchiere", "bicchieri", "tazza", "tazze", "pizzico", "pizzichi", "spicchio",
  "spicchi", "foglia", "foglie", "rametto", "rametti", "fetta", "fette",
  "manciata", "manciate", "noce", "noci", "bustina", "bustine", "barattolo",
  "barattoli", "lattina", "lattine", "scatola", "scatole", "vasetto", "vasetti",
  "goccio", "gocce", "filo", "ciuffo", "ciuffi", "costa", "coste", "cubetto", "cubetti",
]);

const QB = /\b(?:q\.?\s*b\.?|quanto basta)(?=\s|[.,;:)]|$)/i;
const NUMERO = String.raw`\d+(?:[.,]\d+)?(?:\/\d+)?`;
const INTERVALLO = new RegExp(String.raw`${NUMERO}\s*(?:-|–|—|o|a)\s*${NUMERO}`, "i");
const NUMERI_IN_LETTERE =
  /\b(?:mezz[oa]|un[oa]?|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|dodici|venti|trenta|cento)\b/i;

const pulisci = (riga) => riga.replace(/\s+/g, " ").trim();

/** Toglie il segno d'elenco: «- », «• », «* », «1. », «1) », «Passo 1:». */
function senzaSegno(riga) {
  return riga
    .replace(/^(?:[-–—*•·▪◦]+\s*)/, "")
    .replace(/^(?:passo|step|fase)\s*\d+\s*[:.)-]\s*/i, "")
    .replace(/^\d+\s*[.)]\s+/, "")
    .trim();
}

function numeroDa(testo) {
  const t = testo.replace(",", ".");
  if (t.includes("/")) {
    const [a, b] = t.split("/").map(Number);
    return b > 0 ? a / b : null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const senzaDi = (nome) => nome.replace(/^(?:di|d['’])\s*/i, "").replace(/^[:,\s-]+|[:,\s-]+$/g, "").trim();

/**
 * Una riga d'ingrediente. Ritorna la riga candidata e gli eventuali buchi
 * che la riguardano.
 */
function leggiIngrediente(originale) {
  const riga = senzaSegno(originale);
  const buchi = [];
  const base = { testo_originale: originale, nome: riga, quantita: null, unita: null, ingredient_id: null, nota: null };

  if (QB.test(riga)) {
    const nome = senzaDi(riga.replace(QB, "").replace(/\s+/g, " "));
    const n = nome || riga;
    buchi.push(`«${n}»: «q.b.» non è una quantità`);
    return { riga: { ...base, nome: n, nota: "q.b." }, buchi };
  }

  if (INTERVALLO.test(riga)) {
    buchi.push(`«${riga}»: la quantità è un intervallo, va scelta`);
    return { riga: base, buchi };
  }

  const numeri = riga.match(new RegExp(NUMERO, "g")) ?? [];
  if (numeri.length > 1) {
    buchi.push(`«${riga}»: più di un numero, la quantità va scelta`);
    return { riga: base, buchi };
  }

  if (numeri.length === 0) {
    if (NUMERI_IN_LETTERE.test(riga)) {
      buchi.push(`«${riga}»: la quantità è scritta in lettere, va riscritta in cifre`);
    }
    return { riga: base, buchi };
  }

  // Un numero solo: «200 g di farina», «200g farina», «farina 200 g»,
  // «farina: 200 g», «2 uova», «uova 2».
  const forma = new RegExp(String.raw`^(.*?)(${NUMERO})\s*([a-zàèéìòù.]+)?\s*(.*)$`, "i");
  const m = riga.match(forma);
  const prima = m[1];
  const quantita = numeroDa(m[2]);
  let parola = (m[3] ?? "").toLowerCase().replace(/\.$/, "");
  let dopo = m[4] ?? "";

  let unita = null;
  if (parola && SINONIMI_UNITA[parola]) unita = SINONIMI_UNITA[parola];
  else if (parola && MISURE_NON_CODIFICATE.has(parola)) unita = parola;
  else if (parola) dopo = `${m[3]} ${dopo}`; // non è un'unità: è il nome

  const nome = senzaDi(pulisci(`${prima} ${dopo}`));
  if (!nome) {
    buchi.push(`«${riga}»: manca il nome dell'ingrediente`);
    return { riga: base, buchi };
  }
  if (quantita === null) {
    buchi.push(`«${riga}»: la quantità non si legge`);
  }
  return { riga: { ...base, nome, quantita, unita }, buchi };
}

function leggiPorzioni(resto) {
  if (INTERVALLO.test(resto)) return { porzioni: null, buco: `porzioni indicate come intervallo («${resto}»), vanno scelte` };
  const numeri = resto.match(/\d+/g) ?? [];
  if (numeri.length === 1 && Number(numeri[0]) > 0 && !/[.,/]\d/.test(resto)) {
    return { porzioni: Number(numeri[0]), buco: null };
  }
  return { porzioni: null, buco: `porzioni non leggibili («${resto}»)` };
}

/**
 * Il nucleo. Ritorna sempre uno di due esiti:
 *   { ok: false, motivo, messaggio }      — testo non elaborabile offline;
 *   { ok: true, bozza, ingredienti, passaggi, non_classificate }
 *
 * `bozza` ha i campi di `bozze_ricetta` (titolo, origine_tipo,
 * origine_riferimento, sunto, categoria, porzioni, buchi_dichiarati);
 * `ingredienti` e `passaggi` quelli delle tabelle righe, con `posizione`.
 * ⚠️ `titolo` può essere VUOTO (null): la tabella lo pretende, e chi salva la
 *    bozza deve farlo scrivere a una persona invece di inventarlo.
 */
export function bozzaDaTesto(testo) {
  if (typeof testo !== "string") {
    return { ok: false, motivo: "non_testo", messaggio: "Serve un testo." };
  }
  const intero = testo.replace(/\r\n?/g, "\n").trim();
  if (intero === "") {
    return { ok: false, motivo: "vuoto", messaggio: "Il testo è vuoto: non c'è niente da leggere." };
  }
  if (intero.length > LUNGHEZZA_MASSIMA) {
    return {
      ok: false,
      motivo: "troppo_lungo",
      messaggio: `Il testo è più lungo di ${LUNGHEZZA_MASSIMA} caratteri: non sembra una ricetta incollata.`,
    };
  }
  if (SOLO_INDIRIZZO.test(intero)) {
    return {
      ok: false,
      motivo: "solo_indirizzo",
      messaggio:
        "C'è solo un indirizzo: per leggerlo bisognerebbe aprire la pagina, e qui non si apre niente. Incolla il testo della ricetta.",
    };
  }

  const riferimento = (intero.match(INDIRIZZO) ?? [])[0] ?? null;
  const buchi = [];
  const ingredienti = [];
  const passaggi = [];
  const nonClassificate = [];
  let titolo = null;
  let porzioni = null;
  let sezione = null;
  let vistaUnaSezione = false;

  for (const grezza of intero.split("\n")) {
    const riga = pulisci(grezza);
    if (riga === "") continue;
    const senzaLink = pulisci(riga.replace(INDIRIZZO, ""));
    if (senzaLink === "") continue; // una riga che è solo un link: è il riferimento

    if (SEZIONE_INGREDIENTI.test(senzaLink)) {
      sezione = "ingredienti";
      vistaUnaSezione = true;
      continue;
    }
    if (SEZIONE_PASSAGGI.test(senzaLink)) {
      sezione = "passaggi";
      vistaUnaSezione = true;
      continue;
    }
    const p = senzaLink.match(PORZIONI);
    if (p && sezione !== "passaggi" && /\d/.test(p[1])) {
      const letta = leggiPorzioni(p[1]);
      if (porzioni === null && letta.porzioni !== null) porzioni = letta.porzioni;
      else if (letta.buco) buchi.push(letta.buco);
      else if (porzioni !== letta.porzioni) buchi.push(`porzioni indicate due volte in modo diverso`);
      continue;
    }

    if (sezione === "ingredienti" && /:$/.test(senzaLink)) {
      // «Per la crema:» è un sottotitolo, non un ingrediente.
      nonClassificate.push(senzaLink);
    } else if (sezione === "ingredienti") {
      const { riga: r, buchi: b } = leggiIngrediente(senzaLink);
      ingredienti.push({ posizione: ingredienti.length + 1, ...r });
      buchi.push(...b);
    } else if (sezione === "passaggi") {
      const descrizione = senzaSegno(senzaLink);
      if (descrizione) passaggi.push({ posizione: passaggi.length + 1, fase: null, descrizione });
    } else if (titolo === null && !vistaUnaSezione) {
      // Il titolo è la PRIMA riga, prima di qualunque sezione, e solo se
      // è corta come un titolo. Una frase lunga non si spaccia per titolo.
      if (senzaLink.length <= 80 && !/[.!?]$/.test(senzaLink)) titolo = senzaLink.replace(/:$/, "");
      else nonClassificate.push(senzaLink);
    } else {
      nonClassificate.push(senzaLink);
    }
  }

  if (titolo === null) buchi.unshift("manca il titolo: va scritto a mano");
  if (!vistaUnaSezione) {
    buchi.push("non trovo le intestazioni «Ingredienti» e «Procedimento»: le righe vanno smistate a mano");
  }
  if (nonClassificate.length > 0) {
    buchi.push(`${nonClassificate.length} righe fuori da ogni sezione, da rivedere`);
  }

  return {
    ok: true,
    bozza: {
      titolo,
      origine_tipo: "testo",
      origine_riferimento: riferimento,
      sunto: null,
      categoria: null,
      porzioni,
      buchi_dichiarati: buchi,
    },
    ingredienti,
    passaggi,
    non_classificate: nonClassificate,
  };
}
