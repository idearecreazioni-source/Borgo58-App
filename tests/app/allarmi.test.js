import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio } from "./aiuto";

// Gli allarmi: il sistema avvisa quando si rompe.
//
// La parte difficile non è mandare un avviso — è NON mandarlo quando non
// serve. Un locale in cui il telefono squilla a ogni "non c'è più posto"
// è un locale in cui, dopo una settimana, nessuno guarda più il telefono:
// e il primo guasto vero passa inosservato insieme al rumore.
//
// Queste prove verificano la distinzione dal ruolo vero, attraverso il
// corridoio vero — cioè nell'unico modo in cui è verificabile.

const sonda = await clientAutenticato(credenziali().staff);
const CORRIDOIO = await corridoioInstallato(sonda);
// ⚠️ La sentinella sta in OGNI file che salta prove, non in uno solo: chi
// lancia solo questo file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);
await sonda.auth.signOut({ scope: "local" });

const TIPO = "corridoio_close_order_as_discount_gift";

describe.skipIf(!CORRIDOIO)("allarmi: i guasti fanno rumore, i rifiuti previsti no", () => {
  let titolare;
  let staff;

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([
      clientAutenticato(cred.titolare),
      clientAutenticato(cred.staff),
    ]);
    await titolare.from("allarmi").delete().eq("tipo", TIPO);
  });

  afterAll(async () => {
    await titolare.from("allarmi").delete().eq("tipo", TIPO);
  });

  async function quantiAllarmi() {
    const { data, error } = await titolare.from("allarmi").select("id").eq("tipo", TIPO);
    expect(error).toBeNull();
    return data.length;
  }

  it("un rifiuto previsto non fa rumore (conto inesistente = il database fa il suo mestiere)", async () => {
    const prima = await quantiAllarmi();

    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "close_order_as_discount_gift",
        parametri: { p_order_id: crypto.randomUUID(), p_is_gift: true },
      },
    });
    expect(r.error).not.toBeNull(); // rifiutata, come deve essere

    expect(await quantiAllarmi()).toBe(prima);
  });

  it("un errore non previsto fa scattare un allarme — e uno solo, anche se si ripete", async () => {
    // Un identificativo malformato non è un rifiuto di sala: è qualcosa
    // che non doveva succedere, e il titolare lo deve sapere.
    const rotta = {
      operazione: "close_order_as_discount_gift",
      parametri: { p_order_id: "questo-non-e-un-identificativo", p_is_gift: true },
    };

    const primo = await staff.functions.invoke("operazioni-atomiche", { body: rotta });
    expect(primo.error).not.toBeNull();
    expect(await quantiAllarmi()).toBe(1);

    // Stesso guasto a raffica: il freno anti-tempesta tiene.
    await staff.functions.invoke("operazioni-atomiche", { body: rotta });
    await staff.functions.invoke("operazioni-atomiche", { body: rotta });
    expect(await quantiAllarmi()).toBe(1);
  });

  it("gli allarmi li legge solo il titolare", async () => {
    const { data, error } = await staff.from("allarmi").select("id");
    // La RLS filtra invece di dare errore: zero righe, non un rifiuto.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
