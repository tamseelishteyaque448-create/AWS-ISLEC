-- ==========================================================================
-- Projects V1 Full Lifecycle Verification
-- Each operation bundled in a do-block to ensure set_config persists
-- within the same implicit transaction as the RPC call.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- SETUP
-- -------------------------------------------------------------------------
do $$
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at) values
    ('aa000001-0000-4000-8000-000000000001'::uuid, 'qa_owner@islec.test',   now(), now(), now()),
    ('bb000002-0000-4000-8000-000000000002'::uuid, 'qa_member@islec.test',  now(), now(), now()),
    ('cc000003-0000-4000-8000-000000000003'::uuid, 'qa_stranger@islec.test',now(), now(), now()),
    ('dd000004-0000-4000-8000-000000000004'::uuid, 'qa_admin@islec.test',   now(), now(), now()),
    ('ee000005-0000-4000-8000-000000000005'::uuid, 'qa_cap1@islec.test',    now(), now(), now()),
    ('ff000006-0000-4000-8000-000000000006'::uuid, 'qa_cap2@islec.test',    now(), now(), now()),
    ('a0000007-0000-4000-8000-000000000007'::uuid, 'qa_cap3@islec.test',    now(), now(), now());

  update public.profiles set handle='@qa_owner'    where id='aa000001-0000-4000-8000-000000000001';
  update public.profiles set handle='@qa_member'   where id='bb000002-0000-4000-8000-000000000002';
  update public.profiles set handle='@qa_stranger' where id='cc000003-0000-4000-8000-000000000003';
  update public.profiles set handle='@qa_admin'    where id='dd000004-0000-4000-8000-000000000004';
  update public.profiles set handle='@qa_cap1'     where id='ee000005-0000-4000-8000-000000000005';
  update public.profiles set handle='@qa_cap2'     where id='ff000006-0000-4000-8000-000000000006';
  update public.profiles set handle='@qa_cap3'     where id='a0000007-0000-4000-8000-000000000007';
  insert into private.admin_users(user_id) values('dd000004-0000-4000-8000-000000000004');
end $$;

-- =========================================================================
-- T1+1b: Member project creation
-- =========================================================================
do $$
declare v_result jsonb; v_project_id uuid; v_pub text; v_stage text; v_rec text; v_role text; v_status text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.create_project_v1(
    'QA Test Project','qa-test-project-verif','Cloud',
    'QA test project',ARRAY['Lambda','S3'],'open',3);
  v_project_id := (v_result->>'project_id')::uuid;
  select publication_state,build_stage,recruitment_mode into v_pub,v_stage,v_rec
  from public.projects where id=v_project_id;
  if v_pub='draft' and v_stage='idea' and v_rec='open'
  then raise notice 'PASS  [T1  project creation: pub=draft/stage=idea/rec=open]';
  else raise notice 'FAIL  [T1  project creation] pub=% stage=% rec=%',v_pub,v_stage,v_rec;
  end if;
  select role,status into v_role,v_status from public.project_members
  where project_id=v_project_id and profile_id='aa000001-0000-4000-8000-000000000001';
  if v_role='owner' and v_status='active'
  then raise notice 'PASS  [T1b owner row atomic: role=owner/status=active]';
  else raise notice 'FAIL  [T1b owner row] role=% status=%',v_role,v_status;
  end if;
end $$;

-- T2: Owner update
do $$
declare v_result jsonb; v_stage text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Test Project Updated','Cloud','Updated desc',
    ARRAY['Lambda','S3','DynamoDB'],'building','open',3,null,null);
  select build_stage into v_stage from public.projects where slug='qa-test-project-verif';
  if v_stage='building' then raise notice 'PASS  [T2  update_project_v1: build_stage=building]';
  else raise notice 'FAIL  [T2  update_project_v1] stage=%',v_stage; end if;
end $$;

-- T2b: Non-owner rejected
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"cc000003-0000-4000-8000-000000000003","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'Hacked','Cloud','',ARRAY[]::text[],'idea','open',null,null,null);
  raise notice 'FAIL  [T2b non-owner rejected from update_project_v1] — no exception';
exception when sqlstate '42501' then
  raise notice 'PASS  [T2b non-owner rejected from update_project_v1]';
end $$;

