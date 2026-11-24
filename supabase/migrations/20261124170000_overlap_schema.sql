-- Overlap schema (Chunk 7).
--
-- Access model: the browser never talks to these tables. Everything lives in the private `overlap`
-- schema, which is NOT in the API's exposed schemas, and anon/authenticated get no privileges at all.
-- Only the Edge Function (Chunk 8) reaches it, over a direct Postgres connection. RLS is enabled with
-- no policies as defense in depth.
--
-- Validation is layered: the Edge Function runs the shared TypeScript domain rules (schedule, limits,
-- availability parsing); these constraints and functions repeat the invariants that must never break
-- even if the function has a bug. Raw tokens never reach the database: only SHA-256 hashes.
--
-- Errors raised by the functions use SQLSTATE P0001 with a machine-readable MESSAGE:
--   not_found | closed | forbidden | limit_reached | invalid   (DETAIL has a human explanation)

create schema overlap;
revoke all on schema overlap from public;

-- Canonical "YYYY-MM-DDTHH:MM:SSZ" (matches the domain's ISO instants).
create function overlap.iso(ts timestamptz) returns text
language sql immutable parallel safe set search_path = ''
as $$ select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

-- True when a timestamp is on a 15-minute UTC boundary. Slots start on 30-minute *local* boundaries in
-- the event's timezone; every IANA offset is a multiple of 15 minutes (e.g. Nepal +05:45), so those
-- always land on 15-minute UTC boundaries. The exact 30-minute local grid is checked in TypeScript.
create function overlap.on_quarter_hour(ts timestamptz) returns boolean
language sql immutable parallel safe set search_path = ''
as $$ select extract(epoch from ts)::numeric % 900 = 0 $$;

-- A display label: trimmed, non-empty, no control characters.
create function overlap.is_clean_label(value text, max_len int) returns boolean
language sql immutable parallel safe set search_path = ''
as $$ select value = btrim(value) and char_length(value) between 1 and max_len and value !~ '[[:cntrl:]]' $$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table overlap.events (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^[A-Za-z0-9]{10,32}$'),
  title text not null check (overlap.is_clean_label(title, 100)),
  description text check (description is null or (char_length(description) between 1 and 500 and description = btrim(description))),
  organizer_name text not null check (overlap.is_clean_label(organizer_name, 40)),
  timezone text not null check (char_length(timezone) between 1 and 64),
  duration_minutes int not null check (duration_minutes in (30, 60, 90, 120)),
  expected_participants int check (expected_participants between 2 and 50),
  status text not null default 'open' check (status in ('open', 'finalized')),
  final_start_at timestamptz,
  final_end_at timestamptz,
  admin_token_hash bytea not null check (octet_length(admin_token_hash) = 32),
  -- Bumped on every change to the event or its responses; lets clients poll cheaply (Chunk 9).
  revision int not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint final_time_matches_status check (
    (status = 'open' and final_start_at is null and final_end_at is null)
    or (status = 'finalized' and final_start_at is not null and final_end_at > final_start_at)
  ),
  constraint expires_after_creation check (expires_at > created_at)
);
create index events_expires_at_idx on overlap.events (expires_at);

create table overlap.event_ranges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references overlap.events (id) on delete cascade,
  original_local_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  constraint range_order check (end_at > start_at),
  constraint range_max_12h check (end_at - start_at <= interval '12 hours'),
  constraint range_boundaries check (overlap.on_quarter_hour(start_at) and overlap.on_quarter_hour(end_at)),
  unique (event_id, original_local_date),
  unique (id, event_id)
);

create table overlap.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  range_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  sort_order int not null check (sort_order >= 0),
  constraint slot_is_30_minutes check (end_at = start_at + interval '30 minutes'),
  constraint slot_boundary check (overlap.on_quarter_hour(start_at)),
  -- A slot's range must belong to the same event.
  foreign key (range_id, event_id) references overlap.event_ranges (id, event_id) on delete cascade,
  foreign key (event_id) references overlap.events (id) on delete cascade,
  unique (event_id, sort_order),
  unique (event_id, start_at),
  unique (id, event_id)
);
create index event_slots_range_idx on overlap.event_slots (range_id);

create table overlap.responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references overlap.events (id) on delete cascade,
  display_name text not null check (overlap.is_clean_label(display_name, 40)),
  none_work boolean not null default false,
  edit_token_hash bytea not null check (octet_length(edit_token_hash) = 32),
  revision int not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create index responses_event_idx on overlap.responses (event_id, created_at);

create table overlap.response_slots (
  response_id uuid not null,
  event_id uuid not null,
  slot_id uuid not null,
  state text not null check (state in ('available', 'preferred')),
  primary key (response_id, slot_id),
  -- Both the response and the slot must belong to the same event: no cross-event availability.
  foreign key (response_id, event_id) references overlap.responses (id, event_id) on delete cascade,
  foreign key (slot_id, event_id) references overlap.event_slots (id, event_id) on delete cascade
);
create index response_slots_slot_idx on overlap.response_slots (slot_id);

