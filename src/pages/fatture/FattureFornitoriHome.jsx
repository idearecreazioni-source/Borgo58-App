import { useEffect, useMemo, useState } from "react";
import {
  annullaPagamentoFattura,
  anteprimaPagamento,
  collegaDocumentoAFattura,
  createSupplierInvoice,
  creditiFornitore,
  creditiPerFattura,
  deleteSupplierInvoice,
  eliminaNotaCredito,
  listSupplierInvoices,
  markInvoicePaid,
  registraNotaCredito,
  ultimeFatturePagate,
  updateSupplierInvoice,
} from "../../lib/api/supplierInvoices";
import { listDocuments } from "../../lib/api/documents";
import { listSuppliers } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { PAYMENT_METHODS, formatDate, formatEUR, labelFor, oggiLocale } from "../../lib/constants";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import FormNotaCredito from "../../components/FormNotaCredito";

const emptyForm = {
  entity_id: "",
  supplier_id: "",
  invoice_number: "",
  invoice_date: "",
  due_date: "",
  amount: "",
  document_reference: "",
  note: "",
};

// Stesso criterio di urgenza già usato in Magazzino per le scadenze.
const dueUrgency = (dateStr) => {
  if (!dateStr) return "neutral";
  const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (days < 3) return "danger";
  if (days < 7) return "warning";
  return "neutral";
};

const QUANTE_PAGATE = 20;

