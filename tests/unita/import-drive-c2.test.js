import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  abbinaFile,
  codiceSezione,
  improntaFile,
  leggiCsv,
  leggiDataCsv,
  leggiMappa,
  normalizzaNome,
  notaSensibile,
  problemiRiga,
  rigaAnteprima,
  rigaPerElencoDrive,
  righeElenco,
  segnaDoppioni,
  titoloDaNome,
} from "../../src/lib/calcoli/importDrive";

// L'import dal Drive, pezzo C2 (22/11/2026): la logica pura, con righe INVENTATE (il repo è pubblico).

const INTESTAZIONE = "caricare,nome,cartella,formato,MB,data,tipo,sezione,sensibile,no_AI,link";
const riga = (caricare, nome, cartella, sezione, extra = {}) =>
  [
    caricare,
    `"${nome.replace(/"/g, '""')}"`,
    `"${cartella}"`,
    "PDF",
    extra.mb ?? "0.5",
    extra.data ?? "02/11/2026 (nome)",
    "contratto",
    sezione,
    extra.sensibile ?? "no",
    extra.noAi ?? "no",
    extra.link ?? `https://example.invalid/${encodeURIComponent(nome)}`,
  ].join(",");
const csv = (...righe) => [INTESTAZIONE, ...righe].join("\r\n");
const file = (nome, extra = {}) => ({ name: nome, size: extra.size ?? 10, lastModified: 1, webkitRelativePath: extra.percorso ?? "" });

const SEZIONI = [
  { codice: "contratti", etichetta: "Contratti", attiva: true },
  { codice: "progetto_planimetrie", etichetta: "Progetto e planimetrie", attiva: true },
  { codice: "preventivi", etichetta: "Preventivi", attiva: true },
  { codice: "vecchia", etichetta: "Vecchia", attiva: false },
];

