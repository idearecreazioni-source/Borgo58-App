import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  confermaAzione,
  getAllegatoUrl,
  listPostaInAttesa,
  rifiutaAzione,
  scartaPosta,
} from "../../lib/api/posta";
import { listIngredients } from "../../lib/api/ingredients";
import { variazionePrezzo } from "../../lib/api/assistente";
import { listSuppliers } from "../../lib/api/suppliers";
import { formatDate } from "../../lib/constants";

// La posta arrivata al locale, in attesa di una decisione.
//
// Forma decisa da Alessio il 12/08/2026, dopo aver visto la prima
// versione: non una scheda da compilare — «i campi predefiniti non
// possono adeguarsi a qualunque cosa arrivi» — ma **un elenco di cose da
// fare**, ognuna con il suo Conferma o Rifiuta.
//
// I campi restano modificabili prima di confermare: quello che si
// conferma è la lettura fatta da qualcun altro, e ci si aspetta di doverla
// correggere ogni tanto. Quello che parte è ciò che Alessio vede, non ciò
// che l'assistente aveva scritto.

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";
const campo =
  "w-full min-w-0 rounded-lg border border-b58-charcoal/15 bg-white px-2.5 py-1.5 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const etichetta = "block text-[11px] uppercase tracking-wide text-b58-charcoal-soft mb-1";

const NOME_TIPO = {
  archivia_documento: "Archivio",
  archivia_testo: "Archivio",
  promemoria: "Agenda",
  promemoria_multipli: "Agenda",
  carico_magazzino: "Magazzino",
  da_fare_a_mano: "Da fare tu",
  nessuna: "Niente",
};

// Quali campi ha senso mostrare per ciascun tipo di azione — e si vedono
// solo premendo «modifica». È il punto della seconda critica di Alessio:
// i campi servono a correggere, non a capire. Quello che si legge è la
// descrizione.
const CAMPI = {
  archivia_documento: ["titolo", "tipo", "controparte", "data", "importo", "scadenza"],
  archivia_testo: ["titolo", "tipo", "controparte", "data", "importo", "scadenza"],
  promemoria: ["titolo", "data", "note"],
  promemoria_multipli: [],
  da_fare_a_mano: ["titolo", "data"],
  nessuna: [],
};

const ETICHETTE = {
  titolo: "Titolo",
  tipo: "Tipo",
  controparte: "Controparte",
  data: "Data",
  importo: "Importo",
  scadenza: "Scadenza",
  note: "Note",
};

const TIPO_CAMPO = { data: "date", scadenza: "date", importo: "number" };

// Le unità e le categorie del Ricettario, per l'ingrediente che nasce da
// una riga di fattura. «altro» è quella del non alimentare (detersivi,
// imballaggi): resta in anagrafica e sotto controllo prezzi, fuori dal
// Ricettario.
const UNITA = ["kg", "l", "pz", "mazzo"];
const CATEGORIE = [
  { v: "verdura", t: "verdura" },
  { v: "frutta", t: "frutta" },
  { v: "carne_rossa", t: "carne rossa" },
  { v: "carne_bianca", t: "carne bianca" },
  { v: "pesce", t: "pesce" },
  { v: "crostacei_molluschi", t: "crostacei e molluschi" },
  { v: "latticini", t: "latticini" },
  { v: "uova", t: "uova" },
  { v: "farine_cereali", t: "farine e cereali" },
  { v: "legumi", t: "legumi" },
  { v: "olio_condimenti", t: "olio e condimenti" },
  { v: "spezie_aromi", t: "spezie e aromi" },
  { v: "secco_dispensa", t: "secco / dispensa" },
  { v: "bevande", t: "bevande" },
  { v: "altro", t: "altro (non alimentare)" },
];

