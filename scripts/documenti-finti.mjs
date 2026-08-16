// I DOCUMENTI FINTI DEL COLLAUDO — `npm run collaudo:documenti`
//
// Genera i PDF che Alessio si manda per posta per provare la catena
// «mail → archivio → proposta → carico». Niente librerie: un PDF di solo
// testo è un formato semplice, e aggiungere una dipendenza per sei fogli
// costerebbe più di scriverli.
//
// ⚠️ SI RICONOSCONO DA SOLI, in tre modi indipendenti — perché uno solo
// non basta:
//   1. il **nome del file** comincia per `FINTA-`;
//   2. le **controparti sono inventate** («Ortofrutta PROVA S.r.l.»), mai
//      i fornitori veri di Alessio: una fattura falsa intestata a Mililli,
//      ritrovata fra un anno, è indistinguibile da una vera;
//   3. in **fondo a ogni foglio** c'è scritto che è un documento di prova
//      privo di valore fiscale.
// Se un domani ne salta fuori uno, lo dice da sé — e lo dice anche a chi
// legge solo il nome, anche a chi legge solo il contenuto.
//
// ⚠️ I NUMERI SONO PLAUSIBILI MA NON VERI, e nemmeno tondi: un collaudo
// con «100,00» dappertutto non fa emergere gli errori di arrotondamento,
// che sono quelli che si vedono solo coi decimali veri.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { titolo } from "./comune.mjs";

const CARTELLA = path.join("docs", "collaudo", "documenti");

// ---------------------------------------------------------------------
// Un PDF di solo testo, scritto a mano.
//
// Le lettere accentate: il font dichiara `WinAnsiEncoding` e il file si
// scrive in latin-1. Senza, «però» diventa «per?» — e in una fattura di
// prova un carattere sbagliato si scambia per un difetto del lettore.
// ---------------------------------------------------------------------
const A4 = { larghezza: 595, altezza: 842 };

