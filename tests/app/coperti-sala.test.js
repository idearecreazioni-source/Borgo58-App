import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import {
  getCopertiDelGiorno,
  getPostoPerLaSerata,
  rimuoviCorrezioneCoperti,
  salvaCorrezioneCoperti,
} from "../../src/lib/api/sala";

// I COPERTI DENTRO IL TAVOLO — la prova che misura una DIFFERENZA.
//
// ⚠️ Perché non basta «25 coperti su una sala ferma»: un accostamento
// ABBASSA il totale (due tavoli da 4 accostati fanno 6, non 8), quindi la
// capienza di una serata non è una costante — dipende dalla disposizione
// di quel giorno. Una prova che guardasse un totale solo passerebbe anche
// con un conteggio che ignora le giunzioni del tutto.
//
// Tre versi, e sono discriminanti SOLO INSIEME:
//   1. stessa sera, stesse prenotazioni, due disposizioni → due totali;
//   2. la correzione a mano SOPRAVVIVE a un ricalcolo che non cambia
//      l'insieme;
//   3. e DECADE quando l'insieme cambia.
// Una correzione che decadesse sempre passerebbe il terzo e fallirebbe il
// secondo; una che non decadesse mai, il contrario.
//
// ⚠️ E si esercitano ENTRAMBI i formati: una regola scritta solo per i
// quadrati passerebbe una prova costruita solo sui quadrati.
//
// ⚠️ Perché dal client e non solo dentro la migrazione: una verifica in
// migrazione gira come proprietaria del database e SCAVALCA la RLS —
// il 16/08 è così che un difetto di permessi è vissuto sedici giorni
// senza che nessuna verifica potesse accorgersene. Qui si chiama col
// token di un utente vero, attraverso le stesse funzioni dell'app.

const GIORNO = "1994-03-11"; // il locale apre nel 2027: un giorno passato non è una serata vera
const NOME = "PROVA AUTOMATICA coperti";

let titolare;
let quadrati = [];
let lunghi = [];
let baseQ = 0;
let baseL = 0;

// Mette i tavoli dove diciamo noi, solo per quel giorno. Scrive lo
// scostamento, mai la pianta base: la sala di Alessio non si tocca.
async function metti(posizioni) {
  const righe = posizioni.map(([id, x, y]) => ({
    data: GIORNO,
    dining_table_id: id,
    x,
    y,
    ruotato: false,
    aggiornato_il: new Date().toISOString(),
  }));
  const { error } = await titolare
    .from("disposizioni_giornaliere")
    .upsert(righe, { onConflict: "data,dining_table_id" });
  if (error) throw new Error(error.message);
}

// Il gruppo che contiene un certo tavolo.
const gruppoDi = (gruppi, id) => gruppi.find((g) => (g.tavoli ?? []).includes(id));

async function pulisci() {
  await titolare.from("reservations").delete().eq("reservation_date", GIORNO);
  await titolare.from("correzioni_coperti").delete().eq("data", GIORNO);
  await titolare.from("disposizioni_giornaliere").delete().eq("data", GIORNO);
}

