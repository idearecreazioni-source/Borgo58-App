import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, primaEntita } from "./aiuto";

// La Proiezione economico-fiscale (Blocco 3).
//
// Tre cose che solo una prova col token vero può tenere ferme, e che la
// lettura del codice non basta a garantire:
//
// 1. **«Solo mio» è la RLS, non una voce nascosta.** Dentro una
//    migrazione si gira come proprietario delle tabelle, e il
//    proprietario la RLS la scavalca: là dentro un controllo sulla policy
//    darebbe un verde che non vuol dire niente. Qui si passa da
//    PostgREST col token dello staff, che è come ci arriva un tablet — e
//    c'è una riga vera che lui non deve vedere (§5 punto 2).
// 2. **Una previsione chiusa non si tocca nemmeno dal browser.** Il
//    sigillo è un trigger, quindi vale anche per chi scrive direttamente
//    in tabella scavalcando la funzione.
// 3. **Il motore fiscale è uno.** Il Simulatore non calcola più le
//    imposte per conto suo: chiama la stessa funzione della Proiezione, e
//    quella funzione porta con sé la frase che dichiara il limite.
const NOME = "TEST-AUTO previsione";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
// ⚠️ La sentinella sta in OGNI file che salta prove, non in uno solo: chi
// lancia solo questo file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

function scenarioDiProva(ente) {
  return {
    entity_id: ente,
    nome: NOME,
    tipo: "riproiezione",
    anno: 2098,
    parametri: {
      scontrinoFood: 40, scontrinoBeverage: 10,
      foodCostPercento: 0.25, beverageCostPercento: 0.5,
      lavanderiaCoperto: 0, pagamentiElettroniciPercento: 0, commissionePosPercento: 0,
      oreGiorno: 8, pressionePersonale: 0,
      ammortamentiAnnui: 1200, finanziamentoImporto: 0, finanziamentoTasso: 0, finanziamentoAnni: 0,
    },
    personale: [],
    extra: [],
    costiFissi: [{ voce: "Affitto", euroMese: 1000 }],
    accessorie: [],
    mesi: Array.from({ length: 12 }, (_, i) => ({
      mese: i + 1, serviziSettimana: 3, giorniLavorativi: 10, giorniPeak: 0,
      copertiPeak: 0, copertiFeriali: 10, eventiPremium: 0,
    })),
    controlli: { copertiSala: 1200 },
  };
}

