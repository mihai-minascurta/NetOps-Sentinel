
import {
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';

export type DeviceKind =
  | 'router'
  | 'monitoring'
  | 'alert'
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

type GroupNode = Node<{ label: string }, 'group'>;

export type DiagramNode = DeviceNodeType | GroupNode;

function device(
  id: string,
  title: string,
  subtitle: string,
  kind: DeviceKind,
  description: string,
  x: number,
  y: number,
  parentId?: string,
): DeviceNodeType {
  return {
    id,
    type: 'device',
    position: { x, y },
    data: { title, subtitle, kind, description },
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  };
}

export const nodes: DiagramNode[] = [
  {
    id: 'r2-group',
    type: 'group',
    position: { x: 318, y: 85 },
    style: { width: 800, height: 340 },
    className: 'r2-group',
    data: { label: 'R2 · OCI PRIVATE VM / DOCKER HOST' },
  },

  device('r1', 'R1', 'Public VM · Node Exporter', 'router',
    'VM în subnetul public OCI. Expune metrici pentru Prometheus.', 50, 165),

  device('r2', 'R2', 'Private VM · Node Exporter', 'router',
    'VM privată OCI. Rulează Node Exporter și găzduiește stack-ul Docker.', 30, 240, 'r2-group'),

  device('prometheus', 'Prometheus', 'Metrics collection', 'monitoring',
    'Colectează periodic metrici de la Node Exporter pe R1 și R2.', 30, 80, 'r2-group'),

  device('alertmanager', 'Alertmanager', 'Alert routing', 'alert',
    'Primește alertele de la Prometheus și trimite webhook-uri către Incident Manager.', 292, 80, 'r2-group'),

  device('backend', 'Incident Manager', 'FastAPI · Docker', 'backend',
    'Primește webhook-uri, gestionează incidente și coordonează investigațiile.', 554, 80, 'r2-group'),

  device('investigation', 'Investigation', 'Python engine', 'investigation',
    'Execută verificările și colectează informațiile necesare diagnosticului.', 820, 525),

  device('evidence', 'Evidences', 'Collected results', 'evidence',
    'Rezultatele verificărilor sunt structurate și salvate pentru investigație.', 1060, 525),

  device('ai', 'AI Diagnosis', 'NVIDIA inference API', 'ai',
    'Analizează dovezile și generează o explicație, nivel de încredere și recomandări.', 1300, 525),

  device('mcp', 'MCP Tools', 'Read-only investigation tools', 'mcp',
    'Expune instrumente pentru citirea incidentelor, investigațiilor și dovezilor.', 1300, 725),

  device('db', 'SQLite Database', 'Persistent Docker volume · R2', 'database',
    'Stochează alertele, incidentele, investigațiile, dovezile și diagnosticele AI.', 1460, 165),
];

function link(
  id: string,
  source: string,
  target: string,
  sourceHandle = 'out-right',
  targetHandle = 'in-left',
  dashed = false,
): Edge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#7187a4',
    },
    style: {
      stroke: '#7187a4',
      strokeWidth: 1.8,
      ...(dashed ? { strokeDasharray: '6 6' } : {}),
    },
  };
}

export const edges: Edge[] = [
  link('r1-prom', 'r1', 'prometheus'),
  link('r2-prom', 'r2', 'prometheus', 'out-top', 'in-bottom'),

  link('prom-alert', 'prometheus', 'alertmanager'),
  link('alert-backend', 'alertmanager', 'backend'),

  link('backend-db', 'backend', 'db'),

  link('backend-inv', 'backend', 'investigation', 'out-bottom', 'in-top'),
  link('inv-evidence', 'investigation', 'evidence'),
  link('evidence-ai', 'evidence', 'ai'),

  link('ai-db', 'ai', 'db', 'out-top', 'in-bottom'),

  link('ai-mcp', 'ai', 'mcp', 'out-bottom', 'in-top', true),
];
