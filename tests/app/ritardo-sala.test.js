import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, sagomeDiProva } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { apriConto, cancelOrder, getServiceSettings, listContiPerPrenotazioni } from "../../src/lib/api/orders";
import { creaPrenotazioneSuTavoli, listReservations } from "../../src/lib/api/reservations";
import { getRegolePrenotazione, getTurniDelGiorno } from "../../src/lib/api/sala";
import { ARRIVO_PER_STATO, ritardiDellaSerata } from "../../src/lib/calcoli/ritardo";
import { istanteDellaSerata } from "../../src/lib/calcoli/serata";

// IL RITARDO, SUL TRATTO FRA SCHERMATA E DATABASE (18/08, giro D2).
//
// ⚠️ PERCHÉ NON BASTA LA PROVA PURA. L'aritmetica del ritardo è provata ai
// bordi in `tests/unita/ritardo.test.js`, e lì non serve nessun database.
// Quello che una prova pura non può vedere è tutto il resto, ed è dove
// questo progetto si è già fatto male tre volte:
//   · un campo che la schermata non passa e il database riempie da sé (le
//     mance, 16/08) — qui sarebbe `minuti_tolleranza_ritardo` tolto da una
//     `select`: la tolleranza diventerebbe zero e OGNI tavolo prenotato si
//     sbarrerebbe all'istante, senza nessun errore;
//   · un permesso che manca solo per chi lavora davvero (16/08): la sala
//     entra come STAFF, e le prenotazioni sono roba dei clienti;
//   · una prova che gira sul caso vuoto e dimostra soltanto che il codice
//     non esplode (17/08).
//
// Quindi qui si entra come STAFF — l'accesso che sta in mano a chi serve — e
// si costruisce lo stato dalle PORTE VERE: prenotazione dal corridoio, conto
// aperto dal corridoio, annullamento dalla funzione dell'app.
//
// ⚠️ L'OROLOGIO LO METTE LA PROVA, e non è una scorciatoia: il tempo che
// passa non si può aspettare, e la serata di una prenotazione non può essere
// nel passato (la porta vera la rifiuta, misurato dal giro D1). Il database
// fornisce i fatti — chi ha prenotato, chi ha un conto, quanti minuti di
// tolleranza — e l'istante lo sceglie la prova. È la stessa divisione con
// cui il ritardo è calcolato e non scritto.

const GIORNO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
const ORA = "20:00";

let titolare;
let sagome;
let tavolo;
const nati = { ordini: [], prenotazioni: [] };

