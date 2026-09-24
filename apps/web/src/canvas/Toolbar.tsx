import { useStoreApi } from '@xyflow/react';
import { MAX_NODES } from '../config';
import { Button } from '../ui/Button';
import { NODE_META, type CanvasEdge, type CanvasNode, type NodeType } from './graph';
import { useCanvas, useSession } from './SessionContext';

const NODE_TYPES: NodeType[] = ['prompt', 'generator', 'result'];
const COLUMN: Record<NodeType, number> = { prompt: -1, generator: 0, result: 1 };

export function Toolbar() {
  const session = useSession();
  const flow = useStoreApi<CanvasNode, CanvasEdge>();
  const nodeCount = useCanvas((state) => state.nodes.length);
  const full = nodeCount >= MAX_NODES;
  const chainFits = nodeCount + 3 <= MAX_NODES;

  function visibleSpot(column: number) {
    const { width, height, transform } = flow.getState();
    const [x, y, zoom] = transform;
    return {
      x: (width / 2 - x) / zoom - 120 + column * 320,
      y: (height / 4 - y) / zoom + (nodeCount % 5) * 32,
    };
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Добавить ноду">
      {NODE_TYPES.map((type) => (
        <Button
          key={type}
          disabled={full}
          onClick={() => session.addNode(type, visibleSpot(COLUMN[type]))}
        >
          + {NODE_META[type].title}
        </Button>
      ))}
      <Button disabled={!chainFits} onClick={() => session.addChain(visibleSpot(-1))}>
        + Цепочка
      </Button>
      {full && <span className="muted">Максимум {MAX_NODES} нод.</span>}
    </div>
  );
}
