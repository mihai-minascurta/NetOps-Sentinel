import type { RouterId } from './topology.ts';
import { simulationFaults, type FaultId } from './topologySimulation.ts';
import type { SimulationStep, SimulationStepId } from './topologySimulationTimeline.ts';

export type SimulationLogEntry = {
  id: number;
  stepId: SimulationStepId;
  atMs: number;
  message: string;
};

export function createSimulationRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function scenarioSeed(router: RouterId, fault: FaultId): number {
  return [...`${router}-${fault}`].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);
}

function describeChecks(router: string, fault: FaultId, random: () => number) {
  const sample = (low: number, high: number) => Number((low + (high - low) * random()).toFixed(1));
  const cpu = fault === 'cpu_usage' ? sample(92, 98) : sample(23, 42);
  const memory = fault === 'memory_usage' ? sample(87, 92) : sample(52, 65);
  const disk = fault === 'disk_usage' ? sample(87, 95) : sample(54, 69);
  const availability = fault === 'prometheus_up' ? `${router} is down (up is 0).` : `${router} is reachable.`;
  const networkInterface = `Interface eth1 on ${router} is ${fault === 'network_interfaces' ? 'down' : 'up'}.`;
  const networkErrors = fault === 'network_errors'
    ? `${router} sees ${sample(1.1, 2)} network errors per second.`
    : `${router} has no network errors.`;

  // The investigation's memory limit differs from the Prometheus alert threshold.
  const usage = (label: string, value: number, limit: number) =>
    `${label} is ${value}%, ${value >= limit ? 'above' : 'below'} the ${limit}% limit.`;

  return {
    observations: {
      prometheus_up: availability,
      cpu_usage: `${router} CPU usage is ${cpu}%.`,
      memory_usage: `${router} memory usage is ${memory}%.`,
      disk_usage: `${router} root disk is ${disk}% full.`,
      network_interfaces: networkInterface,
      network_errors: networkErrors,
    },
    findings: {
      prometheus_up: availability,
      cpu_usage: usage('CPU usage', cpu, 90),
      memory_usage: usage('Memory usage', memory, 75),
      disk_usage: usage('Root disk usage', disk, 85),
      network_interfaces: networkInterface,
      network_errors: networkErrors,
    },
  };
}

const lineSpacingMs = 150;

export function buildSimulationLog(
  steps: readonly SimulationStep[],
  router: RouterId,
  fault: FaultId,
  collectors: readonly FaultId[],
  random = createSimulationRandom(scenarioSeed(router, fault)),
): SimulationLogEntry[] {
  const routerLabel = router.toUpperCase();
  const { alertname, evaluation } = simulationFaults[fault];
  const { observations, findings } = describeChecks(routerLabel, fault, random);
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const log: SimulationLogEntry[] = [];

  function emit(stepId: SimulationStepId, message: string, when: 'start' | 'end' = 'end', offset = 0) {
    const step = stepsById.get(stepId);
    if (!step) throw new Error(`Missing journal step: ${stepId}`);

    const atMs = when === 'end' ? step.endsAtMs : step.startsAtMs + offset;
    if (atMs > step.endsAtMs) throw new Error(`Journal event extends beyond step: ${stepId}`);
    log.push({ id: log.length, stepId, atMs, message });
  }

  emit('scrape', observations[fault]);
  emit('send-alert', evaluation
    ? `Prometheus fires ${alertname} ${evaluation}.`
    : `The simulation raises ${alertname}.`, 'start', lineSpacingMs);
  emit('group', 'Alertmanager groups the alert.', 'start');
  emit('deliver', 'Alertmanager sends the alert by webhook and email.', 'start');
  emit('insert-alert', 'The webhook records a new alert.');
  emit('commit-incident', 'A new incident is opened.');
  emit('start-investigation', 'Investigation starts with a router check.', 'start', lineSpacingMs);

  for (const check of collectors) {
    if (check === 'cpu_usage') {
      emit('query:cpu_usage', 'Investigation checks CPU, memory and disk.', 'start', lineSpacingMs);
    }
    emit(`query:${check}`, findings[check]);
  }
  if (fault === 'prometheus_up') {
    emit('check-running', 'Investigation skips the other five checks.', 'start', lineSpacingMs);
  }

  emit('complete-investigation', 'Investigation saves its findings.');
  emit('read-evidence', 'AI reads the evidence.');
  emit('save-diagnosis', `AI saves a diagnosis for ${routerLabel}.`);
  return log;
}
