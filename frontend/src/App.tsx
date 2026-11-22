
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';

import '@xyflow/react/style.css';
import './App.css';

const nodes: Node[] = [
  {
    id: 'r1',
    position: { x: 50, y: 90 },
    data: { label: 'R1 · Node Exporter' },
  },
  {
    id: 'r2',
    position: { x: 50, y: 280 },
    data: { label: 'R2 · Node Exporter' },
  },
  {
    id: 'prometheus',
    position: { x: 300, y: 180 },
    data: { label: 'Prometheus · R2' },
  },
  {
    id: 'alertmanager',
    position: { x: 530, y: 180 },
    data: { label: 'Alertmanager · R2' },
  },
  {
    id: 'backend',
    position: { x: 770, y: 180 },
    data: { label: 'Incident Manager · R2' },
  },
];

const edges: Edge[] = [
  { id: 'e1', source: 'r1', target: 'prometheus' },
  { id: 'e2', source: 'r2', target: 'prometheus' },
  { id: 'e3', source: 'prometheus', target: 'alertmanager' },
  { id: 'e4', source: 'alertmanager', target: 'backend' },
].map((edge) => ({
  ...edge,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
}));

export default function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>NetOps Sentinel</h1>
        <span>Interactive Network Topology</span>
      </header>

      <section className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} />
          <Controls />
        </ReactFlow>
      </section>
    </main>
  );
}

