// =====================================================================
// FATTURE AI CLIENTI — 13/11/2026, pezzo 2a di 5
// =====================================================================
// Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md):
// work prepara la fattura e (dal pezzo 3) la spedisce dalla PEC allo SDI.
// Qui: l'elenco, la bozza con le righe e il totale in diretta, il cliente,
// i dati della società, e la bozza che parte dal conto di un tavolo.
//
// ⚠️ NIENTE «EMETTI» IN QUESTO PEZZO, apposta: senza la spedizione una
//    fattura numerata resterebbe ferma «da inviare» col numero consumato.
//    Il pulsante arriva col pezzo 3, insieme a «Manda allo SDI».
// ⚠️ I PREZZI SONO IVA INCLUSA di partenza, come sul conto del ristorante:
//    il totale della fattura è quello pagato, e l'IVA si scorpora
//    (totaliFattura con prezziIvati, uguale a totali_fattura() nel database).

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ALIQUOTE_IVA_FATTURA,
  MODALITA_PAGAMENTO_FATTURA,
  NATURE_IVA,
  SOCIO_UNICO,
  STATI_FATTURA_EMESSA,
  formatDate,
  formatEUR,
  labelFor,
  oggiLocale,
} from "../../lib/constants";
import {
  eliminaBozzaFattura,
  listClientiFattura,
  listFattureEmesse,
  salvaBozzaFattura,
  salvaClienteFattura,
} from "../../lib/api/fattureEmesse";
import { getEntities, salvaDatiSocieta } from "../../lib/api/entities";
import { getOrder, getServiceSettings } from "../../lib/api/orders";
import {
  datiSocietaMancanti,
  nomeCliente,
  numeroFattura,
  righeDalConto,
  totaliFattura,
} from "../../lib/calcoli/fattureEmesse";
import Didascalia from "../../components/Didascalia";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import { ErroreDelGesto } from "../../components/HoPagatoIo";

const inputClass =
  "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const labelClass = "block testo-sala text-b58-charcoal-soft mb-1";
const bottonePrimario =
  "tocco-bottone rounded-lg bg-b58-azione text-b58-sul-colore testo-sala px-4 disabled:opacity-60";
const bottoneSecondario =
  "tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-4 disabled:opacity-60";
const card = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6";

/** «27,50» o «27.50» → 27.5; vuoto → NaN (una riga senza prezzo non è una cifra). */
function cifra(v) {
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (s === "") return NaN;
  // «1.234,50»: i punti sono migliaia quando c'è anche la virgola; e
  // «10.000» (gruppi di tre cifre, senza virgola) è diecimila, non dieci.
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}

const RIGA_VUOTA = { descrizione: "", quantita: 1, prezzo_unitario: "", aliquota_iva: 10, natura: "" };
const CLIENTE_VUOTO = {
  denominazione: "",
  nome: "",
  cognome: "",
  partita_iva: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  comune: "",
  provincia: "",
  codice_destinatario: "",
  pec: "",
};

