import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addNonConformity,
  listNonConformities,
  nonConformitaDelMese,
  nonConformitaMesiConDati,
  riapriNonConformita,
  resolveNonConformity,
} from "../../lib/api/haccp";
import { NC_CATEGORIES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import ArchivioMensile from "../../components/ArchivioMensile";
import { NOMI_MESI } from "../../lib/nomiMesi";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import GiornataDiServizio from "../../components/GiornataDiServizio";

// Le non conformità: le APERTE in evidenza, le risolte in archivio.
//
// 🔴 COM'ERA (fino al 24/08/2026). Sotto le aperte c'era «Risolte»: tutte
// quelle chiuse dall'inizio, una sotto l'altra in ordine di data, per
// sempre. Dopo qualche settimana quella parte diventa illeggibile — e
// resta pure la più importante, perché è **la prova che il sistema ha
// funzionato**: c'era un problema, ecco cosa è stato fatto.
//
// ⚠️ QUINDI NON SI NASCONDE, SI ARCHIVIA, e l'archivio conserva per
// intero cosa è successo E cosa è stato fatto: davanti a un controllo,
// una non conformità risolta senza il suo rimedio scritto è peggio di una
// ancora aperta.
//
// ⚠️ E SI RAGGRUPPA ANCHE PER ATTREZZATURA (richiesta di Alessio): se lo
// stesso frigorifero va fuori norma tre volte in un giorno non sono tre
// disattenzioni, è un guasto da far vedere a un tecnico — e un elenco
// cronologico non lo mostra. Il conteggio lo fa il database, sulla
// giornata di servizio.
//
// ⚠️ IL FORMATO STAMPABILE È PROVVISORIO: quello che l'ASP vuole davvero
// lo dirà la biologa che segue l'HACCP.

const emptyForm = { category: "temperatura", description: "", note: "" };

export default function NonConformita() {
  const { isTitolare } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  const [resolvingId, setResolvingId] = useState(null);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [resolving, setResolving] = useState(false);

  const [mesi, setMesi] = useState([]);

  const load = useCallback(
    () =>
      Promise.all([listNonConformities(), leggi(nonConformitaMesiConDati())]).then(([nc, ms]) => {
        setItems(nc);
        setMesi(nonLetto(ms) ? [] : ms);
      }),
    []
  );

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  // Il contatore serve a far rileggere l'archivio dopo una riapertura:
  // cambiando la funzione, il componente comune la richiama.
  const [ricarica, setRicarica] = useState(0);
  const caricaMese = useCallback(
    (anno, mese) => nonConformitaDelMese(anno, mese),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ricarica]
  );

  const open = useMemo(() => items.filter((i) => !i.resolved), [items]);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!form.description.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addNonConformity({ category: form.category, description: form.description.trim(), note: form.note });
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleResolve = async (id) => {
    setResolving(true);
    setError("");
    try {
      await resolveNonConformity(id, { correctiveAction });
      setResolvingId(null);
      setCorrectiveAction("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setResolving(false);
    }
  };

  const handleRiapri = async (id) => {
    setError("");
    try {
      await riapriNonConformita(id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <p className="testo-sala text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link to="/haccp" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← HACCP
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Non conformità</h1>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Aperte</h2>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              {NC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrizione"
              className={`${inputClass} sm:col-span-2`}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={adding || !form.description.trim()}
              onClick={handleAdd}
              className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60 shrink-0"
            >
              {adding ? "Segnalo…" : "+ Segnala"}
            </button>
          </div>
        </div>

        {open.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft/60">Nessuna non conformità aperta.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((item) => (
              <li key={item.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 mr-1.5">
                      {labelFor(NC_CATEGORIES, item.category)}
                    </span>
                    <span className="testo-sala text-b58-charcoal">{item.description}</span>
                    <div className="testo-sala text-b58-charcoal-soft mt-0.5">{formatDate(item.detected_at)}</div>
                  </div>
                  {isTitolare && (
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId((id) => (id === item.id ? null : item.id));
                        setCorrectiveAction("");
                      }}
                      className="tocco-bottone testo-sala text-b58-terracotta hover:text-b58-terracotta-dark shrink-0"
                    >
                      {resolvingId === item.id ? "Annulla" : "Risolvi"}
                    </button>
                  )}
                </div>
                {resolvingId === item.id && (
                  <div className="mt-3 pt-3 border-t border-b58-charcoal/10 flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        value={correctiveAction}
                        onChange={(e) => setCorrectiveAction(e.target.value)}
                        placeholder="Cosa hai fatto per rimediare"
                        className={inputClass}
                      />
                      {/* ⚠️ La promessa era scritta solo nei messaggi: il
                          registro temperature dice «resta aperta finché non
                          scrivi cosa hai fatto», e si chiudeva col campo
                          vuoto. Nel manuale esibibile quella riga compariva
                          come risolta senza rimedio — davanti a un ispettore
                          è peggio di una ancora aperta. Dal 16/08 il divieto
                          è anche nel database: qui si dà solo l'errore
                          prima. */}
                      <p className="testo-sala text-b58-charcoal-soft/80 mt-1">
                        Obbligatorio: finisce nel manuale che si mostra a un controllo.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={resolving || !correctiveAction.trim()}
                      onClick={() => handleResolve(item.id)}
                      className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4  disabled:opacity-60"
                    >
                      {resolving ? "Confermo…" : "Conferma risoluzione"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------------------------------------------------------
          L'ARCHIVIO: quello che è successo, e cosa è stato fatto
          --------------------------------------------------------------- */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-3">Archivio</h2>
        <ArchivioMensile
          mesi={mesi}
          carica={caricaMese}
          nomeFile="non_conformita"
          vuoto="Ancora nessuna non conformità registrata."
          etichettaMese={(m) => (Number(m.aperte) > 0 ? `${m.quante}, ${m.aperte} aperte` : `${m.quante}`)}
          colonneCsv={[
            { label: "Giornata", value: (r) => r.giorno },
            { label: "Categoria", value: (r) => labelFor(NC_CATEGORIES, r.categoria) },
            { label: "Attrezzatura", value: (r) => r.attrezzatura ?? "" },
            { label: "Descrizione", value: (r) => r.descrizione },
            { label: "Rilevata il", value: (r) => new Date(r.rilevata_il).toLocaleString("it-IT") },
            { label: "Rimedio", value: (r) => r.rimedio ?? "" },
            { label: "Stato", value: (r) => (r.risolta ? "Risolta" : "Aperta") },
            { label: "Risolta il", value: (r) => (r.risolta_il ? new Date(r.risolta_il).toLocaleString("it-IT") : "") },
            { label: "Nota", value: (r) => r.nota ?? "" },
          ]}
        >
          {(righe, mese) => (
            <ArchivioNC
              righe={righe}
              mese={mese}
              isTitolare={isTitolare}
              onRiapri={async (id) => {
                await handleRiapri(id);
                // ⚠️ Si ricarica quello che è cambiato SUL SERVER, non
                // quello che si sta scrivendo altrove (trappola del 12/08).
                setRicarica((n) => n + 1);
              }}
            />
          )}
        </ArchivioMensile>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// L'archivio di un mese: prima gli apparecchi che hanno dato problemi più
// di una volta nella stessa giornata, poi il racconto per giornata.
// ---------------------------------------------------------------------
function ArchivioNC({ righe, mese, isTitolare, onRiapri }) {
  // 🔴 IL RAGGRUPPAMENTO PER APPARECCHIO. Il conteggio arriva dal
  // database — quante non conformità ha aperto quell'apparecchio in
  // QUELLA giornata — e qui si tengono solo le giornate in cui è
  // successo più di una volta: è il segnale che si sta cercando, e
  // mostrare anche i casi singoli lo annegherebbe fra il resto.
  const ripetuti = [];
  const visti = new Set();
  for (const r of righe) {
    if (!r.equipment_id || Number(r.quante_stesso_apparecchio) < 2) continue;
    const chiave = `${r.equipment_id}|${r.giorno}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    ripetuti.push(r);
  }

  const giornate = [];
  const per = new Map();
  for (const r of righe) {
    if (!per.has(r.giorno)) {
      per.set(r.giorno, []);
      giornate.push(r.giorno);
    }
    per.get(r.giorno).push(r);
  }

  return (
    <div>
      <p className="testo-sala text-b58-charcoal-soft mb-3">
        {NOMI_MESI[mese.mese - 1]} {mese.anno} — {righe.length} in {giornate.length}{" "}
        {giornate.length === 1 ? "giornata" : "giornate"}.
        {/* ⚠️ QUI HO SCRITTO DUE VOLTE LA STESSA COSA A DUE CENTIMETRI DI
            DISTANZA, e me ne sono accorto solo unificando le note ripetute
            un'ora dopo: c'era una didascalia «Come sono contate» che diceva
            la serata, e sotto la riga che la dice di nuovo. La didascalia è
            sparita e resta questa, perché questa **si stampa** — e il
            destinatario del foglio è chi viene a controllare. */}
        <GiornataDiServizio cosa="una registrazione" />
      </p>

      {ripetuti.length > 0 && (
        <div className="rounded-lg bg-b58-terracotta/10 ring-1 ring-b58-terracotta/40 p-3 mb-4">
          <p className="testo-sala text-b58-terracotta-dark font-medium mb-1">
            Stesso apparecchio più volte in un giorno
          </p>
          <p className="testo-sala text-b58-charcoal-soft mb-2">
            Non sono disattenzioni: è il segno di un guasto da far vedere a un tecnico.
          </p>
          <ul className="space-y-0.5">
            {ripetuti.map((r) => (
              <li key={`${r.equipment_id}-${r.giorno}`} className="testo-sala text-b58-charcoal">
                <strong>{r.attrezzatura}</strong> — {r.quante_stesso_apparecchio} volte il{" "}
                {formatDate(r.giorno)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {giornate.map((g) => (
          <div key={g} className="border-t border-b58-charcoal/10 pt-2">
            <div className="testo-sala text-b58-charcoal font-medium">{formatDate(g)}</div>
            <ul className="mt-1 space-y-1">
              {per.get(g).map((r) => (
                <li key={r.nc_id} className="testo-sala text-b58-charcoal-soft">
                  <span className="text-b58-charcoal">{labelFor(NC_CATEGORIES, r.categoria)}</span>
                  {r.attrezzatura ? ` · ${r.attrezzatura}` : ""} — {r.descrizione}
                  {/* ⚠️ Il rimedio si stampa SEMPRE: è la prova che il
                      sistema ha funzionato, ed è la metà che un controllo
                      vuole vedere. Se manca, si dice che manca. */}
                  <div>
                    {r.risolta ? (
                      <>
                        Risolta il {formatDate(r.risolta_il)} —{" "}
                        {r.rimedio ? (
                          <span className="text-b58-charcoal">{r.rimedio}</span>
                        ) : (
                          <span className="text-b58-terracotta-dark">rimedio non scritto</span>
                        )}
                      </>
                    ) : (
                      <span className="text-b58-terracotta-dark font-medium">Ancora aperta</span>
                    )}
                    {r.nota ? ` · ${r.nota}` : ""}
                    {/* La via di ritorno di «Risolvi»: chiusa per sbaglio,
                        resterebbe chiusa per sempre. Con la conferma, perché
                        riaprire una riga di un registro che si esibisce non è
                        un gesto da fare per sbaglio due volte. */}
                    {isTitolare && r.risolta && (
                      <span className="ml-2 print:hidden">
                        <ConfermaDistruttiva
                          etichetta="Riapri"
                          domanda={`Rimetto «${r.descrizione}» fra le non conformità aperte? Quello che avevi scritto come rimedio resta, e lo puoi correggere richiudendola.`}
                          etichettaConferma="Sì, riapri"
                          onConferma={() => onRiapri(r.nc_id)}
                        />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
