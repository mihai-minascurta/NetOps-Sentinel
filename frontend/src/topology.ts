import {
  MarkerType,
  Position,
  type Node,
  type Edge,
  type XYPosition,
} from '@xyflow/react';

export type DeviceKind =
  | 'router'
  | 'monitoring'
  | 'alert'
  | 'notification'
  | 'backend'
  | 'alerts'
  | 'incident'
  | 'investigation'
  | 'evidence'
  | 'ai'
  | 'database'
  | 'mcp';

export const routerIds = ['r1', 'r2'] as const;
export type RouterId = (typeof routerIds)[number];
export type NodeStatus = 'up' | 'down' | 'unknown';

export function isRouterId(value: unknown): value is RouterId {
  return value === 'r1' || value === 'r2';
}

export type TopologyAlert = {
  fingerprint: string;
  alertname: string;
  severity: string;
  node: RouterId | null;
  status: 'firing' | 'resolved';
  starts_at: string;
};

export type TopologyStatus = {
  generated_at: string;
  nodes: Record<RouterId, NodeStatus>;
  alerts_available: boolean;
  active_alerts: TopologyAlert[];
};

export type EdgeActivity = {
  pulses?: { id: string; startsAt: number; durationMs: number; reverse?: boolean }[];
  highlight?: boolean;
};

type EdgeKind = 'flow' | 'data' | 'query';
type RouteState = 'active' | 'dimmed';
type EdgeLabelSide = 'left' | 'right';

type DeviceData = {
  title: string;
  subtitle: string;
  description: string;
  kind: DeviceKind;
  liveStatus?: NodeStatus;
  simulatedFault?: { label: string; badge: string };
  simulationStatus?: 'up' | 'down' | 'visited';
  simulationCurrent?: boolean;
};

export type DeviceNodeType = Node<DeviceData, 'device'>;

export type StageNode = Node<{ label: string }, 'stage'>;

export type DiagramNode = DeviceNodeType | StageNode;
type TopologyEdgeData = {
  kind: EdgeKind;
  readOnly?: boolean;
  labelAnchor?: XYPosition;
  labelSide?: EdgeLabelSide;
  labelLines?: readonly string[];
  routeState?: RouteState;
  simulationState?: 'visited' | 'current';
  activity?: EdgeActivity;
};
export type TopologyEdgeType = Edge<TopologyEdgeData, 'topology'> & { data: TopologyEdgeData };

const deviceSize = { width: 168, height: 112 };
const databaseSize = { width: 1096, height: 152 };

function device(
  id: string,
  title: string,
  subtitle: string,
  kind: DeviceKind,
  description: string,
  x: number,
  y: number,
): DeviceNodeType {
  return {
    id,
    type: 'device',
    position: { x, y },
    style: kind === 'database' ? databaseSize : deviceSize,
    data: { title, subtitle, kind, description },
  };
}

function stage(id: string, x: number, y: number, width: number, label: string): StageNode {
  return {
    id,
    type: 'stage',
    position: { x, y },
    data: { label },
    style: { width, height: 16, pointerEvents: 'none' },
    selectable: false,
    focusable: false,
    deletable: false,
  };
}

