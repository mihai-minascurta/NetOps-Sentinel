import { edges, simulationQueryEdge, type RouterId } from './topology.ts';
import { simulationCollectorOrder, type FaultId } from './topologySimulation.ts';
import { buildSimulationLog, type SimulationLogEntry } from './topologySimulationLog.ts';

export const simulationTiming = { flow: 3500, data: 1200, grouping: 1500 } as const;

type DurationKind = keyof typeof simulationTiming;
type SimulationMove = { edgeId: string; from: string; to: string; reverse: boolean };

export type SimulationStepId =
  | 'scrape' | 'send-alert' | 'group' | 'deliver' | 'process' | 'deduplicate' | 'insert-alert'
  | 'open-incident' | 'commit-incident' | 'start-investigation' | 'read-incident' | 'create-investigation'
  | 'check-running' | 'complete-investigation' | 'start-diagnosis' | 'read-metadata' | 'request-mcp'
  | 'read-evidence' | 'return-evidence' | 'save-diagnosis'
  | `query:${FaultId}` | `record:${FaultId}` | `save:${FaultId}`;

export type SimulationStep = {
  id: SimulationStepId;
  label: string;
  moves: SimulationMove[];
  currentNodeIds: string[];
  startsAtMs: number;
  endsAtMs: number;
  durationMs: number;
};

export type SimulationTimeline = {
  steps: SimulationStep[];
  durationMs: number;
  log: SimulationLogEntry[];
};

const collectorLabels: Record<FaultId, string> = {
  prometheus_up: 'availability',
  cpu_usage: 'CPU usage',
  memory_usage: 'memory usage',
  disk_usage: 'disk usage',
  network_interfaces: 'network interfaces',
  network_errors: 'network errors (RX + TX)',
};

export function getSimulationTimeline(router: RouterId, fault: FaultId, random?: () => number): SimulationTimeline {
  const edgesById = new Map([...edges, simulationQueryEdge].map((edge) => [edge.id, edge]));
  const steps: SimulationStep[] = [];
  let cursor = 0;

  function move(edgeId: string, reverse = false): SimulationMove {
    const edge = edgesById.get(edgeId);
    if (!edge) throw new Error(`Missing simulation edge: ${edgeId}`);
    const { source, target } = edge;
    return { edgeId, from: reverse ? target : source, to: reverse ? source : target, reverse };
  }

  function step(
    id: SimulationStepId,
    label: string,
    kind: DurationKind,
    moves: SimulationMove[],
    currentNodeIds = [...new Set(moves.map(({ from }) => from))],
  ) {
    const durationMs = simulationTiming[kind];
    const endsAtMs = cursor + durationMs;
    steps.push({ id, label, moves, currentNodeIds, startsAtMs: cursor, endsAtMs, durationMs });
    cursor = endsAtMs;
  }

  function collect(check: FaultId) {
    const label = collectorLabels[check];
    step(`query:${check}`, `Query ${label}`, 'flow', [move(simulationQueryEdge.id)]);
    step(`record:${check}`, `Record ${label} evidence`, 'flow', [move('inv-evidence')]);
    step(`save:${check}`, `Save ${label} evidence`, 'data', [move('evidence-db')]);
  }

  step('scrape', 'Observe scrape result', 'flow', [move(`${router}-prom`)]);
  step('send-alert', 'Send firing alert', 'flow', [move('prom-alert')]);
  step('group', 'Grouping · 30s configured', 'grouping', [], ['alertmanager']);
  step('deliver', 'Deliver webhook and email', 'flow', [move('alert-backend'), move('alert-email')]);
  step('process', 'Process new alert', 'flow', [move('backend-alerts')]);
  step('deduplicate', 'Read alert for deduplication', 'data', [move('alerts-db', true)]);
  step('insert-alert', 'Insert alert in transaction', 'data', [move('alerts-db')]);
  step('open-incident', 'Open incident for new firing alert', 'flow', [move('alerts-incident')]);
  step('commit-incident', 'Insert incident and link · commit', 'data', [move('incident-db')]);
  step('start-investigation', 'Start investigation', 'flow', [move('incident-inv')]);
  step('read-incident', 'Read incident and router', 'data', [move('investigation-db', true)]);
  step('create-investigation', 'Create running investigation', 'data', [move('investigation-db')]);
  const collectors = fault === 'prometheus_up' ? ['prometheus_up'] as const : simulationCollectorOrder;
  for (const check of collectors) collect(check);

  step('check-running', 'Check investigation is running', 'data', [move('investigation-db', true)]);
  step('complete-investigation', 'Mark investigation completed', 'data', [move('investigation-db')]);
  step('start-diagnosis', 'Start AI diagnosis', 'flow', [move('evidence-ai')]);
  step('read-metadata', 'Read investigation metadata', 'data', [move('ai-db', true)]);
  step('request-mcp', 'Request evidence via MCP', 'flow', [move('ai-mcp')]);
  step('read-evidence', 'Read evidence from SQLite', 'data', [move('mcp-db', true)]);
  step('return-evidence', 'Return read-only evidence to AI', 'flow', [move('ai-mcp', true)]);
  step('save-diagnosis', 'Save validated diagnosis', 'data', [move('ai-db')]);
  return { steps, durationMs: cursor, log: buildSimulationLog(steps, router, fault, collectors, random) };
}

export function getSimulationFrame(timeline: SimulationTimeline | null, elapsedMs: number) {
  if (!timeline) return null;

  const nextLogIndex = timeline.log.findIndex(({ atMs }) => atMs > elapsedMs);
  const logEntries = nextLogIndex < 0 ? timeline.log : timeline.log.slice(0, nextLogIndex);
  const nextLogAtMs = timeline.log[nextLogIndex]?.atMs;
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  for (const step of timeline.steps) {
    if (elapsedMs < step.endsAtMs) return { visitedNodes, visitedEdges, current: step, logEntries, nextLogAtMs };

    for (const { edgeId, to } of step.moves) {
      visitedEdges.add(edgeId);
      visitedNodes.add(to);
    }
  }
  return { visitedNodes, visitedEdges, current: null, logEntries, nextLogAtMs };
}
