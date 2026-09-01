import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";
import {
  destinatariCommerciali,
  numeriPerBroadcast,
  registraConsenso,
  registraInvioCommerciale,
  revocaConsenso,
  storiaCliente,
} from "../../src/lib/api/customers";
import { supabase } from "../../src/lib/supabase";

// IL CONSENSO DEI CLIENTI — 20/08/2026, blocco C del mandato della serata.
//
// 🔴 LA DISTINZIONE CHE REGGE TUTTO: confermare un tavolo a chi ha prenotato
// non ha bisogno di niente; mandargli il menu del mese sì. Le due strade sono
// **due funzioni con due nomi diversi**, e quella commerciale pretende il
// consenso **nel database** — non nella schermata.
//
// 🔴 TRE CLIENTI, NON UNO, e il numero è scelto perché DISTINGUA: con un
// cliente solo «tutti» e «solo quelli col consenso» sono lo stesso insieme, e
// nessuna di queste prove misurerebbe niente.
//   1 · il consenso ce l'ha            → riceve
//   2 · non gliel'hanno mai chiesto    → non riceve
//   3 · l'aveva dato e si è cancellato → non riceve
// ⚠️ Il terzo non è un doppione del secondo: distingue «non lo so» da «ha
// detto di no», che sono due stati diversi con due date diverse.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO consenso");

