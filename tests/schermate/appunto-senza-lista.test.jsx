import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppuntoDaApprovare from "../../src/components/AppuntoDaApprovare";
import { destinazioneDellaLista } from "../../supabase/functions/ascolta-voce/destinazioni.ts";

// 🔴 IL CASO VERO, dal collaudo a mano del 07/09/2026. Alessio detta una
//    riga di lista senza dire in quale delle due, e la schermata risponde
//    *«Ho capito cosa vuoi, ma il gestionale non sa ancora farlo»*.
//
// 🔴 QUELLA FRASE È FALSA, ed è il motivo per cui questo file esiste: le due
//    liste il gestionale le sa scrivere **tutt'e due**. Quello che manca non
//    è un gesto, è un'informazione che ha lui — **quale**. Le due cose si
//    curano in modi opposti: la prima manda a cercare una funzione che non
//    c'è, la seconda si risolve con una parola in più.
//
// ⚠️ E LA FRASE GIUSTA C'ERA GIÀ, scritta dove il caso si conosce (il
//    `motivo` dell'elemento): la schermata mostrava al suo posto una frase
//    fissa. *Un messaggio scritto bene in un posto che nessuno legge è un
//    messaggio che non c'è* — per questo si prova QUI, dove si vede, e non
//    solo sulla regola.
//
// ⚠️ SI MONTA IL SOLO COMPONENTE, non la schermata MEMO: montare la pagina
//    intera fa scadere il tempo alle prove degli altri file di questa
//    cartella.

/** L'appunto come nasce davvero: il motivo lo scrive la regola, non la prova. */
const senzaLista = destinazioneDellaLista({
  tipo: "lista_spesa",
  sicuro: true,
  frase: "Aggiungi il pane",
  dati: { nome_libero: "pane" },
});

const APPUNTO = {
  id: "app-1",
  destinazione: senzaLista.tipo,
  titolo: senzaLista.destinazione,
  eseguibile: false,
  quanti: 1,
  incerto: false,
  aperto_da_ore: 0,
  aperto_da_giorni: 0,
  elementi: [
    {
      id: "el-1",
      frase: senzaLista.frase,
      dati: senzaLista.dati,
      sicuro: true,
      motivo: senzaLista.motivo,
      alternative: [],
      stato: "in_attesa",
      domanda: null,
      scelte: [],
      percorso: null,
    },
  ],
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

describe("l'appunto di una riga di lista detta senza dire quale", () => {
  it("🔴 NON dice che il gestionale non sa farlo", () => {
    mostra(APPUNTO);
    expect(screen.queryByText(/non sa ancora farlo/i)).toBeNull();
    expect(screen.queryByText(/finché non lo costruiamo/i)).toBeNull();
  });

  it("🔴 dice che sa scrivere in tutt'e due, e QUALI parole ridire", () => {
    mostra(APPUNTO);
    expect(screen.getByText(/so scrivere in tutt'e due/i)).toBeTruthy();
    expect(screen.getByText(/«alla lista della spesa»/)).toBeTruthy();
    expect(screen.getByText(/«alla spesa spicciola»/)).toBeTruthy();
  });

  it("...e il titolo chiede quale delle due", () => {
    mostra(APPUNTO);
    expect(screen.getByText(/Quale delle due liste\?/i)).toBeTruthy();
  });

  it("🔴 e resta NON approvabile: cambiano le parole, non il comportamento", () => {
    // ⚠️ È la metà che discrimina. Una cura che avesse reso l'appunto
    //    approvabile per far sparire la frase sbagliata sarebbe stata molto
    //    peggio del difetto: la riga entrerebbe in una lista scelta da
    //    nessuno.
    mostra(APPUNTO);
    expect(screen.queryByRole("button", { name: /Approva/i })).toBeNull();
    expect(screen.getByText(/Non c'è niente da approvare/i)).toBeTruthy();
  });

  it("un appunto che un gesto davvero non ce l'ha continua a dirlo", () => {
    // ⚠️ La frase generale non si toglie: per una cosa che il gestionale non
    //    sa fare è vera, ed è l'unica che si possa dire. Senza questa prova,
    //    una cura che la cancellasse lascerebbe quegli appunti muti.
    mostra({
      ...APPUNTO,
      id: "app-2",
      titolo: "Chiedere un preventivo al fabbro",
      elementi: [{ ...APPUNTO.elementi[0], id: "el-2", motivo: null }],
    });
    expect(screen.getByText(/non sa ancora farlo/i)).toBeTruthy();
  });

  it("e se gli elementi dicono motivi diversi, la frase generale torna", () => {
    // ⚠️ Un appunto additivo può raccoglierne più d'uno. Lì non esiste UNA
    //    ragione dell'appunto — ciascun elemento ha la sua, e la mostra — e
    //    la riga in cima torna a essere quella generale, che almeno non dice
    //    niente di sbagliato su nessuno dei due.
    mostra({
      ...APPUNTO,
      id: "app-3",
      quanti: 2,
      elementi: [
        APPUNTO.elementi[0],
        { ...APPUNTO.elementi[0], id: "el-3", motivo: "un altro motivo" },
      ],
    });
    expect(screen.getByText(/non sa ancora farlo/i)).toBeTruthy();
    // e ciascun elemento continua a dire la sua, senza che nessuna valga per tutti
    expect(screen.getByText(/un altro motivo/i)).toBeTruthy();
  });
});
