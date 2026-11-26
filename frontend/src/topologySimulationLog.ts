import type { RouterId } from './topology.ts';
import { getSimulationMeasurements, simulationFaults, type FaultId } from './topologySimulation.ts';
import type { SimulationStep, SimulationStepId } from './topologySimulationTimeline.ts';

export type SimulationLogEntry = {
  id: number;
  stepId: SimulationStepId;
  atMs: number;
  message: string;
};

function describeChecks(routerId: RouterId, fault: FaultId, random?: () => number) {
  const router = routerId.toUpperCase();
  const { cpu, memory, disk, networkErrors: errorsPerSecond } = getSimulationMeasurements(routerId, fault, random);
  const availability = fault === 'prometheus_up' ? `${router} is down (up is 0).` : `${router} is reachable.`;
  const networkInterface = `Interface eth1 on ${router} is ${fault === 'network_interfaces' ? 'down' : 'up'}.`;
  const networkErrors = fault === 'network_errors'
    ? `${router} sees ${errorsPerSecond} network errors per second.`
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
  random?: () => number,
): SimulationLogEntry[] {
  const routerLabel = router.toUpperCase();
  const { alertname, evaluation } = simulationFaults[fault];
  const { observations, findings } = describeChecks(router, fault, random);
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