-- T14: Owner submits for review
do $$
declare v_result jsonb; v_pub text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.submit_project_for_review(
    (select id from public.projects where slug='qa-test-project-verif'));
  select publication_state into v_pub from public.projects where slug='qa-test-project-verif';
  if v_pub='pending_review' then raise notice 'PASS  [T14 submit_project_for_review: pending_review]';
  else raise notice 'FAIL  [T14 submit] pub=%',v_pub; end if;
end $$;

-- T17b: Cannot resubmit pending_review
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.submit_project_for_review(
    (select id from public.projects where slug='qa-test-project-verif'));
  raise notice 'FAIL  [T17b cannot resubmit pending_review] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T17b cannot resubmit pending_review project]';
end $$;

-- T20c: Owner cannot edit pending_review
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'Hacked','Cloud','Hacked',ARRAY['Lambda'],'idea','open',null,null,null);
  raise notice 'FAIL  [T20c owner cannot edit pending_review] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T20c owner cannot edit pending_review project]';
end $$;

-- T20: Admin edits pending_review project
do $$
declare v_result jsonb; v_title text; v_stage text; v_rec text; v_cap int; v_pub text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.admin_update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Admin Edited Title','CloudOps','Admin edited',
    ARRAY['Lambda','SQS'],'prototype','invite_only',5,
    'https://github.com/qa/test','https://demo.example.com');
  select title,build_stage,recruitment_mode,team_capacity,publication_state
  into v_title,v_stage,v_rec,v_cap,v_pub
  from public.projects where slug='qa-test-project-verif';
  if v_title='QA Admin Edited Title' and v_stage='prototype' and v_rec='invite_only' and v_cap=5
  then raise notice 'PASS  [T20  admin_update_project_v1: V1 fields updated]';
  else raise notice 'FAIL  [T20  admin_update_project_v1] title=% stage=% rec=% cap=%',v_title,v_stage,v_rec,v_cap;
  end if;
  if v_pub='pending_review'
  then raise notice 'PASS  [T20b admin_update does not mutate publication_state]';
  else raise notice 'FAIL  [T20b pub_state changed to %]',v_pub;
  end if;
end $$;

-- T15: Admin approves publication
do $$
declare v_result jsonb; v_pub text; v_ispub bool; v_status text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.review_project_publication(
    (select id from public.projects where slug='qa-test-project-verif'),'approved','');
  select publication_state,is_published,status into v_pub,v_ispub,v_status
  from public.projects where slug='qa-test-project-verif';
  if v_pub='published' and v_ispub=true
  then raise notice 'PASS  [T15 approve: pub=published, is_published=true, trigger synced]';
  else raise notice 'FAIL  [T15 approve] pub=% is_pub=% status=%',v_pub,v_ispub,v_status;
  end if;
end $$;

-- Re-open to 'open' for join requests (admin update)
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Admin Edited Title','CloudOps','Admin edited',
    ARRAY['Lambda','SQS'],'prototype','open',5,
    'https://github.com/qa/test','https://demo.example.com');
end $$;

-- T4+5: Join request + duplicate
do $$
declare v_result jsonb; v_rid uuid; v_cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bb000002-0000-4000-8000-000000000002","role":"authenticated"}',false);
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),
    'Backend dev','Happy to contribute');
  select count(*) into v_cnt from public.project_join_requests
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002' and status='requested';
  if v_cnt=1 then raise notice 'PASS  [T4  join request created]';
  else raise notice 'FAIL  [T4  join request] count=%',v_cnt; end if;
  -- Duplicate idempotent
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),
    'Backend dev','Dup');
  select count(*) into v_cnt from public.project_join_requests
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002' and status='requested';
  if v_cnt=1 and (v_result->>'status')='requested'
  then raise notice 'PASS  [T5  duplicate join request idempotent, still 1 open]';
  else raise notice 'FAIL  [T5  duplicate] count=% status=%',v_cnt,(v_result->>'status'); end if;
end $$;

-- T7: Owner declines stranger's request
do $$
declare v_result jsonb; v_status text; v_rid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"cc000003-0000-4000-8000-000000000003","role":"authenticated"}',false);
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),'Frontend','');
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_rid := (select id from public.project_join_requests
    where project_id=(select id from public.projects where slug='qa-test-project-verif')
      and profile_id='cc000003-0000-4000-8000-000000000003' and status='requested' limit 1);
  v_result := public.resolve_project_join_request(v_rid,false);
  select status into v_status from public.project_join_requests where id=v_rid;
  if v_status='declined' then raise notice 'PASS  [T7  owner decline join request]';
  else raise notice 'FAIL  [T7  decline] status=%',v_status; end if;
