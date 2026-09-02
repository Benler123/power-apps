import type { AuditEntry, FeatureFlag } from '../shared/types.js';
import { idToken } from './firebase.js';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await idToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export interface FlagDraft {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
}

export const api = {
  listFlags: () => request<{ flags: FeatureFlag[] }>('/flags').then((r) => r.flags),
  createFlag: (draft: FlagDraft) =>
    request<{ flag: FeatureFlag }>('/flags', { method: 'POST', body: JSON.stringify(draft) }).then((r) => r.flag),
  updateFlag: (key: string, patch: Partial<Omit<FlagDraft, 'key'>>) =>
    request<{ flag: FeatureFlag }>(`/flags/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.flag),
  deleteFlag: (key: string) => request<void>(`/flags/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  listAudit: () => request<{ entries: AuditEntry[] }>('/audit?limit=25').then((r) => r.entries),
};
