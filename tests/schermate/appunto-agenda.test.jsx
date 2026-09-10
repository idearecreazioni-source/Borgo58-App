import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppuntoDaApprovare from "../../src/components/AppuntoDaApprovare";
import { destinazioneAgenda } from "../../supabase/functions/ascolta-voce/agenda.ts";

// =====================================================================
// L'APPUNTO DI UN IMPEGNO DA CHIUDERE O DA SPOSTARE, A SCHERMO
// =====================================================================
// 🔴 QUELLO CHE SI PROVA QUI È CIÒ CHE SI VEDE PRIMA DI FIRMARE, e non la
//    regola: «Approva» è una firma, e un appunto che riassumesse invece di
//    mostrare farebbe autorizzare una scrittura che non si è vista.
//
// 🔴 E LA COSA PIÙ IMPORTANTE È CHE NON SI POSSA APPROVARE: il gestionale
//    non sa ancora chiudere né spostare un impegno da una frase detta, e un
//    pulsante «Approva» su un gesto che non esiste è la promessa peggiore
//    che questa schermata possa fare.
//
// ⚠️ L'appunto si costruisce dalla REGOLA VERA, non a mano: se un giorno il
//    motivo cambiasse, questa prova lo vedrebbe.

const appuntoDa = (azione, dettato) => {
  const a = destinazioneAgenda(azione, dettato);
  return {
    appunto: {
      id: "app-1",
      destinazione: a.tipo,
      titolo: a.destinazione,
      // ⚠️ `eseguibile` lo scrive il DATABASE guardando il catalogo delle
      //    azioni vocali, e questi tipi lì non ci sono: qui si riproduce
      //    quello stato, ed è il motivo per cui l'appunto non si approva.
      eseguibile: false,
      quanti: 1,
      incerto: false,
      aperto_da_ore: 0,
      aperto_da_giorni: 0,
      elementi: [
        {
          id: "el-1",
          frase: a.frase,
          dati: a.dati,
          sicuro: true,
          motivo: a.motivo,
          alternative: [],
          stato: "in_attesa",
          domanda: null,
          scelte: [],
          percorso: null,
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
describe("«segna come fatto il rinnovo della firma digitale»", () => {
  const { appunto } = appuntoDa(
    { tipo: "promemoria", sicuro: true, frase: "Segna come fatto il rinnovo della firma digitale", dati: { titolo: "rinnovo della firma digitale" } },
    "Segna come fatto il rinnovo della firma digitale",
  );

  it("🔴 NON si può approvare", () => {
    mostra(appunto);
    expect(screen.getByText(/Non c'è niente da approvare/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
  });

  it("dice che il gesto manca e cosa fare in Agenda", () => {
    mostra(appunto);
    expect(screen.getByText(/non sa ancora chiudere un impegno/i)).toBeTruthy();
    expect(screen.getByText(/aprilo in Agenda e tocca «fatto»/i)).toBeTruthy();
  });

  it("🔴 e l'impegno detto resta scritto: non si perde", () => {
    // 🔴 È la ragione per cui l'appunto nasce lo stesso (SPEC-0013): una
    //    frase vera trasformata in «non ho capito» sparisce, e Alessio
    //    crede di averla data.
    mostra(appunto);
    // ⚠️ Compare due volte, ed è giusto: nel riassunto in cima e fra i dati
    //    concreti sotto. Il riassunto dice DOVE va, i dati dicono COSA ci
    //    finisce, e prima di una firma servono tutti e due.
    expect(screen.getAllByText(/rinnovo della firma digitale/).length).toBeGreaterThan(0);
  });

  it("🔴 e il titolo dell'appunto NON promette una cosa nuova", () => {
    // 🔴 Il difetto che tutto questo lavoro chiude: senza la regola nasceva
    //    un impegno NUOVO chiamato «Segna come fatto il rinnovo della
    //    firma», approvabile, accanto a quello vero che restava aperto.
    mostra(appunto);
    expect(screen.getByText(/Da segnare fatto in Agenda/)).toBeTruthy();
    expect(screen.queryByText(/Annota in Agenda/)).toBeNull();
  });

  it("🔴 e porta in Agenda: un rifiuto senza via d'uscita è un vicolo cieco", () => {
    // 🔴 L'appunto dice che il gesto non c'è. Senza un collegamento,
    //    lascerebbe chi legge a cercarsi la schermata da solo — ed è il
    //    difetto che questo progetto chiama «rifiuto senza gesto d'uscita».
    // ⚠️ NON è «fallo a mano coi campi già compilati»: lì c'è un modulo da
    //    riempire, qui c'è un impegno da CERCARE, e promettere campi
    //    compilati su una cosa che il gestionale non sa trovare sarebbe
    //    una bugia.
    mostra(appunto);
    const collegamento = screen.getByRole("link", { name: /Apri l'Agenda/ });
    expect(collegamento.getAttribute("href")).toBe("/agenda");
    expect(screen.queryByText(/campi già compilati/)).toBeNull();
  });

  it("e l'indirizzo non compare fra i dati che si firmerebbero", () => {
    // ⚠️ Mostrare «dove: /agenda» fra i dati concreti direbbe a chi firma
    //    che sta autorizzando un indirizzo. È impalcatura, non contenuto.
    mostra(appunto);
    expect(screen.queryByText(/dove:/)).toBeNull();
  });
});


// =====================================================================
describe("«sposta a venerdì l'ordine delle verdure»", () => {
  const { appunto } = appuntoDa(
    {
      tipo: "agenda_da_spostare",
      sicuro: true,
      frase: "Sposta a venerdì l'ordine delle verdure",
      dati: { impegno: "ordine delle verdure", data_nuova: "2026-09-11" },
    },
    "Sposta a venerdì l'ordine delle verdure",
  );

  it("mostra l'impegno e il giorno nuovo, prima di qualunque firma", () => {
    mostra(appunto);
    expect(screen.getAllByText(/ordine delle verdure/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026-09-11/).length).toBeGreaterThan(0);
  });

  it("🔴 e non si può approvare", () => {
    mostra(appunto);
    expect(screen.getByText(/Non c'è niente da approvare/i)).toBeTruthy();
    expect(screen.getByText(/non sa ancora spostare un impegno/i)).toBeTruthy();
  });
});

// =====================================================================
describe("«sposta l'ordine delle verdure», senza dire a quando", () => {
  const { appunto } = appuntoDa(
    { tipo: "agenda_da_spostare", sicuro: true, frase: "Sposta l'ordine delle verdure", dati: { impegno: "ordine delle verdure" } },
    "Sposta l'ordine delle verdure",
  );

  it("🔴 chiede il giorno invece di inventarlo", () => {
    // 🔴 Mettere «domani» al posto suo sarebbe decidere su una scadenza —
    //    e la riga entrerebbe plausibile, senza nessun errore.
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
  it("🔴 resta un promemoria, e quello il gestionale lo sa fare", () => {
    // 🔴 LA METÀ CHE DISCRIMINA: una regola che dirottasse tutto
    //    romperebbe il gesto più frequente dell'Agenda, e tutte le prove
    //    qui sopra passerebbero lo stesso.
    const { azione } = appuntoDa(
      { tipo: "promemoria", sicuro: true, frase: "Chiamare Tiziana", dati: { titolo: "Chiamare Tiziana", data: "2026-09-09" } },
      "Ricordami di chiamare Tiziana domani",
    );
    expect(azione.tipo).toBe("promemoria");
    expect(azione.motivo).toBeUndefined();
  });
});
