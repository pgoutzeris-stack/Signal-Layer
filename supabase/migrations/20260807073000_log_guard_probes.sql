-- Der externe Waechter (.github/workflows/guard-login.yml) prueft alle fuenf
-- Minuten Anmeldung, Recruiting und Profile. Bisher hinterliess er keine Spur:
-- GitHub loescht die Laufprotokolle nach wenigen Tagen, und in der Datenbank
-- stand nur der aktuelle Zustand in signal_layer.ops_guard. Am 6.8.2026 schlug
-- der Waechter zweimal an - warum, war hinterher nicht mehr feststellbar.
--
-- Zwei Ebenen, absichtlich mit unterschiedlicher Aufbewahrung:
--   ops_probes     jeder Lauf mit seinen Messwerten, 30 Tage. Zeigt eine
--                  kriechende Verlangsamung, bevor etwas ausfaellt.
--   ops_incidents  nur Zustandswechsel, ohne Verfallsdatum. Wenige Zeilen im
--                  Monat, die auch in zwei Jahren noch eine Frage beantworten.
--
-- Im shared-Schema, nicht in signal_layer: geprueft wird das ganze Intranet,
-- die Signal-Layer-Arbeit wird nur als Folge pausiert.

create table if not exists shared.ops_probes (
  id               bigserial primary key,
  checked_at       timestamptz not null default now(),
  verdict          text not null check (verdict in ('up', 'down')),
  login_status     integer,
  login_ms         integer,
  recruiting_status integer,
  recruiting_ms    integer,
  profiles_status  integer,
  profiles_ms      integer,
  slowest_ms       integer,
  reason           text,
  source           text not null default 'github_actions'
);

comment on table shared.ops_probes is
  'Messwerte jedes Waechterlaufs. Aufbewahrung 30 Tage, siehe Cron-Job shared-ops-probe-cleanup.';
comment on column shared.ops_probes.verdict is
  'up = alle drei Dienste antworten schnell genug; down = 5xx, keine Antwort oder ueber der Zeitgrenze.';

create index if not exists ops_probes_checked_at_idx on shared.ops_probes (checked_at desc);
-- Eigener Index auf die Ausfaelle: die Frage "wann war es kaputt" soll nicht
-- 8.600 gesunde Zeilen lesen muessen.
create index if not exists ops_probes_down_idx on shared.ops_probes (checked_at desc) where verdict = 'down';

create table if not exists shared.ops_incidents (
  id            bigserial primary key,
  started_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  reason        text not null,
  login_ms      integer,
  recruiting_ms integer,
  profiles_ms   integer,
  source        text not null default 'github_actions'
);

comment on table shared.ops_incidents is
  'Zustandswechsel des Waechters: eine Zeile je Ausfall, resolved_at wird beim Freigeben gesetzt. Ohne Verfallsdatum.';

create index if not exists ops_incidents_offen_idx on shared.ops_incidents (started_at desc) where resolved_at is null;

-- RLS an, keine Regeln: nur die service_role der Edge Function schreibt und
-- liest. Gleiche Linie wie shared.api_keys.
alter table shared.ops_probes enable row level security;
alter table shared.ops_incidents enable row level security;

-- Aufraeumen der Rohmesswerte. Taeglich um 03:17 UTC, also ausserhalb der
-- Ruhezeitfenster des Signal-Layer-Betriebs.
select cron.unschedule('shared-ops-probe-cleanup')
where exists (select 1 from cron.job where jobname = 'shared-ops-probe-cleanup');

select cron.schedule(
  'shared-ops-probe-cleanup',
  '17 3 * * *',
  $$delete from shared.ops_probes where checked_at < now() - interval '30 days'$$
);
