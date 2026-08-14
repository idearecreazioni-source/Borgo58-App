// La mappa del foglio di Alessio — MODULO PURO, nessun import.
//
// ⚠️ QUI DENTRO NON C'È NESSUN NUMERO DEL PIANO, ed è il punto. Il
// repository è pubblico: vincolo di Alessio del 14/08/2026, su rilievo
// del validatore. Questo file dice **dove guardare** (l'indirizzo delle
// celle) e **come si chiama** ciò che deve trovarci (l'etichetta scritta
// nella colonna a fianco). I valori vivono nel foglio sul suo computer e,
// dopo l'importazione, solo nel database.
//
// ⚠️ PERCHÉ LE ETICHETTE SI CONTROLLANO. Un indirizzo di cella scritto a
// mano è una scommessa: basta una riga inserita nel foglio e «D8» smette
// di essere lo scontrino e diventa altro. Non ci sarebbe nessun errore —
// entrerebbe un numero plausibile al posto sbagliato, e da lì in poi ogni
// conto della Proiezione sarebbe falso in modo credibile. È la stessa
// forma di guasto dello scarto a zero e del magazzino che non scendeva.
// Quindi: ogni valore letto ha accanto l'etichetta che ci si aspetta di
// trovare, e se non combacia **l'importazione si ferma e dice quale riga
// non ha riconosciuto** — non tira a indovinare.
//
// COSA SI LEGGE E COSA SI RICAVA. Del foglio si prendono solo le celle
// che Alessio compila a mano (nel suo foglio sono quelle blu su sfondo
// giallo). Tutto ciò che là dentro è una formula — coperti totali,
// ricavi, margini, EBITDA — qui **non si legge come dato**: si ricalcola,
// perché il calcolo deve stare in un posto solo (stessa regola di
// `orderTotals()` e di `pianta_del_giorno()`). I totali del foglio si
// leggono lo stesso, ma solo come **banco di prova**: l'importazione
// confronta ciò che il gestionale calcola con ciò che il foglio dichiara,
// e se non tornano lo dice prima di salvare.

const MESI = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

// Etichetta attesa → cella del valore. Il confronto è sull'inizio del
// testo, minuscolo: così un accento o una parentesi cambiati non fanno
// fallire un'importazione per un motivo che non interessa a nessuno.
const PARAMETRI = [
  ["scontrinoFood", "A8", "D8", "scontrino food"],
  ["scontrinoBeverage", "A9", "D9", "scontrino beverage"],
  ["foodCostPercento", "A10", "D10", "food cost"],
  ["beverageCostPercento", "A11", "D11", "beverage cost"],
  ["lavanderiaCoperto", "A12", "D12", "lavanderia"],
  ["pagamentiElettroniciPercento", "A13", "D13", "% pagamenti elettronici"],
  ["commissionePosPercento", "A14", "D14", "commissione pos"],
  ["aliquotaFoglioInformativa", "F107", "H107", "aliquota fiscale"],
  ["finanziamentoTasso", "F108", "H108", "tasso annuo"],
  ["finanziamentoImporto", "F109", "H109", "importo finanziamento"],
  ["finanziamentoAnni", "F110", "H110", "durata"],
  ["ammortamentiAnnui", "F111", "H111", "amm. annui"],
];

const PERSONALE = [10, 11, 12, 13]; // G=ruolo, I=netto orario, J=netto al giorno
const EXTRA = [21, 22, 23]; // A=tipo, C=giornate, D=tariffa, F=pressione
const FISSI = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]; // I=voce, M=€/mese
const ACCESSORIE = [33, 34, 35, 36]; // A=linea, E=quantità, F=prezzo, G=costo %

