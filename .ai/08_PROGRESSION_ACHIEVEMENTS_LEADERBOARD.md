# Progression, achievements, and leaderboard

Stages are authoritative in `profiles.stage` and monotonic: Explorer (account exists); Builder (at least one completed challenge and one currently active approved owner/contributor membership); Contributor (≥500 points and one historically approved project); Innovator (≥2,000 points, two historically approved projects, one attended event); Mentor (≥5,000 points, three historically approved projects, three attended events).

Historical approved project evidence requires an `approved` project review and membership joined at or before that approval. The later fix permits membership statuses `active`, `submitted`, and `completed` for historical evidence; post-approval joiners and requested/declined/withdrawn status do not qualify. Stage advancement never lowers a stored stage. The internal `advance_member_stage` is SECURITY DEFINER with no client-supplied stage and is called from authoritative point-mutating RPCs.

Point economy: challenge points are each challenge's configured value; badge points are each badge's configured value; event attendance is +20; first project submission is +50 owner; first publication/approval is +150 owner; first approved project join is +30 contributor. Unique completions/activity keys and first-award checks are anti-loop controls. Leaderboard and achievements are read projections over authoritative profile/evidence data, not their own authority.

**V2.2 tasks and milestones do not award points.** Badge eligibility is existing challenge/badge requirement logic; full production eligibility and leaderboard results are NOT VERIFIED — requires runtime/database verification.
