import { useCallback, useSyncExternalStore } from 'react';

const SPACE_ROUTE = /^#\/spaces\/([0-9a-f-]{36})$/i;

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const readSpaceId = () => SPACE_ROUTE.exec(window.location.hash)?.[1] ?? null;

export function useSpaceRoute() {
  const spaceId = useSyncExternalStore(subscribe, readSpaceId);
  const openSpace = useCallback((id: string) => {
    window.location.hash = `/spaces/${id}`;
  }, []);
  const closeSpace = useCallback(() => {
    window.location.hash = '';
  }, []);
  return { spaceId, openSpace, closeSpace };
}
