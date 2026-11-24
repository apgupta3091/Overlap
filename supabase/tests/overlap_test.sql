begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Helpers -------------------------------------------------------------------------------------
-- One range JSON (buildSchedule shape) starting at p_start with p_slots half-hour slots.
create function pg_temp.range_json(p_date text, p_start timestamptz, p_slots int, p_sort int default 0) returns jsonb
language sql as $$
  select jsonb_build_object(
    'originalLocalDate', p_date,
    'startAt', overlap.iso(p_start),
    'endAt', overlap.iso(p_start + p_slots * interval '30 minutes'),
    'slots', (select jsonb_agg(jsonb_build_object(
        'startAt', overlap.iso(p_start + i * interval '30 minutes'),
        'endAt', overlap.iso(p_start + (i + 1) * interval '30 minutes'),
        'sortOrder', p_sort + i) order by i)
      from generate_series(0, p_slots - 1) as i))
$$;

create function pg_temp.make_event(p_public_id text, p_ranges jsonb, p_expires timestamptz) returns uuid
language sql as $$
  select overlap.create_event(p_public_id, 'Study group', null, 'Priya', 'America/New_York', 60, null,
    sha256('admin'::bytea), p_expires, p_ranges, '2027-05-01T12:00:00Z')
$$;

create function pg_temp.slot_ids(p_public_id text) returns uuid[]
language sql as $$
  select array_agg(s.id order by s.sort_order) from overlap.event_slots s join overlap.events e on e.id = s.event_id where e.public_id = p_public_id
$$;

-- Fixture: two ranges (4 slots on May 4 at 13:00Z, 2 slots on May 5 at 22:00Z); expiry = last end + 30d.
select lives_ok($$ select pg_temp.make_event('EVENTAAAAA',
  jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 4), pg_temp.range_json('2027-05-05', '2027-05-05T22:00:00Z', 2, 4)),
  '2027-06-04T23:00:00Z') $$, 'create_event accepts a valid schedule');
select lives_ok($$ select pg_temp.make_event('EVENTBBBBB', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-06-03T14:00:00Z') $$,
  'a second event can reuse the same times');

-- Schema & privileges -------------------------------------------------------------------------
select has_schema('overlap');
select tables_are('overlap', array['events', 'event_ranges', 'event_slots', 'responses', 'response_slots']);
select ok(bool_and(c.relrowsecurity), 'RLS is enabled on every overlap table')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'overlap' and c.relkind = 'r';
select is((select count(*)::int from pg_policies where schemaname = 'overlap'), 0, 'no RLS policies (nobody but the service role gets in)');

select ok(not has_schema_privilege(r, 'overlap', 'usage'), r || ' has no usage on schema overlap')
  from unnest(array['anon', 'authenticated', 'public']) as r where r <> 'public';
select ok(not has_table_privilege(r, 'overlap.' || t, p), format('%s cannot %s overlap.%s', r, p, t))
  from unnest(array['anon', 'authenticated']) as r,
       unnest(array['events', 'event_ranges', 'event_slots', 'responses', 'response_slots']) as t,
       unnest(array['select', 'insert', 'update', 'delete']) as p;
select ok(not has_function_privilege(r, p.oid, 'execute'), format('%s cannot execute overlap.%s', r, p.proname))
  from unnest(array['anon', 'authenticated']) as r, pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'overlap';
select ok(has_function_privilege('service_role', 'overlap.submit_response(text,uuid,bytea,text,boolean,uuid[],uuid[],timestamptz)', 'execute'),
  'service_role can execute submit_response');
select ok(has_table_privilege('service_role', 'overlap.events', 'select'), 'service_role can read events');

set local role anon;
select throws_ok($$ select overlap.get_event('EVENTAAAAA') $$, '42501', null, 'anon is refused at the schema');
select throws_ok($$ select * from overlap.events $$, '42501', null, 'anon cannot read events');
reset role;
set local role authenticated;
select throws_ok($$ select overlap.get_event('EVENTAAAAA') $$, '42501', null, 'authenticated is refused at the schema');
reset role;

-- create_event validation ---------------------------------------------------------------------
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC', '[]'::jsonb, '2027-06-04T00:00:00Z') $$, 'P0001', 'invalid', 'needs at least one range');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC',
    (select jsonb_agg(pg_temp.range_json('2027-05-0' || d, ('2027-05-0' || d || 'T13:00:00Z')::timestamptz, 2, d * 2)) from generate_series(1, 8) d),
    '2027-06-08T14:00:00Z') $$, 'P0001', 'invalid', 'at most 7 ranges');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC',
    jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 4) || '{"endAt":"2027-05-04T16:00:00Z"}'),
    '2027-06-03T16:00:00Z') $$, 'P0001', 'invalid', 'a range must be fully tiled by its slots');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 1)), '2027-06-03T13:30:00Z') $$,
  'P0001', 'invalid', 'a range shorter than the meeting is rejected');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-06-10T00:00:00Z') $$,
  'P0001', 'invalid', 'expiry must be last end + 30 days');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T06:00:00Z', 26)), '2027-06-03T19:00:00Z') $$,
  '23514', null, 'ranges longer than 12 hours violate a check');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:05:00Z', 2)), '2027-06-03T14:05:00Z') $$,
  '23514', null, 'off-grid times violate a check');
