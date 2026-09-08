-- Correct the V1 seed for environments that did not have the local learning-path slugs.
-- This creates the one approved catalogue path and is safe to apply repeatedly.
insert into public.learning_paths (
  slug, title, description, level, estimated_minutes, points, sort_order, is_published
)
values (
  'aws-challenge-missions',
  'AWS Challenge Missions',
  'A practical AWS challenge track for applying cloud fundamentals through short, objective missions.',
  'starter', 60, 1050, 10, true
)
on conflict (slug) do update
set is_published = true;

insert into public.challenges (learning_path_id, slug, title, detail, level, points, sort_order, is_published)
select lp.id, seed.slug, seed.title, seed.detail, seed.level, seed.points, seed.sort_order, true
from (values
  ('where-should-the-files-go', 'Where should the files go?', 'Choose the AWS service designed for files and objects.', 'easy', 50, 1),
  ('who-gets-permission', 'Who gets permission?', 'Identify the AWS identity and access service.', 'easy', 50, 2),
  ('server-or-no-server', 'Server or no server?', 'Choose an event-driven compute service.', 'easy', 50, 3),
  ('pick-the-right-database', 'Pick the right database', 'Match a relational workload to the right database service.', 'medium', 100, 4),
  ('the-broken-lambda', 'The broken Lambda', 'Diagnose a common Lambda and S3 permission problem.', 'medium', 100, 5),
  ('handle-the-traffic-spike', 'Handle the traffic spike', 'Choose a concept for changing demand.', 'medium', 100, 6),
  ('design-the-student-portal', 'Design the student portal', 'Combine services for a simple student portal.', 'hard', 200, 7),
  ('make-the-application-safer', 'Make the application safer', 'Select two practical protections for student information.', 'hard', 200, 8),
  ('build-the-aws-solution', 'Build the AWS solution', 'Combine the core AWS fundamentals into one solution.', 'hard', 200, 9)
) as seed(slug, title, detail, level, points, sort_order)
cross join (select id from public.learning_paths where slug = 'aws-challenge-missions') lp
on conflict (slug) do update set
  learning_path_id = excluded.learning_path_id,
  title = excluded.title,
  detail = excluded.detail,
  level = excluded.level,
  points = excluded.points,
  sort_order = excluded.sort_order,
  is_published = true;

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
on conflict (challenge_id) do update set
  category = excluded.category,
  estimated_minutes = excluded.estimated_minutes,
  scenario = excluded.scenario,
  question = excluded.question,
  options = excluded.options,
  hint = excluded.hint,
  success_explanation = excluded.success_explanation;

insert into public.challenge_answer_keys (challenge_id, correct_answer)
select c.id, jsonb_build_object('choices', seed.choices::jsonb)
from (values
 ('where-should-the-files-go','["s3"]'), ('who-gets-permission','["iam"]'), ('server-or-no-server','["lambda"]'),
 ('pick-the-right-database','["rds"]'), ('the-broken-lambda','["get-object"]'), ('handle-the-traffic-spike','["auto-scaling"]'),
 ('design-the-student-portal','["s3","lambda","rds"]'), ('make-the-application-safer','["least-privilege","encryption"]'),
 ('build-the-aws-solution','["s3","lambda","rds"]')
) as seed(slug, choices)
join public.challenges c on c.slug = seed.slug
on conflict (challenge_id) do update set correct_answer = excluded.correct_answer;
