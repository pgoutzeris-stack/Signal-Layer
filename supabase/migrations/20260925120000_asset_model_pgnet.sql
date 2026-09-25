-- DeepSeek denkt bei reasoning_effort "high" bis zu fuenf Minuten. Ein
-- Edge-Isolat lebt im Free-Plan 150 Sekunden und nimmt den offenen Aufruf mit.
-- Der Aufruf laeuft deshalb ueber pg_net in der Datenbank: Edge-Isolate fragen
-- das Ergebnis nur noch ab und duerfen dazwischen sterben.

create table if not exists signal_layer.asset_model_calls (
  request_id bigint primary key,
  asset_id uuid not null references signal_layer.generated_assets(id) on delete cascade,
  call text not null check (call in ('entwurf', 'reparatur')),
  attempt integer not null default 1,
  model text not null,
  timeout_ms integer not null,
  body jsonb,
  created_at timestamptz not null default now(),
  flight_started_at timestamptz,
  waiter text,
  waiter_seen_at timestamptz,
  claimed_by text,
  claimed_at timestamptz,
  claims integer not null default 0,
  done_at timestamptz,
  outcome text
);

comment on table signal_layer.asset_model_calls is
  'Offene Modellaufrufe des Asset Studios ueber pg_net. body wird beim Abschluss geleert, der Schluessel liegt nur in net.http_request_queue.';

create index if not exists asset_model_calls_asset_idx
  on signal_layer.asset_model_calls (asset_id, created_at desc);

create index if not exists asset_model_calls_open_idx
  on signal_layer.asset_model_calls (created_at)
  where done_at is null;

alter table signal_layer.asset_model_calls enable row level security;

-- Ereignisse fuer run_log: Array oder einzelnes Objekt, ohne Zeitstempel
-- bekommen sie den Abstand zu created_at des Assets in Millisekunden.
create or replace function signal_layer.asset_log_events(p_events jsonb, p_t bigint)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    case when x.e ? 't' then x.e else jsonb_build_object('t', p_t) || x.e end
    order by x.n
  ), '[]'::jsonb)
  from jsonb_array_elements(
    case jsonb_typeof(p_events)
      when 'array' then p_events
      when 'object' then jsonb_build_array(p_events)
      else '[]'::jsonb
    end
  ) with ordinality as x(e, n)
  where jsonb_typeof(x.e) = 'object';
$$;

