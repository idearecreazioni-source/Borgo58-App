/**
 * Il lettore del CSV della banca: Credem, home banking, «Elenco movimenti
 * di conto» (31/10/2026). Sta accanto al CBI (cbi.js), non al suo posto.
 * In fondo, il CSV di BPER (01/11/2026): stessa forma d'uscita.
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
    // ⚠️ La Categoria di BPER la cambia chi usa l'app della banca: dentro
    //    l'impronta, lo stesso movimento ricaricato dopo entrerebbe due
    //    volte (revisione ecc:silent-failure-hunter, 01/11/2026).
    m.banca === "bper" ? "" : m.causaleInterna,
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

// ─── BPER Banca ─────────────────────────────────────────────────────────
//
// IL CSV DI BPER (01/11/2026, il conto personale di Alessio su Casa). BPER
// da home banking esporta «Lista movimenti» solo in XLS o PDF: l'XLS,
// aperto in Excel e salvato come CSV, ha questa forma (misurata sul file
// vero, che resta fuori dal repository):
//   - caratteri occidentali (Excel), righe CRLF, separatore «;»;
//   - una testata libera (luogo e data, conto, IBAN, saldi, «Numero
//     Movimenti: N»), poi l'intestazione (TESTA_BPER), poi i movimenti dal
//     piu' recente, poi la riga «Totale» con entrate e uscite;
//   - date in lettere («30 ottobre 2026»); la valuta e' «"-"» finche' il
//     movimento non e' contabilizzato;
//   - entrate e uscite in due colonne, le uscite gia' col meno, e i
//     decimali solo se servono («-7,8», «1000»).
//
// ⚠️ I MOVIMENTI «Da contabilizzare» SI LASCIANO FUORI: non hanno ancora la
//    valuta, e quando la banca li contabilizza tornano nel file con la
//    valuta scritta, cioe' con un'altra impronta: entrerebbero due volte.
//    Si caricano col file successivo.
// ⚠️ La riga «Totale» e «Numero Movimenti» sono la prova che il file e'
//    intero: se non tornano coi movimenti letti, ci si ferma.

const TESTA_BPER = ["Data operazione", "Data valuta", "Descrizione", "Entrate", "Uscite", "Categoria", "Stato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const eTestaBper = (campi) => campi.map((c) => c.trim()).join(";") === TESTA_BPER.join(";");

/** Vero se il testo e' il CSV di BPER (l'intestazione sta dopo la testata). */
export function eCsvBper(testo) {
  const { righe } = righeCsv(senzaBom(testo));
  return righe.some((r) => eTestaBper(r.campi));
}

/** Quale CSV di banca e': «credem», «bper», o null. */
export function bancaDelCsv(testo) {
  if (eCsvCredem(testo)) return "credem";
  if (eCsvBper(testo)) return "bper";
  return null;
}

/** «30 ottobre 2026» → «2026-10-30». null se non e' una data vera. */
export function dataInLettere(s) {
  const m = /^(\d{1,2}) ([a-z]+) (\d{4})$/i.exec(stringi(String(s ?? "")));
  if (!m) return null;
  const mese = MESI.indexOf(m[2].toLowerCase());
  if (mese < 0) return null;
  const [gg, aa] = [Number(m[1]), Number(m[3])];
  const d = new Date(Date.UTC(aa, mese, gg));
  if (d.getUTCFullYear() !== aa || d.getUTCMonth() !== mese || d.getUTCDate() !== gg) return null;
  return `${m[3]}-${String(mese + 1).padStart(2, "0")}-${String(gg).padStart(2, "0")}`;
}

/**
 * Un importo di BPER in centesimi: «-7,8» → -780, «1000» → 100000,
 * «2.307,00» → 230700. Virgola dei decimali (uno o due), punti a gruppi di
 * tre; qualunque altra forma e' null.
 */
export function centesimiBper(s) {
  const t = String(s ?? "").trim();
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return null;
  const [intero, decimali = ""] = t.replace(/\./g, "").split(",");
  const segno = intero.startsWith("-") ? -1 : 1;
  return segno * (Math.abs(Number(intero)) * 100 + Number(decimali.padEnd(2, "0")));
}

/**
 * Legge il CSV di BPER.
 *
 * @returns {{ movimenti: object[], errori: string[], daContabilizzare: number }}
 *   i movimenti contabilizzati nella stessa forma di quelli di Credem, e
 *   quanti ne sono rimasti fuori perche' ancora da contabilizzare.
 */