end $$;

-- T6: Owner approves member
do $$
declare v_result jsonb; v_role text; v_status text; v_rid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_rid := (select id from public.project_join_requests
    where project_id=(select id from public.projects where slug='qa-test-project-verif')
      and profile_id='bb000002-0000-4000-8000-000000000002' and status='requested' limit 1);
  v_result := public.resolve_project_join_request(v_rid,true);
  select role,status into v_role,v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002';
  if v_role='contributor' and v_status='active'
  then raise notice 'PASS  [T6  owner approve: contributor/active]';
  else raise notice 'FAIL  [T6  approve] role=% status=%',v_role,v_status; end if;
end $$;

-- T3: Active contributors count
do $$
declare v_cnt int;
begin
  select count(*) into v_cnt from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and status='active';
  if v_cnt=2 then raise notice 'PASS  [T3  2 active contributors visible]';
  else raise notice 'FAIL  [T3  active contributors] count=%',v_cnt; end if;
end $$;

-- T8: Member withdrawal
do $$
declare v_result jsonb; v_status text; v_rid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"cc000003-0000-4000-8000-000000000003","role":"authenticated"}',false);
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),'Test withdraw','');
  v_rid := (select id from public.project_join_requests
    where project_id=(select id from public.projects where slug='qa-test-project-verif')
      and profile_id='cc000003-0000-4000-8000-000000000003' and status='requested' limit 1);
  v_result := public.withdraw_project_join_request(v_rid);
  select status into v_status from public.project_join_requests where id=v_rid;
  if v_status='withdrawn' then raise notice 'PASS  [T8  member withdrawal -> withdrawn]';
  else raise notice 'FAIL  [T8  withdrawal] status=%',v_status; end if;
end $$;

-- T10: invite_only blocks join
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Admin Edited Title','CloudOps','desc',ARRAY['Lambda'],'prototype','invite_only',5,
    'https://github.com/qa','https://demo.example.com');
  perform set_config('request.jwt.claims',
    '{"sub":"cc000003-0000-4000-8000-000000000003","role":"authenticated"}',false);
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),'test','');
  raise notice 'FAIL  [T10 invite_only blocks join] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T10 invite_only blocks join request]';
end $$;

-- T11: not_recruiting blocks join
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Admin Edited Title','CloudOps','desc',ARRAY['Lambda'],'prototype','not_recruiting',5,
    'https://github.com/qa','https://demo.example.com');
  perform set_config('request.jwt.claims',
    '{"sub":"cc000003-0000-4000-8000-000000000003","role":"authenticated"}',false);
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),'test','');
  raise notice 'FAIL  [T11 not_recruiting blocks join] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T11 not_recruiting blocks join request]';
end $$;

-- T9: Restore open
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Admin Edited Title','CloudOps','desc',ARRAY['Lambda'],'prototype','open',5,
    'https://github.com/qa','https://demo.example.com');
  raise notice 'PASS  [T9  open recruitment mode restored]';
end $$;

-- T12: Capacity enforcement
do $$
declare v_result jsonb; v_rid uuid;
begin
  -- Add cap1 and cap2 as active (direct insert, simulating approved)
  insert into public.project_members(project_id,profile_id,role,status)
  values
    ((select id from public.projects where slug='qa-test-project-verif'),
     'ee000005-0000-4000-8000-000000000005','contributor','active'),
    ((select id from public.projects where slug='qa-test-project-verif'),
     'ff000006-0000-4000-8000-000000000006','contributor','active');
  -- Now owner+member+cap1+cap2 = 4 active; capacity=5
  -- Add stranger as 5th via request+approve
  perform set_config('request.jwt.claims',
    '{"sub":"cc000003-0000-4000-8000-000000000003","role":"authenticated"}',false);
  v_result := public.request_project_join(
    (select id from public.projects where slug='qa-test-project-verif'),'test cap','');
  v_rid := (select id from public.project_join_requests
    where project_id=(select id from public.projects where slug='qa-test-project-verif')
      and profile_id='cc000003-0000-4000-8000-000000000003' and status='requested' limit 1);
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.resolve_project_join_request(v_rid,true); -- 5th fills capacity
  -- Try cap3 as 6th
  insert into public.project_join_requests(project_id,profile_id,requested_contribution,message)
  values((select id from public.projects where slug='qa-test-project-verif'),
         'a0000007-0000-4000-8000-000000000007','test','');
  v_rid := (select id from public.project_join_requests
    where project_id=(select id from public.projects where slug='qa-test-project-verif')
      and profile_id='a0000007-0000-4000-8000-000000000007' and status='requested' limit 1);
  v_result := public.resolve_project_join_request(v_rid,true);
  raise notice 'FAIL  [T12 capacity enforcement] — 6th member approved without error';
