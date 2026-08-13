import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  compilaSchede,
  confermaAllergeni,
  listAllergeniStimati,
  listProdottiDaCompilare,
} from "../../lib/api/schedeProdotto";
import { ALLERGENS, labelFor } from "../../lib/constants";

const NOMI_CAMPI = {
  conservazione: "conservazione",
  durata: "durata",
  temperatura: "temperatura di ricevimento",
  stagionalita: "stagionalità",
  scarto: "percentuale di scarto",
  allergeni: "allergeni",
};

export default function SchedeProdotti() {
  const [daCompilare, setDaCompilare] = useState([]);
  const [stimati, setStimati] = useState([]);
  const [scelte, setScelte] = useState({});
  const [loading, setLoading] = useState(true);
  const [lavorando, setLavorando] = useState(false);
  const [esito, setEsito] = useState(null);
  const [error, setError] = useState("");

  const carica = async () => {
    const [a, b] = await Promise.all([listProdottiDaCompilare(), listAllergeniStimati()]);
    setDaCompilare(a);
    setStimati(b);
    // Le caselle degli allergeni si ricostruiscono da ciò che è appena
    // arrivato dal server, mai sopra una scelta in corso: il 12/08 una
    // ricarica ha cancellato in silenzio il lavoro di Alessio.
    setScelte((precedenti) =>
      Object.fromEntries(b.map((i) => [i.id, precedenti[i.id] ?? [...(i.allergens ?? [])]]))
    );
  };

  useEffect(() => {
    carica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const compila = async () => {
    setLavorando(true);
    setError("");
    try {
      const r = await compilaSchede();
      setEsito(r);
      await carica();
    } catch (e) {
      setError(e.message);
    } finally {
      setLavorando(false);
    }
  };

  const conferma = async (id) => {
    try {
      await confermaAllergeni(id, scelte[id] ?? []);
      await carica();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const spunta = (id, valore) => {
    setScelte((s) => {
      const attuali = s[id] ?? [];
      return {
        ...s,
        [id]: attuali.includes(valore)
          ? attuali.filter((v) => v !== valore)
          : [...attuali, valore],
      };
    });
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/ricettario" className="text-sm text-stone-600">
        ← Ricettario
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Schede dei prodotti</h1>
      <p className="mb-6 text-sm text-stone-600">
        Un prodotto nato da una fattura ha solo nome, unità e categoria. Qui l&apos;assistente
        completa il resto: conservazione, durata, temperatura di ricevimento, stagionalità e
        percentuale di scarto — che serve al costo del piatto.
      </p>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p>Carico…</p>}

      {!loading && (
        <>
          <h2 className="mb-2 font-semibold">Schede incomplete ({daCompilare.length})</h2>
          {daCompilare.length === 0 ? (
            <p className="mb-8 text-stone-600">Nessuna: tutti i prodotti hanno la scheda piena.</p>
          ) : (
            <>
              <ul className="mb-4">
                {daCompilare.map((p) => (
                  <li key={p.id} className="border-b border-stone-200 py-2 last:border-0">
                    <span className="font-medium">{p.nome}</span>{" "}
                    <span className="text-sm text-stone-600">
                      — manca: {(p.mancano ?? []).map((m) => NOMI_CAMPI[m] ?? m).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="tocco-bottone rounded bg-b58-terracotta px-5 text-b58-parchment"
                disabled={lavorando}
                onClick={compila}
              >
                {lavorando ? "Sto compilando…" : `Compila con l'assistente (${daCompilare.length})`}
              </button>
              <p className="mt-2 mb-8 text-sm text-stone-500">
                Una chiamata sola per tutti. Riempie solo i campi vuoti: quello che hai già deciso
                tu non viene toccato.
              </p>
            </>
          )}

          {esito && (
            <div className="mb-8 rounded border border-stone-300 p-4">
              <p className="font-medium">
                Compilati {esito.compilati} prodotti
                {esito.rimasti > 0 ? ` — ne restano ${esito.rimasti} per il prossimo giro` : ""}.
              </p>
              <ul className="mt-2 text-sm text-stone-700">
                {(esito.prodotti ?? []).map((p) => (
                  <li key={p.id}>
                    {p.nome}: {(p.scritti ?? []).length} campi
                    {p.sicurezza_allergeni === "bassa" && (
                      <strong className="text-red-700">
                        {" "}
                        — allergeni incerti, guarda l&apos;etichetta
                      </strong>
                    )}
                    {(p.scartati ?? []).length > 0 && (
                      <span className="text-stone-500"> — scartati: {p.scartati.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-stone-500">
                Costo di questo giro: {esito.token_domanda} + {esito.token_risposta} token.
              </p>
            </div>
          )}

          <h2 className="mb-2 font-semibold">Allergeni da confermare ({stimati.length})</h2>
          <p className="mb-4 text-sm text-stone-600">
            Questi allergeni sono <strong>stimati dal nome del prodotto</strong>: finché non li
            confermi <strong>non vengono usati per la stampa del menu</strong>. Sui prodotti crudi
            il modello ci prende quasi sempre; sui prodotti lavorati l&apos;allergene sta
            nell&apos;etichetta e non nel nome — il sedano dentro un ragù pronto, la soia dentro un
            gelato. Quelli vanno guardati sulla confezione.
          </p>

          {stimati.length === 0 ? (
            <p className="text-stone-600">Nessuno in attesa.</p>
          ) : (
            <ul>
              {stimati.map((i) => (
                <li key={i.id} className="border-b border-stone-200 py-3 last:border-0">
                  <div className="font-medium">{i.name}</div>
                  <div className="my-2 flex flex-wrap gap-3">
                    {ALLERGENS.map((a) => (
                      <label key={a.value} className="text-sm">
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={(scelte[i.id] ?? []).includes(a.value)}
                          onChange={() => spunta(i.id, a.value)}
                        />
                        {labelFor(ALLERGENS, a.value)}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="tocco-bottone rounded border border-stone-300 px-4"
                    onClick={() => conferma(i.id)}
                  >
                    Confermo questi allergeni
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
