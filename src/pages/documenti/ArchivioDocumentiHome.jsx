import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDocument,
  getDocumentUrl,
  listDocuments,
  sezioniArchivio,
  updateDocument,
  uploadDocumentFile,
} from "../../lib/api/documents";
import { getEntities } from "../../lib/api/entities";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { leggiFileDaArchiviare } from "../../lib/api/assistente";
import {
  campiProposti,
  cosaNonHoCapito,
  dateDaDistinguere,
} from "../../lib/calcoli/propostaDocumento";
import { contaPostaInAttesa } from "../../lib/api/posta";
import { formatDate, formatEUR } from "../../lib/constants";

// 🔴 L'ELENCO DEI TIPI E' CHIUSO DAL 30/08/2026, e non vive piu' qui.
// Prima erano otto SUGGERIMENTI su un campo di testo libero: si potevano
// ignorare, e «Fattura», «fattura» e «Fatture» diventavano tre sezioni
// diverse. Le otto sezioni vere le ha decise Alessio e stanno nel database
// (`sezioni_archivio`), dove un legame impedisce di scriverne una nona.
// ⚠️ Le vecchie scritte a mano non sono state buttate: sono nel catalogo
//    SPENTE, quindi restano legali per i documenti che le portano e non si
//    propongono piu' (regola del 27/08).

const emptyForm = {
  title: "", doc_type: "", document_date: "", counterparties: "", amount: "", expiry_date: "", note: "",
};

const daysTo = (d) => Math.round((new Date(d) - new Date()) / 86400000);