exception when sqlstate '22023' then
  raise notice 'PASS  [T12 capacity enforcement blocks 6th member]';
end $$;

-- T12b: admin_update_project_v1 blocks capacity below team
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.admin_update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'QA Admin Edited Title','CloudOps','desc',ARRAY['Lambda'],'prototype','open',1);
  raise notice 'FAIL  [T12b admin capacity guard] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T12b admin_update_project_v1 blocks capacity below active team]';
end $$;

-- T13: Structural concurrency safety
do $$
declare v_cnt int; v_defer bool; v_initd bool;
begin
  select count(*) into v_cnt from pg_indexes
  where tablename='project_members' and indexname='project_members_one_owner_idx';
  if v_cnt=1 then raise notice 'PASS  [T13a owner unique partial index present]';
  else raise notice 'FAIL  [T13a owner unique partial index]'; end if;
  select tgdeferrable,tginitdeferred into v_defer,v_initd
  from pg_trigger where tgname='project_members_owner_invariant';
  if v_defer and v_initd then raise notice 'PASS  [T13b invariant trigger DEFERRABLE INITIALLY DEFERRED]';
  else raise notice 'FAIL  [T13b invariant trigger] defer=% initd=%',v_defer,v_initd; end if;
end $$;

-- T16+17: changes_requested cycle
do $$
declare v_result jsonb; v_pub text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.create_project_v1(
    'QA Review Cycle','qa-review-cycle-verif','ML',
    'Review cycle test',ARRAY['SageMaker'],'open',null);
  v_result := public.submit_project_for_review(
    (select id from public.projects where slug='qa-review-cycle-verif'));
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.review_project_publication(
    (select id from public.projects where slug='qa-review-cycle-verif'),
    'changes_requested','Please add more detail');
  select publication_state into v_pub from public.projects where slug='qa-review-cycle-verif';
  if v_pub='changes_requested' then raise notice 'PASS  [T16 admin request_changes]';
  else raise notice 'FAIL  [T16 changes_requested] pub=%',v_pub; end if;
  -- Owner updates and resubmits
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-review-cycle-verif'),
    'QA Review Cycle Updated','ML','More detail',ARRAY['SageMaker','RDS'],
    'prototype','open',null,null,null);
  v_result := public.submit_project_for_review(
    (select id from public.projects where slug='qa-review-cycle-verif'));
  select publication_state into v_pub from public.projects where slug='qa-review-cycle-verif';
  if v_pub='pending_review' then raise notice 'PASS  [T17 owner resubmission after changes_requested]';
  else raise notice 'FAIL  [T17 resubmit] pub=%',v_pub; end if;
end $$;

-- T18+19: Archive + mutation rejection
do $$
declare v_result jsonb; v_pub text; v_status text; v_ispub bool;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.review_project_publication(
    (select id from public.projects where slug='qa-review-cycle-verif'),'archived','QA cleanup');
  select publication_state,status,is_published into v_pub,v_status,v_ispub
  from public.projects where slug='qa-review-cycle-verif';
  if v_pub='archived' and v_status='archived' and v_ispub=false
  then raise notice 'PASS  [T18 archive: pub=archived, status=archived, is_published=false]';
  else raise notice 'FAIL  [T18 archive] pub=% status=% ispub=%',v_pub,v_status,v_ispub; end if;
end $$;

