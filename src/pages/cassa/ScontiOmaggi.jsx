import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createDiscountGift,
  createPosDevice,
  deleteDiscountGift,
  listCausali,
  listDiscountsGifts,
  listDiscountsGiftsMonthly,
  listPosDevices,
} from "../../lib/api/cash";
import { listCustomers } from "../../lib/api/customers";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import CampoGiornata from "../../components/CampoGiornata";
import { useGiornataOperativa } from "../../lib/giornataOperativa";
import { getEntities } from "../../lib/api/entities";
import { DISCOUNT_GIFT_TYPES, formatDate, formatEUR, labelFor, oggiLocale } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";

const today = oggiLocale;

const emptyForm = {
  type: "omaggio",
  full_amount: "",
  collected_amount: "",
  causale_id: "",
  causale_note: "",
  customer_id: "",
  device_id: "",
  movement_date: today(),
  note: "",
};

const monthLabel = (isoMonth) => {
  const d = new Date(isoMonth);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
};

export default function ScontiOmaggi() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [items, setItems] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [causali, setCausali] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // 🔴 LA SERATA, NON «OGGI» — seconda metà della regola delle 5 (19/08).
  // Uno sconto o un omaggio nascono in sala, di sera: alle 00:30
  // `oggiLocale()` li datava al giorno dopo, e il budget degli omaggi
  // della Proiezione li avrebbe contati nel mese sbagliato l'ultima notte
  // di ogni mese. Si propone e si vede; la data resta correggibile.
  const { serata, oraFineSerata } = useGiornataOperativa();
  useEffect(() => {
    if (!serata) return;
    setForm((f) => (f.movement_date === today() ? { ...f, movement_date: serata } : f));
  }, [serata]);

  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: "", isOwnerDevice: false });
  const [savingDevice, setSavingDevice] = useState(false);

  const reloadDevices = () => listPosDevices().then(setDevices);

  useEffect(() => {
    Promise.all([getEntities(), listCausali("sconto_omaggio"), listCustomers(), listPosDevices()])
      .then(([ent, caus, cust, dev]) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
        setCausali(caus);
        setCustomers(cust);
        setDevices(dev);
      })
      .catch((e) => setError(e.message));
  }, []);

  const reload = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([listDiscountsGifts({ entityId }), listDiscountsGiftsMonthly(entityId)]).then(
      ([list, agg]) => {
        setItems(list);
        setMonthly(agg);
      }
    );
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const isOmaggio = form.type === "omaggio";

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.full_amount || Number(form.full_amount) < 0) return;
    // Dal 14/08 la causale e obbligatoria anche qui: il registro manuale
    // scrive nella stessa tabella del conto chiuso in sala.
    if (!form.causale_id) return;
    setSaving(true);
    setError("");
    try {
      await createDiscountGift({
        entity_id: entityId,
        type: form.type,
        full_amount: Number(form.full_amount),
        collected_amount: isOmaggio ? 0 : Number(form.collected_amount) || 0,
        causale_id: form.causale_id,
        causale_note: form.causale_note || null,
        customer_id: form.customer_id || null,
        device_id: form.device_id || null,
        movement_date: form.movement_date,
        note: form.note || null,
      });
      setForm({ ...emptyForm, type: form.type, movement_date: form.movement_date });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDiscountGift(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddDevice = async () => {
    if (!newDevice.name.trim()) return;
    setSavingDevice(true);
    setError("");
    try {
      await createPosDevice(newDevice);
      setNewDevice({ name: "", isOwnerDevice: false });
      await reloadDevices();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingDevice(false);
    }
  };

  // Raggruppa l'aggregazione mensile per mese (sconto + omaggio insieme).
  const monthsMap = {};
  monthly.forEach((r) => {
    (monthsMap[r.month] ??= {})[r.type] = r;
  });
  const months = Object.keys(monthsMap).sort().reverse();

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa
        </Link>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala-grande text-b58-charcoal"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      {/* ⚠️ QUI C'ERANO TRE COSE IN UN PARAGRAFO SOLO, e leggendole di
          seguito si perdeva quella che conta. Adesso stanno separate per
          natura: la differenza fra i due gesti è una SPIEGAZIONE e sta dietro
          il segno, insieme a cosa vuol dire il pallino accanto a una riga;
          il TD27 da verificare con Laura è un LIMITE, e resta a schermo. */}
      <h1 className="font-display text-2xl text-b58-charcoal mb-2">
        Sconti e omaggi
        <Didascalia>
          Sono due gesti distinti. Uno sconto è una vendita a prezzo ridotto e passa
          comunque dal registratore telematico; un omaggio è un conto che il cliente
          non paga affatto e resta solo qui nel gestionale. Un omaggio non tocca la
          prima nota — nessun euro entra e nessuno esce: quello che ti è costato
          davvero sono gli ingredienti, ed è la colonna qui sotto.
          {" "}Un pallino accanto a una riga vuol dire che la registrazione arriva da un
          dispositivo diverso dal tuo: lo vedi solo tu.
        </Didascalia>
      </h1>
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        ⚠️ Se gli omaggi sistematici facciano scattare l&apos;autofattura TD27 dipende da
        volume e frequenza: <strong>da verificare con Laura</strong>, non è automatico.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Riepilogo mensile (TD27) */}
      {months.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Riepilogo mensile</h2>
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-2 font-medium">Mese</th>
                  <th className="py-2 font-medium text-right">Sconti (mancato incasso)</th>
                  <th className="py-2 font-medium text-right">Omaggi (valore a listino)</th>
                  <th className="py-2 font-medium text-right">Omaggi (costo ingredienti)</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m} className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-2 text-b58-charcoal capitalize">{monthLabel(m)}</td>
                    <td className="py-2 text-right text-b58-charcoal-soft">
                      {monthsMap[m].sconto ? formatEUR(monthsMap[m].sconto.total_forgone) : "—"}
                    </td>
                    <td className="py-2 text-right text-b58-charcoal font-medium">
                      {monthsMap[m].omaggio ? formatEUR(monthsMap[m].omaggio.total_full) : "—"}
                    </td>
                    {/* Il costo si mostra SEMPRE accanto al numero di conti
                        valorizzati solo in parte: una somma parziale letta
                        come totale sarebbe più dannosa di nessun numero. */}
                    <td className="py-2 text-right text-b58-charcoal">
                      {monthsMap[m].omaggio?.total_costo != null
                        ? formatEUR(monthsMap[m].omaggio.total_costo)
                        : "—"}
                      {monthsMap[m].omaggio?.conti_incompleti > 0 && (
                        <span className="block testo-sala text-b58-terracotta-dark">
                          parziale: {monthsMap[m].omaggio.conti_incompleti} conti con righe non
                          valorizzabili
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="testo-sala text-b58-charcoal-soft/70 mt-3">
            Il <strong>valore a listino</strong> è quello che il cliente avrebbe pagato; il{" "}
            <strong>costo ingredienti</strong> è quello che il piatto è costato davvero, congelato
            al momento della chiusura. Sono due numeri diversi e servono a due cose diverse: il
            secondo è quello che serve a Laura per l&apos;autofattura sugli omaggi (da confermare
            con lei, domanda L1).
          </p>
        </div>
      )}

      {/* Nuovo */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Nuovo sconto / omaggio</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
          <div className="flex gap-2 mb-3">
            {DISCOUNT_GIFT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                className={`flex-1 tocco-campo rounded-lg border px-3 py-2 testo-sala-grande transition-colors ${
                  form.type === t.value
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={labelClass}>Valore a listino €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.full_amount}
                onChange={(e) => setForm((f) => ({ ...f, full_amount: e.target.value }))}
                className={inputClass}
              />
            </div>
            {!isOmaggio && (
              <div>
                <label className={labelClass}>Incassato €</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.collected_amount}
                  onChange={(e) => setForm((f) => ({ ...f, collected_amount: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}
            <CampoGiornata
              label="Giornata"
              value={form.movement_date}
              onChange={(v) => setForm((f) => ({ ...f, movement_date: v }))}
              oraFineSerata={oraFineSerata}
              frase={`Questo ${form.type === "omaggio" ? "omaggio" : "sconto"} va sulla serata di`}
              labelClass={labelClass}
              inputClass={inputClass}
            />
            <div>
              <label className={labelClass}>Causale (obbligatoria)</label>
              <select
                value={form.causale_id}
                onChange={(e) => setForm((f) => ({ ...f, causale_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Perché? —</option>
                {causali.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <select
              value={form.customer_id}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Cliente (opz.)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.phone}</option>
              ))}
            </select>
            <select
              value={form.device_id}
              onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Device (opz.)</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opz.)"
              className={inputClass}
            />
          </div>

          {isOmaggio && (
            <p className="testo-sala text-b58-charcoal-soft/70 mb-3">
              Un omaggio non incassa nulla: l'incassato resta a 0.
            </p>
          )}

          <div className="mb-3">
            <button type="button" onClick={() => setShowDeviceForm((v) => !v)} className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
              {showDeviceForm ? "Annulla" : devices.length === 0 ? "+ Configura i tablet in uso" : "Gestisci tablet"}
            </button>
            {showDeviceForm && (
              <div className="mt-2 bg-b58-cream-dark/40 rounded-lg p-3 flex flex-wrap gap-2 items-end">
                <input
                  value={newDevice.name}
                  onChange={(e) => setNewDevice((d) => ({ ...d, name: e.target.value }))}
                  placeholder='Nome, es. "Tablet Sala"'
                  className={inputClass + " flex-1 min-w-[140px]"}
                />
                <label className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft whitespace-nowrap">
                  <input type="checkbox" checked={newDevice.isOwnerDevice} onChange={(e) => setNewDevice((d) => ({ ...d, isOwnerDevice: e.target.checked }))} />
                  È il tuo tablet
                </label>
                <button type="button" disabled={savingDevice || !newDevice.name.trim()} onClick={handleAddDevice} className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-3 py-1.5 disabled:opacity-60">
                  {savingDevice ? "Salvo…" : "+ Aggiungi"}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || !form.full_amount || !form.causale_id}
              onClick={handleAdd}
              className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Registro…" : "+ Registra"}
            </button>
          </div>
        </div>
      </div>

      {/* Elenco */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Registro</h2>
        {loading ? (
          <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
        ) : items.length === 0 ? (
          <p className="testo-sala-grande text-b58-charcoal-soft/60">Nessuno sconto o omaggio registrato.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 testo-sala-grande bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                <div>
                  {it.device && it.device.is_owner_device === false && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-b58-terracotta mr-1.5"
                      title={`Da un device diverso dal tuo (${it.device.name})`}
                    />
                  )}
                  <span className="text-b58-charcoal font-medium">{labelFor(DISCOUNT_GIFT_TYPES, it.type)}</span>
                  <span className="text-b58-charcoal-soft"> · {formatDate(it.movement_date)}</span>
                  {it.causale?.label && <span className="text-b58-charcoal-soft"> · {it.causale.label}</span>}
                  {it.customer && (
                    <span className="text-b58-charcoal-soft"> · {it.customer.name || it.customer.phone}</span>
                  )}
                  {it.device && <span className="text-b58-charcoal-soft"> · {it.device.name}</span>}
                  {it.note && <div className="testo-sala text-b58-charcoal-soft">{it.note}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-b58-charcoal">
                    {formatEUR(it.full_amount)}
                    {it.type === "sconto" && (
                      <span className="text-b58-charcoal-soft"> (incassato {formatEUR(it.collected_amount)})</span>
                    )}
                  </span>
                  <ConfermaDistruttiva
                    etichetta="Rimuovi"
                    cosaSparisce={`${it.type === "omaggio" ? "l'omaggio" : "lo sconto"} del ${formatDate(it.movement_date)} da ${formatEUR(it.full_amount)}`}
                    onConferma={() => handleDelete(it.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
