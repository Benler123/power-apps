export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  flagKey: string;
  action: 'created' | 'updated' | 'deleted';
  actor: string;
  before: Partial<FeatureFlag> | null;
  after: Partial<FeatureFlag> | null;
  createdAt: string;
}

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  reason: 'disabled' | 'rollout_excluded' | 'rollout_included' | 'enabled';
}