export const nodes: DiagramNode[] = [
  stage('stage-alert-pipeline', 0, 0, 220, 'Alert Pipeline'),
  stage('stage-data-hub', 224, 352, 200, 'Data Hub'),
  stage('stage-investigation-ai', 16, 576, 208, 'Investigation & AI'),

  device('r1', 'R1', 'Public VM · Node Exporter', 'router',
    'VM in the OCI public subnet. Exposes metrics for Prometheus.', 0, 24),

  device('r2', 'R2', 'Private VM · Node Exporter', 'router',
    'Private OCI VM. Runs Node Exporter and hosts the Docker stack.', 0, 168),

  device('prometheus', 'Prometheus', 'Metrics collection', 'monitoring',
    'Periodically collects metrics from Node Exporter on R1 and R2.', 232, 96),

  device('alertmanager', 'Alertmanager', 'Alert routing', 'alert',
    'Sends grouped alerts to the Webhook API and delivers alert and recovery notifications through its email receiver.', 464, 96),

  device('backend', 'Webhook API', 'FastAPI · /webhook/alerts', 'backend',
    'Validates the alerts sent to /webhook/alerts and passes each valid alert to the alert store.', 696, 96),

  device('alerts', 'Alerts', 'Dedup · fingerprint + started_at', 'alerts',
    'Uses (fingerprint, started_at) to identify an occurrence. Records new alerts, updates existing ones, and skips duplicate deliveries and unmatched recoveries.', 928, 96),

  device('incident', 'Incident', 'Lifecycle · open → closed', 'incident',
    'A new firing alert opens an incident and starts a background investigation. The incident_alerts table links alerts and incidents. The lifecycle is open → investigating → resolved → closed.', 1224, 96),

  device('email', 'Email Notification', 'Gmail SMTP · TLS', 'notification',
    'Sends alert and resolved notifications by email through Gmail SMTP.', 464, 248),

  device('investigation', 'Investigation', 'Python engine', 'investigation',
    'Runs checks in the background and saves their results as evidence. A successful investigation proceeds to AI diagnosis.', 1224, 616),

  device('evidence', 'Evidences', 'Collected results', 'evidence',
    'Each result belongs to an investigation and provides input for AI diagnosis.', 872, 616),

  device('ai', 'AI Diagnosis', 'NVIDIA inference API', 'ai',
    'Analyzes stored evidence, can query read-only MCP tools, and saves the diagnosis as JSON on the completed investigation.', 520, 616),

  device('mcp', 'MCP Tools', 'Read-only investigation tools', 'mcp',
    'Exposes tools for reading incidents, investigations, and evidence.', 168, 616),

  device('db', 'SQLite Database', 'Persistent Docker volume · R2', 'database',
    'Stores alerts, incidents and their links, investigations, evidence, and AI diagnoses. The pipeline reads and updates these records in SQLite. MCP Tools query the database through a read-only connection.', 224, 376),
];

export const componentMetadata: Record<string, { role: string; technology: string }> = {
  r1: {
    role: 'Exports metrics from the public OCI VM.',
    technology: 'OCI VM · Node Exporter',
  },
  r2: {
    role: 'Exports metrics and hosts the Docker stack.',
    technology: 'OCI VM · Node Exporter',
  },
  prometheus: {
    role: 'Collects metrics and evaluates alert rules.',
    technology: 'Prometheus',
  },
  alertmanager: {
    role: 'Routes alerts by webhook and email.',
    technology: 'Alertmanager',
  },
  email: {
    role: 'Email receiver for Alertmanager.',
    technology: 'Gmail SMTP · smtp.gmail.com:587 · TLS',
  },
  backend: {
    role: 'Receives grouped alerts.',
    technology: 'FastAPI · Docker',
  },
  alerts: {
    role: 'Stores and deduplicates alert occurrences.',
    technology: 'Python · SQLite',
  },
  incident: {
    role: 'Tracks the incident lifecycle.',
    technology: 'Python · SQLite',
  },
  investigation: {
    role: 'Collects evidence for a new incident.',
    technology: 'Python · Prometheus queries',
  },
  evidence: {
    role: 'Records the results of investigation checks.',
    technology: 'SQLite · JSON',
  },
  ai: {
    role: 'Produces and saves an investigation diagnosis.',
    technology: 'Python · NVIDIA inference API',
  },
  mcp: {
    role: 'Exposes read-only tools for incident and investigation data.',
    technology: 'Python · MCPServer',
  },
  db: {
    role: 'Shared data store for the alert and investigation workflow.',
    technology: 'SQLite · Docker volume',
  },
};

export const componentPorts: Partial<Record<string, number>> = {
  r1: 9100,
  r2: 9100,
  prometheus: 9090,
  alertmanager: 9093,
  backend: 8000,
};

const edgeMarker = {
  type: MarkerType.ArrowClosed,
  width: 12,
  height: 12,
  color: 'var(--color-edge)',
};

const activeFlowMarker = {
  ...edgeMarker,
  width: 24,
  height: 24,
  markerUnits: 'userSpaceOnUse',
};

const dataEdgeMarker = {
  ...edgeMarker,
  type: MarkerType.Arrow,
  markerUnits: 'userSpaceOnUse',
};

export function getRouteMarker(kind: EdgeKind, state: RouteState) {
  const marker = kind === 'data' ? dataEdgeMarker : state === 'active' ? activeFlowMarker : edgeMarker;
  return { ...marker, color: state === 'active' ? 'var(--color-accent)' : 'var(--color-line-subtle)' };
}

export function getSimulationMarker(kind: EdgeKind) {
  const marker = kind === 'data' ? dataEdgeMarker : edgeMarker;
  return { ...marker, color: 'var(--color-status-unknown)' };
}

type LinkOptions = Pick<TopologyEdgeData, 'readOnly' | 'labelAnchor' | 'labelLines'> & {
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
};

