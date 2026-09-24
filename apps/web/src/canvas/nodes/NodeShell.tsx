import type { ReactNode } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NODE_META, type NodeType } from '../graph';

interface NodeShellProps {
  id: string;
  type: NodeType;
  title?: string;
  selected: boolean;
  children: ReactNode;
}

export function NodeShell({ id, type, title, selected, children }: NodeShellProps) {
  const { deleteElements } = useReactFlow();
  const meta = NODE_META[type];
  const heading = title ?? meta.title;

  return (
    <section
      className={`node node--${type}${selected ? ' node--selected' : ''}`}
      aria-label={heading}
    >
      <header className="node__header">
        <h3 className="node__title">{heading}</h3>
        <button
          type="button"
          className="node__delete nodrag"
          aria-label={`Удалить ноду «${heading}»`}
          title="Удалить ноду"
          onClick={() => void deleteElements({ nodes: [{ id }] })}
        >
          ×
        </button>
      </header>
      <div className="node__body">{children}</div>
      {meta.input && (
        <Handle
          type="target"
          position={Position.Left}
          className="node__port"
          aria-label={meta.input}
          title={meta.input}
        />
      )}
      {meta.output && (
        <Handle
          type="source"
          position={Position.Right}
          className="node__port"
          aria-label={meta.output}
          title={meta.output}
        />
      )}
    </section>
  );
}
