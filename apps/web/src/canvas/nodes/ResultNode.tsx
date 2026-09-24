import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { apiUrl } from '../../api/client';
import { StatusBadge } from '../../ui/Notice';
import type { ResultNode as ResultNodeType } from '../graph';
import { useCanvas } from '../SessionContext';
import { NodeShell } from './NodeShell';

export const ResultNode = memo(function ResultNode({
  id,
  data,
  selected,
}: NodeProps<ResultNodeType>) {
  const generation = useCanvas((state) => state.generations.byResult.get(id));

  return (
    <NodeShell id={id} type="result" title={data.label} selected={selected}>
      <div className="node__preview" aria-live="polite">
        {!generation && (
          <p className="node__hint">Соедините с генератором и запустите генерацию.</p>
        )}
        {generation?.status === 'processing' && (
          <StatusBadge tone="progress">Генерация…</StatusBadge>
        )}
        {generation?.status === 'failed' && (
          <p className="node__hint">Генерация не удалась. Повторите запуск в генераторе.</p>
        )}
        {generation?.status === 'succeeded' && generation.imageUrl && (
          <img
            src={apiUrl(generation.imageUrl)}
            alt={`Изображение по описанию «${generation.prompt}»`}
            draggable={false}
          />
        )}
      </div>
    </NodeShell>
  );
});
