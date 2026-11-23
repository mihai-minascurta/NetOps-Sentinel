import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flowEdges, getPulseTimeline, getPulseTiming, routerIds } from '../src/topology.ts';

const edgesById = new Map(flowEdges.map((edge) => [edge.id, edge]));

test('Alertmanager keeps independent webhook and email receivers', () => {
  const webhook = edgesById.get('alert-backend');
  const email = edgesById.get('alert-email');
  assert.deepEqual([webhook.source, webhook.target], ['alertmanager', 'backend']);
  assert.deepEqual([email.source, email.target], ['alertmanager', 'email']);
});

for (const router of routerIds) {
  test(`${router.toUpperCase()} baseline pulse follows the pipeline and forks at Alertmanager`, () => {
    const cycleStart = 200;
    const timing = getPulseTiming();
    const timeline = getPulseTimeline(router, cycleStart);
    assert.deepEqual(timing, { segmentMs: 1250, cycleMs: 6250, pauseMs: 3000 });
    assert.deepEqual(timeline.map(({ edgeIds }) => edgeIds), [
      [`${router}-prom`], ['prom-alert'], ['alert-backend', 'alert-email'], ['backend-alerts'], ['alerts-incident'],
    ]);
    assert.deepEqual(timeline.map(({ startsAt }) => startsAt), [200, 1450, 2700, 3950, 5200]);
    assert.ok(timeline.every(({ durationMs }) => durationMs === timing.segmentMs));
    assert.equal(timeline.at(-1).startsAt + timeline.at(-1).durationMs, cycleStart + timing.cycleMs);

    let previousTargets = new Set([router]);
    for (const { edgeIds } of timeline) {
      const nextTargets = new Set();
      for (const id of edgeIds) {
        const edge = edgesById.get(id);
        assert.ok(edge, `Pulse must follow a flow edge: ${id}`);
        assert.equal(edge.data.kind, 'flow');
        assert.ok(previousTargets.has(edge.source), `${id} must start where the previous step ended`);
        nextTargets.add(edge.target);
      }
      previousTargets = nextTargets;
    }
    assert.deepEqual([...previousTargets], ['incident']);
  });
}
