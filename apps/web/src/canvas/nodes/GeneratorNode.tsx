import { memo, useState } from 'react';
import { useNodeConnections, useNodesData, type NodeProps } from '@xyflow/react';
import type { GenerationData } from '@canvas/contracts';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Notice, StatusBadge, type Tone } from '../../ui/Notice';
import type { Scenario } from '../generation-controller';
import type { GeneratorNode as GeneratorNodeType, PromptNode } from '../graph';
import { useCanvas, useSession } from '../SessionContext';
import type { LaunchState } from '../store';
import { NodeShell } from './NodeShell';

const STAGE_PREFIX: Record<Extract<LaunchState, { status: 'error' }>['stage'], string> = {
  save: 'Граф не сохранён, генерация не запущена.',
  start: 'Генерация не запущена.',
  poll: 'Нет ответа о статусе генерации, продолжаем проверять.',
};

function describeStatus(
  launch: LaunchState | undefined,
  generation: GenerationData | undefined,
): { tone: Tone; text: string } | null {
  if (launch?.status === 'starting') return { tone: 'progress', text: 'Сохраняем и запускаем…' };
  if (launch?.status === 'error')
    return launch.stage === 'poll'
      ? { tone: 'warning', text: 'Нет связи с сервером' }
      : { tone: 'error', text: 'Не запущено' };
  switch (generation?.status) {
    case 'processing':
      return { tone: 'progress', text: 'Генерация…' };
    case 'succeeded':
      return { tone: 'success', text: 'Готово' };
    case 'failed':
      return { tone: 'error', text: 'Генерация не удалась' };
    default:
      return null;
  }
}

export const GeneratorNode = memo(function GeneratorNode({
  id,
  data,
  selected,
}: NodeProps<GeneratorNodeType>) {
  const session = useSession();
  const [scenario, setScenario] = useState<Scenario>('success');
  const generation = useCanvas((state) => state.generations.byGenerator.get(id));
  const launch = useCanvas((state) => state.launches.get(id));

  const inputs = useNodeConnections({ handleType: 'target' });
  const outputs = useNodeConnections({ handleType: 'source' });
  const prompt = useNodesData<PromptNode>(inputs[0]?.source ?? '');
  const missing = !prompt
    ? 'Соедините вход с нодой «Текст».'
    : !prompt.data.text.trim()
      ? 'Заполните описание в текстовой ноде.'
      : outputs.length === 0
        ? 'Соедините выход с нодой «Результат».'
        : null;

  const launchError = launch?.status === 'error' ? launch : null;
  const starting = launch?.status === 'starting';
  const processing = generation?.status === 'processing' && !launchError;
  const failed = launchError !== null || generation?.status === 'failed';
  const status = describeStatus(launch, generation);

  return (
    <NodeShell id={id} type="generator" title={data.label} selected={selected}>
      <Field label="Сценарий" hint="Тестовый отказ проверяет обработку ошибки.">
        {(control) => (
          <select
            {...control}
            className="input nodrag"
            value={scenario}
            onChange={(event) => setScenario(event.target.value as Scenario)}
          >
            <option value="success">Успех</option>
            <option value="failure">Тестовый отказ</option>
          </select>
        )}
      </Field>

      {status && <StatusBadge tone={status.tone}>{status.text}</StatusBadge>}
      {launchError && (
        <Notice tone={launchError.stage === 'poll' ? 'warning' : 'error'}>
          {STAGE_PREFIX[launchError.stage]} {launchError.error.message}
        </Notice>
      )}
      {!launch && generation?.status === 'failed' && (
        <Notice tone="error">Сервер сообщил о сбое генерации. Запустите её ещё раз.</Notice>
      )}
      {missing && <p className="node__hint">{missing}</p>}

      <Button
        variant="primary"
        className="nodrag"
        busy={starting}
        disabled={Boolean(missing) || processing}
        onClick={() => void session.generations.start(id, scenario)}
      >
        {starting
          ? 'Запускаем…'
          : processing
            ? 'Генерация идёт…'
            : failed
              ? 'Повторить'
              : 'Сгенерировать'}
      </Button>
    </NodeShell>
  );
});