select throws_ok($$ select pg_temp.make_event('EVENTCCCCC', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2), pg_temp.range_json('2027-05-04', '2027-05-04T18:00:00Z', 2, 2)), '2027-06-03T19:00:00Z') $$,
  '23505', null, 'duplicate dates are rejected');
select throws_ok($$ select pg_temp.make_event('bad id!', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-06-03T14:00:00Z') $$,
  '23514', null, 'public ids must be base62');
select throws_ok($$ select pg_temp.make_event('EVENTAAAAA', jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-06-03T14:00:00Z') $$,
  '23505', null, 'public ids are unique');
select throws_ok($$ select overlap.create_event('EVENTCCCCC', '  padded ', null, 'Priya', 'UTC', 60, null, sha256('a'::bytea), '2027-06-03T14:00:00Z',
    jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-05-01T12:00:00Z') $$,
  '23514', null, 'titles must be trimmed');
select throws_ok($$ select overlap.create_event('EVENTCCCCC', 'Ok', null, 'Priya', 'UTC', 45, null, sha256('a'::bytea), '2027-06-03T14:00:00Z',
    jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-05-01T12:00:00Z') $$,
  '23514', null, 'meeting length must be 30/60/90/120');
select throws_ok($$ select overlap.create_event('EVENTCCCCC', 'Ok', null, 'Priya', 'UTC', 60, null, 'short'::bytea, '2027-06-03T14:00:00Z',
    jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T13:00:00Z', 2)), '2027-05-01T12:00:00Z') $$,
  '23514', null, 'token hashes must be 32 bytes');
select is((select count(*)::int from overlap.events where public_id = 'EVENTCCCCC'), 0, 'failed creates leave nothing behind');
select lives_ok($$ select overlap.create_event('EVENTNEPAL', 'Kathmandu', null, 'Priya', 'Asia/Kathmandu', 60, null, sha256('a'::bytea), '2027-06-03T05:15:00Z',
    jsonb_build_array(pg_temp.range_json('2027-05-04', '2027-05-04T03:15:00Z', 4)), '2027-05-01T12:00:00Z') $$,
  'quarter-hour UTC slots (local half-hours in +05:45) are accepted');

-- submit_response -----------------------------------------------------------------------------
create temporary table r1 as
  select * from overlap.submit_response('EVENTAAAAA', null, sha256('edit1'::bytea), 'Sam', false,
    array[(pg_temp.slot_ids('EVENTAAAAA'))[1], (pg_temp.slot_ids('EVENTAAAAA'))[2]], array[(pg_temp.slot_ids('EVENTAAAAA'))[3]], '2027-05-02T10:00:00Z');
select is((select created from r1), true, 'a new response is created');
select is((select response_revision from r1), 1, 'starting at revision 1');
select is((select count(*)::int from overlap.response_slots where response_id = (select response_id from r1)), 3, 'its availability is stored');
select is((select revision from overlap.events where public_id = 'EVENTAAAAA'), 2, 'the event revision is bumped');

select throws_ok(format($$ select * from overlap.submit_response('EVENTAAAAA', %L, sha256('wrong'::bytea), 'Sam', true, null, null, '2027-05-02T11:00:00Z') $$, (select response_id from r1)),
  'P0001', 'forbidden', 'editing needs the right token');
select throws_ok($$ select * from overlap.submit_response('EVENTAAAAA', gen_random_uuid(), sha256('edit1'::bytea), 'Sam', true, null, null, '2027-05-02T11:00:00Z') $$,
  'P0001', 'forbidden', 'an unknown response id is forbidden, not created');
select throws_ok(format($$ select * from overlap.submit_response('EVENTBBBBB', %L, sha256('edit1'::bytea), 'Sam', true, null, null, '2027-05-02T11:00:00Z') $$, (select response_id from r1)),
  'P0001', 'forbidden', 'a response cannot be edited through another event');

create temporary table r1b as
  select * from overlap.submit_response('EVENTAAAAA', (select response_id from r1), sha256('edit1'::bytea), 'Samantha', false,
    array[(pg_temp.slot_ids('EVENTAAAAA'))[5]], null, '2027-05-02T12:00:00Z');
select is((select created from r1b), false, 'updating does not create');
select is((select response_revision from r1b), 2, 'updating bumps the response revision');
select is((select array_agg(slot_id) from overlap.response_slots where response_id = (select response_id from r1)), array[(pg_temp.slot_ids('EVENTAAAAA'))[5]],
  'updating replaces the availability');
select is((select display_name from overlap.responses where id = (select response_id from r1)), 'Samantha', 'and the name');

select throws_ok($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('x'::bytea), 'Ben', false, null, null) $$, 'P0001', 'invalid', 'empty submissions are rejected');
select throws_ok(format($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('x'::bytea), 'Ben', true, array[%L::uuid], null) $$, (pg_temp.slot_ids('EVENTAAAAA'))[1]),
  'P0001', 'invalid', 'none-work with times is rejected');
select throws_ok(format($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('x'::bytea), 'Ben', false, array[%L::uuid], array[%L::uuid]) $$,
    (pg_temp.slot_ids('EVENTAAAAA'))[1], (pg_temp.slot_ids('EVENTAAAAA'))[1]),
  'P0001', 'invalid', 'a slot cannot be both available and preferred');
select throws_ok(format($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('x'::bytea), 'Ben', false, array[%L::uuid], null) $$, (pg_temp.slot_ids('EVENTBBBBB'))[1]),
  'P0001', 'invalid', 'slots from another event are rejected');
select throws_ok($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('x'::bytea), ' Ben', true, null, null) $$, '23514', null, 'names must be trimmed');
select throws_ok($$ select * from overlap.submit_response('NOSUCHEVENT', null, sha256('x'::bytea), 'Ben', true, null, null) $$, 'P0001', 'not_found', 'unknown events');
select throws_ok($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('x'::bytea), 'Ben', true, null, null, '2027-07-01T00:00:00Z') $$,
  'P0001', 'not_found', 'expired events read as missing');

