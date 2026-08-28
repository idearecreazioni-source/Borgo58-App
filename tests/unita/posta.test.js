import { describe, it, expect } from "vitest";
import {
  statoLettura,
  cosaCeDaLeggere,
  notaDiLettura,
  etichettaConferma,
  etichettaRifiuto,
  motivoAzioneBloccata,
  motivoCaricoBloccato,
  TENTATIVI_DI_RIPIEGO,
  daQuanto,
} from "../../src/lib/calcoli/posta.js";

// ⚠️ Queste prove congelano la differenza fra «sta per essere letta» e
//    «non lo sarà mai più». Il 28/08 la schermata le diceva uguali, e da
//    lì nasceva la frase falsa vista con gli occhi su una mail arresa.

describe("in che stato di lettura è una mail", () => {
  it("in coda: lo dice, e non offre di riprovare (non serve)", () => {
    const s = statoLettura({ stato: "da_leggere", tentativi_lettura: 1 }, 3);
    expect(s.chiave).toBe("in_coda");
    expect(s.frase).toMatch(/parte da sola/);
    expect(s.puoRiprovare).toBe(false);
  });

  it("ARRESA: non dice più che la lettura parte da sola, e offre la via d'uscita", () => {
    const s = statoLettura({ stato: "da_leggere", tentativi_lettura: 3 }, 3);
    expect(s.chiave).toBe("arresa");
    // È la frase esatta che il 28/08 compariva su una mail abbandonata.
    expect(s.frase).not.toMatch(/parte da sola/);
    expect(s.frase).toMatch(/si è fermato/);
    expect(s.puoRiprovare).toBe(true);
  });

  it("il confine è il tetto, e il tetto arriva da fuori", () => {
    // Con un tetto di 5, tre tentativi NON sono una resa.
    expect(statoLettura({ stato: "da_leggere", tentativi_lettura: 3 }, 5).chiave).toBe("in_coda");
    expect(statoLettura({ stato: "da_leggere", tentativi_lettura: 5 }, 5).chiave).toBe("arresa");
  });

  // 🔴 SE IL TETTO NON SI E POTUTO LEGGERE, NON SI INDOVINA. Ripiegare su
  //    tre sembra prudente e non lo e: col numero vero a due, una mail
  //    ferma a due risulterebbe «in coda» — cioe la frase falsa che questo
  //    modulo esiste per togliere, rientrata da un altra porta.
  it("un tetto illeggibile non si indovina: si dice che non si sa, e si offre la via d uscita", () => {
    const s = statoLettura({ stato: "da_leggere", tentativi_lettura: 2 }, null);
    expect(s.chiave).toBe("non_so");
    expect(s.frase).not.toMatch(/parte da sola/);
    expect(s.frase).toMatch(/Non riesco a dire/);
    expect(s.puoRiprovare).toBe(true);
  });

  it("...ma una mail MAI tentata si sa lo stesso: nessun tetto la rende abbandonata", () => {
    const s = statoLettura({ stato: "da_leggere", tentativi_lettura: 0 }, null);
    expect(s.chiave).toBe("in_coda");
    expect(TENTATIVI_DI_RIPIEGO).toBe(3);
  });

  it("una mail già letta non parla di lettura", () => {
    expect(statoLettura({ stato: "proposta", tentativi_lettura: 0 }).chiave).toBe("letta");
  });
});

describe("cosa c'è da leggere", () => {
  it("distingue «non c'è niente» da «c'è e non si vede»", () => {
    const conTesto = cosaCeDaLeggere({ testo: "Buongiorno, in allegato…", allegati: [] });
    expect(conTesto.haTesto).toBe(true);
    expect(conTesto.nulla).toBe(false);

    const vuota = cosaCeDaLeggere({ testo: "   ", allegati: [] });
    expect(vuota.haTesto).toBe(false);
    expect(vuota.nulla).toBe(true);
  });

  it("un allegato senza file non conta come apribile", () => {
    const c = cosaCeDaLeggere({
      testo: "",
      allegati: [{ storage_path: null, file_name: "x.pdf" }],
    });
    expect(c.allegatiApribili).toBe(0);
    expect(c.allegatiRotti).toBe(1);
    expect(c.nulla).toBe(true);
  });
});

