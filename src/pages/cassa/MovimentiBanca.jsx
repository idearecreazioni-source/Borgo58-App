import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  abbinaMovimentoBanca,
  caricaMovimentiBanca,
  ignoraMovimentoBanca,
  listMovimentiBanca,
  pagaFatturaDaMovimentoBanca,
  proposteMovimentoBanca,
  registraMovimentoBanca,
  riapriMovimentoBanca,
} from "../../lib/api/banca";
import { listCausali } from "../../lib/api/cash";
import { CASH_DOCUMENT_TYPES, formatDate, formatEUR } from "../../lib/constants";
import { leggiFlussoCbi, movimentiDaCaricare } from "../../lib/calcoli/cbi";
import { eZip, leggiZip } from "../../lib/calcoli/zip";
import { unaVoltaSola } from "../../lib/calcoli/voce";

// L'ESTRATTO CONTO DA FILE (24/10/2026). Alessio scarica dalla banca il
// file CBI (anche dentro lo zip così com'è) e lo carica qui: i movimenti
// entrano da abbinare, e per ognuno il gestionale propone cosa potrebbe
// essere. ⚠️ Niente entra in prima nota senza un suo tocco.
//
// ⚠️ Il file si legge tutto PRIMA di mandare qualcosa: se un conto non
// quadra (saldo iniziale + movimenti ≠ saldo finale) non si carica
// niente, perché un estratto letto a metà sembrerebbe intero.

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
  "tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const bottone =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white testo-sala px-3 py-1.5 text-b58-charcoal disabled:opacity-60";
const bottonePieno =
  "tocco-bottone rounded-lg bg-b58-azione text-b58-parchment testo-sala px-3 py-1.5 disabled:opacity-60";

async function leggiFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dentro = eZip(bytes) ? await leggiZip(bytes) : [{ nome: file.name, contenuto: bytes }];
  // Il CBI è testo a 120 colonne in caratteri occidentali: latin1 non
  // perde niente, e non inventa caratteri dove UTF-8 si fermerebbe.
  return dentro.map((d) => ({
    nome: d.nome === file.name ? file.name : `${file.name} → ${d.nome}`,
    testo: new TextDecoder("latin1").decode(d.contenuto),
  }));
}

export default function MovimentiBanca() {
  const [movimenti, setMovimenti] = useState(null);
  const [errore, setErrore] = useState("");
  const [caricamento, setCaricamento] = useState(null); // { righe: [...], errori: [...] }
  const [stato, setStato] = useState("da_abbinare");
  const [aperto, setAperto] = useState(null);

  const ricarica = () => listMovimentiBanca().then(setMovimenti);

  useEffect(() => {
    ricarica().catch((e) => setErrore(e.message));
  }, []);

  const carica = async (files) => {
    setErrore("");
    setCaricamento({ righe: [], errori: [], inCorso: true });
    const righe = [];
    const errori = [];
    try {
      const letti = [];
      for (const f of files) letti.push(...(await leggiFile(f)));
      const daMandare = [];
      for (const l of letti) {
        const { conti, errori: e } = leggiFlussoCbi(l.testo);
        if (e.length) errori.push(...e.map((x) => `${l.nome}: ${x}`));
        else for (const c of conti) daMandare.push({ nome: l.nome, conto: c });
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
      await ricarica();
    } catch (e) {
      errori.push(e.message);
    }
    setCaricamento({ righe, errori, inCorso: false });
  };

  const visibili = (movimenti ?? []).filter((m) => statoDi(m) === stato);
  const conteggi = Object.fromEntries(
    STATI.map(([k]) => [k, (movimenti ?? []).filter((m) => statoDi(m) === k).length]),
  );

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/cassa"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-4">Movimenti della banca</h1>

      <label className="block bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
        <span className="block testo-sala-grande text-b58-charcoal mb-2">
          Carica l&apos;estratto conto (il file della banca, anche dentro lo zip)
        </span>
        <input
          type="file"
          multiple
          accept=".txt,.zip,.cbi,text/plain,application/zip"
          disabled={caricamento?.inCorso}
          onChange={(e) => {
            const files = [...e.target.files];
            e.target.value = "";
            if (files.length) carica(files);
          }}
          className="tocco-campo block w-full max-w-full testo-sala text-b58-charcoal-soft file:mr-3 file:rounded-lg file:border-0 file:bg-b58-azione file:px-4 file:py-2 file:font-medium file:text-b58-parchment hover:file:bg-b58-azione-dark"
        />
      </label>

      {caricamento && (
        <div className="mb-4 testo-sala-grande">
          {caricamento.inCorso && <p className="text-b58-charcoal-soft">Sto leggendo il file…</p>}
          {caricamento.righe.map((r) => (
            <p key={r.nome} className="text-b58-charcoal">
              {r.conto}: {r.nuovi} {r.nuovi === 1 ? "movimento nuovo" : "movimenti nuovi"}
              {r.gia_presenti > 0 && `, ${r.gia_presenti} già caricati prima`}.
            </p>
          ))}
          {caricamento.errori.length > 0 && (
            <div className="text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
              <p className="font-medium">Non ho caricato niente:</p>
              <ul className="list-disc pl-5">
                {caricamento.errori.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {errore && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {STATI.map(([k, nome]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStato(k)}
            className={`tocco-bottone rounded-full px-3 py-1 testo-sala ${
              stato === k ? "bg-b58-charcoal text-b58-parchment" : "bg-white border border-b58-charcoal/15 text-b58-charcoal"
            }`}
          >
            {nome} ({conteggi[k]})
          </button>
        ))}
      </div>

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
          className={`shrink-0 testo-sala-grande font-medium ${importo < 0 ? "text-b58-charcoal" : "text-b58-olive-dark"}`}
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
            <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-3">
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

  useEffect(() => {
    proposteMovimentoBanca(m.id)
      .then(setProposte)
      .catch((e) => setErroreProposte(e.message));
    listCausali(importo < 0 ? "uscita" : "entrata")
      .then(setCausali)
      .catch((e) => setErroreProposte(e.message));
  }, [m.id, importo]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="testo-sala font-medium text-b58-charcoal mb-1">Cosa potrebbe essere</h3>
        {erroreProposte ? (
          <p className="testo-sala text-b58-terracotta-dark">{erroreProposte}</p>
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
                className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2"
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
                        : abbinaMovimentoBanca(m.id, p.rif_id),
                    )
                  }
                  className={bottonePieno}
                >
                  {p.genere === "fattura" ? "Paga questa fattura" : "È questo movimento"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="testo-sala font-medium text-b58-charcoal mb-1">È una cosa nuova: scrivila in prima nota</h3>
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
