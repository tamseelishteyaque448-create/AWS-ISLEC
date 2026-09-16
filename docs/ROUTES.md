# Routes

## Public

| Route | Purpose |
| --- | --- |
| `/` | Home |
| `/about` | About |
| `/explore` | Public exploration |
| `/learn` | Public learning |
| `/events` and `/events/[slug]` | Public events/details |
| `/projects` and `/projects/[slug]` | Public projects/details |
| `/join` | Login/signup entry |
| `/auth/invite` | Invite acceptance entry |
| `/auth/callback` | Auth callback handler |

## Member (authenticated)

`/member`, `/member/profile`, `/member/journey`, `/member/learn`, `/member/challenges`, `/member/challenges/[slug]`, `/member/events`, `/member/events/[slug]`, `/member/explore`, `/member/projects`, `/member/projects/[id]`, `/member/activities`, `/member/achievements`, and `/member/leaderboard`.

The member layout redirects unauthenticated users to `/join?mode=login&next=...`.

## Admin (allowlisted)

`/admin`, `/admin/members`, `/admin/learning`, `/admin/challenges`, `/admin/events`, `/admin/projects`, `/admin/explore`, `/admin/analytics`, `/admin/activities`, `/admin/leaderboard`, `/admin/achievements`, and `/admin/settings`.

The admin layout redirects unauthenticated users to login and authenticated non-admins to `/member`.

## API/asset handlers

`/api/auth`, `/api/events/[slug]/poster`, and `/api/admin/events/[id]/poster` are route handlers. Their runtime authorization and storage behavior require runtime verification.