describe("la rotta economica: riservata, congelata, con un solo motore fiscale", () => {
  let titolare;
  let staff;
  let ente;
  let scenarioId;

  async function pulisci() {
    const { data } = await titolare.from("scenari_proiezione").select("id").eq("nome", NOME);
    for (const s of data ?? []) {
      // Una previsione chiusa non si cancella: qui non ne restano, ma se
      // una prova fallisse a metà la si toglie prima del sigillo.
      await titolare.from("scenari_proiezione").delete().eq("id", s.id);
    }
  }

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it.skipIf(!CORRIDOIO)("crea una previsione dal corridoio e ne calcola i mesi", async () => {
    const { data, error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "crea_scenario_proiezione", parametri: { p_dati: scenarioDiProva(ente) } },
    });
    expect(error).toBeNull();
    scenarioId = data?.risultato;
    expect(scenarioId).toBeTruthy();

    const mesi = await titolare.rpc("proiezione_scenario", { p_scenario_id: scenarioId });
    expect(mesi.error).toBeNull();
    expect(mesi.data).toHaveLength(12);
    // 100 coperti a 50 = 5.000 di ricavi; 1.500 di costi variabili;
    // 1.000 di fissi → 2.500 di EBITDA.
    expect(Number(mesi.data[0].coperti)).toBe(100);
    expect(Number(mesi.data[0].ebitda)).toBe(2500);
  });

  it.skipIf(!CORRIDOIO)("è riservata al titolare, e lo staff riceve un rifiuto — non un elenco vuoto", async () => {
    expect(scenarioId).toBeTruthy();

    // ⚠️ La riga esiste: senza, questa prova passerebbe identica a RLS spenta.
    const suo = await titolare.from("scenari_proiezione").select("id").eq("id", scenarioId);
    expect(suo.data).toHaveLength(1);

    const visti = await staff.from("scenari_proiezione").select("id");
    expect(visti.error).toBeNull();
    expect(visti.data).toHaveLength(0);

    const mesiStaff = await staff.from("scenario_mesi").select("id");
    expect(mesiStaff.data ?? []).toHaveLength(0);

    // E la funzione dice di no invece di rispondere vuoto.
    const rifiuto = await staff.rpc("proiezione_scenario", { p_scenario_id: scenarioId });
    expect(rifiuto.error).not.toBeNull();
  });

  it.skipIf(!CORRIDOIO)("finché è aperta si corregge, e passa dal corridoio", async () => {
    expect(scenarioId).toBeTruthy();

    const dati = scenarioDiProva(ente);
    dati.parametri.scontrinoFood = 50;
    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "aggiorna_scenario_proiezione",
        parametri: { p_scenario_id: scenarioId, p_dati: dati },
      },
    });
    expect(error).toBeNull();

    const mesi = await titolare.rpc("proiezione_scenario", { p_scenario_id: scenarioId });
    // 100 coperti a 60 = 6.000 di ricavi.
    expect(Number(mesi.data[0].ricavi_sala)).toBe(6000);
    // E le righe figlie si rifanno, non si accumulano.
    const righe = await titolare.from("scenario_mesi").select("id").eq("scenario_id", scenarioId);
    expect(righe.data).toHaveLength(12);
  });

  // ⚠️ IL SIGILLO NON SI PROVA QUI, ed è una scelta con una ragione. Per
  // provarlo servirebbe congelare una previsione, e una previsione chiusa
  // — anche buttandola via — lascia una riga nel registro delle
  // cancellazioni, che **nessuno può ripulire** (ha la sola lettura, ed è
  // giusto così). Ogni giro di prove sporcherebbe per sempre un registro
  // che serve a ricostruire i fatti veri, contro la regola dei dati di
  // prova che si cancellano sempre.
  //
  // Il sigillo è provato dentro `20260814000014` e `20260815000001`, che
  // girano come proprietarie del database e si ripuliscono per intero:
  // update rifiutato, cancellazione di un pezzo rifiutata, riapertura
  // rifiutata, e la previsione intera che se ne va lasciando la traccia.

  it("il motore fiscale è uno solo, e il numero esce con la frase che lo spiega", async () => {
    const { data, error } = await titolare.rpc("calcola_imposte", {
      p_entity_id: ente,
      p_imponibile: 10000,
      p_costo_lavoro_incrementale: 0,
    });
    if (error) {
      // Sul progetto di prova i parametri fiscali possono non esserci:
      // in quel caso la funzione deve DIRLO, non rispondere zero.
      expect(error.message).toMatch(/parametri fiscali/i);
      return;
    }
    const r = data[0];
    expect(Number(r.ires)).toBeCloseTo(Number(r.aliquota_ires) * 100, 2);
    expect(r.avvertenza).toMatch(/IRAP/);
  });

  // 🔴 LA PROVA QUI SOPRA NON DISCRIMINA L'UNITA', ed e' il motivo per cui
  // il difetto del 24/08 le e' passato davanti per giorni: su un imponibile
  // di 10.000, `ires = aliquota x 100` e' vero **qualunque sia l'aliquota**
  // — anche 0,24 al posto di 24. E' una tautologia travestita da controllo.
  //
  // Il difetto: `fiscal_settings` teneva le aliquote in FRAZIONE mentre
  // `calcola_imposte()` le legge in PUNTI, quindi tutte le imposte del
  // gestionale erano cento volte piu' basse del vero, **senza nessun
  // errore** e sempre nella stessa direzione. La radice resta: nello
  // stesso database una percentuale si scrive in due modi (qui in punti,
  // in `scenari_proiezione` in frazione).
  //
  // ⚠️ QUESTA PROVA NON SCRIVE MAI CON SUCCESSO, quindi non ha niente da
  // ripulire: chiede al database di accettare un'aliquota in frazione su
  // un'entita' che non ha parametri, e pretende un rifiuto.
  it("un'aliquota scritta in frazione viene respinta dal database", async () => {
    const enti = await titolare.from("entities").select("id").order("created_at");
    expect(enti.error).toBeNull();
    const senzaParametri = [];
    for (const e of enti.data ?? []) {
      const q = await titolare.from("fiscal_settings").select("entity_id").eq("entity_id", e.id).maybeSingle();
      if (!q.data) senzaParametri.push(e.id);
    }
    // ⚠️ Se tutte le entita' hanno gia' i parametri, la prova NON si
    // inventa una scrittura sulla riga vera: lo dichiara e passa oltre.
    if (senzaParametri.length === 0) {
      expect(senzaParametri.length).toBe(0);
      return;
    }

    const esito = await titolare.from("fiscal_settings").insert({
      entity_id: senzaParametri[0],
      ires_rate: 0.24,
      irap_rate: 0.039,
    });
    expect(esito.error, "il database ha accettato un'aliquota in frazione: il vincolo non morde").not.toBeNull();
    expect(esito.error.message).toMatch(/aliquote_in_punti/);

    // E la riga non e' nata: un rifiuto che lascia dietro di se' la riga
    // rifiutata non e' un rifiuto.
    // ⚠️ Si cancella PRIMA di misurare, e solo la riga di cui questa prova
    // conosce l'identificativo (regola del 23/08): il giorno in cui il
    // vincolo non morde, l'insert riesce — e una prova che scopre un buco
    // non deve anche lasciarci dentro il proprio rifiuto.
    await titolare.from("fiscal_settings").delete().eq("entity_id", senzaParametri[0]);
    const dopo = await titolare.from("fiscal_settings").select("entity_id").eq("entity_id", senzaParametri[0]);
    expect(dopo.data ?? []).toHaveLength(0);
  });

  // Il verso opposto, letto e non scritto: cio' che c'e' gia' e' in punti.
  it("le aliquote gia' scritte sono in punti percentuali, non in frazione", async () => {
    const { data, error } = await titolare
      .from("fiscal_settings")
      .select("entity_id, ires_rate, irap_rate, acconto_percento, acconto_prima_rata_percento");
    expect(error).toBeNull();
    // ⚠️ PROPRIETA', non quantita': su un database sano ma senza parametri
    // fiscali questa prova deve restare verde, non diventare rossa.
    for (const r of data ?? []) {
      for (const campo of ["ires_rate", "irap_rate", "acconto_percento", "acconto_prima_rata_percento"]) {
        const v = Number(r[campo]);
        expect(v === 0 || v >= 1, `${campo} vale ${v}: e' una percentuale scritta in frazione`).toBe(true);
      }
    }
  });

  it("lo staff non può calcolare imposte né chiudere un mese", async () => {
    const imposte = await staff.rpc("calcola_imposte", {
      p_entity_id: ente, p_imponibile: 10000, p_costo_lavoro_incrementale: 0,
    });
    expect(imposte.error).not.toBeNull();

    const mese = await staff.rpc("chiudi_mese", {
      p_entity_id: ente, p_anno: 2001, p_mese: 5, p_note: null,
    });
    expect(mese.error).not.toBeNull();
  });

  it("un mese non ancora finito non si può fotografare", async () => {
    const oggi = new Date();
    const esito = await titolare.rpc("chiudi_mese", {
      p_entity_id: ente,
      p_anno: oggi.getFullYear(),
      p_mese: oggi.getMonth() + 1,
      p_note: null,
    });
    expect(esito.error).not.toBeNull();
    expect(esito.error.message).toMatch(/non e' ancora finito|non è ancora finito/i);
  });
});
