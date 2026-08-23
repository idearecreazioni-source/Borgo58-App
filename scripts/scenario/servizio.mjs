// LE SERATE VERE — quante ne apre un'osteria in due mesi, e cosa mangia
// davvero un tavolo.
//
// 🔴 DECISIONE DI ALESSIO (23/08/2026), e cambia la taglia dello scenario:
// *«lo scenario deve rispecchiare veramente due mesi di attività senza
// eccezioni. I dati devono essere completi e mai, MAI carenti in nessuno
// degli aspetti che riguardano ogni singolo settore dell'app e
// dell'attività.»*
//
// Quindi la nota «lo scenario è un quinto del vero», scritta il 22/08 come
// limite dichiarato, **non si scrive più: si toglie la causa**.
//
// ---------------------------------------------------------------------
// 🔴 IL DIFETTO CHE QUESTO FILE ESISTE PER TOGLIERE — misurato
// ---------------------------------------------------------------------
// Nello scenario del 22/08, chiesto al database: **ogni cliente ordinava
// esattamente un piatto.**
//
//   coperti | conti | piatti a testa
//         2 |    16 |           0,94
//         3 |    19 |           1,00
//         4 |    12 |           0,92
//         7 |     6 |           1,00
//
// Non è un dettaglio di realismo: è la ragione per cui **tutti i numeri
// del gestionale erano assurdi insieme**.
//
// · scontrino per coperto **15,71 €** a giugno (una persona che ordina un
//   piatto e beve acqua del rubinetto), contro i 35 € del piano;
// · **nessuna bevanda**: 287 righe di cucina e **una** di bar, in due mesi;
// · food cost misurato **5,9%** e **7,5%**, contro il 29% previsto;
// · **tutte le 288 righe di turno 1**: la funzione dei turni, costruita il
//   21/08, non aveva un solo dato addosso;
// · **zero storni**, **zero note sul piatto**, **zero scontrini emessi**.
//
// ⚠️ E un food cost del 6% *resta assurdo sia che il calcolo funzioni sia
// che no* — cioè non poteva mostrare nessun problema. È esattamente la cosa
// che questo scenario esiste per evitare.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// 1 · LA CARTA DELLE BEVANDE
//
// ⚠️ Perché è qui e non fra le ricette: **una bevanda non è una ricetta**
// (`bar_items`, tabella sua). E in comanda ci finisce come TESTO — è quello
// che fa `handleAddBarItem` in Sala — col formato accanto al nome, perché
// al bar la differenza fra un calice e una bottiglia conta.
//
// 🔴 CONSEGUENZA CHE VA DETTA PRIMA CHE QUALCUNO LA SCAMBI PER UN GUASTO:
// una riga senza ricetta il magazzino non la sa scaricare, quindi ogni
// bicchiere di vino finisce in *«cosa non è sceso dal magazzino»* come
// «voce libera». Con due mesi di bevande vere quell'elenco diventa lungo
// centinaia di righe. **Non è un difetto dello scenario: è come si
// comporta il gestionale**, e con lo scenario di ieri — una sola bevanda in
// due mesi — non si poteva vedere.
//
// [sezione, categoria, nome, produttore, formato, prezzo]
// ---------------------------------------------------------------------
export const BEVANDE = [
  // --- vini al calice: quelli che si vendono di più, uno per colore ---
  ["vini", "Bianchi", "Grillo", "Feudo delle Rocche", "calice", 6],
  ["vini", "Bianchi", "Catarratto", "Contrada Bagni", "calice", 5.5],
  ["vini", "Bianchi", "Carricante dell'Etna", "Vigna Nord", "calice", 8],
  ["vini", "Rossi", "Nero d'Avola", "Feudo delle Rocche", "calice", 6],
  ["vini", "Rossi", "Etna Rosso", "Vigna Nord", "calice", 8.5],
  ["vini", "Rossi", "Frappato", "Contrada Bagni", "calice", 6.5],
  ["vini", "Rosati", "Rosato di Nerello", "Vigna Nord", "calice", 6],
  ["vini", "Bollicine", "Spumante brut siciliano", "Casa Marino", "calice", 7],
  // --- e le stesse in bottiglia: il tavolo da quattro ordina così ---
  ["vini", "Bianchi", "Grillo", "Feudo delle Rocche", "bottiglia", 22],
  ["vini", "Bianchi", "Carricante dell'Etna", "Vigna Nord", "bottiglia", 32],
  ["vini", "Bianchi", "Zibibbo secco", "Casa Marino", "bottiglia", 26],
  ["vini", "Rossi", "Nero d'Avola", "Feudo delle Rocche", "bottiglia", 24],
  ["vini", "Rossi", "Etna Rosso", "Vigna Nord", "bottiglia", 34],
  ["vini", "Rossi", "Cerasuolo di Vittoria", "Contrada Bagni", "bottiglia", 29],
  ["vini", "Bollicine", "Spumante brut siciliano", "Casa Marino", "bottiglia", 28],
  ["vini", "Dolci", "Passito di Pantelleria", "Casa Marino", "calice", 7.5],
  // --- bevande ---
  ["bevande", "Acqua", "Acqua naturale", null, "0,75 l", 2.5],
  ["bevande", "Acqua", "Acqua frizzante", null, "0,75 l", 2.5],
  ["bevande", "Birre", "Birra artigianale ambrata", "Birrificio dei Monti", "0,33 l", 5.5],
  ["bevande", "Birre", "Birra chiara alla spina", null, "0,4 l", 5],
  ["bevande", "Analcoliche", "Chinotto", null, "bottiglia", 3],
  ["bevande", "Analcoliche", "Aranciata di Sicilia", null, "bottiglia", 3.5],
  ["bevande", "Caffetteria", "Caffè", null, null, 1.5],
  ["bevande", "Caffetteria", "Caffè corretto", null, null, 2.5],
  ["bevande", "Amari", "Amaro siciliano", null, "bicchierino", 4],
  ["bevande", "Amari", "Grappa di Nerello", null, "bicchierino", 5],
];

