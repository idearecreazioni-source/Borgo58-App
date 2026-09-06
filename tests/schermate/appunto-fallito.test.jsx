import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppuntoDaApprovare from "../../src/components/AppuntoDaApprovare";

// 🔴 IL CASO VERO, dal vivo il 06/09/2026. Alessio preme «Approva», il
//    pulsante dice «Lo sto scrivendo…», e poi: in Lista della spesa non
//    compare niente e l'appunto resta lì. Il gestionale aveva ragione — non
//    aveva scritto — ma **chi guardava non poteva saperlo**.
//
// ⚠️ IL DIFETTO NON È CHE MANCASSE UN MESSAGGIO: è che la schermata era
//    compatibile con due letture opposte — «è andata storta» e «ha scritto e
//    non me lo mostra» — e sono due cose che si curano in modo contrario. Chi
//    teme il doppione non ripreme; chi crede che non sia successo niente
//    ripreme. Per questo il fatto va detto **prima** del motivo.
//
// ⚠️ La causa di quel fallimento era un'altra cosa ancora — la parte online
//    non era stata aggiornata — e si cura installandola. Qui si prova **cosa
//    vede chi ha il tablet in mano** quando una qualunque approvazione non
//    riesce, che è una domanda diversa e vale per tutte le cause.
//
// ⚠️ SI MONTA IL SOLO COMPONENTE, non la schermata MEMO: montare la pagina
//    intera faceva scadere il tempo alle prove degli altri file di questa
//    cartella. Vedi il cappello di `src/components/AppuntoDaApprovare.jsx`.

const APPUNTO = {
  id: "app-1",
  destinazione: "lista_spesa",
  titolo: "Aggiungi alla spesa",
  eseguibile: true,
  quanti: 1,
  incerto: false,
  aperto_da_ore: 0,
  aperto_da_giorni: 0,
  elementi: [
    {
      id: "el-1",
      frase: "Pesce spada in lista",
      dati: { nome_libero: "pesce spada" },
      sicuro: true,
      motivo: null,
      alternative: [],
      stato: "in_attesa",
      domanda: null,
      scelte: [],
      percorso: null,
    },
  ],
};

const mostra = (esito) =>
  render(
    <MemoryRouter>
      <AppuntoDaApprovare
        appunto={APPUNTO}
        occupato={false}
        esito={esito}
        onApprova={vi.fn()}
        onScarta={vi.fn()}
        onScegli={vi.fn()}
      />
    </MemoryRouter>,
  );

const FALLITO = {
  stato: "fallita",
  messaggio:
    "Questo gestionale sa fare «approva_appunto», ma la parte online non è ancora stata aggiornata.",
};

describe("quando approvare non riesce", () => {
  it("🔴 dice PER PRIMA COSA che non è stato scritto niente", () => {
    mostra(FALLITO);
    expect(screen.getByText(/Non è stato scritto niente/i)).toBeTruthy();
    // ⚠️ E che l'appunto è ancora intero: è la seconda metà del dubbio.
    expect(screen.getByText(/appunto è ancora qui/i)).toBeTruthy();
  });

  it("...e riporta comunque il motivo, dopo il fatto", () => {
    mostra(FALLITO);
    expect(screen.getByText(/parte online non è ancora stata aggiornata/i)).toBeTruthy();
  });

  it("il pulsante dice «Riprova», non «Approva» come se niente fosse", () => {
    // ⚠️ Un pulsante che torna com'era invita a ripremere alla cieca, ed è
    //    esattamente quello che è successo il 27/08 su un movimento di cassa.
    mostra(FALLITO);
    expect(screen.getByRole("button", { name: /Riprova/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approva$/i })).toBeNull();
  });

  it("🔴 e NON dice «Fatto»: nessuna scrittura viene simulata", () => {
    mostra(FALLITO);
    expect(screen.queryByText(/Fatto/)).toBeNull();
  });

  it("quando invece è andata bene, il fallimento non compare", () => {
    // ⚠️ La metà che discrimina: senza, una schermata che mostrasse SEMPRE
    //    «non è stato scritto niente» passerebbe tutte le prove qui sopra.
    mostra({ stato: "fatta" });
    expect(screen.queryByText(/Non è stato scritto niente/i)).toBeNull();
    expect(screen.getByText(/✓ Fatto/)).toBeTruthy();
  });

  it("e senza nessun esito il riquadro è pulito", () => {
    mostra(undefined);
    expect(screen.queryByText(/Non è stato scritto niente/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^Approva$/i })).toBeTruthy();
  });
});
