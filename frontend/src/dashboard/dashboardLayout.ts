import { simulationQueryEdge } from '../topology.ts';

type NodeRect = { x: number; y: number; width: number; height: number };

const card = (x: number, y: number): NodeRect => ({ x, y, width: 190, height: 64 });

const wide = {
  width: 1268,
  height: 904,
  nodes: {
    r1: card(0, 28),
    r2: card(0, 148),
    prometheus: card(214, 88),
    alertmanager: card(428, 88),
    backend: card(642, 88),
    alerts: card(856, 88),
    incident: card(1070, 88),
    email: card(428, 182),
    db: { x: 44, y: 274, width: 1156, height: 466 },
    investigation: card(1070, 822),
    evidence: card(713, 822),
    ai: card(356, 822),
    mcp: card(0, 822),
  },
};

const compact: typeof wide = {
  width: 704,
  height: 604,
  nodes: {
    r1: card(8, 8),
    r2: card(8, 96),
    prometheus: card(230, 52),
    alertmanager: card(492, 52),
    backend: card(8, 234),
    alerts: card(248, 234),
    incident: card(492, 234),
    email: card(492, 140),
    db: { x: 8, y: 322, width: 658, height: 98 },
    investigation: card(492, 444),
    evidence: card(248, 444),
    ai: card(34, 444),
    mcp: card(8, 532),
  },
};

const right = (node: NodeRect) => node.x + node.width;
const bottom = (node: NodeRect) => node.y + node.height;
const centerX = (node: NodeRect) => node.x + node.width / 2;
const centerY = (node: NodeRect) => node.y + node.height / 2;

function horizontalFlow(source: NodeRect, target: NodeRect) {
  return target.x > source.x
    ? `M${right(source)} ${centerY(source)} H${target.x}`
    : `M${source.x} ${centerY(source)} H${right(target)}`;
}

function placeEdges(template: typeof wide, wrapped: boolean) {
  const { width, height, nodes } = template;
  const { r1, r2, prometheus, alertmanager, email, backend, alerts, incident, db, investigation, evidence, ai, mcp } = nodes;
  const scrapeTurn = (right(r1) + prometheus.x) / 2;
  const scrape = (router: NodeRect, portY: number) =>
    `M${right(router)} ${centerY(router)} H${scrapeTurn} V${portY} H${prometheus.x}`;
  const toHubFromAbove = (node: NodeRect, portX = centerX(node)) =>
    `M${portX} ${bottom(node)} V${db.y}`;
  const toHubFromBelow = (node: NodeRect, portX = centerX(node)) =>
    `M${portX} ${node.y} V${bottom(db)}`;

  const outsideRight = width - 1;
  // In the compact view, the alert flow resumes on the left of the next row.
  const webhookFlow = wrapped
    ? `M${alertmanager.x + 20} ${bottom(alertmanager)} V${bottom(alertmanager) + 12} H${email.x - 12} V${backend.y - 12} H${centerX(backend)} V${backend.y}`
    : horizontalFlow(alertmanager, backend);
  const mcpFlow = wrapped
    ? `M${centerX(ai)} ${bottom(ai)} V${mcp.y - 12} H${centerX(mcp)} V${mcp.y}`
    : horizontalFlow(ai, mcp);
  // Use the corridor beside the hub and approach Prometheus from the open side.
  const queryPath = wrapped
    ? `M${right(investigation)} ${centerY(investigation) - 16} H${outsideRight - 11} V${prometheus.y - 18} H${centerX(prometheus)} V${prometheus.y}`
    : `M${right(investigation) - 36} ${investigation.y} V${db.y - 12} H${centerX(prometheus)} V${bottom(prometheus)}`;

  const paths: Readonly<Record<string, string>> = {
    'r1-prom': scrape(r1, prometheus.y + 20),
    'r2-prom': scrape(r2, prometheus.y + 44),
    'prom-alert': horizontalFlow(prometheus, alertmanager),
    'alert-backend': webhookFlow,
    'alert-email': `M${centerX(alertmanager)} ${bottom(alertmanager)} V${email.y}`,
    'backend-alerts': horizontalFlow(backend, alerts),
    'alerts-incident': horizontalFlow(alerts, incident),
    'incident-inv': `M${right(incident)} ${centerY(incident)} H${outsideRight} V${centerY(investigation)} H${right(investigation)}`,
    'inv-evidence': horizontalFlow(investigation, evidence),
    'evidence-ai': horizontalFlow(evidence, ai),
    'ai-mcp': mcpFlow,
    'backend-db': toHubFromAbove(backend),
    'alerts-db': toHubFromAbove(alerts),
    'incident-db': toHubFromAbove(incident, incident.x + 37),
    'investigation-db': toHubFromBelow(investigation),
    'evidence-db': toHubFromBelow(evidence),
    'ai-db': toHubFromBelow(ai),
    'mcp-db': toHubFromBelow(mcp, wrapped ? mcp.x + 12 : centerX(mcp)),
    [simulationQueryEdge.id]: queryPath,
  };

  const placements: Readonly<Record<string, NodeRect>> = nodes;
  return { width, height, nodes: placements, paths };
}

export function createDashboardLayouts() {
  return { compact: placeEdges(compact, true), wide: placeEdges(wide, false) };
}
