import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import { registraConteggioCassa } from "../../src/lib/api/cash";
import { segnalaScontrinoNonUscito, listContiFiscalizzatiInRitardo } from "../../src/lib/api/orders";
import { emettiScontrino, scontrinoEmesso, ESITI } from "../../src/lib/registratore";
import { supabase } from "../../src/lib/supabase";

// L'ELENCO CHE SI FA NOTARE — blocco 1 del mandato del registratore.
//
// ⚠️ Queste prove entrano col token di un utente vero e passano dalle
// funzioni dell'app: la verifica dentro la migrazione gira come proprietaria
// del database, dove la RLS non esiste.
//
// ⚠️ Le date sono nel 1995 perché il locale apre nel 2027: una serata
// passata e lontana non incrocia nessun dato vero (regola del 17/08 —
// e le date non sono mai un posto neutro, quindi si sceglie il passato,
// non il futuro, che nel frattempo ha acquistato significato).
const MARCA = "TEST-AUTO fisc";
const SERATA_VUOTA = "1995-07-01";
const SERATA = "1995-07-02";
const GIORNO_DOPO = "1995-07-04";

describe("la chiusura della giornata non si completa in silenzio", () => {
  let titolare;
  let ente;
  let conto;

  async function pulisci() {
    const { data: conti } = await titolare.from("orders").select("id").like("table_label", `${MARCA}%`);
    for (const c of conti ?? []) {
      await titolare.from("segnalazioni_fiscali").delete().eq("order_id", c.id);
      await titolare.from("orders").delete().eq("id", c.id);
    }
    await titolare.from("cash_movements").delete().like("note", `%${MARCA}%`);
    await titolare.from("conteggi_cassa").delete().like("nota", `${MARCA}%`);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("con l'elenco vuoto la giornata si chiude normalmente, senza avvisi", async () => {
    // 🔴 È LA PROVA ALL'INCONTRARIO, e senza di lei la prossima non misura
    // niente: un avviso che compare sempre è un avviso che si impara a
    // ignorare. Ci siamo già passati con la lettura tagliata.
    const id = await registraConteggioCassa({
      entityId: ente,
      contato: 0,
      data: SERATA_VUOTA,
      nota: `${MARCA} vuoto`,
    });
    expect(id, "la giornata non si è chiusa con l'elenco vuoto").toBeTruthy();
    const { data } = await titolare
      .from("conteggi_cassa")
      .select("conti_da_fiscalizzare")
      .eq("id", id)
      .single();
    expect(data.conti_da_fiscalizzare).toBe(0);
  });

  it("un conto incassato senza documento BLOCCA la chiusura della giornata", async () => {
    // ⚠️ Il valore arriva dai coperti: due guardie del 16/08 vietano di
    // togliere le righe di un conto chiuso, e una prova non deve spegnere
    // una protezione per potersi ripulire.
    const { data: o, error } = await titolare
      .from("orders")
      .insert({
        entity_id: ente,
        table_label: `${MARCA} T1`,
        status: "chiuso",
        closed_at: `${SERATA}T21:00:00+02:00`,
        coperti: 2,
        coperto_unit_price: 20,
      })
      .select()
      .single();
    expect(error).toBeNull();
    conto = o.id;

    await expect(
      registraConteggioCassa({ entityId: ente, contato: 0, data: SERATA, nota: `${MARCA} bloccato` })
    ).rejects.toThrow(/senza documento fiscale/);
  });

  it("prendendone atto si chiude, e il permesso RESTA SCRITTO", async () => {
    // ⚠️ Se il permesso non lasciasse traccia, nessuno potrebbe contare
    // quante volte è stato dato — e una rete che si apre senza lasciare
    // segno smette di essere una rete.
    const id = await registraConteggioCassa({
      entityId: ente,
      contato: 0,
      data: SERATA,
      nota: `${MARCA} preso atto`,
      presoAtto: true,
    });
    const { data } = await titolare
      .from("conteggi_cassa")
      .select("conti_da_fiscalizzare")
      .eq("id", id)
      .single();
    expect(data.conti_da_fiscalizzare).toBeGreaterThan(0);
  });

  it("la segnalazione della sala riporta indietro uno scontrino «uscito»", async () => {
    await titolare
      .from("orders")
      .update({ documento_fiscale: "scontrino", documento_numero: "9", documento_emesso_il: SERATA })
      .eq("id", conto);

    const staff = await clientAutenticato(credenziali().staff);
    await supabase.auth.signOut({ scope: "local" });
    await supabase.auth.signInWithPassword({
      email: credenziali().staff.email,
      password: credenziali().staff.password,
    });

    // 🔴 LA FA LO STAFF, non il titolare: chi ha il cliente davanti è chi si
    // accorge della pagina bianca. Se questa prova girasse col titolare non
    // starebbe provando il gesto vero.
    const r = await segnalaScontrinoNonUscito(conto, "pagina bianca");
    expect(r.stato_prima).toBe("scontrino");

    const { data } = await staff
      .from("orders")
      .select("documento_fiscale, documento_numero")
      .eq("id", conto)
      .single();
    expect(data.documento_fiscale).toBeNull();
    expect(data.documento_numero).toBeNull();

    const { data: segn } = await staff.from("segnalazioni_fiscali").select("*").eq("order_id", conto);
    expect(segn.length, "la segnalazione non ha lasciato traccia").toBeGreaterThan(0);

    await staff.auth.signOut({ scope: "local" });
    await supabase.auth.signOut({ scope: "local" });
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
  });

  it("un conto fiscalizzato in ritardo resta nella serata in cui è stato pagato", async () => {
    // 🔴 La decisione di Alessio: l'incasso NON si sposta sul giorno del
    // documento. Spostarlo farebbe risultare quella serata più magra del
    // vero. ⚠️ La prova legge ENTRAMBE le giornate.
    await titolare
      .from("orders")
      .update({
        documento_fiscale: "scontrino",
        documento_numero: "10",
        documento_emesso_il: GIORNO_DOPO,
      })
      .eq("id", conto);

    const righe = await listContiFiscalizzatiInRitardo({
      entityId: ente,
      dal: SERATA_VUOTA,
      al: "1995-07-31",
    });
    const mia = righe.find((r) => r.order_id === conto);
    expect(mia, "lo scarto fra le due giornate non è dichiarato").toBeTruthy();
    expect(mia.serata).toBe(SERATA);
    expect(mia.emesso_il).toBe(GIORNO_DOPO);
    expect(mia.giorni_dopo).toBe(2);
  });

  it("il registratore non è collegato, e il gestionale lo DICE invece di far finta", async () => {
    // ⚠️ Rispondere «fatto» sarebbe la bugia comoda: segnerebbe i conti come
    // scontrinati e svuoterebbe l'unica rete di questo blocco.
    const r = await emettiScontrino({ id: conto });
    expect(r.esito).toBe(ESITI.NON_COLLEGATO);
    expect(scontrinoEmesso(r)).toBe(false);
  });
});
