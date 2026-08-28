import { afterAll, describe, expect, it } from "vitest";
import {
  clientAutenticato,
  corridoioInstallato,
  credenziali,
  denunciaSaltiCorridoio,
  primaEntita,
  righeMie,
} from "./aiuto";

// LA POSTA IN ARRIVO — 28/08/2026.
//
// ⚠️ SI ENTRA DAL CORRIDOIO, non chiamando la funzione del database: è la
// strada che usa il gestionale (Contratto B4), e un'operazione dimenticata
// nell'elenco del corridoio risponde 404 senza che nessuna prova SQL se ne
// accorga. La verifica dentro la migrazione prova la regola; questa prova
// il TRATTO fra la schermata e il database.
//
// ⚠️ E IL CASO PROVATO È QUELLO CHE HA QUALCOSA DA FARE: un carico con
// delle righe vere, non un carico vuoto — su cui la guardia del fornitore
// non verrebbe nemmeno raggiunta, perché prima scatta quella delle righe.

const NOME = "TEST-AUTO posta 20260828";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("la posta in arrivo", () => {
  const mie = righeMie(sonda);

  afterAll(async () => {
    await mie.pulisci();
  });

  async function apparecchia({ conFornitore }) {
    const ente = await primaEntita(sonda); // restituisce gia l identificativo

    const { data: forn } = await sonda
      .from("suppliers")
      .insert({ entity_id: ente, name: `${NOME} fornitore` })
      .select("id")
      .single();
    mie.segna("suppliers", forn.id);

    const { data: ing } = await sonda
      .from("ingredients")
      .insert({ entity_id: ente, name: `${NOME} merce`, category: "altro", unit: "kg" })
      .select("id")
      .single();
    mie.segna("ingredients", ing.id);

    const { data: posta } = await sonda
      .from("posta_ricevuta")
      .insert({
        messaggio_id: `${NOME}-${conFornitore ? "si" : "no"}`,
        casella: "info@borgo58.it",
        mittente: "fatture@prova.it",
        oggetto: `${NOME} fattura`,
        testo: "corpo di prova",
        stato: "proposta",
      })
      .select("id")
      .single();
    mie.segna("posta_ricevuta", posta.id);

    const { data: azione } = await sonda
      .from("posta_azioni")
      .insert({
        posta_id: posta.id,
        tipo: "carico_magazzino",
        titolo: `${NOME} carico`,
        descrizione: "una riga",
        perche: "prova",
        parametri: {
          documento: `${NOME} doc`,
          fornitore_id: conFornitore ? forn.id : null,
          righe: [
            {
              descrizione: `${NOME} MERCE`,
              ingrediente_id: ing.id,
              quantita: "2",
              fattore: "1",
              costo_unitario: "10.00",
              ricorda: true,
            },
          ],
        },
        stato: "proposta",
      })
      .select("id")
      .single();
    mie.segna("posta_azioni", azione.id);

    return { azione, forn, ing, posta };
  }

  it.skipIf(!CORRIDOIO)(
    "un carico SENZA fornitore viene respinto, e il messaggio dice cosa fare",
    async () => {
      const { azione } = await apparecchia({ conFornitore: false });
      const r = await sonda.functions.invoke("operazioni-atomiche", {
        body: { operazione: "esegui_azione_posta", parametri: { p_azione_id: azione.id, p_parametri: null } },
      });
      // ⚠️ Su un rifiuto `invoke` mette un messaggio generico in `error`
      // («non-2xx status code») e il messaggio VERO resta nel corpo della
      // risposta. Leggere solo `error.message` vorrebbe dire provare che
      // rifiuta, non COSA dice — e qui il punto è cosa dice.
      const corpo = await r.error?.context?.json?.().catch(() => null);
      const messaggio = corpo?.errore?.messaggio ?? r.data?.errore?.messaggio ?? r.error?.message ?? "";
      expect(messaggio).toMatch(/fornitore/i);
      // ⚠️ Non basta che rifiuti: deve dire cosa fare. Un rifiuto senza
      // gesto d'uscita è un vicolo cieco, ed è un difetto a sé.
      expect(messaggio).toMatch(/rincari/i);
    }
  );

  it.skipIf(!CORRIDOIO)(
    "e NON è un muro: lo stesso carico col fornitore entra in magazzino",
    async () => {
      const { azione, ing } = await apparecchia({ conFornitore: true });
      const { data, error } = await sonda.functions.invoke("operazioni-atomiche", {
        body: { operazione: "esegui_azione_posta", parametri: { p_azione_id: azione.id, p_parametri: null } },
      });
      expect(error?.message ?? data?.errore?.messaggio ?? null).toBeNull();

      // Si misura la DIFFERENZA che si è prodotta, non che «non ha rotto».
      const { data: lotti } = await sonda
        .from("stock_lots")
        .select("id, quantity_received, supplier_id")
        .eq("ingredient_id", ing.id);
      expect(lotti?.length).toBe(1);
      expect(Number(lotti[0].quantity_received)).toBe(2);
      expect(lotti[0].supplier_id).not.toBeNull();
      for (const l of lotti ?? []) mie.segna("stock_lots", l.id);

      const { data: art } = await sonda
        .from("articoli_fornitore")
        .select("id, supplier_id")
        .eq("chiave", `${NOME} merce`.toLowerCase());
      for (const a of art ?? []) mie.segna("articoli_fornitore", a.id);
    }
  );

  it("una mail arresa si rimette in coda, e i tentativi tornano a zero", async () => {
    const { data: posta } = await sonda
      .from("posta_ricevuta")
      .insert({
        messaggio_id: `${NOME}-arresa`,
        casella: "info@borgo58.it",
        mittente: "ufficio@prova.it",
        oggetto: `${NOME} arresa`,
        testo: "corpo",
        stato: "da_leggere",
        tentativi_lettura: 3,
        lettura_note: "lettura fallita 3 volte, non ci riprovo: prova",
      })
      .select("id")
      .single();
    mie.segna("posta_ricevuta", posta.id);

    const { error } = await sonda.rpc("riprova_lettura_posta", { p_posta_id: posta.id });
    expect(error).toBeNull();

    const { data: dopo } = await sonda
      .from("posta_ricevuta")
      .select("tentativi_lettura, lettura_note, stato")
      .eq("id", posta.id)
      .single();
    expect(dopo.tentativi_lettura).toBe(0);
    expect(dopo.lettura_note).toBeNull();
    expect(dopo.stato).toBe("da_leggere");
  });

  it("il tetto dei tentativi è un parametro del gestionale, non un numero nel codice", async () => {
    const { data, error } = await sonda
      .from("service_settings")
      .select("max_tentativi_lettura_posta")
      .limit(1)
      .maybeSingle();
    expect(error).toBeNull();
    // Se questa colonna sparisse, la schermata non potrebbe più distinguere
    // «sta per essere letta» da «non lo sarà mai più» — ed è da lì che
    // nasceva la frase falsa vista a schermo il 28/08.
    expect(Number(data?.max_tentativi_lettura_posta)).toBeGreaterThan(0);
  });
});
