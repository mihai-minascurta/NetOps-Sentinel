import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';

import { Network, Info } from 'lucide-react';
import ComponentDetails from './components/ComponentDetails';
import DeviceNode from './components/DeviceNode';
import TopologyEdge from './components/TopologyEdge';
import {
  activeEdgeMarker,
  edges,
  getComponentRoute,
  nodes,
  type DiagramNode,
  type HostBoundaryNode,
  type StageNode,
  type TopologyEdgeType,
} from './topology';

import '@xyflow/react/style.css';
import './App.css';

function HostBoundary({ data }: NodeProps<HostBoundaryNode>) {
  return <span className="r2-group__label">{data.label}</span>;
}

function Stage({ data }: NodeProps<StageNode>) {
  if (data.label) {
    return <div className="stage-heading">{data.label}</div>;
  }

  return (
    <div className="stage-continuation">
      <span />
      <span />
      <span />
    </div>
  );
}

const nodeTypes = {
  device: DeviceNode,
  group: HostBoundary,
  stage: Stage,
};

const edgeTypes = { topology: TopologyEdge };
const fitViewOptions = { padding: 32 };

export default function App() {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flow, setFlow] = useState<ReactFlowInstance<DiagramNode, TopologyEdgeType> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousPanelWidth = useRef(0);
  const focusOnClose = useRef<string | null>(null);
  const restoringNodeFocus = useRef(false);
  const selected = flowNodes.find((node) => node.selected);
  const selectedDevice = selected?.type === 'device' ? selected : null;
  const selectedId = selectedDevice?.id;
  const panelOpen = selectedDevice !== null;

  const graph = useMemo(() => {
    if (!selectedId) return { nodes: flowNodes, edges };

    const route = getComponentRoute(selectedId);
    return {
      nodes: flowNodes.map((node) => {
        if (node.type !== 'device' || route.nodeIds.has(node.id)) return node;
        return { ...node, className: 'is-outside-route' };
      }),
      edges: edges.map((edge) => {
        if (!route.edgeIds.has(edge.id)) {
          return { ...edge, className: 'is-outside-route', data: { ...edge.data, dimmed: true } };
        }

        return {
          ...edge,
          className: 'topology-edge--active',
          markerEnd: activeEdgeMarker,
          data: { ...edge.data, active: true },
        };
      }),
    };
  }, [flowNodes, selectedId]);

  const closeDetails = useCallback(() => {
    if (!selectedId) return;

    focusOnClose.current = selectedId;
    setFlowNodes((current) => current.map((node) => node.selected ? { ...node, selected: false } : node));
  }, [selectedId, setFlowNodes]);

  useEffect(() => {
    if (!panelOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      closeDetails();
    }

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [panelOpen, closeDetails]);

  useLayoutEffect(() => {
    if (!flow) return;
    const instance = flow;

    function moveForPanel(panelWidth: number) {
      const deltaX = previousPanelWidth.current - panelWidth;
      if (deltaX === 0) return;

      const viewport = instance.getViewport();
      void instance.setViewport({ ...viewport, x: viewport.x + deltaX }, { duration: 0 });
      previousPanelWidth.current = panelWidth;
    }

    const panel = panelOpen ? panelRef.current : null;
    if (panel) {
      const measure = () => moveForPanel(panel.getBoundingClientRect().width);
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(panel, { box: 'border-box' });
      return () => observer.disconnect();
    }

    moveForPanel(0);
    const nodeId = focusOnClose.current;
    focusOnClose.current = null;
    if (!nodeId) return;

    const node = canvasRef.current?.querySelector<HTMLElement>(
      `.react-flow__node-device[data-id="${CSS.escape(nodeId)}"]`,
    );
    restoringNodeFocus.current = true;
    node?.focus({ preventScroll: true });
    restoringNodeFocus.current = false;
  }, [flow, panelOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Network size={18} strokeWidth={1.5} />
          </span>
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
        <div
          ref={canvasRef}
          className="topology-canvas"
          onFocusCapture={(event) => {
            if (restoringNodeFocus.current) event.stopPropagation();
          }}
        >
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={fitViewOptions}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            minZoom={0.35}
            maxZoom={1.8}
            onNodesChange={onNodesChange}
            onInit={setFlow}
          >
            <Background
              variant={BackgroundVariant.Dots}
              bgColor="var(--color-bg)"
              color="var(--canvas-dot)"
              gap={24}
              size={0.8}
            />
            <Controls showInteractive={false} fitViewOptions={fitViewOptions} />
          </ReactFlow>

          <div className="canvas-hint">
            <Info size={15} />
            Click a component for details · Scroll to zoom
          </div>
        </div>

        {selectedDevice && (
          <ComponentDetails device={selectedDevice} panelRef={panelRef} onClose={closeDetails} />
        )}
      </main>

      <footer className="app-footer">
        <span>OCI · R1 + R2 · Docker · Prometheus · AI</span>
        <span>No automatic remediation</span>
      </footer>
    </div>
  );
}
