import { useEffect, useState } from 'react';
import type { SpaceData } from '@canvas/contracts';
import { canvasApi } from '../api/canvas-api';
import { isAborted, toApiError, type ApiError } from '../api/client';
import { useAsyncAction } from '../lib/useAsyncAction';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Notice } from '../ui/Notice';

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; spaces: SpaceData[] }
  | { status: 'error'; error: ApiError };

const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });

export function SpacePicker({ onOpen }: { onOpen: (spaceId: string) => void }) {
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [title, setTitle] = useState('Мой канвас');
  const create = useAsyncAction(async (name: string) => {
    const space = await canvasApi.createSpace(name);
    onOpen(space.id);
  });

  useEffect(() => {
    const controller = new AbortController();
    setList({ status: 'loading' });
    canvasApi.listSpaces(controller.signal).then(
      (spaces) => setList({ status: 'ready', spaces }),
      (error: unknown) => {
        if (!isAborted(error)) setList({ status: 'error', error: toApiError(error) });
      },
    );
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <main className="picker">
      <h1>Рабочие пространства</h1>

      <form
        className="picker__create"
        onSubmit={(event) => {
          event.preventDefault();
          void create.run(title.trim());
        }}
      >
        <Field label="Название нового пространства" error={create.error?.message}>
          {(control) => (
            <input
              {...control}
              className="input"
              value={title}
              maxLength={80}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" busy={create.busy} disabled={!title.trim()}>
          Создать и открыть
        </Button>
      </form>

      <section aria-labelledby="spaces-heading">
        <h2 id="spaces-heading">Открыть существующее</h2>
        {list.status === 'loading' && <p className="muted">Загружаем список…</p>}
        {list.status === 'error' && (
          <Notice
            tone="error"
            actions={<Button onClick={() => setReloadKey((key) => key + 1)}>Повторить</Button>}
          >
            {list.error.message}
          </Notice>
        )}
        {list.status === 'ready' &&
          (list.spaces.length === 0 ? (
            <p className="muted">Пространств пока нет — создайте первое.</p>
          ) : (
            <ul className="picker__list">
              {list.spaces.map((space) => (
                <li key={space.id}>
                  <Button variant="ghost" className="picker__item" onClick={() => onOpen(space.id)}>
                    <span>{space.title}</span>
                    <time className="muted" dateTime={space.createdAt}>
                      {dateFormat.format(new Date(space.createdAt))}
                    </time>
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </main>
  );
}
