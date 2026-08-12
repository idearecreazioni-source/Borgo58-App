import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// «Chiedi all'archivio»: la parte che si può provare senza spendere.
//
// La domanda vera costa soldi e passa da un modello, quindi qui non si
// prova quella: si prova **cosa gli viene messo davanti**, che è la parte
// che decide se la risposta sarà giusta o inventata. Un assistente
// perfetto a cui si passano i documenti sbagliati risponde male, e nessun
// modello più grande lo aggiusta.
//
// Le tre cose che devono reggere:
//   1. la pertinenza si calcola sul CONTENUTO, non solo sul titolo;
//   2. l'elenco è tutto l'Archivio, non una selezione — è ciò che permette
//      di dire "guardati 40, letti 6" invece di un "non risulta" cieco;
//   3. il personale non vede niente, e non perché lo controlla una riga di
//      codice: perché è la RLS dell'Archivio a decidere.

const TITOLO_A = "PROVA DOMANDE caldaia";
const TITOLO_B = "PROVA DOMANDE tovagliato";

describe("chiedi all'archivio: cosa finisce davanti all'assistente", () => {
  let titolare;
  let staff;
  let idA;
  let idB;

  const pulisci = async () => {
    await titolare.from("documents").delete().in("title", [TITOLO_A, TITOLO_B]);
    // Il registro delle cancellazioni conserva una copia della riga: i
    // documenti di prova non devono restare nemmeno lì (regola del 12/08).
    if (idA) await titolare.from("deleted_records").delete().eq("record_id", idA);
    if (idB) await titolare.from("deleted_records").delete().eq("record_id", idB);
  };

  beforeAll(async () => {
    const cred = credenziali();
    [titolare, staff] = await Promise.all([
      clientAutenticato(cred.titolare),
      clientAutenticato(cred.staff),
    ]);
    await pulisci();

    const { data, error } = await titolare
      .from("documents")
      .insert([
        {
          title: TITOLO_A,
          doc_type: "contratto",
          counterparties: "Ditta di prova",
          testo:
            "Contratto di manutenzione ordinaria della caldaia della cucina, canone annuo di 480 euro.",
        },
        {
          title: TITOLO_B,
          doc_type: "preventivo",
          counterparties: "Altra ditta di prova",
          testo: "Preventivo per la fornitura di tovaglie e tovaglioli in lino.",
        },
      ])
      .select("id, title");
    expect(error).toBeNull();
    idA = data.find((d) => d.title === TITOLO_A)?.id;
    idB = data.find((d) => d.title === TITOLO_B)?.id;
  });

  afterAll(async () => {
    await pulisci();
    await Promise.all([
      titolare.auth.signOut({ scope: "local" }),
      staff.auth.signOut({ scope: "local" }),
    ]);
  });

  async function rilevanze(domanda, client = titolare) {
    const { data, error } = await client.rpc("documenti_per_domanda", { p_domanda: domanda });
    expect(error).toBeNull();
    const mappa = {};
    for (const riga of data) mappa[riga.id] = riga.rilevanza;
    return { righe: data, mappa };
  }

  it("pesca il documento dal contenuto, non dal titolo", async () => {
    // La parola «caldaia» non compare nel titolo di nessuno dei due.
    const { mappa } = await rilevanze("chi mi fa la manutenzione della caldaia?");
    expect(mappa[idA]).toBeGreaterThan(0);
    expect(mappa[idB]).toBe(0);
    expect(mappa[idA]).toBeGreaterThan(mappa[idB]);
  });

  it("una domanda con parole diverse dal documento non inventa pertinenza", async () => {
    const { mappa } = await rilevanze("xilofono marziano");
    // Zero deve essere zero: `ts_rank` da solo restituirebbe 1e-20, che
    // chi chiama leggerebbe come "un po' pertinente".
    expect(mappa[idA]).toBe(0);
    expect(mappa[idB]).toBe(0);
  });

  it("l'elenco è tutto l'archivio, anche ciò che non c'entra", async () => {
    const { mappa } = await rilevanze("caldaia");
    expect(Object.keys(mappa)).toContain(idA);
    expect(Object.keys(mappa)).toContain(idB);
  });

  it("il personale non vede l'archivio, e nemmeno attraverso questa strada", async () => {
    // Provata su un archivio NON vuoto: i due documenti esistono davvero
    // in questo momento (§5 punto 2 di CLAUDE.md).
    const { righe } = await rilevanze("caldaia", staff);
    expect(righe).toHaveLength(0);
  });

  it("il registro delle domande è del solo titolare", async () => {
    const { error } = await staff.from("domande_archivio").insert({ domanda: "prova" });
    expect(error).not.toBeNull();
  });
});
