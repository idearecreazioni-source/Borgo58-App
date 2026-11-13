import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  abbinaMovimentoBanca,
  caricaMovimentiBanca,
  ignoraMovimentoBanca,
  incassaDaSoliBonifici,
  incassaFatturaDaMovimentoBanca,
  listMovimentiBanca,
  pagaFatturaDaMovimentoBanca,
  proposteMovimentoBanca,
  registraMovimentoBanca,
  riapriMovimentoBanca,
} from "../../lib/api/banca";
import { listCausali, listContiBancari } from "../../lib/api/cash";
import { propostaSpesaBanca, speseBancaDaRegistrare } from "../../lib/calcoli/speseBanca";
import { CASH_DOCUMENT_TYPES, formatDate, formatEUR } from "../../lib/constants";
import { leggiFlussoCbi, movimentiDaCaricare } from "../../lib/calcoli/cbi";
import { bancaDelCsv, leggiCsvBper, leggiCsvCredem, sovrapposizioni } from "../../lib/calcoli/csvBanca";
import { eZip, leggiZip } from "../../lib/calcoli/zip";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import AvvisiDellaBanca from "./AvvisiDellaBanca";
import CaricaCsvBanca from "./CaricaCsvBanca";

// L'ESTRATTO CONTO DA FILE (24/10/2026). Alessio scarica dalla banca il
// file CBI (anche dentro lo zip così com'è) e lo carica qui: i movimenti
// entrano da abbinare, e per ognuno il gestionale propone cosa potrebbe
// essere. ⚠️ Niente entra in prima nota senza un suo tocco.
//
// ⚠️ Il file si legge tutto PRIMA di mandare qualcosa: se un conto non
// quadra (saldo iniziale + movimenti ≠ saldo finale) non si carica
// niente, perché un estratto letto a metà sembrerebbe intero.
//
// 🔴 ANCHE IL CSV DI CREDEM (31/10/2026), accanto al CBI. Il CSV non dice
// conto e saldi: li chiede CaricaCsvBanca. E lo stesso movimento, arrivato
// dai due file, avrebbe due impronte diverse: per gli stessi giorni dello
// stesso conto si carica da un formato solo (`sovrapposizioni`).
//
// 🔴 GLI AVVISI DELLA BANCA PER MAIL (12/11/2026, PR B1): si raccolgono e
// basta, in un riquadro piccolo sopra i movimenti. Non diventano movimenti
// finché il lettore non è scritto sulle mail vere.

const STATI = [
  ["da_abbinare", "Da abbinare"],
  ["abbinati", "Abbinati"],
  ["ignorati", "Ignorati"],
];

function statoDi(m) {
  if (m.cash_movement_id) return "abbinati";
  if (m.ignorato_il) return "ignorati";
  return "da_abbinare";
}

const campo =
  "tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 bg-b58-campo testo-sala px-3 py-1.5 text-b58-charcoal disabled:opacity-60";
const bottonePieno =
  "tocco-bottone rounded-lg bg-b58-azione text-b58-sul-colore testo-sala px-3 py-1.5 disabled:opacity-60";

async function leggiFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dentro = eZip(bytes) ? await leggiZip(bytes) : [{ nome: file.name, contenuto: bytes }];
  // Il CBI è testo a 120 colonne in caratteri occidentali: latin1 non
  // perde niente, e non inventa caratteri dove UTF-8 si fermerebbe.
  // ⚠️ Il CSV di Credem invece è UTF-8: letto in latin1 le lettere
  // accentate diventerebbero due caratteri strani. Se però qualcuno l'ha
  // salvato di nuovo (Excel lo rifà in caratteri occidentali), è latin1.
  return dentro.map((d) => {
    const nome = d.nome === file.name ? file.name : `${file.name} → ${d.nome}`;
    const utf8 = comeUtf8(d.contenuto);
    // ⚠️ Anche il CSV di BPER (01/11/2026) passa di qui: Excel lo salva
    //    in UTF-8 o in caratteri occidentali, secondo la voce scelta.
    const bancaUtf8 = utf8 !== null ? bancaDelCsv(utf8) : null;
    if (bancaUtf8) return { nome, testo: utf8, formato: "csv", banca: bancaUtf8 };
    const latin1 = new TextDecoder("latin1").decode(d.contenuto);
    const banca = bancaDelCsv(latin1);
    return { nome, testo: latin1, formato: banca ? "csv" : "cbi", banca };
  });
}

function comeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** L'IBAN senza spazi né minuscole, per confrontarlo. */
const ibanPulito = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function testoSovrapposizione(nome, conto, s) {
  return `${nome}: sul conto «${conto.nome}» fra il ${formatDate(s.dal)} e il ${formatDate(s.al)} ci sono già`
    + ` ${s.quanti} ${s.quanti === 1 ? "movimento caricato" : "movimenti caricati"} dal CSV:`
    + " gli stessi movimenti entrerebbero due volte. Per quei giorni usa un file solo.";
}

export default function MovimentiBanca() {
  const [movimenti, setMovimenti] = useState(null);
  const [errore, setErrore] = useState("");
  const [caricamento, setCaricamento] = useState(null); // { righe: [...], errori: [...] }
  const [stato, setStato] = useState("da_abbinare");
  const [aperto, setAperto] = useState(null);
  const [conti, setConti] = useState(null); // null: non ancora letti (servono solo alla scelta del conto del CSV)
  const [csv, setCsv] = useState(null); // { nome, movimenti }: il CSV letto, in attesa di conto e saldi
  const [inviando, setInviando] = useState(false);

  const [tutteLeCausali, setTutteLeCausali] = useState([]);

  const ricarica = () => listMovimentiBanca().then(setMovimenti);

  useEffect(() => {
    ricarica().catch((e) => setErrore(e.message));
    listContiBancari()
      .then(setConti)
      .catch((e) => setErrore(e.message));
    // Le causali servono a riconoscere le spese della banca (12/11/2026).
    // Se non si leggono, nessuna proposta: le righe restano a mano, e lo si dice.
    listCausali()
      .then(setTutteLeCausali)
      .catch((e) => setErrore(`Non riesco a leggere le causali, quindi non propongo le spese della banca: ${e.message}`));
  }, []);

  const carica = async (files) => {
    setErrore("");
    setCsv(null);
    setCaricamento({ righe: [], errori: [], inCorso: true });
    const righe = [];
    const errori = [];
    try {
      const letti = [];
      for (const f of files) letti.push(...(await leggiFile(f)));

      // Il CSV ha un passo in più (conto e saldi): si carica da solo.
      const csvLetti = letti.filter((l) => l.formato === "csv");
      if (csvLetti.length) {
        if (letti.length > 1) {
          errori.push("Il CSV della banca si carica da solo, un file alla volta: chiede il conto e i saldi.");
        } else {
          const leggi = csvLetti[0].banca === "bper" ? leggiCsvBper : leggiCsvCredem;
          const { movimenti: m, errori: e, daContabilizzare = 0 } = leggi(csvLetti[0].testo);
          if (e.length) errori.push(...e.map((x) => `${csvLetti[0].nome}: ${x}`));
          else setCsv({ nome: csvLetti[0].nome, movimenti: m, daContabilizzare });
        }
        setCaricamento(errori.length ? { righe, errori, inCorso: false } : null);
        return;
      }

      const daMandare = [];
      for (const l of letti) {
        const { conti: c, errori: e } = leggiFlussoCbi(l.testo);
        if (e.length) errori.push(...e.map((x) => `${l.nome}: ${x}`));
        else for (const x of c) daMandare.push({ nome: l.nome, conto: x });
      }
      // I doppioni col CSV: gli stessi giorni dello stesso conto già caricati
      // da lì. ⚠️ Conti e movimenti si rileggono ADESSO, non si usano quelli
      // dell'apertura: possono essere cambiati, o non essere ancora arrivati.
      if (!errori.length && daMandare.length) {
        let ora;
        try {
          ora = await Promise.all([listContiBancari(), listMovimentiBanca()]);
        } catch (e) {
          errori.push(`Non riesco a leggere i conti o i movimenti già caricati (${e.message}), quindi non posso controllare i doppioni col CSV. Riprova.`);
        }
        if (ora) {
          const [contiOra, movimentiOra] = ora;
          for (const { nome, conto } of daMandare) {
            const nostro = contiOra.find((c) => c.iban && ibanPulito(c.iban) === ibanPulito(conto.iban));
            if (!nostro) continue; // il database dirà che il conto non c'è
            const s = sovrapposizioni(conto.movimenti, "cbi", nostro.id, movimentiOra);
            if (s) errori.push(testoSovrapposizione(nome, nostro, s));
          }
        }
      }
      // ⚠️ Un file storto ferma tutto il caricamento, anche gli altri: chi
      // ne carica tre e vede «caricato» non va a guardare quale mancava.
      if (!errori.length) {
        for (const { nome, conto } of daMandare) {
          try {
            const r = await caricaMovimentiBanca(conto.iban, nome, movimentiDaCaricare(conto));
            righe.push({ nome, ...r });
          } catch (e) {
            errori.push(`${nome}: ${e.message}`);
          }
        }
      }
      const incassate = righe.length ? await incassaDaSoli() : null;
      await ricarica();
      setCaricamento({ righe, errori, inCorso: false, incassate });
      return;
    } catch (e) {
      errori.push(e.message);
    }
    setCaricamento({ righe, errori, inCorso: false });
  };

  // Le fatture ai clienti incassate da sole dai bonifici appena caricati
  // (13/11/2026). Un guasto qui non ferma il caricamento: si dice, e le
  // proposte restano fra i movimenti da abbinare.
  // ⚠️ Il suo errore NON va fra quelli del caricamento, che direbbero «non
  //    ho caricato niente»: i movimenti sono entrati, è l'abbinamento che no.
  const incassaDaSoli = async () => {
    try {
      return await incassaDaSoliBonifici();
    } catch (e) {
      return { errore: `Abbinamento delle fatture ai clienti non riuscito: ${e.message}. I bonifici restano fra quelli da abbinare.` };
    }
  };

  // ⚠️ Mentre il CSV parte, la casella del file è spenta (`inviando`): un
  // secondo file scelto a metà farebbe sparire il modulo del primo.
  const caricaCsv = async (iban, daMandare) => {
    setInviando(true);
    try {
      const nome = csv.nome;
      const r = await caricaMovimentiBanca(iban, nome, daMandare);
      setCsv(null);
      const incassate = await incassaDaSoli();
      setCaricamento({ righe: [{ nome, ...r }], errori: [], inCorso: false, incassate });
      await ricarica().catch((e) => setErrore(e.message));
    } finally {
      setInviando(false);
    }
  };

  const visibili = (movimenti ?? []).filter((m) => statoDi(m) === stato);
  const conteggi = Object.fromEntries(
    STATI.map(([k]) => [k, (movimenti ?? []).filter((m) => statoDi(m) === k).length]),
  );

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/cassa"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta-testo"
      >
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-4">Movimenti della banca</h1>

      <label className="block bg-b58-campo rounded-lg border border-b58-charcoal/10 p-3 mb-4">
        <span className="block testo-sala-grande text-b58-charcoal mb-2">
          Carica l&apos;estratto conto (il file CBI della banca, anche dentro lo zip, oppure il CSV dei movimenti)
        </span>
        <input
          type="file"
          multiple
          accept=".txt,.zip,.cbi,.csv,text/plain,text/csv,application/zip"
          disabled={caricamento?.inCorso || inviando}
          onChange={(e) => {
            const files = [...e.target.files];
            e.target.value = "";
            if (files.length) carica(files);
          }}
          className="tocco-campo block w-full max-w-full testo-sala text-b58-charcoal-soft file:mr-3 file:rounded-lg file:border-0 file:bg-b58-azione file:px-4 file:py-2 file:font-medium file:text-b58-sul-colore hover:file:bg-b58-azione-dark"
        />
      </label>

      {csv && (
        <CaricaCsvBanca
          file={csv}
          conti={conti}
          leggiEsistenti={listMovimentiBanca}
          onCarica={caricaCsv}
          onAnnulla={() => setCsv(null)}
        />
      )}

      {caricamento && (
        <div role="status" className="mb-4 testo-sala-grande">
          {caricamento.inCorso && <p className="text-b58-charcoal-soft">Sto leggendo il file…</p>}
          {caricamento.righe.map((r) => (
            <p key={r.nome} className="text-b58-charcoal">
              {r.conto}: {r.nuovi} {r.nuovi === 1 ? "movimento nuovo" : "movimenti nuovi"}
              {r.gia_presenti > 0 && `, ${r.gia_presenti} già caricati prima`}.
            </p>
          ))}
          {caricamento.incassate?.incassate > 0 && (
            <div className="text-b58-charcoal bg-b58-gold/15 rounded-lg px-3 py-2" role="status" data-prova="incassate-da-sole">
              <p className="font-medium">
                {caricamento.incassate.incassate === 1
                  ? "Una fattura ai clienti incassata da sola:"
                  : `${caricamento.incassate.incassate} fatture ai clienti incassate da sole:`}
              </p>
              <ul className="list-disc pl-5">
                {caricamento.incassate.elenco.map((x, i) => (
                  <li key={i}>
                    {x.fattura} · {formatEUR(Number(x.importo))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {caricamento.incassate?.errore && (
            <p role="alert" className="text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2">
              {caricamento.incassate.errore}
            </p>
          )}
          {caricamento.errori.length > 0 && (
            <div role="alert" className="text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2">
              <p className="font-medium">Non ho caricato niente:</p>
              <ul className="list-disc pl-5">
                {caricamento.errori.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {errore && (
        <p className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      <AvvisiDellaBanca />

      <div className="flex flex-wrap gap-2 mb-4">
        {STATI.map(([k, nome]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStato(k)}
            className={`tocco-bottone rounded-full px-3 py-1 testo-sala ${
              stato === k ? "bg-b58-inverso text-b58-sul-colore" : "bg-b58-campo border border-b58-charcoal/15 text-b58-charcoal"
            }`}
          >
            {nome} ({conteggi[k]})
          </button>
        ))}
      </div>

      {stato === "da_abbinare" && movimenti && (
        <SpeseDellaBanca
          righe={speseBancaDaRegistrare(movimenti, tutteLeCausali)}
          fatto={() => ricarica().catch((e) => setErrore(e.message))}
        />
      )}

      {movimenti === null ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">
          {errore ? "Non sono riuscito a leggere i movimenti." : "Caricamento…"}
        </p>
      ) : visibili.length === 0 ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">
          {stato === "da_abbinare" ? "Nessun movimento da abbinare." : "Nessuno."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibili.map((m) => (
            <RigaMovimento
              key={m.id}
              m={m}
              aperto={aperto === m.id}
              apri={() => setAperto(aperto === m.id ? null : m.id)}
              fatto={async () => {
                setAperto(null);
                await ricarica();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Le spese della banca tutte insieme (12/11/2026, richiesta di Alessio):
 * commissioni, canoni, bolli e rimborsi riconosciuti dalla causale ABI si
 * scrivono in prima nota con un tocco solo, DOPO averle viste elencate.
 * ⚠️ La conferma sta nella pagina, non in un dialogo del browser.
 * ⚠️ Una riga che non passa non ferma le altre, e si dice quale.
 * 🔴 Una riga che ha già un movimento o una fattura con lo stesso importo
 *    NON si scrive in blocco: potrebbe essere già in prima nota, e
 *    scriverla di nuovo la conterebbe due volte. Resta da guardare a mano
 *    (revisione ecc:react-reviewer, 12/11).
 */
function SpeseDellaBanca({ righe, fatto }) {
  const [chiede, setChiede] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState(null); // { scritte, saltate: [testo], errori: [testo] }
  const guardia = useRef(false);
  const si = useRef(null);
  const registra = useRef(null);
  const resoconto = useRef(null);

  useEffect(() => {
    if (chiede) si.current?.focus();
  }, [chiede]);

  if (righe.length === 0 && !esito) return null;
  const somma = (filtro) => Math.round(righe.filter(filtro).reduce((s, x) => s + Number(x.m.importo) * 100, 0)) / 100;
  const uscite = somma((x) => Number(x.m.importo) < 0);
  const entrate = somma((x) => Number(x.m.importo) > 0);
  const nome = (m) => `${formatDate(m.data_contabile)} ${formatEUR(Number(m.importo))}`;

  const registraTutte = async () => {
    if (guardia.current) return;
    guardia.current = true;
    setLavoro(true);
    const errori = [];
    const saltate = [];
    let scritte = 0;
    try {
      for (const { m, proposta } of righe) {
        try {
          const gia = await proposteMovimentoBanca(m.id);
          if (gia?.length) {
            saltate.push(nome(m));
            continue;
          }
          await registraMovimentoBanca(m.id, { causaleId: proposta.causaleId, tipoDocumento: proposta.tipoDocumento, descrizione: "" });
          scritte += 1;
        } catch (e) {
          errori.push(`${nome(m)}: ${e.message}`);
        }
      }
      setEsito({ scritte, saltate, errori });
      setChiede(false);
      await fatto();
    } finally {
      guardia.current = false;
      setLavoro(false);
      requestAnimationFrame(() => resoconto.current?.focus());
    }
  };

  return (
    <section data-prova="spese-banca" className="mb-4 rounded-xl bg-b58-campo ring-1 ring-b58-charcoal/10 p-3 space-y-2">
      {righe.length > 0 && (
        <>
          <p className="testo-sala-grande text-b58-charcoal">
            {righe.length === 1 ? "Una riga è una spesa della banca" : `${righe.length} righe sono spese della banca`}{" "}
            (commissioni, canoni, bolli o rimborsi): {formatEUR(Math.abs(uscite))} di spese
            {entrate > 0 && ` e ${formatEUR(entrate)} di rimborsi`}.
          </p>
          <ul className="testo-sala text-b58-charcoal-soft list-disc pl-5">
            {righe.map(({ m, proposta }) => (
              <li key={m.id}>
                {nome(m)} → {proposta.causale}, estratto conto
              </li>
            ))}
          </ul>
          {!chiede ? (
            <button
              ref={registra}
              type="button"
              className={bottonePieno}
              disabled={lavoro}
              onClick={() => {
                setEsito(null);
                setChiede(true);
              }}
            >
              Registra tutte ({righe.length})
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="testo-sala text-b58-charcoal">Le scrivo in prima nota così come sono elencate?</span>
              <button ref={si} type="button" className={bottonePieno} disabled={lavoro} onClick={registraTutte}>
                {lavoro ? "Le sto scrivendo…" : "Sì, scrivile"}
              </button>
              <button
                type="button"
                className={bottone}
                disabled={lavoro}
                onClick={() => {
                  setChiede(false);
                  requestAnimationFrame(() => registra.current?.focus());
                }}
              >
                Lascia perdere
              </button>
            </div>
          )}
        </>
      )}
      <div ref={resoconto} tabIndex={-1} role="status" aria-live="polite" className="testo-sala focus:outline-none">
        {esito && esito.scritte > 0 && (
          <p className="text-b58-olive-dark-testo">
            ✓ {esito.scritte === 1 ? "Scritta in prima nota 1 spesa" : `Scritte in prima nota ${esito.scritte} spese`} della banca.
          </p>
        )}
        {esito && esito.saltate.length > 0 && (
          <p className="text-b58-charcoal">
            Non ho scritto {esito.saltate.join(", ")}: c&apos;è già un movimento o una fattura con lo stesso importo, guardale a mano qui sotto.
          </p>
        )}
      </div>
      {esito && esito.errori.length > 0 && (
        <div role="alert" className="testo-sala text-b58-terracotta-dark-testo">
          <p>Queste non le ho scritte (restano da abbinare qui sotto):</p>
          <ul className="list-disc pl-5">
            {esito.errori.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
      {esito && (
        <button type="button" className={bottone} onClick={() => setEsito(null)}>
          Chiudi
        </button>
      )}
    </section>
  );
}

function RigaMovimento({ m, aperto, apri, fatto }) {
  const importo = Number(m.importo);
  const s = statoDi(m);
  const [errore, setErrore] = useState("");
  const guardia = useRef(unaVoltaSola());
  const [occupato, setOccupato] = useState(false);

  // ⚠️ Guardia sincrona: il pulsante si spegne al render dopo, e chi non
  // vede succedere niente ripreme. L'esito sta sulla riga toccata.
  const esegui = async (fn) => {
    if (!guardia.current.prendi(m.id)) return;
    setOccupato(true);
    setErrore("");
    try {
      await fn();
      await fatto();
    } catch (e) {
      setErrore(e.message);
    } finally {
      guardia.current.lascia(m.id);
      setOccupato(false);
    }
  };

  return (
    <li className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3">
      <button type="button" onClick={apri} className="w-full text-left flex justify-between gap-3">
        <span className="min-w-0">
          <span className="block testo-sala text-b58-charcoal-soft">
            {formatDate(m.data_contabile)} · {m.conto?.nome}
          </span>
          <span className="block testo-sala-grande text-b58-charcoal break-words">{m.descrizione}</span>
          {s === "abbinati" && m.registrato && (
            <span className="block testo-sala text-b58-charcoal-soft">
              In prima nota: {m.registrato.causale?.label ? `${m.registrato.causale.label} · ` : ""}
              {m.registrato.business_purpose}
            </span>
          )}
          {s === "ignorati" && (
            <span className="block testo-sala text-b58-charcoal-soft">Ignorato: {m.ignorato_perche}</span>
          )}
        </span>
        <span
          className={`shrink-0 testo-sala-grande font-medium ${importo < 0 ? "text-b58-charcoal" : "text-b58-olive-dark-testo"}`}
        >
          {importo > 0 ? "+" : ""}
          {formatEUR(importo)}
        </span>
      </button>

      {aperto && (
        <div className="mt-3 pt-3 border-t border-b58-charcoal/10">
          {m.dettagli && (
            <p className="testo-sala text-b58-charcoal-soft whitespace-pre-line mb-3 break-words">{m.dettagli}</p>
          )}
          {s === "da_abbinare" ? (
            <Abbina m={m} occupato={occupato} esegui={esegui} />
          ) : (
            <button
              type="button"
              disabled={occupato}
              onClick={() => esegui(() => riapriMovimentoBanca(m.id))}
              className={bottone}
            >
              {s === "abbinati" ? "Sciogli l'abbinamento" : "Riapri"}
            </button>
          )}
          {s === "abbinati" && (
            <p className="testo-sala text-b58-charcoal-soft mt-2">
              Sciogliere non toglie niente dalla prima nota: il movimento torna solo da abbinare.
            </p>
          )}
          {errore && (
            <p className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-3">
              {errore}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Abbina({ m, occupato, esegui }) {
  const importo = Number(m.importo);
  const [proposte, setProposte] = useState(null);
  const [erroreProposte, setErroreProposte] = useState("");
  const [causali, setCausali] = useState([]);
  const [causale, setCausale] = useState("");
  const [tipoDoc, setTipoDoc] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [perche, setPerche] = useState("");

  const [proposta, setProposta] = useState(null);

  useEffect(() => {
    proposteMovimentoBanca(m.id)
      .then(setProposte)
      .catch((e) => setErroreProposte(e.message));
    listCausali(importo < 0 ? "uscita" : "entrata")
      .then((c) => {
        setCausali(c);
        // 12/11/2026: una spesa della banca arriva coi campi già compilati
        // (si propone, non si scrive: il pulsante resta suo).
        const p = propostaSpesaBanca(m, c);
        setProposta(p);
        if (p) {
          setCausale((x) => x || p.causaleId);
          setTipoDoc((x) => x || p.tipoDocumento);
        }
      })
      .catch((e) => setErroreProposte(e.message));
    // ⚠️ `m` cambia oggetto a ogni rilettura: basta l'id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, importo]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="testo-sala font-medium text-b58-charcoal mb-1">Cosa potrebbe essere</h3>
        {erroreProposte ? (
          <p className="testo-sala text-b58-terracotta-dark-testo">{erroreProposte}</p>
        ) : proposte === null ? (
          <p className="testo-sala text-b58-charcoal-soft">Cerco…</p>
        ) : proposte.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft">
            Nessuna fattura da pagare e nessun movimento già scritto con questo importo.
          </p>
        ) : (
          <ul className="space-y-2">
            {proposte.map((p) => (
              <li
                key={`${p.genere}-${p.rif_id}`}
                className="flex flex-wrap items-center justify-between gap-2 bg-b58-campo rounded-lg px-3 py-2"
              >
                <span className="testo-sala text-b58-charcoal min-w-0">
                  {p.titolo}
                  <span className="block text-b58-charcoal-soft">
                    {formatDate(p.data)} · {formatEUR(Number(p.importo))}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() =>
                    esegui(() =>
                      p.genere === "fattura"
                        ? pagaFatturaDaMovimentoBanca(m.id, p.rif_id)
                        : p.genere === "fattura_emessa"
                          ? incassaFatturaDaMovimentoBanca(m.id, p.rif_id)
                          : abbinaMovimentoBanca(m.id, p.rif_id),
                    )
                  }
                  className={bottonePieno}
                >
                  {p.genere === "fattura"
                    ? "Paga questa fattura"
                    : p.genere === "fattura_emessa"
                      ? "Incassa questa fattura"
                      : "È questo movimento"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="testo-sala font-medium text-b58-charcoal mb-1">È una cosa nuova: scrivila in prima nota</h3>
        {proposta && (
          <p data-prova="proposta-spesa-banca" className="testo-sala text-b58-olive-dark-testo mb-2">
            Ho compilato io i campi: sono {proposta.perche}. Controlla e premi «Scrivi in prima nota».
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <select value={causale} onChange={(e) => setCausale(e.target.value)} className={campo}>
            <option value="">Causale…</option>
            {causali.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {/* ⚠️ Nessun documento proposto: «non documentato» scelto per
              comodità toglie la spesa dai costi deducibili in silenzio. */}
          <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className={campo}>
            <option value="">Con quale documento…</option>
            {CASH_DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Descrizione (se vuoi cambiarla)"
            className={`${campo} flex-1 min-w-[180px]`}
          />
          <button
            type="button"
            disabled={occupato || !causale || !tipoDoc}
            onClick={() =>
              esegui(() => registraMovimentoBanca(m.id, { causaleId: causale, tipoDocumento: tipoDoc, descrizione }))
            }
            className={bottonePieno}
          >
            Scrivi in prima nota
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={perche}
          onChange={(e) => setPerche(e.target.value)}
          placeholder="Perché non conta (es. giroconto fra i miei conti)"
          className={`${campo} flex-1 min-w-[180px]`}
        />
        <button
          type="button"
          disabled={occupato || !perche.trim()}
          onClick={() => esegui(() => ignoraMovimentoBanca(m.id, perche))}
          className={bottone}
        >
          Ignora
        </button>
      </div>
    </div>
  );
}
