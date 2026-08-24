import { beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// LE SEI LINEE E IL PAREGGIO IN EURO — 24/08/2026, blocco 4 del collaudo.
//
// ⚠️ QUESTE PROVE STANNO QUI E NON IN UNA MIGRAZIONE per due ragioni: i
// permessi si provano solo col token di un utente vero (una migrazione gira
// come proprietaria e scavalca la RLS, lezione del 16/08), e la regola
// dello zero è una proprietà che si guarda dal lato di chi usa il
// gestionale.
describe("le linee della previsione", () => {
  let titolare;
  let staff;
  let scenario;

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);

    const { data } = await titolare
      .from("scenari_proiezione")
      .select("id, congelato_il")
      .is("congelato_il", null)
      .limit(1);
    scenario = data?.[0]?.id ?? null;
  });

  it("ogni linea dice con che forma si conta", async () => {
    if (!scenario) expect.fail("Nessuna previsione libera sul progetto di prova: questa prova non ha esercitato niente.");

    const { data, error } = await titolare.rpc("linee_della_previsione", {
      p_scenario_id: scenario,
    });
    expect(error).toBeNull();
    if (!data.length) expect.fail("La previsione di prova non ha linee: non c'è niente da guardare.");

    for (const l of data) {
      // ⚠️ Nessuna linea può restare senza forma, nemmeno quelle scritte
      // prima del 24/08: lì la forma si deduce dalla base vecchia, e se la
      // deduzione non rispondesse il calcolo la tratterebbe come forfait
      // per sbaglio — cioè moltiplicandola per il numero di eventi.
      expect(l.forma, `la linea «${l.linea}» non dice come si conta`).toBeTruthy();
      expect(["a_coperto", "a_forfait", "a_pezzo"]).toContain(l.forma);
    }
  });

  it("una linea a ZERO è dichiarata tale, non è una riga dimenticata", async () => {
    // 🔴 È la regola n. 1 del disegno, con le parole di Alessio: *«chef
    // table e barattoli devono poter restare a zero senza sporcare il
    // pareggio e senza comparire come previsione mancata: zero previsto e
    // zero reale è un allineamento perfetto, non un fallimento»*.
    const { data: prima } = await titolare.rpc("pareggio_previsione", {
      p_scenario_id: scenario,
    });

    const { data: linee } = await titolare.rpc("linee_della_previsione", {
      p_scenario_id: scenario,
    });
    const linea = linee[0];
    const quantitaVera = linea.quantita;

    try {
      // La si porta a zero, come farebbe Alessio con la chef table.
      await titolare
        .from("scenario_linee_accessorie")
        .update({ quantita: 0 })
        .eq("id", linea.id);

      const { data: dopo } = await titolare.rpc("pareggio_previsione", {
        p_scenario_id: scenario,
      });

      // ⚠️ La linea a zero si DICHIARA a zero: la schermata deve poter dire
      // «questa non parte ancora» invece di mostrare una riga vuota che
      // sembra da riempire.
      const { data: rilette } = await titolare.rpc("linee_della_previsione", {
        p_scenario_id: scenario,
      });
      expect(rilette.find((l) => l.id === linea.id).a_zero).toBe(true);

      // ⚠️ E NON SPORCA IL PAREGGIO: resta un numero sensato, non nullo e
      // non negativo. Il pareggio si sposta — una linea che non c'è più non
      // porta margine, ed è giusto — ma resta calcolabile.
      expect(dopo[0].pareggio_euro).not.toBeNull();
      expect(Number(dopo[0].pareggio_euro)).toBeGreaterThan(0);
      expect(dopo[0].frase).toBeTruthy();
    } finally {
      // Si rimette esattamente il valore di prima, riconosciuto per
      // identificativo: mai «l'ultima riga» (regola del 23/08).
      await titolare
        .from("scenario_linee_accessorie")
        .update({ quantita: quantitaVera })
        .eq("id", linea.id);
    }

    // Rimesso a posto, il pareggio torna quello di prima.
    const { data: tornato } = await titolare.rpc("pareggio_previsione", {
      p_scenario_id: scenario,
    });
    expect(Number(tornato[0].pareggio_euro)).toBeCloseTo(Number(prima[0].pareggio_euro), 2);
  });

  it("il numero in coperti esce SEMPRE con la frase che lo dichiara condizionato", async () => {
    // ⚠️ Il numero e il suo limite viaggiano insieme, come per
    // `calcola_imposte()` (15/08): un avviso che vive nel testo di una
    // schermata non protegge la seconda schermata che mostra lo stesso
    // numero.
    const { data } = await titolare.rpc("pareggio_previsione", { p_scenario_id: scenario });
    expect(data[0].frase).toBeTruthy();
    expect(data[0].frase).toMatch(/se le altre linee|non si può|non ha ricavi/i);
  });

  it("lo staff riceve un RIFIUTO sul pareggio, non un elenco vuoto", async () => {
    const { data, error } = await staff.rpc("pareggio_previsione", { p_scenario_id: scenario });
    expect(error).toBeTruthy();
    expect(data).toBeFalsy();
    // ⚠️ Si guarda QUALE rifiuto risponde: scritta come «arriva un errore»,
    // questa prova passerebbe anche col portiere tolto, perché a fermare lo
    // staff sarebbe `costanti_scenario` o un'altra difesa più a valle. È il
    // difetto trovato stamattina sugli avvisi della Dashboard.
    expect(error.message).toMatch(/Proiezione è riservata al titolare/i);
  });

  it("una linea con un codice inventato viene respinta", async () => {
    const { error } = await titolare.from("scenario_linee_accessorie").insert({
      scenario_id: scenario,
      linea: "__PROVA__ gelateria",
      quantita: 1,
      prezzo_medio: 1,
      costo_percento: 0,
      base: "per_giorno",
      codice: "gelateria",
      forma: "a_coperto",
    });
    expect(error, "una linea con un codice fuori vocabolario è entrata").toBeTruthy();
  });
});
