# Learning, events, and activities

Learning includes seed data for nine challenge missions, published learning paths/challenges, completion records, progress, streak fields, badges, and points. `submit_challenge_answer`/`complete_challenge` keep answer validation and awards in protected database operations; answer keys must not be assumed exposed to the browser. Challenge completion is unique per member/challenge and can award badges and challenge points.

Events have publication/status fields, optional capacity, registration/cancellation, attendance, and poster path/alt metadata. Availability RPCs and registration operations are intended to protect capacity; attendance is an admin-gated action and awards +20. Poster delivery uses route handlers/storage paths. Storage bucket configuration and live delivery authorization are NOT VERIFIED — requires runtime/database verification.

`activities` is an event/evidence feed, keyed by unique `activity_key`. The activity-integrity migration documents project-created, project-joined, event-registered, event-attended, badge-earned, and challenge activity keys. Inserts use conflict-safe idempotency inside the same SECURITY DEFINER transaction as authoritative mutations. A join request or event cancellation is not positive activity; `lesson` is reserved but unimplemented.

Known gaps: no local Supabase/runtime evidence was supplied, authenticated UI paths are not comprehensively executed here, and actual challenge seed/runtime contents and poster storage access are NOT VERIFIED — requires runtime/database verification.
