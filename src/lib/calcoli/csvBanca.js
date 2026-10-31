/**
 * Il lettore del CSV della banca: Credem, home banking, «Elenco movimenti
 * di conto» (31/10/2026). Sta accanto al CBI (cbi.js), non al suo posto.
 *
 * La forma, misurata il 31/10 sul file vero (che resta fuori dal
 * repository: porta nomi e importi del locale):
 *   - UTF-8 col BOM, righe CRLF, separatore «;»;
 *   - intestazione fissa (TESTA qui sotto);
 *   - date gg/mm/aaaa, importi all'italiana col segno («-1.220,00»);
 *   - la Descrizione fra virgolette, con «;» e spazi multipli dentro:
 *     si legge con un lettore CSV vero, non con split(";").
 *
 * ⚠️ IL CSV NON DICE TRE COSE CHE IL CBI DICE:
 *   - il conto (niente IBAN): lo sceglie chi carica;
 *   - i saldi: chi carica li scrive a mano, presi dall'estratto, e si
 *     controlla saldo iniziale + movimenti = saldo finale come per il CBI;
 *   - quante righe ha: per questo una virgoletta lasciata aperta in fondo
 *     è un file troncato, e ferma tutto.
 *
 * ⚠️ «SI FERMA O CONTINUA ZITTO?» — si ferma, come il CBI. Gli errori si
 * raccolgono TUTTI e chi chiama, se non sono vuoti, non carica niente.
 */

const TESTA = ["Data contabile", "Data valuta", "Descrizione", "Causale Abi", "Causale Int", "Importo", "Note"];
const IBAN_IT = /\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/;
const RIF_BANCA = /\brif\.\s*banca:\s*([0-9A-Z]+)/i;

/** Il testo senza il BOM in testa. */
function senzaBom(testo) {
  return String(testo ?? "").replace(/^﻿/, "");
}

/** Vero se il testo comincia con l'intestazione del CSV di Credem. */
export function eCsvCredem(testo) {
  const prima = senzaBom(testo).split(/\r\n|\r|\n/, 1)[0] ?? "";
  return prima.trim() === TESTA.join(";");
}

/** «20/10/2026» → «2026-10-20». Restituisce null se non è una data vera. */
export function dataItaliana(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const [gg, mm, aa] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(aa, mm - 1, gg));
  if (d.getUTCFullYear() !== aa || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== gg) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Un importo del file, all'italiana, in centesimi: «-1.220,00» → -122000.
 * Solo la forma che la banca scrive (due decimali dopo la virgola, punti
 * a gruppi di tre): qualunque altra è null, perché indovinare un importo
 * è peggio che fermarsi.
 */
export function centesimiItaliani(s) {
  const t = String(s ?? "").trim();
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+),\d{2}$/.test(t)) return null;
  return Number(t.replace(/\./g, "").replace(",", ""));
}

/**
 * Un saldo scritto a mano da Alessio, in centesimi. Qui le forme sono di
 * più, perché le scrive una persona: «1.234,56», «1234,56», «1234.56»,
 * «1234», «3.000». Il punto seguito da tre cifre (e nessuna virgola) è
 * delle migliaia; altrimenti è la virgola dei decimali.
 */
export function euroScritti(s) {
  const t = String(s ?? "").trim().replace(/\s+/g, "");
  let n;
  if (/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) n = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+(\.\d{1,2})?$/.test(t)) n = t;
  else return null;
  return Math.round(Number(n) * 100);
}

/**
 * Le righe di un CSV col «;», con le virgolette dello standard: un campo
 * fra virgolette può contenere «;» e a capo, e «""» vale una virgoletta.
 * Ogni riga porta il numero di riga del file in cui comincia.
 */
