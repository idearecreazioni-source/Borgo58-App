import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, spiega } from "./aiuto";

// =====================================================================
// «OGNI N GIORNI/SETTIMANE/MESI/ANNI» — contro il database vero
// =====================================================================
// 10/09/2026, Blocco 2A del mandato notturno.
//
// 🔴 SI ENTRA DALLA PORTA DELL'APP, col collegamento di un utente vero.
//    `completa_task` è `security definer` con un portiere dentro, e una
//    migrazione gira come proprietaria del database: lì il portiere è
//    sempre soddisfatto e non prova niente (regola del 16/08). Quello che
//    solo questa prova può dire è che la funzione **risponde a chi la
//    chiama davvero dal gestionale**.
//
// 🔴 E IL NUMERO DELLE UNITÀ NON È DI COMODO: le quattro cadenze partono
//    tutte dallo stesso giorno con numeri diversi apposta, così le quattro
//    risposte sono **diverse fra loro**. Con «ogni 1» su tutte, scambiare
//    giorni e settimane darebbe due date vicine e la prova sarebbe verde
//    senza aver misurato niente (regola del 19/08).

const NOME = marchio("TEST-AUTO ricorrenza");
const PARTENZA = "2026-03-01";

// partenza 01/03/2026 → +10 giorni, +2 settimane, +3 mesi, +1 anno
const CADENZE = [
  { ogni: 10, unita: "giorni", attesa: "2026-03-11" },
  { ogni: 2, unita: "settimane", attesa: "2026-03-15" },
  { ogni: 3, unita: "mesi", attesa: "2026-06-01" },
  { ogni: 1, unita: "anni", attesa: "2027-03-01" },
];

