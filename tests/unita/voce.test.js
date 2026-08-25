import { describe, expect, it } from "vitest";
import {
  comeEAndata,
  componiDettato,
  daQuantoAspetta,
  fraseDelMicrofono,
  perchéAspetta,
  riconoscitoreDisponibile,
  titoloDelRiscontro,
} from "../../src/lib/calcoli/voce";

// Le regole della voce, provate senza aprire una schermata.
//
// 🔴 QUELLO CHE QUESTE PROVE NON PROVANO, e va detto: il criterio
//    salva-da-sé. Vive nel database (`azione_si_esegue_da_se`) ed è
//    provato lì, dentro la migrazione e in `tests/app/voce.test.js`.
//    Se fosse anche qui sarebbero due copie che possono divergere.

describe("la filza si compone in una frase sola", () => {
  it("unisce i pezzi con uno spazio", () => {
    expect(componiDettato(["pomodori due casse", "olio tre bottiglie"])).toBe(
      "pomodori due casse olio tre bottiglie",
    );
  });

  // ⚠️ Attaccati darebbero «cassieolio»: nessun assistente lo capirebbe, e
  //    l'errore non somiglierebbe a un errore di incollaggio.
  it("non incolla due pezzi senza spazio", () => {
    expect(componiDettato(["due casse", "olio"])).not.toContain("casseolio");
  });

  it("tiene dentro anche quello che si sta ancora dicendo", () => {
    expect(componiDettato(["pomodori"], "olio tre bot")).toBe("pomodori olio tre bot");
  });

  it("regge i vuoti senza lasciare spazi doppi", () => {
    expect(componiDettato(["", "  pomodori  ", null], "")).toBe("pomodori");
  });
});

describe("il microfono dice sempre in che stato è", () => {
  // 🔴 IL SILENZIO NON FERMA L'ASCOLTO. È la lezione del 12/08: un errore
  //    trattato come innocuo produsse una pagina che non faceva niente e
  //    non lo diceva.
  it("il silenzio si dice a parole ma non spegne", () => {
    const r = fraseDelMicrofono("no-speech");
    expect(r.ferma).toBe(false);
    expect(r.frase).toMatch(/ascolt/i);
  });

  it("il permesso negato spiega dove si sblocca", () => {
    const r = fraseDelMicrofono("not-allowed");
    expect(r.ferma).toBe(true);
    expect(r.frase).toMatch(/Consenti/);
  });

  // ⚠️ Nessun codice viene inghiottito: anche uno mai visto produce una
  //    frase, e la frase dice il codice.
  it("un errore mai visto non sparisce", () => {
    const r = fraseDelMicrofono("qualcosa-di-nuovo");
    expect(r.ferma).toBe(true);
    expect(r.frase).toContain("qualcosa-di-nuovo");
  });
});

describe("il riscontro arriva alla fine, e sono due elenchi", () => {
  const azioni = [
    { id: "1", stato: "eseguita", frase: "Pomodori: 4 kg" },
    { id: "2", stato: "eseguita", frase: "Cella: 3 gradi" },
    { id: "3", stato: "in_attesa", frase: "Cassa: 50 euro", natura: "creazione" },
    { id: "4", stato: "annullata", frase: "Una cosa" },
  ];

  it("separa quello che ha fatto da quello che chiede", () => {
    const r = comeEAndata(azioni);
    expect(r.fatte).toHaveLength(2);
    expect(r.daGuardare).toHaveLength(1);
    expect(r.annullate).toHaveLength(1);
    expect(r.tuttoFatto).toBe(false);
  });

  // ⚠️ Una fallita è una cosa da guardare, non una cosa fatta: se finisse
  //    fra le fatte, il riscontro direbbe «fatto» su un gesto mai avvenuto.
  it("una fallita sta fra quelle da guardare", () => {
    const r = comeEAndata([{ id: "1", stato: "fallita", frase: "x", errore: "non c'è" }]);
    expect(r.daGuardare).toHaveLength(1);
    expect(r.fatte).toHaveLength(0);
  });

  it("con nulla in sospeso lo dice", () => {
    const r = comeEAndata([{ id: "1", stato: "eseguita", frase: "x" }]);
    expect(r.tuttoFatto).toBe(true);
  });

  it("il titolo distingue i tre casi", () => {
    expect(titoloDelRiscontro(3, 0)).toMatch(/^Fatto: 3 cose/);
    expect(titoloDelRiscontro(0, 2)).toMatch(/^2 cose da guardare/);
    expect(titoloDelRiscontro(2, 1)).toMatch(/Fatte 2 cose.*Una da guardare/);
    expect(titoloDelRiscontro(0, 0)).toMatch(/Non ho capito/);
  });

  it("al singolare non dice «1 cose»", () => {
    expect(titoloDelRiscontro(1, 0)).toBe("Fatto: una cosa.");
    expect(titoloDelRiscontro(0, 1)).toMatch(/^Una cosa da guardare/);
  });
});

describe("da quanto aspetta si dice in italiano", () => {
  // 🔴 «Tre da ieri» e «tre da due settimane» sono due situazioni diverse:
  //    è il modo in cui «glielo si ricorda il giorno dopo» si fa senza
  //    buttare via niente.
  it("distingue oggi, ieri e più in là", () => {
    expect(daQuantoAspetta(0)).toBe("di oggi");
    expect(daQuantoAspetta(1)).toBe("da ieri");
    expect(daQuantoAspetta(3)).toBe("da 3 giorni");
    expect(daQuantoAspetta(10)).toMatch(/settimana/);
    expect(daQuantoAspetta(21)).toMatch(/3 settimane/);
    expect(daQuantoAspetta(60)).toMatch(/mese/);
  });

  it("un valore che non è un numero non produce una frase falsa", () => {
    expect(daQuantoAspetta(null)).toBe("di oggi");
    expect(daQuantoAspetta("boh")).toBe("di oggi");
  });
});

describe("perché una cosa aspetta si dice sempre", () => {
  // ⚠️ Un elenco di cose in attesa senza il perché è un elenco di cose di
  //    cui non si sa che fare.
  it("l'errore vero viene prima di tutto", () => {
    expect(perchéAspetta({ errore: "il prodotto non esiste", motivo: "boh" })).toBe(
      "il prodotto non esiste",
    );
  });

  it("il motivo scritto dall'assistente si conserva", () => {
    expect(perchéAspetta({ motivo: "Non hai detto quale frigo" })).toBe(
      "Non hai detto quale frigo",
    );
  });

  it("senza motivo, la natura basta a dirlo", () => {
    expect(perchéAspetta({ natura: "creazione" })).toMatch(/guardi sempre tu/);
    expect(perchéAspetta({ natura: "misura" })).toMatch(/Non ero sicuro/);
  });

  it("non resta mai muta", () => {
    expect(perchéAspetta({})).toBeTruthy();
    expect(perchéAspetta(null)).toBeTruthy();
  });
});

describe("il riconoscimento vocale si cerca senza rompersi", () => {
  it("senza finestra risponde no invece di esplodere", () => {
    expect(riconoscitoreDisponibile(null)).toBe(false);
  });

  it("riconosce tutte e due le forme, con e senza prefisso", () => {
    expect(riconoscitoreDisponibile({ SpeechRecognition: class {} })).toBe(true);
    expect(riconoscitoreDisponibile({ webkitSpeechRecognition: class {} })).toBe(true);
    expect(riconoscitoreDisponibile({})).toBe(false);
  });
});