function righeCsv(testo) {
  const righe = [];
  let campi = [];
  let campo = "";
  let fraVirgolette = false;
  let riga = 1;
  let inizio = 1;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (fraVirgolette) {
      if (c === '"' && testo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        fraVirgolette = false;
      } else {
        if (c === "\n") riga++;
        campo += c;
      }
    } else if (c === '"' && campo === "") {
      fraVirgolette = true;
    } else if (c === ";") {
      campi.push(campo);
      campo = "";
    } else if (c === "\r" && testo[i + 1] === "\n") {
      // l'a capo di Windows: lo chiude il \n
    } else if (c === "\n" || c === "\r") {
      campi.push(campo);
      righe.push({ n: inizio, campi });
      campi = [];
      campo = "";
      riga++;
      inizio = riga;
    } else {
      campo += c;
    }
  }
  if (campo !== "" || campi.length) {
    campi.push(campo);
    righe.push({ n: inizio, campi });
  }
  return { righe, aperta: fraVirgolette ? inizio : null };
}

const stringi = (s) => s.replace(/\s+/g, " ").trim();

/**
 * Legge il testo del CSV di Credem.
 *
 * @returns {{ movimenti: object[], errori: string[] }} i movimenti nella
 *   stessa forma di quelli del CBI (importi in centesimi, con segno).
 */
export function leggiCsvCredem(testo) {
  const errori = [];
  const movimenti = [];
  const { righe, aperta } = righeCsv(senzaBom(testo));

  if (aperta !== null) {
    errori.push(`Riga ${aperta}: una virgoletta si apre e non si chiude più. Il file potrebbe essere troncato.`);
    return { movimenti: [], errori };
  }

  const [testa, ...corpo] = righe;
  if (!testa || testa.campi.map((c) => c.trim()).join(";") !== TESTA.join(";")) {
    errori.push(
      `L'intestazione non è quella del CSV di Credem («${TESTA.join(";")}»): le colonne potrebbero essere spostate.`,
    );
    return { movimenti: [], errori };
  }

  const dati = corpo.filter((r) => r.campi.some((c) => c.trim() !== ""));
  if (!dati.length) {
    errori.push("Il file non ha nessun movimento.");
    return { movimenti: [], errori };
  }

  for (const { n, campi } of dati) {
    if (campi.length !== TESTA.length) {
      errori.push(`Riga ${n}: ha ${campi.length} colonne, il CSV di Credem ne ha ${TESTA.length}.`);
      continue;
    }
    const [contabile, valuta, descrizione, abi, interna, importo, note] = campi;
    const dataContabile = dataItaliana(contabile);
    const dataValuta = dataItaliana(valuta);
    const centesimi = centesimiItaliani(importo);
    if (!dataContabile || !dataValuta) {
      errori.push(`Riga ${n}: le date («${contabile.trim()}», «${valuta.trim()}») non si leggono.`);
      continue;
    }
    if (centesimi === null) {
      errori.push(`Riga ${n}: l'importo «${importo.trim()}» non si legge.`);
      continue;
    }
    if (centesimi === 0) {
      errori.push(`Riga ${n}: un movimento da zero euro non esiste.`);
      continue;
    }
    const testoDescrizione = stringi(descrizione);
    const nota = stringi(note);
    movimenti.push({
      dataContabile,
      dataValuta,
      centesimi,
      causaleAbi: abi.trim(),
      causaleInterna: interna.trim(),
      numeroAssegno: null,
      riferimentoBanca: RIF_BANCA.exec(testoDescrizione)?.[1] ?? null,
      descrizione: testoDescrizione,
      dettagli: nota ? [nota] : [],
      ibanControparte: (testoDescrizione.match(IBAN_IT) ?? nota.match(IBAN_IT))?.[0] ?? null,
    });
  }

  return { movimenti: errori.length ? [] : movimenti, errori };
}

