import { useState } from 'react';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
} from '@xyflow/react';

import { Network, X, Info } from 'lucide-react';
import DeviceNode from './components/DeviceNode';
import { nodes, edges, type DeviceData } from './topology';

import '@xyflow/react/style.css';
import './App.css';

const nodeTypes = {
  device: DeviceNode,
};

export default function App() {
  const [selected, setSelected] = useState<DeviceData | null>(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Network size={24} />
          <div>
            <h1>NetOps Sentinel</h1>
            <p>Interactive System Architecture</p>
          </div>
        </div>

        <span className="preview-label">
          Topology preview · Not live
        </span>
      </header>

      <main className="workspace">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          minZoom={0.35}
          maxZoom={1.8}
          onNodeClick={(_, node) => {
            if (node.type === 'device') {
              setSelected(node.data as DeviceData);
            }
          }}
          onPaneClick={() => setSelected(null)}
        >
          <Background
            variant={BackgroundVariant.Dots}
            bgColor="var(--color-bg)"
            color="var(--canvas-dot)"
            gap={24}
            size={0.8}
          />
          <Controls showInteractive={false} />
        </ReactFlow>

        <div className="canvas-hint">
          <Info size={15} />
          Click a component for details · Scroll to zoom
        </div>

        {selected && (
          <aside className="details-panel">
            <div className="details-top">
              <span>COMPONENT DETAILS</span>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <h2>{selected.title}</h2>
            <p className="details-subtitle">{selected.subtitle}</p>

            <div className="details-divider" />

            <h3>Role in the system</h3>
            <p>{selected.description}</p>

            <div className="details-note">
              Architecture information — live status will be
              connected in M6.2.
            </div>
          </aside>
        )}
      </main>

      <footer className="app-footer">
        <span>OCI · R1 + R2 · Docker · Prometheus · AI</span>
        <span>No automatic remediation</span>
      </footer>
    </div>
  );
}
