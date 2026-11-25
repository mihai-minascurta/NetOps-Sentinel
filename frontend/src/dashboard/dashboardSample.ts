import { edges, isRouterId, nodes, type DeviceKind, type RouterId } from '../topology';

type RouterHealth = { label: 'Up' | 'Down'; tone: 'ok' | 'critical' };
type Utilization = { value: number; tone?: 'warning' };

export type DashboardPipelineData = {
  nodes: readonly { id: string; title: string; subtitle?: string; kind: DeviceKind; health?: RouterHealth }[];
  edges: readonly { id: string; source: string; target: string; kind: 'flow' | 'data' }[];
};

export type DashboardSample = {
  routers: readonly {
    id: RouterId;
    title: string;
    health: RouterHealth;
    cpu: Utilization;
    ram: Utilization;
  }[];
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
};

const routerHealth: Record<RouterId, RouterHealth> = {
  r1: { label: 'Up', tone: 'ok' },
  r2: { label: 'Up', tone: 'ok' },
};

export const dashboardSample: DashboardSample = {
  routers: [
    {
      id: 'r1', title: 'R1', health: routerHealth.r1,
      cpu: { value: 28 }, ram: { value: 46 },
    },
    {
      id: 'r2', title: 'R2', health: routerHealth.r2,
      cpu: { value: 57 }, ram: { value: 91, tone: 'warning' },
    },
  ],
  pipeline: {
    nodes: nodes.filter((node) => node.type === 'device').map((node) => ({
      id: node.id,
      title: node.data.title,
      subtitle: node.id === 'db' ? 'alerts · incidents · incident_alerts · investigations · evidences' : undefined,
      kind: node.data.kind,
      health: isRouterId(node.id) ? routerHealth[node.id] : undefined,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.data.kind === 'data' ? 'data' : 'flow',
    })),
  },
  activity: [
    { id: 1, message: 'R2 memory usage is above 85%.' },
    { id: 2, message: 'Prometheus fires HighRAMUsage.' },
    { id: 3, message: 'Alertmanager sends the alert to the webhook and email.' },
    { id: 4, message: 'A new incident is opened.' },
    { id: 5, message: 'The investigation collects six results from R2.' },
    { id: 6, message: 'AI reads the evidence and writes a diagnosis.' },
  ],
  incidents: [
    { id: 'INC-1042', title: 'High memory usage', severity: 'warning', router: 'r2', age: '8 min ago', status: 'investigating' },
    { id: 'INC-1041', title: 'Node exporter unavailable', severity: 'critical', router: 'r2', age: '42 min ago', status: 'resolved' },
  ],
  diagnosis: {
    summary: 'Memory pressure on R2.',
    probable_cause: 'Available memory was low during the investigation.',
    confidence: 'medium',
    evidence_ids: [411, 413],
    recommendations: ['Review the processes using the most memory.', 'Watch available memory before changing limits.'],
  },
};
