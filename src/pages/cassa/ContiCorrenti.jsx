import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createContoBancario,
  listContiBancari,
  setContoAttivo,
  setContoPredefinito,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";

// 🔴 QUESTA SCHERMATA E' LA VIA D'USCITA DI UN RIFIUTO (25/08/2026). Da
// oggi un movimento che passa dalla banca deve dire su quale conto, e chi
// lo registra senza viene respinto con «aprilo da Cassa → Conti correnti».
// Fino a stamattina quella schermata non esisteva: la tabella c'era dal
// 15/08 e non la leggeva nessuno. Un rifiuto senza gesto d'uscita è un
// vicolo cieco, ed è un difetto a sé in questo progetto.
export default function ContiCorrenti() {
  const [conti, setConti] = useState([]);
  const [entita, setEntita] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState("");
  const [nome, setNome] = useState("");
  const [iban, setIban] = useState("");
  const [entityId, setEntityId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const ricarica = () =>
    Promise.all([listContiBancari(), getEntities()]).then(([c, ent]) => {
      setConti(c);
      // ⚠️ Le società sono due fin dal primo giorno (S.r.l.s. e azienda
      // agricola), e un conto è di una sola delle due: l'azienda agricola
      // non esiste ancora, ma lo schema la prevede da sempre.
      const elenco = [ent.srls, ent.agricola].filter(Boolean);
      setEntita(elenco);
      setEntityId((prec) => prec || elenco[0]?.id || "");
    });

  useEffect(() => {
    ricarica()
      .catch((e) => setErrore(e.message))
      .finally(() => setCaricando(false));
  }, []);

  const campo =
    "tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const azione = async (fn) => {
    setErrore("");
    try {
      await fn();
      await ricarica();
    } catch (e) {
      setErrore(e.message);
    }
  };

  const aggiungi = async () => {
    if (!nome.trim() || !entityId) return;
    setSalvando(true);
    await azione(async () => {
      await createContoBancario({ entityId, nome, iban });
      setNome("");
      setIban("");
    });
    setSalvando(false);
  };

  const attivi = conti.filter((c) => c.attivo);
  const spenti = conti.filter((c) => !c.attivo);
  const senzaPrincipale = attivi.length > 1 && !attivi.some((c) => c.predefinito);

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/cassa"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-2">Conti correnti</h1>
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        Ogni movimento che passa dalla banca dice da quale conto esce o entra. Finché il conto
        è uno solo lo mette il gestionale da sé: qui serve solo registrarlo.
      </p>

      {errore && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      {/* ⚠️ L'avviso sta DOVE STA IL DUBBIO e solo quando il dubbio c'è:
          con un conto solo non c'è niente da scegliere, e una riga
          permanente diventerebbe arredamento. Con due conti e nessuno
          principale, invece, ogni pagamento di fattura viene respinto —
          e senza questa riga sembrerebbe un guasto. */}
      {senzaPrincipale && (
        <p className="testo-sala-grande text-b58-charcoal bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-4">
          Ci sono più conti e nessuno è quello principale: finché è così, i movimenti che il
          gestionale registra da sé (pagare una fattura, versare in banca) vengono rifiutati e
          ti viene chiesto di scegliere. Segna qui sotto quale usi di solito.
        </p>
      )}

      <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-6 flex flex-wrap gap-2 items-end">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome del conto (es. Banca Intesa)"
          className={`${campo} flex-1 min-w-[180px]`}
        />
        <input
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IBAN (se lo sai)"
          className={`${campo} flex-1 min-w-[180px]`}
        />
        {entita.length > 1 && (
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={campo}>
            {entita.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={salvando || !nome.trim() || !entityId}
          onClick={aggiungi}
          className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
        >
          + Aggiungi
        </button>
      </div>

      {caricando ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {attivi.map((c) => (
              <li
                key={c.id}
                className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="testo-sala-grande text-b58-charcoal font-medium">{c.nome}</span>
                  {c.predefinito && (
                    <span className="ml-2 testo-sala text-b58-terracotta-dark">· quello di sempre</span>
                  )}
                  {c.iban && (
                    <span className="block testo-sala text-b58-charcoal-soft break-all">{c.iban}</span>
                  )}
                  {entita.length > 1 && (
                    <span className="block testo-sala text-b58-charcoal-soft">
                      {entita.find((e) => e.id === c.entity_id)?.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* ⚠️ Sul conto che è già quello di sempre il pulsante non
                      c'è, invece di esserci e non fare niente: un tasto che
                      non risponde si impara a non guardare. */}
                  {!c.predefinito && (
                    <button
                      type="button"
                      onClick={() => azione(() => setContoPredefinito(c.id))}
                      className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white testo-sala px-3 py-1.5 text-b58-charcoal"
                    >
                      Usa questo di solito
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => azione(() => setContoAttivo(c.id, false))}
                    className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white testo-sala px-3 py-1.5 text-b58-charcoal-soft"
                  >
                    Spegni
                  </button>
                </div>
              </li>
            ))}
            {attivi.length === 0 && (
              <li className="testo-sala-grande text-b58-charcoal-soft">
                Nessun conto registrato. Finché non ce n&apos;è uno, un movimento di banca non si
                può registrare.
              </li>
            )}
          </ul>

          {spenti.length > 0 && (
            <div className="mt-8">
              <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
                Conti spenti
              </h2>
              {/* ⚠️ Non si cancellano: i movimenti già registrati ci sono
                  attaccati sopra, e un conto sparito lascerebbe uno storico
                  che non si può più leggere. */}
              <p className="testo-sala text-b58-charcoal-soft mb-2">
                Restano qui: i movimenti già registrati continuano a dire da quale conto sono
                passati.
              </p>
              <ul className="space-y-2">
                {spenti.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl bg-b58-parchment/60 ring-1 ring-b58-charcoal/10 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="testo-sala-grande text-b58-charcoal-soft">{c.nome}</span>
                    <button
                      type="button"
                      onClick={() => azione(() => setContoAttivo(c.id, true))}
                      className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white testo-sala px-3 py-1.5 text-b58-charcoal"
                    >
                      Riaccendi
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
