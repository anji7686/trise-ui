import { useEffect, useRef, useState } from 'react';
import { RequestGeneration, SubscriptionCommands } from './subscription-support';

export function useSubscriptionActions(scope: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const state = useRef({ scope, commands: new SubscriptionCommands(), generation: new RequestGeneration(), running: false });
  if (state.current.scope !== scope) {
    state.current.generation.invalidate();
    state.current = { scope, commands: new SubscriptionCommands(), generation: new RequestGeneration(), running: false };
  }
  useEffect(() => { setBusy(false); setError(''); const current = state.current; return () => current.generation.invalidate(); }, [scope]);
  async function run(signature: string, command: (key: string) => Promise<unknown>, refresh: () => Promise<void>) {
    const current = state.current;
    if (current.running) return;
    current.running = true;
    const valid = current.generation.next();
    try {
      await current.commands.run(signature, async (key) => {
        if (valid()) { setBusy(true); setError(''); }
        await command(key);
        if (valid()) await refresh();
      });
    } catch (cause) {
      if (valid()) setError((cause as { message?: string })?.message || 'The action could not be completed. Retry the same action safely.');
    } finally { current.running = false; if (valid()) setBusy(false); }
  }
  return { busy, error, setError, run };
}
