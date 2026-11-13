-- KI-Budget fuer den Perplexity-Schluessel: 30 $ im Monat.
-- Das Tagesbudget ist der Rest des Monats geteilt durch die verbleibenden
-- Tage. Nicht verbrauchtes Budget wandert so automatisch in die Folgetage.
-- Stufen: ok (alles laeuft), knapp (ab 80 % des Tagesbudgets oder der
-- Tokengrenze nur noch Artikel mit Tier-1-Treffer), aus (Tagesbudget, Tokens
-- oder Monatsbudget erschoepft; offene Artikel warten auf den naechsten Tag).
create table if not exists signal_layer.ki_budget (
  id boolean primary key default true check (id),
  aktiv boolean not null default true,
  monatsbudget_usd numeric not null default 30,
  tagestoken_max integer not null default 600000,
  knapp_ab numeric not null default 0.8,
  updated_at timestamptz not null default now()
);
insert into signal_layer.ki_budget (id) values (true) on conflict do nothing;
alter table signal_layer.ki_budget enable row level security;

create or replace function signal_layer.ki_budget_lage()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'signal_layer', 'public'
as $$
declare
  cfg signal_layer.ki_budget;
  ortszeit timestamp := now() at time zone 'Europe/Berlin';
  heute_start timestamptz := (ortszeit::date)::timestamp at time zone 'Europe/Berlin';
  monat_start timestamptz := date_trunc('month', ortszeit) at time zone 'Europe/Berlin';
  tage_im_monat int := extract(day from (date_trunc('month', ortszeit) + interval '1 month - 1 day'))::int;
  tage_rest int := tage_im_monat - extract(day from ortszeit)::int + 1;
  vor_heute numeric;
  heute numeric;
  token_heute bigint;
  tag_budget numeric;
  stufe text := 'ok';
begin
  select * into cfg from signal_layer.ki_budget where id;
  -- Nur Aufrufe ueber den Perplexity-Schluessel (Modell-IDs mit Anbieterpraefix).
  select
    coalesce(sum(coalesce(estimated_cost_usd, 0) + coalesce(grounding_cost_usd, 0)) filter (where created_at < heute_start), 0),
    coalesce(sum(coalesce(estimated_cost_usd, 0) + coalesce(grounding_cost_usd, 0)) filter (where created_at >= heute_start), 0),
    coalesce(sum(coalesce(total_tokens, 0)) filter (where created_at >= heute_start), 0)
  into vor_heute, heute, token_heute
  from signal_layer.ai_usage_events
  where created_at >= monat_start and model like '%/%';

  tag_budget := greatest(coalesce(cfg.monatsbudget_usd, 30) - vor_heute, 0) / greatest(tage_rest, 1);

  if cfg.aktiv then
    if vor_heute + heute >= cfg.monatsbudget_usd or heute >= tag_budget or token_heute >= cfg.tagestoken_max then
      stufe := 'aus';
    elsif heute >= cfg.knapp_ab * tag_budget or token_heute >= cfg.knapp_ab * cfg.tagestoken_max then
      stufe := 'knapp';
    end if;
  end if;

  return jsonb_build_object(
    'stufe', stufe,
    'aktiv', cfg.aktiv,
    'monatsbudget_usd', cfg.monatsbudget_usd,
    'monat_verbraucht_usd', round(vor_heute + heute, 2),
    'tagesbudget_usd', round(tag_budget, 2),
    'heute_verbraucht_usd', round(heute, 2),
    'tagestoken_max', cfg.tagestoken_max,
    'heute_token', token_heute,
    'tage_rest', tage_rest,
    'offen', (select count(*) from signal_layer.articles a
              where a.crawled_at >= now() - interval '72 hours' and a.url not like 'manual://%'
                and not exists (select 1 from signal_layer.simple_signals s where s.article_id = a.id))
  );
end;
$$;
revoke all on function signal_layer.ki_budget_lage() from public, anon;
grant execute on function signal_layer.ki_budget_lage() to authenticated, service_role;

-- Analyse nach dem Crawl: startet nur bei freiem Budget und holt zurueck-
-- gestellte Artikel der letzten 72 Stunden nach (vorher 30 Stunden).
create or replace function signal_layer.analyse_nach_crawl()
returns text
language plpgsql
security definer
set search_path to 'signal_layer', 'shared', 'net'
as $$
declare
  v_crawl record;
  v_ids jsonb;
begin
  select id, status, started_at into v_crawl
    from signal_layer.crawl_runs order by started_at desc nulls last limit 1;
  if v_crawl is null or v_crawl.status not in ('done', 'error') then return 'crawl laeuft oder fehlt'; end if;
  if exists (select 1 from signal_layer.simple_runs where status in ('running', 'queued')) then return 'lauf aktiv'; end if;
  if signal_layer.ki_budget_lage() ->> 'stufe' <> 'ok' then return 'ki-budget erreicht'; end if;
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids from (
    select a.id from signal_layer.articles a
     where a.crawled_at >= greatest(now() - interval '72 hours', timestamptz '2026-10-14 00:00:00+00')
       and a.url not like 'manual://%'
       and not exists (select 1 from signal_layer.simple_signals s where s.article_id = a.id)
     order by a.crawled_at desc limit 3000
  ) x;
  if jsonb_array_length(v_ids) = 0 then return 'nichts offen'; end if;
  perform net.http_post(
    url := 'https://csmguwcvzreefluhahyu.supabase.co/functions/v1/signal-layer',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', shared.get_api_key('signal_layer_cron_secret')),
    body := jsonb_build_object('action', 'start_simple_run', 'article_ids', v_ids, 'accept_peak', true)
  );
  return 'gestartet ' || jsonb_array_length(v_ids);
end;
$$;
