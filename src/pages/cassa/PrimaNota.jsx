import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createCashMovement,
  deleteCashMovement,
  getCashBalance,
  listCashMovements,
  listCausali,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";
import {
  CASH_DOCUMENT_TYPES,
  SIMPLIFIED_INVOICE_THRESHOLD,
  formatDate,
  formatEUR,
  labelFor,
  oggiLocale,
  primoDelMeseLocale,
} from "../../lib/constants";
import { downloadCsv } from "../../lib/csv";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import CampoGiornata from "../../components/CampoGiornata";
import { letturaTagliata } from "../../lib/lettureTagliate";
import { useGiornataOperativa } from "../../lib/giornataOperativa";

const today = oggiLocale;

const emptyForm = {
  direction: "uscita",
  amount: "",
  movement_date: today(),
  causale_id: "",
  mezzo: "cassa",
  tipo_documento: "non_documentato",
  document_reference: "",
  business_purpose: "",
  forager_tax_code: "",
  harvest_region: "",
  is_owner_injection: false,
  note: "",
};

export default function PrimaNota() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [movements, setMovements] = useState([]);
  const [balance, setBalance] = useState(null);
  const [causaliEntrata, setCausaliEntrata] = useState([]);
  const [causaliUscita, setCausaliUscita] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // 🔴 IL PERIODO PARTE DAL MESE IN CORSO, e prima partiva VUOTO (19/08/2026).
  // Con i campi vuoti questa schermata chiedeva TUTTI i movimenti — e su
  // quell'elenco calcola entrate, uscite e il file da esportare. Il database
  // ne consegna al massimo mille senza dirlo, quindi i due totali e l'export
  // fiscale potevano essere parziali con l'aria di essere completi.
  //
  // ⚠️ Un valore di partenza non basta da solo: chi svuota i campi torna nel
  // caso di prima. Per questo la difesa vera è l'altra — l'export si RIFIUTA
  // se la lettura è tornata tagliata (vedi `handleExport`) — e questa riga
  // serve a non farci arrivare quasi mai.
  const [from, setFrom] = useState(primoDelMeseLocale);
  const [to, setTo] = useState("");

  // 🔴 LA GIORNATA PROPOSTA È LA SERATA, NON «OGGI» (seconda metà della
  // regola delle 5, 19/08). Alle 00:30 col locale aperto `oggiLocale()`
  // propone **domani**: un movimento di stanotte finiva su una giornata in
  // cui il locale non ha ancora aperto, e nessuna riga risultava fuori
  // posto. La data resta correggibile e si vede sotto il campo.
  //
  // ⚠️ Il predefinito del database su `cash_movements.movement_date` resta
  // il **calendario** (decisione di Alessio del 19/08, perimetro stretto):
  // non è una contraddizione, è che quel predefinito si usa solo quando
  // nessuno sceglie — e misurando, tutte e quattro le funzioni che scrivono
  // in prima nota passano una data esplicita, e questa schermata pure.
  const { serata, oraFineSerata } = useGiornataOperativa();
  useEffect(() => {
    if (!serata) return;
    // Non si sovrascrive ciò che l'utente sta scrivendo (trappola del 12/08):
    // si corregge solo la proposta di partenza, se è ancora quella.
    setForm((f) => (f.movement_date === today() ? { ...f, movement_date: serata } : f));
  }, [serata]);

  useEffect(() => {
    Promise.all([getEntities(), listCausali("entrata"), listCausali("uscita")])
      .then(([ent, cin, cout]) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
        setCausaliEntrata(cin);
        setCausaliUscita(cout);
      })
      .catch((e) => setError(e.message));
  }, []);

  const reload = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      listCashMovements({ entityId, from: from || undefined, to: to || undefined }),
      getCashBalance(entityId),
    ]).then(([mov, bal]) => {
      setMovements(mov);
      setBalance(bal);
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, from, to]);

  const causaliForDirection = form.direction === "entrata" ? causaliEntrata : causaliUscita;

  // Promemoria deterministico (§3.4): scontrino ≤400€ su un'uscita → suggerisci
  // la fattura semplificata per recuperare l'IVA.
  const showSimplifiedInvoiceHint =
    form.direction === "uscita" &&
    form.tipo_documento === "scontrino" &&
    form.amount !== "" &&
    Number(form.amount) <= SIMPLIFIED_INVOICE_THRESHOLD;

  // Acquisto da raccoglitore occasionale (§3.17): CF + regione di raccolta,
  // obbligo dal 01/01/2026 (L.199/2025 c.932).
  const isForager = form.tipo_documento === "documento_raccoglitore_occasionale";

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const setDirection = (direction) =>
    setForm((f) => ({ ...f, direction, causale_id: "", is_owner_injection: false }));

  const handleAdd = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    setError("");
    try {
      await createCashMovement({
        entity_id: entityId,
        direction: form.direction,
        amount: Number(form.amount),
        movement_date: form.movement_date,
        causale_id: form.causale_id || null,
        mezzo: form.mezzo,
        tipo_documento: form.tipo_documento,
        document_reference: form.document_reference || null,
        business_purpose: form.business_purpose || null,
        forager_tax_code: isForager ? form.forager_tax_code || null : null,
        harvest_region: isForager ? form.harvest_region || null : null,
        is_owner_injection: form.direction === "entrata" ? form.is_owner_injection : false,
        note: form.note || null,
      });
      setForm({ ...emptyForm, movement_date: form.movement_date, direction: form.direction, mezzo: form.mezzo });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCashMovement(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExport = () => {
    // 🔴 O COMPLETO PER COSTRUZIONE, O DICHIARATO PARZIALE: non c'è una terza
    // strada su un file che si porta al commercialista. Se il database ha
    // consegnato meno righe di quelle che ci sono, il file NON esce — e la
    // schermata dice perché e cosa fare. Un export che si scarica lo stesso,
    // con un avviso da qualche parte, è un export incompleto che qualcuno
    // aprirà fra sei mesi senza ricordarsi dell'avviso.
    if (letturaTagliata("cash_movements")) {
      setError(
        "Non esporto: il gestionale ha ricevuto solo una parte dei movimenti, " +
          "quindi il file sarebbe incompleto senza sembrarlo. Restringi il periodo e riprova."
      );
      return;
    }
    setError("");
    downloadCsv(`prima_nota${from ? `_${from}` : ""}${to ? `_${to}` : ""}.csv`, movements, [
      { label: "Data", value: (m) => m.movement_date },
      { label: "Direzione", value: (m) => m.direction },
      { label: "Importo", value: (m) => m.amount },
      // Senza questa colonna l'export non permette di distinguere il
      // cassetto dal conto corrente: due registri diversi appiattiti in
      // uno solo, che è esattamente il difetto corretto il 13/08.
      { label: "Mezzo", value: (m) => (m.mezzo === "banca" ? "Banca" : "Contante") },
      { label: "Causale", value: (m) => m.causale?.label },
      { label: "Tipo documento", value: (m) => labelFor(CASH_DOCUMENT_TYPES, m.tipo_documento) },
      { label: "Rif. documento", value: (m) => m.document_reference },
      { label: "Finalità aziendale", value: (m) => m.business_purpose },
      { label: "CF raccoglitore", value: (m) => m.forager_tax_code },
      { label: "Regione di raccolta", value: (m) => m.harvest_region },
      { label: "Versamento titolare", value: (m) => (m.is_owner_injection ? "Sì" : "") },
      { label: "Nota", value: (m) => m.note },
    ]);
  };

  const periodTotals = useMemo(() => {
    const inc = movements.filter((m) => m.direction === "entrata").reduce((s, m) => s + Number(m.amount), 0);
    const out = movements.filter((m) => m.direction === "uscita").reduce((s, m) => s + Number(m.amount), 0);
    return { inc, out };
  }, [movements]);

  return (
    <div className="testo-sala max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {balance && (
            <span className="testo-sala text-b58-charcoal-soft">
              Contante in cassa:{" "}
              <span className={`font-medium ${Number(balance.balance) < 0 ? "text-b58-terracotta-dark" : "text-b58-charcoal"}`}>
                {formatEUR(balance.balance)}
              </span>
              {" · "}Banca:{" "}
              <span className={`font-medium ${Number(balance.saldo_banca) < 0 ? "text-b58-terracotta-dark" : "text-b58-charcoal"}`}>
                {formatEUR(balance.saldo_banca)}
              </span>
            </span>
          )}
          {entities && (
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala text-b58-charcoal"
            >
              <option value={entities.srls.id}>{entities.srls.name}</option>
              {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
            </select>
          )}
        </div>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-6">Prima nota di cassa</h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Nuovo movimento */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Nuovo movimento</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setDirection("uscita")}
              className={`tocco-bottone flex-1 rounded-lg border px-3  testo-sala transition-colors ${
                form.direction === "uscita"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Uscita
            </button>
            <button
              type="button"
              onClick={() => setDirection("entrata")}
              className={`tocco-bottone flex-1 rounded-lg border px-3  testo-sala transition-colors ${
                form.direction === "entrata"
                  ? "border-b58-olive bg-b58-olive/10 text-b58-olive-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Entrata
            </button>
          </div>

          {/* Da dove passa il denaro. Fino al 13/08/2026 il modulo
              trattava TUTTO come contante: registrare un bonifico faceva
              calare il cassetto di soldi che non ne erano usciti. */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, mezzo: "cassa" }))}
              className={`tocco-bottone flex-1 rounded-lg border px-3  testo-sala transition-colors ${
                form.mezzo === "cassa"
                  ? "border-b58-charcoal bg-b58-charcoal/5 text-b58-charcoal"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Contante
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, mezzo: "banca" }))}
              className={`tocco-bottone flex-1 rounded-lg border px-3  testo-sala transition-colors ${
                form.mezzo === "banca"
                  ? "border-b58-charcoal bg-b58-charcoal/5 text-b58-charcoal"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Banca
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={labelClass}>Importo €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={inputClass}
              />
            </div>
            <CampoGiornata
              label="Giornata"
              value={form.movement_date}
              onChange={(v) => setForm((f) => ({ ...f, movement_date: v }))}
              oraFineSerata={oraFineSerata}
              frase="Questo movimento va sulla serata di"
              labelClass={labelClass}
              inputClass={inputClass}
            />
            <div>
              <label className={labelClass}>Causale</label>
              <select
                value={form.causale_id}
                onChange={(e) => setForm((f) => ({ ...f, causale_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">—</option>
                {causaliForDirection.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tipo documento</label>
              <select
                value={form.tipo_documento}
                onChange={(e) => setForm((f) => ({ ...f, tipo_documento: e.target.value }))}
                className={inputClass}
              >
                {CASH_DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {showSimplifiedInvoiceHint && (
            <p className="testo-sala text-b58-gold-dark bg-b58-gold/10 rounded-lg px-3 py-2 mb-3">
              Scontrino sotto i {SIMPLIFIED_INVOICE_THRESHOLD}€: hai chiesto la fattura semplificata
              (dando P.IVA/codice fiscale) per poter recuperare l'IVA? Con il solo scontrino l'IVA non è detraibile.
            </p>
          )}

          {isForager && (
            <div className="mb-3">
              <p className="testo-sala text-b58-charcoal-soft/80 bg-b58-cream-dark/50 rounded-lg px-3 py-2 mb-2">
                Regime L. 145/2018 per raccoglitori occasionali (funghi/prodotti selvatici non legnosi):
                conserva codice fiscale del raccoglitore e riferimento F24 codice tributo 1853 come prova
                del forfait pagato. Dal 2026 è obbligatoria anche la regione di raccolta.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={form.forager_tax_code}
                  onChange={(e) => setForm((f) => ({ ...f, forager_tax_code: e.target.value }))}
                  placeholder="Codice fiscale del raccoglitore"
                  className={inputClass}
                />
                <input
                  value={form.harvest_region}
                  onChange={(e) => setForm((f) => ({ ...f, harvest_region: e.target.value }))}
                  placeholder="Regione di raccolta"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              value={form.document_reference}
              onChange={(e) => setForm((f) => ({ ...f, document_reference: e.target.value }))}
              placeholder={isForager ? "Rif. F24 codice tributo 1853" : "Rif. documento (opz.)"}
              className={inputClass}
            />
            <input
              value={form.business_purpose}
              onChange={(e) => setForm((f) => ({ ...f, business_purpose: e.target.value }))}
              placeholder="Finalità aziendale (opz., utile in verifica)"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4">
              {form.direction === "entrata" && (
                <label className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft">
                  <input
                    type="checkbox"
                    checked={form.is_owner_injection}
                    onChange={(e) => setForm((f) => ({ ...f, is_owner_injection: e.target.checked }))}
                  />
                  Versamento titolare / fondo cassa
                </label>
              )}
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Nota (opz.)"
                className={`${inputClass} w-48`}
              />
            </div>
            <button
              type="button"
              disabled={saving || !form.amount || Number(form.amount) <= 0}
              onClick={handleAdd}
              className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
            >
              {saving ? "Registro…" : "+ Registra movimento"}
            </button>
          </div>
        </div>
      </div>

      {/* Elenco + filtri */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className={labelClass}>Dal</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Al</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
            {(from || to) && (
              <button
                type="button"
                onClick={() => { setFrom(""); setTo(""); }}
                className="tocco-bottone rounded-lg border border-b58-charcoal/15 px-3  testo-sala text-b58-charcoal-soft hover:bg-b58-cream-dark"
              >
                Azzera
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={movements.length === 0}
            className="tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4  disabled:opacity-40"
          >
            Esporta CSV
          </button>
        </div>

        {loading ? (
          <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
        ) : movements.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft/60">Nessun movimento nel periodo.</p>
        ) : (
          <>
            <div className="testo-sala text-b58-charcoal-soft mb-3">
              Totali periodo: <span className="text-b58-olive-dark font-medium">+{formatEUR(periodTotals.inc)}</span>{" "}
              <span className="text-b58-terracotta-dark font-medium">−{formatEUR(periodTotals.out)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full testo-sala">
                <thead>
                  <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                    <th className="py-2 font-medium">Data</th>
                    {/* ⚠️ Da dove escono o entrano i soldi è la distinzione
                        che DECIDE questa schermata, e fino al collaudo del
                        17/08 non c'era: due uscite comparivano identiche, e
                        per capire quale era uscita dalla banca bisognava
                        fare i conti coi riquadri dei saldi qui sopra.
                        Cassa e banca sono due saldi che non si sommano
                        mai: leggerli confusi è leggerli sbagliati. */}
                    <th className="py-2 font-medium">Da dove</th>
                    <th className="py-2 font-medium">Causale</th>
                    <th className="py-2 font-medium">Documento</th>
                    <th className="py-2 font-medium text-right">Importo</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="py-2 text-b58-charcoal-soft">{formatDate(m.movement_date)}</td>
                      <td className="py-2 whitespace-nowrap">
                        <span
                          className={`testo-sala rounded-full px-2 py-0.5 ${
                            m.mezzo === "banca"
                              ? "bg-b58-charcoal/10 text-b58-charcoal"
                              : "bg-b58-gold/20 text-b58-gold-dark"
                          }`}
                        >
                          {m.mezzo === "banca" ? "Banca" : "Contante"}
                        </span>
                      </td>
                      <td className="py-2 text-b58-charcoal">
                        {m.causale?.label ?? "—"}
                        {m.is_owner_injection && (
                          <span className="testo-sala text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5 ml-1.5">
                            versamento titolare
                          </span>
                        )}
                        {m.business_purpose && (
                          <div className="testo-sala text-b58-charcoal-soft">{m.business_purpose}</div>
                        )}
                        {/* ⚠️ La nota non si vedeva da nessuna parte, e le
                            causali di sistema si chiamano «Uscita» e «Altra
                            uscita»: due righe diverse comparivano con la
                            stessa parola sopra. La descrizione la scrive
                            lui nella nota — mostrarla è tutto ciò che
                            serviva perché una riga si riconosca. */}
                        {m.note && <div className="testo-sala text-b58-charcoal-soft">{m.note}</div>}
                      </td>
                      <td className="py-2 text-b58-charcoal-soft testo-sala">
                        {labelFor(CASH_DOCUMENT_TYPES, m.tipo_documento)}
                        {m.document_reference ? ` · ${m.document_reference}` : ""}
                        {m.harvest_region && <div>Regione: {m.harvest_region}</div>}
                      </td>
                      <td className={`py-2 text-right font-medium ${m.direction === "entrata" ? "text-b58-olive-dark" : "text-b58-terracotta-dark"}`}>
                        {m.direction === "entrata" ? "+" : "−"}{formatEUR(m.amount)}
                      </td>
                      <td className="py-2 text-right">
                        <ConfermaDistruttiva
                          etichetta="Rimuovi"
                          cosaSparisce={`il movimento del ${formatDate(m.movement_date)} da ${formatEUR(m.amount)}`}
                          onConferma={() => handleDelete(m.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
