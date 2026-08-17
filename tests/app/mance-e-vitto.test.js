import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// Mance e vitto del personale (Blocco 5 del mandato).
//
// ⚠️ Le due cose che questo file esiste per tenere ferme:
// 1. **Le mance non sono ricavi**, sono un debito verso il personale — e
//    quelle in contanti stanno FISICAMENTE nel cassetto, quindi il saldo
//    le comprende e dichiara che non sono del locale. Senza, ogni
//    conteggio del cassetto avrebbe mostrato un'eccedenza cronica.
// 2. **Il vitto del personale ha un costo e non entra nel food cost dei
//    piatti venduti.** Prima del 16/08 uno scarico a mano non registrava
//    nemmeno il costo.
const MARCA = "TEST-AUTO mance";

describe("mance e vitto: niente delle due è un ricavo", () => {
  let titolare;
  let staff;
  let ente;

  async function pulisci() {
    await titolare.from("tips_collected").delete().eq("note", MARCA);
    const { data } = await titolare.from("tip_distributions").select("id").eq("note", MARCA);
    for (const d of data ?? []) {
      await titolare.from("tip_distribution_lines").delete().eq("distribution_id", d.id);
      await titolare.from("tip_distributions").delete().eq("id", d.id);
    }
  }

  // ⚠️ I totali di partenza si misurano PRIMA, e si confronta la
  // differenza. Fino al 17/08 questa prova pretendeva che i totali
  // valessero esattamente 40 e 60 — cioè dava per scontato che nel
  // database non ci fossero altre mance, e si è fatta rossa il giorno in
  // cui lo scenario del collaudo ne ha messe due.
  //
  // La prova era sbagliata, non lo scenario: quello che vuole dimostrare è
  // che «40 in contanti e 60 su carta finiscono nei posti giusti», e per
  // dimostrarlo serve la differenza che ha prodotto lei. Un totale
  // assoluto afferma anche «nessun altro ha dati», che non è cosa sua.
  let prima;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);
    await pulisci();

    const [monte, saldo, pos] = await Promise.all([
      titolare.rpc("mance_da_distribuire", { p_entity_id: ente }),
      titolare.rpc("saldo_tesoreria", { p_entity_id: ente }),
      titolare.rpc("pos_in_transito", { p_entity_id: ente }),
    ]);
    prima = {
      contanti: Number(monte.data[0].in_contanti),
      carta: Number(monte.data[0].su_carta),
      manceInCassa: Number(saldo.data[0].mance_in_cassa),
      nonTuo: Number(saldo.data[0].di_cui_non_tuo),
      posMance: Number(pos.data[0].mance),
    };
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("le mance si dividono per forma, e non sono ricavi", async () => {
    await titolare.from("tips_collected").insert([
      { entity_id: ente, amount: 40, collected_date: "2088-05-01", mezzo: "contanti", note: MARCA },
      { entity_id: ente, amount: 60, collected_date: "2088-05-01", mezzo: "carta", note: MARCA },
    ]);

    const { data } = await titolare.rpc("mance_da_distribuire", { p_entity_id: ente });
    expect(Number(data[0].in_contanti) - prima.contanti).toBe(40);
    expect(Number(data[0].su_carta) - prima.carta).toBe(60);
    expect(data[0].avvertenza).toContain("NON sono ricavi");
  });

  it("le mance in contanti stanno nel cassetto, e il saldo lo dichiara", async () => {
    const { data } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    // ⚠️ Sono nel teorico perché sono fisicamente lì: se non ci fossero,
    // ogni conteggio del cassetto mostrerebbe un'eccedenza cronica e la
    // differenza genererebbe un movimento per correggere un errore che non
    // esiste.
    expect(Number(data[0].mance_in_cassa) - prima.manceInCassa).toBe(40);
    expect(Number(data[0].di_cui_non_tuo) - prima.nonTuo).toBe(40);
    expect(data[0].avvertenza).toContain("non tuoi");
  });

  it("le mance su carta arrivano in banca insieme agli incassi", async () => {
    const { data } = await titolare.rpc("pos_in_transito", { p_entity_id: ente });
    expect(Number(data[0].mance) - prima.posMance).toBe(60);
    expect(data[0].avvertenza).toContain("non sono ricavi tuoi");
  });

  it("non si distribuiscono più mance di quelle che ci sono in quella forma", async () => {
    const { data: dip } = await titolare.from("employees").select("id").limit(1);
    if (!dip?.length) return;

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "create_tip_distribution",
        parametri: {
          p_entity_id: ente,
          p_period_month: "2088-05-01",
          p_lines: [{ employee_id: dip[0].id, amount: 999 }],
          p_note: MARCA,
          p_mezzo: "contanti",
        },
      },
    });
    // Il rifiuto arriva dal database: un debito non si paga due volte.
    expect(error).toBeTruthy();
  });

  it("lo staff non vede né le mance da distribuire né gli scarichi", async () => {
    for (const [fn, args] of [
      ["mance_da_distribuire", { p_entity_id: ente }],
      ["scarichi_senza_ricavo", { p_entity_id: ente, p_dal: null, p_al: null }],
    ]) {
      const { error } = await staff.rpc(fn, args);
      expect(error, `${fn} avrebbe dovuto rifiutare lo staff`).toBeTruthy();
    }
  });

  it("il vocabolario degli scarichi resta chiuso, anche scrivendo in tabella", async () => {
    const { data: ingr } = await titolare.from("ingredients").select("id").limit(1);
    if (!ingr?.length) return;

    // ⚠️ Il vincolo è sulla TABELLA, non solo nella funzione: vale anche
    // per chi scrive dritto dal browser.
    const { error } = await titolare.from("stock_consumptions").insert({
      ingredient_id: ingr[0].id,
      quantity: 1,
      reason: "pasto_gratis",
      note: MARCA,
    });
    expect(error).toBeTruthy();
  });
});
