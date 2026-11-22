import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";

// L'import dal Drive, pezzo C2 (22/11/2026): quello che la pagina scrive, provato su un database vero (Prova).
//
// ⚠️ NIENTE LOTTO QUI: un lotto non si cancella (lo vieta il database, ed è giusto), quindi una prova che ne aprisse
//    uno ne lascerebbe uno in più su Prova a ogni giro. Aprire e ANNULLARE un lotto è provato dalla verifica interna
//    della migrazione C1 (dentro una transazione annullata, zero residui). Qui si prova il resto di quello che la
//    pagina scrive: i documenti con impronta, nota riservato e no_ai, l'elenco del Drive senza doppioni, e chi non può.
// ⚠️ Solo righe inventate (il repo è pubblico), e si tolgono solo quelle di cui si conosce l'id.

const SIGLA = marchio("PROVA IMPORT C2");
const impronta = (n) => `${n.toString(16)}`.padStart(64, "c");

describe("import dal Drive: cosa scrive la pagina", () => {
  let titolare;
  let staff;
  const documenti = [];
  const righeElenco = [];

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([clientAutenticato(cred.titolare), clientAutenticato(cred.staff)]);
  });

  afterAll(async () => {
    if (documenti.length > 0) {
      await titolare.from("documents").delete().in("id", documenti);
      // Il registro delle cancellazioni conserva una copia della riga: i documenti di prova non devono restare lì.
      await titolare.from("deleted_records").delete().in("record_id", documenti);
    }
    if (righeElenco.length > 0) await titolare.from("elenco_drive").delete().in("id", righeElenco);
  });

  it("le tre sezioni nuove ci sono e sono attive", async () => {
    const { data, error } = await titolare.rpc("sezioni_archivio_per", { p_corrente: null });
    expect(error).toBeNull();
    const codici = data.filter((s) => s.attiva).map((s) => s.codice);
    for (const c of ["preventivi", "assicurazioni", "progetto_planimetrie"]) expect(codici).toContain(c);
  });

  it("un documento importato porta impronta, nota riservato e no_ai; si ritrova dall'impronta; no_ai si cambia dopo", async () => {
    const { data, error } = await titolare
      .from("documents")
      .insert({
        title: `${SIGLA} contratto`,
        doc_type: "preventivi",
        document_date: "2026-11-02",
        impronta_sha256: impronta(1),
        sensibile: "IBAN",
        no_ai: false,
      })
      .select("id, no_ai, sensibile")
      .single();
    expect(error).toBeNull();
    documenti.push(data.id);
    expect(data).toMatchObject({ no_ai: false, sensibile: "IBAN" });

    const trovato = await titolare.from("documents").select("id, title").in("impronta_sha256", [impronta(1), impronta(2)]);
    expect(trovato.error).toBeNull();
    expect(trovato.data.map((d) => d.id)).toContain(data.id);

    const cambiato = await titolare.from("documents").update({ no_ai: true }).eq("id", data.id).select("no_ai").single();
    expect(cambiato.error).toBeNull();
    expect(cambiato.data.no_ai).toBe(true);
  });

  it("il database rifiuta ciò che la pagina non deve mai mandare: sezione senza data e impronta storta", async () => {
    const senzaData = await titolare.from("documents").insert({ title: `${SIGLA} senza data`, doc_type: "preventivi" }).select("id");
    expect(senzaData.error).not.toBeNull();
    for (const d of senzaData.data ?? []) documenti.push(d.id);
    const storta = await titolare
      .from("documents")
      .insert({ title: `${SIGLA} impronta storta`, doc_type: "preventivi", document_date: "2026-11-02", impronta_sha256: "NON-UN-HASH" })
      .select("id");
    expect(storta.error).not.toBeNull();
    for (const d of storta.data ?? []) documenti.push(d.id);
  });

  it("l'elenco del Drive: un link entra una volta sola, anche riscrivendo", async () => {
    const riga = { nome: `${SIGLA} file.pdf`, cartella: "Cartella finta", sezione: "Preventivi", link: `https://example.invalid/${SIGLA.replace(/\W/g, "")}`, no_ai: false };
    const prima = await titolare.from("elenco_drive").upsert([riga], { onConflict: "link", ignoreDuplicates: true }).select("id");
    expect(prima.error).toBeNull();
    expect(prima.data).toHaveLength(1);
    righeElenco.push(prima.data[0].id);
    const seconda = await titolare.from("elenco_drive").upsert([riga], { onConflict: "link", ignoreDuplicates: true }).select("id");
    expect(seconda.error).toBeNull();
    expect(seconda.data).toHaveLength(0);
    const conta = await titolare.from("elenco_drive").select("id").eq("link", riga.link);
    expect(conta.data).toHaveLength(1);
  });

  it("il personale non vede l'elenco, non apre lotti e non cambia i segni di un documento", async () => {
    const elenco = await staff.from("elenco_drive").select("id").limit(1);
    expect(elenco.error === null ? elenco.data : []).toHaveLength(0);
    const lotto = await staff.from("lotti_import").insert({ nota: "non deve entrare" }).select("id");
    expect(lotto.error).not.toBeNull();
    expect(lotto.data ?? []).toHaveLength(0);
    const cambio = await staff.from("documents").update({ no_ai: true }).eq("id", documenti[0]).select("id");
    expect(cambio.error === null ? cambio.data : []).toHaveLength(0);
  });
});