async function pulisci() {
  // Prima i conti, poi le prenotazioni: dal 18/08 un conto può nominare una
  // prenotazione e la chiave esterna è `restrict`, quindi l'ordine inverso
  // verrebbe respinto. È lo stesso ordine con cui andranno tolti i dati di
  // collaudo veri.
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

// ⚠️ OGNI PROVA SI RIPULISCE PRIMA DI PASSARE ALLA SUCCESSIVA, e non è una
// pignoleria: lasciando un conto aperto, la prova dopo si sente rispondere
// «questo tavolo ha già un conto» e diventa rossa per il residuo invece che
// per un difetto. È la lezione del giro D1 — *in una catena di prove che
// condividono lo stato, chi conta i rossi conta i difetti solo se le prove
// sono indipendenti.*
async function prenota(nome) {
  const esito = await creaPrenotazioneSuTavoli({
    data: GIORNO,
    ora: ORA,
    persone: 2,
    nome,
    tavoliIds: [tavolo],
  });
  nati.prenotazioni.push(esito?.reservation_id ?? esito?.id);
  return esito?.reservation_id ?? esito?.id;
}

/** Il ritardo com'è calcolato dalle due schermate, sui dati veri di stasera. */
async function ritardoVero({ minutiDopoLOra, tolleranza, oraFineSerata }) {
  const turni = await getTurniDelGiorno(GIORNO);
  const conti = await listContiPerPrenotazioni([...new Set(turni.map((t) => t.reservation_id))]);
  const istante = istanteDellaSerata(GIORNO, ORA, oraFineSerata);
  return ritardiDellaSerata({
    prenotazioni: turni,
    conti,
    adesso: new Date(istante.getTime() + minutiDopoLOra * 60000),
    minutiTolleranza: tolleranza,
    serata: GIORNO,
    oraFineSerata,
  });
}

beforeAll(async () => {
  titolare = await clientAutenticato(credenziali().titolare);
  // ⚠️ Il singolo client dell'app entra come STAFF: è quello che usano le
  // funzioni di `api/`, cioè la strada che percorre chi sta in sala.
  const { error } = await supabase.auth.signInWithPassword(credenziali().staff);
  if (error) throw new Error(`Non riesco a entrare come staff: ${error.message}`);
  sagome = await sagomeDiProva(titolare, 1);
  tavolo = sagome.ids[0];
  await pulisci();
});

afterAll(async () => {
  await pulisci();
  await sagome?.pulisci();
  await supabase.auth.signOut({ scope: "local" });
  await titolare?.auth.signOut({ scope: "local" });
});

describe("Il ritardo, dai dati veri", () => {
  it("gli stati del conto che il database ammette sono quelli che il ritardo classifica", async () => {
    // ⚠️ LA PROVA CHE DIVENTA ROSSA DA SOLA. L'elenco `order_status` lo
    // legge il database (`vocabolari_chiusi()`, la rete del 17/08), non
    // questo file: il giorno che qualcuno aggiungesse uno stato nuovo,
    // `contoProvaArrivo()` risponderebbe «sì» per impostazione — che è la
    // direzione scelta, ma va scelta da qualcuno, non subita in silenzio.
    const { data, error } = await titolare.rpc("vocabolari_chiusi");
    if (error) throw new Error(`Gli elenchi non arrivano dal database: ${error.message}`);
    const stati = data.find((v) => v.tabella === "orders" && v.colonna === "status");
    expect(stati, "orders.status non compare fra i vocabolari chiusi").toBeTruthy();
    expect([...stati.valori].sort()).toEqual(Object.keys(ARRIVO_PER_STATO).sort());
  });

  it("i minuti di tolleranza arrivano alla sala E al calendario, dallo stesso posto", async () => {
    // ⚠️ Fino a questo giro la colonna esisteva e NESSUNO la leggeva. Se una
    // delle due `select` la perdesse, la tolleranza diventerebbe zero e ogni
    // tavolo si sbarrerebbe all'ora esatta: un allarme che grida sempre.
    const sala = await getServiceSettings();
    const calendario = await getRegolePrenotazione();
    expect(sala.minuti_tolleranza_ritardo).toBeTypeOf("number");
    expect(sala.minuti_tolleranza_ritardo).toBeGreaterThan(0);
    expect(calendario.minuti_tolleranza_ritardo).toBe(sala.minuti_tolleranza_ritardo);
    expect(sala.ora_fine_serata).toBeTruthy();
  });

  it("una prenotazione senza conto si sbarra dopo la tolleranza, e non un minuto prima", async () => {
    await prenota("PROVA ritardo");
    const { ora_fine_serata } = await getServiceSettings();

    // La coppia che misura la differenza: stessi dati, due istanti.
    const prima = await ritardoVero({ minutiDopoLOra: 30, tolleranza: 30, oraFineSerata: ora_fine_serata });
    const dopo = await ritardoVero({ minutiDopoLOra: 31, tolleranza: 30, oraFineSerata: ora_fine_serata });
    expect(prima.tavoli.has(tavolo)).toBe(false);
    expect(dopo.tavoli.has(tavolo)).toBe(true);
    await pulisci();
  });

  it("aprire il conto lo spegne — e ANNULLARLO lo riaccende", async () => {
    // ⚠️ È il caso vero misurato in produzione il 18/08: su T3 il conto è
    // nato agganciato alla prenotazione delle 20:00 ed è stato annullato un
    // minuto dopo. Un conto annullato non esiste per nessun altro conteggio
    // del gestionale, e non può valere come prova che qualcuno è seduto lì.
    //
    // ⚠️ E le due metà sono discriminanti solo insieme: senza la seconda,
    // una regola che ignorasse del tutto lo stato del conto passerebbe.
    await prenota("PROVA ritardo");
    const { ora_fine_serata } = await getServiceSettings();
    const tardi = { minutiDopoLOra: 60, tolleranza: 30, oraFineSerata: ora_fine_serata };

    expect((await ritardoVero(tardi)).tavoli.has(tavolo)).toBe(true);

    const orderId = await apriConto([tavolo], { serata: GIORNO });
    nati.ordini.push(orderId);
    // 🔴 È LA PROVA CHE HA TROVATO IL DIFETTO. Fin qui il calcolo cercava le
    // prenotazioni arrivate con un nome di campo sbagliato (`id` invece di
    // `reservation_id`): non ne trovava mai nessuna, e il tavolo restava
    // sbarrato col conto aperto davanti. La prova pura non poteva vederlo —
    // i dati se li inventa, e li inventava della forma che il codice si
    // aspettava.
    expect((await ritardoVero(tardi)).tavoli.has(tavolo)).toBe(false);

    await cancelOrder(orderId, "PROVA ritardo — annullato apposta");
    expect((await ritardoVero(tardi)).tavoli.has(tavolo)).toBe(true);
    await pulisci();
  });

  it("lo STAFF vede chi ha prenotato e il legame col conto — senza, la sala resta bianca", async () => {
    // ⚠️ Il difetto che solo una prova dal client può prendere: una regola di
    // permessi che vieta allo staff di leggere le prenotazioni non fa
    // fallire niente — fa comparire una sala vuota, che è indistinguibile da
    // «stasera non ha prenotato nessuno». È la lezione del 16/08 sul
    // «pronta per carta», dove il difetto è vissuto sedici giorni.
    const rid = await prenota("PROVA ritardo");

    // Le due letture che la sala fa davvero: i nomi dalle prenotazioni…
    const prenotazioni = await listReservations({ date: GIORNO });
    const mia = prenotazioni.find((p) => p.id === rid);
    expect(mia?.customer_name).toBe("PROVA ritardo");
    expect(mia?.status).toBe("confermata");

    // …e i tavoli dai turni, che è anche il modo in cui una confermata senza
    // tavolo resta visibile invece di sparire.
    const turni = await getTurniDelGiorno(GIORNO);
    expect(turni.find((t) => t.reservation_id === rid)?.tavoli).toContain(tavolo);

    const orderId = await apriConto([tavolo], { serata: GIORNO });
    nati.ordini.push(orderId);
    const conti = await listContiPerPrenotazioni([rid]);
    expect(conti.map((c) => c.id)).toContain(orderId);
    expect(conti.find((c) => c.id === orderId).status).toBe("aperto");
    await pulisci();
  });
});
