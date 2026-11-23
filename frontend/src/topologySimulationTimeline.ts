import { edges, simulationQueryEdge, type RouterId } from './topology.ts';
import type { FaultId } from './topologySimulation.ts';

export const simulationTiming = {
  speed: { normal: 1, fast: 2 },
  durationMs: { flow: 2500, data: 800, grouping: 1000 },
} as const;

export type SimulationSpeed = keyof typeof simulationTiming.speed;
type DurationKind = keyof typeof simulationTiming.durationMs;
type SimulationMove = { edgeId: string; from: string; to: string; reverse: boolean };

type SimulationStep = {
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
};

const edgesById = new Map([...edges, simulationQueryEdge].map((edge) => [edge.id, edge]));

function move(edgeId: string, reverse = false): SimulationMove {
  const edge = edgesById.get(edgeId);
  if (!edge) throw new Error(`Missing simulation edge: ${edgeId}`);
  const { source, target } = edge;
  return { edgeId, from: reverse ? target : source, to: reverse ? source : target, reverse };
}

export function getSimulationTimeline(router: RouterId, fault: FaultId, speed: SimulationSpeed): SimulationTimeline {
  const steps: SimulationStep[] = [];
  let cursor = 0;

  function step(
    label: string,
    kind: DurationKind,
    moves: SimulationMove[],
    currentNodeIds = [...new Set(moves.map(({ from }) => from))],
  ) {
    const durationMs = simulationTiming.durationMs[kind] / simulationTiming.speed[speed];
    const endsAtMs = cursor + durationMs;
    steps.push({ label, moves, currentNodeIds, startsAtMs: cursor, endsAtMs, durationMs });
    cursor = endsAtMs;
  }

  function collect(label: string) {
    step(`Query ${label}`, 'flow', [move(simulationQueryEdge.id)]);
    step(`Record ${label} evidence`, 'flow', [move('inv-evidence')]);
    step(`Save ${label} evidence`, 'data', [move('evidence-db')]);
  }

  step('Observe scrape result', 'flow', [move(`${router}-prom`)]);
  step('Send firing alert', 'flow', [move('prom-alert')]);
  step('Grouping · 30s configured', 'grouping', [], ['alertmanager']);
  step('Deliver webhook and email', 'flow', [move('alert-backend'), move('alert-email')]);
  step('Process new alert', 'flow', [move('backend-alerts')]);
  step('Read alert for deduplication', 'data', [move('alerts-db', true)]);
  step('Insert alert in transaction', 'data', [move('alerts-db')]);
  step('Open incident for new firing alert', 'flow', [move('alerts-incident')]);
  step('Insert incident and link · commit', 'data', [move('incident-db')]);
  step('Start investigation', 'flow', [move('incident-inv')]);
  step('Read incident and router', 'data', [move('investigation-db', true)]);
  step('Create running investigation', 'data', [move('investigation-db')]);
  collect('availability');

  if (fault !== 'prometheus_up') {
    for (const metric of ['CPU usage', 'memory usage', 'disk usage', 'network interfaces', 'network errors (RX + TX)']) {
      collect(metric);
    }
  }

  step('Check investigation is running', 'data', [move('investigation-db', true)]);
  step('Mark investigation completed', 'data', [move('investigation-db')]);
  step('Start AI diagnosis', 'flow', [move('evidence-ai')]);
  step('Read investigation metadata', 'data', [move('ai-db', true)]);
  step('Request evidence via MCP', 'flow', [move('ai-mcp')]);
  step('Read evidence from SQLite', 'data', [move('mcp-db', true)]);
  step('Return read-only evidence to AI', 'flow', [move('ai-mcp', true)]);
  step('Save validated diagnosis', 'data', [move('ai-db')]);
  return { steps, durationMs: cursor };
}

export function getSimulationFrame(timeline: SimulationTimeline, elapsedMs: number) {
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  for (const step of timeline.steps) {
    if (elapsedMs < step.endsAtMs) return { visitedNodes, visitedEdges, current: step };

    for (const { edgeId, to } of step.moves) {
      visitedEdges.add(edgeId);
      visitedNodes.add(to);
    }
  }
  return { visitedNodes, visitedEdges, current: null };
}
