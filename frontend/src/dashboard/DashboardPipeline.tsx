import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bell, BrainCircuit, ClipboardList, Database, FileText,
  ListChecks, Mail, Search, Server, Webhook, Wrench, type LucideIcon,
} from 'lucide-react';
import type { DeviceKind } from '../topology';
import { createDashboardLayouts } from './dashboardLayout';
import type { DashboardPipelineData } from './dashboardSample';

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

export default function DashboardPipeline({ pipeline }: { pipeline: DashboardPipelineData }) {
  const marker = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const layouts = useMemo(createDashboardLayouts, []);
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
            <marker id={`${marker}-flow`} markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path className="dash-arrow" d="M0 0.5 L6 3.5 L0 6.5 Z" />
            </marker>
          </defs>
          <g aria-hidden="true">
            {pipeline.edges.map((edge) => (
              <path
                key={edge.id}
                data-edge-id={edge.id}
                data-source={edge.source}
                data-target={edge.target}
                data-kind={edge.kind}
                className="dash-wire"
                d={layout.paths[edge.id]}
                markerEnd={edge.kind === 'flow' ? `url(#${marker}-flow)` : undefined}
              />
            ))}
          </g>
          {pipeline.nodes.map((node) => {
            const Icon = nodeIcons[node.kind];
            const selected = node.id === selectedId;

            return (
              <foreignObject key={node.id} {...layout.nodes[node.id]}>
                <button
                  className="dash-node"
                  type="button"
                  data-node-id={node.id}
                  data-kind={node.kind}
                  aria-label={node.health ? `${node.title}, ${node.health.label}` : undefined}
                  aria-pressed={selected}
                  onClick={() => setSelectedId(selected ? null : node.id)}
                >
                  <Icon aria-hidden="true" />
                  <span className="dash-node__text">
                    <span className="dash-node__name">
                      {node.title}
                      {node.health && <i className="dash-indicator" data-tone={node.health.tone} aria-hidden="true" />}
                    </span>
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
