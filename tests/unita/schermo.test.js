import { describe, expect, it } from "vitest";
import { fraseMisura, misureSchermo, modalitaInstallata } from "../../src/lib/calcoli/schermo";

// La misura dello spazio, provata nei DUE casi che deve distinguere.
//
// ⚠️ Un solo caso non discrimina: una funzione che rispondesse sempre «da
// Safari» passerebbe la prova di Safari, e il numero che ne uscirebbe
// sarebbe una misura sola invece di una differenza.

const finta = ({ innerHeight, screenHeight, standalone = undefined, media = false }) => ({
  innerHeight,
  innerWidth: 375,
  screen: { height: screenHeight },
  navigator: { standalone },
  matchMedia: () => ({ matches: media }),
});

describe("Quanto spazio ha la pianta", () => {
  it("da Safari le barre si vedono nel conto", () => {
    const m = misureSchermo(finta({ innerHeight: 650, screenHeight: 812 }));
    expect(m.installata).toBe(false);
    expect(m.altezzaUtile).toBe(650);
    expect(m.barre).toBe(162);
  });

  it("dall'icona le barre spariscono", () => {
    const m = misureSchermo(finta({ innerHeight: 812, screenHeight: 812, standalone: true }));
    expect(m.installata).toBe(true);
    expect(m.barre).toBe(0);
  });

  it("riconosce l'app installata anche fuori da Safari", () => {
    // ⚠️ Due strade perché iOS e gli altri non usano la stessa. Guardarne
    // una sola darebbe «no» su metà dei casi, e un «no» sbagliato qui
    // farebbe misurare due volte lo stesso caso credendo di averne due.
    expect(modalitaInstallata(finta({ innerHeight: 812, screenHeight: 812, media: true }))).toBe(true);
    expect(modalitaInstallata(finta({ innerHeight: 650, screenHeight: 812 }))).toBe(false);
  });

  it("non inventa numeri negativi se la finestra è più alta dello schermo", () => {
    // Capita con la tastiera aperta o su certi emulatori: «barre = -30»
    // sarebbe un numero che Alessio riferirebbe come se volesse dire
    // qualcosa.
    const m = misureSchermo(finta({ innerHeight: 900, screenHeight: 812 }));
    expect(m.barre).toBe(0);
  });

  it("la frase dice quale dei due casi si sta guardando", () => {
    expect(fraseMisura(misureSchermo(finta({ innerHeight: 650, screenHeight: 812 })))).toContain(
      "Da Safari"
    );
    expect(
      fraseMisura(misureSchermo(finta({ innerHeight: 812, screenHeight: 812, standalone: true })))
    ).toContain("Dall'icona");
  });
});
