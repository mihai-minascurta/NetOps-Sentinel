import { edges, nodes, type DeviceKind, type RouterId } from '../topology.ts';
import { simulationCollectorOrder, type FaultId, type getSimulationMeasurements } from '../topologySimulation.ts';

type RouterHealth = { label: 'Up' | 'Down'; tone: 'ok' | 'critical' };
type Utilization = { value: number | null; tone?: 'warning' };

export type DashboardRouter = {
  id: RouterId;
  title: string;
  health: RouterHealth;
  cpu: Utilization;
  ram: Utilization;
  fault?: { badge: string; severity: 'warning' | 'critical' };
};

export type DashboardPipelineData = {
  nodes: readonly { id: string; title: string; subtitle?: string; kind: DeviceKind }[];
  edges: readonly { id: string; source: string; target: string; kind: 'flow' | 'data' }[];
};

export type DashboardActivityEntry = {
  id: number;
  kind: 'anomaly' | 'alert' | 'incident' | 'investigation' | 'ai';
  time: string;
  dateTime?: string;
  message: string;
  incidentNumber?: number;
};

export type DashboardIncident = {
  id: number;
  title: string;
  severity: 'warning' | 'critical';
  router: RouterId;
  age: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  sparkline: readonly number[];
  investigation?: { status: 'running' | 'completed'; evidenceCount: number; skippedCount: number };
};

export type DashboardDiagnosisData = {
  summary: string;
  probable_cause: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_ids: readonly number[];
  recommendations: readonly string[];
};

export type DashboardEvidence = {
  id: FaultId;
  label: string;
  status: 'collected' | 'fault' | 'pending' | 'skipped';
};

export type DashboardSample = {
  routers: readonly DashboardRouter[];
  pipeline: DashboardPipelineData;
  activity: readonly DashboardActivityEntry[];
  incidents: readonly DashboardIncident[];
  diagnosis: DashboardDiagnosisData;
  diagnosisIncidentNumber: number;
  evidence: readonly DashboardEvidence[];
};

const collectorLabels: Record<FaultId, string> = {
  prometheus_up: 'Node availability',
  cpu_usage: 'CPU usage',
  memory_usage: 'Memory usage',
  disk_usage: 'Disk usage',
  network_interfaces: 'Network interfaces',
  network_errors: 'Network errors',
};

export const dashboardCollectors = simulationCollectorOrder.map((id) => ({ id, label: collectorLabels[id] }));

type Measurements = ReturnType<typeof getSimulationMeasurements>;
type FaultDetails = {
  title: string;
  metric: keyof Measurements | null;
  insight: (router: string, measurements: Measurements) => string;
  diagnosis: Omit<DashboardDiagnosisData, 'summary' | 'evidence_ids'>;
};

export const dashboardFaultDetails: Record<FaultId, FaultDetails> = {
  cpu_usage: {
    title: 'CPU overload',
    metric: 'cpu',
    insight: (router, { cpu }) => `${router} CPU usage reached ${cpu}%.`,
    diagnosis: {
      probable_cause: 'CPU demand stayed above the configured alert threshold.',
      confidence: 'medium',
      recommendations: ['Review which processes are using the most CPU.', 'Compare CPU demand with the normal baseline.'],
    },
  },
  memory_usage: {
    title: 'RAM overload',
    metric: 'memory',
    insight: (router, { memory }) => `${router} RAM usage reached ${memory}%.`,
    diagnosis: {
      probable_cause: 'Low available memory triggered the HighRAMUsage alert.',
      confidence: 'medium',
      recommendations: ['Review which processes are using the most memory.', 'Check how available memory changes over time.'],
    },
  },
  disk_usage: {
    title: 'Disk pressure',
    metric: 'disk',
    insight: (router, { disk }) => `${router} root disk usage reached ${disk}%.`,
    diagnosis: {
      probable_cause: 'The root filesystem had less free space than the alert allows.',
      confidence: 'medium',
      recommendations: ['Inspect disk usage by directory on the root filesystem.', 'Review recent growth in logs and stored data.'],
    },
  },
  network_interfaces: {
    title: 'Interface down',
    metric: null,
    insight: (router) => `${router} reports interface eth1 down.`,
    diagnosis: {
      probable_cause: 'The eth1 link or its configured state may explain the interface being down.',
      confidence: 'low',
      recommendations: ['Verify whether eth1 is expected to be active.', 'Check the peer link and recent interface events.'],
    },
  },
  network_errors: {
    title: 'Network errors',
    metric: 'networkErrors',
    insight: (router, { networkErrors }) => `${router} reports ${networkErrors} network errors per second.`,
    diagnosis: {
      probable_cause: 'An interface or its peer may be contributing to the RX/TX errors.',
      confidence: 'low',
      recommendations: ['Compare RX and TX error counters by interface.', 'Check the peer counters over the same time window.'],
    },
  },
  prometheus_up: {
    title: 'Node down',
    metric: null,
    insight: (router) => `Prometheus could not scrape Node Exporter on ${router}.`,
    diagnosis: {
      probable_cause: 'The exporter or the network path from Prometheus may be unavailable.',
      confidence: 'low',
      recommendations: ['Check the Node Exporter service status.', 'Verify reachability from the Prometheus host.'],
    },
  },
};

export const incidentMetricTrend = [0.48, 0.51, 0.49, 0.56, 0.55, 0.65, 0.61, 0.79, 0.83, 1] as const;
export const incidentAvailabilityTrend = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0] as const;

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
      title: node.id === 'db' ? 'SQLite DB' : node.data.title,
      subtitle: node.id === 'db' ? 'alerts · incidents · incident_alerts · investigations · evidences' : undefined,
      kind: node.data.kind,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.data.kind === 'data' ? 'data' : 'flow',
    })),
  },
  activity: [
    { id: 1, kind: 'anomaly', time: '10:42:18', message: 'R2 memory usage is above 85%.' },
    { id: 2, kind: 'alert', time: '10:42:22', message: 'Prometheus fires HighRAMUsage.' },
    { id: 3, kind: 'alert', time: '10:42:54', message: 'Alertmanager sends the alert to the webhook and email.' },
    { id: 4, kind: 'incident', time: '10:42:56', incidentNumber: 1042, message: 'A new incident is opened.' },
    { id: 5, kind: 'investigation', time: '10:43:08', message: 'The investigation collects six results from R2.' },
    { id: 6, kind: 'ai', time: '10:43:14', message: 'AI reads the evidence and writes a diagnosis.' },
  ],
  incidents: [
    {
      id: 1042, title: 'RAM overload', severity: 'warning', router: 'r2', age: '8m ago', status: 'investigating',
      sparkline: [59, 63, 61, 67, 70, 69, 82, 80, 91, 90, 91],
    },
    {
      id: 1041, title: 'Node down', severity: 'critical', router: 'r2', age: '42m ago', status: 'resolved',
      sparkline: [1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
    },
  ],
  diagnosisIncidentNumber: 1042,
  diagnosis: {
    summary: 'Memory pressure on R2.',
    probable_cause: 'Available memory was low during the investigation.',
    confidence: 'medium',
    evidence_ids: [411, 413],
    recommendations: ['Review the processes using the most memory.', 'Watch available memory before changing limits.'],
  },
  evidence: dashboardCollectors.map((check) => ({ ...check, status: check.id === 'memory_usage' ? 'fault' : 'collected' })),
};
