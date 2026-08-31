import { useState } from 'react';

import type { FeatureFlag } from '../shared/types.js';

interface FlagRowProps {
  flag: FeatureFlag;
  onToggle: () => void;
  onSave: (patch: { description: string; rolloutPercentage: number }) => void;
  onDelete: () => void;
}

export function FlagRow({ flag, onToggle, onSave, onDelete }: FlagRowProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(flag.description);
  const [rollout, setRollout] = useState(flag.rolloutPercentage);

  function cancel() {
    setDescription(flag.description);
    setRollout(flag.rolloutPercentage);
    setEditing(false);
  }

  function save() {
    onSave({ description, rolloutPercentage: rollout });
    setEditing(false);
  }

  return (
    <tr>
      <td>
        <code>{flag.key}</code>
      </td>
      <td>
        {editing ? (
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        ) : (
          <span className={flag.description ? undefined : 'muted'}>{flag.description || 'No description'}</span>
        )}
      </td>
      <td>
        <span className={flag.enabled ? 'pill on' : 'pill off'}>{flag.enabled ? 'on' : 'off'}</span>
      </td>
      <td>
        {editing ? (
          <input type="number" min={0} max={100} value={rollout} onChange={(e) => setRollout(Number(e.target.value))} />
        ) : (
          `${flag.rolloutPercentage}%`
        )}
      </td>
      <td>
        <div className="row-actions">
          {editing ? (
            <>
              <button className="primary" onClick={save}>
                Save
              </button>
              <button onClick={cancel}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={onToggle}>{flag.enabled ? 'Disable' : 'Enable'}</button>
              <button onClick={() => setEditing(true)}>Edit</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete flag "${flag.key}"?`)) {
                    onDelete();
                  }
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
