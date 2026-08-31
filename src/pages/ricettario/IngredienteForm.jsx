import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import DatoNonLetto from "../../components/DatoNonLetto";
import Didascalia from "../../components/Didascalia";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { listSuppliers, createSupplier } from "../../lib/api/suppliers";
import {
  assegnaFornitoreArticolo,
  collegaArticoli,
  variantiIngrediente,
} from "../../lib/api/assistente";
import {
  confermaCampiProdotto,
  createIngredient,
  eliminaIngrediente,
  getIngredient,
  ingredienteConQuestoNome,
  listPriceHistory,
  mettiDaParteIngrediente,
  updateIngredientFields,
  updateIngredientPrice,
  usiDellIngrediente,
  listCategorieIngrediente,
  listUnita,
  aggiungiCategoriaIngrediente,
} from "../../lib/api/ingredients";
import ScattaFoto from "../../components/ScattaFoto";
import {
  applicaLetturaEtichetta,
  marcaCampiDallAssistente,
  registraProdottoLetto,
} from "../../lib/api/assistenteFoto";
import {
  allergeniDaScrivere,
  campiProposti,
  campiRimastiDellAssistente,
} from "../../lib/calcoli/schedaLetta";
import {
  ALLERGENS,
  MONTHS,
  STORAGE_TYPES,
  SUPPLIER_CATEGORIES,
  formatDate,
  formatEUR,
} from "../../lib/constants";

// Quello che il gestionale ha già capito da un prodotto dettato.
// ⚠️ Solo i tre campi che si possono dire a voce: il resto della scheda —
//    allergeni, conservazione, scarto — lo compila MEMO da una foto
//    dell'etichetta, oppure Alessio a mano. Precompilarli qui vorrebbe dire
//    inventarli.
import { useDaVoce } from "../../lib/daVoce";
import { conCampi } from "../../lib/calcoli/aMano";
import { meseAcceso, stagionalitaDopoIlTocco } from "../../lib/calcoli/stagionalita";
import { StriscaDallaVoce } from "../../components/StriscaDallaVoce";

const DA_VOCE = { nome: "name", categoria: "category", unita: "unit" };

const emptyForm = {
  name: "",
  category: "",
  unit: "kg",
  source_type: "fornitore_esterno",
  supplier_id: "",
  current_price: "",
  allergens: [],
  seasonality: [],
  storage_type: "",
  waste_percentage_default: "0",
  stock_minimum_threshold: "",
  temperatura_attesa: "",
  haccp_notes: "",
  // Acceso di partenza: il silenzio si compra prodotto per prodotto, non
  // con una percentuale. Un fornitore che alza del 3% ogni mese non
  // supererebbe mai una soglia, e fa +42% in un anno.
  avvisa_rincari: true,
  alimentare: true,
  tenuto_in_magazzino: true,
  // ⚠️ NASCE FALSO, ed è la prudenza nel verso giusto: un prodotto che
  //    dovrebbe stare in carta e non c'è si vede subito (manca dal menu);
  //    uno che non doveva starci **si vende a un cliente**.
  va_in_carta: false,
};

