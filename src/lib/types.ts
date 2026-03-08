export interface ProposedFix {
  description: string;
  steps: string[];
  markdown?: string;
}

export interface Incident {
  id: string;
  service: string;
  serviceType: string;
  status: 'online' | 'issue' | 'warning' | 'resolving';
  logs: string[];
  confidence: number;
  proposedFix: ProposedFix | null;
}