function link(
  id: string,
  source: string,
  target: string,
  {
    sourceHandle = 'out-right',
    targetHandle = 'in-left',
    label,
    ...data
  }: LinkOptions = {},
): TopologyEdgeType {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'topology',
    label,
    markerEnd: edgeMarker,
    data: { kind: 'flow', ...data },
  };
}

type DiagramHandle = {
  id: string;
  type: 'source' | 'target';
  position: Position;
  offset: number;
};

const investigationRail: Record<'incident' | 'investigation', DiagramHandle> = {
  incident: { id: 'out-bottom-flow', type: 'source', position: Position.Bottom, offset: 144 },
  investigation: { id: 'in-top-flow', type: 'target', position: Position.Top, offset: 144 },
};

type DataConnection = {
  deviceId: string;
  deviceSide: Position.Top | Position.Bottom;
  hubOffset: number;
  deviceOffset?: number;
  labelSide?: EdgeLabelSide;
  label?: string;
};

const dataConnections: DataConnection[] = [
  { deviceId: 'backend', deviceSide: Position.Bottom, hubOffset: 556 },
  { deviceId: 'alerts', deviceSide: Position.Bottom, hubOffset: 788 },
  { deviceId: 'incident', deviceSide: Position.Bottom, hubOffset: 1064, deviceOffset: 64, labelSide: 'left' },
  { deviceId: 'investigation', deviceSide: Position.Top, hubOffset: 1064, deviceOffset: 64, labelSide: 'left' },
  { deviceId: 'evidence', deviceSide: Position.Top, hubOffset: 732 },
  { deviceId: 'ai', deviceSide: Position.Top, hubOffset: 380 },
  { deviceId: 'mcp', deviceSide: Position.Top, hubOffset: 28, label: 'read-only' },
];

const dataLinks = dataConnections.map((connection) => ({
  ...connection,
  sourceHandle: {
    id: `data-out-${connection.deviceSide}`,
    type: 'source',
    position: connection.deviceSide,
    offset: connection.deviceOffset ?? deviceSize.width / 2,
  } satisfies DiagramHandle,
  hubHandle: {
    id: `data-in-${connection.deviceId}`,
    type: 'target',
    position: connection.deviceSide === Position.Bottom ? Position.Top : Position.Bottom,
    offset: connection.hubOffset,
  } satisfies DiagramHandle,
}));

const queryTargetHandle: DiagramHandle = { id: 'in-bottom-query', type: 'target', position: Position.Bottom, offset: 136 };

export function getAdditionalDeviceHandles(id: string): DiagramHandle[] {
  if (id === 'db') return dataLinks.map(({ hubHandle }) => hubHandle);
  if (id === 'prometheus') return [queryTargetHandle];

  const connection = dataLinks.find(({ deviceId }) => deviceId === id);
  const handles: DiagramHandle[] = connection ? [connection.sourceHandle] : [];
  if (id === 'incident' || id === 'investigation') handles.push(investigationRail[id]);
  return handles;
}

const opensIncidentLabel = ['opens incident', '(new + firing)'] as const;

export const flowEdges: TopologyEdgeType[] = [
  link('r1-prom', 'r1', 'prometheus', {
    targetHandle: 'in-top', label: 'scrape', labelAnchor: { x: 244, y: 64 },
  }),
  link('r2-prom', 'r2', 'prometheus', {
    targetHandle: 'in-bottom', label: 'scrape', labelAnchor: { x: 244, y: 240 },
  }),
  link('prom-alert', 'prometheus', 'alertmanager', { label: 'alerts' }),
  link('alert-backend', 'alertmanager', 'backend', { label: 'webhook' }),
  link('backend-alerts', 'backend', 'alerts', { label: 'save' }),
  link('alerts-incident', 'alerts', 'incident', {
    label: opensIncidentLabel.join(' '), labelLines: opensIncidentLabel, labelAnchor: { x: 1160, y: 129 },
  }),
  link('alert-email', 'alertmanager', 'email', {
    sourceHandle: 'out-bottom', targetHandle: 'in-top', label: 'email', labelAnchor: { x: 585, y: 228 },
  }),
  link('incident-inv', 'incident', 'investigation', {
    sourceHandle: investigationRail.incident.id,
    targetHandle: investigationRail.investigation.id,
    label: 'investigate',
    labelAnchor: { x: 1342, y: 568 },
  }),
  link('inv-evidence', 'investigation', 'evidence', {
    sourceHandle: 'out-left', targetHandle: 'in-right', label: 'evidence',
  }),
  link('evidence-ai', 'evidence', 'ai', {
    sourceHandle: 'out-left', targetHandle: 'in-right', label: 'diagnose',
  }),
  link('ai-mcp', 'ai', 'mcp', {
    sourceHandle: 'out-left', targetHandle: 'in-right', readOnly: true, label: 'read-only',
  }),
];

