import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import { inFrazione, inPunti } from "../../lib/calcoli/percentuali";
import {
  aggiornaScenario,
  creaScenarioDaFoglio,
  getScenario,
  ingressiScenario,
} from "../../lib/api/proiezione";
import {
  FORMA_TIPICA,
  FORME_LINEA,
  LINEE_PREVISIONE,
  labelFor,
  oggiLocale,
} from "../../lib/constants";
import { righeDaSalvare } from "../../lib/calcoli/lineePrevisione";
import { allineaPaga, allineaTutte, righeDiscordi } from "../../lib/calcoli/pagaPrevisione";
import Didascalia from "../../components/Didascalia";

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

// 🔴 LE VOCI CHE UNA LISTA VUOTA FA DIMENTICARE (24/08/2026, richiesta di
// Alessio dal collaudo). Una previsione a cui manca la TARI o
// l'assicurazione non sbaglia rumorosamente: risulta **più leggera del
// vero**, cioè ottimista, che è la direzione peggiore in cui possa
// sbagliare un piano.
//
// ⚠️ NASCONO VUOTE, NON A ZERO, e non è una sfumatura: uno zero scritto
// vuol dire «questa voce non la pago», il vuoto vuol dire «non l'ho ancora
// deciso». Al salvataggio si tengono **solo le voci con un importo**: chi
// non ha i diritti musicali non se li porta dietro per sempre.
//
// ⚠️ E si propongono solo su una previsione NUOVA. Riproporle correggendone
// una già scritta rimetterebbe dentro voci che qualcuno aveva tolto — la
// stessa forma della sanatoria che si riapplica e riporta indietro una
// scelta dell'utente (il difetto del giro A del 18/08).
const COSTI_FISSI_PROPOSTI = [
  "Affitto",
  "Utenze",
  "Assicurazioni",
  "TARI",
  "Consulenze",
  "Canoni e abbonamenti",
  "Manutenzioni",
  "Pulizia",
  "Marketing",
  "Telefono e internet",
  "Contributi",
  "Diritti musicali",
  "HACCP",
  "Varie",
];

const MESE_VUOTO = (m) => ({
  mese: m, serviziSettimana: "", giorniLavorativi: "", giorniPeak: "",
  copertiPeak: "", copertiFeriali: "", eventiPremium: "0",
});

const num = (v) => (v === "" || v == null ? 0 : Number(v));
// Nel gestionale le percentuali si scrivono come le dice Alessio (25),
// nel database vivono come frazione (0,25). ⚠️ La conversione non sta piu'
// qui: sta in `calcoli/percentuali.js`, perche' dal 24/08 la usa anche la
// tesoreria — due copie della stessa regola sono la forma in cui il debito
// del «percento» si riproduce.
const daPercento = (v) => inFrazione(num(v));
const aPercento = inPunti;
// `String(null)` dà la parola «null», che in un campo numerico diventa NaN
// alla prossima scrittura: un valore mai impostato deve tornare vuoto.
const aTesto = (v) => (v == null ? "" : String(v));

