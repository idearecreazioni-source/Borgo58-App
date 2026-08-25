import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  agendaCorsie,
  agendaFatti,
  completaTask,
  riapriTask,
  listTasksForMonth,
  spostaTask,
  stellaTask,
} from "../../lib/api/tasks";
import { TASK_CATEGORIES, formatDate, labelFor, oggiLocale } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import { toccaSubito, togliSubito } from "../../lib/calcoli/tocco";

const PRIORITY_BADGE = {
  alta: "bg-b58-terracotta",
  media: "bg-b58-gold",
  bassa: "bg-b58-charcoal-soft/50",
};

// Le quattro corsie, nell'ordine in cui servono a rispondere alla domanda
// vera: cosa devo fare adesso.
const CORSIE = [
  { key: "in_ritardo", titolo: "In ritardo", nascondiSeVuota: true },
  { key: "questa_settimana", titolo: "Questa settimana" },
  { key: "piu_avanti", titolo: "Più avanti" },
  { key: "quando_capita", titolo: "Quando capita" },
];

const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

// «Oggi», «Domani», «Giovedì 20»: una data scritta per intero costringe a
// fare il conto ogni volta.
function etichettaGiorno(iso, oggiISO) {
  if (iso === oggiISO) return "Oggi";
  const d = new Date(`${iso}T12:00:00`);
  const o = new Date(`${oggiISO}T12:00:00`);
  const diff = Math.round((d - o) / 86400000);
  if (diff === 1) return "Domani";
  return `${GIORNI[d.getDay()]} ${d.getDate()}`;
}

