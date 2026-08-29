import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addBelowThresholdItems,
  addShoppingListItem,
  chiudiRigaArrivata,
  chiudiRigaLista,
  listaSpesa,
  listShoppingList,
  listShoppingListDisplay,
  removeShoppingListItem,
  updateShoppingListItem,
} from "../../lib/api/shoppingList";
import { listStockLevels } from "../../lib/api/stock";
import { listSuppliers, listSuppliersDisplay } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { useAuth } from "../../context/AuthContext";
import { ESITI_RIGA_LISTA, PAYMENT_METHODS, formatDate, formatEUR, labelFor, formatQta} from "../../lib/constants";
import { listCausali } from "../../lib/api/cash";
import { variazionePrezzoProdotto } from "../../lib/api/assistente";
import DatoNonLetto from "../../components/DatoNonLetto";
import { NON_LETTO, leggi, nonLetto } from "../../lib/calcoli/letture";

import { useDaVoce } from "../../lib/daVoce";
import { StriscaDallaVoce } from "../../components/StriscaDallaVoce";
import { useUnita } from "../../lib/unita";

const emptyAddForm = {
  mode: "ingredient",
  ingredient_id: "",
  custom_name: "",
  supplier_id: "",
  quantity_needed: "",
  unit: "",
  note: "",
};

const emptyCloseForm = {
  // ⚠️ «Comprata e pagata» è la partenza, ed è una scelta: è la via
  // normale, e chiudere una riga senza registrare l'uscita è il buco che
  // questo blocco chiude — 40 € usciti dal cassetto che nessuno ha scritto.
  esito: "comprata",
  purchased_amount: "",
  payment_method: "contante",
  quantity_received: "",
  document_reference: "",
  expiry_date: "",
  causale_id: "",
};

// I due esiti che si scelgono a mano più quello che li nega. ⚠️ Non si
// costruisce da ESITI_RIGA_LISTA: quell'elenco contiene anche
// «arrivata_con_documento», che NON è una scelta di chi chiude — la scrive
// il gestionale quando la merce arriva con una fattura.
const ESITI_SCELTA = [
  { value: "comprata", label: "L'ho comprato e pagato" },
  { value: "gratis", label: "Me l'hanno regalato" },
  { value: "non_presa", label: "Non l'ho preso" },
];

