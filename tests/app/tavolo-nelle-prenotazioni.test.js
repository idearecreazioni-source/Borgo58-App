import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, sagomeDiProva } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { creaPrenotazioneSuTavoli, listReservations } from "../../src/lib/api/reservations";
import { campiPrenotazione } from "../../src/lib/calcoli/prenotazioni";

// IL TAVOLO ARRIVA DAVVERO INSIEME ALLE PRENOTAZIONI (18/08, giro D3).
//
// ⚠️ PERCHÉ QUESTA PROVA ESISTE, ed è tutta nel modo in cui fallirebbe.
// L'elenco del Calendario Eventi legge i tavoli con un **incorporamento**
// (`tavoli:prenotazione_tavoli(...)`), che è una cosa che il database può
// smettere di concedere senza che nessuno se ne accorga: basta una regola di
// permessi diversa o una chiave esterna rinominata. E il modo in cui
// fallirebbe non è un errore rosso — è **«da assegnare» su ogni riga**, cioè
// una schermata che dice con calma che nessuna prenotazione ha un tavolo.
//
// È la stessa forma del difetto del 16/08 (il campo che non arriva al
// database) letta al contrario: qui è un campo che non arriva alla schermata.
// Una prova pura non può vederlo — `campiPrenotazione` fa il suo lavoro
// benissimo su una prenotazione senza tavoli.
//
// ⚠️ E si entra come STAFF: le prenotazioni le guarda anche chi sta in sala.

const GIORNO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

let titolare;
let sagome;
const nate = [];

async function pulisci() {
  if (!nate.length) return;
  await titolare.from("prenotazione_tavoli").delete().in("reservation_id", nate);
  await titolare.from("reservations").delete().in("id", nate);
  nate.length = 0;
}

beforeAll(async () => {
  titolare = await clientAutenticato(credenziali().titolare);
  const { error } = await supabase.auth.signInWithPassword(credenziali().staff);
  if (error) throw new Error(`Non riesco a entrare come staff: ${error.message}`);
  sagome = await sagomeDiProva(titolare, 2);
  await pulisci();
});

afterAll(async () => {
  await pulisci();
  await sagome?.pulisci();
  await supabase.auth.signOut({ scope: "local" });
  await titolare?.auth.signOut({ scope: "local" });
});

describe("Il tavolo nell'elenco delle prenotazioni", () => {
  it("una prenotazione su DUE tavoli li porta tutti e due fino alla schermata", async () => {
    const esito = await creaPrenotazioneSuTavoli({
      data: GIORNO,
      ora: "20:00",
      persone: 4,
      nome: "PROVA tavolo in elenco",
      tavoliIds: sagome.ids,
    });
    nate.push(esito?.reservation_id ?? esito?.id);

    const elenco = await listReservations({ date: GIORNO });
    const mia = elenco.find((r) => r.id === nate[0]);
    expect(mia, "la prenotazione appena creata non compare nell'elenco").toBeTruthy();

    // ⚠️ Si controlla il campo COME LO VEDE LA SCHERMATA, non la forma grezza
    // della risposta: fra il database e l'occhio c'è `campiPrenotazione`, ed è
    // quello il tratto che può rompersi.
    const tavolo = campiPrenotazione(mia).find((c) => c.chiave === "tavolo");
    const etichette = sagome.sagome.map((s) => s.label);
    for (const e of etichette) expect(tavolo.valore).toContain(e);
    await pulisci();
  });

  it("e una senza tavoli lo dice — la gemella al contrario", async () => {
    // Senza questa, un incorporamento che restituisse sempre gli stessi tavoli
    // passerebbe la prova qui sopra. E il caso è reale: una richiesta arrivata
    // dal sito non ha nessun tavolo finché non gliene dà uno Alessio.
    const { data, error } = await titolare
      .from("reservations")
      .insert({
        reservation_date: GIORNO,
        reservation_time: "21:00",
        party_size: 2,
        customer_name: "PROVA senza tavolo",
        status: "richiesta_in_attesa",
        source: "interno",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    nate.push(data.id);

    const elenco = await listReservations({ date: GIORNO });
    const mia = elenco.find((r) => r.id === data.id);
    const tavolo = campiPrenotazione(mia).find((c) => c.chiave === "tavolo");
    expect(tavolo.valore).toBe("");
    await pulisci();
  });
});
