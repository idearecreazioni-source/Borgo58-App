import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";
import { accettaPreventivo, nuovaVersionePreventivo, salvaPreventivo, trattativeDelGiorno } from "../../src/lib/api/preventivi";
import { annullaPrenotazione } from "../../src/lib/api/reservations";
import { supabase } from "../../src/lib/supabase";

// L'EVENTO ACCETTATO — blocco 4 del mandato dei preventivi (20/08/2026).
//
// 🔴 QUESTE PROVE ENTRANO DAL COLLEGAMENTO DELL'APP, non da uno loro: le
// funzioni di `api/preventivi.js` passano dal corridoio col token di un
// utente vero, e un'operazione non dichiarata nel corridoio risponde 404
// senza che nessuna prova SQL se ne accorga. È anche l'unico modo di
// esercitare il tratto fra schermata e database — dove il 16/08 si è
// scoperto che una funzione `security invoker` rendeva impossibile un
// gesto che dentro una migrazione riusciva sempre.
//
// 🔴 E I NUMERI SONO SCELTI PERCHÉ DISTINGUANO. La capienza si CHIEDE alla
// sala, non si scrive qui: un evento con TUTTI i posti della sera riempie,
// uno da 2 persone no. Se il gestionale prendesse la scorciatoia «è un
// evento, quindi blocca», il secondo caso diventerebbe rosso.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO evento");
const GIORNO_PIENO = "1995-09-20";
const GIORNO_LIBERO = "1995-09-21";
const GIORNO_TRATTATIVA = "1995-09-22";

