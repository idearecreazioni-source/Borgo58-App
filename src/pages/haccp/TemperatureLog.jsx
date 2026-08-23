import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addTemperatureLog,
  createEquipment,
  listEquipment,
  listNonConformities,
  temperatureDelMese,
  temperatureDiOggi,
  temperatureMesiConDati,
} from "../../lib/api/haccp";
import { STORAGE_TYPES, formatDate } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import DatoNonLetto from "../../components/DatoNonLetto";
import ArchivioMensile from "../../components/ArchivioMensile";
import { NOMI_MESI } from "../../lib/nomiMesi";

// Il registro temperature: cosa è stato registrato OGGI, e sotto
// l'archivio mese per mese.
//
// 🔴 COM'ERA (fino al 24/08/2026), e perché non andava. Sotto c'era
// «Storico rilevazioni»: un elenco cronologico tagliato a cinquanta righe
// **senza dichiararlo**, sopra 732 rilevazioni vere. Chi guardava vedeva
// le ultime cinquanta e nessuno gli diceva che erano le ultime cinquanta.
// E la domanda che si fa davvero aprendo questa schermata — *«oggi le ho
// fatte tutte?»* — non aveva risposta da nessuna parte: bisognava
// scorrere l'elenco e confrontarlo a mente con le attrezzature.
//
// ⚠️ IN EVIDENZA CI VA ANCHE QUELLO CHE MANCA. Un elenco di ciò che è
// stato registrato non dice quali frigoriferi sono rimasti fuori, e su un
// registro esibibile è esattamente il buco da vedere: le non registrate
// vengono per prime.
//
// ⚠️ IL GIORNO È LA SERATA DI SERVIZIO, non il calendario: le temperature
// si leggono a giro, anche dopo mezzanotte. Il calcolo sta nel database
// (`temperature_di_oggi`), che è anche l'unico posto dove vive.
//
// ⚠️ IL FORMATO STAMPABILE È PROVVISORIO: quello che l'ASP vuole davvero
// lo dirà la biologa che segue l'HACCP.

const emptyEquipmentForm = { name: "", storageType: "", targetMinC: "", targetMaxC: "" };
const emptyReadingForm = { recordedTempC: "", note: "", correctiveAction: "" };

