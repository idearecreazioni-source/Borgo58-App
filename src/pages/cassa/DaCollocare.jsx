import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DatoNonLetto from "../../components/DatoNonLetto";
import {
  collocaSpesa,
  listSpeseCollocate,
  listSpeseDaCollocare,
  togliFotoSpesa,
  urlFotoSpesa,
} from "../../lib/api/speseDaCollocare";
import { listCausali, listContiBancari } from "../../lib/api/cash";
import { listTagAnticipazioni } from "../../lib/api/anticipazioni";
import { sezioniArchivio } from "../../lib/api/documents";
import {
  DESTINAZIONI,
  campiIniziali,
  campiPer,
  cosaMancaPer,
  etichettaDestinazione,
} from "../../lib/calcoli/daCollocare";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import { formatDate, formatEUR } from "../../lib/constants";

// «DA COLLOCARE» — le spese dette a MEMO o fotografate (11/10/2026, C12).
//
// 🔴 QUI NIENTE È ANCORA CONTABILITÀ: un appunto non è in prima nota, non è
//    nella tasca, non è un costo e non è un anticipo. Lo diventa quando
//    Alessio sceglie dove va — una volta sola, e il database lo garantisce
//    (`colloca_spesa` + il guardiano sulla tabella).
//
// ⚠️ L'ORIGINALE STA ACCANTO: il dettato o la foto, perché la relazione
//    chiede di poter risalire prima di decidere.
//
// ⚠️ LA FOTO si tiene finché la spesa non è collocata. In Archivio diventa
//    il file del documento; altrove si toglie subito dopo (decisione di
//    Alessio dell'11/10).

const campo =
  "tocco-riga w-full rounded-lg border border-b58-charcoal/20 bg-white px-3 text-b58-charcoal";
const etichetta = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1";

function Foto({ path }) {
  const [url, setUrl] = useState(null);
  const [errore, setErrore] = useState(false);
  useEffect(() => {
    let vivo = true;
    // SILENZIO MOTIVATO: non tace — l'errore accende «La foto non si apre»
    // al posto della foto.
    urlFotoSpesa(path)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setErrore(true));
    return () => {
      vivo = false;
    };
  }, [path]);
  if (errore) return <p className="testo-sala text-b58-ambra-dark">La foto non si apre.</p>;
  if (!url) return <p className="testo-sala text-b58-charcoal-soft">Apro la foto…</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-28 shrink-0">
      <img src={url} alt="La foto della spesa" className="h-28 w-28 rounded-md object-cover ring-1 ring-b58-charcoal/15" />
    </a>
  );
}

