-- Nachtrag statt Neurecherche.
--
-- Bestehende Steckbriefe tragen brauchbare Zahlen, aber ohne Ebene, Stichtag
-- und Beleg an der einzelnen Kennzahl. Ein vollstaendiger Lauf kostet rund
-- 8 Suchanfragen und schreibt dieselben Karten noch einmal; der Nachtrag
-- braucht bis zu 3 und fasst nur die Kennzahlen an. Der Modus am Job
-- entscheidet, welcher der beiden Wege laeuft.
alter table signal_layer.company_profile_jobs
  add column if not exists mode text not null default 'full';

alter table signal_layer.company_profile_jobs
  drop constraint if exists company_profile_jobs_mode_check;

alter table signal_layer.company_profile_jobs
  add constraint company_profile_jobs_mode_check check (mode in ('full', 'kpi_enrich'));
