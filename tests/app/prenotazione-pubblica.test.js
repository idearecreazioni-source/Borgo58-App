import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { submitPublicReservation } from "../../src/lib/api/publicReservations";

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

    await expect(
      submitPublicReservation({
        date: "2026-12-31",
        time: "20:00",
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
