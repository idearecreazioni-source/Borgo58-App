import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppuntoDaApprovare from "../../src/components/AppuntoDaApprovare";
import { destinazioneAgenda } from "../../supabase/functions/ascolta-voce/agenda.ts";

// =====================================================================
// CHIUDERE E SPOSTARE UN IMPEGNO: CIÒ CHE SI VEDE PRIMA DI FIRMARE
// =====================================================================
// 🔴 «APPROVA» È UNA FIRMA, e dalla fase 2 su questi due appunti la firma fa
//    succedere qualcosa davvero: chiude una riga di Agenda, oppure ne
//    sposta la scadenza. Quello che si prova qui non è la regola — è che
//    chi preme veda **quale impegno** e **quale gesto**, e sullo
//    spostamento **da che giorno a che giorno**.
//
// 🔴 E LA METÀ CHE CONTA È IL CASO OPPOSTO: quando il gestionale non sa
//    quale impegno sia, il pulsante non deve esserci affatto. Un «Approva»
//    su una cosa ambigua è la promessa peggiore che questa schermata possa
//    fare — chi lo preme si aspetta che scelga lui.
//
// ⚠️ L'appunto si costruisce dalla REGOLA VERA (`destinazioneAgenda`) e poi
//    gli si aggiunge quello che il DATABASE ci mette dopo aver guardato in
//    Agenda: l'identificativo dell'impegno, il suo titolo vero e la data di
//    partenza. È la forma in cui arriva davvero alla schermata.

/**
 * Un appunto come lo riceve la schermata.
 *
 * @param risolto  quello che il database aggiunge quando l'impegno l'ha
 *                 trovato. Senza, è il caso in cui non l'ha trovato.
 */
const appuntoDa = (azione, dettato, { risolto = null, approvabile = false } = {}) => {
  const a = destinazioneAgenda(azione, dettato);
  const dati = { ...a.dati, ...(risolto ?? {}) };
  return {
    appunto: {
      id: "app-1",
      destinazione: a.tipo,
      titolo: a.destinazione,
      // ⚠️ `eseguibile` lo scrive il DATABASE leggendo il catalogo delle
      //    azioni vocali: qui si riproduce quello stato, perché è lui a
      //    decidere se il pulsante «Approva» esiste.
      eseguibile: approvabile,
      quanti: 1,
      incerto: false,
      aperto_da_ore: 0,
      aperto_da_giorni: 0,
      elementi: [
        {
          id: "el-1",
          frase: a.frase,
          dati,
          sicuro: true,
          motivo: a.motivo ?? null,
          alternative: [],
          stato: "in_attesa",
          domanda: null,
          scelte: [],
          // 🔴 IL PERCORSO ARRIVA DAL DATABASE (`azione_percorso`), e dalla
          //    fase 2 tutte e tre le destinazioni dell'Agenda ce l'hanno.
          percorso: "/agenda",
        },
      ],
    },
    azione: a,
  };
};

const mostra = (appunto) =>
  render(
    <MemoryRouter>
      <AppuntoDaApprovare
        appunto={appunto}
        occupato={false}
        esito={null}
        onApprova={vi.fn()}
        onScarta={vi.fn()}
        onScegli={vi.fn()}
      />
    </MemoryRouter>,
  );

