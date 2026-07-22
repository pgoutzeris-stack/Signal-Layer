import {
  hasIndependentEventReportSubstance,
  hasQualifiedTier1EventParticipation,
  isBareEventAnnouncement,
} from "./event-signals.ts";

const tier1 = [{ name: "Adidas", aliases: ["adidas AG"] }];

Deno.test("accepts a qualified Tier-1 speaker from any source", () => {
  const text =
    "Frau Anna Müller, CMO bei Adidas, spricht auf der OMR über die neue globale Markenstrategie.";
  if (!hasQualifiedTier1EventParticipation(text, tier1)) {
    throw new Error("qualified speaker was rejected");
  }
  if (!isBareEventAnnouncement(text)) {
    throw new Error("appearance announcement should not qualify Marketing");
  }
});

Deno.test("rejects bare company attendance", () => {
  const text = "Adidas nimmt an der OMR teil und ist auf dem Event vertreten.";
  if (hasQualifiedTier1EventParticipation(text, tier1)) {
    throw new Error("bare attendance qualified");
  }
  if (!isBareEventAnnouncement(text)) {
    throw new Error("bare attendance was not detected");
  }
});

Deno.test("rejects a speaker directory without a substantive appearance", () => {
  const text =
    "Speaker und Teilnehmer der OMR: Anna Müller, CMO bei Adidas. Agenda und Anmeldung.";
  if (hasQualifiedTier1EventParticipation(text, tier1)) {
    throw new Error("directory qualified");
  }
  if (!isBareEventAnnouncement(text)) {
    throw new Error("directory was not detected");
  }
});

Deno.test("keeps a substantive event report eligible for Marketing review", () => {
  const text =
    "OMR Event-Rückblick: Eine Studie zum Konsumentenverhalten zeigt, dass 67 % der Befragten Markenvertrauen priorisieren.";
  if (!hasIndependentEventReportSubstance(text)) {
    throw new Error("substantive report was rejected");
  }
  if (isBareEventAnnouncement(text)) {
    throw new Error("substantive report treated as bare announcement");
  }
});
