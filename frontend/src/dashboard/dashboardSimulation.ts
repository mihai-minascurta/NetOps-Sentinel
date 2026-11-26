import type { RouterId } from '../topology.ts';
import {
  getSimulationMeasurements, simulationCollectorOrder, simulationFaults, type FaultId, type SimulationState,
} from '../topologySimulation.ts';
import type { getSimulationFrame } from '../topologySimulationTimeline.ts';
import type { DashboardRouter, DashboardSample } from './dashboardSample.ts';

type Diagnosis = DashboardSample['diagnosis'];
type Panels = Pick<DashboardSample, 'activity' | 'incidents'> & { diagnosis: Diagnosis | null };

const emptyPanels: Panels = { activity: [], incidents: [], diagnosis: null };

const faultDetails = {
  cpu_usage: {
    title: 'High CPU usage',
    diagnosis: {
      probable_cause: 'CPU demand stayed above the configured alert threshold.',
      confidence: 'medium',
      recommendations: ['Review which processes are using the most CPU.', 'Compare CPU demand with the normal baseline.'],
    },
  },
  memory_usage: {
    title: 'High memory usage',
    diagnosis: {
      probable_cause: 'Low available memory triggered the HighRAMUsage alert.',
      confidence: 'medium',
      recommendations: ['Review which processes are using the most memory.', 'Check how available memory changes over time.'],
    },
  },
  disk_usage: {
    title: 'High root disk usage',
    diagnosis: {
      probable_cause: 'The root filesystem had less free space than the alert allows.',
      confidence: 'medium',
      recommendations: ['Inspect disk usage by directory on the root filesystem.', 'Review recent growth in logs and stored data.'],
    },
  },
  network_interfaces: {
    title: 'Network interface down',
    diagnosis: {
      probable_cause: 'The eth1 link or its configured state may explain the interface being down.',
      confidence: 'low',
      recommendations: ['Verify whether eth1 is expected to be active.', 'Check the peer link and recent interface events.'],
    },
  },
  network_errors: {
    title: 'Network errors',
    diagnosis: {
      probable_cause: 'An interface or its peer may be contributing to the RX/TX errors.',
      confidence: 'low',
      recommendations: ['Compare RX and TX error counters by interface.', 'Check the peer counters over the same time window.'],
    },
  },
  prometheus_up: {
    title: 'Node Exporter unavailable',
    diagnosis: {
      probable_cause: 'The exporter or the network path from Prometheus may be unavailable.',
      confidence: 'low',
      recommendations: ['Check the Node Exporter service status.', 'Verify reachability from the Prometheus host.'],
    },
  },
} satisfies Record<FaultId, { title: string; diagnosis: Omit<Diagnosis, 'summary' | 'evidence_ids'> }>;

function simulateDiagnosis(router: RouterId, fault: FaultId, evidenceIds: readonly number[]): Diagnosis {
  const name = router.toUpperCase();
  const { cpu, memory, disk, networkErrors } = getSimulationMeasurements(router, fault);
  const summaries: Record<FaultId, string> = {
    cpu_usage: `${name} CPU usage reached ${cpu}%.`,
    memory_usage: `${name} RAM usage reached ${memory}%.`,
    disk_usage: `${name} root disk usage reached ${disk}%.`,
    network_interfaces: `${name} reports interface eth1 down.`,
    network_errors: `${name} reports ${networkErrors} network errors per second.`,
    prometheus_up: `Prometheus could not scrape Node Exporter on ${name}.`,
  };

  return { ...faultDetails[fault].diagnosis, summary: summaries[fault], evidence_ids: evidenceIds };
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

  const { logEntries: activity, completedSteps } = frame;
  if (!completedSteps.has('commit-incident')) return { ...emptyPanels, activity };

  const { router, fault } = simulation.scenario;
  const savedChecks = simulationCollectorOrder.filter((check) => completedSteps.has(`save:${check}`));
  const evidenceIds = savedChecks.flatMap((check, index) => check === 'prometheus_up' || check === fault ? [index + 1] : []);
  const investigation = completedSteps.has('create-investigation') ? {
    status: completedSteps.has('complete-investigation') ? 'completed' as const : 'running' as const,
    evidenceCount: savedChecks.length,
    skippedCount: fault === 'prometheus_up' && savedChecks.length > 0 ? simulationCollectorOrder.length - 1 : 0,
  } : undefined;

  return {
    activity,
    incidents: [{
      id: `sim-${simulation.startedAt}`,
      title: faultDetails[fault].title,
      severity: simulationFaults[fault].severity,
      router,
      age: 'This run',
      status: 'open',
      investigation,
    }],
    diagnosis: completedSteps.has('save-diagnosis') ? simulateDiagnosis(router, fault, evidenceIds) : null,
  };
}
