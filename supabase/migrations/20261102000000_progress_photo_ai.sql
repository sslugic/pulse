-- Progress photos: the AI sorts each photo by angle (front, side, back) so before/after compares like
-- with like, and can redraw a photo as a retro cartoon. Sorting runs on Flash-Lite with a small copy of
-- the photo and is free; a drawing is one image from a Gemini image model.
insert into public.feature_costs (feature, credits, description) values
  ('photo_angle', 0, 'Sorting a progress photo by angle'),
  ('photo_retro', 5, 'Retro cartoon version of a progress photo')
on conflict (feature) do update set credits = excluded.credits, description = excluded.description;
