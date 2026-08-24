import { beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// GLI AVVISI DELLA PRIMA SCHERMATA — 24/08/2026.
//
// ⚠️ QUESTE PROVE ESISTONO PERCHÉ LA MIGRAZIONE NON PUÒ FARLE. Una
// migrazione gira come **proprietaria del database**, e le proprietarie
// scavalcano la RLS: un difetto che vive nei permessi lì dentro passa
// verde tutte le volte (lezione del 16/08, quando si scoprì che dal 02/08
// nessuno poteva marcare una ricetta «pronta per carta»). L'unica cosa
// che se ne accorge è il gesto vero, fatto col token di un utente vero.
describe("gli avvisi del gestionale", () => {
  let titolare;
  let staff;

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);
  });

  // 🔴 QUESTA PROVA GUARDA IL *MESSAGGIO*, e non è pignoleria: è un difetto
  // trovato rompendo il codice apposta il 24/08.
  //
  // Scritta come «lo staff riceve un errore», passava **anche con il
  // portiere degli avvisi tolto** — perché lo staff veniva fermato lo
  // stesso, ma da `conti_da_fiscalizzare`, che ha il portiere suo. Cioè:
  // dimostrava che una difesa esiste, non che esiste QUESTA. È la trappola
  // del 24/08 in una forma nuova — non «non c'era niente da fare», ma
  // **«c'era già qualcun altro che lo faceva»**.
  //
  // ⚠️ Il prezzo, dichiarato: cambiando il testo del rifiuto questa prova
  // diventa rossa. È voluto — è l'unica cosa che distingue quale delle due
  // difese ha risposto, e chi cambia il messaggio deve accorgersene.
  it("lo staff riceve il rifiuto DEGLI AVVISI, non un elenco vuoto", async () => {
    const { data, error } = await staff.rpc("avvisi_del_gestionale");
    // ⚠️ La differenza è tutta qui: un elenco vuoto si legge «va tutto
    // bene», ed è una rassicurazione falsa data a chi non doveva vedere.
    expect(error).toBeTruthy();
    expect(data).toBeFalsy();
    expect(
      error.message,
      "lo staff è stato fermato, ma non dal portiere degli avvisi: " +
        `ha risposto «${error.message}». Il portiere di avvisi_del_gestionale ` +
        "potrebbe non esserci più."
    ).toContain("avvisi del gestionale");
  });

  it("il titolare li legge, e ogni avviso porta con sé dove si risolve", async () => {
    const { data, error } = await titolare.rpc("avvisi_del_gestionale");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const a of data) {
      // ⚠️ Un avviso senza strada è un vicolo cieco: si legge che qualcosa
      // non va e non c'è modo di andare a sistemarlo.
      expect(a.dove, `l'avviso «${a.chiave}» non dice dove si va`).toBeTruthy();
      expect(a.dove.startsWith("/")).toBe(true);
      // ⚠️ E un avviso a zero non deve esistere: se compare, il riquadro
      // dice «da sistemare» su una cosa che non c'è.
      expect(a.quanti).toBeGreaterThan(0);
    }
  });

  it("un avviso rimandato esce dal riquadro, e riprendendolo torna", async () => {
    const { data: prima } = await titolare.rpc("avvisi_del_gestionale");
    const aperto = (prima ?? []).find((a) => !a.rimandato_a);

    // ⚠️ IL CASO VUOTO NON PROVA NIENTE (regola del 17/08): se non c'è
    // nessun avviso aperto, questa prova non ha nulla da esercitare — e lo
    // dice, invece di passare in silenzio dimostrando solo che non esplode.
    if (!aperto) {
      expect.fail(
        "Nessun avviso aperto sul progetto di prova: questa prova non ha esercitato niente. " +
          "Serve almeno una condizione aperta (una scadenza, una non conformità) per provarla."
      );
    }

    const { error: e1 } = await titolare.rpc("rimanda_avviso", {
      p_chiave: aperto.chiave,
      p_giorni: 2,
    });
    expect(e1).toBeNull();

    const { data: dopo } = await titolare.rpc("avvisi_del_gestionale");
    const rimandato = dopo.find((a) => a.chiave === aperto.chiave);
    expect(rimandato, "l'avviso è sparito del tutto invece di essere rimandato").toBeTruthy();
    expect(rimandato.rimandato_a).toBeTruthy();

    // La via di ritorno. ⚠️ È anche la pulizia di questa prova: si toglie
    // esattamente la riga che ha scritto lei, riconosciuta per chiave.
    const { error: e2 } = await titolare.rpc("riprendi_avviso", { p_chiave: aperto.chiave });
    expect(e2).toBeNull();

    const { data: fine } = await titolare.rpc("avvisi_del_gestionale");
    expect(fine.find((a) => a.chiave === aperto.chiave)?.rimandato_a).toBeFalsy();
  });

  it("lo staff non può rimandare né riprendere", async () => {
    const { data: elenco } = await titolare.rpc("avvisi_del_gestionale");
    const chiave = (elenco ?? [])[0]?.chiave ?? "scadenze";

    const { error: e1 } = await staff.rpc("rimanda_avviso", { p_chiave: chiave, p_giorni: 1 });
    expect(e1).toBeTruthy();

    const { error: e2 } = await staff.rpc("riprendi_avviso", { p_chiave: chiave });
    expect(e2).toBeTruthy();
  });

  it("un avviso che non esiste non si rimanda", async () => {
    const { error } = await titolare.rpc("rimanda_avviso", {
      p_chiave: "questa_famiglia_non_esiste_davvero",
      p_giorni: 1,
    });
    expect(error).toBeTruthy();
  });
});
