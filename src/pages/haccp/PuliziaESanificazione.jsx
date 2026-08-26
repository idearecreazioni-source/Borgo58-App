import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addCleaningLog,
  addPestControlLog,
  createCleaningTask,
  listPestControlLogs,
  pulizieDelMese,
  pulizieDiOggi,
  pulizieMesiConDati,
} from "../../lib/api/haccp";
import { CLEANING_FREQUENCIES, PEST_CONTROL_TYPES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import DatoNonLetto from "../../components/DatoNonLetto";
import ArchivioMensile from "../../components/ArchivioMensile";
import { NOMI_MESI } from "../../lib/nomiMesi";
import GiornataDiServizio from "../../components/GiornataDiServizio";

// Le pulizie: la lista di oggi, e sotto l'archivio per mese.
//
// 🔴 COM'ERA (fino al 24/08/2026): un elenco piatto in ordine alfabetico,
// con sotto ogni voce «Ultima: 12/08/2026». Per sapere se si era in
// ritardo bisognava contare a mente, voce per voce, ricordandosi anche la
// frequenza — la giornaliera fatta il 12 è un guaio, la mensile fatta il
// 12 non è niente. Con sette voci si può fare; con venti non lo fa
// nessuno, e una lista che nessuno guarda è peggio di nessuna lista,
// perché dà l'impressione che qualcuno stia controllando.
//
// ⚠️ IL CALCOLO NON STA QUI. Quando una pulizia è dovuta e da quanti
// giorni è in ritardo lo dice `pulizie_di_oggi()` nel database: la stessa
// risposta serve al manuale esibibile, e due calcoli per la stessa
// domanda prima o poi ne danno due diverse.
//
// ⚠️ IL FORMATO DELL'ARCHIVIO STAMPABILE È PROVVISORIO: quello che l'ASP
// vuole davvero lo dirà la biologa che segue l'HACCP. Qui c'è una forma
// ragionevole — chi, cosa, quando, con la nota — che verrà rifatta.

const emptyTaskForm = { name: "", area: "", frequency: "giornaliera" };
const emptyPestForm = { performed_by: "", type: "ispezione", findings: "", note: "" };

export default function PuliziaESanificazione() {
  const { isTitolare } = useAuth();
  const [oggi, setOggi] = useState(null);
  const [pestLogs, setPestLogs] = useState([]);
  const [mesi, setMesi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const [openTaskId, setOpenTaskId] = useState(null);
  const [logNote, setLogNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [pestForm, setPestForm] = useState(emptyPestForm);
  const [addingPest, setAddingPest] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([leggi(pulizieDiOggi()), listPestControlLogs(), leggi(pulizieMesiConDati())]).then(
        ([lista, pl, ms]) => {
          setOggi(lista);
          setPestLogs(pl);
          setMesi(nonLetto(ms) ? [] : ms);
        }
      ),
    []
  );

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  // L'archivio si chiede al componente comune, un mese alla volta: è
  // l'unica cosa di questa schermata che può diventare grossa, e
  // chiederla sempre vorrebbe dire portarsi dietro un anno di spunte per
  // guardare oggi.
  const caricaMese = useCallback((anno, mese) => pulizieDelMese(anno, mese), []);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddTask = async () => {
    if (!taskForm.name.trim()) return;
    setAddingTask(true);
    setError("");
    try {
      await createCleaningTask({
        name: taskForm.name.trim(),
        area: taskForm.area || null,
        frequency: taskForm.frequency,
      });
      setTaskForm(emptyTaskForm);
      setShowTaskForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingTask(false);
    }
  };

  const handleAddCleaningLog = async (taskId) => {
    setSaving(true);
    setError("");
    try {
      await addCleaningLog({ taskId, note: logNote });
      setOpenTaskId(null);
      setLogNote("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPest = async () => {
    setAddingPest(true);
    setError("");
    try {
      await addPestControlLog({
        performedBy: pestForm.performed_by,
        type: pestForm.type,
        findings: pestForm.findings,
        note: pestForm.note,
      });
      setPestForm(emptyPestForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingPest(false);
    }
  };

  const daFare = useMemo(() => (nonLetto(oggi) ? [] : (oggi ?? []).filter((r) => r.dovuta)), [oggi]);
  const inPari = useMemo(
    () => (nonLetto(oggi) ? [] : (oggi ?? []).filter((r) => !r.dovuta && r.ogni_giorni != null)),
    [oggi]
  );
  const senzaCadenza = useMemo(
    () => (nonLetto(oggi) ? [] : (oggi ?? []).filter((r) => r.ogni_giorni == null)),
    [oggi]
  );

  if (loading) {
    return <p className="testo-sala text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link
        to="/haccp"
        className="tocco-bottone print:hidden inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← HACCP
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Pulizia e disinfestazione</h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------------
          LA LISTA DI OGGI
          --------------------------------------------------------------- */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6 print:hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display testo-sala-grande text-b58-charcoal">Da fare oggi</h2>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setShowTaskForm((v) => !v)}
              className="tocco-bottone testo-sala text-b58-terracotta hover:text-b58-terracotta-dark"
            >
              {showTaskForm ? "Annulla" : "+ Nuova attività"}
            </button>
          )}
        </div>

        {isTitolare && showTaskForm && (
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <input
                value={taskForm.name}
                onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='Es. "Sanificazione banco pesce"'
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
              <input
                value={taskForm.area}
                onChange={(e) => setTaskForm((f) => ({ ...f, area: e.target.value }))}
                placeholder="Area (opzionale)"
                className={inputClass}
              />
              <select
                value={taskForm.frequency}
                onChange={(e) => setTaskForm((f) => ({ ...f, frequency: e.target.value }))}
                className={inputClass}
              >
                {CLEANING_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={addingTask || !taskForm.name.trim()}
                onClick={handleAddTask}
                className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
              >
                {addingTask ? "Aggiungo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>
        )}

        {/* 🔴 Se la lista non si è potuta leggere NON si disegna una lista
            vuota: «niente da fare oggi» è un'informazione, e sarebbe
            falsa. Si dichiara di non sapere, con la via per riprovare. */}
        {nonLetto(oggi) ? (
          <DatoNonLetto
            cosa="le pulizie dovute oggi"
            nonVuolDire="Non vuol dire che non c'è niente da fare: vuol dire che non lo so."
          />
        ) : (
          <>
            {daFare.length === 0 && inPari.length === 0 && senzaCadenza.length === 0 && (
              <p className="testo-sala text-b58-charcoal-soft/60">
                Nessuna attività configurata.{isTitolare ? " Aggiungine una per iniziare." : ""}
              </p>
            )}

            {daFare.length > 0 && (
              <ul className="space-y-1.5 mb-5">
                {daFare.map((r) => (
                  <VoceDaFare
                    key={r.task_id}
                    riga={r}
                    aperta={openTaskId === r.task_id}
                    nota={logNote}
                    setNota={setLogNote}
                    salvando={saving}
                    onApri={() => {
                      setOpenTaskId((id) => (id === r.task_id ? null : r.task_id));
                      setLogNote("");
                    }}
                    onConferma={() => handleAddCleaningLog(r.task_id)}
                  />
                ))}
              </ul>
            )}

            {daFare.length === 0 && (inPari.length > 0 || senzaCadenza.length > 0) && (
              <p className="testo-sala text-b58-olive-dark mb-5">Oggi non c&apos;è niente in scadenza.</p>
            )}

            {(inPari.length > 0 || senzaCadenza.length > 0) && (
              <div className="border-t border-b58-charcoal/10 pt-4">
                <p className="testo-sala text-b58-charcoal-soft mb-2">Il resto, in pari</p>
                <ul className="space-y-1">
                  {inPari.map((r) => (
                    <li key={r.task_id} className="testo-sala text-b58-charcoal-soft">
                      {r.nome}
                      {r.area ? ` · ${r.area}` : ""} —{" "}
                      {r.fatta_oggi ? "fatta oggi" : `ultima ${formatDate(r.ultima_volta)}`}
                    </li>
                  ))}
                  {/* ⚠️ «Altro» vuol dire «una cadenza che il gestionale non
                      conosce»: non può avere una scadenza, e inventargliene
                      una sarebbe peggio che non averla. Si vede, e si dice
                      perché non è in elenco sopra. */}
                  {senzaCadenza.map((r) => (
                    <li key={r.task_id} className="testo-sala text-b58-charcoal-soft">
                      {r.nome}
                      {r.area ? ` · ${r.area}` : ""} —{" "}
                      <span className="text-b58-charcoal-soft/70">senza cadenza fissa</span>
                      {r.ultima_volta ? `, ultima ${formatDate(r.ultima_volta)}` : ", mai fatta"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------------------------------------------------------------
          L'ARCHIVIO, un mese alla volta
          --------------------------------------------------------------- */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Archivio</h2>
        <ArchivioMensile
          mesi={mesi}
          carica={caricaMese}
          nomeFile="pulizie"
          vuoto="Ancora nessuna pulizia registrata."
          colonneCsv={[
            { label: "Giornata", value: (r) => r.giorno },
            { label: "Attività", value: (r) => r.nome },
            { label: "Area", value: (r) => r.area ?? "" },
            { label: "Frequenza", value: (r) => labelFor(CLEANING_FREQUENCIES, r.frequenza) },
            { label: "Registrata il", value: (r) => new Date(r.quando).toLocaleString("it-IT") },
            { label: "Nota", value: (r) => r.nota ?? "" },
          ]}
        >
          {(righe, mese) => <ArchivioMese righe={righe} mese={mese} />}
        </ArchivioMensile>
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 print:hidden">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Disinfestazione</h2>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
            <input
              value={pestForm.performed_by}
              onChange={(e) => setPestForm((f) => ({ ...f, performed_by: e.target.value }))}
              placeholder="Ditta / operatore"
              className={inputClass}
            />
            <select
              value={pestForm.type}
              onChange={(e) => setPestForm((f) => ({ ...f, type: e.target.value }))}
              className={inputClass}
            >
              {PEST_CONTROL_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              value={pestForm.findings}
              onChange={(e) => setPestForm((f) => ({ ...f, findings: e.target.value }))}
              placeholder="Esito (opzionale)"
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={pestForm.note}
              onChange={(e) => setPestForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={addingPest}
              onClick={handleAddPest}
              className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60 shrink-0"
            >
              {addingPest ? "Registro…" : "+ Registra"}
            </button>
          </div>
        </div>

        {pestLogs.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft/60">Nessun intervento registrato ancora.</p>
        ) : (
          <ul className="space-y-1.5">
            {pestLogs.map((p) => (
              <li key={p.id} className="testo-sala text-b58-charcoal-soft">
                <span className="text-b58-charcoal">{labelFor(PEST_CONTROL_TYPES, p.type)}</span>
                {p.performed_by && ` · ${p.performed_by}`} — {formatDate(p.performed_at)}
                {p.findings && ` · ${p.findings}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Una voce da fare: si spunta con un tocco, e la spunta È il registro.
// ---------------------------------------------------------------------
function VoceDaFare({ riga, aperta, nota, setNota, salvando, onApri, onConferma }) {
  // ⚠️ IL RITARDO SI DICE IN GIORNI, non con un colore soltanto: «scaduta
  // da tre giorni» e «scaduta da uno» non sono la stessa cosa, e un solo
  // rosso per tutte e due fa perdere proprio la differenza che serve a
  // decidere da quale cominciare.
  const inRitardo = riga.giorni_ritardo != null && riga.giorni_ritardo > 0;
  const grave = inRitardo || riga.mai_fatta;

  return (
    <li
      className={`rounded-lg p-3 ring-1 ${
        grave ? "bg-b58-terracotta/10 ring-b58-terracotta/40" : "bg-white ring-b58-charcoal/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-b58-charcoal font-medium">{riga.nome}</div>
          <div className="testo-sala text-b58-charcoal-soft">
            {labelFor(CLEANING_FREQUENCIES, riga.frequenza)}
            {riga.area ? ` · ${riga.area}` : ""}
            {riga.mai_fatta ? (
              <span className="text-b58-terracotta-dark font-medium"> · mai fatta</span>
            ) : inRitardo ? (
              <span className="text-b58-terracotta-dark font-medium">
                {" "}
                · in ritardo di {riga.giorni_ritardo}{" "}
                {riga.giorni_ritardo === 1 ? "giorno" : "giorni"}
              </span>
            ) : (
              <span> · ultima {formatDate(riga.ultima_volta)}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onApri}
          className="tocco-azione shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4"
        >
          {aperta ? "Annulla" : "Fatta"}
        </button>
      </div>

      {aperta && (
        <div className="flex flex-wrap gap-2 items-end mt-3">
          <div className="flex-1 min-w-[160px]">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota (opzionale)"
              className="w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
            />
          </div>
          <button
            type="button"
            disabled={salvando}
            onClick={onConferma}
            className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4 disabled:opacity-60"
          >
            {salvando ? "Salvo…" : "Conferma"}
          </button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------
// L'archivio di un mese, raggruppato per giornata di servizio.
// ---------------------------------------------------------------------
function ArchivioMese({ righe, mese }) {
  const giornate = useMemo(() => {
    const per = new Map();
    for (const r of righe) {
      if (!per.has(r.giorno)) per.set(r.giorno, []);
      per.get(r.giorno).push(r);
    }
    return [...per.entries()];
  }, [righe]);

  if (righe.length === 0) {
    return <p className="testo-sala text-b58-charcoal-soft/60">Nessuna pulizia registrata in questo mese.</p>;
  }

  return (
    <div>
      <p className="testo-sala text-b58-charcoal-soft mb-3">
        {NOMI_MESI[mese.mese - 1]} {mese.anno} — {righe.length}{" "}
        {righe.length === 1 ? "registrazione" : "registrazioni"} in {giornate.length}{" "}
        {giornate.length === 1 ? "giornata" : "giornate"}.
        {/* ⚠️ Stampato, non `print:hidden`: il destinatario di questo foglio
            non è chi sta davanti allo schermo, è chi viene a controllare —
            e deve sapere che il giorno è la SERATA di servizio, non il
            calendario, o una pulizia dell'una di notte sembrerà mancante. */}
        <GiornataDiServizio cosa="una pulizia" />
      </p>
      <div className="space-y-3">
        {giornate.map(([giorno, elenco]) => (
          <div key={giorno} className="border-t border-b58-charcoal/10 pt-2">
            <div className="testo-sala text-b58-charcoal font-medium">{formatDate(giorno)}</div>
            <ul className="mt-1 space-y-0.5">
              {elenco.map((r, i) => (
                <li key={`${r.task_id}-${i}`} className="testo-sala text-b58-charcoal-soft">
                  {r.nome}
                  {r.area ? ` · ${r.area}` : ""} ·{" "}
                  {new Date(r.quando).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
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
