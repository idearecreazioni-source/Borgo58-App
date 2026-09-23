import { readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  NUMERO_CORSA,
  clientAnonimo,
  clientAutenticato,
  credenziali,
  marchio,
  righeMie,
  spiega,
} from "./aiuto";

// =====================================================================
// C5 — LA CHIUSURA DELL'ANNO FISCALE, PROVATA SUI DATI VERI (23/09/2026)
// =====================================================================
// 🔴 PERCHE' QUI E NON DENTRO LA MIGRAZIONE. Una migrazione gira come
//    PROPRIETARIA del database, e la proprietaria scavalca la RLS:
//    `is_titolare()` la' dentro e' falso, e un controllo sui permessi
//    darebbe un verde che non vuol dire niente (16/08). Il rifiuto allo
//    staff e all'anonimo si prova solo da qui, col token di un utente vero.
//
// ⚠️ E L'ANNO E' UNO DI FANTASIA, DIVERSO PER OGNI GIRO. Il locale apre nel
//    2027: gli anni 1900-1989 non contengono nessun dato, ne' vero ne' di
//    collaudo. `NUMERO_CORSA` da' a ogni giro il suo, cosi' due giri
//    paralleli non si contano i conti a vicenda — e' la stessa ragione per
//    cui esiste `giornoDiProva`.
//
// ---------------------------------------------------------------------
// 🔴 QUESTE PROVE GIRANO SOLO DOVE C5 E' APPLICATA, E LO DICHIARANO
// ---------------------------------------------------------------------
// La migrazione `20260923000003` non e' applicata da nessuna parte (per
// mandato: si costruisce, non si rilascia). Senza questa guardia le prove
// qui sotto fallirebbero **per il motivo sbagliato** — non perche' una
// regola sia rotta, perche' la tabella non esiste ancora.
//
// ⚠️ SI SALTA, NON SI ADDOLCISCE: nessuna e' resa permissiva, nessuna
//    diventa una lettura del file della migrazione. Si riaccendono da sole
//    il giorno che la versione compare nel registro.
const VERSIONE = "20260923000003";
const MARCA = marchio("TEST-AUTO chiusura anno");
const ANNO = 1900 + NUMERO_CORSA;

// 🔴 PRIMA DI TUTTO: LA VERSIONE ESISTE DAVVERO COME MIGRAZIONE? Una
//    versione scritta male non darebbe nessun errore — darebbe «migrazione
//    assente» per sempre, cioe' prove spente in silenzio.
const MIGRAZIONI = readdirSync("supabase/migrations").filter((f) => f.startsWith(VERSIONE));
if (MIGRAZIONI.length !== 1) {
  throw new Error(
    `Non trovo UNA migrazione ${VERSIONE} in supabase/migrations (ne ho trovate ` +
      `${MIGRAZIONI.length}). Finche' questa versione non corrisponde a un file, le ` +
      `prove di C5 resterebbero saltate per sempre senza che nessuno lo sappia.`
  );
}

const sonda = await clientAutenticato(credenziali().titolare);
const registro = await sonda.from("applied_migrations").select("version");
await sonda.auth.signOut({ scope: "local" });

// ⚠️ DUE MODI DI FALLIRE, E SI SOMIGLIANO. Il primo e' rumoroso.
if (registro.error) {
  throw new Error(
    `Non riesco a leggere il registro delle migrazioni: ${registro.error.message}. Non so ` +
      `in quale dei due momenti si trova questo database, e NON tiro a indovinare.`
  );
}
// 🔴 E IL SECONDO E' MUTO: una lettura non permessa non da' un errore, da'
//    ZERO RIGHE — che si leggerebbe «nessuna migrazione applicata», cioe'
//    «salta tutto». *Vuoto non e' zero* (19/08).
if ((registro.data ?? []).length === 0) {
  throw new Error(
    "Il registro delle migrazioni e' tornato VUOTO. In un database vero non puo' esserlo: " +
      "mi fermo invece di dedurre che C5 non sia applicata."
  );
}

const APPLICATA = registro.data.some((r) => r.version === VERSIONE);
if (!APPLICATA) {
  console.warn(
    `⚠️  chiusura-annuale: la migrazione ${VERSIONE} (C5) non è applicata su questo ` +
      `database, le prove sono SALTATE. Non è un difetto: la tabella chiusure_annuali ` +
      `non esiste ancora. Si riaccendono da sole quando la migrazione viene applicata.`
  );
}