// ---------------------------------------------------------------------
// 2 · IL CALENDARIO DELLE SERATE
//
// ⚠️ Gli orari veri di Alessio (`service_hours`, dati suoi): **lunedì
// riposo**, cena da martedì a sabato, **pranzo la domenica**. Il calendario
// li rispecchia invece di inventare una settimana tutta uguale.
//
// ⚠️ E i conti per serata NON sono una media: venerdì e sabato sono pieni,
// martedì e mercoledì vuoti. Se fossero tutti uguali, un conto sbagliato
// darebbe lo stesso risultato di uno giusto — e non si vedrebbe mai la
// differenza fra un fine settimana e un mercoledì, che è la prima cosa che
// un ristoratore guarda.
//
// I numeri, e da dove vengono: un'osteria da 34 coperti fa **150-200 conti
// al mese**. Con questa distribuzione il mese pieno ne fa ~175 e quello
// fiacco ~120 (è aperto da poco, ed è il senso di avere due mesi diversi).
// ---------------------------------------------------------------------

/** Quanti conti apre una serata, per giorno della settimana (0 = domenica). */
export const CONTI_PER_GIORNO = {
  0: { base: 7, servizio: "pranzo" },   // domenica: pranzo di famiglia
  1: null,                              // lunedì: riposo
  2: { base: 4, servizio: "cena" },
  3: { base: 5, servizio: "cena" },
  4: { base: 6, servizio: "cena" },
  5: { base: 9, servizio: "cena" },     // venerdì
  6: { base: 11, servizio: "cena" },    // sabato
};

/**
 * Le serate di un mese, con quanti conti ciascuna.
 *
 * @param {string} mese      "AAAA-MM"
 * @param {number} pienezza  1 = mese pieno, 0,7 = mese fiacco
 * @param {() => number} rnd generatore deterministico
 */
export function serateDelMeseVero(mese, pienezza, rnd) {
  const [anno, m] = mese.split("-").map(Number);
  const giorniNelMese = new Date(anno, m, 0).getDate();
  const serate = [];
  for (let g = 1; g <= giorniNelMese; g++) {
    const data = `${mese}-${String(g).padStart(2, "0")}`;
    const settimana = new Date(`${data}T12:00:00`).getDay();
    const regola = CONTI_PER_GIORNO[settimana];
    if (!regola) continue; // lunedì
    // ⚠️ Il caso non è una decorazione: due venerdì non fanno mai lo stesso
    // numero di coperti, e uno scenario dove il venerdì è sempre uguale non
    // fa vedere niente sull'andamento.
    const oscillazione = 0.75 + rnd() * 0.5;
    const conti = Math.max(1, Math.round(regola.base * pienezza * oscillazione));
    serate.push({ data, conti, servizio: regola.servizio, settimana });
  }
  return serate;
}

