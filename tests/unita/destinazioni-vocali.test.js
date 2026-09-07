import { describe, expect, it } from "vitest";
import {
  PREFISSO_LISTA_NOMINATA,
  TIPO_LISTA,
  TIPO_LISTA_NON_DETTA,
  TIPO_SPICCIOLA,
  correggiDestinazioni,
  destinazioneDellaLista,
  listaNominata,
  nomeDellaLista,
  tipoLibero,
  versoLaLista,
} from "../../supabase/functions/ascolta-voce/destinazioni.ts";

// 🔴 IL CASO VERO, dal vivo il 06/09/2026: Alessio detta «segna il pesce
//    spada nella spesa spicciola», MEMO propone «Aggiungi alla spesa» —
//    cioè la lista della spesa normale, che è un'altra cosa — e l'appunto
//    risulta **eseguibile**, quindi mostra «Approva». Lui l'ha premuto per
//    sbaglio.
//
// 🔴 QUEL GIORNO la cura fu rendere l'appunto NON approvabile. Dal
//    07/09/2026 (SPEC-0012) la spesa spicciola è una destinazione vera:
//    l'appunto si approva e finisce **nella sua lista**.
//
// ⚠️ QUESTE PROVE GUARDANO LA REGOLA, NON IL MODELLO. Il prompt glielo
//    chiede, ma un modello non è una garanzia: quello che si prova qui è
//    che il **nome dichiarato** decide, qualunque tipo il modello proponga.

const listaSpesa = (dati, tipo = "lista_spesa") => ({
  tipo,
  sicuro: true,
  frase: "Pesce spada in lista",
  dati: { nome_libero: "pesce spada", nome_sentito: "pesce spada", ...dati },
});

describe("le due liste che il gestionale ha davvero", () => {
  it("🔴 «spesa spicciola» va nella spesa spicciola, non nella lista della spesa", () => {
    const dopo = destinazioneDellaLista(listaSpesa({ lista: "spesa spicciola" }));
    expect(dopo.tipo).toBe(TIPO_SPICCIOLA);
    expect(dopo.tipo).not.toBe(TIPO_LISTA);
    expect(dopo.destinazione).toBe("Aggiungi alla spesa spicciola");
  });

  it("🔴 ...e «lista della spesa» resta la lista della spesa", () => {
    // ⚠️ È la metà che discrimina: una regola che mandasse tutto nella
    //    spicciola passerebbe la prova qui sopra e romperebbe il gesto che
    //    finisce in un ordine al fornitore.
    const dopo = destinazioneDellaLista(listaSpesa({ lista: "lista della spesa" }));
    expect(dopo.tipo).toBe(TIPO_LISTA);
    expect(dopo.destinazione).toBe("Aggiungi alla lista della spesa");
  });

  it("una nella spicciola non finisce nell'altra, e viceversa", () => {
    // La proprietà che il mandato chiede, in una prova sola.
    for (const nome of ["spicciola", "la spesa spicciola", "lista spicciola"]) {
      expect(versoLaLista(listaSpesa({ lista: nome })), nome).toBe("spicciola");
    }
    for (const nome of ["spesa", "la spesa", "lista spesa", "LA Lista Della Spesa"]) {
      expect(versoLaLista(listaSpesa({ lista: nome })), nome).toBe("spesa");
    }
  });

  it("🔴 il NOME DETTO vince sul tipo proposto dal modello, nei due versi", () => {
    // ⚠️ È la protezione vera: il modello propone, il fatto dichiarato
    //    decide. Se un giorno sbagliasse tipo, la roba non cambia lista.
    const modelloSbaglia = listaSpesa({ lista: "spesa spicciola" }, "lista_spesa");
    expect(destinazioneDellaLista(modelloSbaglia).tipo).toBe(TIPO_SPICCIOLA);

    const alContrario = listaSpesa({ lista: "lista della spesa" }, "spesa_spicciola");
    expect(destinazioneDellaLista(alContrario).tipo).toBe(TIPO_LISTA);
  });

  it("quello che era stato capito NON si perde", () => {
    const dopo = destinazioneDellaLista(listaSpesa({ lista: "spesa spicciola" }));
    expect(dopo.dati.nome_libero).toBe("pesce spada");
    expect(dopo.dati.lista).toBe("spesa spicciola");
  });
});

