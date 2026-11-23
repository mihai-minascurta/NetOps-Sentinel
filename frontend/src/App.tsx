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

import { Info } from 'lucide-react';
import CanvasControls from './components/CanvasControls';
import ComponentDetails from './components/ComponentDetails';
import DeviceNode from './components/DeviceNode';
import TopologyDemoControls from './components/TopologyDemoControls';
import TopologyEdge from './components/TopologyEdge';
import {
  edges,
  getRouteMarker,
  getSelectedEdgeIds,
  isRouterId,
  nodes,
  type DiagramNode,
  type StageNode,
  type TopologyEdgeType,
  type TopologyStatus,
} from './topology';
import { useTopologyPulses } from './useTopologyPulses';
import { useTopologyStatus } from './useTopologyStatus';

import '@xyflow/react/style.css';
import './App.css';

function Stage({ data }: NodeProps<StageNode>) {
  return <div className="stage-heading">{data.label}</div>;
}

const nodeTypes = {
  device: DeviceNode,
  stage: Stage,
};

const edgeTypes = { topology: TopologyEdge };
const diagramNodeIds = nodes.map((node) => node.id);
const fitPadding = { top: 32, right: 32, bottom: 56, left: 32 };
const minimumZoomRatio = 0.6;
const zoomStep = 1.15;
const panelTransitionMs = 240;
const entranceDurationMs = 550;
const devTopology = import.meta.env.DEV;
const demoMode = devTopology && new URLSearchParams(window.location.search).get('demo') === '1';

type FitDimensions = { width: number; height: number; panelWidth: number };

