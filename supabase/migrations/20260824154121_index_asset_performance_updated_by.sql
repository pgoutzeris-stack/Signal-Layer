-- Deckt den optionalen FK fuer Nutzerloeschungen und Audit-Lookups ab.
create index if not exists asset_performance_updated_by_idx
  on signal_layer.asset_performance (updated_by)
  where updated_by is not null;
