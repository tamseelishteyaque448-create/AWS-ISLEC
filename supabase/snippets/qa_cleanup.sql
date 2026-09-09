-- Remove any stale QA auth users from prior runs
delete from auth.users where email like '%@islec.test';
select 'stale QA data removed' as cleanup_status;