describe.skipIf(!APPLICATA)("C5: l'anno si chiude, e dice cosa lascia indietro", () => {
  let titolare;
  let staff;
  let anonimo;
  let srls;
  let agricola;
  let mie;
  let conto;
  // 🔴 QUANTE RIFOTOGRAFIE ESISTONO GIA' PER (società, anno) PRIMA CHE
  //    QUESTA PROVA TOCCHI QUALCOSA. Vedi `rifotografieStoriche()`.
  let base;

  /**
   * 🔴 IL CONTEGGIO DELLE RIFOTOGRAFIE E' UNA PROPRIETA' DEL DATABASE, NON
   *    DELLA PROVA — 23/09/2026, difetto misurato.
   *
   * `chiudi_anno` non tiene un contatore: conta, nel registro delle
   * cancellazioni, quante volte quella società in quell'anno è già stata
   * chiusa e poi cancellata. È una scelta voluta (16/08) — un contatore
   * separato sarebbe un secondo posto da tenere allineato.
   *
   * ⚠️ LA CONSEGUENZA, ED E' QUELLA CHE MI E' SFUGGITA: quel registro è
   *    **storico** e non si ripulisce da nessuna parte. Gli anni di
   *    fantasia sono novanta, uno per giro: quando due giri pescano lo
   *    stesso, il secondo trova già una traccia — e le assertion assolute
   *    `toBe(0)` e `toBe(1)` cadono. È successo, ed è un rosso che compare
   *    circa una volta su novanta: *una prova intermittente è peggio di una
   *    rossa, perché insegna a rilanciare invece che a guardare.*
   *
   * ⚠️ LA CURA NON E' ALLARGARE GLI ANNI (sposterebbe solo la probabilità)
   *    né ripulire il registro (è storico, non sporco di prova): è **leggere
   *    la base prima di cominciare** e confrontare con quella. Il controllo
   *    resta esatto — la prima chiusura dichiara la base, la seconda la base
   *    più uno — e smette di dipendere da chi è passato di qui prima.
   */
  async function rifotografieStoriche(entityId, anno) {
    const { count, error } = await titolare
      .from("deleted_records")
      .select("*", { count: "exact", head: true })
      .eq("table_name", "chiusure_annuali")
      .eq("record->>entity_id", entityId)
      .eq("record->>anno", String(anno));
    // ⚠️ Non si deduce «zero» da una lettura fallita: sarebbe la stessa
    //    famiglia del dato non letto che si legge «non c'è niente» (19/08).
    if (error) throw new Error(`Non riesco a contare le rifotografie storiche: ${error.message}`);
    return Number(count ?? 0);
  }

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);
    anonimo = clientAnonimo();
    mie = righeMie(titolare);

    const { data: enti, error } = await titolare.from("entities").select("id, entity_type");
    if (error) throw new Error(`Non leggo i soggetti: ${error.message}`);
    srls = enti.find((e) => e.entity_type === "srls")?.id;
    agricola = enti.find((e) => e.entity_type === "azienda_agricola")?.id;
    if (!srls || !agricola) {
      throw new Error("Servono la società e l'azienda agricola: la separazione non si può provare.");
    }

    // 🔴 QUI C'ERA UNA PULIZIA A TAPPETO — `delete ... where anno = ANNO` —
    //    e cancellava righe che questa prova non aveva creato. È
    //    esattamente ciò che la regola del 23/08 vieta: *una pulizia
    //    cancella solo righe di cui conosce l'identificativo, perché le ha
    //    create lei.* Tolta.
    // ⚠️ E toglierla ha anche un effetto buono: quella cancellazione
    //    lasciava a sua volta una traccia nel registro, cioè sporcava
    //    proprio il conteggio che la prova poi verificava.
    base = await rifotografieStoriche(srls, ANNO);
  });

  afterAll(async () => {
    // Si cancella SOLO quello che questa prova ha creato, e per
    // identificativo (regola del 23/08).
    await mie.pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  // ===================================================================
  it("🔴 una chiusura PULITA: nessun conto senza documento, nessuna conferma", async () => {
    const misure = await titolare.rpc("misure_dell_anno", { p_entity_id: srls, p_anno: ANNO });
    expect(misure.error, spiega(misure)).toBeNull();
    const m = misure.data[0];
    expect(m.anno_finito, `il ${ANNO} dovrebbe risultare finito`).toBe(true);
    expect(Number(m.conti_senza_documento)).toBe(0);
    // ⚠️ Quello che non si è potuto misurare resta VUOTO, mai zero: uno
    //    zero si legge «è andato benissimo».
    expect(m.origine_ricavi).toBe("assente");
    expect(m.ricavi).toBeNull();

    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO,
      p_conferma_conti_senza_documento: false,
      p_note: `${MARCA} pulita`,
    });
    expect(esito.error, spiega(esito)).toBeNull();
    mie.segna("chiusure_annuali", esito.data);

    const { data: riga } = await titolare
      .from("chiusure_annuali")
      .select("*")
      .eq("id", esito.data)
      .single();
    expect(Number(riga.conti_senza_documento)).toBe(0);
    // 🔴 SI CONFRONTA CON LA BASE LETTA PRIMA DI COMINCIARE, non con uno
    //    zero assoluto: il conteggio è una proprietà del registro, e lo
    //    zero valeva solo finché nessun giro precedente era passato di qui.
    //    Il controllo resta esatto — è un `toBe`, non un «almeno».
    expect(
      Number(riga.chiusure_precedenti),
      `rifotografie storiche lette prima di chiudere: ${base}`
    ).toBe(base);
    expect(riga.ricavi).toBeNull();
  });

  it("un anno non ancora finito non si chiude", async () => {
    const quest_anno = new Date().getFullYear();
    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: quest_anno,
      p_conferma_conti_senza_documento: true,
      p_note: `${MARCA} futuro`,
    });
    expect(esito.error, "l'anno in corso si è lasciato chiudere").not.toBeNull();
    expect(esito.error.message).toMatch(/non e' ancora finito|non è ancora finito/i);
  });

  it("🔴 lo stesso anno non si chiude due volte per lo stesso soggetto", async () => {
    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO,
      p_conferma_conti_senza_documento: false,
      p_note: `${MARCA} doppione`,
    });
    expect(esito.error, "il doppione è passato").not.toBeNull();
    expect(esito.error.message).toMatch(/gia'|già/i);
  });

  it("🔴 e una chiusura non si riscrive, nemmeno scrivendo dritto in tabella", async () => {
    // ⚠️ Il sigillo è un trigger, quindi vale anche per chi scavalca la
    //    funzione e scrive dal browser — che è il solo modo di provarlo.
    const { data: riga } = await titolare
      .from("chiusure_annuali")
      .select("id")
      .eq("entity_id", srls)
      .eq("anno", ANNO)
      .single();
    const esito = await titolare
      .from("chiusure_annuali")
      .update({ note: "cambiata a mano" })
      .eq("id", riga.id);
    expect(esito.error, "una chiusura si è lasciata riscrivere").not.toBeNull();
  });

  it("🔴 i soggetti restano separati: l'agricola chiude lo stesso anno, e non si mescolano", async () => {
    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: agricola,
      p_anno: ANNO,
      p_conferma_conti_senza_documento: false,
      p_note: `${MARCA} agricola`,
    });
    expect(esito.error, spiega(esito)).toBeNull();
    mie.segna("chiusure_annuali", esito.data);

    const { data: righe } = await titolare
      .from("chiusure_annuali")
      .select("id, entity_id")
      .eq("anno", ANNO);
    expect(righe).toHaveLength(2);
    expect(new Set(righe.map((r) => r.entity_id)).size, "due chiusure dello stesso soggetto").toBe(
      2
    );
  });

  // ===================================================================
  // 🔴 L'AVVISO
  // ===================================================================
  it("🔴 un conto senza documento viene CONTATO, e la chiusura si rifiuta di avvenire in silenzio", async () => {
    // Si toglie la chiusura pulita per poter riprovare sullo stesso anno.
    const { data: pulita } = await titolare
      .from("chiusure_annuali")
      .select("id")
      .eq("entity_id", srls)
      .eq("anno", ANNO)
      .single();
    await titolare.from("chiusure_annuali").delete().eq("id", pulita.id);

    const { data: o, error: eo } = await titolare
      .from("orders")
      .insert({
        entity_id: srls,
        table_label: `${MARCA} T1`,
        status: "chiuso",
        closed_at: `${ANNO}-06-02T19:00:00Z`,
        coperti: 2,
        coperto_unit_price: 20,
      })
      .select("id")
      .single();
    expect(eo, eo?.message).toBeNull();
    conto = mie.segna("orders", o.id);

    const misure = await titolare.rpc("misure_dell_anno", { p_entity_id: srls, p_anno: ANNO });
    expect(misure.error, spiega(misure)).toBeNull();
    expect(Number(misure.data[0].conti_senza_documento)).toBe(1);
    expect(Number(misure.data[0].incasso_senza_documento)).toBeGreaterThan(0);

    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO,
      p_conferma_conti_senza_documento: false,
      p_note: `${MARCA} senza conferma`,
    });
    expect(esito.error, "l'anno si è chiuso in silenzio con un conto senza documento").not.toBeNull();
    // ⚠️ Il rifiuto dice QUANTI e QUANTO: un «non posso» non fa sapere
    //    cosa si sta per lasciare indietro.
    expect(esito.error.message).toMatch(/1 conto/);
    expect(esito.error.message).toContain("€");
  });

  it("🔴 e il rifiuto NON scrive niente: annullare non lascia tracce", async () => {
    const { data: righe } = await titolare
      .from("chiusure_annuali")
      .select("id")
      .eq("entity_id", srls)
      .eq("anno", ANNO);
    expect(righe, "il rifiuto ha lasciato una chiusura a metà").toHaveLength(0);
  });

  it("🔴 con la conferma esplicita si chiude, e il conteggio resta nello storico", async () => {
    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO,
      p_conferma_conti_senza_documento: true,
      p_note: `${MARCA} con avviso`,
    });
    expect(esito.error, spiega(esito)).toBeNull();
    mie.segna("chiusure_annuali", esito.data);

    const { data: riga } = await titolare
      .from("chiusure_annuali")
      .select("*")
      .eq("id", esito.data)
      .single();
    expect(Number(riga.conti_senza_documento)).toBe(1);
    expect(Number(riga.incasso_senza_documento)).toBeGreaterThan(0);
    // ⚠️ È così che la chiusura con avviso si distingue da una pulita: dal
    //    conteggio, non da una seconda colonna che potrebbe contraddirlo.
    // ⚠️ E dichiara di essere una seconda fotografia: la pulita è stata
    //    cancellata poco fa — quindi ESATTAMENTE una in più della base.
    expect(
      Number(riga.chiusure_precedenti),
      `base ${base} + la pulita cancellata poco fa`
    ).toBe(base + 1);
    expect(riga.prima_chiusura_il).not.toBeNull();
  });

  it("🔴 IL CONFINE SU L21: il conto senza documento non è stato toccato", async () => {
    // Nessuna riclassificazione automatica, nessuno spostamento di anno,
    // nessun documento inventato. Dove finisce se lo si regolarizza dopo è
    // una decisione ancora aperta, e il gestionale non l'ha presa.
    const { data: o, error } = await titolare
      .from("orders")
      .select("documento_fiscale, documento_numero, documento_emesso_il, closed_at, status")
      .eq("id", conto)
      .single();
    expect(error).toBeNull();
    expect(o.documento_fiscale, "il conto è stato fiscalizzato dalla chiusura").toBeNull();
    expect(o.documento_numero).toBeNull();
    expect(o.documento_emesso_il).toBeNull();
    expect(o.status).toBe("chiuso");
    expect(new Date(o.closed_at).getUTCFullYear()).toBe(ANNO);
  });

  it("🔴 lo storico non si muove se dopo cambiano i dati correnti", async () => {
    const { data: prima } = await titolare
      .from("chiusure_annuali")
      .select("*")
      .eq("entity_id", srls)
      .eq("anno", ANNO)
      .single();

    const { data: o2, error: e2 } = await titolare
      .from("orders")
      .insert({
        entity_id: srls,
        table_label: `${MARCA} T2`,
        status: "chiuso",
        closed_at: `${ANNO}-07-07T19:00:00Z`,
        coperti: 4,
        coperto_unit_price: 25,
      })
      .select("id")
      .single();
    expect(e2, e2?.message).toBeNull();
    mie.segna("orders", o2.id);

    const { data: dopo } = await titolare
      .from("chiusure_annuali")
      .select("*")
      .eq("entity_id", srls)
      .eq("anno", ANNO)
      .single();
    expect(dopo.conti_senza_documento).toBe(prima.conti_senza_documento);
    expect(dopo.ricavi).toBe(prima.ricavi);
    expect(dopo.conti_chiusi).toBe(prima.conti_chiusi);

    // ⚠️ ...mentre la MISURA dal vivo si è mossa. È la prova che lo storico
    //    è fermo per scelta, non perché non ci fosse niente da vedere: senza
    //    questa riga, «la fotografia non cambia» sarebbe vero anche su un
    //    database in cui non è cambiato niente.
    const misure = await titolare.rpc("misure_dell_anno", { p_entity_id: srls, p_anno: ANNO });
    expect(Number(misure.data[0].conti_senza_documento)).toBe(2);
  });

  // ===================================================================
  // I PERMESSI
  // ===================================================================
  it("🔴 lo staff non può chiudere un anno, né leggerne i numeri", async () => {
    const chiusura = await staff.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO - 1,
      p_conferma_conti_senza_documento: true,
      p_note: null,
    });
    expect(chiusura.error, "lo staff ha chiuso un anno").not.toBeNull();

    // ⚠️ RIFIUTO, non elenco vuoto: un elenco vuoto si legge «non c'è
    //    niente», che è una rassicurazione falsa (13/08).
    const misure = await staff.rpc("misure_dell_anno", { p_entity_id: srls, p_anno: ANNO });
    expect(misure.error, "lo staff ha letto i numeri dell'anno").not.toBeNull();
  });

  it("🔴 e lo staff non vede nemmeno lo storico", async () => {
    const { data, error } = await staff.from("chiusure_annuali").select("id").eq("anno", ANNO);
    // La RLS filtra: zero righe, non un errore — ma le righe ci sono.
    expect(error).toBeNull();
    expect(data, "lo staff ha visto una chiusura annuale").toHaveLength(0);
  });

  it("🔴 e senza login non si chiude e non si legge niente", async () => {
    const chiusura = await anonimo.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO - 1,
      p_conferma_conti_senza_documento: true,
      p_note: null,
    });
    expect(chiusura.error, "un anonimo ha chiuso un anno").not.toBeNull();

    const lettura = await anonimo.from("chiusure_annuali").select("id");
    expect(
      lettura.error ? true : (lettura.data ?? []).length === 0,
      "un anonimo ha letto lo storico delle chiusure"
    ).toBe(true);
  });

  // ===================================================================
  // 🔴 PERCHE' IL CONFRONTO ASSOLUTO ERA SBAGLIATO — 23/09/2026
  // ===================================================================
  // Sta in fondo apposta: fa un terzo giro di chiusura sullo stesso anno,
  // e nessuna prova qui sopra dipende da com'è messo il database dopo.
  it("🔴 il conteggio SEGUE la storia del registro, e il vecchio `toBe(1)` sarebbe caduto qui", async () => {
    // A questo punto della prova la storia di (questa società, questo anno)
    // vale base + 1: la chiusura pulita è stata cancellata una volta.
    const storiche = await rifotografieStoriche(srls, ANNO);
    expect(storiche, "la storia letta dal registro").toBe(base + 1);

    // Si cancella la chiusura viva — solo la nostra, per identificativo — e
    // si richiude.
    const { data: viva } = await titolare
      .from("chiusure_annuali")
      .select("id")
      .eq("entity_id", srls)
      .eq("anno", ANNO)
      .single();
    await titolare.from("chiusure_annuali").delete().eq("id", viva.id);

    const esito = await titolare.rpc("chiudi_anno", {
      p_entity_id: srls,
      p_anno: ANNO,
      p_conferma_conti_senza_documento: true,
      p_note: `${MARCA} terza`,
    });
    expect(esito.error, spiega(esito)).toBeNull();
    mie.segna("chiusure_annuali", esito.data);

    const { data: riga } = await titolare
      .from("chiusure_annuali")
      .select("chiusure_precedenti, prima_chiusura_il")
      .eq("id", esito.data)
      .single();

    // 🔴 ED E' QUI CHE LA VECCHIA FORMA CADEVA. Il valore è `base + 2`,
    //    cioè **almeno 2**, qualunque sia la base: un `toBe(1)` scritto a
    //    mano sarebbe rosso sempre, e un `toBe(0)` anche. Il difetto non
    //    era il numero scelto — era aver scritto un numero invece di una
    //    relazione.
    // ⚠️ E la relazione si verifica ESATTA, non «almeno»: ogni
    //    cancellazione vale esattamente una rifotografia in più.
    expect(
      Number(riga.chiusure_precedenti),
      `il conteggio deve seguire la storia: base ${base} + due cancellazioni`
    ).toBe(base + 2);
    expect(riga.prima_chiusura_il, "la prima volta non si è persa").not.toBeNull();
  });
});
