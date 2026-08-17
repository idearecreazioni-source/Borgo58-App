import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listCleaningLogs,
  listCleaningTasks,
  listEquipment,
  listForagedItems,
  listGoodsReceiving,
  listNonConformities,
  listPestControlLogs,
  listTemperatureLogs,
} from "../../lib/api/haccp";
import { esitoRicevimento } from "../../lib/calcoli/haccp";
import { CLEANING_FREQUENCIES, NC_CATEGORIES, PEST_CONTROL_TYPES, formatDate, labelFor, oggiLocale, traGiorniLocale } from "../../lib/constants";
import PrintButton from "../../components/PrintButton";

const SectionTitle = ({ children }) => (
  <h2 className="font-display text-lg text-b58-charcoal mt-8 mb-3 pb-1 border-b border-b58-charcoal/15">
    {children}
  </h2>
);

// Filtro di periodo (§3.19 punto 5): dentro il periodo dichiarato il
// documento è COMPLETO — sono spariti i tagli silenziosi ("ultime 15
// rilevazioni") che facevano sembrare intero un registro che non lo era.
// Il periodo è scritto in testa al documento stampato: un ispettore vede
// subito cosa sta guardando, e "Tutto" resta a un tocco.
export default function ManualeCompleto() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dal, setDal] = useState(traGiorniLocale(-30));
  const [al, setAl] = useState(oggiLocale());
  const [tutto, setTutto] = useState(false);

  const periodo = tutto ? undefined : { dal, al };

  useEffect(() => {
    setData(null);
    Promise.all([
      listEquipment(),
      listTemperatureLogs(null, periodo),
      listGoodsReceiving(periodo),
      listCleaningTasks(),
      listCleaningLogs(null, periodo),
      listPestControlLogs(periodo),
      listNonConformities(periodo),
      listForagedItems(periodo),
    ])
      .then(([equipment, temperatureLogs, goodsReceiving, cleaningTasks, cleaningLogs, pestLogs, nonConformities, foragedItems]) =>
        setData({ equipment, temperatureLogs, goodsReceiving, cleaningTasks, cleaningLogs, pestLogs, nonConformities, foragedItems })
      )
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dal, al, tutto]);

  const lastCleaningFor = (taskId) => data?.cleaningLogs.find((l) => l.task_id === taskId)?.completed_at;

  const impostaGiorni = (giorni) => {
    setDal(traGiorniLocale(-giorni));
    setAl(oggiLocale());
    setTutto(false);
  };

  const chipClass = (attivo) =>
    `text-xs rounded-full px-3 py-1.5 border ${attivo ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`;
  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-2 py-1.5 text-sm text-b58-charcoal";

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2 print:hidden">
        <Link to="/haccp" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← HACCP
        </Link>
        <PrintButton label="Esporta manuale in PDF" />
      </div>

      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
        Piano di Autocontrollo — Borgo 58
      </h1>
      {/* Il periodo è parte del DOCUMENTO, non un dettaglio a schermo:
          va stampato, perché dichiara di cosa il registro è completo. */}
      <p className="text-b58-charcoal-soft mt-1">
        Generato il {formatDate(oggiLocale())}.{" "}
        {tutto
          ? "Registro completo dall'avvio dell'attività."
          : `Registrazioni dal ${formatDate(dal)} al ${formatDate(al)}.`}{" "}
        Le non conformità aperte sono sempre incluse.
      </p>

      <div className="flex items-center gap-2 flex-wrap mt-3 print:hidden">
        <button type="button" onClick={() => impostaGiorni(30)} className={chipClass(!tutto && dal === traGiorniLocale(-30))}>
          Ultimi 30 giorni
        </button>
        <button type="button" onClick={() => impostaGiorni(90)} className={chipClass(!tutto && dal === traGiorniLocale(-90))}>
          Ultimi 90
        </button>
        <button type="button" onClick={() => setTutto(true)} className={chipClass(tutto)}>
          Tutto
        </button>
        <span className="text-xs text-b58-charcoal-soft ml-2">dal</span>
        <input type="date" value={dal} onChange={(e) => { setDal(e.target.value); setTutto(false); }} className={inputClass} />
        <span className="text-xs text-b58-charcoal-soft">al</span>
        <input type="date" value={al} onChange={(e) => { setAl(e.target.value); setTutto(false); }} className={inputClass} />
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-4 print:hidden">
          {error}
        </p>
      )}

      {!data ? (
        <p className="text-sm text-b58-charcoal-soft mt-6">Caricamento…</p>
      ) : (
        <>
          <SectionTitle>Attrezzature e registro temperature</SectionTitle>
          {data.equipment.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessuna attrezzatura registrata.</p>
          ) : (
            data.equipment.map((eq) => {
              // Niente tagli: dentro il periodo dichiarato si stampa TUTTO.
              const readings = data.temperatureLogs.filter((l) => l.equipment_id === eq.id);
              return (
                <div key={eq.id} className="mb-4">
                  <p className="text-sm text-b58-charcoal font-medium">
                    {eq.name}
                    {eq.target_min_c != null && (
                      <span className="text-b58-charcoal-soft font-normal"> — range target {eq.target_min_c}°/{eq.target_max_c}°C</span>
                    )}
                  </p>
                  {readings.length === 0 ? (
                    <p className="text-xs text-b58-charcoal-soft/60">Nessuna rilevazione.</p>
                  ) : (
                    <table className="w-full text-sm mt-1">
                      <tbody>
                        {readings.map((r) => (
                          <tr key={r.id} className="border-b border-b58-charcoal/5">
                            <td className="py-1 text-b58-charcoal-soft">{formatDate(r.recorded_at)}</td>
                            <td className="py-1 text-b58-charcoal-soft">{r.recorded_temp_c}°C</td>
                            <td className="py-1">
                              {r.target_min_c == null ? "" : r.is_compliant ? (
                                <span className="text-b58-olive-dark text-xs">conforme</span>
                              ) : (
                                <span className="text-b58-terracotta-dark text-xs font-medium">fuori range</span>
                              )}
                            </td>
                            <td className="py-1 text-b58-charcoal-soft text-xs">{r.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}

          <SectionTitle>Ricevimento merci</SectionTitle>
          {data.goodsReceiving.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessun ricevimento registrato.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-1.5 font-medium">Data</th>
                  <th className="py-1.5 font-medium">Prodotto</th>
                  <th className="py-1.5 font-medium">Fornitore</th>
                  <th className="py-1.5 font-medium">Esito</th>
                </tr>
              </thead>
              <tbody>
                {data.goodsReceiving.map((r) => (
                  <tr key={r.id} className="border-b border-b58-charcoal/5">
                    <td className="py-1.5 text-b58-charcoal-soft">{formatDate(r.received_at)}</td>
                    <td className="py-1.5 text-b58-charcoal">{r.product_description}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">{r.supplier?.name ?? "—"}</td>
                    {/* ⚠️ L'esito lo decide `esitoRicevimento()`, non un
                        confronto scritto qui: prima questa colonna
                        guardava solo «merce conforme» e ignorava
                        l'imballaggio, quindi il manuale dichiarava
                        «conforme» una consegna che due sezioni più sotto
                        compariva fra le non conformità. */}
                    <td className="py-1.5">
                      {(() => {
                        const esito = esitoRicevimento(r);
                        return esito.conforme ? (
                          <span className="text-b58-olive-dark text-xs">conforme</span>
                        ) : (
                          <span className="text-b58-terracotta-dark text-xs font-medium">
                            {esito.etichetta}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SectionTitle>Pulizia e sanificazione</SectionTitle>
          {data.cleaningTasks.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessuna attività definita.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-1.5 font-medium">Attività</th>
                  <th className="py-1.5 font-medium">Frequenza</th>
                  <th className="py-1.5 font-medium">Ultima esecuzione</th>
                </tr>
              </thead>
              <tbody>
                {data.cleaningTasks.map((t) => (
                  <tr key={t.id} className="border-b border-b58-charcoal/5">
                    <td className="py-1.5 text-b58-charcoal">{t.name}{t.area ? ` · ${t.area}` : ""}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">{labelFor(CLEANING_FREQUENCIES, t.frequency)}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">
                      {lastCleaningFor(t.id)
                        ? formatDate(lastCleaningFor(t.id))
                        : tutto
                          ? "mai eseguita"
                          : "nessuna nel periodo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SectionTitle>Disinfestazione</SectionTitle>
          {data.pestLogs.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessun intervento registrato.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.pestLogs.map((p) => (
                  <tr key={p.id} className="border-b border-b58-charcoal/5">
                    <td className="py-1.5 text-b58-charcoal-soft">{formatDate(p.performed_at)}</td>
                    <td className="py-1.5 text-b58-charcoal">{labelFor(PEST_CONTROL_TYPES, p.type)}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">{p.performed_by}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">{p.findings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SectionTitle>Raccolta propria</SectionTitle>
          {data.foragedItems.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessuna raccolta registrata.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.foragedItems.map((f) => (
                  <tr key={f.id} className="border-b border-b58-charcoal/5">
                    <td className="py-1.5 text-b58-charcoal-soft">{formatDate(f.harvest_date)}</td>
                    <td className="py-1.5 text-b58-charcoal">{f.species}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">{f.harvest_location}</td>
                    <td className="py-1.5 text-b58-charcoal-soft text-xs">{f.internal_lot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SectionTitle>Non conformità</SectionTitle>
          {data.nonConformities.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessuna non conformità registrata.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-1.5 font-medium">Data</th>
                  <th className="py-1.5 font-medium">Categoria</th>
                  <th className="py-1.5 font-medium">Descrizione</th>
                  <th className="py-1.5 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {data.nonConformities.map((nc) => (
                  <tr key={nc.id} className="border-b border-b58-charcoal/5">
                    <td className="py-1.5 text-b58-charcoal-soft">{formatDate(nc.detected_at)}</td>
                    <td className="py-1.5 text-b58-charcoal-soft">{labelFor(NC_CATEGORIES, nc.category)}</td>
                    <td className="py-1.5 text-b58-charcoal">
                      {nc.description}
                      {nc.corrective_action && (
                        <div className="text-xs text-b58-charcoal-soft">Azione: {nc.corrective_action}</div>
                      )}
                    </td>
                    <td className="py-1.5">
                      {nc.resolved ? (
                        <span className="text-b58-olive-dark text-xs">risolta</span>
                      ) : (
                        <span className="text-b58-terracotta-dark text-xs font-medium">aperta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