export default function TemperatureLog() {
  const { isTitolare } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [oggi, setOggi] = useState(null);
  const [aperte, setAperte] = useState(null);
  const [mesi, setMesi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");

  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [addingEquipment, setAddingEquipment] = useState(false);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);

  const [openRow, setOpenRow] = useState(null);
  const [readingForm, setReadingForm] = useState(emptyReadingForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        listEquipment(),
        leggi(temperatureDiOggi()),
        leggi(listNonConformities()),
        leggi(temperatureMesiConDati()),
      ]).then(([eq, og, nc, ms]) => {
        setEquipment(eq);
        setOggi(og);
        setAperte(nonLetto(nc) ? nc : nc.filter((i) => !i.resolved));
        setMesi(nonLetto(ms) ? [] : ms);
      }),
    []
  );

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  const caricaMese = useCallback((anno, mese) => temperatureDelMese(anno, mese), []);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddEquipment = async () => {
    if (!equipmentForm.name.trim()) return;
    setAddingEquipment(true);
    setError("");
    try {
      await createEquipment({
        name: equipmentForm.name.trim(),
        storageType: equipmentForm.storageType || null,
        targetMinC: equipmentForm.targetMinC ? Number(equipmentForm.targetMinC) : null,
        targetMaxC: equipmentForm.targetMaxC ? Number(equipmentForm.targetMaxC) : null,
      });
      setEquipmentForm(emptyEquipmentForm);
      setShowEquipmentForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingEquipment(false);
    }
  };

  const toggleRow = (equipmentId) => {
    setOpenRow((r) => (r === equipmentId ? null : equipmentId));
    setReadingForm(emptyReadingForm);
    setError("");
  };

  const handleAddReading = async (equipmentId) => {
    if (!readingForm.recordedTempC) return;
    setSaving(true);
    setError("");
    try {
      const esito = await addTemperatureLog({
        equipmentId,
        recordedTempC: Number(readingForm.recordedTempC),
        note: readingForm.note,
        correctiveAction: readingForm.correctiveAction,
      });
      // La lettura è salvata comunque. Se era fuori range senza rimedio,
      // resta aperta una non conformità: si dice, non si nasconde.
      setAvviso(
        esito?.da_chiudere
          ? "Fuori range: ho aperto una non conformità. Resta aperta finché non scrivi cosa hai fatto."
          : esito?.fuori_range
            ? "Fuori range: registrata insieme al rimedio che hai scritto."
            : ""
      );
      setOpenRow(null);
      setReadingForm(emptyReadingForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="testo-sala text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  const mancanti = nonLetto(oggi) ? [] : (oggi ?? []).filter((r) => !r.registrata);
  const fatte = nonLetto(oggi) ? [] : (oggi ?? []).filter((r) => r.registrata);

  return (
    <div className="testo-sala max-w-4xl mx-auto pb-16">
      <Link
        to="/haccp"
        className="tocco-bottone print:hidden inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← HACCP
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Registro temperature</h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {avviso && (
        <p className="testo-sala text-b58-gold-dark bg-b58-gold/10 rounded-lg px-3 py-2 mb-4">{avviso}</p>
      )}

      {/* ---------------------------------------------------------------
          OGGI
          --------------------------------------------------------------- */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6 print:hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display testo-sala-grande text-b58-charcoal">Oggi</h2>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setShowEquipmentForm((v) => !v)}
              className="tocco-bottone testo-sala text-b58-terracotta hover:text-b58-terracotta-dark"
            >
              {showEquipmentForm ? "Annulla" : "+ Nuova attrezzatura"}
            </button>
          )}
        </div>

        {isTitolare && showEquipmentForm && (
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                value={equipmentForm.name}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='Es. "Frigo pesce"'
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
              <select
                value={equipmentForm.storageType}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, storageType: e.target.value }))}
                className={inputClass}
              >
                <option value="">Tipo (opzionale)</option>
                {STORAGE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                value={equipmentForm.targetMinC}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, targetMinC: e.target.value }))}
                placeholder="Min °C"
                className={inputClass}
              />
              <input
                type="number"
                step="0.1"
                value={equipmentForm.targetMaxC}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, targetMaxC: e.target.value }))}
                placeholder="Max °C"
                className={inputClass}
              />
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={addingEquipment || !equipmentForm.name.trim()}
                onClick={handleAddEquipment}
                className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
              >
                {addingEquipment ? "Aggiungo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>
        )}

        {/* 🔴 Se la lista non si è letta NON si disegna «tutto fatto»: una
            schermata che tace quando non sa è una rassicurazione falsa. */}
        {nonLetto(oggi) ? (
          <DatoNonLetto
            cosa="le temperature registrate oggi"
            nonVuolDire="Non vuol dire che non ne è stata registrata nessuna: vuol dire che non lo so."
          />
        ) : equipment.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft/60">
            Nessuna attrezzatura ancora.
            {isTitolare ? " Aggiungine una per iniziare a registrare le temperature." : ""}
          </p>
        ) : (
          <>
            {mancanti.length > 0 && (
              <>
                <p className="testo-sala text-b58-terracotta-dark font-medium mb-2">
                  Ancora da registrare oggi ({mancanti.length})
                </p>
                <table className="w-full testo-sala mb-5">
                  <tbody>
                    {mancanti.map((eq) => (
                      <RigaAttrezzatura
                        key={eq.equipment_id}
                        eq={eq}
                        aperta={openRow === eq.equipment_id}
                        form={readingForm}
                        setForm={setReadingForm}
                        salvando={saving}
                        inputClass={inputClass}
                        onToggle={() => toggleRow(eq.equipment_id)}
                        onConferma={() => handleAddReading(eq.equipment_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {mancanti.length === 0 && (
              <p className="testo-sala text-b58-olive-dark mb-4">
                Tutte le attrezzature sono state registrate oggi.
              </p>
            )}

            {fatte.length > 0 && (
              <>
                <p className="testo-sala text-b58-charcoal-soft mb-2">Già fatte oggi ({fatte.length})</p>
                <table className="w-full testo-sala">
                  <tbody>
                    {fatte.map((eq) => (
                      <RigaAttrezzatura
                        key={eq.equipment_id}
                        eq={eq}
                        aperta={openRow === eq.equipment_id}
                        form={readingForm}
                        setForm={setReadingForm}
                        salvando={saving}
                        inputClass={inputClass}
                        onToggle={() => toggleRow(eq.equipment_id)}
                        onConferma={() => handleAddReading(eq.equipment_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>

      {/* ---------------------------------------------------------------
          LE NON CONFORMITÀ ANCORA APERTE
          ⚠️ Stanno qui perché è qui che nascono: una temperatura fuori
          range ne apre una, e chi sta facendo il giro dei frigoriferi è
          esattamente chi può chiuderla. Il posto dove si gestiscono resta
          uno solo, e c'è il collegamento.
          --------------------------------------------------------------- */}
      {nonLetto(aperte) ? (
        <div className="mb-6 print:hidden">
          <DatoNonLetto cosa="le non conformità ancora aperte" />
        </div>
      ) : (
        aperte?.length > 0 && (
          <div className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/40 p-5 mb-6 print:hidden">
            <h2 className="font-display testo-sala-grande text-b58-terracotta-dark mb-2">
              Non conformità aperte ({aperte.length})
            </h2>
            <ul className="space-y-1 mb-3">
              {aperte.slice(0, 5).map((i) => (
                <li key={i.id} className="testo-sala text-b58-charcoal">
                  {i.description}
                  <span className="text-b58-charcoal-soft"> · {formatDate(i.detected_at)}</span>
                </li>
              ))}
            </ul>
            {/* ⚠️ Il taglio si DICHIARA: un elenco che finisce senza dirlo
                fa credere che siano tutte. */}
            {aperte.length > 5 && (
              <p className="testo-sala text-b58-charcoal-soft mb-3">
                …e altre {aperte.length - 5}.
              </p>
            )}
            <Link
              to="/haccp/non-conformita"
              className="tocco-bottone inline-flex items-center rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4"
            >
              Vai alle non conformità
            </Link>
          </div>
        )
      )}

      {/* ---------------------------------------------------------------
          L'ARCHIVIO
          --------------------------------------------------------------- */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Archivio</h2>
        <ArchivioMensile
          mesi={mesi}
          carica={caricaMese}
          nomeFile="temperature"
          vuoto="Nessuna rilevazione ancora."
          etichettaMese={(m) => (Number(m.fuori) > 0 ? `${m.quante}, ${m.fuori} fuori range` : `${m.quante}`)}
          colonneCsv={[
            { label: "Giornata", value: (r) => r.giorno },
            { label: "Attrezzatura", value: (r) => r.nome },
            { label: "Temperatura (°C)", value: (r) => r.temperatura },
            { label: "Range", value: (r) => (r.target_min_c != null ? `${r.target_min_c}/${r.target_max_c}` : "") },
            { label: "Esito", value: (r) => (r.fuori_range == null ? "nessun range" : r.fuori_range ? "Fuori range" : "Conforme") },
            { label: "Registrata il", value: (r) => new Date(r.quando).toLocaleString("it-IT") },
            { label: "Nota", value: (r) => r.nota ?? "" },
            { label: "Azione correttiva", value: (r) => r.rimedio ?? "" },
          ]}
        >
          {(righe, mese) => <ArchivioTemperature righe={righe} mese={mese} />}
        </ArchivioMensile>
      </div>
    </div>
  );
}

function RigaAttrezzatura({ eq, aperta, form, setForm, salvando, inputClass, onToggle, onConferma }) {
  return (
    <Fragment>
      <tr className="border-b border-b58-charcoal/5 last:border-0">
        <td className="py-2 text-b58-charcoal font-medium">
          {eq.nome}
          {eq.target_min_c != null && (
            <span className="testo-sala text-b58-charcoal-soft ml-1.5">
              ({eq.target_min_c}° / {eq.target_max_c}°)
            </span>
          )}
          <div className="testo-sala text-b58-charcoal-soft">
            {eq.ultima_ora == null ? (
              "mai registrata"
            ) : (
              <>
                ultima {eq.ultima_temp}°C · {formatDate(eq.ultima_ora)}
                {eq.fuori_range === true && (
                  <span className="text-b58-terracotta-dark font-medium"> · era fuori range</span>
                )}
                {/* ⚠️ Senza un range non si dice «conforme»: non si sa. */}
                {eq.fuori_range === null && (
                  <span className="text-b58-charcoal-soft/70"> · nessun range impostato</span>
                )}
              </>
            )}
          </div>
        </td>
        <td className="py-2 text-right">
          <button
            onClick={onToggle}
            className="tocco-bottone text-b58-charcoal-soft hover:text-b58-terracotta-dark testo-sala"
          >
            {aperta ? "Annulla" : eq.registrata ? "+ Registra ancora" : "+ Registra temperatura"}
          </button>
        </td>
      </tr>
      {aperta && (
        <tr className="bg-white">
          <td colSpan={2} className="py-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="w-24">
                <input
                  type="number"
                  step="0.1"
                  value={form.recordedTempC}
                  onChange={(e) => setForm((f) => ({ ...f, recordedTempC: e.target.value }))}
                  placeholder="°C"
                  className={inputClass}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Nota (opzionale)"
                  className={inputClass}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <input
                  value={form.correctiveAction}
                  onChange={(e) => setForm((f) => ({ ...f, correctiveAction: e.target.value }))}
                  placeholder="Azione correttiva (se fuori range)"
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                disabled={salvando || !form.recordedTempC}
                onClick={onConferma}
                className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
              >
                {salvando ? "Salvo…" : "Conferma"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function ArchivioTemperature({ righe, mese }) {
  const giornate = [];
  const per = new Map();
  for (const r of righe) {
    if (!per.has(r.giorno)) {
      per.set(r.giorno, []);
      giornate.push(r.giorno);
    }
    per.get(r.giorno).push(r);
  }
  const fuori = righe.filter((r) => r.fuori_range === true).length;

  return (
    <div>
      <p className="testo-sala text-b58-charcoal-soft mb-3">
        {NOMI_MESI[mese.mese - 1]} {mese.anno} — {righe.length}{" "}
        {righe.length === 1 ? "rilevazione" : "rilevazioni"} in {giornate.length}{" "}
        {giornate.length === 1 ? "giornata" : "giornate"}
        {fuori > 0 ? `, di cui ${fuori} fuori range` : ", nessuna fuori range"}.
        {/* Stampato, non nascosto: il destinatario di questo foglio è chi
            viene a controllare, e deve sapere che la giornata è quella di
            servizio — o una lettura dell'una di notte sembrerà mancante. */}
        <span className="block text-b58-charcoal-soft/70">
          La giornata è quella di servizio: una lettura fatta dopo mezzanotte resta nella serata che si
          stava chiudendo. Formato provvisorio, da rivedere con la biologa.
        </span>
      </p>
      <div className="space-y-3">
        {giornate.map((g) => (
          <div key={g} className="border-t border-b58-charcoal/10 pt-2">
            <div className="testo-sala text-b58-charcoal font-medium">{formatDate(g)}</div>
            <ul className="mt-1 space-y-0.5">
              {per.get(g).map((r, i) => (
                <li key={`${r.equipment_id}-${i}`} className="testo-sala text-b58-charcoal-soft">
                  {r.nome} · <span className="text-b58-charcoal">{r.temperatura}°C</span>
                  {r.fuori_range === true && (
                    <span className="text-b58-terracotta-dark font-medium"> · fuori range</span>
                  )}
                  {r.fuori_range === null && <span> · nessun range</span>}
                  {" · "}
                  {new Date(r.quando).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  {r.rimedio ? ` — rimedio: ${r.rimedio}` : ""}
                  {r.nota ? ` — ${r.nota}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
