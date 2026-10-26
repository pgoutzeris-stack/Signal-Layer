-- Waechter fuer die Tagesmail: laeuft eine halbe Stunde nach dem Versand,
-- unabhaengig von Edge Function und Resend. Findet er keinen Versand im
-- Protokoll oder einen Resend-Fehler, legt er eine Intranet-Benachrichtigung
-- fuer Pano an, mit den letzten Logs im meta-Feld.
create or replace function signal_layer.pruefe_tagesmail()
returns text
language plpgsql
security definer
set search_path = signal_layer, public
as $$
declare
  empfaenger uuid;
  seit timestamptz := date_trunc('day', now()) + interval '6 hours 25 minutes';
  versand int;
  fehler text;
  cron_lauf jsonb;
  antworten jsonb;
  titel text;
  text_ text;
begin
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
    where r.created between seit and seit + interval '10 minutes'
      -- Nur die Antwort auf send_signal_digest oder Fehler, nicht die anderen Cron-Aufrufe.
      and (r.content::text ~ '"(sent|ergebnis|error)"' or coalesce(r.status_code, 0) <> 200 or r.error_msg is not null)
    order by r.created limit 5) r;

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

revoke all on function signal_layer.pruefe_tagesmail() from public, anon, authenticated;

select cron.schedule('signal-layer-tagesmail-waechter', '0 7 * * *', 'select signal_layer.pruefe_tagesmail()');