alter table overlap.events enable row level security;
alter table overlap.event_ranges enable row level security;
alter table overlap.event_slots enable row level security;
alter table overlap.responses enable row level security;
alter table overlap.response_slots enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Functions (each runs in one transaction, so multi-row writes are atomic)
-- ---------------------------------------------------------------------------------------------

create function overlap.fail(code text, detail text) returns void
language plpgsql set search_path = ''
as $$ begin raise exception using errcode = 'P0001', message = code, detail = detail; end $$;

/**
 * Create an event with its ranges and slots. `p_ranges` is the `ranges` array produced by the shared
 * `buildSchedule` (camelCase: originalLocalDate, startAt, endAt, slots[{startAt, endAt, sortOrder}]).
 * Returns the event's internal id.
 */
create function overlap.create_event(
  p_public_id text,
  p_title text,
  p_description text,
  p_organizer_name text,
  p_timezone text,
  p_duration_minutes int,
  p_expected_participants int,
  p_admin_token_hash bytea,
  p_expires_at timestamptz,
  p_ranges jsonb,
  p_now timestamptz default now()
) returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_event_id uuid;
  v_range jsonb;
  v_range_id uuid;
  v_bad int;
begin
  if jsonb_typeof(p_ranges) is distinct from 'array' or jsonb_array_length(p_ranges) not between 1 and 7 then
    perform overlap.fail('invalid', 'An event needs 1 to 7 date ranges.');
  end if;

  insert into overlap.events (public_id, title, description, organizer_name, timezone, duration_minutes,
                              expected_participants, admin_token_hash, created_at, updated_at, expires_at)
  values (p_public_id, p_title, p_description, p_organizer_name, p_timezone, p_duration_minutes,
          p_expected_participants, p_admin_token_hash, p_now, p_now, p_expires_at)
  returning id into v_event_id;

  for v_range in select value from jsonb_array_elements(p_ranges) loop
    insert into overlap.event_ranges (event_id, original_local_date, start_at, end_at)
    values (v_event_id, (v_range ->> 'originalLocalDate')::date, (v_range ->> 'startAt')::timestamptz, (v_range ->> 'endAt')::timestamptz)
    returning id into v_range_id;

    insert into overlap.event_slots (event_id, range_id, start_at, end_at, sort_order)
    select v_event_id, v_range_id, (s ->> 'startAt')::timestamptz, (s ->> 'endAt')::timestamptz, (s ->> 'sortOrder')::int
    from jsonb_array_elements(coalesce(v_range -> 'slots', '[]'::jsonb)) as s;
  end loop;

  -- Every range must be exactly tiled by its slots, and at least as long as the meeting.
  select count(*) into v_bad
  from overlap.event_ranges r
  where r.event_id = v_event_id
    and (
      (select count(*) from overlap.event_slots s where s.range_id = r.id) * interval '30 minutes' <> r.end_at - r.start_at
      or exists (select 1 from overlap.event_slots s where s.range_id = r.id and (s.start_at < r.start_at or s.end_at > r.end_at))
      or r.end_at - r.start_at < make_interval(mins => p_duration_minutes)
    );
  if v_bad > 0 then
    perform overlap.fail('invalid', 'Each range must be covered exactly by 30-minute slots and fit the meeting length.');
  end if;

  -- Expiry is 30 days after the last range ends.
  if p_expires_at <> (select max(end_at) from overlap.event_ranges where event_id = v_event_id) + interval '30 days' then
    perform overlap.fail('invalid', 'expires_at must be 30 days after the last range ends.');
  end if;

  return v_event_id;
end
$$;

/**
 * Create (p_response_id null) or update a response, replacing its availability atomically.
 * Locks the event row, so the 50-response cap holds under concurrent submissions.
 */
create function overlap.submit_response(
  p_public_id text,
  p_response_id uuid,
  p_edit_token_hash bytea,
  p_display_name text,
  p_none_work boolean,
  p_available uuid[],
  p_preferred uuid[],
  p_now timestamptz default now()
) returns table (response_id uuid, response_revision int, created boolean)
language plpgsql set search_path = ''
as $$
declare
  v_event overlap.events%rowtype;
  v_resp overlap.responses%rowtype;
  v_ids uuid[] := coalesce(p_available, '{}') || coalesce(p_preferred, '{}');
  v_n int := cardinality(coalesce(p_available, '{}') || coalesce(p_preferred, '{}'));
