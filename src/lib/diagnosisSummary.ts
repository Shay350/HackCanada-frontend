import { Incident } from './types';

const LOW_QUALITY_SUMMARY_MARKERS = [
  'without a structured report',
  'manual triage',
  'no structured actions',
  'triage generated without concise summary',
  'insufficient structured',
  'insufficient evidence',
];

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

const isLowQualitySummary = (value: string): boolean => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) {
    return true;
  }
  return LOW_QUALITY_SUMMARY_MARKERS.some((marker) => normalized.includes(marker));
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
    .slice(0, 2)
    .map((line) => `- ${truncateLine(line)}`);

  const lines = [
    `Automated diagnosis is incomplete for **${service}**. Current signals suggest:`,
  ];

  if (highlights.length > 0) {
    lines.push('## Evidence highlights', ...highlights);
  }

  lines.push(
    '## Next step',
    '- Review the suggested execution plan below and validate each step against current logs and metrics before applying changes.',
  );

  return lines.join('\n');
};

export const getDiagnosisSummaryMarkdown = (incident: Incident): string => {
  const markdown = incident.proposedFix?.markdown?.trim() || '';
  if (markdown && !isLowQualitySummary(markdown)) {
    return markdown;
  }

  const description = incident.proposedFix?.description?.trim() || '';
  if (description && !isLowQualitySummary(description)) {
    return description;
  }

  return buildFallbackSummary(incident);
};
