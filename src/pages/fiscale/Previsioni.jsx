import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import { creaScenarioDaFoglio, listaScenari, cancellaScenario } from "../../lib/api/proiezione";
import { decompressioneDisponibile, leggiFoglioExcel } from "../../lib/foglioExcel";
import { leggiScenarioDaFoglio, rigaPerRiga } from "../../lib/foglioProiezione";
import Didascalia from "../../components/Didascalia";
import { oggiLocale } from "../../lib/constants";

// Le previsioni: si carica il foglio, si guarda cosa è stato letto, si
// conferma. Il sistema propone, Alessio conferma — come per la posta e
// per il carico da fattura.
export default function Previsioni() {
  const [entities, setEntities] = useState(null);
  const [scenari, setScenari] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [letto, setLetto] = useState(null);
  const [nome, setNome] = useState("Previsione di partenza");
  const [anno, setAnno] = useState(new Date(oggiLocale()).getFullYear());
  const [tipo, setTipo] = useState("partenza");
  const [salvando, setSalvando] = useState(false);
  // ⚠️ Le previsioni sono di UNA società: la S.r.l.s. e l'azienda agricola
  // hanno ricavi, costi e imposte propri, e un elenco che le mescola fa
  // confrontare fra loro due piani che non parlano della stessa cosa. È lo
  // stesso filtro che «Come sta andando» applica già.
  const [entityId, setEntityId] = useState("");
  const fileRef = useRef(null);

  const ricarica = (ente) => listaScenari(ente).then(setScenari);

  useEffect(() => {
    (async () => {
      try {
        const ent = await getEntities();
        setEntities(ent);
        setEntityId(ent.srls.id);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    ricarica(entityId)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entityId]);

  const inputClass =
    "tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const apriFoglio = async (file) => {
    setError("");
    setLetto(null);
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const { nomeFoglio, celle } = await leggiFoglioExcel(buffer);
      const scenario = leggiScenarioDaFoglio(celle);
      setLetto({ ...scenario, nomeFoglio, nomeFile: file.name });
    } catch (e) {
      setError(e.message);
    }
  };

  const conferma = async () => {
    if (!letto || letto.problemi.length) return;
    setSalvando(true);
    setError("");
    try {
      await creaScenarioDaFoglio({
        // La società è quella scelta in cima, non sempre la S.r.l.s.:
        // altrimenti scegliendo l'agricola si guarderebbe il suo elenco e
        // si scriverebbe nell'altro, in silenzio.
        entity_id: entityId,
        nome,
        tipo,
        anno: Number(anno),
        // ⚠️ Si conserva il NOME del file, mai il file: il modello resta
        // sul computer di Alessio.
        origine: letto.nomeFile,
        versione_foglio: letto.versione,
        parametri: letto.parametri,
        personale: letto.personale,
        extra: letto.extra,
        costiFissi: letto.costiFissi,
        accessorie: letto.accessorie,
        mesi: letto.mesi,
        controlli: letto.controlli,
      });
      setLetto(null);
      if (fileRef.current) fileRef.current.value = "";
      await ricarica(entityId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const elimina = async (s) => {
    const avviso = s.congelato_il
      ? `Buttare via «${s.nome}»? È chiusa: sparisce intera, e la cancellazione resta scritta.`
      : `Cancellare «${s.nome}»?`;
    if (!confirm(avviso)) return;
    try {
      await cancellaScenario(s.id);
      await ricarica(entityId);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="testo-sala max-w-4xl mx-auto pb-16">
      <Link to="/fiscale" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Proiezione fiscale
      </Link>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-1 mb-2">
        <h1 className="font-display text-2xl text-b58-charcoal">Le previsioni</h1>
        {/* 🔴 ANCHE QUESTA ERA SENZA PORTA, ed è la più grave delle tre: la
            schermata per SCRIVERE una previsione a mano è stata costruita il
            15/08 proprio perché Alessio aveva detto che non esisteva — *«mi
            immaginavo dei campi da riempire»* — e poi nessun collegamento la
            raggiungeva. Il caricamento del foglio, che è la scorciatoia, era
            l'unica strada. */}
        {/* ⚠️ LA SOCIETA' SCELTA VIAGGIA COL COLLEGAMENTO. Fino al 24/08
            questo pulsante non la passava e quello nel riquadro sotto sì:
            togliendo il riquadro (erano due porte per la stessa stanza)
            senza portarsi dietro questo pezzo, si sarebbe guardato
            l'elenco dell'agricola e scritto nella S.r.l.s. — e un piano
            scritto per la società sbagliata non si nota da nessun numero. */}
        <Link
          to={`/fiscale/previsioni/nuova${entityId ? `?entita=${entityId}` : ""}`}
          className="tocco-bottone inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala font-medium px-4"
        >
          + Scrivi una previsione
        </Link>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala text-b58-charcoal"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>
      {/* 🔴 «Una previsione chiusa non si ritocca mai più» RESTA VISIBILE
          (24/08): non è una didascalia, è un AVVERTIMENTO — dice cosa
          succede se premi, non cosa significa una parola. Nasconderlo
          sarebbe l'errore che il mandato chiede di non fare.
          ⚠️ La riga su cosa si compila invece si apre dal segno: è una
          spiegazione, e chi ha già scritto una previsione la conosce. */}
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        Una previsione chiusa non si ritocca mai più: se cambia qualcosa se ne fa una nuova, e le due
        restano confrontabili.
        <Didascalia>
          Campo per campo, dentro il gestionale: quanto vale un coperto, chi lavora, i costi fissi, e
          mese per mese quanta gente ti aspetti. Confrontarle è l&apos;unico modo perché fra un anno
          si possa dire com&apos;era andata davvero rispetto a quello che si pensava.
        </Didascalia>
      </p>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* --- Caricare il foglio: la scorciatoia --- */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-1">Oppure parti dal tuo foglio Excel</h2>
        <p className="testo-sala text-b58-charcoal-soft mb-4">
          Una scorciatoia, non un obbligo: serve a non ricopiare a mano sessanta numeri che hai già
          scritto. Il file resta sul tuo computer — il gestionale ne legge i numeri e li tiene nel
          database, non conserva il foglio da nessuna parte. Da lì in poi la previsione vive qui e la
          correggi da qui.
        </p>

        {!decompressioneDisponibile() ? (
          <p className="testo-sala text-b58-terracotta-dark">
            Questo browser non sa aprire i file Excel. Apri il gestionale con Chrome aggiornato.
          </p>
        ) : (
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => apriFoglio(e.target.files?.[0])}
            className="tocco-campo block w-full max-w-full testo-sala text-b58-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-b58-terracotta file:px-4 file:py-2 file:testo-sala file:text-b58-parchment"
          />
        )}

        {letto && (
          <div className="mt-5 border-t border-b58-charcoal/10 pt-4">
            <p className="testo-sala text-b58-charcoal mb-3">
              Foglio <strong>{letto.nomeFoglio}</strong>
              {letto.versione && <> — {letto.versione}</>}
            </p>

            {letto.problemi.length > 0 ? (
              <div className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
                <p className="font-medium mb-1">Non ho riconosciuto questo foglio, e non tiro a indovinare:</p>
                <ul className="list-disc pl-5 space-y-0.5 testo-sala">
                  {letto.problemi.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full testo-sala mb-4">
                    <tbody>
                      {rigaPerRiga(letto).map(([voce, unita, a, b]) => (
                        <tr key={voce} className="border-b border-b58-charcoal/5">
                          <td className="py-1 text-b58-charcoal-soft">{voce}</td>
                          <td className="py-1 text-right text-b58-charcoal tabular-nums">
                            {a ?? "—"}{b != null && <> · {b}</>}
                          </td>
                          <td className="py-1 pl-2 testo-sala text-b58-charcoal-soft/70 w-24">{unita}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {letto.avvisi.length > 0 && (
                  <ul className="testo-sala text-b58-charcoal-soft mb-3 list-disc pl-5">
                    {letto.avvisi.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block testo-sala text-b58-charcoal-soft mb-1">Come la chiami</label>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} className={`${inputClass} min-w-[220px]`} />
                  </div>
                  <div>
                    <label className="block testo-sala text-b58-charcoal-soft mb-1">Anno</label>
                    <input type="number" value={anno} onChange={(e) => setAnno(e.target.value)} className={`${inputClass} w-24`} />
                  </div>
                  <div>
                    <label className="block testo-sala text-b58-charcoal-soft mb-1">Cos&apos;è</label>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
                      <option value="partenza">La previsione di partenza</option>
                      <option value="riproiezione">Una riproiezione</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={conferma}
                    disabled={salvando}
                    className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
                  >
                    {salvando ? "Salvo…" : "Crea la previsione"}
                  </button>
                </div>
                <p className="testo-sala text-b58-charcoal-soft/70 mt-2">
                  Dopo averla creata potrai controllare che i totali tornino col tuo foglio, e solo allora chiuderla.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* --- Le previsioni esistenti --- */}
      {loading ? (
        <p className="testo-sala text-b58-charcoal-soft">Caricamento…</p>
      ) : scenari.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft">Nessuna previsione ancora.</p>
      ) : (
        <ul className="space-y-2">
          {scenari.map((s) => (
            <li
              key={s.id}
              className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <Link to={`/fiscale/previsioni/${s.id}`} className="tocco-bottone inline-flex items-center text-b58-charcoal hover:text-b58-terracotta">
                  <span className="font-medium">{s.nome}</span>
                </Link>
                <p className="testo-sala text-b58-charcoal-soft mt-0.5">
                  {s.anno} · {s.tipo === "partenza" ? "previsione di partenza" : "riproiezione"} ·{" "}
                  {s.congelato_il ? (
                    <span className="text-b58-olive-dark">
                      chiusa il {new Date(s.congelato_il).toLocaleDateString("it-IT")}
                    </span>
                  ) : (
                    <span className="text-b58-terracotta-dark">ancora aperta</span>
                  )}
                </p>
              </div>
              <div className="gesti-pericolosi">
                {!s.congelato_il && (
                  <Link
                    to={`/fiscale/previsioni/${s.id}/modifica`}
                    className="tocco-bottone inline-flex items-center testo-sala text-b58-terracotta hover:text-b58-terracotta-dark"
                  >
                    Correggi
                  </Link>
                )}
                <button
                  onClick={() => elimina(s)}
                  className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                >
                  Cancella
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