export default function ListaSpesa() {
  // Le unita' si chiedono al database, non a un elenco scritto qui: la
  // ragione per esteso sta in src/lib/unita.js.
  const UNITS = useUnita();
  const { isTitolare } = useAuth();
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addForm, setAddForm] = useState(emptyAddForm);

  // 🔴 ARRIVATO QUI DA UNA RIGA DI SPESA DETTATA.
  // ⚠️ SEMPRE COME NOME LIBERO, ed è la decisione di Alessio del 27/08:
  //    *«la lista della spesa è libera, non accoppia mai col magazzino»* —
  //    e non è «cerca ma non bloccare»: non cerca affatto. L'abbinamento si
  //    fa dopo, con la foto del documento quando la merce arriva.
  //    Per questo si scrive in `custom_name` e non si tocca
  //    `ingredient_id`, anche se il modulo saprebbe riceverlo.
  const venuto = useDaVoce((c) => {
    setAddForm((f) => ({
      ...f,
      mode: "custom",
      custom_name: c.nome ?? f.custom_name,
      quantity_needed: c.quantita ?? f.quantity_needed,
      unit: c.unita ?? f.unit,
      note: c.note ?? f.note,
    }));
  });
  const [adding, setAdding] = useState(false);
  const [addingThreshold, setAddingThreshold] = useState(false);

  const [closingItemId, setClosingItemId] = useState(null);
  const [closeForm, setCloseForm] = useState(emptyCloseForm);
  const [closing, setClosing] = useState(false);
  // Le causali d'uscita, per dire dove va a finire quella spesa in prima
  // nota. ⚠️ `listCausali` esclude quelle di sistema, ed è giusto:
  // sceglierne una a mano per una spesa vera la farebbe sparire dai costi.
  const [causali, setCausali] = useState([]);
  // Quanto costava prima, e di quanto si sta salendo. ⚠️ Si guarda PRIMA
  // di confermare: se si è pagato più del solito ci si accorge mentre non
  // registrarlo è ancora gratis. È la stessa scelta del 12/08 sulle
  // fatture — l'avviso in due posti, la schermata prima e Telegram dopo.
  const [rincaro, setRincaro] = useState(null);
  // Se il controllo delle scorte non è riuscito, la lista non è completa e
  // lo dice: chi la legge sta per andare a fare la spesa.
  const [scorteGuardate, setScorteGuardate] = useState(true);

  const load = () => (isTitolare ? listShoppingList() : listShoppingListDisplay());

  const loadAll = async () => {
    // Prima di guardare la lista, si guarda il magazzino: chi è sceso
    // sotto soglia entra da solo. Prima era un pulsante da ricordarsi di
    // premere — cioè una lista che diceva la verità solo a chi sapeva
    // che andava aggiornata.
    // 🔴 Se questo passaggio fallisce la lista si apre CORTA e sembra
    // completa — cioè esattamente il difetto che il commento qui sopra
    // dichiara di aver tolto. Prima veniva ingoiato in silenzio.
    let scorteGuardate = true;
    if (isTitolare) scorteGuardate = !nonLetto(await leggi(addBelowThresholdItems()));
    setScorteGuardate(scorteGuardate);
    const [listData, numeri, levels, sup, caus] = await Promise.all([
      load(),
      isTitolare ? listaSpesa() : Promise.resolve([]),
      listStockLevels(),
      isTitolare ? getEntities().then((e) => listSuppliers(e.srls.id)) : listSuppliersDisplay(),
      isTitolare ? listCausali("uscita") : Promise.resolve([]),
    ]);
    // I numeri veri (giacenza, soglia, quanto manca, se è rientrata) li
    // calcola il database sullo stesso conteggio che usa il Magazzino:
    // qui si attaccano soltanto alla riga giusta.
    const perId = new Map(numeri.map((r) => [r.id, r]));
    setItems(listData.map((i) => ({ ...i, numeri: perId.get(i.id) ?? null })));
    setIngredients(levels);
    setSuppliers(sup);
    setCausali(caus);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAll()
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTitolare]);

  // 🔴 LE RIGHE «ORDINATA» NON COMPARIVANO DA NESSUNA PARTE, trovato
  // misurando il 19/08: il filtro prendeva solo «da_comprare» e l'altro
  // elenco solo «acquistato», quindi una riga ordinata spariva dalla
  // schermata pur essendo viva nel database. ⚠️ In produzione le uniche
  // due righe sono ordinate: la lista della spesa si apriva VUOTA mentre
  // c'era roba dentro — e una lista vuota si legge «non manca niente».
  // ⚠️ Ed è proprio la riga ordinata quella che aspetta gli arrivi: senza
  // vederla, «arrivati 5 di 20» non lo leggerebbe nessuno.
  const daComprare = useMemo(
    () => items.filter((i) => i.status === "da_comprare" || i.status === "ordinata"),
    [items]
  );
  const acquistati = useMemo(() => items.filter((i) => i.status === "acquistato"), [items]);

  const groupedDaComprare = useMemo(() => {
    const groups = {};
    daComprare.forEach((item) => {
      const key = item.supplier?.name ?? "Senza fornitore";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [daComprare]);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddThreshold = async () => {
    setAddingThreshold(true);
    setError("");
    try {
      const count = await addBelowThresholdItems();
      await loadAll();
      if (count === 0) setError("Nessun ingrediente sotto soglia da aggiungere.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingThreshold(false);
    }
  };

  // Si ricarica solo la riga toccata, non tutta la schermata: ricaricare
  // tutto butterebbe via le quantità che sta ancora correggendo sulle
  // altre righe (successo il 12/08 sulla posta, ed era invisibile).
  const handleQuantita = async (item, valore) => {
    const nuova = valore === "" ? null : Number(valore);
    if (nuova === (item.quantity_needed == null ? null : Number(item.quantity_needed))) return;
    if (nuova != null && (Number.isNaN(nuova) || nuova < 0)) return;
    setError("");
    try {
      await updateShoppingListItem(item.id, { quantity_needed: nuova });
      setItems((righe) =>
        righe.map((r) => (r.id === item.id ? { ...r, quantity_needed: nuova } : r))
      );
    } catch (e) {
      setError(e.message);
    }
  };

  // Cambiare il fornitore rimescola i gruppi, quindi qui la lista si
  // ricarica per intero: è l'unica azione di questa schermata che cambia
  // dove sta la riga, non solo cosa dice.
  const handleFornitore = async (itemId, supplierId) => {
    setError("");
    try {
      await updateShoppingListItem(itemId, { supplier_id: supplierId || null });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAdd = async () => {
    const isCustom = addForm.mode === "custom";
    if (isCustom && !addForm.custom_name.trim()) return;
    if (!isCustom && !addForm.ingredient_id) return;
    setAdding(true);
    setError("");
    try {
      await addShoppingListItem({
        ingredientId: isCustom ? null : addForm.ingredient_id,
        customName: isCustom ? addForm.custom_name.trim() : null,
        supplierId: addForm.supplier_id || null,
        quantityNeeded: addForm.quantity_needed ? Number(addForm.quantity_needed) : null,
        unit: addForm.unit || null,
        note: addForm.note || null,
      });
      // 🔴 DOPO il salvataggio riuscito, mai prima.
      await venuto.chiudi();
      setAddForm(emptyAddForm);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  // Quanto ne è arrivato: il titolare lo legge dalla lista completa, lo
  // staff dalla vista senza importi. La colonna si chiama uguale nei due
  // posti, quindi la riga qui sopra non deve sapere chi sta guardando.
  const arrivati = (item) => Number(item.quantita_arrivata ?? 0);

  const handleArrivata = async (itemId) => {
    try {
      await chiudiRigaArrivata(itemId);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemove = async (itemId) => {
    try {
      await removeShoppingListItem(itemId);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  // La causale che il gestionale PROPONE per l'uscita. ⚠️ Si cerca per
  // nome fra le sue causali, e se non c'è non se ne inventa nessuna: le
  // causali sono dati di Alessio (Cassa → Causali), e il giorno che la
  // rinominasse è meglio nessuna proposta che una scelta sbagliata fatta
  // in silenzio — è la causale a decidere dove quel costo finisce nei
  // conti.
  const causalePropostaId = useMemo(
    () => causali.find((c) => c.label.toLowerCase() === "spesa alimentare")?.id ?? "",
    [causali]
  );

  const openClose = (itemId, quantityNeeded) => {
    setClosingItemId(itemId);
    setCloseForm({
      ...emptyCloseForm,
      quantity_received: quantityNeeded ?? "",
      // ⚠️ Proposta e VISIBILE nel menu accanto al mezzo: non si scrive mai
      // una causale su un'uscita senza mostrarla, nemmeno per comodità.
      causale_id: causalePropostaId,
    });
  };

  // L'ingrediente e il prezzo unitario su cui si sta per chiudere.
  const rigaInChiusura = items.find((i) => i.id === closingItemId) ?? null;
  const prezzoUnitario =
    closeForm.esito === "comprata" &&
    Number(closeForm.purchased_amount) > 0 &&
    Number(closeForm.quantity_received) > 0
      ? Number(closeForm.purchased_amount) / Number(closeForm.quantity_received)
      : null;

  useEffect(() => {
    let vivo = true;
    const ingrediente = rigaInChiusura?.ingredient?.id;
    if (!ingrediente || prezzoUnitario === null) {
      setRincaro(null);
      return undefined;
    }
    variazionePrezzoProdotto({ ingredienteId: ingrediente, prezzo: prezzoUnitario })
      .then((v) => vivo && setRincaro(v))
      // Il prezzo di prima è un di più: non blocca la conferma.
      // ⚠️ Non blocca la conferma — ma NON tace: un rincaro che non si è
      // potuto leggere e «nessun rincaro» si leggono uguali, e il rincaro è
      // la ragione per cui questo modulo esiste (decisione di Alessio del
      // 12/08: «se un fornitore aumenta un prezzo senza dirmelo voglio
      // saperlo»).
      .catch(() => vivo && setRincaro(NON_LETTO));
    return () => {
      vivo = false;
    };
  }, [rigaInChiusura?.ingredient?.id, prezzoUnitario]);

  const handleClose = async (itemId) => {
    if (closeForm.esito === "comprata" && !closeForm.purchased_amount) return;
    setClosing(true);
    setError("");
    try {
      await chiudiRigaLista({
        itemId,
        esito: closeForm.esito,
        // ⚠️ Importo e mezzo si mandano SOLO per «comprata»: mandarli
        // sempre vorrebbe dire scrivere «pagato in contanti» su un regalo.
        importo: closeForm.esito === "comprata" ? Number(closeForm.purchased_amount) : null,
        metodoPagamento: closeForm.esito === "comprata" ? closeForm.payment_method : null,
        quantitaRicevuta: closeForm.quantity_received ? Number(closeForm.quantity_received) : null,
        riferimentoDocumento: closeForm.document_reference || null,
        scadenza: closeForm.expiry_date || null,
        causaleId: closeForm.esito === "comprata" ? closeForm.causale_id || null : null,
      });
      setClosingItemId(null);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return <p className="testo-sala text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Lista della spesa</h1>
        <StriscaDallaVoce venuto={venuto} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAddThreshold}
            disabled={addingThreshold}
            className="tocco-bottone rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4  disabled:opacity-60"
          >
            {addingThreshold ? "Aggiungo…" : "Ricontrolla le scorte"}
          </button>
          {isTitolare && (
            <Link
              to="/magazzino/ordini"
              className="tocco-bottone inline-flex items-center rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment testo-sala font-medium px-4"
            >
              Ordina ai fornitori
            </Link>
          )}
        </div>
      </div>

      {!scorteGuardate && (
        <DatoNonLetto
          cosa="quali prodotti sono sotto scorta"
          nonVuolDire="Non vuol dire che non ne manca nessuno: vuol dire che non lo so. Quello che vedi qui sotto potrebbe essere incompleto."
          onRiprova={() => loadAll().catch((e) => setError(e.message))}
          className="mb-4"
        />
      )}

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Da comprare, raggruppati per fornitore */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Da comprare</h2>

        {daComprare.length === 0 ? (
          <p className="testo-sala text-b58-charcoal-soft/60 mb-4">Nessun articolo in lista.</p>
        ) : (
          Object.entries(groupedDaComprare).map(([supplierName, groupItems]) => (
            <div key={supplierName} className="mb-4">
              <p className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
                {supplierName}
              </p>
              <ul className="space-y-2">
                {groupItems.map((item) => (
                  <li key={item.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="testo-sala text-b58-charcoal font-medium">
                          {item.ingredient?.name ?? item.custom_name}
                        </span>
                        {/* La quantità si corregge qui: quella proposta è
                            quanto manca per tornare alla scorta minima, non
                            quanto conviene comprare (un fornitore vende a
                            casse, non a etti). */}
                        {isTitolare ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={item.quantity_needed ?? ""}
                            onBlur={(e) => handleQuantita(item, e.target.value)}
                            className="w-20 ml-1.5 tocco-campo rounded border border-b58-charcoal/15 px-1.5 py-0.5 testo-sala text-b58-charcoal"
                          />
                        ) : (
                          item.quantity_needed != null && (
                            <span className="testo-sala text-b58-charcoal-soft ml-1.5">
                              {formatQta(item.quantity_needed)} {item.unit}
                            </span>
                          )
                        )}
                        {isTitolare && (
                          <span className="testo-sala text-b58-charcoal-soft ml-1">{item.unit}</span>
                        )}
                        {item.source === "soglia_minima" && (
                          <span className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 ml-1.5">
                            sotto soglia
                          </span>
                        )}
                        {item.status === "ordinata" && (
                          <span className="testo-sala text-b58-charcoal-soft bg-b58-charcoal/5 rounded-full px-2 py-0.5 ml-1.5">
                            ordinata
                          </span>
                        )}
                        {/* Comprata altrove nel frattempo: la riga non
                            sparisce da sola — la lista è sua — ma smette
                            di far comprare due volte la stessa cosa. */}
                        {item.numeri?.rientrata && (
                          <span className="testo-sala text-emerald-800 bg-emerald-100 rounded-full px-2 py-0.5 ml-1.5">
                            ora ce n'è abbastanza
                          </span>
                        )}
                        {/* I numeri veri, letti adesso dal magazzino. */}
                        {item.numeri?.soglia != null && (
                          <div className="testo-sala text-b58-charcoal-soft mt-0.5">
                            in cella {Number(item.numeri.giacenza ?? 0)} {item.unit} · scorta minima{" "}
                            {Number(item.numeri.soglia)} {item.unit}
                            {Number(item.numeri.mancante) > 0 && (
                              <> · ne mancano {Number(item.numeri.mancante)}</>
                            )}
                            {" · in lista dal "}
                            {formatDate(item.numeri.in_lista_dal)}
                          </div>
                        )}
                        {/* ⚠️ «ARRIVATI 5 DI 20» — e il fabbisogno NON si
                            riscrive a 15. La riga resta aperta e PROPONE la
                            chiusura: il gestionale segnala, Alessio decide se
                            ne compra ancora o se gli bastano. Una riga che
                            sparisce quando la merce è arrivata a metà lascia
                            senza scorte, ed è la normalità coi fornitori. */}
                        {arrivati(item) > 0 && (
                          <div className="testo-sala text-b58-charcoal mt-0.5">
                            arrivati {formatQta(arrivati(item))}
                            {item.quantity_needed != null && <> di {formatQta(item.quantity_needed)}</>}{" "}
                            {item.unit}
                            {isTitolare && (
                              <button
                                type="button"
                                onClick={() => handleArrivata(item.id)}
                                className="tocco-bottone ml-2 text-b58-terracotta hover:text-b58-terracotta-dark"
                              >
                                mi bastano, chiudi la riga
                              </button>
                            )}
                          </div>
                        )}
                        {item.note && (
                          <div className="testo-sala text-b58-charcoal-soft mt-0.5">{item.note}</div>
                        )}
                      </div>
                      <div className="gesti-pericolosi">
                        {/* Il fornitore si cambia QUI. Una riga lo eredita
                            dalla scheda del prodotto quando nasce, ma
                            senza poterlo correggere sulla riga si
                            sposterebbe soltanto il punto in cui ci si
                            blocca — ed è dove Alessio si è bloccato. */}
                        {isTitolare && (
                          <select
                            value={item.supplier?.id ?? ""}
                            onChange={(e) => handleFornitore(item.id, e.target.value)}
                            className="tocco-campo rounded border border-b58-charcoal/15 bg-white px-1.5 py-1 testo-sala text-b58-charcoal w-full min-w-0"
                          >
                            <option value="">chi lo vende?</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {isTitolare && (
                          <button
                            type="button"
                            onClick={() => openClose(item.id, item.quantity_needed)}
                            className="tocco-bottone testo-sala text-b58-terracotta hover:text-b58-terracotta-dark"
                          >
                            Segna acquistato
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>

                    {/* I TRE ESITI — mandato del 17/08, blocco 2.
                        ⚠️ «Comprata e pagata» è LA VIA NORMALE e sta per
                        prima: 40 € in contanti al contadino, riga chiusa
                        senza scrivere niente, e la sera il cassetto accusa
                        un ammanco che non esiste. È lo stesso meccanismo
                        delle mance su carta.
                        ⚠️ E i tre esiti restano TRE: «avuta gratis» fa
                        entrare la merce, «non presa» no. Confonderli mette
                        in magazzino roba mai arrivata. */}
                    {closingItemId === item.id && (
                      <div className="mt-3 pt-3 border-t border-b58-charcoal/10">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {ESITI_SCELTA.map((e) => (
                            <button
                              key={e.value}
                              type="button"
                              onClick={() => setCloseForm((f) => ({ ...f, esito: e.value }))}
                              className={`tocco-bottone rounded-full testo-sala px-3  border transition-colors ${
                                closeForm.esito === e.value
                                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
                              }`}
                            >
                              {e.label}
                            </button>
                          ))}
                        </div>

                        {closeForm.esito === "non_presa" ? (
                          <p className="testo-sala text-b58-charcoal-soft mb-2">
                            La riga sparisce. Niente costo e <strong>niente merce in
                            magazzino</strong>: se invece te l&apos;hanno regalata, scegli
                            «Avuta gratis».
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2 items-end">
                            {closeForm.esito === "comprata" && (
                              <>
                                <div className="w-28">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={closeForm.purchased_amount}
                                    onChange={(e) =>
                                      setCloseForm((f) => ({ ...f, purchased_amount: e.target.value }))
                                    }
                                    placeholder="Importo €"
                                    className={inputClass}
                                  />
                                </div>
                                {/* ⚠️ IL MEZZO SI VEDE, e lì si cambia: contante
                                    di partenza perché il caso normale è il
                                    mercato. Un predefinito che si vede è una
                                    comodità; uno che riempie un campo che
                                    nessuno guarda è la famiglia dei 33 posti
                                    silenziosi — è così che si è perso il mezzo
                                    delle mance. */}
                                <div className="w-32">
                                  <select
                                    value={closeForm.payment_method}
                                    onChange={(e) =>
                                      setCloseForm((f) => ({ ...f, payment_method: e.target.value }))
                                    }
                                    className={inputClass}
                                  >
                                    {PAYMENT_METHODS.map((m) => (
                                      <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="w-44">
                                  <select
                                    value={closeForm.causale_id}
                                    onChange={(e) =>
                                      setCloseForm((f) => ({ ...f, causale_id: e.target.value }))
                                    }
                                    className={inputClass}
                                  >
                                    <option value="">Senza causale</option>
                                    {causali.map((c) => (
                                      <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            )}
                            {item.ingredient?.id && (
                              <>
                                <div className="w-24">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={closeForm.quantity_received}
                                    onChange={(e) =>
                                      setCloseForm((f) => ({ ...f, quantity_received: e.target.value }))
                                    }
                                    placeholder="Qtà ricevuta"
                                    className={inputClass}
                                  />
                                </div>
                                <div className="w-36">
                                  <input
                                    type="date"
                                    value={closeForm.expiry_date}
                                    onChange={(e) =>
                                      setCloseForm((f) => ({ ...f, expiry_date: e.target.value }))
                                    }
                                    className={inputClass}
                                  />
                                </div>
                              </>
                            )}
                            {closeForm.esito === "comprata" && (
                              <div className="flex-1 min-w-[140px]">
                                <input
                                  value={closeForm.document_reference}
                                  onChange={(e) =>
                                    setCloseForm((f) => ({ ...f, document_reference: e.target.value }))
                                  }
                                  placeholder="Rif. documento (opz.)"
                                  className={inputClass}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {nonLetto(rincaro) && (
                          <DatoNonLetto
                            cosa="quanto lo pagavi prima"
                            className="mt-2"
                          />
                        )}

                        {!nonLetto(rincaro) && rincaro?.da_segnalare && (
                          <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded px-2 py-1.5 mt-2">
                            ⚠️ Prima lo pagavi {formatEUR(rincaro.prezzo_precedente)}, adesso{" "}
                            {formatEUR(prezzoUnitario)} ({rincaro.variazione > 0 ? "+" : ""}
                            {rincaro.variazione}%)
                            {rincaro.variazione_totale != null && (
                              <> · da quando lo compri: {rincaro.variazione_totale > 0 ? "+" : ""}{rincaro.variazione_totale}%</>
                            )}
                          </p>
                        )}

                        {/* Cosa succede confermando, detto prima di confermare. */}
                        <p className="testo-sala text-b58-charcoal-soft mt-2">
                          {closeForm.esito === "comprata" &&
                            "Esce un'uscita di prima nota dalla " +
                              (closeForm.payment_method === "contante" ? "cassa" : "banca") +
                              ", e la merce entra in magazzino."}
                          {closeForm.esito === "gratis" &&
                            "La merce entra in magazzino a costo zero. Il prezzo di listino non si tocca: il regalo vale zero per questa volta, non per sempre."}
                        </p>

                        <div className="flex gap-3 items-center mt-2">
                          <button
                            type="button"
                            disabled={
                              closing ||
                              (closeForm.esito === "comprata" && !closeForm.purchased_amount)
                            }
                            onClick={() => handleClose(item.id)}
                            className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4 py-2 disabled:opacity-60 tocco-bottone"
                          >
                            {closing ? "Chiudo…" : "Conferma"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setClosingItemId(null)}
                            className="tocco-bottone testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        {/* Aggiungi articolo */}
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mt-2">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setAddForm({ ...emptyAddForm, mode: "ingredient" })}
              className={`tocco-bottone rounded-full testo-sala px-3  border transition-colors ${
                addForm.mode === "ingredient"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Ingrediente
            </button>
            <button
              type="button"
              onClick={() => setAddForm({ ...emptyAddForm, mode: "custom" })}
              className={`tocco-bottone rounded-full testo-sala px-3  border transition-colors ${
                addForm.mode === "custom"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Articolo generico
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {addForm.mode === "ingredient" ? (
              <select
                value={addForm.ingredient_id}
                onChange={(e) => {
                  const chosen = ingredients.find((i) => i.ingredient_id === e.target.value);
                  setAddForm((f) => ({ ...f, ingredient_id: e.target.value, unit: chosen?.unit ?? f.unit }));
                }}
                className={`${inputClass} col-span-2 sm:col-span-1`}
              >
                <option value="">Seleziona ingrediente…</option>
                {ingredients.map((i) => (
                  <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name}</option>
                ))}
              </select>
            ) : (
              <input
                value={addForm.custom_name}
                onChange={(e) => setAddForm((f) => ({ ...f, custom_name: e.target.value }))}
                placeholder='Es. "Detersivo piatti"'
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
            )}
            <input
              type="number"
              step="0.01"
              min="0"
              value={addForm.quantity_needed}
              onChange={(e) => setAddForm((f) => ({ ...f, quantity_needed: e.target.value }))}
              placeholder="Quantità"
              className={inputClass}
            />
            <select
              value={addForm.unit}
              onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              <option value="">Unità</option>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <select
              value={addForm.supplier_id}
              onChange={(e) => setAddForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Nessun fornitore</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={addForm.note}
              onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={
                adding || (addForm.mode === "custom" ? !addForm.custom_name.trim() : !addForm.ingredient_id)
              }
              onClick={handleAdd}
              className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-4 disabled:opacity-60 shrink-0 tocco-bottone"
            >
              {adding ? "Aggiungo…" : "+ Aggiungi"}
            </button>
          </div>
        </div>
      </div>

      {/* Storico acquisti */}
      {acquistati.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display testo-sala-grande text-b58-charcoal mb-4">Acquistati di recente</h2>
          <ul className="space-y-1.5">
            {acquistati.map((item) => (
              <li key={item.id} className="testo-sala text-b58-charcoal-soft flex items-center justify-between gap-2">
                <span>
                  <span className="text-b58-charcoal">{item.ingredient?.name ?? item.custom_name}</span>
                  {item.purchased_at && ` — ${formatDate(item.purchased_at)}`}
                </span>
                {isTitolare && item.purchased_amount != null && (
                  <span className="text-b58-charcoal">
                    {formatEUR(item.purchased_amount)}
                    {item.payment_method && ` · ${labelFor(PAYMENT_METHODS, item.payment_method)}`}
                    {item.esito && ` · ${labelFor(ESITI_RIGA_LISTA, item.esito)}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
