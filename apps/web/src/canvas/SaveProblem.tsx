import { useAsyncAction } from '../lib/useAsyncAction';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useCanvas, useSession } from './SessionContext';

export function SaveProblem() {
  const session = useSession();
  const save = useCanvas((state) => state.save);
  const reload = useAsyncAction(session.reloadFromServer);
  const overwrite = useAsyncAction(session.overwriteServer);
  const actionError = reload.error ?? overwrite.error;

  if (save.state === 'conflict')
    return (
      <Notice
        tone="warning"
        className="space__banner"
        actions={
          <>
            <Button busy={reload.busy} disabled={overwrite.busy} onClick={() => reload.run()}>
              Загрузить версию сервера
            </Button>
            <Button busy={overwrite.busy} disabled={reload.busy} onClick={() => overwrite.run()}>
              Сохранить мою версию
            </Button>
          </>
        }
      >
        <strong>Конфликт версий.</strong> Граф изменили в другом месте, автосохранение остановлено.
        Ваши правки на экране не потеряны: «Загрузить версию сервера» заменит их серверным графом,
        «Сохранить мою версию» перезапишет сервер.
        {actionError && <p className="notice__detail">{actionError.message}</p>}
      </Notice>
    );

  if (save.state === 'error' && save.error)
    return (
      <Notice
        tone="error"
        className="space__banner"
        actions={<Button onClick={session.retrySave}>Повторить сохранение</Button>}
      >
        Изменения не сохранены. {save.error.message} Правки остаются на экране и отправятся при
        повторе или следующей правке.
      </Notice>
    );

  return null;
}
