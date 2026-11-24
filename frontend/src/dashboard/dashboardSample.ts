import { edges, nodes, type DeviceKind, type RouterId } from '../topology';

type Tone = 'ok' | 'warning' | 'critical';
type Health = { label: string; tone: Tone };
type Utilization = { value: number; tone: Tone };
type NodePlacement = { x: number; y: number; width: number; height: number };
type EdgePlacement = { path: string; labelAt: { x: number; y: number }; active?: boolean };

export type DashboardPipelineData = {
  width: number;
  height: number;
  nodes: readonly (NodePlacement & { id: string; title: string; kind: DeviceKind; health: Health })[];
  edges: readonly (EdgePlacement & {
    id: string;
    source: string;
    target: string;
    kind: 'flow' | 'data';
    readOnly?: boolean;
    labels: readonly string[];
  })[];
};

export type DashboardSample = {
  routers: readonly {
    id: RouterId;
    title: string;
    subtitle: string;
    health: Health;
    cpu: Utilization;
    ram: Utilization;
    history: readonly number[];
  }[];
  services: readonly { id: string; title: string; health: Health }[];
  pipeline: DashboardPipelineData;
  activity: readonly { id: number; message: string }[];
  incidents: readonly {
    id: string;
    title: string;
    severity: 'warning' | 'critical';
    router: RouterId;
    age: string;
    status: 'open' | 'investigating' | 'resolved' | 'closed';
  }[];
  diagnosis: {
    summary: string;
    probable_cause: string;
    confidence: 'low' | 'medium' | 'high';
    evidence_ids: readonly number[];
    recommendations: readonly string[];
  };
  evidence: readonly {
    id: number;
    collector: 'collect_node_status' | 'collect_cpu_usage' | 'collect_memory_usage' | 'collect_disk_usage'
      | 'collect_network_interfaces' | 'collect_network_errors';
    title: string;
    health: Health;
  }[];
};

const ok: Health = { label: 'OK', tone: 'ok' };
const up: Health = { label: 'UP', tone: 'ok' };
const down: Health = { label: 'DOWN', tone: 'critical' };
const warning: Health = { label: 'WARNING', tone: 'warning' };

const nodeHealth: Readonly<Record<string, Health>> = {
  r1: up,
  r2: down,
  alerts: warning,
  incident: warning,
  investigation: warning,
};

const nodePlacements: Readonly<Record<string, NodePlacement>> = {
  r1: { x: 12, y: 30, width: 78, height: 44 },
  r2: { x: 12, y: 122, width: 78, height: 44 },
  prometheus: { x: 150, y: 76, width: 112, height: 44 },
  alertmanager: { x: 315, y: 76, width: 120, height: 44 },
  backend: { x: 491, y: 76, width: 108, height: 44 },
  alerts: { x: 634, y: 76, width: 64, height: 44 },
  incident: { x: 757, y: 76, width: 79, height: 44 },
  email: { x: 313, y: 157, width: 124, height: 44 },
  db: { x: 139, y: 225, width: 593, height: 55 },
  mcp: { x: 104, y: 340, width: 114, height: 44 },
  ai: { x: 289, y: 340, width: 116, height: 44 },
  evidence: { x: 478, y: 340, width: 117, height: 44 },
  investigation: { x: 661, y: 340, width: 145, height: 44 },
};

const edgePlacements: Readonly<Record<string, EdgePlacement>> = {
  'r1-prom': { path: 'M90 52 H108 Q116 52 116 60 V76 Q116 84 124 84 H150', labelAt: { x: 120, y: 42 } },
  'r2-prom': { path: 'M90 144 H108 Q116 144 116 136 V120 Q116 112 124 112 H150', labelAt: { x: 120, y: 156 }, active: true },
  'prom-alert': { path: 'M262 98 H315', labelAt: { x: 288, y: 82 }, active: true },
  'alert-backend': { path: 'M435 98 H491', labelAt: { x: 463, y: 82 }, active: true },
  'backend-alerts': { path: 'M599 98 H634', labelAt: { x: 616.5, y: 82 }, active: true },
  'alerts-incident': { path: 'M698 98 H757', labelAt: { x: 728, y: 56 }, active: true },
  'alert-email': { path: 'M375 120 V157', labelAt: { x: 408, y: 138 } },
  'incident-inv': { path: 'M820 120 V353 Q820 362 811 362 H806', labelAt: { x: 779, y: 266 } },
  'inv-evidence': { path: 'M661 362 H595', labelAt: { x: 628, y: 346 } },
  'evidence-ai': { path: 'M478 362 H405', labelAt: { x: 441.5, y: 346 } },
  'ai-mcp': { path: 'M289 362 H218', labelAt: { x: 253.5, y: 346 } },
  'backend-db': { path: 'M542 120 V225', labelAt: { x: 542, y: 168 } },
  'alerts-db': { path: 'M651 120 V225', labelAt: { x: 651, y: 168 } },
  'incident-db': { path: 'M776 120 V143 Q776 150 769 150 H719 Q712 150 712 157 V225', labelAt: { x: 712, y: 196 } },
  'investigation-db': { path: 'M709 340 V280', labelAt: { x: 709, y: 309 } },
  'evidence-db': { path: 'M534 340 V280', labelAt: { x: 534, y: 309 } },
  'ai-db': { path: 'M344 340 V280', labelAt: { x: 344, y: 309 } },
  'mcp-db': { path: 'M168 340 V280', labelAt: { x: 168, y: 309 } },
};

