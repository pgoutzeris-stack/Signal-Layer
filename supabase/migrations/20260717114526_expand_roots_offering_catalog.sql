create table if not exists signal_layer.roots_offerings (
  id text primary key,
  label text not null,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table signal_layer.roots_offerings
  add column if not exists pillar text,
  add column if not exists sort_order integer not null default 0;

alter table signal_layer.roots_offerings
  drop constraint if exists roots_offerings_pillar_check;

alter table signal_layer.roots_offerings
  add constraint roots_offerings_pillar_check
  check (pillar in ('planning', 'purpose', 'presence', 'people', 'productivity', 'performance'));

-- The public website lists these concrete services below the six pillars.
-- Descriptions translate ROOTS' pillar promises into a classifier-friendly
-- explanation of the work performed; they are intentionally editable in-app.
insert into signal_layer.roots_offerings (id, pillar, sort_order, label, description, active)
values
  ('planning_marketing_audit', 'planning', 10, 'Marketing Audit', 'ROOTS analysiert Strategie, Aktivitäten, Organisation und Wirkung des bestehenden Marketings, deckt Stärken und Lücken auf und priorisiert konkrete Handlungsfelder.', true),
  ('planning_markt_wettbewerbsanalyse', 'planning', 20, 'Markt- & Wettbewerbsanalyse', 'ROOTS untersucht Markt, Kategorie, Kunden, Trends und Wettbewerber, um Chancen, Risiken und differenzierende Wachstumsfelder faktenbasiert sichtbar zu machen.', true),
  ('planning_ideation_workshops', 'planning', 30, 'Ideation-Workshops', 'ROOTS konzipiert und moderiert strukturierte Workshops, in denen Teams aus Insights neue Wachstums-, Innovations- und Aktivierungsideen entwickeln und bewerten.', true),
  ('planning_wachstumsstrategie', 'planning', 40, 'Wachstumsstrategie', 'ROOTS identifiziert neue Wachstumschancen und entwickelt einen priorisierten Pfad für nachhaltig profitables Wachstum und Marktanteilssteigerung.', true),
  ('planning_innovationsstrategie', 'planning', 50, 'Innovationsstrategie', 'ROOTS definiert Suchfelder, Prioritäten und Entscheidungslogiken für marktrelevante Innovationen und überführt Chancen in eine belastbare Innovationsroadmap.', true),
  ('planning_markenstrategie', 'planning', 60, 'Markenstrategie', 'ROOTS leitet aus Markt, Zielgruppen und Unternehmenszielen die langfristige Rolle, Ausrichtung und Wachstumslogik der Marke ab.', true),
  ('planning_marketingstrategie', 'planning', 70, 'Marketingstrategie', 'ROOTS übersetzt Geschäfts- und Wachstumsziele in Zielgruppen, Prioritäten, strategische Stoßrichtungen und einen umsetzbaren Marketingrahmen.', true),
  ('planning_go_to_market_strategie', 'planning', 80, 'Go-to-Market-Strategie', 'ROOTS entwickelt den Markteintritt oder Rollout mit Zielsegmenten, Nutzenargumentation, Kanal-, Aktivierungs- und Umsetzungsplan.', true),
  ('planning_integrierte_marketingplanung', 'planning', 90, 'Integrierte Marketingplanung', 'ROOTS verzahnt Ziele, Zielgruppen, Maßnahmen, Kanäle, Budgets und Verantwortlichkeiten zu einem konsistenten, steuerbaren Marketingplan.', true),

  ('purpose_brand_audit', 'purpose', 10, 'Brand Audit', 'ROOTS bewertet Markenwahrnehmung, Positionierung, Auftritt und Wettbewerbsfähigkeit und zeigt die zentralen Hebel für eine stärkere Marke auf.', true),
  ('purpose_markenpositionierung', 'purpose', 20, 'Markenpositionierung', 'ROOTS definiert eine relevante und differenzierende Positionierung, die festlegt, wofür die Marke steht und warum sie gegenüber Wettbewerbern gewählt wird.', true),
  ('purpose_brand_purpose', 'purpose', 30, 'Brand Purpose', 'ROOTS schärft den glaubwürdigen Daseinszweck und gesellschaftlichen oder kundenseitigen Beitrag der Marke als Orientierung für Strategie und Handeln.', true),
  ('purpose_value_proposition', 'purpose', 40, 'Value Proposition', 'ROOTS formuliert ein klares, zielgruppenrelevantes Nutzenversprechen und belegt, welchen konkreten Mehrwert Angebot und Marke stiften.', true),
  ('purpose_employer_value_proposition', 'purpose', 50, 'Employer Value Proposition', 'ROOTS entwickelt ein differenzierendes Arbeitgeberversprechen, das Kultur, Stärken und relevante Bedürfnisse heutiger und künftiger Mitarbeitender verbindet.', true),
  ('purpose_internal_branding', 'purpose', 60, 'Internal Branding', 'ROOTS verankert Positionierung, Werte und Markenversprechen intern, damit Mitarbeitende die Marke verstehen, glaubwürdig leben und konsistent erlebbar machen.', true),
  ('purpose_handelsmarkenstrategie', 'purpose', 70, 'Handelsmarkenstrategie', 'ROOTS definiert Rolle, Positionierung, Architektur und Wachstumslogik von Handelsmarken im Zusammenspiel mit Kategorie, Sortiment und Herstellermarken.', true),

  ('presence_customer_experience_management', 'presence', 10, 'Customer Experience Management', 'ROOTS entwickelt ein systematisches Management für attraktive, konsistente und integrierte Kundenerlebnisse über alle relevanten Touchpoints hinweg.', true),
  ('presence_customer_insights', 'presence', 20, 'Customer Insights', 'ROOTS erschließt und verdichtet qualitative und quantitative Kundenerkenntnisse zu entscheidungsrelevanten Bedürfnissen, Motiven, Barrieren und Verhaltensmustern.', true),
  ('presence_customer_journey_maps', 'presence', 30, 'Customer Journey Maps', 'ROOTS visualisiert Phasen, Aufgaben, Emotionen und Touchpoints der Customer Journey und leitet priorisierte Verbesserungen für das Kundenerlebnis ab.', true),
  ('presence_content_strategie', 'presence', 40, 'Content-Strategie', 'ROOTS definiert Zielgruppen, Themen, Formate, Kanäle, Prozesse und Messgrößen für relevanten, konsistenten und wirksamen Content.', true),
  ('presence_social_media_strategie', 'presence', 50, 'Social-Media-Strategie', 'ROOTS entwickelt die strategische Rolle sozialer Kanäle, Zielgruppen, Plattformen, Inhalte, Governance und Erfolgsmessung.', true),
  ('presence_influencer_marketing_strategie', 'presence', 60, 'Influencer-Marketing-Strategie', 'ROOTS entwickelt Ziele, Creator-Auswahl, Kooperationsmodell, Inhalte, Prozesse und Messlogik für glaubwürdiges und wirksames Influencer Marketing.', true),

  ('people_marketing_academy', 'people', 10, 'Marketing Academy Entwicklung', 'ROOTS konzipiert eine unternehmensspezifische Marketing Academy mit Kompetenzmodell, Lernpfaden, Formaten und Transfer in die tägliche Praxis.', true),
  ('people_brand_management_grundlagen', 'people', 20, 'Brand Management Grundlagen', 'ROOTS vermittelt praxisnah die zentralen Methoden und Entscheidungen professioneller Markenführung – von Positionierung bis Umsetzung und Steuerung.', true),
  ('people_marketing_for_non_marketers', 'people', 30, 'Marketing for Non-Marketers', 'ROOTS befähigt Fach- und Führungskräfte außerhalb des Marketings, Marketinglogik, Kundenorientierung und die Zusammenarbeit mit Marketingteams sicher anzuwenden.', true),
  ('people_online_marketing_kompetenz', 'people', 40, 'Online-Marketing-Kompetenz', 'ROOTS baut Verständnis und Anwendungskompetenz für digitale Kanäle, Instrumente, Kampagnen, Daten und Erfolgsmessung auf.', true),
  ('people_content_marketing', 'people', 50, 'Content Marketing', 'ROOTS schult Teams darin, zielgruppenrelevante Inhalte strategisch zu planen, effizient zu produzieren, auszuspielen und anhand klarer Ziele zu messen.', true),
  ('people_social_media_marketing', 'people', 60, 'Social Media Marketing', 'ROOTS befähigt Teams zu strategischer Plattformwahl, Content- und Community-Arbeit, Kampagnensteuerung und Erfolgsmessung in sozialen Medien.', true),
  ('people_influencer_marketing', 'people', 70, 'Influencer Marketing', 'ROOTS vermittelt Auswahl, Briefing, Zusammenarbeit, Governance und Messung von Creator-Partnerschaften für glaubwürdige Markenwirkung.', true),
  ('people_agenturen_richtig_briefen', 'people', 80, 'Agenturen richtig briefen', 'ROOTS zeigt Teams, wie sie Ziele, Aufgaben, Zielgruppen, Rahmenbedingungen und Bewertungskriterien in klaren, wirksamen Agenturbriefings formulieren.', true),
  ('people_effiziente_agentur_pitches', 'people', 90, 'Effiziente Agentur-Pitches', 'ROOTS gestaltet Pitch-Prozess, Shortlist, Briefing, Bewertung und Entscheidung so, dass Unternehmen effizient die passende Agentur auswählen.', true),
  ('people_erste_100_tage_cmo', 'people', 100, 'Die ersten 100 Tage als CMO', 'ROOTS begleitet neue Marketingverantwortliche bei Standortbestimmung, Stakeholder- und Team-Ausrichtung, Priorisierung und einer belastbaren Agenda für die ersten 100 Tage.', true),
  ('people_data_analytics', 'people', 110, 'Data Analytics', 'ROOTS befähigt Marketingteams, relevante Daten, Kennzahlen und Analysen korrekt zu verstehen, in Entscheidungen zu übersetzen und wirkungsorientiert zu nutzen.', true),

  ('productivity_marketing_operations_audit', 'productivity', 10, 'Marketing Operations Audit', 'ROOTS prüft Strukturen, Rollen, Prozesse, Technologien und Schnittstellen der Marketing Operations und priorisiert Effizienz- und Wirksamkeitshebel.', true),
  ('productivity_marketing_operations_ziele', 'productivity', 20, 'Marketing Operations-Ziele', 'ROOTS definiert messbare Zielbilder und Prioritäten für leistungsfähige Marketing Operations im Einklang mit Geschäfts- und Marketingstrategie.', true),
  ('productivity_martech_oekosystem', 'productivity', 30, 'MarTech-Ökosystem', 'ROOTS gestaltet eine integrierte MarTech-Landschaft, die Daten, Tools und Anwendungsfälle sinnvoll verbindet und Doppelstrukturen reduziert.', true),
  ('productivity_marketing_prozesse', 'productivity', 40, 'Marketing-Prozesse', 'ROOTS analysiert, standardisiert und optimiert Marketingabläufe, Übergaben und Verantwortlichkeiten für mehr Geschwindigkeit, Qualität und Transparenz.', true),
  ('productivity_martech_anbieter', 'productivity', 50, 'MarTech-Anbieter', 'ROOTS strukturiert Anforderungen, bewertet Anbieter und begleitet die Auswahl geeigneter Marketingtechnologien passend zu Strategie, Prozessen und Systemlandschaft.', true),
  ('productivity_governance_modell', 'productivity', 60, 'Governance-Modell', 'ROOTS entwickelt klare Rollen, Entscheidungsrechte, Standards und Gremien für konsistente und handlungsfähige Marketingsteuerung.', true),
  ('productivity_project_management_office', 'productivity', 70, 'Project Management Office', 'ROOTS richtet ein Marketing-PMO für Priorisierung, Planung, Ressourcensteuerung, Transparenz, Risiken und verlässliche Umsetzung strategischer Initiativen ein.', true),
  ('productivity_marketing_automation', 'productivity', 80, 'Marketing Automation', 'ROOTS identifiziert geeignete Use Cases und gestaltet Prozesse, Daten, Technologie und Governance für skalierbare automatisierte Marketingaktivitäten.', true),

  ('performance_digital_maturity_assessment', 'performance', 10, 'Digital Maturity Assessment', 'ROOTS bewertet den digitalen Reifegrad von Strategie, Organisation, Prozessen, Daten, Technologie und Kompetenzen und leitet eine priorisierte Entwicklungsroadmap ab.', true),
  ('performance_datenstrategie_exekution', 'performance', 20, 'Datenstrategie & Exekution', 'ROOTS entwickelt Ziele, Use Cases, Datenbasis, Governance und Umsetzungsplan, damit Marketingdaten verlässlich in Entscheidungen und Aktivierung einfließen.', true),
  ('performance_marketing_tool_auswahl', 'performance', 30, 'Marketing Tool Auswahl', 'ROOTS übersetzt fachliche Anforderungen in Kriterien, bewertet Tools und Anbieter und begleitet eine fundierte, anschlussfähige Technologieentscheidung.', true),
  ('performance_customer_journey_analytics', 'performance', 40, 'Customer Journey Analytics', 'ROOTS verbindet Daten entlang der Customer Journey, analysiert Verhalten und Reibungspunkte und macht konkrete Optimierungshebel über Touchpoints hinweg sichtbar.', true),
  ('performance_marketing_performance_management', 'performance', 50, 'Marketing Performance Management', 'ROOTS etabliert Ziele, Kennzahlen, Messlogik und Steuerungsroutinen, um Marketingwirkung transparent zu machen und Ressourcen wirkungsorientiert zu optimieren.', true),
  ('performance_kpi_dashboards_reportings', 'performance', 60, 'KPI-Dashboards & Reportings', 'ROOTS konzipiert entscheidungsorientierte KPI-Systeme, Dashboards und Reports, die relevante Leistungsdaten verständlich bündeln und regelmäßige Steuerung ermöglichen.', true)
on conflict (id) do update set
  pillar = excluded.pillar,
  sort_order = excluded.sort_order,
  label = excluded.label,
  description = excluded.description,
  active = excluded.active,
  updated_at = now();

delete from signal_layer.roots_offerings
where id in ('planning', 'purpose', 'presence', 'people', 'productivity', 'performance');

create index if not exists roots_offerings_pillar_sort_idx
  on signal_layer.roots_offerings (pillar, sort_order, label);
