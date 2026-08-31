import { useCallback, useEffect, useState } from 'react';

import type { AuditEntry, FeatureFlag } from '../shared/types.js';
import { api } from './api.js';
import { FlagRow } from './FlagRow.js';

export function App() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRollout, setNewRollout] = useState(100);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextFlags, nextAudit] = await Promise.all([api.listFlags(), api.listAudit()]);
      setFlags(nextFlags);
      setAudit(nextAudit);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await api.createFlag({
        key: newKey.trim(),
        description: newDescription.trim(),
        enabled: false,
        rolloutPercentage: newRollout,
      });
      setNewKey('');
      setNewDescription('');
      setNewRollout(100);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="app">
      <h1>Feature Flags</h1>
      <p className="subtitle">Toggle flags, tune percentage rollouts, and review who changed what.</p>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h2>New flag</h2>
        <form className="form-grid" onSubmit={handleCreate}>
          <div>
            <label htmlFor="key">Key</label>
            <input
              id="key"
              type="text"
              value={newKey}
              placeholder="checkout.new-cart"
              onChange={(e) => setNewKey(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              value={newDescription}
              placeholder="What does this flag control?"
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rollout">Rollout %</label>
            <input
              id="rollout"
              type="number"
              min={0}
              max={100}
              value={newRollout}
              onChange={(e) => setNewRollout(Number(e.target.value))}
            />
          </div>
          <button className="primary" type="submit" disabled={creating || newKey.trim() === ''}>
            {creating ? 'Creating…' : 'Create flag'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Flags ({flags.length})</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : flags.length === 0 ? (
          <p className="muted">No flags yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Description</th>
                <th>State</th>
                <th>Rollout</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  onToggle={() => mutate(() => api.updateFlag(flag.key, { enabled: !flag.enabled }))}
                  onSave={(patch) => mutate(() => api.updateFlag(flag.key, patch))}
                  onDelete={() => mutate(() => api.deleteFlag(flag.key))}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Recent changes</h2>
        {audit.length === 0 ? (
          <p className="muted">No changes recorded yet.</p>
        ) : (
          <ul className="audit-list">
            {audit.map((entry) => (
              <li key={entry.id}>
                <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                <span>
                  <strong>{entry.actor}</strong> {entry.action} <code>{entry.flagKey}</code>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
