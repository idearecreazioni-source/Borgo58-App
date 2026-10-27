import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DatoNonLetto from "../../components/DatoNonLetto";
import {
  annotaSpesaDettataAMano,
  annullaCollocazione,
  collocaSpesa,
  eliminaSpesa,
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
import Didascalia from "../../components/Didascalia";
import { StriscaDallaVoce } from "../../components/StriscaDallaVoce";
import { useDaVoce } from "../../lib/daVoce";

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
  "tocco-riga w-full rounded-lg border border-b58-charcoal/20 bg-b58-campo px-3 text-b58-charcoal";
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
  if (errore) return <p className="testo-sala text-b58-ambra-dark-testo">La foto non si apre.</p>;
  if (!url) return <p className="testo-sala text-b58-charcoal-soft">Apro la foto…</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-28 shrink-0">
      <img src={url} alt="La foto della spesa" className="h-28 w-28 rounded-md object-cover ring-1 ring-b58-charcoal/15" />
    </a>
  );
}

// 🔴 UN GESTO CHE TOGLIE SI CONFERMA SULLA RIGA, e la conferma dice COSA
//    toglie: un «Sei sicuro?» generico si impara a premere senza leggere.
//    Il secondo tocco ha la guardia sincrona come gli altri (27/08): chi
//    non vede succedere niente ripreme.
function GestoConConferma({ etichetta, domanda, conferma, onFai }) {
  const [chiede, setChiede] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const guardia = useRef(unaVoltaSola());

  const fai = async () => {
    if (!guardia.current.prendi("fai")) return;
    setErrore("");
    setLavoro(true);
    try {
      await onFai();
    } catch (e) {
      setErrore(e.message);
      setLavoro(false);
    } finally {
      guardia.current.lascia("fai");
    }
  };

  if (!chiede) {
    return (
      <button
        type="button"
        onClick={() => setChiede(true)}
        className="tocco-bottone testo-sala mt-1 rounded-md border border-b58-charcoal/20 px-3 text-b58-charcoal"
      >
        {etichetta}
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-lg bg-b58-cream-dark/40 p-2">
      <p className="testo-sala text-b58-charcoal">{domanda}</p>
      {errore && <p className="testo-sala mt-1 rounded bg-red-50 p-2 text-red-700">{errore}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={fai}
          disabled={lavoro}
          className="tocco-bottone rounded-lg bg-b58-azione px-4 font-medium text-b58-sul-colore disabled:opacity-60"
        >
          {lavoro ? "Lo sto facendo…" : conferma}
        </button>
        <button
          type="button"
          onClick={() => {
            setChiede(false);
            setErrore("");
          }}
          disabled={lavoro}
          className="tocco-bottone rounded-lg border border-b58-charcoal/20 px-4 text-b58-charcoal"
        >
          No, lascia stare
        </button>
      </div>
    </div>
  );
}

// Cosa toglie l'annullamento, detto PRIMA di premere.
function cosaToglie(s) {
  if (s.stato === "ignorata") return "Non è andata da nessuna parte: torna solo fra quelle da collocare.";
  switch (s.collocata_in) {
    case "prima_nota":
      return "Toglie il movimento dalla prima nota e la spesa torna da collocare.";
    case "tasca":
      return "Toglie il movimento dalla tua tasca e la spesa torna da collocare.";
    case "anticipo":
      return "Toglie l'anticipo e la spesa torna da collocare.";
    case "archivio":
      return "Toglie il documento dall'Archivio; la foto resta alla spesa, che torna da collocare.";
    default:
      return "La spesa torna da collocare.";
  }
}

function Riga({ spesa, elenchi, onCollocata, onTolta, tornata }) {
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
      {/* L'esito dell'annullamento sta sulla riga che è tornata, non in
          cima alla pagina: un esito lontano dal gesto non si vede (17/08). */}
      {tornata && <p className="testo-sala mb-2 text-b58-olive-dark-testo">{tornata}</p>}
      <div className="flex gap-3">
        {spesa.foto_path && <Foto path={spesa.foto_path} />}
        <div className="min-w-0 flex-1">
          <p className="testo-sala-grande font-semibold text-b58-charcoal">
            {spesa.importo != null ? formatEUR(spesa.importo) : <span className="text-b58-ambra-dark-testo">importo non letto</span>}
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
          {spesa.incertezza && <p className="testo-sala text-b58-ambra-dark-testo">{spesa.incertezza}</p>}
          {spesa.testo_originale && spesa.provenienza === "voce" && (
            <p className="testo-sala italic text-b58-charcoal-soft">«{spesa.testo_originale}»</p>
          )}
        </div>
      </div>

      {!aperta ? (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={() => setAperta(true)}
            className="tocco-bottone rounded-lg bg-b58-azione px-5 font-medium text-b58-sul-colore hover:bg-b58-azione-dark"
          >
            Colloca
          </button>
          <GestoConConferma
            etichetta="Togli l'appunto"
            domanda={
              spesa.foto_path
                ? "Lo tolgo del tutto, foto compresa. Non è contabilità, quindi nessun conto cambia."
                : "Lo tolgo del tutto. Non è contabilità, quindi nessun conto cambia."
            }
            conferma="Sì, toglilo"
            onFai={async () => onTolta(spesa.id, await eliminaSpesa(spesa.id))}
          />
        </div>
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
                      <span className="testo-sala text-b58-ambra-dark-testo">
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
            <p className="testo-sala mt-2 text-b58-ambra-dark-testo">Manca {manca.join(", ")}.</p>
          )}
          {errore && <p className="testo-sala mt-2 rounded bg-red-50 p-2 text-red-700">{errore}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dove || manca.length > 0 || lavoro}
              onClick={conferma}
              className="tocco-bottone rounded-lg bg-b58-azione px-5 font-medium text-b58-sul-colore hover:bg-b58-azione-dark disabled:opacity-50"
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

// 🔴 «FALLO A MANO» DI UNA SPESA DETTA (27/10/2026). Prima si arrivava qui
//    e la spesa non c'era: la scrive solo «Approva», e la schermata non
//    aveva un modo per scriverla — un vicolo cieco trovato da Alessio.
//    Qui la si corregge e la si mette fra quelle da collocare; il database
//    chiude la cosa detta nella stessa transazione (20261027000002).
// ⚠️ NON È CONTABILITÀ nemmeno così: entra nell'elenco qui sotto, e da lì
//    si colloca come tutte le altre.
const VUOTA = { importo: "", data: "", controparte: "", descrizione: "" };

function SchedaDallaVoce({ venuto, scheda, setScheda, onScritta }) {
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const guardia = useRef(unaVoltaSola());

  const imposta = (k) => (e) => setScheda((c) => ({ ...c, [k]: e.target.value }));
  const vuota = !scheda.importo.trim() && !scheda.descrizione.trim();

  const salva = async (e) => {
    e.preventDefault();
    if (vuota || !venuto.idDaChiudere || !guardia.current.prendi("salva")) return;
    setErrore("");
    setLavoro(true);
    try {
      await annotaSpesaDettataAMano(venuto.idDaChiudere, scheda);
      venuto.segnaChiusa();
      onScritta();
    } catch (err) {
      setErrore(err.message);
    } finally {
      guardia.current.lascia("salva");
      setLavoro(false);
    }
  };

  return (
    <form onSubmit={salva} className="mb-6 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
      <h2 className="mb-3 font-display font-semibold text-b58-charcoal">La spesa che hai detto</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="voce-importo" className={etichetta}>Importo (€)</label>
          <input id="voce-importo" inputMode="decimal" className={campo} value={scheda.importo} onChange={imposta("importo")} />
        </div>
        <div>
          <label htmlFor="voce-data" className={etichetta}>Giorno della spesa</label>
          <input id="voce-data" type="date" className={`${campo} campo-data`} value={scheda.data} onChange={imposta("data")} />
        </div>
        <div>
          <label htmlFor="voce-controparte" className={etichetta}>Da chi</label>
          <input id="voce-controparte" className={campo} value={scheda.controparte} onChange={imposta("controparte")} />
        </div>
        <div>
          <label htmlFor="voce-descrizione" className={etichetta}>Che cosa</label>
          <input id="voce-descrizione" className={campo} value={scheda.descrizione} onChange={imposta("descrizione")} />
        </div>
      </div>
      {vuota && (
        <p id="voce-manca" className="testo-sala mt-2 text-b58-charcoal-soft">
          Scrivi almeno l'importo o che cosa hai comprato.
        </p>
      )}
      {errore && (
        <p role="alert" className="testo-sala mt-2 rounded bg-red-50 p-2 text-red-700">
          {errore}
        </p>
      )}
      {/* ⚠️ Con la scheda vuota il bottone resta raggiungibile da tastiera e
          dice perché non salva (aria-describedby): spento del tutto, chi usa
          la tastiera lo salterebbe senza sapere cosa manca. */}
      <button
        type="submit"
        disabled={lavoro}
        aria-disabled={vuota || undefined}
        aria-describedby={vuota ? "voce-manca" : undefined}
        className="tocco-bottone mt-3 rounded-lg bg-b58-azione px-5 font-medium text-b58-sul-colore hover:bg-b58-azione-dark disabled:opacity-60 aria-disabled:opacity-60"
      >
        {lavoro ? "La sto mettendo…" : "Mettila fra quelle da collocare"}
      </button>
    </form>
  );
}

export default function DaCollocare() {
  const [aperte, setAperte] = useState(null);
  const [fatte, setFatte] = useState([]);
  const [elenchi, setElenchi] = useState({ causali: [], conti: [], tag: [], sezioni: [] });
  const [errLettura, setErrLettura] = useState("");
  const [esiti, setEsiti] = useState({});
  const [avviso, setAvviso] = useState("");
  const [scheda, setScheda] = useState(VUOTA);
  const venuto = useDaVoce((c) => setScheda((s) => ({ ...s, ...c })));

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
  // SILENZIO MOTIVATO: è solo l'elenco «di recente»,
  // che resta quello di prima; l'esito vero del gesto si vede già — la riga
  // sparisce dalle aperte, o il motivo compare sotto la riga toccata.
  const collocata = (id, dove, fotoRimasta) => {
    setAperte((a) => (a ?? []).filter((s) => s.id !== id));
    setEsiti((e) => ({ ...e, [id]: { dove, fotoRimasta } }));
    listSpeseCollocate().then(setFatte).catch(() => {});
  };

  // ⚠️ Ricaricare le «aperte» qui NON butta il lavoro delle altre righe:
  //    ogni riga tiene i suoi campi nel proprio stato, legato al suo id, e
  //    un elenco riletto con gli stessi id le lascia com'erano.
  const annullata = async (s) => {
    const esito = await annullaCollocazione(s.id);
    setEsiti((e) => ({ ...e, [s.id]: { tornata: esito?.frase ?? "La spesa è tornata da collocare." } }));
    // ⚠️ Il gesto e' riuscito: se la rilettura fallisce non lo si fa
    //    sembrare fallito — lo si dice, e la pagina si ricarica a mano.
    try {
      const [a, f] = await Promise.all([listSpeseDaCollocare(), listSpeseCollocate()]);
      setAperte(a);
      setFatte(f);
    } catch {
      setAvviso("Fatto, ma non riesco a rileggere l'elenco: ricarica la pagina per vederla fra quelle da collocare.");
    }
  };

  const tolta = (id, esito) => {
    setAperte((a) => (a ?? []).filter((s) => s.id !== id));
    setFatte((f) => f.filter((s) => s.id !== id));
    if (esito?.fotoRimasta) setAvviso(esito.fotoRimasta);
  };

  const togliFoto = async (s) => {
    try {
      await togliFotoSpesa(s.id, s.foto_path);
      setEsiti((e) => ({ ...e, [s.id]: { ...(e[s.id] ?? {}), fotoRimasta: null } }));
      // SILENZIO MOTIVATO: è solo l'elenco «di recente», che resta quello di
      // prima; l'esito del gesto si vede già sotto la riga toccata.
      listSpeseCollocate().then(setFatte).catch(() => {});
    } catch (e) {
      setEsiti((x) => ({ ...x, [s.id]: { ...(x[s.id] ?? {}), fotoRimasta: e.message } }));
    }
  };

  if (errLettura) {
    return (
      <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
        <StriscaDallaVoce venuto={venuto} />
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
      <h1 className="mt-2 mb-4 font-display text-2xl md:text-3xl text-b58-charcoal">
        Da collocare
        <Didascalia>
          Le spese dette a MEMO o fotografate. Non sono ancora contabilità: scegli tu dove vanno, una
          volta sola.
        </Didascalia>
      </h1>

      <StriscaDallaVoce venuto={venuto} />
      {/* Si aspetta la rilettura dell'appunto: una scheda vuota che poi si
          riempie da sola sembra un modulo che cambia sotto le dita. */}
      {venuto.idDaChiudere && (venuto.azione || venuto.errore) && (
        <SchedaDallaVoce
          venuto={venuto}
          scheda={scheda}
          setScheda={setScheda}
          // ⚠️ La spesa è scritta: se la rilettura fallisce, sopra a
          //    DatoNonLetto resta la striscia «Fatto», così non sembra fallita.
          onScritta={carica}
        />
      )}

      {avviso && <p className="testo-sala mb-3 text-b58-ambra-dark-testo">{avviso}</p>}

      {aperte.length === 0 ? (
        <p className="rounded-xl bg-b58-parchment p-4 text-b58-charcoal-soft ring-1 ring-b58-charcoal/10">
          Niente da collocare.
        </p>
      ) : (
        <ul className="space-y-3">
          {aperte.map((s) => (
            <Riga
              key={s.id}
              spesa={s}
              elenchi={elenchi}
              onCollocata={collocata}
              onTolta={tolta}
              tornata={esiti[s.id]?.tornata}
            />
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
                  <p className="testo-sala text-b58-ambra-dark-testo">{esiti[s.id].fotoRimasta}</p>
                )}
                <div className="flex flex-wrap items-start gap-2">
                  {s.foto_path && s.collocata_in !== "archivio" && (
                    <button
                      type="button"
                      onClick={() => togliFoto(s)}
                      className="tocco-bottone testo-sala mt-1 rounded-md border border-b58-charcoal/20 px-3 text-b58-charcoal"
                    >
                      Togli la foto
                    </button>
                  )}
                  {/* 🔴 LA VIA DI RITORNO (20261011000003): senza, una spesa
                      messa nel posto sbagliato non si correggeva più. */}
                  <GestoConConferma
                    etichetta={s.stato === "ignorata" ? "Rimettila da collocare" : "Annulla la collocazione"}
                    domanda={cosaToglie(s)}
                    conferma={s.stato === "ignorata" ? "Sì, rimettila" : "Sì, annulla"}
                    onFai={() => annullata(s)}
                  />
                  {s.stato === "ignorata" && (
                    <GestoConConferma
                      etichetta="Togli del tutto"
                      domanda="La tolgo del tutto. Era ignorata, quindi nessun conto cambia."
                      conferma="Sì, toglila"
                      onFai={async () => tolta(s.id, await eliminaSpesa(s.id))}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
