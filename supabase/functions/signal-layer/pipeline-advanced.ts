// ---------------------------------------------------------------------------
// Signal Layer - ADVANCED pipeline (previous behaviour, unchanged)
//
// Every business rule of the advanced mode lives here: prompt, taxonomy,
// response schema, deterministic hard gates, non-negotiable guardrails,
// validation of the model answer, routing/value scoring and the ROOTS offering
// match. Tuning advanced mode means editing this file.
//
// index.ts stays the transport layer (HTTP, auth, crawl, database) and calls
// these rules. The simple mode lives entirely in pipeline-simple.ts and shares
// nothing with this file except pipeline-core.ts.
// ---------------------------------------------------------------------------
import {
  CrawlPolicy,
  clampConfidence,
  cleanArticleText,
  containsMatchTerm,
  evidenceExists,
  looksLikePaywallTeaser,
  normalizeMatchText,
  patternTerms,
  selectClassifierContent,
} from "./pipeline-core.ts";
import {
  hasIndependentEventReportSubstance,
  hasQualifiedTier1EventParticipation,
  isBareEventAnnouncement,
} from "./event-signals.ts";

export const CAREER_CONTENT_TERMS = [
  "bewerbung", "bewerben", "stellenbörse", "stellenboerse", "freie stellen",
  "ausbildung", "praktikum", "traineeprogramm", "bewerbungsfrist", "lebenslauf",
  "anschreiben", "bewerbungsunterlagen", "job suchen", "jobs & karriere",
  "application process", "apply now", "open positions", "vacancies", "internship",
  "apprenticeship", "graduate program", "resume", "cover letter", "job board",
];

export const ROLE_TERMS = [
  "cmo", "chief marketing officer", "ceo", "chief executive officer",
  "marketingleiter", "marketingleiterin", "marketingdirektor", "head of marketing",
  "brand manager", "brand director", "geschäftsführer marketing", "neuer cmo", "new cmo",
  "geschäftsführer", "geschäftsführerin", "managing director", "commercial director",
  "sales director", "head of sales", "vertriebsleiter", "vertriebsleiterin",
  "category manager", "head of category", "innovation director", "head of innovation",
];

export const GEMINI_PRIMARY_MODEL = "gemini-2.5-flash-lite";

export const GEMINI_REVIEW_MODEL = "gemini-2.5-flash-lite";

export const CLASSIFIER_PROMPT_VERSION = "roots-signal-v1.9.2";

// Eine gemeinsame, sprechende Version je Modus. Die internen Stufen-Versionen
// bleiben für den Prüfpfad erhalten, in der Oberfläche steht nur noch diese.
export const PIPELINE_VERSION = "3.1";
export const PIPELINE_RULE_MANIFEST_VERSION = "roots-pipeline-rules-v1.1.0";

export const RELEVANCE_SCORING_VERSION = "roots-value-v1.0";

export const ROUTING_STAGE_VERSION = "roots-routing-v1.1";

export const OFFERING_STAGE_VERSION = "roots-offering-v1.1";

export const TRANSLATION_STAGE_VERSION = "roots-translation-v1.1";

export const EDITORIAL_TEXT_REQUIREMENTS = {
  minimumCharacters: 500,
  minimumWords: 70,
  minimumSentences: 3,
  denseMinimumCharacters: 430,
  denseMinimumWords: 75,
  denseMinimumSentences: 5,
} as const;

export const MARKETING_SCORE_WEIGHTS = { novelty: 25, strategic_value: 30, transferability: 25, evidence_strength: 20 } as const;

export const SALES_SCORE_WEIGHTS = { problem_strength: 32, roots_fit: 30, buying_intent: 23, timing: 15 } as const;

export type PipelineConfig = {
  experience: { quality_profile: "strict" | "balanced" | "discovery" };
  relevance: {
    customer_insights: "relevant" | "impact_required" | "not_relevant";
    marketing_insights: "relevant" | "impact_required" | "not_relevant";
    fmcg_retail_signale: "relevant" | "impact_required" | "not_relevant";
    ki_performance: "relevant" | "impact_required" | "not_relevant";
    sub_branchen_insight: "relevant" | "impact_required" | "not_relevant";
    allow_product_launch_without_strategy: boolean; allow_campaign_without_results: boolean;
    allow_ai_pilot: boolean; require_ai_application: boolean; require_subsector_transferability: boolean;
  };
  decisions: {
    marketing_requires_direct_evidence: boolean; customer_signal_qualifies_marketing: boolean;
    retail_signal_qualifies_marketing: boolean; sales_requires_implementation: boolean;
    sales_allow_risks: boolean; buying_center_allow_role_without_name: boolean; reject_pure_appointments: boolean;
  };
  crawl: { freshness_days: number; future_tolerance_hours: number; article_batch_size: number; default_max_depth: number; default_max_pages: number; event_max_depth: number; event_max_pages: number };
  filters: { minimum_text_length: number; require_professional_signal: boolean; reject_career_pages: boolean; reject_faq_pages: boolean; reject_event_programs: boolean; reject_future_dates: boolean; deduplicate: boolean };
  // simple_model gehört dem einfachen Modus (pipeline-simple.ts); es liegt hier,
  // weil beide Modi eine gemeinsame Einstellungszeile teilen.
  ai: { primary_model: string; review_model: string; simple_model: string; review_enabled: boolean; review_confidence_below: number; review_rejected_articles: boolean; batch_enabled: boolean; batch_size: number; thinking_level: "minimal" | "low" | "medium" | "high"; max_output_tokens: number; monthly_warning_usd: number };
  quality: { topic_confidence: number; territory_confidence: number; company_confidence: number; person_confidence: number; sales_trigger_confidence: number; routing_confidence: number; reliable_confidence: number };
  routing: { marketing_enabled: boolean; sales_enabled: boolean; buying_center_enabled: boolean; sales_requires_tier1: boolean; sales_requires_trigger: boolean; buying_center_requires_person: boolean; subsector_alone_is_marketing: boolean };
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  experience: { quality_profile: "strict" },
  relevance: {
    customer_insights: "relevant", marketing_insights: "relevant", fmcg_retail_signale: "relevant",
    ki_performance: "impact_required", sub_branchen_insight: "impact_required",
    allow_product_launch_without_strategy: false, allow_campaign_without_results: true,
    allow_ai_pilot: true, require_ai_application: true, require_subsector_transferability: true,
  },
  decisions: {
    marketing_requires_direct_evidence: true, customer_signal_qualifies_marketing: true,
    retail_signal_qualifies_marketing: true, sales_requires_implementation: false,
    sales_allow_risks: true, buying_center_allow_role_without_name: true, reject_pure_appointments: true,
  },
  crawl: { freshness_days: 183, future_tolerance_hours: 24, article_batch_size: 1, default_max_depth: 2, default_max_pages: 40, event_max_depth: 1, event_max_pages: 24 },
  filters: { minimum_text_length: EDITORIAL_TEXT_REQUIREMENTS.minimumCharacters, require_professional_signal: true, reject_career_pages: true, reject_faq_pages: true, reject_event_programs: true, reject_future_dates: true, deduplicate: true },
  ai: { primary_model: GEMINI_PRIMARY_MODEL, review_model: GEMINI_REVIEW_MODEL, simple_model: "deepseek-v4-pro", review_enabled: true, review_confidence_below: 0.9, review_rejected_articles: false, batch_enabled: true, batch_size: 8, thinking_level: "low", max_output_tokens: 4096, monthly_warning_usd: 10 },
  quality: { topic_confidence: 0.82, territory_confidence: 0.84, company_confidence: 0.86, person_confidence: 0.86, sales_trigger_confidence: 0.86, routing_confidence: 0.88, reliable_confidence: 0.9 },
  routing: { marketing_enabled: true, sales_enabled: true, buying_center_enabled: true, sales_requires_tier1: true, sales_requires_trigger: true, buying_center_requires_person: true, subsector_alone_is_marketing: false },
};

export function mergePipelineConfig(raw: Partial<PipelineConfig> | null | undefined): PipelineConfig {
  const merged: PipelineConfig = {
    experience: { ...DEFAULT_PIPELINE_CONFIG.experience, ...(raw?.experience || {}) },
    relevance: { ...DEFAULT_PIPELINE_CONFIG.relevance, ...(raw?.relevance || {}) },
    decisions: { ...DEFAULT_PIPELINE_CONFIG.decisions, ...(raw?.decisions || {}) },
    crawl: { ...DEFAULT_PIPELINE_CONFIG.crawl, ...(raw?.crawl || {}) },
    filters: { ...DEFAULT_PIPELINE_CONFIG.filters, ...(raw?.filters || {}) },
    ai: { ...DEFAULT_PIPELINE_CONFIG.ai, ...(raw?.ai || {}) },
    quality: { ...DEFAULT_PIPELINE_CONFIG.quality, ...(raw?.quality || {}) },
    routing: { ...DEFAULT_PIPELINE_CONFIG.routing, ...(raw?.routing || {}) },
  };
  const profiles: Record<PipelineConfig["experience"]["quality_profile"], PipelineConfig["quality"]> = {
    strict: { topic_confidence: 0.82, territory_confidence: 0.84, company_confidence: 0.86, person_confidence: 0.86, sales_trigger_confidence: 0.86, routing_confidence: 0.88, reliable_confidence: 0.9 },
    balanced: { topic_confidence: 0.77, territory_confidence: 0.79, company_confidence: 0.82, person_confidence: 0.82, sales_trigger_confidence: 0.82, routing_confidence: 0.84, reliable_confidence: 0.86 },
    discovery: { topic_confidence: 0.7, territory_confidence: 0.72, company_confidence: 0.76, person_confidence: 0.76, sales_trigger_confidence: 0.76, routing_confidence: 0.78, reliable_confidence: 0.82 },
  };
  merged.quality = profiles[merged.experience.quality_profile] || profiles.strict;
  // Non-negotiable safety and quality guardrails are visible in the UI but
  // cannot be disabled through stale clients or direct API payloads.
  merged.filters.reject_career_pages = true;
  merged.filters.reject_faq_pages = true;
  merged.filters.reject_event_programs = true;
  merged.filters.reject_future_dates = true;
  merged.filters.deduplicate = true;
  merged.filters.require_professional_signal = true;
  merged.decisions.marketing_requires_direct_evidence = true;
  merged.decisions.reject_pure_appointments = true;
  // The model may be switched (Gemini or another provider with a stored price
  // list), but never silently to a runtime that does not exist: the half-price
  // batch queue is a Gemini feature, so any other provider runs synchronously.
  if (!merged.ai.primary_model) merged.ai.primary_model = GEMINI_PRIMARY_MODEL;
  if (!merged.ai.review_model) merged.ai.review_model = merged.ai.primary_model;
  merged.ai.batch_enabled = merged.ai.primary_model.startsWith("gemini-");
  // These values describe hard runtime limits. Keeping them normalized here
  // prevents a stale database row or older frontend from advertising a value
  // that the worker does not actually execute.
  merged.filters.minimum_text_length = Math.max(EDITORIAL_TEXT_REQUIREMENTS.minimumCharacters, Number(merged.filters.minimum_text_length || 0));
  merged.crawl.article_batch_size = 1;
  return merged;
}

export type PipelineRule = {
  id: string;
  title: string;
  explanation: string;
  systems: Array<"source" | "crawler" | "browser" | "code" | "gemini" | "server" | "frontend">;
  status: "active" | "inactive" | "conditional";
  locked: boolean;
  config_path?: string;
  value?: string | number | boolean;
  technical?: string;
};

