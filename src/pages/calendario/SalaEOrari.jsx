import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import { oggiLocale } from "../../lib/constants";
import {
  GIORNI,
  createClosure,
  deleteClosure,
  getRegolePrenotazione,
  listClosures,
  listDiningTables,
  listServiceHours,
  updateRegolePrenotazione,
  updateServiceHour,
  updateTableSeats,
} from "../../lib/api/sala";

// I numeri che il locale conosce e il software no: quanti posti ha ogni
// tavolo, quando si è aperti, quanto si tiene un tavolo. Da qui il form
// pubblico sa se c'è posto — e sono numeri che cambiano nel tempo, quindi
// li cambia Alessio senza chiedere una modifica al software.

const inputClass =
  "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";
const sezioneClass = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6";

export default function SalaEOrari() {
  const [tavoli, setTavoli] = useState([]);
  const [orari, setOrari] = useState([]);
  const [chiusure, setChiusure] = useState([]);
  const [regole, setRegole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");
  const [nuovaChiusura, setNuovaChiusura] = useState({ dal: "", al: "", motivo: "" });

  const ricarica = useCallback(async () => {
    const [t, o, c, r] = await Promise.all([
      listDiningTables(),
      listServiceHours(),
      listClosures(),
      getRegolePrenotazione(),
    ]);
    setTavoli(t);
    setOrari(o);
    setChiusure(c);
    setRegole(r);
  }, []);

  useEffect(() => {
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ricarica]);

  const capienza = useMemo(
    () => tavoli.filter((t) => t.active).reduce((s, t) => s + (t.seats ?? 0), 0),
    [tavoli]
  );
  const serviziAperti = useMemo(() => orari.filter((o) => o.attivo).length, [orari]);

  const esegui = async (azione) => {
    setError("");
    try {
      await azione();
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const cambiaInterruttore = async (acceso) => {
    setAvviso("");
    // Acceso senza numeri veri, il sito direbbe "non c'è posto" a chiunque:
    // peggio della richiesta libera di prima.
    if (acceso && (capienza === 0 || serviziAperti === 0)) {
      setAvviso(
        "Prima accendi almeno un servizio qui sotto e controlla i coperti dei tavoli: " +
          "altrimenti il sito risponderebbe «non c'è posto» a tutti."
      );
      return;
    }
    await esegui(() => updateRegolePrenotazione({ prenotazioni_online_attive: acceso }));
  };

  const aggiungiChiusura = async () => {
    if (!nuovaChiusura.dal) return;
    await esegui(() => createClosure(nuovaChiusura));
    setNuovaChiusura({ dal: "", al: "", motivo: "" });
  };

  const orariDelGiorno = (weekday) => orari.filter((o) => o.weekday === weekday);

  if (loading) return <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/calendario-eventi" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario Eventi
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Sala e orari</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Interruttore generale */}
      <div className={sezioneClass}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(regole?.prenotazioni_online_attive)}
            onChange={(e) => cambiaInterruttore(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            <span className="block text-b58-charcoal font-medium">
              Mostra i posti liberi sul sito
            </span>
            <span className="block text-sm text-b58-charcoal-soft mt-1">
              Acceso: il cliente vede solo gli orari in cui c'è davvero posto, e non può
              chiedere un giorno di chiusura. Spento: può chiedere qualunque data e ora,
              come prima. <strong>In tutti e due i casi confermi sempre tu.</strong>
            </span>
          </span>
        </label>
        {avviso && (
          <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-3">
            {avviso}
          </p>
        )}
        <p className="text-sm text-b58-charcoal-soft mt-3">
          Oggi il locale conta <strong>{capienza} coperti</strong> su {tavoli.filter((t) => t.active).length}{" "}
          tavoli, con <strong>{serviziAperti}</strong>{" "}
          {serviziAperti === 1 ? "servizio acceso" : "servizi accesi"} nella settimana.
        </p>
      </div>

      {/* Orari */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Quando siamo aperti</h2>
        <p className="text-sm text-b58-charcoal-soft mb-4">
          L'<em>ultimo ingresso</em> è l'ora oltre la quale non fai più entrare nessuno, non
          l'ora in cui chiudi.
        </p>
        <div className="space-y-4">
          {GIORNI.map((g) => (
            <div key={g.weekday}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1">
                {g.nome}
              </h3>
              <div className="space-y-1">
                {orariDelGiorno(g.weekday).map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-3 bg-white rounded-lg px-3 py-2">
                    <label className="flex items-center gap-2 min-w-[110px]">
                      <input
                        type="checkbox"
                        checked={o.attivo}
                        onChange={(e) =>
                          esegui(() => updateServiceHour(o.id, { attivo: e.target.checked }))
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-b58-charcoal capitalize">{o.servizio}</span>
                    </label>
                    <span className="text-xs text-b58-charcoal-soft">dalle</span>
                    <CampoAutosalvato
                      type="time"
                      value={o.apertura?.slice(0, 5) ?? ""}
                      onSave={(v) => esegui(() => updateServiceHour(o.id, { apertura: v }))}
                      className={inputClass}
                      disabled={!o.attivo}
                    />
                    <span className="text-xs text-b58-charcoal-soft">ultimo ingresso</span>
                    <CampoAutosalvato
                      type="time"
                      value={o.ultimo_ingresso?.slice(0, 5) ?? ""}
                      onSave={(v) => esegui(() => updateServiceHour(o.id, { ultimo_ingresso: v }))}
                      className={inputClass}
                      disabled={!o.attivo}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coperti dei tavoli */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Coperti di ogni tavolo</h2>
        <p className="text-sm text-b58-charcoal-soft mb-4">
          Il totale è la capienza che il sito considera piena. Se unisci due tavoli per un
          gruppo, il conto lo fai tu quando confermi.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tavoli.map((t) => (
            <div key={t.id} className={`bg-white rounded-lg px-3 py-2 ${t.active ? "" : "opacity-50"}`}>
              <label className={labelClass}>{t.label}</label>
              <CampoAutosalvato
                type="number"
                value={t.seats ?? ""}
                onSave={(v) => esegui(() => updateTableSeats(t.id, v))}
                className={`${inputClass} w-full`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Regole */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Regole di prenotazione</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Quanto tieni un tavolo (minuti)</label>
            <CampoAutosalvato
              type="number"
              value={regole?.durata_tavolo_minuti ?? ""}
              onSave={(v) => esegui(() => updateRegolePrenotazione({ durata_tavolo_minuti: Number(v) }))}
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-b58-charcoal-soft/80 mt-1">
              Due ore è la misura di una cena tranquilla.
            </p>
          </div>
          <div>
            <label className={labelClass}>Massimo coperti insieme (vuoto = tutti)</label>
            <CampoAutosalvato
              type="number"
              value={regole?.max_coperti_contemporanei ?? ""}
              onSave={(v) =>
                esegui(() =>
                  updateRegolePrenotazione({ max_coperti_contemporanei: v === "" ? null : Number(v) })
                )
              }
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-b58-charcoal-soft/80 mt-1">
              Da usare se la cucina regge meno posti di quanti ne ha la sala.
            </p>
          </div>
          <div>
            <label className={labelClass}>Con quanto anticipo minimo (minuti)</label>
            <CampoAutosalvato
              type="number"
              value={regole?.preavviso_minuti ?? ""}
              onSave={(v) => esegui(() => updateRegolePrenotazione({ preavviso_minuti: Number(v) }))}
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-b58-charcoal-soft/80 mt-1">
              Sotto questa soglia gli orari non compaiono più: chi è in ritardo chiama.
            </p>
          </div>
          <div>
            <label className={labelClass}>Fin quanto in là si prenota (giorni)</label>
            <CampoAutosalvato
              type="number"
              value={regole?.giorni_prenotabili ?? ""}
              onSave={(v) => esegui(() => updateRegolePrenotazione({ giorni_prenotabili: Number(v) }))}
              className={`${inputClass} w-full`}
            />
          </div>
        </div>
      </div>

      {/* Chiusure */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Chiusure straordinarie</h2>
        <p className="text-sm text-b58-charcoal-soft mb-4">
          Ferie, festivi, giorni singoli. In queste date il sito non propone nessun orario e
          scrive al cliente il motivo, se lo metti.
        </p>
        <div className="flex flex-wrap gap-2 items-end mb-4">
          <div>
            <label className={labelClass}>Dal</label>
            <input
              type="date"
              min={oggiLocale()}
              value={nuovaChiusura.dal}
              onChange={(e) => setNuovaChiusura((c) => ({ ...c, dal: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Al (vuoto = un giorno solo)</label>
            <input
              type="date"
              min={nuovaChiusura.dal || oggiLocale()}
              value={nuovaChiusura.al}
              onChange={(e) => setNuovaChiusura((c) => ({ ...c, al: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className={labelClass}>Motivo (lo legge il cliente)</label>
            <input
              value={nuovaChiusura.motivo}
              onChange={(e) => setNuovaChiusura((c) => ({ ...c, motivo: e.target.value }))}
              placeholder="Chiusura estiva"
              className={`${inputClass} w-full`}
            />
          </div>
          <button
            type="button"
            onClick={aggiungiChiusura}
            disabled={!nuovaChiusura.dal}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
          >
            + Aggiungi
          </button>
        </div>
        <ul className="space-y-1">
          {chiusure.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 text-sm text-b58-charcoal bg-white rounded-lg px-3 py-2"
            >
              <span>
                {c.dal === c.al ? c.dal : `${c.dal} → ${c.al}`}
                {c.motivo ? ` — ${c.motivo}` : ""}
              </span>
              <button
                onClick={() => esegui(() => deleteClosure(c.id))}
                className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                title="Togli"
              >
                ✕
              </button>
            </li>
          ))}
          {chiusure.length === 0 && (
            <li className="text-xs text-b58-charcoal-soft/60">Nessuna chiusura in programma.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
