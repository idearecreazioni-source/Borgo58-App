import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { annullaLottoImport, sezioniArchivio } from "../../lib/api/documents";
import {
  apriLottoImport,
  impronteInArchivio,
  importaDocumento,
  linkElencoDrive,
  scriviElencoDrive,
} from "../../lib/api/importDrive";
import {
  abbinaFile,
  improntaFile,
  leggiTestoFile,
  leggiMappa,
  problemiRiga,
  rigaAnteprima,
  rigaPerElencoDrive,
  righeElenco,
  segnaDoppioni,
} from "../../lib/calcoli/importDrive";
import { formatDate } from "../../lib/constants";
import Didascalia from "../../components/Didascalia";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

// «Importa dal Drive» — porta nell'Archivio i file che Alessio ha scelto nel Drive (22/11/2026, pezzo C2).
//
// 🔴 IL CSV È LA MAPPA. Prima si sceglie il file della mappa, poi i file. Un file passa solo se la mappa lo vuole
//    («sì»); gli altri si RIFIUTANO e la pagina dice perché. Niente si importa in silenzio, niente si scarta in silenzio.
// 🔴 NESSUN FILE VA A UN MODELLO: si salvano la scheda e il file, e basta. Il contenuto si legge dopo, solo se Alessio lo
//    chiede (e il segno «non far leggere all'AI» di ogni riga parte SPENTO: decisione sua del 22/11, ma resta lì).
// ⚠️ Il file della mappa e i file si leggono nel browser: la mappa non viene caricata da nessuna parte.
// ⚠️ Importare = un LOTTO. Si può annullare intero, subito, da questa pagina.

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";
const campo =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-2 py-1.5 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const bottone =
  "tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2";
const bottonePieno =
  "tocco-bottone rounded-lg bg-b58-azione hover:bg-b58-azione-dark disabled:opacity-40 transition-colors text-b58-sul-colore testo-sala-grande font-medium px-5";