export default function App() {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [demoStatus, setDemoStatus] = useState<TopologyStatus | null>(() => demoMode ? {
    generated_at: new Date().toISOString(),
    nodes: { r1: 'up', r2: 'up' },
    alerts_available: true,
    active_alerts: [],
  } : null);
  const live = useTopologyStatus(devTopology && !demoMode);
  const snapshot = demoStatus ?? live.snapshot;
  const [flow, setFlow] = useState<ReactFlowInstance<DiagramNode, TopologyEdgeType> | null>(null);
  const [fittedZoom, setFittedZoom] = useState<number | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const defaultViewport = useRef<Viewport | null>(null);
  const lastFit = useRef<FitDimensions | null>(null);
  const fitRequest = useRef(0);
  const workspaceRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const focusOnClose = useRef<string | null>(null);
  const r1Status = snapshot?.nodes.r1 ?? 'unknown';
  const r2Status = snapshot?.nodes.r2 ?? 'unknown';
  const displayedNodes = useMemo(() => {
    if (!devTopology) return flowNodes;

    const statuses = { r1: r1Status, r2: r2Status };
    return flowNodes.map((node) => node.type === 'device' && isRouterId(node.id)
      ? { ...node, data: { ...node.data, liveStatus: statuses[node.id] } }
      : node);
  }, [flowNodes, r1Status, r2Status]);
  const selected = displayedNodes.find((node) => node.selected);
  const selectedDevice = selected?.type === 'device' ? selected : null;
  const selectedId = selectedDevice?.id;
  const panelOpen = selectedDevice !== null;
  const minimumZoom = fittedZoom === null ? undefined : fittedZoom * minimumZoomRatio;
  const nodesMeasured = flowNodes.every((node) => node.measured?.width && node.measured.height);
  const fitReady = fittedZoom !== null;
  const entering = fitReady && !entranceDone;
  const finishEntrance = entering ? () => setEntranceDone(true) : undefined;
  const edgeActivities = useTopologyPulses(snapshot, fitReady);

  let previewLabel = 'Topology preview · Not live';
  if (demoStatus) previewLabel = 'Demo';
  else if (live.unreachable) previewLabel = 'Not live · Backend unreachable';
  else if (snapshot) previewLabel = snapshot.alerts_available ? 'Live' : 'Alerts unavailable';

  const displayedEdges = useMemo(() => {
    if (!selectedId && edgeActivities.size === 0) return edges;

    const edgeIds = selectedId ? getSelectedEdgeIds(selectedId) : undefined;
    return edges.map<TopologyEdgeType>((edge) => {
      const routeState = edgeIds ? (edgeIds.has(edge.id) ? 'active' : 'dimmed') : undefined;
      const bidirectional = edge.data.kind === 'data';
      const activity = routeState === 'dimmed' || bidirectional ? undefined : edgeActivities.get(edge.id);
      if (!routeState && !activity) return edge;

      const marker = routeState ? getRouteMarker(edge.data.kind, routeState) : edge.markerEnd;
      return {
        ...edge,
        markerStart: bidirectional ? marker : undefined,
        markerEnd: marker,
        data: { ...edge.data, routeState, activity },
      };
    });
  }, [edgeActivities, selectedId]);

  const fitDiagram = useCallback((force = false) => {
    const workspace = workspaceRef.current;
    if (!flow || !workspace || !nodesMeasured) return;

    const { width, height } = workspace.getBoundingClientRect();
    const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 0;
    const availableWidth = width - panelWidth;
    if (
      availableWidth <= 0 ||
      width <= fitPadding.left + fitPadding.right ||
      height <= fitPadding.top + fitPadding.bottom
    ) return;

    const previous = lastFit.current;
    const sameWorkspaceSize = previous?.width === width && previous.height === height;
    if (!force && sameWorkspaceSize && previous.panelWidth === panelWidth) return;

    const bounds = flow.getNodesBounds(diagramNodeIds);
    const closedViewport = sameWorkspaceSize && defaultViewport.current
      ? defaultViewport.current
      : getViewportForBounds(bounds, width, height, 0, Infinity, fitPadding);
    const lateralPadding = Math.min(fitPadding.left, availableWidth / 8);
    const fitted = panelWidth > 0
      ? getViewportForBounds(bounds, availableWidth, height, 0, Infinity, {
          ...fitPadding,
          left: lateralPadding,
          right: lateralPadding,
        })
      : closedViewport;

    const panelChanged = previous !== null && (previous.panelWidth > 0) !== (panelWidth > 0);
    const duration = panelChanged && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? panelTransitionMs
      : 0;
    const request = ++fitRequest.current;

    defaultViewport.current = closedViewport;
    lastFit.current = { width, height, panelWidth };
    setFittedZoom(fitted.zoom);
    setIsFitting(duration > 0);

    const transition = flow.setViewport(fitted, { duration, interpolate: 'linear' });
    if (duration > 0) {
      void transition.then(() => {
        if (fitRequest.current === request) setIsFitting(false);
      });
    }
  }, [flow, nodesMeasured]);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!flow || !workspace || !nodesMeasured) return;

    const observer = new ResizeObserver(() => fitDiagram());
    observer.observe(workspace);
    const panel = panelOpen ? panelRef.current : null;
    if (panel) observer.observe(panel, { box: 'border-box' });
    return () => observer.disconnect();
  }, [fitDiagram, flow, nodesMeasured, panelOpen]);

  useEffect(() => {
    if (!entering) return;

    const timeout = window.setTimeout(() => setEntranceDone(true), entranceDurationMs);
    return () => window.clearTimeout(timeout);
  }, [entering]);

  function zoomBy(factor: number) {
    const workspace = workspaceRef.current;
    if (!flow || !workspace || isFitting || fittedZoom === null || minimumZoom === undefined) return;

    const { x, y, zoom } = flow.getViewport();
    const nextZoom = Math.min(fittedZoom, Math.max(minimumZoom, zoom * factor));
    if (nextZoom === zoom) return;

    const { width, height } = workspace.getBoundingClientRect();
    const centerX = (width - (lastFit.current?.panelWidth ?? 0)) / 2;
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
    if (panelOpen) return;

    const nodeId = focusOnClose.current;
    focusOnClose.current = null;
    if (!nodeId) return;

    const node = canvasRef.current?.querySelector<HTMLElement>(
      `.react-flow__node-device[data-id="${CSS.escape(nodeId)}"]`,
    );
    node?.focus({ preventScroll: true });
  }, [panelOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <h1 aria-label="NetOps Sentinel">
            <svg
              className="brand-wordmark"
              viewBox="0 0 193 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinejoin="round"
              strokeLinecap="square"
              aria-hidden="true"
              focusable="false"
            >
              <path transform="translate(2 0)" d="M0 20V4l9 16V4" />
              <path transform="translate(15 0)" d="M9 4H0v16h9M0 12h7.5" />
              <path transform="translate(28 0)" d="M0 4h10M5 4v16" />
              <path transform="translate(41 0)" d="M2.1 4.2h4.8L9 6.3v11.4l-2.1 2.1H2.1L0 17.7V6.3Z" />
              <path transform="translate(54 0)" d="M0 20V4h6.2L9 6.4v4L6.2 13H0" />
              <path transform="translate(67 0)" d="M9 4.3H2.2L0 6.5v3.1l2.2 2.3h4.6L9 14.1v3.6L6.8 20H0" />
              <path transform="translate(91 0)" d="M9 4.3H2.2L0 6.5v3.1l2.2 2.3h4.6L9 14.1v3.6L6.8 20H0" />
              <path transform="translate(104 0)" d="M9 4H0v16h9M0 12h7.5" />
              <path transform="translate(117 0)" d="M0 20V4l9 16V4" />
              <path transform="translate(130 0)" d="M0 4h10M5 4v16" />
              <path transform="translate(143 0)" d="M1 4h8M5 4v16M1 20h8" />
              <path transform="translate(156 0)" d="M0 20V4l9 16V4" />
              <path transform="translate(169 0)" d="M9 4H0v16h9M0 12h7.5" />
              <path transform="translate(182 0)" d="M0 4v16h9" />
            </svg>
          </h1>
          <p>Interactive System Architecture</p>
        </div>

        <span className="preview-label">
          <span role="status">{previewLabel}</span>
          {snapshot && !demoStatus && (
            <> · <time dateTime={snapshot.generated_at}>{new Date(snapshot.generated_at).toLocaleTimeString()}</time></>
          )}
        </span>
      </header>

      <main ref={workspaceRef} className="workspace">
        <div
          ref={canvasRef}
          className="topology-canvas"
          data-fit-ready={fitReady}
          data-entering={entering}
          onPointerDownCapture={finishEntrance}
          onFocusCapture={finishEntrance}
        >
          <ReactFlow
            forceColorMode="light"
            nodes={displayedNodes}
            edges={displayedEdges}
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
            maxZoom={fittedZoom ?? undefined}
            onNodesChange={onNodesChange}
            onInit={setFlow}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="var(--canvas-dot)"
              gap={24}
              size={0.8}
            />
            <CanvasControls
              defaultZoom={isFitting ? null : fittedZoom}
              minimumZoom={isFitting ? undefined : minimumZoom}
              onZoomIn={() => zoomBy(zoomStep)}
              onZoomOut={() => zoomBy(1 / zoomStep)}
              onFit={() => fitDiagram(true)}
            />
          </ReactFlow>

          {devTopology && demoStatus && (
            <TopologyDemoControls
              snapshot={demoStatus}
              onChange={(update) => setDemoStatus((current) => current && update(current))}
            />
          )}

          <div className="canvas-hint">
            <Info size={15} />
            Select a component to see its connections.
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
