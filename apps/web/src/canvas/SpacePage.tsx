import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Canvas } from './Canvas';
import { SaveIndicator } from './SaveIndicator';
import { SaveProblem } from './SaveProblem';
import { CanvasSession } from './session';
import { Toolbar } from './Toolbar';
import { SessionContext, useCanvas, useSession } from './SessionContext';

export function SpacePage({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [session, setSession] = useState<CanvasSession | null>(null);

  useEffect(() => {
    const next = new CanvasSession(spaceId);
    setSession(next);
    void next.load();
    return () => next.dispose();
  }, [spaceId]);

  if (!session) return null;
  return (
    <SessionContext.Provider value={session}>
      <ReactFlowProvider>
        <SpaceLayout onClose={onClose} />
      </ReactFlowProvider>
    </SessionContext.Provider>
  );
}

function SpaceLayout({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const load = useCanvas((state) => state.load);
  const title = useCanvas((state) => state.title);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (session.hasUnsavedChanges) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [session]);

  return (
    <div className="space">
      <header className="space__header">
        <Button variant="ghost" onClick={onClose}>
          ← Все пространства
        </Button>
        <h1 className="space__title">{title || 'Пространство'}</h1>
        {load.status === 'ready' && (
          <>
            <SaveIndicator />
            <Toolbar />
          </>
        )}
      </header>
      {load.status === 'ready' && <SaveProblem />}
      {load.status === 'loading' && <p className="space__message muted">Загружаем граф…</p>}
      {load.status === 'error' && (
        <Notice
          tone="error"
          className="space__message"
          actions={
            <>
              <Button onClick={() => void session.load()}>Повторить</Button>
              <Button variant="ghost" onClick={onClose}>
                К списку
              </Button>
            </>
          }
        >
          {load.error.message}
        </Notice>
      )}
      {load.status === 'ready' && <Canvas />}
    </div>
  );
}
