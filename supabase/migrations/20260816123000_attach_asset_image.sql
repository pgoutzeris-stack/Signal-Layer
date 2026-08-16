-- Ein Motiv pro Request in die Nutzlast legen. Sechs Data-URIs auf einmal
-- (mehrere MB) haben am 16.8.2026 den Persist nach images_done verschluckt:
-- Gemini lieferte 6/6, die Zeile behielt den Textstand.

create or replace function signal_layer.attach_asset_image(
  p_id uuid,
  p_key text,
  p_src text,
  p_pos text default '50% 50%'
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  treffer text[];
  n integer;
begin
  if p_src is null or p_src not like 'data:image/%' then
    raise exception 'invalid image src';
  end if;
  treffer := regexp_match(p_key, '^(benchmarks|potentials)\.([0-9]+)$');
  if treffer is null then
    raise exception 'invalid image key';
  end if;
  update signal_layer.generated_assets
  set
    payload = jsonb_set(
      coalesce(payload, '{}'::jsonb),
      array[treffer[1], treffer[2], 'image'],
      jsonb_build_object(
        'src', p_src,
        'pos', coalesce(nullif(p_pos, ''), '50% 50%')
      ),
      true
    ),
    updated_at = now()
  where id = p_id
    and status = 'running';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

comment on function signal_layer.attach_asset_image(uuid, text, text, text) is
  'Hängt ein Memo-Motiv (data:image/…) an benchmarks.N oder potentials.N, ohne die ganze Nutzlast zu ersetzen.';

revoke all on function signal_layer.attach_asset_image(uuid, text, text, text) from public, anon, authenticated;
grant execute on function signal_layer.attach_asset_image(uuid, text, text, text) to service_role;
