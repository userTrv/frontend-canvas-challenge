import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { CanvasSession } from './session';
import type { CanvasState } from './store';

export const SessionContext = createContext<CanvasSession | null>(null);

export function useSession(): CanvasSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionContext');
  return session;
}

export function useCanvas<T>(selector: (state: CanvasState) => T): T {
  return useStore(useSession().store, selector);
}