describe("la nota del lettore non dice cose false", () => {
  it("su una mail ARRESA non dice «l'ho letta in parte» né manda ad aprire allegati che non ci sono", () => {
    const mail = {
      stato: "da_leggere",
      tentativi_lettura: 3,
      lettura_note: "lettura fallita 3 volte, non ci riprovo: il PDF non contiene testo",
      allegati: [],
    };
    const s = statoLettura(mail, 3);
    const n = notaDiLettura(mail, s, cosaCeDaLeggere(mail));
    expect(n.tono).toBe("fermo");
    expect(n.frase).not.toMatch(/solo in parte/);
    expect(n.frase).not.toMatch(/Apri l'allegato/);
    expect(n.frase).toMatch(/il PDF non contiene testo/);
  });

  it("su una lettura parziale SENZA allegati non manda ad aprirne uno", () => {
    const mail = { stato: "proposta", lettura_note: "il totale non torna", allegati: [] };
    const n = notaDiLettura(mail, statoLettura(mail), cosaCeDaLeggere(mail));
    expect(n.tono).toBe("parziale");
    expect(n.frase).not.toMatch(/Apri l'allegato/);
  });

  it("con un allegato apribile, invece, ci manda", () => {
    const mail = {
      stato: "proposta",
      lettura_note: "il totale non torna",
      allegati: [{ storage_path: "x/y.pdf", file_name: "y.pdf" }],
    };
    const n = notaDiLettura(mail, statoLettura(mail), cosaCeDaLeggere(mail));
    expect(n.frase).toMatch(/Apri l'allegato/);
  });

  it("senza nota non si inventa niente", () => {
    const mail = { stato: "proposta", lettura_note: null };
    expect(notaDiLettura(mail, statoLettura(mail), cosaCeDaLeggere(mail))).toBeNull();
  });
});

describe("i pulsanti dicono COSA succede a COSA", () => {
  it("il carico nomina quante righe entrano, e conta solo quelle che entrano davvero", () => {
    const par = {
      righe: [
        { ingrediente_id: "a", quantita: "2" },
        { ingrediente_id: "b", quantita: "1" },
        { ingrediente_id: "c", quantita: "3", salta: true },
        { ingrediente_id: "d", quantita: "0" },
        { descrizione: "senza prodotto" },
      ],
    };
    expect(etichettaConferma({ tipo: "carico_magazzino" }, par)).toBe("Metti 2 righe in magazzino");
  });

  it("una riga sola si dice al singolare", () => {
    const par = { righe: [{ ingrediente_id: "a", quantita: "2" }] };
    expect(etichettaConferma({ tipo: "carico_magazzino" }, par)).toBe("Metti 1 riga in magazzino");
  });

  it("l'archivio nomina il documento", () => {
    expect(
      etichettaConferma({ tipo: "archivia_documento" }, { titolo: "Contratto di locazione" })
    ).toBe("Archivia «Contratto di locazione»");
  });

  it("un titolo lunghissimo si accorcia invece di mandare a capo tre volte", () => {
    const e = etichettaConferma(
      { tipo: "archivia_documento" },
      { titolo: "Comunicazione relativa alla revisione annuale degli impianti di refrigerazione" }
    );
    expect(e.length).toBeLessThanOrEqual(42);
    expect(e).toMatch(/…»$/);
  });

  it("nessuna etichetta resta nuda quando c'è di che nominare", () => {
    const casi = [
      [{ tipo: "promemoria" }, { titolo: "Pagare F24" }],
      [{ tipo: "promemoria_multipli" }, { scadenze: [{}, {}] }],
      [{ tipo: "da_fare_a_mano" }, { titolo: "Chiamare Laura" }],
    ];
    for (const [a, p] of casi) {
      expect(etichettaConferma(a, p)).not.toBe("Conferma");
    }
  });

  it("il rifiuto nomina cosa NON si farà", () => {
    expect(etichettaRifiuto({ tipo: "carico_magazzino" })).toBe("Non caricare");
    expect(etichettaRifiuto({ tipo: "archivia_documento" })).toBe("Non archiviare");
    expect(etichettaRifiuto({ tipo: "promemoria" })).toBe("Non mettere in agenda");
  });
});

describe("il carico si spegne CON LA RAGIONE, non si lascia premere per essere rifiutato", () => {
  it("senza fornitore è bloccato, e la ragione nomina il fornitore e il perché", () => {
    const m = motivoCaricoBloccato(
      { tipo: "carico_magazzino" },
      { righe: [{ ingrediente_id: "a", quantita: "2" }] }
    );
    expect(m).toMatch(/fornitore/i);
    expect(m).toMatch(/rincari/i);
  });

  it("col fornitore e con almeno una riga vera, non è bloccato", () => {
    expect(
      motivoCaricoBloccato(
        { tipo: "carico_magazzino" },
        { fornitore_id: "f1", righe: [{ ingrediente_id: "a", quantita: "2" }] }
      )
    ).toBeNull();
  });

  it("col fornitore ma senza nessuna riga da caricare, è bloccato per l'altra ragione", () => {
    const m = motivoCaricoBloccato(
      { tipo: "carico_magazzino" },
      { fornitore_id: "f1", righe: [{ ingrediente_id: "a", quantita: "0" }] }
    );
    expect(m).toMatch(/niente da mettere in magazzino/i);
    expect(m).not.toMatch(/Scegli il fornitore/i);
  });

  // 🔴 Trovato APRENDO la schermata, non rileggendo il codice: su una
  //    proposta con zero righe la prima versione diceva «scegli il
  //    fornitore». Uno lo sceglie, e non cambia niente — perché il
  //    problema era un altro. Si nomina per prima la causa che l'altra
  //    non può risolvere.
  it("senza righe E senza fornitore, nomina le RIGHE: sceglierlo non aggiungerebbe niente", () => {
    const m = motivoCaricoBloccato({ tipo: "carico_magazzino" }, { righe: [] });
    expect(m).toMatch(/niente da mettere in magazzino/i);
    expect(m).not.toMatch(/Scegli il fornitore/i);
  });

  it("ma con delle righe vere, il fornitore torna a essere la ragione", () => {
    const m = motivoCaricoBloccato(
      { tipo: "carico_magazzino" },
      { righe: [{ ingrediente_id: "a", quantita: "3" }] }
    );
    expect(m).toMatch(/Scegli il fornitore/i);
  });

  it("le altre azioni non vengono bloccate da questa regola", () => {
    expect(motivoCaricoBloccato({ tipo: "archivia_documento" }, {})).toBeNull();
  });
});

// 🔴 L'ARCHIVIO SENZA IDENTITA' — dimostrato con le mani da Alessio il
//    28/08: sei campi vuoti, «Archivia» premuto, e il gestionale ha
//    archiviato senza rifiutare e senza avvisare.
describe("un documento non si archivia senza identita", () => {
  it("senza tipo NE data: bloccato, e la ragione nomina tutt'e due", () => {
    const m = motivoAzioneBloccata({ tipo: "archivia_documento" }, { titolo: "Rapportino" });
    expect(m).toMatch(/tipo/i);
    expect(m).toMatch(/data/i);
    expect(m).toMatch(/Correggi i dati/);
  });

  it("manca solo il tipo: lo dice, e non parla della data", () => {
    const m = motivoAzioneBloccata({ tipo: "archivia_documento" }, { data: "2026-07-12" });
    expect(m).toMatch(/Manca il tipo/);
    expect(m).not.toMatch(/Manca la data/);
  });

  it("manca solo la data: lo dice, e non parla del tipo", () => {
    const m = motivoAzioneBloccata({ tipo: "archivia_documento" }, { tipo: "rapportino" });
    expect(m).toMatch(/Manca la data/);
    expect(m).not.toMatch(/Manca il tipo/);
  });

  it("e NON e' un muro: con tutt'e due si archivia", () => {
    expect(
      motivoAzioneBloccata({ tipo: "archivia_documento" }, { tipo: "rapportino", data: "2026-07-12" })
    ).toBeNull();
  });

  it("uno spazio non e' un tipo: non basta riempire per finta", () => {
    expect(
      motivoAzioneBloccata({ tipo: "archivia_documento" }, { tipo: "   ", data: "2026-07-12" })
    ).toMatch(/Manca il tipo/);
  });

  it("vale anche per il testo archiviato, che finisce nella stessa tabella", () => {
    expect(motivoAzioneBloccata({ tipo: "archivia_testo" }, {})).toMatch(/tipo/i);
  });

  it("e il carico resta governato dalla sua regola, non da questa", () => {
    expect(
      motivoAzioneBloccata({ tipo: "carico_magazzino" }, { righe: [{ ingrediente_id: "a", quantita: "2" }] })
    ).toMatch(/Scegli il fornitore/);
  });
});

// 🔴 IL LETTORE FERMO — tre mail sul progetto di prova dicevano da NOVE
//    GIORNI «la lettura parte da sola entro un quarto d'ora», su un
//    gestionale dove non girava nessun lavoro pianificato.
describe("la Posta dice se MEMO sta leggendo", () => {
  const ferma = { stato: "da_leggere", tentativi_lettura: 0 };

  it("se il lettore e fermo NON promette un quarto d'ora, e offre il gesto", () => {
    const s = statoLettura(ferma, 3, { fermo: true, minuti: 8374, cosa_smette: "x" });
    expect(s.chiave).toBe("lettore_fermo");
    expect(s.frase).not.toMatch(/parte da sola/);
    expect(s.frase).toMatch(/non sta leggendo/);
    expect(s.puoLeggereAdesso).toBe(true);
  });

  it("e dice DA QUANTO in parole: 8374 minuti non significano niente per nessuno", () => {
    const s = statoLettura(ferma, 3, { fermo: true, minuti: 8374, cosa_smette: "x" });
    expect(s.frase).toMatch(/5 giorni/);
    expect(s.frase).not.toMatch(/8374/);
  });

  it("se invece sta leggendo, la promessa torna vera", () => {
    const s = statoLettura(ferma, 3, { fermo: false, minuti: 0, cosa_smette: null });
    expect(s.chiave).toBe("in_coda");
    expect(s.frase).toMatch(/parte da sola/);
    expect(s.puoLeggereAdesso).toBe(false);
  });

  it("una mail ARRESA resta arresa anche col lettore fermo: e un altro problema", () => {
    const s = statoLettura(
      { stato: "da_leggere", tentativi_lettura: 3 },
      3,
      { fermo: false, minuti: 0 }
    );
    expect(s.chiave).toBe("arresa");
  });

  it("«letta» si DICE, e dice quando: prima lo si deduceva dalla proposta qui sotto", () => {
    const s = statoLettura({ stato: "proposta", proposta_il: "2026-08-21T09:30:00Z" }, 3, null);
    expect(s.chiave).toBe("letta");
    expect(s.frase).toMatch(/Letta da MEMO il/);
    expect(s.frase).toMatch(/21\/08\/2026/);
  });

  it("letta ma senza sapere quando: lo dice lo stesso, senza inventare una data", () => {
    const s = statoLettura({ stato: "proposta" }, 3, null);
    expect(s.frase).toBe("Letta da MEMO.");
  });
});

describe("da quanto tace, in parole", () => {
  it("minuti, ore e giorni", () => {
    expect(daQuanto(1)).toBe("1 minuto");
    expect(daQuanto(45)).toBe("45 minuti");
    expect(daQuanto(60)).toBe("1 ora");
    expect(daQuanto(300)).toBe("5 ore");
    expect(daQuanto(1440)).toBe("1 giorno");
    expect(daQuanto(8374)).toBe("5 giorni");
  });

  it("un numero che non e un numero non diventa «NaN giorni»", () => {
    expect(daQuanto(null)).toBe("poco");
    expect(daQuanto("boh")).toBe("poco");
    expect(daQuanto(-3)).toBe("poco");
  });
});