create or replace function signal_layer.start_asset_model_call(
  p_asset_id uuid,
  p_call text,
  p_attempt integer,
  p_model text,
  p_body jsonb,
  p_timeout_ms integer,
  p_events jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_key text;
  v_timeout integer := least(greatest(coalesce(p_timeout_ms, 600000), 30000), 900000);
  v_attempt integer := greatest(coalesce(p_attempt, 1), 1);
  v_request_id bigint;
  v_t bigint;
begin
  if p_call is null or p_call not in ('entwurf', 'reparatur') then
    raise exception 'Unbekannter Modellaufruf: %', p_call;
  end if;
  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    raise exception 'Der Modellaufruf braucht einen JSON-Body.';
  end if;

  select a.created_at into v_created_at
  from signal_layer.generated_assets a
  where a.id = p_asset_id and a.status = 'running'
  for update;
  if not found then
    return null;
  end if;

  v_key := shared.get_api_key('signal_layer_deepseek_api_key');
  if coalesce(v_key, '') = '' then
    raise exception 'Der API-Schlüssel für DeepSeek fehlt im Supabase Vault.';
  end if;

  v_request_id := net.http_post(
    url := 'https://api.deepseek.com/chat/completions',
    body := p_body,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    timeout_milliseconds := v_timeout
  );

  insert into signal_layer.asset_model_calls (request_id, asset_id, call, attempt, model, timeout_ms, body)
  values (v_request_id, p_asset_id, p_call, v_attempt, coalesce(nullif(p_model, ''), 'deepseek'), v_timeout, p_body);

  v_t := floor(extract(epoch from (clock_timestamp() - v_created_at)) * 1000)::bigint;
  update signal_layer.generated_assets a
  set run_log = coalesce(a.run_log, '[]'::jsonb)
        || signal_layer.asset_log_events(p_events, v_t)
        || jsonb_build_array(jsonb_build_object(
          't', v_t, 'event', 'model_call', 'call', p_call, 'request_id', v_request_id,
          'attempt', v_attempt, 'timeout_ms', v_timeout
        )),
      stage = 'modell',
      updated_at = now(),
      duration_ms = v_t::integer
  where a.id = p_asset_id;

  return v_request_id;
end;
$$;

-- Neuer Anlauf mit demselben Body. Der alte Aufruf ist damit erledigt, auch
-- wenn pg_net seine Antwort spaeter noch ablegt.
create or replace function signal_layer.retry_asset_model_call(
  p_request_id bigint,
  p_events jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call signal_layer.asset_model_calls%rowtype;
begin
  select * into v_call
  from signal_layer.asset_model_calls c
  where c.request_id = p_request_id
  for update;
  if not found or v_call.done_at is not null or v_call.body is null then
    return null;
  end if;

  update signal_layer.asset_model_calls c
  set done_at = now(), outcome = 'retry', body = null
  where c.request_id = p_request_id;

  begin
    delete from net._http_response r where r.id = p_request_id;
  exception when others then
    null;
  end;

  return signal_layer.start_asset_model_call(
    v_call.asset_id, v_call.call, v_call.attempt + 1, v_call.model,
    v_call.body, v_call.timeout_ms, p_events
  );
end;
$$;

-- Zustand eines Aufrufs fuer genau einen Wartenden:
--   done     bereits abgeschlossen
--   gone     Asset laeuft nicht mehr
--   busy     ein anderer Wartender fragt gerade ab
--   pending  pg_net wartet oder ist unterwegs (in_flight, flight_ms)
--   lost     weder in der Warteschlange noch als Antwort vorhanden
--   claimed  Antwort liegt vor, ein anderer Wartender verarbeitet sie
--   ready    Antwort liegt vor und gehoert jetzt diesem Wartenden
create or replace function signal_layer.poll_asset_model_call(
  p_request_id bigint,
  p_waiter text,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call signal_layer.asset_model_calls%rowtype;
  v_status text;
  v_asset_created timestamptz;
  v_updated timestamptz;
  v_now timestamptz := clock_timestamp();
  v_age bigint;
  v_flight bigint := 0;
  v_xmax text;
  v_in_flight boolean := false;
  v_batch_start timestamptz;
  v_resp record;
  v_waiter text := coalesce(nullif(p_waiter, ''), 'anonym');
begin
  select * into v_call
  from signal_layer.asset_model_calls c
  where c.request_id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('state', 'unknown', 'request_id', p_request_id);
  end if;

  v_age := floor(extract(epoch from (v_now - v_call.created_at)) * 1000)::bigint;
  if v_call.done_at is not null then
    return jsonb_build_object(
      'state', 'done', 'outcome', v_call.outcome, 'request_id', p_request_id,
      'asset_id', v_call.asset_id, 'call', v_call.call, 'attempt', v_call.attempt
    );
  end if;

  select a.status, a.created_at, a.updated_at into v_status, v_asset_created, v_updated
  from signal_layer.generated_assets a
  where a.id = v_call.asset_id;
  if not found or v_status <> 'running' then
    update signal_layer.asset_model_calls c
    set done_at = now(), outcome = 'gone', body = null
    where c.request_id = p_request_id;
    return jsonb_build_object('state', 'gone', 'request_id', p_request_id, 'asset_id', v_call.asset_id);
  end if;

  if v_call.waiter is not null and v_call.waiter <> v_waiter
     and v_call.waiter_seen_at > v_now - interval '25 seconds' then
    return jsonb_build_object(
      'state', 'busy', 'request_id', p_request_id, 'asset_id', v_call.asset_id,
      'waiter', v_call.waiter, 'age_ms', v_age
    );
  end if;

  update signal_layer.asset_model_calls c
  set waiter = v_waiter, waiter_seen_at = v_now
  where c.request_id = p_request_id;

  -- Herzschlag fuer die Oberflaeche und die Haengeerkennung.
  if v_updated is null or v_updated < v_now - interval '8 seconds' then
    update signal_layer.generated_assets a
    set updated_at = now(),
        duration_ms = floor(extract(epoch from (v_now - v_asset_created)) * 1000)::integer
    where a.id = v_call.asset_id and a.status = 'running';
  end if;

  -- pg_net loescht die Zeile der Warteschlange in derselben Transaktion, in
  -- der es die Antwort ablegt. Solange sie sichtbar ist, liegt noch keine
  -- Antwort vor; xmax mit gehaltener Sperre heisst: der Stapel laeuft.
  select q.xmax::text into v_xmax
  from net.http_request_queue q
  where q.id = p_request_id;
  if found then
    v_in_flight := v_xmax <> '0' and exists (
      select 1 from pg_catalog.pg_locks l
      where l.locktype = 'transactionid' and l.transactionid::text = v_xmax
    );
    if v_in_flight and v_call.flight_started_at is null then
      select min(s.xact_start) into v_batch_start
      from pg_catalog.pg_stat_activity s
      where s.backend_type like 'pg_net%';
      v_call.flight_started_at := greatest(v_call.created_at, coalesce(v_batch_start, v_now));
      update signal_layer.asset_model_calls c
      set flight_started_at = v_call.flight_started_at
      where c.request_id = p_request_id;
    end if;
    if v_call.flight_started_at is not null then
      v_flight := floor(extract(epoch from (v_now - v_call.flight_started_at)) * 1000)::bigint;
    end if;
    return jsonb_build_object(
      'state', 'pending', 'request_id', p_request_id, 'asset_id', v_call.asset_id,
      'in_flight', v_in_flight, 'age_ms', v_age, 'flight_ms', v_flight,
      'timeout_ms', v_call.timeout_ms, 'call', v_call.call, 'attempt', v_call.attempt
    );
  end if;

  if v_call.flight_started_at is not null then
    v_flight := floor(extract(epoch from (v_now - v_call.flight_started_at)) * 1000)::bigint;
  end if;

  select r.status_code, r.timed_out, r.error_msg, r.content into v_resp
  from net._http_response r
  where r.id = p_request_id;
  if not found then
    return jsonb_build_object(
      'state', 'lost', 'request_id', p_request_id, 'asset_id', v_call.asset_id,
      'age_ms', v_age, 'flight_ms', v_flight, 'timeout_ms', v_call.timeout_ms,
      'call', v_call.call, 'attempt', v_call.attempt
    );
  end if;

  if v_call.claimed_by is not null and v_call.claimed_by <> v_waiter
     and v_call.claimed_at > v_now - make_interval(secs => greatest(coalesce(p_lease_seconds, 90), 10)) then
    return jsonb_build_object(
      'state', 'claimed', 'request_id', p_request_id, 'asset_id', v_call.asset_id,
      'claimed_by', v_call.claimed_by, 'age_ms', v_age
    );
  end if;

  update signal_layer.asset_model_calls c
  set claimed_by = v_waiter, claimed_at = v_now, claims = c.claims + 1
  where c.request_id = p_request_id;

  return jsonb_build_object(
    'state', 'ready', 'request_id', p_request_id, 'asset_id', v_call.asset_id,
    'status_code', v_resp.status_code, 'timed_out', coalesce(v_resp.timed_out, false),
    'error_msg', v_resp.error_msg, 'content', v_resp.content,
    'claims', v_call.claims + 1, 'age_ms', v_age, 'flight_ms', v_flight,
    'call', v_call.call, 'attempt', v_call.attempt, 'model', v_call.model,
    'timeout_ms', v_call.timeout_ms
  );
end;
$$;

-- Schliesst einen Aufruf genau einmal ab und schreibt Protokoll, Stufe,
-- Status und Tokens atomar. Nur der erste Aufrufer bekommt die Zeile zurueck.
create or replace function signal_layer.settle_asset_model_call(
  p_request_id bigint,
  p_outcome text,
  p_events jsonb default '[]'::jsonb,
  p_fields jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call signal_layer.asset_model_calls%rowtype;
  v_status text;
  v_created_at timestamptz;
  v_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  v_t bigint;
  v_row jsonb;
begin
  select * into v_call
  from signal_layer.asset_model_calls c
  where c.request_id = p_request_id
  for update;
  if not found or v_call.done_at is not null then
    return null;
  end if;

  select a.status, a.created_at into v_status, v_created_at
  from signal_layer.generated_assets a
  where a.id = v_call.asset_id
  for update;
  if not found or v_status <> 'running' then
    update signal_layer.asset_model_calls c
    set done_at = now(), outcome = 'gone', body = null
    where c.request_id = p_request_id;
    return null;
  end if;

  if (v_fields ->> 'status') is not null and (v_fields ->> 'status') not in ('running', 'done', 'error') then
    raise exception 'Unbekannter Status: %', v_fields ->> 'status';
  end if;

  v_t := floor(extract(epoch from (clock_timestamp() - v_created_at)) * 1000)::bigint;
  update signal_layer.generated_assets a
  set run_log = coalesce(a.run_log, '[]'::jsonb) || signal_layer.asset_log_events(p_events, v_t),
      stage = coalesce(v_fields ->> 'stage', a.stage),
      status = coalesce(v_fields ->> 'status', a.status),
      error_message = case when v_fields ? 'error_message' then v_fields ->> 'error_message' else a.error_message end,
      input_tokens = coalesce((v_fields ->> 'input_tokens')::integer, a.input_tokens),
      cached_input_tokens = coalesce((v_fields ->> 'cached_input_tokens')::integer, a.cached_input_tokens),
      output_tokens = coalesce((v_fields ->> 'output_tokens')::integer, a.output_tokens),
      thinking_tokens = coalesce((v_fields ->> 'thinking_tokens')::integer, a.thinking_tokens),
      total_tokens = coalesce((v_fields ->> 'total_tokens')::integer, a.total_tokens),
      updated_at = now(),
      duration_ms = v_t::integer
  where a.id = v_call.asset_id
  returning jsonb_build_object(
    'id', a.id, 'created_by', a.created_by, 'kind', a.kind, 'article_id', a.article_id,
    'status', a.status, 'error_message', a.error_message, 'stage', a.stage
  ) into v_row;

  update signal_layer.asset_model_calls c
  set done_at = now(), outcome = coalesce(nullif(p_outcome, ''), 'ok'), body = null
  where c.request_id = p_request_id;

  -- Die Antwort steht jetzt im Protokoll; pg_net muss sie nicht sechs
  -- Stunden aufbewahren.
  begin
    delete from net._http_response r where r.id = p_request_id;
  exception when others then
    null;
  end;

  return v_row;
end;
$$;

-- Haengt Ereignisse an das Protokoll eines laufenden Assets, ohne den Rest
-- des Protokolls zu ueberschreiben.
create or replace function signal_layer.append_asset_log(
  p_asset_id uuid,
  p_events jsonb,
  p_stage text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update signal_layer.generated_assets a
  set run_log = coalesce(a.run_log, '[]'::jsonb) || signal_layer.asset_log_events(
        p_events, floor(extract(epoch from (clock_timestamp() - a.created_at)) * 1000)::bigint
      ),
      stage = coalesce(p_stage, a.stage),
      updated_at = now(),
      duration_ms = floor(extract(epoch from (clock_timestamp() - a.created_at)) * 1000)::integer
  where a.id = p_asset_id and a.status = 'running';
  return found;
end;
$$;

revoke all on table signal_layer.asset_model_calls from public, anon, authenticated;
revoke all on function signal_layer.asset_log_events(jsonb, bigint) from public, anon, authenticated;
revoke all on function signal_layer.start_asset_model_call(uuid, text, integer, text, jsonb, integer, jsonb) from public, anon, authenticated;
revoke all on function signal_layer.retry_asset_model_call(bigint, jsonb) from public, anon, authenticated;
revoke all on function signal_layer.poll_asset_model_call(bigint, text, integer) from public, anon, authenticated;
revoke all on function signal_layer.settle_asset_model_call(bigint, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function signal_layer.append_asset_log(uuid, jsonb, text) from public, anon, authenticated;
grant all on table signal_layer.asset_model_calls to service_role;
grant execute on function signal_layer.asset_log_events(jsonb, bigint) to service_role;
grant execute on function signal_layer.start_asset_model_call(uuid, text, integer, text, jsonb, integer, jsonb) to service_role;
grant execute on function signal_layer.retry_asset_model_call(bigint, jsonb) to service_role;
grant execute on function signal_layer.poll_asset_model_call(bigint, text, integer) to service_role;
grant execute on function signal_layer.settle_asset_model_call(bigint, text, jsonb, jsonb) to service_role;
grant execute on function signal_layer.append_asset_log(uuid, jsonb, text) to service_role;
