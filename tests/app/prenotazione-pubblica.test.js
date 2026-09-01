import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonimo, clientAutenticato, credenziali, marchio, sagomeDiProva } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import {
  getReservationOptions,
  submitPublicReservation,
} from "../../src/lib/api/publicReservations";

// Il form pubblico deve funzionare ANCHE da un browser in cui il
// gestionale è aperto.
//
// Guasto reale del 09/08/2026: Alessio prova il proprio form da /prenota,
// vede "Non è stato possibile inviare la richiesta" e nel database non
// arriva niente. Causa: il collegamento condiviso dell'app allega la
// sessione di chi è loggato, e la funzione delle richieste pubbliche è
// concessa al solo ruolo anonimo → 403. Da sloggato funzionava, quindi il
// difetto era invisibile a chiunque non fosse dentro il gestionale — cioè
// invisibile a chi lo prova.
//
// Questa prova rifà esattamente quella scena: prima entra, poi invia.

const TELEFONO = "3999000099";
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const NOME = marchio("PROVA AUTOMATICA form pubblico");

// Un momento in cui il locale accetta davvero prenotazioni.
//
// Non si può più scrivere una data fissa: dal 10/08 il database rifiuta i
// giorni di chiusura e gli orari fuori servizio, e quegli orari li decide
// Alessio dalle impostazioni. Una data scritta a mano qui dentro
// funzionerebbe finché non sposta un giorno di riposo, e poi fallirebbe
// dando la colpa al form.
async function quandoSiPuoPrenotare(persone = 2) {
  const oggi = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const opzioni = await getReservationOptions({ date, partySize: persone });
    // Interruttore spento: vale qualunque data futura, decide il titolare.
    if (!opzioni?.attivo) return { date, time: "20:00" };
    if (opzioni.orari?.length) return { date, time: opzioni.orari[0] };
  }
  throw new Error(
    "Nessun orario prenotabile nei prossimi 30 giorni: controllare orari e capienza in Sala e orari."
  );
}

describe("form pubblico /prenota", () => {
  let titolare;

  const ripulisci = async () => {
    await titolare.from("reservations").delete().eq("customer_phone", TELEFONO);
  };

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    await ripulisci(); // eventuali residui di una corsa interrotta
    // La scena del guasto: il gestionale è aperto in questo browser.
    const { error } = await supabase.auth.signInWithPassword(cred.staff);
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await ripulisci();
    // scope "local": chiude la sessione SOLO qui. Il signOut normale è
    // globale — revoca l'utente su tutti i dispositivi — e facendo girare
    // le prove in parallelo buttava fuori l'altro file di prove a metà
    // corsa, con un errore che sembrava un guasto del corridoio.
    await supabase.auth.signOut({ scope: "local" });
  });

  it("invia la richiesta anche con il gestionale aperto e loggato", async () => {
    const { data: sessione } = await supabase.auth.getSession();
    expect(sessione.session).not.toBeNull(); // altrimenti la prova non prova nulla

    const quando = await quandoSiPuoPrenotare();
    await expect(
      submitPublicReservation({
        ...quando,
        partySize: 2,
        name: NOME,
        phone: TELEFONO,
        email: "",
        notes: "",
      })
    ).resolves.toBeUndefined();

    const { data } = await titolare
      .from("reservations")
      .select("source, status")
      .eq("customer_phone", TELEFONO);
    expect(data).toHaveLength(1);
    // La funzione impone origine e stato: non li decide il chiamante.
    expect(data[0].source).toBe("form_pubblico");
    expect(data[0].status).toBe("richiesta_in_attesa");
  });

  it("il varco resta chiuso a chi non è anonimo (il permesso non è stato allargato)", async () => {
    // Se un domani qualcuno "risolvesse" concedendo la funzione anche agli
    // utenti loggati, questa prova lo direbbe: la porta pubblica deve
    // restare l'unica del ruolo anonimo.
    const loggato = await clientAutenticato(credenziali().staff);
    const { error } = await loggato.rpc("submit_public_reservation", {
      p_reservation_date: "2026-12-31",
      p_reservation_time: "21:00",
      p_party_size: 2,
      p_customer_name: NOME,
      p_customer_phone: TELEFONO,
      p_customer_email: null,
      p_notes: null,
    });
    expect(error).not.toBeNull();
    expect(error.code).toBe("42501"); // permesso negato
  });
});

