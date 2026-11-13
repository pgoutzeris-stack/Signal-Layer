-- Einmaliges Monatsbudget: gilt nur fuer den eingetragenen Monat, danach
-- wieder ki_budget.monatsbudget_usd. November 2026: bis 13.11. verbrauchte
-- 31,14 $ plus 30 EUR Aufladung vom 13.11. (Kurs 0,90177 = 33,27 $).
create table if not exists signal_layer.ki_budget_monat (
  monat date primary key check (monat = date_trunc('month', monat)::date),
  budget_usd numeric not null,
  notiz text,
  created_at timestamptz not null default now()
);
alter table signal_layer.ki_budget_monat enable row level security;
insert into signal_layer.ki_budget_monat (monat, budget_usd, notiz)
values ('2026-11-01', 64.41, '31,14 $ bis 13.11. plus 30 EUR Aufladung')
on conflict (monat) do update set budget_usd = excluded.budget_usd, notiz = excluded.notiz;

-- Budget-Lage liest das Monatsbudget aus ki_budget_monat, sonst den Standard.
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
  budget numeric;
begin
  select * into cfg from signal_layer.ki_budget where id;
  select coalesce((select budget_usd from signal_layer.ki_budget_monat where monat = date_trunc('month', ortszeit)::date), cfg.monatsbudget_usd, 30)
    into budget;
  -- Nur Aufrufe ueber den Perplexity-Schluessel (Modell-IDs mit Anbieterpraefix).
  select
    coalesce(sum(coalesce(estimated_cost_usd, 0) + coalesce(grounding_cost_usd, 0)) filter (where created_at < heute_start), 0),
    coalesce(sum(coalesce(estimated_cost_usd, 0) + coalesce(grounding_cost_usd, 0)) filter (where created_at >= heute_start), 0),
    coalesce(sum(coalesce(total_tokens, 0)) filter (where created_at >= heute_start), 0)
  into vor_heute, heute, token_heute
  from signal_layer.ai_usage_events
  where created_at >= monat_start and model like '%/%';

  tag_budget := greatest(budget - vor_heute, 0) / greatest(tage_rest, 1);

  if cfg.aktiv then
    if vor_heute + heute >= budget or heute >= tag_budget or token_heute >= cfg.tagestoken_max then
      stufe := 'aus';
    elsif heute >= cfg.knapp_ab * tag_budget or token_heute >= cfg.knapp_ab * cfg.tagestoken_max then
      stufe := 'knapp';
    end if;
  end if;

  return jsonb_build_object(
    'stufe', stufe,
    'aktiv', cfg.aktiv,
    'monatsbudget_usd', budget,
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
