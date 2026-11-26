import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDashboardLayouts } from '../src/dashboard/dashboardLayout.ts';
import { dashboardSample } from '../src/dashboard/dashboardSample.ts';
import { getDashboardRouters, getDashboardSimulationPanels } from '../src/dashboard/dashboardSimulation.ts';
import { simulationQueryEdge } from '../src/topology.ts';
import { simulationCollectorOrder, simulationFaultIds, simulationFaults, transitionSimulation } from '../src/topologySimulation.ts';
import { getSimulationFrame, getSimulationTimeline } from '../src/topologySimulationTimeline.ts';

const at = '2026-11-25T12:00:00.000Z';
const { routers: sample } = dashboardSample;
const armed = transitionSimulation({ phase: 'idle' }, { type: 'arm', at });

test('arming shows healthy metrics on both routers and Reset restores the sample', () => {
  assert.equal(sample.find(({ id }) => id === 'r2').ram.value, 91);
  for (const router of getDashboardRouters(sample, armed)) {
    assert.equal(router.health.label, 'Up');
    assert.ok(router.cpu.value < 90);
    assert.ok(router.ram.value < 75);
    assert.equal(router.fault, undefined);
  }
  assert.equal(getDashboardRouters(sample, transitionSimulation(armed, { type: 'reset' })), sample);
});

test('only Router down hides metrics and changes reachability, on either router', () => {
  const baseline = getDashboardRouters(sample, armed);
  for (const { id: router } of sample) {
    for (const fault of simulationFaultIds) {
      const setup = { mode: 'custom', router, fault };
      const configured = transitionSimulation(armed, { type: 'configure', setup });
      const running = transitionSimulation(configured, { type: 'start', at });
      const displayed = getDashboardRouters(sample, running);
      const affected = displayed.find(({ id }) => id === router);
      assert.deepEqual(displayed.find(({ id }) => id !== router), baseline.find(({ id }) => id !== router));

      if (fault === 'prometheus_up') {
        assert.equal(affected.health.label, 'Down');
        assert.equal(affected.cpu.value, null);
        assert.equal(affected.ram.value, null);
      } else {
        assert.equal(affected.health.label, 'Up');
        assert.equal(affected.fault.badge, simulationFaults[fault].badge);
        assert.ok(Number.isFinite(affected.cpu.value) && Number.isFinite(affected.ram.value));
      }
      assert.equal(getDashboardRouters(sample, transitionSimulation(running, { type: 'reset' })), sample);
    }
  }
});

test('dashboard CPU and RAM alerts show the same measurements as the timeline journal', () => {
  for (const [fault, metric, threshold] of [['cpu_usage', 'cpu', 90], ['memory_usage', 'ram', 85]]) {
    const running = { phase: 'running', mode: 'custom', scenario: { router: 'r2', fault }, startedAt: at };
    const { [metric]: reading } = getDashboardRouters(sample, running).find(({ id }) => id === 'r2');
    const openingLine = getSimulationTimeline('r2', fault).log[0].message;
    assert.ok(reading.value > threshold);
    assert.equal(reading.tone, 'warning');
    assert.ok(openingLine.includes(`${reading.value}%`));
  }
});

test('dashboard activity, incident, investigation and diagnosis appear at timeline boundaries', () => {
  const running = { phase: 'running', mode: 'custom', scenario: { router: 'r2', fault: 'memory_usage' }, startedAt: at };
  const timeline = getSimulationTimeline('r2', 'memory_usage');
  const panelsAt = (elapsedMs) => getDashboardSimulationPanels(dashboardSample, running, getSimulationFrame(timeline, elapsedMs));
  const endOf = (id) => timeline.steps.find((step) => step.id === id).endsAtMs;

  assert.equal(panelsAt(endOf('scrape') - 1).activity.length, 0);
  const firstEntry = panelsAt(endOf('scrape')).activity[0];
  assert.match(firstEntry.message, /R2 memory usage/);
  assert.equal(panelsAt(endOf('commit-incident') - 1).incidents.length, 0);
  const committed = panelsAt(endOf('commit-incident'));
  assert.equal(committed.incidents[0].status, 'open');
  assert.equal(committed.incidents[0].investigation, undefined);
  assert.equal(committed.activity.at(-1).message, 'A new incident is opened.');
  assert.deepEqual(panelsAt(endOf('create-investigation')).incidents[0].investigation, {
    status: 'running', evidenceCount: 0, skippedCount: 0,
  });
  assert.equal(panelsAt(endOf('save:prometheus_up') - 1).incidents[0].investigation.evidenceCount, 0);
  assert.equal(panelsAt(endOf('save:prometheus_up')).incidents[0].investigation.evidenceCount, 1);
  assert.equal(panelsAt(endOf('save-diagnosis') - 1).diagnosis, null);

  const finished = panelsAt(endOf('save-diagnosis'));
  assert.equal(finished.incidents[0].status, 'open');
  assert.deepEqual(finished.incidents[0].investigation, { status: 'completed', evidenceCount: 6, skippedCount: 0 });
  assert.deepEqual(finished.diagnosis.evidence_ids, [1, 3]);
  assert.ok(finished.diagnosis.summary.includes(firstEntry.message.match(/\d+(?:\.\d+)?%/)[0]));
  assert.equal(getDashboardSimulationPanels(dashboardSample, transitionSimulation(running, { type: 'reset' }), null), dashboardSample);
});

