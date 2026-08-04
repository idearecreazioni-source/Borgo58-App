import { supabase } from "../supabase";

// --- Raccolta propria (§3.17) — erbe spontanee/prodotti autoraccolti ---
export async function listForagedItems() {
  const { data, error } = await supabase
    .from("foraged_items")
    .select("*, ingredient:ingredient_id(id, name)")
    .order("harvest_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createForagedItem(payload) {
  const { data, error } = await supabase
    .from("foraged_items")
    .insert(payload)
    .select("*, ingredient:ingredient_id(id, name)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteForagedItem(id) {
  const { error } = await supabase.from("foraged_items").delete().eq("id", id);
  if (error) throw error;
}

// --- Attrezzature (struttura, solo titolare in scrittura — RLS) ---
export async function listEquipment() {
  const { data, error } = await supabase
    .from("haccp_equipment")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createEquipment({ name, storageType, targetMinC, targetMaxC }) {
  const { data, error } = await supabase
    .from("haccp_equipment")
    .insert({
      name,
      storage_type: storageType || null,
      target_min_c: targetMinC ?? null,
      target_max_c: targetMaxC ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Registro temperature ---
export async function listTemperatureLogs(equipmentId) {
  let query = supabase
    .from("v_haccp_temperature_logs")
    .select("*")
    .order("recorded_at", { ascending: false });
  if (equipmentId) query = query.eq("equipment_id", equipmentId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addTemperatureLog({ equipmentId, recordedTempC, note, correctiveAction }) {
  const { error } = await supabase.from("haccp_temperature_logs").insert({
    equipment_id: equipmentId,
    recorded_temp_c: recordedTempC,
    note: note || null,
    corrective_action: correctiveAction || null,
  });
  if (error) throw error;
}

// --- Ricevimento merci ---
export async function listGoodsReceiving() {
  const { data, error } = await supabase
    .from("haccp_goods_receiving")
    .select("*, supplier:supplier_id(id, name)")
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addGoodsReceiving({
  supplierId,
  productDescription,
  temperatureC,
  packagingOk,
  conformity,
  note,
}) {
  const { error } = await supabase.from("haccp_goods_receiving").insert({
    supplier_id: supplierId || null,
    product_description: productDescription,
    temperature_c: temperatureC ?? null,
    packaging_ok: packagingOk,
    conformity,
    note: note || null,
  });
  if (error) throw error;
}

// --- Pulizia e sanificazione ---
export async function listCleaningTasks() {
  const { data, error } = await supabase
    .from("haccp_cleaning_tasks")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createCleaningTask({ name, area, frequency }) {
  const { data, error } = await supabase
    .from("haccp_cleaning_tasks")
    .insert({ name, area: area || null, frequency })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCleaningLogs(taskId) {
  let query = supabase
    .from("haccp_cleaning_logs")
    .select("*, task:task_id(id, name, area, frequency)")
    .order("completed_at", { ascending: false });
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addCleaningLog({ taskId, note }) {
  const { error } = await supabase.from("haccp_cleaning_logs").insert({
    task_id: taskId,
    note: note || null,
  });
  if (error) throw error;
}

// --- Disinfestazione ---
export async function listPestControlLogs() {
  const { data, error } = await supabase
    .from("haccp_pest_control_logs")
    .select("*")
    .order("performed_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addPestControlLog({ performedBy, type, findings, note }) {
  const { error } = await supabase.from("haccp_pest_control_logs").insert({
    performed_by: performedBy || null,
    type,
    findings: findings || null,
    note: note || null,
  });
  if (error) throw error;
}

// --- Non conformità ---
export async function listNonConformities() {
  const { data, error } = await supabase
    .from("haccp_non_conformities")
    .select("*")
    .order("detected_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addNonConformity({ category, description, note }) {
  const { error } = await supabase.from("haccp_non_conformities").insert({
    category,
    description,
    note: note || null,
  });
  if (error) throw error;
}

export async function resolveNonConformity(id, { correctiveAction }) {
  const { error } = await supabase
    .from("haccp_non_conformities")
    .update({ resolved: true, resolved_at: new Date().toISOString(), corrective_action: correctiveAction || null })
    .eq("id", id);
  if (error) throw error;
}
