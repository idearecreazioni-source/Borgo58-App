-- =====================================================================
-- Borgo 58 · Migrazione 0010 — Video ricetta (§4, modulo 1)
-- =====================================================================
-- Link (non upload) a video Instagram/TikTok collegabili a una ricetta —
-- più video per ricetta. Nessuna estrazione AI qui: quella (trascrizione +
-- lettura fotogrammi → bozza ingredienti/passaggi da confermare) richiede
-- una decisione separata su quale servizio AI usare e i relativi costi,
-- coerente col trattamento già dato al Consulente Culinario AI (§3.10).
-- =====================================================================

create type video_platform as enum ('instagram', 'tiktok', 'altro');

create table recipe_videos (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references recipes(id) on delete cascade,
  url         text not null,
  platform    video_platform not null default 'altro',
  note        text,
  created_at  timestamptz not null default now()
);
comment on table recipe_videos is
  'Link a video (Instagram/TikTok) collegati a una ricetta. Solo link, nessun upload. Estrazione AI di bozza ingredienti/passaggi non ancora implementata (§3.13-stile, decisione separata).';

create index idx_recipe_videos_recipe on recipe_videos(recipe_id);

-- RLS: stesso pattern di recipe_steps/recipe_ingredients — lettura a tutti
-- (utile anche allo staff come riferimento), scrittura solo titolare.
alter table recipe_videos enable row level security;
create policy recipe_videos_select_all on recipe_videos
  for select to authenticated using (true);
create policy recipe_videos_ins_titolare on recipe_videos
  for insert to authenticated with check ((select is_titolare()));
create policy recipe_videos_del_titolare on recipe_videos
  for delete to authenticated using ((select is_titolare()));
grant select, insert, delete on recipe_videos to authenticated;