export const dashboardSample: DashboardSample = {
  routers: [
    {
      id: 'r1', title: 'R1', subtitle: 'Public VM · Node Exporter', health: up,
      cpu: { value: 28, tone: 'ok' }, ram: { value: 46, tone: 'ok' },
      history: [35, 38, 34, 42, 38, 43, 41, 47, 42, 48, 44, 46],
    },
    {
      id: 'r2', title: 'R2', subtitle: 'Private VM · Node Exporter', health: down,
      cpu: { value: 57, tone: 'ok' }, ram: { value: 91, tone: 'warning' },
      history: [34, 38, 35, 46, 42, 58, 55, 74, 63, 82, 89, 91],
    },
  ],
  services: [
    { id: 'prometheus', title: 'Prometheus', health: ok },
    { id: 'alertmanager', title: 'Alertmanager', health: ok },
    { id: 'backend', title: 'Webhook API', health: ok },
    { id: 'db', title: 'SQLite', health: ok },
    { id: 'email', title: 'Email Notification', health: ok },
  ],
  pipeline: {
    width: 848,
    height: 406,
    nodes: nodes.filter((node) => node.type === 'device').map((node) => ({
      ...nodePlacements[node.id],
      id: node.id,
      title: node.data.title,
      kind: node.data.kind,
      health: nodeHealth[node.id] ?? ok,
    })),
    edges: edges.map((edge) => ({
      ...edgePlacements[edge.id],
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.data.kind === 'data' ? 'data' : 'flow',
      readOnly: edge.data.readOnly,
      labels: edge.data.labelLines ?? (typeof edge.label === 'string' ? [edge.label] : []),
    })),
  },
  activity: [
    { id: 1, message: 'R2 memory usage is above 85%.' },
    { id: 2, message: 'Prometheus fires HighRAMUsage.' },
    { id: 3, message: 'Alertmanager sends the alert to the webhook and email.' },
    { id: 4, message: 'A new incident is opened.' },
    { id: 5, message: 'The investigation collects six results from R2.' },
    { id: 6, message: 'AI reads the evidence and writes a diagnosis.' },
    { id: 7, message: 'The R2 exporter stops responding.' },
    { id: 8, message: 'A critical incident opens for R2.' },
  ],
  incidents: [
    { id: 'INC-1042', title: 'Node exporter unavailable', severity: 'critical', router: 'r2', age: '2 min ago', status: 'open' },
    { id: 'INC-1041', title: 'High memory usage', severity: 'warning', router: 'r2', age: '8 min ago', status: 'investigating' },
  ],
  diagnosis: {
    summary: 'Memory pressure on R2.',
    probable_cause: 'Available memory was low during the investigation.',
    confidence: 'medium',
    evidence_ids: [411, 413],
    recommendations: ['Review the processes using the most memory.', 'Watch available memory before changing limits.'],
  },
  evidence: [
    { id: 411, collector: 'collect_node_status', title: 'Node availability', health: ok },
    { id: 412, collector: 'collect_cpu_usage', title: 'CPU usage', health: ok },
    { id: 413, collector: 'collect_memory_usage', title: 'Memory usage', health: { label: 'FAIL', tone: 'critical' } },
    { id: 414, collector: 'collect_disk_usage', title: 'Disk usage', health: ok },
    { id: 415, collector: 'collect_network_interfaces', title: 'Network interfaces', health: ok },
    { id: 416, collector: 'collect_network_errors', title: 'Network errors', health: ok },
  ],
};