export default function ImportaDalDrive() {
  const [sezioni, setSezioni] = useState([]);
  const [erroreSezioni, setErroreSezioni] = useState("");
  const [mappa, setMappa] = useState(null); // { nome, righe }
  const [erroreMappa, setErroreMappa] = useState("");
  const [file, setFile] = useState([]); // tutti i file scelti (senza doppie scelte)
  const [scelte, setScelte] = useState({}); // chiave file → indice della riga scelta a mano
  const [righe, setRighe] = useState([]); // anteprima: i file ammessi dalla mappa
  const [calcolo, setCalcolo] = useState(false);
  const [erroreImpronte, setErroreImpronte] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState(null); // { lottoId, entrati: [], falliti: [], annullato }
  const [elenco, setElenco] = useState(null); // { nuove, presenti, senzaLink }
  const [elencoScritto, setElencoScritto] = useState(null);
  const giro = useRef(0);

  useEffect(() => {
    sezioniArchivio()
      .then(setSezioni)
      .catch((e) => setErroreSezioni(e.message));
  }, []);

  const chiaveFile = (f) => `${f.name}#${f.size}#${f.lastModified ?? 0}`;

  // L'abbinamento dei file alla mappa: si rifà a ogni scelta (di file, di riga a mano), mai a metà.
  const abbinati = useMemo(() => {
    if (!mappa) return [];
    return file.map((f) => {
      const k = chiaveFile(f);
      const base = abbinaFile(f, mappa.righe);
      if (base.esito === "da_scegliere" && scelte[k] !== undefined) {
        const scelta = base.candidate[scelte[k]];
        return { file: f, chiave: k, ...abbinaFile(f, [scelta]), candidate: base.candidate };
      }
      return { file: f, chiave: k, ...base };
    });
  }, [file, mappa, scelte]);

  const rifiutati = abbinati.filter((a) => a.esito === "rifiutato");
  const daScegliere = abbinati.filter((a) => a.esito === "da_scegliere");
  const ammessi = abbinati.filter((a) => a.esito === "ok");

  // L'anteprima segue gli ammessi: una riga nuova nasce con i valori della mappa, una già presente conserva le
  // correzioni di Alessio. Le impronte si calcolano nel browser, una volta per file.
  useEffect(() => {
    const questo = ++giro.current;
    const nuove = ammessi.filter((a) => !righe.some((r) => r.chiave === a.chiave));
    const rimaste = righe.filter((r) => ammessi.some((a) => a.chiave === r.chiave));
    if (nuove.length === 0) {
      if (rimaste.length !== righe.length) setRighe(rimaste);
      return;
    }
    setCalcolo(true);
    setErroreImpronte("");
    (async () => {
      const calcolate = [];
      for (const a of nuove) {
        const r = rigaAnteprima({ file: a.file, riga: a.riga, sezioni });
        try {
          r.impronta = await improntaFile(a.file);
        } catch {
          r.impronta = null;
        }
        calcolate.push({ ...r, chiave: a.chiave });
      }
      let tutte = [...rimaste, ...calcolate];
      let gia = new Map();
      try {
        gia = await impronteInArchivio(tutte.map((r) => r.impronta));
      } catch (e) {
        if (questo === giro.current) {
          setErroreImpronte(
            `Non sono riuscito a controllare i doppioni già in Archivio (${e.message}). Controllo solo fra i file scelti ora.`
          );
        }
      }
      if (questo !== giro.current) return;
      tutte = segnaDoppioni(tutte, gia).map((r) => {
        const nuova = calcolate.some((c) => c.chiave === r.chiave);
        // Un doppione parte NON selezionato: per importarlo serve una spunta consapevole.
        return nuova && r.doppione ? { ...r, selezionato: false } : r;
      });
      setRighe(tutte);
      setCalcolo(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abbinati, sezioni]);

  const scegliMappa = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErroreMappa("");
    setElenco(null);
    setElencoScritto(null);
    try {
      const esitoLettura = leggiMappa(await leggiTestoFile(f));
      if (!esitoLettura.ok) {
        setMappa(null);
        setErroreMappa(esitoLettura.errore);
        return;
      }
      setMappa({ nome: f.name, righe: esitoLettura.righe });
      setFile([]);
      setScelte({});
      setRighe([]);
      setEsito(null);
    } catch (err) {
      setMappa(null);
      setErroreMappa(`Non sono riuscito a leggere il file della mappa: ${err.message}`);
    }
  };

  const scegliFile = (e) => {
    const nuovi = [...(e.target.files ?? [])];
    e.target.value = "";
    if (nuovi.length === 0) return;
    setEsito(null);
    setFile((vecchi) => {
      const viste = new Set(vecchi.map(chiaveFile));
      return [...vecchi, ...nuovi.filter((f) => !viste.has(chiaveFile(f)))];
    });
  };

  const cambia = (chiave, patch) => setRighe((rs) => rs.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)));

  const pronte = righe.map((r) => ({ r, problemi: problemiRiga(r, sezioni) }));
  const daImportare = pronte.filter(({ r, problemi }) => r.selezionato && problemi.length === 0);

  const importa = async () => {
    if (daImportare.length === 0 || inCorso) return;
    setInCorso(true);
    setErrore("");
    const entrati = [];
    const falliti = [];
    let lottoId = null;
    try {
      lottoId = await apriLottoImport(`Dal Drive, ${daImportare.length} file`);
    } catch (e) {
      setErrore(`Non sono riuscito ad aprire il carico, quindi non ho importato niente: ${e.message}`);
      setInCorso(false);
      return;
    }
    for (const { r } of daImportare) {
      try {
        const id = await importaDocumento({
          file: r.file,
          titolo: r.titolo.trim(),
          sezione: r.sezione,
          data: r.data,
          sensibile: r.sensibile,
          noAi: r.noAi,
          impronta: r.impronta,
          lottoId,
        });
        entrati.push({ chiave: r.chiave, nome: r.nome, id });
      } catch (e) {
        falliti.push({ chiave: r.chiave, nome: r.nome, motivo: e.message });
      }
    }
    setEsito({ lottoId, entrati, falliti, annullato: null });
    // Quelli entrati escono dall'anteprima; quelli falliti restano, per riprovare.
    const entratiChiavi = new Set(entrati.map((x) => x.chiave));
    setRighe((rs) => rs.filter((r) => !entratiChiavi.has(r.chiave)));
    setFile((fs) => fs.filter((f) => !entratiChiavi.has(chiaveFile(f))));
    setInCorso(false);
  };

  const annulla = async () => {
    setErrore("");
    try {
      const quanti = await annullaLottoImport(esito.lottoId);
      setEsito((e) => ({ ...e, annullato: typeof quanti === "number" ? quanti : e.entrati.length }));
    } catch (e) {
      setErrore(e.message);
    }
  };

  // L'elenco del Drive: le righe «solo elenco» della mappa.
  const controllaElenco = async () => {
    setErrore("");
    setElencoScritto(null);
    try {
      setElenco(righeElenco(mappa.righe, await linkElencoDrive()));
    } catch (e) {
      setElenco(null);
      setErrore(`Non sono riuscito a leggere l'elenco che c'è già: ${e.message}`);
    }
  };

  const caricaElenco = async () => {
    setErrore("");
    setInCorso(true);
    try {
      const scritte = await scriviElencoDrive(elenco.nuove.map(rigaPerElencoDrive));
      setElencoScritto(scritte);
      setElenco(null);
    } catch (e) {
      setErrore(`L'elenco non si è scritto (${e.message}). Quello che c'era non è cambiato, puoi riprovare.`);
    } finally {
      setInCorso(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="mb-6">
        <Link to="/documenti" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-charcoal">
          ← Archivio Documenti
        </Link>
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal mt-2">
          Importa dal Drive
          <Didascalia>
            Prima scegli il file della mappa (l&apos;elenco in cui hai segnato «sì» o «solo elenco»), poi i file. Entrano solo
            quelli che la mappa vuole; gli altri te li segno come rifiutati, con il motivo. Nessun file passa da un modello:
            vengono solo archiviati.
          </Didascalia>
        </h1>
      </div>

      {erroreSezioni && (
        <p className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          Non sono riuscito a leggere le sezioni dell&apos;Archivio ({erroreSezioni}): per ora non posso importare.
        </p>
      )}
      {errore && (
        <p role="alert" className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      {/* 1. La mappa */}
      <div className={sezione}>
        <h2 className="font-display text-lg text-b58-charcoal mb-2">1. La mappa (il file CSV)</h2>
        <label className={`${bottone} inline-block cursor-pointer`}>
          {mappa ? "Scegli un'altra mappa" : "Scegli la mappa"}
          <input type="file" accept=".csv,text/csv" onChange={scegliMappa} className="sr-only" aria-label="File della mappa" />
        </label>
        {erroreMappa && <p className="testo-sala-grande text-b58-terracotta-dark-testo mt-3">{erroreMappa}</p>}
        {mappa && (
          <p className="testo-sala-grande text-b58-charcoal-soft mt-3">
            Mappa «{mappa.nome}»: <strong>{mappa.righe.filter((r) => r.entra).length}</strong> file da importare,{" "}
            <strong>{mappa.righe.filter((r) => !r.entra).length}</strong> solo in elenco.
          </p>
        )}
      </div>

      {/* 2. I file */}
      <div className={sezione}>
        <h2 className="font-display text-lg text-b58-charcoal mb-2">2. I file</h2>
        <div className="flex flex-wrap gap-2">
          <label className={`${bottone} inline-block ${mappa ? "cursor-pointer" : "opacity-40"}`}>
            Scegli i file
            <input type="file" multiple disabled={!mappa || sezioni.length === 0} onChange={scegliFile} className="sr-only" aria-label="File da importare" />
          </label>
          <label className={`${bottone} inline-block ${mappa ? "cursor-pointer" : "opacity-40"}`}>
            Scegli una cartella
            <input
              type="file"
              multiple
              disabled={!mappa || sezioni.length === 0}
              onChange={scegliFile}
              className="sr-only"
              aria-label="Cartella da importare"
              // eslint-disable-next-line react/no-unknown-property
              webkitdirectory=""
            />
          </label>
        </div>
        {!mappa && <p className="testo-sala text-b58-charcoal-soft mt-3">Prima la mappa: senza, non so quali file vanno importati.</p>}
        {calcolo && <p className="testo-sala text-b58-charcoal-soft mt-3">Controllo i file e cerco i doppioni…</p>}
        {erroreImpronte && <p className="testo-sala text-b58-terracotta-dark-testo mt-3">{erroreImpronte}</p>}
      </div>

      {rifiutati.length > 0 && (
        <div className={sezione} data-testid="rifiutati">
          <h2 className="font-display text-lg text-b58-charcoal mb-2">Rifiutati ({rifiutati.length})</h2>
          <p className="testo-sala text-b58-charcoal-soft mb-2">Questi non li ho toccati e non li importo.</p>
          <ul className="space-y-1">
            {rifiutati.map((a) => (
              <li key={a.chiave} className="testo-sala-grande text-b58-charcoal">
                <strong>{a.file.name}</strong> — {a.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {daScegliere.length > 0 && (
        <div className={sezione} data-testid="da-scegliere">
          <h2 className="font-display text-lg text-b58-charcoal mb-2">Da scegliere ({daScegliere.length})</h2>
          <p className="testo-sala text-b58-charcoal-soft mb-2">
            La mappa ha più righe con lo stesso nome: dimmi quale è, altrimenti non lo importo.
          </p>
          <ul className="space-y-2">
            {daScegliere.map((a) => (
              <li key={a.chiave} className="testo-sala-grande text-b58-charcoal flex flex-wrap items-center gap-2">
                <strong>{a.file.name}</strong>
                <select
                  aria-label={`Quale riga della mappa è ${a.file.name}`}
                  value={scelte[a.chiave] ?? ""}
                  onChange={(e) =>
                    setScelte((s) => {
                      const prossime = { ...s };
                      if (e.target.value === "") delete prossime[a.chiave];
                      else prossime[a.chiave] = Number(e.target.value);
                      return prossime;
                    })
                  }
                  className={`${campo} max-w-md`}
                >
                  <option value="">Scegli la riga…</option>
                  {a.candidate.map((c, i) => (
                    <option key={c.riga} value={i}>
                      {c.entra ? "sì" : "solo elenco"} · {c.cartella || "senza cartella"} · riga {c.riga}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. L'anteprima */}
      {righe.length > 0 && (
        <div className={sezione} data-testid="anteprima">
          <h2 className="font-display text-lg text-b58-charcoal mb-2">3. Controlla prima di importare</h2>
          <p className="testo-sala text-b58-charcoal-soft mb-3">
            Una riga con un problema non si importa finché non lo sistemi. «Non far leggere all&apos;AI» parte spento per
            tutti: lo accendi tu, riga per riga.
          </p>
          {/* Una scheda per file, non una tabella: sul telefono una tabella a sei colonne obbliga a scorrere di lato. */}
          <ul className="space-y-3">
            {pronte.map(({ r, problemi }) => (
              <li key={r.chiave} className="rounded-lg bg-b58-campo border border-b58-charcoal/10 p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    aria-label={`Importa ${r.nome}`}
                    checked={r.selezionato && problemi.length === 0}
                    disabled={problemi.length > 0}
                    onChange={(e) => cambia(r.chiave, { selezionato: e.target.checked })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="testo-sala text-b58-charcoal-soft break-words">
                      {r.nome} · {r.mb} MB
                    </div>
                    <input
                      aria-label={`Titolo di ${r.nome}`}
                      value={r.titolo}
                      onChange={(e) => cambia(r.chiave, { titolo: e.target.value })}
                      className={`${campo} mt-1`}
                    />
                    {r.doppione && <div className="testo-sala text-b58-terracotta-dark-testo mt-1">⚠ Doppione: {r.doppione}</div>}
                    {problemi.length > 0 && (
                      <div className="testo-sala text-b58-terracotta-dark-testo mt-1">Da sistemare: {problemi.join("; ")}.</div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 testo-sala">
                  <label className="block">
                    <span className="block text-b58-charcoal-soft mb-1">Sezione</span>
                    <select
                      aria-label={`Sezione di ${r.nome}`}
                      value={r.sezione}
                      onChange={(e) => cambia(r.chiave, { sezione: e.target.value })}
                      className={campo}
                    >
                      <option value="">Scegli…</option>
                      {sezioni.map((s) => (
                        <option key={s.codice} value={s.codice}>
                          {s.etichetta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <label className="block">
                      <span className="block text-b58-charcoal-soft mb-1">Data del documento</span>
                      <input
                        type="date"
                        aria-label={`Data di ${r.nome}`}
                        value={r.data}
                        onChange={(e) => cambia(r.chiave, { data: e.target.value, dataDaVerificare: false })}
                        className={`${campo} campo-data`}
                      />
                    </label>
                    {r.dataDaVerificare && r.data && (
                      <div className="text-b58-terracotta-dark-testo mt-1">
                        Da verificare: {r.dataOrigine === "modifica" ? "è l'ultima modifica del file" : "data non sicura"} ({formatDate(r.data)}).
                      </div>
                    )}
                  </div>
                  <div className="text-b58-charcoal">
                    <span className="block text-b58-charcoal-soft mb-1">Riservato</span>
                    {r.sensibile ?? "—"}
                  </div>
                  <label className="flex items-center gap-2 text-b58-charcoal cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label={`Non far leggere all'AI ${r.nome}`}
                      checked={r.noAi}
                      onChange={(e) => cambia(r.chiave, { noAi: e.target.checked })}
                    />
                    Non far leggere all&apos;AI
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button onClick={importa} disabled={daImportare.length === 0 || inCorso} className={bottonePieno}>
              {inCorso ? "Importo…" : `Importa ${daImportare.length} documenti`}
            </button>
            {righe.length - daImportare.length > 0 && (
              <span className="testo-sala text-b58-charcoal-soft">
                {righe.length - daImportare.length} restano fuori (non spuntati o da sistemare).
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. L'esito */}
      {esito && (
        <div className={sezione} data-testid="esito">
          <h2 className="font-display text-lg text-b58-charcoal mb-2">Com&apos;è andata</h2>
          {esito.annullato !== null ? (
            <p className="testo-sala-grande text-b58-charcoal">
              Carico annullato: ho tolto dall&apos;Archivio {esito.annullato} documenti.
            </p>
          ) : (
            <>
              <p className="testo-sala-grande text-b58-charcoal">
                Entrati in Archivio: <strong>{esito.entrati.length}</strong>
                {esito.falliti.length > 0 && (
                  <>
                    {" "}
                    · non entrati: <strong>{esito.falliti.length}</strong>
                  </>
                )}
                .
              </p>
              {esito.falliti.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {esito.falliti.map((f) => (
                    <li key={f.chiave} className="testo-sala-grande text-b58-terracotta-dark-testo">
                      <strong>{f.nome}</strong> non è entrato: {f.motivo}. Resta nell&apos;elenco qui sopra, puoi riprovare.
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <Link to="/documenti" className={`${bottone} inline-block`}>
                  Vai all&apos;Archivio
                </Link>
                {esito.entrati.length > 0 && (
                  <ConfermaDistruttiva
                    etichetta="Annulla questo carico"
                    domanda={`Togliere dall'Archivio i ${esito.entrati.length} documenti di questo carico?`}
                    etichettaConferma="Sì, annulla il carico"
                    onConferma={annulla}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. L'elenco del Drive */}
      {mappa && (
        <div className={sezione} data-testid="elenco-drive">
          <h2 className="font-display text-lg text-b58-charcoal mb-2">L&apos;elenco del Drive</h2>
          <p className="testo-sala text-b58-charcoal-soft mb-3">
            I file segnati «solo elenco» non entrano nell&apos;Archivio: li metto in un elenco con il loro link, così MEMO
            può dirti «non è nel gestionale, è nel Drive» e dartelo. I file importati come documenti non vanno nell&apos;elenco.
          </p>
          {elencoScritto !== null && (
            <p className="testo-sala-grande text-b58-charcoal mb-3">Fatto: {elencoScritto} file aggiunti all&apos;elenco.</p>
          )}
          {!elenco && (
            <button onClick={controllaElenco} className={bottone}>
              Controlla l&apos;elenco
            </button>
          )}
          {elenco && (
            <div>
              <p className="testo-sala-grande text-b58-charcoal">
                Da aggiungere: <strong>{elenco.nuove.length}</strong> · già presenti: <strong>{elenco.presenti.length}</strong>
                {elenco.senzaLink.length > 0 && (
                  <>
                    {" "}
                    · senza un link valido (non li aggiungo): <strong>{elenco.senzaLink.length}</strong>
                  </>
                )}
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={caricaElenco} disabled={elenco.nuove.length === 0 || inCorso} className={bottonePieno}>
                  {inCorso ? "Scrivo…" : `Carica ${elenco.nuove.length} file nell'elenco`}
                </button>
                <button onClick={() => setElenco(null)} className={bottone}>
                  Lascia stare
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
