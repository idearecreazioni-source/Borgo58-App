import { describe, expect, it } from "vitest";
import {
  TIPO_CASSA,
  TIPO_DA_RIMBORSARE,
  TIPO_DI_CHI_SONO,
  TIPO_TASCA,
  correggiSpese,
  cosaManca,
  destinazioneDellaSpesa,
  diChiSono,
  versoStorto,
} from "../../supabase/functions/ascolta-voce/tasca.ts";

// 🔴 DUE COSE CHE SI SOMIGLIANO ABBASTANZA DA SCAMBIARSI, e il gestionale lo
//    sa da sé: in Cassa i due pulsanti stanno uno accanto all'altro.
//      · **La mia tasca** — soldi di Alessio che NON tornano indietro.
//      · **Anticipo io, poi mi rimborso** — soldi che la società gli pareggia.
//
// 🔴 QUALI PAROLE SCELGONO QUALE LO HA DECISO LUI il 07/09/2026, ed è una
//    scelta di prodotto: «di tasca mia» è sempre la tasca; per l'altro caso
//    usa parole esplicite; se non nomina nessuno dei due MEMO chiede; e se
//    li nomina tutt'e due **prevale il rimborso**.
//
// ⚠️ QUESTE PROVE GUARDANO LA REGOLA, NON IL MODELLO: quello che si prova è
//    che, qualunque cosa il modello proponga, le parole dette decidono.

const spesa = (dati, extra = {}) => ({
  tipo: TIPO_CASSA,
  sicuro: true,
  frase: "Ho comprato il detersivo",
  dati: { verso: "uscita", importo: 12, descrizione: "detersivo", ...dati },
  ...extra,
});

describe("di chi erano i soldi", () => {
  it("🔴 «di tasca mia» è sempre la tasca", () => {
    const dopo = destinazioneDellaSpesa(spesa({ soldi: "di tasca mia" }));
    expect(dopo.tipo).toBe(TIPO_TASCA);
    expect(dopo.destinazione).toBe("Spesa dalla mia tasca");
  });

  it("🔴 «poi mi rimborso» va alle anticipazioni, non alla tasca", () => {
    const dopo = destinazioneDellaSpesa(spesa({ soldi: "poi mi rimborso" }));
    expect(dopo.tipo).toBe(TIPO_DA_RIMBORSARE);
    expect(dopo.tipo).not.toBe(TIPO_TASCA);
    expect(dopo.destinazione).toBe("Anticipo io, poi mi rimborso");
  });

  it("🔴 e se ci sono TUTT'E DUE, prevale il rimborso", () => {
    // 🔴 LA REGOLA CHE PROTEGGE DI PIÙ (decisione di Alessio, 07/09): non si
    //    registra mai come non rimborsabile una cosa che ha detto di voler
    //    recuperare. Sbagliando in quel verso i soldi non tornano, e la riga
    //    è plausibile: non se ne accorge nessuno.
    for (const detto of [
      "di tasca mia, poi mi rimborso",
      "l'ho anticipato di tasca mia",
      "spesa personale ma da rimborsare",
    ]) {
      expect(destinazioneDellaSpesa(spesa({ soldi: detto })).tipo, detto).toBe(
        TIPO_DA_RIMBORSARE,
      );
    }
  });

  it("🔴 «con soldi miei» non basta: CHIEDE quale dei due", () => {
    // ⚠️ In italiano dice chi ha pagato, non se tornano. Sono due cose
    //    diverse, e sceglierne una sarebbe farlo al posto suo.
    const dopo = destinazioneDellaSpesa(spesa({ soldi: "con soldi miei" }));
    expect(dopo.tipo).toBe(TIPO_DI_CHI_SONO);
    expect(dopo.motivo).toMatch(/di tasca mia/);
    expect(dopo.motivo).toMatch(/rimborso|anticipato/);
  });

  it("se dei soldi non ha parlato, resta la cassa dell'osteria com'era", () => {
    // ⚠️ È la metà che discrimina: una regola che dirottasse tutto romperebbe
    //    il gesto più frequente — «ho pagato trenta euro al fornitore».
    const dopo = destinazioneDellaSpesa(spesa({}));
    expect(dopo.tipo).toBe(TIPO_CASSA);
    expect(dopo.motivo).toBeUndefined();
  });

  it("🔴 il fatto DICHIARATO decide da solo: il riassunto del modello non si legge", () => {
    // 🔴 IL DIFETTO, misurato col modello vero il 07/09/2026. Alla frase
    //    «ho pagato 30 euro di tasca mia per il pane» il modello aveva
    //    dichiarato benissimo `soldi: "di tasca mia"`, e poi aveva scritto
    //    di suo il riassunto «Uscita di 30€ per il pane (anticipati di
    //    tasca sua)». Leggendo anche quel riassunto, la parola «anticipati»
    //    mandava la spesa fra le cose da farsi rimborsare — il contrario di
    //    quello che Alessio aveva detto.
    const vera = spesa(
      { soldi: "di tasca mia" },
      { frase: "Uscita di 30€ per il pane (anticipati di tasca sua)" },
    );
    expect(diChiSono(vera)).toBe("tasca");
    expect(destinazioneDellaSpesa(vera).tipo).toBe(TIPO_TASCA);
  });

  it("...e senza dichiarazione la rete guarda il DETTATO di Alessio", () => {
    // ⚠️ Serve davvero: se il modello non riempisse `soldi`, una spesa
    //    personale resterebbe un movimento della cassa dell'osteria — cioè
    //    il soggetto sbagliato, in silenzio.
    expect(diChiSono(spesa({}), "ho comprato il pane di tasca mia")).toBe("tasca");
    expect(diChiSono(spesa({}), "l'ho anticipato io, poi mi rimborso")).toBe("rimborso");
    expect(diChiSono(spesa({}), "ho pagato trenta euro al fornitore")).toBe("non_ne_ha_parlato");
    expect(diChiSono(spesa({}))).toBe("non_ne_ha_parlato");
  });

  it("🔴 «senza rimborso» è la tasca, non un rimborso", () => {
    // 🔴 Una contraddizione dentro gli elenchi stessi, trovata mentre si
    //    curava il difetto qui sopra: «senza rimborso» contiene la parola
    //    «rimborso», e senza guardare prima le negazioni finiva fra le cose
    //    da farsi ridare — cioè il contrario di quello che dice.
    for (const detto of ["senza rimborso", "non chiedo rimborso", "niente rimborso"]) {
      expect(diChiSono(spesa({ soldi: detto })), detto).toBe("tasca");
    }
  });
});

