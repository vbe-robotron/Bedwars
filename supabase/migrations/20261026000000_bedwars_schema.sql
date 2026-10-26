-- BedWars Ultimate: tables, RLS and RPCs
-- Apply with: supabase db push
-- Requirements: enable Anonymous Sign-Ins in Authentication > Providers.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.bw_lobby (
  lobby_id text not null default 'main',
  uid text not null,
  name text not null default 'Player',
  is_host boolean not null default false,
  is_spectator boolean not null default false,
  team_mode integer not null default 2,
  game_started boolean not null default false,
  assignments jsonb not null default '{}'::jsonb,
  map_theme text not null default 'grassland',
  match_id text,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (lobby_id, uid)
);

create table if not exists public.bw_matches (
  match_id text primary key,
  lobby_id text not null default 'main',
  host_uid text not null,
  status text not null default 'running',
  team_mode integer not null default 2,
  map_theme text not null default 'grassland',
  map_seed integer not null default 0,
  map_version integer not null default 2,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.bw_players (
  match_id text not null,
  uid text not null,
  name text not null default 'P',
  team text not null default 'Blue',
  x double precision not null default 0,
  y double precision not null default 65,
  z double precision not null default 0,
  hp double precision not null default 20,
  max_hp double precision not null default 20,
  bed boolean not null default true,
  alive boolean not null default true,
  state text not null default 'normal',
  is_sneaking boolean not null default false,
  is_sprinting boolean not null default false,
  is_jumping boolean not null default false,
  is_falling boolean not null default false,
  kills integer not null default 0,
  last_seen timestamptz not null default now(),
  skin text not null default '',
  yaw double precision not null default 0,
  pitch double precision not null default 0,
  head_yaw double precision not null default 0,
  head_pitch double precision not null default 0,
  held_item text not null default '',
  held_item_count integer not null default 0,
  inventory jsonb not null default '[]'::jsonb,
  hotbar jsonb not null default '[]'::jsonb,
  armor jsonb not null default '{}'::jsonb,
  velocity_x double precision not null default 0,
  velocity_y double precision not null default 0,
  velocity_z double precision not null default 0,
  action_animation text not null default '',
  action_animation_until bigint not null default 0,
  attack_animation_until bigint not null default 0,
  bot_profile text not null default '',
  bot_skin text not null default '',
  skin_model text not null default 'classic',
  primary key (match_id, uid)
);

create table if not exists public.bw_blocks (
  match_id text not null,
  x integer not null,
  y integer not null,
  z integer not null,
  type text not null default '',
  team text not null default '',
  uid text not null default '',
  action text not null default 'place',
  ts timestamptz not null default now(),
  primary key (match_id, x, y, z)
);

create table if not exists public.bw_beds (
  match_id text not null,
  team text not null,
  has_bed boolean not null default true,
  destroyed_by text not null default '',
  uid text not null default '',
  destroyed_at timestamptz,
  ts timestamptz not null default now(),
  primary key (match_id, team)
);

create table if not exists public.bw_chat (
  id bigserial primary key,
  lobby_id text not null default 'main',
  match_id text,
  scope text not null default 'battle',
  team text not null default '',
  uid text not null default '',
  name text not null default 'Player',
  msg text not null default '',
  color text not null default '#ffffff',
  pc_id text not null default '',
  ts timestamptz not null default now()
);

create table if not exists public.bw_damage (
  id bigserial primary key,
  match_id text not null,
  to_uid text not null,
  from_uid text not null,
  amount numeric not null default 0,
  type text not null default 'melee',
  ts timestamptz not null default now()
);

create table if not exists public.bw_action_events (
  id bigserial primary key,
  match_id text not null,
  uid text not null,
  action_type text not null default 'action',
  item_type text not null default '',
  x double precision,
  y double precision,
  z double precision,
  yaw double precision,
  pitch double precision,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bw_drops (
  drop_id text primary key,
  match_id text not null,
  item_type text not null,
  amount integer not null default 1,
  x double precision not null default 0,
  y double precision not null default 0,
  z double precision not null default 0,
  owner_uid text not null,
  state text not null default 'ground',
  picked_by text,
  picked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bw_history (
  uid text primary key,
  name text not null default 'Player',
  kills integer not null default 0,
  wins integer not null default 0,
  level integer not null default 1,
  skin text not null default '',
  last_match_id text,
  last_seen timestamptz not null default now()
);

create table if not exists public.bw_friends (
  uid text not null,
  target_uid text not null,
  target_name text not null default '',
  status text not null default 'accepted',
  ts timestamptz not null default now(),
  primary key (uid, target_uid)
);

create table if not exists public.bw_settings (
  key text primary key,
  value text not null
);

create table if not exists public.bw_training_records (
  uid text not null,
  course_id text not null,
  type text not null default '',
  score_ms integer not null default 0,
  attempts integer not null default 0,
  best_ms integer not null default 0,
  last_ms integer not null default 0,
  completed_count integer not null default 0,
  deaths integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (uid, course_id)
);

create index if not exists bw_lobby_last_seen_idx on public.bw_lobby (lobby_id, last_seen desc);
create index if not exists bw_players_last_seen_idx on public.bw_players (match_id, last_seen desc);
create index if not exists bw_blocks_match_idx on public.bw_blocks (match_id);
create index if not exists bw_chat_scope_idx on public.bw_chat (lobby_id, scope, ts);
create index if not exists bw_chat_match_idx on public.bw_chat (match_id, ts);
create index if not exists bw_damage_target_idx on public.bw_damage (match_id, to_uid, ts);
create index if not exists bw_drops_match_idx on public.bw_drops (match_id, state);
create index if not exists bw_action_events_match_idx on public.bw_action_events (match_id, created_at);
create index if not exists bw_history_kills_idx on public.bw_history (kills desc, wins desc);

insert into public.bw_settings (key, value) values
  ('syncInterval', '480'),
  ('blockInterval', '800'),
  ('bedInterval', '2000'),
  ('dmgInterval', '500'),
  ('chatInterval', '3000')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.bw_in_match(p_match_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.bw_players
    where match_id = p_match_id
      and uid = auth.uid()::text
      and last_seen > now() - interval '30 seconds'
  );
$$;

revoke all on function public.bw_in_match(text) from public, anon;
grant execute on function public.bw_in_match(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Lobby RPCs (all writes go through these functions)
-- ---------------------------------------------------------------------------

create or replace function public.bw_claim_lobby_host(p_lobby_id text, p_name text default 'Player')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_has_host boolean;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_lobby_id)::bigint);

  insert into public.bw_lobby (lobby_id, uid, name, is_host, is_spectator, joined_at, last_seen)
  values (p_lobby_id, v_uid, left(coalesce(p_name, 'Player'), 64), false, false, now(), now())
  on conflict (lobby_id, uid) do update
    set name = excluded.name,
        is_spectator = false,
        last_seen = now();

  select exists (
    select 1 from public.bw_lobby
    where lobby_id = p_lobby_id
      and is_host
      and last_seen > now() - interval '30 seconds'
  ) into v_has_host;

  if not v_has_host then
    update public.bw_lobby
    set is_host = (uid = v_uid)
    where lobby_id = p_lobby_id;
  end if;
end;
$$;

create or replace function public.bw_reassign_lobby_host(p_lobby_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text;
begin
  if auth.uid() is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_lobby_id)::bigint);

  if exists (
    select 1 from public.bw_lobby
    where lobby_id = p_lobby_id
      and is_host
      and last_seen > now() - interval '30 seconds'
  ) then
    return;
  end if;

  update public.bw_lobby set is_host = false where lobby_id = p_lobby_id;

  select uid into v_uid
  from public.bw_lobby
  where lobby_id = p_lobby_id
    and not is_spectator
    and last_seen > now() - interval '30 seconds'
  order by joined_at asc
  limit 1;

  if v_uid is not null then
    update public.bw_lobby set is_host = true where lobby_id = p_lobby_id and uid = v_uid;
  end if;
end;
$$;

create or replace function public.bw_lobby_poll(p_lobby_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  update public.bw_lobby
  set last_seen = now()
  where lobby_id = p_lobby_id and uid = auth.uid()::text;
  perform public.bw_reassign_lobby_host(p_lobby_id);
end;
$$;

create or replace function public.bw_lobby_spectator(p_lobby_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  update public.bw_lobby
  set is_spectator = true, is_host = false, last_seen = now()
  where lobby_id = p_lobby_id and uid = auth.uid()::text;
  perform public.bw_reassign_lobby_host(p_lobby_id);
end;
$$;

create or replace function public.bw_set_team_mode(p_lobby_id text, p_mode integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.bw_lobby
    where lobby_id = p_lobby_id
      and uid = auth.uid()::text
      and is_host
      and last_seen > now() - interval '30 seconds'
  ) then
    raise exception 'host_required';
  end if;
  update public.bw_lobby
  set team_mode = greatest(2, least(4, p_mode))
  where lobby_id = p_lobby_id and uid = auth.uid()::text;
end;
$$;

create or replace function public.bw_start_match(
  p_lobby_id text,
  p_team_mode integer default 2,
  p_map_theme text default 'grassland',
  p_assignments jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_match_id text;
  v_seed integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_lobby_id)::bigint);

  if not exists (
    select 1 from public.bw_lobby
    where lobby_id = p_lobby_id
      and uid = v_uid
      and is_host
      and last_seen > now() - interval '30 seconds'
  ) then
    raise exception 'host_required';
  end if;

  if exists (
    select 1
    from jsonb_each_text(coalesce(p_assignments, '{}'::jsonb))
    where value not in ('Red', 'Blue', 'Green', 'Yellow')
  ) then
    raise exception 'invalid_assignments';
  end if;

  v_match_id := 'match_' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6);
  v_seed := floor(random() * 2147483647)::integer;

  insert into public.bw_matches (
    match_id, lobby_id, host_uid, status, team_mode, map_theme, map_seed, map_version, started_at
  ) values (
    v_match_id, p_lobby_id, v_uid, 'running', greatest(2, least(4, p_team_mode)),
    left(coalesce(p_map_theme, 'grassland'), 64), v_seed, 2, now()
  );

  update public.bw_lobby
  set team_mode = greatest(2, least(4, p_team_mode)),
      game_started = true,
      assignments = coalesce(p_assignments, '{}'::jsonb),
      map_theme = left(coalesce(p_map_theme, 'grassland'), 64),
      match_id = v_match_id
  where lobby_id = p_lobby_id;

  return jsonb_build_object('ok', true, 'matchId', v_match_id, 'mapSeed', v_seed);
end;
$$;

create or replace function public.bw_leave_lobby(p_lobby_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  delete from public.bw_lobby
  where lobby_id = p_lobby_id and uid = auth.uid()::text;
  perform public.bw_reassign_lobby_host(p_lobby_id);
end;
$$;

create or replace function public.bw_clear_match(p_match_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if exists (
    select 1 from public.bw_players
    where match_id = p_match_id
      and last_seen > now() - interval '15 seconds'
  ) then
    return false;
  end if;

  delete from public.bw_blocks where match_id = p_match_id;
  delete from public.bw_beds where match_id = p_match_id;
  delete from public.bw_damage where match_id = p_match_id;
  delete from public.bw_chat where match_id = p_match_id;
  delete from public.bw_drops where match_id = p_match_id;
  delete from public.bw_action_events where match_id = p_match_id;
  delete from public.bw_players where match_id = p_match_id;
  update public.bw_lobby
  set game_started = false, match_id = null, assignments = '{}'::jsonb
  where match_id = p_match_id;
  delete from public.bw_matches where match_id = p_match_id;
  return true;
end;
$$;

revoke all on function public.bw_claim_lobby_host(text, text) from public, anon;
revoke all on function public.bw_reassign_lobby_host(text) from public, anon;
revoke all on function public.bw_lobby_poll(text) from public, anon;
revoke all on function public.bw_lobby_spectator(text) from public, anon;
revoke all on function public.bw_set_team_mode(text, integer) from public, anon;
revoke all on function public.bw_start_match(text, integer, text, jsonb) from public, anon;
revoke all on function public.bw_leave_lobby(text) from public, anon;
revoke all on function public.bw_clear_match(text) from public, anon;

grant execute on function public.bw_claim_lobby_host(text, text) to authenticated;
grant execute on function public.bw_reassign_lobby_host(text) to authenticated;
grant execute on function public.bw_lobby_poll(text) to authenticated;
grant execute on function public.bw_lobby_spectator(text) to authenticated;
grant execute on function public.bw_set_team_mode(text, integer) to authenticated;
grant execute on function public.bw_start_match(text, integer, text, jsonb) to authenticated;
grant execute on function public.bw_leave_lobby(text) to authenticated;
grant execute on function public.bw_clear_match(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.bw_lobby enable row level security;
alter table public.bw_matches enable row level security;
alter table public.bw_players enable row level security;
alter table public.bw_blocks enable row level security;
alter table public.bw_beds enable row level security;
alter table public.bw_chat enable row level security;
alter table public.bw_damage enable row level security;
alter table public.bw_action_events enable row level security;
alter table public.bw_drops enable row level security;
alter table public.bw_history enable row level security;
alter table public.bw_friends enable row level security;
alter table public.bw_settings enable row level security;
alter table public.bw_training_records enable row level security;

-- Remove any legacy permissive policies before installing the new model.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'bw_lobby', 'bw_matches', 'bw_players', 'bw_blocks', 'bw_beds',
        'bw_chat', 'bw_damage', 'bw_action_events', 'bw_drops',
        'bw_history', 'bw_friends', 'bw_settings', 'bw_training_records'
      )
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$$;

-- Lobby and matches are read-only for clients; writes use the RPCs above.
drop policy if exists bw_lobby_select on public.bw_lobby;
create policy bw_lobby_select on public.bw_lobby
  for select to authenticated using (true);

drop policy if exists bw_matches_select on public.bw_matches;
create policy bw_matches_select on public.bw_matches
  for select to authenticated using (true);

drop policy if exists bw_players_select on public.bw_players;
create policy bw_players_select on public.bw_players
  for select to authenticated
  using (uid = auth.uid()::text or public.bw_in_match(match_id));

drop policy if exists bw_players_insert on public.bw_players;
create policy bw_players_insert on public.bw_players
  for insert to authenticated
  with check (uid = auth.uid()::text);

drop policy if exists bw_players_update on public.bw_players;
create policy bw_players_update on public.bw_players
  for update to authenticated
  using (uid = auth.uid()::text)
  with check (uid = auth.uid()::text);

drop policy if exists bw_players_delete on public.bw_players;
create policy bw_players_delete on public.bw_players
  for delete to authenticated
  using (uid = auth.uid()::text);

drop policy if exists bw_blocks_select on public.bw_blocks;
create policy bw_blocks_select on public.bw_blocks
  for select to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_blocks_insert on public.bw_blocks;
create policy bw_blocks_insert on public.bw_blocks
  for insert to authenticated
  with check (public.bw_in_match(match_id) and uid = auth.uid()::text);

drop policy if exists bw_blocks_update on public.bw_blocks;
create policy bw_blocks_update on public.bw_blocks
  for update to authenticated
  using (public.bw_in_match(match_id))
  with check (public.bw_in_match(match_id) and uid = auth.uid()::text);

drop policy if exists bw_blocks_delete on public.bw_blocks;
create policy bw_blocks_delete on public.bw_blocks
  for delete to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_beds_select on public.bw_beds;
create policy bw_beds_select on public.bw_beds
  for select to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_beds_insert on public.bw_beds;
create policy bw_beds_insert on public.bw_beds
  for insert to authenticated
  with check (public.bw_in_match(match_id) and uid = auth.uid()::text);

drop policy if exists bw_beds_update on public.bw_beds;
create policy bw_beds_update on public.bw_beds
  for update to authenticated
  using (public.bw_in_match(match_id))
  with check (public.bw_in_match(match_id) and uid = auth.uid()::text);

drop policy if exists bw_beds_delete on public.bw_beds;
create policy bw_beds_delete on public.bw_beds
  for delete to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_chat_select on public.bw_chat;
create policy bw_chat_select on public.bw_chat
  for select to authenticated
  using (scope in ('lobby', 'post') or public.bw_in_match(match_id) or uid = auth.uid()::text);

drop policy if exists bw_chat_insert on public.bw_chat;
create policy bw_chat_insert on public.bw_chat
  for insert to authenticated
  with check (uid = auth.uid()::text and (scope in ('lobby', 'post') or public.bw_in_match(match_id)));

drop policy if exists bw_chat_delete on public.bw_chat;
create policy bw_chat_delete on public.bw_chat
  for delete to authenticated using (uid = auth.uid()::text);

drop policy if exists bw_damage_select on public.bw_damage;
create policy bw_damage_select on public.bw_damage
  for select to authenticated
  using (to_uid = auth.uid()::text or from_uid = auth.uid()::text);

drop policy if exists bw_damage_insert on public.bw_damage;
create policy bw_damage_insert on public.bw_damage
  for insert to authenticated
  with check (from_uid = auth.uid()::text and public.bw_in_match(match_id));

drop policy if exists bw_damage_delete on public.bw_damage;
create policy bw_damage_delete on public.bw_damage
  for delete to authenticated using (to_uid = auth.uid()::text);

drop policy if exists bw_action_events_select on public.bw_action_events;
create policy bw_action_events_select on public.bw_action_events
  for select to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_action_events_insert on public.bw_action_events;
create policy bw_action_events_insert on public.bw_action_events
  for insert to authenticated
  with check (uid = auth.uid()::text and public.bw_in_match(match_id));

drop policy if exists bw_drops_select on public.bw_drops;
create policy bw_drops_select on public.bw_drops
  for select to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_drops_insert on public.bw_drops;
create policy bw_drops_insert on public.bw_drops
  for insert to authenticated
  with check (public.bw_in_match(match_id) and owner_uid = auth.uid()::text);

drop policy if exists bw_drops_update on public.bw_drops;
create policy bw_drops_update on public.bw_drops
  for update to authenticated
  using (public.bw_in_match(match_id))
  with check (public.bw_in_match(match_id));

drop policy if exists bw_drops_delete on public.bw_drops;
create policy bw_drops_delete on public.bw_drops
  for delete to authenticated using (public.bw_in_match(match_id));

drop policy if exists bw_history_select on public.bw_history;
create policy bw_history_select on public.bw_history
  for select to authenticated using (true);

drop policy if exists bw_history_insert on public.bw_history;
create policy bw_history_insert on public.bw_history
  for insert to authenticated with check (uid = auth.uid()::text);

drop policy if exists bw_history_update on public.bw_history;
create policy bw_history_update on public.bw_history
  for update to authenticated
  using (uid = auth.uid()::text)
  with check (uid = auth.uid()::text);

drop policy if exists bw_history_delete on public.bw_history;
create policy bw_history_delete on public.bw_history
  for delete to authenticated using (uid = auth.uid()::text);

drop policy if exists bw_friends_select on public.bw_friends;
create policy bw_friends_select on public.bw_friends
  for select to authenticated using (uid = auth.uid()::text);

drop policy if exists bw_friends_insert on public.bw_friends;
create policy bw_friends_insert on public.bw_friends
  for insert to authenticated with check (uid = auth.uid()::text);

drop policy if exists bw_friends_update on public.bw_friends;
create policy bw_friends_update on public.bw_friends
  for update to authenticated
  using (uid = auth.uid()::text)
  with check (uid = auth.uid()::text);

drop policy if exists bw_friends_delete on public.bw_friends;
create policy bw_friends_delete on public.bw_friends
  for delete to authenticated using (uid = auth.uid()::text);

drop policy if exists bw_settings_select on public.bw_settings;
create policy bw_settings_select on public.bw_settings
  for select to authenticated using (true);

drop policy if exists bw_training_records_select on public.bw_training_records;
create policy bw_training_records_select on public.bw_training_records
  for select to authenticated using (uid = auth.uid()::text);

drop policy if exists bw_training_records_insert on public.bw_training_records;
create policy bw_training_records_insert on public.bw_training_records
  for insert to authenticated with check (uid = auth.uid()::text);

drop policy if exists bw_training_records_update on public.bw_training_records;
create policy bw_training_records_update on public.bw_training_records
  for update to authenticated
  using (uid = auth.uid()::text)
  with check (uid = auth.uid()::text);

drop policy if exists bw_training_records_delete on public.bw_training_records;
create policy bw_training_records_delete on public.bw_training_records
  for delete to authenticated using (uid = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Grants (Supabase's default privileges normally handle this; explicit is safer)
-- ---------------------------------------------------------------------------

revoke all on public.bw_lobby, public.bw_matches, public.bw_players, public.bw_blocks,
  public.bw_beds, public.bw_chat, public.bw_damage, public.bw_action_events,
  public.bw_drops, public.bw_history, public.bw_friends, public.bw_settings,
  public.bw_training_records from anon;

grant select on public.bw_lobby, public.bw_matches, public.bw_settings, public.bw_history to authenticated;
grant select, insert, update, delete on public.bw_players, public.bw_blocks, public.bw_beds,
  public.bw_chat, public.bw_damage, public.bw_action_events, public.bw_drops,
  public.bw_friends, public.bw_training_records to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'bw_lobby', 'bw_players', 'bw_blocks', 'bw_beds', 'bw_chat',
    'bw_damage', 'bw_action_events', 'bw_drops'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

alter table public.bw_lobby replica identity full;
alter table public.bw_players replica identity full;
alter table public.bw_blocks replica identity full;
alter table public.bw_beds replica identity full;
alter table public.bw_chat replica identity full;
alter table public.bw_drops replica identity full;