export default function ArchivioDocumentiHome() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState(null);
  // Quanta posta aspetta una decisione. Il numero sta qui perché è qui
  // che si viene a cercare un documento: il momento giusto per accorgersi
  // che ce n'è dell'altro da guardare.
  const [postaInAttesa, setPostaInAttesa] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [sezioni, setSezioni] = useState([]);
  const [search, setSearch] = useState("");
  // Quello che si sta ancora scrivendo, e quello su cui si cerca davvero.
  // Prima partiva una richiesta a OGNI tasto premuto: scrivere «locazione»
  // ne mandava nove, di cui otto già inutili quando arrivava la risposta —
  // e le risposte potevano tornare in ordine sparso, mostrando i risultati
  // di «locazi» sopra quelli di «locazione».
  const [cercato, setCercato] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  // Il documento prima, i dati dopo (10/09/2026): cosa il gestionale ha
  // letto nel file, e cosa propone di scriverci sopra.
  const [leggendo, setLeggendo] = useState(false);
  const [proposta, setProposta] = useState(null);
  const [testo, setTesto] = useState(null);

  useEffect(() => {
    // 🔴 Due letture accessorie che tacevano. La prima riempie il menu
    // delle società: vuoto, si archivia un documento SENZA società e
    // nessuno lo segnala. La seconda è il numero sul pulsante della posta:
    // assente, si legge «non c'è niente in attesa».
    leggi(getEntities()).then(setEntities);
    leggi(contaPostaInAttesa()).then(setPostaInAttesa);
    // ⚠️ E la terza: senza le sezioni il menu resta vuoto e non si puo'
    //    archiviare niente. `leggi` fa in modo che una lettura fallita si
    //    denunci invece di sembrare «non ce ne sono».
    leggi(sezioniArchivio()).then(setSezioni);
  }, []);

  const reload = () => listDocuments({ search: cercato || undefined }).then(setDocuments);

  // Stessa attesa del salvataggio automatico delle note (700 ms sarebbe
  // troppo per una ricerca, che deve sembrare istantanea): si aspetta che
  // le dita si fermino un momento.
  useEffect(() => {
    const t = setTimeout(() => setCercato(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cercato]);

  // 🔴 L'ARCHIVIO SI GUARDA A SEZIONI (30/08/2026, richiesta di Alessio).
  //    Prima era un elenco solo, ordinato per data: per trovare una fattura
  //    bisognava scorrere anche i contratti e le pratiche.
  // ⚠️ L'ORDINE DELLE SEZIONI E' QUELLO DEL CATALOGO, non alfabetico e non
  //    per quantita': lo ha deciso lui, e una sezione che si sposta perche'
  //    e' cresciuta e' una sezione che si cerca due volte.
  // ⚠️ E UNA SEZIONE VUOTA NON COMPARE: qui si cerca un documento, e otto
  //    riquadri di cui sei vuoti sono sei righe da saltare ogni volta. Che
  //    la sezione esista si vede aprendo il menu del modulo.
  // ⚠️ I documenti SENZA sezione stanno in fondo e si dicono: sono i due
  //    scritti prima che l'elenco fosse chiuso, e vanno sistemati a mano —
  //    nasconderli li farebbe sparire dall'archivio.
  // ⚠️ Il segno «non letto» non e' un elenco: si guarda PRIMA di usarlo.
  //    Qui diventa un elenco vuoto per non far cadere il raggruppamento,
  //    e il menu del modulo lo dichiara al posto suo — cosi' l'assenza
  //    non si traveste da «non ce ne sono».
  const elencoSezioni = useMemo(() => (nonLetto(sezioni) ? [] : sezioni), [sezioni]);

  const perSezione = useMemo(() => {
    const gruppi = new Map();
    for (const d of documents) {
      const chiave = d.doc_type ?? "";
      if (!gruppi.has(chiave)) gruppi.set(chiave, []);
      gruppi.get(chiave).push(d);
    }
    const ordinate = elencoSezioni
      .filter((s) => gruppi.has(s.codice))
      .map((s) => ({ codice: s.codice, titolo: s.etichetta, righe: gruppi.get(s.codice) }));
    // Una sezione che i documenti portano ma che il catalogo non offre piu'
    // (spenta, e quindi fuori da `sezioni`) non deve sparire dall'elenco.
    for (const [codice, righe] of gruppi) {
      if (codice && !ordinate.some((o) => o.codice === codice)) {
        ordinate.push({ codice, titolo: codice, righe });
      }
    }
    if (gruppi.has("")) {
      ordinate.push({ codice: "", titolo: "Senza sezione", righe: gruppi.get("") });
    }
    return ordinate;
  }, [documents, elencoSezioni]);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  // 🔴 IL DOCUMENTO PRIMA, I DATI DOPO — 10/09/2026, Blocco 4 del mandato.
  //
  // Si sceglie il file, il gestionale lo legge, e la scheda arriva **già
  // compilata**. Prima chi archiviava doveva copiare a mano nome, tipo e
  // data da un foglio che aveva davanti — e copiare a mano è il posto dove
  // nascono gli errori che nessuno rilegge.
  //
  // 🔴 E NIENTE ENTRA NELL'ARCHIVIO PRIMA DEL «SALVA». Il file viaggia
  //    dentro la richiesta, viene letto, e finisce lì: non tocca il
  //    deposito e non tocca il database. È una **proprietà**, non un
  //    controllo — non c'è nessun posto da cui togliere qualcosa se poi
  //    Alessio cambia idea.
  const scegliFile = async (scelto) => {
    setFile(scelto);
    setProposta(null);
    setTesto(null);
    setError("");
    if (!scelto) return;
    setLeggendo(true);
    try {
      const r = await leggiFileDaArchiviare(scelto);
      setProposta(r?.proposta ?? null);
      setTesto(r?.testo ?? null);
      const campi = campiProposti(r?.proposta, elencoSezioni);
      // ⚠️ SI PROPONE SOPRA IL VUOTO, non sopra quello che c'è: se qualcuno
      //    aveva già scritto un titolo a mano, quello vince. Una lettura
      //    che cancella quello che una persona ha appena scritto è il
      //    difetto del 12/08, pagato una volta.
      setForm((f) => ({
        ...f,
        title: f.title || campi.title,
        doc_type: f.doc_type || campi.doc_type,
        document_date: f.document_date || campi.document_date,
        counterparties: f.counterparties || campi.counterparties,
        amount: f.amount || campi.amount,
        expiry_date: f.expiry_date || campi.expiry_date,
      }));
    } catch (e) {
      // ⚠️ Una lettura fallita NON impedisce di archiviare: la scheda si
      //    compila a mano come si è sempre fatto, e lo si dice.
      setError(`Non sono riuscito a leggere il file: ${e.message} — la scheda si compila a mano.`);
    } finally {
      setLeggendo(false);
    }
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      let fileInfo = {};
      if (file) fileInfo = await uploadDocumentFile(file);
      const nato = await createDocument({
        entity_id: form.entity_id || null,
        title: form.title.trim(),
        doc_type: form.doc_type || null,
        document_date: form.document_date || null,
        counterparties: form.counterparties || null,
        amount: form.amount ? Number(form.amount) : null,
        expiry_date: form.expiry_date || null,
        note: form.note || null,
        ...fileInfo,
      });
      // 🔴 IL TESTO GIÀ LETTO SI CONSERVA, e non è un di più: senza, il
      //    documento nascerebbe **cieco** — «Chiedi all'archivio»
      //    risponderebbe «non ce l'ho» su un file appena letto, e
      //    bisognerebbe premere «Leggi il contenuto» dalla sua scheda,
      //    cioè pagare due volte la stessa lettura.
      // ⚠️ Si scrive con un `update` su UNA colonna di UNA tabella, che è
      //    la categoria A del Contratto: nessuna conseguenza altrove, la
      //    RLS è la barriera. È lo stesso gesto che fa `documento-leggi`.
      // ⚠️ E se non riesce NON si finge: il documento c'è, il testo no, e
      //    lo si dice — perché chi non lo sa crederebbe di poterci fare una
      //    domanda.
      if (testo && nato) {
        try {
          await updateDocument(typeof nato === "string" ? nato : nato.id, { testo });
        } catch (e) {
          setError(
            `Il documento è archiviato, ma il testo letto non si è salvato: ${e.message}. ` +
              "Apri la sua scheda e premi «Leggi il contenuto»."
          );
        }
      }
      setForm(emptyForm);
      setFile(null);
      setProposta(null);
      setTesto(null);
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (doc) => {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  const expiringSoon = useMemo(
    () => documents.filter((d) => d.expiry_date && daysTo(d.expiry_date) <= 60),
    [documents]
  );

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
            Archivio Documenti
            <Didascalia>
              Contratti, licenze, assicurazioni, atti. Quelli con una scadenza generano
              da soli un promemoria in Agenda. I file sono conservati in modo privato su
              server europei, solo per te.
            </Didascalia>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/documenti/chiedi")}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
          >
            Chiedi all'archivio
          </button>
          <button
            onClick={() => navigate("/documenti/posta")}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
          >
            Posta in arrivo
            {nonLetto(postaInAttesa) && (
              <span className="ml-2 testo-sala text-b58-terracotta-dark">· non so quanta ce n&apos;è</span>
            )}
            {!nonLetto(postaInAttesa) && postaInAttesa > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-b58-gold text-b58-parchment testo-sala font-medium px-2 py-0.5">
                {postaInAttesa}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala-grande font-medium px-4 py-2"
          >
            {showForm ? "Annulla" : "+ Nuovo documento"}
          </button>
        </div>
      </div>

      {/* ⚠️ RESTA VISIBILE, e accorciato al solo limite: dice che «Chiedi
          all'archivio» NON risponde sui documenti di cui non conosce il
          testo. Nasconderlo dietro un segno renderebbe un «non risulta»
          che vuol dire «non ho guardato lì» indistinguibile da un «non
          c'è» — che è il difetto contro cui quella schermata è nata. Il
          resto della spiegazione è passato nel segno accanto al titolo. */}
      <p className="testo-sala text-b58-charcoal-soft mb-4">
        ⚠️ Quelli caricati a mano vanno aperti e letti una volta: «Chiedi all&apos;archivio»
        risponde solo sui documenti di cui conosce il testo.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {showForm && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          {/* 🔴 IL DOCUMENTO PRIMA, I DATI DOPO — 10/09/2026.
              Il file sta in CIMA e non più in fondo: è il primo gesto, non
              un allegato. Sotto, quello che il gestionale ne ha ricavato. */}
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4 mb-3">
            <label className={labelClass}>1 · Il documento</label>
            {/* ⚠️ Il pulsante «Scegli file» lo disegna il browser con una
                misura sua: non si può ingrandire, e non è un nostro
                bersaglio di tocco. */}
            <input
              type="file"
              onChange={(e) => scegliFile(e.target.files?.[0] ?? null)}
              className="max-w-full tocco-campo testo-sala-grande text-b58-charcoal-soft"
            />
            {leggendo && (
              <p className="testo-sala-grande text-b58-charcoal-soft mt-2">
                Sto leggendo il documento…
              </p>
            )}
            {!leggendo && proposta && (
              <div className="mt-2">
                <p className="testo-sala-grande text-b58-olive-dark">
                  L&apos;ho letto: qui sotto c&apos;è quello che ne ho ricavato. Correggi
                  quello che non va — <strong>niente entra nell&apos;Archivio finché non
                  premi Salva</strong>.
                </p>
                {/* 🔴 QUELLO CHE NON HO CAPITO SI DICE. Una scheda compilata
                    a metà senza dire quale metà manca si legge come una
                    scheda completa: i campi vuoti sembrano campi che nel
                    documento non c'erano. */}
                {[...cosaNonHoCapito(proposta, campiProposti(proposta, elencoSezioni)),
                  ...(Array.isArray(proposta.non_ho_capito) ? proposta.non_ho_capito : [])]
                  .length > 0 && (
                  <p className="testo-sala text-b58-terracotta-dark mt-1">
                    Non ho capito:{" "}
                    {[...cosaNonHoCapito(proposta, campiProposti(proposta, elencoSezioni)),
                      ...(Array.isArray(proposta.non_ho_capito) ? proposta.non_ho_capito : [])]
                      .join(" · ")}
                    . Riempi tu quello che manca.
                  </p>
                )}
                {/* 🔴 PIÙ DI UNA DATA SI MOSTRA TUTTA. Un documento ha quasi
                    sempre la data della firma, quella di decorrenza e quella
                    di scadenza: sceglierne una in silenzio vuol dire
                    archiviarlo sotto l'anno sbagliato senza che nessun
                    errore lo dica. */}
                {dateDaDistinguere(proposta).length > 0 && (
                  <p className="testo-sala text-b58-charcoal-soft mt-1">
                    Nel documento ci sono più date:{" "}
                    {dateDaDistinguere(proposta)
                      .map((d) => `${formatDate(d.data)} (${d.cosa})`)
                      .join(" · ")}
                    . Ho messo la prima — cambiala se non è quella giusta.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
            <label className={labelClass}>2 · La scheda</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titolo del documento" className={`${inputClass} sm:col-span-2`} />
              {/* ⚠️ Un menu, non un campo libero: e' il vocabolario chiuso che
                  fa esistere le sezioni. E la prima voce dice «Sezione…»
                  invece di essere gia' una scelta — un menu che si apre su
                  «Fatture ricevute» archivierebbe li' tutto quello che
                  nessuno guarda. */}
              {nonLetto(sezioni) ? (
                <DatoNonLetto cosa="le sezioni dell'archivio" nonVuolDire="che non ce ne siano" />
              ) : (
              <select value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))} className={inputClass}>
                <option value="">Sezione…</option>
                {elencoSezioni.map((s) => (
                  <option key={s.codice} value={s.codice}>{s.etichetta}</option>
                ))}
              </select>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelClass}>Data documento</label>
                <input type="date" value={form.document_date} onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Scadenza</label>
                <input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Importo €</label>
                <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} />
              </div>
              {nonLetto(entities) && (
                <DatoNonLetto cosa="le società" className="self-end pb-2" />
              )}
              {!nonLetto(entities) && entities && (
                <div>
                  <label className={labelClass}>Entità</label>
                  <select value={form.entity_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))} className={inputClass}>
                    <option value="">—</option>
                    <option value={entities.srls.id}>{entities.srls.name}</option>
                    {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
                  </select>
                </div>
              )}
            </div>
            <input value={form.counterparties} onChange={(e) => setForm((f) => ({ ...f, counterparties: e.target.value }))} placeholder="Controparti (opz., es. locatore, assicurazione)" className={`${inputClass} mb-3`} />
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Nota (opz.)" className={`${inputClass} mb-3`} />
            {/* ⚠️ IL FILE NON È PIÙ QUI (10/09/2026): è salito in cima, come
                primo gesto. Restava anche un secondo campo per sceglierlo —
                due porte per la stessa cosa, e la seconda avrebbe scavalcato
                la lettura senza dirlo. */}
            <div className="flex items-center justify-end gap-3 flex-wrap">
              <button
                type="button"
                disabled={saving || leggendo || !form.title.trim()}
                onClick={handleAdd}
                className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
              >
                {saving ? "Salvo…" : "+ Salva nell'Archivio"}
              </button>
            </div>
            <p className="testo-sala text-b58-charcoal-soft/70 mt-2">Il file è opzionale: puoi anche registrare solo i metadati. Con una scadenza, viene creato un promemoria in Agenda.</p>
          </div>
        </div>
      )}

      {/* In scadenza */}
      {expiringSoon.length > 0 && (
        <div className="rounded-xl bg-b58-terracotta/5 ring-1 ring-b58-terracotta/30 p-5 mb-6">
          <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">In scadenza (60 giorni)</h2>
          <ul className="space-y-1.5">
            {expiringSoon.map((d) => {
              const days = daysTo(d.expiry_date);
              return (
                <li key={d.id} className="testo-sala-grande flex items-center justify-between gap-2">
                  <button onClick={() => navigate(`/documenti/${d.id}`)} className="text-b58-charcoal hover:text-b58-terracotta text-left">
                    {d.title}
                  </button>
                  <span className={days < 0 ? "text-b58-terracotta-dark font-medium" : "text-b58-gold-dark"}>
                    {days < 0 ? `scaduto (${formatDate(d.expiry_date)})` : `${formatDate(d.expiry_date)} (${days}gg)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per titolo, tipo, controparti…"
        className={`${inputClass} max-w-sm mb-4`}
      />

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">{search ? "Nessun documento corrisponde." : "Nessun documento ancora."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {perSezione.map((sez) => (
            <section key={sez.codice || "(senza)"}>
              <h2 className="font-display testo-sala-grande text-b58-charcoal mb-2">
                {sez.titolo}{" "}
                <span className="testo-sala text-b58-charcoal-soft font-normal">({sez.righe.length})</span>
              </h2>
              <ul className="space-y-2">
          {sez.righe.map((d) => (
            <li key={d.id} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 flex items-start justify-between gap-3">
              {/* ⚠️ 6,53 mm misurati il 31/08: sotto la soglia degli 8,5.
                  Il riquadro sembra grande — ha `p-4` — ma il padding non
                  si preme: il bersaglio e' il pulsante, e finiva alto quanto
                  le sue due righe di testo. Preesistente, non nato stanotte. */}
              <button onClick={() => navigate(`/documenti/${d.id}`)} className="text-left min-w-0 tocco-campo">
                <div className="text-b58-charcoal font-medium">{d.title}</div>
                <div className="testo-sala text-b58-charcoal-soft mt-0.5">
                  {d.document_date && <>{formatDate(d.document_date)} · </>}
                  {d.counterparties && <>{d.counterparties} · </>}
                  {d.amount != null && <>{formatEUR(d.amount)} · </>}
                  {d.expiry_date && <>scade {formatDate(d.expiry_date)}</>}
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                {d.storage_path && (
                  <button onClick={() => openFile(d)} className="tocco-testo testo-sala text-b58-terracotta hover:text-b58-terracotta-dark">
                    Apri file
                  </button>
                )}
              </div>
            </li>
          ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
