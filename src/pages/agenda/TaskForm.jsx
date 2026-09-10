import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { createTask, deleteTask, getTask, updateTask } from "../../lib/api/tasks";
import { TASK_RICORRENZA_UNITA } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

import { useDaVoce } from "../../lib/daVoce";
import { conCampi } from "../../lib/calcoli/aMano";
import { provenienzaImpegno } from "../../lib/calcoli/agenda";
import { StriscaDallaVoce } from "../../components/StriscaDallaVoce";

// Quello che il gestionale ha già capito da un promemoria dettato.
// ⚠️ L'ora (`due_time`) non c'è: la voce dà il giorno, non l'ora, e
//    inventarla metterebbe una scadenza precisa che nessuno ha detto.
const DA_VOCE = {
  titolo: "title",
  descrizione: "description",
  scadenza: "due_date",
  priorita: "priority",
  categoria: "category",
};

const emptyForm = {
  title: "",
  description: "",
  due_date: "",
  due_time: "",
  priority: "media",
  // 🔴 STATO E CATEGORIA NON SI SCELGONO PIÙ QUI — 10/09/2026, deciso da
  //    Alessio. Non sono spariti dal gestionale: sono spariti dal MODULO.
  //
  //    · lo **stato** di un impegno appena scritto è «da fare», sempre: non
  //      esiste il caso di uno che apre «Nuovo impegno» per dichiararlo già
  //      completato. Chiuderlo si fa con la spunta nell'elenco, che è il
  //      gesto per cui quella schermata esiste. La colonna resta, e resta
  //      quella che era su un impegno che si sta correggendo.
  //    · la **categoria** di un impegno scritto a mano è «Altro», e il
  //      menu lo dimostrava: su venti righe diceva «Altro» quindici volte.
  //      ⚠️ Non si riscrive niente all'indietro — un impegno nato dalla
  //      posta o dall'Archivio tiene la categoria che gli ha messo il
  //      modulo che l'ha creato, e correggerlo qui non gliela cambia.
  status: "da_fare",
  category: "altro",
  preferito: false,
  ricorrenza_ogni: "",
  ricorrenza_unita: "",
  remind_date: "",
  remind_time: "",
  // §3.18: l'Agenda è condivisa, quindi un task nasce visibile. Il titolare
  // può riservarne uno singolo; per i task automatici decide il DB (trigger
  // trg_task_visibility), qualunque cosa mandi questo form.
  visibile_staff: true,
};

// Il DB salva remind_at come timestamptz (UTC); i campi data/ora del form
// lavorano in ora locale del browser — Date fa la conversione in entrambe
// le direzioni.
const splitLocal = (isoString) => {
  if (!isoString) return { date: "", time: "" };
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};
const combineToISO = (date, time) =>
  date && time ? new Date(`${date}T${time}`).toISOString() : null;

