import { useId, useState } from 'react';
import {
  Activity, Bell, BrainCircuit, ClipboardList, Database, FileText,
  GitBranch, ListChecks, Mail, Search, Server, Webhook, Wrench, type LucideIcon,
} from 'lucide-react';
import type { DeviceKind } from '../topology';
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

function WireLabel({ edge }: { edge: DashboardPipelineData['edges'][number] }) {
  if (edge.labels.length === 0) return null;

  const width = Math.max(...edge.labels.map((line) => line.length)) * 6.1 + 9;
  const height = edge.labels.length * 12 + 4;

  return (
    <g className="dash-wire-label" data-kind={edge.kind} transform={`translate(${edge.labelAt.x} ${edge.labelAt.y})`}>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="4" />
      {edge.labels.map((line, index) => (
        <text key={index} y={(index - (edge.labels.length - 1) / 2) * 12} textAnchor="middle" dominantBaseline="central">
          {line}
        </text>
      ))}
    </g>
  );
}

export default function DashboardPipeline({ pipeline }: { pipeline: DashboardPipelineData }) {
  const marker = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <section className="dash-panel dash-pipeline" aria-labelledby="dashboard-pipeline-title">
      <div className="dash-panel__heading">
        <h2 id="dashboard-pipeline-title"><GitBranch aria-hidden="true" />Alert &amp; Investigation Pipeline</h2>
        <ul className="dash-pipeline__legend" aria-label="Connection types">
          <li>Flow</li>
          <li data-kind="data">SQLite data</li>
        </ul>
      </div>
      <div className="dash-pipeline__canvas">
        <svg
          className="dash-pipeline__graph"
          viewBox={`0 0 ${pipeline.width} ${pipeline.height}`}
          role="group"
          aria-label="Pipeline components"
        >
          <defs>
            <marker id={`${marker}-flow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path className="dash-arrow" d="M0 0.5 L6 3.5 L0 6.5 Z" />
            </marker>
            <marker id={`${marker}-active`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path className="dash-arrow dash-arrow--active" d="M0 0.5 L6 3.5 L0 6.5 Z" />
            </marker>
            <marker id={`${marker}-data`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
              <path className="dash-arrow--data" d="M1 1 L6 3.5 L1 6" />
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
                data-read-only={edge.readOnly || undefined}
                data-active={edge.active || undefined}
                className="dash-wire"
                d={edge.path}
                markerStart={edge.kind === 'data' ? `url(#${marker}-data)` : undefined}
                markerEnd={`url(#${marker}-${edge.kind === 'data' ? 'data' : edge.active ? 'active' : 'flow'})`}
              />
            ))}
            {pipeline.edges.map((edge) => <WireLabel key={edge.id} edge={edge} />)}
          </g>
          {pipeline.nodes.map((node) => {
            const Icon = nodeIcons[node.kind];
            const selected = node.id === selectedId;

            return (
              <foreignObject key={node.id} x={node.x} y={node.y} width={node.width} height={node.height}>
                <button
                  className="dash-node"
                  type="button"
                  data-node-id={node.id}
                  data-kind={node.kind}
                  data-tone={node.health.tone}
                  aria-label={`${node.title}, ${node.health.label}`}
                  aria-pressed={selected}
                  onClick={() => setSelectedId(selected ? null : node.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{node.title}</span>
                  <i className="dash-indicator" aria-hidden="true" />
                </button>
              </foreignObject>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
