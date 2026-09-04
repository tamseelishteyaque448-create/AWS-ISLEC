insert into public.badges (
  slug,
  icon,
  title,
  detail,
  points,
  requirement_type,
  requirement_value
)
values
  ('first-challenge', '04', 'First challenge', 'Complete your first challenge', 100, 'challenge_count', 1),
  ('week-in-motion', '05', 'Week in motion', 'Maintain a 7-day streak', 150, 'streak', 7),
  ('builder-momentum', '06', 'Builder momentum', 'Reach 1,000 builder points', 200, 'points', 1000);