-- Cross-event availability is impossible even with a direct insert.
select throws_ok(format($$ insert into overlap.response_slots (response_id, event_id, slot_id, state)
    select %L, e.id, %L, 'available' from overlap.events e where e.public_id = 'EVENTAAAAA' $$, (select response_id from r1), (pg_temp.slot_ids('EVENTBBBBB'))[1]),
  '23503', null, 'composite FKs block cross-event slots');

-- The 50-response cap.
select lives_ok($$ select count(*) from generate_series(1, 49) i,
    lateral overlap.submit_response('EVENTAAAAA', null, sha256(('t' || i)::bytea), 'P' || i, true, null, null) $$, 'responses up to the cap are accepted');
select is((select count(*)::int from overlap.responses r join overlap.events e on e.id = r.event_id where e.public_id = 'EVENTAAAAA'), 50, '50 responses stored');
select throws_ok($$ select * from overlap.submit_response('EVENTAAAAA', null, sha256('late'::bytea), 'Late', true, null, null) $$, 'P0001', 'limit_reached', 'the 51st is refused');
select lives_ok(format($$ select * from overlap.submit_response('EVENTAAAAA', %L, sha256('edit1'::bytea), 'Sam', true, null, null) $$, (select response_id from r1)),
  'existing responses can still be edited at the cap');

