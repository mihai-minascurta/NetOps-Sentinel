import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flowEdges, getPulseTimeline, pulseCycleMs, pulseSegmentMs, routerIds } from '../src/topology.ts';

const edgesById = new Map(flowEdges.map((edge) => [edge.id, edge]));

test('Alertmanager keeps independent webhook and email receivers', () => {
  const webhook = edgesById.get('alert-backend');
  const email = edgesById.get('alert-email');
  assert.deepEqual([webhook.source, webhook.target], ['alertmanager', 'backend']);
  assert.deepEqual([email.source, email.target], ['alertmanager', 'email']);
});

for (const router of routerIds) {
  test(`${router.toUpperCase()} pulse follows the pipeline and forks at Alertmanager`, () => {
    const cycleStart = 200;
    const timeline = getPulseTimeline(router, cycleStart);

    assert.deepEqual(timeline, [
      { edgeIds: [`${router}-prom`], startsAt: 200 },
      { edgeIds: ['prom-alert'], startsAt: 1450 },
      { edgeIds: ['alert-backend', 'alert-email'], startsAt: 2700 },
      { edgeIds: ['backend-alerts'], startsAt: 3950 },
      { edgeIds: ['alerts-incident'], startsAt: 5200 },
    ]);
    assert.equal(timeline.at(-1).startsAt + pulseSegmentMs, cycleStart + pulseCycleMs);
    assert.equal(pulseCycleMs, 6250);

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