const proteggi = (t) => String(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function paginaPdf(righe) {
  const flusso = righe
    .map(({ testo, x, y, dimensione = 10, grassetto = false }) => {
      const font = grassetto ? "/F2" : "/F1";
      return `BT ${font} ${dimensione} Tf 1 0 0 1 ${x} ${y} Tm (${proteggi(testo)}) Tj ET`;
    })
    .join("\n");

  const oggetti = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.larghezza} ${A4.altezza}] ` +
      "/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(flusso, "latin1")} >>\nstream\n${flusso}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let corpo = "%PDF-1.4\n";
  const posizioni = [];
  oggetti.forEach((o, i) => {
    posizioni.push(Buffer.byteLength(corpo, "latin1"));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });

  const inizioXref = Buffer.byteLength(corpo, "latin1");
  corpo += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`;
  for (const p of posizioni) corpo += `${String(p).padStart(10, "0")} 00000 n \n`;
  corpo += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${inizioXref}\n%%EOF\n`;

  return Buffer.from(corpo, "latin1");
}

// Impagina un documento come una lista di righe di testo, con le colonne
// dove servono. Restituisce le righe pronte per `paginaPdf`.
function foglio({ intestazione, mittente, meta, colonne, righe, totali, coda }) {
  const out = [];
  let y = A4.altezza - 60;
  const riga = (testo, opzioni = {}) => {
    out.push({ testo, x: opzioni.x ?? 50, y, dimensione: opzioni.dimensione ?? 10, grassetto: opzioni.grassetto });
    if (!opzioni.stessaRiga) y -= opzioni.salto ?? 16;
  };

  riga(mittente, { dimensione: 13, grassetto: true });
  riga(intestazione, { dimensione: 16, grassetto: true, salto: 22 });
  for (const m of meta) riga(m, { dimensione: 10 });
  y -= 10;

  if (colonne) {
    colonne.forEach((c) => out.push({ testo: c.titolo, x: c.x, y, dimensione: 9, grassetto: true }));
    y -= 6;
    out.push({ testo: "".padEnd(0), x: 50, y });
    y -= 12;
    for (const r of righe) {
      colonne.forEach((c) => out.push({ testo: String(r[c.chiave] ?? ""), x: c.x, y, dimensione: 9 }));
      y -= 14;
    }
    y -= 10;
  }

  for (const t of totali ?? []) riga(t, { dimensione: 11, grassetto: t.startsWith("TOTALE") });

  // La riga che dichiara cos'è, in fondo e in piccolo: non deve disturbare
  // la lettura del documento, deve esserci se qualcuno lo ritrova.
  out.push({
    testo: "Documento di PROVA generato per il collaudo del gestionale Borgo 58. Privo di valore fiscale.",
    x: 50,
    y: 60,
    dimensione: 8,
  });
  if (coda) out.push({ testo: coda, x: 50, y: 48, dimensione: 8 });

  return out;
}

// ---------------------------------------------------------------------
// I sei documenti.
// ---------------------------------------------------------------------
const COLONNE_FATTURA = [
  { titolo: "Descrizione", chiave: "desc", x: 50 },
  { titolo: "Q.tà", chiave: "qta", x: 300 },
  { titolo: "U.M.", chiave: "um", x: 350 },
  { titolo: "Prezzo", chiave: "prezzo", x: 400 },
  { titolo: "IVA", chiave: "iva", x: 460 },
  { titolo: "Importo", chiave: "importo", x: 500 },
];

const DOCUMENTI = [
  {
    file: "FINTA-Fattura-OrtoProva-114.pdf",
    cosa: "Fattura d'acquisto, righe pulite: è il giro normale.",
    righe: foglio({
      mittente: "Ortofrutta PROVA S.r.l. — Via delle Verifiche 12, Piazza Armerina (EN)",
      intestazione: "FATTURA n. 114/2026",
      meta: [
        "P.IVA 00000000000  —  Data documento: 12/03/2027",
        "Spett.le BORGO 58 S.r.l.s. — Piazza Armerina (EN)",
        "Pagamento: bonifico 30 gg data fattura",
      ],
      colonne: COLONNE_FATTURA,
      righe: [
        { desc: "Pomodoro ciliegino Pachino IGP - cassa 6 kg", qta: "3", um: "CT", prezzo: "14,40", iva: "4%", importo: "43,20" },
        { desc: "Melanzana lunga nera - cassa 5 kg", qta: "2", um: "CT", prezzo: "9,75", iva: "4%", importo: "19,50" },
        { desc: "Basilico fresco - mazzo", qta: "6", um: "PZ", prezzo: "1,15", iva: "4%", importo: "6,90" },
        { desc: "Limone verdello - cassa 8 kg", qta: "1", um: "CT", prezzo: "12,80", iva: "4%", importo: "12,80" },
      ],
      totali: ["Imponibile: 82,40", "IVA 4%: 3,30", "TOTALE DOCUMENTO: 85,70"],
    }),
  },
  {
    file: "FINTA-Fattura-IttiCollaudo-58.pdf",
    cosa: "Fattura con DUE righe difficili: una dicitura che non si capisce e un'unità ambigua.",
    righe: foglio({
      mittente: "Ittica di Collaudo S.n.c. — Porto di Prova (RG)",
      intestazione: "FATTURA n. 58/2026",
      meta: [
        "P.IVA 00000000000  —  Data documento: 13/03/2027",
        "Spett.le BORGO 58 S.r.l.s. — Piazza Armerina (EN)",
        "Pagamento: bonifico 30 gg — IBAN IT00 X000 0000 0000 0000 0000 000",
      ],
      colonne: COLONNE_FATTURA,
      righe: [
        { desc: "Gambero rosso di Mazara - cassetta 2 kg", qta: "2", um: "CT", prezzo: "48,00", iva: "10%", importo: "96,00" },
        // ⚠️ La riga che non si capisce: sigla del fornitore, nessun nome
        // di prodotto. Deve costringere a fermarsi invece di indovinare.
        { desc: "MISTO GG/2 SEL. CAT.A", qta: "1", um: "CT", prezzo: "31,50", iva: "10%", importo: "31,50" },
        // ⚠️ L'unità ambigua: 12 di che cosa? È la trappola del 12/08.
        { desc: "Alici fresche - cassa da 3 kg", qta: "12", um: "", prezzo: "4,20", iva: "10%", importo: "50,40" },
      ],
      totali: ["Imponibile: 177,90", "IVA 10%: 17,79", "TOTALE DOCUMENTO: 195,69"],
      coda: "Merce viaggiante a temperatura controllata 0/+2 gradi C.",
    }),
  },
  {
    file: "FINTA-DDT-OrtoProva-341.pdf",
    cosa: "Documento di trasporto: quantità sì, prezzi no. La fattura arriva dopo.",
    righe: foglio({
      mittente: "Ortofrutta PROVA S.r.l. — Via delle Verifiche 12, Piazza Armerina (EN)",
      intestazione: "DOCUMENTO DI TRASPORTO n. 341",
      meta: [
        "Data e ora trasporto: 14/03/2027 ore 07:20",
        "Destinatario: BORGO 58 S.r.l.s. — Piazza Armerina (EN)",
        "Causale: vendita  —  Trasporto a cura del mittente",
      ],
      colonne: [
        { titolo: "Descrizione", chiave: "desc", x: 50 },
        { titolo: "Q.tà", chiave: "qta", x: 350 },
        { titolo: "U.M.", chiave: "um", x: 400 },
        { titolo: "Lotto", chiave: "lotto", x: 450 },
        { titolo: "Scadenza", chiave: "scad", x: 505 },
      ],
      righe: [
        { desc: "Pomodoro ciliegino Pachino IGP", qta: "18", um: "KG", lotto: "L-2703A", scad: "21/03/27" },
        { desc: "Melanzana lunga nera", qta: "10", um: "KG", lotto: "L-2703B", scad: "24/03/27" },
        { desc: "Basilico fresco", qta: "6", um: "PZ", lotto: "L-2703C", scad: "18/03/27" },
      ],
      totali: ["Colli: 5   —   Peso lordo: 36,4 kg"],
      coda: "Il presente documento non riporta importi: seguira' fattura di fine mese.",
    }),
  },
  {
    file: "FINTA-Contratto-manutenzione-frigoriferi.pdf",
    cosa: "Contratto: serve a «Chiedi all'archivio» — canone, durata, rinnovo, chi paga cosa.",
    righe: foglio({
      mittente: "FrigoService PROVA S.r.l. — Catania",
      intestazione: "CONTRATTO DI MANUTENZIONE",
      meta: [
        "Fra FrigoService PROVA S.r.l. e BORGO 58 S.r.l.s.",
        "Sottoscritto il 02/03/2027  —  Decorrenza 01/04/2027",
      ],
      colonne: [
        { titolo: "Articolo", chiave: "art", x: 50 },
        { titolo: "Contenuto", chiave: "testo", x: 130 },
      ],
      righe: [
        { art: "Art. 1", testo: "Oggetto: manutenzione di 3 celle frigorifere e 1 abbattitore." },
        { art: "Art. 2", testo: "Durata: 24 mesi dalla decorrenza, fino al 31/03/2029." },
        { art: "Art. 3", testo: "Canone: 148,00 euro + IVA al mese, fatturato trimestralmente." },
        { art: "Art. 4", testo: "Interventi ordinari: 2 visite programmate l'anno, comprese nel canone." },
        { art: "Art. 5", testo: "Interventi straordinari: a carico del committente, 55,00 euro/ora" },
        { art: "", testo: "        piu' ricambi. Uscita entro 24 ore dalla chiamata." },
        { art: "Art. 6", testo: "Rinnovo: tacito per 12 mesi salvo disdetta 90 giorni prima" },
        { art: "", testo: "        della scadenza, a mezzo PEC." },
        { art: "Art. 7", testo: "Foro competente: Enna." },
      ],
      totali: ["Canone annuo complessivo: 1.776,00 euro + IVA"],
    }),
  },
  {
    file: "FINTA-Bustapaga-marzo-2027.pdf",
    cosa: "Busta paga: numeri di lordo, netto e costo azienda su cui provare il modulo Personale.",
    righe: foglio({
      mittente: "Studio Paghe di PROVA — elaborazione per BORGO 58 S.r.l.s.",
      intestazione: "PROSPETTO PAGA — MARZO 2027",
      meta: [
        "Dipendente: ROSSI MARIO (nome di fantasia)",
        "Qualifica: cuoco - livello 4 CCNL Pubblici Esercizi",
        "Periodo: 01/03/2027 - 31/03/2027  —  Giorni lavorati: 22",
      ],
      colonne: [
        { titolo: "Voce", chiave: "voce", x: 50 },
        { titolo: "Importo", chiave: "importo", x: 400 },
      ],
      righe: [
        { voce: "Retribuzione lorda", importo: "1.842,50" },
        { voce: "Straordinari (8 ore)", importo: "112,40" },
        { voce: "Contributi a carico dipendente", importo: "-179,73" },
        { voce: "IRPEF netta", importo: "-243,18" },
        { voce: "NETTO IN BUSTA", importo: "1.531,99" },
        { voce: "", importo: "" },
        { voce: "Contributi a carico azienda", importo: "612,15" },
        { voce: "Ratei (TFR, tredicesima, ferie)", importo: "331,08" },
      ],
      totali: ["COSTO AZIENDA DEL MESE: 2.898,13"],
      coda: "Versamento F24 contributi: entro il 16/04/2027. Bonifico netto: 10/04/2027.",
    }),
  },
  {
    file: "FINTA-Pubblicita-forniture.pdf",
    cosa: "Pubblicità: NON è un documento. Serve a vedere che il sistema non la archivia.",
    righe: foglio({
      mittente: "GrandiForniture PROVA — La tua ristorazione al top!",
      intestazione: "OFFERTA IRRIPETIBILE DI PRIMAVERA",
      meta: [
        "Solo per questa settimana: sconti fino al 40% su tutto il catalogo!",
        "Chiama ora il numero verde 800 000 000",
      ],
      colonne: [
        { titolo: "Promozione", chiave: "desc", x: 50 },
        { titolo: "Sconto", chiave: "sconto", x: 400 },
      ],
      righe: [
        { desc: "Pentolame professionale - intera linea", sconto: "-30%" },
        { desc: "Detergenti e sanificanti", sconto: "-40%" },
        { desc: "Abbigliamento cucina", sconto: "-25%" },
      ],
      totali: ["Spedizione gratuita sopra i 300 euro di ordine!"],
      coda: "Per non ricevere piu' queste comunicazioni rispondi CANCELLAMI.",
    }),
  },
];

// ---------------------------------------------------------------------
mkdirSync(CARTELLA, { recursive: true });
titolo(`Documenti finti del collaudo — ${CARTELLA}`);
for (const d of DOCUMENTI) {
  const percorso = path.join(CARTELLA, d.file);
  writeFileSync(percorso, paginaPdf(d.righe));
  console.log(`   ${d.file}`);
  console.log(`      ${d.cosa}`);
}
console.log("");
console.log(`   ${DOCUMENTI.length} documenti. Si rigenerano identici: non serve conservarli.`);
console.log("");