describe("un impegno che si ripete ogni N giorni, settimane, mesi o anni", () => {
  let titolare;
  const miei = [];

  /** Un impegno di questa prova: riconoscibile, e mio. */
  async function impegno(coda, extra = {}) {
    const { data, error } = await titolare
      .from("tasks")
      .insert({
        title: `${NOME} ${coda}`,
        status: "da_fare",
        category: "altro",
        due_date: PARTENZA,
        ...extra,
      })
      .select("id, title, due_date, ricorrenza_ogni, ricorrenza_unita")
      .single();
    if (error) throw new Error(`non riesco a creare l'impegno: ${error.message}`);
    miei.push(data.id);
    return data;
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    // ⚠️ Anche i figli nati dalla chiusura: sono righe che questa prova ha
    //    fatto nascere, e nessuno le ha passate da `impegno()`.
    const { data: nati } = await titolare.from("tasks").select("id").like("title", `${NOME}%`);
    for (const t of nati ?? []) if (!miei.includes(t.id)) miei.push(t.id);
    if (miei.length) await titolare.from("tasks").delete().in("id", miei);
    await titolare.auth.signOut({ scope: "local" });
  });

  it("le quattro unità contano la prossima scadenza, e sono quattro risposte diverse", async () => {
    const viste = [];
    for (const c of CADENZE) {
      const t = await impegno(`${c.ogni} ${c.unita}`, {
        ricorrenza_ogni: c.ogni,
        ricorrenza_unita: c.unita,
      });
      const { data: nuovoId, error } = await titolare.rpc("completa_task", { p_id: t.id });
      expect(error, `chiudere «ogni ${c.ogni} ${c.unita}» non riesce`).toBeNull();
      expect(nuovoId, `chiudere «ogni ${c.ogni} ${c.unita}» non ha generato il prossimo`).toBeTruthy();
      miei.push(nuovoId);

      const { data: nuovo } = await titolare
        .from("tasks")
        .select("due_date, status, ricorrenza_ogni, ricorrenza_unita, generato_da")
        .eq("id", nuovoId)
        .single();
      expect(nuovo.due_date, `«ogni ${c.ogni} ${c.unita}» dal ${PARTENZA}`).toBe(c.attesa);
      expect(nuovo.status).toBe("da_fare");
      expect(nuovo.generato_da).toBe(t.id);
      // La cadenza si eredita, o il secondo giro non nasce mai.
      expect(nuovo.ricorrenza_ogni).toBe(c.ogni);
      expect(nuovo.ricorrenza_unita).toBe(c.unita);
      viste.push(nuovo.due_date);
    }
    // 🔴 Le quattro date sono tutte diverse: è la condizione che rende
    //    questa prova capace di distinguere uno scambio fra unità.
    expect(new Set(viste).size).toBe(4);
  });

  it("un impegno che non si ripete non ne genera nessun altro", async () => {
    const t = await impegno("una volta sola");
    const { data: nuovoId, error } = await titolare.rpc("completa_task", { p_id: t.id });
    expect(error).toBeNull();
    expect(nuovoId, "un impegno che non si ripete ne ha generato un altro").toBeNull();
  });

  it("🔴 la scadenza si conta dalla SUA data, non da oggi", async () => {
    // Un adempimento annuale chiuso in ritardo torna alla sua data: se si
    // contasse da oggi, ogni ritardo si porterebbe dietro la scadenza per
    // sempre, e dopo tre anni l'adempimento di marzo cadrebbe a novembre.
    const t = await impegno("chiuso in ritardo", { ricorrenza_ogni: 1, ricorrenza_unita: "anni" });
    const { data: nuovoId } = await titolare.rpc("completa_task", { p_id: t.id });
    miei.push(nuovoId);
    const { data: nuovo } = await titolare.from("tasks").select("due_date").eq("id", nuovoId).single();
    expect(nuovo.due_date).toBe("2027-03-01");
  });

  it("🔴 mezza cadenza il database la rifiuta, e lo dice in italiano", async () => {
    // ⚠️ Il rifiuto si prova dal collegamento DELL'APP: la frase italiana
    //    vive in `src/lib/supabase.js`, e con un client suo il rifiuto
    //    arriverebbe in inglese (lezione del 25/08).
    const soloNumero = await titolare
      .from("tasks")
      .insert({ title: `${NOME} meta A`, status: "da_fare", category: "altro", ricorrenza_ogni: 3 })
      .select("id");
    expect(soloNumero.error, "un numero senza unità è stato accettato").not.toBeNull();
    if (soloNumero.data?.[0]?.id) miei.push(soloNumero.data[0].id);

    const soloUnita = await titolare
      .from("tasks")
      .insert({
        title: `${NOME} meta B`,
        status: "da_fare",
        category: "altro",
        ricorrenza_unita: "mesi",
      })
      .select("id");
    expect(soloUnita.error, "un'unità senza numero è stata accettata").not.toBeNull();
    if (soloUnita.data?.[0]?.id) miei.push(soloUnita.data[0].id);
  });

  it("«ogni 0» e un'unità che nessuno sa contare vengono respinte", async () => {
    const zero = await titolare.from("tasks").insert({
      title: `${NOME} zero`,
      status: "da_fare",
      category: "altro",
      ricorrenza_ogni: 0,
      ricorrenza_unita: "giorni",
    });
    expect(zero.error, `«ogni 0 giorni» è stato accettato — ${spiega(zero)}`).not.toBeNull();

    const parola = await titolare.from("tasks").insert({
      title: `${NOME} parola`,
      status: "da_fare",
      category: "altro",
      ricorrenza_ogni: 2,
      ricorrenza_unita: "lune piene",
    });
    expect(parola.error, "un'unità inventata è stata accettata").not.toBeNull();
  });

  it("⚠️ e una cadenza insolita ma legittima passa", async () => {
    // 🔴 Un limite che rifiuta anche i casi buoni è peggio di nessun limite
    //    (regola del 24/08). «Ogni 90 giorni» è il sanificatore della
    //    cappa; «ogni 5 anni» la revisione di un impianto.
    const a = await impegno("novanta giorni", { ricorrenza_ogni: 90, ricorrenza_unita: "giorni" });
    expect(a.ricorrenza_ogni).toBe(90);
    const b = await impegno("cinque anni", { ricorrenza_ogni: 5, ricorrenza_unita: "anni" });
    expect(b.ricorrenza_ogni).toBe(5);
  });

  it("le due letture dell'Agenda portano la cadenza, non una parola sola", async () => {
    const t = await impegno("nella corsia", { ricorrenza_ogni: 6, ricorrenza_unita: "settimane" });
    const corsie = await titolare.rpc("agenda_corsie");
    expect(corsie.error, `agenda_corsie non risponde — ${spiega(corsie)}`).toBeNull();
    const riga = corsie.data.find((r) => r.id === t.id);
    expect(riga, "l'impegno non compare fra le corsie").toBeTruthy();
    expect(riga.ricorrenza_ogni).toBe(6);
    expect(riga.ricorrenza_unita).toBe("settimane");
    // 🔴 E la parola vecchia non deve tornare: se qualcuno rimettesse
    //    `ricorrenza` accanto ai due dati, il gestionale avrebbe di nuovo
    //    due posti che dicono ogni quanto si ripete lo stesso impegno.
    expect(Object.keys(riga)).not.toContain("ricorrenza");

    const { data: nuovoId } = await titolare.rpc("completa_task", { p_id: t.id });
    miei.push(nuovoId);
    const fatti = await titolare.rpc("agenda_fatti", { p_giorni: 30 });
    expect(fatti.error, `agenda_fatti non risponde — ${spiega(fatti)}`).toBeNull();
    const chiuso = fatti.data.find((r) => r.id === t.id);
    expect(chiuso, "l'impegno chiuso non compare fra i fatti").toBeTruthy();
    expect(chiuso.ricorrenza_ogni).toBe(6);
    expect(chiuso.ricorrenza_unita).toBe("settimane");
  });

  it("🔴 la colonna vecchia non esiste più: non è vuota, non c'è", async () => {
    // Una colonna spenta, fra sei mesi, qualcuno la riaccende credendo di
    // riparare qualcosa — e da quel momento due posti direbbero ogni
    // quanto si ripete lo stesso impegno.
    const r = await titolare.from("tasks").select("ricorrenza").limit(1);
    expect(r.error, "la colonna «ricorrenza» risponde ancora").not.toBeNull();
  });
});