export function buildPipelineRuleManifest(config: PipelineConfig) {
  const configured = (
    id: string, title: string, explanation: string, systems: PipelineRule["systems"],
    configPath: string, value: string | number | boolean, technical?: string,
  ): PipelineRule => ({
    id, title, explanation, systems, config_path: configPath, value,
    status: typeof value === "boolean" ? (value ? "active" : "inactive") : "active",
    locked: false, technical,
  });
  const fixed = (
    id: string, title: string, explanation: string, systems: PipelineRule["systems"],
    technical?: string, status: PipelineRule["status"] = "active",
  ): PipelineRule => ({ id, title, explanation, systems, status, locked: true, technical });

  // Die Oberfläche soll pro Regel die tatsächlichen Wortlisten aufklappen
  // können, nicht nur den Namen der Variablen.
  const patternLibrary: Record<string, string[]> = {
    professionalSignalPatterns: [
      ...patternTerms(MARKETING_CONTEXT_PATTERN),
      ...patternTerms(RETAIL_CONTEXT_PATTERN),
      ...patternTerms(CUSTOMER_CONTEXT_PATTERN),
    ],
    CAREER_CONTENT_TERMS: patternTerms(CAREER_CONTENT_TERMS),
    ROLE_TERMS: patternTerms(ROLE_TERMS),
    ROOTS_SALES_CONTEXT_PATTERN: patternTerms(ROOTS_SALES_CONTEXT_PATTERN),
    OPERATIONAL_ONLY_PATTERN: patternTerms(OPERATIONAL_ONLY_PATTERN),
    EXPLICIT_MARKETING_PROBLEM_PATTERN: patternTerms(EXPLICIT_MARKETING_PROBLEM_PATTERN),
    RESOLVED_PROBLEM_PATTERN: patternTerms(RESOLVED_PROBLEM_PATTERN),
    CUSTOMER_INSIGHT_SIGNAL_PATTERN: patternTerms(CUSTOMER_INSIGHT_SIGNAL_PATTERN),
    INDUSTRIAL_OPERATIONS_PATTERN: patternTerms(INDUSTRIAL_OPERATIONS_PATTERN),
    MARKETING_DEPTH_PATTERN: patternTerms(MARKETING_DEPTH_PATTERN),
    CONCRETE_ACTIVATION_PATTERN: patternTerms(CONCRETE_ACTIVATION_PATTERN),
    RESEARCH_CONTENT_PATTERN: patternTerms(RESEARCH_CONTENT_PATTERN),
    RESEARCH_SUBSTANCE_PATTERN: patternTerms(RESEARCH_SUBSTANCE_PATTERN),
    THIN_SPONSORSHIP_PATTERN: patternTerms(THIN_SPONSORSHIP_PATTERN),
    TACTICAL_PRICE_PROMOTION_PATTERN: patternTerms(TACTICAL_PRICE_PROMOTION_PATTERN),
    SALES_ONLY_REJECTION_PATTERN: patternTerms(SALES_ONLY_REJECTION_PATTERN),
    MARKETING_RECOVERY_TOPIC_PATTERN: patternTerms(MARKETING_RECOVERY_TOPIC_PATTERN),
    MARKETING_RECOVERY_VALUE_PATTERN: patternTerms(MARKETING_RECOVERY_VALUE_PATTERN),
    VENDOR_PITCH_TERMS: patternTerms(/\b(demo|kostenlos testen|jetzt anfragen|unsere losung|unser produkt|whitepaper herunterladen|kontaktieren sie uns|request a demo|free trial|book a call|our solution|our platform)\b/),
    AI_APPLICATION_TERMS: patternTerms(/\b(used|uses|using|deploy\w*|implement\w*|pilot|application|anwendung|eingesetzt|einfuhr\w*|automati\w*|optimier\w*)\b/),
    EDITORIAL_TEXT_REQUIREMENTS: [
      `mindestens ${EDITORIAL_TEXT_REQUIREMENTS.minimumCharacters} Zeichen`,
      `mindestens ${EDITORIAL_TEXT_REQUIREMENTS.minimumSentences} Sätze`,
      `mindestens ${EDITORIAL_TEXT_REQUIREMENTS.minimumWords} Wörter`,
    ],
    NON_EDITORIAL_URL_PARTS: [
      "/search", "/suche", "/tag/", "/category/", "/kategorie/", "/author/",
      "/newsletter", "/abo", "/shop", "/mediadaten", "/impressum", "/datenschutz",
      "/kontakt", "/jobs", "/karriere", "/stellenangebote", "/faq", "/hilfe",
    ],
  };

  const stageSteps: Record<string, Array<{ title: string; copy: string; kind: string; patterns?: string[] }>> = {
    crawl: [
      { title: "Quelle abrufen", copy: "RSS oder Sitemap der aktiven Quelle liefern Titel, URL und Datum. Erst wenn beides fehlt, folgt der eigene Crawler innerhalb derselben Domain.", kind: "Quelle" },
      { title: "URL-Art prüfen", copy: "Übersichts-, Karriere-, Hilfe- und Serviceseiten werden anhand ihres Pfads verworfen, bevor sie geöffnet werden.", kind: "Deterministischer Code", patterns: ["NON_EDITORIAL_URL_PARTS"] },
      { title: "Datum prüfen", copy: `Nur Artikel innerhalb des Rückblicks von ${config.crawl.freshness_days} Tagen; Zukunftsdaten über ${config.crawl.future_tolerance_hours} Stunden gelten als fehlerhaft.`, kind: "Deterministischer Code" },
      { title: "Volltext holen", copy: "Direkter Abruf mit Entfernen von Navigation, Werbung und Bannern. Bei JavaScript, Blockade oder Paywall übernimmt der Browser-Worker.", kind: "Crawler und Browser" },
    ],
    prefilter: [
      { title: "Text bereinigen", copy: "Menü, Cookie-Hinweise, Newsletter-Kästen, Autorenboxen und doppelte Zeilen werden entfernt. Der redaktionelle Text bleibt unverändert.", kind: "Deterministischer Code" },
      { title: "Textmenge prüfen", copy: `Der Artikel braucht mindestens ${config.filters.minimum_text_length} Zeichen sowie genug Sätze und Wörter, damit ein Zitat überhaupt belegbar ist.`, kind: "Deterministischer Code", patterns: ["EDITORIAL_TEXT_REQUIREMENTS"] },
      { title: "Seitenart prüfen", copy: "Karriere-, FAQ- und reine Eventprogramm-Seiten werden anhand ihrer typischen Begriffe erkannt und gestoppt.", kind: "Deterministischer Code", patterns: ["CAREER_CONTENT_TERMS"] },
      { title: "Anbietertext erkennen", copy: "Seiten, die vor allem das eigene Produkt verkaufen, werden ausgeschlossen. Substanzielle Studien derselben Anbieter bleiben erlaubt.", kind: "Deterministischer Code", patterns: ["VENDOR_PITCH_TERMS"] },
      { title: "Fachsignal prüfen", copy: "Mindestens ein Begriff aus Marketing, Marke, Kunde oder Handel muss vorkommen. Ein Treffer erlaubt nur die KI-Prüfung und erzeugt nie selbst ein Signal.", kind: "Deterministischer Code", patterns: ["professionalSignalPatterns"] },
      { title: "Dünne Meldungen aussortieren", copy: "Reines Sponsoring und taktische Rabattaktionen ohne Mechanik oder Ergebnis reichen nicht.", kind: "Deterministischer Code", patterns: ["THIN_SPONSORSHIP_PATTERN", "TACTICAL_PRICE_PROMOTION_PATTERN"] },
      { title: "Duplikate erkennen", copy: "Gleicher Inhalt, gleicher Textkörper oder sehr ähnliche Überschrift derselben Quelle werden nur einmal bewertet.", kind: "Deterministischer Code" },
    ],
    gemini: [
      { title: "Prompt bauen", copy: "Taxonomie, aktive Geschäftsregeln, Tier-1-Liste, Quelle, Titel und bis zu 12.000 Zeichen Artikeltext werden zusammengestellt.", kind: "Server" },
      { title: "Semantische Prüfung", copy: `${config.ai.primary_model} bewertet Themen, Territory, Unternehmen, Personen, Trigger, Routing und Nutzwert - jeweils nur mit wörtlicher Evidenz.`, kind: "KI" },
      { title: "Artikeltext bleibt Daten", copy: "Der Prompt weist das Modell an, Artikeltext niemals als Anweisung zu behandeln.", kind: "KI" },
      { title: "Zweite Prüfung bei Grenzfällen", copy: config.ai.review_enabled ? `Unklare Ergebnisse unter Konfidenz ${config.ai.review_confidence_below} gehen erneut an ${config.ai.review_model}.` : "Aktuell abgeschaltet: Grenzfälle werden nicht erneut geprüft.", kind: "KI" },
      { title: "Nutzwert bewerten", copy: "Marketing wird über Neuheit, strategischen Wert, Übertragbarkeit und Evidenzstärke bewertet, Sales über Problemstärke, ROOTS-Passung, Kaufabsicht und Timing.", kind: "KI" },
    ],
    validation: [
      { title: "Zitate gegenprüfen", copy: "Jedes Zitat muss wortgleich im Artikel stehen. Fehlt es, wird die Aussage verworfen - nicht korrigiert.", kind: "Server" },
      { title: "Themen-Kontext prüfen", copy: "Ein Kundenthema braucht belegtes Verhalten oder Bedürfnis, kein allgemeines Wort. Fehlende Belege führen zur Ablehnung des Themas.", kind: "Deterministischer Code", patterns: ["CUSTOMER_INSIGHT_SIGNAL_PATTERN"] },
      { title: "Produktions- und Industriethemen abgrenzen", copy: "Fabrik, Anlagen, Logistik und Energie sind keine Marketingerkenntnis, auch wenn sie strategisch klingen.", kind: "Deterministischer Code", patterns: ["INDUSTRIAL_OPERATIONS_PATTERN", "OPERATIONAL_ONLY_PATTERN"] },
      { title: "Schwellen anwenden", copy: `Qualitätsprofil ${config.experience.quality_profile}: Thema ab ${config.quality.topic_confidence}, Routing ab ${config.quality.routing_confidence}, zuverlässig ab ${config.quality.reliable_confidence}.`, kind: "Server" },
      { title: "Artikeltyp normalisieren", copy: "Der Typ wird aus der tatsächlichen Textform bestimmt, nicht aus Wörtern in der Überschrift.", kind: "Deterministischer Code" },
    ],
    routing: [
      { title: "Marketing entscheiden", copy: "Es braucht übertragbare Substanz und direkte Evidenz. Studien und Reports brauchen offengelegte Methode oder Ergebnisse.", kind: "Server", patterns: ["RESEARCH_CONTENT_PATTERN", "RESEARCH_SUBSTANCE_PATTERN"] },
      { title: "Sales entscheiden", copy: "Es braucht ein Tier-1-Unternehmen, einen belegten strategischen Trigger, eine konkrete Herausforderung und einen ROOTS-Bezug.", kind: "Server", patterns: ["ROOTS_SALES_CONTEXT_PATTERN", "EXPLICIT_MARKETING_PROBLEM_PATTERN"] },
      { title: "ROOTS-Leistung zuordnen", copy: "Zuerst deterministisch über Leistungsbegriffe, nur bei Bedarf per KI - und nur mit wörtlichem Beleg im Artikel.", kind: "Deterministischer Code und KI" },
      { title: "Buying Center ableiten", copy: "Passende Rollen werden aus der Rollenliste bestimmt; eine reine Personalie genügt nicht.", kind: "Deterministischer Code", patterns: ["ROLE_TERMS"] },
    ],
    output: [
      { title: "Zuverlässige Signale zeigen", copy: "Nur Artikel mit bestandener Validierung und aktivem Routing erscheinen als Kachel.", kind: "Server" },
      { title: "Grenzfälle markieren", copy: "Fehlt genau eine Pflichtprüfung, wird der Artikel als Grenzfall mit Begründung ausgewiesen.", kind: "Server" },
      { title: "Archiv füllen", copy: "Abgelehnte, alte und technisch fehlerhafte Artikel bleiben mit Begründung nachvollziehbar erhalten.", kind: "Server" },
      { title: "Prüfpfad speichern", copy: "Jede Station schreibt Modell, Tokens, Kosten und Entscheidungen in den technischen Prüfpfad des Artikels.", kind: "Server" },
    ],
  };

  return {
    version: PIPELINE_RULE_MANIFEST_VERSION,
    version_label: PIPELINE_VERSION,
    prompt_version: CLASSIFIER_PROMPT_VERSION,
    pattern_library: patternLibrary,
    // Ordnet jeder Regel die Wortlisten zu, die sie tatsächlich prüft, damit die
    // Oberfläche sie aufklappen kann statt nur den Variablennamen zu zeigen.
    rule_patterns: {
      "prefilter.text_quality": ["EDITORIAL_TEXT_REQUIREMENTS"],
      "prefilter.non_articles": ["CAREER_CONTENT_TERMS", "NON_EDITORIAL_URL_PARTS"],
      "prefilter.vendor_pitch": ["VENDOR_PITCH_TERMS"],
      "prefilter.professional_signal": ["professionalSignalPatterns"],
      "prefilter.weak_news": ["THIN_SPONSORSHIP_PATTERN", "TACTICAL_PRICE_PROMOTION_PATTERN"],
      "gemini.evidence": ["MARKETING_DEPTH_PATTERN", "CONCRETE_ACTIVATION_PATTERN"],
      "validation.topic_context": ["CUSTOMER_INSIGHT_SIGNAL_PATTERN", "MARKETING_RECOVERY_TOPIC_PATTERN"],
      "validation.operations_guard": ["INDUSTRIAL_OPERATIONS_PATTERN", "OPERATIONAL_ONLY_PATTERN"],
      "validation.ai_application": ["AI_APPLICATION_TERMS"],
      "validation.subsector_transfer": ["MARKETING_RECOVERY_VALUE_PATTERN"],
      "routing.marketing": ["RESEARCH_CONTENT_PATTERN", "RESEARCH_SUBSTANCE_PATTERN"],
      "routing.sales": ["ROOTS_SALES_CONTEXT_PATTERN", "EXPLICIT_MARKETING_PROBLEM_PATTERN", "RESOLVED_PROBLEM_PATTERN"],
      "routing.buying_center": ["ROLE_TERMS"],
      "output.manual_sales": ["SALES_ONLY_REJECTION_PATTERN"],
    } as Record<string, string[]>,
    scoring_version: RELEVANCE_SCORING_VERSION,
    source_of_truth: "Supabase Edge Function + aktive Pipeline-Konfiguration",
    systems: {
      source: "RSS oder Sitemap der Quelle",
      crawler: "Nativer, domainbegrenzter Crawler",
      browser: "Playwright-Browser-Fallback über GitHub Actions",
      code: "Deterministische TypeScript-Regel ohne KI-Kosten",
      gemini: "Semantische Gemini-Prüfung mit strukturiertem Ergebnis",
      server: "Finale serverseitige Validierung und Speicherung",
      frontend: "Darstellung des bereits gespeicherten Ergebnisses",
    },
    ai_operations: [
      { id: "classification", title: "Hauptklassifizierung und Scoring", model: `${config.ai.primary_model} · Batch`, when: "Automatische Artikel laufen über die Gemini Batch API zum halben Tokenpreis. Nur eine bewusst gestartete Einzelvorschau antwortet sofort zum Standardpreis." },
      { id: "review", title: "Gezielte Zweitprüfung", model: config.ai.review_model, when: config.ai.review_enabled ? "Dasselbe Flash-Lite-Modell prüft nur echte Grenzfälle. Weil das Ergebnis der Hauptprüfung dafür bereits vorliegen muss, wird dieser abhängige Aufruf einzeln protokolliert." : "Derzeit deaktiviert." },
      { id: "batch", title: "Aktiver Automatikmodus", model: `${config.ai.primary_model} · Batch`, when: `Alle automatischen Analysejobs werden in Gruppen von bis zu ${config.ai.batch_size} über die Gemini Batch API eingereicht. Es gibt keinen automatischen Wechsel zum Standardpreis.` },
      { id: "offering_match", title: "ROOTS-Leistungsmatch", model: config.ai.primary_model, when: "Dasselbe Flash-Lite-Modell wird nur genutzt, wenn der deterministische Leistungsmatch einen belegten Sales-Kandidaten nicht eindeutig zuordnen kann." },
      { id: "translation", title: "Übersetzung und Darstellungsformatierung", model: config.ai.primary_model, when: "Dasselbe Flash-Lite-Modell wird nur verwendet, wenn Sprache oder Textformat eine deutsche Lesefassung erfordern." },
    ],
    stage_steps: stageSteps,
    stages: [
      {
        id: "crawl", number: "01", icon: "fa-solid fa-link", title: "Quellen und Volltext", short_title: "Quellen",
        summary: "Findet Artikel günstig über strukturierte Wege und stellt bei Bedarf den vollständigen Text im Browser wieder her.",
        input: "Aktive Quellen", check: "URL, Datum und Volltext", output: "Bereinigter Artikelkandidat",
        rules: [
          fixed("crawl.structured_first", "RSS und Sitemap zuerst", "RSS und Sitemap liefern Artikel-URLs ohne Browserkosten. Der native Crawler ergänzt nur innerhalb der erlaubten Domain.", ["source", "crawler"]),
          fixed("crawl.browser_fallback", "Browser-Fallback bei JavaScript, Blockade oder Paywall", "Wenn Direktabruf oder Quellenerkennung scheitern, übernimmt Playwright über GitHub Actions. Wiederhergestellter Volltext wird automatisch erneut analysiert.", ["browser", "server"], "browser_source_discovery_jobs und browser_article_jobs"),
          configured("crawl.freshness", "Aktualitätsfenster", "Beim initialen Crawl werden nur Artikel innerhalb dieses Rückblicks aufgenommen.", ["server"], "crawl.freshness_days", config.crawl.freshness_days, "Tage"),
          configured("crawl.future_tolerance", "Zukunftstoleranz", "Ein Datum darf nur begrenzt in der Zukunft liegen; weiter entfernte Datumswerte werden verworfen.", ["server"], "crawl.future_tolerance_hours", config.crawl.future_tolerance_hours, "Stunden"),
          configured("crawl.default_limits", "Normale Crawl-Grenzen", "Begrenzt Linktiefe und Seitenzahl für normale Quellen.", ["crawler"], "crawl.default_max_pages", config.crawl.default_max_pages, `Tiefe ${config.crawl.default_max_depth}`),
          configured("crawl.event_limits", "Strengere Grenzen für Eventquellen", "Messe-, Speaker- und Programmseiten werden enger durchsucht, damit keine Listenflut entsteht.", ["crawler"], "crawl.event_max_pages", config.crawl.event_max_pages, `Tiefe ${config.crawl.event_max_depth}`),
          fixed("crawl.batch_size", "Ein Artikel je Edge-Function-Schritt", "Der Crawl speichert seinen Fortschritt nach jedem Artikel. So bleiben lange Läufe sichtbar und laufen nicht in das Ausführungslimit.", ["server"], "article_batch_size = 1"),
        ],
      },
      {
        id: "prefilter", number: "02", icon: "fa-solid fa-filter", title: "Bereinigung und Vorfilter", short_title: "Vorfilter",
        summary: "Stoppt unvollständige Texte, Nicht-Artikel, Eigenwerbung und fachfremdes Rauschen vor dem ersten Gemini-Aufruf.",
        input: "Geladener Rohtext", check: "Textqualität und Fachsignal", output: "KI-Kandidat oder dokumentierter Stopp",
        rules: [
          fixed("prefilter.text_quality", "Vollständiger redaktioneller Text", `Normalfall: mindestens ${config.filters.minimum_text_length} Zeichen, ${EDITORIAL_TEXT_REQUIREMENTS.minimumWords} Wörter und ${EDITORIAL_TEXT_REQUIREMENTS.minimumSentences} Sätze. Dichte Kurztexte dürfen ab ${EDITORIAL_TEXT_REQUIREMENTS.denseMinimumCharacters} Zeichen, ${EDITORIAL_TEXT_REQUIREMENTS.denseMinimumWords} Wörtern und ${EDITORIAL_TEXT_REQUIREMENTS.denseMinimumSentences} Sätzen passieren. Paywall-Teaser reichen nie.`, ["code", "server"], "editorialTextQuality"),
          fixed("prefilter.non_articles", "Keine Verzeichnisse, Pressemappen oder Textsammlungen", "Kontaktseiten, Anbieterprofile, Übersichten, Downloadsammlungen und mehrere aufeinanderfolgende Versalzeilen gelten nicht als eigenständiger Artikel.", ["code"]),
          fixed("prefilter.vendor_pitch", "Keine Tool- oder Dienstleisterwerbung", "Software-, Agentur- und Beratungs-Pitches werden gestoppt. Substanzielle Studien, Whitepaper, Marktberichte und Playbooks mit Methodik und Ergebnissen dürfen weiter.", ["code"]),
          fixed("prefilter.noise", "Karriere, FAQ und reine Eventprogramme stoppen", "Jobs, Hilfeseiten, Teilnehmerlisten, Agenden und alte Eventseiten werden vor Gemini ausgeschlossen.", ["code"]),
          fixed("prefilter.professional_signal", "Breiter Fachsignal-Vorfilter", "Deutsch- und englischsprachige Signalmuster entscheiden nur, ob Gemini den Inhalt prüfen darf. Ein Keyword erzeugt niemals selbst ein Tag oder Routing.", ["code"], "professionalSignalPatterns"),
          fixed("prefilter.weak_news", "Schwache Meldungstypen stoppen", "Reine Personalien, taktische Rabatte, dünnes Sponsoring und Produktmeldungen ohne Strategie bleiben draußen.", ["code"]),
          fixed("prefilter.deduplication", "Duplikate zusammenführen", "Identische Inhalte sowie sehr ähnliche Titel- und Ereignisvarianten werden nicht mehrfach ausgewählt.", ["code", "server"]),
        ],
      },
      {
        id: "gemini", number: "03", icon: "fa-solid fa-wand-magic-sparkles", title: "Semantische KI-Prüfung", short_title: "KI-Prüfung",
        summary: "Gemini versteht den Zusammenhang, schlägt Klassifikation und Nutzwert vor und muss jede Kernaussage belegen.",
        input: "Vorgeprüfter Volltext", check: "Bedeutung, Evidenz und Nutzwert", output: "Strukturierter KI-Vorschlag",
        rules: [
          configured("gemini.primary", "Hauptmodell", "Gemini 2.5 Flash-Lite analysiert Themen, Territories, Artikeltyp, Unternehmen, Personen, Sales-Trigger, Routing und beide Nutzwert-Scores in einem strukturierten Aufruf.", ["gemini"], "ai.primary_model", config.ai.primary_model),
          configured("gemini.review", "Zweitprüfung bei echtem Grenzfall", "Ein zweiter Vollaufruf erfolgt nur bei widersprüchlicher Evidenz, einem echten manuellen Grenzfall oder einem unsicheren Sales-Kandidaten.", ["gemini", "server"], "ai.review_enabled", config.ai.review_enabled, config.ai.review_model),
          configured("gemini.batch", "Flash-Lite Batch für alle Automatikläufe", "Alle automatisch gecrawlten oder zur Neuanalyse eingereihten Artikel werden mit Gemini 2.5 Flash-Lite asynchron zum halben Tokenpreis verarbeitet. Ein fehlgeschlagener Batch wechselt nicht unbemerkt auf den Standardpreis.", ["gemini", "supabase"], "ai.batch_enabled", config.ai.batch_enabled, `gemini-2.5-flash-lite · bis ${config.ai.batch_size} Artikel`),
          fixed("ai.no_provider_fallback", "Kein externer Modell-Fallback", "Wenn das konfigurierte Gemini-Modell ausfällt, wird keine NVIDIA- oder andere Drittanbieter-KI verwendet. Die Hauptanalyse wird als technischer Fehler protokolliert; scheitert nur die optionale Zweitprüfung, bleibt die bereits validierte Hauptanalyse erhalten.", ["gemini", "server"]),
          fixed("gemini.evidence", "Wörtliche Belege sind Pflicht", "Themen, Unternehmen, Personen, Trigger und Routing müssen jeweils durch eine konkrete Passage aus Titel oder Artikeltext gestützt sein.", ["gemini"]),
          fixed("gemini.untrusted", "Artikeltext ist keine Anweisung", "Der Prompt behandelt den Artikel als nicht vertrauenswürdige Daten und ignoriert darin enthaltene Instruktionen.", ["gemini", "server"]),
          fixed("gemini.scores", "Zwei getrennte Nutzwert-Scores", "Marketing misst den möglichen Wert als Grundlage für ROOTS-Assets. Sales misst die konkrete Opportunity bei einem Tier-1-Kunden. Beides ist keine Modellkonfidenz.", ["gemini"]),
        ],
      },
      {
        id: "validation", number: "04", icon: "fa-solid fa-shield-halved", title: "Servervalidierung", short_title: "Validierung",
        summary: "Der Server vertraut dem KI-Vorschlag nicht blind, sondern prüft IDs, Schwellen, Zitate und deren fachliche Bedeutung.",
        input: "KI-Vorschlag", check: "Schwellen und Originalbelege", output: "Zuverlässig, Grenzfall oder abgelehnt",
        rules: [
          fixed("validation.exact_evidence", "Originalbeleg muss existieren", "Jede Evidenz wird normalisiert mit Titel und Artikeltext abgeglichen. Erfundenes oder nur sinngemäßes Zitat wird verworfen.", ["server"]),
          fixed("validation.topic_context", "Beleg muss semantisch zum Tag passen", "Customer-Belege müssen Kunden oder Verhalten betreffen; Marketing-Belege Marke, Kommunikation oder CX; Retail-Belege Handel, Sortiment, Pricing, Promotion oder Store.", ["code", "server"]),
          fixed("validation.operations_guard", "Industrie- und Operations-Schutz", "Produktion, Fabrik, Batterie, Maschinen, Energie, Logistik und Lieferkette reichen ohne separaten Marketing-, Customer- oder Retail-Beleg nicht.", ["code", "gemini", "server"]),
          configured("validation.quality_profile", "Gemeinsames Qualitätsprofil", "Das Profil setzt alle Konfidenzschwellen konsistent. Automatisches Routing braucht zusätzlich den Status zuverlässig.", ["server"], "experience.quality_profile", config.experience.quality_profile, `Thema ${config.quality.topic_confidence}; Routing ${config.quality.routing_confidence}; zuverlässig ${config.quality.reliable_confidence}`),
          configured("validation.ai_application", "Konkrete KI-Anwendung", "Wenn aktiv, reichen allgemeine KI-Meinungen nicht; Anwendung, Pilot oder Wirkung müssen im Beleg stehen.", ["code", "server"], "relevance.require_ai_application", config.relevance.require_ai_application),
          configured("validation.subsector_transfer", "Übertragbarer Sub-Branchen-Insight", "Wenn aktiv, muss die Erkenntnis über einen einzelnen Unternehmensfall hinaus relevant sein.", ["gemini", "server"], "relevance.require_subsector_transferability", config.relevance.require_subsector_transferability),
          fixed("validation.article_type", "Zulässiger Artikeltyp und deutscher Titel", "Der Artikeltyp wird normalisiert. Sonstiges bleibt ausgeschlossen; eine automatische Freigabe benötigt außerdem einen faktentreuen deutschen Titel.", ["code", "server"]),
        ],
      },
      {
        id: "routing", number: "05", icon: "fa-solid fa-code-branch", title: "Marketing, Sales und Buying Center", short_title: "Routing",
        summary: "Marketing und Sales werden fachlich getrennt geprüft. Besteht Sales vollständig, hat es in der sichtbaren Ausgabe Vorrang vor Marketing.",
        input: "Validierte Klassifikation", check: "Track-spezifische Pflichtbedingungen", output: "Genau passende Route oder Grenzfall",
        rules: [
          configured("routing.marketing", "Marketing braucht belegten Asset-Nutzen", "Status zuverlässig, direktes semantisch passendes ROOTS-Thema, veröffentlichungsfähiger Marketing-Nutzen und Routing-Evidenz sind Pflicht.", ["gemini", "server"], "routing.marketing_enabled", config.routing.marketing_enabled),
          configured("routing.subsector", "Übertragbarer Sub-Branchen-Insight kann Marketing sein", "Wenn aktiv, darf eine übertragbare Marktbeobachtung auch ohne weiteres Kernthema Marketing werden. Sie braucht weiterhin Evidenz und veröffentlichungsfähigen Nutzwert.", ["gemini", "server"], "routing.subsector_alone_is_marketing", config.routing.subsector_alone_is_marketing),
          configured("routing.sales", "Sales braucht einen konkreten Tier-1-Bedarf", "Pflicht sind: zuverlässiger Status, aktives Tier-1 als Hauptgegenstand oder Betroffener, strategischer Trigger, unternehmensspezifischer Beleg, ROOTS-relevanter Beratungsbedarf und ein konkreter ROOTS-Leistungsmatch.", ["gemini", "server"], "routing.sales_enabled", config.routing.sales_enabled),
          fixed("routing.offering", "ROOTS-Leistungsmatch ist ein harter Sales-Gate", "Der zusätzliche Match-Aufruf darf nur eine gespeicherte ROOTS-Leistung mit exaktem Artikelbeleg auswählen. Ohne belastbaren Match wird nicht automatisch Sales geroutet.", ["gemini", "server"]),
          fixed("routing.exclusive", "Sales und Marketing erscheinen nicht doppelt", "Beide Tracks werden zunächst unabhängig bewertet. Wenn Sales alle Bedingungen besteht, erhält Sales die sichtbare Route und Marketing wird für denselben Artikel unterdrückt.", ["server"], "salesRouted; marketingRouted = marketingEligible && !salesRouted"),
          configured("routing.buying_center", "Buying Center erst nach Sales", "Erst ein erfolgreiches Sales-Signal kann passende Personen oder konkrete Zielrollen erhalten.", ["gemini", "server"], "routing.buying_center_enabled", config.routing.buying_center_enabled),
          fixed("routing.marketing_score", "Marketing-Asset-Score", "Gewichtung: 25 % Neuigkeit, 30 % strategischer Wert, 25 % Übertragbarkeit und 20 % Evidenz. Wiederkehrende Tracker und schwächere Formate werden gedeckelt.", ["gemini", "server"], JSON.stringify(MARKETING_SCORE_WEIGHTS)),
          fixed("routing.sales_score", "Sales-Opportunity-Score", "Gewichtung: 32 % Problemstärke, 30 % ROOTS-Fit, 23 % Kaufabsicht und 15 % Timing. Breite Trigger, fehlende Hilfesuche und reine Kreativumsetzung werden gedeckelt.", ["gemini", "server"], JSON.stringify(SALES_SCORE_WEIGHTS)),
        ],
      },
      {
        id: "output", number: "06", icon: "fa-solid fa-table-cells-large", title: "Ergebnis und manuelle Prüfung", short_title: "Ergebnis",
        summary: "Speichert nicht nur das Ergebnis, sondern auch Prüfpfad, Modelle, Belege, Scores und Gründe für spätere Nachvollziehbarkeit.",
        input: "Final geprüfte Tracks", check: "Datum und Mindestsubstanz", output: "Kachel, manuelle Prüfung, Archiv oder Fehler",
        rules: [
          fixed("output.no_date", "Ohne Veröffentlichungsdatum immer Archiv", "Ein Artikel ohne belastbares Datum wird unabhängig von KI-Score und möglichen Routen nicht veröffentlicht.", ["server"]),
          fixed("output.manual_marketing", "Marketing-Grenzfall braucht echte Evidenz", "Manuelle Prüfung ist nur möglich, wenn ein direktes ROOTS-Thema und ein konkreter Marketing-Beleg vorhanden sind, aber etwa Übertragbarkeit, Substanz oder Sicherheit offen bleiben.", ["server"]),
          fixed("output.manual_sales", "Sales-Grenzfall braucht Tier-1 und Herausforderung", "Manuelle Prüfung setzt Tier-1, Trigger, unternehmensspezifische Evidenz, konkrete Herausforderung und ROOTS-Relevanz voraus. Ohne diese Basis geht der Artikel ins Archiv.", ["server"]),
          fixed("output.archive", "Kein Signal bedeutet Archiv statt Prüfliste", "Wenn weder Marketing noch Sales genügend Pflichtkriterien für eine menschliche Abwägung erfüllt, wird der Artikel sicher abgelehnt und archiviert.", ["server"]),
          fixed("output.error", "Technische Fehler sind keine fachliche Ablehnung", "Extraktionsfehler, Quota, Timeout oder unlesbare Modellantwort bleiben als Fehler sichtbar und können erneut verarbeitet werden.", ["server", "frontend"]),
          fixed("output.audit", "Vollständiger Prüfpfad", "Extraktion, deterministische Regeln, verwendete Modelle, Prompt-Version, Belege, Leistungsmatch, Scores, manuelle Tracks und finale Route werden am Artikel gespeichert.", ["server", "frontend"]),
        ],
      },
    ],
  };
}

