import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulationRandom } from '../src/topologySimulationLog.ts';
import { getSimulationSnapshot, simulationCollectorOrder, transitionSimulation } from '../src/topologySimulation.ts';
import { getSimulationFrame, getSimulationTimeline } from '../src/topologySimulationTimeline.ts';

const examples = {
  prometheus_up: ['NodeExporterDown', '2 minutes'],
  cpu_usage: ['HighCPUUsage', '5 minutes above 90%'],
  memory_usage: ['HighRAMUsage', '5 minutes above 85%'],
  disk_usage: ['HighDiskUsage', '10 minutes above 85%'],
  network_interfaces: ['SyntheticNetworkInterfaces', 'The simulation raises'],
  network_errors: ['SyntheticNetworkErrors', 'The simulation raises'],
};

for (const [fault, [name, rule]] of Object.entries(examples)) {
  test(`${fault} has a deterministic, traceable journal with the matching rule and evidence`, () => {
    const timeline = getSimulationTimeline('r2', fault, createSimulationRandom(42));
    assert.deepEqual(timeline.log, getSimulationTimeline('r2', fault, createSimulationRandom(42)).log);
    if (fault !== 'prometheus_up') {
      assert.notDeepEqual(timeline.log, getSimulationTimeline('r2', fault, createSimulationRandom(24)).log);
    }
    const steps = new Map(timeline.steps.map((step) => [step.id, step]));
    for (const [index, entry] of timeline.log.entries()) {
      const step = steps.get(entry.stepId);
      assert.ok(step && entry.atMs >= step.startsAtMs && entry.atMs <= step.endsAtMs);
      if (index > 0) assert.ok(entry.atMs > timeline.log[index - 1].atMs);
      assert.match(entry.message, /^[A-Z].*\.$/);
    }

    const [scrape, evaluation] = timeline.log;
    assert.equal(scrape.atMs, 3500);
    assert.equal(evaluation.atMs, 3650);
    assert.ok(evaluation.message.includes(name) && evaluation.message.includes(rule));
    const snapshot = getSimulationSnapshot({
      phase: 'running', mode: 'custom', scenario: { router: 'r2', fault }, startedAt: '2026-11-23T12:00:00.000Z',
    });
    assert.equal(snapshot.active_alerts[0].alertname, name);
    assert.equal(snapshot.active_alerts[0].severity, fault === 'prometheus_up' ? 'critical' : 'warning');

    const checked = timeline.log.filter(({ stepId, atMs }) => stepId.startsWith('query:') && atMs === steps.get(stepId).endsAtMs);
    if (fault === 'prometheus_up') {
      assert.equal(scrape.message, 'R2 is down (up is 0).');
      assert.deepEqual(checked.map(({ message }) => message), [scrape.message]);
      const skipped = timeline.log.find(({ stepId }) => stepId === 'check-running');
      assert.ok(skipped.atMs > checked[0].atMs);
      assert.match(skipped.message, /skips the other five checks/);
    } else {
      assert.deepEqual(checked.map(({ stepId }) => stepId.split(':')[1]), simulationCollectorOrder);
      assert.match(checked.find(({ stepId }) => stepId === 'query:memory_usage').message, /75% limit/);
      const abnormal = checked.find(({ stepId }) => stepId === `query:${fault}`).message;
      const value = scrape.message.match(/\d+(?:\.\d+)?%/)?.[0] ?? scrape.message;
      assert.ok(abnormal.includes(value));
      assert.match(checked.find(({ stepId }) => stepId === 'query:disk_usage').message, /85% limit/);
    }
    const last = timeline.log.at(-1);
    assert.equal(last.atMs, timeline.durationMs);
    assert.equal(last.message, 'AI saves a diagnosis for R2.');
    assert.ok(timeline.log.some(({ message }) => message === 'Investigation starts with a router check.'));
  });
}

test('journal and pulse share the next boundary and Reset removes the complete journal', () => {
  const timeline = getSimulationTimeline('r1', 'prometheus_up');
  const first = getSimulationFrame(timeline, 3500);
  assert.equal(first.current.id, 'send-alert');
  assert.equal(first.logEntries.length, 1);
  assert.equal(first.nextLogAtMs, 3650);
  assert.equal(getSimulationFrame(timeline, 3650).logEntries.length, 2);
  assert.equal(getSimulationFrame(timeline, timeline.durationMs).logEntries.length, timeline.log.length);

  const running = { phase: 'running', mode: 'custom', scenario: { router: 'r1', fault: 'prometheus_up' }, startedAt: '2026-11-23T12:00:00.000Z' };
  const idle = transitionSimulation(running, { type: 'reset' });
  assert.equal(getSimulationSnapshot(idle), null);
  const afterReset = getSimulationFrame(null, timeline.durationMs);
  assert.deepEqual(afterReset?.logEntries ?? [], []);
});
