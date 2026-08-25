import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  listPriceHistory,
  mettiDaParteIngrediente,
  updateIngredientFields,
  updateIngredientPrice,
  usiDellIngrediente,
} from "../../lib/api/ingredients";
import {
  ALLERGENS,
  INGREDIENT_CATEGORIES,
  MONTHS,
  STORAGE_TYPES,
  SUPPLIER_CATEGORIES,
  UNITS,
  formatDate,
  formatEUR,
} from "../../lib/constants";

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
  shelf_life_days: "",
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
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [priceHistory, setPriceHistory] = useState([]);
  const [daConfermare, setDaConfermare] = useState([]);
  const [fonti, setFonti] = useState({});
  const [varianti, setVarianti] = useState([]);
  const [newPrice, setNewPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", category: "" });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

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
            shelf_life_days: ing.shelf_life_days ?? "",
            waste_percentage_default: ing.waste_percentage_default ?? "0",
            stock_minimum_threshold: ing.stock_minimum_threshold ?? "",
            temperatura_attesa: ing.temperatura_attesa ?? "",
            haccp_notes: ing.haccp_notes ?? "",
            avvisa_rincari: ing.avvisa_rincari !== false,
            alimentare: ing.alimentare !== false,
            tenuto_in_magazzino: ing.tenuto_in_magazzino !== false,
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
        shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : null,
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
      };

      if (isEdit) {
        await updateIngredientFields(id, payload);
        navigate(`/ricettario/ingredienti/${id}`);
      } else {
        const created = await createIngredient({
          ...payload,
          current_price: Number(form.current_price) || 0,
        });
        navigate(`/ricettario/ingredienti/${created.id}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!newPrice) return;
    setUpdatingPrice(true);
    setError("");
    try {
      await updateIngredientPrice(id, Number(newPrice), { note: priceNote || undefined });
      setForm((f) => ({ ...f, current_price: Number(newPrice) }));
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
        <span className="rounded bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[0.68rem] font-medium">
          messo dalla macchina
        </span>
        <button
          type="button"
          className="text-[0.68rem] underline text-b58-charcoal-soft hover:text-b58-charcoal"
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

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/ricettario/ingredienti"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Ingredienti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        {isEdit ? form.name || "Ingrediente" : "Nuovo ingrediente"}
      </h1>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

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
              {INGREDIENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Unità</label>
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Provenienza */}
        <div>
          <label className={labelClass}>Provenienza</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, source_type: "fornitore_esterno" }))}
              className={`flex-1 rounded-lg border px-3 py-2 testo-sala-grande transition-colors ${
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
              className={`flex-1 rounded-lg border px-3 py-2 testo-sala-grande transition-colors ${
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
                  className="testo-sala-grande text-b58-terracotta hover:text-b58-terracotta-dark mt-2"
                >
                  + Nuovo fornitore
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-b58-charcoal/15 p-3 space-y-2 bg-white">
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={creatingSupplier}
                      onClick={handleCreateSupplier}
                      className="rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-3 py-1.5 disabled:opacity-60"
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
          <div>
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
          <div>
            <label className={labelClass}>Shelf life (giorni){segnoMacchina("durata")}</label>
            <input
              type="number"
              min="0"
              value={form.shelf_life_days}
              onChange={(e) => setForm((f) => ({ ...f, shelf_life_days: e.target.value }))}
              className={inputClass}
            />
            {/* 🔴 DA DOVE VIENE (23/08/2026). Stabilire una durata di
                conservazione è responsabilità di chi la firma, e deve
                reggersi su linee guida — non essere improvvisata. Il numero
                non cambia: cambia che porta con sé su cosa si regge, ed è lo
                stesso principio degli allergeni da confermare. */}
            {fonti.durata && (
              <p className="mt-1 testo-sala text-b58-charcoal-soft">secondo: {fonti.durata}</p>
            )}
          </div>
          <div>
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
            <label className="flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.avvisa_rincari}
                onChange={(e) => setForm((f) => ({ ...f, avvisa_rincari: e.target.checked }))}
              />
              Avvisami se il prezzo sale
              <span className="testo-sala text-b58-charcoal-soft">
                (qualunque aumento, anche piccolo — togli la spunta su ciò che varia sempre)
              </span>
            </label>
            <label className="flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.alimentare}
                onChange={(e) => setForm((f) => ({ ...f, alimentare: e.target.checked }))}
              />
              È un alimento
              <span className="testo-sala text-b58-charcoal-soft">
                (togli la spunta per detersivi, carta, imballaggi: restano sotto controllo prezzi
                ma fuori dal Ricettario)
              </span>
            </label>
            {/* 🔴 LE SPEZIE A PIZZICO (23/08/2026, decisione di Alessio).
                Non è una preferenza di comodo: un prodotto che in un piatto
                pesa meno di un decimo di grammo il magazzino non lo sa
                scaricare — e prima del 23/08 quel pizzico faceva fallire lo
                scarico dell'intero tavolo. Togliendo la spunta il gestionale
                smette di fingere di seguirlo: si compra, il costo resta sulla
                fattura, la giacenza non si racconta. */}
            <label className="flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.tenuto_in_magazzino}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tenuto_in_magazzino: e.target.checked }))
                }
              />
              Il magazzino lo segue
              <span className="testo-sala text-b58-charcoal-soft">
                (togli la spunta alle spezie a pizzico: si comprano, ma non si
                scaricano e non entrano in lista della spesa)
              </span>
            </label>
          </div>

          <div>
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

        <div>
          <label className={labelClass}>Note HACCP</label>
          <textarea
            value={form.haccp_notes}
            onChange={(e) => setForm((f) => ({ ...f, haccp_notes: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Allergeni</label>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <button
                type="button"
                key={a.value}
                onClick={() => toggleArrayValue("allergens", a.value)}
                className={`rounded-full testo-sala px-3 py-1.5 border transition-colors ${
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

        <div>
          <label className={labelClass}>Stagionalità{segnoMacchina("stagionalita")}</label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() => toggleArrayValue("seasonality", m.value)}
                className={`rounded-full testo-sala px-3 py-1.5 border transition-colors ${
                  form.seasonality.includes(m.value)
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
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 testo-sala-grande"
          >
            {saving ? "Salvo…" : isEdit ? "Salva modifiche" : "Crea ingrediente"}
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
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left testo-sala uppercase tracking-wide text-b58-charcoal-soft">
                  <th className="pb-2">Versione</th>
                  <th className="pb-2">Chi la vende</th>
                  <th className="pb-2 text-right">€/{form.unit}</th>
                  <th className="pb-2 text-right">Ultima volta</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {varianti.map((v, i) => (
                  <tr key={v.articolo_id} className="border-t border-b58-charcoal/10">
                    <td className="py-1.5 text-b58-charcoal">
                      {v.descrizione}
                      {v.stesso_di && (
                        <span className="testo-sala text-b58-charcoal-soft"> · stesso prodotto</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {/* Chi la vende. Le diciture nate dalle prime fatture
                          non ce l'hanno, perché all'epoca non c'era
                          nessun fornitore in anagrafica — e senza, l'ordine
                          non può chiamare il prodotto come lo chiama lui. */}
                      <select
                        value={v.fornitore_id ?? ""}
                        onChange={(e) => assegnaFornitore(v.articolo_id, e.target.value)}
                        className="testo-sala rounded border border-b58-charcoal/15 bg-white px-1.5 py-1"
                      >
                        <option value="">chi la vende?</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 text-right text-b58-charcoal">
                      {v.prezzo ? Number(v.prezzo).toFixed(2) : "—"}
                      {i === 0 && v.prezzo && (
                        <span className="testo-sala text-b58-olive"> ↓</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-b58-charcoal-soft testo-sala">
                      {v.ultima_volta ? formatDate(v.ultima_volta) : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {/* Il gestionale vede due stringhe e non può sapere che
                          dentro c'è la stessa cosa: glielo dice Alessio, una
                          volta, e da lì in poi le confronta da sole.
                          ⚠️ Con una versione sola non c'è niente da collegare:
                          un menù che si apre vuoto sembra un menù rotto, e
                          accanto a quello del fornitore fa sbagliare bersaglio. */}
                      {varianti.length > 1 && (
                        <select
                          value={v.stesso_di ?? ""}
                          onChange={(e) => collega(v.articolo_id, e.target.value || null)}
                          className="testo-sala rounded border border-b58-charcoal/15 bg-white px-1.5 py-1"
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
                      )}
                    </td>
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
          )}
        </div>
      )}
    </div>
  );
}