function Riga({ spesa, elenchi, onCollocata }) {
  const [aperta, setAperta] = useState(false);
  const [dove, setDove] = useState(spesa.natura_proposta ?? "");
  const [campi, setCampi] = useState(() => campiIniziali(spesa));
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const guardia = useRef(unaVoltaSola());

  const imposta = (k) => (e) => setCampi((c) => ({ ...c, [k]: e.target.value }));
  const manca = cosaMancaPer(dove, campi);

  const conferma = async () => {
    if (manca.length || !guardia.current.prendi("colloca")) return;
    setErrore("");
    setLavoro(true);
    try {
      const esito = await collocaSpesa(spesa.id, dove, campiPer(dove, campi));
      let fotoRimasta = null;
      if (esito?.foto_da_togliere) {
        try {
          await togliFotoSpesa(spesa.id, esito.foto_da_togliere);
        } catch (e) {
          fotoRimasta = e.message;
        }
      }
      onCollocata(spesa.id, dove, fotoRimasta);
    } catch (e) {
      setErrore(e.message);
    } finally {
      guardia.current.lascia("colloca");
      setLavoro(false);
    }
  };

  return (
    <li className="rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10" data-spesa={spesa.id}>
      <div className="flex gap-3">
        {spesa.foto_path && <Foto path={spesa.foto_path} />}
        <div className="min-w-0 flex-1">
          <p className="testo-sala-grande font-semibold text-b58-charcoal">
            {spesa.importo != null ? formatEUR(spesa.importo) : <span className="text-b58-ambra-dark">importo non letto</span>}
            {spesa.controparte && <span className="font-normal"> · {spesa.controparte}</span>}
          </p>
          {spesa.descrizione && <p className="text-b58-charcoal">{spesa.descrizione}</p>}
          <p className="testo-sala text-b58-charcoal-soft">
            {spesa.provenienza === "foto" ? "Fotografata" : "Detta a MEMO"} il {formatDate(spesa.creata_il)}
            {spesa.data && <> · spesa del {formatDate(spesa.data)}</>}
          </p>
          {spesa.natura_proposta && (
            <p className="testo-sala text-b58-charcoal-soft">
              MEMO propone: <strong>{etichettaDestinazione(spesa.natura_proposta)}</strong>
            </p>
          )}
          {spesa.incertezza && <p className="testo-sala text-b58-ambra-dark">{spesa.incertezza}</p>}
          {spesa.testo_originale && spesa.provenienza === "voce" && (
            <p className="testo-sala italic text-b58-charcoal-soft">«{spesa.testo_originale}»</p>
          )}
        </div>
      </div>

      {!aperta ? (
        <button
          type="button"
          onClick={() => setAperta(true)}
          className="tocco-bottone mt-3 rounded-lg bg-b58-azione px-5 font-medium text-b58-parchment hover:bg-b58-azione-dark"
        >
          Colloca
        </button>
      ) : (
        <div className="mt-3 border-t border-b58-charcoal/10 pt-3">
          <fieldset>
            <legend className={etichetta}>Dove va</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {DESTINAZIONI.map((d) => (
                <label key={d.value} className="tocco-riga flex items-start gap-2 rounded-md px-2 py-1 hover:bg-b58-cream-dark/40">
                  <input
                    type="radio"
                    name={`dove-${spesa.id}`}
                    value={d.value}
                    checked={dove === d.value}
                    onChange={() => setDove(d.value)}
                    className="mt-1.5"
                  />
                  <span className="min-w-0">
                    <span className="text-b58-charcoal">{d.label}</span>
                    <span className="block testo-sala text-b58-charcoal-soft">{d.spiega}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {dove && dove !== "ignora" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <span className={etichetta}>Importo (€)</span>
                <input inputMode="decimal" value={campi.importo} onChange={imposta("importo")} className={campo} />
              </label>
              <label>
                <span className={etichetta}>Data della spesa</span>
                <input type="date" value={campi.data} onChange={imposta("data")} className={`${campo} campo-data`} />
              </label>
              <label>
                <span className={etichetta}>A chi</span>
                <input value={campi.controparte} onChange={imposta("controparte")} className={campo} />
              </label>
              <label>
                <span className={etichetta}>Che cosa</span>
                <input value={campi.descrizione} onChange={imposta("descrizione")} className={campo} />
              </label>

              {dove === "prima_nota" && (
                <>
                  <label>
                    <span className={etichetta}>Causale</span>
                    <select value={campi.causale_id} onChange={imposta("causale_id")} className={campo}>
                      <option value="">— da classificare dopo —</option>
                      {elenchi.causali.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={etichetta}>Da dove sono usciti</span>
                    <select value={campi.mezzo} onChange={imposta("mezzo")} className={campo}>
                      <option value="cassa">Cassa</option>
                      <option value="banca">Banca</option>
                    </select>
                  </label>
                  {campi.mezzo === "banca" && (
                    <label>
                      <span className={etichetta}>Conto</span>
                      <select value={campi.conto_id} onChange={imposta("conto_id")} className={campo}>
                        <option value="">— scegli —</option>
                        {elenchi.conti.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    <span className={etichetta}>Documento</span>
                    <select value={campi.documento} onChange={imposta("documento")} className={campo}>
                      <option value="scontrino">Scontrino</option>
                      <option value="fattura">Fattura</option>
                      <option value="non_documentato">Nessun documento fiscale</option>
                    </select>
                  </label>
                </>
              )}

              {dove === "anticipo" && (
                <>
                  <label>
                    <span className={etichetta}>Motivo dell&apos;anticipo</span>
                    <select value={campi.tag_id} onChange={imposta("tag_id")} className={campo}>
                      <option value="">— scegli —</option>
                      {elenchi.tag.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.etichetta}
                        </option>
                      ))}
                    </select>
                    {elenchi.tag.length === 0 && (
                      <span className="testo-sala text-b58-ambra-dark">
                        Non ci sono ancora motivi:{" "}
                        <Link to="/cassa/personale" className="underline">
                          aggiungine uno
                        </Link>
                        .
                      </span>
                    )}
                  </label>
                  <label>
                    <span className={etichetta}>Con che soldi</span>
                    <select value={campi.fondi} onChange={imposta("fondi")} className={campo}>
                      <option value="contanti">Contanti miei</option>
                      <option value="conto_personale">Il mio conto personale</option>
                    </select>
                  </label>
                </>
              )}

              {dove === "archivio" && (
                <>
                  <label>
                    <span className={etichetta}>Sezione dell&apos;Archivio</span>
                    <select value={campi.sezione} onChange={imposta("sezione")} className={campo}>
                      <option value="">— scegli —</option>
                      {elenchi.sezioni
                        .filter((s) => s.attiva !== false)
                        .map((s) => (
                          <option key={s.codice} value={s.codice}>
                            {s.etichetta}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span className={etichetta}>Titolo (facoltativo)</span>
                    <input value={campi.titolo} onChange={imposta("titolo")} className={campo} />
                  </label>
                </>
              )}
            </div>
          )}

          {dove === "archivio" && (
            <p className="testo-sala mt-2 text-b58-charcoal-soft">In Archivio non entra nei conti: si conserva e basta, foto compresa.</p>
          )}
          {dove && dove !== "archivio" && dove !== "ignora" && spesa.foto_path && (
            <p className="testo-sala mt-2 text-b58-charcoal-soft">Collocata qui, la foto si toglie.</p>
          )}

          {manca.length > 0 && dove && (
            <p className="testo-sala mt-2 text-b58-ambra-dark">Manca {manca.join(", ")}.</p>
          )}
          {errore && <p className="testo-sala mt-2 rounded bg-red-50 p-2 text-red-700">{errore}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dove || manca.length > 0 || lavoro}
              onClick={conferma}
              className="tocco-bottone rounded-lg bg-b58-azione px-5 font-medium text-b58-parchment hover:bg-b58-azione-dark disabled:opacity-50"
            >
              {lavoro
                ? "Sto collocando…"
                : !dove
                  ? "Scegli dove va"
                  : dove === "ignora"
                    ? "Ignorala"
                    : `Metti in «${etichettaDestinazione(dove)}»`}
            </button>
            <button
              type="button"
              onClick={() => setAperta(false)}
              className="tocco-bottone rounded-lg border border-b58-charcoal/20 px-4 text-b58-charcoal"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function DaCollocare() {
  const [aperte, setAperte] = useState(null);
  const [fatte, setFatte] = useState([]);
  const [elenchi, setElenchi] = useState({ causali: [], conti: [], tag: [], sezioni: [] });
  const [errLettura, setErrLettura] = useState("");
  const [esiti, setEsiti] = useState({});

  const carica = () => {
    setErrLettura("");
    Promise.all([listSpeseDaCollocare(), listSpeseCollocate()])
      .then(([a, f]) => {
        setAperte(a);
        setFatte(f);
      })
      .catch((e) => setErrLettura(e.message));
  };
  useEffect(carica, []);

  useEffect(() => {
    // ⚠️ Gli elenchi delle destinazioni non fermano la schermata: senza, si
    //    può ancora ignorare o mettere in tasca. Un menu vuoto lo dice.
    Promise.allSettled([
      listCausali("uscita"),
      listContiBancari({ soloAttivi: true }),
      listTagAnticipazioni({ soloAttivi: true }),
      sezioniArchivio(),
    ]).then(([c, k, t, s]) =>
      setElenchi({
        causali: c.status === "fulfilled" ? c.value ?? [] : [],
        conti: k.status === "fulfilled" ? k.value ?? [] : [],
        tag: t.status === "fulfilled" ? t.value ?? [] : [],
        sezioni: s.status === "fulfilled" ? s.value ?? [] : [],
      })
    );
  }, []);

  // Dopo la collocazione si ricarica solo ciò che è cambiato sul server: le
  // altre righe possono avere un modulo aperto a metà (trappola del 12/08).
  // SILENZIO MOTIVATO (qui e in togliFoto): è solo l'elenco «di recente»,
  // che resta quello di prima; l'esito vero del gesto si vede già — la riga
  // sparisce dalle aperte, o il motivo compare sotto la riga toccata.
  const collocata = (id, dove, fotoRimasta) => {
    setAperte((a) => (a ?? []).filter((s) => s.id !== id));
    setEsiti((e) => ({ ...e, [id]: { dove, fotoRimasta } }));
    listSpeseCollocate().then(setFatte).catch(() => {});
  };

  const togliFoto = async (s) => {
    try {
      await togliFotoSpesa(s.id, s.foto_path);
      setEsiti((e) => ({ ...e, [s.id]: { ...(e[s.id] ?? {}), fotoRimasta: null } }));
      listSpeseCollocate().then(setFatte).catch(() => {});
    } catch (e) {
      setEsiti((x) => ({ ...x, [s.id]: { ...(x[s.id] ?? {}), fotoRimasta: e.message } }));
    }
  };

  if (errLettura) {
    return (
      <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
        <DatoNonLetto cosa="le spese da collocare" nonVuolDire="che non ce ne siano" onRiprova={carica} />
      </div>
    );
  }
  if (!aperte) return <p className="p-4 testo-sala-grande">Caricamento…</p>;

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
      <Link to="/cassa" className="tocco-bottone inline-flex items-center text-b58-charcoal-soft">
        ← Cassa
      </Link>
      <h1 className="mt-2 font-display text-2xl md:text-3xl text-b58-charcoal">Da collocare</h1>
      <p className="mb-4 text-b58-charcoal-soft">
        Le spese dette a MEMO o fotografate. Non sono ancora contabilità: scegli tu dove vanno, una volta sola.
      </p>

      {aperte.length === 0 ? (
        <p className="rounded-xl bg-b58-parchment p-4 text-b58-charcoal-soft ring-1 ring-b58-charcoal/10">
          Niente da collocare.
        </p>
      ) : (
        <ul className="space-y-3">
          {aperte.map((s) => (
            <Riga key={s.id} spesa={s} elenchi={elenchi} onCollocata={collocata} />
          ))}
        </ul>
      )}

      {fatte.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display font-semibold text-b58-charcoal">Collocate di recente</h2>
          <ul className="divide-y divide-b58-charcoal/10 rounded-xl bg-b58-parchment px-4 ring-1 ring-b58-charcoal/10">
            {fatte.map((s) => (
              <li key={s.id} className="py-2" data-collocata={s.id}>
                <p className="text-b58-charcoal">
                  {s.importo != null ? formatEUR(s.importo) : "—"}
                  {s.controparte && <> · {s.controparte}</>}
                  {s.descrizione && <> · {s.descrizione}</>}
                </p>
                <p className="testo-sala text-b58-charcoal-soft">
                  {s.stato === "ignorata" ? "Ignorata" : `In «${etichettaDestinazione(s.collocata_in)}»`} il{" "}
                  {formatDate(s.collocata_il)}
                </p>
                {esiti[s.id]?.fotoRimasta && (
                  <p className="testo-sala text-b58-ambra-dark">{esiti[s.id].fotoRimasta}</p>
                )}
                {s.foto_path && s.collocata_in !== "archivio" && (
                  <button
                    type="button"
                    onClick={() => togliFoto(s)}
                    className="tocco-bottone testo-sala mt-1 rounded-md border border-b58-charcoal/20 px-3 text-b58-charcoal"
                  >
                    Togli la foto
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
