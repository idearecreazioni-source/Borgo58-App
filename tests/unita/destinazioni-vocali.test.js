import { describe, expect, it } from "vitest";
import {
  PREFISSO_LISTA_NOMINATA,
  correggiDestinazioni,
  listaNominata,
  senzaListeCheNonEsistono,
  tipoLibero,
} from "../../supabase/functions/ascolta-voce/destinazioni.ts";

// 🔴 IL CASO VERO, dal vivo il 06/09/2026: Alessio detta «segna il pesce
//    spada nella spesa spicciola», MEMO propone «Aggiungi alla spesa» —
//    cioè la lista della spesa normale, che è un'altra cosa — e l'appunto
//    risulta **eseguibile**, quindi mostra «Approva». Lui l'ha premuto per
//    sbaglio.
//
// ⚠️ QUESTE PROVE GUARDANO LA REGOLA, NON IL MODELLO. Il prompt è stato
//    corretto, ma un modello non è una garanzia: la volta dopo può
//    ricondurre lo stesso. Quello che si prova qui è che **anche se lo
//    facesse**, la destinazione non diventa la lista della spesa.

const listaSpesa = (dati) => ({
  tipo: "lista_spesa",
  sicuro: true,
  frase: "Pesce spada in lista",
  dati: { nome_libero: "pesce spada", nome_sentito: "pesce spada", ...dati },
});

describe("una lista nominata che il gestionale non ha", () => {
  it("🔴 «spesa spicciola» NON diventa la lista della spesa", () => {
    const dopo = senzaListeCheNonEsistono(listaSpesa({ lista: "spesa spicciola" }));
    expect(dopo.tipo).not.toBe("lista_spesa");
    expect(dopo.tipo).toBe("lista_nominata_spesa_spicciola");
  });

  it("...e l'appunto lo dice in italiano, col nome che lui ha usato", () => {
    const dopo = senzaListeCheNonEsistono(listaSpesa({ lista: "spesa spicciola" }));
    expect(dopo.destinazione).toBe("Aggiungi a «spesa spicciola»");
    expect(dopo.motivo).toMatch(/spesa spicciola/);
    expect(dopo.motivo).toMatch(/una sola/);
  });

  it("🔴 NON è «non ero sicuro»: MEMO aveva capito", () => {
    // ⚠️ Le due cose si curano in modi diversi. Dirle uguale manderebbe a
    //    cercare un errore di ascolto che non c'è: qui l'ascolto era
    //    giusto, ed è il gestionale a non avere quella lista.
    const dopo = senzaListeCheNonEsistono(listaSpesa({ lista: "spesa spicciola" }));
    expect(dopo.sicuro).toBe(true);
  });

  it("quello che era stato capito NON si perde", () => {
    // Un appunto che non si può eseguire è comunque un promemoria; uno che
    // ha perso il nome della cosa non è niente.
    const dopo = senzaListeCheNonEsistono(listaSpesa({ lista: "spesa spicciola" }));
    expect(dopo.dati.nome_libero).toBe("pesce spada");
    expect(dopo.dati.lista).toBe("spesa spicciola");
  });

  it("vale per qualunque nome, non per un elenco di parole italiane", () => {
    // ⚠️ Cercare «spicciola» nel testo sarebbe un elenco che invecchia al
    //    primo sinonimo. Si guarda un fatto dichiarato: è stata nominata
    //    una lista.
    expect(senzaListeCheNonEsistono(listaSpesa({ lista: "quella del bar" })).tipo)
      .toBe("lista_nominata_quella_del_bar");
    expect(senzaListeCheNonEsistono(listaSpesa({ lista: "lista del pesce" })).tipo)
      .toBe("lista_nominata_lista_del_pesce");
  });
});

describe("il caso normale non cambia", () => {
  it("senza nessuna lista nominata resta la lista della spesa", () => {
    // ⚠️ È la metà che discrimina: una regola che convertisse sempre
    //    romperebbe il gesto più frequente, e la prova sopra passerebbe
    //    lo stesso.
    const dopo = senzaListeCheNonEsistono(listaSpesa({}));
    expect(dopo.tipo).toBe("lista_spesa");
    expect(dopo.motivo).toBeUndefined();
  });

  it("una lista vuota o fatta di spazi non conta come nominata", () => {
    expect(listaNominata(listaSpesa({ lista: "" }))).toBeNull();
    expect(listaNominata(listaSpesa({ lista: "   " }))).toBeNull();
    expect(senzaListeCheNonEsistono(listaSpesa({ lista: "  " })).tipo).toBe("lista_spesa");
  });

  it("le altre destinazioni non vengono toccate", () => {
    const temperatura = { tipo: "temperatura", dati: { gradi: 3, lista: "spesa spicciola" } };
    expect(senzaListeCheNonEsistono(temperatura).tipo).toBe("temperatura");
  });
});

describe("su tutta la filza", () => {
  it("converte solo quelle che vanno convertite", () => {
    const dopo = correggiDestinazioni([
      listaSpesa({}),
      listaSpesa({ lista: "spesa spicciola" }),
      { tipo: "promemoria", dati: { titolo: "x" } },
    ]);
    expect(dopo.map((a) => a.tipo)).toEqual([
      "lista_spesa",
      "lista_nominata_spesa_spicciola",
      "promemoria",
    ]);
  });
});

describe("🔴 i due casi che la revisione ha trovato scoperti", () => {
  it("«spesa» NON deve produrre il tipo vero «lista_spesa»", () => {
    // 🔴 LA PRIMA STESURA LO FACEVA: il prefisso era `lista_`, quindi
    //    `lista` + `spesa` dava esattamente il tipo eseguibile che questa
    //    regola esiste per evitare — e l'appunto tornava approvabile.
    //    Nessuna prova ci passava sopra: l'ha visto la revisione del diff.
    expect(tipoLibero("qualunque cosa")).toMatch(/^lista_nominata_/);
    expect(tipoLibero("spesa")).not.toBe("lista_spesa");
    expect(PREFISSO_LISTA_NOMINATA).toBe("lista_nominata_");
  });

  it("i modi di dire «quella normale» NON diventano una lista a parte", () => {
    // ⚠️ Il difetto allo specchio: bloccare la lista vera romperebbe il
    //    gesto più frequente, e la prova sopra passerebbe lo stesso.
    for (const nome of [
      "spesa",
      "la spesa",
      "lista spesa",
      "lista della spesa",
      "LA Lista Della Spesa",
    ]) {
      expect(listaNominata(listaSpesa({ lista: nome })), nome).toBeNull();
      expect(senzaListeCheNonEsistono(listaSpesa({ lista: nome })).tipo, nome).toBe("lista_spesa");
    }
  });

  it("gli accenti non sopravvivono nel tipo, ma il nome sì", () => {
    const dopo = senzaListeCheNonEsistono(listaSpesa({ lista: "perché no" }));
    expect(dopo.tipo).toBe("lista_nominata_perche_no");
    expect(dopo.destinazione).toBe("Aggiungi a «perché no»");
  });

  it("un valore che non è testo non converte niente e non rompe", () => {
    for (const strano of [42, { a: 1 }, [1, 2], null, true]) {
      expect(senzaListeCheNonEsistono(listaSpesa({ lista: strano })).tipo).toBe("lista_spesa");
    }
  });

  it("un nome fatto solo di segni non produce un tipo vuoto", () => {
    expect(tipoLibero("!!! ???")).toBe("lista_nominata_senza_nome");
  });
});
