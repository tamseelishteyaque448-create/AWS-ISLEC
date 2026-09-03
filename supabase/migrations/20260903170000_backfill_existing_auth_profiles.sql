-- Accounts created before the initial schema was deployed did not pass through
-- the profile-creation trigger. Create their default member profiles once.
insert into public.profiles (id, full_name, handle)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(users.email, '@', 1), ''),
    'New member'
  ),
  '@member_' || substring(users.id::text from 1 for 8)
from auth.users as users
on conflict (id) do nothing;
