import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bell, BrainCircuit, ClipboardList, Database, FileText,
  ListChecks, Mail, Search, Server, Webhook, Wrench, type LucideIcon,
} from 'lucide-react';
import MovingPulse from '../components/MovingPulse';
import { simulationQueryEdge, type DeviceKind, type EdgeActivity } from '../topology';
import type { getSimulationFrame } from '../topologySimulationTimeline';
import { createDashboardLayouts } from './dashboardLayout';
import type { DashboardPipelineData, DashboardRouter } from './dashboardSample';

const nodeIcons: Record<DeviceKind, LucideIcon> = {
  router: Server,
  monitoring: Activity,
  alert: Bell,
  notification: Mail,
  backend: Webhook,
  alerts: ListChecks,
  incident: ClipboardList,
  investigation: Search,
  evidence: FileText,
  ai: BrainCircuit,
  database: Database,
  mcp: Wrench,
};

type Props = {
  pipeline: DashboardPipelineData;
  routers: readonly DashboardRouter[];
  simulationActive: boolean;
  simulationFrame: ReturnType<typeof getSimulationFrame>;
  edgeActivities: ReadonlyMap<string, EdgeActivity>;
};

const queryEdge = {
  id: simulationQueryEdge.id,
  source: simulationQueryEdge.source,
  target: simulationQueryEdge.target,
  kind: 'query',
} as const;

export default function DashboardPipeline({ pipeline, routers, simulationActive, simulationFrame, edgeActivities }: Props) {
  const marker = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const layouts = useMemo(() => createDashboardLayouts(), []);
  const [variant, setVariant] = useState<'compact' | 'wide'>('compact');
  const activeVariant = useRef<'compact' | 'wide'>('compact');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let lastWidth = 0;
    let lastHeight = 0;
    const chooseLayout = (width: number, height: number) => {
      if (Math.abs(width - lastWidth) <= 1 && Math.abs(height - lastHeight) <= 1) return;
      lastWidth = width;
      lastHeight = height;
      const next = width >= layouts.wide.width && height >= layouts.wide.height ? 'wide' : 'compact';
      if (next === activeVariant.current) return;
      activeVariant.current = next;
      setVariant(next);
    };
    const observer = new ResizeObserver(([{ contentRect }]) => chooseLayout(contentRect.width, contentRect.height));
    chooseLayout(viewport.clientWidth, viewport.clientHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [layouts]);

  const layout = layouts[variant];
  const currentMoves = simulationFrame?.current?.moves ?? [];
  const queryVisible = currentMoves.some(({ edgeId }) => edgeId === queryEdge.id) || simulationFrame?.visitedEdges.has(queryEdge.id);
  const visibleEdges = queryVisible ? [...pipeline.edges, queryEdge] : pipeline.edges;

  return (
    <section className="dash-pipeline" aria-label="Alert and investigation pipeline">
      <div className="dash-pipeline__viewport" ref={viewportRef}>
        <svg
          className="dash-pipeline__graph"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Pipeline components"
        >
          <defs>
            <linearGradient id={`${marker}-beam`}>
              <stop offset="0%" stopColor="var(--dash-beam-orange)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--dash-beam-orange)" stopOpacity=".85" />
              <stop offset="83%" stopColor="var(--dash-beam-gold)" />
              <stop offset="100%" stopColor="var(--dash-beam-core)" />
            </linearGradient>
            {['idle', 'current', 'visited'].map((phase) => (
              <marker key={phase} id={`${marker}-${phase}`} markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
                <path className="dash-arrow" data-playback={phase} d="M0 0.5 L6 3.5 L0 6.5 Z" />
              </marker>
            ))}
          </defs>
          <g aria-hidden="true">
            {visibleEdges.map((edge) => {
              const move = currentMoves.find(({ edgeId }) => edgeId === edge.id);
              const phase = move ? 'current' : simulationFrame?.visitedEdges.has(edge.id) ? 'visited' : 'idle';
              const arrow = `url(#${marker}-${phase})`;

              return (
                <path
                  key={edge.id}
                  data-edge-id={edge.id}
                  data-source={edge.source}
                  data-target={edge.target}
                  data-kind={edge.kind}
                  data-playback={phase}
                  className="dash-wire"
                  d={layout.paths[edge.id]}
                  markerStart={move?.reverse ? arrow : undefined}
                  markerEnd={!move?.reverse && (move || edge.kind !== 'data') ? arrow : undefined}
                />
              );
            })}
          </g>
          <g aria-hidden="true">
            {visibleEdges.flatMap((edge) => edgeActivities.get(edge.id)?.pulses?.map((pulse) => (
              <MovingPulse
                key={`${variant}-${pulse.id}`}
                className="dash-pulse"
                path={layout.paths[edge.id]}
                startsAt={pulse.startsAt}
                durationMs={pulse.durationMs}
                reverse={pulse.reverse}
              >
                <g className="dash-pulse__light" transform={edge.kind === 'flow' ? undefined : 'scale(.75)'}>
                  <path d="M-28 0 Q-13 -5 0 -4.5 C7 -4 7 4 0 4.5 Q-13 5 -28 0Z" fill={`url(#${marker}-beam)`} />
                  <path className="dash-pulse__core" d="M-9 0 H2" />
                </g>
              </MovingPulse>
            )) ?? [])}
          </g>
          {pipeline.nodes.map((node) => {
            const Icon = nodeIcons[node.kind];
            const selected = node.id === selectedId;
            const router = routers.find(({ id }) => id === node.id);
            const status = simulationActive && router ? router.fault?.badge ?? router.health.label.toUpperCase() : undefined;
            const tone = simulationActive && router ? router.fault?.severity ?? router.health.tone : undefined;
            const label = router && [node.title, router.health.label, router.fault?.badge].filter(Boolean).join(', ');
            const current = simulationFrame?.current?.currentNodeIds.includes(node.id);
            const visited = simulationFrame?.visitedNodes.has(node.id);

            return (
              <foreignObject key={node.id} {...layout.nodes[node.id]}>
                <button
                  className="dash-node"
                  type="button"
                  data-node-id={node.id}
                  data-kind={node.kind}
                  data-simulation-tone={tone}
                  data-visited={visited || undefined}
                  aria-label={label}
                  aria-current={current ? 'step' : undefined}
                  aria-pressed={selected}
                  onClick={() => setSelectedId(selected ? null : node.id)}
                >
                  <Icon aria-hidden="true" />
                  <span className="dash-node__text">
                    <span className="dash-node__name">
                      {node.title}
                      {router && <i className="dash-indicator" data-tone={router.health.tone} aria-hidden="true" />}
                    </span>
                    {status && <span className="dash-node__status" data-tone={tone}>{status}</span>}
                    {node.subtitle && <span className="dash-node__subtitle">{node.subtitle}</span>}
                  </span>
                </button>
              </foreignObject>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
