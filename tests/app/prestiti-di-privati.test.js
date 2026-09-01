import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, marchio, primaEntita } from "./aiuto";

// I prestiti di privati (mandato del 22/08).
//
// Quattro cose che una verifica dentro la migrazione NON puo' dimostrare:
//
// 1. 🔴 **Trentamila euro in cassa non sono incassi.** E' la cosa che il
//    mandato chiedeva di misurare per prima, perche' se finissero fra i
//    ricavi salterebbero food cost e imposte proiettate. Qui si guarda dal
//    di fuori: il saldo sale, `declared_takings` non si muove di un
//    centesimo.
// 2. **Le due operazioni sono NELL'ELENCO del corridoio.** Un'operazione
//    che c'e' nel database ma manca dall'elenco risponde 404, e nessuna
//    prova SQL se ne accorge (lezione del 16/08).
// 3. **I prestiti sono del titolare**, e la RLS si prova solo col token
//    vero: dentro una migrazione si gira come proprietari (§5 punto 2).
// 4. **Non si restituisce piu' del dovuto**, e il rifiuto arriva fin qui.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO prestiti");
// ⚠️ Un anno passato, come in tesoreria: i saldi contano solo cio' che e'
// gia' avvenuto, e il locale apre nel 2027.
const ANNO = 1994;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("prestiti di privati: soldi che stanno in cassa e non sono nostri", () => {
  let titolare;
  let staff;
  let ente;

  async function pulisci() {
    const { data } = await titolare.from("prestiti_privati").select("id").like("da_chi", `${MARCA}%`);
    for (const p of data ?? []) {
      await titolare.from("cash_movements").delete().eq("prestito_id", p.id);
      await titolare.from("restituzioni_prestito").delete().eq("prestito_id", p.id);
      await titolare.from("prestiti_privati").delete().eq("id", p.id);
    }
  }

  async function saldo() {
    const { data } = await titolare
      .from("v_cash_balance")
      .select("balance, declared_takings, prestiti_in_cassa")
      .eq("entity_id", ente)
      .maybeSingle();
    return {
      saldo: Number(data.balance),
      incassi: Number(data.declared_takings),
      prestiti: Number(data.prestiti_in_cassa),
    };
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);
    // ⚠️ La causale non si cerca piu' qui: dal 29/08 la mette la funzione
    // del database, che e' la sola a sapere qual e'. Prima la sceglieva
    // chi chiamava, e sceglieva «la prima non di sistema» — cioe' una
    // qualunque.
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
    await sonda.auth.signOut({ scope: "local" });
  });

  it.skipIf(!CORRIDOIO)("il denaro entra in cassa senza diventare un incasso", async () => {
    const prima = await saldo();

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_prestito_privato",
        parametri: {
          p_entity_id: ente,
          p_da_chi: `${MARCA} Manuela`,
          p_importo: 4990,
          p_mezzo: "cassa",
          p_ricevuto_il: `${ANNO}-03-01`,
        },
      },
    });
    expect(error).toBeNull();

    const dopo = await saldo();
    // I soldi ci sono davvero: il saldo li conta.
    expect(dopo.saldo).toBe(prima.saldo + 4990);
    // 🔴 Ma non sono incassi, ed e' l'unica riga che protegge la Proiezione.
    expect(dopo.incassi).toBe(prima.incassi);
    // E si sa quanti di quei soldi vanno restituiti.
    expect(dopo.prestiti).toBe(prima.prestiti + 4990);
  });

  it("i prestiti sono del titolare, e la riga c'e' davvero", async () => {
    // ⚠️ Prima si controlla che il titolare la veda: su una tabella vuota
    // «lo staff non vede niente» non dimostrerebbe niente.
    const { data: sue } = await titolare.from("prestiti_privati").select("id").like("da_chi", `${MARCA}%`);
    expect(sue.length).toBeGreaterThan(0);

    const { data } = await staff.from("prestiti_privati").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("lo spazio di manovra e' riservato al titolare", async () => {
    const { error } = await staff.rpc("spazio_di_manovra", { p_entity_id: ente });
    expect(error).toBeTruthy();
  });

  it.skipIf(!CORRIDOIO)("una restituzione parziale lascia il residuo, e non si va oltre", async () => {
    const { data: p } = await titolare
      .from("prestiti_privati")
      .select("id")
      .like("da_chi", `${MARCA}%`)
      .limit(1)
      .single();

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_restituzione_prestito",
        parametri: {
          p_prestito_id: p.id,
          p_importo: 1000,
          p_mezzo: "cassa",
          p_restituito_il: `${ANNO}-04-01`,
        },
      },
    });
    expect(error).toBeNull();

    const { data: aperti } = await titolare.rpc("prestiti_aperti", { p_entity_id: ente });
    const mio = aperti.find((x) => x.id === p.id);
    expect(Number(mio.residuo)).toBe(3990);

    // ⚠️ Il rifiuto: piu' del residuo. Un prestito non si restituisce due volte.
    const rifiuto = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_restituzione_prestito",
        parametri: {
          p_prestito_id: p.id,
          p_importo: 4000,
          p_mezzo: "cassa",
          p_restituito_il: `${ANNO}-04-02`,
        },
      },
    });
    const corpo = await rifiuto.error.context.json();
    // ⚠️ E NON basta che sia un errore: `operazione` vorrebbe dire «non e'
    // nell'elenco del corridoio», cioe' un 404 travestito da rifiuto.
    expect(corpo.errore.codice).not.toBe("operazione");
    expect(corpo.errore.messaggio).toMatch(/restitu|residuo|piu/i);

    const { data: ancora } = await titolare.rpc("prestiti_aperti", { p_entity_id: ente });
    expect(Number(ancora.find((x) => x.id === p.id).residuo)).toBe(3990);
  });
});