beforeAll(async () => {
  // ⚠️ SI ENTRA SUL COLLEGAMENTO DELL'APP, non su un client a parte. Le
  // funzioni di `src/lib/api/sala.js` usano quello: con un client
  // separato la prova eserciterebbe il database ma non il tratto fra
  // schermata e database — cioè proprio il pezzo dove il 16/08 si è perso
  // il `mezzo` delle mance. Provato: con un client a parte queste sei
  // prove rispondono «permission denied», perché l'app parlava da
  // anonima.
  const { error: eLogin } = await supabase.auth.signInWithPassword(credenziali().titolare);
  if (eLogin) throw new Error(`Non riesco a entrare come titolare: ${eLogin.message}`);
  titolare = supabase;

  const { data: formati, error: eF } = await titolare
    .from("formati_tavolo")
    .select("id, nome, coperti_base");
  if (eF) throw new Error(eF.message);
  const fq = formati.find((f) => f.nome === "Quadrato 90x90");
  const fl = formati.find((f) => f.nome === "Rettangolare 180x90");
  baseQ = fq.coperti_base;
  baseL = fl.coperti_base;

  const { data: tavoli, error: eT } = await titolare
    .from("dining_tables")
    .select("id, label, formato_id")
    .eq("tipo", "tavolo")
    .eq("active", true)
    .order("label");
  if (eT) throw new Error(eT.message);

  quadrati = tavoli.filter((t) => t.formato_id === fq.id);
  lunghi = tavoli.filter((t) => t.formato_id === fl.id);

  // ⚠️ Condizione dichiarata invece che dedotta: se la sala non ha di che
  // reggere la prova, si dice — non si salta in silenzio. È il modo in cui
  // una verifica smette di verificare senza che nessuno se ne accorga.
  if (quadrati.length < 3 || lunghi.length < 2) {
    throw new Error(
      `Servono almeno 3 tavoli quadrati e 2 rettangolari, ce ne sono ${quadrati.length} e ${lunghi.length}.`
    );
  }

  await pulisci();
});

afterAll(async () => {
  if (!titolare) return;
  await pulisci();
  await titolare.auth.signOut({ scope: "local" });
});

