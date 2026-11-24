import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, marchio, primaEntita } from "./aiuto";

// REVISIONE DELL'11/11/2026, punto 8: la STESSA restituzione di un prestito mandata da due apparecchi nello stesso istante
// non scrive due volte. Su un database vero (Prova), con due richieste davvero in parallelo: una verifica dentro la
// migrazione gira in una sola sessione e non può provare una corsa.
// ⚠️ Righe inventate (il repo è pubblico) e marchio di questo giro, ripulite alla fine.

const MARCA = marchio("TEST-AUTO doppio invio");
// Un anno passato, come in tesoreria: i saldi contano solo ciò che è già avvenuto.
const ANNO = 1993;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("doppio invio: la restituzione di un prestito non si scrive due volte", () => {
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

  it.skipIf(!CORRIDOIO)("due restituzioni uguali nello stesso istante: una sola entra, l'altra aspetta e viene rifiutata", async () => {
    const nato = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_prestito_privato",
        parametri: { p_entity_id: ente, p_da_chi: `${MARCA} Marta`, p_importo: 700, p_mezzo: "cassa", p_ricevuto_il: `${ANNO}-03-01` },
      },
    });
    expect(nato.error).toBeNull();
    const { data: p } = await titolare.from("prestiti_privati").select("id").like("da_chi", `${MARCA}%`).limit(1).single();

    // Due richieste IDENTICHE, davvero insieme: restituiscono tutto il prestito (700), quindi se entrassero tutte e due
    // si restituirebbero 1.400 euro di un prestito da 700.
    const [a, b] = await Promise.all([restituisci(p.id, 700, "01"), restituisci(p.id, 700, "01")]);
    const riuscite = [a, b].filter((r) => !r.error).length;
    expect(riuscite, "una sola delle due deve entrare").toBe(1);

    const { data: righe } = await titolare.from("restituzioni_prestito").select("id, importo").eq("prestito_id", p.id);
    expect(righe).toHaveLength(1);
    expect(Number(righe[0].importo)).toBe(700);
    const { data: movimenti } = await titolare.from("cash_movements").select("id").eq("prestito_id", p.id).eq("direction", "uscita");
    expect(movimenti).toHaveLength(1);

    const { data: aperti } = await titolare.rpc("prestiti_aperti", { p_entity_id: ente });
    expect(aperti.find((x) => x.id === p.id)?.residuo ?? 0).toBeFalsy();
  }, 60000);
});
