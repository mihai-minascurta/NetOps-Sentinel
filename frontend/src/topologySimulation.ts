import { routerIds, type RouterId, type TopologyStatus } from './topology.ts';

export const simulationFaults = {
  cpu_usage: {
    label: 'CPU usage', collector: 'collect_cpu_usage', badge: 'CPU HIGH',
    alertname: 'HighCPUUsage', severity: 'warning', evaluation: 'after 5 minutes above 90%',
  },
  memory_usage: {
    label: 'Memory usage', collector: 'collect_memory_usage', badge: 'MEM HIGH',
    alertname: 'HighRAMUsage', severity: 'warning', evaluation: 'after 5 minutes above 85%',
  },
  disk_usage: {
    label: 'Disk usage', collector: 'collect_disk_usage', badge: 'DISK FULL',
    alertname: 'HighDiskUsage', severity: 'warning', evaluation: 'after 10 minutes above 85% on the root disk',
  },
  network_interfaces: {
    label: 'Network interfaces', collector: 'collect_network_interfaces', badge: 'IFACE DOWN',
    alertname: 'SyntheticNetworkInterfaces', severity: 'warning', evaluation: null,
  },
  network_errors: {
    label: 'Network errors', collector: 'collect_network_errors', badge: 'NET ERRORS',
    alertname: 'SyntheticNetworkErrors', severity: 'warning', evaluation: null,
  },
  prometheus_up: {
    label: 'Router down', collector: 'collect_node_status', badge: 'DOWN',
    alertname: 'NodeExporterDown', severity: 'critical', evaluation: 'after 2 minutes without a response',
  },
} as const;

export type FaultId = keyof typeof simulationFaults;
export const simulationFaultIds = Object.keys(simulationFaults) as FaultId[];
export const simulationCollectorOrder: readonly FaultId[] = [
  'prometheus_up', ...simulationFaultIds.filter((fault) => fault !== 'prometheus_up'),
];

type Scenario = { router: RouterId; fault: FaultId };
type SimulationSetup = { mode: 'random' } | ({ mode: 'custom' } & Scenario);

export type SimulationState =
  | { phase: 'idle' }
  | { phase: 'armed'; setup: SimulationSetup | null; armedAt: string }
  | { phase: 'running'; mode: SimulationSetup['mode']; scenario: Scenario; startedAt: string };

export type SimulationAction =
  | { type: 'arm'; at: string }
  | { type: 'configure'; setup: SimulationSetup }
  | { type: 'start'; at: string }
  | { type: 'reset' };

export function transitionSimulation(
  state: SimulationState,
  action: SimulationAction,
  random: () => number = Math.random,
): SimulationState {
  if (action.type === 'reset') return { phase: 'idle' };

  if (action.type === 'arm') {
    return state.phase === 'idle' ? { phase: 'armed', setup: null, armedAt: action.at } : state;
  }

  if (action.type === 'configure') {
    return state.phase === 'armed' ? { ...state, setup: action.setup } : state;
  }

  if (state.phase !== 'armed' || !state.setup) return state;

  const { setup } = state;
  const scenario = setup.mode === 'custom'
    ? { router: setup.router, fault: setup.fault }
    : {
        router: routerIds[Math.floor(random() * routerIds.length)],
        fault: simulationFaultIds[Math.floor(random() * simulationFaultIds.length)],
      };

  return { phase: 'running', mode: setup.mode, scenario, startedAt: action.at };
}

export function getSimulationSnapshot(state: SimulationState): TopologyStatus | null {
  if (state.phase === 'idle') return null;

  const nodes: TopologyStatus['nodes'] = { r1: 'up', r2: 'up' };
  if (state.phase === 'armed') {
    return {
      generated_at: state.armedAt,
      nodes,
      alerts_available: true,
      active_alerts: [],
    };
  }

  const { router, fault } = state.scenario;
  const { startedAt } = state;
  const { alertname, severity } = simulationFaults[fault];
  nodes[router] = 'down';

  return {
    generated_at: startedAt,
    nodes,
    alerts_available: true,
    active_alerts: [{
      fingerprint: `simulation-${router}-${fault}-${startedAt}`,
      alertname,
      severity,
      node: router,
      status: 'firing',
      starts_at: startedAt,
    }],
  };
}