begin
  select * into v_event from overlap.events where public_id = p_public_id for update;
  if not found or v_event.expires_at <= p_now then
    perform overlap.fail('not_found', 'This event doesn''t exist.');
  end if;
  if v_event.status <> 'open' then
    perform overlap.fail('closed', 'This event is no longer collecting availability.');
  end if;

  if p_none_work and v_n > 0 then
    perform overlap.fail('invalid', 'A "none of these times work" response can''t include times.');
  end if;
  if not coalesce(p_none_work, false) and v_n = 0 then
    perform overlap.fail('invalid', 'Mark at least one time, or choose "none of these times work".');
  end if;
  if (select count(distinct x) from unnest(v_ids) as x) <> v_n or array_position(v_ids, null) is not null then
    perform overlap.fail('invalid', 'Each time can be marked only once.');
  end if;
  if (select count(*) from overlap.event_slots s where s.event_id = v_event.id and s.id = any (v_ids)) <> v_n then
    perform overlap.fail('invalid', 'Some times don''t belong to this event.');
  end if;

  if p_response_id is null then
    if (select count(*) from overlap.responses r where r.event_id = v_event.id) >= 50 then
      perform overlap.fail('limit_reached', 'This event already has 50 responses, the maximum.');
    end if;
    insert into overlap.responses (event_id, display_name, none_work, edit_token_hash, created_at, updated_at)
    values (v_event.id, p_display_name, p_none_work, p_edit_token_hash, p_now, p_now)
    returning * into v_resp;
  else
    select * into v_resp from overlap.responses r where r.id = p_response_id and r.event_id = v_event.id for update;
    if not found or v_resp.edit_token_hash is distinct from p_edit_token_hash then
      perform overlap.fail('forbidden', 'This response can only be edited from the browser that submitted it.');
    end if;
    update overlap.responses r
    set display_name = p_display_name, none_work = p_none_work, revision = r.revision + 1, updated_at = p_now
    where r.id = v_resp.id
    returning * into v_resp;
    delete from overlap.response_slots rs where rs.response_id = v_resp.id;
  end if;

  insert into overlap.response_slots (response_id, event_id, slot_id, state)
  select v_resp.id, v_event.id, x, 'available' from unnest(coalesce(p_available, '{}')) as x
  union all
  select v_resp.id, v_event.id, x, 'preferred' from unnest(coalesce(p_preferred, '{}')) as x;

  update overlap.events e set revision = e.revision + 1, updated_at = p_now where e.id = v_event.id;

  return query select v_resp.id, v_resp.revision, p_response_id is null;
end
$$;

/**
 * The client-safe snapshot ({ event, responses }) in the exact shape of the domain types.
 * Never includes token hashes or internal ids. Expired events read as missing (null).
 */
create function overlap.get_event(p_public_id text, p_now timestamptz default now()) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'publicId', e.public_id,
      'title', e.title,
      'description', e.description,
      'organizerName', e.organizer_name,
      'timezone', e.timezone,
      'durationMinutes', e.duration_minutes,
      'expectedParticipants', e.expected_participants,
      'status', e.status,
      'finalStartAt', overlap.iso(e.final_start_at),
      'finalEndAt', overlap.iso(e.final_end_at),
      'revision', e.revision,
      'createdAt', overlap.iso(e.created_at),
      'updatedAt', overlap.iso(e.updated_at),
      'expiresAt', overlap.iso(e.expires_at),
      'ranges', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'originalLocalDate', r.original_local_date::text,
          'startAt', overlap.iso(r.start_at), 'endAt', overlap.iso(r.end_at)
        ) order by r.start_at), '[]'::jsonb)
        from overlap.event_ranges r where r.event_id = e.id
      ),
      'slots', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id, 'rangeId', s.range_id,
          'startAt', overlap.iso(s.start_at), 'endAt', overlap.iso(s.end_at), 'sortOrder', s.sort_order
        ) order by s.sort_order), '[]'::jsonb)
        from overlap.event_slots s where s.event_id = e.id
      )
    ),
    'responses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'displayName', r.display_name,
        'noneWork', r.none_work,
        'revision', r.revision,
        'createdAt', overlap.iso(r.created_at),
        'updatedAt', overlap.iso(r.updated_at),
        'slots', (
          select coalesce(jsonb_object_agg(rs.slot_id::text, rs.state), '{}'::jsonb)
          from overlap.response_slots rs where rs.response_id = r.id
        )
      ) order by r.created_at, r.id), '[]'::jsonb)
      from overlap.responses r where r.event_id = e.id
    )
  )
  from overlap.events e
  where e.public_id = p_public_id and e.expires_at > p_now
$$;

/** Lifecycle: delete events past their expiry (cascades to everything else). Scheduled in Chunk 12. */
create function overlap.delete_expired_events(p_now timestamptz default now()) returns int
language sql set search_path = ''
as $$
  with gone as (delete from overlap.events where expires_at <= p_now returning 1)
  select count(*)::int from gone
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: nothing for anon/authenticated; the service role (and the owner) only.
-- ---------------------------------------------------------------------------------------------

revoke all on all tables in schema overlap from public, anon, authenticated;
revoke all on all functions in schema overlap from public, anon, authenticated;
revoke all on all sequences in schema overlap from public, anon, authenticated;
alter default privileges in schema overlap revoke all on tables from public, anon, authenticated;
alter default privileges in schema overlap revoke all on functions from public, anon, authenticated;

grant usage on schema overlap to service_role;
grant select, insert, update, delete on all tables in schema overlap to service_role;
grant execute on all functions in schema overlap to service_role;
