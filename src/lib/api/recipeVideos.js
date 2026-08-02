import { supabase } from "../supabase";

export async function listRecipeVideos(recipeId) {
  const { data, error } = await supabase
    .from("recipe_videos")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

const detectPlatform = (url) => {
  const host = url.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  return "altro";
};

export async function addRecipeVideo(recipeId, { url, note }) {
  const { data, error } = await supabase
    .from("recipe_videos")
    .insert({
      recipe_id: recipeId,
      url,
      platform: detectPlatform(url),
      note: note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeRecipeVideo(id) {
  const { error } = await supabase.from("recipe_videos").delete().eq("id", id);
  if (error) throw error;
}
