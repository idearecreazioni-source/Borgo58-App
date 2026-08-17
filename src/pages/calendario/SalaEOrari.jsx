import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import { oggiLocale } from "../../lib/constants";
import {
  GIORNI,
  attivaSagoma,
  createClosure,
  deleteClosure,
  getRegolePrenotazione,
  listClosures,
  listFormatiTavolo,
  listSagome,
  listServiceHours,
  rinominaSagoma,
  updateFormatoTavolo,
  updateRegolePrenotazione,
  updateServiceHour,
} from "../../lib/api/sala";

// Quando si è aperti, come si chiamano i tavoli, quando si è chiusi.
//
// ⚠️ Il 14/08/2026 da qui era sparito ogni numero di coperti, con questa
// ragione: *la capienza non è un dato del software, dipende da come i
// tavoli sono messi quel giorno*. Dal 18/08 un numero torna, e la ragione
// di allora non è stata smentita — è stata resa più precisa. Quello che
// torna è **quanti ne tiene UN tavolo di quel formato**, che è un fatto
// del mobile e non cambia mai; quello che resta fuori — e deve restare
// fuori — è la capienza della sala, che non è scritta da nessuna parte
// perché si ricalcola ogni giorno sulla disposizione di quel giorno.

const inputClass =
  "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";
const sezioneClass = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6";