export function leggiCsvBper(testo) {
  const errori = [];
  const movimenti = [];
  const { righe, aperta } = righeCsv(senzaBom(testo));
  const fuori = { movimenti: [], errori, daContabilizzare: 0 };

  if (aperta !== null) {
    errori.push(`Riga ${aperta}: una virgoletta si apre e non si chiude più. Il file potrebbe essere troncato.`);
    return fuori;
  }
  const i = righe.findIndex((r) => eTestaBper(r.campi));
  if (i < 0) {
    errori.push(`Non trovo l'intestazione del CSV di BPER («${TESTA_BPER.join(";")}»): le colonne potrebbero essere spostate.`);
    return fuori;
  }
  const dichiarati = righe
    .slice(0, i)
    .map((r) => /^Numero Movimenti:\s*(\d+)$/i.exec(r.campi[0]?.trim() ?? ""))
    .find(Boolean);

  let totale = null;
  let letti = 0;
  let sommaEntrate = 0;
  let sommaUscite = 0;
  let daContabilizzare = 0;
  for (const { n, campi } of righe.slice(i + 1)) {
    if (!campi.some((c) => c.trim() !== "")) continue;
    if (campi[2]?.trim() === "Totale") {
      totale = { n, entrate: centesimiBper(campi[3]), uscite: centesimiBper(campi[4]) };
      break;
    }
    if (campi.length !== TESTA_BPER.length) {
      errori.push(`Riga ${n}: ha ${campi.length} colonne, il CSV di BPER ne ha ${TESTA_BPER.length}.`);
      continue;
    }
    const [operazione, valuta, descrizione, entrate, uscite, categoria, statoBanca] = campi;
    letti++;
    const dataContabile = dataInLettere(operazione);
    if (!dataContabile) {
      errori.push(`Riga ${n}: la data «${operazione.trim()}» non si legge.`);
      continue;
    }
    const piu = entrate.trim() ? centesimiBper(entrate) : 0;
    const meno = uscite.trim() ? centesimiBper(uscite) : 0;
    if (piu === null || meno === null || piu < 0 || meno > 0 || (piu !== 0) === (meno !== 0)) {
      errori.push(`Riga ${n}: entrate «${entrate.trim()}» e uscite «${uscite.trim()}» non si leggono (ne serve una sola, le uscite col meno).`);
      continue;
    }
    sommaEntrate += piu;
    sommaUscite += meno;
    const stato = statoBanca.trim();
    if (stato === "Da contabilizzare") {
      daContabilizzare++;
      continue;
    }
    if (stato !== "Contabilizzato") {
      errori.push(`Riga ${n}: lo stato «${stato}» non lo conosco (mi aspetto «Contabilizzato» o «Da contabilizzare»).`);
      continue;
    }
    const dataValuta = dataInLettere(valuta);
    if (!dataValuta) {
      errori.push(`Riga ${n}: la data valuta «${valuta.trim()}» non si legge.`);
      continue;
    }
    const testoDescrizione = stringi(descrizione);
    movimenti.push({
      banca: "bper",
      dataContabile,
      dataValuta,
      centesimi: piu + meno,
      causaleAbi: "",
      causaleInterna: stringi(categoria),
      numeroAssegno: null,
      riferimentoBanca: null,
      descrizione: testoDescrizione,
      dettagli: [],
      ibanControparte: testoDescrizione.match(IBAN_IT)?.[0] ?? null,
    });
  }

  if (!totale) {
    errori.push("Manca la riga «Totale» in fondo: il file potrebbe essere troncato.");
  } else if (totale.entrate !== sommaEntrate || totale.uscite !== sommaUscite) {
    errori.push(
      `Riga ${totale.n}: il Totale del file (entrate ${euro(totale.entrate ?? 0)}, uscite ${euro(totale.uscite ?? 0)})`
      + ` non torna coi movimenti letti (${euro(sommaEntrate)}, ${euro(sommaUscite)}).`,
    );
  }
  if (!dichiarati) {
    errori.push("Manca «Numero Movimenti» in cima al file: senza, non so se è intero.");
  } else if (Number(dichiarati[1]) !== letti) {
    errori.push(`Il file dice ${dichiarati[1]} movimenti, ma ne ho letti ${letti}: potrebbe essere incompleto.`);
  }
  if (!letti && !errori.length) errori.push("Il file non ha nessun movimento.");
  else if (!movimenti.length && !errori.length) {
    errori.push("Il file ha solo movimenti ancora «da contabilizzare»: non c'è niente da caricare, riprova fra qualche giorno.");
  }

  return { movimenti: errori.length ? [] : movimenti, errori, daContabilizzare: errori.length ? 0 : daContabilizzare };
}