test('diagnosis references only persisted evidence for each scenario and unavailable routers skip five checks', () => {
  for (const fault of simulationFaultIds) {
    const running = { phase: 'running', mode: 'custom', scenario: { router: 'r1', fault }, startedAt: at };
    const timeline = getSimulationTimeline('r1', fault);
    const { activity, diagnosis, incidents } = getDashboardSimulationPanels(
      dashboardSample, running, getSimulationFrame(timeline, timeline.durationMs),
    );
    const { evidenceCount, skippedCount } = incidents[0].investigation;
    const unreachable = fault === 'prometheus_up';
    assert.equal(evidenceCount, unreachable ? 1 : 6);
    assert.equal(skippedCount, unreachable ? 5 : 0);
    assert.deepEqual(diagnosis.evidence_ids, unreachable ? [1] : [1, simulationCollectorOrder.indexOf(fault) + 1]);
    assert.equal(activity.at(-1).message, 'AI saves a diagnosis for R1.');
  }
});

test('each timeline move has a drawable edge in both dashboard layouts', () => {
  const edgeIds = new Set([...dashboardSample.pipeline.edges.map(({ id }) => id), simulationQueryEdge.id]);
  const layouts = Object.values(createDashboardLayouts());
  for (const [router, fault] of [['r1', 'prometheus_up'], ['r2', 'memory_usage']]) {
    const { steps } = getSimulationTimeline(router, fault);
    for (const { edgeId } of steps.flatMap(({ moves }) => moves)) {
      assert.ok(edgeIds.has(edgeId), edgeId);
      for (const { paths } of layouts) assert.match(paths[edgeId], /^M/, edgeId);
    }
  }
});

test('the simulation query path goes from Investigation to Prometheus without crossing a card', () => {
  for (const [variant, { nodes, paths, width, height }] of Object.entries(createDashboardLayouts())) {
    const [start, ...commands] = paths[simulationQueryEdge.id].match(/[MHV][^MHV]+/g);
    let [x, y] = start.slice(1).split(' ').map(Number);
    const investigation = nodes.investigation;
    assert.ok(y === investigation.y || x === investigation.x + investigation.width, variant);

    for (const command of commands) {
      const coordinate = Number(command.slice(1));
      const nextX = command[0] === 'H' ? coordinate : x;
      const nextY = command[0] === 'V' ? coordinate : y;
      assert.ok(nextX >= 0 && nextX <= width && nextY >= 0 && nextY <= height, variant);
      for (const [id, node] of Object.entries(nodes)) {
        const crosses = nextX === x
          ? x > node.x && x < node.x + node.width && Math.min(y, nextY) < node.y + node.height && Math.max(y, nextY) > node.y
          : y > node.y && y < node.y + node.height && Math.min(x, nextX) < node.x + node.width && Math.max(x, nextX) > node.x;
        assert.ok(!crosses, `${variant}: query crosses ${id}`);
      }
      x = nextX;
      y = nextY;
    }

    const prometheus = nodes.prometheus;
    assert.equal(x, prometheus.x + prometheus.width / 2, variant);
    assert.ok(y === prometheus.y || y === prometheus.y + prometheus.height, variant);
  }
});