describe("leggiCsv", () => {
  it("legge virgole dentro le virgolette, virgolette doppie, BOM e righe a capo", () => {
    const t = '﻿a,b,c\r\n"uno, due","dice ""ciao""",tre\r\n"va\na capo",x,y\r\n';
    expect(leggiCsv(t)).toEqual([
      ["a", "b", "c"],
      ["uno, due", 'dice "ciao"', "tre"],
      ["va\na capo", "x", "y"],
    ]);
  });
  it("ignora le righe vuote e legge l'ultima riga senza a capo", () => {
    expect(leggiCsv("a,b\n\n\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("normalizzaNome", () => {
  it("NFC, minuscole, apostrofi e trattini tipografici come quelli normali, spazi ridotti", () => {
    const decomposto = "Perché ‘Dell’Orto’  —  Contratto.PDF";
    expect(normalizzaNome(decomposto)).toBe("perché 'dell'orto' - contratto.pdf");
    expect(normalizzaNome("Perché 'Dell'Orto' - Contratto.pdf")).toBe(normalizzaNome(decomposto));
  });
  it("gli accenti NON si tolgono: «è» e «e» sono nomi diversi", () => {
    expect(normalizzaNome("caffè.pdf")).not.toBe(normalizzaNome("caffe.pdf"));
  });
  it("titolo dal nome: senza estensione", () => {
    expect(titoloDaNome("Preventivo — Ditta Prova — 2026-11-02.pdf")).toBe("Preventivo — Ditta Prova — 2026-11-02");
    expect(titoloDaNome("senza estensione")).toBe("senza estensione");
  });
});

describe("leggiDataCsv", () => {
  it("«(nome)» è sicura, «(modifica)» è da verificare, vuota non c'è", () => {
    expect(leggiDataCsv("02/11/2026 (nome)")).toEqual({ iso: "2026-11-02", daVerificare: false, origine: "nome" });
    expect(leggiDataCsv("10/10/2026 (modifica)")).toEqual({ iso: "2026-10-10", daVerificare: true, origine: "modifica" });
    expect(leggiDataCsv("")).toEqual({ iso: null, daVerificare: true, origine: null });
  });
  it("una data impossibile non entra", () => {
    expect(leggiDataCsv("31/02/2026 (nome)").iso).toBeNull();
  });
});

describe("notaSensibile", () => {
  it("toglie «sì — » e lascia la nota; «no» e vuoto non hanno nota", () => {
    expect(notaSensibile("sì — IBAN")).toBe("IBAN");
    expect(notaSensibile("sì — documento d'identità")).toBe("documento d'identità");
    expect(notaSensibile("no")).toBeNull();
    expect(notaSensibile("")).toBeNull();
    expect(notaSensibile("sì")).toBe("riservato");
  });
  it("al massimo 80 caratteri (il limite del database)", () => {
    expect(notaSensibile("sì — " + "x".repeat(200))).toHaveLength(80);
  });
});

describe("leggiMappa", () => {
  it("legge le righe, distingue «sì» da tutto il resto", () => {
    const m = leggiMappa(csv(riga("sì", "Contratto A.pdf", "Cartella, uno", "contratti"), riga("no (solo elenco)", "Appunti.docx", "Altra", "")));
    expect(m.ok).toBe(true);
    expect(m.righe).toHaveLength(2);
    expect(m.righe[0]).toMatchObject({ entra: true, nome: "Contratto A.pdf", cartella: "Cartella, uno", sezione: "contratti", mb: 0.5 });
    expect(m.righe[1].entra).toBe(false);
  });
  it("un refuso nella colonna «caricare» NON entra", () => {
    const m = leggiMappa(csv(riga("si'", "A.pdf", "C", "contratti"), riga("", "B.pdf", "C", "contratti")));
    expect(m.righe.every((r) => !r.entra)).toBe(true);
  });
  it("con BOM e intestazione in maiuscole funziona; un file che non è la mappa è rifiutato con le colonne mancanti", () => {
    expect(leggiMappa("﻿" + csv(riga("sì", "A.pdf", "C", "contratti"))).ok).toBe(true);
    const sbagliata = leggiMappa("a,b\n1,2");
    expect(sbagliata.ok).toBe(false);
    expect(sbagliata.errore).toContain("caricare");
    expect(leggiMappa("").ok).toBe(false);
  });
  it("la nota sul riservato e la data arrivano già letti", () => {
    const m = leggiMappa(csv(riga("sì", "A.pdf", "C", "banca", { sensibile: "sì — IBAN", data: "10/10/2026 (modifica)" })));
    expect(m.righe[0].sensibile).toBe("IBAN");
    expect(m.righe[0].data.daVerificare).toBe(true);
  });
});

describe("codiceSezione", () => {
  it("riconosce codice o etichetta, senza badare a maiuscole e accenti; le sezioni spente non contano", () => {
    expect(codiceSezione("Contratti", SEZIONI)).toBe("contratti");
    expect(codiceSezione("Progetto e planimetrie", SEZIONI)).toBe("progetto_planimetrie");
    expect(codiceSezione("PROGETTO_PLANIMETRIE", SEZIONI)).toBe("progetto_planimetrie");
    expect(codiceSezione("Vecchia", SEZIONI)).toBeNull();
    expect(codiceSezione("Non esiste", SEZIONI)).toBeNull();
    expect(codiceSezione("", SEZIONI)).toBeNull();
  });
});

describe("abbinaFile", () => {
  const m = leggiMappa(
    csv(
      riga("sì", "Contratto A.pdf", "Drive/uno", "contratti"),
      riga("no (solo elenco)", "Solo elenco.pdf", "Drive/due", ""),
      riga("sì", "Doppio.pdf", "Drive/01_alfa", "contratti"),
      riga("sì", "Doppio.pdf", "Drive/02_beta", "preventivi"),
      riga("sì", "Perché ‘x’ — A.pdf", "Drive/tre", "contratti")
    )
  ).righe;

  it("un file della mappa con «sì» passa", () => {
    expect(abbinaFile(file("contratto a.PDF"), m)).toMatchObject({ esito: "ok", riga: { nome: "Contratto A.pdf" } });
  });
  it("accenti, apostrofi e trattini tipografici non bloccano l'abbinamento", () => {
    expect(abbinaFile(file("Perché 'x' - A.pdf"), m).esito).toBe("ok");
  });
  it("un file sconosciuto è rifiutato, con il motivo", () => {
    const r = abbinaFile(file("Mai visto.pdf"), m);
    expect(r.esito).toBe("rifiutato");
    expect(r.motivo).toContain("non conosce");
  });
  it("un file che la mappa tiene «solo elenco» è rifiutato", () => {
    const r = abbinaFile(file("Solo elenco.pdf"), m);
    expect(r.esito).toBe("rifiutato");
    expect(r.motivo).toContain("solo in elenco");
  });
  it("due righe con lo stesso nome: si distingue dalla cartella, altrimenti si chiede", () => {
    expect(abbinaFile(file("Doppio.pdf", { percorso: "x/01_alfa/Doppio.pdf" }), m)).toMatchObject({ esito: "ok", riga: { sezione: "contratti" } });
    expect(abbinaFile(file("Doppio.pdf", { percorso: "x/02_beta/Doppio.pdf" }), m)).toMatchObject({ esito: "ok", riga: { sezione: "preventivi" } });
    const ambiguo = abbinaFile(file("Doppio.pdf"), m);
    expect(ambiguo.esito).toBe("da_scegliere");
    expect(ambiguo.candidate).toHaveLength(2);
  });
});

describe("anteprima e problemi", () => {
  const m = leggiMappa(csv(riga("sì", "Contratto A.pdf", "C", "Contratti"), riga("sì", "Strano.pdf", "C", "Sezione inventata", { data: "" })));
  const f = (n) => ({ ...file(n, { size: 2 * 1024 * 1024 }) });

  it("una riga buona nasce pronta, con no_ai SPENTO", () => {
    const r = rigaAnteprima({ file: f("Contratto A.pdf"), riga: m.righe[0], sezioni: SEZIONI });
    expect(r).toMatchObject({ titolo: "Contratto A", sezione: "contratti", data: "2026-11-02", noAi: false, mb: 2, selezionato: true });
    expect(problemiRiga(r, SEZIONI)).toEqual([]);
  });
  it("sezione sconosciuta e data mancante sono problemi detti a parole, e non si indovina", () => {
    const r = rigaAnteprima({ file: f("Strano.pdf"), riga: m.righe[1], sezioni: SEZIONI });
    expect(r.sezione).toBe("");
    const p = problemiRiga(r, SEZIONI);
    expect(p.join(" ")).toContain("«Sezione inventata» non esiste");
    expect(p.join(" ")).toContain("manca la data");
  });
  it("un file vuoto e un titolo vuoto sono problemi", () => {
    const r = { ...rigaAnteprima({ file: file("A.pdf", { size: 0 }), riga: m.righe[0], sezioni: SEZIONI }), titolo: " " };
    const p = problemiRiga(r, SEZIONI).join(" ");
    expect(p).toContain("file è vuoto");
    expect(p).toContain("manca il titolo");
  });
});

describe("segnaDoppioni", () => {
  it("segna chi ha l'impronta già in Archivio e chi è scelto due volte", () => {
    const righe = [
      { nome: "a.pdf", impronta: "aa" },
      { nome: "b.pdf", impronta: "bb" },
      { nome: "c.pdf", impronta: "bb" },
      { nome: "d.pdf", impronta: null },
    ];
    const r = segnaDoppioni(righe, new Map([["aa", "Titolo già presente"]]));
    expect(r[0].doppione).toContain("Titolo già presente");
    expect(r[1].doppione).toBeNull();
    expect(r[2].doppione).toContain("b.pdf");
    expect(r[3].doppione).toBeNull();
  });
});

describe("l'elenco del Drive", () => {
  const m = leggiMappa(
    csv(
      riga("sì", "Importato.pdf", "C", "contratti"),
      riga("no (solo elenco)", "Uno.pdf", "C", "", { link: "https://example.invalid/uno" }),
      riga("no (solo elenco)", "Due.pdf", "C", "", { link: "https://example.invalid/due" }),
      riga("no (solo elenco)", "Due bis.pdf", "C", "", { link: "https://example.invalid/due" }),
      riga("no (solo elenco)", "Senza link.pdf", "C", "", { link: "" }),
      riga("no (solo elenco)", "Non sicuro.pdf", "C", "", { link: "http://example.invalid/x" })
    )
  ).righe;

  it("le righe «sì» NON vanno nell'elenco; i link già presenti o ripetuti non si duplicano; quelli non validi si contano", () => {
    const e = righeElenco(m, new Set(["https://example.invalid/uno"]));
    expect(e.nuove.map((r) => r.nome)).toEqual(["Due.pdf"]);
    expect(e.presenti.map((r) => r.nome)).toEqual(["Uno.pdf", "Due bis.pdf"]);
    expect(e.senzaLink.map((r) => r.nome)).toEqual(["Senza link.pdf", "Non sicuro.pdf"]);
  });
  it("la riga per il database: no_ai spento, data e nota già pronte", () => {
    const r = rigaPerElencoDrive(righeElenco(m).nuove[0]);
    expect(r).toMatchObject({ nome: "Uno.pdf", no_ai: false, link: "https://example.invalid/uno", sensibile: null });
  });
});

describe("improntaFile", () => {
  it("è lo SHA-256 vero del contenuto", async () => {
    expect(await improntaFile(new Blob(["abc"]))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("NESSUN FILE VA A UN MODELLO", () => {
  const sorgenti = ["src/lib/api/importDrive.js", "src/lib/calcoli/importDrive.js", "src/pages/documenti/ImportaDalDrive.jsx"].map((p) => readFileSync(p, "utf8"));
  it("l'import non chiama nessuna funzione che legge con un modello", () => {
    for (const s of sorgenti) {
      expect(s).not.toMatch(/documento-leggi|assistente-archivio|memo-chat|leggiContenutoDocumento|chiediAllArchivio|functions\.invoke|api\.anthropic/);
      expect(s).not.toMatch(/from "\.\.\/(\.\.\/)?lib\/api\/assistente"|from "\.\/assistente"/);
    }
  });
  it("la pagina fa partire no_ai SPENTO (decisione di Alessio del 22/11) e non lo accende da sola", () => {
    expect(readFileSync("src/lib/calcoli/importDrive.js", "utf8")).toContain("noAi: false");
    expect(readFileSync("src/lib/api/importDrive.js", "utf8")).toContain("no_ai: noAi === true");
  });
});

// La revisione del 22/11: la mappa che non si legge, i file che non ci stanno, la chiave col percorso.
import { CSV_MAX_BYTE, LIMITE_FILE_MB, chiaveFile, controllaFile, leggiCsvConErrore } from "../../src/lib/calcoli/importDrive";

describe("la mappa che non si legge si dice", () => {
  it("una virgoletta aperta e mai chiusa è un errore, non una mappa più corta", () => {
    expect(leggiCsvConErrore('a,"b\nc,d').virgoletteAperte).toBe(true);
    expect(leggiCsvConErrore('a,"b"\nc,d').virgoletteAperte).toBe(false);
    const m = leggiMappa(csv(riga("sì", "A.pdf", "C", "contratti")) + '\nsì,"nome senza fine,x');
    expect(m.ok).toBe(false);
    expect(m.errore).toContain("virgoletta aperta");
  });
  it("un file con il punto e virgola (o tabulazioni) dice che il separatore deve essere la virgola", () => {
    for (const t of ["caricare;nome;sezione;link\nsì;a;b;c", "caricare\tnome\tsezione\tlink\nsì\ta\tb\tc"]) {
      const m = leggiMappa(t);
      expect(m.ok).toBe(false);
      expect(m.errore).toContain("deve essere la virgola");
    }
  });
  it("una cella lunghissima è rifiutata con il numero di riga", () => {
    const m = leggiMappa(csv(riga("sì", "x".repeat(1500), "C", "contratti")));
    expect(m.ok).toBe(false);
    expect(m.errore).toMatch(/riga 2/);
  });
  it("il tetto di dimensione della mappa è 2 MB", () => {
    expect(CSV_MAX_BYTE).toBe(2 * 1024 * 1024);
  });
});

describe("controllaFile", () => {
  it("oltre il limite del deposito è un rifiuto, con i MB veri nel motivo", () => {
    const r = controllaFile({ name: "a.pdf", size: 80 * 1024 * 1024 });
    expect(r.rifiuto).toContain("80 MB");
    expect(r.rifiuto).toContain(`${LIMITE_FILE_MB} MB`);
    expect(controllaFile({ name: "a.pdf", size: LIMITE_FILE_MB * 1024 * 1024 }).rifiuto).toBeNull();
  });
  it("html, svg e eseguibili sono un avviso (non un rifiuto); i documenti normali nessuno", () => {
    for (const n of ["pagina.HTML", "logo.svg", "programma.exe", "script.sh", "app.msi"]) {
      const r = controllaFile({ name: n, size: 10 });
      expect(r.rifiuto).toBeNull();
      expect(r.avviso).toContain("insolito");
    }
    for (const n of ["a.pdf", "foto.jpg", "relazione.docx", "senza-estensione"]) expect(controllaFile({ name: n, size: 10 }).avviso).toBeNull();
  });
});

describe("chiaveFile", () => {
  it("due file con lo stesso nome in cartelle diverse hanno chiavi diverse", () => {
    const a = { name: "x.pdf", size: 1, lastModified: 5, webkitRelativePath: "uno/x.pdf" };
    const b = { name: "x.pdf", size: 1, lastModified: 5, webkitRelativePath: "due/x.pdf" };
    expect(chiaveFile(a)).not.toBe(chiaveFile(b));
    expect(chiaveFile(a)).toBe(chiaveFile({ ...a }));
  });
});