// ---------------------------------------------------------------------
// Il carico da fattura
// ---------------------------------------------------------------------
// Le righe di una fattura non stanno in una griglia di sei campi: sono N
// prodotti, e ognuno va abbinato a un ingrediente del Ricettario. Quello
// che si legge senza aprire niente è **cosa entra in magazzino**; il resto
// (costo, scadenza, numero di lotto) sta sotto «modifica», come per le
// altre azioni.
//
// Una riga senza ingrediente non si carica: qui si vede subito, in rosso,
// invece di scoprirlo dal conteggio dopo aver confermato.
function RigheCarico({ par, ingredienti, fornitori, aperto, cambia }) {
  const righe = par?.righe ?? [];
  const perId = Object.fromEntries((ingredienti ?? []).map((i) => [i.id, i]));

  // Cosa si pagava prima, per riga. Chiesto al database mentre si guarda,
  // non dopo aver confermato: se il fornitore ha sbagliato la fattura,
  // questo è l'unico momento in cui non registrarla è ancora gratis.
  const [rincari, setRincari] = useState({});

  useEffect(() => {
    let vivo = true;
    Promise.all(
      righe.map(async (r, i) => {
        const prezzo = Number(r.costo_unitario) / (Number(r.fattore) || 1);
        if (!r.ingrediente_id || !Number.isFinite(prezzo) || prezzo <= 0) return null;
        try {
          const v = await variazionePrezzo({
            ingredienteId: r.ingrediente_id,
            fornitoreId: par?.fornitore_id || null,
            prezzo,
          });
          return v ? [i, v] : null;
        } catch {
          return null; // il prezzo di prima è un di più: non blocca la conferma
        }
      })
    ).then((esiti) => {
      if (vivo) setRincari(Object.fromEntries(esiti.filter(Boolean)));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(righe.map((r) => [r.ingrediente_id, r.costo_unitario, r.fattore])), par?.fornitore_id]);

  // Si cambia una riga con UNA sola chiamata, anche quando i campi da
  // toccare sono due.
  //
  // ⚠️ Due `cambiaRiga` di fila non funzionano: partono entrambe dalla
  // stessa fotografia di `righe`, e la seconda sovrascrive la prima. È
  // successo davvero il 12/08/2026 su «crea nuovo da questa riga», che
  // deve scrivere l'ingrediente nuovo E svuotare l'abbinamento: si
  // scriveva il primo, il secondo lo cancellava, e in schermata **non
  // succedeva niente**. Nessun errore in console: il caso peggiore.
  const patchRiga = (i, patch) =>
    cambia("righe", righe.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const cambiaRiga = (i, chiave, valore) => patchRiga(i, { [chiave]: valore });

  const daAbbinare = righe.filter((r) => !r.ingrediente_id && !r.salta && !r.ignora && !r.nuovo_ingrediente?.nome).length;
  const caricabili = righe.filter(
    (r) => (r.ingrediente_id || r.nuovo_ingrediente?.nome) && !r.salta && !r.ignora
  ).length;

  return (
    <>
      <ul className="text-sm text-b58-charcoal-soft ml-2 mb-2">
        {righe.map((r, i) => (
          <li key={i} className={r.salta || r.ignora ? "line-through opacity-50" : undefined}>
            · {r.quantita ?? "?"} {r.unita_fattura || perId[r.ingrediente_id]?.unit || ""}{" "}
            <strong className="text-b58-charcoal">
              {perId[r.ingrediente_id]?.name ?? r.nuovo_ingrediente?.nome ?? r.descrizione}
            </strong>
            {r.ingrediente_id && r.descrizione ? ` (${r.descrizione})` : ""}
            {r.scadenza ? ` — scade ${formatDate(r.scadenza)}` : ""}
            {r.gia_noto && <span className="text-b58-olive"> — già conosciuto</span>}
            {r.nuovo_ingrediente?.nome && !r.ingrediente_id && (
              <span className="text-b58-olive"> — ingrediente nuovo</span>
            )}
            {!r.ingrediente_id && !r.nuovo_ingrediente?.nome && !r.salta && !r.ignora && (
              <span className="text-b58-terracotta-dark"> — da abbinare, non verrà caricata</span>
            )}
            {/* Il rincaro, dove si guarda: dentro la riga, non in fondo.
                Due numeri e non uno: il singolo passo può essere innocuo,
                la somma dall'inizio no — ed è quella l'argomento con cui
                si telefona a un fornitore. */}
            {rincari[i]?.da_segnalare && (
              <span className="text-b58-terracotta-dark">
                {" "}— ⚠️ prima lo pagavi {rincari[i].prezzo_precedente}, ora{" "}
                {(Number(r.costo_unitario) / (Number(r.fattore) || 1)).toFixed(2)} (+
                {rincari[i].variazione}%)
                {rincari[i].variazione_totale > rincari[i].variazione &&
                  `, +${rincari[i].variazione_totale}% da quando lo compri`}
              </span>
            )}
          </li>
        ))}
      </ul>

      {daAbbinare > 0 && (
        <p className="text-xs text-b58-terracotta-dark mb-2">
          {daAbbinare === 1
            ? "Una riga senza ingrediente"
            : `${daAbbinare} righe senza ingrediente`}
          : premi «modifica» per abbinarle o crearle, oppure conferma e verranno saltate.
        </p>
      )}

      {aperto && (
        <div className="my-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="min-w-0 col-span-2">
              <label className={etichetta}>Fornitore</label>
              <select
                value={par?.fornitore_id ?? ""}
                onChange={(e) => cambia("fornitore_id", e.target.value)}
                className={campo}
              >
                <option value="">— nessuno —</option>
                {(fornitori ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className={etichetta}>Temp. °C</label>
              <input
                type="number"
                step="0.1"
                value={par?.temperatura ?? ""}
                onChange={(e) => cambia("temperatura", e.target.value)}
                className={campo}
              />
            </div>
            <div className="min-w-0 flex items-end">
              {/* Spenta di proposito: la temperatura di ricevimento si
                  misura alla porta, e una fattura arriva dopo la merce. */}
              <label className="flex items-center gap-1.5 text-xs text-b58-charcoal-soft pb-1.5">
                <input
                  type="checkbox"
                  checked={par?.registra_haccp === true}
                  onChange={(e) => cambia("registra_haccp", e.target.checked)}
                />
                registra in HACCP
              </label>
            </div>
          </div>

          {par?.registra_haccp === true && (
            <p className="text-[11px] text-b58-terracotta-dark">
              Scriverà nel registro HACCP una consegna ricevuta <strong>adesso</strong>. Accendila
              solo se la merce è davvero appena arrivata: il registro è un documento che si mostra
              a un'ispezione.
            </p>
          )}

          {righe.map((r, i) => (
            <div key={i} className="rounded-lg bg-white ring-1 ring-b58-charcoal/10 p-2">
              <p className="text-[11px] text-b58-charcoal-soft mb-1.5 truncate">{r.descrizione}</p>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div className="min-w-0 col-span-2">
                  <label className={etichetta}>Ingrediente</label>
                  <select
                    value={r.nuovo_ingrediente ? "__nuovo__" : (r.ingrediente_id ?? "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__nuovo__") {
                        // Il nome parte dalla dicitura della fattura: si
                        // corregge, non si riscrive da zero.
                        patchRiga(i, {
                          ingrediente_id: "",
                          nuovo_ingrediente: {
                            nome: r.descrizione ?? "",
                            unita: "kg",
                            categoria: "verdura",
                            alimentare: true,
                          },
                        });
                      } else {
                        patchRiga(i, { ingrediente_id: v, nuovo_ingrediente: null });
                      }
                    }}
                    className={campo}
                  >
                    <option value="">— da abbinare —</option>
                    {(ingredienti ?? []).map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name}</option>
                    ))}
                    <option value="__nuovo__">+ crea nuovo da questa riga</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Quantità</label>
                  <input type="number" step="0.01" value={r.quantita ?? ""}
                    onChange={(e) => cambiaRiga(i, "quantita", e.target.value)} className={campo} />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Costo unit.</label>
                  <input type="number" step="0.01" value={r.costo_unitario ?? ""}
                    onChange={(e) => cambiaRiga(i, "costo_unitario", e.target.value)} className={campo} />
                </div>
                {/* La conversione: se la fattura conta casse e l'ingrediente
                    sta in chili, senza questo numero il prezzo al chilo è
                    sbagliato di sei volte — e la sorveglianza dei prezzi
                    costruita sopra non vale niente. Si chiede una volta:
                    poi resta in memoria per quella dicitura. */}
                <div className="min-w-0">
                  <label className={etichetta}>Conta in</label>
                  <input value={r.unita_fattura ?? ""} placeholder="cassa, kg…"
                    onChange={(e) => cambiaRiga(i, "unita_fattura", e.target.value)} className={campo} />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>= quante unità</label>
                  <input type="number" step="0.001" value={r.fattore ?? ""} placeholder="1"
                    onChange={(e) => cambiaRiga(i, "fattore", e.target.value)} className={campo} />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>Scadenza</label>
                  <input type="date" value={r.scadenza ?? ""}
                    onChange={(e) => cambiaRiga(i, "scadenza", e.target.value)} className={campo} />
                </div>
                <div className="min-w-0">
                  <label className={etichetta}>N° lotto</label>
                  <input value={r.lotto ?? ""}
                    onChange={(e) => cambiaRiga(i, "lotto", e.target.value)} className={campo} />
                </div>
              </div>
              {/* L'ingrediente che nasce da questa riga. Nome, unità e
                  categoria si correggono qui: quello che nasce è ciò che
                  Alessio vede, non ciò che ha proposto l'assistente. */}
              {r.nuovo_ingrediente && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 rounded-lg bg-b58-cream-dark/40 p-2">
                  <div className="min-w-0 col-span-2">
                    <label className={etichetta}>Nome dell'ingrediente nuovo</label>
                    <input value={r.nuovo_ingrediente.nome ?? ""}
                      onChange={(e) => cambiaRiga(i, "nuovo_ingrediente", { ...r.nuovo_ingrediente, nome: e.target.value })}
                      className={campo} />
                  </div>
                  <div className="min-w-0">
                    <label className={etichetta}>Unità</label>
                    <select value={r.nuovo_ingrediente.unita ?? "kg"}
                      onChange={(e) => cambiaRiga(i, "nuovo_ingrediente", { ...r.nuovo_ingrediente, unita: e.target.value })}
                      className={campo}>
                      {UNITA.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={etichetta}>Categoria</label>
                    <select value={r.nuovo_ingrediente.categoria ?? "altro"}
                      onChange={(e) => {
                        const c = e.target.value;
                        cambiaRiga(i, "nuovo_ingrediente", {
                          ...r.nuovo_ingrediente, categoria: c, alimentare: c !== "altro",
                        });
                      }}
                      className={campo}>
                      {CATEGORIE.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-b58-charcoal-soft col-span-2 sm:col-span-4">
                    <input type="checkbox" checked={r.nuovo_ingrediente.alimentare !== false}
                      onChange={(e) => cambiaRiga(i, "nuovo_ingrediente", { ...r.nuovo_ingrediente, alimentare: e.target.checked })} />
                    è un alimento (togli la spunta per detersivi, carta, imballaggi: restano
                    sotto controllo prezzi ma fuori dal Ricettario)
                  </label>
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                <label className="flex items-center gap-1.5 text-[11px] text-b58-charcoal-soft">
                  <input type="checkbox" checked={r.salta === true}
                    onChange={(e) => cambiaRiga(i, "salta", e.target.checked)} />
                  non caricare questa riga, per stavolta
                </label>
                {/* Ricordare che una riga non è merce vale quanto ricordare
                    che lo è: senza, trasporto e CONAI tornano ogni mese. */}
                <label className="flex items-center gap-1.5 text-[11px] text-b58-charcoal-soft">
                  <input type="checkbox" checked={r.ignora === true}
                    onChange={(e) => cambiaRiga(i, "ignora", e.target.checked)} />
                  non è merce — non chiedermelo più
                </label>
              </div>
            </div>
          ))}

          <p className="text-[11px] text-b58-charcoal-soft/70">
            Verranno caricate {caricabili} rig{caricabili === 1 ? "a" : "he"} su {righe.length}.
          </p>
        </div>
      )}
    </>
  );
}

export default function PostaInArrivo() {
  const [posta, setPosta] = useState([]);
  const [valori, setValori] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState(null);
  // Servono solo al carico da fattura, ma si caricano una volta sola:
  // aprire «modifica» su una fattura non deve aspettare una query.
  const [ingredienti, setIngredienti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  // Quale azione ha i campi aperti. Uno alla volta: se si aprissero tutti
  // tornerebbe la schermata che Alessio ha già bocciato due volte.
  const [aperta, setAperta] = useState(null);

  const ricarica = () =>
    listPostaInAttesa().then((righe) => {
      setPosta(righe);
      setValori(
        Object.fromEntries(
          righe.flatMap((m) =>
            (m.azioni ?? []).map((a) => [a.id, { ...(a.parametri ?? {}) }])
          )
        )
      );
    });

  useEffect(() => {
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // Se non ci sono fatture da caricare non servono, e non fanno danno.
    listIngredients().then(setIngredienti).catch(() => {});
    listSuppliers().then(setFornitori).catch(() => {});
  }, []);

  const cambia = (azioneId, chiave, valore) =>
    setValori((v) => ({ ...v, [azioneId]: { ...v[azioneId], [chiave]: valore } }));

  const agisci = async (azioneId, fn) => {
    setError("");
    setInCorso(azioneId);
    try {
      await fn();
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso(null);
    }
  };

  const apri = async (allegato) => {
    try {
      window.open(await getAllegatoUrl(allegato.storage_path), "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/documenti" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Archivio Documenti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">Posta in arrivo</h1>
      <p className="text-sm text-b58-charcoal-soft mb-6">
        Quello che arriva alle caselle del locale. Il gestionale legge e{" "}
        <strong>propone cosa fare</strong>: decidi tu, una cosa alla volta.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {posta.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna posta in attesa.</p>
        </div>
      ) : (
        posta.map((m) => {
          const daDecidere = (m.azioni ?? []).filter((a) => a.stato === "proposta");
          return (
            <div key={m.id} className={sezione}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-b58-charcoal font-medium">
                  {m.oggetto || "(senza oggetto)"}
                </span>
                <span className="text-sm text-b58-charcoal-soft">da {m.mittente || "?"}</span>
                <span className="text-sm text-b58-charcoal-soft">{formatDate(m.ricevuta_il)}</span>
              </div>

              {m.proposta_sintesi && (
                <p className="text-sm text-b58-charcoal mt-1 mb-3">{m.proposta_sintesi}</p>
              )}

              {m.stato === "da_leggere" && (
                <p className="text-sm text-b58-charcoal-soft mb-3">
                  Non ancora letta — la lettura parte da sola entro un quarto d&apos;ora.
                </p>
              )}

              {m.lettura_note && (
                <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
                  Ho letto questa mail solo in parte: {m.lettura_note}. Apri l&apos;allegato e
                  controlla i dati a mano.
                </p>
              )}

              {m.allegati?.length > 0 && (
                <p className="text-sm text-b58-charcoal-soft mb-3">
                  Allegati:{" "}
                  {m.allegati.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ", "}
                      {a.storage_path ? (
                        <button
                          type="button"
                          onClick={() => apri(a)}
                          className="text-b58-terracotta hover:underline"
                        >
                          {a.file_name}
                        </button>
                      ) : (
                        <span
                          className="text-b58-terracotta-dark"
                          title={a.errore || "Non è stato possibile salvarlo"}
                        >
                          {a.file_name} — non salvato
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}

              {daDecidere.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-white/60 ring-1 ring-b58-charcoal/10 p-3 mt-3"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="inline-flex items-center rounded-full bg-b58-olive text-b58-parchment text-[11px] font-medium px-2.5 py-1 shrink-0 mt-0.5">
                      {NOME_TIPO[a.tipo] ?? a.tipo}
                    </span>
                    <span className="text-b58-charcoal">
                      {a.descrizione || a.titolo}
                    </span>
                  </div>

                  {/* Le date di un documento, in chiaro: sono la cosa che
                      va guardata prima di confermare. */}
                  {valori[a.id]?.scadenze?.length > 0 && (
                    <ul className="text-sm text-b58-charcoal-soft ml-2 mb-2">
                      {valori[a.id].scadenze.map((s, i) => (
                        <li key={i}>
                          · <strong className="text-b58-charcoal">{formatDate(s.data)}</strong>{" "}
                          {s.titolo}
                          {s.note ? ` — ${s.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  {valori[a.id]?.passi?.length > 0 && (
                    <ul className="text-sm text-b58-charcoal-soft ml-2 mb-2">
                      {valori[a.id].passi.map((s, i) => (
                        <li key={i}>· {s}</li>
                      ))}
                    </ul>
                  )}

                  {a.tipo === "carico_magazzino" && (
                    <RigheCarico
                      par={valori[a.id]}
                      ingredienti={ingredienti}
                      fornitori={fornitori}
                      aperto={aperta === a.id}
                      cambia={(chiave, valore) => cambia(a.id, chiave, valore)}
                    />
                  )}

                  {aperta === a.id && CAMPI[a.tipo]?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 my-3">
                      {CAMPI[a.tipo].map((c) => (
                        <div key={c} className="min-w-0">
                          <label className={etichetta}>{ETICHETTE[c]}</label>
                          <input
                            type={TIPO_CAMPO[c] ?? "text"}
                            step={c === "importo" ? "0.01" : undefined}
                            value={valori[a.id]?.[c] ?? ""}
                            onChange={(e) => cambia(a.id, c, e.target.value)}
                            className={campo}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      disabled={inCorso === a.id}
                      onClick={() => agisci(a.id, () => confermaAzione(a.id, valori[a.id]))}
                      className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment font-medium px-3 py-1.5 text-sm"
                    >
                      {inCorso === a.id ? "…" : "Conferma"}
                    </button>
                    <button
                      type="button"
                      disabled={inCorso === a.id}
                      onClick={() => agisci(a.id, () => rifiutaAzione(a.id))}
                      className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-50 transition-colors text-b58-charcoal text-sm px-3 py-1.5"
                    >
                      No
                    </button>
                    {(CAMPI[a.tipo]?.length > 0 || a.tipo === "carico_magazzino") && (
                      <button
                        type="button"
                        onClick={() => setAperta(aperta === a.id ? null : a.id)}
                        className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta ml-1"
                      >
                        {aperta === a.id ? "chiudi" : "modifica"}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {daDecidere.length === 0 && m.stato === "proposta" && (
                <p className="text-sm text-b58-charcoal-soft mt-2">
                  Nessuna azione proposta per questa mail.
                </p>
              )}

              <button
                type="button"
                disabled={inCorso === m.id}
                onClick={() => agisci(m.id, () => scartaPosta(m.id))}
                className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta mt-3"
              >
                Non serve niente di tutto questo — togli la mail
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
