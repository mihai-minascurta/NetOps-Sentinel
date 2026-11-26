import { simulationQueryEdge } from '../topology.ts';

type NodeRect = { x: number; y: number; width: number; height: number };
type Point = readonly [x: number, y: number];

const wideCard = (x: number, y: number): NodeRect => ({ x, y, width: 184, height: 76 });
const compactCard = (x: number, y: number): NodeRect => ({ x, y, width: 202, height: 74 });

const wide = {
  width: 1220,
  height: 900,
  nodes: {
    r1: wideCard(10, 54),
    r2: wideCard(10, 166),
    prometheus: wideCard(214, 110),
    alertmanager: wideCard(414, 110),
    backend: wideCard(614, 110),
    alerts: wideCard(814, 110),
    incident: wideCard(1014, 110),
    email: wideCard(414, 229),
    db: { x: 70, y: 344, width: 1084, height: 352 },
    investigation: wideCard(1014, 770),
    evidence: wideCard(710, 770),
    ai: wideCard(406, 770),
    mcp: wideCard(102, 770),
  },
};

const compact: typeof wide = {
  width: 680,
  height: 630,
  nodes: {
    r1: compactCard(10, 14),
    r2: compactCard(10, 106),
    prometheus: compactCard(232, 60),
    alertmanager: compactCard(455, 60),
    backend: compactCard(10, 246),
    alerts: compactCard(232, 246),
    incident: compactCard(455, 246),
    email: compactCard(455, 153),
    db: { x: 10, y: 344, width: 636, height: 86 },
    investigation: compactCard(455, 456),
    evidence: compactCard(232, 456),
    ai: compactCard(10, 456),
    mcp: compactCard(10, 546),
  },
};

const right = (node: NodeRect) => node.x + node.width;
const bottom = (node: NodeRect) => node.y + node.height;
const centerX = (node: NodeRect) => node.x + node.width / 2;
const centerY = (node: NodeRect) => node.y + node.height / 2;
const point = ([x, y]: Point) => `${x} ${y}`;
const toward = (from: Point, to: Point, fraction: number): Point => [
  from[0] + (to[0] - from[0]) * fraction,
  from[1] + (to[1] - from[1]) * fraction,
];
const distance = (a: Point, b: Point) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function roundedPath(points: readonly Point[]) {
  let path = `M${point(points[0])}`;
  for (let index = 1; index < points.length - 1; index++) {
    const [previous, corner, next] = points.slice(index - 1, index + 2);
    const incoming = distance(previous, corner);
    const outgoing = distance(corner, next);
    const radius = Math.min(10, incoming / 2, outgoing / 2);
    if (radius === 0) continue;

    const before = toward(corner, previous, radius / incoming);
    const after = toward(corner, next, radius / outgoing);
    path += ` L${point(before)} Q${point(corner)} ${point(after)}`;
  }
  return `${path} L${point(points[points.length - 1])}`;
}

function horizontalFlow(source: NodeRect, target: NodeRect): Point[] {
  return target.x > source.x
    ? [[right(source), centerY(source)], [target.x, centerY(target)]]
    : [[source.x, centerY(source)], [right(target), centerY(target)]];
}

function placeEdges(template: typeof wide, wrapped: boolean) {
  const { width, height, nodes } = template;
  const { r1, r2, prometheus, alertmanager, email, backend, alerts, incident, db, investigation, evidence, ai, mcp } = nodes;
  const scrapeTurn = (right(r1) + prometheus.x) / 2;
  const scrape = (router: NodeRect, portY: number): Point[] => [
    [right(router), centerY(router)], [scrapeTurn, centerY(router)], [scrapeTurn, portY], [prometheus.x, portY],
  ];
  const toHubFromAbove = (node: NodeRect, portX = centerX(node)): Point[] => [[portX, bottom(node)], [portX, db.y]];
  const toHubFromBelow = (node: NodeRect): Point[] => [[centerX(node), node.y], [centerX(node), bottom(db)]];

  const outsideRight = width - 4;
  const webhookX = alertmanager.x + 20;
  const webhookBendY = bottom(alertmanager) + 12;
  const webhookApproachY = backend.y - 12;
  const webhookFlow: Point[] = wrapped ? [
    [webhookX, bottom(alertmanager)], [webhookX, webhookBendY], [email.x - 12, webhookBendY],
    [email.x - 12, webhookApproachY], [centerX(backend), webhookApproachY], [centerX(backend), backend.y],
  ] : horizontalFlow(alertmanager, backend);

  const queryX = wrapped ? outsideRight - 10 : right(investigation) - 36;
  const queryY = wrapped ? prometheus.y - 18 : db.y - 12;
  const querySourceY = centerY(investigation) - 16;
  const query: Point[] = wrapped ? [
    [right(investigation), querySourceY], [queryX, querySourceY],
    [queryX, queryY], [centerX(prometheus), queryY], [centerX(prometheus), prometheus.y],
  ] : [
    [queryX, investigation.y], [queryX, queryY], [centerX(prometheus), queryY], [centerX(prometheus), bottom(prometheus)],
  ];

  const routes: Readonly<Record<string, readonly Point[]>> = {
    'r1-prom': scrape(r1, centerY(prometheus) - 12),
    'r2-prom': scrape(r2, centerY(prometheus) + 12),
    'prom-alert': horizontalFlow(prometheus, alertmanager),
    'alert-backend': webhookFlow,
    'alert-email': [[centerX(alertmanager), bottom(alertmanager)], [centerX(email), email.y]],
    'backend-alerts': horizontalFlow(backend, alerts),
    'alerts-incident': horizontalFlow(alerts, incident),
    'incident-inv': [
      [right(incident), centerY(incident)], [outsideRight, centerY(incident)],
      [outsideRight, centerY(investigation)], [right(investigation), centerY(investigation)],
    ],
    'inv-evidence': horizontalFlow(investigation, evidence),
    'evidence-ai': horizontalFlow(evidence, ai),
    'ai-mcp': wrapped ? [[centerX(ai), bottom(ai)], [centerX(mcp), mcp.y]] : horizontalFlow(ai, mcp),
    'backend-db': toHubFromAbove(backend),
    'alerts-db': toHubFromAbove(alerts),
    'incident-db': toHubFromAbove(incident, incident.x + 37),
    'investigation-db': toHubFromBelow(investigation),
    'evidence-db': toHubFromBelow(evidence),
    'ai-db': toHubFromBelow(ai),
    'mcp-db': wrapped ? [[mcp.x, centerY(mcp)], [4, centerY(mcp)], [4, centerY(db)], [db.x, centerY(db)]] : toHubFromBelow(mcp),
    [simulationQueryEdge.id]: query,
  };

  const placements: Readonly<Record<string, NodeRect>> = nodes;
  const paths = Object.fromEntries(Object.entries(routes).map(([id, points]) => [id, roundedPath(points)]));
  return { width, height, nodes: placements, paths, routes };
}

export function createDashboardLayouts() {
  return { compact: placeEdges(compact, true), wide: placeEdges(wide, false) };
}
