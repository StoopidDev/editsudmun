-- Cards show a 2-line script preview and a "has note" marker; reading these instead of the full
-- script and note keeps week and Home lists small (Buddy handoff 2026-11-12 §2.5.5).
-- Generated, so nothing writes them; copy_clip and the API insert named columns only.
alter table public.clips
  add column script_preview text generated always as (left(script, 160)) stored,
  add column has_note boolean generated always as (note <> '') stored;
