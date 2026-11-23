import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edges, getSelectedEdgeIds, nodes, simulationQueryEdge } from '../src/topology.ts';
import { getSimulationFrame, getSimulationTimeline } from '../src/topologySimulationTimeline.ts';

const queryId = simulationQueryEdge.id;
const graph = new Map([...edges, simulationQueryEdge].map((edge) => [edge.id, edge]));
const routerDown = getSimulationTimeline('r1', 'prometheus_up', 'normal');
const routerUp = getSimulationTimeline('r2', 'cpu_usage', 'normal');

test('the alert workflow forks after grouping and makes SQLite gray only at the first write', () => {
  const { steps } = routerDown;
  assert.deepEqual(steps.slice(0, 9).map(({ startsAtMs }) => startsAtMs),
    [0, 2500, 5000, 6000, 8500, 11000, 11800, 12600, 15100]);
  assert.deepEqual(steps[0].moves.map(({ edgeId }) => edgeId), ['r1-prom']);
  assert.deepEqual(steps[2].currentNodeIds, ['alertmanager']);
  assert.deepEqual(steps[2].moves, []);
  assert.equal(steps[2].durationMs, 1000);
  assert.deepEqual(steps[3].moves.map(({ edgeId }) => edgeId), ['alert-backend', 'alert-email']);
  assert.deepEqual(steps[5].moves.map(({ from, to }) => [from, to]), [['db', 'alerts']]);
  assert.deepEqual(steps[6].moves.map(({ from, to }) => [from, to]), [['alerts', 'db']]);
  assert.deepEqual(steps[8].moves.map(({ from, to }) => [from, to]), [['incident', 'db']]);

  assert.deepEqual(getSimulationFrame(routerDown, 2499).visitedNodes, new Set());
  assert.deepEqual(getSimulationFrame(routerDown, 2500).visitedNodes, new Set(['prometheus']));
  assert.equal(getSimulationFrame(routerDown, 12599).visitedNodes.has('db'), false);
  assert.equal(getSimulationFrame(routerDown, 12600).visitedNodes.has('db'), true);
});

test('the engine saves availability first and runs further collectors only when the router is up', () => {
  assert.equal(routerDown.durationMs, 37300);
  assert.equal(routerUp.durationMs, 66300);
  assert.deepEqual(routerUp.steps[0].moves.map(({ edgeId }) => edgeId), ['r2-prom']);
  assert.deepEqual(routerDown.steps.filter((step) => step.moves[0]?.edgeId === queryId).map(({ label }) => label),
    ['Query availability']);

  const expectedQueries = ['availability', 'CPU usage', 'memory usage', 'disk usage', 'network interfaces', 'network errors (RX + TX)'];
  const firstQuery = routerUp.steps.findIndex((step) => step.moves[0]?.edgeId === queryId);
  for (const [index, metric] of expectedQueries.entries()) {
    const [query, record, write] = routerUp.steps.slice(firstQuery + index * 3, firstQuery + index * 3 + 3);
    assert.equal(query.label, `Query ${metric}`);
    assert.deepEqual([query, record, write].map((step) => step.moves[0].edgeId), [queryId, 'inv-evidence', 'evidence-db']);
    assert.equal(write.moves[0].to, 'db');
  }
});

test('AI receives metadata directly, evidence via MCP, then writes the diagnosis', () => {
  for (const timeline of [routerDown, routerUp]) {
    assert.deepEqual(timeline.steps.slice(-8).map((step) => {
      const { edgeId, from, to } = step.moves[0];
      return [edgeId, from, to];
    }), [
      ['investigation-db', 'db', 'investigation'], ['investigation-db', 'investigation', 'db'],
      ['evidence-ai', 'evidence', 'ai'], ['ai-db', 'db', 'ai'],
      ['ai-mcp', 'ai', 'mcp'], ['mcp-db', 'db', 'mcp'],
      ['ai-mcp', 'mcp', 'ai'], ['ai-db', 'ai', 'db'],
    ]);
    for (const move of timeline.steps.flatMap((step) => step.moves)) {
      const edge = graph.get(move.edgeId);
      assert.deepEqual([move.from, move.to], move.reverse ? [edge.target, edge.source] : [edge.source, edge.target]);
    }
  }
});

test('Fast halves every step and both speeds share one final frame without replay', () => {
  for (const [router, fault, normal] of [['r1', 'prometheus_up', routerDown], ['r2', 'cpu_usage', routerUp]]) {
    const fast = getSimulationTimeline(router, fault, 'fast');
    assert.equal(fast.durationMs, normal.durationMs / 2);
    fast.steps.forEach((step, index) => {
      const base = normal.steps[index];
      assert.deepEqual(step, {
        ...base, startsAtMs: base.startsAtMs / 2, endsAtMs: base.endsAtMs / 2, durationMs: base.durationMs / 2,
      });
    });

    const final = getSimulationFrame(normal, normal.durationMs);
    assert.equal(final.current, null);
    assert.deepEqual(final.visitedNodes, new Set([
      'prometheus', 'alertmanager', 'backend', 'email', 'alerts', 'db', 'incident', 'investigation', 'evidence', 'ai', 'mcp',
    ]));
    assert.deepEqual(getSimulationFrame(fast, fast.durationMs), final);
    assert.deepEqual(getSimulationFrame(normal, normal.durationMs * 2), final);
  }
});

test('the dev-only query edge stays outside the selection graph', () => {
  assert.ok(!edges.some((edge) => edge.id === queryId));
  for (const { id } of nodes) assert.ok(!getSelectedEdgeIds(id).has(queryId), id);
});
