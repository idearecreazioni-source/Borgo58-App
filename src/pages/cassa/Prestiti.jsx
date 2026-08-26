import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Didascalia from "../../components/Didascalia";
import {
  getSpazioDiManovra,
  listAllCausali,
  listPrestiti,
  registraPrestito,
  registraRestituzione,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale } from "../../lib/constants";

// I PRESTITI DI PRIVATI — 22/08/2026.
//
// 🔴 QUESTA SCHERMATA ESISTE PER UNA DOMANDA SOLA, e non è «quanto devo»:
// è **quanto posso restituire adesso senza restare a secco**. Parole di
// Alessio: *sapere di dovere 30.000 non serve a decidere niente; sapere che
// oggi puoi restituirne 3.000 sì.* Per questo quel numero sta in cima e in
// grande, e il debito totale gli sta accanto in piccolo.
//
// ⚠️ NESSUNA SCADENZA, da nessuna parte — è una decisione, non una
// dimenticanza: *«non hanno scadenza e il gestionale non deve chiedermi
// quando restituire»*. Qui non c'è nessun promemoria, nessuna rata, nessun
// avviso: solo quanto si deve e quanto si può.

const vuoto = {
  daChi: "",
  importo: "",
  mezzo: "banca",
  ricevutoIl: oggiLocale(),
  nota: "",
};

