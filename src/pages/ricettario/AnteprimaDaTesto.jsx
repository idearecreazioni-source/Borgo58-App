import { useState } from "react";
import { Link } from "react-router-dom";
import { bozzaDaTesto } from "../../lib/calcoli/ricettaDaTesto";

// ANTEPRIMA DA TESTO — NON SALVA NULLA (Ricettario Fase 1C, 07/10/2026).
//
// 🔴 È UNA PREVISIONE LOCALE. Il testo incollato resta in questa schermata:
//    non si manda a nessuno, non si salva, non crea bozze, non apre
//    indirizzi. L'unica cosa che si chiama è il nucleo puro `bozzaDaTesto`
//    (src/lib/calcoli/ricettaDaTesto.js), che non importa niente.
//    Niente API, database, memoria del browser, rete: chi aggiunge qui un
//    «salva» sta costruendo un'altra cosa, e va deciso a parte.
//
// ⚠️ NON È NEL MENU e nessuna schermata la collega: si apre solo da
//    /ricettario/bozze/da-testo.
//
// ⚠️ Quello che il nucleo non ha trovato si mostra COME MANCANTE, mai
//    completato: quantità, unità, porzioni e titolo sono esattamente quelli
//    che restituisce. Un indirizzo dentro il testo resta testo, non un
//    collegamento: cliccarlo vorrebbe dire aprire una pagina.

const DA_COMPLETARE = "da completare";
const campo = "w-full rounded border border-stone-300 p-3";

/** Cosa va rivisto a mano: le segnalazioni del nucleo, più i campi vuoti. */
function daRivedere(esito) {
  const elenco = [...esito.bozza.buchi_dichiarati];
  if (esito.bozza.porzioni === null) elenco.push("porzioni da completare");
  for (const r of esito.ingredienti) {
    if (r.quantita === null) elenco.push(`«${r.nome}»: quantità da completare`);
    if (r.unita === null) elenco.push(`«${r.nome}»: unità da completare`);
  }
  esito.passaggi.forEach((p) => {
    if (p.fase === null) elenco.push(`passaggio ${p.posizione}: fase da scegliere`);
  });
  if (esito.ingredienti.length > 0) {
    elenco.push("ogni ingrediente va collegato a mano a un prodotto dell'anagrafica");
  }
  elenco.push("categoria da scegliere");
  return elenco;
}

export default function AnteprimaDaTesto() {
  const [testo, setTesto] = useState("");
  const [esito, setEsito] = useState(null);

  const esamina = () => setEsito(bozzaDaTesto(testo));
  const svuota = () => {
    setTesto("");
    setEsito(null);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
      <Link to="/ricettario" className="tocco-bottone inline-flex items-center testo-sala-grande text-stone-600">
        ← Ricettario
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Anteprima da testo — non salva nulla</h1>
      <p className="mb-4 text-stone-600">
        Il testo che incolli resta solo in questa schermata: non viene inviato né salvato, e non crea
        nessuna bozza. Qui vedi soltanto cosa si riesce a leggere, e cosa andrebbe completato a mano.
      </p>

      <label className="mb-3 flex flex-col">
        <span className="text-stone-600">Testo della ricetta</span>
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          rows={10}
          className={campo}
          placeholder="Incolla qui il testo: titolo, «Ingredienti», «Procedimento»…"
        />
      </label>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={esamina}
          className="tocco-bottone rounded bg-b58-terracotta px-5 text-b58-parchment"
        >
          Esamina il testo
        </button>
        <button type="button" onClick={svuota} className="tocco-bottone rounded border border-stone-300 px-4">
          Svuota
        </button>
      </div>

      {esito && !esito.ok && (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">
          {esito.messaggio}
        </p>
      )}

      {esito && esito.ok && (
        <section aria-label="Anteprima">
          <h2 className="mb-1 font-semibold">Titolo</h2>
          <p className="mb-3">{esito.bozza.titolo ?? <em>{DA_COMPLETARE}</em>}</p>

          <h2 className="mb-1 font-semibold">Porzioni</h2>
          <p className="mb-3">{esito.bozza.porzioni ?? <em>{DA_COMPLETARE}</em>}</p>

          {esito.bozza.origine_riferimento && (
            <>
              <h2 className="mb-1 font-semibold">Indirizzo trovato nel testo (non aperto)</h2>
              <p className="mb-3 break-all text-stone-600">{esito.bozza.origine_riferimento}</p>
            </>
          )}

          <h2 className="mb-1 font-semibold">Ingredienti ({esito.ingredienti.length})</h2>
          {esito.ingredienti.length === 0 ? (
            <p className="mb-3 text-stone-600">Nessuno trovato.</p>
          ) : (
            <ul className="mb-3">
              {esito.ingredienti.map((r) => (
                <li key={r.posizione} className="border-b border-stone-200 py-1 last:border-0">
                  <span className="font-medium">{r.nome}</span>
                  {" — quantità: "}
                  {r.quantita === null ? <em>{DA_COMPLETARE}</em> : String(r.quantita)}
                  {" · unità: "}
                  {r.unita === null ? <em>{DA_COMPLETARE}</em> : r.unita}
                  {r.nota ? ` · nota: ${r.nota}` : ""}
                  <span className="block text-stone-600">scritto: {r.testo_originale}</span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-1 font-semibold">Passaggi ({esito.passaggi.length})</h2>
          {esito.passaggi.length === 0 ? (
            <p className="mb-3 text-stone-600">Nessuno trovato.</p>
          ) : (
            <ol className="mb-3 list-decimal pl-6">
              {esito.passaggi.map((p) => (
                <li key={p.posizione}>{p.descrizione}</li>
              ))}
            </ol>
          )}

          {esito.non_classificate.length > 0 && (
            <>
              <h2 className="mb-1 font-semibold">Righe non classificate ({esito.non_classificate.length})</h2>
              <ul className="mb-3 list-disc pl-6">
                {esito.non_classificate.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}

          <div className="rounded border border-stone-300 p-4">
            <h2 className="mb-2 font-semibold">Da rivedere a mano</h2>
            <ul className="list-disc pl-6">
              {daRivedere(esito).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
