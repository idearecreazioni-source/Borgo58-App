import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import {
  aggiornaScenario,
  creaScenarioDaFoglio,
  getScenario,
  ingressiScenario,
} from "../../lib/api/proiezione";
import { oggiLocale } from "../../lib/constants";

// Costruire una previsione a mano, campo per campo.
//
// ⚠️ È la porta che mancava, e l'errore era mio: la prima consegna aveva
// una sola via d'ingresso, il foglio Excel. Alessio se n'è accorto subito
// («ora sono vincolato a un file esterno che produce una previsione fissa
// che non posso modificare»), e aveva ragione. I numeri vivevano già nel
// gestionale — mancava il modo di scriverli e di correggerli.
//
// Finché la previsione non è chiusa si modifica quante volte si vuole.
// Chiuderla è un gesto a parte, dalla sua scheda.

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const PARAMETRI_VUOTI = {
  scontrinoFood: "", scontrinoBeverage: "",
  foodCostPercento: "", beverageCostPercento: "",
  lavanderiaCoperto: "0", pagamentiElettroniciPercento: "0", commissionePosPercento: "0",
  oreGiorno: "8", pressionePersonale: "0",
  ammortamentiAnnui: "0", finanziamentoImporto: "0", finanziamentoTasso: "0", finanziamentoAnni: "0",
};

const MESE_VUOTO = (m) => ({
  mese: m, serviziSettimana: "", giorniLavorativi: "", giorniPeak: "",
  copertiPeak: "", copertiFeriali: "", eventiPremium: "0",
});

const num = (v) => (v === "" || v == null ? 0 : Number(v));
// Nel gestionale le percentuali si scrivono come le dice Alessio (25),
// nel database vivono come frazione (0,25): la conversione sta qui, in un
// posto solo, e non in mezzo ai calcoli.
const daPercento = (v) => num(v) / 100;
const aPercento = (v) => (v == null ? "" : String(Math.round(Number(v) * 10000) / 100));