export const TOPIC_IDS = [
  "customer_insights", "marketing_insights", "fmcg_retail_signale",
  "sub_branchen_insight", "ki_performance",
] as const;

export const TERRITORY_IDS = [
  "wachstumstreiber", "markenaktivierung", "marke_im_wandel",
  "operational_excellence", "empowered_marketers",
] as const;

export const ARTICLE_TYPES = [
  "news", "analysis", "interview", "opinion", "study", "whitepaper", "report",
  "case_study", "press_release", "company_update", "event_report", "other",
] as const;

export const NON_RELEVANT_ARTICLE_TYPES = new Set(["other"]);

export type AiTag = { id: string; confidence: number; evidence: string };

export type AiCompany = {
  name: string;
  role: "primary_subject" | "affected_party" | "incidental_mention";
  confidence: number;
  evidence: string;
};

export type AiPerson = { name: string; role: string; confidence: number; evidence: string };

export const SALES_TRIGGER_IDS = [
  "acquisition", "merger", "market_entry", "market_expansion", "investment",
  "restructuring", "portfolio_change", "transformation", "rebranding",
  "campaign_launch", "agency_change", "ai_initiative", "retail_strategy",
  "new_business_model", "event_participation", "marketing_problem",
] as const;

export const SALES_TRIGGERS_REQUIRING_ROOTS_CONTEXT = new Set([
  "acquisition", "merger", "market_entry", "market_expansion", "investment",
  "restructuring", "portfolio_change", "rebranding", "campaign_launch",
  "event_participation", "marketing_problem",
]);

export const BROAD_SALES_TRIGGER_IDS = new Set([
  "acquisition", "merger", "market_entry", "market_expansion", "investment",
]);

export const ROOTS_SALES_CONTEXT_PATTERN = /\b(agency|agentur|consult\w*|beratung|advis\w*|partner(?:ship)?|partnerschaft|pitch|tender|ausschreibung|mandat|budget|marketing (?:organi[sz]ation|operating model|transformation|strateg\w*|capabilit\w*|technolog\w*)|marketingorgani[sz]ation|marketingtransformation|marketingstrateg\w*|martech|customer insights?|consumer insights?|shopper insights?|retail media|category management|value proposition|nutzenversprechen\w*|wertversprechen\w*|preisposition\w*|preisstellung\w*|nutzenargument\w*|brand (?:strateg\w*|position\w*|transform\w*|architecture)|marke\w* strateg\w*|markenstrateg\w*|markenpositionier\w*|markentransform\w*|markenarchitektur|customer experience|customer journey|kundenerlebnis|target group\w*|zielgruppe\w*|direct[- ]to[- ]consumer|\bd2c\b|sell[- ]through|marketplace elevation|marketplace strateg\w*|operating model|organisationsmodell|capabilit\w*|kompetenzaufbau)\b/i;

export const OPERATIONAL_ONLY_PATTERN = /\b(factory|factories|plant|production|manufactur\w*|filling|packaging|warehouse|logistics|machinery|machine|facility|facilities|site|sites|fabrik\w*|werk(?:e|en)?|produktions\w*|herstell\w*|abfull\w*|abfuell\w*|verpackung\w*|lager\w*|logistik\w*|maschine\w*|betriebsstatte\w*|standort\w*)\b/i;

export const EXPLICIT_MARKETING_PROBLEM_PATTERN = /\b(problem\w*|challenge\w*|challenged|headwind\w*|declin\w*|sell[- ]through|herausforderung\w*|ruckgang\w*|verlust\w*|stagn\w*|verfehl\w*|scheiter\w*|ineffiz\w*|fragment\w*|silo\w*|mangel\w*|lucke\w*|risiko\w*|akzeptanzproblem\w*|vertrauensverlust\w*|relevanzverlust\w*|kostendruck\w*|umsatzdruck\w*|absatzproblem\w*|wettbewerbsdruck\w*|konsumzuruckhaltung\w*)\b/i;

export const RESOLVED_PROBLEM_PATTERN = /\b(fully resolved|completely resolved|problem solved|challenge solved|vollstandig gelost|abschliessend gelost|bereits behoben|successfully completed|erfolgreich abgeschlossen)\b/i;

export function isExplicitUnresolvedMarketingProblem(evidence: string): boolean {
  const normalized = normalizeMatchText(evidence);
  return EXPLICIT_MARKETING_PROBLEM_PATTERN.test(normalized)
    && ROOTS_SALES_CONTEXT_PATTERN.test(normalized)
    && !RESOLVED_PROBLEM_PATTERN.test(normalized);
}

export type AiSalesTrigger = { id: string; confidence: number; evidence: string };

export type AiRouteDecision = { eligible: boolean; confidence: number; evidence: string; reason: string };

export type AiMarketingUse = { publishable: boolean; transferable_value: string; sufficient_substance: boolean; evidence: string };

export type AiSalesUse = { actionable: boolean; company_challenge: string; roots_relevance: string; sufficient_substance: boolean; personalization_facts: string[]; evidence: string };

export type AiBuyingCenter = { recommended_roles: string[]; research_required: boolean };

export type AiMarketingScore = { novelty: number; strategic_value: number; transferability: number; evidence_strength: number; reason: string };

export type AiSalesScore = { problem_strength: number; roots_fit: number; buying_intent: number; timing: number; reason: string };

export type AiClassification = {
  relevance_status: "reliable" | "uncertain" | "rejected";
  overall_confidence: number;
  article_type: string;
  language: "de" | "en" | "other";
  title_de: string;
  summary: string;
  rationale: string;
  topics: AiTag[];
  territory: AiTag;
  companies: AiCompany[];
  people: AiPerson[];
  market_insight_transferable: boolean;
  market_insight_explanation: string;
  sales_triggers: AiSalesTrigger[];
  marketing_use: AiMarketingUse;
  sales_use: AiSalesUse;
  buying_center: AiBuyingCenter;
  marketing_asset_value: AiMarketingScore;
  sales_opportunity_value: AiSalesScore;
  routing_decisions: { marketing: AiRouteDecision; sales: AiRouteDecision };
  rejection_reasons: string[];
  event_key: string;
};