export default function Prestiti() {
  const [entityId, setEntityId] = useState("");
  const [prestiti, setPrestiti] = useState(null);
  const [spazio, setSpazio] = useState(null);
  // ⚠️ `null` e non `[]`: «non ho letto le causali» e «non ce ne sono» non
  // sono la stessa cosa, e qui la differenza si paga in prima nota.
  const [causali, setCausali] = useState(null);
  const [form, setForm] = useState(vuoto);
  const [restituzione, setRestituzione] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState("");
  const [esito, setEsito] = useState("");

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  useEffect(() => {
    getEntities()
      .then((e) => setEntityId(e.srls.id))
      .catch((e) => setErrore(e.message));
  }, []);

  const carica = async (id = entityId) => {
    if (!id) return;
    setErrore("");
    try {
      // 🔴 LE CAUSALI STANNO QUI DENTRO, e non e' una comodita'.
      //
      // Prima si leggevano a parte e un guasto le lasciava a elenco vuoto:
      // il modulo restava compilabile, la causale partiva vuota, e il
      // prestito si registrava **con un movimento di prima nota senza
      // causale** — senza nessun errore. ⚠️ Un movimento senza causale non
      // e' un dato incompleto qualsiasi: e' un'uscita che nessun totale
      // classifica, e da li' si legge tutto il resto.
      //
      // ⚠️ Le tre letture cadono insieme apposta (famiglia del 18/08): senza
      // una delle tre questa schermata non puo' fare il suo mestiere, e
      // disegnarne due su tre direbbe una mezza verita' con l'aria intera.
      const [p, s, c] = await Promise.all([
        listPrestiti(id),
        getSpazioDiManovra(id),
        listAllCausali(),
      ]);
      setPrestiti(p);
      setSpazio(s);
      setCausali(c);
    } catch (e) {
      // ⚠️ Non si disegna un elenco vuoto quando la lettura è fallita:
      // «non c'è nessun prestito» e «non lo so» sono due cose diverse. E qui
      // un elenco vuoto si leggerebbe «non devi niente a nessuno».
      setPrestiti(null);
      setSpazio(null);
      setCausali(null);
      setErrore(e.message);
    }
  };

  useEffect(() => {
    carica(entityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const causaleEntrata = (causali ?? []).find((c) => c.kind === "entrata" && c.active && !c.di_sistema);
  const causaleUscita = (causali ?? []).find((c) => c.kind === "uscita" && c.active && !c.di_sistema);

  const salva = async () => {
    if (!form.daChi.trim() || !Number(form.importo)) return;
    setBusy(true);
    setErrore("");
    setEsito("");
    try {
      const r = await registraPrestito({
        entityId,
        daChi: form.daChi,
        importo: Number(form.importo),
        mezzo: form.mezzo,
        ricevutoIl: form.ricevutoIl,
        causaleId: causaleEntrata?.id ?? null,
        nota: form.nota,
      });
      setEsito(r.messaggio);
      setForm(vuoto);
      await carica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setBusy(false);
    }
  };

  const restituisci = async () => {
    const q = Number(restituzione?.importo);
    if (!q) return;
    setBusy(true);
    setErrore("");
    setEsito("");
    try {
      const r = await registraRestituzione({
        prestitoId: restituzione.id,
        importo: q,
        mezzo: restituzione.mezzo,
        restituitoIl: restituzione.data,
        causaleId: causaleUscita?.id ?? null,
      });
      setEsito(r.messaggio);
      setRestituzione(null);
      await carica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setBusy(false);
    }
  };

  const aperti = (prestiti ?? []).filter((p) => !p.estinto);
  const estinti = (prestiti ?? []).filter((p) => p.estinto);

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link
        to="/cassa"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">
        Prestiti da privati
        <Didascalia>
          Soldi che qualcuno ha messo nel locale e che vanno restituiti. Stanno in
          cassa come tutti gli altri, ma non sono incassi: restituirli non è un
          costo, e prenderli non è un ricavo.
        </Didascalia>
      </h1>
      {/* ⚠️ La riga sopra è passata dietro il segno; questa resta perché è il
          limite del numero grande qui sotto, non una spiegazione. */}
      <p className="text-b58-charcoal-soft mb-6">
        ⚠️ Non entrano nei ricavi.
      </p>

      {errore && (
        <div className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          <p>{errore}</p>
          <button onClick={() => carica()} className="tocco-bottone underline testo-sala mt-1">
            Riprova
          </button>
        </div>
      )}
      {esito && (
        <p className="testo-sala text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2 mb-4">{esito}</p>
      )}

      {/* 🔴 IL NUMERO CHE CONTA STA IN CIMA E IN GRANDE. Il debito totale
          gli sta accanto in piccolo: è un'informazione, non una decisione. */}
      {spazio && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
            Puoi restituire adesso
          </div>
          <div className="text-3xl font-medium text-b58-charcoal">
            {formatEUR(spazio.restituibile_adesso)}
          </div>
          <div className="testo-sala text-b58-charcoal-soft mt-1">
            in tutto devi ancora {formatEUR(spazio.debito_residuo)}
          </div>
          {/* ⚠️ Il numero e il suo limite viaggiano insieme: viene dal
              database con la frase che dice su cosa è calcolato, e non da
              un testo scritto qui — che una seconda schermata potrebbe
              mostrare senza. */}
          <p className="testo-sala text-b58-charcoal-soft/70 mt-3 leading-snug">{spazio.avvertenza}</p>
        </div>
      )}

      {prestiti === null && !errore && <p className="text-b58-charcoal-soft">Sto guardando…</p>}

      {aperti.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/10 mb-6">
          {aperti.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-b58-charcoal">{p.da_chi}</div>
                  <div className="testo-sala text-b58-charcoal-soft">
                    {formatEUR(p.importo)} il {formatDate(p.ricevuto_il)} · {p.mezzo}
                    {Number(p.restituito) > 0 && <> · restituiti {formatEUR(p.restituito)}</>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">Resta</div>
                    <div className="text-b58-charcoal font-medium">{formatEUR(p.residuo)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRestituzione({ id: p.id, daChi: p.da_chi, residuo: p.residuo, importo: "", mezzo: p.mezzo, data: oggiLocale() })
                    }
                    className="tocco-bottone rounded-lg border border-b58-charcoal/20 testo-sala px-3 text-b58-charcoal"
                  >
                    Restituisci
                  </button>
                </div>
              </div>

              {restituzione?.id === p.id && (
                <div className="mt-3 rounded-lg bg-white border border-b58-charcoal/10 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Quanto</label>
                      <input
                        type="number" step="0.01" autoFocus
                        value={restituzione.importo}
                        onChange={(e) => setRestituzione((r) => ({ ...r, importo: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Come</label>
                      <select
                        value={restituzione.mezzo}
                        onChange={(e) => setRestituzione((r) => ({ ...r, mezzo: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="banca">Banca</option>
                        <option value="cassa">Contanti</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Quando</label>
                      <input
                        type="date"
                        value={restituzione.data}
                        onChange={(e) => setRestituzione((r) => ({ ...r, data: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {/* ⚠️ I due gesti opposti stanno a 5 mm veri: è la regola
                      del 22/08 per le coppie pericolose. */}
                  <div className="gesti-pericolosi justify-end mt-3">
                    <button
                      type="button" disabled={busy || !causali} onClick={restituisci}
                      className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment px-4 disabled:opacity-60"
                    >
                      {busy ? "Registro…" : "Registra la restituzione"}
                    </button>
                    <button
                      type="button" onClick={() => setRestituzione(null)}
                      className="tocco-bottone text-b58-charcoal-soft px-3"
                    >
                      Lascia stare
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {prestiti !== null && aperti.length === 0 && (
        <p className="text-b58-charcoal-soft mb-6">Nessun prestito da restituire.</p>
      )}

      {/* Il modulo per registrarne uno nuovo */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-3">Registra un prestito ricevuto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Da chi</label>
            <input
              value={form.daChi}
              onChange={(e) => setForm((f) => ({ ...f, daChi: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Quanto €</label>
            <input
              type="number" step="0.01"
              value={form.importo}
              onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Com'è entrato</label>
            <select
              value={form.mezzo}
              onChange={(e) => setForm((f) => ({ ...f, mezzo: e.target.value }))}
              className={inputClass}
            >
              <option value="banca">Bonifico</option>
              <option value="cassa">Contanti</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Quando</label>
            <input
              type="date"
              value={form.ricevutoIl}
              onChange={(e) => setForm((f) => ({ ...f, ricevutoIl: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Nota</label>
          <input
            value={form.nota}
            onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end items-center gap-3 mt-3">
          {/* ⚠️ Spento CON LA RAGIONE, non premibile per essere rifiutato
              (regola del 17/08). Senza causali il prestito si registrerebbe
              con un movimento che nessun totale classifica. */}
          {!causali && (
            <p className="testo-sala text-b58-charcoal-soft">
              Non ho letto le causali di cassa: senza, il movimento resterebbe
              senza voce. Riprova qui sopra.
            </p>
          )}
          <button
            type="button"
            disabled={busy || !causali || !form.daChi.trim() || !Number(form.importo)}
            onClick={salva}
            className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment px-4 disabled:opacity-50"
          >
            {busy ? "Registro…" : "Registra"}
          </button>
        </div>
      </div>

      {estinti.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-2">Restituiti per intero</h2>
          <div className="rounded-xl bg-b58-parchment/60 ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/10">
            {estinti.map((p) => (
              <div key={p.id} className="px-4 py-2 testo-sala text-b58-charcoal-soft">
                {p.da_chi} · {formatEUR(p.importo)} · ricevuto il {formatDate(p.ricevuto_il)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