describe("I coperti dentro il tavolo", () => {
  it("1 · stessa sera, stesse prenotazioni, due disposizioni: due totali", async () => {
    // Le prenotazioni restano IDENTICHE fra le due misure: se cambiassero
    // anche loro, la differenza non direbbe più da dove viene.
    const { error } = await titolare.from("reservations").insert({
      type: "prenotazione",
      status: "confermata",
      source: "interno",
      reservation_date: GIORNO,
      reservation_time: "20:00",
      party_size: 4,
      customer_name: NOME,
    });
    expect(error).toBeNull();

    // --- Disposizione A: tutti distanti ---
    const tutti = [...quadrati, ...lunghi];
    await metti(tutti.map((t, i) => [t.id, i * 400, 0]));

    const a = await getPostoPerLaSerata(GIORNO);
    const gruppiA = await getCopertiDelGiorno(GIORNO);
    expect(gruppiA.every((g) => g.giunzioni === 0)).toBe(true);
    expect(a.prenotati).toBe(4);

    // --- Disposizione B: tre quadrati in fila, i due lunghi accostati ---
    await metti([
      [quadrati[0].id, 0, 0],
      [quadrati[1].id, 90, 0],
      [quadrati[2].id, 180, 0],
      [lunghi[0].id, 0, 300],
      [lunghi[1].id, 180, 300],
    ]);

    const b = await getPostoPerLaSerata(GIORNO);

    // Tre giunzioni in più devono togliere esattamente sei coperti. È la
    // DIFFERENZA a essere la prova, non il numero.
    expect(b.capienza).toBe(a.capienza - 6);
    expect(b.prenotati).toBe(a.prenotati);
    expect(b.restanti).toBe(a.restanti - 6);

    const gruppiB = await getCopertiDelGiorno(GIORNO);
    const fila = gruppoDi(gruppiB, quadrati[0].id);
    expect(fila.tavoli).toHaveLength(3);
    expect(fila.giunzioni).toBe(2);
    expect(fila.coperti_calcolati).toBe(3 * baseQ - 4);

    const tavolone = gruppoDi(gruppiB, lunghi[0].id);
    expect(tavolone.tavoli).toHaveLength(2);
    expect(tavolone.giunzioni).toBe(1);
    expect(tavolone.coperti_calcolati).toBe(2 * baseL - 2);
  });

  it("2 · i due formati non si accostano fra loro, nemmeno toccandosi", async () => {
    // Un quadrato e un lungo appiccicati restano due cose: la regola è
    // lo STILE del mobile, non la geometria.
    //
    // ⚠️ Due chiamate e non una: un upsert che nomina lo stesso id due
    // volte non è «l'ultimo vince», è un errore di Postgres.
    // ⚠️ x e y stanno fra 0 e 5000 per vincolo: sparpagliare troppo non è
    // «più sicuro», è un salvataggio che fallisce.
    await metti([...quadrati, ...lunghi].map((t, i) => [t.id, 2000 + i * 300, 2000]));
    await metti([
      [quadrati[0].id, 0, 1000],
      [lunghi[0].id, 90, 1000],
    ]);

    const gruppi = await getCopertiDelGiorno(GIORNO);
    expect(gruppoDi(gruppi, quadrati[0].id).tavoli).toHaveLength(1);
    expect(gruppoDi(gruppi, quadrati[0].id).coperti).toBe(baseQ);
    expect(gruppoDi(gruppi, lunghi[0].id).tavoli).toHaveLength(1);
    expect(gruppoDi(gruppi, lunghi[0].id).coperti).toBe(baseL);
  });

  it("3 · la correzione a mano sopravvive a un ricalcolo che non cambia l'insieme", async () => {
    await metti([
      [quadrati[0].id, 0, 0],
      [quadrati[1].id, 90, 0],
      [quadrati[2].id, 900, 0],
      [lunghi[0].id, 0, 300],
      [lunghi[1].id, 180, 300],
    ]);

    let gruppi = await getCopertiDelGiorno(GIORNO);
    const coppiaQ = gruppoDi(gruppi, quadrati[0].id);
    const coppiaL = gruppoDi(gruppi, lunghi[0].id);

    // Su tutti e due i formati.
    await salvaCorrezioneCoperti({
      data: GIORNO,
      tavoli: coppiaQ.tavoli,
      coperti: 5,
      ragione: "uno contro il muro",
    });
    await salvaCorrezioneCoperti({ data: GIORNO, tavoli: coppiaL.tavoli, coperti: 11 });

    gruppi = await getCopertiDelGiorno(GIORNO);
    expect(gruppoDi(gruppi, quadrati[0].id).coperti).toBe(5);
    expect(gruppoDi(gruppi, quadrati[0].id).corretto).toBe(true);
    // ⚠️ Il numero calcolato non sparisce: resta accanto, o in sala non si
    // saprebbe quale dei due si sta guardando.
    expect(gruppoDi(gruppi, quadrati[0].id).coperti_calcolati).toBe(2 * baseQ - 2);
    expect(gruppoDi(gruppi, quadrati[0].id).ragione).toBe("uno contro il muro");
    // ⚠️ Chi e quando: una correzione senza autore è un numero che nessuno
    // può spiegare tre giorni dopo. Lo scrive il database, non la
    // schermata — quindi qui si controlla che sia arrivato davvero.
    expect(gruppoDi(gruppi, quadrati[0].id).corretto_da_me).toBe(true);
    expect(gruppoDi(gruppi, quadrati[0].id).corretto_il).toBeTruthy();
    expect(gruppoDi(gruppi, lunghi[0].id).coperti).toBe(11);

    // Il tavolone si sposta INTERO: stesso insieme, geometria ricalcolata
    // da capo. Il numero scritto a mano deve restare.
    await metti([
      [lunghi[0].id, 40, 300],
      [lunghi[1].id, 220, 300],
    ]);
    gruppi = await getCopertiDelGiorno(GIORNO);
    expect(gruppoDi(gruppi, lunghi[0].id).coperti).toBe(11);
    expect(gruppoDi(gruppi, lunghi[0].id).corretto).toBe(true);
  });

  it("4 · e decade quando l'insieme cambia — l'altro formato non si tocca", async () => {
    // Si scioglie il tavolone dei lunghi: quel numero si riferiva a quei
    // due messi così, e adesso non descrive più niente.
    await metti([[lunghi[1].id, 2500, 2500]]);

    const gruppi = await getCopertiDelGiorno(GIORNO);
    const solo = gruppoDi(gruppi, lunghi[0].id);
    expect(solo.tavoli).toHaveLength(1);
    expect(solo.corretto).toBe(false);
    expect(solo.coperti).toBe(baseL);

    // La correzione dei quadrati, il cui insieme NON è cambiato, è ancora
    // lì: sciogliere un tavolone non ne cancella un altro.
    expect(gruppoDi(gruppi, quadrati[0].id).coperti).toBe(5);
    expect(gruppoDi(gruppi, quadrati[0].id).corretto).toBe(true);
  });

  it("5 · «torna al calcolato» toglie la correzione", async () => {
    let gruppi = await getCopertiDelGiorno(GIORNO);
    const coppiaQ = gruppoDi(gruppi, quadrati[0].id);
    expect(coppiaQ.corretto).toBe(true);

    await rimuoviCorrezioneCoperti({ data: GIORNO, tavoli: coppiaQ.tavoli });

    gruppi = await getCopertiDelGiorno(GIORNO);
    expect(gruppoDi(gruppi, quadrati[0].id).corretto).toBe(false);
    expect(gruppoDi(gruppi, quadrati[0].id).coperti).toBe(2 * baseQ - 2);
  });

  it("6 · «c'è posto?» avvisa e non impedisce, e dichiara chi resta fuori", async () => {
    const posto = await getPostoPerLaSerata(GIORNO);

    // ⚠️ La soglia si prova FACENDOLA SCATTARE nei due versi, non
    // confrontandola con se stessa: `oltre_soglia === prenotati >= soglia`
    // sarebbe vero anche se la soglia non fosse mai letta da nessuna
    // impostazione. E il valore di Alessio si rimette a posto — non si
    // cancella, si riscrive quello che c'era (lezione del 14/08).
    const { data: prima } = await titolare
      .from("service_settings")
      .select("soglia_coperti_serata")
      .eq("id", 1)
      .single();
    const originale = prima.soglia_coperti_serata;
    try {
      await titolare.from("service_settings").update({ soglia_coperti_serata: 1 }).eq("id", 1);
      expect((await getPostoPerLaSerata(GIORNO)).oltre_soglia).toBe(true);

      await titolare.from("service_settings").update({ soglia_coperti_serata: 500 }).eq("id", 1);
      expect((await getPostoPerLaSerata(GIORNO)).oltre_soglia).toBe(false);
    } finally {
      await titolare
        .from("service_settings")
        .update({ soglia_coperti_serata: originale })
        .eq("id", 1);
    }
    const { data: dopoRipristino } = await titolare
      .from("service_settings")
      .select("soglia_coperti_serata")
      .eq("id", 1)
      .single();
    expect(dopoRipristino.soglia_coperti_serata).toBe(originale);

    // ⚠️ Divani e Chef Table non sono contati, ed è dichiarato: sono
    // un'altra formula, non una dimenticanza.
    expect(posto.avvertenza).toContain("divani e Chef Table");
    // ⚠️ Il limite misurato del 18/08: su una serata passata la capienza è
    // ricalcolata coi formati di OGGI, non è una fotografia di allora.
    expect(posto.avvertenza).toContain("Serata passata");

    // Le richieste in attesa non si sommano ai confermati (14/08: una
    // richiesta in attesa non tiene niente) ma si dichiarano.
    const { error } = await titolare.from("reservations").insert({
      type: "prenotazione",
      status: "richiesta_in_attesa",
      source: "interno",
      reservation_date: GIORNO,
      reservation_time: "21:00",
      party_size: 3,
      customer_name: NOME,
    });
    expect(error).toBeNull();

    const dopo = await getPostoPerLaSerata(GIORNO);
    expect(dopo.prenotati).toBe(posto.prenotati);
    expect(dopo.in_attesa).toBe(3);
    expect(dopo.restanti).toBe(posto.restanti);
    expect(dopo.avvertenza).toContain("da confermare");
  });
});
