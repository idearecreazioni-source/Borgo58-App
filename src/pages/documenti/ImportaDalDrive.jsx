import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  CSV_MAX_BYTE,
  LIMITE_FILE_MB,
  abbinaFile,
  chiaveFile,
  controllaFile,
  improntaFile,
  leggiMappa,
  leggiTestoFile,
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
// ⚠️ Importare = un LOTTO («carico»). Si può annullare intero, subito, da questa pagina.
// ⚠️ IL RIEPILOGO DI UN CARICO NON SPARISCE DA SOLO (revisione del 22/11): vive in uno stato a parte, e cambiare mappa o
//    file non lo tocca. Se sparisse, «Annulla questo carico» sparirebbe con lui e un carico sbagliato non si
//    potrebbe più togliere da qui. Si chiude solo con un clic esplicito.
// ⚠️ UN GESTO ALLA VOLTA: mentre si importa o si annulla, tutti i campi sono bloccati (fieldset) e un secondo clic non
//    parte (`inVolo`, un riferimento e non uno stato: lo stato non basta, perché due clic ravvicinati lo leggono
//    ancora «libero» prima che la schermata si ridisegni).

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";
const campo =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-2 py-1.5 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const bottone =
  "tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2";
const bottonePieno =
  "tocco-bottone rounded-lg bg-b58-azione hover:bg-b58-azione-dark disabled:opacity-40 transition-colors text-b58-sul-colore testo-sala-grande font-medium px-5";
// Il file nascosto dentro la sua etichetta: l'anello di focus lo disegna l'etichetta (focus-within), perché l'input è sr-only.
const etichettaFile =
  "inline-block tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal testo-sala-grande font-medium px-4 py-2 focus-within:ring-2 focus-within:ring-b58-terracotta";
const errorePieno = "testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4";

