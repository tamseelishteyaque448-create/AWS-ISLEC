alter table public.badges
  add column requirement_type text,
  add column requirement_value integer;

alter table public.badges
  add constraint badges_requirement_type_check
  check (requirement_type is null or requirement_type in ('challenge_count', 'streak', 'points')),
  add constraint badges_requirement_value_check
  check (requirement_value is null or requirement_value > 0),
  add constraint badges_requirement_pair_check
  check ((requirement_type is null) = (requirement_value is null));