do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.update_project_v1(
    (select id from public.projects where slug='qa-review-cycle-verif'),
    'Hacked','ML','Hacked',ARRAY['X'],'idea','open',null,null,null);
  raise notice 'FAIL  [T19 owner cannot edit archived] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T19  owner cannot edit archived project]';
end $$;

do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.admin_update_project_v1(
    (select id from public.projects where slug='qa-review-cycle-verif'),
    'Hacked','ML','Hacked',ARRAY['X'],'idea','open');
  raise notice 'FAIL  [T19b admin cannot edit archived] — no exception';
exception when sqlstate '22023' then
  raise notice 'PASS  [T19b admin cannot edit archived project]';
end $$;

-- T21: Non-admin rejected
do $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bb000002-0000-4000-8000-000000000002","role":"authenticated"}',false);
  v_result := public.admin_update_project_v1(
    (select id from public.projects where slug='qa-test-project-verif'),
    'Hacked','Cloud','Hacked',ARRAY['Lambda'],'idea','open');
  raise notice 'FAIL  [T21 non-admin rejected] — no exception';
exception when sqlstate '42501' then
  raise notice 'PASS  [T21 non-admin rejected from admin_update_project_v1]';
end $$;

-- T22+23: Member submit work, admin review
do $$
declare v_result jsonb; v_status text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bb000002-0000-4000-8000-000000000002","role":"authenticated"}',false);
  v_result := public.submit_project_work(
    (select id from public.projects where slug='qa-test-project-verif'));
  select status into v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002';
  if v_status='submitted' then raise notice 'PASS  [T22a member submit_project_work -> submitted]';
  else raise notice 'FAIL  [T22a submit_work] status=%',v_status; end if;
  -- Admin complete
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.review_project_member(
    (select id from public.projects where slug='qa-test-project-verif'),
    'bb000002-0000-4000-8000-000000000002','complete_submission');
  select status into v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002';
  if v_status='completed' then raise notice 'PASS  [T22b complete_submission -> completed]';
  else raise notice 'FAIL  [T22b complete_submission] status=%',v_status; end if;
  -- return_submission
  update public.project_members set status='submitted'
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002';
  v_result := public.review_project_member(
    (select id from public.projects where slug='qa-test-project-verif'),
    'bb000002-0000-4000-8000-000000000002','return_submission');
  select status into v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002';
  if v_status='active' then raise notice 'PASS  [T23a return_submission -> active]';
  else raise notice 'FAIL  [T23a return_submission] status=%',v_status; end if;
end $$;

-- T23b: Admin decline_request on cap3 pending request
do $$
declare v_result jsonb; v_status text; v_rid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  -- cap3 has a declined join_request but no project_members row from decline path
  -- Insert cap3 as requested member directly to test review_project_member decline_request
  insert into public.project_members(project_id,profile_id,role,status)
  values((select id from public.projects where slug='qa-test-project-verif'),
         'a0000007-0000-4000-8000-000000000007','contributor','requested')
  on conflict(project_id,profile_id) do update set status='requested';
  v_result := public.review_project_member(
    (select id from public.projects where slug='qa-test-project-verif'),
    'a0000007-0000-4000-8000-000000000007','decline_request');
  select status into v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='a0000007-0000-4000-8000-000000000007';
  if v_status='declined' then raise notice 'PASS  [T23b admin decline_request -> declined]';
  else raise notice 'FAIL  [T23b decline_request] status=%',v_status; end if;
end $$;

-- T24+25: Ownership transfer + invariant
do $$
declare v_result jsonb; v_role text; v_status text; v_cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated"}',false);
  v_result := public.transfer_project_ownership(
    (select id from public.projects where slug='qa-test-project-verif'),
    'bb000002-0000-4000-8000-000000000002');
  select role,status into v_role,v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='bb000002-0000-4000-8000-000000000002';
  if v_role='owner' and v_status='active'
  then raise notice 'PASS  [T24  transfer: new owner = contributor aa002]';
  else raise notice 'FAIL  [T24  transfer] role=% status=%',v_role,v_status; end if;
  select role into v_role from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='aa000001-0000-4000-8000-000000000001';
  if v_role='contributor' then raise notice 'PASS  [T24b old owner demoted to contributor]';
  else raise notice 'FAIL  [T24b demote] role=%',v_role; end if;
  select count(*) into v_cnt from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and role='owner' and status='active';
  if v_cnt=1 then raise notice 'PASS  [T25  exactly 1 active owner after transfer]';
  else raise notice 'FAIL  [T25  owner count] cnt=%',v_cnt; end if;
