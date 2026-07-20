create table if not exists signal_layer.browser_source_discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references signal_layer.sources(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (source_id)
);

alter table signal_layer.browser_source_discovery_jobs enable row level security;
revoke all on table signal_layer.browser_source_discovery_jobs from public, anon, authenticated;
grant all on table signal_layer.browser_source_discovery_jobs to service_role;

create index if not exists browser_source_discovery_claim_idx
  on signal_layer.browser_source_discovery_jobs (status, created_at)
  where status in ('queued', 'running');

create or replace function signal_layer.claim_browser_source_discovery_jobs(p_limit integer default 4)
returns setof signal_layer.browser_source_discovery_jobs
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select id from signal_layer.browser_source_discovery_jobs
    where attempts < 3 and (
      status = 'queued' or (status = 'running' and started_at < now() - interval '2 hours')
    )
    order by created_at for update skip locked
    limit greatest(1, least(coalesce(p_limit, 4), 8))
  )
  update signal_layer.browser_source_discovery_jobs job
  set status='running', attempts=job.attempts+1, started_at=now(), finished_at=null,
      updated_at=now(), last_error=null
  from picked where job.id=picked.id returning job.*;
$$;

revoke all on function signal_layer.claim_browser_source_discovery_jobs(integer) from public, anon, authenticated;
grant execute on function signal_layer.claim_browser_source_discovery_jobs(integer) to service_role;

-- Prefer public sitemaps where the newsroom landing page itself returns 403.
update signal_layer.sources set feed_type='sitemap', feed_url='https://www.carrefour.com/sitemap.xml'
where company='Carrefour';
update signal_layer.sources set feed_type='sitemap', feed_url='https://www.meininger.de/sitemap.xml'
where company='Getränke Zeitung';
update signal_layer.sources set feed_type='sitemap', feed_url='https://www.nestle.de/sitemap.xml'
where company='Nestlé Deutschland';
update signal_layer.sources set feed_type='sitemap', feed_url='https://www.unilever.de/sitemap.xml'
where company='Unilever Deutschland';

-- Correct current public newsroom entry points for JavaScript-heavy sources.
update signal_layer.sources set url='https://www.haleon.com/news', feed_type='crawler', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.haleon.com/news"}'::jsonb
where company='Haleon Deutschland';
update signal_layer.sources set url='https://www.messe-stuttgart.de/suedback/news/newsroom/meldungen/', feed_type='crawler', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.messe-stuttgart.de/suedback/news/newsroom/meldungen/","require_tier1":false,"require_topic_signal":false}'::jsonb
where company='südback';
update signal_layer.sources set url='https://www.messe-stuttgart.de/sueffa/news/newsroom/meldungen/', feed_type='crawler', feed_url=null,
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.messe-stuttgart.de/sueffa/news/newsroom/meldungen/","require_tier1":false,"require_topic_signal":false}'::jsonb
where company='Süffa';
update signal_layer.sources set feed_type='sitemap', feed_url='https://www.muellergroup.com/sitemap.xml',
  crawl_config=coalesce(crawl_config,'{}'::jsonb)||'{"recommended_entry_url":"https://www.muellergroup.com/"}'::jsonb
where company='Unternehmensgruppe Theo Müller';

-- Statista's public category page is discoverable, but article-level research
-- requires a subscription. Make that explicit in Sources and Status.
update signal_layer.sources set crawl_config=coalesce(crawl_config,'{}'::jsonb)||jsonb_build_object(
  'login_required',true,'paywall_detected',true,'paywall_credentials_missing',true,
  'paywall_access_status','credentials_required'
) where company='Statista – Konsum & FMCG';

-- Seed browser discovery for sources whose listing page is blocked or rendered
-- client-side. The same queue is refreshed automatically on future empty crawls.
insert into signal_layer.browser_source_discovery_jobs(source_id,status)
select id,'queued' from signal_layer.sources
where active=true and company in (
  'Aldi Süd','Barry Callebaut Group','BCG Consumer Products Insights','BCG Retail Insights',
  'Campaign (UK)','Investec Advisory – Food & Beverage/Consumer M&A','Marketing Week (UK)',
  'METRO Deutschland GmbH','Penny','XXXLutz-Gruppe','adidas','Haleon Deutschland','südback','Süffa'
) on conflict(source_id) do update set status='queued',attempts=0,last_error=null,started_at=null,finished_at=null,updated_at=now();