export const dataEdges: TopologyEdgeType[] = dataLinks.map((connection) => ({
  id: `${connection.deviceId}-db`,
  source: connection.deviceId,
  target: 'db',
  sourceHandle: connection.sourceHandle.id,
  targetHandle: connection.hubHandle.id,
  type: 'topology',
  label: connection.label ?? 'read / write',
  markerStart: dataEdgeMarker,
  markerEnd: dataEdgeMarker,
  data: { kind: 'data', labelSide: connection.labelSide ?? 'right' },
}));

export const edges = [...flowEdges, ...dataEdges];

export const simulationQueryRoute = { bottomY: 744, leftX: 8, returnY: 320, fitBottomY: 748 };
export const simulationQueryEdge: TopologyEdgeType = {
  id: 'investigation-prom-queries',
  source: 'investigation',
  target: 'prometheus',
  sourceHandle: 'out-bottom',
  targetHandle: queryTargetHandle.id,
  type: 'topology',
  label: 'queries',
  markerEnd: edgeMarker,
  selectable: false,
  focusable: false,
  data: { kind: 'query', labelAnchor: { x: 300, y: 304 } },
};

const alertDeliverySteps = [
  ['prom-alert'],
  ['alert-backend', 'alert-email'],
  ['backend-alerts'],
  ['alerts-incident'],
] as const;
const pulseSegmentMs = 1250;
const pulseStepCount = 1 + alertDeliverySteps.length;
const basePulseTiming = {
  segmentMs: pulseSegmentMs,
  cycleMs: pulseStepCount * pulseSegmentMs,
  pauseMs: 3000,
};
export function getPulseTiming() {
  return basePulseTiming;
}

export function getPulseTimeline(router: RouterId, cycleStart: number) {
  const steps = [[`${router}-prom`], ...alertDeliverySteps];
  return steps.map((edgeIds, index) => ({
    edgeIds,
    startsAt: cycleStart + index * pulseSegmentMs,
    durationMs: pulseSegmentMs,
  }));
}

const entranceOrder = [
  ['r1', 'r2'],
  ['prometheus'],
  ['alertmanager'],
  ['backend', 'email'],
  ['alerts', 'db'],
  ['incident'],
  ['investigation'],
  ['evidence'],
  ['ai'],
  ['mcp'],
];

export const entranceDelayByDevice = new Map(
  entranceOrder.flatMap((devices, step) => devices.map((id) => [id, step * 45] as const)),
);

const deviceTitles = new Map(
  nodes.filter((node) => node.type === 'device').map((node) => [node.id, node.data.title]),
);

export function getComponentConnections(selectedId: string) {
  function describe(edge: TopologyEdgeType, deviceId: string) {
    return { id: edge.id, title: deviceTitles.get(deviceId) ?? deviceId, label: edge.label };
  }

  const shared = dataEdges
    .filter((edge) => edge.source === selectedId || edge.target === selectedId)
    .map((edge) => describe(edge, edge.source === selectedId ? edge.target : edge.source));

  return {
    inputs: [...flowEdges.filter((edge) => edge.target === selectedId).map((edge) => describe(edge, edge.source)), ...shared],
    outputs: [...flowEdges.filter((edge) => edge.source === selectedId).map((edge) => describe(edge, edge.target)), ...shared],
  };
}

export function getComponentRoute(selectedId: string) {
  const nodeIds = new Set([selectedId]);
  const edgeIds = new Set<string>();

  // Walk the two directions independently so unrelated branches stay dimmed.
  for (const [from, to] of [['source', 'target'], ['target', 'source']] as const) {
    const pending = [selectedId];
    const visited = new Set(pending);

    for (const id of pending) {
      for (const edge of flowEdges) {
        if (edge[from] !== id) continue;

        edgeIds.add(edge.id);
        const nextId = edge[to];
        if (visited.has(nextId)) continue;

        visited.add(nextId);
        nodeIds.add(nextId);
        pending.push(nextId);
      }
    }
  }

  return { nodeIds, edgeIds };
}

export function getSelectedEdgeIds(selectedId: string) {
  const { edgeIds } = getComponentRoute(selectedId);
  for (const edge of dataEdges) {
    if (edge.source === selectedId || edge.target === selectedId) edgeIds.add(edge.id);
  }
  return edgeIds;
}
