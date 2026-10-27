import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import {
  cambiaStatoSegnalazione,
  eliminaSegnalazione,
  listSegnalazioni,
} from "../../lib/api/segnalazioni";
import { STATI_SEGNALAZIONE, etichettaStato } from "../../lib/calcoli/segnalazioni";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import { leggi, nonLetto } from "../../lib/calcoli/letture";

// «LE TUE SEGNALAZIONI» — il quaderno dei difetti (25/10/2026, tappa 1).
//
// Qui Alessio rilegge quello che ha segnalato e vede a che punto è: nuova,
// in lavorazione, corretta, scartata. L'esito è la riga in cui chi ha
// corretto dice cosa ha fatto (o perché non l'ha fatto).
//
// ⚠️ L'ESITO SI MOSTRA SOTTO LA RIGA TOCCATA, mai in cima alla pagina
//    (CLAUDE.md §8, il rifiuto lontano dal gesto).
//
// ⚠️ «Non riesco a leggere» non è «nessuna segnalazione»: se la lettura
//    fallisce si dice, con la via per riprovare.

const quando = (v) =>
  v
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v))
    : "—";

function Riga({ s, onCambiata, onTolta }) {
  const [esito, setEsito] = useState(s.esito ?? "");
  const [errore, setErrore] = useState(null);
  const [vista, setVista] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const guardia = useRef(unaVoltaSola());

  async function fai(chiave, azione) {
    if (!guardia.current.prendi(chiave)) return;
    setLavoro(true);
    setErrore(null);
    try {
      await azione();
    } catch (e) {
      setErrore(e?.message ?? "Non è stato salvato.");
    } finally {
      guardia.current.lascia(chiave);
      setLavoro(false);
    }
  }

  const cambia = (stato) =>
    fai("stato", async () => {
      await cambiaStatoSegnalazione(s.id, stato, esito);
      onCambiata(s.id, { stato, esito: esito.trim() || null });
    });

  const togli = () =>
    fai("togli", async () => {
      await eliminaSegnalazione(s.id);
      onTolta(s.id);
    });

  return (
    <li className="rounded-xl bg-b58-campo p-4 ring-1 ring-b58-charcoal/10 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">
          {etichettaStato(s.stato)}
        </span>
        <span className="testo-sala text-b58-charcoal-soft">{quando(s.creata_il)}</span>
      </div>
      <p className="whitespace-pre-wrap text-b58-charcoal">{s.testo}</p>
      {s.schermata && (
        <p className="testo-sala text-b58-charcoal-soft">
          Da: <Link to={s.schermata} className="underline">{s.titolo_schermata || s.schermata}</Link>
        </p>
      )}
      {s.cosa_si_vedeva && (
        <div>
          <button
            type="button"
            onClick={() => setVista((v) => !v)}
            aria-expanded={vista}
            className="tocco-bottone testo-sala text-b58-olive-dark-testo underline"
          >
            {vista ? "Nascondi cosa si vedeva" : "Cosa si vedeva"}
          </button>
          {vista && (
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-b58-parchment p-3 testo-sala text-b58-charcoal">
              {s.cosa_si_vedeva}
            </pre>
          )}
        </div>
      )}
      <label className="block">
        <span className="testo-sala text-b58-charcoal-soft">Esito</span>
        <textarea
          value={esito}
          onChange={(e) => setEsito(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-b58-charcoal/20 px-3 py-2 text-b58-charcoal"
          style={{ fontSize: "max(16px, 1em)" }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {STATI_SEGNALAZIONE.filter((x) => x.valore !== s.stato).map((x) => (
          <button
            key={x.valore}
            type="button"
            disabled={lavoro}
            onClick={() => cambia(x.valore)}
            className="tocco-bottone rounded-lg px-3 ring-1 ring-b58-charcoal/20 text-b58-charcoal hover:bg-b58-cream-dark disabled:opacity-50"
          >
            {x.etichetta}
          </button>
        ))}
        <button
          type="button"
          disabled={lavoro}
          onClick={togli}
          className="tocco-bottone rounded-lg px-3 text-b58-turno-dark-testo hover:bg-b58-cream-dark disabled:opacity-50"
        >
          Togli
        </button>
      </div>
      {errore && <p className="testo-sala text-b58-turno-dark-testo">{errore}</p>}
    </li>
  );
}

export default function Segnalazioni() {
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState(false);

  const carica = useCallback(async () => {
    setErrore(false);
    const r = await leggi(listSegnalazioni());
    if (nonLetto(r)) setErrore(true);
    else setRighe(r);
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const aperte = righe?.filter((s) => s.stato === "nuova" || s.stato === "in_lavorazione") ?? [];
  const chiuse = righe?.filter((s) => s.stato === "corretta" || s.stato === "scartata") ?? [];
  const cambiata = (id, campi) => setRighe((r) => r.map((s) => (s.id === id ? { ...s, ...campi } : s)));
  const tolta = (id) => setRighe((r) => r.filter((s) => s.id !== id));

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal flex items-center gap-2">
        Segnalazioni
        <Didascalia>
          Quello che hai segnalato col pulsante «Segnala». Ogni sera le leggo e preparo le correzioni; qui vedi a che
          punto sono.
        </Didascalia>
      </h1>

      {errore ? (
        <DatoNonLetto cosa="le segnalazioni" onRiprova={carica} className="mt-4" />
      ) : righe === null ? (
        <p className="mt-4 text-b58-charcoal-soft">Caricamento…</p>
      ) : righe.length === 0 ? (
        <p className="mt-4 rounded-xl bg-b58-parchment p-4 text-b58-charcoal-soft ring-1 ring-b58-charcoal/10">
          Nessuna segnalazione.
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {aperte.map((s) => (
              <Riga key={s.id} s={s} onCambiata={cambiata} onTolta={tolta} />
            ))}
          </ul>
          {chiuse.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 font-display text-xl text-b58-charcoal">Chiuse</h2>
              <ul className="flex flex-col gap-3">
                {chiuse.map((s) => (
                  <Riga key={s.id} s={s} onCambiata={cambiata} onTolta={tolta} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
