import { readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NUMERO_CORSA, clientAutenticato, credenziali, marchio, righeMie, spiega } from "./aiuto";

// =====================================================================
// I DUE VINCOLI DELLA CHIUSURA, SUI DATI VERI — C5, 23/09/2026
// =====================================================================
// 🔴 PERCHE' NON BASTA LEGGERE LA MIGRAZIONE. Il file dice quali frasi
//    SCRIVE; qui si guarda cosa il database HA — e soprattutto **cosa fa**
//    quando qualcuno scrive dritto in tabella, che e' l'unica strada da cui
//    quei due rifiuti possono uscire (sulla strada normale il messaggio lo
//    da' `chiudi_anno` con parole sue).
//
// ⚠️ E LE RIGHE SONO SUE: si creano in un anno di fantasia diverso per ogni
//    giro, e si cancellano per identificativo (regola del 23/08).
//
// ---------------------------------------------------------------------
// 🔴 QUESTE PROVE GIRANO SOLO DOVE LA `…004` E' APPLICATA
// ---------------------------------------------------------------------
// Senza la guardia fallirebbero **per il motivo sbagliato** — non perche'
// una regola sia rotta, perche' le due frasi non ci sono ancora. Si
// riaccendono da sole quando la versione compare nel registro.
const VERSIONE = "20260923000004";
const MARCA = marchio("TEST-AUTO vincoli chiusura");
const ANNO = 1900 + NUMERO_CORSA;

const MIGRAZIONI = readdirSync("supabase/migrations").filter((f) => f.startsWith(VERSIONE));
if (MIGRAZIONI.length !== 1) {
  throw new Error(
    `Non trovo UNA migrazione ${VERSIONE} in supabase/migrations (ne ho trovate ` +
      `${MIGRAZIONI.length}): queste prove resterebbero saltate per sempre senza che ` +
      `nessuno lo sappia.`
  );
}

const sonda = await clientAutenticato(credenziali().titolare);
const registro = await sonda.from("applied_migrations").select("version");
await sonda.auth.signOut({ scope: "local" });

if (registro.error) {
  throw new Error(
    `Non riesco a leggere il registro delle migrazioni: ${registro.error.message}. ` +
      `Non so in quale dei due momenti si trova questo database, e non tiro a indovinare.`
  );
}
// 🔴 Vuoto non e' zero: una lettura non permessa torna senza righe, e si
//    leggerebbe «nessuna migrazione applicata», cioe' «salta tutto».
if ((registro.data ?? []).length === 0) {
  throw new Error(
    "Il registro delle migrazioni e' tornato VUOTO. In un database vero non puo' esserlo."
  );
}

const APPLICATA = registro.data.some((r) => r.version === VERSIONE);
if (!APPLICATA) {
  console.warn(
    `⚠️  vincoli-chiusura-anno: la migrazione ${VERSIONE} non è applicata su questo ` +
      `database, le prove sono SALTATE. Non è un difetto: le due frasi italiane non ` +
      `esistono ancora. Si riaccendono da sole quando la migrazione viene applicata.`
  );
}

describe.skipIf(!APPLICATA)("i due vincoli della chiusura annuale parlano italiano", () => {
  let titolare;
  let srls;
  let agricola;
  let mie;

  const rigaFinta = (entityId, anno) => ({
    entity_id: entityId,
    anno,
    origine_coperti: "assente",
    origine_ricavi: "assente",
    origine_food_cost: "assente",
    origine_fissi: "assente",
    note: `${MARCA} ${anno}`,
  });

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    mie = righeMie(titolare);

    const { data: enti, error } = await titolare.from("entities").select("id, entity_type");
    if (error) throw new Error(`Non leggo i soggetti: ${error.message}`);
    srls = enti.find((e) => e.entity_type === "srls")?.id;
    agricola = enti.find((e) => e.entity_type === "azienda_agricola")?.id;
    if (!srls || !agricola) throw new Error("Servono la società e l'azienda agricola.");

    // Il perimetro dev'essere fatto di roba che la prova ha creato (16/08).
    await titolare.from("chiusure_annuali").delete().eq("anno", ANNO);
  });

  afterAll(async () => {
    await mie.pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  // ===================================================================
  it("🔴 nessun vincolo di `chiusure_annuali` è rimasto muto", async () => {
    const { data, error } = await titolare.rpc("vincoli_senza_frase");
    expect(error, spiega({ error })).toBeNull();
    const nostri = (data ?? []).filter((r) => r.tabella === "chiusure_annuali");
    expect(
      nostri.map((r) => r.conname),
      "vincoli della chiusura annuale senza spiegazione italiana"
    ).toEqual([]);
  });

  it("🔴 e l'unicità è ESATTAMENTE su società + anno: lo stesso anno passa su un altro soggetto", async () => {
    // ⚠️ È il controllo che discrimina: un'unicità sul solo anno
    //    respingerebbe anche questa, e la prova del duplicato qui sotto
    //    sarebbe verde lo stesso — cioè non proverebbe su cosa è l'unicità.
    const a = await titolare.from("chiusure_annuali").insert(rigaFinta(srls, ANNO)).select("id").single();
    expect(a.error, spiega(a)).toBeNull();
    mie.segna("chiusure_annuali", a.data.id);

    const b = await titolare
      .from("chiusure_annuali")
      .insert(rigaFinta(agricola, ANNO))
      .select("id")
      .single();
    expect(b.error, "lo stesso anno su un altro soggetto è stato respinto").toBeNull();
    mie.segna("chiusure_annuali", b.data.id);
  });

  it("🔴 un secondo anno uguale sullo STESSO soggetto è respinto, scrivendo dritto in tabella", async () => {
    // ⚠️ Sulla strada normale il messaggio buono lo dà `chiudi_anno`. Questa
    //    è l'altra porta — quella che la RLS lascia aperta al titolare — ed è
    //    da qui che quel rifiuto può uscire davanti a qualcuno.
    const r = await titolare.from("chiusure_annuali").insert(rigaFinta(srls, ANNO));
    expect(r.error, "il duplicato è passato").not.toBeNull();
    expect(r.error.code).toBe("23505");
  });

  it("🔴 e una chiusura intestata a un soggetto che non esiste è respinta", async () => {
    const r = await titolare
      .from("chiusure_annuali")
      .insert(rigaFinta("00000000-0000-0000-0000-000000000000", ANNO + 1));
    expect(r.error, "una chiusura senza soggetto è passata").not.toBeNull();
    expect(r.error.code).toBe("23503");
  });

  it("⚠️ e i quattro limiti sui valori di C5 non si sono persi per strada", async () => {
    // Questa migrazione aggiunge frasi, non tocca regole: un'origine
    // inventata dev'essere ancora respinta.
    const r = await titolare
      .from("chiusure_annuali")
      .insert({ ...rigaFinta(srls, ANNO + 2), origine_ricavi: "inventata" });
    expect(r.error, "un'origine fuori vocabolario è passata").not.toBeNull();
    expect(r.error.code).toBe("23514");
  });
});
