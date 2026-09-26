import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  annullaPareggioAnticipazione,
  createAnticipazione,
  segnaInvestimentoAnticipazione,
  createTagAnticipazione,
  deleteAnticipazione,
  getSaldoAnticipazioni,
  listAnticipazioni,
  listAnticipazioniPerTag,
  listDaComunicare,
  listTagAnticipazioni,
  pareggiaAnticipazione,
} from "../../lib/api/anticipazioni";
import { listSupplierInvoices } from "../../lib/api/supplierInvoices";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale } from "../../lib/constants";
import ElencoAdattivo from "../../components/ElencoAdattivo";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { doveEntraLaSpesa } from "../../lib/calcoli/investimento";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

// La sezione personale del titolare (Blocco 7).
//
// ⚠️ Non è «i tuoi soldi»: è il registro di quello che paghi tu per conto
// della società. Il verso opposto — prendere dalla cassa per spese
// personali — è escluso per decisione di Alessio, e infatti qui non c'è.

const annoCorrente = new Date().getFullYear();
const meseCorrente = new Date().getMonth() + 1;

// ⚠️ CALENDARIO, e non serata: una nota pagata di tasca propria è una
// spesa fatta in un giorno, non in un servizio. Dichiarato qui perché non
// venga «uniformato» alla cassa: il perimetro della serata è di due gesti
// soli (19/08).
const formaVuota = {
  importo: "",
  pagataIl: oggiLocale(),
  tagId: "",
  fondi: "contanti",
  supplierInvoiceId: "",
  documento: "",
  nota: "",
  // 🔴 NASCE SPENTA (C11, 21/09/2026): se Alessio non sceglie, questa
  //    nota non e' un investimento. Nessuna regola lo deduce dal motivo,
  //    dall'importo o dal testo.
  eInvestimento: false,
};

