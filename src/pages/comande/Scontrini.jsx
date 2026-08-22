import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { segnalaScontrinoNonUscito } from "../../lib/api/orders";
import { formatDate } from "../../lib/constants";
import { serataCorrente } from "../../lib/giornataOperativa";
import { useAuth } from "../../context/AuthContext";

// «QUESTO SCONTRINO NON È USCITO» — la segnalazione della sala.
//
// 🔴 PERCHÉ ESISTE, e non è una comodità: c'è un buco che nessun protocollo
// copre — la stampante che risponde «fatto» e stampa una pagina bianca.
// L'apparecchio crede di aver stampato, il gestionale gli crede, e l'unico
// che vede il foglio bianco è chi lo ha in mano. Serve anche col
// registratore più moderno.
//
// 🔴 LA RETTIFICA LA FA IL TITOLARE (22/08/2026, rovesciamento n. 30).
// Fino al 21/08 la faceva chiunque fosse in sala, e la ragione era buona:
// *chi ha il cliente davanti è chi se ne accorge*. **Quella ragione resta
// vera** — cade la conclusione, non la premessa.
//
// ⚠️ Cambia perché da oggi la fiscalizzazione è **automatica**: il
// gestionale scrive il documento da sé quando il conto si chiude, e la
// rettifica smette di essere un gesto di sala fra tanti — diventa l'unico
// punto in cui una persona **disfa a mano un dato fiscale già registrato**.
// Parole di Alessio: *«è un dato fiscale»*.
//
// ⚠️ E QUESTA SCHERMATA RESTA IN SALA, in sola lettura per lo staff: chi
// serve deve poter **vedere** se lo scontrino è uscito — è lui che ha il
// foglio in mano. Toglierla vorrebbe dire che se ne accorge nessuno.
export default function Scontrini() {
  const { isTitolare } = useAuth();
  const [conti, setConti] = useState(null);
  const [errore, setErrore] = useState("");
  const [esito, setEsito] = useState("");
  const [inCorso, setInCorso] = useState(null);
  const [serata, setSerata] = useState(null);

  const carica = async () => {
    setErrore("");
    try {
      const s = await serataCorrente();
      setSerata(s);
      // La serata comincia la sera prima: si parte da mezzogiorno di quel
      // giorno, che è prima di qualunque servizio.
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_label, closed_at, documento_fiscale, documento_numero, coperti")
        .in("status", ["chiuso", "omaggiato"])
        .gte("closed_at", `${s}T00:00:00`)
        .order("closed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setConti(data ?? []);
    } catch (e) {
      // ⚠️ Non si disegna un elenco vuoto quando la lettura è fallita:
      // «non ci sono conti» e «non lo so» sono due cose diverse.
      setConti(null);
      setErrore(e.message);
    }
  };

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segnala = async (conto) => {
    setInCorso(conto.id);
    setErrore("");
    setEsito("");
    try {
      const r = await segnalaScontrinoNonUscito(conto.id, null);
      setEsito(`${conto.table_label}: ${r.messaggio}`);
      await carica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setInCorso(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4">
        <Link to="/comande" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Sala
        </Link>
      </div>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">Scontrini</h1>
      {serata && (
        <p className="testo-sala text-b58-charcoal-soft mb-4">
          Conti chiusi nella serata del {formatDate(serata)}
        </p>
      )}

      {errore && (
        <div className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          <p>{errore}</p>
          <button onClick={carica} className="tocco-bottone underline testo-sala mt-1">
            Riprova
          </button>
        </div>
      )}
      {esito && (
        <p className="testo-sala text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2 mb-4">{esito}</p>
      )}

      {conti === null && !errore && <p className="testo-sala text-b58-charcoal-soft">Sto guardando…</p>}
      {/* ⚠️ LA VIA D'USCITA PER CHI NON PUÒ RETTIFICARE. Senza questa
          riga la schermata sarebbe muta proprio con chi ha il foglio bianco
          in mano: vedrebbe «Scontrino n. 14» accanto a un conto per cui non
          è uscito niente, e nessuna indicazione di cosa fare. Un rifiuto
          senza gesto d'uscita è un vicolo cieco — e qui il rifiuto non è
          nemmeno visibile, perché il pulsante non c'è. */}
      {!isTitolare && conti !== null && conti.length > 0 && (
        <p className="testo-sala text-b58-charcoal-soft mb-4">
          Se uno scontrino non è uscito davvero, dillo ad Alessio: la rettifica la fa lui.
        </p>
      )}

      {conti !== null && conti.length === 0 && (
        <p className="testo-sala text-b58-charcoal-soft">Stasera non è ancora stato chiuso nessun conto.</p>
      )}

      {conti !== null && conti.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/10">
          {conti.map((c) => {
            const uscito = c.documento_fiscale === "scontrino" || c.documento_fiscale === "fattura";
            return (
              <div key={c.id} className="tocco-riga flex items-center gap-3 px-4">
                <div className="flex-1 min-w-0">
                  <div className="text-b58-charcoal">{c.table_label}</div>
                  <div className="testo-sala text-b58-charcoal-soft">
                    {uscito
                      ? `${c.documento_fiscale === "fattura" ? "Fattura" : "Scontrino"}${
                          c.documento_numero ? ` n. ${c.documento_numero}` : ""
                        }`
                      : "Ancora senza scontrino"}
                  </div>
                </div>
                {/* ⚠️ Il gesto c'è solo dove serve. Su una fattura non
                    compare: ha un numero, e un numero emesso non si disfa
                    con un tocco in sala — il database lo rifiuterebbe, e un
                    pulsante che esiste per essere rifiutato è un inganno. */}
                {c.documento_fiscale !== "fattura" && isTitolare && (
                  <button
                    type="button"
                    disabled={inCorso !== null}
                    onClick={() => segnala(c)}
                    className="tocco-bottone shrink-0 rounded-lg border border-b58-charcoal/20 testo-sala px-3 text-b58-charcoal-soft disabled:opacity-60"
                  >
                    {inCorso === c.id ? "…" : "Non è uscito"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="testo-sala text-b58-charcoal-soft mt-4">
        Segnalando, il conto torna fra quelli da fiscalizzare e Alessio lo trova a fine serata.
      </p>
    </div>
  );
}