describe("🔴 quello che manca non si inventa", () => {
  it("senza importo non si scrive, e lo dice", () => {
    const dopo = destinazioneDellaSpesa(spesa({ soldi: "di tasca mia", importo: null }));
    expect(dopo.tipo).toBe(TIPO_DI_CHI_SONO);
    expect(dopo.tipo).not.toBe(TIPO_TASCA);
    expect(dopo.motivo).toMatch(/quanto hai speso/);
  });

  it("senza il per che cosa non si scrive, e lo dice", () => {
    const dopo = destinazioneDellaSpesa(spesa({ soldi: "di tasca mia", descrizione: "  " }));
    expect(dopo.tipo).toBe(TIPO_DI_CHI_SONO);
    expect(dopo.motivo).toMatch(/per che cosa/);
  });

  it("se mancano tutt'e due le nomina TUTTE, non la prima", () => {
    // ⚠️ Dirne una per volta fa scoprire la seconda dopo aver rimediato alla
    //    prima, e alla terza si smette di leggere.
    const dopo = destinazioneDellaSpesa(
      spesa({ soldi: "di tasca mia", importo: null, descrizione: "" }),
    );
    expect(dopo.motivo).toMatch(/quanto hai speso/);
    expect(dopo.motivo).toMatch(/per che cosa/);
  });

  it("un importo a zero o negativo conta come mancante", () => {
    for (const importo of [0, -5, "", "ciao", null, undefined]) {
      expect(cosaManca({ dati: { importo, descrizione: "x" } }), String(importo)).toContain(
        "quanto hai speso",
      );
    }
    expect(cosaManca({ dati: { importo: 12, descrizione: "detersivo" } })).toEqual([]);
  });
});

describe("🔴 dalla tasca escono soldi e basta", () => {
  it("un'entrata non si propone nemmeno, e si dice perché", () => {
    const dopo = destinazioneDellaSpesa(spesa({ soldi: "di tasca mia", verso: "entrata" }));
    expect(dopo.tipo).toBe(TIPO_DI_CHI_SONO);
    expect(dopo.motivo).toMatch(/pareggio|restituisce/i);
    expect(dopo.motivo).toMatch(/Anticipo io/);
  });

  it("...e un'uscita, o un verso non detto, passano", () => {
    // La metà che discrimina: un controllo che rifiutasse sempre renderebbe
    // la tasca inutilizzabile, e la prova qui sopra passerebbe lo stesso.
    expect(versoStorto(spesa({ verso: "uscita" }))).toBe(false);
    expect(versoStorto(spesa({ verso: null }))).toBe(false);
    expect(versoStorto(spesa({ verso: "entrata" }))).toBe(true);
    expect(destinazioneDellaSpesa(spesa({ soldi: "di tasca mia", verso: null })).tipo).toBe(
      TIPO_TASCA,
    );
  });
});

describe("le altre cose e la filza", () => {
  it("una cosa che non è una spesa non viene toccata", () => {
    const temperatura = { tipo: "temperatura", frase: "di tasca mia", dati: { gradi: 3 } };
    expect(destinazioneDellaSpesa(temperatura).tipo).toBe("temperatura");
  });

  it("🔴 i tipi che non si possono approvare non sono del catalogo", () => {
    // Se collidessero con un tipo vero, l'appunto tornerebbe approvabile e la
    // riga entrerebbe da sola — è il difetto trovato il 06/09 sulle liste.
    for (const t of [TIPO_DA_RIMBORSARE, TIPO_DI_CHI_SONO]) {
      expect(t).not.toBe(TIPO_CASSA);
      expect(t).not.toBe(TIPO_TASCA);
    }
  });

  it("su tutta la filza converte solo quelle che vanno convertite", () => {
    const dopo = correggiSpese([
      spesa({ soldi: "di tasca mia" }),
      spesa({ soldi: "poi mi rimborso" }),
      spesa({ soldi: "con soldi miei" }),
      spesa({}),
      { tipo: "promemoria", dati: { titolo: "x" } },
    ]);
    expect(dopo.map((a) => a.tipo)).toEqual([
      TIPO_TASCA,
      TIPO_DA_RIMBORSARE,
      TIPO_DI_CHI_SONO,
      TIPO_CASSA,
      "promemoria",
    ]);
  });
});
