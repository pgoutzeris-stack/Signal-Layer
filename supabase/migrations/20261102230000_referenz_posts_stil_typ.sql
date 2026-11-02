-- Stil-Typ je eigenem Post: welche Komposition er zeigt. Das KI-Visual nimmt
-- den staerksten Post des Typs, der zum Inhalt der Folie passt.
alter table signal_layer.referenz_posts
  add column if not exists stil_typ text check (stil_typ is null or stil_typ in ('zahlenvergleich','duell','these','infografik','illustration'));