function etichettaMese(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function raggruppa(righe, chiave) {
  const map = new Map();
  righe.forEach((r) => {
    const k = chiave(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.entries()];
}

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function CalendarView({ tasks, loading, year, month, onPrev, onNext, selectedDay, onSelectDay }) {
  const firstOfMonth = new Date(year, month - 1, 1);
  // Lunedì=0 ... Domenica=6
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const day = Number(t.due_date.slice(8, 10));
      (map[day] ??= []).push(t);
    });
    return map;
  }, [tasks]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayISO = oggiLocale();

  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrev} className="tocco-bottone text-b58-charcoal-soft hover:text-b58-terracotta px-2">←</button>
        <h3 className="font-display testo-sala-grande text-b58-charcoal">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <button onClick={onNext} className="tocco-bottone text-b58-charcoal-soft hover:text-b58-terracotta px-2">→</button>
      </div>

      {loading ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
            <div key={d} className="testo-sala text-b58-charcoal-soft/60 font-medium pb-1">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayTasks = tasksByDay[day] ?? [];
            const isToday = dateISO === todayISO;
            const isSelected = dateISO === selectedDay;
            return (
              <button
                key={idx}
                onClick={() => onSelectDay(isSelected ? null : dateISO)}
                className={`tocco-bottone aspect-square rounded-lg flex flex-col items-center justify-center testo-sala relative ${
                  isSelected
                    ? "bg-b58-terracotta text-b58-parchment"
                    : isToday
                      ? "bg-b58-olive/15 text-b58-charcoal font-medium"
                      : "text-b58-charcoal hover:bg-b58-cream-dark"
                }`}
              >
                {day}
                {dayTasks.length > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? "bg-b58-parchment" : "bg-b58-terracotta"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Solo il titolare vede i task riservati (la RLS li filtra per lo staff,
// §3.18) — per lui è utile sapere a colpo d'occhio quali lo sono, altrimenti
// non ha modo di distinguerli da quelli che lo staff sta leggendo davvero.
function RiservatoBadge() {
  return (
    <span
      title="Riservato: lo staff non vede questo task"
      className="shrink-0 inline-flex items-center rounded-full bg-b58-charcoal/10 text-b58-charcoal-soft testo-sala font-medium px-2 py-0.5"
    >
      Riservato
    </span>
  );
}

// Una riga della lista, coi tre gesti a portata di pollice.
function RigaImpegno({ t, onFatto, onSposta, onStella, onApri }) {
  const [rimanda, setRimanda] = useState(false);
  const senzaData = !t.due_date;

  return (
    <div className="px-4 py-3">
      {/* ⚠️ `flex-wrap`: su un telefono da 390 punti la fila — casella,
          stella, titolo, provenienza, data, «rimanda» — spingeva la pagina
          fuori dallo schermo di 363 punti. Quello che non entra va a capo
          invece di trascinarsi dietro la pagina. */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="checkbox" checked={false} onChange={onFatto} className="shrink-0" title="Fatto" />
        <button type="button" onClick={onStella} className="tocco-bottone shrink-0 testo-sala-grande leading-none" title="Per me conta">
          <span className={t.preferito ? "text-b58-gold" : "text-b58-charcoal-soft/30"}>★</span>
        </button>
        <button onClick={onApri} className="tocco-bottone flex-1 text-left min-w-0">
          <span className="testo-sala text-b58-charcoal">{t.title}</span>
          <span className="testo-sala text-b58-charcoal-soft ml-2">
            · {labelFor(TASK_CATEGORIES, t.category)}
          </span>
          {/* ⚠️ L'anzianità è ciò che impedisce a «quando capita» di
              diventare un cimitero: senza, una voce ferma da tre mesi
              sembra scritta ieri. */}
          {senzaData && t.giorni_in_lista > 13 && (
            <span className="testo-sala text-b58-charcoal-soft/70 ml-2">
              in lista da {Math.round(t.giorni_in_lista / 30) >= 1
                ? `${Math.round(t.giorni_in_lista / 30)} mes${Math.round(t.giorni_in_lista / 30) === 1 ? "e" : "i"}`
                : `${t.giorni_in_lista} giorni`}
            </span>
          )}
        </button>
        {/* Da dove viene, e ci si arriva con un tocco. */}
        {t.origine_modulo && (
          <Link
            to={t.origine_modulo === "posta" ? "/documenti/posta" : "/documenti"}
            className="tocco-bottone inline-flex items-center shrink-0 testo-sala text-b58-charcoal-soft hover:text-b58-terracotta underline"
          >
            da {t.origine_modulo === "posta" ? "Posta" : "Archivio documenti"}
          </Link>
        )}
        {t.visibile_staff === false && <RiservatoBadge />}
        {t.due_date && (
          <span className="testo-sala text-b58-charcoal-soft shrink-0">{formatDate(t.due_date)}</span>
        )}
        <button
          type="button"
          onClick={() => setRimanda((r) => !r)}
          className="tocco-bottone shrink-0 testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          {senzaData ? "dagli una data" : "rimanda"}
        </button>
      </div>
      {rimanda && (
        <div className="mt-2 pl-8">
          <input
            type="date"
            defaultValue={t.due_date ?? ""}
            onChange={(e) => {
              onSposta(e.target.value);
              setRimanda(false);
            }}
            className="rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala text-b58-charcoal"
          />
        </div>
      )}
    </div>
  );
}

export default function AgendaList() {
  const { isTitolare } = useAuth();
  const oggiISO = oggiLocale();
  const [view, setView] = useState("lista");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [corsie, setCorsie] = useState([]);
  const [apri, setApri] = useState({});
  const [fatti, setFatti] = useState([]);
  const [mostraFatti, setMostraFatti] = useState(false);
  const navigate = useNavigate();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthTasks, setMonthTasks] = useState([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [notice, setNotice] = useState("");

  const ricarica = async () => {
    const [c, f] = await Promise.all([agendaCorsie(), agendaFatti(30)]);
    setCorsie(c);
    setFatti(f);
  };

  // Annullare un «fatto». Sul ricorrente si porta dietro il successore
  // già nato: due righe per lo stesso adempimento sarebbero
  // indistinguibili da due impegni veri.
  const riapri = async (t) => {
    setError("");
    setNotice("");
    try {
      const r = await riapriTask(t.id);
      await ricarica();
      if (r?.successore_tolto) {
        setNotice("Rimesso da fare. Ho tolto anche quello che era già nato per la volta dopo.");
      } else if (r?.successore_rimasto) {
        setNotice(
          "Rimesso da fare. Quello nato per la volta dopo l'hai già lavorato, quindi l'ho lasciato dov'era."
        );
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view !== "calendario") return;
    setMonthLoading(true);
    listTasksForMonth(year, month)
      .then(setMonthTasks)
      .catch((e) => setError(e.message))
      .finally(() => setMonthLoading(false));
  }, [view, year, month]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  };

  // I tre gesti dalla lista, senza aprire la scheda: fatto, rimanda,
  // promuovi a data. Aprire una scheda per spuntare una casella è il
  // motivo per cui le liste non si tengono aggiornate.
  // 🔴 LA RIGA SPARISCE SUBITO, NON DOPO DUE GIRI DI RETE (25/08/2026).
  // Era la stessa forma misurata sulla spesa spicciola — l'aggiornamento
  // e poi la rilettura dell'elenco intero, ~390 ms di media da computer —
  // e qui pesa uguale: spuntare gli impegni è un gesto che si fa in fila,
  // uno dopo l'altro. ⚠️ E la casella era `checked={false}` fissa, quindi
  // per quei due giri il tocco non lasciava **nessun** segno.
  //
  // ⚠️ IL RICARICO RESTA, ma dopo e in silenzio: «fatto» può generare
  // l'impegno successivo di una ricorrenza, e quello lo sa solo il
  // database. La riga sparisce subito; l'impegno nuovo compare quando
  // arriva, insieme alla frase che lo annuncia.
  const fatto = async (task) => {
    setNotice("");
    const { ok, esito } = await togliSubito({
      righe: corsie,
      id: task.id,
      mostra: setCorsie,
      avvisa: setError,
      salva: () => completaTask(task.id),
    });
    if (!ok) return; // `togliSubito` l'ha già rimessa al suo posto e l'ha detto
    if (esito) setNotice("Fatto. Ne è già nato uno nuovo alla prossima scadenza.");
    await ricarica();
  };

  const sposta = async (task, data) => {
    if (!data) return;
    setError("");
    try {
      await spostaTask(task.id, data);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // ⚠️ LA STELLA CAMBIAVA **DOPO** LA RETE (25/08): non ricaricava l'elenco
  // — quello era già stato evitato — ma aspettava lo stesso la risposta
  // prima di accendersi, cioè ~200 ms in cui il tocco non lasciava segno.
  // E se il salvataggio falliva non tornava indietro **perché non era mai
  // andata avanti**: adesso va avanti subito e sa tornare.
  const stella = (task) =>
    toccaSubito({
      righe: corsie,
      id: task.id,
      cambio: { preferito: !task.preferito },
      mostra: setCorsie,
      avvisa: setError,
      salva: () => stellaTask(task.id, !task.preferito),
    });

  // ⚠️ Il badge conta SOLO ritardo e oggi. «Quando capita» non ci entra
  // mai: un numero fermo su venti smette di essere un'informazione e si
  // impara a ignorarlo.
  const daFareAdesso = corsie.filter(
    (c) => c.corsia === "in_ritardo" || c.giorni_alla_scadenza === 0
  ).length;

  const dayTasks = selectedDay ? monthTasks.filter((t) => t.due_date === selectedDay) : [];

  return (
    <div className="testo-sala max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-display text-2xl text-b58-charcoal">
          Agenda
          {/* ⚠️ Il badge conta SOLO ritardo e oggi. «Quando capita» non ci
              entra mai: un numero fermo su venti smette di essere
              un'informazione e si impara a ignorarlo. */}
          {daFareAdesso > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-b58-terracotta text-b58-parchment testo-sala font-medium px-2 py-0.5 align-middle">
              {daFareAdesso}
            </span>
          )}
        </h1>
        <div className="flex flex-wrap gap-2">
          {/* Adempimenti societari: materia riservata al titolare (§3.5). La
              barriera è la RLS — per lo staff l'export uscirebbe comunque
              vuoto — qui si evita solo di mostrargli una porta inutile. */}
          {isTitolare && (
            <Link
              to="/agenda/adempimenti"
              className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
            >
              Scadenze da stampare
            </Link>
          )}
          <Link
            to="/agenda/nuovo"
            className="tocco-bottone inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4  testo-sala"
          >
            + Nuovo task
          </Link>
        </div>
      </div>

      {notice && (
        <p className="testo-sala text-b58-olive-dark bg-b58-olive/10 rounded-lg px-3 py-2 mb-4">{notice}</p>
      )}

      <div className="flex gap-2 mb-4">
        {[
          { value: "lista", label: "Lista" },
          { value: "calendario", label: "Calendario" },
        ].map((v) => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            className={`tocco-bottone testo-sala rounded-full px-3  border transition-colors ${
              view === v.value
                ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                : "border-b58-charcoal/15 text-b58-charcoal-soft"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {error && <p className="testo-sala text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {view === "lista" ? (
        loading ? (
          <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
        ) : corsie.length === 0 ? (
          <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
            <p className="text-b58-charcoal-soft">Niente da fare. Davvero.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {CORSIE.map((c) => {
              const righe = corsie.filter((t) => t.corsia === c.key);
              {/* «In ritardo» sparisce quando è vuota: una corsia vuota in
                  cima ogni giorno è rumore che si impara a saltare. */}
              if (righe.length === 0 && c.nascondiSeVuota) return null;

              let gruppi;
              if (c.key === "questa_settimana") {
                gruppi = raggruppa(righe, (r) => r.due_date).map(([k, v]) => [
                  etichettaGiorno(k, oggiISO),
                  v,
                ]);
              } else if (c.key === "piu_avanti") {
                gruppi = raggruppa(righe, (r) => r.due_date.slice(0, 7)).map(([k, v]) => [
                  etichettaMese(`${k}-01`),
                  v,
                ]);
              } else {
                gruppi = [[null, righe]];
              }

              const chiusa = c.key === "piu_avanti" && !apri[c.key];

              return (
                <section key={c.key}>
                  <button
                    type="button"
                    onClick={() =>
                      c.key === "piu_avanti" && setApri((a) => ({ ...a, [c.key]: !a[c.key] }))
                    }
                    className="tocco-bottone flex items-center gap-2 mb-2"
                  >
                    <h2
                      className={`font-display testo-sala-grande ${
                        c.key === "in_ritardo" ? "text-b58-terracotta-dark" : "text-b58-charcoal"
                      }`}
                    >
                      {c.titolo}
                    </h2>
                    <span className="testo-sala text-b58-charcoal-soft">({righe.length})</span>
                    {c.key === "piu_avanti" && (
                      <span className="testo-sala text-b58-charcoal-soft">{chiusa ? "▸" : "▾"}</span>
                    )}
                  </button>

                  {righe.length === 0 ? (
                    <p className="testo-sala text-b58-charcoal-soft/60">Niente qui.</p>
                  ) : chiusa ? null : (
                    <div className="space-y-3">
                      {gruppi.map(([titolo, elenco]) => (
                        <div key={titolo ?? "unico"}>
                          {titolo && (
                            <p className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1">
                              {titolo}
                            </p>
                          )}
                          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
                            {elenco.map((t) => (
                              <RigaImpegno
                                key={t.id}
                                t={t}
                                onFatto={() => fatto(t)}
                                onSposta={(d) => sposta(t, d)}
                                onStella={() => stella(t)}
                                onApri={() => navigate(`/agenda/${t.id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : null}

      {/* Dove finiscono i fatti. Non e' un archivio: e' la via di
          ritorno da un tocco sbagliato. Chiusa di default, perche' la
          domanda dell'Agenda resta «cosa devo fare adesso». */}
      {view === "lista" && fatti.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setMostraFatti((m) => !m)}
            className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
          >
            {mostraFatti ? "▾" : "▸"} Fatti di recente ({fatti.length})
          </button>
          {mostraFatti && (
            <div className="mt-2 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
              {fatti.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="testo-sala text-b58-charcoal-soft line-through flex-1 min-w-0">
                    {f.title}
                  </span>
                  {f.ricorrenza && (
                    <span className="testo-sala text-b58-charcoal-soft/70 shrink-0">si ripete</span>
                  )}
                  <span className="testo-sala text-b58-charcoal-soft/70 shrink-0">
                    {formatDate(f.fatto_il)}
                  </span>
                  <button
                    type="button"
                    onClick={() => riapri(f)}
                    className="tocco-bottone shrink-0 testo-sala text-b58-terracotta hover:text-b58-terracotta-dark"
                  >
                    rimetti da fare
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "calendario" ? (
        <>
          <CalendarView
            tasks={monthTasks}
            loading={monthLoading}
            year={year}
            month={month}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mt-4">
              <h3 className="testo-sala font-medium text-b58-charcoal mb-2">{formatDate(selectedDay)}</h3>
              {dayTasks.length === 0 ? (
                <p className="testo-sala text-b58-charcoal-soft">Nessun task in questo giorno.</p>
              ) : (
                <div className="space-y-2">
                  {dayTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/agenda/${t.id}`)}
                      className="tocco-bottone w-full text-left flex items-center gap-2 testo-sala"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_BADGE[t.priority]}`}
                      />
                      <span className="text-b58-charcoal flex-1">{t.title}</span>
                      {t.visibile_staff === false && <RiservatoBadge />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
