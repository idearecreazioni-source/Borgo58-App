import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { getTurniDelGiorno } from "../../src/lib/api/sala";
import { creaPrenotazioneSuTavoli } from "../../src/lib/api/reservations";

// LE TRE FASCE E «DA LIBERARE ENTRO LE…» — giro C.
//
// ⚠️ Si entra sul collegamento dell'APP, non su un client a parte: è la
// lezione del giro B, dove sei prove rispondevano «permission denied»
// perché l'app parlava da anonima.
//
// I versi che devono valere insieme:
//   1. le fasce si leggono sugli orari DI QUEL SERVIZIO — provato anche su
//      un PRANZO, non solo su una cena: con un'ora unica del locale ogni
//      pranzo risulterebbe «primo giro»;
//   2. la nota c'è dove c'è un turno dopo, e SOLO lì;
//   3. la nota SEGUE la seconda prenotazione se si sposta;
//   4. e SPARISCE se la seconda viene annullata — una nota che sopravvive
//      alla propria causa è come una che non segue lo spostamento.

// ⚠️ Le date sono nel FUTURO, e non è una scelta di comodo: una
// prenotazione è per il futuro, e la funzione vera dell'app rifiuta una
// data passata («Quella data è già passata») — cosa che si scopre solo
// passando dalla sua porta. Si prendono il primo mercoledì e la prima
// domenica ad almeno tre settimane da oggi, e il perimetro si verifica
// libero prima di cominciare.
function prossimo(giornoSettimana, minimoGiorni = 21) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + minimoGiorni);
  while (d.getDay() !== giornoSettimana) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CENA = prossimo(3); // mercoledì
const PRANZO = prossimo(0); // domenica
const NOME = "PROVA AUTOMATICA turni";

let titolare;
let t1;
let t2;
let orariPrima = [];

// ⚠️ Si prenota con la FUNZIONE VERA dell'app, non scrivendo nelle
// tabelle: `prenotazione_tavoli` è chiusa in scrittura diretta dalla RLS,
// e scoprirlo qui è il segno che la prova sta passando dalla stessa porta
// della schermata. La prenotazione presa dalla pianta nasce confermata e
// senza email, per decisione di Alessio del 14/08.
async function prenota(data, ora, tavolo) {
  return creaPrenotazioneSuTavoli({
    data,
    ora,
    persone: 2,
    nome: NOME,
    telefono: null,
    email: null,
    note: null,
    tavoliIds: [tavolo],
  });
}

const turnoDi = (turni, id) => turni.find((t) => t.reservation_id === id);
const alleOre = (turni, ora) => turni.find((t) => t.ora.startsWith(ora));

async function pulisci() {
  await titolare.from("reservations").delete().eq("customer_name", NOME);
}

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
  if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
  titolare = supabase;

  const { data: tavoli } = await titolare
    .from("dining_tables")
    .select("id")
    .eq("tipo", "tavolo")
    .eq("active", true)
    .order("label")
    .limit(2);
  t1 = tavoli[0].id;
  t2 = tavoli[1].id;

  // ⚠️ Gli orari sono dati di Alessio, e sul progetto di prova non c'è
  // nessun servizio attivo. La prova si costruisce il proprio perimetro e
  // alla fine rimette quello che c'era — non «quello giusto».
  const { data: righe } = await titolare
    .from("service_hours")
    .select("id, weekday, servizio, attivo, apertura, ultimo_ingresso, ora_primo_turno, ora_ultimi_arrivi")
    .in("weekday", [3, 0]);
  orariPrima = righe;

  for (const r of righe) {
    if (r.weekday === 3 && r.servizio === "cena") {
      // ⚠️ La prova dichiara il proprio orario PER INTERO invece di
      // ereditarne metà: sono gli orari veri di Alessio (cena 20:00 →
      // 22:30, primo giro alle 20:00, ultimi arrivi dalle 22:00), e
      // scriverli qui rende la prova indipendente da cosa ha lasciato
      // l'ultima migrazione.
      await titolare
        .from("service_hours")
        .update({
          attivo: true,
          apertura: "20:00",
          ultimo_ingresso: "22:30",
          ora_primo_turno: "20:00",
          ora_ultimi_arrivi: "22:00",
        })
        .eq("id", r.id);
    }
    if (r.weekday === 0 && r.servizio === "pranzo") {
      // ⚠️ Il pranzo resta SENZA ora del primo giro: è lo stato voluto —
      // nessuno l'ha decisa, e quel servizio ha due fasce invece di tre.
      await titolare
        .from("service_hours")
        .update({
          attivo: true,
          apertura: "12:30",
          ultimo_ingresso: "14:00",
          ora_primo_turno: null,
          ora_ultimi_arrivi: null,
        })
        .eq("id", r.id);
    }
  }

  await pulisci();

  // Il perimetro dev'essere vuoto: la prova non gira su roba di qualcun altro.
  const { count } = await titolare
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .in("reservation_date", [CENA, PRANZO]);
  if (count) {
    throw new Error(`Le date di prova (${CENA}, ${PRANZO}) hanno già ${count} prenotazioni.`);
  }
});