// ---------------------------------------------------------------------
// 3 · COSA MANGIA UN TAVOLO
//
// ⚠️ Le probabilità non sono inventate a caso: sono quelle di un'osteria
// dove si mangia — non tutti prendono tutto, quasi tutti prendono un primo,
// il dolce lo prende un terzo. Vengono fuori **~2 portate a testa**, che è
// la differenza fra un ristorante e una tavola calda.
//
// ⚠️ E chi ordina di più è chi è seduto la sera del sabato: la `pienezza`
// alza le probabilità invece di aggiungere piatti a caso.
// ---------------------------------------------------------------------
const PROBABILITA = {
  antipasto: 0.5,
  primo: 0.65,
  secondo: 0.5,
  dolce: 0.32,
};

/**
 * Quanti coperti ha questo tavolo.
 *
 * ⚠️ La distribuzione è quella vera di una sala da 34 posti: quasi metà
 * sono coppie, i tavoli da otto sono rari. Con coperti tutti uguali, lo
 * scontrino medio non direbbe niente.
 */
export function copertiDelTavolo(rnd) {
  const p = rnd();
  if (p < 0.34) return 2;
  if (p < 0.55) return 3;
  if (p < 0.78) return 4;
  if (p < 0.86) return 5;
  if (p < 0.93) return 6;
  if (p < 0.97) return 7;
  return 8;
}

/**
 * Le righe di un conto: cosa mangia e cosa beve un tavolo.
 *
 * @param {object} opzioni
 * @param {number} opzioni.coperti
 * @param {boolean} opzioni.ricco       serata piena (sabato, mese buono)
 * @param {object[]} opzioni.inCarta    [{recipe_id, prezzo, nome, categoria}]
 * @param {object[]} opzioni.bevande    [{id, name, serving, selling_price, category}]
 * @param {() => number} opzioni.rnd
 * @returns {{righe: object[], turni: number}}
 */
export function componiConto({ coperti, ricco, inCarta, bevande, rnd }) {
  const perCategoria = (c) => inCarta.filter((p) => p.categoria === c);
  const pesca = (elenco) => elenco[Math.floor(rnd() * elenco.length)];
  const righe = [];

  // --- il cibo, persona per persona -----------------------------------
  // ⚠️ Persona per persona e non «n piatti per tavolo»: è l'unico modo
  // perché quattro persone che prendono cose diverse producano una comanda
  // che somiglia a una vera.
  for (let i = 0; i < coperti; i++) {
    for (const categoria of ["antipasto", "primo", "secondo", "dolce"]) {
      const elenco = perCategoria(categoria);
      if (!elenco.length) continue;
      const soglia = PROBABILITA[categoria] * (ricco ? 1.15 : 0.92);
      if (rnd() > soglia) continue;
      const piatto = pesca(elenco);
      righe.push({
        genere: "piatto",
        recipe_id: piatto.recipe_id,
        nome: piatto.nome,
        categoria,
        prezzo: piatto.prezzo,
        // ⚠️ La nota sul piatto non è folclore: è il caso in cui il ticket
        // di cucina cambia forma, e nello scenario di ieri non ce n'era
        // **nessuna** in 288 righe.
        nota: rnd() < 0.06 ? notaDelPiatto(rnd) : null,
      });
    }
  }
  // Un tavolo che non ha ordinato niente non esiste: capita quando i dadi
  // dicono di no a tutti e quattro. Gli si mette almeno un primo.
  if (!righe.length) {
    const elenco = perCategoria("primo").length ? perCategoria("primo") : inCarta;
    const piatto = pesca(elenco);
    righe.push({ genere: "piatto", recipe_id: piatto.recipe_id, nome: piatto.nome, categoria: "primo", prezzo: piatto.prezzo, nota: null });
  }

  // --- da bere ---------------------------------------------------------
  const acqua = bevande.filter((b) => b.category === "Acqua");
  const calici = bevande.filter((b) => b.serving === "calice");
  const bottiglie = bevande.filter((b) => b.serving === "bottiglia" && b.section === "vini");
  const caffe = bevande.filter((b) => b.category === "Caffetteria");
  const amari = bevande.filter((b) => b.category === "Amari");
  const birre = bevande.filter((b) => b.category === "Birre");

  const aggiungiBevanda = (b, quante = 1) => {
    if (!b) return;
    for (let k = 0; k < quante; k++) {
      righe.push({
        genere: "bevanda",
        nome: b.serving ? `${b.name} · ${b.serving}` : b.name,
        prezzo: Number(b.selling_price),
        nota: null,
      });
    }
  };

  // L'acqua la prendono tutti: una bottiglia ogni due persone.
  aggiungiBevanda(pesca(acqua), Math.max(1, Math.ceil(coperti / 2)));

  // Il vino: sopra i tre coperti si va a bottiglia, sotto al calice. È il
  // gesto vero, e fa muovere lo scontrino medio molto più dei piatti.
  if (rnd() < (ricco ? 0.85 : 0.6)) {
    if (coperti >= 3 && bottiglie.length) {
      aggiungiBevanda(pesca(bottiglie), coperti >= 6 ? 2 : 1);
    } else if (calici.length) {
      aggiungiBevanda(pesca(calici), Math.max(1, coperti));
    }
  } else if (birre.length && rnd() < 0.5) {
    aggiungiBevanda(pesca(birre), Math.max(1, Math.round(coperti / 2)));
  }

  // Caffè e amaro alla fine, e non per tutti.
  for (let i = 0; i < coperti; i++) {
    if (rnd() < 0.42) aggiungiBevanda(pesca(caffe));
    if (rnd() < 0.14) aggiungiBevanda(pesca(amari));
  }

  return { righe, turni: turniDelConto(righe, rnd) };
}

