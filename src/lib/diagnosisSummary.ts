import { Incident } from './types';

const LOW_QUALITY_SUMMARY_MARKERS = [
  'without a structured report',
  'manual triage',
  'no structured actions',
  'triage generated without concise summary',
  'insufficient structured',
  'insufficient evidence',
];

const REQUIRED_SECTION_MARKERS = [
  'investigation steps',
  'problems found',
  'other important info',
  'solution suggestions',
];

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

const isLowQualitySummary = (value: string): boolean => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) {
    return true;
  }
  return LOW_QUALITY_SUMMARY_MARKERS.some((marker) => normalized.includes(marker));
};

const hasRequiredSections = (value: string): boolean => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return REQUIRED_SECTION_MARKERS.every((marker) => normalized.includes(marker));
};

const truncateLine = (value: string, maxLen = 180): string => {
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, maxLen - 3).trimEnd()}...`;
};

const buildFallbackSummary = (incident: Incident): string => {
  const service = normalizeWhitespace(incident.service || 'this service');
  const highlights = incident.logs
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => `- ${truncateLine(line)}`);

  const lines = [
    '## Investigation Steps',
    `- Diagnosis markdown from Gemini is unavailable for **${service}** in this result.`,
    '- Reviewed available incident logs and payload metadata only.',
    '',
    '## Problems Found',
    '- Root cause is currently inconclusive from model output.',
  ];

  if (highlights.length > 0) {
    lines.push(...highlights);
  }

  lines.push(
    '',
    '## Other Important Info',
    '- This summary is a frontend fallback and not an AI-authored incident report.',
    '',
    '## Solution Suggestions',
    '- Review execution steps below and validate against live telemetry before applying changes.',
  );

  return lines.join('\n');
};

export const getDiagnosisSummaryMarkdown = (incident: Incident): string => {
  const markdown = incident.proposedFix?.markdown?.trim() || '';
  if (markdown && (hasRequiredSections(markdown) || !isLowQualitySummary(markdown))) {
    return markdown;
  }

  const description = incident.proposedFix?.description?.trim() || '';
  if (description && (hasRequiredSections(description) || !isLowQualitySummary(description))) {
    return description;
  }

  return buildFallbackSummary(incident);
};
