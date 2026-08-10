import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { almenoUnTavolo, clientAnonimo, clientAutenticato, credenziali } from "./aiuto";
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
const NOME = "PROVA AUTOMATICA form pubblico";

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

// Capienza e orari (10/08/2026). Queste prove NON accendono l'interruttore
// delle prenotazioni online: cambiarlo mentre gira il locale vero
// cambierebbe il comportamento del sito pubblico per il tempo della corsa.
// La prova della catena completa (orario pieno che sparisce, invio
// rifiutato) sta dentro la migrazione 20260810000001, che la esegue e si
// ripulisce. Qui si verifica ciò che la migrazione NON può verificare,
// perché gira come amministratore: i permessi dei ruoli veri.
describe("posti liberi", () => {
  let titolare;
  let staff;
  let anonimo;
  let pulisciTavolo = async () => {};
  // Data lontana e ora precisa: nessuna prenotazione vera ci finisce sopra.
  const QUANDO = "2027-06-15T20:00:00";
  const NOME = "PROVA AUTOMATICA capienza";

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([
      clientAutenticato(cred.titolare),
      clientAutenticato(cred.staff),
    ]);
    anonimo = clientAnonimo();
    await titolare.from("reservations").delete().eq("customer_name", NOME);
    // Sul progetto di prova la sala nasce senza tavoli: senza posti a
    // sedere "quanti ne restano liberi" e sempre zero e non dimostra nulla.
    pulisciTavolo = await almenoUnTavolo(titolare);
  });

  afterAll(async () => {
    await titolare.from("reservations").delete().eq("customer_name", NOME);
    await pulisciTavolo();
  });

  it("una prenotazione toglie posti, cancellarla li ridà", async () => {
    const { data: prima, error: e1 } = await titolare.rpc("posti_liberi", { p_quando: QUANDO });
    expect(e1).toBeNull();
    expect(prima).toBeGreaterThan(0); // altrimenti la prova non dimostrerebbe nulla

    const { data: creata, error: e2 } = await titolare
      .from("reservations")
      .insert({
        type: "prenotazione",
        status: "richiesta_in_attesa",
        source: "interno",
        reservation_date: "2027-06-15",
        reservation_time: "20:00",
        party_size: 2,
        customer_name: NOME,
      })
      .select("id")
      .single();
    expect(e2).toBeNull();

    // Una richiesta ancora da confermare tiene il posto: è la decisione del
    // 10/08 — altrimenti due clienti vedrebbero lo stesso ultimo tavolo.
    const { data: dopo } = await titolare.rpc("posti_liberi", { p_quando: QUANDO });
    expect(dopo).toBe(prima - 2);

    // Mezz'ora dopo il tavolo è ancora occupato (dura più di un istante)…
    const { data: mezzOra } = await titolare.rpc("posti_liberi", {
      p_quando: "2027-06-15T20:30:00",
    });
    expect(mezzOra).toBe(prima - 2);

    // …ma il giorno prima no.
    const { data: altroGiorno } = await titolare.rpc("posti_liberi", {
      p_quando: "2027-06-14T20:00:00",
    });
    expect(altroGiorno).toBe(prima);

    await titolare.from("reservations").delete().eq("id", creata.id);
    const { data: liberato } = await titolare.rpc("posti_liberi", { p_quando: QUANDO });
    expect(liberato).toBe(prima);
  });

  it("il cliente può chiedere gli orari liberi, ma non quanto è pieno il locale", async () => {
    // La pagina pubblica passa da qui: deve funzionare da anonimo.
    const opzioni = await getReservationOptions({ date: "2027-06-15", partySize: 2 });
    expect(opzioni).toHaveProperty("attivo");
    expect(Array.isArray(opzioni.orari)).toBe(true);

    // Quanti posti restano è un dato di casa: non esce dal locale.
    const { error } = await anonimo.rpc("posti_liberi", { p_quando: QUANDO });
    expect(error).not.toBeNull();
    expect(error.code).toBe("42501");
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
