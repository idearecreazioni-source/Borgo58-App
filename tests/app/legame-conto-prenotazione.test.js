import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { apriConto } from "../../src/lib/api/orders";
import { creaPrenotazioneSuTavoli } from "../../src/lib/api/reservations";

// IL LEGAME FRA UN CONTO E LA SUA PRENOTAZIONE (18/08, giro D1).
//
// ⚠️ PERCHE' DAL CLIENT E NON SOLO DENTRO LA MIGRAZIONE. La verifica di una
// migrazione gira come proprietaria del database e non passa dal
// corridoio: proverebbe la regola SQL e non il tratto fra schermata e
// database — cioe' esattamente il punto dove il 16/08 si e' perso il
// `mezzo` delle mance, e dove un parametro nuovo (`p_serata`) puo' non
// arrivare senza che nessuno se ne accorga, perche' senza serata la
// funzione non fallisce: lascia il legame vuoto.
//
// Le tre prove sono discriminanti SOLO INSIEME:
//   1. col tavolo prenotato il legame si riempie;
//   2. sullo stesso tavolo con DUE turni sceglie quello dell'ora giusta;
//   3. su un tavolo senza prenotazioni resta vuoto — e resta vuoto anche
//      se la serata non viene passata.

// ⚠️ NON una data passata, e la ragione l'ha detta il database: la porta
// vera risponde «Quella data è già passata», perché una prenotazione per
// ieri non ha senso. Le altre prove di questo progetto marcano il proprio
// perimetro con anni lontani nel passato; qui non si può, quindi si usa
// DOMANI — e si pulisce tutto, che è la sola cosa che tiene il perimetro.
const GIORNO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
let titolare;
let tavolo;
const nati = { ordini: [], prenotazioni: [] };

// ⚠️ Si prenota dalla PORTA VERA — l'operazione del corridoio che usa la
// pianta — e non scrivendo in tabella. Provato: `prenotazione_tavoli`
// rifiuta l'inserimento diretto (la RLS vuole che si passi di lì), e una
// prova che si costruisce lo stato con una scorciatoia non esercita la
// strada che percorre Alessio.
async function prenota(ora, nome) {
  const esito = await creaPrenotazioneSuTavoli({
    data: GIORNO,
    ora,
    persone: 2,
    nome,
    tavoliIds: [tavolo],
  });
  const id = esito?.reservation_id ?? esito?.id;
  if (!id) throw new Error(`La prenotazione non ha restituito un id: ${JSON.stringify(esito)}`);
  nati.prenotazioni.push(id);
  return id;
}

const legameDi = async (orderId) => {
  const { data, error } = await titolare
    .from("orders")
    .select("reservation_id")
    .eq("id", orderId)
    .single();
  if (error) throw new Error(error.message);
  return data.reservation_id;
};

async function chiudiEPulisci() {
  if (nati.ordini.length) {
    await titolare.from("order_tables").delete().in("order_id", nati.ordini);
    await titolare.from("orders").delete().in("id", nati.ordini);
    nati.ordini = [];
  }
  if (nati.prenotazioni.length) {
    await titolare.from("prenotazione_tavoli").delete().in("reservation_id", nati.prenotazioni);
    await titolare.from("reservations").delete().in("id", nati.prenotazioni);
    nati.prenotazioni = [];
  }
}

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
  if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
  titolare = supabase;
  const { data, error: eT } = await titolare
    .from("dining_tables")
    .select("id")
    .eq("tipo", "tavolo")
    .eq("active", true)
    .order("position")
    .limit(1);
  if (eT) throw new Error(eT.message);
  if (!data?.length) throw new Error("Non c'è nessun tavolo su cui provare il legame.");
  tavolo = data[0].id;
  await chiudiEPulisci();
});

afterAll(async () => {
  if (!titolare) return;
  await chiudiEPulisci();
  await titolare.auth.signOut({ scope: "local" });
});

describe("Il conto sa da quale prenotazione nasce", () => {
  it("su un tavolo senza prenotazioni il legame resta VUOTO — ed è normale", async () => {
    // ⚠️ Il caso che va scritto perché nessuno lo «corregga»: un conto
    // senza prenotazione è uno che entra senza prenotare.
    const id = await apriConto([tavolo], { serata: GIORNO });
    nati.ordini.push(id);
    expect(await legameDi(id)).toBeNull();
    await chiudiEPulisci();
  });

  it("col tavolo prenotato il legame si riempie", async () => {
    const p = await prenota("20:00", "PROVA legame");
    const id = await apriConto([tavolo], { serata: GIORNO });
    nati.ordini.push(id);
    expect(await legameDi(id)).toBe(p);
    await chiudiEPulisci();
  });

  it("con DUE turni sceglie quello dell'ora più vicina, non il primo", async () => {
    // ⚠️ È il caso per cui la regola esiste: dal giro C un tavolo può
    // avere un giallo alle 19:30 e un arancio alle 22:30. Prendere «la
    // prima che trovi» attaccherebbe lo scontrino al cliente sbagliato.
    // Le due ore si mettono a cavallo dell'istante in cui gira la prova,
    // così una delle due è per forza la più vicina — e si controlla che
    // sia QUELLA, non che sia una delle due.
    const adesso = new Date();
    const hh = (m) => {
      const d = new Date(adesso.getTime() + m * 60000);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const vicina = await prenota(hh(5), "PROVA vicina");
    await prenota(hh(-240), "PROVA lontana");
    const id = await apriConto([tavolo], { serata: GIORNO });
    nati.ordini.push(id);
    expect(await legameDi(id)).toBe(vicina);
    await chiudiEPulisci();
  });

  it("e senza la serata il legame resta vuoto invece di indovinare", async () => {
    // ⚠️ La prova al contrario del passaggio del parametro: se un giorno
    // qualcuno smettesse di passare la serata, il conto NON deve
    // agganciarsi a una prenotazione a caso. Perde l'informazione, non ne
    // scrive una sbagliata.
    await prenota("20:00", "PROVA senza serata");
    const id = await apriConto([tavolo]);
    nati.ordini.push(id);
    expect(await legameDi(id)).toBeNull();
    await chiudiEPulisci();
  });
});
