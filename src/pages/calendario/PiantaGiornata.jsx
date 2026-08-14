import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PiantaSala from "../../components/PiantaSala";
import { formatDate, oggiLocale } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import {
  getPiantaDelGiorno,
  isSoldOut,
  promuoviDisposizione,
  riportaSagomaAllaBase,
  salvaSagoma,
  setSoldOut,
} from "../../lib/api/sala";
import {
  assegnaPrenotazione,
  listReservations,
  listTavoliPrenotatiPerData,
  togliAssegnazione,
} from "../../lib/api/reservations";

// LA PIANTA VIVA — la schermata in cui si prepara una serata.
//
// Il sistema non decide più se un gruppo entra: lo decide Alessio
// guardando la sala. Qui si fanno tre cose e basta: si sposta la sala per
// quel giorno, si dice chi sta dove, e si chiude la serata quando è
// piena.

export default function PiantaGiornata() {
  const { isTitolare } = useAuth();

  const [data, setData] = useState(oggiLocale());
  const [sagome, setSagome] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [pieno, setPieno] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");

  // La prenotazione che si sta sistemando adesso, e i tavoli che le si
  // stanno dando. Vivono solo qui: finché non si conferma, nel database
  // non cambia niente.
  const [inCorso, setInCorso] = useState(null);
  const [scelti, setScelti] = useState([]);
  const [rischio, setRischio] = useState(false);

  const ricarica = useCallback(async () => {
    const [p, r, a, s] = await Promise.all([
      getPiantaDelGiorno(data),
      listReservations({ date: data }),
      listTavoliPrenotatiPerData(data),
      isSoldOut(data),
    ]);
    setSagome(p);
    setPrenotazioni(r.filter((x) => x.status === "richiesta_in_attesa" || x.status === "confermata"));
    setAssegnazioni(a);
    setPieno(s);
  }, [data]);

  useEffect(() => {
    setCaricamento(true);
    setInCorso(null);
    setScelti([]);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setCaricamento(false));
  }, [ricarica]);

  const esegui = async (azione) => {
    setError("");
    setAvviso("");
    try {
      await azione();
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // Chi tiene quale tavolo, per colorare la pianta.
  const perTavolo = useMemo(() => {
    const m = new Map();
    for (const a of assegnazioni) {
      const elenco = m.get(a.dining_table_id) ?? [];
      elenco.push(a);
      m.set(a.dining_table_id, elenco);
    }
    return m;
  }, [assegnazioni]);

  const tavoliDi = (reservationId) =>
    assegnazioni.filter((a) => a.reservation.id === reservationId);

  const stato = useMemo(() => {
    const s = {};
    for (const sagoma of sagome) {
      const elenco = perTavolo.get(sagoma.id) ?? [];
      const altri = elenco.filter((a) => a.reservation.id !== inCorso?.id);
      if (altri.length > 0) {
        s[sagoma.id] = {
          colore: "prenotato",
          riga1: altri[0].reservation.customer_name?.split(" ")[0],
          riga2:
            altri.length > 1
              ? `${altri.length} turni`
              : `${altri[0].reservation.reservation_time?.slice(0, 5)} · ${altri[0].reservation.party_size}p`,
        };
      }
    }
    return s;
  }, [sagome, perTavolo, inCorso]);

  const tocca = (sagoma) => {
    if (!inCorso) {
      setAvviso("Scegli prima una prenotazione qui sotto, poi tocca i tavoli da darle.");
      return;
    }
    setAvviso("");
    setScelti((s) => (s.includes(sagoma.id) ? s.filter((x) => x !== sagoma.id) : [...s, sagoma.id]));
  };

  const iniziaAssegnazione = (p) => {
    setAvviso("");
    setInCorso(p);
    setScelti(tavoliDi(p.id).map((a) => a.dining_table_id));
    setRischio(tavoliDi(p.id)[0]?.rischio_accettato ?? false);
  };

  const conferma = () =>
    esegui(async () => {
      await assegnaPrenotazione(inCorso.id, scelti, { rischioAccettato: rischio, conferma: true });
      setInCorso(null);
      setScelti([]);
      setRischio(false);
    });

  const scostamenti = sagome.filter((s) => s.spostato).length;
  // Girare un quadrato non cambia niente: il pulsante compare solo dove
  // il quarto di giro si vede.
  const sagomeGirevoli = sagome.filter(
    (s) => s.spostabile && s.larghezza_cm !== s.profondita_cm
  );

  const bottone =
    "rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2";
  const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-5";

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/calendario-eventi" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario Eventi
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">La sala</h1>
      <p className="text-sm text-b58-charcoal-soft mb-5">
        Sposta i tavoli come li apparecchi quel giorno, poi di' a ogni prenotazione dove
        sedersi. Quello che sposti oggi vale <strong>solo per oggi</strong>: domani la sala
        torna com'è di solito.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}
      {avviso && (
        <p className="text-sm text-b58-charcoal bg-b58-gold/15 rounded-lg px-3 py-2 mb-4">{avviso}</p>
      )}

      {/* Il giorno */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal"
        />
        <button type="button" onClick={() => setData(oggiLocale())} className={bottone}>
          Oggi
        </button>
        <span className="text-sm text-b58-charcoal-soft">{formatDate(data)}</span>
      </div>

      {caricamento ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* La serata al completo — l'unico freno alle richieste dal sito */}
          <div className={sezione}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={pieno}
                disabled={!isTitolare}
                onChange={(e) => esegui(() => setSoldOut(data, e.target.checked))}
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="block text-b58-charcoal font-medium">
                  Per questa sera siamo al completo
                </span>
                <span className="block text-sm text-b58-charcoal-soft mt-1">
                  Acceso: dal sito non arrivano più richieste per questo giorno, e al cliente
                  compare che siamo pieni. Si toglie quando vuoi.{" "}
                  <strong>Non è una chiusura</strong>: quella si mette da Sala e orari e resta
                  un'altra cosa.
                </span>
              </span>
            </label>
          </div>

          {/* La pianta */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70">
              La sala del {formatDate(data)}
            </p>
            {isTitolare && scostamenti > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Vuoi che questa diventi la disposizione normale della sala, da qui in avanti?\n\n` +
                        `${scostamenti} ${scostamenti === 1 ? "tavolo spostato" : "tavoli spostati"}. ` +
                        `Da domani la sala riparte da questa, non da quella di prima.`
                    )
                  )
                    return;
                  esegui(() => promuoviDisposizione(data));
                }}
                className="rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
              >
                Questa diventa la sala di sempre
              </button>
            )}
          </div>

          <PiantaSala
            sagome={sagome}
            selezione={scelti}
            stato={stato}
            onSeleziona={tocca}
            onSposta={
              isTitolare
                ? (sagoma, x, y) =>
                    // Il verso si riscrive insieme alla posizione: senza,
                    // trascinare un tavolo girato lo raddrizzerebbe.
                    esegui(() =>
                      salvaSagoma({ data, sagomaId: sagoma.id, x, y, ruotato: sagoma.ruotato })
                    )
                : undefined
            }
          />

          {/* Girare un tavolo. Un quarto di giro e basta: un tavolo in
              sala si mette di traverso, non a 37 gradi. Compare solo per
              le sagome che girandole cambiano forma — su un quadrato non
              vorrebbe dire niente. */}
          {isTitolare && sagomeGirevoli.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-b58-charcoal-soft">Gira per questo giorno:</span>
              {sagomeGirevoli.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    esegui(() =>
                      salvaSagoma({
                        data,
                        sagomaId: s.id,
                        x: s.x,
                        y: s.y,
                        ruotato: !s.ruotato,
                      })
                    )
                  }
                  className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs px-3 py-1.5"
                >
                  ⟳ {s.label} {s.ruotato ? "(in piedi)" : "(di traverso)"}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2 mb-6 text-[11px] text-b58-charcoal-soft">
            <span>
              {scostamenti > 0
                ? `${scostamenti} ${scostamenti === 1 ? "tavolo spostato" : "tavoli spostati"} solo per questo giorno (pallino rosso)`
                : "Sala nella disposizione di sempre"}
            </span>
            {isTitolare &&
              sagome
                .filter((s) => s.spostato)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => esegui(() => riportaSagomaAllaBase({ data, sagomaId: s.id }))}
                    className="underline hover:text-b58-terracotta-dark"
                  >
                    rimetti {s.label} a posto
                  </button>
                ))}
          </div>

          {/* Assegnazione in corso */}
          {inCorso && (
            <div className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/30 p-5 mb-5">
              <p className="text-b58-charcoal font-medium mb-1">
                {inCorso.customer_name} · {inCorso.party_size} persone ·{" "}
                {inCorso.reservation_time?.slice(0, 5)}
              </p>
              <p className="text-sm text-b58-charcoal-soft mb-3">
                Tocca sulla pianta i tavoli dove li fai sedere. Se sono in tanti, accostali
                prima e poi toccali tutti.
              </p>
              <p className="text-sm text-b58-charcoal mb-3">
                {scelti.length === 0 ? (
                  <em className="text-b58-charcoal-soft">Nessun tavolo scelto.</em>
                ) : (
                  <>
                    Tavoli scelti:{" "}
                    <strong>
                      {sagome
                        .filter((s) => scelti.includes(s.id))
                        .map((s) => s.label)
                        .join(" · ")}
                    </strong>
                  </>
                )}
              </p>

              <label className="flex items-start gap-2 text-sm text-b58-charcoal-soft mb-4">
                <input
                  type="checkbox"
                  checked={rischio}
                  onChange={(e) => setRischio(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Il cliente sa che il tavolo potrebbe essere ancora occupato quando arriva
                  (è il secondo giro della serata).
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={scelti.length === 0}
                  onClick={conferma}
                  className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment text-sm font-semibold px-4 py-2"
                >
                  Conferma su {scelti.length || "…"}{" "}
                  {scelti.length === 1 ? "tavolo" : "tavoli"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInCorso(null);
                    setScelti([]);
                  }}
                  className={bottone}
                >
                  Lascia stare
                </button>
              </div>
            </div>
          )}

          {/* Le prenotazioni del giorno */}
          <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-2">
            Prenotazioni del giorno
          </p>
          {prenotazioni.length === 0 ? (
            <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-8 text-center">
              <p className="text-b58-charcoal-soft text-sm">
                Nessuna prenotazione per questo giorno.
              </p>
            </div>
          ) : (
            <ul className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
              {prenotazioni.map((p) => {
                const suoi = tavoliDi(p.id);
                return (
                  <li key={p.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-sm text-b58-charcoal-soft w-12">
                      {p.reservation_time?.slice(0, 5)}
                    </span>
                    <span className="text-b58-charcoal font-medium flex-1 min-w-[140px]">
                      {p.customer_name}
                      <span className="text-b58-charcoal-soft font-normal"> · {p.party_size} persone</span>
                    </span>
                    <span className="text-sm">
                      {suoi.length > 0 ? (
                        <span className="text-b58-olive-dark font-medium">
                          {suoi.map((a) => a.etichetta_al_momento).join(" · ")}
                        </span>
                      ) : (
                        <span className="text-b58-terracotta-dark">senza tavolo</span>
                      )}
                    </span>
                    {p.status === "richiesta_in_attesa" && (
                      <span className="inline-flex items-center rounded-full bg-b58-gold text-b58-parchment text-[11px] font-medium px-2.5 py-1">
                        da confermare
                      </span>
                    )}
                    <button type="button" onClick={() => iniziaAssegnazione(p)} className={bottone}>
                      {suoi.length > 0 ? "Cambia tavolo" : "Dai un tavolo"}
                    </button>
                    {suoi.length > 0 && isTitolare && (
                      <button
                        type="button"
                        onClick={() => esegui(() => togliAssegnazione(p.id))}
                        className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark underline"
                      >
                        togli
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
