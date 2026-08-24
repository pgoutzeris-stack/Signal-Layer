-- Deckt den FK fuer ON DELETE CASCADE und direkte Asset-Lookups ab. Der
-- bestehende Unique-Index beginnt mit user_id und kann das nicht ersetzen.
create index if not exists asset_performance_asset_idx
  on signal_layer.asset_performance (asset_id);
