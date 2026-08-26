import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientAutenticato,
  corridoioInstallato,
  credenziali,
  denunciaSaltiCorridoio,
  righeMie,
} from "./aiuto";
import { setReservationDeposit } from "../../src/lib/api/reservations";
import { caparraDelConto } from "../../src/lib/api/orders";
// ⚠️ IL COLLEGAMENTO DELL'APP, non uno nostro. `eseguiOperazione` passa da
// questo, e una prova che apre un client suo farebbe parlare l'app da
// anonima: il corridoio risponde «Sessione non valida» e sembra un guasto del
// corridoio. Lezione del 18/08/2026, terza ricomparsa.
import { supabase } from "../../src/lib/supabase";
// ⚠️ Mai `new Date().toISOString().slice(0,10)`: e' la data UTC, e questa
// regola vale anche per il codice che non e' l'app (lezione del 17/08/2026).
import { traGiorniLocale } from "../../src/lib/constants";

// LA CAPARRA ENTRA IN CASSA (26/08/2026).
//
// ⚠️ COSA PROVA QUESTO FILE, E PERCHÉ NON POTREBBE PROVARLO LA MIGRAZIONE.
// Il giro completo — importo a zero respinto, bonifico spento, prenotazione
// cancellata col denaro che resta — sta dentro `20260826000017`, che gira
// come proprietaria. Qui si prova solo ciò che da dentro una migrazione è
// invisibile:
//
//  1. che la funzione dell'APP (`setReservationDeposit`) arrivi davvero fino
//     al movimento di cassa. Fino al 26/08 scriveva dritta dal browser in una
//     tabella sola, e il denaro non arrivava mai nel cassetto: nessun errore,
//     solo un numero che il cassetto non conosceva;
//  2. che il corridoio conosca le due operazioni nuove. Un nome fuori
//     dall'elenco risponde 404, e nessuna prova sul database se ne accorge;
//  3. che il portiere regga col token di un utente vero: `registra_caparra` è
//     `security definer`, quindi dentro la funzione la RLS non protegge più e
//     il controllo del ruolo è l'unica cosa che resta.
//
// ⚠️ `cash_movements` È UNA TABELLA SORVEGLIATA dal registro delle
// cancellazioni: questa prova toglie le proprie lapidi per identificativo,
// perché sono righe che ha creato lei (regola del 23/08).
const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("la caparra: quando la ricevi, entra in cassa", () => {
  let titolare;
  let staff;
  let mie;
  let prenotazione;
  const movimenti = [];

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    mie = righeMie(titolare);
    const { error: eLogin } = await supabase.auth.signInWithPassword(credenziali().titolare);
    if (eLogin) throw eLogin;

    const { data, error } = await titolare
      .from("reservations")
      .insert({
        customer_name: "__PROVA__ caparra",
        reservation_date: traGiorniLocale(30),
        reservation_time: "20:30",
        party_size: 8,
        status: "confermata",
        source: "interno",
      })
      .select("id")
      .single();
    if (error) throw error;
    prenotazione = mie.segna("reservations", data.id);
  });

  afterAll(async () => {
    if (titolare && prenotazione) {
      await setReservationDeposit(prenotazione, "").catch(() => {});
      await mie.pulisci();
      // 🔴 LA LAPIDE NON SI PUÒ TOGLIERE, E VA DETTO invece di provarci.
      // Misurato il 26/08: su `deleted_records` c'è UNA SOLA policy,
      // `deleted_records_select_titolare` in SELECT. Nessuna in DELETE —
      // ed è voluto: il registro non si ripulisce dall'app. Quindi ogni giro
      // di questa prova lascia **una lapide** sul progetto di prova, e non
      // c'è modo di evitarlo dal client.
      // ⚠️ Un `.delete()` su quella tabella NON dà errore: cancella zero
      // righe in silenzio. Scriverlo qui sarebbe una pulizia che dichiara di
      // aver fatto una cosa che non ha fatto — peggio di non averla.
    }
    await supabase.auth.signOut({ scope: "local" });
    await titolare?.auth.signOut({ scope: "local" });
    await staff?.auth.signOut({ scope: "local" });
  });

  it.skipIf(!CORRIDOIO)("registrarla scrive il movimento di cassa, con la sua causale", async () => {
    const prima = await titolare.from("cash_movements").select("id", { count: "exact", head: true });

    const esito = await setReservationDeposit(prenotazione, 80);
    expect(esito?.movimento_id).toBeTruthy();
    movimenti.push(esito.movimento_id);

    const dopo = await titolare.from("cash_movements").select("id", { count: "exact", head: true });
    expect(dopo.count).toBe(prima.count + 1);

    const { data: mov } = await titolare
      .from("cash_movements")
      .select("amount, direction, mezzo, reservation_id, caparra_evento_il, cash_causali(label)")
      .eq("id", esito.movimento_id)
      .single();
    expect(Number(mov.amount)).toBe(80);
    expect(mov.direction).toBe("entrata");
    expect(mov.mezzo).toBe("cassa");
    expect(mov.cash_causali.label).toBe("Caparra ricevuta");
    // Il legame nelle due direzioni: dal movimento alla prenotazione…
    expect(mov.reservation_id).toBe(prenotazione);
    // …e dalla caparra al movimento.
    const { data: dep } = await titolare
      .from("reservation_deposits")
      .select("amount, movimento_id")
      .eq("reservation_id", prenotazione)
      .single();
    expect(dep.movimento_id).toBe(esito.movimento_id);
    expect(Number(dep.amount)).toBe(80);
  });

  it.skipIf(!CORRIDOIO)("correggere l'importo sposta tutti e due i numeri, non ne crea un secondo", async () => {
    const prima = await titolare.from("cash_movements").select("id", { count: "exact", head: true });

    const esito = await setReservationDeposit(prenotazione, 95);
    expect(esito?.corretta).toBe(true);

    const dopo = await titolare.from("cash_movements").select("id", { count: "exact", head: true });
    expect(dopo.count).toBe(prima.count);

    const { data: mov } = await titolare
      .from("cash_movements")
      .select("amount")
      .eq("id", movimenti[0])
      .single();
    expect(Number(mov.amount)).toBe(95);
  });

  it.skipIf(!CORRIDOIO)("una caparra a zero euro è respinta, e lo dice in italiano", async () => {
    await expect(setReservationDeposit(prenotazione, 0)).rejects.toThrow(/non e.* una caparra/i);
  });

  it.skipIf(!CORRIDOIO)("lo staff non può registrare una caparra: è un dato commerciale", async () => {
    // ⚠️ `registra_caparra` è security definer: dentro la funzione la RLS non
    // protegge più, e il portiere è l'unica cosa che resta. Si prova col token
    // vero dello staff, perché da dentro una migrazione questo è invisibile.
    const { error } = await staff.functions.invoke("operazioni-atomiche", {
      body: { operazione: "registra_caparra", parametri: { p_reservation_id: prenotazione, p_importo: 50 } },
    });
    expect(error).toBeTruthy();
  });

  it.skipIf(!CORRIDOIO)("la proposta arriva fino al browser, e su un conto senza caparra tace", async () => {
    // ⚠️ SI PROVA DAL CLIENT PERCHE' I PERMESSI SONO INVISIBILI DA DENTRO UNA
    // MIGRAZIONE: `caparra_del_conto` è `security definer`, e una `revoke`
    // dimenticata la renderebbe muta a schermo senza nessun errore rosso —
    // cioe' un conto con caparra che si chiude come se non ne avesse.
    const { data: ent } = await titolare.from("entities").select("id").eq("entity_type", "srls").single();

    const { data: senza } = await titolare
      .from("orders")
      .insert({ entity_id: ent.id, table_label: "__PROVA__ senza caparra", coperti: 2 })
      .select("id").single();
    mie.segna("orders", senza.id);
    expect(await caparraDelConto(senza.id)).toBeNull();

    const esito = await setReservationDeposit(prenotazione, 30);
    movimenti.push(esito.movimento_id);
    const { data: con } = await titolare
      .from("orders")
      .insert({ entity_id: ent.id, table_label: "__PROVA__ con caparra", coperti: 4,
                reservation_id: prenotazione, coperto_unit_price: 20 })
      .select("id").single();
    mie.segna("orders", con.id);

    const proposta = await caparraDelConto(con.id);
    expect(proposta).toBeTruthy();
    expect(Number(proposta.importo)).toBe(30);
    expect(proposta.si_puo_scalare).toBe(true);
    // La frase e' quella che il cameriere legge: deve nominare i due numeri.
    expect(proposta.frase).toMatch(/30,00/);
    expect(proposta.frase).toMatch(/da incassare adesso/i);
  });
});
