import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, marchio, primaEntita } from "./aiuto";

// REVISIONE DELL'11/11/2026, punto 8: più restituzioni dello stesso prestito mandate insieme (due tablet, un invio ripetuto
// da una rete lenta) non possono restituire più di quello che si deve. Su un database vero (Prova), con richieste in parallelo.
//
// ⚠️ LIMITE DICHIARATO (24/11): provato togliendo il blocco `for update` dalla funzione su Prova, questa prova passa lo
//    stesso, sia con una coppia di richieste sia con cinque da 400 su 700 (tre giri di fila): le richieste passano dal
//    corridoio e non si sovrappongono abbastanza per aprire la corsa. Quindi è una guardia sul RISULTATO — mai più
//    restituito del dovuto, un solo movimento per restituzione — e NON la prova che il blocco c'è: quella la dà la verifica
//    della migrazione, che legge il corpo vivo delle tre funzioni. Una prova vera della corsa chiede due sessioni SQL con
//    una transazione tenuta aperta: resta da fare se serve.
// ⚠️ Righe inventate (il repo è pubblico) e marchio di questo giro, ripulite alla fine.

const MARCA = marchio("TEST-AUTO doppio invio");
// Un anno passato, come in tesoreria: i saldi contano solo ciò che è già avvenuto.
const ANNO = 1993;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("doppio invio: le restituzioni di un prestito non superano il dovuto", () => {
  let titolare;
  let ente;

  async function pulisci() {
    const { data } = await titolare.from("prestiti_privati").select("id").like("da_chi", `${MARCA}%`);
    for (const p of data ?? []) {
      await titolare.from("cash_movements").delete().eq("prestito_id", p.id);
      await titolare.from("restituzioni_prestito").delete().eq("prestito_id", p.id);
      await titolare.from("prestiti_privati").delete().eq("id", p.id);
    }
  }

  const restituisci = (prestitoId, importo, giorno) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_restituzione_prestito",
        parametri: { p_prestito_id: prestitoId, p_importo: importo, p_mezzo: "cassa", p_restituito_il: `${ANNO}-05-${giorno}` },
      },
    });

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await sonda.auth.signOut({ scope: "local" });
  });

  it.skipIf(!CORRIDOIO)("cinque restituzioni da 400 insieme su un prestito da 700: ne entra una sola", async () => {
    const nato = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_prestito_privato",
        parametri: { p_entity_id: ente, p_da_chi: `${MARCA} Marta`, p_importo: 700, p_mezzo: "cassa", p_ricevuto_il: `${ANNO}-03-01` },
      },
    });
    expect(nato.error).toBeNull();
    const { data: p } = await titolare.from("prestiti_privati").select("id").like("da_chi", `${MARCA}%`).limit(1).single();

    const esiti = await Promise.all([1, 2, 3, 4, 5].map(() => restituisci(p.id, 400, "01")));
    const riuscite = esiti.filter((r) => !r.error).length;
    expect(riuscite, "ne può entrare una sola: 2 × 400 supererebbe i 700 del prestito").toBe(1);

    const { data: righe } = await titolare.from("restituzioni_prestito").select("id, importo").eq("prestito_id", p.id);
    expect(righe).toHaveLength(1);
    const totale = righe.reduce((s, r) => s + Number(r.importo), 0);
    expect(totale).toBeLessThanOrEqual(700);
    const { data: movimenti } = await titolare.from("cash_movements").select("id").eq("prestito_id", p.id).eq("direction", "uscita");
    expect(movimenti).toHaveLength(righe.length);

    const { data: aperti } = await titolare.rpc("prestiti_aperti", { p_entity_id: ente });
    expect(Number(aperti.find((x) => x.id === p.id)?.residuo)).toBe(300);
  }, 90000);
});
