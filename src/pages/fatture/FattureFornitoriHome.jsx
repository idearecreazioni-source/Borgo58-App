import { useEffect, useMemo, useState } from "react";
import {
  annullaPagamentoFattura,
  createSupplierInvoice,
  deleteSupplierInvoice,
  listSupplierInvoices,
  markInvoicePaid,
  ultimeFatturePagate,
  updateSupplierInvoice,
} from "../../lib/api/supplierInvoices";
import { listSuppliers } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { PAYMENT_METHODS, formatDate, formatEUR, labelFor, oggiLocale } from "../../lib/constants";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

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
  // Il debito INTERO, che nessun filtro tocca: vedi ricaricaFatture.
  const [tutteDaPagare, setTutteDaPagare] = useState([]);
  const [filtri, setFiltri] = useState({ supplierId: "", dal: "", al: "" });
  const [entities, setEntities] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
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

  // Le due liste si chiedono separate: quelle da pagare tutte (è l'elenco
  // di cosa c'è da fare), le pagate solo le ultime.
  //
  // ⚠️ E IL DEBITO TOTALE SI CHIEDE A PARTE, SENZA FILTRI. È la decisione
  // che conta di tutto il n. 9: un totale «da pagare» che si rimpicciolisce
  // perché si è filtrato un fornitore somiglia in tutto a un debito più
  // piccolo. Il filtro cambia cosa si GUARDA, non quanto si DEVE — e la
  // schermata dichiara che il totale è intero quando un filtro è attivo.
  const ricaricaFatture = async (f = filtri) => {
    const [aperte, chiuse, tutteAperte] = await Promise.all([
      listSupplierInvoices({ status: "da_pagare", supplierId: f.supplierId, dal: f.dal, al: f.al }),
      ultimeFatturePagate(QUANTE_PAGATE, f),
      listSupplierInvoices({ status: "da_pagare" }),
    ]);
    setDaPagare(aperte);
    setPagate(chiuse);
    setTutteDaPagare(tutteAperte);
  };

  const load = async () => {
    const ent = await getEntities();
    setEntities(ent);
    setForm((f) => (f.entity_id ? f : { ...f, entity_id: ent.srls.id }));
    const [, sup] = await Promise.all([ricaricaFatture(), listSuppliers(ent.srls.id)]);
    setSuppliers(sup);
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ⚠️ Due società, due debiti — mai un totale solo. La S.r.l.s. e
  // l'azienda agricola sono due soggetti fiscali distinti: chi paga le
  // fatture dell'una non sono i soldi dell'altra, e un numero che le
  // somma non è il debito di nessuna delle due. Si mostra un totale per
  // società, e solo per quelle che hanno qualcosa da pagare.
  const totaliPerSocieta = useMemo(() => {
    const per = new Map();
    for (const i of tutteDaPagare) {
      const nome = i.entity?.name ?? "Senza società";
      const riga = per.get(nome) ?? { nome, totale: 0, quante: 0 };
      riga.totale += Number(i.amount);
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
      await ricaricaFatture(nuovi);
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
      await ricaricaFatture();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (id) => {
    setPaying(true);
    setError("");
    try {
      await markInvoicePaid(id, { paymentMethod, dataUscita, riferimento });
      setPayingId(null);
      await ricaricaFatture();
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
      await ricaricaFatture();
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
  const correggi = async (id, patch) => {
    setError("");
    try {
      await updateSupplierInvoice(id, patch);
      await ricaricaFatture();
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
      await ricaricaFatture();
    } catch (e) {
      setError(e.message);
    }
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
              </div>
            ))
          )}
        </div>
      </div>

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
          ⚠️ Non toccano i totali qui sopra: vedi `ricaricaFatture`. */}
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
                      <input
                        defaultValue={inv.invoice_number ?? ""}
                        onBlur={(e) =>
                          (e.target.value.trim() || null) !== inv.invoice_number &&
                          correggi(inv.id, { invoice_number: e.target.value.trim() || null })
                        }
                        placeholder="n. fattura"
                        className="w-28 rounded border border-b58-charcoal/15 px-2 py-1 text-xs"
                      />
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
                      <button
                        type="button"
                        onClick={() => {
                          setPayingId((id) => (id === inv.id ? null : inv.id));
                          setPaymentMethod("bonifico");
                          setDataUscita(oggiLocale());
                          setRiferimento("");
                        }}
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
          <ul className="space-y-1.5">
            {pagate.righe.map((inv) => (
              <li key={inv.id} className="text-sm text-b58-charcoal-soft flex items-center justify-between gap-2">
                <span>
                  <span className="text-b58-charcoal">{inv.supplier.name}</span>
                  {inv.invoice_number && ` #${inv.invoice_number}`}
                  {inv.paid_at && ` — ${formatDate(inv.paid_at)}`}
                  {inv.payment_method && ` · ${labelFor(PAYMENT_METHODS, inv.payment_method)}`}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-b58-charcoal">{formatEUR(inv.amount)}</span>
                  {/* Toglie un'uscita vera dalla prima nota: conferma. */}
                  <ConfermaDistruttiva
                    etichetta="Annulla il pagamento"
                    domanda={`Tolgo dalla prima nota l'uscita di ${formatEUR(inv.amount)} e rimetto la fattura fra quelle da pagare?`}
                    etichettaConferma="Sì, annulla"
                    onConferma={() => handleAnnullaPagamento(inv.id)}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-b58-charcoal-soft/70 mt-3">
            Una fattura pagata non si può rimuovere: in prima nota c'è l'uscita che
            la registra. Annullando il pagamento l'uscita sparisce, la fattura torna
            fra quelle da pagare e il promemoria si riapre.
          </p>
        </div>
      )}
    </div>
  );
}