// =====================================================================
describe("«segna come fatto il rinnovo della firma digitale» — impegno trovato", () => {
  const { appunto } = appuntoDa(
    {
      tipo: "promemoria",
      sicuro: true,
      frase: "Segnato come fatto: rinnovo della firma digitale",
      dati: { titolo: "rinnovo della firma digitale" },
    },
    "Segna come fatto il rinnovo della firma digitale",
    {
      approvabile: true,
      risolto: {
        task_id: "00000000-0000-4000-8000-000000000001",
        // ⚠️ IL TITOLO È QUELLO SCRITTO IN AGENDA, non le parole dette: è
        //    la riga che verrà toccata, e chi firma deve vedere quella.
        titolo: "Rinnovo firma digitale",
        data_precedente: "2026-09-12",
      },
    },
  );

  it("si può approvare", () => {
    mostra(appunto);
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
    expect(screen.queryByText(/Non c'è niente da approvare/i)).toBeNull();
  });

  it("🔴 e mostra QUALE impegno e QUALE gesto, prima della firma", () => {
    mostra(appunto);
    expect(screen.getAllByText(/Rinnovo firma digitale/).length).toBeGreaterThan(0);
    expect(screen.getByText(/gesto: segna fatto/)).toBeTruthy();
    expect(screen.getByText(/Da segnare fatto in Agenda/)).toBeTruthy();
  });

  it("🔴 e il titolo dell'appunto NON promette una cosa nuova", () => {
    // 🔴 Il difetto che la fase 1 ha chiuso e che qui non deve tornare:
    //    senza la regola nasceva un impegno NUOVO chiamato «Segna come
    //    fatto il rinnovo della firma», accanto a quello vero.
    mostra(appunto);
    expect(screen.queryByText(/Annota in Agenda/)).toBeNull();
  });

  it("porta in Agenda, e con un collegamento solo", () => {
    // ⚠️ Fino all'08/09 ce n'erano due: uno dal database e uno che il
    //    modulo della voce si portava dietro nei dati. Adesso il posto lo
    //    dice il database, e basta.
    mostra(appunto);
    const collegamenti = screen.getAllByRole("link");
    expect(collegamenti).toHaveLength(1);
    // ⚠️ Con il suo `daVoce`: e' il telaio della via d'uscita a mano del
    //    27/08, che porta l'identificativo della riga senza i campi.
    expect(collegamenti[0].getAttribute("href")).toMatch(/^\/agenda\?daVoce=/);
    // ⚠️ E non promette campi compilati: lì c'è un impegno da CERCARE.
    expect(screen.queryByText(/campi già compilati/)).toBeNull();
  });
});

// =====================================================================
describe("«sposta a venerdì l'ordine delle verdure» — impegno trovato", () => {
  const { appunto } = appuntoDa(
    {
      tipo: "agenda_da_spostare",
      sicuro: true,
      frase: "Spostare a venerdì l'impegno: ordine delle verdure",
      dati: { impegno: "ordine delle verdure", data_nuova: "2026-09-11" },
    },
    "Sposta a venerdì l'ordine delle verdure",
    {
      approvabile: true,
      risolto: {
        task_id: "00000000-0000-4000-8000-000000000002",
        titolo: "Ordine delle verdure",
        data_precedente: "2026-09-07",
      },
    },
  );

  it("🔴 mostra il titolo, il giorno di prima e quello nuovo", () => {
    // 🔴 TUTTI E TRE, e non solo il nuovo: «lo sposto a venerdì» senza dire
    //    da dove non si può controllare, e chi firma non sa se sta
    //    anticipando o rimandando.
    mostra(appunto);
    expect(screen.getAllByText(/Ordine delle verdure/).length).toBeGreaterThan(0);
    expect(screen.getByText(/data precedente: 2026-09-07/)).toBeTruthy();
    expect(screen.getByText(/data nuova: 2026-09-11/)).toBeTruthy();
    expect(screen.getByText(/gesto: sposta/)).toBeTruthy();
  });

  it("e si può approvare", () => {
    mostra(appunto);
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
  });
});

// =====================================================================
describe("quando il gestionale NON sa quale impegno sia", () => {
  // 🔴 È il caso che questa schermata deve fare bene più di ogni altro: due
  //    impegni che potrebbero essere quello detto, oppure nessuno. Il
  //    gestionale non sceglie, e il pulsante non c'è.
  const { appunto } = appuntoDa(
    {
      tipo: "agenda_da_segnare_fatto",
      sicuro: true,
      frase: "Segnato come fatto: ordine delle verdure",
      dati: { impegno: "ordine delle verdure" },
    },
    "Segna come fatto l'ordine delle verdure",
    { approvabile: false },
  );

  it("🔴 NON si può approvare", () => {
    mostra(appunto);
    expect(screen.getByText(/Non c'è niente da approvare/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
  });

  it("e porta comunque in Agenda: un rifiuto senza via d'uscita è un vicolo cieco", () => {
    mostra(appunto);
    const collegamenti = screen.getAllByRole("link");
    expect(collegamenti).toHaveLength(1);
    // ⚠️ Con il suo `daVoce`: e' il telaio della via d'uscita a mano del
    //    27/08, che porta l'identificativo della riga senza i campi.
    expect(collegamenti[0].getAttribute("href")).toMatch(/^\/agenda\?daVoce=/);
  });

  it("🔴 e l'impegno detto resta scritto: non si perde", () => {
    // 🔴 È la ragione per cui l'appunto nasce lo stesso (SPEC-0013): una
    //    frase vera trasformata in «non ho capito» sparisce, e Alessio
    //    crede di averla data.
    mostra(appunto);
    expect(screen.getAllByText(/ordine delle verdure/i).length).toBeGreaterThan(0);
  });
});

// =====================================================================
describe("«sposta l'ordine delle verdure», senza dire a quando", () => {
  const { appunto } = appuntoDa(
    {
      tipo: "agenda_da_spostare",
      sicuro: true,
      frase: "Sposta l'ordine delle verdure",
      dati: { impegno: "ordine delle verdure" },
    },
    "Sposta l'ordine delle verdure",
  );

  it("🔴 chiede il giorno invece di inventarlo", () => {
    // 🔴 Mettere «domani» al posto suo sarebbe decidere su una scadenza — e
    //    la riga entrerebbe plausibile, senza nessun errore.
    mostra(appunto);
    expect(screen.getByText(/a quando/)).toBeTruthy();
    expect(screen.getByText(/Quale impegno\?/)).toBeTruthy();
  });

  it("e resta non approvabile", () => {
    mostra(appunto);
    expect(screen.getByText(/Non c'è niente da approvare/i)).toBeTruthy();
  });
});

// =====================================================================
describe("«ricordami di chiamare Tiziana domani»", () => {
  it("🔴 resta un promemoria, e quello il gestionale lo sa fare da sempre", () => {
    // 🔴 LA METÀ CHE DISCRIMINA: una regola che dirottasse tutto romperebbe
    //    il gesto più frequente dell'Agenda, e tutte le prove qui sopra
    //    passerebbero lo stesso.
    const { azione } = appuntoDa(
      {
        tipo: "promemoria",
        sicuro: true,
        frase: "Chiamare Tiziana",
        dati: { titolo: "Chiamare Tiziana", data: "2026-09-09" },
      },
      "Ricordami di chiamare Tiziana domani",
    );
    expect(azione.tipo).toBe("promemoria");
    expect(azione.motivo).toBeUndefined();
  });
});

// =====================================================================
describe("🔴 due impegni possibili: si vedono QUALI, e restano non approvabili", () => {
  // 🔴 IL DIFETTO CHE SI CHIUDE (09/09/2026, dal collaudo col telefono).
  //    Quando MEMO trova due impegni ugualmente plausibili non ne sceglie
  //    nessuno — e fa bene. Ma la schermata diceva soltanto «quale dei 2»,
  //    e chi la leggeva doveva andare in Agenda a cercarli per sapere di
  //    quali due si parlasse: cioè rifare a mano il lavoro appena fatto dal
  //    gestionale.
  //
  // ⚠️ I CANDIDATI LI DECIDE IL DATABASE, che ha guardato in Agenda: qui
  //    arrivano dentro i dati dell'appunto, come arrivano davvero.
  const conCandidati = (candidati) =>
    appuntoDa(
      {
        tipo: "agenda_da_segnare_fatto",
        sicuro: true,
        frase: "Segnato come fatto: ordine delle verdure",
        dati: { impegno: "ordine delle verdure" },
      },
      "Segna come fatto l'ordine delle verdure",
      { approvabile: false, risolto: { impegni_possibili: candidati } },
    ).appunto;

  const DUE = [
    { titolo: "Ordine verdure", data: "2027-03-03" },
    { titolo: "Ordine delle verdure", data: "2027-03-04" },
  ];

  it("🔴 i due titoli si leggono, e non si deve andare in Agenda a cercarli", () => {
    mostra(conCandidati(DUE));
    expect(screen.getByText("Ordine verdure")).toBeTruthy();
    expect(screen.getByText("Ordine delle verdure")).toBeTruthy();
  });

  it("🔴 e ognuno porta il suo giorno, che è quello che li distingue", () => {
    // ⚠️ Due titoli somiglianti senza data sono la stessa domanda, scritta
    //    più lunga: è il giorno a far scegliere.
    mostra(conCandidati(DUE));
    const righe = screen.getAllByRole("listitem").map((r) => r.textContent);
    const conVerdure = righe.filter((t) => t.includes("Ordine"));
    expect(conVerdure.length).toBeGreaterThanOrEqual(2);
    expect(conVerdure.every((t) => /2027/.test(t))).toBe(true);
  });

  it("🔴 mostrarli NON li rende approvabili", () => {
    // È la riga che non si tocca: finché i candidati sono due, «Approva»
    // non deve esistere. Un pulsante su una cosa ambigua promette che
    // sceglierà lui.
    mostra(conCandidati(DUE));
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
    expect(screen.getByText(/Non c'è niente da approvare/i)).toBeTruthy();
  });

  it("🔴 e non si possono nemmeno toccare: non sono una scelta", () => {
    // ⚠️ Un pulsante per sceglierli sarebbe un'altra funzionalità, e
    //    renderebbe approvabile ciò che non deve esserlo. La via d'uscita è
    //    ridirlo, o aprire l'Agenda.
    mostra(conCandidati(DUE));
    const bottoni = screen.queryAllByRole("button");
    for (const b of bottoni) {
      expect(b.textContent).not.toMatch(/Ordine verdure|Ordine delle verdure/);
    }
  });

  it("un impegno senza scadenza lo DICE, invece di lasciare la riga muta", () => {
    // Il vuoto che non è zero, sulle date: «senza scadenza» è una delle
    // cose che distinguono un impegno dagli altri.
    mostra(conCandidati([{ titolo: "Ordine verdure", data: null }, DUE[1]]));
    expect(screen.getByText(/senza scadenza/i)).toBeTruthy();
  });

  it("🔴 quando l'impegno è UNO, l'elenco non compare affatto", () => {
    // ⚠️ Un elenco di candidati accanto a un appunto già risolto direbbe
    //    che c'è ancora un dubbio dove non ce n'è più.
    const risolto = appuntoDa(
      {
        tipo: "agenda_da_segnare_fatto",
        sicuro: true,
        frase: "Segnato come fatto: rinnovo della firma digitale",
        dati: { impegno: "rinnovo della firma digitale" },
      },
      "Segna come fatto il rinnovo della firma digitale",
      {
        approvabile: true,
        risolto: { task_id: "t-1", titolo: "Rinnovo firma digitale", data_precedente: null },
      },
    ).appunto;
    mostra(risolto);
    expect(screen.queryByText(/Potrebbero essere questi/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
  });
});
