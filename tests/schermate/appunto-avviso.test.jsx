import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppuntoDaApprovare from "../../src/components/AppuntoDaApprovare";

// =====================================================================
// IL PROMEMORIA CHE AVVISA: COSA SI VEDE PRIMA DI FIRMARE
// =====================================================================
// 10/09/2026, Blocco 3 del mandato notturno.
//
// 🔴 QUELLO CHE SI APPROVA QUI NON È UN DATO IN TABELLA: è **un telefono
//    che suonerà**. Quindi le tre cose che il mandato chiede di vedere —
//    il titolo, il giorno dell'impegno, il giorno e l'ora dell'avviso —
//    non sono una cortesia: sono ciò che rende quella firma una firma.
//
// 🔴 E LA METÀ CHE CONTA È IL CASO OPPOSTO: quando l'avviso è detto a
//    metà, o è già passato, «Approva» **non deve esserci**. Un pulsante su
//    una notifica che il gestionale non sa quando mandare è la promessa
//    peggiore che questa schermata possa fare.

const GIORNO_IMPEGNO = "2026-09-13";
const GIORNO_AVVISO = "2026-09-12";

/**
 * Un appunto come lo riceve la schermata.
 *
 * ⚠️ `eseguibile` lo scrive il DATABASE leggendo il catalogo delle azioni
 * vocali: qui si riproduce quello stato, perché è lui a decidere se
 * «Approva» esiste. Su un avviso detto a metà il database cambia il tipo in
 * uno che nel catalogo non c'è — quindi `eseguibile` diventa falso, e non
 * è una scelta della schermata.
 */
const appuntoCon = (dati, { approvabile = true, destinazione = "promemoria", titolo = "Da annotare in Agenda", manca = null } = {}) => ({
  id: "app-1",
  destinazione,
  titolo,
  eseguibile: approvabile,
  quanti: 1,
  incerto: false,
  aperto_da_ore: 0,
  aperto_da_giorni: 0,
  elementi: [
    {
      id: "el-1",
      frase: "Annotato in Agenda: appuntamento in banca",
      dati,
      sicuro: true,
      motivo: manca,
      alternative: [],
      stato: "in_attesa",
      domanda: manca ? "manca" : "se",
      scelte: [],
      percorso: "/agenda",
    },
  ],
});

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
    </MemoryRouter>
  );

describe("«ho appuntamento in banca sabato 13, ricordamelo il giorno prima alle 15»", () => {
  const appunto = appuntoCon({
    titolo: "Appuntamento in banca",
    data: GIORNO_IMPEGNO,
    avviso_data: GIORNO_AVVISO,
    avviso_ora: "15:00",
  });

  it("🔴 si vedono tutt'e tre le cose: cosa, quando succede, quando avvisa", () => {
    mostra(appunto);
    expect(screen.getAllByText(/Appuntamento in banca/).length).toBeGreaterThan(0);
    // Le due date sono scritte in italiano e NON si confondono fra loro.
    expect(screen.getByText(/giorno: 13 set 2026/)).toBeTruthy();
    expect(screen.getByText(/ti avviso il: 12 set 2026/)).toBeTruthy();
    expect(screen.getByText(/alle: 15:00/)).toBeTruthy();
  });

  it("🔴 e dice che il messaggio può arrivare entro cinque minuti dopo", () => {
    // Il lavoro che manda le notifiche gira ogni cinque minuti. Chi aspetta
    // il Telegram alle 15:00 spaccate e lo riceve alle 15:04 pensa che il
    // gestionale funzioni male: dirlo prima costa una riga, scoprirlo dopo
    // costa la fiducia in tutti gli avvisi.
    mostra(appunto);
    expect(screen.getByText(/entro i cinque minuti dopo/i)).toBeTruthy();
  });

  it("si può approvare", () => {
    mostra(appunto);
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
  });
});

describe("un promemoria senza nessun avviso — il caso normale", () => {
  const appunto = appuntoCon({ titolo: "Chiamare Tiziana", data: GIORNO_IMPEGNO });

  it("non promette nessuna notifica", () => {
    mostra(appunto);
    expect(screen.queryByText(/notifica su Telegram/i)).toBeNull();
    expect(screen.queryByText(/cinque minuti/i)).toBeNull();
  });

  it("e si approva lo stesso: un impegno senza avviso è la maggioranza", () => {
    mostra(appunto);
    expect(screen.getByRole("button", { name: /^Approva/ })).toBeTruthy();
  });
});

describe("🔴 un avviso detto a metà non si approva", () => {
  const appunto = appuntoCon(
    { titolo: "Appuntamento in banca", data: GIORNO_IMPEGNO, avviso_data: GIORNO_AVVISO },
    {
      approvabile: false,
      destinazione: "promemoria_quando_avvisare",
      titolo: "Quando ti avviso?",
      manca:
        "Vuoi che ti avvisi, ma non ho capito a che ora (il giorno l'ho capito: 12/09/2026). " +
        "Ridimmelo dicendo giorno e ora, oppure ridillo senza notifica e l'impegno nasce lo stesso.",
    }
  );

  it("«Approva» non c'è", () => {
    mostra(appunto);
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
  });

  it("⚠️ e NON promette una notifica che il gestionale non sa quando mandare", () => {
    // È il difetto peggiore possibile su questa schermata: annunciare «ti
    // avviso il 12» senza l'ora farebbe credere che una notifica partirà.
    mostra(appunto);
    expect(screen.queryByText(/notifica su Telegram/i)).toBeNull();
  });

  it("dice cosa manca e come uscirne", () => {
    mostra(appunto);
    expect(screen.getByText(/non ho capito a che ora/i)).toBeTruthy();
    expect(screen.getByText(/senza notifica e l'impegno nasce lo stesso/i)).toBeTruthy();
  });
});

describe("🔴 un avviso già passato non si approva", () => {
  const appunto = appuntoCon(
    {
      titolo: "Appuntamento in banca",
      data: GIORNO_IMPEGNO,
      avviso_data: "2020-01-01",
      avviso_ora: "15:00",
    },
    {
      approvabile: false,
      destinazione: "promemoria_quando_avvisare",
      titolo: "Quando ti avviso?",
      manca:
        "Mi hai chiesto di avvisarti il 01/01/2020 alle 15:00, che è già passato: " +
        "una notifica per un momento passato non parte mai. Ridimmi quando vuoi che ti avvisi.",
    }
  );

  it("«Approva» non c'è, e la frase dice perché", () => {
    mostra(appunto);
    expect(screen.queryByRole("button", { name: /^Approva/ })).toBeNull();
    expect(screen.getByText(/già passato/i)).toBeTruthy();
  });
});
