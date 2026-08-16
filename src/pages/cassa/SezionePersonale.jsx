import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  annullaPareggioAnticipazione,
  createAnticipazione,
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
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

// La sezione personale del titolare (Blocco 7).
//
// ⚠️ Non è «i tuoi soldi»: è il registro di quello che paghi tu per conto
// della società. Il verso opposto — prendere dalla cassa per spese
// personali — è escluso per decisione di Alessio, e infatti qui non c'è.

const annoCorrente = new Date().getFullYear();
const meseCorrente = new Date().getMonth() + 1;

const formaVuota = {
  importo: "",
  pagataIl: oggiLocale(),
  tagId: "",
  fondi: "contanti",
  supplierInvoiceId: "",
  documento: "",
  nota: "",
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
      listSupplierInvoices({ status: "da_pagare" }).catch(() => []),
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
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

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

  const aperte = note.filter((n) => !n.pareggiata_il);
  const chiuse = note.filter((n) => n.pareggiata_il).slice(0, 10);
  const fattureAperte = fatture;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa, Banca e Prima Nota
        </Link>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Ho messo di tasca mia</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Quello che paghi <strong>tu</strong> per conto della società, e che la società ti deve. I tuoi
        soldi personali non entrano qui: questo è solo il registro dei prestiti che le fai.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* ---- Il saldo, sempre in vista ---------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">
              La società ti deve
            </div>
            <div className="text-3xl font-medium text-b58-charcoal mb-1">
              {saldo ? formatEUR(saldo.ti_deve) : "—"}
            </div>
            <div className="text-xs text-b58-charcoal-soft">
              {saldo?.note_aperte ?? 0} note aperte
              {saldo?.piu_vecchia_il && <> · la più vecchia del {formatDate(saldo.piu_vecchia_il)}</>}
              {" · "}
              {formatEUR(saldo?.totale_anno ?? 0)} anticipati nel {annoCorrente}
            </div>
            {/* ⚠️ Il limite viaggia col numero: questo saldo non entra
                nella previsione di cassa, perché una nota aperta non ha
                una scadenza. */}
            <p className="text-[11px] text-b58-charcoal-soft mt-3 bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10">
              {saldo?.avvertenza}
            </p>
          </div>

          {/* ---- Da dire alla commercialista -------------------------- */}
          {daComunicare.length > 0 && (
            <div className="rounded-xl bg-b58-gold/10 ring-1 ring-b58-gold-dark/30 p-6 mb-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-1">
                Da dire alla commercialista ({daComunicare.length})
              </h2>
              <p className="text-[11px] text-b58-charcoal-soft/80 mb-3">
                Entrano qui da sole. <strong>Quello che si chiude dentro il mese resta un
                promemoria; quello che sopravvive al mese diventa formale.</strong>
              </p>
              <ul className="space-y-2">
                {daComunicare.map((d) => (
                  <li key={d.anticipazione_id} className="text-sm">
                    <span className="text-b58-charcoal font-medium">{formatEUR(d.importo)}</span>
                    <span className="text-b58-charcoal-soft"> · {formatDate(d.pagata_il)} · {d.tag}</span>
                    <div className="text-[11px] text-b58-charcoal-soft">{d.perche}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- Nuova nota ------------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-4">Ho pagato io</h2>

            {tag.length === 0 ? (
              <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
                <p className="text-sm text-b58-charcoal mb-1">
                  Prima serve almeno un <strong>motivo</strong>.
                </p>
                <p className="text-[11px] text-b58-charcoal-soft/80 mb-3">
                  I motivi li scegli tu, come le causali di cassa: «fornitore urgente», «spesa
                  veloce», «anticipo per lavori». Servono perché i totali per motivo sono la
                  diagnosi — se «fornitore urgente» domina la classifica, il problema non sono le
                  anticipazioni, è la cassa tenuta troppo scarica.
                </p>
                <div className="flex gap-2">
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
                    className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
                  >
                    + Crea
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
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
                      className={inputClass}
                    />
                  </div>
                  <div>
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
                  <div>
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
                  <p className="text-xs text-b58-charcoal-soft bg-b58-gold/10 rounded-lg px-3 py-2 mb-3">
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
                  </div>
                </div>

                {!form.documento.trim() && (
                  <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
                    Senza il riferimento al documento questa spesa <strong>non si scarica</strong>. Puoi
                    registrarla lo stesso — il debito verso di te resta — ma resterà indeducibile finché
                    non aggiungi il documento.
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <input
                    value={form.nota}
                    onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                    placeholder="Nota (opz.)"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    disabled={saving || !form.importo || !form.tagId}
                    onClick={registra}
                    className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
                  >
                    {saving ? "Registro…" : "+ Registra"}
                  </button>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-b58-charcoal/10">
                  <input
                    value={nuovoTag}
                    onChange={(e) => setNuovoTag(e.target.value)}
                    placeholder="Aggiungi un motivo nuovo…"
                    className={`${inputClass} text-xs`}
                  />
                  <button
                    type="button"
                    disabled={!nuovoTag.trim()}
                    onClick={aggiungiTag}
                    className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs px-3 py-2 disabled:opacity-60 shrink-0"
                  >
                    + Motivo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ---- Le note aperte --------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-1">Ancora da rimborsare</h2>
            <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
              Segnando il rimborso, i soldi <strong>escono davvero dalla cassa</strong>: il cassetto
              deve quadrare col conteggio fisico.
            </p>
            {aperte.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Niente in sospeso.</p>
            ) : (
              <ul className="space-y-2">
                {aperte.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-3 text-sm border-b border-b58-charcoal/5 last:border-0 pb-2 last:pb-0">
                    <span className="text-b58-charcoal">
                      <span className="font-medium">{formatEUR(n.importo)}</span>
                      <span className="text-b58-charcoal-soft"> · {formatDate(n.pagata_il)} · {n.tag?.etichetta}</span>
                      <div className="text-[11px] text-b58-charcoal-soft">
                        {n.fondi === "conto_personale" ? "dal tuo conto" : "contanti tuoi"}
                        {n.supplier_invoice_id && " · collegata a una fattura (la spesa è contata lì)"}
                        {!n.documento_riferimento && " · senza documento"}
                        {n.nota && ` · ${n.nota}`}
                      </div>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => pareggia(n.id)}
                        className="rounded-lg bg-b58-terracotta text-b58-parchment text-xs px-3 py-1.5"
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
              <h2 className="font-display text-lg text-b58-charcoal mb-1">Per motivo, nel {annoCorrente}</h2>
              <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
                È qui che si capisce. Se una voce domina la classifica, il problema di solito non sono
                le anticipazioni — è quello che le rende necessarie.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                    <th className="py-2 font-medium">Motivo</th>
                    <th className="py-2 pr-6 font-medium text-right">Quante</th>
                    <th className="py-2 pr-6 font-medium text-right">Totale</th>
                    <th className="py-2 font-medium text-right">Ancora aperte</th>
                  </tr>
                </thead>
                <tbody>
                  {perTag.map((r) => (
                    <tr key={r.tag} className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="py-2 text-b58-charcoal">{r.tag}</td>
                      <td className="py-2 pr-6 text-right text-b58-charcoal-soft">{r.quante}</td>
                      <td className="py-2 pr-6 text-right text-b58-charcoal">{formatEUR(r.totale)}</td>
                      <td className="py-2 text-right text-b58-charcoal-soft">
                        {r.aperte > 0 ? formatEUR(r.da_pagare) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- Le ultime chiuse ------------------------------------- */}
          {chiuse.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-4">Già rimborsate</h2>
              <ul className="space-y-1.5">
                {chiuse.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-b58-charcoal-soft">
                      {formatDate(n.pagata_il)} · {n.tag?.etichetta}
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
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
              <p className="text-xs text-b58-charcoal-soft/70 mt-3">
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
