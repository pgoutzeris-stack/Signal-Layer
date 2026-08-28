-- "Design to Print" stand zweimal in der Themenliste: einmal als
-- Sales-Familie design_to_print, einmal als Marketing-Familie prozess_knowhow
-- mit demselben Label. Die Familie gibt es im Regelstand 2.7 nicht mehr, die
-- gespeicherten Signale tragen den Namen aber weiter - und der Themenfilter
-- baut sich aus dem Bestand, nicht aus der Familienliste im Code. Der Name
-- folgt jetzt dem Inhalt der alten Familie: uebertragbares Prozesswissen.
update signal_layer.simple_signals
set signal_label = 'Prozess-Know-how', updated_at = now()
where signal_id = 'prozess_knowhow' and signal_label = 'Design to Print';

update signal_layer.simple_signal_history
set signal_label = 'Prozess-Know-how'
where signal_id = 'prozess_knowhow' and signal_label = 'Design to Print';
