import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { authConfigured, getFirebaseAuth, signInWithGoogle, signOutOfGoogle } from './firebase.js';

interface AuthGateProps {
  children: (user: User | null, signOut: () => Promise<void>) => ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!authConfigured);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!authConfigured) {
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setReady(true);
    });
  }, []);

  async function handleSignIn() {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return <p className="muted">Checking sign-in…</p>;
  }

  if (authConfigured && !user) {
    return (
      <div className="signin">
        <h1>Feature Flags</h1>
        <p className="subtitle">Sign in with Google to administer feature flags.</p>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="button" onClick={() => void handleSignIn()} disabled={pending}>
          {pending ? 'Opening Google…' : 'Sign in with Google'}
        </button>
      </div>
    );
  }

  return <>{children(user, signOutOfGoogle)}</>;
}