export default function SezionePersonale() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [saldo, setSaldo] = useState(null);
  const [note, setNote] = useState([]);
  const [tag, setTag] = useState([]);
  const [perTag, setPerTag] = useState([]);
  const [daComunicare, setDaComunicare] = useState([]);
  const [fatture, setFatture] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(formaVuota);
  const [nuovoTag, setNuovoTag] = useState("");
  const [saving, setSaving] = useState(false);
  // 🔴 L'ESITO VA SULLA RIGA TOCCATA, non in cima alla pagina: un rifiuto
  //    lontano dal gesto e' un rifiuto che non c'e' (lezione del 17/08,
  //    pagata una volta proprio in Cassa).
  const [marcando, setMarcando] = useState(null);
  const [erroreRiga, setErroreRiga] = useState({});

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const ricarica = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      getSaldoAnticipazioni(entityId),
      listAnticipazioni(entityId),
      listTagAnticipazioni({ soloAttivi: true }),
      listAnticipazioniPerTag(entityId, annoCorrente),
      listDaComunicare(entityId, annoCorrente, meseCorrente),
      leggi(listSupplierInvoices({ status: "da_pagare" })),
    ]).then(([s, n, t, pt, dc, f]) => {
      setSaldo(s);
      setNote(n);
      setTag(t);
      setPerTag(pt);
      setDaComunicare(dc);
      setFatture(f);
      // Il menu dei tag non deve restare quello di prima quando se ne crea
      // uno nuovo (trappola del 12/08, la lista caricata una volta sola).
      setForm((prev) => (prev.tagId ? prev : { ...prev, tagId: t[0]?.id ?? "" }));
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const aggiungiTag = async () => {
    if (!nuovoTag.trim()) return;
    try {
      const creato = await createTagAnticipazione(nuovoTag);
      setNuovoTag("");
      await ricarica();
      setForm((f) => ({ ...f, tagId: creato.id }));
    } catch (e) {
      setError(e.message);
    }
  };

  const registra = async () => {
    if (!form.importo || !form.tagId) return;
    setSaving(true);
    setError("");
    try {
      await createAnticipazione({ ...form, entityId });
      setForm({ ...formaVuota, tagId: form.tagId, pagataIl: form.pagataIl });
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 🔴 MARCARE E SMARCARE UNA NOTA GIA' SCRITTA, senza ricrearla.
  //
  // ⚠️ Il rifiuto del database e' un'INFORMAZIONE e va letto dove si e'
  //    premuto: dice quale delle due cose e' gia' contata — questa nota o
  //    l'uscita che paga la stessa fattura — e come cambiare idea.
  const segnaInvestimento = async (n, valore) => {
    setMarcando(n.id);
    setErroreRiga((e) => ({ ...e, [n.id]: "" }));
    try {
      const aggiornata = await segnaInvestimentoAnticipazione(n.id, valore);
      // ⚠️ Si aggiorna SOLO la riga toccata: una ricarica completa
      //    butterebbe via quello che si sta scrivendo nel modulo sopra
      //    (trappola del 12/08).
      setNote((righe) => righe.map((r) => (r.id === n.id ? { ...r, ...aggiornata } : r)));
    } catch (e) {
      setErroreRiga((err) => ({ ...err, [n.id]: e.message }));
    } finally {
      setMarcando(null);
    }
  };

  const pareggia = async (id) => {
    setError("");
    try {
      await pareggiaAnticipazione(id, oggiLocale());
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const elimina = async (id) => {
    setError("");
    try {
      await deleteAnticipazione(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // La via di ritorno del pareggio. Il rifiuto di cancellare una nota già
  // rimborsata è giusto — in cassa c'è l'uscita — ma senza questo gesto
  // sarebbe un muro.
  const annullaRimborso = async (id) => {
    setError("");
    try {
      await annullaPareggioAnticipazione(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // 🔴 DOVE FINISCE UNA SPESA MARCATA, per la società scelta qui sopra.
  //    La regola vive in `src/lib/calcoli/investimento.js`, dove si prova
  //    senza montare la schermata, e la chiede alla STESSA funzione che
  //    decide i totali: la spiegazione non può più raccontare un ordine
  //    diverso da quello che il gestionale fa.
  const soggetto = entities
    ? [entities.srls, entities.agricola, entities.tasca].find((e) => e?.id === entityId)
    : null;
  const dove = doveEntraLaSpesa(soggetto);

  const aperte = note.filter((n) => !n.pareggiata_il);
  const chiuse = note.filter((n) => n.pareggiata_il).slice(0, 10);
  const fattureAperte = nonLetto(fatture) ? [] : fatture;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa, Banca e Prima Nota
        </Link>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala-grande text-b58-charcoal"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Ho messo di tasca mia</h1>
      <p className="testo-sala text-b58-charcoal-soft/80 mb-6">
        Quello che paghi <strong>tu</strong> per conto della società, e che la società ti deve. I tuoi
        soldi personali non entrano qui: questo è solo il registro dei prestiti che le fai.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* ---- Il saldo, sempre in vista ---------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
              La società ti deve
            </div>
            <div className="text-3xl font-medium text-b58-charcoal mb-1">
              {saldo ? formatEUR(saldo.ti_deve) : "—"}
            </div>
            <div className="testo-sala text-b58-charcoal-soft">
              {saldo?.note_aperte ?? 0} note aperte
              {saldo?.piu_vecchia_il && <> · la più vecchia del {formatDate(saldo.piu_vecchia_il)}</>}
              {" · "}
              {formatEUR(saldo?.totale_anno ?? 0)} anticipati nel {annoCorrente}
            </div>
            {/* ⚠️ Il limite viaggia col numero: questo saldo non entra
                nella previsione di cassa, perché una nota aperta non ha
                una scadenza. */}
            <p className="testo-sala text-b58-charcoal-soft mt-3 bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10">
              {saldo?.avvertenza}
            </p>
          </div>

          {/* ---- Da dire alla commercialista -------------------------- */}
          {daComunicare.length > 0 && (
            <div className="rounded-xl bg-b58-gold/10 ring-1 ring-b58-gold-dark/30 p-6 mb-6">
              <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">
                Da dire alla commercialista ({daComunicare.length})
              </h2>
              <p className="testo-sala text-b58-charcoal-soft/80 mb-3">
                Entrano qui da sole. <strong>Quello che si chiude dentro il mese resta una
                nota; quello che sopravvive al mese diventa formale.</strong>
              </p>
              <ul className="space-y-2">
                {daComunicare.map((d) => (
                  <li key={d.anticipazione_id} className="testo-sala-grande">
                    <span className="text-b58-charcoal font-medium">{formatEUR(d.importo)}</span>
                    <span className="text-b58-charcoal-soft"> · {formatDate(d.pagata_il)} · {d.tag}</span>
                    <div className="testo-sala text-b58-charcoal-soft">{d.perche}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- Nuova nota ------------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Ho pagato io</h2>

            {tag.length === 0 ? (
              <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
                <p className="testo-sala-grande text-b58-charcoal mb-1">
                  Prima serve almeno un <strong>motivo</strong>.
                </p>
                <p className="testo-sala text-b58-charcoal-soft/80 mb-3">
                  Li scegli tu, come le causali di cassa.
                  <Didascalia etichetta="A cosa servono">
                    «Fornitore urgente», «spesa veloce», «anticipo per lavori». Servono
                    perché i totali per motivo sono la diagnosi: se una voce domina la
                    classifica, il problema di solito non sono le anticipazioni — è quello
                    che le rende necessarie.
                  </Didascalia>
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={nuovoTag}
                    onChange={(e) => setNuovoTag(e.target.value)}
                    placeholder="es. Fornitore urgente"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={!nuovoTag.trim()}
                    onClick={aggiungiTag}
                    className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60 shrink-0"
                  >
                    + Crea
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
                {/* SPEC-0010, 11/09/2026: «Quando» in mezza riga (132 punti)
                    si tagliava — chiedeva 181, 260 a 64 punti per cm. */}
                <div className="riga-campi mb-3">
                  <div className="cella-media">
                    <label className={labelClass}>Importo €</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.importo}
                      onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Quando</label>
                    <input
                      type="date"
                      value={form.pagataIl}
                      onChange={(e) => setForm((f) => ({ ...f, pagataIl: e.target.value }))}
                      className={`${inputClass} campo-data`}
                    />
                  </div>
                  <div className="cella-larga">
                    <label className={labelClass}>Motivo</label>
                    <select
                      value={form.tagId}
                      onChange={(e) => setForm((f) => ({ ...f, tagId: e.target.value }))}
                      className={inputClass}
                    >
                      {tag.map((t) => (
                        <option key={t.id} value={t.id}>{t.etichetta}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cella-larga">
                    <label className={labelClass}>Con che soldi</label>
                    <select
                      value={form.fondi}
                      onChange={(e) => setForm((f) => ({ ...f, fondi: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="contanti">contanti miei</option>
                      <option value="conto_personale">il mio conto</option>
                    </select>
                  </div>
                </div>

                {form.fondi === "conto_personale" && (
                  <p className="testo-sala text-b58-charcoal-soft bg-b58-gold/10 rounded-lg px-3 py-2 mb-3">
                    Pagando dal tuo conto, nei registri la spesa risulta pagata da un conto che non è
                    della società: questa nota <strong>entrerà da sola</strong> fra quelle da dire alla
                    commercialista.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Rif. documento</label>
                    <input
                      value={form.documento}
                      onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                      placeholder="numero dello scontrino o della ricevuta"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    {/* ⚠️ È il campo che evita di contare la stessa spesa
                        due volte: se c'è già la fattura, il costo è contato
                        lì e questa nota è solo il debito verso di te. */}
                    <label className={labelClass}>C&apos;è già una fattura?</label>
                    <select
                      value={form.supplierInvoiceId}
                      onChange={(e) => setForm((f) => ({ ...f, supplierInvoiceId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">no, la spesa è solo questa</option>
                      {fattureAperte.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.supplier?.name ?? "fornitore"} · {formatEUR(f.amount)} · {formatDate(f.invoice_date)}
                        </option>
                      ))}
                    </select>
                    {/* 🔴 Un menu vuoto qui non è innocuo: si legge «non c'è
                        nessuna fattura aperta», e si registra la nota come
                        spesa a sé — cioè LA STESSA SPESA CONTATA DUE VOLTE,
                        che è precisamente quello che questo campo esiste per
                        evitare. */}
                    {nonLetto(fatture) && (
                      <DatoNonLetto cosa="le fatture ancora da pagare" className="mt-1" />
                    )}
                  </div>
                </div>

                {!form.documento.trim() && (
                  <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
                    Senza il riferimento al documento questa spesa <strong>non si scarica</strong>. Puoi
                    registrarla lo stesso — il debito verso di te resta — ma resterà indeducibile finché
                    non aggiungi il documento.
                  </p>
                )}

                {/* 🔴 «INVESTIMENTO PER IL PROGETTO» ANCHE QUI — C11,
                    21/09/2026, decisione di Alessio. È il punto in cui la
                    spesa VIVE: quello che anticipi per conto della società
                    non passa dalla Prima nota, e senza questa casella non
                    avrebbe nessuna porta per entrare nel costo del progetto.
                    ⚠️ La spiegazione sta dietro il segno e non accanto al
                    nome: una nota affiancata a una spunta toglie spazio
                    proprio al nome che spiega (misurato il 25/08). */}
                <label
                  data-prova="investimento-nota-nuova"
                  className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft mb-3"
                >
                  <input
                    type="checkbox"
                    checked={form.eInvestimento}
                    onChange={(e) => setForm((f) => ({ ...f, eInvestimento: e.target.checked }))}
                  />
                  <span>Investimento per il progetto</span>
                  {/* 🔴 LA SPIEGAZIONE SEGUE LA SOCIETÀ SCELTA — 21/09/2026.
                      Qui sopra il menu offre Borgo 58 **oppure** l'orto, e
                      questa didascalia diceva sempre «entra sotto Borgo 58»:
                      su una nota dell'orto era falso, perché quella spesa
                      finisce sotto l'orto e l'orto sta FUORI dal totale del
                      progetto.
                      ⚠️ Non era una svista di parole: la regola di calcolo
                      era già giusta — si raggruppa per soggetto — e la
                      spiegazione ne raccontava una diversa. Due parti dello
                      stesso programma che dicono cose diverse dello stesso
                      fatto.
                      ⚠️ E la regola NON cambia: chi entra lo decide
                      `doveEntraLaSpesa`, che lo chiede alla stessa funzione
                      dei totali. Se un giorno cambiasse chi entra, la frase
                      cambierebbe da sola invece di restare indietro. */}
                  <Didascalia etichetta="Cosa vuol dire «investimento per il progetto»">
                    <span data-prova="aiuto-investimento-nota">
                      Spunta questa casella quando quello che hai anticipato serve a{" "}
                      <strong>mettere in piedi il locale</strong> — arredi, attrezzature, lavori,
                      pratiche — e non alla gestione di tutti i giorni.
                      <br />
                      <br />
                      {dove.nome === null ? (
                        // ⚠️ Se non si sa quale società è selezionata non si
                        //    nomina nessuno: meglio dire meno che dire una
                        //    cosa che potrebbe essere falsa.
                        <>
                          Entra in <em>Cassa → Quanto è costato il progetto</em>, sotto la
                          società che hai scelto qui sopra.
                        </>
                      ) : dove.dentro ? (
                        <>
                          Entra in <em>Cassa → Quanto è costato il progetto</em> sotto{" "}
                          <strong>{dove.nome}</strong>, perché è una spesa fatta per conto della
                          società, e conta <strong>nel totale del progetto</strong>.
                        </>
                      ) : (
                        <>
                          Entra in <em>Cassa → Quanto è costato il progetto</em> sotto{" "}
                          <strong>{dove.nome}</strong>, ma{" "}
                          <strong>fuori dal totale del progetto</strong>: l'orto è un'altra
                          impresa, e una spesa per l'orto non è una spesa per aprire l'osteria.
                          La vedi lì lo stesso, dichiarata a parte col suo importo — non sparisce.
                        </>
                      )}{" "}
                      E ci resta <strong>uguale anche dopo che ti sei rimborsato</strong>: il
                      rimborso non è una spesa nuova, è un debito che si chiude.
                      <br />
                      <br />
                      Non cambia la deducibilità, l'IVA né nessun calcolo delle imposte.
                    </span>
                  </Didascalia>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    value={form.nota}
                    onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                    placeholder="Nota (facoltativa)"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    disabled={saving || !form.importo || !form.tagId}
                    onClick={registra}
                    className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60 shrink-0"
                  >
                    {saving ? "Registro…" : "+ Registra"}
                  </button>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-b58-charcoal/10">
                  <input
                    value={nuovoTag}
                    onChange={(e) => setNuovoTag(e.target.value)}
                    placeholder="Aggiungi un motivo nuovo…"
                    className={`${inputClass} testo-sala`}
                  />
                  <button
                    type="button"
                    disabled={!nuovoTag.trim()}
                    onClick={aggiungiTag}
                    className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala px-3 py-2 disabled:opacity-60 shrink-0"
                  >
                    + Motivo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ---- Le note aperte --------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Ancora da rimborsare</h2>
            <p className="testo-sala text-b58-charcoal-soft/70 mb-4">
              Segnando il rimborso, i soldi <strong>escono davvero dalla cassa</strong>: il cassetto
              deve quadrare col conteggio fisico.
            </p>
            {aperte.length === 0 ? (
              <p className="testo-sala-grande text-b58-charcoal-soft/60">Niente in sospeso.</p>
            ) : (
              <ul className="space-y-2">
                {aperte.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 testo-sala-grande border-b border-b58-charcoal/5 last:border-0 pb-2 last:pb-0">
                    <span className="text-b58-charcoal">
                      <span className="font-medium">{formatEUR(n.importo)}</span>
                      <span className="text-b58-charcoal-soft"> · {formatDate(n.pagata_il)} · {n.tag?.etichetta}</span>
                      <div className="testo-sala text-b58-charcoal-soft">
                        {n.fondi === "conto_personale" ? "dal tuo conto" : "contanti tuoi"}
                        {/* ⚠️ LA FRASE DICE DI QUALE CONTEGGIO PARLA — C11,
                            21/09/2026. Prima diceva «la spesa è contata lì»
                            senza dire dove, e da oggi non è più vero in
                            generale: per il FISCO il costo resta sulla
                            fattura (regola del 16/08, non toccata), ma nel
                            costo del progetto questa nota può entrare — è
                            denaro uscito per il locale. Una frase che vale
                            per un conteggio e non per l'altro va detta
                            intera, o diventa falsa senza cambiare. */}
                        {n.supplier_invoice_id && " · collegata a una fattura (il costo fiscale è contato sulla fattura)"}
                        {!n.documento_riferimento && " · senza documento"}
                        {n.nota && ` · ${n.nota}`}
                      </div>
                      <label
                        data-prova="investimento-nota"
                        className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(n.e_investimento)}
                          disabled={marcando === n.id}
                          onChange={(e) => segnaInvestimento(n, e.target.checked)}
                        />
                        <span>
                          Investimento per il progetto
                          {marcando === n.id ? " — salvo…" : ""}
                        </span>
                      </label>
                      {erroreRiga[n.id] && (
                        <p
                          data-prova="investimento-nota-errore"
                          className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-1"
                        >
                          {erroreRiga[n.id]}
                        </p>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => pareggia(n.id)}
                        className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-3 py-1.5"
                      >
                        Mi sono rimborsato
                      </button>
                      <ConfermaDistruttiva
                        etichetta="✕"
                        cosaSparisce={`la nota da ${formatEUR(n.importo)} del ${formatDate(n.pagata_il)}`}
                        onConferma={() => elimina(n.id)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---- I totali per motivo — la diagnosi -------------------- */}
          {perTag.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
              <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
                Per motivo, nel {annoCorrente}
                <Didascalia>
                  È qui che si capisce. Se una voce domina la classifica, il problema di
                  solito non sono le anticipazioni — è quello che le rende necessarie.
                </Didascalia>
              </h2>
              <ElencoAdattivo
                righe={perTag}
                chiave={(r) => r.tag}
                titolo={(r) => r.tag}
                intestazioneTitolo="Motivo"
                campi={(r) => [
                  { chiave: "quante", etichetta: "Quante", valore: String(r.quante) },
                  { chiave: "totale", etichetta: "Totale", valore: formatEUR(r.totale), forte: true },
                  {
                    chiave: "aperte",
                    etichetta: "Ancora aperte",
                    valore: r.aperte > 0 ? formatEUR(r.da_pagare) : "",
                  },
                ]}
              />
            </div>
          )}

          {/* ---- Le ultime chiuse ------------------------------------- */}
          {chiuse.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
              <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Già rimborsate</h2>
              <ul className="space-y-1.5">
                {chiuse.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 testo-sala-grande">
                    <span className="text-b58-charcoal-soft">
                      {formatDate(n.pagata_il)} · {n.tag?.etichetta}
                      {/* 🔴 SI MARCA ANCHE UNA NOTA GIA' RIMBORSATA, ed è la
                          decisione di Alessio del 21/09: il costo del
                          progetto è lo stesso prima e dopo il rimborso. Il
                          rimborso chiude un debito, non annulla una spesa. */}
                      <label
                        data-prova="investimento-nota-chiusa"
                        className="tocco-campo flex items-center gap-2 testo-sala text-b58-charcoal-soft"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(n.e_investimento)}
                          disabled={marcando === n.id}
                          onChange={(e) => segnaInvestimento(n, e.target.checked)}
                        />
                        <span>
                          Investimento per il progetto
                          {marcando === n.id ? " — salvo…" : ""}
                        </span>
                      </label>
                      {erroreRiga[n.id] && (
                        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-1">
                          {erroreRiga[n.id]}
                        </p>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-b58-charcoal-soft">
                        {formatEUR(n.importo)} · rimborsata il {formatDate(n.pareggiata_il)}
                      </span>
                      {/* Toglie un'uscita vera dal cassetto: chiede conferma
                          come ogni gesto che sposta denaro. */}
                      <ConfermaDistruttiva
                        etichetta="Annulla il rimborso"
                        domanda={`Tolgo dalla cassa l'uscita di ${formatEUR(n.importo)} e riapro la nota?`}
                        etichettaConferma="Sì, annulla"
                        onConferma={() => annullaRimborso(n.id)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="testo-sala text-b58-charcoal-soft/70 mt-3">
                Una nota già rimborsata non si può togliere: in cassa c'è l'uscita
                che la registra. Annullando il rimborso l'uscita sparisce e la nota
                torna aperta.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