afterAll(async () => {
  if (!titolare) return;
  await pulisci();
  for (const r of orariPrima) {
    await titolare
      .from("service_hours")
      .update({
        attivo: r.attivo,
        apertura: r.apertura,
        ultimo_ingresso: r.ultimo_ingresso,
        ora_primo_turno: r.ora_primo_turno,
        ora_ultimi_arrivi: r.ora_ultimi_arrivi,
      })
      .eq("id", r.id);
  }
  await titolare.auth.signOut({ scope: "local" });
});

describe("Le fasce e il turno", () => {
  it("1 · a cena le fasce sono tre, e i confini sono gli orari di quel servizio", async () => {
    // ⚠️ Gli orari veri: il primo slot COINCIDE con l'ora del primo giro,
    // quindi il giallo vale per le 20:00 esatte e basta. E l'arancio
    // comincia alle 22:00, PRIMA dell'ultimo orario prenotabile (22:30).
    await prenota(CENA, "20:00", t1);
    await prenota(CENA, "21:00", t2);
    await prenota(CENA, "22:15", t1);

    const turni = await getTurniDelGiorno(CENA);
    expect(alleOre(turni, "20:00").fascia).toBe("presto");
    expect(alleOre(turni, "21:00").fascia).toBe("pieno");
    expect(alleOre(turni, "22:15").fascia).toBe("tardi");
    expect(alleOre(turni, "20:00").servizio).toBe("cena");
  });

  it("2 · la nota c'è dove c'è un turno dopo, e solo lì", async () => {
    const turni = await getTurniDelGiorno(CENA);
    const presto = turni.find((t) => t.ora.startsWith("20:00"));
    const pieno = turni.find((t) => t.ora.startsWith("21:00"));
    const tardi = turni.find((t) => t.ora.startsWith("22:15"));

    expect(presto.liberare_entro).toBeTruthy();
    // Il tavolo di mezzo non ha nessuno dopo: nessuna nota.
    expect(pieno.liberare_entro).toBeNull();
    // E l'ultimo turno di un tavolo non lo libera per nessuno.
    expect(tardi.liberare_entro).toBeNull();
  });

  it("3 · la nota segue la seconda prenotazione se si sposta", async () => {
    const prima = await getTurniDelGiorno(CENA);
    const tardi = prima.find((t) => t.ora.startsWith("22:15"));
    await titolare
      .from("reservations")
      .update({ reservation_time: "22:30" })
      .eq("id", tardi.reservation_id);

    const dopo = await getTurniDelGiorno(CENA);
    const presto = dopo.find((t) => t.ora.startsWith("20:00"));
    expect(presto.liberare_entro.startsWith("22:30")).toBe(true);
  });

  it("4 · e sparisce se la seconda viene annullata", async () => {
    const turni = await getTurniDelGiorno(CENA);
    const tardi = turni.find((t) => t.ora.startsWith("22:30"));
    // Annullata, non cancellata: è il gesto vero della sala.
    await titolare
      .from("reservations")
      .update({ status: "annullata" })
      .eq("id", tardi.reservation_id);

    const dopo = await getTurniDelGiorno(CENA);
    const presto = dopo.find((t) => t.ora.startsWith("20:00"));
    expect(presto.liberare_entro).toBeNull();
  });

  it("5 · a PRANZO le fasce si leggono sugli orari del pranzo, non della cena", async () => {
    // ⚠️ È il caso che con una sola ora del locale sarebbe stato sbagliato:
    // le 13:00 confrontate con un 20:00 buono per la cena risulterebbero
    // «primo giro», cioè «il tavolo può servire una seconda volta».
    await prenota(PRANZO, "13:00", t1);
    await prenota(PRANZO, "14:30", t2);

    const turni = await getTurniDelGiorno(PRANZO);
    expect(alleOre(turni, "13:00").servizio).toBe("pranzo");
    // Senza un'ora del primo giro quel servizio ha DUE fasce.
    expect(alleOre(turni, "13:00").fascia).toBe("pieno");
    expect(alleOre(turni, "14:30").fascia).toBe("tardi");
  });

  it("6 · le richieste non ancora confermate non entrano nei turni", async () => {
    const { data: r } = await titolare
      .from("reservations")
      .insert({
        type: "prenotazione",
        status: "richiesta_in_attesa",
        source: "interno",
        reservation_date: CENA,
        reservation_time: "21:00",
        party_size: 2,
        customer_name: NOME,
      })
      .select("id")
      .single();

    const turni = await getTurniDelGiorno(CENA);
    expect(turnoDi(turni, r.id)).toBeUndefined();
  });
});
