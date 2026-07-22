export type EventTier1Company = { name: string; aliases?: string[] };

function normalize(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EVENT_CONTEXT_PATTERN =
  /\b(event|messe|konferenz|conference|summit|festival|kongress|congress|expo|forum|convention|panel|keynote|speaker\w*|buhne|stage|session|omr|dmexco|cannes lions|anuga|web summit|sxsw|euroshop|eurocis|prowein|ifa berlin)\b/i;
const EVENT_ACTION_PATTERN =
  /\b(spricht|sprechen|sprach|referiert|referieren|prasentiert|prasentieren|diskutiert|diskutieren|tritt auf|auftreten|nimmt teil|teilnimmt|teilnehmen|halt eine keynote|gibt eine keynote|speaks?|speaking|will speak|presents?|presenting|discusses?|joins? (?:a )?panel|participates?|takes? part|appears? at|gives? (?:a )?keynote)\b/i;
const ROOTS_EVENT_TOPIC_PATTERN =
  /\b(marketing|marke\w*|brand\w*|positionier\w*|customer\w*|kund\w*|consumer\w*|konsument\w*|shopper\w*|retail\w*|handel\w*|category management|kategoriemanagement|innovation\w*|kunstliche intelligenz|\bki\b|artificial intelligence|\bai\b|pricing\w*|preisstrateg\w*|media\w*|werbung\w*|kampagn\w*|customer experience|customer journey)\b/i;
const CREDIBLE_ROLE_PATTERN =
  /\b(cmo|ceo|chief [a-z ]+ officer|marketingleiter\w*|marketingdirektor\w*|head of [a-z ]+|brand (?:manager|director|lead)|geschaftsfuhrer\w*|managing director|commercial director|sales director|vertriebsleiter\w*|category manager|innovation director|director|vice president|\bvp\b|vorstand\w*|leiter\w*)\b/i;
const REPORT_SUBSTANCE_PATTERN =
  /\b(ergebnis\w*|erkenntnis\w*|findings?|results?|zeigt|zeigte|found|reveals?|daten|data|studie\w*|study|survey|umfrage\w*|benchmark\w*|prozent|percent|\d+(?:[.,]\d+)?\s*%|learning\w*|lessons?|framework|modell\w*|fazit|conclusion\w*|messbar\w*|uplift|roi)\b/i;
const BARE_EVENT_PATTERN =
  /\b(teilnahme|nimmt teil|teilnimmt|teilnehmen|anwesend|vertreten|aussteller\w*|exhibitor\w*|attendee\w*|speaker\w*|redner\w*|referent\w*|auftritt\w*|tritt auf|spricht|sprechen|referiert|referieren|prasentiert|prasentieren|diskutiert|diskutieren|speaks?|speaking|presents?|presenting|discusses?|participates?|takes? part|joins? (?:a )?panel|gives? (?:a )?keynote|agenda|programm\w*|schedule|session|panel|keynote|tickets?|anmeldung)\b/i;

function hasPlausiblePerson(
  rawWindow: string,
  companyTerms: string[],
): boolean {
  const courtesy =
    /\b(?:Herr|Frau|Mr\.?|Mrs\.?|Ms\.?)\s+\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+){1,2}\b/u;
  if (courtesy.test(rawWindow)) return true;
  const names = rawWindow.match(
    /\b\p{Lu}[\p{L}'’.-]+(?:\s+(?:von|van|de|der|da|del))?\s+\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+)?\b/gu,
  ) || [];
  return names.some((name) => {
    const candidate = normalize(name);
    if (companyTerms.some((term) => candidate === normalize(term))) {
      return false;
    }
    return !/\b(chief|marketing|officer|head|brand|director|event|festival|conference|summit|group|gmbh|company)\b/i
      .test(candidate);
  });
}

export function hasQualifiedTier1EventParticipation(
  articleText: string,
  companies: EventTier1Company[],
): boolean {
  if (!companies.length) return false;
  const lowerText = articleText.toLocaleLowerCase("de-DE");
  return companies.some((company) => {
    const terms = [company.name, ...(company.aliases || [])].filter((term) =>
      term.trim().length >= 3
    );
    return terms.some((term) => {
      const lowerTerm = term.toLocaleLowerCase("de-DE");
      let offset = lowerText.indexOf(lowerTerm);
      while (offset >= 0) {
        const window = articleText.slice(
          Math.max(0, offset - 420),
          Math.min(articleText.length, offset + lowerTerm.length + 420),
        );
        const normalizedWindow = normalize(window);
        if (
          EVENT_CONTEXT_PATTERN.test(normalizedWindow) &&
          EVENT_ACTION_PATTERN.test(normalizedWindow) &&
          ROOTS_EVENT_TOPIC_PATTERN.test(normalizedWindow) &&
          CREDIBLE_ROLE_PATTERN.test(normalizedWindow) &&
          hasPlausiblePerson(window, terms)
        ) return true;
        offset = lowerText.indexOf(lowerTerm, offset + lowerTerm.length);
      }
      return false;
    });
  });
}

export function hasIndependentEventReportSubstance(
  articleText: string,
): boolean {
  const normalized = normalize(articleText);
  return EVENT_CONTEXT_PATTERN.test(normalized) &&
    ROOTS_EVENT_TOPIC_PATTERN.test(normalized) &&
    REPORT_SUBSTANCE_PATTERN.test(normalized);
}

export function isBareEventAnnouncement(articleText: string): boolean {
  const normalized = normalize(articleText);
  return EVENT_CONTEXT_PATTERN.test(normalized) &&
    BARE_EVENT_PATTERN.test(normalized) &&
    !hasIndependentEventReportSubstance(normalized);
}
