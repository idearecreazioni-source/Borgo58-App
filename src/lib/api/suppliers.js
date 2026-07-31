import { supabase } from "../supabase";

export async function listSuppliers(entityId) {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("entity_id", entityId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createSupplier({ entityId, name, category, contactPhone, contactEmail }) {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      entity_id: entityId,
      name,
      category: category || null,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