/**
 * Come le righe si dividono in turni.
 *
 * 🔴 IL TURNO NON SI DEDUCE DALLA CATEGORIA, e sta scritto nel database:
 * *«lo compone chi serve, non si deduce MAI dalla categoria del piatto: nel
 * primo turno possono esserci due antipasti e una pasta»*. Quindi qui non
 * c'è la regola «antipasti = turno 1»: c'è un cameriere che compone,
 * qualche volta in due turni, qualche volta in tre, qualche volta in uno
 * solo — ed è così che quella funzione riceve dati che la mettono alla
 * prova invece di confermarla.
 */
function turniDelConto(righe, rnd) {
  const dado = rnd();
  // Un tavolo su cinque manda tutto insieme (è come si lavorava prima del
  // 21/08, e capita ancora: il tavolo che ha fretta).
  if (dado < 0.2) {
    for (const r of righe) r.turno = 1;
    return 1;
  }
  const treTurni = dado > 0.65;
  const ordine = { antipasto: 1, primo: treTurni ? 2 : 1, secondo: treTurni ? 3 : 2, dolce: treTurni ? 3 : 2 };
  for (const r of righe) {
    if (r.genere === "bevanda") { r.turno = 1; continue; }
    r.turno = ordine[r.categoria] ?? 1;
  }
  // ⚠️ E qualche volta il cameriere sbaglia il giro: una riga aggiunta
  // dopo, che sale di un turno. Serve perché i turni non risultino MAI
  // perfettamente allineati alle portate — che è la cosa che il commento
  // sulla colonna dice di non dare per scontata.
  if (rnd() < 0.25 && righe.length > 2) {
    const i = Math.floor(rnd() * righe.length);
    righe[i].turno = (righe[i].turno ?? 1) + 1;
  }
  return Math.max(...righe.map((r) => r.turno ?? 1));
}

const NOTE_PIATTO = [
  "senza aglio",
  "cottura al sangue",
  "senza glutine",
  "ben cotto",
  "senza lattosio",
  "poco sale",
  "portare per ultimo",
  "senza cipolla",
];

function notaDelPiatto(rnd) {
  return NOTE_PIATTO[Math.floor(rnd() * NOTE_PIATTO.length)];
}

// ---------------------------------------------------------------------
// I NOMI DI CHI PRENOTA
//
// ⚠️ Servono TANTI e servono RIPETUTI, e sono due esigenze diverse. Tanti,
// perché una rubrica di otto nomi non fa provare né la ricerca né
// l'ordinamento. Ripetuti, perché la domanda vera di una scheda cliente è
// *«questo è già venuto?»* — e con nomi tutti diversi non c'è nessun
// cliente abituale da riconoscere.
//
// Gli abituali sono i primi otto: tornano molte volte nei due mesi.
// ---------------------------------------------------------------------
export const ABITUALI = [
  "Lo Giudice", "Interlandi", "Nicosia", "Pappalardo",
  "Zappalà", "Grasso", "Di Blasi", "Amato",
];