export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: [
    "relevance_status", "overall_confidence", "article_type", "language", "title_de", "summary",
    "rationale", "topics", "territory", "companies", "people", "market_insight_transferable",
    "market_insight_explanation", "sales_triggers", "marketing_use", "sales_use", "buying_center",
    "routing_decisions", "marketing_asset_value", "sales_opportunity_value", "rejection_reasons", "event_key",
  ],
  properties: {
    relevance_status: { type: "STRING", enum: ["reliable", "uncertain", "rejected"] },
    overall_confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    article_type: { type: "STRING", enum: [...ARTICLE_TYPES] },
    language: { type: "STRING", enum: ["de", "en", "other"] },
    title_de: { type: "STRING", description: "Faithful German translation of the article title; preserve names, brands, numbers and meaning." },
    summary: { type: "STRING", description: "German summary, maximum two concise sentences." },
    rationale: { type: "STRING", description: "German reason why this is or is not a ROOTS signal." },
    topics: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["id", "confidence", "evidence"],
        properties: {
          id: { type: "STRING", enum: [...TOPIC_IDS] },
          confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          evidence: { type: "STRING" },
        },
      },
    },
    territory: {
      type: "OBJECT",
      required: ["id", "confidence", "evidence"],
      properties: {
        id: { type: "STRING", enum: ["none", ...TERRITORY_IDS] },
        confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
        evidence: { type: "STRING" },
      },
    },
    companies: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["name", "role", "confidence", "evidence"],
        properties: {
          name: { type: "STRING" },
          role: { type: "STRING", enum: ["primary_subject", "affected_party", "incidental_mention"] },
          confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          evidence: { type: "STRING" },
        },
      },
    },
    people: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["name", "role", "confidence", "evidence"],
        properties: {
          name: { type: "STRING" },
          role: { type: "STRING" },
          confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          evidence: { type: "STRING" },
        },
      },
    },
    market_insight_transferable: { type: "BOOLEAN", description: "True only when the article contains a market insight transferable beyond the single company event." },
    market_insight_explanation: { type: "STRING", description: "German explanation of why the sub-sector observation is or is not transferable." },
    sales_triggers: {
      type: "ARRAY",
      items: {
        type: "OBJECT", required: ["id", "confidence", "evidence"],
        properties: {
          id: { type: "STRING", enum: [...SALES_TRIGGER_IDS] },
          confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          evidence: { type: "STRING" },
        },
      },
    },
    marketing_use: {
      type: "OBJECT", required: ["publishable", "transferable_value", "sufficient_substance", "evidence"],
      properties: {
        publishable: { type: "BOOLEAN" },
        transferable_value: { type: "STRING", description: "Brief German explanation of the general audience value; do not create a post idea or title." },
        sufficient_substance: { type: "BOOLEAN", description: "Whether the source contains enough facts for later editorial development." },
        evidence: { type: "STRING", description: "Verbatim evidence for the transferable value." },
      },
    },
    sales_use: {
      type: "OBJECT", required: ["actionable", "company_challenge", "roots_relevance", "sufficient_substance", "personalization_facts", "evidence"],
      properties: {
        actionable: { type: "BOOLEAN" },
        company_challenge: { type: "STRING", description: "Concrete company-specific strategic challenge in German." },
        roots_relevance: { type: "STRING", description: "Why ROOTS can credibly contribute, in German." },
        sufficient_substance: { type: "BOOLEAN", description: "Whether enough article facts exist for later personalized content development." },
        personalization_facts: { type: "ARRAY", items: { type: "STRING" }, description: "Article facts that make later outreach specific; do not create an asset, idea or title." },
        evidence: { type: "STRING", description: "Verbatim evidence for the challenge or strategic change." },
      },
    },
    buying_center: {
      type: "OBJECT", required: ["recommended_roles", "research_required"],
      properties: {
        recommended_roles: { type: "ARRAY", items: { type: "STRING" }, description: "One to four specific business roles that would benefit from the proposed asset." },
        research_required: { type: "BOOLEAN", description: "True when a fitting named person is not proven by the article." },
      },
    },
    routing_decisions: {
      type: "OBJECT", required: ["marketing", "sales"],
      properties: {
        marketing: { type: "OBJECT", required: ["eligible", "confidence", "evidence", "reason"], properties: {
          eligible: { type: "BOOLEAN" }, confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          evidence: { type: "STRING" }, reason: { type: "STRING" },
        } },
        sales: { type: "OBJECT", required: ["eligible", "confidence", "evidence", "reason"], properties: {
          eligible: { type: "BOOLEAN" }, confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          evidence: { type: "STRING" }, reason: { type: "STRING" },
        } },
      },
    },
    marketing_asset_value: { type: "OBJECT", required: ["novelty", "strategic_value", "transferability", "evidence_strength", "reason"], properties: {
      novelty: { type: "NUMBER", minimum: 0, maximum: 100 }, strategic_value: { type: "NUMBER", minimum: 0, maximum: 100 },
      transferability: { type: "NUMBER", minimum: 0, maximum: 100 }, evidence_strength: { type: "NUMBER", minimum: 0, maximum: 100 }, reason: { type: "STRING" },
    } },
    sales_opportunity_value: { type: "OBJECT", required: ["problem_strength", "roots_fit", "buying_intent", "timing", "reason"], properties: {
      problem_strength: { type: "NUMBER", minimum: 0, maximum: 100 }, roots_fit: { type: "NUMBER", minimum: 0, maximum: 100 },
      buying_intent: { type: "NUMBER", minimum: 0, maximum: 100 }, timing: { type: "NUMBER", minimum: 0, maximum: 100 }, reason: { type: "STRING" },
    } },
    rejection_reasons: { type: "ARRAY", items: { type: "STRING" } },
    event_key: { type: "STRING", description: "Stable short event key without dates or filler words." },
  },
};

