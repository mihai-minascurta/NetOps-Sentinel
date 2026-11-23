import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dataEdges, getComponentConnections, getComponentRoute, getSelectedEdgeIds, nodes } from '../src/topology.ts';

const hubLinks = new Map([
  ['backend', 'read / write'],
  ['alerts', 'read / write'],
  ['incident', 'read / write'],
  ['investigation', 'read / write'],
  ['evidence', 'read / write'],
  ['ai', 'read / write'],
  ['mcp', 'read-only'],
]);

test('SQLite has seven bidirectional connections, including read-only MCP access', () => {
  assert.deepEqual(new Map(dataEdges.map(({ source, label }) => [source, label])), hubLinks);
  assert.equal(dataEdges.length, hubLinks.size);
  for (const { target, markerStart, markerEnd } of dataEdges) {
    assert.equal(target, 'db');
    assert.ok(markerStart);
    assert.deepEqual(markerStart, markerEnd);
  }

  const { inputs, outputs } = getComponentConnections('db');
  assert.deepEqual(inputs, outputs);
  assert.deepEqual(new Map(inputs.map(({ id, label }) => [id.replace(/-db$/, ''), label])), hubLinks);
});

test('SQLite stays out of flow traversal and data edges highlight only at their endpoints', () => {
  const devices = nodes.filter((node) => node.type === 'device');
  for (const { id } of devices) {
    const route = getComponentRoute(id);
    const selected = getSelectedEdgeIds(id);
    const expectedDataEdges = id === 'db' ? [...hubLinks.keys()].map((node) => `${node}-db`)
      : hubLinks.has(id) ? [`${id}-db`] : [];
    assert.deepEqual(selected, new Set([...route.edgeIds, ...expectedDataEdges]), id);

    for (const edge of dataEdges) assert.ok(!route.edgeIds.has(edge.id), id);
    if (id !== 'db') assert.ok(!route.nodeIds.has('db'), id);
  }

  assert.deepEqual(getComponentRoute('db').edgeIds, new Set());
  assert.deepEqual(getComponentRoute('email').edgeIds, new Set(['alert-email', 'prom-alert', 'r1-prom', 'r2-prom']));
});
