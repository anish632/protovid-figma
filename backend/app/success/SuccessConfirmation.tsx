'use client';

import { useEffect, useState } from 'react';

type ConfirmationState = 'idle' | 'confirming' | 'confirmed' | 'failed';

export function SuccessConfirmation({ sessionId }: { sessionId?: string }) {
  const [state, setState] = useState<ConfirmationState>(sessionId ? 'confirming' : 'idle');

  useEffect(() => {
    if (!sessionId) return;

    let canceled = false;

    async function confirmSession() {
      try {
        const response = await fetch('/api/billing/confirm-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (!canceled) {
          setState(response.ok ? 'confirmed' : 'failed');
        }
      } catch (_error) {
        if (!canceled) setState('failed');
      }
    }

    confirmSession();

    return () => {
      canceled = true;
    };
  }, [sessionId]);

  if (state === 'confirmed') {
    return (
      <p style={{ color: '#166534', fontSize: 14, marginBottom: 16 }}>
        Payment confirmed. Return to Figma and ProtoVid will unlock paid access automatically.
      </p>
    );
  }

  if (state === 'failed') {
    return (
      <p style={{ color: '#92400e', fontSize: 14, marginBottom: 16 }}>
        Payment succeeded, but confirmation is still catching up. Return to Figma and use Check payment status.
      </p>
    );
  }

  if (state === 'confirming') {
    return (
      <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>
        Confirming your paid access...
      </p>
    );
  }

  return null;
}