function euro(centesimi) {
  return `${(centesimi / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/**
 * La prova del nove che il CBI fa da solo, coi saldi scritti a mano:
 * saldo iniziale + movimenti = saldo finale, al centesimo.
 */
export function controllaSaldi(movimenti, inizialeCentesimi, finaleCentesimi) {
  if (inizialeCentesimi == null || finaleCentesimi == null) {
    return ["Scrivi il saldo iniziale e il saldo finale dell'estratto: il CSV non li dice, e senza non si sa se il file è intero."];
  }
  const somma = movimenti.reduce((s, m) => s + m.centesimi, 0);
  if (inizialeCentesimi + somma === finaleCentesimi) return [];
  return [
    `Non quadra: saldo iniziale ${euro(inizialeCentesimi)} più i movimenti (${euro(somma)}) fa`
    + ` ${euro(inizialeCentesimi + somma)}, ma il saldo finale scritto è ${euro(finaleCentesimi)}.`
    + " Controlla i saldi, oppure il file potrebbe essere incompleto.",
  ];
}

/**
 * L'impronta di un movimento del CSV. Comincia con «csv§» perché lo stesso
 * movimento arrivato dal CBI ha un'impronta diversa (il CSV non ha tutti
 * i campi del CBI): non si possono riconoscere l'uno nell'altro, e per
 * questo c'è `sovrapposizioni`. Il conto non serve: l'unicità nel
 * database è già per conto.
 */
function improntaCsv(m) {
  return [
    "csv",
    m.dataContabile,
    m.dataValuta,
    m.centesimi,
    m.causaleAbi,
    m.causaleInterna,
    m.descrizione,
    m.dettagli.join(" | "),
  ].join("§");
}

/** Da quale file è entrato un movimento già caricato, dalla sua impronta. */
export function formatoDi(impronta) {
  return String(impronta ?? "").startsWith("csv§") ? "csv" : "cbi";
}

/**
 * I movimenti del CSV nella forma di `carica_movimenti_banca`.
 *
 * ⚠️ Due movimenti con tutti i campi uguali (due commissioni identiche lo
 * stesso giorno) sono due fatti: il secondo prende «#2», come nel CBI.
 */
export function movimentiCsvDaCaricare(movimenti) {
  const visti = new Map();
  return movimenti.map((m) => {
    const base = improntaCsv(m);
    const n = (visti.get(base) ?? 0) + 1;
    visti.set(base, n);
    return {
      impronta: n === 1 ? base : `${base}#${n}`,
      data_contabile: m.dataContabile,
      data_valuta: m.dataValuta,
      importo: m.centesimi / 100,
      causale_abi: m.causaleAbi || null,
      causale_interna: m.causaleInterna || null,
      riferimento_banca: m.riferimentoBanca,
      numero_assegno: null,
      descrizione: m.descrizione,
      dettagli: m.dettagli.length ? m.dettagli.join("\n") : null,
      iban_controparte: m.ibanControparte,
    };
  });
}

const MARGINE = 2;

/** «2026-10-01», -2 → «2026-09-29». */
function spostaGiorni(iso, giorni) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/**
 * 🔴 I DOPPIONI FRA CBI E CSV. Lo stesso movimento arrivato dai due file
 * ha due impronte diverse, ed entrerebbe due volte. Quindi un conto, per
 * gli stessi giorni, si carica da un formato solo: se ha già movimenti
 * dell'ALTRO formato fra il primo e l'ultimo giorno del file nuovo, ci si
 * ferma. Per lo stesso formato bastano le impronte.
 *
 * ⚠️ I giorni si allargano di MARGINE per parte: non è misurato che i due
 * file diano sempre la stessa data contabile allo stesso movimento (fine
 * mese, festivi), e un blocco di troppo si vede, un doppione no.
 *
 * @param movimenti  quelli del file nuovo (con dataContabile)
 * @param formato    «csv» o «cbi», il formato del file nuovo
 * @param contoId    il conto su cui si carica
 * @param esistenti  i movimenti già caricati (conto_id, data_contabile, impronta)
 * @returns null se non si sovrappone, altrimenti cosa e dove
 */
export function sovrapposizioni(movimenti, formato, contoId, esistenti) {
  if (!movimenti.length) return null;
  const date = movimenti.map((m) => m.dataContabile).sort();
  const dal = date[0];
  const al = date[date.length - 1];
  const da = spostaGiorni(dal, -MARGINE);
  const a = spostaGiorni(al, MARGINE);
  const altri = (esistenti ?? []).filter(
    (e) => String(e.conto_id) === String(contoId)
      && formatoDi(e.impronta) !== formato
      && e.data_contabile >= da
      && e.data_contabile <= a,
  );
  if (!altri.length) return null;
  return { altroFormato: formato === "csv" ? "cbi" : "csv", quanti: altri.length, dal, al };
}