describe("il consenso decide chi riceve, e lo decide il database", () => {
  let titolare;
  let staff;
  let c1;
  let c2;
  let c3;

  async function pulisci() {
    const { data } = await titolare.from("customers").select("id").like("name", `${MARCA}%`);
    for (const c of data ?? []) {
      await titolare.from("email_inviate").delete().eq("customer_id", c.id);
      await titolare.from("customers").delete().eq("id", c.id);
    }
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    await pulisci();

    // ⚠️ Numeri che cominciano per 000: non è il prefisso di nessun paese, e
    // il marcatore vero sta nel nome (il telefono ha un vincolo numerico).
    const nuovo = async (n, nome, mail) => {
      const { data, error } = await titolare
        .from("customers")
        .insert({ phone: n, name: `${MARCA} ${nome}`, email: mail })
        .select()
        .single();
      expect(error).toBeNull();
      return data.id;
    };
    c1 = await nuovo("0000009001", "col consenso", "uno@esempio.it");
    c2 = await nuovo("0000009002", "mai chiesto", "due@esempio.it");
    c3 = await nuovo("0000009003", "cancellato", "tre@esempio.it");
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("il consenso nasce vuoto, e vuoto NON è «no»", async () => {
    // ⚠️ «Non gliel'ho mai chiesto» e «ha detto di no» sono due stati diversi,
    // e il secondo lo distingue la data di revoca.
    const { data } = await titolare
      .from("customers")
      .select("consenso_commerciale_il, consenso_revocato_il")
      .eq("id", c1)
      .single();
    expect(data.consenso_commerciale_il).toBeNull();
    expect(data.consenso_revocato_il).toBeNull();
  });

  it("si pretende COME l'ha dato: una spunta da sola non dimostra niente", async () => {
    await expect(registraConsenso(c2, "   ")).rejects.toThrow(/come te l/i);
  });

  it("registrato il consenso, il cliente può ricevere", async () => {
    await registraConsenso(c1, "al telefono");
    const righe = await destinatariCommerciali();
    const mio = righe.find((r) => r.customer_id === c1);
    expect(mio.puo_ricevere).toBe(true);
    expect(mio.perche_no).toBeNull();
  });

  it("🔴 chi si cancella esce DAVVERO, non solo dal registro delle richieste", async () => {
    await registraConsenso(c3, "di persona");
    await revocaConsenso(c3);

    const righe = await destinatariCommerciali();
    const suo = righe.find((r) => r.customer_id === c3);
    expect(suo.puo_ricevere, "chi si è cancellato è ancora fra i destinatari").toBe(false);
    expect(suo.perche_no).toContain("cancellato");

    // ⚠️ E la revoca NON cancella la prova che il consenso c'era stato: serve
    // a dimostrare che la richiesta è stata applicata, e quando.
    const { data } = await titolare
      .from("customers")
      .select("consenso_commerciale_il, consenso_revocato_il")
      .eq("id", c3)
      .single();
    expect(data.consenso_commerciale_il, "la revoca ha cancellato la prova").toBeTruthy();
    expect(data.consenso_revocato_il).toBeTruthy();
  });

  it("🔴 la comunicazione commerciale è RIFIUTATA a chi non ha il consenso", async () => {
    // Chi non gliel'ha mai detto...
    await expect(registraInvioCommerciale(c2, "Il menu del mese")).rejects.toThrow(/consenso/i);
    // ...e chi si è cancellato. Due casi diversi, stesso rifiuto.
    await expect(registraInvioCommerciale(c3, "Il menu del mese")).rejects.toThrow(/consenso/i);
  });

  it("...e passa a chi ce l'ha: è la prova che le due strade sono davvero due", async () => {
    const r = await registraInvioCommerciale(c1, "Il menu del mese");
    expect(r.email).toBe("uno@esempio.it");
    const { data } = await titolare
      .from("email_inviate")
      .select("tipo, oggetto")
      .eq("customer_id", c1);
    expect(data.length).toBe(1);
    expect(data[0].tipo).toBe("commerciale");
  });

  it("🔴 una conferma di prenotazione NON chiede nessun consenso", async () => {
    // ⚠️ È la prova che distingue le due strade dal lato opposto: senza, un
    // consenso preteso ovunque bloccherebbe le conferme dei tavoli — e
    // qualcuno lo aggirerebbe.
    const { error } = await titolare
      .from("email_inviate")
      .insert({ customer_id: c2, tipo: "conferma", oggetto: `${MARCA} conferma` });
    expect(error, "una conferma è stata bloccata dal consenso").toBeNull();
  });

  it("l'elenco dice anche CHI RESTA FUORI, e perché", async () => {
    // ⚠️ Un elenco di destinatari senza gli esclusi si legge «sono tutti».
    const righe = (await destinatariCommerciali()).filter((r) => r.nome.startsWith(MARCA));
    expect(righe.filter((r) => r.puo_ricevere).length).toBe(1);
    const fuori = righe.filter((r) => !r.puo_ricevere);
    expect(fuori.length).toBe(2);
    for (const r of fuori) expect(r.perche_no, `${r.nome} è escluso senza dire perché`).toBeTruthy();
    // Le due ragioni sono DIVERSE: «non gliel'ho chiesto» e «si è cancellato».
    expect(new Set(fuori.map((r) => r.perche_no)).size).toBe(2);
  });

  it("🔴 i numeri per WhatsApp portano il limite della rubrica, e non è un dettaglio", async () => {
    const r = await numeriPerBroadcast();
    // Il gestionale NON può sapere chi ha il numero di Alessio in rubrica:
    // un broadcast a chi non ce l'ha non arriva e nessuno lo segnala.
    expect(r.avvertenza, "l'elenco non avverte del limite della rubrica").toMatch(/rubrica/i);
    expect(r.numeri, "chi ha il consenso non compare fra i numeri").toContain("0000009001");
    expect(r.numeri, "chi non ha il consenso compare fra i numeri").not.toContain("0000009002");
    expect(r.numeri, "chi si è cancellato compare fra i numeri").not.toContain("0000009003");
  });

  it("in sala i consensi e la rubrica NON si toccano", async () => {
    // ⚠️ Si prova solo dal client: dentro una migrazione tutto gira come
    // proprietario (lezione del 16/08). E si RIFIUTA, non si torna vuoto.
    const a = await staff.rpc("destinatari_commerciali");
    expect(a.error, "chi è in sala ha ottenuto la rubrica dei clienti").not.toBeNull();
    const b = await staff.rpc("registra_consenso", { p_customer_id: c2, p_come: "a voce" });
    expect(b.error, "chi è in sala ha registrato un consenso").not.toBeNull();
    const c = await staff.rpc("numeri_per_broadcast");
    expect(c.error, "chi è in sala ha ottenuto i numeri dei clienti").not.toBeNull();
  });

  it("la storia del cliente vede quello che gli è stato mandato", async () => {
    const righe = await storiaCliente(c1);
    const uscite = righe.filter((r) => r.verso === "uscita");
    expect(uscite.length).toBeGreaterThanOrEqual(1);
    expect(uscite.some((r) => r.dettaglio === "Il menu del mese")).toBe(true);
  });
});