// I totali che il foglio dichiara: non entrano nel calcolo, servono a
// verificarlo. Ogni voce è (nome, cella, cosa vuol dire a schermo).
const CONTROLLI = [
  ["copertiSala", "N47", "coperti in sala"],
  ["ricaviSala", "N58", "ricavi di sala"],
  ["costiVariabiliSala", "N59", "costi variabili di sala"],
  ["margineContribuzione", "N60", "margine di contribuzione"],
  ["personaleAnnuo", "N64", "personale (somma dei mesi)"],
  ["costiFissiAnnui", "N66", "costi fissi operativi"],
  ["ebitdaSala", "N69", "EBITDA della sola sala"],
  ["ricaviAccessori", "N83", "ricavi delle linee accessorie"],
  ["margineAccessori", "N84", "margine delle linee accessorie"],
  ["ricaviTotali", "N89", "ricavi totali"],
  ["commissioniPos", "N90", "commissioni POS"],
  ["margineTotale", "N91", "margine totale"],
  ["ebitdaComplessivo", "N93", "EBITDA complessivo"],
  ["ammortamenti", "N94", "ammortamenti"],
  ["ebit", "N95", "EBIT"],
  ["bepSoloSala", "B110", "pareggio con la sola sala"],
  ["bepConAccessorie", "B111", "pareggio con le linee accessorie"],
];

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Legge il foglio già aperto (celle per indirizzo) e restituisce lo
// scenario, oppure l'elenco di ciò che non ha riconosciuto.
export function leggiScenarioDaFoglio(celle) {
  const num = (a) => {
    const v = celle.get(a);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const txt = (a) => norm(celle.get(a));
  const problemi = [];
  const avvisi = [];

  const attesa = (cellaEtichetta, inizio, cosa) => {
    const trovata = txt(cellaEtichetta);
    if (!trovata.startsWith(norm(inizio))) {
      problemi.push(
        `In ${cellaEtichetta} mi aspettavo «${cosa}» e ho trovato ${trovata ? `«${celle.get(cellaEtichetta)}»` : "una cella vuota"}.`
      );
      return false;
    }
    return true;
  };

  // --- Parametri scalari ---
  const parametri = {};
  for (const [chiave, cellaEtichetta, cellaValore, inizio] of PARAMETRI) {
    if (!attesa(cellaEtichetta, inizio, inizio)) continue;
    const v = num(cellaValore);
    if (v === null) problemi.push(`La cella ${cellaValore} (${inizio}) non contiene un numero.`);
    else parametri[chiave] = v;
  }

  // --- Personale dipendente ---
  // ⚠️ Una riga VUOTA non è un problema: vuol dire che quel posto non
  // c'è (tre ruoli invece di quattro). Una riga con il nome e senza i
  // numeri sì: quella è una cosa che non si è capita, e tirare a
  // indovinare vorrebbe dire far sparire uno stipendio dal piano.
  const personale = [];
  for (const r of PERSONALE) {
    const ruolo = celle.get(`G${r}`);
    const orario = num(`I${r}`);
    const giorno = num(`J${r}`);
    if (!ruolo && orario === null && giorno === null) continue;
    if (!ruolo || orario === null || giorno === null) {
      problemi.push(`La riga ${r} del personale è a metà (servono ruolo, netto orario e netto al giorno).`);
      continue;
    }
    personale.push({ ruolo: String(ruolo), nettoOrario: orario, nettoGiorno: giorno });
  }
  // Le ore al giorno nel foglio non sono una cella: stanno dentro la
  // formula del netto giornaliero. Si ricavano dividendo, e si pretende
  // che tutti i ruoli dicano lo stesso numero — se un domani un ruolo
  // avesse orario diverso, questo lo fa vedere invece di nasconderlo.
  const ore = personale.map((p) => (p.nettoOrario ? p.nettoGiorno / p.nettoOrario : null));
  const oreDistinte = [...new Set(ore.map((o) => (o === null ? "?" : Math.round(o * 100) / 100)))];
  if (oreDistinte.length === 1 && typeof oreDistinte[0] === "number") {
    parametri.oreGiorno = oreDistinte[0];
  } else if (personale.length) {
    problemi.push(`Le ore al giorno non sono le stesse per tutti i ruoli (${oreDistinte.join(", ")}).`);
  }
  // La pressione fiscale è una sola cella per tutti i ruoli.
  const pressione = num("L10");
  if (pressione === null) problemi.push("Manca la pressione fiscale e contributiva del personale (L10).");
  else parametri.pressionePersonale = pressione;

  // --- Extra personale ---
  const extra = [];
  for (const r of EXTRA) {
    const tipo = celle.get(`A${r}`);
    const giornate = num(`C${r}`);
    const tariffa = num(`D${r}`);
    const pr = num(`F${r}`);
    if (!tipo && giornate === null && tariffa === null) continue;
    if (!tipo || giornate === null || tariffa === null || pr === null) {
      problemi.push(`La riga ${r} degli extra è a metà (servono tipo, giornate, tariffa e pressione).`);
      continue;
    }
    // Le giornate degli eventi non sono un dato: sono gli eventi
    // dell'anno. Riconosciute dall'etichetta, non dalla posizione.
    extra.push({
      tipo: String(tipo),
      giornateAnno: giornate,
      tariffaGiorno: tariffa,
      pressione: pr,
      daEventi: norm(tipo).includes("eventi"),
    });
  }

  // --- Costi fissi operativi ---
  const costiFissi = [];
  for (const r of FISSI) {
    const voce = celle.get(`I${r}`);
    if (!voce) continue;
    const mese = num(`M${r}`);
    if (mese === null) {
      problemi.push(`Il costo fisso «${voce}» (riga ${r}) non ha un importo mensile.`);
      continue;
    }
    costiFissi.push({ voce: String(voce), euroMese: mese });
  }
  if (!costiFissi.length) problemi.push("Non ho trovato nessun costo fisso operativo.");

  // --- Linee accessorie ---
  const accessorie = [];
  for (const r of ACCESSORIE) {
    const linea = celle.get(`A${r}`);
    const q = num(`E${r}`);
    const prezzo = num(`F${r}`);
    const costo = num(`G${r}`);
    if (!linea && q === null && prezzo === null) continue;
    if (!linea || q === null || prezzo === null || costo === null) {
      problemi.push(`La linea accessoria della riga ${r} è a metà (servono nome, quantità, prezzo e costo %).`);
      continue;
    }
    // Gli eventi si contano al mese (stanno nella struttura mensile), le
    // altre linee vanno a giornata di apertura.
    accessorie.push({
      linea: String(linea),
      quantita: q,
      prezzoMedio: prezzo,
      costoPercento: costo,
      base: norm(linea).includes("eventi") ? "per_evento" : "per_giorno",
    });
  }

  // --- Struttura mensile ---
  const mesi = [];
  for (let i = 0; i < 12; i++) {
    const col = MESI[i];
    const riga = {
      mese: i + 1,
      serviziSettimana: num(`${col}41`),
      giorniLavorativi: num(`${col}42`),
      giorniPeak: num(`${col}43`),
      copertiPeak: num(`${col}45`),
      copertiFeriali: num(`${col}46`),
      eventiPremium: num(`${col}48`),
    };
    const mancanti = Object.entries(riga)
      .filter(([k, v]) => k !== "mese" && v === null)
      .map(([k]) => k);
    if (mancanti.length) {
      problemi.push(`Il mese ${i + 1} (colonna ${col}) non ha ${mancanti.join(", ")}.`);
      continue;
    }
    if (riga.giorniPeak > riga.giorniLavorativi) {
      problemi.push(`Il mese ${i + 1} ha più giorni di punta che giorni di apertura.`);
      continue;
    }
    mesi.push(riga);
  }
  if (mesi.length !== 12) problemi.push(`Ho letto ${mesi.length} mesi invece di 12.`);

  // --- I totali del foglio: banco di prova, non dato ---
  const controlli = {};
  for (const [chiave, cella, cosa] of CONTROLLI) {
    const v = num(cella);
    if (v === null) avvisi.push(`Non ho trovato il totale «${cosa}» (${cella}): quel confronto non si potrà fare.`);
    else controlli[chiave] = v;
  }

  return {
    versione: String(celle.get("A4") || "").trim(),
    parametri,
    personale,
    extra,
    costiFissi,
    accessorie,
    mesi,
    controlli,
    problemi,
    avvisi,
  };
}

// Le voci del foglio da mostrare a chi importa, prima di confermare. Chi
// guarda deve poter riconoscere il proprio foglio riga per riga: è la
// regola «il sistema propone, Alessio conferma».
export function rigaPerRiga(scenario) {
  const p = scenario.parametri;
  return [
    ["Scontrino per coperto", `food + beverage`, p.scontrinoFood, p.scontrinoBeverage],
    ["Food cost / beverage cost", "%", p.foodCostPercento, p.beverageCostPercento],
    ["Lavanderia per coperto", "€", p.lavanderiaCoperto, null],
    ["Pagamenti elettronici / commissione", "%", p.pagamentiElettroniciPercento, p.commissionePosPercento],
    ["Ruoli in organico", "n.", scenario.personale.length, null],
    ["Tipi di extra", "n.", scenario.extra.length, null],
    ["Voci di costo fisso", "n.", scenario.costiFissi.length, null],
    ["Linee accessorie", "n.", scenario.accessorie.length, null],
    ["Mesi compilati", "n.", scenario.mesi.length, null],
  ];
}
