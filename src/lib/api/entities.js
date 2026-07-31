import { supabase } from "../supabase";

let cache = null;

// Le due entità sono seed fisse (migrazione 0001) — poche letture, va bene
// una cache in-memory semplice invece di un context/provider dedicato.
export async function getEntities() {
  if (cache) return cache;
  const { data, error } = await supabase.from("entities").select("*");
  if (error) throw error;
  cache = {
    srls: data.find((e) => e.entity_type === "srls"),
    agricola: data.find((e) => e.entity_type === "azienda_agricola"),
  };
  return cache;
}
