import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSimulationSnapshot,
  simulationFaults,
  transitionSimulation,
} from '../src/topologySimulation.ts';

const idle = { phase: 'idle' };
const armedAt = '2026-11-23T12:00:00.000Z';
const startedAt = '2026-11-23T12:00:01.000Z';
const open = { type: 'arm', at: armedAt };
const start = { type: 'start', at: startedAt };
const reset = { type: 'reset' };

function configure(setup, random) {
  return transitionSimulation(transitionSimulation(idle, open), { type: 'configure', setup }, random);
}

test('Opening the panel arms both routers without a configured scenario', () => {
  assert.equal(getSimulationSnapshot(idle), null);
  const armed = transitionSimulation(idle, open);
  assert.deepEqual(armed, { phase: 'armed', setup: null, armedAt });
  assert.deepEqual(getSimulationSnapshot(armed), {
    generated_at: armedAt,
    nodes: { r1: 'up', r2: 'up' },
    alerts_available: true,
    active_alerts: [],
  });
  assert.equal(transitionSimulation(armed, start), armed);
  assert.equal(transitionSimulation(armed, { type: 'arm', at: startedAt }), armed);
  assert.deepEqual(transitionSimulation(armed, reset), idle);
});

test('Custom goes from idle to healthy, starts one fault, and resets', () => {
  const setup = { mode: 'custom', router: 'r2', fault: 'network_interfaces' };
  const noRandom = () => assert.fail('Custom must not use randomness');
  const armed = configure(setup, noRandom);
  assert.deepEqual(armed, { phase: 'armed', setup, armedAt });
  assert.deepEqual(getSimulationSnapshot(armed), {
    generated_at: armedAt,
    nodes: { r1: 'up', r2: 'up' },
    alerts_available: true,
    active_alerts: [],
  });

  const running = transitionSimulation(armed, start, noRandom);
  assert.deepEqual(running, {
    phase: 'running', mode: 'custom', scenario: { router: 'r2', fault: 'network_interfaces' }, startedAt,
  });
  assert.equal(transitionSimulation(running, { type: 'arm', at: startedAt }), running);
  const snapshot = getSimulationSnapshot(running);
  assert.deepEqual(snapshot.nodes, { r1: 'up', r2: 'down' });
  assert.equal(snapshot.active_alerts.length, 1);
  assert.deepEqual(snapshot.active_alerts[0], {
    fingerprint: `simulation-r2-network_interfaces-${startedAt}`,
    alertname: 'Network interfaces',
    severity: 'warning',
    node: 'r2',
    status: 'firing',
    starts_at: startedAt,
  });
  const stopped = transitionSimulation(running, reset);
  assert.deepEqual(stopped, idle);
  assert.equal(getSimulationSnapshot(stopped), null);
});

test('Random draws independently for router and fault on Start', () => {
  const armed = configure({ mode: 'random' }, () => assert.fail('Choosing Random must not draw a scenario'));
  assert.deepEqual(getSimulationSnapshot(armed).nodes, { r1: 'up', r2: 'up' });
  assert.deepEqual(getSimulationSnapshot(armed).active_alerts, []);
  for (const [draws, expected] of [
    [[0, 0.99999], { router: 'r1', fault: 'prometheus_up' }],
    [[0.99999, 0], { router: 'r2', fault: 'cpu_usage' }],
  ]) {
    const running = transitionSimulation(armed, start, () => draws.shift());
    assert.deepEqual(running.scenario, expected);
    assert.equal(draws.length, 0);
    assert.equal(getSimulationSnapshot(running).nodes[expected.router], 'down');
  }
});

test('Configuring requires an open simulation, and running locks the configuration', () => {
  assert.equal(transitionSimulation(idle, start), idle);
  const randomMode = { type: 'configure', setup: { mode: 'random' } };
  assert.equal(transitionSimulation(idle, randomMode), idle);

  const armed = configure({ mode: 'random' });
  assert.deepEqual(transitionSimulation(armed, reset), idle);

  const running = transitionSimulation(armed, start, () => 0);
  assert.equal(transitionSimulation(running, start), running);
  assert.equal(transitionSimulation(running, randomMode), running);
});

test('Simulation fault labels map to the six collector results', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(simulationFaults).map(([id, fault]) => [id, fault.badge])), {
    cpu_usage: 'CPU HIGH',
    memory_usage: 'MEM HIGH',
    disk_usage: 'DISK FULL',
    network_interfaces: 'IFACE DOWN',
    network_errors: 'NET ERRORS',
    prometheus_up: 'DOWN',
  });
});