export default function SalaEOrari() {
  const [tavoli, setTavoli] = useState([]);
  const [orari, setOrari] = useState([]);
  const [chiusure, setChiusure] = useState([]);
  const [regole, setRegole] = useState(null);
  const [formati, setFormati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");
  const [nuovaChiusura, setNuovaChiusura] = useState({ dal: "", al: "", motivo: "" });

  const ricarica = useCallback(async () => {
    const [t, o, c, r, f] = await Promise.all([
      listSagome(),
      listServiceHours(),
      listClosures(),
      getRegolePrenotazione(),
      listFormatiTavolo(),
    ]);
    setTavoli(t);
    setOrari(o);
    setChiusure(c);
    setRegole(r);
    setFormati(f);
  }, []);

  useEffect(() => {
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ricarica]);

  const serviziAperti = useMemo(() => orari.filter((o) => o.attivo).length, [orari]);
  const sagomeAttive = useMemo(() => tavoli.filter((t) => t.active), [tavoli]);

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
    // Acceso senza nessun servizio, il sito direbbe "siamo chiusi" a
    // chiunque, tutti i giorni: peggio della richiesta libera di prima.
    if (acceso && serviziAperti === 0) {
      setAvviso(
        "Prima accendi almeno un servizio qui sotto: altrimenti il sito risponderebbe " +
          "«quel giorno siamo chiusi» a tutti."
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
              Mostra i nostri orari sul sito
            </span>
            <span className="block text-sm text-b58-charcoal-soft mt-1">
              Acceso: il cliente sceglie un'ora fra quelle in cui siamo in servizio, e non
              può chiedere un giorno di chiusura. Spento: può chiedere qualunque data e ora,
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
          Oggi la sala ha <strong>{sagomeAttive.length} posizioni</strong>, con{" "}
          <strong>{serviziAperti}</strong>{" "}
          {serviziAperti === 1 ? "servizio acceso" : "servizi accesi"} nella settimana. Quante
          persone entrano lo decidi tu guardando la sala:{" "}
          <Link to="/calendario-eventi/pianta" className="underline text-b58-terracotta">
            apri la pianta
          </Link>
          .
        </p>
      </div>

      {/* Email di conferma al cliente */}
      <div className={sezioneClass}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(regole?.email_conferma_attiva)}
            onChange={(e) =>
              esegui(() => updateRegolePrenotazione({ email_conferma_attiva: e.target.checked }))
            }
            className="mt-1 h-5 w-5"
          />
          <span>
            <span className="block text-b58-charcoal font-medium">
              Manda l&apos;email di conferma al cliente
            </span>
            <span className="block text-sm text-b58-charcoal-soft mt-1">
              Quando confermi una richiesta arrivata dal sito, il cliente riceve un&apos;email con
              giorno, ora e numero di persone. Spento: non riceve niente, come prima.{" "}
              <strong>Parte solo alla conferma</strong>, mai da sola.
            </span>
          </span>
        </label>
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

      {/* Quanti ne tiene un tavolo, per formato */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Quanti ne tiene un tavolo</h2>
        <p className="text-sm text-b58-charcoal-soft mb-4">
          Quanti coperti fa <strong>un tavolo da solo</strong>, per formato. Accostandone due il
          totale scende di due — dove si toccano i posti non ci sono. Il numero della serata si
          vede sulla{" "}
          <Link to="/calendario-eventi/pianta" className="underline text-b58-terracotta">
            pianta
          </Link>
          , e lì si corregge a mano quando la sala dice altro.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formati.map((f) => (
            <div key={f.id} className="bg-white rounded-lg px-3 py-2">
              <label className={labelClass}>{f.nome}</label>
              <CampoAutosalvato
                type="number"
                value={f.coperti_base}
                onSave={(v) => esegui(() => updateFormatoTavolo(f.id, { coperti_base: Number(v) }))}
                className={`${inputClass} w-full`}
              />
            </div>
          ))}
        </div>
        {/* ⚠️ IL FORMATO È ANCHE LA REGOLA DELL'ACCOSTAMENTO, e va detto
            qui perché è dove uno se lo chiede. La ragione è di Alessio e
            non è la misura: i due tavoli lunghi sono di uno STILE diverso,
            quindi si accostano fra loro e non ai quadrati. Se domani
            comprasse due 90x90 di un altro stile, sarebbero un formato
            nuovo — e giustamente non accostabili a questi. */}
        <p className="text-xs text-b58-charcoal-soft/80 mt-3">
          Due tavoli si accostano <strong>solo se sono dello stesso formato</strong>: i due lunghi
          fra loro, i quadrati fra loro. Non è il gestionale che sceglie — è che sono mobili
          diversi.
        </p>
      </div>

      {/* Come si chiamano i tavoli */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Come si chiamano i tavoli</h2>
        <p className="text-sm text-b58-charcoal-soft mb-4">
          Solo il nome: dove stanno lo decidi trascinandoli dalla{" "}
          <Link to="/calendario-eventi/pianta" className="underline text-b58-terracotta">
            pianta
          </Link>
          . Un tavolo che non usi più si spegne, non si cancella: le prenotazioni vecchie
          devono continuare a dire dove erano seduti.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tavoli.map((t) => (
            <div key={t.id} className={`bg-white rounded-lg px-3 py-2 ${t.active ? "" : "opacity-50"}`}>
              <label className={labelClass}>
                {t.tipo === "tavolo" ? "Tavolo" : t.tipo === "divano" ? "Divano" : "Bancone"}
                {t.posti_fissi ? ` · ${t.posti_fissi} posti` : ""}
              </label>
              <CampoAutosalvato
                value={t.label}
                onSave={(v) => esegui(() => rinominaSagoma(t.id, v))}
                className={`${inputClass} w-full`}
              />
              <button
                type="button"
                onClick={() => esegui(() => attivaSagoma(t.id, !t.active))}
                className="text-[11px] text-b58-charcoal-soft hover:text-b58-terracotta-dark underline mt-1"
              >
                {t.active ? "spegni" : "riaccendi"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Regole */}
      <div className={sezioneClass}>
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Regole di prenotazione</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fin quando è «primo giro»</label>
            <CampoAutosalvato
              type="time"
              value={regole?.ora_primo_turno?.slice(0, 5) ?? ""}
              onSave={(v) => esegui(() => updateRegolePrenotazione({ ora_primo_turno: v }))}
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-b58-charcoal-soft/80 mt-1">
              Sulla pianta, chi arriva entro quest'ora è <strong>giallo</strong> (il tavolo può
              liberarsi per una seconda serata), dopo è <strong>verde</strong>. Serve a vederlo a
              colpo d'occhio: non impedisce niente.
            </p>
          </div>
          <div>
            {/* ⚠️ LA SOGLIA È UN SUO PARAMETRO, non un numero nel codice.
                25 è più basso di quel che la sala regge (40 sulla carta) e
                di quel che la cucina regge (30): è così di proposito, per
                il rodaggio, e il giorno che il rodaggio finisce si cambia
                qui invece che con una migrazione. */}
            <label className={labelClass}>Avvisami sopra questi coperti a serata</label>
            <CampoAutosalvato
              type="number"
              value={regole?.soglia_coperti_serata ?? ""}
              onSave={(v) =>
                esegui(() => updateRegolePrenotazione({ soglia_coperti_serata: Number(v) }))
              }
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-b58-charcoal-soft/80 mt-1">
              Sopra questo numero di coperti confermati la sala te lo dice. <strong>Avvisa
              soltanto</strong>: accettare o no lo decidi tu.
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
          scrive al cliente il motivo, se lo metti. <strong>Non è «siamo pieni»</strong>:
          quello si mette giorno per giorno dalla{" "}
          <Link to="/calendario-eventi/pianta" className="underline text-b58-terracotta">
            pianta
          </Link>
          , e nello storico resta una cosa diversa.
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
