import { useCallback, useState } from 'react';
import { toApiError, type ApiError } from '../api/client';

interface AsyncActionState {
  busy: boolean;
  error: ApiError | null;
}

export function useAsyncAction<A extends unknown[]>(action: (...args: A) => Promise<unknown>) {
  const [state, setState] = useState<AsyncActionState>({ busy: false, error: null });
  const run = useCallback(
    async (...args: A) => {
      setState({ busy: true, error: null });
      try {
        await action(...args);
        setState({ busy: false, error: null });
      } catch (error) {
        setState({ busy: false, error: toApiError(error) });
      }
    },
    [action],
  );
  return { ...state, run };
}