export default function ImportaDalDrive() {
  const base = useId();
  const [sezioni, setSezioni] = useState([]);
  const [erroreSezioni, setErroreSezioni] = useState("");
  const [mappa, setMappa] = useState(null); // { nome, righe }
  const [erroreMappa, setErroreMappa] = useState("");
  const [file, setFile] = useState([]); // tutti i file scelti (senza doppie scelte)
  const [avvisoFile, setAvvisoFile] = useState("");
  const [scelte, setScelte] = useState({}); // chiave file → indice della riga scelta a mano
  const [righe, setRighe] = useState([]); // anteprima: i file ammessi dalla mappa
  const [calcolo, setCalcolo] = useState(false);
  const [progresso, setProgresso] = useState(null); // { fase, fatti, totale, nome }
  const [erroreImpronte, setErroreImpronte] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [carichi, setCarichi] = useState([]); // i riepiloghi, dal più recente: { lottoId, entrati, falliti, annullato, errore }
  const [elenco, setElenco] = useState(null); // { nuove, presenti, senzaLink }
  const [elencoScritto, setElencoScritto] = useState(null);
  const giro = useRef(0);
  const vivo = useRef(true);
  const inVolo = useRef(false);
  const righeRef = useRef([]);
  const giaRef = useRef(new Map()); // le impronte già in Archivio, dall'ultimo controllo riuscito
  const titoloCarico = useRef(null);
  righeRef.current = righe;

  useEffect(() => {
    vivo.current = true;
    return () => {
      // Una schermata chiusa non riceve più risultati: i calcoli in corso si fermano al prossimo passo.
      vivo.current = false;
      giro.current += 1;
    };
  }, []);

  useEffect(() => {
    sezioniArchivio()
      .then((s) => vivo.current && setSezioni(s))
      .catch((e) => vivo.current && setErroreSezioni(e.message));
  }, []);

  // Mentre si importa, chiudere la scheda o ricaricare lascerebbe un carico a metà: il browser lo chiede.
  useEffect(() => {
    if (!inCorso) return undefined;
    const avvisa = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [inCorso]);

  // L'abbinamento dei file alla mappa: si rifà a ogni scelta (di file, di riga a mano), mai a metà.
  const abbinati = useMemo(() => {
    if (!mappa) return [];
    return file.map((f) => {
      const k = chiaveFile(f);
      const esame = controllaFile(f);
      const base0 = abbinaFile(f, mappa.righe);
      let esito = base0;
      let candidate;
      if (base0.esito === "da_scegliere") {
        candidate = base0.candidate;
        if (scelte[k] !== undefined) esito = abbinaFile(f, [candidate[scelte[k]]]);
      }
      // Un file troppo grosso si rifiuta PRIMA di provare a caricarlo, con il motivo: non dopo un errore del deposito.
      if (esito.esito === "ok" && esame.rifiuto) esito = { esito: "rifiutato", motivo: esame.rifiuto, riga: esito.riga };
      return { file: f, chiave: k, ...esito, candidate, avviso: esame.avviso };
    });
  }, [file, mappa, scelte]);

  const rifiutati = abbinati.filter((a) => a.esito === "rifiutato");
  const daScegliere = abbinati.filter((a) => a.esito === "da_scegliere");
  const ammessi = abbinati.filter((a) => a.esito === "ok");

  // L'anteprima segue gli ammessi: una riga nuova nasce con i valori della mappa, una già presente conserva le
  // correzioni di Alessio. Le impronte si calcolano nel browser, una volta per file.
  // ⚠️ Le dipendenze sono SOLO [abbinati, sezioni] di proposito: questo effetto SCRIVE `righe`, e metterla fra le
  //    dipendenze lo farebbe ripartire a ogni correzione di Alessio. `righe` si legge dal riferimento `righeRef`.
  useEffect(() => {
    const questo = ++giro.current;
    const attuali = righeRef.current;
    const nuove = ammessi.filter((a) => !attuali.some((r) => r.chiave === a.chiave));
    const restano = (rs) => rs.filter((r) => ammessi.some((a) => a.chiave === r.chiave));
    if (nuove.length === 0) {
      // Niente da calcolare: si toglie quello che non c'è più, e i segni «doppione» si RIFANNO (un file tolto non può
      // più far risultare doppio quello che gli somigliava).
      setCalcolo(false);
      setProgresso(null);
      setRighe((rs) => segnaDoppioni(restano(rs), giaRef.current));
      return undefined;
    }
    setCalcolo(true);
    setErroreImpronte("");
    (async () => {
      const calcolate = [];
      for (let i = 0; i < nuove.length; i++) {
        if (!vivo.current || questo !== giro.current) return;
        const a = nuove[i];
        setProgresso({ fase: "controllo", fatti: i + 1, totale: nuove.length, nome: a.file.name });
        const r = { ...rigaAnteprima({ file: a.file, riga: a.riga, sezioni }), avviso: a.avviso };
        try {
          r.impronta = await improntaFile(a.file);
        } catch {
          r.impronta = null;
          r.improntaFallita = true;
        }
        calcolate.push(r);
      }
      let gia = giaRef.current;
      try {
        gia = await impronteInArchivio([...attuali.map((r) => r.impronta), ...calcolate.map((r) => r.impronta)]);
        giaRef.current = gia;
      } catch (e) {
        if (vivo.current && questo === giro.current) {
          setErroreImpronte(
            `Non sono riuscito a controllare i doppioni già in Archivio (${e.message}). Controllo solo fra i file scelti ora.`
          );
        }
      }
      if (!vivo.current || questo !== giro.current) return;
      // Si parte dallo stato di ADESSO (`prev`), non da quello di quando il calcolo è iniziato: le correzioni fatte
      // nel frattempo da Alessio restano.
      setRighe((prev) => {
        const presenti = new Set(prev.map((r) => r.chiave));
        const nuoveRighe = calcolate.filter((c) => !presenti.has(c.chiave));
        const chiaviNuove = new Set(nuoveRighe.map((r) => r.chiave));
        const marcate = segnaDoppioni([...restano(prev), ...nuoveRighe], gia);
        // Un doppione, o un file insolito, parte NON selezionato: per importarlo serve una spunta consapevole.
        return marcate.map((r) => (chiaviNuove.has(r.chiave) && (r.doppione || r.avviso) ? { ...r, selezionato: false } : r));
      });
      setCalcolo(false);
      setProgresso(null);
    })();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abbinati, sezioni]);

  const scegliMappa = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErroreMappa("");
    const tengo = mappa ? ` Tengo la mappa di prima («${mappa.nome}»).` : "";
    if (f.size > CSV_MAX_BYTE) {
      setErroreMappa(`Questo file è troppo grande per essere la mappa (oltre ${CSV_MAX_BYTE / (1024 * 1024)} MB).${tengo}`);
      return;
    }
    try {
      const esitoLettura = leggiMappa(await leggiTestoFile(f));
      if (!esitoLettura.ok) {
        // Una mappa nuova che non si legge NON butta via quella buona.
        setErroreMappa(`${esitoLettura.errore}${tengo}`);
        return;
      }
      setMappa({ nome: f.name, righe: esitoLettura.righe });
      setFile([]);
      setAvvisoFile("");
      setScelte({});
      setRighe([]);
      setElenco(null);
      setElencoScritto(null);
      giaRef.current = new Map();
    } catch (err) {
      setErroreMappa(`Non sono riuscito a leggere il file della mappa: ${err.message}.${tengo}`);
    }
  };

  const scegliFile = (e) => {
    const nuovi = [...(e.target.files ?? [])];
    e.target.value = "";
    if (nuovi.length === 0) return;
    const viste = new Set(file.map(chiaveFile));
    const unici = [];
    let ignorati = 0;
    for (const f of nuovi) {
      const k = chiaveFile(f);
      if (viste.has(k)) ignorati += 1;
      else {
        viste.add(k);
        unici.push(f);
      }
    }
    // Mai scartare in silenzio: se qualche file era già scelto, lo si dice.
    setAvvisoFile(ignorati > 0 ? `${ignorati} ${ignorati === 1 ? "file era già stato scelto e l'ho ignorato" : "file erano già stati scelti e li ho ignorati"}.` : "");
    if (unici.length > 0) setFile((v) => [...v, ...unici]);
  };

  const cambia = (chiave, patch) => setRighe((rs) => rs.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)));

  const pronte = righe.map((r) => ({ r, problemi: problemiRiga(r, sezioni) }));
  const daImportare = pronte.filter(({ r, problemi }) => r.selezionato && problemi.length === 0);

  const importa = async () => {
    if (inVolo.current || daImportare.length === 0) return;
    inVolo.current = true;
    setInCorso(true);
    setErrore("");
    try {
      let lottoId;
      try {
        lottoId = await apriLottoImport(`Dal Drive, ${daImportare.length} file`);
      } catch (e) {
        setErrore(`Non sono riuscito ad aprire il carico, quindi non ho importato niente: ${e.message}`);
        return;
      }
      const entrati = [];
      const falliti = [];
      for (let i = 0; i < daImportare.length; i++) {
        const { r } = daImportare[i];
        setProgresso({ fase: "importo", fatti: i + 1, totale: daImportare.length, nome: r.nome });
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
          entrati.push({ chiave: r.chiave, nome: r.nome, id, impronta: r.impronta, titolo: r.titolo.trim() });
        } catch (e) {
          falliti.push({ chiave: r.chiave, nome: r.nome, motivo: e.message });
        }
      }
      // Quello che è appena entrato è ORA in Archivio: un file uguale ancora in anteprima è un doppione vero, e deve restare segnato.
      const giaOra = new Map(giaRef.current);
      for (const x of entrati) if (x.impronta) giaOra.set(x.impronta, x.titolo);
      giaRef.current = giaOra;
      setCarichi((c) => [{ lottoId, entrati, falliti, annullato: null, errore: null }, ...c]);
      // Quelli entrati escono dall'anteprima; quelli falliti restano, per riprovare.
      const entratiChiavi = new Set(entrati.map((x) => x.chiave));
      setRighe((rs) => rs.filter((r) => !entratiChiavi.has(r.chiave)));
      setFile((fs) => fs.filter((f) => !entratiChiavi.has(chiaveFile(f))));
    } finally {
      inVolo.current = false;
      setProgresso(null);
      setInCorso(false);
    }
  };

  const annulla = async (lottoId) => {
    if (inVolo.current) return;
    inVolo.current = true;
    setInCorso(true);
    const tocca = (patch) => setCarichi((cs) => cs.map((c) => (c.lottoId === lottoId ? { ...c, ...patch } : c)));
    tocca({ errore: null });
    try {
      const quanti = await annullaLottoImport(lottoId);
      setCarichi((cs) =>
        cs.map((c) => (c.lottoId === lottoId ? { ...c, annullato: typeof quanti === "number" ? quanti : c.entrati.length } : c))
      );
    } catch (e) {
      // L'errore sta nel riquadro del carico, dove si è premuto il bottone.
      tocca({ errore: e.message });
    } finally {
      inVolo.current = false;
      setInCorso(false);
    }
  };

  // Dopo un'importazione il focus va al titolo del riepilogo: chi usa la tastiera o la voce sa che è cambiato qualcosa.
  const ultimo = carichi[0]?.lottoId;
  useEffect(() => {
    if (ultimo) titoloCarico.current?.focus();
  }, [ultimo]);

  // L'elenco del Drive: le righe «solo elenco» della mappa.
  const controllaElenco = async () => {
    if (inVolo.current) return;
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
    if (inVolo.current) return;
    inVolo.current = true;
    setInCorso(true);
    setErrore("");
    try {
      const scritte = await scriviElencoDrive(elenco.nuove.map(rigaPerElencoDrive));
      setElencoScritto(scritte);
      setElenco(null);
    } catch (e) {
      setErrore(`L'elenco non si è scritto (${e.message}). Quello che c'era non è cambiato, puoi riprovare.`);
    } finally {
      inVolo.current = false;
      setInCorso(false);
    }
  };

  const sezioniPronte = sezioni.length > 0;

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
        <p role="alert" className={errorePieno}>
          Non sono riuscito a leggere le sezioni dell&apos;Archivio ({erroreSezioni}): per ora non posso importare.
        </p>
      )}
      {errore && (
        <p role="alert" className={errorePieno}>
          {errore}
        </p>
      )}

      {/* I riepiloghi dei carichi stanno FUORI dal blocco dei campi: «Annulla questo carico» deve restare raggiungibile. */}
      {carichi.map((c, i) => (
        <div className={sezione} data-testid="esito" key={c.lottoId}>
          <h2
            ref={i === 0 ? titoloCarico : undefined}
            tabIndex={-1}
            className="font-display text-lg text-b58-charcoal mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-b58-terracotta rounded"
          >
            {i === 0 ? "Ultimo carico — com'è andata" : "Un carico precedente — com'è andata"}
          </h2>
          <div role="status" aria-live="polite">
            {c.annullato !== null ? (
              <p className="testo-sala-grande text-b58-charcoal">
                Carico annullato: ho tolto dall&apos;Archivio {c.annullato} documenti.
              </p>
            ) : (
              <>
                <p className="testo-sala-grande text-b58-charcoal">
                  Entrati in Archivio: <strong>{c.entrati.length}</strong>
                  {c.falliti.length > 0 && (
                    <>
                      {" "}
                      · non entrati: <strong>{c.falliti.length}</strong>
                    </>
                  )}
                  .
                </p>
                {c.entrati.length === 0 && (
                  <p className="testo-sala text-b58-charcoal-soft mt-1">
                    Nessun documento è entrato: il carico è rimasto vuoto. Un carico non si cancella, ma vuoto non fa danni e non c&apos;è
                    niente da annullare.
                  </p>
                )}
                {c.falliti.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.falliti.map((f) => (
                      <li key={f.chiave} className="testo-sala-grande text-b58-terracotta-dark-testo break-words">
                        <strong>{f.nome}</strong> non è entrato: {f.motivo}. Resta nell&apos;elenco qui sotto, puoi riprovare.
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          {c.errore && (
            <p role="alert" className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-3">
              Non ho potuto annullare il carico: {c.errore}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <Link to="/documenti" className={`${bottone} inline-block`}>
              Vai all&apos;Archivio
            </Link>
            {c.annullato === null && c.entrati.length > 0 && (
              <ConfermaDistruttiva
                etichetta="Annulla questo carico"
                domanda={`Togliere dall'Archivio i ${c.entrati.length} documenti di questo carico?`}
                etichettaConferma="Sì, annulla il carico"
                disabilitato={inCorso}
                onConferma={() => annulla(c.lottoId)}
              />
            )}
            <button type="button" onClick={() => setCarichi((cs) => cs.filter((x) => x.lottoId !== c.lottoId))} className={bottone}>
              Chiudi questo riepilogo
            </button>
          </div>
        </div>
      ))}

      {/* Mentre si importa tutto il resto è BLOCCATO: niente mappa nuova, niente file nuovi, niente correzioni a metà. */}
      <fieldset disabled={inCorso} className="border-0 p-0 m-0 min-w-0">
        <legend className="sr-only">Importazione dal Drive</legend>

        {/* 1. La mappa */}
        <div className={sezione}>
          <h2 className="font-display text-lg text-b58-charcoal mb-2">1. La mappa (il file CSV)</h2>
          <label className={`${etichettaFile} cursor-pointer`}>
            {mappa ? "Scegli un'altra mappa" : "Scegli la mappa"}
            <input type="file" accept=".csv,text/csv" onChange={scegliMappa} className="sr-only" />
          </label>
          {erroreMappa && (
            <p role="alert" className="testo-sala-grande text-b58-terracotta-dark-testo mt-3">
              {erroreMappa}
            </p>
          )}
          {mappa && (
            <p role="status" className="testo-sala-grande text-b58-charcoal-soft mt-3">
              Mappa «{mappa.nome}»: <strong>{mappa.righe.filter((r) => r.entra).length}</strong> file da importare,{" "}
              <strong>{mappa.righe.filter((r) => !r.entra).length}</strong> solo in elenco.
            </p>
          )}
        </div>

        {/* 2. I file */}
        <div className={sezione}>
          <h2 className="font-display text-lg text-b58-charcoal mb-2">2. I file</h2>
          <div className="flex flex-wrap gap-2">
            <label className={`${etichettaFile} ${mappa && sezioniPronte ? "cursor-pointer" : "opacity-40"}`}>
              Scegli i file
              <input type="file" multiple disabled={!mappa || !sezioniPronte} onChange={scegliFile} className="sr-only" />
            </label>
            {/* Sul telefono e sul tablet la scelta di una cartella intera non c'è (iPhone e iPad non la offrono). */}
            <label className={`${etichettaFile} hidden md:inline-block ${mappa && sezioniPronte ? "cursor-pointer" : "opacity-40"}`}>
              Scegli una cartella
              <input
                type="file"
                multiple
                disabled={!mappa || !sezioniPronte}
                onChange={scegliFile}
                className="sr-only"
                // eslint-disable-next-line react/no-unknown-property
                webkitdirectory=""
              />
            </label>
          </div>
          <p className="md:hidden testo-sala text-b58-charcoal-soft mt-2">
            Da telefono scegli i file uno alla volta: la scelta di una cartella intera funziona solo dal computer.
          </p>
          <p className="testo-sala text-b58-charcoal-soft mt-2">
            Ogni file può pesare al massimo {LIMITE_FILE_MB} MB.
          </p>
          {!mappa && <p className="testo-sala text-b58-charcoal-soft mt-3">Prima la mappa: senza, non so quali file vanno importati.</p>}
          {avvisoFile && (
            <p role="status" className="testo-sala text-b58-charcoal-soft mt-3">
              {avvisoFile}
            </p>
          )}
          <div role="status" aria-live="polite">
            {calcolo && (
              <p className="testo-sala text-b58-charcoal-soft mt-3">
                {progresso?.fase === "controllo"
                  ? `Controllo il file ${progresso.fatti} di ${progresso.totale} (${progresso.nome})…`
                  : "Controllo i file e cerco i doppioni…"}
              </p>
            )}
          </div>
          {erroreImpronte && (
            <p role="alert" className="testo-sala text-b58-terracotta-dark-testo mt-3">
              {erroreImpronte}
            </p>
          )}
        </div>

        {rifiutati.length > 0 && (
          <div className={sezione} data-testid="rifiutati">
            <h2 className="font-display text-lg text-b58-charcoal mb-2">Rifiutati ({rifiutati.length})</h2>
            <p className="testo-sala text-b58-charcoal-soft mb-2">Questi non li ho toccati e non li importo.</p>
            <ul className="space-y-1">
              {rifiutati.map((a) => (
                <li key={a.chiave} className="testo-sala-grande text-b58-charcoal break-words">
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
                  <strong className="break-words">{a.file.name}</strong>
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
              {pronte.map(({ r, problemi }, i) => {
                const idProblemi = `${base}-problemi-${i}`;
                return (
                  <li key={r.chiave} className="rounded-lg bg-b58-campo border border-b58-charcoal/10 p-3">
                    <div className="flex items-start gap-1">
                      {/* L'area di tocco è la ETICHETTA intorno alla casella, non la casella da sola. */}
                      <label className="tocco-campo inline-flex items-center justify-center px-2 -ml-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          aria-label={`Importa ${r.nome}`}
                          aria-describedby={problemi.length > 0 ? idProblemi : undefined}
                          checked={r.selezionato && problemi.length === 0}
                          disabled={problemi.length > 0}
                          onChange={(e) => cambia(r.chiave, { selezionato: e.target.checked })}
                        />
                      </label>
                      <div className="flex-1 min-w-0">
                        <div className="testo-sala text-b58-charcoal-soft break-words">
                          {r.nome} · {r.mb} MB
                        </div>
                        <input
                          aria-label={`Titolo di ${r.nome}`}
                          maxLength={200}
                          value={r.titolo}
                          onChange={(e) => cambia(r.chiave, { titolo: e.target.value })}
                          className={`${campo} mt-1`}
                        />
                        {r.doppione && <div className="testo-sala text-b58-terracotta-dark-testo mt-1">⚠ Doppione: {r.doppione}</div>}
                        {r.avviso && <div className="testo-sala text-b58-terracotta-dark-testo mt-1">⚠ {r.avviso}</div>}
                        {r.improntaFallita && (
                          <div className="testo-sala text-b58-terracotta-dark-testo mt-1">
                            ⚠ Il controllo dei doppioni non è valido per questo file: non ho potuto leggerlo per calcolarne l&apos;impronta.
                          </div>
                        )}
                        {problemi.length > 0 && (
                          <div id={idProblemi} className="testo-sala text-b58-terracotta-dark-testo mt-1">
                            Da sistemare: {problemi.join("; ")}.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 testo-sala">
                      <label className="block">
                        <span className="block text-b58-charcoal-soft mb-1">Sezione</span>
                        <select value={r.sezione} onChange={(e) => cambia(r.chiave, { sezione: e.target.value })} className={campo}>
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
                      <label className="tocco-campo flex items-center gap-2 text-b58-charcoal cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={r.noAi}
                          onChange={(e) => cambia(r.chiave, { noAi: e.target.checked })}
                        />
                        Non far leggere all&apos;AI
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button type="button" onClick={importa} disabled={daImportare.length === 0 || inCorso} className={bottonePieno}>
                {inCorso && progresso?.fase === "importo"
                  ? `Importo ${progresso.fatti} di ${progresso.totale}…`
                  : `Importa ${daImportare.length} documenti`}
              </button>
              {righe.length - daImportare.length > 0 && (
                <span className="testo-sala text-b58-charcoal-soft">
                  {righe.length - daImportare.length} restano fuori (non spuntati o da sistemare).
                </span>
              )}
            </div>
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
            <div role="status" aria-live="polite">
              {elencoScritto !== null && (
                <p className="testo-sala-grande text-b58-charcoal mb-3">Fatto: {elencoScritto} file aggiunti all&apos;elenco.</p>
              )}
            </div>
            {!elenco && (
              <button type="button" onClick={controllaElenco} className={bottone}>
                Controlla l&apos;elenco
              </button>
            )}
            {elenco && (
              <div>
                <p role="status" className="testo-sala-grande text-b58-charcoal">
                  Da aggiungere: <strong>{elenco.nuove.length}</strong> · già presenti: <strong>{elenco.presenti.length}</strong>
                  {elenco.senzaLink.length > 0 && (
                    <>
                      {" "}
                      · senza un link valido (non li aggiungo): <strong>{elenco.senzaLink.length}</strong>
                    </>
                  )}
                </p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button type="button" onClick={caricaElenco} disabled={elenco.nuove.length === 0 || inCorso} className={bottonePieno}>
                    {inCorso ? "Scrivo…" : `Carica ${elenco.nuove.length} file nell'elenco`}
                  </button>
                  <button type="button" onClick={() => setElenco(null)} className={bottone}>
                    Lascia stare
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}
