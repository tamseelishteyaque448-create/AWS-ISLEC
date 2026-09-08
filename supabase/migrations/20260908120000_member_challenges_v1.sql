-- Member Challenges V1: public learning content and private, objective answer keys.
alter table public.challenges drop constraint if exists challenges_level_check;
alter table public.challenges add constraint challenges_level_check
  check (level in ('starter', 'builder', 'architect', 'easy', 'medium', 'hard'));

create table public.challenge_contents (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  category text not null check (char_length(trim(category)) between 1 and 80),
  estimated_minutes integer not null check (estimated_minutes between 1 and 120),
  scenario text not null check (char_length(trim(scenario)) between 1 and 4000),
  question text not null check (char_length(trim(question)) between 1 and 2000),
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  hint text,
  success_explanation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.challenge_answer_keys (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  correct_answer jsonb not null check (jsonb_typeof(correct_answer) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger challenge_contents_set_updated_at before update on public.challenge_contents for each row execute function public.set_updated_at();
create trigger challenge_answer_keys_set_updated_at before update on public.challenge_answer_keys for each row execute function public.set_updated_at();

alter table public.challenge_contents enable row level security;
alter table public.challenge_answer_keys enable row level security;
revoke all on public.challenge_contents, public.challenge_answer_keys from anon, authenticated;
grant select on public.challenge_contents to authenticated;
create policy "Members can read content for published challenges" on public.challenge_contents for select to authenticated
using (exists (
  select 1 from public.challenges c join public.learning_paths lp on lp.id = c.learning_path_id
  where c.id = challenge_contents.challenge_id and c.is_published and lp.is_published
));

-- The old RPC awarded rewards based only on a challenge id, so any authenticated
-- caller could bypass solving. It remains an internal security-definer primitive.
revoke all on function public.complete_challenge(uuid) from public, anon, authenticated;

create or replace function public.submit_challenge_answer(p_challenge_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid := auth.uid();
  v_expected jsonb;
  v_received jsonb;
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_answer is null or jsonb_typeof(p_answer) <> 'object'
    or jsonb_typeof(p_answer -> 'choices') <> 'array'
    or jsonb_array_length(p_answer -> 'choices') not between 1 and 5
    or exists (select 1 from jsonb_array_elements(p_answer -> 'choices') item where jsonb_typeof(item) <> 'string') then
    return jsonb_build_object('status', 'incorrect', 'message', 'Choose an answer before submitting.');
  end if;

  select jsonb_build_object('choices', coalesce(jsonb_agg(value order by value), '[]'::jsonb))
  into v_received
  from jsonb_array_elements_text(p_answer -> 'choices') as values_to_check(value);

  if (select count(*) from jsonb_array_elements_text(p_answer -> 'choices')) <>
     (select count(distinct value) from jsonb_array_elements_text(p_answer -> 'choices') as values_to_check(value)) then
    return jsonb_build_object('status', 'incorrect', 'message', 'Choose each answer only once.');
  end if;

  select jsonb_build_object('choices', coalesce(jsonb_agg(value order by value), '[]'::jsonb))
  into v_expected
  from public.challenge_answer_keys keys
  join public.challenges c on c.id = keys.challenge_id
  join public.learning_paths lp on lp.id = c.learning_path_id
  cross join lateral jsonb_array_elements_text(keys.correct_answer -> 'choices') as values_to_check(value)
  where keys.challenge_id = p_challenge_id and c.is_published and lp.is_published;

  if v_expected is null then
    raise exception using errcode = 'P0002', message = 'Published challenge not found';
  end if;

  if v_received <> v_expected then
    return jsonb_build_object('status', 'incorrect', 'message', 'Not quite. Review the scenario and try again.');
  end if;

  return public.complete_challenge(p_challenge_id);
end;
$function$;

revoke all on function public.submit_challenge_answer(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_challenge_answer(uuid, jsonb) to authenticated;

-- Keep historic challenges and their completion ledger intact, but only expose
-- the nine V1 missions in the member catalogue.
update public.challenges set is_published = false
where slug not in (
  'where-should-the-files-go', 'who-gets-permission', 'server-or-no-server',
  'pick-the-right-database', 'the-broken-lambda', 'handle-the-traffic-spike',
  'design-the-student-portal', 'make-the-application-safer', 'build-the-aws-solution'
);

insert into public.challenges (learning_path_id, slug, title, detail, level, points, sort_order, is_published)
select lp.id, seed.slug, seed.title, seed.detail, seed.level, seed.points, seed.sort_order, true
from (values
  ('serverless-foundations', 'where-should-the-files-go', 'Where should the files go?', 'Choose the AWS service designed for files and objects.', 'easy', 50, 101),
  ('serverless-foundations', 'who-gets-permission', 'Who gets permission?', 'Identify the AWS identity and access service.', 'easy', 50, 102),
  ('serverless-foundations', 'server-or-no-server', 'Server or no server?', 'Choose an event-driven compute service.', 'easy', 50, 103),
  ('serverless-foundations', 'pick-the-right-database', 'Pick the right database', 'Match a relational workload to the right database service.', 'medium', 100, 104),
  ('serverless-foundations', 'the-broken-lambda', 'The broken Lambda', 'Diagnose a common Lambda and S3 permission problem.', 'medium', 100, 105),
  ('resilient-cloud-design', 'handle-the-traffic-spike', 'Handle the traffic spike', 'Choose a concept for changing demand.', 'medium', 100, 106),
  ('serverless-foundations', 'design-the-student-portal', 'Design the student portal', 'Combine services for a simple student portal.', 'hard', 200, 107),
  ('resilient-cloud-design', 'make-the-application-safer', 'Make the application safer', 'Select two practical protections for student information.', 'hard', 200, 108),
  ('serverless-foundations', 'build-the-aws-solution', 'Build the AWS solution', 'Combine the core AWS fundamentals into one solution.', 'hard', 200, 109)
) as seed(path_slug, slug, title, detail, level, points, sort_order)
join public.learning_paths lp on lp.slug = seed.path_slug and lp.is_published
on conflict (slug) do update set
  learning_path_id = excluded.learning_path_id, title = excluded.title, detail = excluded.detail,
  level = excluded.level, points = excluded.points, sort_order = excluded.sort_order, is_published = true;

insert into public.challenge_contents (challenge_id, category, estimated_minutes, scenario, question, options, hint, success_explanation)
select c.id, seed.category, seed.minutes, seed.scenario, seed.question, seed.options::jsonb, seed.hint, seed.explanation
from (values
 ('where-should-the-files-go','Storage',3,'A college website needs to store images, PDFs, and other files.','Which AWS service is designed for this type of storage?','[{"id":"s3","label":"Amazon S3"},{"id":"rds","label":"Amazon RDS"},{"id":"lambda","label":"AWS Lambda"}]','Think about object storage.',null),
 ('who-gets-permission','Security',3,'An application needs controlled access to AWS resources.','Which AWS service manages identities and permissions?','[{"id":"iam","label":"AWS IAM"},{"id":"s3","label":"Amazon S3"},{"id":"cloudwatch","label":"Amazon CloudWatch"}]','Think about identities and access.',null),
 ('server-or-no-server','Compute',3,'A small function should run in response to an event without managing servers.','Which AWS service best fits this use case?','[{"id":"lambda","label":"AWS Lambda"},{"id":"ec2","label":"Amazon EC2"},{"id":"rds","label":"Amazon RDS"}]','Think event-driven compute.',null),
 ('pick-the-right-database','Databases',5,'A college application needs a traditional relational database with SQL queries and relationships.','Which is the better fit?','[{"id":"rds","label":"Amazon RDS"},{"id":"dynamodb","label":"Amazon DynamoDB"}]','Look for the relational SQL option.','Amazon RDS is designed for relational data, SQL queries, and relationships.'),
 ('the-broken-lambda','Security',5,'A Lambda function runs successfully but receives AccessDenied when trying to read an S3 object.','What is the most likely missing requirement?','[{"id":"get-object","label":"IAM permission allowing s3:GetObject for the required object or bucket"},{"id":"more-memory","label":"More Lambda memory"},{"id":"new-database","label":"A new database"}]','Check what authorizes access to S3.',null),
 ('handle-the-traffic-spike','Scalability',5,'A college registration website normally serves 200 users but may receive thousands during registration.','Which concept should handle changing demand?','[{"id":"auto-scaling","label":"Auto Scaling / a scalable architecture"},{"id":"larger-file","label":"A larger file upload limit"},{"id":"manual-restart","label":"Manually restarting the website"}]','Think about capacity changing with demand.',null),
 ('design-the-student-portal','Architecture',8,'A student portal needs a web frontend, application logic, and structured relational data.','Select the best service combination.','[{"id":"s3","label":"Amazon S3 for the web frontend"},{"id":"lambda","label":"AWS Lambda for application logic"},{"id":"rds","label":"Amazon RDS for structured relational data"},{"id":"iam","label":"AWS IAM as the data store"}]','Choose one service for each stated need.',null),
 ('make-the-application-safer','Security',8,'A college application stores student information.','Select the TWO appropriate security practices.','[{"id":"least-privilege","label":"Use IAM least privilege"},{"id":"encryption","label":"Encrypt sensitive data"},{"id":"public-access","label":"Make all data publicly accessible"},{"id":"shared-keys","label":"Share one access key with everyone"}]','Choose protections that limit access and protect data.',null),
 ('build-the-aws-solution','Architecture',8,'AWS ISLEC needs an application that stores files, runs application logic, and stores structured relational data.','Select the appropriate service combination.','[{"id":"s3","label":"Amazon S3 for files"},{"id":"lambda","label":"AWS Lambda for application logic"},{"id":"rds","label":"Amazon RDS for structured data"},{"id":"cloudwatch","label":"Amazon CloudWatch as the application database"}]','Map each requirement to the service built for it.',null)
) as seed(slug, category, minutes, scenario, question, options, hint, explanation)
join public.challenges c on c.slug = seed.slug
on conflict (challenge_id) do update set category=excluded.category, estimated_minutes=excluded.estimated_minutes, scenario=excluded.scenario, question=excluded.question, options=excluded.options, hint=excluded.hint, success_explanation=excluded.success_explanation;

insert into public.challenge_answer_keys (challenge_id, correct_answer)
select c.id, jsonb_build_object('choices', seed.choices::jsonb)
from (values
 ('where-should-the-files-go','["s3"]'), ('who-gets-permission','["iam"]'), ('server-or-no-server','["lambda"]'),
 ('pick-the-right-database','["rds"]'), ('the-broken-lambda','["get-object"]'), ('handle-the-traffic-spike','["auto-scaling"]'),
 ('design-the-student-portal','["s3","lambda","rds"]'), ('make-the-application-safer','["least-privilege","encryption"]'),
 ('build-the-aws-solution','["s3","lambda","rds"]')
) as seed(slug, choices)
join public.challenges c on c.slug = seed.slug
on conflict (challenge_id) do update set correct_answer=excluded.correct_answer;
