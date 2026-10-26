-- Tagesmail erst, wenn die Nacht fertig ist. Bisher fest um 6:30 UTC; die
-- Analyse lief an mehreren Tagen bis 9:50 Ortszeit, die Mail kam dann ohne
-- die spaeten Signale. Jetzt: alle zehn Minuten pruefen, senden sobald der
-- Crawl der Nacht fertig ist und die Analyse zwanzig Minuten ruht.
-- Spaetestens um 10:00 Ortszeit geht sie trotzdem raus.

create table if not exists signal_layer.tagesmail_status (
  tag date primary key,
  gesendet_at timestamptz not null default now(),
  grund text not null
);
alter table signal_layer.tagesmail_status enable row level security;

create or replace function signal_layer.tagesmail_pruefen()
returns text
language plpgsql
security definer
set search_path = signal_layer, public
as $$
declare
  ortszeit timestamp := now() at time zone 'Europe/Berlin';
  heute date := ortszeit::date;
  mitternacht timestamptz := heute::timestamp at time zone 'Europe/Berlin';
  crawl record;
  letzte_analyse timestamptz;
  laeuft boolean;
  bereit boolean;
  frist boolean := ortszeit::time >= time '10:00';
begin
  if ortszeit::time < time '04:00' then return 'zu frueh'; end if;
  if exists (select 1 from signal_layer.tagesmail_status where tag = heute) then return 'schon gesendet'; end if;

  select status, started_at, finished_at into crawl from signal_layer.crawl_runs
    where started_at >= mitternacht order by started_at desc limit 1;
  select exists (select 1 from signal_layer.simple_runs where status = 'running') into laeuft;
  select max(finished_at) into letzte_analyse from signal_layer.simple_runs where started_at >= mitternacht;

  bereit := coalesce(crawl.status in ('done', 'error')
    and not laeuft
    and greatest(coalesce(letzte_analyse, crawl.finished_at), crawl.finished_at) < now() - interval '20 minutes', false);
  if not bereit and not frist then return 'wartet'; end if;

  insert into signal_layer.tagesmail_status (tag, grund) values (heute, case when bereit then 'bereit' else 'frist 10:00' end);
  perform net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', shared.get_api_key('signal_layer_cron_secret')),
    body := jsonb_build_object('action','send_signal_digest','taeglich',true,'days',1,
      'to', jsonb_build_array('pgoutzeris@roots-consultants.com'),
      'debug_to','pgoutzeris@roots-consultants.com'),
    timeout_milliseconds := 120000);
  return case when bereit then 'gesendet' else 'gesendet (Frist)' end;
end;
$$;
revoke all on function signal_layer.tagesmail_pruefen() from public, anon, authenticated;

select cron.unschedule('signal-layer-tagesmail');
select cron.schedule('signal-layer-tagesmail', '*/10 2-9 * * *', 'select signal_layer.tagesmail_pruefen()');

-- Waechter: nach der Frist pruefen, Fenster ab Mitternacht Ortszeit.
create or replace function signal_layer.pruefe_tagesmail()
returns text
language plpgsql
security definer
set search_path = signal_layer, public
as $$
declare
  empfaenger uuid;
  seit timestamptz := (now() at time zone 'Europe/Berlin')::date::timestamp at time zone 'Europe/Berlin';
  versand int;
  fehler text;
  cron_lauf jsonb;
  antworten jsonb;
  titel text;
  text_ text;
begin
  if (now() at time zone 'Europe/Berlin')::time < time '10:20' then return 'zu frueh'; end if;
  if exists (select 1 from recruiting.notifications where type = 'signal_layer_mail' and created_at >= seit) then return 'heute schon gemeldet'; end if;
  select id into empfaenger from users.profiles where lower(email) = 'pgoutzeris@roots-consultants.com';
  if empfaenger is null then return 'kein Empfaenger'; end if;

  select count(*), string_agg(left(error, 300), ' | ') filter (where error is not null)
    into versand, fehler
    from signal_layer.signal_digest_log where sent_at >= seit;

  if versand > 0 and fehler is null then return 'ok'; end if;

  select to_jsonb(d) into cron_lauf from (
    select d.status, d.return_message, d.start_time, d.end_time
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = 'signal-layer-tagesmail' order by d.start_time desc limit 1) d;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into antworten from (
    select r.id, r.status_code, r.timed_out, r.error_msg, left(r.content::text, 500) as content, r.created
    from net._http_response r
    where r.created >= seit
      and (r.content::text ~ '"(sent|ergebnis)"' or r.error_msg is not null)
    order by r.created desc limit 5) r;

  if versand = 0 then
    titel := 'Tagesmail nicht verschickt';
    text_ := 'Heute steht kein Versand im Protokoll. Cron: '
      || coalesce(cron_lauf->>'status', 'kein Lauf') || '. Antwort der Edge Function: '
      || coalesce((select string_agg(coalesce(a->>'status_code', 'keine') || coalesce(' ' || nullif(a->>'error_msg', ''), ''), ', ') from jsonb_array_elements(antworten) a), 'keine') || '.';
  else
    titel := 'Tagesmail: Resend-Fehler';
    text_ := 'Resend hat den Versand abgelehnt: ' || left(fehler, 300);
  end if;

  insert into recruiting.notifications (user_id, type, title, message, meta)
  values (empfaenger, 'signal_layer_mail', titel, text_,
    jsonb_build_object('tool_id', 'signal-layer', 'cron', cron_lauf, 'antworten', antworten, 'resend_fehler', fehler));
  return titel;
end;
$$;

select cron.unschedule('signal-layer-tagesmail-waechter');
select cron.schedule('signal-layer-tagesmail-waechter', '*/20 8-10 * * *', 'select signal_layer.pruefe_tagesmail()');

-- Heute ist schon verschickt worden.
insert into signal_layer.tagesmail_status (tag, grund) values ((now() at time zone 'Europe/Berlin')::date, 'vor Umstellung') on conflict do nothing;