export default function PrevisioneForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ricerca] = useSearchParams();
  const modifica = Boolean(id);
  // La società arriva dall'elenco delle previsioni, che ha il selettore:
  // senza, si guardava l'elenco dell'agricola e si scriveva nella S.r.l.s.
  const entitaScelta = ricerca.get("entita");

  const [entities, setEntities] = useState(null);
  const [entitaScenario, setEntitaScenario] = useState(null);
  const [nome, setNome] = useState("");
  const [anno, setAnno] = useState(new Date(oggiLocale()).getFullYear() + 1);
  const [tipo, setTipo] = useState("partenza");
  const [par, setPar] = useState(PARAMETRI_VUOTI);
  const [personale, setPersonale] = useState([]);
  const [extra, setExtra] = useState([]);
  const [fissi, setFissi] = useState(
    modifica ? [] : COSTI_FISSI_PROPOSTI.map((voce) => ({ voce, euroMese: "" }))
  );
  const [accessorie, setAccessorie] = useState([]);
  const [mesi, setMesi] = useState(Array.from({ length: 12 }, (_, i) => MESE_VUOTO(i + 1)));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(modifica);
  const [salvando, setSalvando] = useState(false);
  // 🔴 IL LAVORO SCRITTO E NON SALVATO (24/08/2026). Alessio ha compilato
  // questa schermata e se l'è ritrovata da rifare: la frase in cima
  // prometteva che «finché non la chiudi puoi tornarci sopra quante volte
  // vuoi», e quella promessa vale per una previsione GIA' SALVATA — non
  // per quello che si sta scrivendo adesso.
  // ⚠️ Misurato prima di correggere: il salvataggio e la rilettura
  // funzionano, campo per campo, righe comprese. Non c'era niente da
  // riparare nel salvataggio; c'era una frase che diceva il falso e
  // un'uscita che non avvisava.
  const [sporco, setSporco] = useState(false);
  const primaVolta = useRef(true);

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
    // ⚠️ Correggendo, la società resta quella della previsione. Prima si
    // rimandava sempre la S.r.l.s.: correggere una previsione
    // dell'agricola l'avrebbe spostata all'altra società senza dirlo.
    setEntitaScenario(s.entity_id);
    setPar({
      scontrinoFood: aTesto(s.scontrino_food), scontrinoBeverage: aTesto(s.scontrino_beverage),
      foodCostPercento: aPercento(s.food_cost_percento),
      beverageCostPercento: aPercento(s.beverage_cost_percento),
      lavanderiaCoperto: aTesto(s.lavanderia_coperto),
      pagamentiElettroniciPercento: aPercento(s.pagamenti_elettronici_percento),
      commissionePosPercento: aPercento(s.commissione_pos_percento),
      oreGiorno: aTesto(s.ore_giorno), pressionePersonale: aPercento(s.pressione_personale),
      ammortamentiAnnui: aTesto(s.ammortamenti_annui),
      finanziamentoImporto: aTesto(s.finanziamento_importo),
      finanziamentoTasso: aPercento(s.finanziamento_tasso),
      finanziamentoAnni: aTesto(s.finanziamento_anni),
    });
    const g = await ingressiScenario(id);
    setPersonale(g.personale.map((p) => ({ ruolo: p.ruolo, nettoOrario: aTesto(p.netto_orario), nettoGiorno: aTesto(p.netto_giorno) })));
    setExtra(g.extra.map((e) => ({ tipo: e.tipo, giornateAnno: aTesto(e.giornate_anno), tariffaGiorno: aTesto(e.tariffa_giorno), pressione: aPercento(e.pressione), daEventi: e.da_eventi })));
    setFissi(g.costiFissi.map((f) => ({ voce: f.voce, euroMese: aTesto(f.euro_mese) })));
    setAccessorie(g.accessorie.map((a) => ({ codice: a.codice ?? "", forma: a.forma ?? "", linea: a.linea, quantita: aTesto(a.quantita), prezzoMedio: aTesto(a.prezzo_medio), costoPercento: aPercento(a.costo_percento), base: a.base })));
    setMesi(g.mesi.map((m) => ({
      mese: m.mese, serviziSettimana: aTesto(m.servizi_settimana), giorniLavorativi: aTesto(m.giorni_lavorativi),
      giorniPeak: aTesto(m.giorni_peak), copertiPeak: aTesto(m.coperti_peak),
      copertiFeriali: aTesto(m.coperti_feriali), eventiPremium: aTesto(m.eventi_premium),
    })));
  }, [id, modifica]);

  useEffect(() => {
    carica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [carica]);

  // Il primo giro è il caricamento, non una modifica di chi scrive: si
  // consuma e basta. Da lì in poi ogni tocco marca il lavoro da salvare.
  useEffect(() => {
    if (loading) return;
    if (primaVolta.current) {
      primaVolta.current = false;
      return;
    }
    setSporco(true);
  }, [loading, nome, anno, tipo, par, personale, extra, fissi, accessorie, mesi]);

  // ⚠️ Copre ricaricare, chiudere e il tasto «indietro» del browser —
  // che sono le tre strade da cui il lavoro se ne andava senza una parola.
  // La navigazione dentro il gestionale la trattiene il collegamento qui
  // sotto: in questo progetto il router non è quello che permette a React
  // di bloccarla da sé.
  useEffect(() => {
    if (!sporco) return;
    const trattieni = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", trattieni);
    return () => window.removeEventListener("beforeunload", trattieni);
  }, [sporco]);

  const lasciare = (e) => {
    if (!sporco) return;
    if (!window.confirm("Quello che hai scritto qui non è ancora salvato: se esci adesso lo perdi. Vuoi uscire lo stesso?")) {
      e.preventDefault();
    }
  };

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-2.5 py-1.5 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala text-b58-charcoal-soft mb-1";
  const cellaClass =
    "w-full tocco-campo rounded border border-b58-charcoal/15 bg-white px-1.5 py-1 testo-sala text-b58-charcoal text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-b58-terracotta";

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

  // ⚠️ Un campo lasciato vuoto diventava zero senza dirlo, e su questi due
  // lo zero non è una risposta: uno scontrino medio a zero fa una
  // previsione con ricavi zero, un food cost a zero fa un margine perfetto.
  // Sono numeri che sembrano calcolati e non lo sono.
  //
  // Solo questi due, e non tutti: su «lavanderia a coperto» o «eventi
  // premium» lo zero è la risposta vera di chi non ha quella voce, e
  // pretenderla riempita farebbe scrivere numeri finti per passare oltre.
  const OBBLIGATORI = [
    ["scontrinoFood", "lo scontrino medio food"],
    ["foodCostPercento", "il food cost %"],
  ];

  const salva = async () => {
    const mancanti = OBBLIGATORI.filter(([k]) => String(par[k] ?? "").trim() === "").map(([, e]) => e);
    if (mancanti.length) {
      setError(`Manca ${mancanti.join(" e ")}: lasciato vuoto varrebbe zero, e una previsione con quello zero dentro non è una previsione.`);
      return;
    }
    setSalvando(true);
    setError("");
    try {
      const dati = {
        entity_id: entitaScenario || entitaScelta || entities?.srls?.id,
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
        // ⚠️ Solo le voci con un importo scritto: le proposte lasciate in
        // bianco sono un promemoria, non un costo da zero euro.
        costiFissi: fissi
          .filter((f) => f.voce.trim() && String(f.euroMese ?? "").trim() !== "")
          .map((f) => ({ voce: f.voce, euroMese: num(f.euroMese) })),
        // ⚠️ LA REGOLA STA IN UNA FUNZIONE PURA E PROVATA
        // (src/lib/calcoli/lineePrevisione.js), non qui: è il tratto fra
        // schermata e database, quello che né le prove sul database né la
        // revisione del codice guardano — e dove il 24/08 una riga di
        // ricavo è sparita in silenzio. La schermata usa QUELLA funzione,
        // non una sua copia: due copie divergono alla prima modifica.
        accessorie: righeDaSalvare(accessorie, { num, daPercento }),
        mesi: mesi.map((m) => ({
          mese: m.mese, serviziSettimana: num(m.serviziSettimana), giorniLavorativi: num(m.giorniLavorativi),
          giorniPeak: num(m.giorniPeak), copertiPeak: num(m.copertiPeak),
          copertiFeriali: num(m.copertiFeriali), eventiPremium: num(m.eventiPremium),
        })),
      };

      const nuovo = modifica ? await aggiornaScenario(id, dati) : await creaScenarioDaFoglio(dati);
      setSporco(false);
      navigate(`/fiscale/previsioni/${modifica ? id : nuovo}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const idSocieta = entitaScenario || entitaScelta || entities?.srls?.id;
  const nomeSocieta = [entities?.srls, entities?.agricola].find((e) => e?.id === idSocieta)?.name ?? "";

  const riga = (lista, setLista, indice, chiave, valore) =>
    setLista(lista.map((r, i) => (i === indice ? { ...r, [chiave]: valore } : r)));

  // ⚠️ Il personale non passa dal `riga` generico: i suoi due netti si
  // tengono d'accordo dalle ore del giorno, e comanda l'ultimo toccato.
  // La regola vive in un posto solo (`src/lib/calcoli/pagaPrevisione.js`)
  // e ha le sue prove: qui c'è solo il collegamento.
  const rigaPersonale = (indice, chiave, valore) =>
    setPersonale(
      personale.map((r, i) => {
        if (i !== indice) return r;
        const aggiornata = { ...r, [chiave]: valore };
        return chiave === "nettoOrario" || chiave === "nettoGiorno"
          ? allineaPaga(aggiornata, par.oreGiorno, chiave)
          : aggiornata;
      })
    );

  const cambiaOre = (valore) => {
    setPar((prec) => ({ ...prec, oreGiorno: valore }));
    setPersonale((righe) => allineaTutte(righe, valore));
  };

  // Le righe che si contraddicono: si DICONO, non si correggono di
  // nascosto. Una previsione scritta prima che le ore esistessero può
  // averne, e riscriverla da soli cambierebbe il costo del personale di un
  // piano che qualcuno aveva deciso.
  const discordi = righeDiscordi(personale, par.oreGiorno);

  if (loading) return <p className="testo-sala-grande text-b58-charcoal-soft max-w-5xl mx-auto">Caricamento…</p>;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/fiscale/previsioni" onClick={lasciare} className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Le previsioni
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">
        {modifica ? "Correggi la previsione" : "Costruisci una previsione"}
      </h1>
      <p className="testo-sala-grande text-b58-charcoal-soft mb-2">
        {modifica
          ? "Le correzioni entrano quando premi «Salva le correzioni», in fondo. Finché non chiudi la previsione puoi tornarci sopra quante volte vuoi."
          : "Quello che scrivi qui entra nel gestionale quando premi «Crea la previsione», in fondo alla schermata: prima di allora non è ancora salvato. Dopo puoi tornarci sopra quante volte vuoi — si blocca solo quando premi tu «Chiudi questa previsione», dalla sua scheda."}
      </p>
      {/* Di quale società è questa previsione: si sceglie nell'elenco, e
          qui si vede — un piano scritto per la società sbagliata non si
          nota da nessun numero. */}
      {nomeSocieta && (
        <p className="testo-sala text-b58-charcoal-soft/80 mb-6">Società: <strong>{nomeSocieta}</strong></p>
      )}

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
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
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          Quanto vale un coperto
          <Didascalia>
            Da qui escono i ricavi e il costo diretto di ogni persona che entra, ed è la
            base su cui si calcola il pareggio: quanti coperti servono perché la serata
            non ci rimetta.
          </Didascalia>
        </h2>
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
        onChange={rigaPersonale}
        extra={
          <div className="grid grid-cols-2 gap-3">
            {campo("pressionePersonale", "Tasse e contributi sopra il netto", "%")}
            {/* 🔴 UNA SOLA PER TUTTA LA PREVISIONE, non una per riga
                (richiesta di Alessio, 24/08). Prima «netto all'ora» e
                «netto al giorno» erano due caselle scollegate: 7 €/ora e
                30 €/giorno passavano senza che niente lo dicesse. */}
            <div>
              <label className={labelClass}>
                Ore lavorate al giorno <span className="text-b58-charcoal-soft/60">ore</span>
              </label>
              <input
                type="number"
                step="0.25"
                value={par.oreGiorno}
                onChange={(e) => cambiaOre(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        }
        sotto2={
          <>
            Scrivi il netto all&apos;ora <em>oppure</em> quello al giorno: l&apos;altro lo calcola il
            gestionale con le ore qui sotto, e comanda sempre l&apos;ultimo che hai toccato.
            {discordi.length > 0 && (
              <span className="block mt-1 text-b58-terracotta-dark">
                {discordi.length === 1 ? "Una riga non torna" : `${discordi.length} righe non tornano`} con le
                ore del giorno: {discordi.map((i) => personale[i].ruolo || `riga ${i + 1}`).join(", ")}. Tocca
                uno dei due netti e si riallinea.
              </span>
            )}
          </>
        }
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
        sotto={
          modifica
            ? "Tutto ciò che paghi anche a sala vuota."
            : "Tutto ciò che paghi anche a sala vuota. Le voci qui sotto sono un promemoria: riempi quelle che hai, lascia in bianco quelle che non ti riguardano — le vuote non finiscono nella previsione. Puoi aggiungerne altre."
        }
        righe={fissi}
        aggiungi={() => setFissi([...fissi, { voce: "", euroMese: "" }])}
        togli={(i) => setFissi(fissi.filter((_, k) => k !== i))}
        colonne={[
          { chiave: "voce", etichetta: "Voce", tipo: "text", largo: true },
          { chiave: "euroMese", etichetta: "€ al mese" },
        ]}
        onChange={(i, k, v) => riga(fissi, setFissi, i, k, v)}
      />

      {/* LE LINEE OLTRE ALLA SALA (24/08/2026, disegno chiuso da Alessio).
          🔴 Prima erano righe di testo libero con due sole «basi»: a
          giornata o a evento. Il foglio vero ne conteneva quattro, e tre di
          quelle non erano né l'una né l'altra cosa — un barattolo non è un
          coperto, e chiamarlo «a giornata» diceva come si conta ma non cosa
          si vende.
          ⚠️ La linea si SCEGLIE da un elenco e la forma si PROPONE:
          scegliendo «barattoli» viene proposto «a pezzo», ma resta
          correggibile — un evento a coperto è il suo locale, non una regola
          nostra.
          ⚠️ E la SALA non è qui: vive nei parametri e nei dodici mesi, ed è
          la linea attorno a cui tutto il resto è costruito. */}
      <ListaModificabile
        titolo="Le linee oltre alla sala"
        sotto="Lunch, chef table, lounge apericena, eventi, barattoli. Una linea può restare a zero: chef table e barattoli non partono da subito, e zero previsto con zero fatto è un conto che torna — non una previsione mancata."
        righe={accessorie}
        aggiungi={() => setAccessorie([...accessorie, { codice: "", linea: "", quantita: "", prezzoMedio: "", costoPercento: "", forma: "", base: "per_giorno" }])}
        togli={(i) => setAccessorie(accessorie.filter((_, k) => k !== i))}
        colonne={[
          { chiave: "codice", etichetta: "Linea", tipo: "select", largo: true,
            opzioni: LINEE_PREVISIONE.map((l) => [l.value, l.label]) },
          { chiave: "quantita", etichetta: "Quanti" },
          { chiave: "prezzoMedio", etichetta: "Prezzo medio €" },
          { chiave: "costoPercento", etichetta: "Costo %" },
          { chiave: "forma", etichetta: "Come si conta", tipo: "select",
            opzioni: FORME_LINEA.map((f) => [f.value, f.label]) },
        ]}
        onChange={(i, k, v) => {
          if (k === "codice") {
            // ⚠️ Si PROPONE la forma tipica e il nome leggibile, non si
            // impongono: chi sceglie «eventi» quasi sempre vuole il
            // forfait, e chiederglielo due volte è un tocco in più su una
            // schermata dove se ne fanno sessanta.
            const nuove = [...accessorie];
            nuove[i] = {
              ...nuove[i],
              codice: v,
              forma: nuove[i].forma || FORMA_TIPICA[v] || "",
              linea: nuove[i].linea || labelFor(LINEE_PREVISIONE, v),
            };
            setAccessorie(nuove);
            return;
          }
          riga(accessorie, setAccessorie, i, k, v);
        }}
      />

      {/* I dodici mesi */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-5 overflow-x-auto">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          I dodici mesi
          <Didascalia>
            Quanti giorni apri, quanti sono di punta, e quanta gente ti aspetti nei due casi. È qui
            che vive la stagionalità: agosto non somiglia a gennaio, e il gestionale non lo indovina.
          </Didascalia>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full testo-sala min-w-[760px]">
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
      </div>

      {/* Sotto l'EBITDA */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Ammortamenti e finanziamento</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {campo("ammortamentiAnnui", "Ammortamenti all'anno", "€")}
          {campo("finanziamentoImporto", "Finanziamento", "€")}
          {campo("finanziamentoTasso", "Tasso annuo", "%")}
          {campo("finanziamentoAnni", "Durata", "anni")}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={salva}
            disabled={salvando}
            className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-5 py-2.5 disabled:opacity-60"
          >
            {salvando ? "Salvo…" : modifica ? "Salva le correzioni" : "Crea la previsione"}
          </button>
          <span className="testo-sala text-b58-charcoal-soft">
            {sporco ? "Non ancora salvata." : "Non la chiude: resta modificabile finché non lo decidi tu."}
          </span>
        </div>
        {/* 🔴 IL RIFIUTO STA ANCHE QUI, sotto il gesto che l'ha causato.
            Il messaggio in cima alla schermata è a dodici mesi di distanza
            da questo pulsante: premendo con un campo obbligatorio vuoto non
            succedeva niente di visibile, e l'istinto è premere di nuovo o
            andarsene. È la stessa cura del 17/08 in Cassa. */}
        {error && (
          <p className="mt-3 testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </div>
  );
}

function ListaModificabile({ titolo, sotto, sotto2, righe, colonne, aggiungi, togli, onChange, extra }) {
  const cella =
    "w-full tocco-campo rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-1 focus:ring-b58-terracotta";
  return (
    <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-5">
      <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">{titolo}</h2>
      <p className="testo-sala text-b58-charcoal-soft mb-4">{sotto}</p>

      {extra && <div className="max-w-md mb-3">{extra}</div>}
      {sotto2 && <p className="testo-sala text-b58-charcoal-soft mb-4">{sotto2}</p>}

      {righe.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 mb-3">Ancora niente.</p>
      ) : (
        <div className="overflow-x-auto mb-3">
          <table className="w-full testo-sala-grande">
            <thead>
              <tr className="testo-sala text-b58-charcoal-soft">
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
                      className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
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
        className="tocco-testo testo-sala-grande text-b58-terracotta hover:text-b58-terracotta-dark"
      >
        + Aggiungi una riga
      </button>
    </div>
  );
}
