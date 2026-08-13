import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chiudiPartita, listPartiteInScadenza } from "../../lib/api/scadenze";
import { formatDate } from "../../lib/constants";

// Lo scadenziario, la stessa cosa che alle 10:00 arriva su Telegram.
//
// Mostra anche le partite che NON vengono segnalate, con scritto perché:
// «come mai non me l'ha detto?» deve avere una risposta qui, non
// richiedere che qualcuno vada a guardare nel database.
function quandoScade(giorni, scadenza) {
  if (giorni < 0) return `scaduto il ${formatDate(scadenza)}`;
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `scade fra ${giorni} giorni (${formatDate(scadenza)})`;
}

export default function Scadenze() {
  const [partite, setPartite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);

  const carica = async () => {
    try {
      setPartite(await listPartiteInScadenza());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carica();
  }, []);

  // Nessuna conferma, nemmeno su «buttata»: chiesto da Alessio il
  // 13/08/2026 dopo avermi sentito consigliare il contrario. Il gesto
  // resta irreversibile e scrive nel registro HACCP — sta scritto sotto
  // il pulsante, che è dove si legge davvero.
  const chiudi = async (partita, come) => {
    setInCorso(partita.lotto_id);
    try {
      await chiudiPartita({ lottoId: partita.lotto_id, come });
      await carica();
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(null);
    }
  };

  const daGuardare = partite.filter((p) => p.da_segnalare);
  const mute = partite.filter((p) => !p.da_segnalare);

  const riga = (p) => (
    <li key={p.lotto_id} className="border-b border-stone-200 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{p.ingrediente}</div>
          <div className="text-sm text-stone-600">
            {p.quantita} {p.unita} · {quandoScade(p.giorni_mancanti, p.scadenza)}
            {p.lotto_fornitore ? ` · lotto ${p.lotto_fornitore}` : ""}
          </div>
          {p.perche_muta && <div className="text-sm text-stone-500 italic">{p.perche_muta}</div>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="tocco-bottone rounded border border-stone-300 px-4"
            disabled={inCorso === p.lotto_id}
            onClick={() => chiudi(p, "finita")}
          >
            finita
          </button>
          <button
            type="button"
            className="tocco-bottone rounded border border-red-300 px-4 text-red-700"
            disabled={inCorso === p.lotto_id}
            onClick={() => chiudi(p, "buttata")}
          >
            buttata
          </button>
        </div>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/magazzino" className="text-sm text-stone-600">
        ← Magazzino
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Scadenze</h1>
      <p className="mb-6 text-sm text-stone-600">
        Le partite che stanno per scadere e non sono state rimpiazzate da una più recente. Ogni
        mattina alle 10:00 le stesse cose arrivano su Telegram.
      </p>
      <p className="mb-6 text-sm text-stone-500">
        <strong>finita</strong> = usata, esce dalla giacenza. <strong>buttata</strong> = esce dalla
        giacenza <em>e</em> finisce nel registro HACCP come prodotto eliminato. Non si chiede
        conferma e non si torna indietro.
      </p>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p>Carico…</p>}

      {!loading && (
        <>
          <h2 className="mb-2 font-semibold">Da guardare ({daGuardare.length})</h2>
          {daGuardare.length === 0 ? (
            <p className="mb-8 text-stone-600">Niente in scadenza. Il magazzino gira.</p>
          ) : (
            <ul className="mb-8">{daGuardare.map(riga)}</ul>
          )}

          <h2 className="mb-2 font-semibold">Le altre ({mute.length})</h2>
          {mute.length === 0 ? (
            <p className="text-stone-600">Nessun'altra partita con una data di scadenza.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-stone-500">
                Ci sono, ma non vengono segnalate — sotto ognuna c&apos;è scritto perché.
              </p>
              <ul>{mute.map(riga)}</ul>
            </>
          )}

          <p className="mt-8 text-sm text-stone-500">
            I prodotti entrati senza data di scadenza (i vegetali sfusi, per esempio) non compaiono
            qui: senza una data non c&apos;è niente da sorvegliare.
          </p>
        </>
      )}
    </div>
  );
}
