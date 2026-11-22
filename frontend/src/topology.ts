import {
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';

export type DeviceKind =
  | 'router'
  | 'monitoring'
  | 'alert'
  | 'notification'
  | 'backend'
  | 'investigation'
  | 'evidence'
  | 'ai'
  | 'database'
  | 'mcp';

export type DeviceData = {
  title: string;
  subtitle: string;
  description: string;
  kind: DeviceKind;
};

export type DeviceNodeType = Node<DeviceData, 'device'>;

export type StageNode = Node<{ label: string }, 'stage'>;

export type DiagramNode = DeviceNodeType | StageNode;
export type TopologyEdgeType = Edge<{ readOnly?: boolean; routeState?: 'active' | 'dimmed' }, 'topology'>;

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
  stage('stage-sources', 0, 0, 288, 'Sources'),
  stage('stage-monitoring', 368, 208, 128, 'Monitoring'),
  stage('stage-incident', 736, 416, 128, 'Incident'),
  stage('stage-analysis', 1104, 208, 152, 'AI Analysis'),
  stage('stage-storage', 1280, 0, 288, 'Storage'),
  stage('incident-continuation', 736, 616, 128, 'Investigation'),

  device('r1', 'R1', 'Public VM · Node Exporter', 'router',
    'VM in the OCI public subnet. Exposes metrics for Prometheus.', 0, 24),

  device('r2', 'R2', 'Private VM · Node Exporter', 'router',
    'Private OCI VM. Runs Node Exporter and hosts the Docker stack.', 0, 232),

  device('prometheus', 'Prometheus', 'Metrics collection', 'monitoring',
    'Periodically collects metrics from Node Exporter on R1 and R2.', 368, 232),

  device('alertmanager', 'Alertmanager', 'Alert routing', 'alert',
    'Receives alerts from Prometheus, sends webhooks to Incident Manager, and sends email notifications.', 368, 440),

  device('backend', 'Incident Manager', 'FastAPI · Docker', 'backend',
    'Receives webhooks, manages incidents, and coordinates investigations.', 736, 440),

  device('email', 'Email Notification', 'Gmail SMTP · TLS', 'notification',
    'Sends alert and resolved notifications by email through Gmail SMTP.', 368, 648),

  device('investigation', 'Investigation', 'Python engine', 'investigation',
    'Runs checks and collects the information needed for diagnosis.', 736, 648),

  device('evidence', 'Evidences', 'Collected results', 'evidence',
    'Check results are structured and stored for the investigation.', 1104, 648),

  device('ai', 'AI Diagnosis', 'NVIDIA inference API', 'ai',
    'Analyzes evidence and produces an explanation, a confidence level, and recommendations.', 1104, 440),

  device('mcp', 'MCP Tools', 'Read-only investigation tools', 'mcp',
    'Exposes tools for reading incidents, investigations, and evidence.', 1104, 232),

  device('db', 'SQLite Database', 'Persistent Docker volume · R2', 'database',
    'The database file is data/incidents.db within Incident Manager. Saved AI diagnoses are stored as JSON on the corresponding completed investigation records.', 1280, 24),
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
    role: 'Routes alerts to Incident Manager and sends email notifications.',
    technology: 'Alertmanager',
  },
  email: {
    role: 'Email receiver for Alertmanager.',
    technology: 'Gmail SMTP · smtp.gmail.com:587 · TLS',
  },
  backend: {
    role: 'Receives alerts and coordinates investigations.',
    technology: 'FastAPI · Docker',
  },
  investigation: {
    role: 'Runs checks and collects evidence for diagnosis.',
    technology: 'Python · Prometheus queries',
  },
  evidence: {
    role: 'Records the results of investigation checks.',
    technology: 'SQLite · JSON',
  },
  ai: {
    role: 'Analyzes evidence and generates a diagnosis.',
    technology: 'Python · NVIDIA inference API',
  },
  mcp: {
    role: 'Exposes read-only tools for incident and investigation data.',
    technology: 'Python · MCPServer',
  },
  db: {
    role: 'Stores alerts, incidents, investigations, evidence, and diagnoses.',
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

export const dimmedEdgeMarker = {
  ...edgeMarker,
  color: 'var(--color-line-subtle)',
};

export const activeEdgeMarker = {
  ...edgeMarker,
  width: 24,
  height: 24,
  markerUnits: 'userSpaceOnUse',
  color: 'var(--color-accent)',
};

type LinkOptions = {
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  readOnly?: boolean;
};

function link(
  id: string,
  source: string,
  target: string,
  {
    sourceHandle = 'out-right',
    targetHandle = 'in-left',
    label,
    readOnly,
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
    data: { readOnly },
  };
}

export const edges: TopologyEdgeType[] = [
  link('r1-prom', 'r1', 'prometheus', { targetHandle: 'in-top', label: 'scrape' }),
  link('r2-prom', 'r2', 'prometheus', { label: 'scrape' }),

  link('prom-alert', 'prometheus', 'alertmanager', {
    sourceHandle: 'out-bottom', targetHandle: 'in-top', label: 'alerts',
  }),
  link('alert-backend', 'alertmanager', 'backend', { label: 'webhook' }),
  link('alert-email', 'alertmanager', 'email', {
    sourceHandle: 'out-bottom', targetHandle: 'in-top', label: 'email',
  }),

  link('backend-db', 'backend', 'db', { sourceHandle: 'out-top' }),

  link('backend-inv', 'backend', 'investigation', { sourceHandle: 'out-bottom', targetHandle: 'in-top' }),
  link('inv-evidence', 'investigation', 'evidence'),
  link('evidence-ai', 'evidence', 'ai', {
    sourceHandle: 'out-top', targetHandle: 'in-bottom', label: 'evidence',
  }),

  link('ai-db', 'ai', 'db', { targetHandle: 'in-bottom' }),

  link('ai-mcp', 'ai', 'mcp', {
    sourceHandle: 'out-top', targetHandle: 'in-bottom', readOnly: true, label: 'read-only',
  }),
];

const entranceOrder = [
  ['r1', 'r2'],
  ['prometheus'],
  ['alertmanager'],
  ['backend', 'email'],
  ['investigation'],
  ['evidence'],
  ['ai'],
  ['db', 'mcp'],
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

  return {
    inputs: edges.filter((edge) => edge.target === selectedId).map((edge) => describe(edge, edge.source)),
    outputs: edges.filter((edge) => edge.source === selectedId).map((edge) => describe(edge, edge.target)),
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
      for (const edge of edges) {
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