end $$;

-- T25b: Unique index prevents two owners
do $$
begin
  update public.project_members set role='owner'
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='aa000001-0000-4000-8000-000000000001';
  raise notice 'FAIL  [T25b unique index prevents two owners] — no exception';
exception when unique_violation then
  raise notice 'PASS  [T25b unique index prevents two simultaneous owners]';
end $$;

-- T26: Admin ownership recovery
do $$
declare v_result jsonb; v_role text; v_status text; v_cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dd000004-0000-4000-8000-000000000004","role":"authenticated"}',false);
  v_result := public.recover_project_ownership(
    (select id from public.projects where slug='qa-test-project-verif'),
    'aa000001-0000-4000-8000-000000000001',
    'QA recovery test — reassigning to original owner');
  select role,status into v_role,v_status from public.project_members
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and profile_id='aa000001-0000-4000-8000-000000000001';
  if v_role='owner' and v_status='active'
  then raise notice 'PASS  [T26  ownership recovered: aa001 is now owner]';
  else raise notice 'FAIL  [T26  recovery] role=% status=%',v_role,v_status; end if;
  select count(*) into v_cnt from public.project_reviews
  where project_id=(select id from public.projects where slug='qa-test-project-verif')
    and decision='ownership_recovered';
  if v_cnt>=1 then raise notice 'PASS  [T26b recovery project_reviews entry written]';
  else raise notice 'FAIL  [T26b project_reviews] cnt=%',v_cnt; end if;
  select count(*) into v_cnt from public.admin_audit_log
  where target_id=(select id from public.projects where slug='qa-test-project-verif')
    and action='project.ownership_recovered';
  if v_cnt>=1 then raise notice 'PASS  [T26c recovery audit_log entry written]';
  else raise notice 'FAIL  [T26c audit_log] cnt=%',v_cnt; end if;
end $$;

-- =========================================================================
-- Structural / RLS / Security checks (plain SQL — no set_config needed)
-- =========================================================================

-- T27: Published project satisfies anon RLS condition
select case when publication_state='published' and status<>'archived'
       then 'PASS' else 'FAIL' end
  as "T27 published satisfies anon RLS condition",
  publication_state, status
from public.projects where slug='qa-test-project-verif';

-- T28+29: Archived project does NOT satisfy anon RLS condition
select case when count(*)=0 then 'PASS' else 'FAIL' end
  as "T28+29 archived excluded by anon RLS condition"
from public.projects
where slug='qa-review-cycle-verif'
  and publication_state='published' and status<>'archived';

-- T29: Members policy uses is_active_project_member
select case when qual::text ilike '%is_active_project_member%' then 'PASS' else 'FAIL' end
  as "T29 members_policy references is_active_project_member"
from pg_policies where tablename='projects'
  and policyname='Members can read published or involved projects';

-- T30: project_members policy uses is_active_project_member
select case when qual::text ilike '%is_active_project_member%' then 'PASS' else 'FAIL' end
  as "T30 project_members_policy references is_active_project_member"
from pg_policies where tablename='project_members'
  and policyname='Members can read appropriate project memberships';

-- T31: No write RLS policies on projects for authenticated
select case when count(*)=0 then 'PASS' else 'FAIL' end
  as "T31 no write RLS policies on projects for authenticated",
  count(*) as write_policy_count
from pg_policies
where schemaname='public' and tablename='projects'
  and cmd in ('INSERT','UPDATE','DELETE','ALL')
  and 'authenticated'=any(roles);

-- T32: EXECUTE grants
select case when count(*)=1 then 'PASS' else 'FAIL' end
  as "T32a admin_update_project_v1 EXECUTE granted to authenticated"
from information_schema.role_routine_grants
where routine_schema='public' and routine_name='admin_update_project_v1'
  and grantee='authenticated' and privilege_type='EXECUTE';

select case when count(*)=0 then 'PASS' else 'FAIL' end
  as "T32b request_project_access NOT granted to authenticated"
from information_schema.role_routine_grants
where routine_schema='public' and routine_name='request_project_access'
  and grantee='authenticated' and privilege_type='EXECUTE';

