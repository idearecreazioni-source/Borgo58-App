import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  indirizziAttesi,
  problemaDegliIndirizziDiAccesso,
} from "../../scripts/rilascio.mjs";
import { INDIRIZZI_PREDEFINITI, marcatore } from "../../scripts/indirizzi-accesso.mjs";

// 🔴 IL BLOCCO DELLA PUBBLICAZIONE — 02/09/2026.
//
// Il rischio che chiude è l'unico serio di tutto il lavoro sugli indirizzi
// configurabili: se qualcuno impostasse `VITE_EMAIL_TITOLARE` o
// `VITE_EMAIL_STAFF` sull'ambiente **produzione** con indirizzi che sul
// gestionale vero non esistono, **Alessio non entrerebbe più in
// borgo58.it** — e se ne accorgerebbe davanti alla schermata di accesso.
//
// ⚠️ E si ferma PRIMA di Wrangler: il sito resta com'era.

const finto = (testo) => () => testo;
const PRODUZIONE = `x="${marcatore(INDIRIZZI_PREDEFINITI)}"`;

describe("che indirizzi ci si aspetta, per ambiente", () => {
  it("🔴 in produzione sono SEMPRE i predefiniti, anche se l'ambiente dice altro", () => {
    // 🔴 È la prova che porta tutto il peso. Se gli attesi venissero
    //    dall'ambiente, il controllo sarebbe d'accordo con qualunque cosa
    //    trovasse — cioè un controllo che approva sempre. E l'ambiente
    //    «produzione» è precisamente quello di cui diffidare.
    const ambienteAvvelenato = {
      VITE_EMAIL_TITOLARE: "estraneo@x.it",
      VITE_EMAIL_STAFF: "altro@x.it",
    };
    expect(indirizziAttesi("produzione", ambienteAvvelenato)).toEqual(
      INDIRIZZI_PREDEFINITI,
    );
  });

  it("in anteprima sono quelli configurati", () => {
    // ⚠️ Ed è giusto: l'anteprima esiste per entrarci con utenti che non sono
    //    quelli del locale vero.
    expect(
      indirizziAttesi("anteprima", {
        VITE_EMAIL_TITOLARE: "capo@prova.it",
        VITE_EMAIL_STAFF: "sala@prova.it",
      }),
    ).toEqual({ titolare: "capo@prova.it", staff: "sala@prova.it" });
  });

  it("in anteprima senza niente impostato sono i predefiniti", () => {
    expect(indirizziAttesi("anteprima", {})).toEqual(INDIRIZZI_PREDEFINITI);
  });
});

describe("il blocco della pubblicazione", () => {
  it("lascia passare un pacchetto di produzione con gli indirizzi giusti", () => {
    expect(
      problemaDegliIndirizziDiAccesso("dist", "produzione", {}, finto(PRODUZIONE)),
    ).toBeNull();
  });

  it("🔴 FERMA la produzione se nel pacchetto ci sono indirizzi diversi", () => {
    const storto = `x="${marcatore({ titolare: "capo@prova.it", staff: "sala@prova.it" })}"`;
    const guaio = problemaDegliIndirizziDiAccesso(
      "dist",
      "produzione",
      {},
      finto(storto),
    );
    expect(guaio).not.toBeNull();
    expect(guaio).toContain("capo@prova.it");
  });

  it("🔴 e il rifiuto dice COSA FARE, non solo che c'è un problema", () => {
    // ⚠️ Un rifiuto che non nomina la cura manda a cercare. Qui la cura è
    //    sempre la stessa: svuotare quelle due caselle.
    const storto = `x="${marcatore({ titolare: "capo@prova.it", staff: "sala@prova.it" })}"`;
    const guaio = problemaDegliIndirizziDiAccesso("dist", "produzione", {}, finto(storto));
    expect(guaio).toContain("VITE_EMAIL_TITOLARE");
    expect(guaio).toContain("VITE_EMAIL_STAFF");
    expect(guaio).toContain("borgo58.it");
  });

  it("🔴 ferma la produzione ANCHE se l'ambiente è d'accordo col pacchetto", () => {
    // Il caso vero: qualcuno ha impostato le caselle sull'ambiente
    // «produzione», quindi la compilazione e il controllo vedrebbero lo
    // stesso valore. Se il controllo chiedesse all'ambiente, sarebbero
    // d'accordo e non si fermerebbe nessuno.
    const configurati = { titolare: "capo@prova.it", staff: "sala@prova.it" };
    const ambiente = {
      VITE_EMAIL_TITOLARE: configurati.titolare,
      VITE_EMAIL_STAFF: configurati.staff,
    };
    const pacchetto = `x="${marcatore(configurati)}"`;
    expect(
      problemaDegliIndirizziDiAccesso("dist", "produzione", ambiente, finto(pacchetto)),
    ).not.toBeNull();
  });

  it("in anteprima invece lascia passare gli indirizzi configurati", () => {
    const configurati = { titolare: "capo@prova.it", staff: "sala@prova.it" };
    const ambiente = {
      VITE_EMAIL_TITOLARE: configurati.titolare,
      VITE_EMAIL_STAFF: configurati.staff,
    };
    const pacchetto = `x="${marcatore(configurati)}"`;
    expect(
      problemaDegliIndirizziDiAccesso("dist", "anteprima", ambiente, finto(pacchetto)),
    ).toBeNull();
  });

  it("🔴 ma in anteprima ferma se il pacchetto NON porta ciò che è configurato", () => {
    // ⚠️ Senza questa, «in anteprima va bene tutto» sarebbe vero — e il
    //    controllo non controllerebbe niente su due strade su tre.
    const ambiente = { VITE_EMAIL_TITOLARE: "capo@prova.it" };
    expect(
      problemaDegliIndirizziDiAccesso("dist", "anteprima", ambiente, finto(PRODUZIONE)),
    ).not.toBeNull();
  });

  it("🔴 ferma se nel pacchetto non c'è nessun marcatore", () => {
    // Vuol dire che non è stato compilato da questa configurazione. Fallisce
    // chiuso anche quando non sa: è la regola del 19/08 — *una risposta più
    // corta che ha l'aria di essere intera*.
    expect(
      problemaDegliIndirizziDiAccesso("dist", "produzione", {}, finto("niente")),
    ).not.toBeNull();
  });
});

describe("🔴 il comando gira davvero quando lo si lancia", () => {
  it("non esce zitto con codice zero", () => {
    // 🔴 IL DIFETTO CHE QUESTA PROVA CHIUDE, misurato il 02/09: il file
    //    riconosceva «mi hanno lanciato» confrontando `import.meta.url` con
    //    «file://» più il percorso. Su Windows `process.argv[1]` ha le barre
    //    rovesce e `import.meta.url` le barre dritte: il confronto **non
    //    tornava mai**, quindi da lì lo script usciva con **codice 0 senza
    //    aver controllato niente**.
    //
    // ⚠️ Su Linux funzionava, ed è per questo che nessuno se n'era accorto:
    //    in CI il controllo gira. Ma chi lo lanciasse dal computer di Alessio
    //    per guardare un pacchetto prima di pubblicare otterrebbe silenzio e
    //    codice zero — la faccia esatta di «va tutto bene».
    const esito = spawnSync(process.execPath, ["scripts/rilascio.mjs"], {
      encoding: "utf8",
    });
    // Senza `--ambiente` deve rifiutare: quello che conta è che **risponda**.
    expect(esito.status).not.toBe(0);
    expect(`${esito.stdout}${esito.stderr}`).toMatch(/[Aa]mbiente/);
  }, 60_000);
});
