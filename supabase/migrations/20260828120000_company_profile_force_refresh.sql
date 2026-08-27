-- Eine Neurecherche fuer viele Unternehmen auf einmal.
--
-- Bisher recherchierte die Warteschlange ein Unternehmen genau einmal: der
-- Worker ruft ensureCompanyProfile ohne force auf, ein vorhandener Steckbrief
-- gilt damit als erledigt. Eine Sammelaktualisierung - etwa nachdem sich das
-- Format der Kennzahlen geaendert hat - war deshalb nur Klick fuer Klick
-- moeglich. Das Merkmal am Job entscheidet jetzt, ob ein vorhandener Stand
-- ueberschrieben wird. Der alte Stand bleibt als Version in
-- company_profile_history erhalten.
alter table signal_layer.company_profile_jobs
  add column if not exists force boolean not null default false;