// La pianta viva (14/08/2026): al posto del calcolo dei posti liberi.
//
// Queste prove NON accendono l'interruttore delle prenotazioni online:
// cambiarlo mentre gira il locale vero cambierebbe il comportamento del
// sito pubblico per il tempo della corsa. La catena completa (giornata al
// completo che rifiuta, ferie che restano distinguibili) sta dentro la
// migrazione 20260814000007, che la esegue e si ripulisce. Qui si prova
// ciò che la migrazione NON può provare, perché gira come
// amministratore: i permessi dei ruoli veri.
describe("la pianta della sala e la giornata al completo", () => {
  let titolare;
  let staff;
  let anonimo;
  let prova = { ids: [], pulisci: async () => {} };
  // Data lontana: nessuna prenotazione vera ci finisce sopra.
  const GIORNO_PIENO = "2027-06-15";

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([
      clientAutenticato(cred.titolare),
      clientAutenticato(cred.staff),
    ]);
    anonimo = clientAnonimo();
    await titolare.from("giornate_sold_out").delete().eq("data", GIORNO_PIENO);
    prova = await sagomeDiProva(titolare, 3);
  });

  afterAll(async () => {
    await titolare.from("giornate_sold_out").delete().eq("data", GIORNO_PIENO);
    await prova.pulisci();
  });

  it("del calcolo dei posti non è rimasto niente da chiamare", async () => {
    // Non «risponde zero»: proprio non esiste più. Una funzione spenta,
    // fra tre mesi, qualcuno la riaccende credendo di riparare qualcosa.
    const { error } = await titolare.rpc("posti_liberi", { p_quando: "2027-06-15T20:00:00" });
    expect(error).not.toBeNull();

    // E nessun tavolo può tornare ad avere dei coperti.
    const { error: coperti } = await titolare
      .from("dining_tables")
      .update({ seats: 4 })
      .eq("id", prova.ids[0]);
    expect(coperti).not.toBeNull();
  });

  it("un tavolo non può avere coperti, e gli arredi fissi non si spostano", async () => {
    const { error: suTavolo } = await titolare
      .from("dining_tables")
      .update({ posti_fissi: 4 })
      .eq("id", prova.ids[0]);
    expect(suTavolo).not.toBeNull();
    expect(suTavolo.code).toBe("23514"); // il vincolo, non un controllo di schermata
  });

  it("la pianta di un giorno è base + scostamenti, e il giorno dopo riparte dalla base", async () => {
    const domani = "2027-06-16";

    const { error } = await titolare.from("disposizioni_giornaliere").upsert(
      { data: GIORNO_PIENO, dining_table_id: prova.ids[0], x: 1234, y: 567 },
      { onConflict: "data,dining_table_id" }
    );
    expect(error).toBeNull();

    const { data: quelGiorno } = await titolare.rpc("pianta_del_giorno", { p_data: GIORNO_PIENO });
    const spostato = quelGiorno.find((s) => s.id === prova.ids[0]);
    expect(spostato.x).toBe(1234);
    expect(spostato.spostato).toBe(true);

    const { data: ilGiornoDopo } = await titolare.rpc("pianta_del_giorno", { p_data: domani });
    const base = ilGiornoDopo.find((s) => s.id === prova.ids[0]);
    expect(base.x).toBe(100); // la posizione di partenza della sagoma di prova
    expect(base.spostato).toBe(false);

    await titolare.from("disposizioni_giornaliere").delete().eq("data", GIORNO_PIENO);
  });

  it("lo staff vede la pianta ma non la sposta, e non chiude la serata", async () => {
    const { data: vista } = await staff.rpc("pianta_del_giorno", { p_data: GIORNO_PIENO });
    expect((vista ?? []).length).toBeGreaterThan(0);

    const { data: mosse } = await staff
      .from("disposizioni_giornaliere")
      .insert({ data: GIORNO_PIENO, dining_table_id: prova.ids[0], x: 10, y: 10 })
      .select("id");
    expect(mosse ?? []).toHaveLength(0);

    const { data: chiuse } = await staff
      .from("giornate_sold_out")
      .insert({ data: GIORNO_PIENO })
      .select("data");
    expect(chiuse ?? []).toHaveLength(0);
  });

  it("una giornata al completo rifiuta la richiesta pubblica, e il rifiuto è del database", async () => {
    const { error: segnata } = await titolare.from("giornate_sold_out").insert({ data: GIORNO_PIENO });
    expect(segnata).toBeNull();

    // Il cliente lo vede…
    const opzioni = await getReservationOptions({ date: GIORNO_PIENO, partySize: 2 });
    expect(opzioni.sold_out).toBe(true);
    expect(opzioni.chiuso).toBe(true);

    // …e chiamando la funzione direttamente, non dall'interfaccia, il
    // rifiuto arriva lo stesso: un form disabilitato non è un freno.
    await expect(
      submitPublicReservation({
        date: GIORNO_PIENO,
        time: "20:00",
        partySize: 2,
        name: "PROVA AUTOMATICA sold out",
        phone: "3999000098",
        email: "",
        notes: "",
      })
    ).rejects.toThrow(/completo/i);
  });

  it("il form pubblico non espone nessun numero sulla capienza", async () => {
    const opzioni = await getReservationOptions({ date: "2027-06-20", partySize: 2 });
    // Si controlla la FORMA della risposta, non il testo: una chiave in
    // più domani sarebbe un numero in più esposto senza che nessuno se
    // ne accorga.
    const ammesse = ["attivo", "chiuso", "sold_out", "motivo", "orari"];
    expect(Object.keys(opzioni).filter((k) => !ammesse.includes(k))).toEqual([]);
    expect(Array.isArray(opzioni.orari)).toBe(true);

    // E il ruolo anonimo non legge né la pianta né le giornate chiuse.
    const { data: sagome } = await anonimo.from("dining_tables").select("id");
    expect(sagome ?? []).toHaveLength(0);
    const { data: piene } = await anonimo.from("giornate_sold_out").select("data");
    expect(piene ?? []).toHaveLength(0);
  });

  it("orari e chiusure li cambia solo il titolare", async () => {
    const [perStaff, perTitolare] = await Promise.all([
      staff.from("service_hours").select("id"),
      titolare.from("service_hours").select("id"),
    ]);
    // Lo staff li legge (in sala serve sapere fin quando si accettano arrivi)
    expect(perStaff.data.length).toBe(14);
    expect(perTitolare.data.length).toBe(14);

    // ma non li tocca: la RLS non gli fa passare nessuna riga in modifica.
    const riga = perStaff.data[0];
    const { data: modificate } = await staff
      .from("service_hours")
      .update({ ultimo_ingresso: "23:59" })
      .eq("id", riga.id)
      .select("id");
    expect(modificate ?? []).toHaveLength(0);

    // e infatti il valore vero è rimasto quello di prima
    const { data: controllo } = await titolare
      .from("service_hours")
      .select("ultimo_ingresso")
      .eq("id", riga.id)
      .single();
    expect(controllo.ultimo_ingresso).not.toBe("23:59:00");

    // e il ruolo anonimo non li vede proprio
    const { data: perAnonimo } = await anonimo.from("service_hours").select("id");
    expect(perAnonimo ?? []).toHaveLength(0);
  });
});

