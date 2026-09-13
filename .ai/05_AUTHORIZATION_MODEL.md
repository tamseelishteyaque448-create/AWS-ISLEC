# Authorization model

| Persona | Read / mutate boundary |
| --- | --- |
| Anonymous | Public published projects and public pages; no member/admin or protected mutation access. |
| Authenticated member | Own profile, participation records, published project discovery and own/involved project reads; uses RPCs for protected actions. |
| Project owner | Active owner may manage eligible project metadata, resolve requests, transfer ownership, and access relevant request evidence through protected paths. |
| Active contributor | May read active-project membership context and perform the explicitly exposed personal project-work action; cannot manage owner-only operations. |
| Applicant | May read own request/proofs and add/remove proofs only while request is `requested`; cannot see unrelated applications. |
| Unrelated member | Sees published project data, not private project workspace/material merely due to being authenticated. |
| Former/removed member | Must not be assumed to retain private workspace access. Current V1 policy distinctions must be checked against migrations and live DB; V2.2 must enforce current active membership. |
| Admin | Allowlisted administrator can access admin routes and policy-authorized administration/audit reads; admin status comes only from `private.admin_users`. |

Project privacy is anchored to `publication_state = 'published'`, active/involved membership, and admin authorization; legacy project fields are not the visibility authority. Historical membership evidence used for stages is not a permission grant. Do not convert historical membership, a declined/withdrawn request, client state, or a display role into workspace access.

NOT VERIFIED — requires database verification for the deployed policy/grant result and browser verification for all persona flows.