// ---------------------------------------------------------------------
// I DATI DELLA SOCIETÀ
// ---------------------------------------------------------------------
function DatiSocieta({ societa, onSalvata }) {
  const mancano = datiSocietaMancanti(societa);
  const [aperta, setAperta] = useState(mancano.length > 0);
  const [dati, setDati] = useState(() => ({ ...societa }));
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState("");
  const [fatto, setFatto] = useState(false);

  const campo = (k, etichetta, extra = {}) => (
    <div className={extra.largo ? "cella-larga" : ""}>
      <label className={labelClass} htmlFor={`societa-${k}`}>{etichetta}</label>
      <input
        id={`societa-${k}`}
        value={dati[k] ?? ""}
        onChange={(e) => setDati((d) => ({ ...d, [k]: extra.maiuscolo ? e.target.value.toUpperCase() : e.target.value }))}
        className={inputClass}
        placeholder={extra.esempio}
        inputMode={extra.numeri ? "numeric" : undefined}
      />
    </div>
  );

  async function salva() {
    setSalvo(true);
    setErrore("");
    setFatto(false);
    try {
      const scritto = dati.capitale_sociale;
      const capitale = scritto == null || String(scritto).trim() === "" ? null : cifra(scritto);
      if (Number.isNaN(capitale)) throw new Error("Il capitale sociale va scritto in cifre (per esempio 1.000,00).");
      await salvaDatiSocieta(societa.id, { ...dati, capitale_sociale: capitale });
      setFatto(true);
      await onSalvata();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvo(false);
    }
  }

  return (
    <section className={card} data-prova="dati-societa">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display testo-sala-grande text-b58-charcoal">I dati di Borgo 58 in fattura</h2>
        <button type="button" onClick={() => setAperta((a) => !a)} className={bottoneSecondario} aria-expanded={aperta}>
          {aperta ? "Chiudi" : "Apri"}
        </button>
      </div>
      {mancano.length > 0 ? (
        <p className="testo-sala text-b58-charcoal mt-2" role="status">
          Per fare una fattura mancano: {mancano.join(", ")}.
        </p>
      ) : (
        <p className="testo-sala text-b58-charcoal-soft mt-2">Completi: si può fare la fattura.</p>
      )}
      {aperta && (
        <div className="mt-4">
          <div className="riga-campi">
            {campo("legal_name", "Ragione sociale", { largo: true, esempio: "Borgo 58 S.r.l.s." })}
            {campo("vat_number", "Partita IVA", { esempio: "11 cifre", numeri: true })}
            {campo("tax_code", "Codice fiscale (se diverso)", { maiuscolo: true })}
          </div>
          <div className="riga-campi mt-3">
            {campo("sede_indirizzo", "Indirizzo della sede", { largo: true, esempio: "Via …, numero" })}
            {campo("sede_cap", "CAP", { numeri: true })}
            {campo("sede_comune", "Comune")}
            {campo("sede_provincia", "Provincia", { maiuscolo: true, esempio: "SA" })}
          </div>
          <div className="riga-campi mt-3">
            {campo("rea_ufficio", "REA: ufficio", { maiuscolo: true, esempio: "SA" })}
            {campo("rea_numero", "REA: numero")}
            {campo("capitale_sociale", "Capitale sociale (€)", { numeri: true })}
            <div>
              <label className={labelClass} htmlFor="societa-socio_unico">Soci</label>
              <select
                id="societa-socio_unico"
                value={dati.socio_unico ?? ""}
                onChange={(e) => setDati((d) => ({ ...d, socio_unico: e.target.value }))}
                className={inputClass}
              >
                <option value="">non indicato</option>
                {SOCIO_UNICO.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="riga-campi mt-3">
            {campo("pec", "PEC della società", { largo: true, esempio: "borgo58@pec.it" })}
            {campo("iban", "IBAN (per il bonifico)", { largo: true, maiuscolo: true })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={salva} disabled={salvo} className={bottonePrimario}>
              {salvo ? "Salvo…" : "Salva i dati"}
            </button>
            {fatto && <span className="testo-sala text-b58-charcoal-soft" role="status">Salvati.</span>}
          </div>
          <ErroreDelGesto messaggio={errore} className="mt-2" />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// IL CLIENTE NUOVO
// ---------------------------------------------------------------------
function ClienteNuovo({ onSalvato, onAnnulla }) {
  const [c, setC] = useState(CLIENTE_VUOTO);
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState("");

  const campo = (k, etichetta, extra = {}) => (
    <div className={extra.largo ? "cella-larga" : ""}>
      <label className={labelClass} htmlFor={`cliente-${k}`}>{etichetta}</label>
      <input
        id={`cliente-${k}`}
        value={c[k]}
        onChange={(e) => setC((x) => ({ ...x, [k]: extra.maiuscolo ? e.target.value.toUpperCase() : e.target.value }))}
        className={inputClass}
        placeholder={extra.esempio}
      />
    </div>
  );

  async function salva() {
    setSalvo(true);
    setErrore("");
    try {
      const pulito = Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v?.trim?.() ?? v])
      );
      const nuovo = await salvaClienteFattura(pulito);
      onSalvato(nuovo);
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvo(false);
    }
  }

  return (
    <div className="rounded-xl bg-b58-campo ring-1 ring-b58-charcoal/10 p-4 mt-3" data-prova="cliente-nuovo">
      <p className="testo-sala text-b58-charcoal-soft mb-3">
        Una ditta: la ragione sociale. Una persona: nome e cognome. Poi la partita IVA oppure il codice fiscale.
      </p>
      <div className="riga-campi">
        {campo("denominazione", "Ragione sociale", { largo: true })}
        {campo("nome", "Nome")}
        {campo("cognome", "Cognome")}
      </div>
      <div className="riga-campi mt-3">
        {campo("partita_iva", "Partita IVA", { esempio: "11 cifre" })}
        {campo("codice_fiscale", "Codice fiscale", { maiuscolo: true })}
      </div>
      <div className="riga-campi mt-3">
        {campo("indirizzo", "Indirizzo", { largo: true })}
        {campo("cap", "CAP")}
        {campo("comune", "Comune")}
        {campo("provincia", "Provincia", { maiuscolo: true, esempio: "SA" })}
      </div>
      <div className="riga-campi mt-3">
        {campo("codice_destinatario", "Codice destinatario", { maiuscolo: true, esempio: "7 caratteri" })}
        {campo("pec", "oppure la sua PEC", { largo: true })}
      </div>
      <p className="testo-sala text-b58-charcoal-soft mt-2">
        Se il cliente non sa né il codice né la PEC, lascia vuoto: la fattura la trova nel suo cassetto fiscale.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={salva} disabled={salvo} className={bottonePrimario}>
          {salvo ? "Salvo…" : "Salva il cliente"}
        </button>
        <button type="button" onClick={onAnnulla} className={bottoneSecondario}>Lascia perdere</button>
      </div>
      <ErroreDelGesto messaggio={errore} className="mt-2" />
    </div>
  );
}

// ---------------------------------------------------------------------
// LA BOZZA
// ---------------------------------------------------------------------
function Bozza({ fattura, clienti, onClienteNuovo, onSalvata, onChiudi, totaleAtteso }) {
  const [testata, setTestata] = useState(() => ({
    cliente_id: fattura?.cliente_id ?? "",
    data: fattura?.data ?? oggiLocale(),
    modalita_pagamento: fattura?.modalita_pagamento ?? "MP05",
    causale: fattura?.causale ?? "",
    prezzi_ivati: fattura?.prezzi_ivati ?? true,
    order_id: fattura?.order_id ?? null,
    preventivo_id: fattura?.preventivo_id ?? null,
  }));
  const [righe, setRighe] = useState(() =>
    fattura?.righe?.length
      ? [...fattura.righe]
          .sort((a, b) => a.posizione - b.posizione)
          .map((r) => ({ ...r, natura: r.natura ?? "" }))
      : [{ ...RIGA_VUOTA }]
  );
  const [nuovoCliente, setNuovoCliente] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState("");

  const uscita = fattura?.numero != null;
  // ⚠️ La virgola è il decimale di Alessio («27,50»): senza questa
  //    conversione il totale in diretta saltava la riga in silenzio.
  const totali = useMemo(
    () =>
      totaliFattura(
        righe
          .map((r) => ({
            ...r,
            quantita: cifra(r.quantita),
            prezzo_unitario: cifra(r.prezzo_unitario),
          }))
          .filter((r) => !Number.isNaN(r.prezzo_unitario) && !Number.isNaN(r.quantita)),
        { prezziIvati: testata.prezzi_ivati }
      ),
    [righe, testata.prezzi_ivati]
  );

  const cambiaRiga = (i, k, v) =>
    setRighe((rr) =>
      rr.map((r, j) => {
        if (j !== i) return r;
        const n = { ...r, [k]: v };
        if (k === "aliquota_iva" && Number(v) !== 0) n.natura = "";
        return n;
      })
    );

  async function salva() {
    setSalvo(true);
    setErrore("");
    try {
      const pulite = righe.map((r) => ({
        descrizione: r.descrizione,
        quantita: cifra(r.quantita),
        prezzo_unitario: cifra(r.prezzo_unitario),
        aliquota_iva: Number(r.aliquota_iva),
        natura: Number(r.aliquota_iva) === 0 ? r.natura || null : null,
      }));
      if (pulite.some((r) => Number.isNaN(r.prezzo_unitario) || Number.isNaN(r.quantita))) {
        throw new Error("Una riga ha il prezzo o la quantità che non sono cifre.");
      }
      const id = await salvaBozzaFattura(fattura?.id ?? null, testata, pulite);
      await onSalvata(id);
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvo(false);
    }
  }

  async function butta() {
    try {
      await eliminaBozzaFattura(fattura.id);
      await onSalvata(null);
      onChiudi();
    } catch (e) {
      setErrore(e.message);
    }
  }

  return (
    <section className={card} data-prova="bozza-fattura">
      <h2 className="font-display testo-sala-grande text-b58-charcoal mb-1">
        {uscita ? `Fattura ${numeroFattura(fattura)} — correzione dopo lo scarto` : fattura?.id ? "Bozza di fattura" : "Nuova fattura"}
      </h2>
      <p className="testo-sala text-b58-charcoal-soft mb-4">
        È una bozza: puoi cambiarla quante volte vuoi. Il numero lo prende quando parte (arriva col prossimo pezzo).
      </p>

      <div className="riga-campi">
        <div className="cella-larga">
          <label className={labelClass} htmlFor="fattura-cliente">Cliente</label>
          <select
            id="fattura-cliente"
            value={testata.cliente_id}
            onChange={(e) => setTestata((t) => ({ ...t, cliente_id: e.target.value }))}
            className={inputClass}
          >
            <option value="">scegli…</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeCliente(c)} · {c.partita_iva || c.codice_fiscale}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => setNuovoCliente(true)} className={`${bottoneSecondario} self-end`}>
          + Nuovo cliente
        </button>
      </div>
      {nuovoCliente && (
        <ClienteNuovo
          onAnnulla={() => setNuovoCliente(false)}
          onSalvato={async (c) => {
            setNuovoCliente(false);
            await onClienteNuovo();
            setTestata((t) => ({ ...t, cliente_id: c.id }));
          }}
        />
      )}

      <div className="riga-campi mt-3">
        <div>
          <label className={labelClass} htmlFor="fattura-data">Data</label>
          <input
            id="fattura-data"
            type="date"
            value={testata.data}
            disabled={uscita}
            onChange={(e) => setTestata((t) => ({ ...t, data: e.target.value }))}
            className={`${inputClass} campo-data`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="fattura-pagamento">Pagato con</label>
          <select
            id="fattura-pagamento"
            value={testata.modalita_pagamento}
            onChange={(e) => setTestata((t) => ({ ...t, modalita_pagamento: e.target.value }))}
            className={inputClass}
          >
            {MODALITA_PAGAMENTO_FATTURA.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="cella-larga">
          <label className={labelClass} htmlFor="fattura-causale">Causale (facoltativa)</label>
          <input
            id="fattura-causale"
            value={testata.causale}
            onChange={(e) => setTestata((t) => ({ ...t, causale: e.target.value }))}
            className={inputClass}
            placeholder="es. Cena aziendale del 12/01"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 testo-sala text-b58-charcoal mt-3">
        <input
          type="checkbox"
          checked={testata.prezzi_ivati}
          disabled={uscita}
          onChange={(e) => setTestata((t) => ({ ...t, prezzi_ivati: e.target.checked }))}
        />
        I prezzi sono IVA inclusa (come sul conto)
        <Didascalia>
          Al ristorante il prezzo è già con l&apos;IVA: il totale della fattura resta quello pagato e l&apos;IVA si
          ricava dentro. Togli la spunta solo se i prezzi che scrivi sono senza IVA.
        </Didascalia>
      </label>

      <h3 className="testo-sala-grande text-b58-charcoal mt-5 mb-2">Righe</h3>
      <ul className="space-y-3" data-prova="righe-fattura">
        {righe.map((r, i) => (
          <li key={i} className="rounded-lg bg-b58-campo ring-1 ring-b58-charcoal/10 p-3">
            <div className="riga-campi">
              <div className="cella-larga">
                <label className={labelClass} htmlFor={`riga-${i}-descrizione`}>Cosa</label>
                <input
                  id={`riga-${i}-descrizione`}
                  value={r.descrizione}
                  onChange={(e) => cambiaRiga(i, "descrizione", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`riga-${i}-quantita`}>Quantità</label>
                <input
                  id={`riga-${i}-quantita`}
                  inputMode="decimal"
                  value={r.quantita}
                  onChange={(e) => cambiaRiga(i, "quantita", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`riga-${i}-prezzo`}>
                  Prezzo {testata.prezzi_ivati ? "(IVA incl.)" : "(senza IVA)"}
                </label>
                <input
                  id={`riga-${i}-prezzo`}
                  inputMode="decimal"
                  value={r.prezzo_unitario}
                  onChange={(e) => cambiaRiga(i, "prezzo_unitario", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`riga-${i}-iva`}>IVA</label>
                <select
                  id={`riga-${i}-iva`}
                  value={r.aliquota_iva}
                  onChange={(e) => cambiaRiga(i, "aliquota_iva", e.target.value)}
                  className={inputClass}
                >
                  {ALIQUOTE_IVA_FATTURA.map((a) => (
                    <option key={a} value={a}>{a}%</option>
                  ))}
                </select>
              </div>
              {Number(r.aliquota_iva) === 0 && (
                <div className="cella-larga">
                  <label className={labelClass} htmlFor={`riga-${i}-natura`}>Perché senza IVA</label>
                  <select
                    id={`riga-${i}-natura`}
                    value={r.natura}
                    onChange={(e) => cambiaRiga(i, "natura", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">scegli…</option>
                    {NATURE_IVA.map((n) => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {righe.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRighe((rr) => rr.filter((_, j) => j !== i))}
                  className={`${bottoneSecondario} self-end`}
                  aria-label={`Togli la riga ${i + 1}`}
                >
                  Togli
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setRighe((rr) => [...rr, { ...RIGA_VUOTA }])} className={`${bottoneSecondario} mt-3`}>
        + Aggiungi una riga
      </button>

      <dl className="mt-5 testo-sala text-b58-charcoal grid grid-cols-[auto_auto] gap-x-6 gap-y-1 w-fit" data-prova="totali-fattura">
        {totali.riepilogo.map((g) => (
          <div key={`${g.aliquota}|${g.natura ?? ""}`} className="contents">
            <dt className="text-b58-charcoal-soft">
              Imponibile al {g.aliquota}%{g.natura ? ` (${g.natura})` : ""}
            </dt>
            <dd className="text-right">{formatEUR(g.imponibile)} + IVA {formatEUR(g.imposta)}</dd>
          </div>
        ))}
        <dt className="font-medium">Totale</dt>
        <dd className="text-right font-medium">{formatEUR(totali.totale)}</dd>
      </dl>
      {totaleAtteso != null && Math.abs(totaleAtteso - totali.totale) >= 0.005 && (
        <p className="testo-sala text-b58-charcoal bg-b58-gold/15 rounded-lg px-3 py-2 mt-3" role="status">
          Il conto del tavolo era {formatEUR(totaleAtteso)}: la fattura fa {formatEUR(totali.totale)}. Controlla le righe
          (uno sconto, un omaggio, un piatto tolto).
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={salva} disabled={salvo} className={bottonePrimario} data-prova="salva-bozza">
          {salvo ? "Salvo…" : "Salva la bozza"}
        </button>
        <button type="button" onClick={onChiudi} className={bottoneSecondario}>Chiudi</button>
        {fattura?.id && !uscita && (
          <ConfermaDistruttiva
            etichetta="Butta la bozza"
            domanda={`Buttare la bozza per ${nomeCliente(clienti.find((c) => c.id === testata.cliente_id)) || "questo cliente"}?`}
            etichettaConferma="Sì, buttala"
            onConferma={butta}
          />
        )}
      </div>
      <ErroreDelGesto messaggio={errore} className="mt-2" />
    </section>
  );
}

// ---------------------------------------------------------------------
// LA PAGINA
// ---------------------------------------------------------------------
export default function FattureClientiHome() {
  const [params, setParams] = useSearchParams();
  const [fatture, setFatture] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [societa, setSocieta] = useState(null);
  const [aperta, setAperta] = useState(null); // null | "nuova" | id
  const [daConto, setDaConto] = useState(null); // { fattura, totale }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function leggiFatture() {
    setFatture(await listFattureEmesse());
  }
  async function leggiClienti() {
    setClienti(await listClientiFattura());
  }
  async function leggiSocieta() {
    setSocieta((await getEntities()).srls ?? null);
  }

  useEffect(() => {
    Promise.all([leggiFatture(), leggiClienti(), leggiSocieta()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Dal conto di un tavolo (Cassa → «Prepara la fattura»).
  const ordineId = params.get("ordine");
  useEffect(() => {
    if (!ordineId) return;
    Promise.all([getOrder(ordineId), getServiceSettings()])
      .then(([order, impostazioni]) => {
        const { righe, totale } = righeDalConto(order, impostazioni?.coperto_price);
        setDaConto({
          fattura: {
            order_id: order.id,
            causale: `Conto del tavolo ${order.table_label ?? ""}`.trim(),
            righe: righe.map((r, i) => ({ ...r, posizione: i + 1 })),
          },
          totale,
        });
        setAperta("nuova");
      })
      .catch((e) => setError(`Non riesco a leggere il conto del tavolo: ${e.message}`));
  }, [ordineId]);

  const fatturaAperta = aperta && aperta !== "nuova" ? fatture.find((f) => f.id === aperta) : null;

  function chiudi() {
    setAperta(null);
    setDaConto(null);
    if (ordineId) {
      params.delete("ordine");
      setParams(params, { replace: true });
    }
  }

  return (
    <div className="testo-sala max-w-4xl mx-auto pb-16">
      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal mb-1">
        Fatture ai clienti{" "}
        <Didascalia>
          Le fatture che Borgo 58 fa ai clienti che la chiedono. Qui prepari la bozza; dal prossimo aggiornamento
          partirà dalla PEC verso l&apos;Agenzia, e la risposta (consegnata o scartata) la leggerà MEMO.
        </Didascalia>
      </h1>
      <p className="testo-sala text-b58-charcoal-soft mb-6">Prepari la fattura qui. L&apos;invio arriva nel prossimo pezzo.</p>

      {error && (
        <p role="alert" className="testo-sala text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p>Caricamento…</p>
      ) : (
        <>
          {/* La chiave rinnova il modulo quando i dati salvati tornano dal database. */}
          {societa && <DatiSocieta key={JSON.stringify(societa)} societa={societa} onSalvata={leggiSocieta} />}

          {aperta ? (
            <Bozza
              key={aperta === "nuova" ? `nuova-${ordineId ?? ""}-${daConto ? "conto" : ""}` : aperta}
              fattura={aperta === "nuova" ? daConto?.fattura ?? null : fatturaAperta}
              totaleAtteso={aperta === "nuova" ? daConto?.totale ?? null : null}
              clienti={clienti}
              onClienteNuovo={leggiClienti}
              onSalvata={async (id) => {
                await leggiFatture();
                if (id) setAperta(id);
                setDaConto(null);
              }}
              onChiudi={chiudi}
            />
          ) : (
            <button type="button" onClick={() => setAperta("nuova")} className={`${bottonePrimario} mb-6`}>
              + Nuova fattura
            </button>
          )}

          <section className={card}>
            <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Le fatture</h2>
            {fatture.length === 0 ? (
              <p className="testo-sala text-b58-charcoal-soft">Nessuna fattura ancora.</p>
            ) : (
              <ul className="divide-y divide-b58-charcoal/10" data-prova="elenco-fatture">
                {fatture.map((f) => {
                  const modificabile = f.stato === "bozza" || f.stato === "scartata";
                  // Una scartata corretta ha righe nuove: il totale congelato è quello vecchio.
                  const t =
                    modificabile || f.totale == null
                      ? totaliFattura(f.righe ?? [], { prezziIvati: f.prezzi_ivati }).totale
                      : f.totale;
                  return (
                    <li key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="testo-sala text-b58-charcoal">
                        <span className="font-medium">{numeroFattura(f) ?? "bozza"}</span>
                        <span className="text-b58-charcoal-soft">
                          {" "}· {formatDate(f.data)} · {nomeCliente(f.cliente)} · {formatEUR(t)} ·{" "}
                          {labelFor(STATI_FATTURA_EMESSA, f.stato)}
                        </span>
                      </span>
                      {modificabile && (
                        <button type="button" onClick={() => setAperta(f.id)} className={bottoneSecondario}>
                          Apri
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
