import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// Il silenzio a tempo delle notifiche di Prova (migrazione 20260919000001).
// ⚠️ Nessuna prova qui manda un Telegram: si guardano solo le funzioni del
//    database che aprono e chiudono il silenzio.
//
// ⚠️ Finché la migrazione non è applicata su Prova queste prove SALTANO, e
//    lo dicono: il silenzio non esiste ancora.

const sonda = await clientAutenticato(credenziali().titolare);
const { error: assente } = await sonda.from("silenzi_notifiche").select("id").limit(1);
const INSTALLATO = !assente;
if (!INSTALLATO) {
  console.warn(
    "⚠️  silenzio-notifiche: la migrazione 20260919000001 non è applicata su Prova, prove saltate."
  );
}
await sonda.auth.signOut({ scope: "local" });

describe.skipIf(!INSTALLATO)("il silenzio delle notifiche di Prova", () => {
  let titolare;
  let staff;
  const miei = [];

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([clientAutenticato(cred.titolare), clientAutenticato(cred.staff)]);
  });

  afterAll(async () => {
    for (const id of miei) await titolare.rpc("chiudi_silenzio_notifiche", { p_id: id });
  });

  it("questo giro di prove sta girando dentro un silenzio aperto", async () => {
    // È la prova che i test automatici sono muti: il silenzio l'ha aperto
    // `silenzio-globale.js` prima di tutte le prove.
    const { data, error } = await titolare
      .from("silenzi_notifiche")
      .select("id")
      .gt("scade_il", new Date().toISOString());
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  it("lo staff non può zittire le notifiche", async () => {
    const { error } = await staff.rpc("apri_silenzio_notifiche", { p_minuti: 5, p_motivo: "prova staff" });
    expect(error).not.toBeNull();
  });

  it("più di 90 minuti è rifiutato", async () => {
    const { error } = await titolare.rpc("apri_silenzio_notifiche", { p_minuti: 91, p_motivo: "troppo" });
    expect(error).not.toBeNull();
  });

  it("chiudere il proprio silenzio lascia aperto quello del giro", async () => {
    const { data: id, error } = await titolare.rpc("apri_silenzio_notifiche", {
      p_minuti: 5,
      p_motivo: "prova silenzio-notifiche",
    });
    expect(error).toBeNull();
    miei.push(id);
    expect((await titolare.rpc("chiudi_silenzio_notifiche", { p_id: id })).error).toBeNull();
    const { data } = await titolare.from("silenzi_notifiche").select("id").gt("scade_il", new Date().toISOString());
    expect(data.some((r) => r.id === id)).toBe(false);
    expect(data.length).toBeGreaterThan(0);
  });
});