export function looksLikeEditorialCollection(title: string, text: string): boolean {
  const normalizedTitle = normalizeMatchText(title);
  const normalized = normalizeMatchText(text.slice(0, 12_000));
  const explicitCollectionTitle = /\b(pressemappe|press kit|media kit|download center|medienmappe|presseunterlagen|press materials?)\b/i.test(normalizedTitle);
  const assetMarkers = (normalized.match(/\b(factsheet|fact sheet|download|logo|historie|bildmaterial|pressefoto|press photo|pressemeldung|pressemitteilung)\b/gi) || []).length;
  const lines = text.split("\n").map((line) => line.replace(/^#{1,6}\s+|^-\s+/, "").trim()).filter(Boolean);
  const proseLines = lines.filter((line) => line.split(/\s+/).length >= 9 && /[.!?][”»\"]?$/.test(line));
  const headlineLike = lines.filter((line) => {
    const letters = line.match(/[A-Za-zÄÖÜäöüß]/g) || [];
    const upper = line.match(/[A-ZÄÖÜ]/g) || [];
    const words = line.split(/\s+/).length;
    return words >= 4 && words <= 24 && (!/[.!?][”»\"]?$/.test(line) || letters.length >= 12 && upper.length / letters.length >= 0.72);
  });
  // A press-kit title is sufficient when the body also behaves like an asset
  // index. For generic pages require several independent collection signals;
  // uppercase is deliberately only supporting evidence, never a sole reject.
  return explicitCollectionTitle && (assetMarkers >= 2 || headlineLike.length >= 3 || proseLines.length < 2)
    || assetMarkers >= 4 && headlineLike.length >= 4 && headlineLike.length > proseLines.length * 2;
}

export function hasConsecutiveAllCapsSentences(text: string): boolean {
  let consecutive = 0;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^#{1,6}\s+|^-\s+|\*+/g, "").trim();
    if (!line) continue;
    const letters = line.match(/[A-Za-zÄÖÜäöüß]/g) || [];
    const upper = line.match(/[A-ZÄÖÜ]/g) || [];
    const words = line.split(/\s+/).filter(Boolean).length;
    const sentenceLike = line.length >= 35 && words >= 6;
    const allCaps = sentenceLike && letters.length >= 20 && upper.length / letters.length >= 0.78;
    consecutive = allCaps ? consecutive + 1 : 0;
    if (consecutive >= 3) return true;
  }
  return false;
}

export function editorialTextQuality(text: string, config: PipelineConfig = DEFAULT_PIPELINE_CONFIG): {
  sufficient: boolean; length: number; words: number; sentences: number; reason: string;
} {
  const cleaned = cleanArticleText(text);
  const length = cleaned.length;
  const words = cleaned.split(/\s+/).filter((word) => /[A-Za-zÄÖÜäöüß]/.test(word)).length;
  const sentences = (cleaned.match(/[.!?](?:[”»"')\]]|\s|$)/g) || []).length;
  const requiredLength = Math.max(EDITORIAL_TEXT_REQUIREMENTS.minimumCharacters, Number(config.filters.minimum_text_length || 0));
  const enoughProse = length >= requiredLength
    && words >= EDITORIAL_TEXT_REQUIREMENTS.minimumWords
    && sentences >= EDITORIAL_TEXT_REQUIREMENTS.minimumSentences;
  const denseShortArticle = length >= EDITORIAL_TEXT_REQUIREMENTS.denseMinimumCharacters
    && words >= EDITORIAL_TEXT_REQUIREMENTS.denseMinimumWords
    && sentences >= EDITORIAL_TEXT_REQUIREMENTS.denseMinimumSentences;
  const sufficient = !looksLikePaywallTeaser(cleaned) && (enoughProse || denseShortArticle);
  const reason = sufficient ? "Ausreichender redaktioneller Volltext"
    : looksLikePaywallTeaser(cleaned) ? "Paywall- oder Login-Auszug statt Volltext"
      : `Nur ${length} Zeichen, ${words} Wörter und ${sentences} vollständige Sätze nach Bereinigung`;
  return { sufficient, length, words, sentences, reason };
}

export function isVendorSalesPitch(title: string, text: string): boolean {
  const normalized = normalizeMatchText(`${title} ${text.slice(0, 9000)}`);
  const vendorOffer = /\b(software|saas|tool\w*|plattform\w*|platform\w*|losung\w*|solution\w*|system\w*|dienstleistung\w*|service\w*|beratung\w*|consulting|agentur\w*|agency|anbieter\w*|provider\w*|practice|capabilit\w*)\b/i.test(normalized);
  const selfPromotional = /\b(unsere? (?:software|plattform|losung|tool\w*|service\w*|dienstleistung\w*|beratung\w*|expert\w*|kompetenz\w*)|our (?:software|platform|solution|tool\w*|service\w*|practice|capabilit\w*|expert\w*)|wir (?:bieten|helfen|unterstutzen|entwickeln|ermoglichen|analysieren)|we (?:offer|help|support|provide|enable|develop|analyse|analyze|partner)|(?:we |our practice )?help(?:s)? you|ist spezialist fur|spezialist fur|anbieter von|provider of|unsere kunden|our customers|grow your (?:brand|business)|ihre (?:marke|unternehmen) (?:wachsen|starken)|kontaktieren sie uns|contact us|work with us|demo (?:anfordern|buchen)|request a demo)\b/i.test(normalized);
  const profileOrPitchPage = /\b(anbieterprofil|unternehmensprofil|company profile|supplier profile|produktmeldung|product announcement)\b/i.test(normalized)
    || /\b(gmbh|ag|ltd|inc|llc)\b/i.test(normalizeMatchText(title)) && selfPromotional;

  // Other consultancies/agencies remain valuable when they expose an actual
  // knowledge asset with evidence, not merely when a pitch calls its output
  // an "analysis" or "insight".
  const empiricalKnowledgeAsset = /\b(studie|study|studies|survey|umfrage|befragung|benchmark(?:ing)? report)\b/i.test(normalized);
  const analyticalKnowledgeAsset = /\b(whitepaper|white paper|research paper|forschungspapier|playbook|marktbericht|market report|trendbericht|trend report)\b/i.test(normalized);
  const knowledgeSignals = [
    /\b(methodik|methodology|stichprobe|sample size|befrag\w*|interviews?|erheb\w*|respondent\w*|teilnehm\w*|participants?)\b/i,
    /\b(ergebnis\w*|findings?|untersuchung\w*|survey|umfrage|benchmark\w*)\b/i,
    /\b\d+(?:[.,]\d+)? (?:prozent|percent)|\d+(?:[.,]\d+)?%\b/i,
    /\b(trend\w*|branchenentwicklung\w*|market development|consumer behavior|konsumverhalten|customer insight\w*)\b/i,
  ].filter((pattern) => pattern.test(normalized)).length;
  const hasMethod = /\b(methodik|methodology|stichprobe|sample size|befrag\w*|interviews?|erheb\w*|respondent\w*|teilnehm\w*|participants?)\b/i.test(normalized);
  const hasFinding = /\b(ergebnis\w*|findings?|zeigt|found|reveals?|conclusion\w*|schlussfolger\w*|handlungsfeld\w*)\b/i.test(normalized);
  const substantiveKnowledgeAsset = empiricalKnowledgeAsset
    ? hasMethod && (hasFinding || knowledgeSignals >= 2)
    : analyticalKnowledgeAsset && hasFinding && knowledgeSignals >= 2;
  return vendorOffer && (selfPromotional || profileOrPitchPage) && !substantiveKnowledgeAsset;
}

export type EventFilterContext = {
  sourceCategory?: string;
  tier1Companies?: Array<{ name: string; aliases: string[] }>;
};

export function hardRejectionReasons(
  title: string,
  text: string,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
  eventContext: EventFilterContext = {},
): string[] {
  // Long reports often put their findings after navigation, author and methodology copy.
  const normalized = normalizeMatchText(`${title} ${selectClassifierContent(text, 12_000)}`);
  const articleText = `${title}\n${text}`;
  const eventCompanies = selectCompanyCandidates(articleText, eventContext.tier1Companies || []);
  const qualifiedEventParticipation = hasQualifiedTier1EventParticipation(articleText, eventCompanies);
  const independentEventReport = hasIndependentEventReportSubstance(articleText);
  const reasons: string[] = [];
  const careerHits = CAREER_CONTENT_TERMS.filter((term) => containsMatchTerm(normalized, term)).length;
  if (config.filters.reject_career_pages && careerHits >= 3) reasons.push("Karriere-, Bewerbungs- oder Ausbildungsinhalt");
  if (config.filters.reject_faq_pages && /\b(faq|frequently asked questions|fragen und antworten|noch fragen)\b/i.test(title)) reasons.push("FAQ- oder Hilfeseite");
  const genericEventDirectoryTitle = /^(?:event\s+)?(?:attendees|speakers|agenda|schedule|tickets|event program|teilnehmer|programm|anmeldung)(?:\s+\d{4})?$/i.test(title.trim());
  if (config.filters.reject_event_programs
      && (genericEventDirectoryTitle
        || /\b(attendees|speakers|agenda|schedule|tickets|event program|teilnehmer|programm|anmeldung)\b/i.test(title)
          && !qualifiedEventParticipation && !independentEventReport
          && !/\b(report|rückblick|results|ergebnisse|launch|kampagne|strategy|strategie)\b/i.test(title))) {
    reasons.push("Event-, Teilnehmer- oder Programmseite ohne strategisches Signal");
  }
  const directoryOrListing = /\b(media contacts?|kontakt|anbieter|supplier|company profile|unternehmensprofil)\b/i.test(title)
    || (/^media(?:\s*\||$)/i.test(title.trim()) && /\b(latest news|reports?|publications?|download)\b/i.test(text))
    || (/\b(tel\.?|fax|e-mail|grundungsjahr|mitarbeiter)\b/i.test(text) && /\b(adresse|strasse|straße|internet|www\.)\b/i.test(text))
    || ((text.match(/\b(download file|read more)\b/gi) || []).length >= 6 && /\b(media|downloads?|publications?)\b/i.test(title));
  if (directoryOrListing) reasons.push("Verzeichnis-, Kontakt- oder Übersichtsseite ohne redaktionellen Artikel");
  if (looksLikeEditorialCollection(title, text)) {
    reasons.push("Pressemappe, Download- oder Meldungssammlung ohne eigenständigen redaktionellen Artikel");
  }
  if (hasConsecutiveAllCapsSentences(text)) {
    reasons.push("Mehrere aufeinanderfolgende Versalzeilen statt eines redaktionell formatierten Artikeltexts");
  }
  if (isVendorSalesPitch(title, text)) {
    reasons.push("Anbieter-, Tool- oder Dienstleister-Sales-Pitch ohne belastbare Studie, Paper, Playbook oder unabhängige Branchenerkenntnis");
  }
  const normalizedTitle = normalizeMatchText(title);
  const normalizedText = normalizeMatchText(text);
  // A feed teaser remains useful as a recovery hint, but it is not a full
  // article and therefore must never enter semantic classification/manual
  // review. Browser recovery gets a chance first; otherwise this stays a
  // technical extraction error.
  const contentUnavailable = !editorialTextQuality(text, config).sufficient;
  if (contentUnavailable) reasons.push("Artikelinhalt nicht verfügbar oder Extraktion fehlgeschlagen");
  if (!contentUnavailable && eventContext.sourceCategory === "Events & Messen" && !qualifiedEventParticipation) {
    reasons.push("Eventquelle ohne belegten Tier-1-Auftritt einer benannten Person mit Rolle, tatsächlichem Beitrag und ROOTS-relevantem Thema");
  } else if (!contentUnavailable && eventContext.sourceCategory !== "Events & Messen"
      && !qualifiedEventParticipation && isBareEventAnnouncement(articleText)) {
    reasons.push("Bloße Eventteilnahme oder Auftrittsankündigung ohne qualifizierten Tier-1-Beitrag");
  }
  const titleYear = title.match(/\b(20\d{2})\b/)?.[1];
  if (titleYear && Number(titleYear) <= new Date().getUTCFullYear() - 2
      && /\b(event|messe|festival|conference|konferenz|forum|summit|all in)\b/i.test(title)) {
    reasons.push("Veralteter Eventinhalt trotz aktuellem Crawl-Datum");
  }
  const professionalSignalPatterns = [
    /\b(markenstrateg\w*|markenpositionier\w*|rebrand\w*|relaunch\w*|kampagn\w*|markenaktivier\w*)\b/i,
    /\b(brand strateg\w*|brand position\w*|campaign\w*|brand activat\w*|media strateg\w*)\b/i,
    /\b(kaufverhalten|konsumverhalten|kundenerlebnis|kundenbind\w*|zielgrupp\w*|shopper insight\w*)\b/i,
    /\b(consumer behavio\w*|customer experience|customer insight\w*|customer loyalty|target audience\w*)\b/i,
    /\b(brand strength|brand health|brand relevance|consumer demand|consumer engagement|serve consumers?|marketplace elevation|sell[- ]through|top[- ]line headwinds?)\b/i,
    /\b(markenstarke|markengesundheit|markenrelevanz|konsumentennachfrage|kundenansprache|absatzproblem\w*|umsatzdruck\w*)\b/i,
    /\b(sortiment\w*|eigenmark\w*|handelsmark\w*|kategoriemanagement|preisstrateg\w*|aktionsmechanik\w*|filialkonzept\w*)\b/i,
    /\b(assortment strateg\w*|private label\w*|category management|pricing strateg\w*|promotion strateg\w*|store concept\w*)\b/i,
    /\b(ki[- ](?:initiative|anwendung|plattform)|kunstliche intelligenz|generative ai|ai[- ](?:initiative|platform|application)|automation\w*)\b/i,
    /\b(markteintritt|marktexpansion|wachstumsstrateg\w*|geschaftsmodell\w*|portfolio(?:anderung|transformation)|restrukturier\w*)\b/i,
    /\b(market entr\w*|market expansion|growth strateg\w*|business model\w*|portfolio (?:change|transformation)|restructur\w*)\b/i,
    /\b(acquisition|merger|ubernahm\w*|fusion\w*|agency change|agenturwechsel|retail strateg\w*)\b/i,
  ];
  // Relevance cannot be judged from a teaser/consent shell. Keep extraction
  // failures diagnostically separate from genuine no-signal rejections.
  if (!contentUnavailable && config.filters.require_professional_signal && !professionalSignalPatterns.some((pattern) => pattern.test(normalized))) {
    reasons.push("Kein fachliches Marketing-, Retail-, Customer-, Innovations- oder Strategiesignal");
  }
  if (config.decisions.reject_pure_appointments
      && /\b(appoint\w*|named|ernenn\w*|beruf\w*|neue?r? (?:ceo|cmo|geschaftsfuhrer|marketingleiter))\b/i.test(normalized)
      && !/\b(strateg\w*|transform\w*|kampagn\w*|campaign\w*|rebrand\w*|market entr\w*|markteintritt)\b/i.test(normalized)) {
    reasons.push("Reine Personalernennung ohne strategischen Trigger");
  }
  if (!config.relevance.allow_product_launch_without_strategy
      && /\b(product launch|produkteinfuhr\w*|produktneuheit\w*)\b/i.test(normalized)
      && !/\b(strateg\w*|position\w*|kampagn\w*|campaign\w*|target audience|zielgrupp\w*)\b/i.test(normalized)) {
    reasons.push("Reiner Produktlaunch ohne Marketing- oder Strategiesignal");
  }
  return [...new Set(reasons)];
}

export function publicationDateRejectionReasons(
  publishedAt: string | null | undefined,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
  nowMs = Date.now(),
): string[] {
  // Unknown dates remain eligible here and are kept archive-only later.
  if (!publishedAt) return [];
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return [];
  const oldest = nowMs - Math.max(1, config.crawl.freshness_days) * 24 * 60 * 60 * 1000;
  const newest = nowMs + Math.max(0, config.crawl.future_tolerance_hours) * 60 * 60 * 1000;
  if (timestamp < oldest) return [`Bestätigtes Veröffentlichungsdatum liegt außerhalb des ${config.crawl.freshness_days}-Tage-Aktualitätsfensters`];
  if (timestamp > newest) return [`Bestätigtes Veröffentlichungsdatum liegt mehr als ${config.crawl.future_tolerance_hours} Stunden in der Zukunft`];
  return [];
}

export const DIRECT_MARKETING_TOPIC_IDS = new Set(["customer_insights", "marketing_insights", "fmcg_retail_signale"]);

export const CUSTOMER_CONTEXT_PATTERN = /\b(customer|consumer|shopper|kund\w*|konsument\w*|verbraucher\w*|zielgrupp\w*|kaufverhalten|konsumverhalten|loyalty|customer journey|customer experience|kundenerlebnis)\b/i;

export const CUSTOMER_INSIGHT_SIGNAL_PATTERN = /\b(behavior|behaviour|verhalten\w*|bedurf\w*|need\w*|erwart\w*|expect\w*|praferenz\w*|prefer\w*|akzeptanz\w*|zufrieden\w*|frustr\w*|vertrauen\w*|loyalty|kundenbindung\w*|kaufabbruch\w*|anbieterwechsel\w*|befrag\w*|umfrage\w*|studie\w*|research|insight\w*|erkenntnis\w*|prozent|percent|\d+(?:[.,]\d+)?\s*%)\b/i;

export const MARKETING_CONTEXT_PATTERN = /\b(marketing|brand|marke\w*|branding|positionier\w*|kommunikation|campaign|kampagn\w*|media|werbung|advertis\w*|crm|newsletter|customer journey|customer experience|kundenerlebnis|zielgrupp\w*|consumer insight|customer insight|shopper insight)\b/i;

export const RETAIL_CONTEXT_PATTERN = /\b(retail|handel\w*|handler\w*|store|filial\w*|point of sale|\bpos\b|assortment|sortiment\w*|category management|kategoriemanagement|pricing|preisstrateg\w*|promotion|retail media|shopper)\b/i;

export const INDUSTRIAL_OPERATIONS_PATTERN = /\b(production|manufactur\w*|factory|plant|facility|battery|batterie\w*|zellfertigung|zellfabrik|fertigung\w*|produktion\w*|fabrik\w*|werk\w*|maschine\w*|anlage\w*|trockenbeschichtung|energieverbrauch|energieeffizienz|lieferkette|supply chain|logistik|rohstoff\w*|industrial|industrie\w*)\b/i;

export function hasDirectMarketingContext(topic: AiTag): boolean {
  const evidence = normalizeMatchText(topic.evidence);
  if (topic.id === "customer_insights") return CUSTOMER_CONTEXT_PATTERN.test(evidence)
    && CUSTOMER_INSIGHT_SIGNAL_PATTERN.test(evidence);
  if (topic.id === "marketing_insights") return MARKETING_CONTEXT_PATTERN.test(evidence);
  if (topic.id === "fmcg_retail_signale") return RETAIL_CONTEXT_PATTERN.test(evidence);
  if (topic.id !== "ki_performance") return false;
  return (MARKETING_CONTEXT_PATTERN.test(evidence) || CUSTOMER_CONTEXT_PATTERN.test(evidence) || RETAIL_CONTEXT_PATTERN.test(evidence))
    && /\b(ai|artificial intelligence|ki|kunstliche intelligenz)\b/i.test(evidence);
}

export const SALES_ONLY_REJECTION_PATTERN = /\b(sales|vertrieb|tier[ -]?1|buying center|kaufsignal|sales[- ]?trigger|mandat|consulting|beratungsbedarf)\b/i;

export const THIN_SPONSORSHIP_PATTERN = /\b(title sponsor|titelsponsor|sponsorship|sponsoring|official partner|offizieller partner)\b/i;

export const TACTICAL_PRICE_PROMOTION_PATTERN = /\b(tankrabatt|preisnachlass|discount|rabatt|coupon|gutschein|gift with purchase|zugabeaktion)\b/i;

export const MARKETING_DEPTH_PATTERN = /\b(strateg\w*|position\w*|target audience|zielgrupp\w*|customer (?:need|behavio|journey|experience)|consumer (?:need|behavio|insight)|kundenbedurf\w*|kaufverhalten|konsumverhalten|customer insight|consumer insight|shopper insight|brand architecture|markenarchitektur|operating model|organisationsmodell|measur\w*|messbar\w*|uplift|conversion|roi|pilot|testet|learning\w*|erkenntnis\w*|plattform|platform|ecosystem|okosystem|innovation\w*|format\w*|digital\w*|omnichannel|customer experience|kundenerlebnis|loyalty|treueprogramm|experience space|eventspace|shop in shop)\b/i;

export const CONCRETE_ACTIVATION_PATTERN = /\b(sampling|verkost\w*|service\w*|finisher|workshop|make it lab|personalis\w*|interactive|interaktiv|receipt scan|belegscan|app|shop in shop|experience space|eventspace|point of sale|\bpos\b)\b/i;

export const RESEARCH_CONTENT_PATTERN = /\b(stud(?:y|ies|ie|ien)|research|white ?paper|survey|poll|report|benchmark|analysis|analyse|forschung|untersuchung|umfrage|befragung|marktstudie|verbraucherstudie|consumer study|consumer research|shopper study|market research)\b/i;

export const RESEARCH_SUBSTANCE_PATTERN = /\b(method(?:ology)?|methodik|sample|stichprobe|respondent\w*|befrag\w*|interviews?|erheb\w*|participants?|teilnehm\w*|findings?|results?|ergebnis\w*|percent|prozent|data|daten|benchmark|trend\w*|zeigt|found|reveals?|according to)\b/i;

export const MARKETING_RECOVERY_TOPIC_PATTERN = /\b(marketing|brand|marke\w*|customer|kund\w*|consumer|konsument\w*|shopper|retail media|category management|kategoriemanagement|campaign|kampagn\w*|media|werbung|loyalty|omnichannel|d2c|e-?commerce|customer experience|customer journey|ki|kunstliche intelligenz|artificial intelligence)\b/i;

export const MARKETING_RECOVERY_VALUE_PATTERN = /\b(strateg\w*|insight\w*|erkenntnis\w*|learning\w*|trend\w*|method\w*|modell\w*|framework|result\w*|ergebnis\w*|percent|prozent|impact|wirkung|roi|uplift|conversion|wachstum|ruckgang|verander\w*|transform\w*|optimier\w*|zielgrupp\w*|verhalten|bedurf\w*|expectation\w*|erwartung\w*)\b/i;

export function recoverExactMarketingEvidence(articleText: string): string {
  return articleText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .find((sentence) => sentence.length >= 60 && sentence.length <= 700
      && MARKETING_RECOVERY_TOPIC_PATTERN.test(normalizeMatchText(sentence))
      && MARKETING_RECOVERY_VALUE_PATTERN.test(normalizeMatchText(sentence))) || "";
}

export function inferRecoveredMarketingTopic(evidence: string): typeof TOPIC_IDS[number] {
  const normalized = normalizeMatchText(evidence);
  if (/\b(customer|kund\w*|consumer|konsument\w*|shopper|zielgrupp\w*|loyalty|customer experience|customer journey)\b/i.test(normalized)) {
    return "customer_insights";
  }
  if (/\b(retail|handel\w*|category|kategorie\w*|sortiment\w*|pricing|preis\w*|promotion)\b/i.test(normalized)) {
    return "fmcg_retail_signale";
  }
  if (/\b(ki|kunstliche intelligenz|artificial intelligence|ai)\b/i.test(normalized)
      && /\b(anwendung|eingesetzt|implement\w*|optimier\w*|automati\w*|application|deployed|used)\b/i.test(normalized)) {
    return "ki_performance";
  }
  return "marketing_insights";
}

export function recoverMissingMarketingTopics(articleText: string, existing: AiTag[], minimumConfidence: number): AiTag[] {
  const sentences = articleText.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 700);
  const rules: Array<{ id: typeof TOPIC_IDS[number]; pattern: RegExp }> = [
    { id: "customer_insights", pattern: /(?=.*\b(customer|consumer|shopper|kund\w*|konsument\w*|verbraucher\w*|kaufverhalten|konsumverhalten|zielgrupp\w*|loyalty)\b)(?=.*\b(behavior|behaviour|verhalten\w*|bedurf\w*|need\w*|erwart\w*|expect\w*|praferenz\w*|prefer\w*|akzeptanz\w*|zufrieden\w*|frustr\w*|vertrauen\w*|loyalty|kundenbindung\w*|befrag\w*|umfrage\w*|studie\w*|research|insight\w*|erkenntnis\w*|prozent|percent|\d+(?:[.,]\d+)?\s*%))/i },
    { id: "fmcg_retail_signale", pattern: /\b(retail|handel\w*|handler\w*|sortiment\w*|assortment|pricing|preisstrateg\w*|promotion|category management|kategoriemanagement|store concept|filialkonzept)\b/i },
    { id: "ki_performance", pattern: /(?=.*\b(ai|artificial intelligence|ki|kunstliche intelligenz)\b)(?=.*\b(used|uses|using|deploy\w*|implement\w*|application|eingesetzt|einfuhr\w*|automati\w*|optimier\w*|pricing|preis\w*)\b)/i },
  ];
  const recovered: AiTag[] = [];
  for (const rule of rules) {
    if (existing.some((topic) => topic.id === rule.id) || recovered.some((topic) => topic.id === rule.id)) continue;
    const evidence = sentences.find((sentence) => rule.pattern.test(normalizeMatchText(sentence))
      && MARKETING_RECOVERY_VALUE_PATTERN.test(normalizeMatchText(sentence)));
    if (evidence) recovered.push({ id: rule.id, confidence: Math.max(minimumConfidence, 0.9), evidence });
  }
  return recovered;
}

export function hasTransferableMarketingSubstance(
  articleType: string,
  articleText: string,
  topics: AiTag[],
  marketingUse: AiMarketingUse,
): boolean {
  if (!marketingUse.publishable || !marketingUse.sufficient_substance || !marketingUse.evidence
      || !marketingUse.transferable_value) return false;
  const directTopics = topics.filter(hasDirectMarketingContext);
  const subsectorTopics = topics.filter((topic) => topic.id === "sub_branchen_insight");
  if (!directTopics.length && !subsectorTopics.length) return false;

  const combined = normalizeMatchText(`${marketingUse.evidence} ${marketingUse.transferable_value}`);
  const article = normalizeMatchText(articleText);
  const hasRootsMarketingContext = MARKETING_CONTEXT_PATTERN.test(combined)
    || CUSTOMER_CONTEXT_PATTERN.test(combined) || RETAIL_CONTEXT_PATTERN.test(combined);
  // Operational innovation can be strategically important without being a
  // ROOTS Marketing signal. Never convert production, factory, energy or
  // supply-chain learnings into Marketing unless the evidence separately
  // proves a direct brand/customer/marketing/retail implication.
  if (INDUSTRIAL_OPERATIONS_PATTERN.test(combined) && !hasRootsMarketingContext) return false;
  const hasCustomerInsight = directTopics.some((topic) => topic.id === "customer_insights");
  const hasDepth = MARKETING_DEPTH_PATTERN.test(combined);
  const hasSubstantiveResearch = RESEARCH_CONTENT_PATTERN.test(article)
    && RESEARCH_SUBSTANCE_PATTERN.test(normalizeMatchText(`${articleText} ${combined}`));
  const hasTransferableSubsectorDepth = subsectorTopics.length > 0
    && /\b(trend\w*|markt\w*|kategorie\w*|branche\w*|segment\w*|konsum\w*|kunden\w*|wettbewerb\w*|wachstum\w*|ruckgang\w*|entwicklung\w*|benchmark\w*|anteil\w*|prozent|percent|framework|modell\w*|methode\w*)\b/i.test(combined);
  const companyEventOnly = articleType === "company_update"
    && !hasSubstantiveResearch && !hasTransferableSubsectorDepth;
  if (!directTopics.length && (!hasTransferableSubsectorDepth || companyEventOnly)) return false;

  // A logo placement, title sponsorship or generic visibility/community claim
  // is not a transferable Marketing insight without a concrete mechanism,
  // audience insight, strategic rationale, test or measurable outcome.
  if (THIN_SPONSORSHIP_PATTERN.test(article)
      && !hasCustomerInsight && !CONCRETE_ACTIVATION_PATTERN.test(combined)) return false;

  // Tactical discounts remain archive material unless the article proves a
  // broader pricing/customer strategy or contains an actual consumer insight.
  if (TACTICAL_PRICE_PROMOTION_PATTERN.test(article)
      && !hasCustomerInsight && !hasDepth) return false;

  // Campaign and product news need more than the fact that something launched.
  if (articleType === "company_update"
      && /\b(campaign|kampagn\w*|product launch|produktlaunch|produkteinfuhr\w*|sponsoring|sponsorship)\b/i.test(article)
      && !hasCustomerInsight && !hasDepth) return false;
  // A consultancy, institute or trade body study is useful Marketing content
  // only when the article exposes an actual method, finding or data point.
  // A landing page that merely advertises a download does not qualify.
  if (RESEARCH_CONTENT_PATTERN.test(article) && !hasSubstantiveResearch) return false;
  return true;
}

export function validateRouteDecision(raw: AiRouteDecision | undefined, articleText: string, threshold = 0.88): AiRouteDecision {
  const confidence = clampConfidence(raw?.confidence);
  const evidence = String(raw?.evidence || "").trim();
  const eligible = Boolean(raw?.eligible) && confidence >= threshold && evidenceExists(evidence, articleText);
  return {
    eligible,
    confidence,
    evidence: eligible ? evidence : "",
    reason: String(raw?.reason || "").trim().slice(0, 700),
  };
}

export function normalizeArticleType(rawType: string, articleText: string): typeof ARTICLE_TYPES[number] {
  const normalized = normalizeMatchText(articleText.slice(0, 20_000));
  const empiricalAsset = /\b(studie|study|survey|umfrage|befragung|untersuchung)\b/i.test(normalized)
    && /\b(methodik|methodology|stichprobe|sample|befrag\w*|interviews?|erheb\w*|respondent\w*|teilnehm\w*|participants?)\b/i.test(normalized)
    && /\b(ergebnis\w*|findings?|zeigt|found|reveals?|prozent|percent|\d+(?:[.,]\d+)?\s*%)\b/i.test(normalized);
  if (empiricalAsset) return "study";
  const whitepaperAsset = /\b(whitepaper|white paper|research paper|forschungspapier|playbook)\b/i.test(normalized)
    && /\b(findings?|ergebnis\w*|framework|modell\w*|handlungsfeld\w*|schlussfolger\w*|daten|data|benchmark\w*)\b/i.test(normalized);
  if (whitepaperAsset) return "whitepaper";
  if (ARTICLE_TYPES.includes(rawType as typeof ARTICLE_TYPES[number]) && rawType !== "other") {
    return rawType as typeof ARTICLE_TYPES[number];
  }
  const proseSentences = articleText.split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => sentence.trim().length >= 60 && /[.!?][”»\"]?$/.test(sentence.trim())).length;
  // `other` is reserved for genuinely unclassifiable/non-article material.
  // If the extractor delivered sustained prose, use the neutral news type
  // rather than allowing a model omission to create a large miscellaneous bin.
  return proseSentences >= 3 ? "news" : "other";
}

export function hasRootsRelevantSalesOpportunity(classification: AiClassification): boolean {
  const salesDecision = classification.routing_decisions.sales;
  const salesUse = classification.sales_use;
  if (!salesDecision.eligible || !salesDecision.evidence || !salesUse.actionable || !salesUse.evidence) return false;
  if (!salesUse.company_challenge || !salesUse.roots_relevance || !salesUse.sufficient_substance
      || salesUse.personalization_facts.length === 0) return false;

  const triggers = classification.sales_triggers;
  if (!triggers.length) return false;
  if (triggers.every((trigger) => trigger.id === "campaign_launch")) return false;

  const combinedEvidence = [
    salesDecision.evidence,
    salesUse.evidence,
    ...triggers.map((trigger) => trigger.evidence),
  ].join(" ");
  const hasRootsContext = ROOTS_SALES_CONTEXT_PATTERN.test(normalizeMatchText(combinedEvidence));
  const broadTriggersOnly = triggers.every((trigger) => BROAD_SALES_TRIGGER_IDS.has(trigger.id));
  const hasContextIndependentTrigger = triggers.some((trigger) =>
    !SALES_TRIGGERS_REQUIRING_ROOTS_CONTEXT.has(trigger.id)
  );
  const operationalInvestmentOnly = triggers.every((trigger) => trigger.id === "investment")
    && OPERATIONAL_ONLY_PATTERN.test(normalizeMatchText(combinedEvidence))
    && !hasRootsContext;

  return !operationalInvestmentOnly && !broadTriggersOnly
    ? (hasContextIndependentTrigger || hasRootsContext)
    : !operationalInvestmentOnly && hasRootsContext;
}

export function shouldReviewClassification(primary: AiClassification, config: PipelineConfig): boolean {
  if (!config.ai.review_enabled) return false;
  if (primary.relevance_status === "rejected") return config.ai.review_rejected_articles;
  const marketing = primary.routing_decisions.marketing;
  const sales = primary.routing_decisions.sales;
  const missingRouteEvidence = (marketing.eligible && !String(marketing.evidence || "").trim())
    || (sales.eligible && !String(sales.evidence || "").trim());
  const salesConflict = sales.eligible && (!primary.sales_use.actionable
    || !primary.sales_use.sufficient_substance
    || primary.sales_triggers.length === 0
    || primary.companies.every((company) => company.role === "incidental_mention"));
  const marketingConflict = marketing.eligible && (!primary.marketing_use.publishable
    || !String(primary.marketing_use.evidence || "").trim());
  const reviewThreshold = Math.min(config.ai.review_confidence_below, config.quality.reliable_confidence);
  const nearDecisionBoundary = primary.overall_confidence >= Math.max(0, reviewThreshold - 0.08)
    && primary.overall_confidence < reviewThreshold;
  const evidencedRoute = (marketing.eligible && Boolean(String(marketing.evidence || "").trim()))
    || (sales.eligible && Boolean(String(sales.evidence || "").trim()));
  const genuinelyBorderline = primary.relevance_status === "uncertain" && nearDecisionBoundary && evidencedRoute;
  const salesValue = Math.round(
    primary.sales_opportunity_value.problem_strength * 0.32
    + primary.sales_opportunity_value.roots_fit * 0.30
    + primary.sales_opportunity_value.buying_intent * 0.23
    + primary.sales_opportunity_value.timing * 0.15,
  );
  const highValueSalesNeedsAudit = sales.eligible && salesValue >= 65 && nearDecisionBoundary;
  return genuinelyBorderline
    || (nearDecisionBoundary && evidencedRoute && (missingRouteEvidence || salesConflict || marketingConflict))
    || highValueSalesNeedsAudit;
}

export const ROOTS_OFFERINGS: Array<{ id: string; pillar: string; label: string; description: string }> = [
  { id: "planning", pillar: "planning", label: "Planning – Growth Strategy", description: "Wachstumsstrategie: Pfade für nachhaltig profitables Wachstum, Marktanteilsgewinne, Markteintritt/-expansion." },
  { id: "purpose", pillar: "purpose", label: "Purpose – Brand Positioning", description: "Markenpositionierung: Wertversprechen der Marke für Konsumenten, Mitarbeitende und Stakeholder definieren." },
  { id: "presence", pillar: "presence", label: "Presence – Customer Experience", description: "Customer Experience: integrierte CX-Programme über die gesamte Customer Journey für Konsistenz und Attraktivität." },
  { id: "people", pillar: "people", label: "People – Marketing Capabilities", description: "Marketing-Kompetenzaufbau: Team-Fähigkeiten für kontinuierlichen Marktwandel entwickeln." },
  { id: "productivity", pillar: "productivity", label: "Productivity – Marketing Operations", description: "Marketing Operations: Systeme und Prozesse für höhere Effizienz und Output transformieren." },
  { id: "performance", pillar: "performance", label: "Performance – Marketing Analytics", description: "Marketing Analytics: analytische Infrastruktur und Datenkultur als Wettbewerbsvorteil aufbauen." },
];

export type RootsOffering = { id: string; pillar: string; label: string; description: string };

export function offeringFitGuardrail(offering: RootsOffering, challenge: string, exactEvidence: string): boolean {
  const text = normalizeMatchText(`${challenge} ${exactEvidence}`);
  const strictPatterns: Record<string, RegExp> = {
    presence_customer_experience_management: /\b(customer experience\w*|customer journey\w*|kundenerlebnis\w*|kundenreise\w*|touchpoint\w*)\b/i,
    purpose_value_proposition: /\b(value proposition|nutzenversprechen\w*|wertversprechen\w*|mehrwert\w*|preisposition\w*|preisstellung\w*|preispremium\w*|hohere\w* preis\w*|preis\w* rechtfertig\w*|nutzenargument\w*)\b/i,
    planning_innovationsstrategie: /\b(innovationsstrateg\w*|innovationsroadmap\w*|innovationsportfolio\w*|innovation\w*|produktentwickl\w*|rezeptentwickl\w*|neuheit\w*|suchfeld\w*)\b/i,
    presence_customer_insights: /\b(customer insight\w*|consumer insight\w*|shopper insight\w*|kundenbedurfnis\w*|kundenverhalten\w*|kaufverhalten\w*|marktforschung\w*|verbraucherforschung\w*)\b/i,
    planning_markenstrategie: /\b(markenstrateg\w*|markenfuhr\w*|brand strateg\w*|markentransform\w*|repositionier\w*|neupositionier\w*)\b/i,
    purpose_handelsmarkenstrategie: /\b(handelsmark\w*|eigenmark\w*|private label\w*|retailer brand\w*)\b/i,
    productivity_marketing_automation: /\b(marketing automation|marketingautomatisier\w*|automatisier\w* marketing\w*|crm automation|journey automation)\b/i,
    productivity_governance_modell: /\b(governance|entscheidungsrecht\w*|verantwortlichkeit\w*|steuerungsmodell\w*|steuerungsrahmen\w*)\b/i,
  };
  const strict = strictPatterns[offering.id];
  if (strict) return strict.test(text);
  const stop = new Set(["roots", "entwickelt", "definiert", "unterstutzt", "systematisch", "strategisch", "relevant", "konkret", "management", "strategie", "marketing"]);
  const concepts = normalizeMatchText(`${offering.label} ${offering.description}`).split(/\s+/)
    .filter((word) => word.length >= 7 && !stop.has(word)).map((word) => word.slice(0, 7));
  return concepts.some((concept) => text.split(/\s+/).some((word) => word.startsWith(concept)));
}

export function matchRootsOfferingDeterministically(
  challenge: string,
  triggerEvidence: string,
  offerings: RootsOffering[],
  triggerIds: string[] = [],
): { id: string; label: string; reasoning: string } | null {
  const text = normalizeMatchText(`${challenge} ${triggerEvidence}`);
  const select = (id: string, reasoning: string) => {
    const offering = offerings.find((item) => item.id === id);
    if (offering) return { id: offering.id, label: offering.label, reasoning };
    // Only used when the DB catalog could not be read and the six-pillar
    // emergency fallback is active. Production DB settings still control
    // activation whenever detailed offerings were loaded successfully.
    if (offerings !== ROOTS_OFFERINGS) return null;
    const fallbackLabels: Record<string, string> = {
      purpose_handelsmarkenstrategie: "Handelsmarkenstrategie",
      planning_markenstrategie: "Markenstrategie",
      presence_customer_experience_management: "Customer Experience Management",
      productivity_governance_modell: "Governance-Modell",
    };
    return fallbackLabels[id] ? { id, label: fallbackLabels[id], reasoning } : null;
  };
  const strategicBrandChange = /\b(marke\w* strategisch|markenstrateg\w*|markenfuhr\w*|markentransform\w*|brand strateg\w*|brand transform\w*|repositionier\w*|neupositionier\w*)\b/i.test(text);
  const retailContext = /\b(einzelhandel\w*|grosshandel\w*|handler\w*|handelsunternehmen\w*|retail\w*|baumarkt\w*|diy markt\w*|sortiment\w*)\b/i.test(text);
  const explicitPrivateLabel = /\b(handelsmark\w*|eigenmark\w*|private label\w*|retailer brand\w*)\b/i.test(text);
  if (explicitPrivateLabel || retailContext && strategicBrandChange) {
    return select("purpose_handelsmarkenstrategie", "ROOTS kann mit Handelsmarkenstrategie andocken und Rolle, Positionierung, Sortimentswirkung sowie Wachstumslogik der belegten Handels-/Retail-Marke schärfen.");
  }
  if (strategicBrandChange) {
    return select("planning_markenstrategie", "ROOTS kann mit Markenstrategie andocken und die belegte Neuausrichtung in eine langfristige Rolle, Positionierung und Wachstumslogik der Marke übersetzen.");
  }
  const valueOrPriceChallenge = /\b(value proposition|nutzenversprechen\w*|wertversprechen\w*|mehrwert\w*|preisposition\w*|preisstellung\w*|preispremium\w*|hohere\w* preis\w*|preis\w* rechtfertig\w*|nutzenargument\w*)\b/i.test(text);
  const productAudienceContext = /\b(produkt\w*|angebot\w*|innovation\w*|neuheit\w*|zielgruppe\w*|verbraucher\w*|kunde\w*)\b/i.test(text);
  if (valueOrPriceChallenge && productAudienceContext) {
    return select("purpose_value_proposition", "ROOTS kann mit der Value Proposition andocken und den belegten Mehrwert des Angebots für die relevante Zielgruppe so schärfen, dass die höhere Preispositionierung nachvollziehbar und differenzierend begründet wird.");
  }
  if (/\b(customer experience\w*|customer journey\w*|kundenerlebnis\w*|touchpoint\w*)\b/i.test(text)
      && /\b(konsistent\w*|strateg\w*|steuer\w*|transform\w*|optimier\w*|etablier\w*)\b/i.test(text)) {
    return select("presence_customer_experience_management", "ROOTS kann mit Customer Experience Management andocken und die belegte Customer-Journey-Veränderung über relevante Touchpoints systematisch und konsistent ausgestalten.");
  }
  if (/\b(governance|steuerungsrahmen|entscheidungsrecht\w*|verantwortlichkeit\w*|organisationsstruktur\w*)\b/i.test(text)) {
    return select("productivity_governance_modell", "ROOTS kann mit dem Governance-Modell andocken und Rollen, Entscheidungsrechte, Standards und Steuerung für die belegte Transformation strukturieren.");
  }
  const aiMarketingTransformation = /\b(agentic commerce|shopping agents?|ki agent\w*|ai agent\w*|transformative ai|transformative ki|generative ai|generative ki|kunstliche intelligenz|ki gestutzt\w*|ai powered)\b/i.test(text)
    && /\b(customer journey\w*|kundenerlebnis\w*|commerce|marketing\w*|werbung\w*|advertis\w*|produktsuche\w*|product search|personalisier\w*|personaliz\w*|aktivier\w*|automation|automatisier\w*)\b/i.test(text);
  if (aiMarketingTransformation) {
    return select("productivity_marketing_automation", "ROOTS kann mit Marketing Automation andocken, die belegten KI-Use-Cases entlang der Customer Journey priorisieren und Prozesse, Daten, Technologie sowie Governance in eine skalierbare Umsetzung übersetzen.");
  }
  const hasTrigger = (...ids: string[]) => ids.some((id) => triggerIds.includes(id));
  const marketingTransformation = /\b(marketingorgani[sz]ation\w*|marketing operating model|marketing operations?|marketingprozess\w*|marketing process\w*|rollen\w*|verantwortlichkeit\w*|schnittstell\w*|governance|steuerungsmodell\w*)\b/i.test(text);
  if (hasTrigger("transformation") && marketingTransformation) {
    return select("productivity_marketing_operations_audit", "ROOTS kann mit einem Marketing Operations Audit andocken, die belegte Transformation von Rollen, Prozessen, Schnittstellen und Technologien bewerten und daraus priorisierte Umsetzungshebel ableiten.");
  }
  const marketOrGrowthChange = /\b(markteintritt\w*|marktexpansion\w*|neue\w* markt\w*|new market\w*|marktanteil\w*|wachstum\w*|growth\w*|kundensegment\w*|zielsegment\w*)\b/i.test(text);
  if (hasTrigger("market_entry", "market_expansion", "new_business_model") && marketOrGrowthChange && ROOTS_SALES_CONTEXT_PATTERN.test(text)) {
    return select("planning_go_to_market_strategie", "ROOTS kann mit einer Go-to-Market-Strategie andocken und Zielsegmente, Nutzenargumentation, Kanäle, Aktivierung und Rollout für die belegte Wachstumsinitiative strukturieren.");
  }
  const innovationChange = /\b(innovationsstrateg\w*|innovationsroadmap\w*|innovationsportfolio\w*|suchfeld\w*|pilot\w*|testformat\w*|skalier\w*)\b/i.test(text);
  if (hasTrigger("ai_initiative", "retail_strategy", "portfolio_change") && innovationChange) {
    return select("planning_innovationsstrategie", "ROOTS kann mit Innovationsstrategie andocken, die belegte Initiative in priorisierte Suchfelder, Entscheidungslogiken und eine belastbare Innovationsroadmap überführen.");
  }
  const customerOrLoyaltyChange = /\b(customer insight\w*|consumer insight\w*|shopper insight\w*|kundenbedurfnis\w*|kundenverhalten\w*|kaufverhalten\w*|loyalty\w*|kundenbindung\w*|personalisier\w*)\b/i.test(text);
  if (hasTrigger("marketing_problem", "retail_strategy", "transformation") && customerOrLoyaltyChange) {
    return select("presence_customer_insights", "ROOTS kann mit Customer Insights andocken, die belegten Kunden-, Shopper- oder Verhaltenssignale vertiefen und in entscheidungsrelevante Handlungsfelder übersetzen.");
  }
  return null;
}

export type SalesOfferingContext = {
  primaryCompany: string | null;
  triggerIds: string[];
  triggerEvidence: string[];
  rootsRelevance: string;
  personalizationFacts: string[];
  salesReason: string;
};

export type RouteValueScores = {
  marketing: { score: number; reason: string; components: AiMarketingScore };
  sales: { score: number; reason: string; components: AiSalesScore };
};

export function calibrateRouteValueScores(
  classification: AiClassification,
  articleText: string,
  marketingEligible: boolean,
  salesCandidate: boolean,
  matchedOffering: { id: string; label: string; reasoning: string } | null,
): RouteValueScores {
  const m = classification.marketing_asset_value;
  const s = classification.sales_opportunity_value;
  const round = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  let marketingScore = marketingEligible ? round(
    m.novelty * MARKETING_SCORE_WEIGHTS.novelty / 100
    + m.strategic_value * MARKETING_SCORE_WEIGHTS.strategic_value / 100
    + m.transferability * MARKETING_SCORE_WEIGHTS.transferability / 100
    + m.evidence_strength * MARKETING_SCORE_WEIGHTS.evidence_strength / 100,
  ) : 0;
  const normalized = normalizeMatchText(articleText);
  const recurringTracker = /\b(jahrlich|annual|monatlich|monthly|regelmassig|wiederkehrend|edition|welle|tracker|seit \d{4})\b/i.test(normalized);
  if (recurringTracker && m.novelty < 70) marketingScore = Math.min(marketingScore, 69);
  if (!["study", "whitepaper", "report", "analysis", "case_study"].includes(classification.article_type)) {
    marketingScore = Math.min(marketingScore, 84);
  }
  if (marketingScore === 100 && (m.novelty < 95 || m.strategic_value < 95 || m.evidence_strength < 90)) marketingScore = 99;

  const priceValueOpportunity = matchedOffering?.id === "purpose_value_proposition"
    && /\b(hohere\w* preis\w*|preisstellung\w*|preisaufschlag\w*|preispremium\w*)\b/i.test(normalized)
    && /\b(bedingt|begrund\w*|rechtfertig\w*|wegen|durch)\b/i.test(normalized);
  const calibratedSalesComponents: AiSalesScore = priceValueOpportunity ? {
    ...s,
    problem_strength: Math.max(s.problem_strength, 60),
    roots_fit: Math.max(s.roots_fit, 85),
    buying_intent: Math.min(s.buying_intent, 10),
    timing: Math.max(s.timing, 55),
    reason: "Das Unternehmen begründet aktuell eine höhere Preispositionierung; ROOTS passt mit Value Proposition und Nutzenargumentation, eine konkrete Kaufabsicht ist jedoch nicht belegt.",
  } : s;
  let salesScore = salesCandidate && matchedOffering ? round(
    calibratedSalesComponents.problem_strength * SALES_SCORE_WEIGHTS.problem_strength / 100
    + calibratedSalesComponents.roots_fit * SALES_SCORE_WEIGHTS.roots_fit / 100
    + calibratedSalesComponents.buying_intent * SALES_SCORE_WEIGHTS.buying_intent / 100
    + calibratedSalesComponents.timing * SALES_SCORE_WEIGHTS.timing / 100,
  ) : 0;
  const explicitHelp = /\b(sucht|suchen|seeking|request for proposal|\brfp\b|tender|ausschreibung|partner gesucht|beratung gesucht|consultancy|consulting support|externe unterstutzung|externe hilfe|mandat|pitch|budget freigegeben)\b/i.test(normalized);
  const explicitProblem = EXPLICIT_MARKETING_PROBLEM_PATTERN.test(normalized)
    && ROOTS_SALES_CONTEXT_PATTERN.test(normalized) && !RESOLVED_PROBLEM_PATTERN.test(normalized);
  const broadOnly = classification.sales_triggers.length > 0
    && classification.sales_triggers.every((trigger) => BROAD_SALES_TRIGGER_IDS.has(trigger.id));
  const creativeExecutionOnly = /\b(logo design|logogestaltung|packaging design|verpackungsdesign|kampagnenkreation|werbemittelproduktion|media buying|medieneinkauf|filmproduktion|fotoproduktion)\b/i.test(normalized)
    && !/\b(markenstrateg\w*|marketingstrateg\w*|positionier\w*|customer experience|customer journey|marketingorganisation|marketing transformation)\b/i.test(normalized);
  if (creativeExecutionOnly) salesScore = Math.min(salesScore, 25);
  if (broadOnly && !explicitProblem) salesScore = Math.min(salesScore, 59);
  if (!explicitHelp) salesScore = Math.min(salesScore, explicitProblem && matchedOffering ? 89 : 79);
  if (salesScore === 100 && (!explicitHelp || !explicitProblem || !matchedOffering)) salesScore = 99;
  const marketingReason = marketingEligible
    ? (m.reason || `Der Inhalt bietet mit ${marketingScore} % einen belegten Nutzwert als Grundlage für ein ROOTS-Marketing-Asset.`)
    : "Kein ausreichend übertragbarer Nutzwert als Grundlage für ein ROOTS-Marketing-Asset belegt.";
  const salesReason = salesCandidate && matchedOffering
    ? (calibratedSalesComponents.reason || `Die belegte Opportunity passt mit ${salesScore} % zur ROOTS-Leistung ${matchedOffering.label}.`)
    : "Keine vollständig belegte Tier-1-Sales-Opportunity mit konkretem ROOTS-Leistungsmatch.";
  return { marketing: { score: marketingScore, reason: marketingReason, components: m }, sales: { score: salesScore, reason: salesReason, components: calibratedSalesComponents } };
}

export function selectCompanyCandidates(
  articleText: string,
  companies: Array<{ name: string; aliases: string[] }>,
): Array<{ name: string; aliases: string[] }> {
  const normalizedText = ` ${normalizeMatchText(articleText)} `;
  return companies.filter((company) => [company.name, ...(company.aliases || [])].some((term) => {
    const normalizedTerm = normalizeMatchText(term);
    if (normalizedTerm.length < 3 || !normalizedText.includes(` ${normalizedTerm} `)) return false;
    // Every single-token company/brand term can collide with ordinary language
    // (Tempo, Action, Mars, Puma, Metro, Netto, Globus, ...). A bare word is
    // never enough: require a syntactic brand/entity relation or an action in
    // which the term itself is the acting subject. This is deliberately generic
    // so newly added Tier-1 aliases receive the same protection automatically.
    if (!normalizedTerm.includes(" ")) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mention = new RegExp(`(?:^|[^A-Za-zÀ-ÖØ-öø-ÿ])${escaped}(?:[^A-Za-zÀ-ÖØ-öø-ÿ]|$)`, "gi");
      const actorVerb = /^(?:\s|[,:;()\-–—])*\b(?:announc\w*|launch\w*|introduc\w*|invest\w*|acquir\w*|expand\w*|open\w*|plan\w*|partner\w*|report\w*|sell\w*|grow\w*|appoint\w*|meld\w*|kundig\w*|start\w*|bring\w*|fuhr\w*|investier\w*|ubern\w*|expandier\w*|eroffn\w*|plan\w*|kooperier\w*|steiger\w*|wach\w*|beruf\w*|senk\w*|erhoh\w*|verzeichn\w*|positionier\w*|transformier\w*)\b/i;
      const entityBefore = /\b(?:marke\w*|brand\w*|unternehmen\w*|company|konzern\w*|group|gruppe\w*|retailer\w*|handler\w*|hersteller\w*|anbieter\w*|discounter\w*|tochter\w*|ceo|chef\w*|vorstand\w*)\b(?:\s+\w+){0,4}\s*$/i;
      const ownedByBefore = /\b(?:bei|von|fur|des|der|durch)\s*$/i;
      const businessAfter = /\b(?:marke\w*|brand\w*|unternehmen\w*|company|konzern\w*|group|gruppe\w*|retailer\w*|handler\w*|hersteller\w*|anbieter\w*|discounter\w*|umsatz\w*|produkt\w*|sortiment\w*|strategie\w*|kampagn\w*|kunde\w*|consumer\w*|store\w*|filial\w*|markt\w*)\b/i;
      let match: RegExpExecArray | null;
      while ((match = mention.exec(articleText)) !== null) {
        const termStart = match.index + Math.max(0, match[0].toLowerCase().indexOf(term.toLowerCase()));
        const before = normalizeMatchText(articleText.slice(Math.max(0, termStart - 120), termStart));
        const after = normalizeMatchText(articleText.slice(termStart + term.length, termStart + term.length + 180));
        if (entityBefore.test(before) || actorVerb.test(after) || (ownedByBefore.test(before) && businessAfter.test(after))) return true;
      }
      return false;
    }
    return true;
  }));
}

export function companyEvidenceMentionsCandidate(
  evidence: string,
  company: { name: string; aliases: string[] },
): boolean {
  return selectCompanyCandidates(evidence, [company]).length > 0;
}

export function passesEventPreClassificationGate(
  articleText: string,
  tier1Companies: Array<{ name: string; aliases: string[] }>,
  policy: CrawlPolicy,
): boolean {
  if (policy.sourceType !== "event") return true;
  const matchedCompanies = selectCompanyCandidates(articleText, tier1Companies);
  return hasQualifiedTier1EventParticipation(articleText, matchedCompanies);
}

export const FALLBACK_TOPICS_TEXT = `- customer_insights: customer behavior, needs, trust, loyalty, experience or target groups
- marketing_insights: brand strategy, positioning, campaigns, communication or media
- fmcg_retail_signale: retail, assortment, private label, pricing, promotion, stores or category management
- sub_branchen_insight: concrete development in a relevant FMCG, retail or consumer sub-sector
- ki_performance: demonstrated AI, automation, analytics or measurable business/marketing impact`;

export const FALLBACK_TERRITORIES_TEXT = `- wachstumstreiber: growth, market entry, expansion, innovation or new revenue
- markenaktivierung: campaign, activation, sponsorship, promotion or customer engagement
- marke_im_wandel: rebranding, repositioning, portfolio or brand transformation
- operational_excellence: efficiency, organization, process, restructuring or cost optimization
- empowered_marketers: marketing operating model, capabilities, teams, leadership or technology enablement`;

export const FALLBACK_ARTICLE_TYPES_TEXT = `- news: redaktionelle Nachricht oder Meldung
- analysis: fachliche Analyse oder Hintergrundstück
- interview: redaktionelles Frage-Antwort- oder Gesprächsformat
- opinion: Kommentar, Kolumne oder klar gekennzeichnete Meinung
- study: empirische Studie, Survey oder Untersuchung mit Methode/Stichprobe und Ergebnissen
- whitepaper: substanzielles Whitepaper, Research Paper oder Playbook
- report: Markt-, Trend-, Benchmark- oder Prognosebericht
- case_study: dokumentierter Praxisfall mit Vorgehen und Ergebnissen
- press_release: eigenständige Pressemitteilung mit zusammenhängendem Artikeltext
- company_update: Strategie-, Produkt-, Kampagnen-, Finanz-, M&A-, Investitions-, Expansions-, Operations- oder Personalupdate
- event_report: redaktioneller Messe-, Event-, Panel- oder Vortragsbericht mit inhaltlicher Substanz
- other: sonstiger Inhalt; nur verwenden, wenn kein anderer Typ belastbar passt`;

export const FALLBACK_SALES_TRIGGERS_TEXT = `Use only evidence-backed strategic triggers accepted by the response schema. Generic company mentions, launches or personnel news are not triggers by themselves.`;

export type ClassifierTaxonomyText = {
  topics: string;
  territories: string;
  articleTypes: string;
  salesTriggers: string;
};

// Der Prompt bleibt inhaltlich unveraendert. Die Taxonomie-Texte werden von
// index.ts aus der Datenbank geladen und hier nur eingesetzt, damit diese Datei
// ohne Datenbankzugriff lesbar und testbar bleibt.
export function buildClassifierPrompt(
  title: string,
  cleanedContent: string,
  source: { company?: string; category?: string },
  companies: Array<{ name: string; aliases: string[] }>,
  taxonomyText: ClassifierTaxonomyText,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
  maxContentChars = 12_000,
): string {
  const modelContent = selectClassifierContent(cleanedContent, maxContentChars);
  return `<taxonomy>
Topics:
${taxonomyText.topics}
Territories:
${taxonomyText.territories}
Article types:
${taxonomyText.articleTypes}
Sales triggers:
${taxonomyText.salesTriggers}
</taxonomy>
<active_business_policy>${JSON.stringify({ relevance: config.relevance, decisions: config.decisions, routing: config.routing })}</active_business_policy>
<routing_rules>
Marketing means editorial usefulness for ROOTS: the article must contain enough transferable substance to support a later general post, newsletter item, whitepaper or thought-leadership contribution. Evaluate only that potential; do NOT create content ideas, angles, headlines or finished copy. Marketing NEVER requires a Tier-1 company or any named company. Missing Tier-1 status is exclusively a Sales limitation and must never appear in article-level rejection_reasons or make Marketing uncertain. General analyses, interviews, studies and market observations qualify when they teach a broader audience something concrete and evidence-backed about a ROOTS topic; a company case study is useful but not required. Company news that cannot teach a broader audience anything is not Marketing. Direct evidence for customer behaviour, brand/marketing strategy, campaign/media, retail assortment/pricing/promotion/store strategy, applied AI or a transferable development in a ROOTS-relevant consumer/FMCG/retail sub-sector is required. sub_branchen_insight MAY qualify Marketing by itself only when it contains a concrete transferable market/category/customer/competitive development, evidence and enough depth to remain useful beyond a single company event. A single acquisition, opening, expansion, result, investment, facility or personnel announcement is never such an insight. Acquisitions, mergers, financial results, investments, logistics, production, expansion and personnel news are not Marketing unless separate direct Marketing or transferable sector evidence exists. A technology, production, factory, battery, machinery, energy-efficiency, supply-chain or industrial-cost insight is NOT a Marketing insight merely because it is innovative, strategic, transferable or economically important. "Interesting for business" is not the same as "useful for a ROOTS Marketing asset". For marketing_insights, the verbatim topic and marketing_use evidence must itself explicitly concern marketing strategy, brand/positioning, communication/media, customer/consumer/shopper behaviour, customer experience, retail/category/pricing/promotion or marketing organisation/performance. Empirical studies and surveys from consultancies, institutes, associations or companies require exposed methodology/sample plus findings or data. Whitepapers, research papers, playbooks and trend/market reports may qualify without a survey methodology when they expose concrete findings, frameworks, benchmarks, data or independently useful conclusions. A download announcement, gated landing page or self-promotional claim without an exposed finding does not qualify. If marketing_use.sufficient_substance is true or routing_decisions.marketing.reason describes transferable value, you MUST copy a verbatim supporting sentence into marketing_use.evidence and evaluate publishable independently of Sales.
Software-, Tool-, Plattform-, Agentur-, Beratungs- and other service-provider pages that primarily present or sell their own offering are NOT Marketing signals. Vendor claims that their product creates insights, improves customer experience or raises performance are still sales pitches, not independent insights. This also applies to provider profiles, directories, product descriptions, demos and promotional case examples without independently useful evidence. Exception: substantive studies, research papers, whitepapers, benchmarks, playbooks or trend reports from consultancies/agencies/providers remain eligible when the article itself exposes concrete methodology plus findings, data or transferable customer/industry trends beyond promoting the provider.
sub_branchen_insight is valid only for a transferable market observation that remains useful beyond the reported company event. A single acquisition, product, expansion, financial result or facility is not transferable.
Sales means sufficient account-specific substance for later personalized outreach content. Evaluate only whether a credible whitepaper, executive briefing or comparable material could later be developed; do NOT propose an asset, topic, title or finished idea. It requires BOTH a Tier-1 company as primary_subject/affected_party AND at least one evidence-backed strategic sales_trigger, a concrete company challenge or evidenced ROOTS-relevant opportunity, a clear ROOTS contribution, sufficient factual depth and at least one personalization fact. The Sales evidence, company_challenge or personalization facts MUST explicitly connect the named Tier-1 company to that challenge or trigger; generic statements about "companies", "brands" or an anonymous case study are Marketing only. A company mention or generic strategic change alone is insufficient. From ANY source, a named person with a credible role at a Tier-1 company who substantively speaks, presents, discusses, participates or is quoted about a ROOTS marketing, brand, customer, retail, category, innovation or applied-AI topic qualifies event_participation as a Sales trigger. The person's contribution and company affiliation must both be evidenced locally in the article. Attendee lists, speaker directories, schedules, navigation, a session title without described contribution, bare attendance announcements, and a name merely appearing somewhere on the same page are insufficient. Event participation alone is never Marketing. An event report qualifies for Marketing only when the article contains independent transferable findings, data, results, learnings, a framework or another concrete ROOTS-relevant insight beyond announcing the appearance.
marketing_problem is a valid Sales trigger when the article explicitly proves an unresolved or currently material marketing, brand, customer, consumer, loyalty, media, retail-media, category, positioning or customer-journey problem of a Tier-1 company. The evidenced problem itself supplies the trigger; a separate pitch, investment or transformation announcement is not required. Still require company-specific facts, a credible ROOTS contribution and personalization substance. Generic competitive pressure, sector-wide commentary, speculative criticism, weak performance without a marketing/customer connection, and problems described as fully resolved are not marketing_problem.
Financial_news is not an article-level rejection reason when it explicitly proves such an unresolved Tier-1 marketing_problem. Ignore the surrounding earnings figures for routing, but evaluate evidenced brand weakness, consumer/customer pressure, sell-through difficulty, marketplace relevance or a stated need to strengthen how the company serves consumers as a possible Sales signal. Pure financial performance without that direct ROOTS connection remains irrelevant.
Buying Center is downstream of Sales. Recommend one to four specific roles that would genuinely benefit from the proposed asset. A named person from the article is preferred when their responsibility fits; otherwise recommend roles and set research_required=true. A pure CEO/CMO appointment, press contact, testimonial or spokesperson is insufficient.
Rate marketing_asset_value independently from classification confidence. Score novelty, strategic_value, transferability and evidence_strength from 0 to 100. 100 means a genuinely field-changing, exceptionally well-evidenced insight that could transform marketing practice for ROOTS clients. New frameworks, original analyses and major studies can score 80–99. A useful but familiar insight scores 50–79. Recurring annual/monthly trackers without a major new shift normally score below 70. Explain the asset value in one concise German sentence.
Rate sales_opportunity_value independently from classification confidence. Score problem_strength, roots_fit, buying_intent and timing from 0 to 100. 100 requires an explicit current Tier-1 marketing problem, exact fit with strategic marketing consulting and direct evidence that help, a partner, consultancy, pitch, tender, mandate or budget is being sought. An explicit problem plus credible ROOTS fit without buying intent belongs in the upper range but below 90. Revenue decline, merger, partnership, investment or expansion alone is weak. Creative execution needs such as logo design, packaging production, campaign creation or media buying are not strategic ROOTS consulting demand. Explain the opportunity value in one concise German sentence.
Sales is not a synonym for Marketing. A campaign_launch alone is NEVER a Sales signal. General product launches, portfolio news, sponsorships, testimonials and campaign execution remain Marketing unless the article separately proves a concrete strategic change or commercial need relevant to ROOTS. Investment qualifies only when it concerns marketing, brand, customer/consumer insights, retail media, category management, marketing technology, capabilities or an external partner/agency/consulting mandate. Investment in factories, filling, packaging, machinery, production, logistics, buildings or other operational infrastructure is not a ROOTS Sales signal. Require verbatim Sales evidence for the strategic change, buying need, mandate, budget, tender, partner search or ROOTS-relevant capability build. The same strategic passage may support Marketing and Sales only when all additional Sales substance requirements are independently fulfilled.
Marketing and Sales are evaluated independently. Missing Tier-1 status, a missing Sales trigger or an ineligible Buying Center must NEVER make an otherwise evidence-backed Marketing result uncertain or rejected. Put route-specific failures only into routing_decisions.sales.reason, not into the article-level rejection_reasons array. Article-level rejection_reasons are reserved for reasons that invalidate every route.
Use uncertain only for a genuine human borderline decision: at least one route must have concrete verbatim evidence and pass some, but not all, of its mandatory gates. If neither Marketing nor Sales has a ROOTS-relevant topic/challenge, exact evidence and meaningful substance, return rejected with high confidence. Technical extraction, language or formatting problems are handled before this prompt and are never reasons for uncertain. A Sales borderline needs a named Tier-1 account plus an account-specific strategic trigger/challenge; a Marketing borderline needs a ROOTS-relevant topic plus transferable editorial evidence. Generic company news, broad industry relevance or a score without direct evidence is not a borderline case.
Return EVERY separately evidenced applicable topic, not only the strongest one. Multi-topic classification is expected: consumer/customer behaviour plus retail/pricing should return both customer_insights and fmcg_retail_signale; a concrete AI application in marketing/customer/retail/pricing must additionally return ki_performance; a transferable sector conclusion may additionally return sub_branchen_insight. Each topic needs its own verbatim evidence sentence.
Pure title sponsorship, logo placement, generic visibility/community claims and tactical discounts/coupons are not Marketing by themselves. They require a concrete activation mechanism plus strategic rationale, customer insight, tested learning or measurable result. A campaign or product launch needs transferable substance beyond the announcement itself.
For each routing_decision, provide separate verbatim evidence. If routing is not eligible, use an empty evidence string and explain why in German.
</routing_rules>
<tier1_companies>${JSON.stringify(companies.map((company) => ({ name: company.name, aliases: company.aliases })))}</tier1_companies>
<source name="${source.company || "unknown"}" category="${source.category || "unknown"}" />
<article_title>${title}</article_title>
<article_text>${modelContent}</article_text>
<task>Return a conservative final classification. Evidence must be copied verbatim from article_title or article_text. Determine article_type from the actual format, not merely words in the headline. Use study only for an empirical study/survey with exposed method or sample and findings; whitepaper only for a substantive whitepaper, research paper or playbook; report for a market, trend, benchmark or forecast report; case_study only for a documented practice case with approach and outcome. Use press_release for a complete standalone press release and company_update for ordinary company announcements. Use other only when none of the eleven meaningful types fits; other can never be reliable. Acquisition, finance, operations, product, campaign, expansion and personnel announcements are company_update. title_de must be a faithful, fluent German translation of article_title without adding or omitting facts; preserve names, brands, numbers and claims exactly. Use German for title_de, summary, rationale, route reasons and market_insight_explanation. event_key must describe the underlying event, not the publication.</task>`;
}

export function validateClassification(
  raw: AiClassification,
  articleText: string,
  tier1Companies: Array<{ name: string; aliases: string[] }>,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): AiClassification {
  const canonicalCompanies = new Map(tier1Companies.map((company) => [normalizeMatchText(company.name), company]));
  const marketInsightTransferable = Boolean(raw.market_insight_transferable);
  const relevanceMode = (topicId: string) => config.relevance[topicId as keyof PipelineConfig["relevance"]];
  const hasRequiredImpact = (tag: AiTag) => /\b(measur\w*|impact|result\w*|uplift|roi|increase\w*|improv\w*|wirkung|ergebnis\w*|steiger\w*|strategie|strategy|implemented|eingefuhrt|pilot)\b/i
    .test(normalizeMatchText(tag.evidence));
  const topics = (Array.isArray(raw.topics) ? raw.topics : [])
    .filter((tag) => TOPIC_IDS.includes(tag.id as typeof TOPIC_IDS[number]))
    .map((tag) => ({ ...tag, confidence: clampConfidence(tag.confidence) }))
    .filter((tag) => tag.confidence >= config.quality.topic_confidence && evidenceExists(tag.evidence, articleText))
    .filter((tag) => relevanceMode(tag.id) !== "not_relevant")
    .filter((tag) => relevanceMode(tag.id) !== "impact_required" || hasRequiredImpact(tag))
    .filter((tag) => tag.id !== "sub_branchen_insight" || !config.relevance.require_subsector_transferability || marketInsightTransferable)
    .filter((tag) => tag.id !== "ki_performance" || config.relevance.allow_ai_pilot || !/\bpilot\b/i.test(normalizeMatchText(tag.evidence)))
    .filter((tag) => tag.id !== "ki_performance" || !config.relevance.require_ai_application
      || /\b(used|uses|using|deploy\w*|implement\w*|pilot|application|anwendung|eingesetzt|einfuhr\w*|automati\w*|optimier\w*)\b/i.test(normalizeMatchText(tag.evidence)))
    .filter((tag) => tag.id !== "marketing_insights" || config.relevance.allow_campaign_without_results
      || !/\b(campaign|kampagn)\w*\b/i.test(normalizeMatchText(tag.evidence)) || hasRequiredImpact(tag))
    // Topic labels are never trusted on their own. The exact evidence must
    // contain the semantic context required by that Marketing dimension.
    .filter((tag) => !DIRECT_MARKETING_TOPIC_IDS.has(tag.id) || hasDirectMarketingContext(tag));
  const territory = raw.territory && TERRITORY_IDS.includes(raw.territory.id as typeof TERRITORY_IDS[number])
      && clampConfidence(raw.territory.confidence) >= config.quality.territory_confidence && evidenceExists(raw.territory.evidence, articleText)
    ? { ...raw.territory, confidence: clampConfidence(raw.territory.confidence) }
    : { id: "none", confidence: 0, evidence: "" };
  const companies = (Array.isArray(raw.companies) ? raw.companies : [])
    .map((company) => {
      const canonical = canonicalCompanies.get(normalizeMatchText(company.name));
      return {
        ...company,
        name: canonical?.name || "",
        aliases: canonical?.aliases || [],
        confidence: clampConfidence(company.confidence),
      };
    })
    // The evidence sentence itself must name the company (or one of its
    // aliases). This prevents a stray navigation mention such as "Action"
    // from being attached to evidence about the actual subject, e.g. Asda.
    .filter((company) => company.name && company.confidence >= config.quality.company_confidence
      && evidenceExists(company.evidence, articleText)
      && companyEvidenceMentionsCandidate(company.evidence, company))
    .map(({ aliases: _aliases, ...company }) => company);
  const people = (Array.isArray(raw.people) ? raw.people : [])
    .map((person) => {
      const role = String(person.role || "").trim();
      const name = String(person.name || "").trim() || (config.decisions.buying_center_allow_role_without_name && role ? `Rolle: ${role}` : "");
      return { ...person, name, role, confidence: clampConfidence(person.confidence) };
    })
    .filter((person) => person.name && person.role && person.confidence >= config.quality.person_confidence && evidenceExists(person.evidence, articleText));
  const qualifiedEventParticipation = hasQualifiedTier1EventParticipation(
    articleText,
    selectCompanyCandidates(articleText, tier1Companies),
  );
  const salesTriggers = (Array.isArray(raw.sales_triggers) ? raw.sales_triggers : [])
    .filter((trigger) => SALES_TRIGGER_IDS.includes(trigger.id as typeof SALES_TRIGGER_IDS[number]))
    .map((trigger) => ({ ...trigger, confidence: clampConfidence(trigger.confidence) }))
    .filter((trigger) => trigger.confidence >= config.quality.sales_trigger_confidence && evidenceExists(trigger.evidence, articleText))
    .filter((trigger) => trigger.id !== "event_participation" || qualifiedEventParticipation)
    .filter((trigger) => trigger.id !== "marketing_problem" || isExplicitUnresolvedMarketingProblem(trigger.evidence))
    .filter((trigger) => !config.decisions.sales_requires_implementation
      || /\b(launch\w*|implement\w*|invest\w*|acquir\w*|expand\w*|start\w*|einfuhr\w*|investier\w*|ubernomm\w*|expandier\w*|gestartet|umgesetzt)\b/i.test(normalizeMatchText(trigger.evidence)));
  const marketingUse: AiMarketingUse = {
    publishable: Boolean(raw.marketing_use?.publishable) && evidenceExists(raw.marketing_use?.evidence || "", articleText),
    transferable_value: String(raw.marketing_use?.transferable_value || "").trim().slice(0, 700),
    sufficient_substance: Boolean(raw.marketing_use?.sufficient_substance),
    evidence: evidenceExists(raw.marketing_use?.evidence || "", articleText) ? String(raw.marketing_use.evidence).trim() : "",
  };
  if (marketInsightTransferable && marketingUse.sufficient_substance && marketingUse.transferable_value) {
    const recoveredEvidence = marketingUse.evidence || recoverExactMarketingEvidence(articleText);
    if (recoveredEvidence) {
      const recoveredTopic: AiTag = {
        id: inferRecoveredMarketingTopic(recoveredEvidence),
        confidence: Math.max(config.quality.topic_confidence, clampConfidence(raw.routing_decisions?.marketing?.confidence)),
        evidence: recoveredEvidence,
      };
      const recoveredHasMarketingContext = hasDirectMarketingContext(recoveredTopic);
      const recoveredHasSubsectorContext = topics.some((topic) => topic.id === "sub_branchen_insight")
        && marketInsightTransferable;
      if (recoveredHasMarketingContext || recoveredHasSubsectorContext) {
        if (!topics.some(hasDirectMarketingContext) && recoveredHasMarketingContext) topics.push(recoveredTopic);
        marketingUse.evidence = recoveredEvidence;
        marketingUse.publishable = true;
      } else {
        marketingUse.publishable = false;
      }
    }
  }
  if (!marketingUse.transferable_value || !marketingUse.sufficient_substance || !marketingUse.evidence) {
    marketingUse.publishable = false;
  }
  // Gemini sometimes emits only its strongest topic. Once it has established
  // transferable Marketing substance, recover other independently evidenced
  // Customer/Retail/applied-AI dimensions from exact article sentences.
  if (marketingUse.publishable && marketingUse.sufficient_substance) {
    topics.push(...recoverMissingMarketingTopics(articleText, topics, config.quality.topic_confidence));
  }
  const salesUse: AiSalesUse = {
    actionable: Boolean(raw.sales_use?.actionable),
    company_challenge: String(raw.sales_use?.company_challenge || "").trim().slice(0, 700),
    roots_relevance: String(raw.sales_use?.roots_relevance || "").trim().slice(0, 700),
    sufficient_substance: Boolean(raw.sales_use?.sufficient_substance),
    personalization_facts: (Array.isArray(raw.sales_use?.personalization_facts) ? raw.sales_use.personalization_facts : [])
      .map((basis) => String(basis).trim()).filter(Boolean).slice(0, 5),
    evidence: evidenceExists(raw.sales_use?.evidence || "", articleText)
      ? String(raw.sales_use.evidence).trim() : String(salesTriggers[0]?.evidence || ""),
  };
  // Gemini occasionally returns a false boolean while simultaneously providing
  // every required, evidence-backed Sales field. Derive the boolean from those
  // validated fields so routing remains deterministic and reproducible.
  salesUse.actionable = Boolean(
    salesUse.company_challenge && salesUse.roots_relevance && salesUse.sufficient_substance
    && salesUse.personalization_facts.length > 0 && salesUse.evidence,
  );
  if (salesUse.actionable && companies.length === 0 && tier1Companies.length === 1) {
    const candidate = tier1Companies[0];
    const matchedLabel = [candidate.name, ...(candidate.aliases || [])]
      .find((label) => containsMatchTerm(articleText, label)) || candidate.name;
    companies.push({ name: candidate.name, role: "affected_party", confidence: 1, evidence: matchedLabel });
  }
  const validatedMarketingProblem = salesTriggers.find((trigger) => trigger.id === "marketing_problem");
  const problemEvidence = salesUse.evidence || validatedMarketingProblem?.evidence || "";
  const hasExplicitMarketingProblem = isExplicitUnresolvedMarketingProblem(problemEvidence);
  if (validatedMarketingProblem && companies.some((company) => company.role !== "incidental_mention")
      && hasExplicitMarketingProblem) {
    salesUse.actionable = true;
    salesUse.company_challenge ||= "Explizit belegtes, aktuell relevantes Marketing-, Marken- oder Customer-Problem.";
    salesUse.roots_relevance ||= "Das belegte Problem liegt unmittelbar in einem ROOTS-Beratungsfeld.";
    salesUse.sufficient_substance = true;
    salesUse.personalization_facts = salesUse.personalization_facts.length
      ? salesUse.personalization_facts : [problemEvidence];
    salesUse.evidence = problemEvidence;
  }
  if (salesUse.actionable && companies.some((company) => company.role !== "incidental_mention")
      && hasExplicitMarketingProblem && !salesTriggers.some((trigger) => trigger.id === "marketing_problem")) {
    salesTriggers.push({
      id: "marketing_problem",
      confidence: Math.max(config.quality.sales_trigger_confidence, 0.9),
      evidence: salesUse.evidence,
    });
  }
  const buyingCenter: AiBuyingCenter = {
    recommended_roles: (Array.isArray(raw.buying_center?.recommended_roles) ? raw.buying_center.recommended_roles : [])
      .map((role) => String(role).trim()).filter(Boolean).slice(0, 4),
    research_required: Boolean(raw.buying_center?.research_required),
  };
  const scorePart = (value: unknown) => Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
  const marketingAssetValue: AiMarketingScore = {
    novelty: scorePart(raw.marketing_asset_value?.novelty), strategic_value: scorePart(raw.marketing_asset_value?.strategic_value),
    transferability: scorePart(raw.marketing_asset_value?.transferability), evidence_strength: scorePart(raw.marketing_asset_value?.evidence_strength),
    reason: String(raw.marketing_asset_value?.reason || "").trim().slice(0, 700),
  };
  const salesOpportunityValue: AiSalesScore = {
    problem_strength: scorePart(raw.sales_opportunity_value?.problem_strength), roots_fit: scorePart(raw.sales_opportunity_value?.roots_fit),
    buying_intent: scorePart(raw.sales_opportunity_value?.buying_intent), timing: scorePart(raw.sales_opportunity_value?.timing),
    reason: String(raw.sales_opportunity_value?.reason || "").trim().slice(0, 700),
  };
  const routingDecisions = {
    marketing: validateRouteDecision(raw.routing_decisions?.marketing, articleText, config.quality.routing_confidence),
    sales: validateRouteDecision(raw.routing_decisions?.sales, articleText, config.quality.routing_confidence),
  };
  if (salesUse.actionable && !routingDecisions.sales.eligible && salesTriggers.length > 0) {
    routingDecisions.sales = {
      eligible: true,
      confidence: Math.max(config.quality.routing_confidence, ...salesTriggers.map((trigger) => trigger.confidence)),
      evidence: salesUse.evidence,
      reason: String(raw.routing_decisions?.sales?.reason || "Belegte strategische Herausforderung mit ausreichender personalisierbarer Sales-Substanz.").slice(0, 700),
    };
  }
  const overallConfidence = clampConfidence(raw.overall_confidence);
  const articleType = normalizeArticleType(String(raw.article_type || "other"), articleText);
  const titleDe = String(raw.title_de || "").trim().slice(0, 500);
  let rejectionReasons = Array.isArray(raw.rejection_reasons) ? raw.rejection_reasons.filter(Boolean).slice(0, 8) : [];
  const directMarketingTopics = topics.filter(hasDirectMarketingContext).filter((topic) => {
    if (topic.id === "customer_insights") return config.decisions.customer_signal_qualifies_marketing;
    if (topic.id === "fmcg_retail_signale") return config.decisions.retail_signal_qualifies_marketing;
    return true;
  });
  const marketingEligibleTopics = [
    ...directMarketingTopics,
    ...topics.filter((topic) => topic.id === "sub_branchen_insight" && marketInsightTransferable),
  ];
  const marketingHasSubstance = hasTransferableMarketingSubstance(articleType, articleText, marketingEligibleTopics, marketingUse)
    && !isBareEventAnnouncement(articleText);
  if (marketingHasSubstance) {
    // Route-specific Sales failures cannot downgrade a valid Marketing result.
    rejectionReasons = rejectionReasons.filter((reason) => !SALES_ONLY_REJECTION_PATTERN.test(normalizeMatchText(String(reason))));
    if (!routingDecisions.marketing.eligible) {
      routingDecisions.marketing = {
        eligible: true,
        confidence: Math.max(config.quality.routing_confidence, ...marketingEligibleTopics.map((topic) => topic.confidence)),
        evidence: marketingUse.evidence,
        reason: "Übertragbarer Marketing-, Customer- oder Retail-Nutzen mit direktem Artikelbeleg.",
      };
    }
  } else if (routingDecisions.marketing.eligible) {
    routingDecisions.marketing = {
      eligible: false,
      confidence: routingDecisions.marketing.confidence,
      evidence: "",
      reason: "Keine ausreichend übertragbare Marketing-Substanz über Ankündigung, Sponsoring oder taktische Promotion hinaus.",
    };
  }
  const hasSalesSignal = companies.some((company) => company.role !== "incidental_mention") && salesTriggers.length > 0;
  const hasSignal = directMarketingTopics.length > 0 || topics.some((topic) => topic.id === "sub_branchen_insight") || hasSalesSignal;
  const expectedTopics = (raw.topics || []).filter((topic) => topic.id !== "sub_branchen_insight" || marketInsightTransferable);
  const evidenceComplete = topics.length === expectedTopics.length
    && companies.filter((company) => company.role !== "incidental_mention").length
      === (raw.companies || []).filter((company) => company.role !== "incidental_mention").length;
  const stronglySupportedMarketingSignal = marketingHasSubstance
    && marketingEligibleTopics.some((topic) => topic.confidence >= config.quality.reliable_confidence)
    && routingDecisions.marketing.eligible && overallConfidence >= config.quality.reliable_confidence;
  let status: AiClassification["relevance_status"] = "uncertain";
  if (raw.relevance_status === "rejected" && overallConfidence >= config.quality.reliable_confidence) status = "rejected";
  if (raw.relevance_status === "reliable" && overallConfidence >= config.quality.reliable_confidence && hasSignal
      && titleDe && evidenceComplete && !NON_RELEVANT_ARTICLE_TYPES.has(articleType) && rejectionReasons.length === 0) {
    status = "reliable";
  }
  if (raw.relevance_status !== "rejected" && stronglySupportedMarketingSignal
      && titleDe && !NON_RELEVANT_ARTICLE_TYPES.has(articleType) && rejectionReasons.length === 0) {
    status = "reliable";
  }
  const stronglySupportedSalesSignal = hasSalesSignal && routingDecisions.sales.eligible
    && salesUse.actionable && salesTriggers.length > 0;
  if (raw.relevance_status !== "rejected" && stronglySupportedSalesSignal
      && titleDe && !NON_RELEVANT_ARTICLE_TYPES.has(articleType) && rejectionReasons.length === 0) {
    status = "reliable";
  }
  // "Reliable" is an output state, not merely a model confidence label. A
  // reliable article must be eligible for at least one visible route.
  if (status === "reliable" && !marketingHasSubstance && !stronglySupportedSalesSignal) {
    status = "uncertain";
  }
  return {
    ...raw,
    relevance_status: status,
    overall_confidence: overallConfidence,
    article_type: articleType,
    language: ["de", "en", "other"].includes(raw.language) ? raw.language : "other",
    title_de: titleDe,
    summary: String(raw.summary || "").slice(0, 700),
    rationale: String(raw.rationale || "").slice(0, 1000),
    topics,
    territory,
    companies,
    people,
    market_insight_transferable: marketInsightTransferable,
    market_insight_explanation: String(raw.market_insight_explanation || "").trim().slice(0, 700),
    sales_triggers: salesTriggers,
    marketing_use: marketingUse,
    sales_use: salesUse,
    buying_center: buyingCenter,
    marketing_asset_value: marketingAssetValue,
    sales_opportunity_value: salesOpportunityValue,
    routing_decisions: routingDecisions,
    rejection_reasons: rejectionReasons,
    event_key: normalizeMatchText(String(raw.event_key || "")).slice(0, 180),
  };
}
