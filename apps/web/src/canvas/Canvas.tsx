import { Background, Controls, Panel, ReactFlow, type AriaLabelConfig } from '@xyflow/react';
import type { CanvasEdge, CanvasNode } from './graph';
import { nodeTypes } from './nodes';
import { useCanvas, useSession } from './SessionContext';

const NODE_EXTENT: [[number, number], [number, number]] = [
  [-10000, -10000],
  [10000, 10000],
];
const DELETE_KEYS = ['Delete', 'Backspace'];

const ARIA_LABELS: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default':
    'Enter или пробел — выбрать ноду, стрелки — переместить, Delete — удалить, Escape — отменить.',
  'node.a11yDescription.keyboardDisabled':
    'Enter или пробел — выбрать ноду, Delete — удалить, Escape — отменить.',
  'node.a11yDescription.ariaLiveMessage': ({ x, y }) =>
    `Нода перемещена. Позиция: x ${Math.round(x)}, y ${Math.round(y)}.`,
  'edge.a11yDescription.default':
    'Enter или пробел — выбрать связь, Delete — удалить, Escape — отменить.',
  'controls.ariaLabel': 'Масштаб канваса',
  'controls.zoomIn.ariaLabel': 'Приблизить',
  'controls.zoomOut.ariaLabel': 'Отдалить',
  'controls.fitView.ariaLabel': 'Показать все ноды',
  'handle.ariaLabel': 'Порт',
};

export function Canvas() {
  const session = useSession();
  const nodes = useCanvas((state) => state.nodes);
  const edges = useCanvas((state) => state.edges);
  const viewport = useCanvas((state) => state.viewport);
  const revision = useCanvas((state) => state.revision);

  return (
    <ReactFlow<CanvasNode, CanvasEdge>
      key={revision}
      className="canvas"
      aria-label="Канвас"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={session.onNodesChange}
      onEdgesChange={session.onEdgesChange}
      onConnect={session.onConnect}
      isValidConnection={session.isValidConnection}
      onMoveEnd={(_event, viewport) => session.onViewportChange(viewport)}
      defaultViewport={viewport}
      minZoom={0.1}
      maxZoom={4}
      nodeExtent={NODE_EXTENT}
      deleteKeyCode={DELETE_KEYS}
      ariaLabelConfig={ARIA_LABELS}
    >
      <Background />
      <Controls showInteractive={false} />
      <Panel position="bottom-center" className="canvas__help">
        Тяните от правого порта к левому: текст → генератор → результат. Выделенную ноду или связь
        удаляет Delete.
      </Panel>
    </ReactFlow>
  );
}