export default function IngredienteForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);

  // Dove è usato questo ingrediente: si chiede PRIMA di offrire i gesti.
  // ⚠️ Finché non si sa, non si offre di cancellare — «non lo so» e «non è
  // usato» sono due cose diverse (regola del 19/08).
  const [usi, setUsi] = useState(null);
  const [attivo, setAttivo] = useState(true);
  const [togliendo, setTogliendo] = useState(false);

  // Quello che l'assistente ha letto sull'etichetta, in attesa che Alessio
  // guardi la scheda e salvi.
  // ⚠️ SI TIENE FINCHE' NON SI SALVA, e non un istante di piu': serve a
  //    scrivere le origini degli allergeni e la marcatura dei campi DOPO
  //    che il prodotto esiste. Poi se ne va con la schermata, insieme alla
  //    foto, che non e' mai stata salvata da nessuna parte.
  const [letturaEtichetta, setLetturaEtichetta] = useState(null);

  const guardaGliUsi = useCallback(() => {
    if (!id) return;
    setUsi(null);
    leggi(usiDellIngrediente(id)).then(setUsi);
  }, [id]);

  useEffect(() => {
    guardaGliUsi();
  }, [guardaGliUsi]);

  const cambiaPresenza = async (prossimo) => {
    setTogliendo(true);
    setError("");
    try {
      await mettiDaParteIngrediente(id, prossimo);
      setAttivo(prossimo);
    } catch (e) {
      setError(e.message);
    } finally {
      setTogliendo(false);
    }
  };

  const eliminaDavvero = async () => {
    setTogliendo(true);
    setError("");
    try {
      await eliminaIngrediente(id);
      navigate("/ricettario/ingredienti");
    } catch (e) {
      // ⚠️ Il messaggio arriva dal database e nomina i posti in italiano:
      // non si sostituisce con uno generico (regola del 09/08).
      setError(e.message);
      setTogliendo(false);
      guardaGliUsi();
    }
  };
  const navigate = useNavigate();

  const [entities, setEntities] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  // ⚠️ Solo su un prodotto NUOVO: aprendone uno esistente i campi sono i
  //    suoi, e riempirli con quelli di una dettatura li cancellerebbe.
  const venuto = useDaVoce((c) => { if (!isEdit) setForm((f) => conCampi(f, c, DA_VOCE)); });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [priceHistory, setPriceHistory] = useState([]);
  const [daConfermare, setDaConfermare] = useState([]);
  const [fonti, setFonti] = useState({});
  const [varianti, setVarianti] = useState([]);
  // Da dove viene `current_price`: «prodotto», «a_mano», oppure vuoto —
  // che vuol dire «non l'ha ancora detto nessuno» e non è la stessa cosa.
  const [prezzoDa, setPrezzoDa] = useState(null);
  // Le categorie sono DATI dal 27/08/2026: si leggono, non si ridicono.
  const [categorie, setCategorie] = useState([]);
  // `null` = il campo per aggiungerne una non è aperto; "" = è aperto e vuoto.
  // ⚠️ ANCHE LE UNITA SONO DATI dal 29/08, come le categorie dal 27/08:
  //    un elenco scritto nel codice sarebbe una seconda verita accanto alla
  //    tabella, e il giorno che se ne aggiunge una resterebbe indietro.
  const [unita, setUnita] = useState([]);
  const [nuovaCategoria, setNuovaCategoria] = useState(null);
  const [aggiungendoCategoria, setAggiungendoCategoria] = useState(false);
  const [esitoCategoria, setEsitoCategoria] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", category: "" });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // ------------------------------------------------------------------
  // La scheda che arriva da una foto scattata altrove (dalla Dashboard,
  // dove il contesto non era noto e l'assistente ha riconosciuto
  // un'etichetta).
  // ------------------------------------------------------------------
  // ⚠️ VIAGGIA NELLA NAVIGAZIONE, non in un deposito: e' lo stesso motivo
  //    per cui la foto non viene mai salvata. Se si ricarica la pagina si
  //    perde, e va rifatta la foto — un prezzo piccolo, pagato una volta,
  //    contro un dato che resterebbe in giro per sempre.
  const posizione = useLocation();
  const schedaDaFoto = posizione.state?.daFoto ?? null;

  // ⚠️ ARRIVANDO DA «+ Nuovo materiale» la scheda nasce gia' spuntata come
  // materiale di consumo: chi è entrato da lì ha già detto cos'è, e
  // chiederglielo di nuovo è un passo per niente. Vale solo in creazione.
  const nasceMateriale = new URLSearchParams(posizione.search).get("materiale") === "1";

  // 🔴 «QUESTO NOME CE L'HA GIÀ QUALCUNO» — 29/08/2026, punto 2c.
  //
  // Da MEMO foto si arriva sempre qui in CREAZIONE, anche quando
  // l'ingrediente generico esiste già: misurato, `create_ingredient` non
  // accorpa niente e su `ingredients` non c'è nessun indice unico sul
  // nome. Fotografando la seconda marca di una cosa che c'è già nasceva
  // **un secondo ingrediente generico**, cioè il difetto che la
  // separazione del 27/08 era andata a togliere.
  //
  // ⚠️ AVVISA, NON BLOCCA: due prodotti possono legittimamente chiamarsi
  // quasi uguali, e se accorpare lo decide l'assistente (25/08). Qui si
  // dice **prima di salvare**, con la via d'uscita — aprire quello che
  // c'è già e appendergli la confezione, invece di crearne un altro.
  //
  // ⚠️ Solo in creazione: in modifica il nome combacia con se stesso.
  const [omonimi, setOmonimi] = useState([]);
  useEffect(() => {
    if (isEdit) {
      setOmonimi([]);
      return;
    }
    const nome = form.name.trim();
    if (nome.length < 3) {
      setOmonimi([]);
      return;
    }
    let annullato = false;
    // Mezzo secondo: si cerca quando si smette di scrivere, non a ogni
    // lettera. Un giro di rete per carattere e' rumore.
    const attesa = setTimeout(() => {
      ingredienteConQuestoNome(nome)
        .then((r) => {
          if (!annullato) setOmonimi(r);
        })
        // ⚠️ SILENZIO MOTIVATO: senza questa risposta la scheda si comporta
        // come si comportava fino al 29/08. Non compare nessuna
        // rassicurazione falsa — non viene detto «il nome e' libero».
        .catch(() => {});
    }, 500);
    return () => {
      annullato = true;
      clearTimeout(attesa);
    };
  }, [form.name, isEdit]);
  useEffect(() => {
    if (!nasceMateriale || isEdit) return;
    setForm((f) => (f.alimentare === false ? f : { ...f, alimentare: false }));
  }, [nasceMateriale, isEdit]);

  useEffect(() => {
    if (!schedaDaFoto || isEdit) return;
    setForm((f) => {
      const { valori } = campiProposti(schedaDaFoto, f);
      const allergeniLetti = (schedaDaFoto.allergeni ?? []).map((a) => a?.codice).filter(Boolean);
      return {
        ...f,
        ...valori,
        allergens: Array.from(new Set([...(f.allergens ?? []), ...allergeniLetti])),
      };
    });
    setLetturaEtichetta((precedente) => {
      if (precedente) return precedente;
      const { valori, proposti } = campiProposti(schedaDaFoto, emptyForm);
      return { scheda: schedaDaFoto, valoriProposti: valori, proposti };
    });
  }, [schedaDaFoto, isEdit]);

  // 🔴 IN QUALE DEI DUE MONDI SI STA — richiesta di Alessio del 29/08, da
  //    una sua schermata: sulla scheda della «Carta forno» gli venivano
  //    proposte verdura, pesce e latticini, e come unita kg, g e mazzo.
  //    ⚠️ Nasce dal prodotto e non dalla schermata da cui si e entrati: un
  //    materiale aperto da un collegamento vecchio resta un materiale.
  const ambito = form.alimentare === false ? "materiali" : "alimenti";

  // I due cataloghi seguono il mondo, e si rileggono quando cambia: senza
  // questo, spuntando «e un alimento» su una scheda l elenco resterebbe
  // quello dei materiali — cioe direbbe il falso senza nessun errore.
  useEffect(() => {
    let annullato = false;
    (async () => {
      try {
        const [c, u] = await Promise.all([listCategorieIngrediente(ambito), listUnita(ambito)]);
        if (annullato) return;
        setCategorie(c);
        setUnita(u);
      } catch {
        // Un catalogo che non si legge NON si finge vuoto: resta com era, e
        // l errore vero lo dice il caricamento della scheda qui sotto.
      }
    })();
    return () => { annullato = true; };
  }, [ambito]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ent = await getEntities();
        if (cancelled) return;
        setEntities(ent);
        setSuppliers(await listSuppliers(ent.srls.id));

        if (isEdit) {
          const ing = await getIngredient(id);
          if (cancelled) return;
          // Se e' gia' messo da parte, il pulsante deve dire «rimettilo».
          setAttivo(ing.active !== false);
          setPrezzoDa(ing.prezzo_da ?? null);
          setForm({
            name: ing.name,
            category: ing.category,
            unit: ing.unit,
            source_type: ing.source_type,
            supplier_id: ing.supplier_id ?? "",
            current_price: ing.current_price,
            allergens: ing.allergens ?? [],
            seasonality: ing.seasonality ?? [],
            storage_type: ing.storage_type ?? "",
            waste_percentage_default: ing.waste_percentage_default ?? "0",
            stock_minimum_threshold: ing.stock_minimum_threshold ?? "",
            temperatura_attesa: ing.temperatura_attesa ?? "",
            haccp_notes: ing.haccp_notes ?? "",
            avvisa_rincari: ing.avvisa_rincari !== false,
            alimentare: ing.alimentare !== false,
            tenuto_in_magazzino: ing.tenuto_in_magazzino !== false,
            va_in_carta: ing.va_in_carta === true,
          });
          // I campi che ha messo la macchina e che nessuno ha ancora
          // guardato. ⚠️ Vuoto NON vuol dire «li ha scritti Alessio»: vuol
          // dire che nessuno li ha messi in dubbio — su un prodotto creato
          // a mano la lista è vuota da sempre.
          setDaConfermare(ing.campi_da_confermare ?? []);
          setFonti(ing.fonti_campi ?? {});
          setPriceHistory(await listPriceHistory(id));
          // ⚠️ Vuoto si legge «questo prodotto non ha altre versioni», e
          // da lì nasce un doppione in anagrafica — che in magazzino è una
          // giacenza sbagliata per sempre.
          setVarianti(await leggi(variantiIngrediente(id)));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const priceAlert = useMemo(() => {
    if (priceHistory.length === 0) return null;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recent = priceHistory.filter(
      (h) => new Date(h.recorded_at) >= threeMonthsAgo
    );
    if (recent.length === 0) return null;
    const avg = recent.reduce((sum, h) => sum + Number(h.price), 0) / recent.length;
    if (avg === 0) return null;
    const variation = ((Number(form.current_price) - avg) / avg) * 100;
    if (Math.abs(variation) > 10) return variation;
    return null;
  }, [priceHistory, form.current_price]);

  const toggleArrayValue = (field, value) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }));
  };

  const handleCreateSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    setCreatingSupplier(true);
    try {
      const created = await createSupplier({
        entityId: entities.srls.id,
        name: newSupplier.name.trim(),
        category: newSupplier.category || null,
      });
      setSuppliers((s) => [...s, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, supplier_id: created.id }));
      setShowNewSupplier(false);
      setNewSupplier({ name: "", category: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  // «Queste due sono lo stesso prodotto». Lo dice Alessio, non il
  // gestionale: due diciture di fornitori diversi sono due stringhe, e
  // nessun confronto automatico può sapere che dentro c'è la stessa cosa.
  const assegnaFornitore = async (articoloId, supplierId) => {
    setError("");
    try {
      await assegnaFornitoreArticolo(articoloId, supplierId);
      setVarianti(await variantiIngrediente(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const collega = async (articoloId, stessoDi) => {
    setError("");
    try {
      await collegaArticoli(articoloId, stessoDi);
      setVarianti(await variantiIngrediente(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        entity_id: entities.srls.id,
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        source_type: form.source_type,
        supplier_id: form.source_type === "fornitore_esterno" ? form.supplier_id || null : null,
        producer_entity_id:
          form.source_type === "produzione_interna" ? entities.agricola.id : null,
        allergens: form.allergens,
        seasonality: form.seasonality,
        storage_type: form.storage_type || null,
        waste_percentage_default: Number(form.waste_percentage_default) || 0,
        // Vuoto e zero sono la stessa cosa qui: nessuna soglia. Zero
        // sarebbe una soglia che non scatta mai, e il database la rifiuta.
        stock_minimum_threshold:
          Number(form.stock_minimum_threshold) > 0
            ? Number(form.stock_minimum_threshold)
            : null,
        temperatura_attesa: form.temperatura_attesa || null,
        haccp_notes: form.haccp_notes || null,
        avvisa_rincari: form.avvisa_rincari,
        alimentare: form.alimentare,
        tenuto_in_magazzino: form.tenuto_in_magazzino,
        va_in_carta: form.va_in_carta,
      };

      let idProdotto = id;
      if (isEdit) {
        await updateIngredientFields(id, payload);
      } else {
        const created = await createIngredient({
          ...payload,
          current_price: Number(form.current_price) || 0,
        });
        idProdotto = created.id;
      }

      // ------------------------------------------------------------------
      // Quello che viene da una foto d'etichetta si registra DOPO, quando
      // il prodotto esiste.
      // ------------------------------------------------------------------
      // ⚠️ SE QUESTA PARTE FALLISCE, IL PRODOTTO RESTA SALVATO. E' una
      //    scrittura di conseguenza, come lo scarico di magazzino alla
      //    chiusura di un conto: perdere le origini degli allergeni e' un
      //    danno molto piu' piccolo che perdere la scheda che Alessio ha
      //    appena compilato. Il guaio si dichiara invece di sparire.
      if (letturaEtichetta) {
        try {
          // ------------------------------------------------------------
          // IL PRODOTTO NASCE QUI, appeso all'ingrediente appena salvato.
          // ------------------------------------------------------------
          // ⚠️ Fino al 27/08/2026 una foto faceva nascere un INGREDIENTE
          //    nuovo ogni volta: due marche di maionese diventavano due
          //    ingredienti, e il food cost dei piatti si spezzava in due.
          //    Ora l'ingrediente resta uno e sotto di lui stanno le
          //    versioni comprate.
          // ⚠️ Si passa `ingredient_id`: senza, la funzione cercherebbe per
          //    NOME, e un nome corretto a mano qui sopra ne farebbe nascere
          //    un secondo — il difetto rientrato dalla finestra.
          const s = letturaEtichetta.scheda;
          if (s?.prodotto || s?.marca || s?.formato) {
            await registraProdottoLetto({
              ingredient_id: idProdotto,
              prodotto: s.prodotto ?? null,
              marca: s.marca ?? null,
              formato: s.formato ?? null,
              nome_esteso: s.nome_esteso ?? null,
              quantita_confezione: s.quantita_confezione ?? null,
            });
          }

          const daScrivere = allergeniDaScrivere(letturaEtichetta.scheda, form.allergens);
          if (daScrivere.length > 0) {
            await applicaLetturaEtichetta(idProdotto, { allergeni: daScrivere });
          }
          const rimasti = campiRimastiDellAssistente(letturaEtichetta.valoriProposti, form);
          await marcaCampiDallAssistente(idProdotto, rimasti);
        } catch (errore) {
          setError(
            `L'ingrediente è salvato, ma non sono riuscito a registrare la versione letta dall'etichetta e da dove vengono gli allergeni: ${errore.message}. Puoi sistemarli a mano dalla scheda.`
          );
          setSaving(false);
          return;
        }
      }

      // 🔴 DOPO il salvataggio riuscito, mai prima.
      await venuto.chiudi();
      navigate(`/ricettario/ingredienti/${idProdotto}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // La categoria che manca si aggiunge da qui
  // ------------------------------------------------------------------
  // ⚠️ SI SELEZIONA DA SÉ dopo averla aggiunta: chi la scrive la vuole per
  //    il prodotto che sta inserendo, e obbligarlo a cercarla nel menu
  //    subito dopo averla creata sarebbe un passo in più per niente.
  // ⚠️ E SE ESISTE GIÀ non si fa finta di averla creata: si dice quale, e la
  //    si seleziona comunque — è quello che chi ha scritto quel nome
  //    voleva. Due categorie che si somigliano sono il doppione che il
  //    catalogo esiste per evitare.
  const aggiungiCategoria = async () => {
    const nome = (nuovaCategoria ?? "").trim();
    if (!nome) return;
    setAggiungendoCategoria(true);
    setEsitoCategoria("");
    try {
      const r = await aggiungiCategoriaIngrediente(nome, ambito);
      setCategorie(await listCategorieIngrediente(ambito));
      setForm((f) => ({ ...f, category: r.codice }));
      setNuovaCategoria(null);
      setEsitoCategoria(
        r.nuova
          ? `«${r.nome}» aggiunta, ed è già scelta qui sopra.`
          : `«${r.nome}» c'era già: l'ho scelta qui sopra invece di crearne una seconda.`
      );
    } catch (e) {
      setEsitoCategoria(e.message);
    } finally {
      setAggiungendoCategoria(false);
    }
  };

  // ------------------------------------------------------------------
  // I CAMPI DI UNA VERSIONE, IN UN POSTO SOLO
  // ------------------------------------------------------------------
  // ⚠️ Li leggono DUE disposizioni — i blocchetti del telefono e la tabella
  //    del computer — e due elenchi di colonne divergono in silenzio: a
  //    restare indietro sarebbe il telefono, che è la strada maestra
  //    (lezione del 25/08/2026 sul Ricettario).
  const celleVersione = (v, i) => [
    {
      chiave: "versione",
      intestazione: "Versione",
      contenuto: (
        <>
          {v.descrizione}
          {v.stesso_di && (
            <span className="testo-sala text-b58-charcoal-soft"> · stesso prodotto</span>
          )}
          {/* Marca e formato. ⚠️ Il commento sopra questa tabella li promette
              dal giorno in cui è stata scritta, e non c'erano: quelle colonne
              sono nate il 27/08/2026 con la separazione fra prodotto e
              ingrediente. Vanno a capo perché sono l'informazione con cui si
              riconosce la confezione, non un dettaglio del nome. */}
          {(v.marca || v.formato) && (
            <span className="block testo-sala text-b58-charcoal-soft">
              {[v.marca, v.formato].filter(Boolean).join(" · ")}
            </span>
          )}
          {/* Quante volte quella versione è entrata davvero. Distingue «la
              compro sempre» da «l'ho provata una volta», che è la domanda con
              cui si guarda questo elenco. */}
          {v.carichi > 0 && (
            <span className="block testo-sala text-b58-charcoal-soft">
              entrata {v.carichi === 1 ? "una volta" : `${v.carichi} volte`}
            </span>
          )}
        </>
      ),
    },
    {
      chiave: "fornitore",
      intestazione: "Chi la vende",
      contenuto: (
        // Le diciture nate dalle prime fatture non ce l'hanno, perché
        // all'epoca non c'era nessun fornitore in anagrafica — e senza,
        // l'ordine non può chiamare il prodotto come lo chiama lui.
        <select
          value={v.fornitore_id ?? ""}
          onChange={(e) => assegnaFornitore(v.articolo_id, e.target.value)}
          className="tocco-campo testo-sala rounded border border-b58-charcoal/15 bg-white px-1.5 max-w-full"
        >
          <option value="">chi la vende?</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      chiave: "prezzo",
      intestazione: `Prezzo per ${form.unit}`,
      intestazioneTabella: `€/${form.unit}`,
      destra: true,
      contenuto: (
        <>
          {v.prezzo ? Number(v.prezzo).toFixed(2) : "—"}
          {i === 0 && v.prezzo && <span className="testo-sala text-b58-olive"> ↓ la più conveniente</span>}
        </>
      ),
    },
    {
      chiave: "ultima",
      intestazione: "Ultima volta",
      destra: true,
      contenuto: (
        <span className="text-b58-charcoal-soft testo-sala">
          {v.ultima_volta ? formatDate(v.ultima_volta) : "—"}
        </span>
      ),
    },
    {
      chiave: "collega",
      intestazione: "È lo stesso prodotto di…",
      intestazioneTabella: "",
      destra: true,
      // ⚠️ Con una versione sola non c'è niente da collegare: un menù che si
      //    apre vuoto sembra un menù rotto, e accanto a quello del fornitore
      //    fa sbagliare bersaglio.
      soloTabella: varianti.length <= 1,
      contenuto:
        varianti.length > 1 ? (
          // Il gestionale vede due stringhe e non può sapere che dentro c'è
          // la stessa cosa: glielo dice Alessio, una volta, e da lì in poi
          // le confronta da sole.
          <select
            value={v.stesso_di ?? ""}
            onChange={(e) => collega(v.articolo_id, e.target.value || null)}
            className="tocco-campo testo-sala rounded border border-b58-charcoal/15 bg-white px-1.5 max-w-full"
          >
            <option value="">— versione a sé —</option>
            {varianti
              .filter((a) => a.articolo_id !== v.articolo_id)
              .map((a) => (
                <option key={a.articolo_id} value={a.articolo_id}>
                  = {a.descrizione}
                </option>
              ))}
          </select>
        ) : null,
    },
  ];

  const handleUpdatePrice = async () => {
    if (!newPrice) return;
    setUpdatingPrice(true);
    setError("");
    try {
      await updateIngredientPrice(id, Number(newPrice), { note: priceNote || undefined });
      setForm((f) => ({ ...f, current_price: Number(newPrice) }));
      // ⚠️ Si aggiorna anche la provenienza: senza, la riga sotto il numero
      //    continuerebbe a dire da dove veniva il prezzo di PRIMA — cioè una
      //    frase diventata falsa nel momento in cui si preme il pulsante.
      setPrezzoDa("a_mano");
      setPriceHistory(await listPriceHistory(id));
      setNewPrice("");
      setPriceNote("");
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingPrice(false);
    }
  };

  if (loading) {
    return <p className="testo-sala-grande text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  // ---------------------------------------------------------------
  // IL SEGNO «MESSO DALLA MACCHINA» (23/08/2026)
  //
  // ⚠️ Sta DENTRO il campo, non in un riquadro in cima: una spiegazione
  // sopra la schermata si legge il primo giorno e poi diventa arredamento,
  // e qui il dubbio è su un numero preciso — «questo 18% l'ho detto io o
  // l'ha indovinato la macchina?».
  //
  // ⚠️ E non blocca niente, per decisione di Alessio: è un segno. Il
  // prodotto si usa, si vende, e il suo piatto va in carta lo stesso.
  const segnoMacchina = (campo) => {
    if (!daConfermare.includes(campo)) return null;
    return (
      <span className="inline-flex items-center gap-2 ml-2 align-middle">
        {/* 🔴 ERANO DUE MISURE IN PIXEL FISSI (`text-[0.68rem]`), trovate
            MISURANDO questa scheda il 29/08 e non leggendola: su un tablet
            calibrato valevano **1,70 mm** di testo, e «va bene così» era un
            bersaglio da **2,12 mm** — un pulsante che si preme con un dito.
            È la famiglia dei pixel fissi già tolta dal Ricettario il 25/08,
            rimasta qui dentro. Le classi del progetto sono in centimetri
            veri e valgono 3,20 mm su qualunque schermo. */}
        <span className="rounded bg-amber-100 text-amber-900 px-1.5 py-0.5 testo-sala font-medium">
          messo dalla macchina
        </span>
        <button
          type="button"
          className="tocco-bottone testo-sala underline text-b58-charcoal-soft hover:text-b58-charcoal"
          onClick={async () => {
            // ⚠️ Si conferma SUBITO, senza aspettare il salvataggio del
            // modulo: «va bene così» non cambia nessun valore, quindi non
            // c'è niente da salvare — e legarlo al Salva vorrebbe dire che
            // chi guarda un campo e poi esce non ha confermato niente.
            // ⚠️ E SE LA CONFERMA NON RIESCE, SI DICE. Il primo tentativo
            // inghiottiva il guasto in silenzio, e l'ha preso la prova
            // automatica delle letture mute: il segnetto sarebbe rimasto lì
            // senza nessuna spiegazione, e chi preme due volte senza vedere
            // niente conclude che il pulsante non funziona.
            //
            // ⚠️ E la stessa prova, la volta dopo, ha segnalato questo
            // commento: dentro c'era scritta la forma che vieta, e il
            // setaccio guarda il testo — non il comportamento. È la lezione
            // del 22/08 vista da vicino: *un censimento automatico dice dove
            // guardare, non cosa è vero.*
            try {
              setError("");
              setDaConfermare(await confermaCampiProdotto(id, [campo]));
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          va bene così
        </button>
      </span>
    );
  };

  // 🔴 IL VESTITO DA INGREDIENTE SI TOGLIE A CHI NON È UN ALIMENTO —
  // 29/08/2026, punto 2a, decisione di Alessio.
  // ⚠️ Non è un secondo magazzino: prezzo, fornitore, scorta minima,
  // sorveglianza dei prezzi e giacenza RESTANO — carta forno e detersivi
  // sono costi come gli altri. Spariscono solo i campi che descrivono un
  // cibo, e che su un rotolo di carta non vogliono dire niente.
  // ⚠️ Misurato prima di nasconderli, sui 4 non alimentari veri: «Carta
  // forno» portava stagionalità «tutto l'anno», temperatura di consegna
  // «ambiente» e il 3% di scarto.
  // ⚠️ I VALORI NON SI CANCELLANO, si smette di mostrarli: cancellarli
  // sarebbe una decisione sui suoi dati che nessuno mi ha chiesto. Restano
  // inerti — dal 29/08 un non alimentare non può entrare in una ricetta, e
  // il divieto è nel database.
  const eAlimento = form.alimentare !== false;

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* 🔴 IL RITORNO SEGUE IL PRODOTTO, non la schermata da cui la scheda
          è nata (visto aprendo una scheda, il 29/08). Da quando i materiali
          di consumo hanno una sezione loro, «← Ingredienti» su una carta
          forno porta in un elenco dove quel prodotto **non c'è più**: un
          vicolo cieco, che in questo progetto è un difetto a sé. */}
      <Link
        to={eAlimento ? "/ricettario/ingredienti" : "/magazzino/materiali"}
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        {eAlimento ? "← Ingredienti" : "← Materiali di consumo"}
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        {isEdit
          ? form.name || (eAlimento ? "Ingrediente" : "Materiale di consumo")
          : eAlimento
            ? "Nuovo ingrediente"
            : "Nuovo materiale di consumo"}
      </h1>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <StriscaDallaVoce venuto={venuto} />

      {/* ⚠️ IL CONTESTO E' GIA' NOTO: si sta guardando un prodotto, quindi
          non si chiede dove mettere quello che viene letto — sarebbe una
          domanda con una risposta sola. Ma se la foto non e' un'etichetta,
          l'assistente lo dice e non si tocca niente. */}
      {/* 🔴 5a · LA FOTO DELL ETICHETTA NON HA SENSO SU UN MATERIALE
          (Alessio, 29/08): un rotolo di carta forno non ha allergeni,
          conservazione ne scadenza da leggere. */}
      <div className={eAlimento ? "mb-4" : "hidden"}>
        <ScattaFoto
          genere="etichetta"
          etichettaPulsante="Fotografa l'etichetta"
          onLetto={(esito) => {
            if (!esito || esito.esito !== "letta" || !esito.scheda) {
              setLetturaEtichetta(null);
              return;
            }
            const { valori, proposti } = campiProposti(esito.scheda, form);
            const allergeniLetti = (esito.scheda.allergeni ?? [])
              .map((a) => a?.codice)
              .filter(Boolean);
            setForm((f) => ({
              ...f,
              ...valori,
              // Gli allergeni si uniscono a quelli che c'erano: toglierne
              // uno che Alessio aveva gia' messo sarebbe la cosa
              // pericolosa, e lui li vede tutti prima di salvare.
              allergens: Array.from(new Set([...(f.allergens ?? []), ...allergeniLetti])),
            }));
            setLetturaEtichetta({ scheda: esito.scheda, valoriProposti: valori, proposti });
          }}
        />

        {letturaEtichetta && (
          <div className="testo-sala mt-2 rounded-md bg-emerald-50 p-3 text-emerald-900">
            <p className="font-semibold">
              Ho letto l&apos;etichetta e riempito la scheda qui sotto. Controllala e salva.
            </p>
            {letturaEtichetta.scheda.dopo_apertura && (
              <p className="mt-1">
                Dopo l&apos;apertura: {letturaEtichetta.scheda.dopo_apertura}
              </p>
            )}
            {/* ⚠️ L'ORIGINE DI OGNI ALLERGENE SI VEDE PRIMA DI SALVARE, non
                dopo: è il momento in cui Alessio può correggere. Un
                allergene «dedotto» è una cosa diversa da uno letto, e in
                sala si comporterà diversamente. */}
            {(letturaEtichetta.scheda.allergeni ?? []).length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {letturaEtichetta.scheda.allergeni.map((a) => (
                  <li key={a.codice}>
                    <span className="font-semibold">
                      {ALLERGENS.find((x) => x.value === a.codice)?.label ?? a.codice}
                    </span>
                    {a.origine === "etichetta"
                      ? " — scritto sull'etichetta"
                      : a.origine === "fonte"
                        ? ` — ricavato da: ${a.fonte ?? "(fonte non indicata)"}`
                        : " — dedotto dal tipo di prodotto, nessuno l'ha letto sull'etichetta"}
                  </li>
                ))}
              </ul>
            )}
            {letturaEtichetta.scheda.ingredienti_letti ? (
              <p className="mt-2 text-emerald-800">
                Ingredienti letti: {letturaEtichetta.scheda.ingredienti_letti}
              </p>
            ) : (
              <p className="mt-2 text-emerald-800">
                L&apos;elenco ingredienti non si leggeva: gli allergeni qui sopra sono dedotti dal
                tipo di prodotto.
              </p>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder='Es. "Pomodoro San Marzano DOP"'
              className={inputClass}
            />
            {omonimi.length > 0 && (
              <p className="mt-1.5 testo-sala text-b58-charcoal bg-b58-gold/25 rounded-lg px-3 py-2">
                Questo nome ce l&apos;ha già{" "}
                {omonimi.map((o, i) => (
                  <span key={o.id}>
                    {i > 0 && ", "}
                    <Link
                      to={`/ricettario/ingredienti/${o.id}`}
                      className="underline font-medium hover:text-b58-terracotta-dark"
                    >
                      {o.name}
                    </Link>
                  </span>
                ))}
                . Se è la stessa cosa comprata da un&apos;altra marca, aprilo e
                aggiungi lì la confezione: così il costo dei piatti resta su un
                ingrediente solo.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Categoria</label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>
                Seleziona…
              </option>
              {categorie.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* 🔴 LA CATEGORIA SI AGGIUNGE DA QUI, mentre si inserisce il
                prodotto — richiesta di Alessio del 27/08/2026: se manca
                quella giusta, prima ci si fermava, e la misura di quanto
                servisse è che 20 prodotti su 133 stavano in «altro».
                ⚠️ STA SOTTO IL CAMPO, non in un'altra schermata: il momento
                in cui uno si accorge che manca è mentre sta compilando. */}
            {/* 🔴 `=== null`, NON `!nuovaCategoria`: gli stati sono TRE —
                chiuso (`null`), aperto e vuoto (`""`), e scritto — e una
                stringa vuota è FALSA, quindi con `!` il campo non compariva
                MAI. Trovato aprendo la schermata, non rileggendola.
                ⚠️ In SQL la stessa famiglia si presenta al contrario: là il
                terzo stato sparisce dai CONFRONTI (26/08 e 27/08); qui in
                JavaScript sparisce nei controlli di verità. */}
            {nuovaCategoria === null ? (
              <button
                type="button"
                onClick={() => setNuovaCategoria("")}
                className="tocco-inline mt-1 testo-sala text-b58-charcoal-soft underline hover:text-b58-terracotta"
              >
                Manca la categoria giusta? Aggiungila
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <input
                  value={nuovaCategoria}
                  onChange={(e) => setNuovaCategoria(e.target.value)}
                  placeholder="Es. Conserve"
                  className={`${inputClass} flex-1 min-w-[140px]`}
                />
                <button
                  type="button"
                  disabled={aggiungendoCategoria || !nuovaCategoria.trim()}
                  onClick={aggiungiCategoria}
                  className="tocco-bottone rounded-lg bg-b58-olive px-3 testo-sala-grande text-white disabled:opacity-40"
                >
                  {aggiungendoCategoria ? "Aggiungo…" : "Aggiungi"}
                </button>
                <button
                  type="button"
                  onClick={() => setNuovaCategoria(null)}
                  className="tocco-inline testo-sala text-b58-charcoal-soft underline"
                >
                  lascia stare
                </button>
              </div>
            )}
            {/* ⚠️ L'esito si dice SULLA RIGA, non in cima alla pagina: un
                messaggio lontano dal gesto è un messaggio che non c'è
                (lezione del 17/08, ripagata due volte il 27/08). */}
            {esitoCategoria && (
              <p className="mt-1 testo-sala text-b58-charcoal-soft">{esitoCategoria}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Unità</label>
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              {unita.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Provenienza */}
        <div>
          {/* 🔴 5b · «PRODUZIONE INTERNA (ORTO)» NON HA SENSO SU UN MATERIALE
              (Alessio, 29/08): un rotolo di carta forno non viene dall orto.
              ⚠️ Spariscono i due pulsanti, NON il fornitore: quello resta e
              serve — un materiale si compra da qualcuno come tutto il resto,
              ed e stato detto espressamente di lasciarlo. */}
          <label className={eAlimento ? labelClass : "hidden"}>Provenienza</label>
          <div className={eAlimento ? "flex gap-2 mb-3" : "hidden"}>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, source_type: "fornitore_esterno" }))}
              className={`flex-1 tocco-campo rounded-lg border px-3 py-2 testo-sala-grande transition-colors ${
                form.source_type === "fornitore_esterno"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Fornitore esterno
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, source_type: "produzione_interna" }))}
              className={`flex-1 tocco-campo rounded-lg border px-3 py-2 testo-sala-grande transition-colors ${
                form.source_type === "produzione_interna"
                  ? "border-b58-olive bg-b58-olive/10 text-b58-olive-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Produzione interna (orto)
            </button>
          </div>

          {form.source_type === "fornitore_esterno" ? (
            <div>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Nessun fornitore specifico</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {!showNewSupplier ? (
                <button
                  type="button"
                  onClick={() => setShowNewSupplier(true)}
                  className="tocco-testo testo-sala-grande text-b58-terracotta hover:text-b58-terracotta-dark mt-2"
                >
                  + Nuovo fornitore
                </button>
              ) : (
                <div className="mt-3 tocco-campo rounded-lg border border-b58-charcoal/15 p-3 space-y-2 bg-white">
                  <input
                    value={newSupplier.name}
                    onChange={(e) =>
                      setNewSupplier((s) => ({ ...s, name: e.target.value }))
                    }
                    placeholder="Nome fornitore"
                    className={inputClass}
                  />
                  <select
                    value={newSupplier.category}
                    onChange={(e) =>
                      setNewSupplier((s) => ({ ...s, category: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">Categoria (opzionale)</option>
                    {SUPPLIER_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={creatingSupplier}
                      onClick={handleCreateSupplier}
                      className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-3 py-1.5 disabled:opacity-60"
                    >
                      {creatingSupplier ? "Salvo…" : "Salva fornitore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewSupplier(false)}
                      className="testo-sala-grande text-b58-charcoal-soft px-3 py-1.5"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="testo-sala-grande text-b58-charcoal-soft bg-b58-olive/5 rounded-lg px-3 py-2">
              Prodotto dall'azienda agricola (non ancora operativa). Il prezzo qui
              sotto rappresenta il valore della cessione intercompany.
            </p>
          )}
        </div>

        {/* Prezzo — solo in creazione. In modifica si usa la sezione dedicata sotto. */}
        {!isEdit && (
          <div>
            <label className={labelClass}>Prezzo unitario (IVA esclusa)</label>
            <input
              required
              type="number"
              step="0.0001"
              min="0"
              value={form.current_price}
              onChange={(e) => setForm((f) => ({ ...f, current_price: e.target.value }))}
              className={inputClass}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 🔴 5c · LA CONSERVAZIONE NON HA SENSO SU UN MATERIALE
              (Alessio, 29/08): frigo, freezer e dispensa parlano di roba da
              mangiare. Con lei sparisce anche l etichetta gialla «messo
              dalla macchina», che ne era il segno. */}
          <div className={eAlimento ? undefined : "hidden"}>
            <label className={labelClass}>Conservazione{segnoMacchina("conservazione")}</label>
            <select
              value={form.storage_type}
              onChange={(e) => setForm((f) => ({ ...f, storage_type: e.target.value }))}
              className={inputClass}
            >
              <option value="">—</option>
              {STORAGE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className={eAlimento ? undefined : "hidden"}>
            {/* 🔴 LO SCARTO NON LO PROPONE PIÙ NESSUNO (23/08/2026,
                decisione di Alessio): il dato vero emerge dalla
                preparazione — un chilo di alici che diventa un chilo di
                sugo — e lo stesso ingrediente ha rese diverse a seconda di
                dove finisce. Un numero inventato entra nel costo di ogni
                piatto e nessuno lo verifica mai. */}
            <label className={labelClass}>% scarto standard{segnoMacchina("scarto")}</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.waste_percentage_default}
              onChange={(e) =>
                setForm((f) => ({ ...f, waste_percentage_default: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          {/* La scorta minima è quello che fa nascere una riga nella lista
              della spesa. Volutamente VUOTA di partenza e mai proposta dal
              sistema: senza mesi di consumi veri un numero inventato
              sarebbe credibile e sbagliato, e finirebbe in un ordine. */}
          <div>
            <label className={labelClass}>Scorta minima ({form.unit || "unità"})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.stock_minimum_threshold}
              onChange={(e) =>
                setForm((f) => ({ ...f, stock_minimum_threshold: e.target.value }))
              }
              className={inputClass}
              placeholder="vuota = mai in lista da solo"
            />
            <p className="testo-sala text-b58-charcoal-soft mt-1">
              Sotto questa quantità il prodotto entra da solo nella lista della
              spesa. Lasciala vuota se preferisci deciderlo tu ogni volta.
            </p>
          </div>
          {/* Due interruttori, e il secondo è quello che decide se questo
              prodotto ti farà squillare il telefono. Acceso di partenza:
              si spegne sui prodotti che ballano per stagione o per
              mercato, dove un avviso a ogni consegna si smette di
              leggere. */}
          <div className="sm:col-span-2 space-y-2">
            <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.avvisa_rincari}
                onChange={(e) => setForm((f) => ({ ...f, avvisa_rincari: e.target.checked }))}
              />
              Avvisami se il prezzo sale
              <Didascalia>
                Qualunque aumento, anche piccolo. Togli la spunta su ciò che varia
                sempre per stagione o per mercato: un avviso a ogni consegna si
                smette di leggere.
              </Didascalia>
            </label>
            {/* 🔴 5d · DENTRO I MATERIALI DI CONSUMO LA RISPOSTA È IMPLICITA
                (Alessio, 29/08, ed è il più importante dei cinque campi che ha
                chiesto di togliere): una casella «È un alimento» spuntabile da
                qui rimanda la carta forno in mezzo al baccalà, e disfa il
                lavoro fatto. Su un alimento la casella resta — è da lì che si
                dichiara che una cosa è un materiale. */}
            {eAlimento ? (
              <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
                <input
                  type="checkbox"
                  checked={form.alimentare}
                  onChange={(e) => setForm((f) => ({ ...f, alimentare: e.target.checked }))}
                />
                È un alimento
                <Didascalia>
                  Togli la spunta per detersivi, carta, imballaggi: restano sotto
                  controllo prezzi, con la loro scorta minima e la loro lista
                  della spesa, ma stanno in Magazzino → Materiali di consumo e
                  non possono entrare in una ricetta.
                </Didascalia>
              </label>
            ) : (
              /* ⚠️ LA VIA DI RITORNO, ed è un'aggiunta mia sopra la richiesta:
                 togliendo la casella e basta, un prodotto finito qui per
                 sbaglio non potrebbe più tornare fra gli ingredienti da
                 nessuna schermata — e un vicolo cieco, in questo progetto, è
                 un difetto a sé. Non è la casella di prima: è un gesto
                 NOMINATO, che non si preme per distrazione mentre si guarda
                 il prezzo. Se ad Alessio non serve, si toglie in tre righe. */
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, alimentare: true }))}
                className="tocco-inline testo-sala text-b58-charcoal-soft underline hover:text-b58-terracotta self-start"
              >
                Non è un materiale: rimettilo fra gli ingredienti
              </button>
            )}
            {/* 🔴 LE SPEZIE A PIZZICO (23/08/2026, decisione di Alessio).
                Non è una preferenza di comodo: un prodotto che in un piatto
                pesa meno di un decimo di grammo il magazzino non lo sa
                scaricare — e prima del 23/08 quel pizzico faceva fallire lo
                scarico dell'intero tavolo. Togliendo la spunta il gestionale
                smette di fingere di seguirlo: si compra, il costo resta sulla
                fattura, la giacenza non si racconta. */}
            <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.tenuto_in_magazzino}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tenuto_in_magazzino: e.target.checked }))
                }
              />
              Il magazzino lo segue
              <Didascalia>
                Togli la spunta alle spezie a pizzico: si comprano, ma non si
                scaricano e non entrano in lista della spesa.
              </Didascalia>
            </label>

            {/* 🔴 IL SEGNO DELLA CARTA — costruito nel database il 31/08 e
                per mezza giornata **senza nessuna schermata che lo
                scrivesse**: la colonna c'era, la Cantina la leggeva, e non
                esisteva un posto dove spuntarla. Quinta volta della stessa
                famiglia in due giorni.
                ⚠️ E NON SI DEDUCE DAL MONDO, ed è la ragione di Alessio:
                dentro «Vini» ci sono anche il vino da cucina e le bottiglie
                del personale. Il mondo dice **che cosa è**, questo dice **se
                si vende**. */}
            <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.va_in_carta}
                onChange={(e) => setForm((f) => ({ ...f, va_in_carta: e.target.checked }))}
              />
              Si vende al cliente (va in carta)
              <Didascalia>
                Spunta le bottiglie e le bevande che finiscono sulla carta.
                Il vino da cucina e l&apos;acqua del personale no: stanno in
                magazzino, ma non si vendono.
              </Didascalia>
            </label>
          </div>

          <div className={eAlimento ? undefined : "hidden"}>
            {/* 🔴 IL NOME È LA CURA (23/08/2026, reperto di Alessio): «come
                fa a sapere a che temperatura sono gli ingredienti che
                arrivano? Dovrebbe sapere a che temperatura DOVREBBERO
                essere». Questo campo è una NORMA, non una misurazione — e
                chiamandolo «Temperatura ricevimento (HACCP)» sembrava il
                dato del registro. Il registro attesta misurazioni: un
                numero indovinato da una macchina lì dentro lo renderebbe
                falso, e a un'ispezione risponde chi l'ha firmato. */}
            <label className={labelClass}>
              Temperatura attesa alla consegna{segnoMacchina("temperatura")}
            </label>
            <input
              value={form.temperatura_attesa}
              onChange={(e) =>
                setForm((f) => ({ ...f, temperatura_attesa: e.target.value }))
              }
              placeholder="Es. ≤ 4°C"
              className={inputClass}
            />
            <p className="mt-1 testo-sala text-b58-charcoal-soft">
              A che temperatura <em>dovrebbe</em> arrivare. Quella vera si
              misura col termometro alla consegna e si scrive nel registro
              HACCP: questa non ci finisce mai.
            </p>
          </div>
        </div>

        <div className={eAlimento ? undefined : "hidden"}>
          <label className={labelClass}>Note HACCP</label>
          <textarea
            value={form.haccp_notes}
            onChange={(e) => setForm((f) => ({ ...f, haccp_notes: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </div>

        <div className={eAlimento ? undefined : "hidden"}>
          <label className={labelClass}>Allergeni</label>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <button
                type="button"
                key={a.value}
                onClick={() => toggleArrayValue("allergens", a.value)}
                className={`tocco-bottone inline-flex items-center rounded-full testo-sala px-3 py-1.5 border transition-colors ${
                  form.allergens.includes(a.value)
                    ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className={eAlimento ? undefined : "hidden"}>
          {/* 🔴 DODICI MESI ACCESI SONO «TUTTO L'ANNO» — 29/08/2026,
              decisione di Alessio. Misurato prima di scriverlo: **35
              prodotti su 133** avevano tutti e dodici i mesi accesi e
              **zero** dicevano «tutto l'anno», che pure esiste nel
              vocabolario dal primo giorno. A schermo i due casi si vedono
              uguali; nel database no, e il giorno che si vorrà sapere cosa
              è davvero stagionale non si distinguono.
              ⚠️ La regola vale NEI DUE VERSI, e il secondo è quello che il
              database non può fare: togliendo agosto da «tutto l'anno»
              restano **undici** mesi, e quali undici lo sa solo chi ha
              toccato. Sta in `src/lib/calcoli/stagionalita.js`; la
              normalizzazione, che deve valere anche per MEMO e per le
              fatture, è un trigger. */}
          <label className={labelClass}>Stagionalità{segnoMacchina("stagionalita")}</label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    seasonality: stagionalitaDopoIlTocco(f.seasonality, m.value),
                  }))
                }
                className={`tocco-bottone inline-flex items-center rounded-full testo-sala px-3 py-1.5 border transition-colors ${
                  meseAcceso(form.seasonality, m.value)
                    ? "bg-b58-olive text-b58-parchment border-b58-olive"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {/* Da quale calendario viene, quando l'ha proposta la macchina. */}
          {fonti.stagionalita && (
            <p className="mt-1 testo-sala text-b58-charcoal-soft">
              secondo: {fonti.stagionalita}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 testo-sala-grande"
          >
            {saving
              ? "Salvo…"
              : isEdit
                ? "Salva modifiche"
                : eAlimento
                  ? "Crea ingrediente"
                  : "Crea materiale"}
          </button>
        </div>
      </form>

      {/* 🔴 TOGLIERE UN INGREDIENTE (24/08/2026, punto (a) del collaudo).
          Prima qui c'era solo «Salva modifiche»: nessun modo di eliminarlo
          e nessuno di metterlo da parte, mentre nella scheda del fornitore
          «Disattiva» esisteva gia'.

          ⚠️ E IL GESTIONALE DICE IN QUALE CASO SEI, invece di lasciartelo
          scoprire premendo: se l'ingrediente e' gia' stato usato, il
          pulsante «Elimina» non c'e' — c'e' la ragione, e la via
          d'uscita. Un pulsante che a volte funziona e a volte no, senza
          spiegare, e' peggio di un pulsante che non c'e'. */}
      {isEdit && (
        <div className="mt-8 rounded-xl border border-b58-charcoal/15 p-5">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">
            Toglierlo dagli elenchi
            <Didascalia>
              Metterlo da parte lo fa sparire da dove lo cerchi, ma resta
              agganciato a tutto quello che l&apos;ha usato: ricette, carichi,
              partite in magazzino, food cost gia&apos; calcolati. Cancellarlo
              davvero si puo&apos; solo se non l&apos;ha mai usato nessuno.
            </Didascalia>
          </h2>

          {usi === null ? (
            <p className="testo-sala-grande text-b58-charcoal-soft">Guardo dove è usato…</p>
          ) : nonLetto(usi) ? (
            <DatoNonLetto
              cosa="dove è usato questo ingrediente"
              nonVuolDire="Non vuol dire che non è usato da nessuna parte: vuol dire che non lo so, e finché non lo so non ti offro di cancellarlo."
              onRiprova={guardaGliUsi}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={togliendo}
                  onClick={() => cambiaPresenza(!attivo)}
                  className="tocco-bottone rounded-lg border border-b58-charcoal/20 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande px-4 disabled:opacity-60"
                >
                  {attivo ? "Mettilo da parte" : "Rimettilo negli elenchi"}
                </button>

                {usi.length === 0 ? (
                  /* ⚠️ Il pulsante si trasforma in conferma sul posto: non
                     e' una finestra, e il secondo tocco cade lontano dal
                     primo — cosi' non si conferma per inerzia. */
                  <ConfermaDistruttiva
                    etichetta="Elimina definitivamente"
                    cosaSparisce={`l'ingrediente «${form.name || "senza nome"}»`}
                    domanda="Non l'ha mai usato nessuno, quindi sparisce e basta."
                    etichettaConferma="Sì, elimina"
                    onConferma={eliminaDavvero}
                    disabilitato={togliendo}
                  />
                ) : (
                  <span className="testo-sala-grande text-b58-charcoal-soft">
                    Non si può eliminare: compare in{" "}
                    {usi.map((u) => `${u.dove} (${u.quante})`).join(", ")}.
                  </span>
                )}
              </div>

              {!attivo && (
                <p className="mt-3 testo-sala-grande text-b58-charcoal">
                  ⚠️ È messo da parte: non compare negli elenchi dove lo cerchi,
                  ma tutto quello che l&apos;ha usato continua a nominarlo.
                </p>
              )}
            </>
          )}
        </div>
      )}


      {/* Le versioni comprate davvero: marca, formato, fornitore, prezzo
          per unità. È la tabella disegnata da Alessio il 12/08/2026 —
          «vedo tutte le versioni di olio che ho comprato e scelgo
          consapevolmente cosa continuare a comprare», e serve anche a
          vedere se un fornitore è più caro di un altro sullo stesso
          identico prodotto. */}
      {isEdit && nonLetto(varianti) && (
        /* 🔴 Vuoto qui si legge «questo prodotto non ha altre versioni», e
           da lì nasce un doppione in anagrafica — che in magazzino è una
           giacenza sbagliata per sempre. */
        <DatoNonLetto
          cosa="le altre versioni di questo prodotto"
          className="mt-6"
        />
      )}

      {isEdit && !nonLetto(varianti) && varianti.length > 0 && (
        <div className="mt-6 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">
            Versioni che compri
          </h2>
          <p className="testo-sala text-b58-charcoal-soft mb-3">
            Dalla più conveniente. Il prezzo è sempre per {form.unit}, così formati diversi si
            possono confrontare.
          </p>
          {/* 🔴 BLOCCHETTI SUL TELEFONO, TABELLA SUL COMPUTER — la forma del
              25/08/2026, e qui serviva. Misurato a 375 punti: la tabella
              chiedeva **809 punti in un riquadro da 295**, e la colonna
              «Versione» ne aveva **74** — dentro i quali il nome del prodotto,
              la marca e il formato andavano a capo una parola per riga. La
              larghezza la facevano i due menu (232 + 423 punti), non il testo.
              ⚠️ E I CAMPI STANNO IN UN POSTO SOLO (`celleVersione`): due
              elenchi di colonne divergono in silenzio, e a restare indietro
              sarebbe il telefono, che è la strada maestra. */}
          <div className="md:hidden space-y-3">
            {varianti.map((v, i) => (
              <div
                key={v.articolo_id}
                className="rounded-lg bg-white ring-1 ring-b58-charcoal/10 p-3 space-y-2"
              >
                {celleVersione(v, i).map((c) => (
                  <div key={c.chiave} className={c.soloTabella ? "hidden" : ""}>
                    <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">
                      {c.intestazione}
                    </div>
                    <div className="testo-sala-grande text-b58-charcoal">{c.contenuto}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left testo-sala uppercase tracking-wide text-b58-charcoal-soft">
                  {celleVersione(varianti[0], 0).map((c) => (
                    <th key={c.chiave} className={`pb-2 ${c.destra ? "text-right" : ""}`}>
                      {c.intestazioneTabella ?? c.intestazione}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {varianti.map((v, i) => (
                  <tr key={v.articolo_id} className="border-t border-b58-charcoal/10">
                    {celleVersione(v, i).map((c) => (
                      <td
                        key={c.chiave}
                        className={`py-1.5 text-b58-charcoal ${c.destra ? "text-right" : ""}`}
                      >
                        {c.contenuto}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="testo-sala text-b58-charcoal-soft/70 mt-2">
            Se due righe sono lo stesso identico prodotto con nomi diversi, collegale: da lì in poi
            un aumento fra un fornitore e l{"'"}altro diventa un avviso invece di una cosa da
            notare a occhio.
          </p>
        </div>
      )}

      {/* 🔴 L'ALLINEAMENTO SI RAGGIUNGE ANCHE DA QUI, in un tocco: il momento
          in cui uno se ne accorge è **mentre guarda quel prodotto**, non
          quando apre una sezione apposta. */}
      {isEdit && (
        <Link
          to="/magazzino/allineamento"
          className="inline-block mt-6 testo-sala-grande text-b58-charcoal-soft underline hover:text-b58-terracotta"
        >
          Quanto ce n&apos;è davvero? Allinea la dispensa →
        </Link>
      )}

      {isEdit && (
        <div className="mt-6 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal">Prezzo e storico</h2>
            <div className="text-right">
              <div className="text-xl text-b58-charcoal font-medium">
                {formatEUR(form.current_price)}
                <span className="testo-sala-grande text-b58-charcoal-soft">/{form.unit}</span>
              </div>
              {priceAlert !== null && (
                <span className="testo-sala text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">
                  {priceAlert > 0 ? "+" : ""}
                  {priceAlert.toFixed(1)}% vs media 3 mesi
                </span>
              )}
            </div>
          </div>

          {/* DA DOVE VIENE QUESTO NUMERO.
              ⚠️ Le risposte sono TRE, e la terza è quella che serve: un
              prezzo misurato sull'ultima confezione entrata, uno scritto a
              mano da Alessio, e «nessuno l'ha ancora detto». Prima del
              27/08/2026 i tre casi si vedevano tutti allo stesso modo, e un
              prezzo scritto a mano era indistinguibile da uno misurato. */}
          <p className="testo-sala text-b58-charcoal-soft -mt-2 mb-4">
            {prezzoDa === "prodotto"
              ? "Viene dall'ultima confezione entrata in magazzino, e si aggiorna da sé al prossimo carico."
              : prezzoDa === "a_mano"
                ? "L'hai scritto tu. Al primo carico con un costo lo sostituirà quello pagato davvero."
                : "Nessun carico l'ha ancora misurato, e nessuno l'ha scritto a mano."}
          </p>

          <div className="flex flex-wrap gap-2 items-end mb-5 bg-white rounded-lg p-3 border border-b58-charcoal/10">
            <div>
              <label className={labelClass}>Nuovo prezzo</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={`${inputClass} w-32`}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className={labelClass}>Nota (opzionale)</label>
              <input
                value={priceNote}
                onChange={(e) => setPriceNote(e.target.value)}
                placeholder='Es. "Aumento stagionale"'
                className={inputClass}
              />
            </div>
            <button
              type="button"
              disabled={updatingPrice || !newPrice}
              onClick={handleUpdatePrice}
              className="rounded-lg bg-b58-charcoal hover:bg-b58-charcoal-soft disabled:opacity-60 transition-colors text-b58-parchment testo-sala-grande px-4 py-2"
            >
              {updatingPrice ? "Aggiorno…" : "Aggiorna prezzo"}
            </button>
          </div>

          {priceHistory.length === 0 ? (
            <p className="testo-sala-grande text-b58-charcoal-soft">Nessuno storico ancora.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full testo-sala-grande">
                <thead>
                  <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                    <th className="py-2 font-medium">Data</th>
                    <th className="py-2 font-medium text-right">Prezzo</th>
                    <th className="py-2 font-medium">Fonte</th>
                    <th className="py-2 font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((h) => (
                    <tr key={h.id} className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="py-2 text-b58-charcoal-soft">{formatDate(h.recorded_at)}</td>
                      <td className="py-2 text-right text-b58-charcoal">{formatEUR(h.price)}</td>
                      <td className="py-2 text-b58-charcoal-soft">{h.source}</td>
                      <td className="py-2 text-b58-charcoal-soft">{h.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