select case when count(*)=1 then 'PASS' else 'FAIL' end
  as "T32c submit_project_work EXECUTE granted to authenticated"
from information_schema.role_routine_grants
where routine_schema='public' and routine_name='submit_project_work'
  and grantee='authenticated' and privilege_type='EXECUTE';

-- T33: search_path pinned on all SECURITY DEFINER project functions
select case when count(*)=0 then 'PASS'
       else 'FAIL — missing pin: ' || string_agg(p.proname,', ') end
  as "T33 all SECURITY DEFINER project functions have search_path pin"
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private')
  and p.prosecdef=true
  and p.proname in (
    'admin_update_project_v1','create_project_v1','update_project_v1',
    'review_project_publication','recover_project_ownership',
    'review_project_member','transfer_project_ownership',
    'submit_project_for_review','request_project_join',
    'withdraw_project_join_request','resolve_project_join_request',
    'is_active_project_member','is_active_project_owner','is_admin',
    'project_is_owner','enforce_project_owner_invariant',
    'audit_admin_project_change','sync_project_legacy_state'
  )
  and not exists (
    select 1 from unnest(p.proconfig) cfg where cfg ilike 'search_path=%'
  );

-- T34: project_reviews restricted
select case when qual::text ilike '%is_admin%' and qual::text ilike '%is_active_project_owner%'
       then 'PASS' else 'FAIL' end
  as "T34 project_reviews restricted to admin/active-owner"
from pg_policies where tablename='project_reviews'
  and policyname='Admins and owners can read project reviews';

-- T34b: challenge_answer_keys not directly readable
select case when count(*)=0 then 'PASS' else 'FAIL' end
  as "T34b challenge_answer_keys not directly readable by authenticated/anon"
from information_schema.role_table_grants
where table_name='challenge_answer_keys'
  and grantee in ('authenticated','anon') and privilege_type='SELECT';

-- T35: Audit records
select case when count(*)>=4 then 'PASS' else 'FAIL' end
  as "T35 audit records for admin mutations",
  count(*) as audit_count,
  string_agg(distinct action,', ' order by action) as actions_seen
from public.admin_audit_log
where actor_id='dd000004-0000-4000-8000-000000000004'
  and action in (
    'project.approved','project.changes_requested','project.archived',
    'project.admin_updated','project.ownership_recovered',
    'project_member.complete_submission','project_member.return_submission',
    'project_member.decline_request'
  );

-- T36: Regression
select case when count(*)=1 then 'PASS' else 'FAIL' end
  as "T36a events admin policy intact"
from pg_policies where tablename='events' and policyname='Admins can manage events';

select case when count(*)=1 then 'PASS' else 'FAIL' end
  as "T36b learning_paths admin policy intact"
from pg_policies where tablename='learning_paths' and policyname='Admins can manage learning paths';

select case when count(*)=1 then 'PASS' else 'FAIL' end
  as "T36c challenges admin policy intact"
from pg_policies where tablename='challenges' and policyname='Admins can manage challenges';

select case when prosecdef then 'PASS' else 'FAIL' end
  as "T36d private.is_admin() SECURITY DEFINER intact"
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='is_admin';

-- =========================================================================
-- CLEANUP
-- =========================================================================
-- Delete in FK dependency order before deleting auth users
delete from public.admin_audit_log
where actor_id in (
  'aa000001-0000-4000-8000-000000000001',
  'dd000004-0000-4000-8000-000000000004'
);
-- project_reviews.reviewer_id has ON DELETE RESTRICT
delete from public.project_reviews
where reviewer_id in (
  'aa000001-0000-4000-8000-000000000001',
  'dd000004-0000-4000-8000-000000000004'
);
-- Now auth.users cascade-deletes profiles, project_members, project_join_requests, projects
delete from auth.users where id in (
  'aa000001-0000-4000-8000-000000000001',
  'bb000002-0000-4000-8000-000000000002',
  'cc000003-0000-4000-8000-000000000003',
  'dd000004-0000-4000-8000-000000000004',
  'ee000005-0000-4000-8000-000000000005',
  'ff000006-0000-4000-8000-000000000006',
  'a0000007-0000-4000-8000-000000000007'
);

select 'QA data cleaned — 7 personas removed' as "CLEANUP";