describe("l'evento accettato, la sala che si blocca e quella che no", () => {
  let titolare;
  let staff;
  let ente;
  let capienza;

  async function pulisci() {
    const { data: p } = await titolare.from("preventivi").select("id").like("cliente_nome", `${MARCA}%`);
    const ids = (p ?? []).map((r) => r.id);
    if (ids.length) {
      await titolare.from("giornate_sold_out").delete().in("preventivo_id", ids);
      await titolare.from("preventivo_fogli").delete().in("preventivo_id", ids);
      // ⚠️ Si scollega PRIMA e si cancella DOPO: il rifiuto sulla
      // cancellazione di un preventivo con un evento è una protezione, e non
      // si spegne per fare pulizia — ci si gira attorno.
      await titolare.from("preventivi").update({ reservation_id: null }).in("id", ids);
      await titolare.from("preventivi").delete().not("versione_di", "is", null).in("id", ids);
      await titolare.from("preventivi").delete().in("id", ids);
    }
    await titolare.from("giornate_sold_out").delete().in("data", [GIORNO_PIENO, GIORNO_LIBERO, GIORNO_TRATTATIVA]);
    await titolare.from("reservations").delete().like("customer_name", `${MARCA}%`);
    await titolare.from("allarmi").delete().like("messaggio", `${MARCA}%`);
  }

  // ⚠️ NESSUN AVVISO PARTE DA QUESTE PROVE. Annullare un evento manda un
  // messaggio su Telegram, e il telefono di Alessio suonerebbe per una prova
  // (§8, già successo l'11/08). Si usa il freno anti-tempesta del sistema —
  // un avviso per tipo all'ora — mettendo davanti un allarme di quel tipo:
  // la regola gira per intero, il messaggio non parte.
  async function silenzia(reservationId) {
    await titolare.from("allarmi").insert({
      tipo: `evento_annullato_${reservationId}`,
      messaggio: `${MARCA}: silenzia l'avviso di questa prova`,
      notificato: true,
    });
  }

  async function creaPreventivo(nome, giorno, persone) {
    return salvaPreventivo({
      testata: {
        entity_id: ente,
        cliente_nome: `${MARCA} ${nome}`,
        data_evento: giorno,
        ora_evento: "20:00",
        persone,
      },
      righe: [],
    });
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    ente = await primaEntita(titolare);
    await pulisci();

    const { data: gruppi, error } = await titolare.rpc("coperti_del_giorno", { p_data: GIORNO_PIENO });
    expect(error, "la sala non si è potuta contare").toBeNull();
    capienza = (gruppi ?? []).reduce((s, g) => s + g.coperti, 0);
    // ⚠️ Una prova che non riesce più a costruire il caso che sorveglia
    // smette di guardarlo senza diventare rossa: qui si ferma invece.
    expect(capienza, "sala vuota: questa prova non distinguerebbe niente").toBeGreaterThan(4);
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("un evento che riempie la sala la blocca, e l'evento nasce in calendario", async () => {
    const prev = await creaPreventivo("pieno", GIORNO_PIENO, capienza);
    const esito = await accettaPreventivo(prev);

    expect(esito.sala_piena, "la sala non risulta piena").toBe(true);
    expect(esito.capienza).toBe(capienza);
    expect(esito.reservation_id, "nessun evento in calendario").toBeTruthy();

    const { data: res } = await titolare
      .from("reservations")
      .select("type, status, party_size, reservation_date")
      .eq("id", esito.reservation_id)
      .single();
    expect(res.type).toBe("evento");
    expect(res.status).toBe("confermata");
    expect(res.party_size).toBe(capienza);
    expect(res.reservation_date).toBe(GIORNO_PIENO);

    // ⚠️ La spunta dice DA DOVE viene: senza, annullare l'evento
    // spegnerebbe anche una spunta messa a mano da Alessio.
    const { data: spunta } = await titolare
      .from("giornate_sold_out")
      .select("preventivo_id")
      .eq("data", GIORNO_PIENO)
      .maybeSingle();
    expect(spunta?.preventivo_id, "la spunta non risulta accesa dal preventivo").toBe(prev);
  });

  it("🔴 un evento da due persone NON blocca la sala", async () => {
    // È la prova che distingue la regola dalla scorciatoia «è un evento,
    // quindi blocca»: qui la sala ci sta comodamente.
    const prev = await creaPreventivo("piccolo", GIORNO_LIBERO, 2);
    const esito = await accettaPreventivo(prev);

    expect(esito.sala_piena, "un evento da 2 persone ha chiuso la sala").toBe(false);
    const { data: spunta } = await titolare
      .from("giornate_sold_out")
      .select("data")
      .eq("data", GIORNO_LIBERO)
      .maybeSingle();
    expect(spunta, "la sala risulta bloccata da un evento conciliabile").toBeNull();
  });

  it("annullato l'evento, la sala torna libera e il preventivo lo dice", async () => {
    const prev = await creaPreventivo("da annullare", GIORNO_TRATTATIVA, capienza);
    const esito = await accettaPreventivo(prev);
    expect(esito.sala_piena).toBe(true);

    await silenzia(esito.reservation_id);
    // ⚠️ Si annulla dal gesto VERO dell'app, non scrivendo in tabella:
    // è quello che fa una mano in sala.
    await annullaPrenotazione(esito.reservation_id);

    const { data: spunta } = await titolare
      .from("giornate_sold_out")
      .select("data")
      .eq("data", GIORNO_TRATTATIVA)
      .maybeSingle();
    expect(spunta, "annullato l'evento la sala è rimasta bloccata").toBeNull();

    const { data: p } = await titolare.from("preventivi").select("stato").eq("id", prev).single();
    expect(p.stato, "il preventivo risulta ancora accettato").toBe("annullato");
  });

  it("🔴 una versione nuova aggiorna l'evento, non ne crea un secondo", async () => {
    // ⚠️ È LA PROVA CHE DIVENTA ROSSA se si toglie il collegamento fra la
    // versione nuova e la vecchia: senza `versione_di` nascerebbe una
    // seconda prenotazione per la stessa cena, e nessuna delle due
    // sembrerebbe sbagliata.
    const prima = await titolare
      .from("reservations")
      .select("id")
      .eq("reservation_date", GIORNO_LIBERO)
      .eq("type", "evento");
    const quanti = (prima.data ?? []).length;

    const { data: vecchio } = await titolare
      .from("preventivi")
      .select("id, reservation_id")
      .eq("cliente_nome", `${MARCA} piccolo`)
      .single();

    const nuovo = await nuovaVersionePreventivo(vecchio.id);
    await salvaPreventivo({
      id: nuovo,
      testata: {
        entity_id: ente,
        cliente_nome: `${MARCA} piccolo v2`,
        data_evento: GIORNO_LIBERO,
        ora_evento: "20:00",
        persone: 6,
      },
      righe: [],
    });
    const esito = await accettaPreventivo(nuovo);

    expect(esito.reservation_id, "la versione nuova ha creato un secondo evento").toBe(
      vecchio.reservation_id
    );
    const dopo = await titolare
      .from("reservations")
      .select("id, party_size")
      .eq("reservation_date", GIORNO_LIBERO)
      .eq("type", "evento");
    expect((dopo.data ?? []).length, "gli eventi di quella sera sono raddoppiati").toBe(quanti);
    expect(dopo.data[0].party_size, "l'evento non è stato aggiornato").toBe(6);
  });

  it("le trattative aperte si vedono, quelle già accettate no", async () => {
    await salvaPreventivo({
      testata: {
        entity_id: ente,
        cliente_nome: `${MARCA} trattativa`,
        data_evento: GIORNO_TRATTATIVA,
        ora_evento: "21:00",
        persone: 18,
        stato: "inviato",
      },
      righe: [],
    });
    const righe = await trattativeDelGiorno(GIORNO_TRATTATIVA);
    expect(righe.length, "la trattativa aperta non compare").toBe(1);
    expect(righe[0].persone).toBe(18);
    // Un evento già accettato non è più un dubbio su quella serata.
    const accettate = await trattativeDelGiorno(GIORNO_PIENO);
    expect(accettate.length, "un evento accettato compare fra le trattative").toBe(0);
  });

  it("🔴 in sala l'avviso arriva SENZA il nome del cliente", async () => {
    // ⚠️ Questa prova esiste solo dal client: dentro una migrazione tutto
    // gira come proprietario, e un difetto di permessi non si vedrebbe mai
    // (lezione del 16/08). Chi è in sala deve sapere che quella sera è in
    // trattativa — quante persone basta a decidere — ma il cliente di
    // Alessio è un dato suo.
    const r = await staff.rpc("trattative_del_giorno", { p_data: GIORNO_TRATTATIVA });
    expect(r.error, "lo staff non può nemmeno sapere che c'è una trattativa").toBeNull();
    expect((r.data ?? []).length, "in sala la trattativa non si vede").toBe(1);
    expect(r.data[0].persone).toBe(18);
    expect(r.data[0].cliente, "in sala si legge il nome del cliente").toBeNull();

    const mio = await titolare.rpc("trattative_del_giorno", { p_data: GIORNO_TRATTATIVA });
    expect(mio.data[0].cliente, "nemmeno il titolare vede il nome").toContain(MARCA);
  });

  it("un preventivo con un evento in calendario non si cancella e basta", async () => {
    const { data: p } = await titolare
      .from("preventivi")
      .select("id")
      .eq("cliente_nome", `${MARCA} pieno`)
      .single();
    const r = await titolare.from("preventivi").delete().eq("id", p.id);
    expect(r.error, "un preventivo con un evento è stato cancellato").not.toBeNull();
    // ⚠️ Un rifiuto senza via d'uscita è un vicolo cieco: dice cosa fare prima.
    expect(r.error.message).toContain("Annulla prima l");
  });
});