const maiuscola = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function TaskForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  const [form, setForm] = useState(emptyForm);
  // ⚠️ Solo su un promemoria NUOVO: aprendo uno esistente i campi sono i
  //    suoi, e riempirli con quelli di una dettatura li cancellerebbe.
  const venuto = useDaVoce((c) => { if (!isEdit) setForm((f) => conCampi(f, c, DA_VOCE)); });
  const [origineModulo, setOrigineModulo] = useState(null);
  const [reminderSentAt, setReminderSentAt] = useState(null);
  const [initialRemindAt, setInitialRemindAt] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getTask(id)
      .then((t) => {
        if (cancelled) return;
        const remind = splitLocal(t.remind_at);
        setForm({
          title: t.title,
          description: t.description ?? "",
          due_date: t.due_date ?? "",
          due_time: t.due_time?.slice(0, 5) ?? "",
          priority: t.priority,
          status: t.status,
          category: t.category ?? "altro",
          preferito: t.preferito ?? false,
          ricorrenza_ogni: t.ricorrenza_ogni ?? "",
          ricorrenza_unita: t.ricorrenza_unita ?? "",
          remind_date: remind.date,
          remind_time: remind.time,
          visibile_staff: t.visibile_staff ?? true,
        });
        setOrigineModulo(t.origine_modulo);
        setReminderSentAt(t.reminder_sent_at);
        setInitialRemindAt(t.remind_at);
      })
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  if (notFound) return <Navigate to="/agenda" replace />;
  if (loading) {
    return <p className="testo-sala-grande text-b58-charcoal-soft max-w-xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full min-w-0 tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const siRipete = Boolean(form.ricorrenza_unita);

  // 🔴 LE DUE CASELLE DI UNA DATA STANNO IN UNA GRIGLIA CHE NON SBORDA —
  //    10/09/2026. Erano già affiancate, e sul telefono non ci stavano lo
  //    stesso: una casella `date` o `time` ha una larghezza minima sua, e
  //    in una griglia una colonna non scende sotto il contenuto se non
  //    glielo si dice. Da qui `min-w-0` sulle due colonne — senza, il
  //    riquadro esce dallo schermo invece di stringersi.
  //    ⚠️ È la famiglia misurata il 25/08 su HACCP, Magazzino e Comande:
  //    da un monitor non si vede, perché lo spazio c'è.
  //    🔴 11/09/2026: `min-w-0` non bastava. Stringeva la COLONNA, non la
  //    casella: a 390 punti ogni metà ne ha 149, e una casella di data ne
  //    chiede 175 (251 a 64 punti per centimetro) — su Safari la data si
  //    tagliava e l'icona ci finiva sopra. Sul telefono le due caselle
  //    vanno una sotto l'altra, affiancate da `sm` in su, dove ci stanno.
  //    🔴 11/09/2026, SECONDO GIRO — dal collaudo su iPhone: impilate a
  //    tutta larghezza col testo grande erano «troppo grandi». Adesso ogni
  //    casella è larga quanto il suo contenuto, con un minimo in centimetri
  //    veri (una casella vuota non deve stringersi fino a sparire), il testo
  //    è quello dei campi secondari (3,2 mm) e l'altezza 0,75 cm. Giorno e
  //    ora stanno sulla stessa riga quando ci stanno e vanno a capo quando
  //    no: decide lo spazio vero, non una soglia di larghezza.
  const rigaCompatta = "flex flex-wrap items-end gap-x-3 gap-y-2";
  const contenitoreCampo = "min-w-0 max-w-full testo-sala";
  const campoCompatto =
    "block max-w-full rounded-lg border border-b58-charcoal/15 bg-white px-2 py-0.5 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta [&::-webkit-date-and-time-value]:text-left";
  const altezzaCompatta = { minHeight: "calc(var(--pxcm) * 0.75)" };
  const largoAlmeno = (cm) => ({ ...altezzaCompatta, minWidth: `calc(var(--pxcm) * ${cm})` });

  // 🔴 L'ORA SI SCEGLIE A PASSI DI CINQUE MINUTI, MA UN ORARIO GIÀ SCRITTO
  //    NON SI TOCCA — 10/09/2026, ed è la parte non ovvia della richiesta.
  //
  //    `step={300}` non è solo un comodo per il selettore: rende **non
  //    valido** un orario fuori griglia, e un promemoria già salvato alle
  //    20:07 non si potrebbe più salvare — il modulo si rifiuterebbe di
  //    partire, su una cosa che nessuno aveva chiesto di cambiare.
  //    Quindi il passo si mette solo dove non fa danno: casella vuota, o
  //    orario già sui cinque minuti. Chi ha un 20:07 se lo tiene finché
  //    non lo cambia lui.
  const passoCinqueMinuti = (v) =>
    !v || Number(v.slice(3, 5)) % 5 === 0 ? { step: 300 } : {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const newRemindAt = combineToISO(form.remind_date, form.remind_time);
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        priority: form.priority,
        status: form.status,
        category: form.category || "altro",
        preferito: form.preferito,
        // ⚠️ Le due caselle vanno insieme o non vanno: mandarne una sola
        //    il database lo rifiuta (vincolo `ricorrenza_intera`), ed è
        //    giusto — un numero senza unità non dice ogni quanto.
        ricorrenza_ogni: siRipete ? Number(form.ricorrenza_ogni) : null,
        ricorrenza_unita: siRipete ? form.ricorrenza_unita : null,
        remind_at: newRemindAt,
        visibile_staff: form.visibile_staff,
        // Un promemoria nuovo o cambiato deve poter essere rimandato di nuovo.
        ...(newRemindAt !== initialRemindAt ? { reminder_sent_at: null } : {}),
      };
      if (isEdit) {
        await updateTask(id, payload);
        navigate("/agenda");
      } else {
        await createTask(payload);
        // 🔴 DOPO il salvataggio riuscito, mai prima.
        await venuto.chiudi();
        navigate("/agenda");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteTask(id);
      navigate("/agenda");
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/agenda" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Agenda
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        {isEdit ? "Modifica task" : "Nuovo task"}
      </h1>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <StriscaDallaVoce venuto={venuto} />

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Titolo</label>
          <input
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Descrizione (opzionale)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className={inputClass}
          />
        </div>

        <div className={rigaCompatta}>
          <div className={contenitoreCampo}>
            <label className={labelClass}>📅 Giorno</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className={campoCompatto}
              style={largoAlmeno(2.6)}
            />
          </div>
          <div className={contenitoreCampo}>
            <label className={labelClass}>🕒 Ora</label>
            <input
              type="time"
              value={form.due_time}
              onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
              className={campoCompatto}
              style={largoAlmeno(1.6)}
              disabled={!form.due_date}
              {...passoCinqueMinuti(form.due_time)}
            />
          </div>
        </div>

        {/* 🔴 LA CADENZA SI DICE A PAROLE SUE — 10/09/2026.
            Erano quattro voci fisse (ogni mese / tre mesi / sei mesi /
            anno), cioè il calendario fiscale: chi doveva cambiare i filtri
            della cappa ogni sei settimane non trovava nessuna casella, e
            **senza nessun errore** — quindi sembrava che la cosa non si
            potesse fare.
            ⚠️ La didascalia «chiudendolo ne nasce subito un altro» è
            sparita: si legge il primo giorno e poi diventa arredamento, e
            il gesto la dimostra da sé la prima volta che si chiude un
            ricorrente (criterio del 18/08). */}
        <div>
          <label className={labelClass}>Si ripete</label>
          {/* 🔴 «OGNI [n] [unità]» ERA ROTTA — 11/09/2026, collaudo su
              iPhone. La casella del numero portava insieme `w-full` (dalla
              classe comune) e `w-16`, e vinceva la prima: il numero
              prendeva tutta la riga e il menu dell'unità finiva fuori
              allineamento. Ora ogni pezzo ha la larghezza sua — il numero
              tre cifre, il menu la parola più lunga — e se la frase non ci
              sta accanto a «Si ripete» va a capo intera, sotto. */}
          <div className={rigaCompatta} data-ripete>
            <div className={contenitoreCampo}>
            <select
              value={siRipete ? "si" : "no"}
              onChange={(e) =>
                setForm((f) =>
                  e.target.value === "si"
                    ? // Una proposta, non una risposta data al posto suo:
                      // si vede, ed è la prima cosa che si corregge.
                      { ...f, ricorrenza_ogni: f.ricorrenza_ogni || 1, ricorrenza_unita: "mesi" }
                    : { ...f, ricorrenza_ogni: "", ricorrenza_unita: "" }
                )
              }
              className={campoCompatto}
              style={altezzaCompatta}
            >
              <option value="no">Non si ripete</option>
              <option value="si">Si ripete</option>
            </select>
            </div>
            {siRipete && (
              <div className={`${contenitoreCampo} flex flex-wrap items-center gap-2`}>
                <span className="text-b58-charcoal-soft shrink-0">ogni</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={form.ricorrenza_ogni}
                  onChange={(e) => setForm((f) => ({ ...f, ricorrenza_ogni: e.target.value }))}
                  className={`${campoCompatto} shrink-0 text-center`}
                  style={{ ...altezzaCompatta, width: "calc(var(--pxcm) * 1.4)" }}
                />
                <select
                  value={form.ricorrenza_unita}
                  onChange={(e) => setForm((f) => ({ ...f, ricorrenza_unita: e.target.value }))}
                  className={campoCompatto}
                  style={altezzaCompatta}
                >
                  {TASK_RICORRENZA_UNITA.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* La stella non si può calcolare da nient'altro: è l'unica cosa
            che dice «questo lo voglio davanti agli occhi». */}
        <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
          <input
            type="checkbox"
            checked={form.preferito}
            onChange={(e) => setForm((f) => ({ ...f, preferito: e.target.checked }))}
          />
          ★ Per me conta
        </label>

        {isTitolare && !origineModulo && (
          <div className="border-t border-b58-charcoal/10 pt-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.visibile_staff}
                onChange={(e) => setForm((f) => ({ ...f, visibile_staff: e.target.checked }))}
                className="mt-0.5 shrink-0"
              />
              {/* ⚠️ LA SPIEGAZIONE È SPARITA — 10/09/2026, deciso da
                  Alessio. Diceva «l'Agenda è condivisa: di norma un task è
                  visibile a tutti; togli la spunta per tenerlo solo per
                  te», cioè raccontava a parole quello che la casella fa.
                  La regola non è cambiata e resta scritta dov'è sempre
                  stata: §3.18 del contratto e il trigger
                  `trg_task_visibility`. Il giorno che entrerà personale
                  nuovo, la spiegazione andrà rimessa — con parole per chi
                  non ha mai visto questa schermata, non con queste. */}
              <span className="testo-sala-grande text-b58-charcoal">Visibile allo staff</span>
            </label>
          </div>
        )}

        <div className="border-t border-b58-charcoal/10 pt-4">
          {/* ⚠️ Via anche qui la didascalia: le due caselle adesso si
              chiamano «Giorno» e «Ora», e una frase che ripete quello che
              c'è scritto sopra le caselle è ingombro. Che il promemoria sia
              indipendente dalla scadenza si vede compilandolo. */}
          <label className={labelClass}>Promemoria Telegram (opzionale)</label>
          <div className={rigaCompatta}>
            <div className={contenitoreCampo}>
              <label className={labelClass}>📅 Giorno</label>
              <input
                type="date"
                value={form.remind_date}
                onChange={(e) => setForm((f) => ({ ...f, remind_date: e.target.value }))}
                className={campoCompatto}
                style={largoAlmeno(2.6)}
              />
            </div>
            <div className={contenitoreCampo}>
              <label className={labelClass}>🕒 Ora</label>
              <input
                type="time"
                value={form.remind_time}
                onChange={(e) => setForm((f) => ({ ...f, remind_time: e.target.value }))}
                className={campoCompatto}
                style={largoAlmeno(1.6)}
                disabled={!form.remind_date}
                {...passoCinqueMinuti(form.remind_time)}
              />
            </div>
          </div>
          {form.remind_date && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, remind_date: "", remind_time: "" }))}
              className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark mt-1.5"
            >
              Rimuovi promemoria
            </button>
          )}
          {reminderSentAt && (
            <p className="testo-sala text-b58-olive-dark mt-1.5">
              ✓ Promemoria già inviato il {new Date(reminderSentAt).toLocaleString("it-IT")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={saving}
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 testo-sala-grande"
          >
            {saving ? "Salvo…" : isEdit ? "Salva modifiche" : "Crea task"}
          </button>
          {isEdit && isTitolare && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="tocco-testo testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta-dark"
            >
              Elimina
            </button>
          )}
        </div>
      </form>

      {/* 🔴 DA DOVE VIENE, IN FONDO E IN PICCOLO — 11/09/2026, dal collaudo
          su iPhone. Stava in un riquadro colorato in cima alla scheda,
          prima ancora del titolo, e nell'elenco era una riga su ogni
          impegno nato da solo. È un'informazione secondaria: si legge qui,
          dopo tutto il resto. Per un impegno automatico dice anche chi lo
          vede, perché lì la casella «Visibile allo staff» non c'è. */}
      {origineModulo && (
        <div className="mt-3 px-1 testo-sala text-b58-charcoal-soft" data-provenienza>
          <p>{maiuscola(provenienzaImpegno({ origine_modulo: origineModulo }))}.</p>
          {isTitolare && (
            <p className="mt-0.5">
              {form.visibile_staff
                ? "Visibile anche allo staff."
                : "Riservato a te: lo staff non vede questo task in Agenda. La visibilità dei task automatici dipende dal modulo di origine e non è modificabile da qui."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
