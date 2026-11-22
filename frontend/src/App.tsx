import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  getViewportForBounds,
  useNodesState,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';

import { Network, Info } from 'lucide-react';
import CanvasControls from './components/CanvasControls';
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
const diagramNodeIds = nodes.map((node) => node.id);
const fitPadding = { top: 32, right: 32, bottom: 56, left: 32 };
const minimumZoomRatio = 0.6;
const zoomStep = 1.15;

export default function App() {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flow, setFlow] = useState<ReactFlowInstance<DiagramNode, TopologyEdgeType> | null>(null);
  const [defaultZoom, setDefaultZoom] = useState<number | null>(null);
  const defaultViewport = useRef<Viewport | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousPanelWidth = useRef(0);
  const focusOnClose = useRef<string | null>(null);
  const selected = flowNodes.find((node) => node.selected);
  const selectedDevice = selected?.type === 'device' ? selected : null;
  const selectedId = selectedDevice?.id;
  const panelOpen = selectedDevice !== null;
  const minimumZoom = defaultZoom === null ? undefined : defaultZoom * minimumZoomRatio;
  const nodesMeasured = flowNodes.every((node) => node.measured?.width && node.measured.height);

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

  const fitDiagram = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!flow || !workspace || !nodesMeasured) return;

    // The workspace stays full width while the details panel is open.
    const { width, height } = workspace.getBoundingClientRect();
    if (width <= fitPadding.left + fitPadding.right || height <= fitPadding.top + fitPadding.bottom) return;

    const bounds = flow.getNodesBounds(diagramNodeIds);
    const fitted = getViewportForBounds(bounds, width, height, 0, Infinity, fitPadding);
    const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 0;

    defaultViewport.current = fitted;
    previousPanelWidth.current = panelWidth;
    setDefaultZoom(fitted.zoom);
    void flow.setViewport({ ...fitted, x: fitted.x - panelWidth }, { duration: 0 });
  }, [flow, nodesMeasured]);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!flow || !workspace || !nodesMeasured) return;

    let width = 0;
    let height = 0;
    const observer = new ResizeObserver(([entry]) => {
      const { width: nextWidth, height: nextHeight } = entry.contentRect;
      if (nextWidth === width && nextHeight === height) return;

      width = nextWidth;
      height = nextHeight;
      fitDiagram();
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [fitDiagram, flow, nodesMeasured]);

  function zoomBy(factor: number) {
    const workspace = workspaceRef.current;
    if (!flow || !workspace || defaultZoom === null || minimumZoom === undefined) return;

    const { x, y, zoom } = flow.getViewport();
    const nextZoom = Math.min(defaultZoom, Math.max(minimumZoom, zoom * factor));
    if (nextZoom === zoom) return;

    const { width, height } = workspace.getBoundingClientRect();
    const centerX = (width - previousPanelWidth.current) / 2;
    const centerY = height / 2;
    const ratio = nextZoom / zoom;

    void flow.setViewport({
      x: centerX + (x - centerX) * ratio,
      y: centerY + (y - centerY) * ratio,
      zoom: nextZoom,
    }, { duration: 0 });
  }

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

    if (previousPanelWidth.current !== 0) {
      previousPanelWidth.current = 0;
      if (defaultViewport.current) {
        void instance.setViewport(defaultViewport.current, { duration: 0 });
      }
    }

    const nodeId = focusOnClose.current;
    focusOnClose.current = null;
    if (!nodeId) return;

    const node = canvasRef.current?.querySelector<HTMLElement>(
      `.react-flow__node-device[data-id="${CSS.escape(nodeId)}"]`,
    );
    node?.focus({ preventScroll: true });
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

      <main ref={workspaceRef} className="workspace">
        <div ref={canvasRef} className="topology-canvas" data-fit-ready={defaultZoom !== null}>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            panActivationKeyCode={null}
            zoomActivationKeyCode={null}
            autoPanOnNodeFocus={false}
            preventScrolling={false}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            minZoom={minimumZoom}
            maxZoom={defaultZoom ?? undefined}
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
            <CanvasControls
              defaultZoom={defaultZoom}
              minimumZoom={minimumZoom}
              onZoomIn={() => zoomBy(zoomStep)}
              onZoomOut={() => zoomBy(1 / zoomStep)}
              onFit={fitDiagram}
            />
          </ReactFlow>

          <div className="canvas-hint">
            <Info size={15} />
            Click a component for details
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