// La prenotazione presa al telefono, guardando la sala (14/08/2026).
//
// Chiesta da Alessio dopo la prima prova della pianta: al telefono si
// guarda dove c'è spazio e si scrive il nome, senza uscire dalla
// schermata. Qui si prova ciò che la migrazione non può provare perché
// gira come amministratore: che la prenda anche lo STAFF, e che non
// faccia partire niente verso il cliente.
describe("prendere una prenotazione dalla pianta", () => {
  let titolare;
  let staff;
  let prova = { ids: [], sagome: [], pulisci: async () => {} };
  const NOME = "PROVA AUTOMATICA telefono";
  const QUANDO = "2027-07-20";

  const ripulisci = async () => {
    await titolare.from("reservations").delete().like("customer_name", `${NOME}%`);
  };

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([
      clientAutenticato(cred.titolare),
      clientAutenticato(cred.staff),
    ]);
    await ripulisci();
    prova = await sagomeDiProva(titolare, 2);
  });

  afterAll(async () => {
    await ripulisci();
    await prova.pulisci();
  });

  it("lo staff la prende su due tavoli accostati: nasce confermata e senza email", async () => {
    const { data, error } = await staff.rpc("crea_prenotazione_su_tavoli", {
      p_data: QUANDO,
      p_ora: "20:30",
      p_persone: 8,
      p_nome: NOME,
      p_tavoli: prova.ids,
      p_telefono: "3999000097",
      p_email: null,
      p_note: null,
    });
    expect(error).toBeNull();
    expect(data.tavoli).toBe(2);

    const { data: riga } = await staff
      .from("reservations")
      .select("status, source, party_size")
      .eq("id", data.reservation_id)
      .single();
    // Confermata: al telefono gliel'ha appena detto lui.
    expect(riga.status).toBe("confermata");
    // Interna: è quello che tiene spento l'avviso su Telegram.
    expect(riga.source).toBe("interno");
    expect(riga.party_size).toBe(8);

    // ⚠️ Nessuna email al cliente: l'email parte su un CAMBIO di stato, e
    // qui non ce n'è nessuno. Si controlla invece di darlo per scontato.
    const { data: inviate } = await titolare
      .from("email_inviate")
      .select("id")
      .eq("reservation_id", data.reservation_id);
    expect(inviate ?? []).toHaveLength(0);

    // E i tavoli risultano suoi nella giornata.
    const { data: tavoli } = await staff
      .from("prenotazione_tavoli")
      .select("etichetta_al_momento")
      .eq("reservation_id", data.reservation_id);
    expect(tavoli.map((t) => t.etichetta_al_momento).sort()).toEqual(
      prova.sagome.map((s) => s.label).sort()
    );
  });

  it("senza tavoli e senza nome non si prende", async () => {
    const senzaTavoli = await staff.rpc("crea_prenotazione_su_tavoli", {
      p_data: QUANDO, p_ora: "20:00", p_persone: 2, p_nome: NOME, p_tavoli: [],
    });
    expect(senzaTavoli.error).not.toBeNull();

    const senzaNome = await staff.rpc("crea_prenotazione_su_tavoli", {
      p_data: QUANDO, p_ora: "20:00", p_persone: 2, p_nome: "  ", p_tavoli: prova.ids,
    });
    expect(senzaNome.error).not.toBeNull();
  });

  it("il ruolo anonimo non la può prendere: resta un gesto di chi è in sala", async () => {
    const anonimo = clientAnonimo();
    const { error } = await anonimo.rpc("crea_prenotazione_su_tavoli", {
      p_data: QUANDO, p_ora: "20:00", p_persone: 2, p_nome: NOME, p_tavoli: prova.ids,
    });
    expect(error).not.toBeNull();
    expect(error.code).toBe("42501"); // permesso negato
  });
});
