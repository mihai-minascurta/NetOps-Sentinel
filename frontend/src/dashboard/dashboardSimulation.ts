import {
  getSimulationIncidentNumber, getSimulationMeasurements, simulationFaults, type SimulationState,
} from '../topologySimulation.ts';
import type { getSimulationFrame, SimulationStepId } from '../topologySimulationTimeline.ts';
import {
  dashboardCollectors, dashboardFaultDetails, incidentAvailabilityTrend, incidentMetricTrend,
  type DashboardActivityEntry, type DashboardDiagnosisData, type DashboardEvidence, type DashboardIncident,
  type DashboardRouter, type DashboardSample,
} from './dashboardSample.ts';

type Panels = Pick<DashboardSample, 'activity' | 'incidents' | 'evidence'> & {
  diagnosis: DashboardDiagnosisData | null;
  diagnosisIncidentNumber: number | null;
};

const emptyPanels: Panels = {
  activity: [],
  incidents: [],
  diagnosis: null,
  diagnosisIncidentNumber: null,
  evidence: dashboardCollectors.map((collector) => ({ ...collector, status: 'pending' })),
};

const activityKinds: Partial<Record<SimulationStepId, DashboardActivityEntry['kind']>> = {
  scrape: 'anomaly',
  'send-alert': 'alert',
  group: 'alert',
  deliver: 'alert',
  'insert-alert': 'alert',
  'commit-incident': 'incident',
  'read-evidence': 'ai',
  'save-diagnosis': 'ai',
};

const activityTime = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function formatIncidentAge(ageMs: number) {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 1) return 'just now';
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
}

export function getDashboardRouterTone({ health, fault, ram }: DashboardRouter) {
  if (fault || health.label === 'Down') return 'critical';
  return ram.value !== null && ram.value > 85 ? 'warning' : 'ok';
}

export function getDashboardRouters(routers: readonly DashboardRouter[], simulation: SimulationState) {
  if (simulation.phase === 'idle') return routers;

  const scenario = simulation.phase === 'running' ? simulation.scenario : null;
  return routers.map<DashboardRouter>((router) => {
    const fault = scenario?.router === router.id ? scenario.fault : null;
    if (fault === 'prometheus_up') {
      return {
        ...router,
        health: { label: 'Down', tone: 'critical' },
        cpu: { value: null },
        ram: { value: null },
        fault: undefined,
      };
    }

    const { cpu, memory } = getSimulationMeasurements(router.id, fault);
    return {
      ...router,
      health: { label: 'Up', tone: 'ok' },
      cpu: { value: cpu, tone: fault === 'cpu_usage' ? 'warning' : undefined },
      ram: { value: memory, tone: fault === 'memory_usage' ? 'warning' : undefined },
      fault: fault ? simulationFaults[fault] : undefined,
    };
  });
}

export function getDashboardSimulationPanels(
  sample: Panels,
  simulation: SimulationState,
  frame: ReturnType<typeof getSimulationFrame>,
): Panels {
  if (simulation.phase === 'idle') return sample;
  if (simulation.phase !== 'running' || !frame) return emptyPanels;

  const { logEntries, completedSteps, elapsedMs } = frame;
  const { router, fault } = simulation.scenario;
  const number = getSimulationIncidentNumber(router, fault);
  const startedAt = Date.parse(simulation.startedAt);
  const activity = logEntries.map<DashboardActivityEntry>(({ id, stepId, atMs, message }) => {
    const time = new Date(startedAt + atMs);
    const kind = activityKinds[stepId] ?? 'investigation';
    return { id, kind, time: activityTime.format(time), dateTime: time.toISOString(), message, incidentNumber: kind === 'incident' ? number : undefined };
  });
  const committed = completedSteps.get('commit-incident');
  if (!committed) return { ...emptyPanels, activity };

  const shouldSkip = fault === 'prometheus_up' && completedSteps.has('save:prometheus_up');
  const evidence = dashboardCollectors.map<DashboardEvidence>((collector) => {
    if (completedSteps.has(`save:${collector.id}`)) {
      return { ...collector, status: collector.id === fault ? 'fault' : 'collected' };
    }
    return { ...collector, status: shouldSkip ? 'skipped' : 'pending' };
  });
  const savedChecks = evidence.filter(({ status }) => status === 'collected' || status === 'fault');
  const evidenceIds = savedChecks.flatMap(({ id }, index) => id === 'prometheus_up' || id === fault ? [index + 1] : []);
  const investigation = completedSteps.has('create-investigation') ? {
    status: completedSteps.has('complete-investigation') ? 'completed' as const : 'running' as const,
    evidenceCount: savedChecks.length,
    skippedCount: shouldSkip ? dashboardCollectors.length - 1 : 0,
  } : undefined;
  const details = dashboardFaultDetails[fault];
  const { metric } = details;
  const measurements = getSimulationMeasurements(router, fault);
  const sparkline = metric === null
    ? incidentAvailabilityTrend
    : incidentMetricTrend.map((fraction) => fraction * measurements[metric]);
  const incident: DashboardIncident = {
    id: number,
    title: details.title,
    severity: simulationFaults[fault].severity,
    router,
    age: formatIncidentAge(elapsedMs - committed.endsAtMs),
    status: investigation ? 'investigating' : 'open',
    investigation,
    sparkline,
  };
  const diagnosis: DashboardDiagnosisData | null = completedSteps.has('save-diagnosis') ? {
    ...details.diagnosis,
    summary: details.insight(router.toUpperCase(), measurements),
    evidence_ids: evidenceIds,
  } : null;

  return {
    activity,
    incidents: [incident],
    diagnosis,
    diagnosisIncidentNumber: diagnosis ? number : null,
    evidence,
  };
}