export default function FattureFornitoriHome() {
  const [daPagare, setDaPagare] = useState([]);
  const [pagate, setPagate] = useState({ righe: [], quante: 0 });
  // Il debito INTERO, che nessun filtro tocca: vedi ricarica.
  const [tutteDaPagare, setTutteDaPagare] = useState([]);
  // Il credito ancora da usare, per fornitore: sono soldi di Alessio, e un
  // credito che nessuno ricorda è un credito perso.
  const [crediti, setCrediti] = useState([]);
  const [filtri, setFiltri] = useState({ supplierId: "", dal: "", al: "" });
  const [entities, setEntities] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [documenti, setDocumenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [payingId, setPayingId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("bonifico");
  // Il giorno in cui i soldi escono: di partenza oggi, e con l'assegno lo
  // si sposta in avanti. Non ha un valore predefinito «fra 30 giorni»: una
  // data inventata da me sposterebbe il saldo di chi non ci ha pensato.
  const [dataUscita, setDataUscita] = useState(oggiLocale());
  const [riferimento, setRiferimento] = useState("");
  const [paying, setPaying] = useState(false);
  // I crediti proponibili su QUESTA fattura, quali si è scelto di usare, e
  // i numeri che ne uscirebbero — che arrivano dal database, non da una
  // somma fatta qui: due crediti da 30 su una fattura da 40 si applicano
  // per 40 in tutto, e una somma in schermata direbbe 60.
  const [creditiFattura, setCreditiFattura] = useState([]);
  const [noteScelte, setNoteScelte] = useState([]);
  const [anteprima, setAnteprima] = useState(null);

  const [notaPerId, setNotaPerId] = useState(null);
  const [docPerId, setDocPerId] = useState(null);

  // Le due liste si chiedono separate: quelle da pagare tutte (è l'elenco
  // di cosa c'è da fare), le pagate solo le ultime.
  //
  // ⚠️ E IL DEBITO TOTALE SI CHIEDE A PARTE, SENZA FILTRI. È la decisione
  // che conta di tutto il n. 9: un totale «da pagare» che si rimpicciolisce
  // perché si è filtrato un fornitore somiglia in tutto a un debito più
  // piccolo. Il filtro cambia cosa si GUARDA, non quanto si DEVE — e la
  // schermata dichiara che il totale è intero quando un filtro è attivo.
  const ricarica = async (f = filtri, enti = entities) => {
    const [aperte, chiuse, tutteAperte] = await Promise.all([
      listSupplierInvoices({ status: "da_pagare", supplierId: f.supplierId, dal: f.dal, al: f.al }),
      ultimeFatturePagate(QUANTE_PAGATE, f),
      listSupplierInvoices({ status: "da_pagare" }),
    ]);
    setDaPagare(aperte);
    setPagate(chiuse);
    setTutteDaPagare(tutteAperte);

    // ⚠️ I crediti si chiedono per SOCIETÀ, e per tutte quelle che
    // esistono: un credito con un fornitore dell'azienda agricola non è
    // spendibile dalla S.r.l.s., e mescolarli darebbe un numero che non è
    // di nessuna delle due (stessa regola dei totali del «da pagare»).
    const lista = [enti?.srls, enti?.agricola].filter(Boolean);
    const perEnte = await Promise.all(
      lista.map(async (e) => (await creditiFornitore(e.id)).map((c) => ({ ...c, societa: e.name })))
    );
    setCrediti(perEnte.flat());
  };

  const load = async () => {
    const ent = await getEntities();
    setEntities(ent);
    setForm((f) => (f.entity_id ? f : { ...f, entity_id: ent.srls.id }));
    const [, sup, doc] = await Promise.all([
      ricarica(filtri, ent),
      listSuppliers(ent.srls.id),
      listDocuments(),
    ]);
    setSuppliers(sup);
    setDocumenti(doc ?? []);
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // Solo al primo montaggio: `load` legge lo stato iniziale e i ricarichi
    // successivi li fanno i gesti, non l'effetto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚠️ Due società, due debiti — mai un totale solo. La S.r.l.s. e
  // l'azienda agricola sono due soggetti fiscali distinti: chi paga le
  // fatture dell'una non sono i soldi dell'altra, e un numero che le
  // somma non è il debito di nessuna delle due. Si mostra un totale per
  // società, e solo per quelle che hanno qualcosa da pagare.
  //
  // ⚠️ E si somma `da_pagare`, non `amount`: con una nota di credito
  // addosso il debito è più basso dell'importo della fattura, e sommare
  // gli importi direbbe di dover pagare soldi che non si devono più.
  const totaliPerSocieta = useMemo(() => {
    const per = new Map();
    for (const i of tutteDaPagare) {
      const nome = i.entity?.name ?? "Senza società";
      const riga = per.get(nome) ?? { nome, totale: 0, quante: 0, scalato: 0 };
      riga.totale += Number(i.da_pagare ?? i.amount);
      riga.scalato += Number(i.note_scalate ?? 0);
      riga.quante += 1;
      per.set(nome, riga);
    }
    return [...per.values()].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [tutteDaPagare]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-[11px] text-b58-charcoal-soft mb-1";

  const filtroAttivo = Boolean(filtri.supplierId || filtri.dal || filtri.al);

  // Il filtro cambia e si ricarica subito: nessun pulsante «cerca», che su
  // tre campi sarebbe un passaggio in piu' per niente.
  const cambiaFiltro = async (patch) => {
    const nuovi = { ...filtri, ...patch };
    setFiltri(nuovi);
    setError("");
    try {
      await ricarica(nuovi);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEntityChange = async (entityId) => {
    setForm((f) => ({ ...f, entity_id: entityId, supplier_id: "" }));
    setSuppliers(await listSuppliers(entityId));
  };

  const handleAdd = async () => {
    if (!form.supplier_id || !form.invoice_date || !form.amount) return;
    setSaving(true);
    setError("");
    try {
      await createSupplierInvoice({
        entityId: form.entity_id,
        supplierId: form.supplier_id,
        invoiceNumber: form.invoice_number,
        invoiceDate: form.invoice_date,
        dueDate: form.due_date,
        amount: Number(form.amount),
        documentReference: form.document_reference,
        note: form.note,
      });
      setForm((f) => ({ ...emptyForm, entity_id: f.entity_id }));
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Aprire il modulo del pagamento chiede al database due cose: quali
  // crediti si potrebbero usare, e cosa uscirebbe senza usarne nessuno.
  const apriPagamento = async (inv) => {
    setPayingId(inv.id);
    setPaymentMethod("bonifico");
    setDataUscita(oggiLocale());
    setRiferimento("");
    setNoteScelte([]);
    setCreditiFattura([]);
    setAnteprima(null);
    setError("");
    try {
      const [proposte, ante] = await Promise.all([
        creditiPerFattura(inv.id),
        anteprimaPagamento(inv.id, []),
      ]);
      setCreditiFattura(proposte);
      setAnteprima(ante);
    } catch (e) {
      setError(e.message);
    }
  };

  const cambiaCredito = async (invId, notaId) => {
    const nuove = noteScelte.includes(notaId)
      ? noteScelte.filter((x) => x !== notaId)
      : [...noteScelte, notaId];
    setNoteScelte(nuove);
    try {
      setAnteprima(await anteprimaPagamento(invId, nuove));
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePay = async (id) => {
    setPaying(true);
    setError("");
    try {
      await markInvoicePaid(id, {
        paymentMethod,
        dataUscita,
        riferimento,
        noteDaUsare: noteScelte,
      });
      setPayingId(null);
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async (id) => {
    setError("");
    try {
      await deleteSupplierInvoice(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // ⚠️ Correggere invece di «cancella e rifai» (Blocco 5.2 del mandato di
  // correzione). Su una fattura già pagata l'importo NON si tocca da qui:
  // quel numero è uscito dalla cassa, e cambiarlo lo scollegherebbe in
  // silenzio dal movimento che lo giustifica. Per quello si annulla prima
  // il pagamento — è la stessa regola del Blocco 1, e Alessio l'ha
  // confermata come precedente per i casi analoghi.
  //
  // ⚠️ E dal 17/08 il database respinge anche un importo più basso delle
  // note di credito già scalate: si pagherebbe un numero negativo.
  const correggi = async (id, patch) => {
    setError("");
    try {
      await updateSupplierInvoice(id, patch);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // La via di ritorno di «Segna pagata». Senza, una fattura segnata
  // pagata per sbaglio resterebbe pagata per sempre: l'uscita in prima
  // nota la rende non cancellabile, ed è giusto — ma un rifiuto senza
  // gesto di uscita è un vicolo cieco.
  const handleAnnullaPagamento = async (id) => {
    setError("");
    try {
      await annullaPagamentoFattura(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const salvaNota = async (inv, dati) => {
    setError("");
    try {
      await registraNotaCredito({
        entityId: inv.entity_id,
        supplierId: inv.supplier_id,
        fatturaId: inv.id,
        ...dati,
      });
      setNotaPerId(null);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const togliNota = async (notaId) => {
    setError("");
    try {
      await eliminaNotaCredito(notaId);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const collega = async (documentId, invoiceId) => {
    setError("");
    try {
      await collegaDocumentoAFattura(documentId, invoiceId);
      setDocumenti(await listDocuments());
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // ⚠️ I tre numeri insieme, sempre: «fattura 250 · nota −40 · da pagare
  // 210». Mostrare solo il terzo farebbe sembrare che manchino 40 euro;
  // mostrare solo il primo è il difetto che il n. 8 chiude.
  const RigaNote = ({ inv }) =>
    Number(inv.note_scalate ?? 0) > 0 ? (
      <div className="mt-2 text-xs bg-b58-gold/10 rounded px-2 py-1.5">
        <span className="text-b58-charcoal-soft">Fattura {formatEUR(inv.amount)}</span>
        {(inv.utilizzi ?? []).map((u) => (
          <span key={u.id} className="text-b58-charcoal-soft">
            {" · nota "}
            {u.nota?.numero ? `${u.nota.numero} ` : ""}
            <strong className="text-b58-terracotta-dark">−{formatEUR(u.importo)}</strong>
            {inv.status !== "pagata" && (
              <button
                type="button"
                onClick={() => togliNota(u.nota.id)}
                className="ml-1 text-[10px] text-b58-charcoal-soft/70 hover:text-b58-terracotta underline"
              >
                togli
              </button>
            )}
          </span>
        ))}
        <span className="text-b58-charcoal">
          {" · "}
          {inv.status === "pagata" ? "pagati " : "da pagare "}
          <strong>{formatEUR(inv.da_pagare)}</strong>
        </span>
      </div>
    ) : null;

  const RigaDocumenti = ({ inv }) => {
    const liberi = documenti.filter((d) => !d.supplier_invoice_id && d.entity_id === inv.entity_id);
    return (
      <div className="mt-2 pt-2 border-t border-b58-charcoal/10">
        {(inv.documenti ?? []).length > 0 ? (
          <p className="text-xs text-b58-charcoal-soft">
            Documenti collegati: {inv.documenti.map((d) => d.title).join(" · ")}
          </p>
        ) : (
          <p className="text-xs text-b58-charcoal-soft/60">Nessun documento collegato.</p>
        )}
        {docPerId === inv.id && (
          <div className="mt-2">
            {liberi.length === 0 ? (
              <p className="text-[11px] text-b58-charcoal-soft/70">
                Nessun documento libero di questa società nell&apos;Archivio: il DDT va prima
                archiviato lì.
              </p>
            ) : (
              <select
                defaultValue=""
                onChange={(e) => e.target.value && collega(e.target.value, inv.id)}
                className={inputClass}
              >
                <option value="">Collega un documento dell&apos;Archivio…</option>
                {liberi.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                    {d.document_date ? ` — ${formatDate(d.document_date)}` : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-1">
              Un DDT o un contratto è solo un collegamento: nessun conto ci passa dentro. Quello che
              cambia i soldi è la nota di credito, che si registra col pulsante accanto.
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Fatture Fornitori</h1>
          <p className="text-b58-charcoal-soft mt-1">
            Inserimento manuale — sincronizzazione automatica da attivare in futuro (§3.1).
          </p>
        </div>
        <div className="text-right">
          {totaliPerSocieta.length === 0 ? (
            <>
              <div className="text-2xl text-b58-charcoal font-medium">{formatEUR(0)}</div>
              <div className="text-xs text-b58-charcoal-soft">niente da pagare</div>
            </>
          ) : (
            totaliPerSocieta.map((r) => (
              <div key={r.nome} className="mb-1 last:mb-0">
                <div className="text-2xl text-b58-charcoal font-medium">{formatEUR(r.totale)}</div>
                <div className="text-xs text-b58-charcoal-soft">
                  da pagare — {r.nome} ({r.quante})
                </div>
                {r.scalato > 0 && (
                  <div className="text-[11px] text-b58-charcoal-soft/70">
                    già al netto di {formatEUR(r.scalato)} di note di credito
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* IL CREDITO CHE RESTA (n. 8 del collaudo). Sta accanto al «da
          pagare» e non in una schermata a parte: una nota di credito
          arrivata dopo il pagamento è la cosa più facile da dimenticare, e
          sono soldi suoi. */}
      {crediti.length > 0 && (
        <div className="rounded-xl bg-b58-sage/15 ring-1 ring-b58-sage/40 p-4 mb-4">
          <p className="text-sm text-b58-charcoal font-medium mb-1">Crediti da usare</p>
          <ul className="text-sm text-b58-charcoal-soft space-y-0.5">
            {crediti.map((c) => (
              <li key={`${c.societa}-${c.supplier_id}`}>
                <strong className="text-b58-charcoal">{formatEUR(c.residuo)}</strong> con {c.fornitore}
                {" — "}
                {c.societa} ({c.quante} {Number(c.quante) === 1 ? "nota" : "note"})
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">
            Sono note di credito arrivate dopo il pagamento: te le propongo quando registri il
            pagamento della prossima fattura di quel fornitore.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {entities && (
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Nuova fattura</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <select
              value={form.entity_id}
              onChange={(e) => handleEntityChange(e.target.value)}
              className={inputClass}
            >
              <option value={entities.srls.id}>{entities.srls.name}</option>
              {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
            </select>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Fornitore…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              value={form.invoice_number}
              onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
              placeholder="Numero fattura (opz.)"
              className={inputClass}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Importo €"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div>
              <label className="block text-[11px] text-b58-charcoal-soft mb-1">Data fattura</label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] text-b58-charcoal-soft mb-1">Scadenza (opz.)</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <input
              value={form.document_reference}
              onChange={(e) => setForm((f) => ({ ...f, document_reference: e.target.value }))}
              placeholder="Rif. documento (opz.)"
              className={`${inputClass} self-end`}
            />
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opz.)"
              className={`${inputClass} self-end`}
            />
          </div>
          <p className="text-xs text-b58-charcoal-soft/70 mb-2">
            Con una scadenza, viene creato automaticamente un promemoria in Agenda.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || !form.supplier_id || !form.invoice_date || !form.amount}
              onClick={handleAdd}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Registro…" : "+ Registra fattura"}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* I FILTRI (n. 9 del collaudo): «con due fatture si vive, con
          duecento no». Governano ENTRAMBE le liste — da pagare e pagate —
          perché cercare «le fatture di Mililli di marzo» non ha niente a
          che vedere con se sono già state pagate.
          ⚠️ Non toccano i totali qui sopra: vedi `ricarica`. */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[180px]">
          <label className={labelClass}>Fornitore</label>
          <select
            value={filtri.supplierId}
            onChange={(e) => cambiaFiltro({ supplierId: e.target.value })}
            className={inputClass}
          >
            <option value="">Tutti</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Dal (data fattura)</label>
          <input
            type="date"
            value={filtri.dal}
            onChange={(e) => cambiaFiltro({ dal: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Al</label>
          <input
            type="date"
            value={filtri.al}
            onChange={(e) => cambiaFiltro({ al: e.target.value })}
            className={inputClass}
          />
        </div>
        {filtroAttivo && (
          <button
            type="button"
            onClick={() => cambiaFiltro({ supplierId: "", dal: "", al: "" })}
            className="text-sm text-b58-terracotta hover:text-b58-terracotta-dark pb-2"
          >
            Togli i filtri
          </button>
        )}
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Da pagare</h2>
        {/* ⚠️ Con un filtro attivo l'elenco è parziale e i totali no: senza
            dirlo, un elenco corto accanto a un totale grande sembra un
            errore di somma. */}
        <p className="text-xs text-b58-charcoal-soft/70 mb-4">
          {filtroAttivo
            ? `${daPagare.length} di ${tutteDaPagare.length} da pagare — i totali in alto restano quelli interi.`
            : `Tutte e ${tutteDaPagare.length}.`}
        </p>
        {daPagare.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna fattura da pagare.</p>
        ) : (
          <ul className="space-y-2">
            {daPagare.map((inv) => {
              const urgency = dueUrgency(inv.due_date);
              return (
                <li key={inv.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-sm text-b58-charcoal font-medium">{inv.supplier.name}</span>
                      {inv.invoice_number && (
                        <span className="text-xs text-b58-charcoal-soft ml-1.5">#{inv.invoice_number}</span>
                      )}
                      <div className="text-xs text-b58-charcoal-soft">
                        {/* Di chi è questa fattura: senza, i due totali qui
                            sopra non si possono ricontrollare riga per riga. */}
                        {inv.entity?.name && <>{inv.entity.name} · </>}
                        {formatDate(inv.invoice_date)}
                        {inv.due_date && (
                          <span
                            className={
                              urgency === "danger"
                                ? "text-b58-terracotta-dark font-medium"
                                : urgency === "warning"
                                ? "text-b58-gold-dark font-medium"
                                : ""
                            }
                          >
                            {" "}
                            · scade {formatDate(inv.due_date)}
                          </span>
                        )}
                      </div>
                      {inv.note && <p className="text-xs text-b58-charcoal-soft mt-1">{inv.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Correggibili finché la fattura non è pagata: dopo,
                          l'importo è uscito dalla cassa. */}
                      <div>
                        <label className={labelClass}>N. fattura</label>
                        <input
                          defaultValue={inv.invoice_number ?? ""}
                          onBlur={(e) =>
                            (e.target.value.trim() || null) !== inv.invoice_number &&
                            correggi(inv.id, { invoice_number: e.target.value.trim() || null })
                          }
                          className="w-28 rounded border border-b58-charcoal/15 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Importo €</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={inv.amount}
                          onBlur={(e) =>
                            Number(e.target.value) !== Number(inv.amount) &&
                            Number(e.target.value) > 0 &&
                            correggi(inv.id, { amount: Number(e.target.value) })
                          }
                          className="w-24 rounded border border-b58-charcoal/15 px-2 py-1 text-sm text-right font-medium"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotaPerId((id) => (id === inv.id ? null : inv.id))}
                        className="text-xs text-b58-charcoal-soft hover:text-b58-charcoal"
                      >
                        {notaPerId === inv.id ? "Chiudi" : "Nota di credito"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocPerId((id) => (id === inv.id ? null : inv.id))}
                        className="text-xs text-b58-charcoal-soft hover:text-b58-charcoal"
                      >
                        Documenti
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          payingId === inv.id ? setPayingId(null) : apriPagamento(inv)
                        }
                        className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
                      >
                        {payingId === inv.id ? "Annulla" : "Segna pagata"}
                      </button>
                      <ConfermaDistruttiva
                        etichetta="Rimuovi"
                        cosaSparisce={`la fattura ${inv.invoice_number ? `#${inv.invoice_number} ` : ""}di ${inv.supplier.name} da ${formatEUR(inv.amount)}`}
                        onConferma={() => handleDelete(inv.id)}
                      />
                    </div>
                  </div>

                  <RigaNote inv={inv} />
                  {(docPerId === inv.id || (inv.documenti ?? []).length > 0) && (
                    <RigaDocumenti inv={inv} />
                  )}
                  {notaPerId === inv.id && (
                    <FormNotaCredito
                      fattura={inv}
                      onSalva={(dati) => salvaNota(inv, dati)}
                      onAnnulla={() => setNotaPerId(null)}
                    />
                  )}

                  {payingId === inv.id && (
                    <div className="mt-3 pt-3 border-t border-b58-charcoal/10">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="w-36">
                          <label className={labelClass}>Come paghi</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className={inputClass}
                          >
                            {PAYMENT_METHODS.map((p) => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        {/* ⚠️ Il giorno in cui i soldi ESCONO, non quello in
                            cui registri (17/08). Con un assegno a 30 giorni
                            le due date sono diverse, e prima la cassa
                            scendeva un mese prima del dovuto. */}
                        <div className="w-40">
                          <label className={labelClass}>Quando escono i soldi</label>
                          <input
                            type="date"
                            value={dataUscita}
                            onChange={(e) => setDataUscita(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="w-44">
                          <label className={labelClass}>
                            {paymentMethod === "assegno" ? "N. assegno" : "Riferimento"}
                          </label>
                          <input
                            value={riferimento}
                            onChange={(e) => setRiferimento(e.target.value)}
                            placeholder={paymentMethod === "assegno" ? "es. 0004521" : "es. bonifico 12/03"}
                            className={inputClass}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={paying || !dataUscita}
                          onClick={() => handlePay(inv.id)}
                          className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                        >
                          {paying ? "Confermo…" : "Conferma pagamento"}
                        </button>
                      </div>

                      {/* I CREDITI PROPOSTI. ⚠️ Il numero accanto a ogni
                          nota e quello del netto arrivano dal database:
                          due crediti da 30 su una fattura da 40 si
                          applicano per 40 in tutto, e una somma fatta qui
                          direbbe 60 — cioè mentirebbe proprio mentre uno
                          guarda prima di confermare. */}
                      {creditiFattura.length > 0 && (
                        <div className="mt-3 bg-b58-sage/15 rounded-lg p-3">
                          <p className="text-xs text-b58-charcoal mb-1.5">
                            Hai un credito con {inv.supplier.name}: lo usi su questa fattura?
                          </p>
                          {creditiFattura.map((c) => (
                            <label key={c.nota_id} className="flex items-center gap-2 text-xs py-0.5">
                              <input
                                type="checkbox"
                                checked={noteScelte.includes(c.nota_id)}
                                onChange={() => cambiaCredito(inv.id, c.nota_id)}
                              />
                              <span>
                                {c.numero ? `${c.numero} ` : "nota senza numero "}
                                del {formatDate(c.data)} — restano {formatEUR(c.residuo)}, qui se ne
                                possono usare <strong>{formatEUR(c.usabile)}</strong>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {anteprima && (
                        <p className="text-xs text-b58-charcoal mt-2">
                          Usciranno <strong>{formatEUR(anteprima.netto)}</strong>
                          {Number(anteprima.gia_scalato) > 0 && (
                            <> · nota già scalata {formatEUR(anteprima.gia_scalato)}</>
                          )}
                          {Number(anteprima.scalato_ora) > 0 && (
                            <> · credito usato adesso {formatEUR(anteprima.scalato_ora)}</>
                          )}
                          {" · fattura "}
                          {formatEUR(anteprima.lordo)}
                          {Number(anteprima.netto) === 0 && (
                            <>
                              {" — "}
                              coperta per intero: non uscirà nessun euro, e in prima nota non ci sarà
                              nessuna riga.
                            </>
                          )}
                        </p>
                      )}

                      {/* ⚠️ Le due avvertenze sono INFORMAZIONE, non
                          divieti: il database non rifiuta nessuna delle due
                          date, perché entrambe sono cose vere — prima è un
                          acconto, dopo è un assegno postdatato. Dirlo qui
                          serve a distinguere il caso voluto dal giorno
                          digitato male. */}
                      {dataUscita > oggiLocale() && (
                        <p className="text-[11px] text-b58-charcoal-soft mt-2">
                          I soldi escono il {formatDate(dataUscita)}: fino a quel giorno l&apos;uscita
                          resta in prima nota e <strong>non abbassa il saldo</strong> — la trovi fra le
                          uscite attese in «Ce la faccio?».
                        </p>
                      )}
                      {dataUscita && dataUscita < inv.invoice_date && (
                        <p className="text-[11px] text-b58-gold-dark mt-2">
                          Escono <strong>prima</strong> della data della fattura
                          ({formatDate(inv.invoice_date)}): è un acconto? Se invece hai sbagliato il
                          giorno, correggilo — in prima nota resterebbe così.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagate.righe.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-1">Pagate di recente</h2>
          {/* Il taglio si dichiara: un elenco tagliato in silenzio sembra
              completo, ed è la stessa forma dello zero al posto del buco. */}
          <p className="text-xs text-b58-charcoal-soft/70 mb-4">
            {pagate.quante > pagate.righe.length
              ? `Le ultime ${pagate.righe.length} di ${pagate.quante}${filtroAttivo ? " che corrispondono ai filtri" : " pagate in tutto"}.`
              : `Tutte e ${pagate.quante}${filtroAttivo ? " che corrispondono ai filtri" : ""}.`}
          </p>
          <ul className="space-y-2">
            {pagate.righe.map((inv) => (
              <li key={inv.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                <div className="text-sm text-b58-charcoal-soft flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    <span className="text-b58-charcoal">{inv.supplier.name}</span>
                    {inv.invoice_number && ` #${inv.invoice_number}`}
                    {inv.paid_at && ` — ${formatDate(inv.paid_at)}`}
                    {inv.payment_method && ` · ${labelFor(PAYMENT_METHODS, inv.payment_method)}`}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-b58-charcoal">{formatEUR(inv.da_pagare)}</span>
                    {/* ⚠️ La nota di credito arrivata DOPO il pagamento è
                        il caso che si dimentica, quindi il gesto sta anche
                        qui: diventa un credito col fornitore. */}
                    <button
                      type="button"
                      onClick={() => setNotaPerId((id) => (id === inv.id ? null : inv.id))}
                      className="text-xs text-b58-charcoal-soft hover:text-b58-charcoal"
                    >
                      {notaPerId === inv.id ? "Chiudi" : "Nota di credito"}
                    </button>
                    {/* Toglie un'uscita vera dalla prima nota: conferma. */}
                    <ConfermaDistruttiva
                      etichetta="Annulla il pagamento"
                      domanda={`Tolgo dalla prima nota l'uscita di ${formatEUR(inv.da_pagare)} e rimetto la fattura fra quelle da pagare?`}
                      etichettaConferma="Sì, annulla"
                      onConferma={() => handleAnnullaPagamento(inv.id)}
                    />
                  </span>
                </div>
                <RigaNote inv={inv} />
                {notaPerId === inv.id && (
                  <FormNotaCredito
                    fattura={inv}
                    onSalva={(dati) => salvaNota(inv, dati)}
                    onAnnulla={() => setNotaPerId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-b58-charcoal-soft/70 mt-3">
            Una fattura pagata non si può rimuovere: in prima nota c&apos;è l&apos;uscita che
            la registra. Annullando il pagamento l&apos;uscita sparisce, la fattura torna
            fra quelle da pagare e il promemoria si riapre — e i crediti che avevi usato su di lei
            tornano disponibili.
          </p>
        </div>
      )}
    </div>
  );
}
