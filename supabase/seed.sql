-- Deterministic local-development seed data. These Auth rows are not login-capable.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'alex.morgan@example.test', '{"full_name":"Alex Morgan","handle":"@alexm"}'),
  ('00000000-0000-4000-8000-000000000002', 'maya.chen@example.test', '{"full_name":"Maya Chen","handle":"@mayac"}'),
  ('00000000-0000-4000-8000-000000000003', 'jon.bell@example.test', '{"full_name":"Jon Bell","handle":"@jonb"}'),
  ('00000000-0000-4000-8000-000000000004', 'riley.shaw@example.test', '{"full_name":"Riley Shaw","handle":"@rileys"}'),
  ('00000000-0000-4000-8000-000000000005', 'kai.tan@example.test', '{"full_name":"Kai Tan","handle":"@kait"}');

update public.profiles
set role = seeded.role, points = seeded.points, streak = seeded.streak
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Cloud builder', 1840, 12),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Community leader', 3120, 0),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Cloud builder', 1660, 0),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'Builder', 0, 0),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'Builder', 0, 0)
) as seeded(id, role, points, streak)
where profiles.id = seeded.id;

insert into public.learning_paths (id, slug, title, description, level, estimated_minutes, points, sort_order) values
  ('10000000-0000-4000-8000-000000000001', 'serverless-foundations', 'Serverless foundations', 'Lambda + API Gateway + DynamoDB', 'starter', 120, 250, 1),
  ('10000000-0000-4000-8000-000000000002', 'observability-in-practice', 'Observability in practice', 'Instrument an app with CloudWatch', 'builder', 180, 400, 2),
  ('10000000-0000-4000-8000-000000000003', 'resilient-cloud-design', 'Resilient cloud design', 'Design a multi-AZ architecture', 'architect', 240, 600, 3);

insert into public.challenges (id, learning_path_id, slug, title, detail, level, points, sort_order) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'build-a-url-shortener', 'Build a URL shortener', 'Lambda + API Gateway + DynamoDB', 'starter', 250, 1),
  ('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'add-eyes-to-your-stack', 'Add eyes to your stack', 'Instrument an app with CloudWatch', 'builder', 400, 1),
  ('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'make-it-resilient', 'Make it resilient', 'Design a multi-AZ architecture', 'architect', 600, 1);

insert into public.projects (id, slug, title, category, status, description, progress, technologies, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'signal-garden', 'Signal Garden', 'Serverless', 'in_progress', 'A calm signal board for local gardens, designed to turn sensor data into small, useful decisions.', 72, array['Lambda', 'API Gateway', 'DynamoDB'], '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'tiny-observability', 'Tiny Observability', 'DevOps', 'in_progress', 'A minimal observability starter that makes traces, logs, and meaningful signals easier to see.', 34, array['CloudWatch', 'OpenTelemetry', 'CDK'], '00000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003', 'open-source-atlas', 'Open Source Atlas', 'Community', 'shipped', 'A shared map of open-source opportunities for students ready to make their first contribution.', 100, array['Next.js', 'TypeScript', 'Vercel'], '00000000-0000-4000-8000-000000000003');

insert into public.project_members (project_id, profile_id, role) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'contributor'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'contributor'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'owner'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'contributor'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'owner'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'contributor'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'contributor'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', 'contributor');

insert into public.events (id, slug, title, event_type, status, starts_at, location, context, attendance_label) values
  ('30000000-0000-4000-8000-000000000001', 'ship-it-serverless-study-hall', 'Ship it: a serverless study hall', 'Virtual', 'upcoming', '2026-08-28 18:00:00+00', 'Virtual', 'Bring the project you are stuck on. We will make progress together, one small deployment at a time.', 'Open study hall'),
  ('30000000-0000-4000-8000-000000000002', 'designing-for-the-cloud', 'Designing for the cloud', 'Workshop', 'upcoming', '2026-09-03 16:30:00+00', 'Virtual', 'A hands-on session for making technical decisions that serve both the system and the people using it.', 'Guided workshop'),
  ('30000000-0000-4000-8000-000000000003', 'community-demo-night', 'Community demo night', 'Showcase', 'upcoming', '2026-09-11 19:00:00+00', 'Virtual', 'Share a rough edge, a small win, or the question your latest build gave you. First versions welcome.', 'Show and tell'),
  ('30000000-0000-4000-8000-000000000004', 'patterns-for-a-calmer-serverless-stack', 'Patterns for a calmer serverless stack', 'Study hall', 'past', '2026-08-15 18:00:00+00', 'Virtual', 'Members compared notes on resilient serverless patterns and left with experiments to try in their own builds.', '24 builders joined'),
  ('30000000-0000-4000-8000-000000000005', 'first-deploy-celebration', 'First deploy celebration', 'Community', 'past', '2026-08-08 18:00:00+00', 'Virtual', 'A room full of first launches, useful feedback, and proof that progress gets easier when it is shared.', '18 first deploys');

insert into public.badges (id, slug, icon, title, detail, points) values
  ('40000000-0000-4000-8000-000000000001', 'first-deploy', '01', 'First deploy', 'Deploy your first app', 250),
  ('40000000-0000-4000-8000-000000000002', 'open-book', '02', 'Open book', 'Complete 5 lessons', 120),
  ('40000000-0000-4000-8000-000000000003', 'signal-boost', '03', 'Signal boost', 'Help a fellow builder', 0);

insert into public.user_badges (profile_id, badge_id, earned_at) values
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '2026-08-18 12:00:00+00'),
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '2026-08-19 12:00:00+00');

insert into public.activities (activity_key, profile_id, activity_type, title, detail, points, occurred_at, project_id, learning_path_id, badge_id, event_id) values
  ('activity-1', '00000000-0000-4000-8000-000000000001', 'project', 'Updated Signal Garden', 'Added request tracing to the API', 80, '2026-08-20 12:00:00+00', '20000000-0000-4000-8000-000000000001', null, null, null),
  ('activity-2', '00000000-0000-4000-8000-000000000001', 'lesson', 'Completed Open book', 'AWS fundamentals path', 120, '2026-08-19 12:00:00+00', null, '10000000-0000-4000-8000-000000000001', null, null),
  ('activity-3', '00000000-0000-4000-8000-000000000001', 'badge', 'Earned First deploy', 'Your first app is live', 250, '2026-08-18 12:00:00+00', null, null, '40000000-0000-4000-8000-000000000001', null),
  ('activity-4', '00000000-0000-4000-8000-000000000001', 'event', 'Joined study hall', 'Serverless patterns', 40, '2026-08-15 20:00:00+00', null, null, null, '30000000-0000-4000-8000-000000000004');