export default function PrevisioneForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const modifica = Boolean(id);

  const [entities, setEntities] = useState(null);
  const [nome, setNome] = useState("");
  const [anno, setAnno] = useState(new Date(oggiLocale()).getFullYear() + 1);
  const [tipo, setTipo] = useState("partenza");
  const [par, setPar] = useState(PARAMETRI_VUOTI);
  const [personale, setPersonale] = useState([]);
  const [extra, setExtra] = useState([]);
  const [fissi, setFissi] = useState([]);
  const [accessorie, setAccessorie] = useState([]);
  const [mesi, setMesi] = useState(Array.from({ length: 12 }, (_, i) => MESE_VUOTO(i + 1)));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(modifica);
  const [salvando, setSalvando] = useState(false);

  const carica = useCallback(async () => {
    setEntities(await getEntities());
    if (!modifica) return;
    const s = await getScenario(id);
    if (s.congelato_il) {
      throw new Error("Questa previsione è chiusa: non si modifica più. Creane una nuova.");
    }
    setNome(s.nome);
    setAnno(s.anno);
    setTipo(s.tipo);
    setPar({
      scontrinoFood: String(s.scontrino_food), scontrinoBeverage: String(s.scontrino_beverage),
      foodCostPercento: aPercento(s.food_cost_percento),
      beverageCostPercento: aPercento(s.beverage_cost_percento),
      lavanderiaCoperto: String(s.lavanderia_coperto),
      pagamentiElettroniciPercento: aPercento(s.pagamenti_elettronici_percento),
      commissionePosPercento: aPercento(s.commissione_pos_percento),
      oreGiorno: String(s.ore_giorno), pressionePersonale: aPercento(s.pressione_personale),
      ammortamentiAnnui: String(s.ammortamenti_annui),
      finanziamentoImporto: String(s.finanziamento_importo),
      finanziamentoTasso: aPercento(s.finanziamento_tasso),
      finanziamentoAnni: String(s.finanziamento_anni),
    });
    const g = await ingressiScenario(id);
    setPersonale(g.personale.map((p) => ({ ruolo: p.ruolo, nettoOrario: String(p.netto_orario), nettoGiorno: String(p.netto_giorno) })));
    setExtra(g.extra.map((e) => ({ tipo: e.tipo, giornateAnno: String(e.giornate_anno), tariffaGiorno: String(e.tariffa_giorno), pressione: aPercento(e.pressione), daEventi: e.da_eventi })));
    setFissi(g.costiFissi.map((f) => ({ voce: f.voce, euroMese: String(f.euro_mese) })));
    setAccessorie(g.accessorie.map((a) => ({ linea: a.linea, quantita: String(a.quantita), prezzoMedio: String(a.prezzo_medio), costoPercento: aPercento(a.costo_percento), base: a.base })));
    setMesi(g.mesi.map((m) => ({
      mese: m.mese, serviziSettimana: String(m.servizi_settimana), giorniLavorativi: String(m.giorni_lavorativi),
      giorniPeak: String(m.giorni_peak), copertiPeak: String(m.coperti_peak),
      copertiFeriali: String(m.coperti_feriali), eventiPremium: String(m.eventi_premium),
    })));
  }, [id, modifica]);

  useEffect(() => {
    carica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [carica]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-2.5 py-1.5 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs text-b58-charcoal-soft mb-1";
  const cellaClass =
    "w-full rounded border border-b58-charcoal/15 bg-white px-1.5 py-1 text-xs text-b58-charcoal text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-b58-terracotta";

  const campo = (chiave, etichetta, suffisso) => (
    <div>
      <label className={labelClass}>
        {etichetta} {suffisso && <span className="text-b58-charcoal-soft/60">{suffisso}</span>}
      </label>
      <input
        type="number"
        step="0.01"
        value={par[chiave]}
        onChange={(e) => setPar((p) => ({ ...p, [chiave]: e.target.value }))}
        className={inputClass}
      />
    </div>
  );

  const salva = async () => {
    setSalvando(true);
    setError("");
    try {
      const dati = {
        entity_id: entities?.srls?.id,
        nome: nome.trim() || "Previsione senza nome",
        tipo,
        anno: Number(anno),
        origine: "scritta a mano",
        parametri: {
          scontrinoFood: num(par.scontrinoFood),
          scontrinoBeverage: num(par.scontrinoBeverage),
          foodCostPercento: daPercento(par.foodCostPercento),
          beverageCostPercento: daPercento(par.beverageCostPercento),
          lavanderiaCoperto: num(par.lavanderiaCoperto),
          pagamentiElettroniciPercento: daPercento(par.pagamentiElettroniciPercento),
          commissionePosPercento: daPercento(par.commissionePosPercento),
          oreGiorno: num(par.oreGiorno),
          pressionePersonale: daPercento(par.pressionePersonale),
          ammortamentiAnnui: num(par.ammortamentiAnnui),
          finanziamentoImporto: num(par.finanziamentoImporto),
          finanziamentoTasso: daPercento(par.finanziamentoTasso),
          finanziamentoAnni: num(par.finanziamentoAnni),
        },
        personale: personale
          .filter((p) => p.ruolo.trim())
          .map((p) => ({ ruolo: p.ruolo, nettoOrario: num(p.nettoOrario), nettoGiorno: num(p.nettoGiorno) })),
        extra: extra
          .filter((e) => e.tipo.trim())
          .map((e) => ({ tipo: e.tipo, giornateAnno: num(e.giornateAnno), tariffaGiorno: num(e.tariffaGiorno), pressione: daPercento(e.pressione), daEventi: Boolean(e.daEventi) })),
        costiFissi: fissi.filter((f) => f.voce.trim()).map((f) => ({ voce: f.voce, euroMese: num(f.euroMese) })),
        accessorie: accessorie
          .filter((a) => a.linea.trim())
          .map((a) => ({ linea: a.linea, quantita: num(a.quantita), prezzoMedio: num(a.prezzoMedio), costoPercento: daPercento(a.costoPercento), base: a.base })),
        mesi: mesi.map((m) => ({
          mese: m.mese, serviziSettimana: num(m.serviziSettimana), giorniLavorativi: num(m.giorniLavorativi),
          giorniPeak: num(m.giorniPeak), copertiPeak: num(m.copertiPeak),
          copertiFeriali: num(m.copertiFeriali), eventiPremium: num(m.eventiPremium),
        })),
      };

      const nuovo = modifica ? await aggiornaScenario(id, dati) : await creaScenarioDaFoglio(dati);
      navigate(`/fiscale/previsioni/${modifica ? id : nuovo}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const riga = (lista, setLista, indice, chiave, valore) =>
    setLista(lista.map((r, i) => (i === indice ? { ...r, [chiave]: valore } : r)));

  if (loading) return <p className="text-sm text-b58-charcoal-soft max-w-5xl mx-auto">Caricamento…</p>;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/fiscale/previsioni" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Le previsioni
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">
        {modifica ? "Correggi la previsione" : "Costruisci una previsione"}
      </h1>
      <p className="text-sm text-b58-charcoal-soft mb-6">
        Finché non la chiudi puoi tornarci sopra quante volte vuoi. Si blocca solo quando premi tu
        «Chiudi questa previsione», dalla sua scheda.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Testata */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className={labelClass}>Come la chiami</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Previsione di partenza" />
        </div>
        <div>
          <label className={labelClass}>Anno</label>
          <input type="number" value={anno} onChange={(e) => setAnno(e.target.value)} className={inputClass} />
        </div>
        {!modifica && (
          <div>
            <label className={labelClass}>Cos&apos;è</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
              <option value="partenza">La previsione di partenza</option>
              <option value="riproiezione">Una riproiezione</option>
            </select>
          </div>
        )}
      </div>

      {/* Un coperto */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-5">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Quanto vale un coperto</h2>
        <p className="text-xs text-b58-charcoal-soft mb-4">
          Da qui escono i ricavi e il costo diretto di ogni persona che entra: è la base del pareggio.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {campo("scontrinoFood", "Scontrino cibo", "€")}
          {campo("scontrinoBeverage", "Scontrino bevande", "€")}
          {campo("foodCostPercento", "Food cost", "%")}
          {campo("beverageCostPercento", "Beverage cost", "%")}
          {campo("lavanderiaCoperto", "Lavanderia a coperto", "€")}
          {campo("pagamentiElettroniciPercento", "Pagamenti elettronici", "%")}
          {campo("commissionePosPercento", "Commissione POS", "%")}
        </div>
      </div>

      {/* Personale */}
      <ListaModificabile
        titolo="Chi lavora in sala e in cucina"
        sotto="Il costo mensile lo calcola il gestionale dalle giornate di apertura dell'anno."
        righe={personale}
        aggiungi={() => setPersonale([...personale, { ruolo: "", nettoOrario: "", nettoGiorno: "" }])}
        togli={(i) => setPersonale(personale.filter((_, k) => k !== i))}
        colonne={[
          { chiave: "ruolo", etichetta: "Ruolo", tipo: "text", largo: true },
          { chiave: "nettoOrario", etichetta: "Netto all'ora €" },
          { chiave: "nettoGiorno", etichetta: "Netto al giorno €" },
        ]}
        onChange={(i, k, v) => riga(personale, setPersonale, i, k, v)}
        extra={campo("pressionePersonale", "Tasse e contributi sopra il netto", "%")}
      />

      {/* Extra */}
      <ListaModificabile
        titolo="Gli extra"
        sotto="Weekend, alta stagione, eventi. Spuntando «segue gli eventi» le giornate le conta il gestionale dai tuoi eventi del mese."
        righe={extra}
        aggiungi={() => setExtra([...extra, { tipo: "", giornateAnno: "", tariffaGiorno: "", pressione: "50", daEventi: false }])}
        togli={(i) => setExtra(extra.filter((_, k) => k !== i))}
        colonne={[
          { chiave: "tipo", etichetta: "Tipo", tipo: "text", largo: true },
          { chiave: "giornateAnno", etichetta: "Giornate/anno" },
          { chiave: "tariffaGiorno", etichetta: "Tariffa €/gg" },
          { chiave: "pressione", etichetta: "Pressione %" },
          { chiave: "daEventi", etichetta: "Segue gli eventi", tipo: "checkbox" },
        ]}
        onChange={(i, k, v) => riga(extra, setExtra, i, k, v)}
      />

      {/* Costi fissi */}
      <ListaModificabile
        titolo="I costi fissi"
        sotto="Affitto, utenze, assicurazioni: tutto ciò che paghi anche a sala vuota."
        righe={fissi}
        aggiungi={() => setFissi([...fissi, { voce: "", euroMese: "" }])}
        togli={(i) => setFissi(fissi.filter((_, k) => k !== i))}
        colonne={[
          { chiave: "voce", etichetta: "Voce", tipo: "text", largo: true },
          { chiave: "euroMese", etichetta: "€ al mese" },
        ]}
        onChange={(i, k, v) => riga(fissi, setFissi, i, k, v)}
      />

      {/* Linee accessorie */}
      <ListaModificabile
        titolo="Le linee accessorie"
        sotto="Lounge, chef table, barattoli, eventi. «A evento» usa il numero di eventi del mese; «a giornata» le giornate di apertura."
        righe={accessorie}
        aggiungi={() => setAccessorie([...accessorie, { linea: "", quantita: "", prezzoMedio: "", costoPercento: "", base: "per_giorno" }])}
        togli={(i) => setAccessorie(accessorie.filter((_, k) => k !== i))}
        colonne={[
          { chiave: "linea", etichetta: "Linea", tipo: "text", largo: true },
          { chiave: "quantita", etichetta: "Quantità" },
          { chiave: "prezzoMedio", etichetta: "Prezzo medio €" },
          { chiave: "costoPercento", etichetta: "Costo %" },
          { chiave: "base", etichetta: "Come si conta", tipo: "select",
            opzioni: [["per_giorno", "a giornata"], ["per_evento", "a evento"]] },
        ]}
        onChange={(i, k, v) => riga(accessorie, setAccessorie, i, k, v)}
      />

      {/* I dodici mesi */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-5 overflow-x-auto">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">I dodici mesi</h2>
        <p className="text-xs text-b58-charcoal-soft mb-4">
          Quanti giorni apri, quanti sono di punta, e quanta gente ti aspetti nei due casi. È qui che
          vive la stagionalità: agosto non somiglia a gennaio, e il gestionale non lo indovina.
        </p>
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="text-b58-charcoal-soft">
              <th className="text-left font-medium py-1 pr-2">&nbsp;</th>
              {MESI.map((m) => <th key={m} className="font-medium py-1 px-1">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["serviziSettimana", "Servizi a settimana"],
              ["giorniLavorativi", "Giorni di apertura"],
              ["giorniPeak", "…di cui di punta"],
              ["copertiPeak", "Coperti nei giorni di punta"],
              ["copertiFeriali", "Coperti negli altri giorni"],
              ["eventiPremium", "Eventi nel mese"],
            ].map(([chiave, etichetta]) => (
              <tr key={chiave} className="border-t border-b58-charcoal/5">
                <td className="py-1 pr-2 text-b58-charcoal-soft whitespace-nowrap">{etichetta}</td>
                {mesi.map((m, i) => (
                  <td key={m.mese} className="py-1 px-0.5">
                    <input
                      type="number"
                      step="0.01"
                      value={m[chiave]}
                      onChange={(e) => riga(mesi, setMesi, i, chiave, e.target.value)}
                      className={cellaClass}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sotto l'EBITDA */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Ammortamenti e finanziamento</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {campo("ammortamentiAnnui", "Ammortamenti all'anno", "€")}
          {campo("finanziamentoImporto", "Finanziamento", "€")}
          {campo("finanziamentoTasso", "Tasso annuo", "%")}
          {campo("finanziamentoAnni", "Durata", "anni")}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={salva}
          disabled={salvando}
          className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-5 py-2.5 disabled:opacity-60"
        >
          {salvando ? "Salvo…" : modifica ? "Salva le correzioni" : "Crea la previsione"}
        </button>
        <span className="text-xs text-b58-charcoal-soft">
          Non la chiude: resta modificabile finché non lo decidi tu.
        </span>
      </div>
    </div>
  );
}

function ListaModificabile({ titolo, sotto, righe, colonne, aggiungi, togli, onChange, extra }) {
  const cella =
    "w-full rounded border border-b58-charcoal/15 bg-white px-2 py-1 text-sm text-b58-charcoal focus:outline-none focus:ring-1 focus:ring-b58-terracotta";
  return (
    <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-5">
      <h2 className="font-display text-lg text-b58-charcoal mb-1">{titolo}</h2>
      <p className="text-xs text-b58-charcoal-soft mb-4">{sotto}</p>

      {extra && <div className="max-w-xs mb-4">{extra}</div>}

      {righe.length === 0 ? (
        <p className="text-xs text-b58-charcoal-soft/60 mb-3">Ancora niente.</p>
      ) : (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-b58-charcoal-soft">
                {colonne.map((c) => (
                  <th key={c.chiave} className="text-left font-medium py-1 pr-2">{c.etichetta}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {righe.map((r, i) => (
                <tr key={i}>
                  {colonne.map((c) => (
                    <td key={c.chiave} className={`py-1 pr-2 ${c.largo ? "w-2/5" : ""}`}>
                      {c.tipo === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={Boolean(r[c.chiave])}
                          onChange={(e) => onChange(i, c.chiave, e.target.checked)}
                          className="accent-b58-terracotta"
                        />
                      ) : c.tipo === "select" ? (
                        <select value={r[c.chiave]} onChange={(e) => onChange(i, c.chiave, e.target.value)} className={cella}>
                          {c.opzioni.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <input
                          type={c.tipo === "text" ? "text" : "number"}
                          step="0.01"
                          value={r[c.chiave]}
                          onChange={(e) => onChange(i, c.chiave, e.target.value)}
                          className={cella}
                        />
                      )}
                    </td>
                  ))}
                  <td className="py-1">
                    <button
                      onClick={() => togli(i)}
                      className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                      title="Togli questa riga"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={aggiungi}
        className="text-sm text-b58-terracotta hover:text-b58-terracotta-dark"
      >
        + Aggiungi una riga
      </button>
    </div>
  );
}
