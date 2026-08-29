import { supabase } from "../supabase";

// ⚠️ `includiDisattivati` esiste perché senza di lui un fornitore
// disattivato è un vicolo cieco: l'elenco mostra solo gli attivi, quindi
// non c'è nessuna schermata da cui riaccenderlo (Blocco 5.2 del mandato
// di correzione, 16/08/2026). I tavoli quel ritorno ce l'hanno, i
// fornitori no.
export async function listSuppliers(entityId, { includiDisattivati = false } = {}) {
  let query = supabase.from("suppliers").select("*").eq("entity_id", entityId).order("name");
  if (!includiDisattivati) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Staff: identità + contatti + giorni di consegna, niente di amministrativo
// (vista sicura — §3.18).
export async function listSuppliersDisplay() {
  const { data, error } = await supabase
    .from("suppliers_display")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getSupplier(id) {
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

const supplierPayload = ({
  entityId,
  name,
  category,
  contactPhone,
  contactEmail,
  contactPerson,
  taxCode,
  paymentTerms,
  deliveryDays,
  isOccasional,
  notes,
  canaleOrdine,
  regimeEsonero,
}) => ({
  ...(entityId ? { entity_id: entityId } : {}),
  name,
  category: category || null,
  contact_phone: contactPhone || null,
  contact_email: contactEmail || null,
  contact_person: contactPerson || null,
  tax_code: taxCode || null,
  // Un fornitore occasionale non compila condizioni di pagamento/giorni di
  // consegna (§3.11) — anche se il form li manda comunque, li scartiamo qui
  // per non lasciare dati a metà su un profilo pensato per restare minimo.
  payment_terms: isOccasional ? null : paymentTerms || null,
  delivery_days: isOccasional ? null : deliveryDays || null,
  is_occasional: !!isOccasional,
  notes: notes || null,
  // Vuoto vuol dire «non l'ha ancora detto»: la schermata degli ordini
  // offre le strade che i recapiti permettono, senza sceglierne una.
  canale_ordine: canaleOrdine || null,
  // 🔴 IL REGIME DI ESONERO ha TRE risposte, e il terzo stato e' quello
  // vero di quasi tutti: «nessuno gliel'ha ancora chiesto». Un `false`
  // scritto qui direbbe «ho verificato che non lo e'» su un fornitore che
  // Alessio non ha mai guardato — e su un contadino quella e' esattamente
  // l'affermazione che fa saltare l'autofattura.
  regime_esonero: regimeEsonero === "" || regimeEsonero === undefined ? null : regimeEsonero,
});

export async function createSupplier(input) {
  const { data, error } = await supabase
    .from("suppliers")
    .insert(supplierPayload(input))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, input) {
  const { data, error } = await supabase
    .from("suppliers")
    .update(supplierPayload(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateSupplier(id) {
  const { error } = await supabase.from("suppliers").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// La via di ritorno di «disattiva». Un fornitore si smette di usare e si
// riprende: senza questo, l'unico modo per riaverlo era crearne uno nuovo
// con lo stesso nome — e da lì in poi lo storico dei prezzi sarebbe stato
// spezzato in due fornitori diversi, cioè la sorveglianza dei rincari
// avrebbe smesso di funzionare su di lui senza dirlo.
export async function riattivaSupplier(id) {
  const { error } = await supabase.from("suppliers").update({ active: true }).eq("id", id);
  if (error) throw error;
}

// Storico automatico (§3.11 — "non inserito a mano"). Due fonti già esistenti,
// non una nuova tabella: prezzi dal Ricettario, consegne dal Magazzino
// (i carichi diretti e le chiusure di Lista della spesa scrivono entrambi
// su stock_lots).
export async function listSupplierPriceHistory(supplierId) {
  const { data, error } = await supabase
    .from("price_history")
    .select("id, price, recorded_at, source, ingredient:ingredient_id(name, unit)")
    .eq("supplier_id", supplierId)
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function listSupplierDeliveries(supplierId) {
  const { data, error } = await supabase
    .from("stock_lots")
    .select("id, quantity_received, unit_cost, received_at, ingredient:ingredient_id(name, unit)")
    .eq("supplier_id", supplierId)
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