-- Closed events.
update overlap.events set status = 'finalized', final_start_at = '2027-05-04T13:00:00Z', final_end_at = '2027-05-04T14:00:00Z' where public_id = 'EVENTBBBBB';
select throws_ok($$ select * from overlap.submit_response('EVENTBBBBB', null, sha256('x'::bytea), 'Ben', true, null, null) $$, 'P0001', 'closed', 'finalized events reject responses');
select throws_ok($$ update overlap.events set status = 'finalized', final_start_at = null where public_id = 'EVENTNEPAL' $$, '23514', null, 'finalized requires a final time');

-- get_event -----------------------------------------------------------------------------------
select is(overlap.get_event('NOSUCHEVENT'), null, 'unknown events return null');
select is(overlap.get_event('EVENTAAAAA', '2027-07-01T00:00:00Z'), null, 'expired events return null');
select is(jsonb_typeof(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z') -> 'responses'), 'array', 'snapshot has responses');
select is((select array_agg(k order by k) from jsonb_object_keys(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z') -> 'event') as k),
  array['createdAt', 'description', 'durationMinutes', 'expectedParticipants', 'expiresAt', 'finalEndAt', 'finalStartAt', 'organizerName', 'publicId', 'ranges',
        'revision', 'slots', 'status', 'timezone', 'title', 'updatedAt'],
  'event keys match the OverlapEvent type exactly (no hashes, no internal id)');
select is((select array_agg(k order by k) from jsonb_object_keys(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z') -> 'responses' -> 0) as k),
  array['createdAt', 'displayName', 'id', 'noneWork', 'revision', 'slots', 'updatedAt'], 'response keys match ParticipantResponse (no token hash)');
select is(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z') -> 'event' -> 'slots' -> 0 ->> 'startAt', '2027-05-04T13:00:00Z', 'instants are canonical ISO UTC');
select is(jsonb_array_length(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z') -> 'event' -> 'slots'), 6, 'all slots, in sort order');
select is(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z') -> 'event' -> 'ranges' -> 1 ->> 'originalLocalDate', '2027-05-05', 'local dates are YYYY-MM-DD');
select ok(overlap.get_event('EVENTAAAAA', '2027-05-02T00:00:00Z')::text !~ 'hash', 'nothing hash-like in the snapshot');

-- Lifecycle -----------------------------------------------------------------------------------
select is(overlap.delete_expired_events('2027-06-04T00:00:00Z'), 2, 'expired events are deleted (B and Nepal expire on Jun 3)');
select is((select count(*)::int from overlap.event_slots s join overlap.events e on e.id = s.event_id where e.public_id = 'EVENTAAAAA'), 6, 'live events are kept');
select is(overlap.delete_expired_events('2027-06-05T00:00:00Z'), 1, 'then A');
select is((select count(*)::int from overlap.responses), 0, 'responses cascade');
select is((select count(*)::int from overlap.response_slots), 0, 'response slots cascade');
select is((select count(*)::int from overlap.event_slots), 0, 'slots cascade');

select * from finish();
rollback;
