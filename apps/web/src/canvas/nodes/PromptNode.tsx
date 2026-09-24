import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Field } from '../../ui/Field';
import type { PromptNode as PromptNodeType } from '../graph';
import { useSession } from '../SessionContext';
import { NodeShell } from './NodeShell';

const MAX_TEXT = 2000;

export const PromptNode = memo(function PromptNode({
  id,
  data,
  selected,
}: NodeProps<PromptNodeType>) {
  const session = useSession();
  return (
    <NodeShell id={id} type="prompt" selected={selected}>
      <Field label="Описание изображения" hint={`${data.text.length} / ${MAX_TEXT}`}>
        {(control) => (
          <textarea
            {...control}
            className="input nodrag nowheel"
            value={data.text}
            maxLength={MAX_TEXT}
            placeholder="Например: горы на рассвете"
            onChange={(event) => session.setPromptText(id, event.target.value)}
          />
        )}
      </Field>
    </NodeShell>
  );
});