describe("🔴 se la lista non è stata detta, non se ne sceglie una", () => {
  // 🔴 CAMBIA UN COMPORTAMENTO, ed è la riga più importante di SPEC-0012:
  //    fino al 06/09 il silenzio valeva «lista della spesa». Con una lista
  //    sola era una scorciatoia innocua; con due è una scelta fatta al
  //    posto suo, e quella sbagliata si scopre quando la roba è già nella
  //    lista che va al fornitore.
  it("non diventa la lista della spesa", () => {
    const dopo = destinazioneDellaLista(listaSpesa({}));
    expect(dopo.tipo).not.toBe(TIPO_LISTA);
    expect(dopo.tipo).toBe(TIPO_LISTA_NON_DETTA);
  });

  it("...e l'appunto CHIEDE, con le due parole da dire", () => {
    // ⚠️ Un rifiuto senza gesto d'uscita è un vicolo cieco: qui l'uscita è
    //    sapere che cosa ridire.
    const dopo = destinazioneDellaLista(listaSpesa({}));
    expect(dopo.destinazione).toBe("Quale delle due liste?");
    expect(dopo.motivo).toMatch(/lista della spesa/);
    expect(dopo.motivo).toMatch(/spesa spicciola/);
    expect(dopo.sicuro).toBe(true);
  });

  it("🔴 e NON dice che il gestionale non sa farlo, perché lo sa", () => {
    // 🔴 DAL COLLAUDO A MANO DEL 07/09/2026. La frase che si leggeva era
    //    «il gestionale non sa ancora farlo», e su questo caso è **falsa**:
    //    le due liste il gestionale le sa scrivere tutt'e due. Quello che
    //    manca è un'informazione che ha lui — quale — e le due cose si
    //    curano in modi opposti: la prima manda a cercare una funzione che
    //    non c'è, la seconda si risolve con una parola in più.
    const motivo = destinazioneDellaLista(listaSpesa({})).motivo;
    expect(motivo).not.toMatch(/non sa ancora farlo|non la sa|sappia ancora fare|costruiamo/i);
    // dice che sa scrivere in tutt'e due…
    expect(motivo).toMatch(/tutt'e due|entrambe/i);
    // …e dice esattamente che cosa ridire, con i due nomi fra virgolette.
    expect(motivo).toMatch(/«alla lista della spesa»/);
    expect(motivo).toMatch(/«alla spesa spicciola»/);
  });

  it("🔴 ...e resta comunque NON approvabile", () => {
    // ⚠️ La metà che discrimina: cambiare le parole non deve cambiare il
    //    comportamento. Se questo tipo diventasse uno del catalogo,
    //    l'appunto tornerebbe approvabile e la riga entrerebbe in una lista
    //    scelta da nessuno.
    const dopo = destinazioneDellaLista(listaSpesa({}));
    expect(dopo.tipo).toBe(TIPO_LISTA_NON_DETTA);
    expect(dopo.tipo).not.toBe(TIPO_LISTA);
    expect(dopo.tipo).not.toBe(TIPO_SPICCIOLA);
  });

  it("una lista vuota o fatta di spazi conta come non detta", () => {
    expect(nomeDellaLista(listaSpesa({ lista: "" }))).toBeNull();
    expect(nomeDellaLista(listaSpesa({ lista: "   " }))).toBeNull();
    expect(destinazioneDellaLista(listaSpesa({ lista: "  " })).tipo).toBe(TIPO_LISTA_NON_DETTA);
  });

  it("un valore che non è testo conta come non detto, e non rompe", () => {
    for (const strano of [42, { a: 1 }, [1, 2], null, true]) {
      expect(destinazioneDellaLista(listaSpesa({ lista: strano })).tipo).toBe(
        TIPO_LISTA_NON_DETTA,
      );
    }
  });

  it("🔴 e NON è un tipo che il gestionale sa eseguire", () => {
    // Se collidesse con un tipo del catalogo, l'appunto tornerebbe
    // approvabile: è il difetto che la revisione trovò il 06/09 sul
    // prefisso delle liste nominate, in un posto nuovo.
    expect(TIPO_LISTA_NON_DETTA).not.toBe(TIPO_LISTA);
    expect(TIPO_LISTA_NON_DETTA).not.toBe(TIPO_SPICCIOLA);
  });
});

describe("una lista che non è nessuna delle due", () => {
  it("resta un appunto che non si può approvare, col nome che ha usato", () => {
    const dopo = destinazioneDellaLista(listaSpesa({ lista: "quella del bar" }));
    expect(dopo.tipo).toBe("lista_nominata_quella_del_bar");
    expect(dopo.destinazione).toBe("Aggiungi a «quella del bar»");
    expect(dopo.motivo).toMatch(/nessuna delle due/);
  });

  it("🔴 NON è «non ero sicuro»: MEMO aveva capito", () => {
    // ⚠️ Le due cose si curano in modi diversi. Dirle uguale manderebbe a
    //    cercare un errore di ascolto che non c'è.
    expect(destinazioneDellaLista(listaSpesa({ lista: "quella del bar" })).sicuro).toBe(true);
  });

  it("vale per qualunque nome, e le due vere non ci finiscono dentro", () => {
    expect(listaNominata(listaSpesa({ lista: "lista del pesce" }))).toBe("lista del pesce");
    expect(listaNominata(listaSpesa({ lista: "spesa spicciola" }))).toBeNull();
    expect(listaNominata(listaSpesa({ lista: "la spesa" }))).toBeNull();
  });

  it("gli accenti non sopravvivono nel tipo, ma il nome sì", () => {
    const dopo = destinazioneDellaLista(listaSpesa({ lista: "perché no" }));
    expect(dopo.tipo).toBe("lista_nominata_perche_no");
    expect(dopo.destinazione).toBe("Aggiungi a «perché no»");
  });

  it("«spesa» non produce mai il tipo vero, e un nome di soli segni non svuota il tipo", () => {
    // 🔴 LA PRIMA STESURA DEL 06/09 LO FACEVA: il prefisso era `lista_`,
    //    quindi `lista` + `spesa` dava esattamente il tipo eseguibile che
    //    quella regola esisteva per evitare.
    expect(tipoLibero("qualunque cosa")).toMatch(/^lista_nominata_/);
    expect(tipoLibero("spesa")).not.toBe(TIPO_LISTA);
    expect(tipoLibero("spesa spicciola")).not.toBe(TIPO_SPICCIOLA);
    expect(PREFISSO_LISTA_NOMINATA).toBe("lista_nominata_");
    expect(tipoLibero("!!! ???")).toBe("lista_nominata_senza_nome");
  });
});

describe("le altre destinazioni e la filza", () => {
  it("una cosa che non è una riga di lista non viene toccata", () => {
    const temperatura = { tipo: "temperatura", dati: { gradi: 3, lista: "spesa spicciola" } };
    expect(destinazioneDellaLista(temperatura).tipo).toBe("temperatura");
  });

  it("su tutta la filza converte solo quelle che vanno convertite", () => {
    const dopo = correggiDestinazioni([
      listaSpesa({ lista: "la spesa" }),
      listaSpesa({ lista: "spesa spicciola" }),
      listaSpesa({ lista: "quella del bar" }),
      listaSpesa({}),
      { tipo: "promemoria", dati: { titolo: "x" } },
    ]);
    expect(dopo.map((a) => a.tipo)).toEqual([
      TIPO_LISTA,
      TIPO_SPICCIOLA,
      "lista_nominata_quella_del_bar",
      TIPO_LISTA_NON_DETTA,
      "promemoria",
    ]);
  });

  it("due articoli detti per liste diverse restano in due destinazioni diverse", () => {
    // Il criterio di accettazione di SPEC-0012, in una prova sola.
    const dopo = correggiDestinazioni([
      listaSpesa({ nome_libero: "parmigiano", lista: "lista della spesa" }),
      listaSpesa({ nome_libero: "shampoo", lista: "spesa spicciola" }),
    ]);
    expect(dopo[0].tipo).toBe(TIPO_LISTA);
    expect(dopo[1].tipo).toBe(TIPO_SPICCIOLA);
    expect(dopo[0].dati.nome_libero).toBe("parmigiano");
    expect(dopo[1].dati.nome_libero).toBe("shampoo");
  });
});
