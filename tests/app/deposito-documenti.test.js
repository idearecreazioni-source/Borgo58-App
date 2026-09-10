import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CORSA, clientAutenticato, credenziali } from "./aiuto";

// =====================================================================
// IL DEPOSITO DEI DOCUMENTI — 10/09/2026, dal collaudo di Alessio
// =====================================================================
// 🔴 IL FATTO: sul progetto di prova la lettura di un documento
//    funzionava, e premendo «Salva nell'Archivio» compariva «new row
//    violates row-level security policy». Misurato: veniva respinto il
//    caricamento del FILE, perché sul deposito (`storage.objects`) del
//    progetto di prova non c'era nessuna delle quattro regole che in
//    produzione ci sono. Curato dalla migrazione `20260910000003`.
//
// ⚠️ PERCHÉ UNA PROVA DAL CLIENT: una regola di accesso si prova solo col
//    token di un utente vero (§8, 16/08) — dentro una migrazione si gira
//    come proprietari. E il caricamento passa dal servizio dei file, non
//    dal database: è la strada che usa la schermata.
//
// ⚠️ NIENTE RIGA IN `documents`: quella tabella è sorvegliata dal registro
//    delle cancellazioni, e una prova che la crea e la cancella lascerebbe
//    una lapide (tests/app/LEGGIMI.md). La scheda la prova la verifica della
//    migrazione, che si annulla da sola; la sequenza della schermata —
//    lettura, correzione, salvataggio — la prova
//    `tests/schermate/archivio-documento-prima.test.jsx`.

const CASSETTO = "documents";
// Un percorso che dice di chi è: se una pulizia saltasse, il file resterebbe
// riconoscibile come prova, e `npm run deposito:orfani` lo mostrerebbe.
const percorso = (chi) => `test-auto-deposito-${CORSA}-${chi}-${crypto.randomUUID()}.txt`;
const DEL_TITOLARE = percorso("titolare");
const CONTENUTO = "prova del deposito dei documenti";

const unFile = (testo) => new Blob([testo], { type: "text/plain" });
const carica = (client, dove, testo) =>
  client.storage.from(CASSETTO).upload(dove, unFile(testo), { upsert: false, contentType: "text/plain" });

describe("il deposito dei documenti", () => {
  let titolare;
  let staff;
  const caricati = [];

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
  });

  afterAll(async () => {
    // ⚠️ Solo i file che questa prova ha caricato, per percorso (regola del
    //    23/08).
    if (caricati.length) await titolare.storage.from(CASSETTO).remove(caricati);
  });

  it("🔴 il titolare carica un file, come fa «Salva nell'Archivio», e lo riapre", async () => {
    const { error } = await carica(titolare, DEL_TITOLARE, CONTENUTO);
    expect(error?.message ?? null, "il deposito ha respinto il file del titolare").toBeNull();
    caricati.push(DEL_TITOLARE);

    // Un file che entra e non si può riaprire non è archiviato.
    const { data, error: eLetto } = await titolare.storage.from(CASSETTO).download(DEL_TITOLARE);
    expect(eLetto).toBeNull();
    expect(await data.text()).toBe(CONTENUTO);
  });

  it("🔴 lo staff non vede il file del titolare", async () => {
    // ⚠️ La regola restrittiva si prova su un file CHE C'È (§5 punto 2): su
    //    un cassetto vuoto «lo staff non lo vede» passerebbe anche senza
    //    nessuna regola.
    expect(caricati, "manca il file del titolare: la prova sopra non è passata").toContain(DEL_TITOLARE);
    const { data, error } = await staff.storage.from(CASSETTO).download(DEL_TITOLARE);
    expect(data, "lo staff ha scaricato il file del titolare").toBeNull();
    expect(error).not.toBeNull();
  });

  it("🔴 e lo staff non carica niente nel cassetto dei documenti", async () => {
    const suo = percorso("staff");
    const { error } = await carica(staff, suo, "non dovrebbe entrare");
    if (!error) caricati.push(suo); // se passasse, va tolto lo stesso
    expect(error, "lo staff ha caricato un file nell'Archivio").not.toBeNull();
    expect(error.message).toMatch(/row-level security/i);
  });

  it("⚠️ il titolare toglie il suo file, e il deposito non lo conosce più", async () => {
    // 🔴 COSA SI GUARDA, e perché non è più il download — 10/09/2026.
    //    Questa prova scaricava il file subito dopo averlo tolto, e su
    //    GitHub una volta lo ha ancora ricevuto. Misurato sul progetto di
    //    prova: il download passa da una cache (Cloudflare), e la seconda
    //    richiesta dello stesso file è servita da lì (`cf-cache-status:
    //    HIT`), anche con «cacheNonce». La documentazione di Supabase
    //    (Smart CDN) dice che dopo una cancellazione la cache si invalida
    //    «fino a 60 secondi» dopo, un centro dati alla volta. Il download
    //    misurava quella cache, non la cancellazione.
    //    ⚠️ Lo staff NON ha mai ricevuto la copia del titolare dalla cache
    //    (misurato: 400, non dalla cache): non è una fuga fra utenti.
    //
    //    Si guarda allora il deposito stesso, per due strade, PRIMA e DOPO:
    //    il link firmato — che è come il gestionale apre un documento
    //    (`getDocumentUrl`) — e l'elenco dei file. Misurato: prima si crea
    //    ed è elencato, dopo «Object not found» e assente. Il PRIMA è ciò che
    //    rende il DOPO una prova: senza, due strade rotte passerebbero.
    const deposito = titolare.storage.from(CASSETTO);
    const elencato = async () =>
      ((await deposito.list("", { search: DEL_TITOLARE })).data ?? []).some((f) => f.name === DEL_TITOLARE);

    const prima = await deposito.createSignedUrl(DEL_TITOLARE, 60);
    expect(prima.error, "prima di toglierlo il link non si crea: la prova non discrimina").toBeNull();
    expect(await elencato(), "prima di toglierlo il file non è nell'elenco").toBe(true);

    // ⚠️ Una cancellazione che la regola non ammette NON dà errore: torna
    //    «riuscita» con zero file tolti (§8, 26/08). Quindi si conta.
    const { data: tolti, error } = await deposito.remove([DEL_TITOLARE]);
    expect(error).toBeNull();
    expect(tolti, "la cancellazione non ha tolto il file").toHaveLength(1);
    caricati.splice(caricati.indexOf(DEL_TITOLARE), 1);

    const dopo = await deposito.createSignedUrl(DEL_TITOLARE, 60);
    expect(dopo.data, "dopo la cancellazione si crea ancora un link al file").toBeNull();
    expect(dopo.error?.message ?? "").toMatch(/not found/i);
    expect(await elencato(), "dopo la cancellazione il file è ancora nell'elenco").toBe(false);
  });
});