export const NOMI_CLIENTI = [
  ...ABITUALI,
  "Bianchi", "Ferrara", "La Rosa", "Gulisano", "Restivo", "Sciacca", "Cannizzaro",
  "Trovato", "Musumeci", "Rapisarda", "Scalia", "Battiato", "Consoli", "Finocchiaro",
  "Longo", "Maugeri", "Privitera", "Raciti", "Sapienza", "Torrisi", "Vasta",
  "Alberghina", "Bonaccorsi", "Caruso", "D'Agata", "Fichera", "Gagliano", "Indelicato",
  "Leotta", "Mangano", "Nicolosi", "Oliveri", "Patanè", "Quartarone", "Riolo",
  "Sciuto", "Tomaselli", "Urso", "Ventura", "Zuccarello", "Aiello", "Barbagallo",
  "Cavallaro", "Distefano", "Emmi", "Fisichella", "Garozzo", "Hyerace", "Incardona",
];

/**
 * Chi prenota stasera: uno degli abituali una volta su tre, altrimenti un
 * nome qualunque. Restituisce anche il telefono, che è la chiave con cui il
 * gestionale riconosce un cliente già visto.
 */
export function chiPrenota(rnd) {
  const abituale = rnd() < 0.34;
  const elenco = abituale ? ABITUALI : NOMI_CLIENTI;
  const nome = elenco[Math.floor(rnd() * elenco.length)];
  const i = NOMI_CLIENTI.indexOf(nome);
  return {
    nome,
    abituale,
    // ⚠️ Il telefono è **legato al nome**, non casuale: è così che il
    // gestionale capisce che è la stessa persona. Con un numero diverso
    // ogni volta, un abituale sembrerebbe otto clienti diversi.
    telefono: `+39351${String(1000000 + i * 7919).slice(0, 7)}`,
  };
}

/** L'ora a cui si prenota: le 20 e le 21 sono le più gettonate. */
export function oraDellaPrenotazione(servizio, rnd) {
  if (servizio === "pranzo") return ["12:30", "12:45", "13:00", "13:15", "13:30"][Math.floor(rnd() * 5)];
  const p = rnd();
  if (p < 0.18) return "20:00";
  if (p < 0.34) return "20:15";
  if (p < 0.5) return "20:30";
  if (p < 0.62) return "20:45";
  if (p < 0.76) return "21:00";
  if (p < 0.86) return "21:15";
  if (p < 0.94) return "21:30";
  return "22:00";
}

// ---------------------------------------------------------------------
// I FORNITORI — otto, come ne ha un'osteria vera
//
// 🔴 Nello scenario del 22/08 erano **due** («Ortofrutta PROVA» e «Ittica
// di Collaudo»), e tutta la merce arrivava da loro: un pesce e una verdura
// dallo stesso camion. Con due fornitori non si prova niente di quello per
// cui l'anagrafica esiste — il confronto dei prezzi fra chi vende la stessa
// cosa, il raggruppamento degli ordini, le fatture di ciascuno.
//
// ⚠️ E ognuno porta **le sue categorie**: è così che la merce sa da chi
// arriva, e le fatture tornano coi carichi invece di essere numeri
// scollegati.
//
// [nome, canale d'ordine, telefono, categorie che fornisce]
// ---------------------------------------------------------------------
export const FORNITORI = [
  ["Ortofrutta Serrone S.r.l.", "whatsapp", "+390935610011", ["verdura", "frutta"]],
  ["Ittica dello Stretto S.n.c.", "email", "+390935610022", ["pesce", "crostacei_molluschi"]],
  ["Macelleria dei Nebrodi", "whatsapp", "+390935610033", ["carne_rossa", "carne_bianca"]],
  ["Caseificio Val di Noto", "email", "+390935610044", ["latticini", "uova"]],
  ["Molino Grano Antico", "email", "+390935610055", ["farine_cereali", "legumi", "secco_dispensa"]],
  ["Oleificio di contrada Bagni", "whatsapp", "+390935610066", ["olio_condimenti", "spezie_aromi"]],
  ["Distribuzione Bevande Enna", "email", "+390935610077", ["bevande"]],
  ["PuliPro Forniture", "email", "+390935610088", ["altro"]],
];

/** Chi porta questa categoria di merce. */
export function fornitoreDellaCategoria(categoria) {
  const trovato = FORNITORI.find(([, , , categorie]) => categorie.includes(categoria));
  return trovato ? trovato[0] : FORNITORI[FORNITORI.length - 1][0];
}
